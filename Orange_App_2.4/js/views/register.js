import { navigate } from '../utils.js';
import { auth, db } from '../services/firebase.js';
import { toTitleCase } from '../utils.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const countryCodes = {
    'VE': '+58', 'CO': '+57', 'MX': '+52', 'US': '+1',
    'ES': '+34', 'AR': '+54', 'CL': '+56', 'PE': '+51'
};

export function renderRegister() {
    const container = document.createElement('div');
    container.className = 'auth-layout';
    
    container.innerHTML = `
        <div class="card auth-card" style="max-width: 500px;">
            <div class="text-center mb-4">
                <h2>Registro de Negocio</h2>
                <p class="text-muted text-sm">Crea tu cuenta administrativa</p>
            </div>
            
            <form id="registerForm">
                <div id="errorMsg" style="color: var(--danger); font-size: 0.875rem; margin-bottom: 1rem; text-align: center;"></div>
                
                <div class="form-group mb-2">
                    <label>Nombre del Negocio</label>
                    <input type="text" class="form-control" id="businessName" required>
                </div>
                
                <div class="form-group mb-2">
                    <label>País</label>
                    <select class="form-control" id="countrySelect" required>
                        <option value="">Seleccione un país...</option>
                        <option value="VE">Venezuela</option>
                        <option value="CO">Colombia</option>
                        <option value="MX">México</option>
                        <option value="US">Estados Unidos</option>
                        <option value="ES">España</option>
                        <option value="AR">Argentina</option>
                        <option value="CL">Chile</option>
                        <option value="PE">Perú</option>
                    </select>
                </div>

                <div style="display: flex; gap: 1rem;" class="flex-stack-mobile">
                    <div class="form-group mb-2" style="flex: 1;">
                        <label>Ciudad</label>
                        <input type="text" class="form-control" id="city" required>
                    </div>
                    <div class="form-group mb-2" style="flex: 1;">
                        <label>Dirección</label>
                        <input type="text" class="form-control" id="address" required>
                    </div>
                </div>

                <div class="form-group mb-2">
                    <label>Teléfono</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" class="form-control" id="phoneCode" style="width: 80px;" readonly placeholder="+XX">
                        <input type="tel" class="form-control" id="phoneNumber" placeholder="414 2367458" style="flex: 1;" required>
                    </div>
                </div>
                
                <div class="form-group mb-2">
                    <label>Correo Electrónico</label>
                    <input type="email" class="form-control" id="email" required>
                </div>
                
                <div class="form-group mb-4">
                    <label>Contraseña</label>
                    <input type="password" class="form-control" id="password" minlength="6" required>
                </div>
                
                <button type="submit" class="btn btn-primary mb-4" id="submitBtn">Siguiente</button>
            </form>
            
            <div class="text-center">
                <p class="text-sm">¿Ya tienes cuenta? <a href="#login" style="color: var(--primary); text-decoration: none; font-weight: 500;">Inicia Sesión</a></p>
            </div>
        </div>

        <div id="loadingOverlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 100;">
            <div class="card text-center" style="max-width: 400px; padding: 2rem;">
                <h3 class="mb-2">Creando Cuenta...</h3>
                <div style="width: 40px; height: 40px; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
        </div>
        <style>
            @keyframes spin { 100% { transform: rotate(360deg); } }
        </style>
    `;

    const countrySelect = container.querySelector('#countrySelect');
    const phoneCode = container.querySelector('#phoneCode');
    const form = container.querySelector('#registerForm');
    const loadingOverlay = container.querySelector('#loadingOverlay');
    const errorMsg = container.querySelector('#errorMsg');

    countrySelect.addEventListener('change', (e) => {
        phoneCode.value = countryCodes[e.target.value] || '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';
        loadingOverlay.style.display = 'flex';
        
        const email = container.querySelector('#email').value;
        const password = container.querySelector('#password').value;
        const businessData = {
            name: toTitleCase(container.querySelector('#businessName').value),
            country: countrySelect.value,
            city: toTitleCase(container.querySelector('#city').value),
            address: toTitleCase(container.querySelector('#address').value),
            phone: phoneCode.value + " " + container.querySelector('#phoneNumber').value,
            createdAt: new Date().toISOString()
        };

        try {
            // 1. Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Guardar datos del negocio en Firestore
            await setDoc(doc(db, "businesses", user.uid), businessData);

            // 3. Redirigir a configuración
            loadingOverlay.style.display = 'none';
            navigate('#config');
            
        } catch (error) {
            loadingOverlay.style.display = 'none';
            console.error(error);
            if(error.code === 'auth/email-already-in-use') {
                errorMsg.textContent = 'El correo ya está en uso.';
            } else {
                errorMsg.textContent = 'Error al registrar: ' + error.message;
            }
        }
    });

    return container;
}
