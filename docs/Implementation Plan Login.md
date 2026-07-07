# PLAN DE IMPLEMENTACIÓN V3: MÓDULO DE AUTENTICACIÓN Y SEGURIDAD MULTI-TENANT (BANCARIO)

## 1. Flujo de Inicio de Sesión (Login)
* El dropdown "Tipo de Usuario" debe mostrar:
  - Propietario
  - Empleado
* **Selección Propietario:** Acceso para cuentas registradas mediante la Cloud Function `createBusiness`. Se valida que el propietario coincida con su `businessId` semántico.
* **Restricción de acceso:** Si un empleado con `role = "Administrador"` intenta acceder como "Propietario", la app bloqueará el acceso.
* **Selección Empleado (Flujo de Código de Acceso de 10 caracteres con Protección de Fuerza Bruta):**
  - El empleado ingresa su Código de Acceso de 10 caracteres en el frontend (4 caracteres alfanuméricos de la empresa + 6 dígitos numéricos del PIN).
  - El sistema invoca de forma segura la Cloud Function HTTPS `verifyEmployeePin`.
  - El backend aplica rate-limiting basado en la IP del cliente en Firebase Realtime Database. Máximo 5 intentos cada 15 minutos.
  - El backend valida el bloqueo por intentos fallidos recurrentes (`failed_attempts >= 3`).
  - Al validar exitosamente (búsqueda por hash exacto), el frontend inicializa la sesión con `signInWithCustomToken()`.
  - Un modal preguntará la sucursal de trabajo. Si no hay sucursales adicionales, se asume "Sede Principal".
* **Auditoría de Acceso Avanzada (login.js):** Cada inicio de sesión se registrará con IP, userAgent, etc.

## 2. Clasificación de Roles de Empleados
Cualquier empleado con un rol distinto a "Vendedor", "Cajero", "Almacén" o "Administrador" será considerado bajo el rol de "Personalizado".

## 3. Creación de Negocios y Tiendas (register.js y stores.js)
* **Registro del Negocio (`register.js`):** El frontend llama a la Cloud Function `createBusiness` para garantizar atomicidad. La función genera el `businessId`, un `businessCode` único, crea el usuario Auth con sus claims, y el documento del negocio en Firestore. Todo en una transacción/batch.
* **Creación de Tiendas:** Cada Propietario o Administrador puede crear tiendas. La tienda "Sede Principal" se crea automáticamente al registrar el negocio.

## 4. Creación de Empleados (employees.js)
Cada Propietario o Administrador puede crear empleados en la subcolección employees:

- id_empleado: (String) uniqueid requerido, oculto.
- businessId: (String) Denormalizado explícitamente.
- businessCode: (String) Código alfanumérico de 4 caracteres heredado del negocio.
- createdAt: (Timestamp) unificado obligatoriamente a admin.firestore.FieldValue.serverTimestamp().
- name: (String) Nombre y apellido en formato Title Case.
- documentId: (String) Cédula de identidad con prefijo (ej. "V-12345678").
- role: (String) Cargo asignado.
- modules: (Array de Strings) Lista de módulos permitidos.
- phone: (String) Formato internacional (ej. "+584141234567").
- email: (String) Correo electrónico de acceso.
- pin: (String) Hash SHA-256 del código completo de 10 caracteres + PEPPER global. No se requieren comparaciones adicionales (timingSafeEqual) gracias a la entropía del código alfanumérico.
- failed_attempts: (Number) Inicializado en 0.
- status: (String) Por defecto 'ACTIVO'.

## 5. Lógica e Infraestructura de Backend (Firebase Admin SDK)

