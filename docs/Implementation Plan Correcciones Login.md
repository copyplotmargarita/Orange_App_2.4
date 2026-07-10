# PLAN DE IMPLEMENTACIÓN: CORRECCIONES DE SEGURIDAD Y LOGS V3 (BANCARIO)

## 1. Resumen de Prioridades

| Prioridad | Ítem | Impacto |
| :--- | :--- | :--- |
| 🔴 **Urgente** | Mover PEPPER a variables de entorno (`functions.config`) | Seguridad de Criptografía |
| 🟡 **Importante** | Homologar Claims de Roles en Reglas de Firestore (`owner` vs `Propietario`) | Corrección de Bug de Escritura |
| 🟡 **Importante** | Corregir ruta de `system_notifications` en login fallido | Consistencia Multi-Tenant |
| 🟠 **Recomendado** | Interceptar `requiresPinChange` y forzar interfaz de cambio de PIN | Seguridad de Credenciales |
| 🟠 **Recomendado** | Control de estados (`INACTIVO`, `VACACIONES`, `ELIMINADO`) en Login | Control Operativo |
| ⚪ **Deuda** | Remover `functions/node_modules/` del tracking de Git | Optimización de Repositorio |

---

## 2. Cambios Propuestos

### Módulo Backend (Cloud Functions)

#### [MODIFY] `functions/index.js`
* **Ocultación del Pepper:** Eliminar la constante harcodeada `const PEPPER = "V3_ORANGE_APP_SECURE_PEPPER_2026";`. Reemplazar estrictamente por la lectura segura del entorno:
  ```javascript
  const PEPPER = functions.config().app.pin_pepper;
  ```
* **Enrutamiento de Alertas de Seguridad:** En la Cloud Function `verifyEmployeePin`, al detonarse un fallo de credenciales, extraer los primeros 4 caracteres del string recibido (`businessCode`).
  * Buscar el documento correspondiente en `/businesses` donde `businessCode == inputPrefix`.
  * Si el negocio existe, guardar la alerta en `/businesses/{businessId}/system_notifications`.
  * Si el negocio NO existe (código inválido), guardar el log de auditoría en la colección de incidentes raíz `/global_security_alerts` para evitar escrituras huérfanas o bloqueos por referencias nulas.
* **Control de Estados Operativos:** Modificar la lógica de autenticación en `verifyEmployeePin` para evaluar el campo `status` del empleado hallado:
  * Si `status` es igual a `"INACTIVO"`, `"VACACIONES"` o `"ELIMINADO"`, la función debe denegar la generación del Custom Token inmediatamente y retornar un código de error explícito al cliente (`permission-denied`) junto con el estado del empleado.
* **Inyección Semántica de employeeId:** Modificar la función `verifyEmployeePin` para inyectar explícitamente `employeeId: employeeDoc.id` dentro del objeto de claims al generar el Custom Token.
* **Destrucción Atómica de Credenciales Temporales:** En la función encargada de actualizar el PIN (`changeEmployeePin`), una vez calculado y guardado el nuevo hash SHA256, eliminar los campos `temporaryPin` y `requirePinChange` del documento del empleado utilizando:
  ```javascript
  admin.firestore.FieldValue.delete()
  ```

### Módulo de Reglas de Base de Datos

#### [MODIFY] `firestore.rules`
* **Unificación de Claims para Propietarios:** Corregir la regla de la subcolección `employees` para validar de forma consistente el claim de registro generado por la función atómica.
  ```javascript
  // Ahora (Homologado con claim real 'owner')
  allow create, update: if request.auth != null && 
                        request.auth.token.businessId == businessId &&
                        (request.auth.token.role in ['owner', 'Propietario', 'Administrador']);
  ```
