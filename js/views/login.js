import { navigate, showPromptModal, showConfirmModal } from '../utils.js';
import { auth, db } from '../services/firebase.js';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, collectionGroup } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderLogin() {
    const container = document.createElement('div');
    container.className = 'auth-layout';
    
    container.innerHTML = `
        <div class="card auth-card">
            <div class="text-center mb-4">
                <h2>Bienvenido</h2>
                <p class="text-muted text-sm">Inicia sesión en tu cuenta</p>
            </div>
            
            <form id="loginForm">
                <div id="errorMsg" style="color: var(--danger); font-size: 0.875rem; margin-bottom: 1rem; text-align: center;"></div>
                
                <div class="form-group mb-4">
                    <label>Tipo de Usuario</label>
                    <select class="form-control" id="roleSelect">
                        <option value="admin">Administrador</option>
                        <option value="employee">Empleado</option>
                    </select>
                </div>
                
                <div class="form-group mb-4">
                    <label>Correo Electrónico</label>
                    <input type="email" id="email" class="form-control" placeholder="correo@ejemplo.com" required>
                </div>
                
                <div class="form-group mb-4">
                    <label>Contraseña</label>
                    <input type="password" id="password" class="form-control" placeholder="••••••••" required>
                </div>
                
                <button type="submit" class="btn btn-primary mb-4" id="submitBtn">Ingresar</button>
            </form>
            
            <div class="text-center">
                <p class="text-sm" style="margin-bottom: 0.75rem;">¿No tienes cuenta? <a href="#register" style="color: var(--primary); text-decoration: none; font-weight: 500;">Regístrate aquí</a></p>
                <p class="text-sm" style="margin-bottom: 0;"><a href="#" id="forgotPasswordLnk" style="color: var(--primary); text-decoration: none; font-weight: 500;">¿Olvidaste tu contraseña?</a></p>
            </div>
        </div>
    `;

    const form = container.querySelector('#loginForm');
    const errorMsg = container.querySelector('#errorMsg');
    const submitBtn = container.querySelector('#submitBtn');
    const forgotPwdLnk = container.querySelector('#forgotPasswordLnk');

    if (forgotPwdLnk) {
        forgotPwdLnk.addEventListener('click', (e) => {
            e.preventDefault();
            
            const currentEmail = container.querySelector('#email').value.trim();
            
            showPromptModal(
                "Recuperar Contraseña",
                "Ingresa el correo asociado a tu cuenta:",
                currentEmail,
                (promptEmail) => {
                    if (!promptEmail) return;
                    
                    showConfirmModal(
                        "¿Estás seguro?",
                        `¿Es este tu correo electrónico correcto?<br><strong style="color: var(--text-main); font-size: 1.1rem; display: block; margin-top: 0.5rem;">${promptEmail}</strong>`,
                        async () => {
                            try {
                                errorMsg.style.color = 'var(--text-muted)';
                                errorMsg.textContent = 'Enviando enlace...';
                                
                                await sendPasswordResetEmail(auth, promptEmail);
                                
                                errorMsg.style.color = 'var(--success)';
                                errorMsg.textContent = '✅ Enlace enviado. Revisa tu correo (incluyendo carpeta de spam) para crear una nueva contraseña.';
                            } catch (err) {
                                console.error("Error password reset:", err);
                                errorMsg.style.color = 'var(--danger)';
                                if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
                                    errorMsg.textContent = 'Error: Correo no válido o cuenta no encontrada.';
                                } else {
                                    errorMsg.textContent = 'Error al enviar el enlace. Intenta de nuevo.';
                                }
                            }
                        },
                        "Enviar Enlace",
                        "Cancelar",
                        "❓"
                    );
                },
                "Siguiente",
                "Cancelar",
                "🔐"
            );
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ingresando...';

        const email = container.querySelector('#email').value;
        const password = container.querySelector('#password').value;
        const role = container.querySelector('#roleSelect').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            
            // Retardo para asegurar la sincronización del token de Auth con el cliente Firestore
            await new Promise(resolve => setTimeout(resolve, 350));
            
            // Verificación estricta de seguridad
            const uid = auth.currentUser.uid;
            
            // 1. ¿Es el dueño principal del negocio?
            let businessDoc = null;
            let businessExists = false;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    businessDoc = await getDoc(doc(db, "businesses", uid));
                    businessExists = businessDoc.exists();
                    break; // Éxito, salir del bucle
                } catch (err) {
                    console.warn(`Intento ${retryCount + 1} de leer negocio falló:`, err);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 250)); // Esperar antes de reintentar
                    } else {
                        businessExists = false;
                    }
                }
            }

            // AUTO-CREACIÓN DE NEGOCIO (Si no existe en Firestore y se autentica como administrador)
            if (!businessExists && role === 'admin') {
                try {
                    console.log("Iniciando auto-creación de negocio por ausencia en Firestore...");
                    const defaultBusinessData = {
                        name: "Mi Negocio",
                        document: "J-000000000",
                        country: "Venezuela",
                        address: "Dirección Principal",
                        ownerName: "Propietario",
                        email: email,
                        status: "active",
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(doc(db, "businesses", uid), defaultBusinessData);
                    
                    // Volver a leer para confirmar la existencia
                    businessDoc = await getDoc(doc(db, "businesses", uid));
                    businessExists = businessDoc.exists();
                } catch (createErr) {
                    console.error("Error al auto-crear negocio default:", createErr);
                }
            }

            let empData = null;
            let businessId = null;
            let cargo = "Administrador";

            if (businessExists) {
                // Es el dueño, forzamos su rol a admin
                businessId = uid;
                const bData = businessDoc.data();
                empData = { name: bData.name || 'Administrador', role: 'Administrador' };
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('businessId', businessId);
                localStorage.setItem('employeeName', empData.name);
            } else {
                // 1.5 ¿Existe un negocio registrado con este email pero bajo un ID diferente (ej. por respaldos)?
                try {
                    const qBus = query(collection(db, "businesses"), where("email", "==", email));
                    const busSnap = await getDocs(qBus);
                    if (!busSnap.empty) {
                        const bDoc = busSnap.docs[0];
                        businessId = bDoc.id;
                        const bData = bDoc.data();
                        empData = { name: bData.name || 'Administrador', role: 'Administrador' };
                        localStorage.setItem('userRole', 'admin');
                        localStorage.setItem('businessId', businessId);
                        localStorage.setItem('employeeName', empData.name);
                        businessExists = true; // Marcamos como encontrado
                    }
                } catch (busErr) {
                    console.warn("No se pudo buscar negocio por email:", busErr);
                }
            }

            if (!businessExists) {
                // 2. Si no es el dueño, debe ser un empleado. Buscamos su cargo en la BD usando una consulta de grupo de colecciones
                try {
                    const q = query(collectionGroup(db, "employees"), where("email", "==", email));
                    const empSnap = await getDocs(q);
                    if (!empSnap.empty) {
                        const empDoc = empSnap.docs[0];
                        empData = empDoc.data();
                        businessId = empDoc.ref.parent.parent.id;
                    }
                } catch (grpErr) {
                    console.error("Error al buscar empleado en grupo de colecciones:", grpErr);
                    throw new Error("No se encontró un negocio activo para esta cuenta. Si borró y recreó su cuenta en la consola, por favor use el enlace 'Regístrate aquí' para volver a vincular su negocio.");
                }
                
                if (!empData) {
                    await signOut(auth);
                    throw new Error("No se encontró un negocio activo para esta cuenta. Si borró y recreó su cuenta en la consola, por favor use el enlace 'Regístrate aquí' para volver a vincular su negocio.");
                }
                
                // 3. Validar privilegios contra el rol seleccionado en el formulario
                cargo = empData.role; // "Administrador", "Cajero", "Vendedor", etc.
                
                if (role === 'admin' && cargo !== 'Administrador') {
                    await signOut(auth);
                    throw new Error("Acceso denegado: Tu cargo (" + cargo + ") no tiene privilegios de Administrador.");
                }

                // VALIDACIÓN DE ESTADO: Solo permitir si está ACTIVO
                if (empData.status !== 'ACTIVO') {
                    await signOut(auth);
                    throw new Error(`Acceso denegado: Tu estado actual es "${empData.status}". Contacte al administrador.`);
                }
                
                // Si todo está bien, guardamos el rol localmente
                localStorage.setItem('userRole', role);
                localStorage.setItem('businessId', businessId);
                localStorage.setItem('employeeName', empData ? (empData.name || email) : email);
            }

            if (role === 'employee') {
                // Obtener tiendas del negocio
                const storesSnap = await getDocs(collection(db, "businesses", businessId, "stores"));
                const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (stores.length === 0) {
                    await signOut(auth);
                    throw new Error("No hay tiendas configuradas para este negocio. Contacte al administrador.");
                }

                // BUSCAR TURNO ABIERTO PREVIO antes de mostrar selección (por si ya estaba trabajando)
                const qTurno = query(
                    collection(db, "businesses", businessId, "sessions"), 
                    where("employeeEmail", "==", email),
                    where("turnoStatus", "==", "ABIERTO")
                );
                const turnoSnap = await getDocs(qTurno);

                if (!turnoSnap.empty) {
                    const tDoc = turnoSnap.docs[0];
                    const tData = tDoc.data();
                    localStorage.setItem('currentShiftId', tDoc.id);
                    localStorage.setItem('shiftStartTime', tData.startTime);
                    localStorage.setItem('storeId', tData.storeId);
                    localStorage.setItem('storeName', tData.storeName);
                    localStorage.setItem('userEmail', email);
                    navigate('#dashboard');
                    return;
                }

                // Renderizar Selección de Tienda (Solo si no hay turno abierto)
                const card = container.querySelector('.auth-card');
                let optionsHtml = stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
                
                card.innerHTML = `
                    <div class="text-center mb-4">
                        <h2>Seleccione su tienda</h2>
                        <p class="text-muted text-sm">¿En qué sucursal trabajará hoy?</p>
                    </div>
                    <form id="storeSelectionForm">
                        <div class="form-group mb-4">
                            <label>Tienda / Sucursal</label>
                            <select class="form-control" id="storeSelect" required>
                                <option value="" disabled selected>Selecciona una tienda</option>
                                ${optionsHtml}
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary mb-4" id="storeSubmitBtn">Abrir Turno e Ingresar</button>
                    </form>
                `;

                const storeForm = card.querySelector('#storeSelectionForm');
                storeForm.addEventListener('submit', async (ev) => {
                    ev.preventDefault();
                    const storeBtn = card.querySelector('#storeSubmitBtn');
                    storeBtn.disabled = true;
                    storeBtn.textContent = 'Abriendo turno...';

                    const selectEl = card.querySelector('#storeSelect');
                    const selectedStoreId = selectEl.value;
                    const selectedStoreName = selectEl.options[selectEl.selectedIndex].text;

                    try {
                        const startTime = new Date().toISOString();
                        // Registrar nuevo turno (session)
                        const docRef = await addDoc(collection(db, "businesses", businessId, "sessions"), {
                            storeId: selectedStoreId,
                            storeName: selectedStoreName,
                            employeeEmail: email,
                            employeeName: empData ? (empData.name || email) : email,
                            role: cargo,
                            startTime: startTime,
                            turnoStatus: 'ABIERTO',
                            status: 'active'
                        });

                        localStorage.setItem('currentShiftId', docRef.id);
                        localStorage.setItem('shiftStartTime', startTime);
                        localStorage.setItem('storeId', selectedStoreId);
                        localStorage.setItem('storeName', selectedStoreName);
                        localStorage.setItem('userEmail', email);
                        navigate('#dashboard');
                    } catch (err) {
                        console.error("Error al abrir turno:", err);
                        alert("Error: " + err.message);
                        storeBtn.disabled = false;
                        storeBtn.textContent = 'Abrir Turno e Ingresar';
                    }
                });
                
                return; 
            }

            // SI ES ADMINISTRADOR (Dueño o Empleado con cargo Admin)
            // 1. Buscar turno abierto previo
            const qAdmin = query(
                collection(db, "businesses", businessId, "sessions"), 
                where("employeeEmail", "==", email),
                where("turnoStatus", "==", "ABIERTO")
            );
            const adminTurnoSnap = await getDocs(qAdmin);

            if (!adminTurnoSnap.empty) {
                const tDoc = adminTurnoSnap.docs[0];
                const tData = tDoc.data();
                localStorage.setItem('currentShiftId', tDoc.id);
                localStorage.setItem('shiftStartTime', tData.startTime);
                // Si el admin tenía una tienda específica (poco común pero posible), la respetamos
                localStorage.setItem('storeId', tData.storeId || 'general');
                localStorage.setItem('storeName', tData.storeName || 'Sede Principal');
            } else {
                // Crear nuevo turno para Admin
                const startTime = new Date().toISOString();
                const docRef = await addDoc(collection(db, "businesses", businessId, "sessions"), {
                    storeId: 'general',
                    storeName: 'Sede Principal',
                    employeeEmail: email,
                    employeeName: empData.name || 'Administrador',
                    role: cargo,
                    startTime: startTime,
                    turnoStatus: 'ABIERTO',
                    status: 'active'
                });
                localStorage.setItem('currentShiftId', docRef.id);
                localStorage.setItem('shiftStartTime', startTime);
                localStorage.setItem('storeId', 'general');
                localStorage.setItem('storeName', 'Sede Principal');
            }

            localStorage.setItem('userEmail', email);
            navigate('#dashboard');

        } catch (error) {
            console.error(error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ingresar';
            if (error.code === 'auth/invalid-credential') {
                errorMsg.textContent = 'Correo o contraseña incorrectos.';
            } else {
                errorMsg.textContent = 'Error: ' + error.message;
            }
        }
    });

    return container;
}