### A. Cloud Function HTTPS: createBusiness (Registro Seguro y Atómico)
```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.createBusiness = functions.https.onCall(async (data, context) => {
  const { businessName, ownerEmail, password, address } = data;
  
  if (!businessName || !ownerEmail || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos incompletos');
  }
  
  // Verificar que el email no esté registrado
  try {
    await admin.auth().getUserByEmail(ownerEmail);
    throw new functions.https.HttpsError('already-exists', 'El email ya está registrado');
  } catch (error) {
    if (error.code === 'already-exists') throw error;
  }
  
  // Generar IDs únicos
  const businessId = admin.firestore().collection('businesses').doc().id;
  const businessCode = await generateUniqueBusinessCode();
  
  // Crear usuario en Auth
  const userRecord = await admin.auth().createUser({
    email: ownerEmail,
    password: password,
    displayName: businessName
  });
  
  // Asignar claims inmediatamente
  await admin.auth().setCustomUserClaims(userRecord.uid, {
    businessId: businessId,
    businessCode: businessCode,
    role: 'Propietario',
    tenantType: 'OWNER'
  });
  
  // Crear documento del negocio y tienda por defecto en un Batch
  const batch = admin.firestore().batch();
  const businessRef = admin.firestore().collection('businesses').doc(businessId);
  
  batch.set(businessRef, {
    businessName: smartTitleCase(businessName),
    businessCode: businessCode,
    ownerEmail: ownerEmail,
    ownerUid: userRecord.uid,
    address: address || '',
    status: 'ACTIVO',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  const storeRef = businessRef.collection('stores').doc();
  batch.set(storeRef, {
    Id_tienda: storeRef.id,
    Id_usuario: userRecord.uid,
    nombre_usuario: ownerEmail,
    fecha_creacion: admin.firestore.FieldValue.serverTimestamp(),
    nombre_tienda: 'Sede Principal',
    dirección_tienda: smartTitleCase(address || 'Dirección Principal'),
    isDefault: true,
    oculto: true
  });
  
  await batch.commit();
  
  return { businessId, businessCode, uid: userRecord.uid };
});

async function generateUniqueBusinessCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let isUnique = false;
  let code;
  
  while (!isUnique) {
    code = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const snapshot = await admin.firestore().collection('businesses').where('businessCode', '==', code).limit(1).get();
    isUnique = snapshot.empty;
  }
  return code;
}
```

### B. Cloud Function HTTPS: verifyEmployeePin
```javascript
const crypto = require('crypto');
const PEPPER = functions.config().app.pin_pepper;

exports.verifyEmployeePin = functions.https.onCall(async (data, context) => {
  const { pin } = data;
  
  if (!pin || !/^[a-zA-Z0-9]{4}\d{6}$/.test(pin)) {
    throw new functions.https.HttpsError('invalid-argument', 'Formato de PIN inválido.');
  }
  
  // Rate Limiting optimizado por IP (con transacción atómica)
  const clientIp = context.rawRequest.ip;
  const hashedIp = crypto.createHash('sha256').update(clientIp).digest('hex');
  const rateRef = admin.database().ref(`rate_limits/${hashedIp}`);
  
  const result = await rateRef.transaction(current => {
    const currentAttempts = current || 0;
    if (currentAttempts >= 5) return; // Abortar transacción si excedió el límite
    return currentAttempts + 1;
  });

  if (!result.committed) {
    throw new functions.https.HttpsError('resource-exhausted', 'Demasiados intentos fallidos. Bloqueo temporal por 15 minutos.');
  }

  // Solo configurar expiración si es el primer intento
  if (result.snapshot.val() === 1) {
    await rateRef.child('expiresAt').set(Date.now() + 15 * 60 * 1000);
  }
  
  // Hash y Búsqueda Global (Confiamos en el índice y en el hash de 10 caracteres)
  const hashedInputPin = crypto.createHash('sha256').update(pin.toUpperCase() + PEPPER).digest('hex');
  const db = admin.firestore();
  
  const employeesSnapshot = await db.collectionGroup('employees')
    .where('pin', '==', hashedInputPin)
    .where('status', '==', 'ACTIVO')
    .limit(1)
    .get();
  
  if (employeesSnapshot.empty) {
    // Registrar intento fallido para análisis de seguridad y detección de ataques de diccionario
    await admin.database().ref(`failed_attempts_log/${Date.now()}`).set({
      ip: hashedIp,
      timestamp: Date.now(),
      inputPrefix: pin.substring(0, 4), // Solo el código de empresa
      userAgent: context.rawRequest.headers['user-agent'] || 'unknown'
    });
    
    throw new functions.https.HttpsError('not-found', 'Credenciales de acceso incorrectas.');
  }
  
  const employeeDoc = employeesSnapshot.docs[0];
  const employeeData = employeeDoc.data();
  
  if (employeeData.failed_attempts >= 3) {
    throw new functions.https.HttpsError('permission-denied', 'Cuenta bloqueada.');
  }
  
  // Validación de businessId Consistente
  const pathBusinessId = employeeDoc.ref.parent.parent.id;
  if (employeeData.businessId !== pathBusinessId) {
    console.error('⚠️ ALERTA: Inconsistencia de businessId detectada', {
      documentField: employeeData.businessId,
      pathId: pathBusinessId,
      employeeId: employeeData.id_empleado
    });
    
    // Auto-corregir
    await employeeDoc.ref.update({ 
      businessId: pathBusinessId,
      businessCode: employeeData.businessCode 
    });
  }
  
  // Éxito - Resetear contadores de seguridad
  await Promise.all([
    employeeDoc.ref.update({ failed_attempts: 0 }),
    rateRef.remove()
  ]);
  
  const customToken = await admin.auth().createCustomToken(
    employeeData.id_empleado,
    {
      businessId: pathBusinessId,
      businessCode: employeeData.businessCode,
      role: employeeData.role,
      tenantType: 'EMPLOYEE',
      employeeId: employeeData.id_empleado
    }
  );
  
  return { 
    token: customToken,
    employee: {
      id: employeeData.id_empleado,
      name: employeeData.name,
      role: employeeData.role,
      businessId: pathBusinessId
    }
  };
});
```

