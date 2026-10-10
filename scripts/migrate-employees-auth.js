const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Inicializar SDK
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

try {
    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`El archivo NO existe en: ${serviceAccountPath}`);
    }
    
    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountContent);
    
    console.log("✅ Service Account Key cargado. Project:", serviceAccount.project_id);
    
    admin.initializeApp({
        credential: admin.cert(serviceAccount)
    });
} catch (error) {
    console.error("❌ Error cargando Service Account Key:");
    console.error("   Mensaje:", error.message);
    console.error("   Stack:", error.stack);
    console.error("👉 Ruta verificada:", serviceAccountPath);
    process.exit(1);
}

const db = getFirestore();
const auth = getAuth();

// Configuración de Hash (Debe coincidir con la app cliente)
const PEPPER = "V3_ORANGE_APP_SECURE_PEPPER_2026";

async function hashPin(businessCode, plainPin) {
    return crypto.createHash('sha256')
        .update(businessCode + plainPin + PEPPER)
        .digest('hex');
}

async function runMigration() {
    console.log("Iniciando migración de empleados a Firebase Auth...");
    const csvData = [];
    csvData.push("BusinessCode,EmployeeName,EmployeeId,PIN,Email,UID");

    let totalMigrated = 0;
    
    try {
        const businessesSnap = await db.collection('businesses').get();
        console.log(`Encontrados ${businessesSnap.size} negocios.`);

        for (const businessDoc of businessesSnap.docs) {
            const businessData = businessDoc.data();
            const businessCode = businessData.businessCode;
            const businessId = businessDoc.id;

            if (!businessCode) {
                console.warn(`⚠️ Negocio ${businessId} no tiene businessCode. Saltando...`);
                continue;
            }

            const employeesSnap = await db.collection(`businesses/${businessId}/employees`).get();
            
            for (const empDoc of employeesSnap.docs) {
                const empData = empDoc.data();
                const empId = empDoc.id;

                // Generar PIN aleatorio de 6 dígitos
                const plainPin = Math.floor(100000 + Math.random() * 900000).toString();
                
                const authEmail = `${businessCode.toLowerCase()}-${empId}@orange-app.local`;

                try {
                    let userRecord;
                    
                    // Intentar crear
                    try {
                        userRecord = await auth.createUser({
                            email: authEmail,
                            password: plainPin,
                            displayName: empData.name,
                        });
                        console.log(`✅ Creado: ${empData.name} (${businessCode})`);
                    } catch (createError) {
                        // Si ya existe, buscar y actualizar
                        if (createError.code === 'auth/email-already-exists') {
                            userRecord = await auth.getUserByEmail(authEmail);
                            await auth.updateUser(userRecord.uid, {
                                password: plainPin,
                                displayName: empData.name,
                            });
                            console.log(`♻️  Actualizado: ${empData.name} (${businessCode})`);
                        } else {
                            throw createError;
                        }
                    }
                    
                    const uid = userRecord.uid;

                    // Asignar Custom Claims
                    await auth.setCustomUserClaims(uid, {
                        businessId: businessId,
                        employeeId: empId,
                        role: empData.role || 'Empleado',
                        businessCode: businessCode,
                        isEmployee: true
                    });

                    // Hashear PIN
                    const hashedPin = await hashPin(businessCode, plainPin);

                    // Actualizar Firestore
                    await empDoc.ref.update({
                        authUid: uid,
                        authEmail: authEmail,
                        pin: hashedPin,
                        temporaryPin: plainPin,
                        requirePinChange: true
                    });

                    // Agregar al CSV
                    csvData.push(`${businessCode},"${empData.name}",${empId},${plainPin},${authEmail},${uid}`);
                    totalMigrated++;

                } catch (error) {
                    console.error(`❌ Error migrando empleado ${empData.name} (${empId}):`, error.message);
                }
            }
        }

        // Guardar CSV
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputPath = path.join(outputDir, 'employees-migration.csv');
        fs.writeFileSync(outputPath, csvData.join('\n'));

        console.log(`\n🎉 Migración completada exitosamente.`);
        console.log(`📊 Total de empleados migrados: ${totalMigrated}`);
        console.log(`📄 Archivo CSV generado en: ${outputPath}`);
        console.log(`⚠️ IMPORTANTE: Distribuye los PINs del CSV a los empleados para que puedan iniciar sesión.`);

    } catch (error) {
        console.error("❌ Error durante la migración:", error);
    }
}

// Iniciar
runMigration();
