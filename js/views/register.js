import { navigate } from '../utils.js';
import { auth, db } from '../services/firebase.js';
import { toTitleCase } from '../utils.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { COUNTRY_CONFIG, DEFAULT_COUNTRY } from '../data/countries.js';

export function renderRegister() {
    const container = document.createElement('div');
    container.className = 'auth-layout';

    container.innerHTML = `
        <div class="card auth-card" style="max-width: 600px; padding: 2.5rem;">
            <div class="text-center mb-5">
                <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem;">Registro de Negocio</h2>
                <p class="text-muted text-sm">Crea tu cuenta administrativa</p>
            </div>

            <form id="registerForm">
                <div id="errorMsg" style="color: var(--danger); font-size: 0.875rem; margin-bottom: 1.5rem; text-align: center; font-weight: 600;"></div>

                <!-- SECCIÓN 1: EMPRESA -->
                <div class="section-divider" style="margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
                    <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 800;">🏢 Datos de la Empresa</h3>
                </div>

                <div class="form-group mb-3">
                    <label>Nombre del Negocio</label>
                    <input type="text" class="form-control" id="businessName" placeholder="Ej. Inversiones Orange C.A." required>
                </div>

                <div class="form-group mb-3">
                    <label>País</label>
                    <select class="form-control" id="countrySelect" required>
                        <option value="">Cargando países...</option>
                    </select>
                </div>

                <div class="form-group mb-3" id="businessDocContainer">
                    <label id="businessDocLabel">Documento de la Empresa</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <select id="businessDocPrefix" class="form-control" style="width: 160px;">
                            <option value="V-">V - Venezolano</option>
                            <option value="J-">J - Jurídico</option>
                            <option value="G-">G - Gubernamental</option>
                            <option value="E-">E - Extranjero</option>
                        </select>
                        <input type="text" id="businessDocNumber" class="form-control" placeholder="Número de documento" style="flex: 1;" required>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;" class="flex-stack-mobile">
                    <div class="form-group" style="flex: 1;" id="stateContainer">
                        <label id="stateLabel">Estado</label>
                        <select id="stateSelect" class="form-control" required>
                            <option value="">Seleccione...</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1;" id="municipalityContainer">
                        <label id="municipalityLabel">Municipio</label>
                        <select id="municipalitySelect" class="form-control" required disabled>
                            <option value="">Seleccione...</option>
                        </select>
                    </div>
                </div>

                <div class="form-group mb-3">
                    <label>Dirección Exacta</label>
                    <textarea class="form-control" id="address" rows="2" placeholder="Av. Principal con calle 5, Local 2..." required style="padding-top: 0.5rem;"></textarea>
                </div>

                <div class="form-group mb-5">
                    <label>Logo de la Empresa</label>
                    <div style="display: flex; align-items: center; gap: 1rem; background: var(--background); padding: 1rem; border-radius: 12px; border: 2px dashed var(--border);">
                        <div id="logoPreview" style="width: 60px; height: 60px; border-radius: 8px; background: var(--surface); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border);">
                            <span style="font-size: 1.5rem;">🖼️</span>
                        </div>
                        <div style="flex: 1;">
                            <input type="file" id="businessLogo" accept="image/*" style="display: none;">
                            <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('businessLogo').click()" style="width: auto;">Subir Imagen</button>
                            <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px;">Formato recomendado: PNG o JPG (Máx 2MB)</p>
                        </div>
                    </div>
                </div>

                <!-- SECCIÓN 2: PROPIETARIO -->
                <div class="section-divider" style="margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
                    <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 800;">👤 Datos del Propietario</h3>
                </div>

                <div class="form-group mb-3">
                    <label>Nombre Completo</label>
                    <input type="text" class="form-control" id="ownerName" placeholder="Ej. Juan Pérez" required>
                </div>

                <div class="form-group mb-3">
                    <label>Documento de Identidad</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <select id="ownerDocPrefix" class="form-control" style="width: 160px;">
                            <option value="V-">V - Venezolano</option>
                            <option value="E-">E - Extranjero</option>
                        </select>
                        <input type="text" id="ownerDocNumber" class="form-control" placeholder="Número de documento" style="flex: 1;" required>
                    </div>
                </div>

                <div class="form-group mb-3">
                    <label>Teléfono Móvil</label>
                    <input type="tel" class="form-control" id="ownerPhone" required>
                </div>

                <div class="form-group mb-3">
                    <label>Correo Electrónico</label>
                    <input type="email" class="form-control" id="email" placeholder="propietario@empresa.com" required>
                </div>

                <div class="form-group mb-5">
                    <label>Contraseña Administrativa</label>
                    <input type="password" class="form-control" id="password" minlength="6" placeholder="Mínimo 6 caracteres" required>
                </div>

                <button type="submit" class="btn btn-primary mb-4" id="submitBtn" style="height: 55px; font-size: 1rem; font-weight: 800;">CREAR CUENTA Y NEGOCIO</button>
            </form>

            <div class="text-center">
                <p class="text-sm">¿Ya tienes cuenta? <a href="#entrar" style="color: var(--primary); text-decoration: none; font-weight: 500;">Inicia Sesión</a></p>
            </div>
        </div>

        <div id="loadingOverlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 10000;">
            <div class="card text-center" style="max-width: 400px; padding: 2.5rem; border-radius: 1.5rem;">
                <div style="width: 60px; height: 60px; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem;"></div>
                <h3 class="mb-2" id="loadingText">Configurando tu Negocio</h3>
                <p class="text-muted text-sm">Estamos preparando tu panel administrativo...</p>
            </div>
        </div>

        <style>
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .form-group label { margin-bottom: 0.35rem !important; color: var(--text-muted) !important; font-weight: 800 !important; font-size: 0.7rem !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
            .iti { width: 100%; display: block; }
            .iti__country-list { background-color: var(--surface) !important; color: var(--text-main) !important; border: 1px solid var(--border) !important; border-radius: 8px !important; }
        </style>
    `;

    const countrySelect = container.querySelector('#countrySelect');
    const form = container.querySelector('#registerForm');
    const loadingOverlay = container.querySelector('#loadingOverlay');
    const loadingText = container.querySelector('#loadingText');
    const errorMsg = container.querySelector('#errorMsg');
    const phoneInput = container.querySelector('#ownerPhone');
    const logoInput = container.querySelector('#businessLogo');
    const logoPreview = container.querySelector('#logoPreview');

    // ── Actualiza tipos de documento y labels de región según país ──────────
    function applyCountryConfig(countryCode) {
        const cfg = COUNTRY_CONFIG[countryCode];

        // Tipos de documento empresa
        const bizPrefix = container.querySelector('#businessDocPrefix');
        if (cfg) {
            bizPrefix.innerHTML = cfg.businessDocTypes
                .map(t => `<option value="${t.prefix}">${t.label}</option>`)
                .join('');
        } else {
            bizPrefix.innerHTML = `<option value="">Tipo</option>`;
        }

        // Tipos de documento propietario
        const ownerPrefix = container.querySelector('#ownerDocPrefix');
        if (cfg) {
            ownerPrefix.innerHTML = cfg.ownerDocTypes
                .map(t => `<option value="${t.prefix}">${t.label}</option>`)
                .join('');
        } else {
            ownerPrefix.innerHTML = `<option value="">Tipo</option>`;
        }

        // Labels de región
        const regionLabel = cfg ? cfg.regionLabel : 'Estado / Región';
        const municipalityLabel = cfg ? cfg.municipalityLabel : 'Ciudad / Localidad';
        container.querySelector('#stateLabel').textContent = regionLabel;
        container.querySelector('#municipalityLabel').textContent = municipalityLabel;
    }

    // ── intlTelInput ────────────────────────────────────────────────────────
    const iti = window.intlTelInput(phoneInput, {
        initialCountry: "auto",
        geoIpLookup: callback => {
            fetch("https://ipapi.co/json/")
                .then(res => res.json())
                .then(data => callback(data.country_code))
                .catch(() => callback("ve"));
        },
        preferredCountries: ["ve", "co", "ar", "mx", "uy", "pa", "es", "us"],
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
    });

    // ── Carga países desde API ──────────────────────────────────────────────
    async function detectUserLocation() {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            return data.country_code || DEFAULT_COUNTRY;
        } catch {
            return DEFAULT_COUNTRY;
        }
    }

    async function fetchCountries() {
        try {
            const userCountry = await detectUserLocation();
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/iso');
            const resData = await res.json();

            if (!resData.error) {
                countrySelect.innerHTML = '<option value="">Seleccione un país...</option>';
                resData.data
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.Iso2;
                        opt.textContent = c.name;
                        if (c.Iso2 === userCountry) opt.selected = true;
                        countrySelect.appendChild(opt);
                    });
                applyCountryConfig(userCountry);
                loadStates(userCountry);
                iti.setCountry(userCountry.toLowerCase());
            }
        } catch {
            countrySelect.innerHTML = '<option value="VE" selected>Venezuela</option>';
            applyCountryConfig('VE');
            loadStates('VE');
        }
    }

    // ── Helpers de región ───────────────────────────────────────────────────
    function toggleLocationField(containerId, fieldId, isSelect, data = []) {
        const fieldContainer = container.querySelector(`#${containerId}`);
        const label = container.querySelector(
            fieldId === 'municipalitySelect' ? '#municipalityLabel' : '#stateLabel'
        ).textContent;

        if (isSelect) {
            fieldContainer.innerHTML = `
                <label id="${fieldId === 'municipalitySelect' ? 'municipalityLabel' : 'stateLabel'}">${label}</label>
                <select id="${fieldId}" class="form-control" required>
                    <option value="">Seleccione...</option>
                    ${data.map(item => `<option value="${item}">${item}</option>`).join('')}
                </select>
            `;
            if (fieldId === 'stateSelect') {
                fieldContainer.querySelector('select').onchange = e => handleStateChange(e.target.value);
            }
        } else {
            fieldContainer.innerHTML = `
                <label id="${fieldId === 'municipalitySelect' ? 'municipalityLabel' : 'stateLabel'}">${label}</label>
                <input type="text" id="${fieldId}" class="form-control" placeholder="Escriba aquí..." required>
            `;
        }
    }

    async function loadStates(countryCode) {
        if (!countryCode) return;
        toggleLocationField('stateContainer', 'stateSelect', true);
        toggleLocationField('municipalityContainer', 'municipalitySelect', true);

        const stateEl = container.querySelector('#stateSelect');
        const munEl = container.querySelector('#municipalitySelect');
        stateEl.innerHTML = '<option value="">Cargando...</option>';
        stateEl.disabled = true;
        munEl.disabled = true;

        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iso2: countryCode })
            });
            const resData = await res.json();

            if (!resData.error && resData.data.states.length > 0) {
                stateEl.innerHTML = '<option value="">Seleccione...</option>';
                resData.data.states
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .forEach(state => {
                        const name = state.name
                            .replace(' State', '')
                            .replace(' Department', '')
                            .replace(' Province', '');
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        stateEl.appendChild(opt);
                    });
                stateEl.disabled = false;
                stateEl.onchange = e => handleStateChange(e.target.value);
            } else {
                toggleLocationField('stateContainer', 'stateSelect', false);
                toggleLocationField('municipalityContainer', 'municipalitySelect', false);
            }
        } catch {
            toggleLocationField('stateContainer', 'stateSelect', false);
            toggleLocationField('municipalityContainer', 'municipalitySelect', false);
        }
    }

    async function handleStateChange(stateName) {
        const munEl = container.querySelector('#municipalitySelect');
        const countryName = countrySelect.options[countrySelect.selectedIndex]?.text;

        if (!stateName) {
            munEl.innerHTML = '<option value="">Seleccione...</option>';
            munEl.disabled = true;
            return;
        }

        munEl.innerHTML = '<option value="">Cargando...</option>';
        munEl.disabled = true;

        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: countryName, state: stateName })
            });
            const resData = await res.json();

            if (!resData.error && resData.data.length > 0) {
                munEl.innerHTML = '<option value="">Seleccione...</option>';
                resData.data.sort().forEach(city => {
                    const opt = document.createElement('option');
                    opt.value = city;
                    opt.textContent = city;
                    munEl.appendChild(opt);
                });
                munEl.disabled = false;
            } else {
                toggleLocationField('municipalityContainer', 'municipalitySelect', false);
            }
        } catch {
            toggleLocationField('municipalityContainer', 'municipalitySelect', false);
        }
    }

    // ── Listeners ───────────────────────────────────────────────────────────
    countrySelect.addEventListener('change', (e) => {
        const code = e.target.value;
        applyCountryConfig(code);
        loadStates(code);
        if (code) iti.setCountry(code.toLowerCase());
    });

    fetchCountries();

    // ── Logo preview ────────────────────────────────────────────────────────
    logoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = re => {
            logoPreview.innerHTML = `<img src="${re.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    });

    function resizeImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; } }
                    else       { if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; } }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ── Submit ──────────────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';

        if (!iti.isValidNumber()) {
            errorMsg.textContent = 'El número de teléfono no es válido.';
            return;
        }

        loadingOverlay.style.display = 'flex';
        loadingText.textContent = 'Creando Cuenta Administrativa...';

        const email = container.querySelector('#email').value;
        const password = container.querySelector('#password').value;
        const countryCode = countrySelect.value;

        const businessData = {
            name: toTitleCase(container.querySelector('#businessName').value),
            document: container.querySelector('#businessDocPrefix').value + container.querySelector('#businessDocNumber').value,
            country: countryCode,
            state: container.querySelector('#stateSelect').value,
            municipality: container.querySelector('#municipalitySelect').value,
            address: toTitleCase(container.querySelector('#address').value),
            ownerName: toTitleCase(container.querySelector('#ownerName').value),
            ownerDocument: container.querySelector('#ownerDocPrefix').value + container.querySelector('#ownerDocNumber').value,
            ownerPhone: iti.getNumber(),
            email: email,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const logoFile = logoInput.files[0];
            if (logoFile) {
                loadingText.textContent = 'Procesando Logo...';
                try {
                    businessData.logoUrl = await resizeImage(logoFile, 200, 200);
                } catch { /* logo opcional, no bloquea */ }
            }

            loadingText.textContent = 'Finalizando Configuración...';
            await setDoc(doc(db, "businesses", user.uid), businessData);

            localStorage.setItem('businessId', user.uid);
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('userName', businessData.ownerName);
            localStorage.setItem('businessName', businessData.name);
            localStorage.setItem('businessCountry', countryCode);
            if (businessData.logoUrl) localStorage.setItem('businessLogo', businessData.logoUrl);

            loadingOverlay.style.display = 'none';
            navigate('#config');

        } catch (error) {
            loadingOverlay.style.display = 'none';
            if (error.code === 'auth/email-already-in-use') {
                errorMsg.textContent = 'El correo ya está en uso.';
            } else {
                errorMsg.textContent = 'Error al registrar: ' + error.message;
            }
        }
    });

    return container;
}
