Problemas encontrados

  ---                                                                                                                                                                 
  Crítico — PEPPER hardcodeado en el repo                                                                                                                             
                                                                                                                                                                    
  // functions/index.js:10                                                                                                                                            
  const PEPPER = "V3_ORANGE_APP_SECURE_PEPPER_2026";                                                                                                                
  Está reconocido en el mismo comentario del código. Si el repo es público, el PEPPER está expuesto y el sistema de hash queda comprometido. Debe moverse a           
  functions.config() o Firebase Secret Manager.                                                                                                                       
                                                                                                                                                                      
  ---                                                                                                                                                                 
  Moderado — temporaryPin en plaintext en Firestore                                                                                                                 
                                                                                                                                                                      
  // functions/index.js:364
  temporaryPin: randomPinStr, // Se guardará temporalmente...                                                                                                         
  Durante la migración, el PIN en texto plano queda guardado en Firestore. Aunque sea temporal, es una credencial expuesta en base de datos.                        
                                                                                                                                                                      
  ---
  Moderado — system_notifications en colección raíz                                                                                                                   
                                                                                                                                                                    
  // functions/index.js:138 (dentro de verifyEmployeePin, al fallar el login)
  await db.collection('system_notifications').add({ ... })                                                                                                            
  Las reglas de Firestore solo definen system_notifications dentro de businesses/{businessId}/.... Esta escritura va a la colección raíz — o falla silenciosamente por
   permisos, o crea una colección no protegida.                                                                                                                       
                                                                                                                                                                      
  ---                                                                                                                                                                 
  Menor — requiresPinChange no se maneja en el frontend                                                                                                             

  // login.js:208
  // Nota: La lógica de requiresPinChange se puede manejar luego mostrándole un modal
  El flag se retorna de la Cloud Function pero no se actúa sobre él — los empleados migrados no son forzados a cambiar su PIN.                                        
                                                                                                                                                                      
  ---                                                                                                                                                                 
  Menor — Inconsistencia de roles entre reglas y código                                                                                                               
                                                                                                                                                                      
  Las Firestore Rules verifican:
  request.auth.token.role in ['Propietario', 'Administrador']                                                                                                         
  Pero la Cloud Function createBusiness asigna el claim:                                                                                                              
  role: 'owner'  // no 'Propietario'
  Esto significa que el propietario no puede crear ni editar empleados según las reglas actuales — el claim 'owner' no está en la lista ['Propietario',               
  'Administrador'].                                                                                                                                                 
                                                                                                                                                                      
  ---                                                                                                                                                               
  Deuda técnica — node_modules commiteado                                                                                                                             
                                                                                                                                                                      
  functions/node_modules/ está en el repo (infló el pull a 12,608 archivos). Debería agregarse al .gitignore.
                                                                                                                                                                      
  ---                                                                                                                                                               
  Resumen de prioridades                                                                                                                                              
                                                                                                                                                                    
  ┌────────────────┬────────────────────────────────────────────────────────────┐
  │   Prioridad    │                            Ítem                            │                                                                                     
  ├────────────────┼────────────────────────────────────────────────────────────┤
  ├────────────────┼────────────────────────────────────────────────────────────┤                                                                                   
  │ 🔴 Urgente     │ Mover PEPPER a variable de entorno                         │                                                                                     
  ├────────────────┼────────────────────────────────────────────────────────────┤
  │ 🟡 Importante  │ Fix de roles en Firestore Rules ('owner' vs 'Propietario') │                                                                                     
  ├────────────────┼────────────────────────────────────────────────────────────┤                                                                                     
  │ 🟡 Importante  │ Fix de system_notifications (ruta incorrecta)              │
  ├────────────────┼────────────────────────────────────────────────────────────┤                                                                                     
  │ 🟠 Recomendado │ Manejar requiresPinChange en el frontend                   │                                                                                   
  ├────────────────┼────────────────────────────────────────────────────────────┤                                                                                     
  │ 🟠 Recomendado │ Limpiar temporaryPin post-migración                        │                                                                                   
  ├────────────────┼────────────────────────────────────────────────────────────┤                                                                                     
  │ ⚪ Deuda       │ Agregar functions/node_modules al .gitignore               │                                                                                   
  └────────────────┴────────────────────────────────────────────────────────────┘


Mas detalle en de cada observación  

