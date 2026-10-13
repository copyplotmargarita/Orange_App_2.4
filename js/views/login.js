import { navigate, showPromptModal, showConfirmModal } from '../utils.js';

function showPinSuccessModal(pin, actionMessage) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        modal.innerHTML = `
            <div class="card" style="padding: 2.5rem; max-width: 450px; text-align: center; width: 90%; border-radius: 1.5rem; border: 2px solid var(--primary);">
                <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔐</div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">${actionMessage}</h3>
                
                <div style="background: var(--background); padding: 1.5rem; border-radius: 12px; border: 1px dashed var(--primary); margin-bottom: 1.5rem; margin-top: 1.5rem;">
                    <p style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 800;">Su Nuevo PIN</p>
                    <div style="font-family: monospace; font-size: 2.2rem; font-weight: 900; letter-spacing: 4px; color: var(--primary);">${pin}</div>
                </div>

                <div style="background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem; text-align: left;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <p style="font-size: 0.85rem; color: var(--danger); margin: 0; line-height: 1.4; font-weight: 600;"><strong>¡Importante!</strong> Anote y guarde su PIN en un lugar seguro. Por motivos de seguridad, no podrá volver a verlo después de cerrar esta ventana.</p>
                </div>
                
                <button class="btn btn-primary" id="btnPinSuccessModalListo" style="width: 100%; height: 50px; font-size: 1rem; font-weight: 800; border-radius: 12px;">¡LISTO, YA LO ANOTÉ!</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#btnPinSuccessModalListo').addEventListener('click', () => {
            modal.remove();
            resolve();
        });
    });
}

import { auth, db } from '../services/firebase.js';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, collectionGroup, updateDoc, limit } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

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
                    <div style="display: flex; gap: 0.5rem; background: var(--surface); padding: 0.5rem; border-radius: 12px; border: 1px solid var(--border);">
                        <button type="button" class="btn role-toggle-btn active" data-role="propietario" style="flex: 1; height: 38px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; transition: 0.3s; background: var(--primary); color: white;">Propietario</button>
                        <button type="button" class="btn role-toggle-btn" data-role="empleado" style="flex: 1; height: 38px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; transition: 0.3s; background: transparent; color: var(--text-muted); border: none;">Empleado</button>
                    </div>
                    <input type="hidden" id="roleSelect" value="propietario">
                </div>
                
                <div id="propietarioFields">
                    <div class="form-group mb-4">
                        <label>Correo Electrónico</label>
                        <input type="email" id="email" class="form-control" placeholder="correo@ejemplo.com" required>
                    </div>
                    
                    <div class="form-group mb-4">
                        <label>Contraseña</label>
                        <input type="password" id="password" class="form-control" placeholder="••••••••" required>
                    </div>
                </div>

                <div id="empleadoFields" style="display: none;">
                    <div class="form-group mb-4">
                        <label>Código de Acceso <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 400; text-transform: none;">(10 caracteres)</span></label>
                        <div style="position: relative;">
                            <input type="text" id="employeePin" class="form-control" placeholder="Ej. EMPR123456" maxlength="10" style="text-transform: uppercase; font-family: monospace; font-size: 1.1rem; letter-spacing: 2px; text-align: center;">
                        </div>
                    </div>
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
    
    // UI Toggle logic
    const roleBtns = container.querySelectorAll('.role-toggle-btn');
    const roleInput = container.querySelector('#roleSelect');
    const ownerFields = container.querySelector('#propietarioFields');
    const empFields = container.querySelector('#empleadoFields');
    const emailInput = container.querySelector('#email');
    const pwdInput = container.querySelector('#password');
    const pinInput = container.querySelector('#employeePin');

    roleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            roleBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text-muted)';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
            
            const role = btn.dataset.role;
            roleInput.value = role;

            if (role === 'propietario') {
                ownerFields.style.display = 'block';
                empFields.style.display = 'none';
                emailInput.required = true;
                pwdInput.required = true;
                pinInput.required = false;
                if (forgotPwdLnk) forgotPwdLnk.parentElement.style.display = 'block';
            } else {
                ownerFields.style.display = 'none';
                empFields.style.display = 'block';
                emailInput.required = false;
                pwdInput.required = false;
                pinInput.required = true;
                if (forgotPwdLnk) forgotPwdLnk.parentElement.style.display = 'none'; // Empleados no resetean por email
            }
        });
    });

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

        const role = container.querySelector('#roleSelect').value;

        try {
            // Asegurar deviceId único globalmente para esta sesión de navegador
            let deviceId = localStorage.getItem('deviceId');
            if (!deviceId) {
                deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
                localStorage.setItem('deviceId', deviceId);
            }
            
            let empData = null;
            let businessId = null;
            let cargo = "Administrador";
            let email = ""; // Usaremos el email si es dueño, o un fallback si es empleado
            
            if (role === 'empleado') {
                // FLUJO V3: AUTENTICACIÓN DE EMPLEADO CON CÓDIGO (Auth Email/Password)
                const pin = pinInput.value.toUpperCase();
                if (pin.length !== 10) {
                    throw new Error("El código de acceso debe tener exactamente 10 caracteres.");
                }
                
                const businessCode = pin.substring(0, 4).toUpperCase();
                const plainPin = pin.substring(4);
                
                // 1. Buscar al empleado en Firestore por businessCode
                const q = query(
                    collection(db, 'businesses'),
                    where('businessCode', '==', businessCode),
                    limit(1)
                );
                const businessSnap = await getDocs(q);
                
                if (businessSnap.empty) {
                    throw new Error("Código de negocio inválido.");
                }
                
                const bId = businessSnap.docs[0].id;
                
                // 2. Buscar al empleado por hash del PIN
                // NOTA: crypto.subtle solo funciona en HTTPS o localhost.
                // Para soportar acceso por IP local (HTTP) desde móviles,
                // usamos un fallback con SHA-256 implementado en JS puro.
                async function sha256(message) {
                    if (window.crypto && window.crypto.subtle) {
                        const enc = new TextEncoder();
                        const buf = await window.crypto.subtle.digest('SHA-256', enc.encode(message));
                        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
                    }
                    // Fallback: SHA-256 puro en JS (RFC 6234)
                    function rightRotate(v, a) { return (v >>> a) | (v << (32 - a)); }
                    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
                               0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
                               0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
                               0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
                               0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
                               0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
                               0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
                               0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
                    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
                    const bytes = new TextEncoder().encode(message);
                    const bits = bytes.length * 8;
                    const extra = bytes.length % 64 < 56 ? 55 - (bytes.length % 64) : 119 - (bytes.length % 64);
                    const padded = new Uint8Array(bytes.length + 1 + extra + 8);
                    padded.set(bytes);
                    padded[bytes.length] = 0x80;
                    const view = new DataView(padded.buffer);
                    view.setUint32(padded.length - 4, bits, false);
                    for (let i = 0; i < padded.length; i += 64) {
                        const w = new Uint32Array(64);
                        for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
                        for (let j = 16; j < 64; j++) {
                            const s0 = rightRotate(w[j-15],7)^rightRotate(w[j-15],18)^(w[j-15]>>>3);
                            const s1 = rightRotate(w[j-2],17)^rightRotate(w[j-2],19)^(w[j-2]>>>10);
                            w[j] = (w[j-16]+s0+w[j-7]+s1) >>> 0;
                        }
                        let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
                        for (let j = 0; j < 64; j++) {
                            const S1 = rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25);
                            const ch = (e&f)^(~e&g);
                            const temp1 = (h+S1+ch+K[j]+w[j]) >>> 0;
                            const S0 = rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22);
                            const maj = (a&b)^(a&c)^(b&c);
                            const temp2 = (S0+maj) >>> 0;
                            h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0;
                        }
                        h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
                        h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
                    }
                    return [h0,h1,h2,h3,h4,h5,h6,h7].map(n => n.toString(16).padStart(8,'0')).join('');
                }

                const PEPPER = "V3_ORANGE_APP_SECURE_PEPPER_2026";
                const hashToVerify = await sha256(businessCode + plainPin + PEPPER);
                
                const empQ = query(
                    collection(db, 'businesses', bId, 'employees'),
                    where('pin', '==', hashToVerify),
                    limit(1)
                );
                const empSnap = await getDocs(empQ);
                
                if (empSnap.empty) {
                    throw new Error("Credenciales incorrectas.");
                }
                
                const employeeDoc = empSnap.docs[0];
                const employeeData = employeeDoc.data();
                
                // 3. Verificar estado
                if (employeeData.status !== 'ACTIVO') {
                    throw new Error(`Tu cuenta está ${employeeData.status}. Contacta al administrador.`);
                }
                
                // 4. Login con Auth usando email/password
                if (!employeeData.authEmail) {
                    throw new Error("Tu cuenta aún no está activada. Contacta al administrador.");
                }
                
                await signInWithEmailAndPassword(auth, employeeData.authEmail, plainPin);
                
                // 5. Guardar datos de sesión
                empData = employeeData;
                businessId = bId;
                cargo = employeeData.role || 'Empleado';
                email = employeeData.email || employeeData.authEmail;
                
                localStorage.setItem('userRole', 'employee');
                localStorage.setItem('businessId', bId);
                localStorage.setItem('employeeId', employeeDoc.id);
                localStorage.setItem('employeeName', employeeData.name);
                localStorage.setItem('isOwner', 'false');
                localStorage.setItem('userEmail', email);

            } else {
                // FLUJO PROPIETARIO (O ADMIN DE LEGACY)
                email = emailInput.value;
                const password = pwdInput.value;
                
                await signInWithEmailAndPassword(auth, email, password);
                await new Promise(resolve => setTimeout(resolve, 350));
                
                const uid = auth.currentUser.uid;
                
                let businessDoc = await getDoc(doc(db, "businesses", uid));
                let businessExists = businessDoc.exists();
                if (businessExists) {
                    businessId = uid;
                } else {
                    // Buscar por email
                    const qBus = query(collection(db, "businesses"), where("email", "==", email));
                    const busSnap = await getDocs(qBus);
                    if (!busSnap.empty) {
                        businessId = busSnap.docs[0].id;
                        businessExists = true;
                    }
                }
                
                if (!businessExists) {
                    await signOut(auth);
                    throw new Error("No se encontró un negocio registrado para esta cuenta.");
                }

                // Configurar sesión para el dueño
                cargo = 'Administrador';
                empData = { name: 'Propietario', role: 'Administrador' };
                
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('businessId', businessId);
                localStorage.setItem('employeeName', 'Propietario');
                localStorage.setItem('isOwner', 'true');
            }

            if (role === 'empleado') {
                // Obtener tiendas del negocio
                const storesSnap = await getDocs(collection(db, "businesses", businessId, "stores"));
                const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (stores.length === 0) {
                    await signOut(auth);
                    throw new Error("No hay tiendas configuradas para este negocio. Contacte al administrador.");
                }

                // BUSCAR TURNO ABIERTO PREVIO antes de mostrar selección (por si ya estaba trabajando)
                const qTurno = query(
                    collection(db, "businesses", businessId, "turnos"), 
                    where("CORREO_USUARIO_LOGUEADO", "==", email),
                    where("ESTADO_TURNO", "==", "ABIERTO")
                );
                const turnoSnap = await getDocs(qTurno);

                let hasValidShift = false;
                if (!turnoSnap.empty) {
                    const sortedDocs = [...turnoSnap.docs].sort((a, b) => 
                        new Date(a.data().TIMESTAMP_INICIO_TURNO) - new Date(b.data().TIMESTAMP_INICIO_TURNO)
                    );
                    for (const tDoc of sortedDocs) {
                        const tData = tDoc.data();
                        const shiftStart = new Date(tData.TIMESTAMP_INICIO_TURNO);
                        const now = new Date();
                        const hoursPassed = (now - shiftStart) / (1000 * 60 * 60);

                        if (hoursPassed >= 16) {
                            // Auto-cerrar turno olvidado (16 hrs)
                            await updateDoc(doc(db, "businesses", businessId, "turnos", tDoc.id), {
                                ESTADO_TURNO: 'CERRADO',
                                TIMESTAMP_CIERRE_TURNO: now.toISOString(),
                                autoClosed: true
                            });
                        } else if (!hasValidShift) {
                            hasValidShift = true;
                            // Actualizar el activeDeviceId para este turno
                            await updateDoc(doc(db, "businesses", businessId, "turnos", tDoc.id), {
                                activeDeviceId: deviceId
                            });

                            localStorage.setItem('currentShiftId', tDoc.id);
                            localStorage.setItem('shiftStartTime', tData.TIMESTAMP_INICIO_TURNO);
                            localStorage.setItem('storeId', tData.ID_TIENDA);
                            localStorage.setItem('storeName', tData.NOMBRE_TIENDA);
                            localStorage.setItem('userEmail', email);
                            
                            if (window.innerWidth < 1024 && document.documentElement.requestFullscreen) {
                                document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen request denied", e));
                            }
                            
                            navigate('#dashboard');
                            return; // Salir inmediatamente tras encontrar el válido
                        }
                    }
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
                        // Registrar nuevo turno (turnos)
                        const docRef = await addDoc(collection(db, "businesses", businessId, "turnos"), {
                            ID_TIENDA: selectedStoreId,
                            NOMBRE_TIENDA: selectedStoreName,
                            CORREO_USUARIO_LOGUEADO: email,
                            NOMBRE_USUARIO_LOGUEADO: empData ? (empData.name || email) : email,
                            CARGO_USUARIO_LOGUEADO: cargo,
                            TIMESTAMP_INICIO_TURNO: startTime,
                            TIMESTAMP_CIERRE_TURNO: null,
                            ESTADO_TURNO: 'ABIERTO',
                            status: 'active',
                            activeDeviceId: deviceId
                        });

                        localStorage.setItem('currentShiftId', docRef.id);
                        localStorage.setItem('shiftStartTime', startTime);
                        localStorage.setItem('storeId', selectedStoreId);
                        localStorage.setItem('storeName', selectedStoreName);
                        localStorage.setItem('userEmail', email);
                        
                        if (window.innerWidth < 1024 && document.documentElement.requestFullscreen) {
                            document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen request denied", e));
                        }
                        
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
                collection(db, "businesses", businessId, "turnos"), 
                where("CORREO_USUARIO_LOGUEADO", "==", email),
                where("ESTADO_TURNO", "==", "ABIERTO")
            );
            const adminTurnoSnap = await getDocs(qAdmin);

            let adminHasOpenShift = false;
            if (!adminTurnoSnap.empty) {
                const sortedDocs = [...adminTurnoSnap.docs].sort((a, b) => 
                    new Date(a.data().TIMESTAMP_INICIO_TURNO) - new Date(b.data().TIMESTAMP_INICIO_TURNO)
                );
                for (const tDoc of sortedDocs) {
                    const tData = tDoc.data();
                    const shiftStart = new Date(tData.TIMESTAMP_INICIO_TURNO);
                    const now = new Date();
                    const hoursPassed = (now - shiftStart) / (1000 * 60 * 60);

                    if (hoursPassed >= 16) {
                        // Auto-cerrar turno olvidado (16 hrs)
                        await updateDoc(doc(db, "businesses", businessId, "turnos", tDoc.id), {
                            ESTADO_TURNO: 'CERRADO',
                            TIMESTAMP_CIERRE_TURNO: now.toISOString(),
                            autoClosed: true
                        });
                    } else if (!adminHasOpenShift) {
                        adminHasOpenShift = true;
                        // Actualizar el activeDeviceId para este turno
                        await updateDoc(doc(db, "businesses", businessId, "turnos", tDoc.id), {
                            activeDeviceId: deviceId
                        });

                        localStorage.setItem('currentShiftId', tDoc.id);
                        localStorage.setItem('shiftStartTime', tData.TIMESTAMP_INICIO_TURNO);
                        // Si el admin tenía una tienda específica (poco común pero posible), la respetamos
                        localStorage.setItem('storeId', tData.ID_TIENDA || 'general');
                        localStorage.setItem('storeName', tData.NOMBRE_TIENDA || 'Sede Principal');
                    }
                }
            }

            if (!adminHasOpenShift) {
                // Crear nuevo turno para Admin
                const startTime = new Date().toISOString();
                const docRef = await addDoc(collection(db, "businesses", businessId, "turnos"), {
                    ID_TIENDA: 'general',
                    NOMBRE_TIENDA: 'Sede Principal',
                    CORREO_USUARIO_LOGUEADO: email,
                    NOMBRE_USUARIO_LOGUEADO: empData.name || 'Administrador',
                    CARGO_USUARIO_LOGUEADO: cargo,
                    TIMESTAMP_INICIO_TURNO: startTime,
                    TIMESTAMP_CIERRE_TURNO: null,
                    ESTADO_TURNO: 'ABIERTO',
                    status: 'active',
                    activeDeviceId: deviceId
                });
                localStorage.setItem('currentShiftId', docRef.id);
                localStorage.setItem('shiftStartTime', startTime);
                localStorage.setItem('storeId', 'general');
                localStorage.setItem('storeName', 'Sede Principal');
            }

            localStorage.setItem('userEmail', email);
            
            if (window.innerWidth < 1024 && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen request denied", e));
            }
            
            navigate('#dashboard');

        } catch (error) {
            console.error(error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Ingresar';
            if (error.code === 'auth/invalid-credential') {
                errorMsg.textContent = 'Correo o contraseña incorrectos.';
            } else if (error.message && error.message.includes('employee-status:')) {
                const status = error.message.split(':')[1];
                if (status === 'INACTIVO') {
                    errorMsg.textContent = 'No estás activo en este negocio. Comunícate con tu superior.';
                } else if (status === 'VACACIONES') {
                    errorMsg.textContent = 'Estás de vacaciones en este negocio.';
                } else if (status === 'ELIMINADO') {
                    errorMsg.textContent = 'Ya no perteneces a este negocio.';
                }
            } else {
                errorMsg.textContent = 'Error: ' + error.message;
            }
        }
    });

    return container;
}

async function showPinChangeModal() {
    return new Promise((resolve) => {
        const modalHtml = `
            <div id="pinChangeModalOverlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 1rem;">
                <div class="card" style="width: 100%; max-width: 400px; padding: 1.5rem; text-align: center; border-radius: 12px; background: var(--surface);">
                    <h3 style="margin-bottom: 0.5rem; color: var(--text-main);">🔒 Cambio de PIN Obligatorio</h3>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem;">Por motivos de seguridad, debes establecer un nuevo PIN de 6 dígitos antes de continuar.</p>
                    <form id="pinChangeForm">
                        <div class="form-group mb-3 text-start">
                            <label style="font-size: 0.85rem; font-weight: 600;">Nuevo PIN (6 dígitos)</label>
                            <input type="password" id="newPinInput" class="form-control" maxlength="6" pattern="\\d{6}" required placeholder="••••••" style="text-align: center; font-size: 1.5rem; letter-spacing: 5px;">
                        </div>
                        <div class="form-group mb-4 text-start">
                            <label style="font-size: 0.85rem; font-weight: 600;">Confirmar Nuevo PIN</label>
                            <input type="password" id="confirmPinInput" class="form-control" maxlength="6" pattern="\\d{6}" required placeholder="••••••" style="text-align: center; font-size: 1.5rem; letter-spacing: 5px;">
                        </div>
                        <div id="pinErrorMsg" style="color: var(--danger); font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>
                        <div style="display: flex; gap: 1rem;">
                            <button type="button" id="cancelPinBtn" class="btn" style="flex: 1; background: var(--border); color: var(--text-main);">Cancelar</button>
                            <button type="submit" id="savePinBtn" class="btn btn-primary" style="flex: 1;">Guardar PIN</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const overlay = document.getElementById('pinChangeModalOverlay');
        const form = document.getElementById('pinChangeForm');
        const newPinInput = document.getElementById('newPinInput');
        const confirmPinInput = document.getElementById('confirmPinInput');
        const cancelBtn = document.getElementById('cancelPinBtn');
        const errorMsg = document.getElementById('pinErrorMsg');

        const cleanup = () => {
            if (overlay) overlay.remove();
        };

        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(null);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            errorMsg.style.display = 'none';
            const pin = newPinInput.value;
            const confirm = confirmPinInput.value;
            
            if (!/^\d{6}$/.test(pin)) {
                errorMsg.textContent = 'El PIN debe ser de exactamente 6 dígitos numéricos.';
                errorMsg.style.display = 'block';
                return;
            }
            if (pin !== confirm) {
                errorMsg.textContent = 'Los PIN no coinciden. Intenta de nuevo.';
                errorMsg.style.display = 'block';
                return;
            }
            
            const saveBtn = document.getElementById('savePinBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';
            cleanup();
            resolve(pin);
        });
    });
}
