const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Configuraciones de Seguridad (Idealmente esto debe estar en Firebase Secret Manager o Variables de Entorno)
const PEPPER = "V3_ORANGE_APP_SECURE_PEPPER_2026"; 

// Helper: Generar código de negocio único (4 caracteres alfanuméricos)
async function generateUniqueBusinessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let isUnique = false;
    while (!isUnique) {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const snapshot = await db.collection('businesses').where('businessCode', '==', code).get();
        if (snapshot.empty) isUnique = true;
    }
    return code;
}

// ============================================================================
// 1. REGISTRO ATÓMICO DE NEGOCIOS
// ============================================================================
exports.createBusiness = functions.https.onCall(async (data, context) => {
    try {
        const { email, password, name, document, country, state, municipality, address, ownerName, ownerDocument, ownerPhone, logoUrl } = data;

        if (!email || !password || !name) {
            throw new functions.https.HttpsError('invalid-argument', 'Faltan datos obligatorios');
        }

        // 1. Crear usuario en Auth
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: ownerName,
        });

        const businessId = userRecord.uid;
        const businessCode = await generateUniqueBusinessCode();

        // 2. Asignar Custom Claims
        await auth.setCustomUserClaims(businessId, {
            businessId: businessId,
            role: 'owner',
            businessCode: businessCode
        });

        // 3. Crear lote atómico (Batch)
        const batch = db.batch();

        const businessRef = db.collection('businesses').doc(businessId);
        batch.set(businessRef, {
            name,
            document,
            country,
            state,
            municipality,
            address,
            ownerName,
            ownerDocument,
            ownerPhone,
            email,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            logoUrl: logoUrl || null,
            businessCode: businessCode,
            ownerUid: businessId
        });

        const storeRef = db.collection('businesses').doc(businessId).collection('stores').doc();
        batch.set(storeRef, {
            name: "Sede Principal",
            address: address,
            isMain: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            businessCode: businessCode,
            Id_tienda: storeRef.id
        });

        await batch.commit();

        return { success: true, businessId, businessCode };
    } catch (error) {
        console.error("Error en createBusiness:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});


// ============================================================================
// 2. INICIO DE SESIÓN DE EMPLEADOS (VERIFICACIÓN DE PIN Y GENERACIÓN DE TOKEN)
// ============================================================================
exports.verifyEmployeePin = functions.https.onCall(async (data, context) => {
    const { pin } = data; // Formato esperado: 10 caracteres (4 código de empresa + 6 PIN)
    
    if (!pin || typeof pin !== 'string' || pin.length !== 10) {
        throw new functions.https.HttpsError('invalid-argument', 'Formato de PIN de acceso inválido.');
    }

    const businessCode = pin.substring(0, 4).toUpperCase();
    const plainPin = pin.substring(4);
    
    // --- RATE LIMITING TRANSACCIONAL POR IP EN FIRESTORE ---
    const clientIp = context.rawRequest ? context.rawRequest.ip : 'unknown';
    const rateRef = db.collection('rate_limits').doc(clientIp.replace(/[.#$[\]]/g, '_'));
    
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(rateRef);
        const currentAttempts = doc.exists ? (doc.data().attempts || 0) : 0;
        
        if (currentAttempts >= 5) {
            throw new functions.https.HttpsError('resource-exhausted', 'Demasiados intentos fallidos. Bloqueo temporal activo.');
        }
        
        transaction.set(rateRef, { attempts: currentAttempts + 1 }, { merge: true });
    });

    // --- BÚSQUEDA DEL EMPLEADO Y VALIDACIÓN DEL HASH ---
    const hashToVerify = crypto.createHash('sha256').update(businessCode + plainPin + PEPPER).digest('hex');

    const employeesSnapshot = await db.collectionGroup('employees')
        .where('businessCode', '==', businessCode)
        .where('pin', '==', hashToVerify)
        .where('status', '==', 'ACTIVO')
        .limit(1)
        .get();

    if (employeesSnapshot.empty) {
        // Loguear intento de ataque
        await db.collection('system_notifications').add({
            type: 'FAILED_LOGIN_ATTEMPT',
            businessCode: businessCode,
            ip: clientIp,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        throw new functions.https.HttpsError('unauthenticated', 'Credenciales incorrectas');
    }

    const employeeDoc = employeesSnapshot.docs[0];
    const employeeData = employeeDoc.data();
    
    // --- REGLAS DE BLOQUEO DE LA CUENTA ---
    if (employeeData.failed_attempts >= 3) {
        throw new functions.https.HttpsError('permission-denied', 'Cuenta bloqueada por múltiples intentos fallidos. Contacte al administrador.');
    }

    // Validación del Negocio
    const businessId = employeeDoc.ref.parent.parent.id;
    const businessDoc = await db.collection('businesses').doc(businessId).get();
    const bData = businessDoc.data();
    // Si el status es undefined (negocios pre-V3) asumimos que está activo
    if (!businessDoc.exists || (bData.status !== undefined && bData.status !== 'active')) {
         throw new functions.https.HttpsError('permission-denied', 'El negocio no se encuentra activo o ha sido suspendido.');
    }

    await employeeDoc.ref.update({ failed_attempts: 0 });
    await rateRef.delete(); // Limpiar el bloqueo IP tras éxito
    
    const requiresPinChange = employeeData.requirePinChange === true;

    // --- GENERACIÓN DEL CUSTOM TOKEN ---
    const customToken = await auth.createCustomToken(employeeDoc.id, {
        businessId: businessId,
        role: employeeData.role,
        businessCode: businessCode,
        isEmployee: true,
        requiresPinChange: requiresPinChange
    });

    return { token: customToken, businessId: businessId, requiresPinChange };
});

// ============================================================================
// 2.5 CREACIÓN DE EMPLEADOS (GENERACIÓN DE HASH SEGURO)
// ============================================================================
exports.createEmployee = functions.https.onCall(async (data, context) => {
    // Verificar si está autenticado
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión para realizar esta acción.');
    }
    
    // Solo Propietario o Admin puede crear.
    // Verificamos si tiene el custom claim 'owner'/'Administrador', O si su UID coincide con el businessId (ya que el Propietario es el dueño del documento)
    const isOwnerByUid = context.auth.uid === data.businessId;
    const hasRoleClaim = context.auth.token.role === 'owner' || context.auth.token.role === 'Administrador';
    
    if (!isOwnerByUid && !hasRoleClaim) {
         throw new functions.https.HttpsError('permission-denied', 'No tiene permisos para crear empleados.');
    }

    const { name, documentId, role, modules, phone, email, businessId } = data;
    
    if (!name || !documentId || !role || !businessId) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos obligatorios para crear el empleado.');
    }

    // Obtener el businessCode del negocio
    const businessDoc = await db.collection('businesses').doc(businessId).get();
    if (!businessDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Negocio no encontrado.');
    }
    const businessCode = businessDoc.data().businessCode;
    
    if (!businessCode) {
        throw new functions.https.HttpsError('failed-precondition', 'El negocio no tiene un código asignado. Contacte soporte.');
    }

    // Verificar que la cédula no exista (opcional pero recomendado)
    const empSnap = await db.collection('businesses').doc(businessId).collection('employees')
        .where('documentId', '==', documentId)
        .where('status', '!=', 'ELIMINADO')
        .get();
        
    if (!empSnap.empty) {
        throw new functions.https.HttpsError('already-exists', 'Ya existe un empleado activo con esta cédula.');
    }

    // Verificar correo
    if (email) {
        const emailSnap = await db.collection('businesses').doc(businessId).collection('employees')
            .where('email', '==', email)
            .where('status', '!=', 'ELIMINADO')
            .get();
            
        if (!emailSnap.empty) {
            throw new functions.https.HttpsError('already-exists', 'Ya existe un empleado activo con este correo.');
        }
    }

    // Generar PIN aleatorio de 6 dígitos
    const randomPinStr = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hashear PIN V3: SHA256(businessCode + PIN + PEPPER)
    const newHash = crypto.createHash('sha256').update(businessCode + randomPinStr + PEPPER).digest('hex');

    const newEmpRef = db.collection('businesses').doc(businessId).collection('employees').doc();
    
    await newEmpRef.set({
        name,
        documentId,
        role,
        modules: modules || [],
        phone: phone || '',
        email: email || '',
        pin: newHash,
        businessCode: businessCode,
        businessId: businessId,
        status: 'ACTIVO',
        failed_attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { 
        success: true, 
        employeeId: newEmpRef.id,
        plainPin: randomPinStr,
        businessCode: businessCode
    };
});

exports.resetEmployeePin = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debe iniciar sesión para realizar esta acción.');
    }
    
    const { employeeId, businessId } = data;
    if (!employeeId || !businessId) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos obligatorios.');
    }
    
    // Validar permisos
    const isOwnerByUid = context.auth.uid === businessId;
    const hasRoleClaim = context.auth.token.role === 'owner' || context.auth.token.role === 'Administrador';
    
    if (!isOwnerByUid && !hasRoleClaim) {
         throw new functions.https.HttpsError('permission-denied', 'No tiene permisos para modificar empleados.');
    }

    const businessDoc = await db.collection('businesses').doc(businessId).get();
    if (!businessDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Negocio no encontrado.');
    }
    
    const businessCode = businessDoc.data().businessCode;
    
    const randomPinStr = Math.floor(100000 + Math.random() * 900000).toString();
    const newHash = crypto.createHash('sha256').update(businessCode + randomPinStr + PEPPER).digest('hex');

    await db.collection('businesses').doc(businessId).collection('employees').doc(employeeId).update({
        pin: newHash,
        failed_attempts: 0 // Resetear intentos por si estaba bloqueado
    });
    
    return {
        success: true,
        plainPin: randomPinStr,
        businessCode: businessCode
    };
});



// ============================================================================
// 3. HERRAMIENTA DE MIGRACIÓN Y MANTENIMIENTO V3
// ============================================================================
exports.migrateV3Data = functions.https.onCall(async (data, context) => {
    // Validar Seguridad (Comentado temporalmente para facilitar pruebas, en PRD debe estar activado)
    // if (!context.auth || context.auth.token.role !== 'SuperAdmin') {
    //     throw new functions.https.HttpsError('permission-denied', 'Solo administradores globales pueden ejecutar la migración.');
    // }

    const businessesSnapshot = await db.collection('businesses').get();
    let migratedBusinesses = 0;
    let migratedEmployees = 0;

    for (const bDoc of businessesSnapshot.docs) {
        const bData = bDoc.data();
        let currentBusinessCode = bData.businessCode;

        // Migrar Documento del Negocio y Claims de Autenticación
        const ownerUid = bData.ownerUid || bDoc.id;
        if (!currentBusinessCode || !bData.status) {
            if (!currentBusinessCode) currentBusinessCode = await generateUniqueBusinessCode();
            await bDoc.ref.update({
                businessCode: currentBusinessCode,
                ownerUid: ownerUid,
                status: bData.status || 'active'
            });
            migratedBusinesses++;
        }
        
        // Asignar Custom Claims al Propietario (Siempre forzarlo para garantizar que las reglas V3 apliquen)
        try {
            await auth.setCustomUserClaims(ownerUid, {
                businessId: bDoc.id,
                role: 'owner',
                businessCode: currentBusinessCode
            });
        } catch (error) {
            console.error(`Error asignando claims al owner ${ownerUid}:`, error);
        }

        // Migrar Empleados y Forzar Reseteo de PIN Aleatorio
        const employeesSnap = await bDoc.ref.collection('employees').get();
        for (const eDoc of employeesSnap.docs) {
            const eData = eDoc.data();
            
            // Generar nuevo PIN Aleatorio de 6 digitos (100000 - 999999)
            const randomPinStr = Math.floor(100000 + Math.random() * 900000).toString();
            const newHash = crypto.createHash('sha256').update(currentBusinessCode + randomPinStr + PEPPER).digest('hex');

            await eDoc.ref.update({
                businessId: bDoc.id,
                businessCode: currentBusinessCode,
                pin: newHash,
                temporaryPin: randomPinStr, // Se guardará temporalmente para que el dueño se lo dicte al empleado
                requirePinChange: true,
                failed_attempts: eData.failed_attempts || 0
            });
            migratedEmployees++;
        }

        // Migrar Tiendas (Stores)
        const storesSnap = await bDoc.ref.collection('stores').get();
        if (storesSnap.empty) {
            // Si no hay tiendas, crear "Sede Principal"
            const storeRef = bDoc.ref.collection('stores').doc();
            await storeRef.set({
                name: "Sede Principal",
                address: bData.address || "Dirección Principal",
                isMain: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                businessCode: currentBusinessCode,
                Id_tienda: storeRef.id
            });
        } else {
            // Si hay tiendas, asegurar que tengan Id_tienda y businessCode
            for (const sDoc of storesSnap.docs) {
                const sData = sDoc.data();
                if (!sData.Id_tienda || !sData.businessCode) {
                    await sDoc.ref.update({
                        Id_tienda: sData.Id_tienda || sDoc.id,
                        businessCode: currentBusinessCode
                    });
                }
            }
        }

        // Migrar Turnos (Shifts)
        const shiftsSnap = await bDoc.ref.collection('shifts').get();
        for (const shDoc of shiftsSnap.docs) {
            const shData = shDoc.data();
            if (!shData.businessId || !shData.businessCode) {
                await shDoc.ref.update({
                    businessId: bDoc.id,
                    businessCode: currentBusinessCode
                });
            }
        }

        // Migrar Login Audits (Logins)
        const loginSnap = await bDoc.ref.collection('login').get();
        for (const lDoc of loginSnap.docs) {
            const lData = lDoc.data();
            if (!lData.businessId || !lData.businessCode) {
                await lDoc.ref.update({
                    businessId: bDoc.id,
                    businessCode: currentBusinessCode
                });
            }
        }
    }

    return { 
        success: true, 
        message: `Migración masiva V3 completada exitosamente. Negocios migrados: ${migratedBusinesses}, Empleados re-hasheados: ${migratedEmployees}` 
    };
});