* **Bloqueo Inmediato por Estado (Real-time Blacklist) y Excepción de Dueño:** Asegurar que las subcolecciones operativas verifiquen que el documento del empleado mantenga el estado "ACTIVO". Además, incluir un cortocircuito lógico (`||`) para garantizar que el Propietario (`request.auth.uid == businessId`) no sea bloqueado, ya que este no posee un documento en la colección de empleados. Usar `request.auth.token.employeeId` para ultra-precisión semántica en la consulta del empleado.
  ```javascript
  // Dentro del match de subcolecciones críticas
  allow read, write: if request.auth != null && (
      request.auth.uid == businessId || 
      (request.auth.token.businessId == businessId && 
       get(/databases/$(database)/documents/businesses/$(businessId)/employees/$(request.auth.token.employeeId)).data.status == 'ACTIVO')
  );
  ```

### Módulo Frontend

#### [MODIFY] `js/views/login.js`
* **Interrupción por Cambio de PIN Obligatorio:** Al recibir una respuesta exitosa de `verifyEmployeePin` donde `requirePinChange === true`, el sistema detendrá inmediatamente el flujo de enrutamiento hacia el `#dashboard`.
  * Se inyectará un Modal HTML personalizado (en lugar de `showPromptModal` genérico) que solicite dos campos: **Nuevo PIN** (6 dígitos) y **Confirmar Nuevo PIN**, garantizando que el usuario no se equivoque al teclear.
  * Al procesar, llamará al endpoint de cambio de clave. Si el usuario cancela, el sistema ejecutará de forma atómica un `firebase.auth().signOut()` para destruir la sesión local.
* **Manejo de Respuestas de Estados Restringidos:** Interceptar los códigos de error del backend cuando el estado no sea activo, interrumpiendo el flujo y pintando en pantalla:
  * INACTIVO: "No estás activo en este negocio. Comunícate con tu superior."
  * VACACIONES: "Estás de vacaciones en este negocio."
  * ELIMINADO: "Ya no perteneces a este negocio."

#### [MODIFY] `js/views/employees.js`
* **Estandarización de Borrado Lógico (Soft Delete):** Modificar el listener del botón de eliminación de la tabla de personal. Reemplazar el método destructivo `deleteDoc()` por una actualización de estado estructurada:
  ```javascript
  await updateDoc(employeeRef, { status: 'ELIMINADO' });
  ```

### Configuración del Repositorio

#### [MODIFY] `.gitignore`
* Agregar la exclusión de dependencias locales al archivo `.gitignore` raíz para sanear el árbol de trabajo:
  ```plaintext
  functions/node_modules/
  ```

## 3. Plan de Verificación Manual
1. **Verificación de Aislamiento del Pepper:** Realizar el despliegue del backend con el pepper inyectado vía CLI.
2. **Verificación de Permisos del Dueño:** Loguearse con una cuenta con claim 'owner' e intentar dar de alta un empleado de prueba.
3. **Prueba de Inyección de Alertas:** Provocar fallos de login intencionales. Verificar en la consola las alertas.
4. **Prueba de Fuerza del Reset:** Forzar un estado de migración con PIN temporal en un empleado.
5. **Prueba de Bloqueo por Estados:** Mutar el estado del empleado entre INACTIVO, VACACIONES y ELIMINADO. Validar que el frontend renderice los componentes de alerta correspondientes y destruya el intento de sesión.

## 4. Comandos de Despliegue y Pruebas Locales
```bash
# 1. Configurar secreto de producción en Firebase (Producción)
firebase functions:config:set app.pin_pepper="V3_ORANGE_APP_SECURE_PEPPER_2026"

# 1.1 Para pruebas en Emulador Local (Opcional, ejecutar dentro de /functions)
firebase functions:config:get > .runtimeconfig.json

# 2. Desplegar backend y reglas actualizadas
firebase deploy --only functions
firebase deploy --only firestore:rules

# 3. Remover las dependencias locales del índice de Git sin borrarlas del disco
git rm -r --cached functions/node_modules/
git commit -m "chore: corregidas vulnerabilidades de auditoría y saneado node_modules"
git push origin main
```