## 🛠️ FUNCIONES AUXILIARES REQUERIDAS

### Algoritmo de Capitalización Inteligente (smartTitleCase)
```javascript
function smartTitleCase(text) {
  const exceptions = ['de', 'del', 'la', 'los', 'las', 'el', 'y', 'e', 'o'];
  const suffixes = ['C.A.', 'S.A.', 'S.R.L.', 'F.P.'];
  
  return text.split(' ').map((word, index) => {
    if (suffixes.includes(word.toUpperCase())) return word.toUpperCase();
    if (index > 0 && exceptions.includes(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}
```

### Configuración de Índices Estrictos (firestore.indexes.json)
```json
{
  "indexes": [{
    "collectionGroup": "employees",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "pin", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  }]
}
```

## 🔒 REGLAS DE SEGURIDAD DE FIREBASE (Firestore Rules)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ==========================================
    // ACCESO A LA COLECCIÓN GLOBAL BCV
    // ==========================================
    match /global_bcv_history/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // ==========================================
    // AISLAMIENTO MULTI-TENANT (POR NEGOCIO)
    // ==========================================
    match /businesses/{businessId} {
      
      allow read: if request.auth != null && 
                  (request.auth.uid == businessId || request.auth.token.businessId == businessId);
      
      allow write: if request.auth != null && request.auth.uid == businessId;
      
      // REGLA OPTIMIZADA: Los empleados solo pueden ser leídos y gestionados por miembros de su propio Tenant
      match /employees/{employeeId} {
        allow read: if request.auth != null && request.auth.token.businessId == businessId;
        allow create, update: if request.auth != null && 
                     request.auth.token.businessId == businessId &&
                     request.auth.token.role in ['Propietario', 'Administrador'];
      }
      
      // ==========================================
      // EXCEPCIONES PARA FORMULARIOS PÚBLICOS (Con protección de Update/Delete)
      // ==========================================
      match /clients/{clientId} {
        allow create: if true; // Habilita la prospección pública (ej. link de registro de clientes)
        allow get, update, delete: if request.auth != null && 
                      (request.auth.uid == businessId || request.auth.token.businessId == businessId); 
      }
      
      match /suppliers/{supplierId} {
        allow create: if true;
        allow get, update, delete: if request.auth != null && 
                      (request.auth.uid == businessId || request.auth.token.businessId == businessId);
      }
      
      match /system_notifications/{notifId} {
        allow create: if true; 
        allow read, update, delete: if request.auth != null && 
                                    (request.auth.uid == businessId || request.auth.token.businessId == businessId);
      }
      
      // ==========================================
      // ACCESO TOTAL PROTEGIDO PARA SUBCOLECCIONES (Ventas, Inventarios, Cajas)
      // ==========================================
      match /{subcollection}/{document=**} {
        allow read, write: if request.auth != null && 
                            (request.auth.uid == businessId || request.auth.token.businessId == businessId);
      }
    }
  }
}
```

## 6. Herramienta de Migración de Datos (Módulo Mantenimiento)
Para garantizar que los registros existentes en la base de datos sean compatibles con la nueva arquitectura Multi-Tenant y el esquema de seguridad (V3), se implementará una herramienta/script de mantenimiento administrativo (idealmente una Cloud Function invocable `migrateV3Data`). Esta herramienta recorrerá las colecciones y actualizará los documentos faltantes de manera estructurada.

### Tareas de Migración por Colección:

1. **Negocios (`businesses`):**
   - Verificar si el negocio no tiene un `businessCode`.
   - Generar y asignar un `businessCode` único de 4 caracteres (usando la función `generateUniqueBusinessCode`).
   - Sellar el `ownerUid` si está faltando y se puede deducir del Firebase Auth.

2. **Tiendas (`stores`):**
   - Asegurar que todas las tiendas dentro del negocio hereden los campos básicos requeridos (por ejemplo, si no hay una "Sede Principal", crearla asociándole la dirección del negocio).
   - Inyectar o asegurar que exista el `Id_tienda` y que coincida con el ID del documento.

3. **Empleados (`employees`):**
   - Heredar y escribir el `businessCode` del negocio padre dentro de cada documento de empleado de forma denormalizada.
   - Escribir explícitamente el `businessId` (el ID del negocio padre) en cada documento del empleado para consultas globales.
   - **Migración de PIN (Reset Masivo Forzado con PIN Aleatorio):** Dado que los hashes anteriores son irreversibles, la herramienta de migración generará un nuevo PIN aleatorio de 6 dígitos único para cada empleado existente. Se calculará el nuevo Hash V3 seguro: `SHA256(businessCode + PIN_aleatorio + PEPPER)` y se sobrescribirá el campo `pin`. Además, el PIN aleatorio en texto plano se guardará en un campo temporal (ej. `temporaryPin`) para que el Propietario pueda verlo en la lista de empleados y comunicarlo. Se añadirá el flag `requirePinChange: true` para forzar su cambio y eliminar el `temporaryPin` en el próximo inicio de sesión.
   - Inicializar el contador `failed_attempts = 0` si el campo no existe.

4. **Turnos/Cajas (`shifts`):**
   - Inyectar el `businessId` y `businessCode` en cada registro histórico y turno abierto para alinearlo con las nuevas reglas de seguridad de acceso denormalizado.

5. **Auditoría de Inicios de Sesión (`login`):**
   - Inyectar `businessId` y `businessCode` en los registros históricos del log de accesos (`login`) para mantener la consistencia en el reporte y auditoría de seguridad.

### Mecanismo de Ejecución
* Esta herramienta estará disponible en el frontend bajo el **Módulo de Mantenimiento**.
* Solo podrá ser ejecutada por un usuario autorizado (Super Administrador del sistema).
* Dado que las actualizaciones en Firebase están limitadas a lotes (Batches de a 500 escrituras), el algoritmo de migración deberá iterar y procesar los registros en bloques (chunks) para no exceder los límites de Firebase Firestore.

---

## Anexo: Ajustes post-implementación (Realidad vs Plan)

Durante la implementación en los entornos de prueba, se encontraron tres desafíos técnicos no anticipados en el diseño original que requirieron correcciones y convirtieron el sistema en una solución más robusta:

1. **Permiso de Service Account Token Creator:**
   La generación de **Custom Tokens** (gafetes virtuales) usando `auth.createCustomToken()` arrojaba un error `INTERNAL`. Esto se debió a que la cuenta de servicio por defecto (`app-ventas-db@appspot.gserviceaccount.com`) no contaba con los permisos necesarios para firmar tokens.
   **Solución:** Se otorgó explícitamente el rol de `roles/iam.serviceAccountTokenCreator` al Service Account directamente desde Google Cloud IAM.

2. **Cruces en la Migración de PINs (Migración V3):**
   Al probar la creación de un empleado manual y luego ejecutar la migración masiva de V3 (`migrateV3Data`), el script sobreescribió los PINs recién generados con nuevos valores aleatorios, invalidando las pruebas iniciales.
   **Solución:** Se incluyó un mecanismo en la interfaz (botón **🔒 Generar Nuevo Código de Acceso**) que permite a los propietarios o administradores regenerar e inspeccionar el nuevo código de acceso de los empleados para subsanar cualquier desincronización y facilitar el acceso a la cuenta.

3. **Inconsistencia de caché local (F5) en el Dashboard:**
   Originalmente, el Dashboard obtenía el nombre del usuario dependiente puramente del `localStorage`. Al refrescar la página, el navegador eliminaba o perdía la llave temporal y mostraba 'Empleado'.
   **Solución:** Se cambió la prioridad de la fuente de verdad. Ahora, el `dashboard.js` intenta leer primero el documento del **Turno Activo (ABIERTO)** asociado al dispositivo; si lo encuentra, extrae los campos `NOMBRE_USUARIO_LOGUEADO` y `NOMBRE_TIENDA` directamente desde Firestore, garantizando exactitud independientemente del caché local.

