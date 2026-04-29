import { navigate } from '../app.js';
import { auth, db } from '../services/firebase.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

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
                <p class="text-sm">¿No tienes cuenta? <a href="#register" style="color: var(--primary); text-decoration: none; font-weight: 500;">Regístrate aquí</a></p>
            </div>
        </div>
    `;

    const form = container.querySelector('#loginForm');
    const errorMsg = container.querySelector('#errorMsg');
    const submitBtn = container.querySelector('#submitBtn');

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
            
            // Verificación estricta de seguridad
            const uid = auth.currentUser.uid;
            
            // 1. ¿Es el dueño principal del negocio?
            const businessDoc = await getDoc(doc(db, "businesses", uid));
            if (businessDoc.exists()) {
                // Es el dueño, forzamos su rol a admin sin importar qué haya seleccionado en el dropdown
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('businessId', uid);
                navigate('#dashboard');
                return;
            }
            
            // 2. Si no es el dueño, debe ser un empleado. Buscamos su cargo en la BD
            let empData = null;
            let businessId = null;
            const businessesSnap = await getDocs(collection(db, "businesses"));
            for (const bDoc of businessesSnap.docs) {
                const q = query(collection(db, "businesses", bDoc.id, "employees"), where("email", "==", email));
                const empSnap = await getDocs(q);
                if (!empSnap.empty) {
                    empData = empSnap.docs[0].data();
                    businessId = bDoc.id;
                    break;
                }
            }
            
            if (!empData) {
                await signOut(auth);
                throw new Error("Usuario no encontrado en la base de datos.");
            }
            
            // 3. Validar privilegios contra el rol seleccionado en el formulario
            const cargo = empData.role; // "Administrador", "Cajero", "Vendedor", etc.
            
            if (role === 'admin' && cargo !== 'Administrador') {
                await signOut(auth);
                throw new Error("Acceso denegado: Tu cargo (" + cargo + ") no tiene privilegios de Administrador.");
            }
            
            // Si todo está bien, guardamos el rol localmente
            localStorage.setItem('userRole', role);
            localStorage.setItem('businessId', businessId);
            localStorage.setItem('employeeName', empData ? (empData.name || email) : email);

            if (role === 'employee') {
                // Obtener tiendas del negocio
                const storesSnap = await getDocs(collection(db, "businesses", businessId, "stores"));
                const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                if (stores.length === 0) {
                    await signOut(auth);
                    throw new Error("No hay tiendas configuradas para este negocio. Contacte al administrador.");
                }

                // Renderizar Selección de Tienda
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
                        <button type="submit" class="btn btn-primary mb-4" id="storeSubmitBtn">Aceptar e Ingresar</button>
                    </form>
                `;

                const storeForm = card.querySelector('#storeSelectionForm');
                storeForm.addEventListener('submit', async (ev) => {
                    ev.preventDefault();
                    const storeBtn = card.querySelector('#storeSubmitBtn');
                    storeBtn.disabled = true;
                    storeBtn.textContent = 'Registrando turno...';

                    const selectEl = card.querySelector('#storeSelect');
                    const selectedStoreId = selectEl.value;
                    const selectedStoreName = selectEl.options[selectEl.selectedIndex].text;

                    try {
                        // Registrar sesión en Firestore
                        await addDoc(collection(db, "businesses", businessId, "sessions"), {
                            storeId: selectedStoreId,
                            storeName: selectedStoreName,
                            employeeEmail: email,
                            employeeName: empData ? (empData.name || email) : email,
                            startTime: new Date().toISOString(),
                            status: 'active'
                        });

                        localStorage.setItem('storeId', selectedStoreId);
                        localStorage.setItem('storeName', selectedStoreName);
                        navigate('#dashboard');
                    } catch (err) {
                        console.error("Error registrando turno:", err);
                        alert("Hubo un error al registrar el turno: " + err.message);
                        storeBtn.disabled = false;
                        storeBtn.textContent = 'Aceptar e Ingresar';
                    }
                });
                
                return; // Evitamos navegar al dashboard todavía
            }

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