🔴 1. PEPPER hardcodeado                                                                                                                                            

  ¿Qué es el PEPPER?
  Es un secreto global que se agrega al hash del PIN para que, incluso si alguien roba la base de datos y ve todos los hashes, no pueda usar tablas precalculadas para
   revertirlos.                                                                                                                                                       
   
  ¿Cuál es el problema?                                                                                                                                               
  const PEPPER = "V3_ORANGE_APP_SECURE_PEPPER_2026";                                                                                                                
  Está literalmente en el código fuente, que está en GitHub. Si el repo es público (o si alguien obtiene acceso al repo), el PEPPER ya no es secreto — y el sistema de
   hash pierde toda su protección adicional.                                                                                                                          
                                                                                                                                                                      
  Fix: Moverlo a una variable de entorno de Firebase:                                                                                                                 
  // En la terminal:                                                                                                                                                  
  firebase functions:config:set app.pin_pepper="valor-secreto-real"                                                                                                 
                                                                                                                                                                      
  // En el código:                                                                                                                                                    
  const PEPPER = functions.config().app.pin_pepper;
                                                                                                                                                                      
  ---                                                                                                                                                                 
  🟡 2. Inconsistencia de roles (bug activo)
                                                                                                                                                                      
  ¿Cómo funciona el sistema de roles?                                                                                                                               
  Firebase Auth guarda un "claim" en el token del usuario con su rol. Las reglas de Firestore leen ese claim para decidir qué puede hacer cada usuario.               
                                                                                                                                                                      
  ¿Cuál es el problema?                                                                                                                                               
  Cuando un propietario se registra, createBusiness le asigna este claim:                                                                                             
  role: 'owner'  // ← lo que se guarda en el token                                                                                                                    
  Pero las reglas de Firestore verifican:
  request.auth.token.role in ['Propietario', 'Administrador']  // ← 'owner' no está aquí
  Entonces cuando el propietario intenta crear o editar un empleado, Firestore le dice que no tiene permisos — aunque debería poder hacerlo. Es un bug que afecta a
  todos los propietarios con cuentas creadas con el flujo V3.

  Fix: Cambiar la regla para incluir 'owner':
  request.auth.token.role in ['owner', 'Propietario', 'Administrador']
  O mejor, estandarizar el nombre del rol en toda la app.                                                                                                           
                                                                                                                                                                      
  ---                                                                                                                                                                 
  🟡 3. system_notifications en ruta incorrecta
                                                                                                                                                                      
  ¿Qué debería pasar cuando alguien falla el login?                                                                                                                 
  La función verifyEmployeePin registra el intento fallido para análisis de seguridad.                                                                                
                                                                                                                                                                      
  ¿Cuál es el problema?                                                                                                                                               
  Lo guarda en:                                                                                                                                                       
  db.collection('system_notifications').add({ ... })                                                                                                                
  // Ruta: /system_notifications/{id}               
  Pero las reglas de Firestore solo protegen:                                                                                                                         
  /businesses/{businessId}/system_notifications/{id}                                                                                                                  
  La colección raíz /system_notifications no tiene ninguna regla definida — en Firestore, lo que no tiene regla explícita está bloqueado por defecto, así que esta    
  escritura probablemente falla silenciosamente (o lanza un error que no se ve en el frontend porque no se maneja).                                                   
                                                                                                                                                                      
  Fix: Cambiar la ruta a:
  db.collection('businesses').doc(businessCode_lookup).collection('system_notifications').add({ ... })                                                                
  O crear una colección raíz dedicada para auditoría global con sus propias reglas.                                                                                   
  
  ---                                                                                                                                                                 
  🟠 4. requiresPinChange no manejado                                                                                                                               
                                                                                                                                                                      
  ¿Qué es esto?                                                                                                                                                     
  Cuando se migra un negocio al sistema V3, todos los empleados reciben un PIN temporal aleatorio y el flag requirePinChange: true. La idea es que la próxima vez que 
  el empleado entre, el sistema lo fuerce a cambiar su PIN.                                                                                                           
  
  ¿Cuál es el problema?                                                                                                                                               
  En login.js se recibe el flag pero se ignora completamente:                                                                                                       
  const { token, businessId: bId, requiresPinChange } = response.data;                                                                                                
  // ... (requiresPinChange nunca se usa)                             
  // Nota: La lógica de requiresPinChange se puede manejar luego mostrándole un modal                                                                                 
  El empleado entra al dashboard directo, con un PIN temporal que nunca cambia.                                                                                     
                                                                                                                                                                      
  Fix: Después del signInWithCustomToken, si requiresPinChange === true, redirigir a una vista de cambio de PIN antes del dashboard.                                  
                                                                                                                                                                      
  ---                                                                                                                                                                 
  🟠 5. temporaryPin en plaintext en Firestore                                                                                                                        
                                                                                                                                                                    
  ¿Qué es esto?
  Durante la migración V3, se genera un PIN aleatorio para cada empleado y se guarda así:                                                                             
  await eDoc.ref.update({                                                                                                                                             
      pin: newHash,             // ← hash seguro (correcto)                                                                                                           
      temporaryPin: randomPinStr, // ← "123456" en texto plano (problema)                                                                                             
      requirePinChange: true,                                                                                                                                         
  });                                                                                                                                                                 
  La idea es que el propietario vea el PIN temporal en la lista de empleados y se lo diga en persona.                                                                 
                                                                                                                                                                      
  ¿Cuál es el problema?                                                                                                                                               
  Una credencial en texto plano en la base de datos es un riesgo: si alguien obtiene acceso de lectura a Firestore (sea por un bug en las reglas, por la consola de 
  Firebase, o por una fuga), tiene acceso inmediato a las credenciales de todos los empleados.                                                                        
                                                                                                                                                                    
  Fix ideal: El PIN temporal debería mostrarse una sola vez al propietario al momento de la migración (en la respuesta de la Cloud Function) y nunca guardarse en la  
  DB. Si ya se guardó, agregar lógica que lo borre en cuanto el empleado cambie su PIN.                                                                             
                                                                                                                                                                      
  ---                                                                                                                                                               
  ⚪ 6. node_modules en el repo
                                                                                                                                                                      
  ¿Qué pasó?
  Alguien corrió npm install dentro de functions/ y luego hizo git add . sin tener un .gitignore que excluya node_modules. Resultado: ~12,000 archivos de dependencias
   entraron al historial de git.                                                                                                                                      
  
  ¿Cuál es el problema?                                                                                                                                               
  - El repo pesa mucho más de lo necesario                                                                                                                          
  - Los npm pull y clones son lentos                                                                                                                                  
  - Las dependencias deben instalarse del package.json, no estar en el repo

  Fix:
  # Agregar al .gitignore raíz o al functions/.gitignore:
  functions/node_modules/

  # Luego remover del tracking:
  git rm -r --cached functions/node_modules/