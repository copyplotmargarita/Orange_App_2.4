import { auth as mainAuth, db, firebaseConfig } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

const countryCodes = {
    'VE': '+58', 'CO': '+57', 'MX': '+52', 'US': '+1',
    'ES': '+34', 'AR': '+54', 'CL': '+56', 'PE': '+51'
};

export function renderEmployees(container) {
    let allEmployees = [];
    let employees = [];
    let currentSearchQuery = '';

    async function loadEmployees() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando empleados...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;
        
        try {
            const q = query(collection(db, "businesses", businessId, "employees"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            
            allEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            employees = allEmployees.filter(e => e.status !== 'ELIMINADO');
            
            renderList();
        } catch (error) {
            console.error("Error cargando empleados:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar los empleados.</div>';
        }
    }

    function renderGrid() {
        const listGrid = container.querySelector('#employeeGrid');
        if (!listGrid) return;

        const filteredEmployees = employees.filter(e => 
            (e.name || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) || 
            (e.role || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
            (e.documentId || '').toLowerCase().includes(currentSearchQuery.toLowerCase())
        );

        let html = '';
        if (filteredEmployees.length === 0) {
            html = `<p class="text-muted" style="grid-column: 1 / -1;">No hay empleados registrados activos o no coinciden con la búsqueda.</p>`;
        } else {
            filteredEmployees.forEach(emp => {
                const statusColor = emp.status === 'ACTIVO' ? 'var(--success)' : (emp.status === 'INACTIVO' ? 'var(--danger)' : 'var(--warning)');
                html += `
                    <div class="card employee-card" data-id="${emp.id}" style="cursor: pointer; padding: 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); transition: transform 0.2s; border-left: 4px solid var(--primary);">
                        <h3 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${emp.name}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">💼 ${emp.role}</p>
                        <p style="font-size: 0.85rem; color: ${statusColor}; font-weight: bold;">🏷️ ${emp.status}</p>
                    </div>
                `;
            });
        }
        listGrid.innerHTML = html;
        
        listGrid.querySelectorAll('.employee-card').forEach(card => {
            card.addEventListener('click', () => {
                const emp = employees.find(e => e.id === card.dataset.id);
                if(emp) renderDetail(emp);
            });
        });
    }

    function renderList() {
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">👤 Empleados</h2>
                <div style="margin-left: auto; display: flex; gap: 1rem; align-items: center;" class="flex-stack-mobile">
                    <input type="text" id="searchEmployeeInput" class="form-control" placeholder="🔍 Buscar empleado..." style="width: 250px; max-width: 100%; border-radius: 10px; height: 42px;" value="${currentSearchQuery}">
                    <button class="btn btn-primary" id="addEmployeeBtn" style="width: 180px; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">+ Crear Empleado</button>
                </div>
            </div>
            <div id="employeeGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem;">
            </div>
        `;
        container.innerHTML = html;

        renderGrid();

        const searchInput = container.querySelector('#searchEmployeeInput');
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderGrid();
        });

        container.querySelector('#addEmployeeBtn').addEventListener('click', renderForm);
        
        const backBtn = container.querySelector('#backToDashboardBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const navHome = document.getElementById('navHome');
                if (navHome) {
                    navHome.click();
                    const toggleIcon = document.getElementById('toggleIcon');
                    if (toggleIcon && toggleIcon.innerText === '▶') {
                        document.getElementById('sidebarToggle')?.click();
                    }
                } else {
                    window.location.hash = '#dashboard';
                }
            });
        }
    }

    function renderForm() {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button type="button" class="btn btn-outline" id="backHeaderBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">✨ Nuevo Colaborador</h2>
            </div>
            
            <div class="card" style="max-width: 500px; margin: 0 auto; padding: 2rem; border-top: 4px solid var(--primary);">
                <form id="employeeForm">
                    <div id="errorMsg" class="text-danger mb-4 text-center" style="font-size: 0.85rem; font-weight: 500;"></div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>👤 Nombre y Apellido</label>
                            <input type="text" id="empName" class="form-control" placeholder="Ej. Juan Pérez" required>
                        </div>
                        
                        <div class="form-group">
                            <label>🪪 Cédula</label>
                            <div style="display: flex; gap: 0;">
                                <span style="padding: 0 0.75rem; background: var(--background); border: 1px solid var(--border); border-right: none; border-radius: 10px 0 0 10px; font-weight: bold; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; height: 40px;">V-</span>
                                <input type="text" id="empCedula" class="form-control" style="border-radius: 0 10px 10px 0; height: 40px;" placeholder="12345678" required pattern="[0-9]+" title="Solo números">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>💼 Cargo</label>
                            <input type="text" id="empRole" class="form-control" placeholder="Ej. Vendedor, Cajero, Almacenero..." required>
                        </div>

                        <div class="form-group">
                            <label>🎭 Perfil Base <span style="font-size:0.65rem; font-weight:400; text-transform:none; color:var(--text-muted);">— pre-marca los módulos</span></label>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
                                <button type="button" class="profile-btn btn btn-outline" data-profile="vendedor" style="flex:1; min-width:80px; height:34px; font-size:0.8rem; padding:0 0.5rem;">Vendedor</button>
                                <button type="button" class="profile-btn btn btn-outline" data-profile="cajero" style="flex:1; min-width:80px; height:34px; font-size:0.8rem; padding:0 0.5rem;">Cajero</button>
                                <button type="button" class="profile-btn btn btn-outline" data-profile="almacen" style="flex:1; min-width:80px; height:34px; font-size:0.8rem; padding:0 0.5rem;">Almacén</button>
                                <button type="button" class="profile-btn btn btn-outline" data-profile="personalizado" style="flex:1; min-width:80px; height:34px; font-size:0.8rem; padding:0 0.5rem;">Personalizado</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>📋 Módulos con Acceso</label>
                            <div id="modulesGrid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-top: 0.35rem; background: var(--background); padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border);">
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="ventas"> 💰 Ventas
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="clientes"> 👥 Clientes
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="cobros"> 📋 Cobros
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="productos"> 🛍️ Productos
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="compras"> 🧾 Compras
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="inventario"> 📦 Inventario
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="proveedores"> 🏭 Proveedores
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="reportes"> 📊 Reportes
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="tiendas"> 🏪 Tiendas
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500 !important; text-transform:none !important; letter-spacing:0 !important; color:var(--text-main) !important; cursor:pointer;">
                                    <input type="checkbox" name="modules" value="empleados"> 👤 Empleados
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>📱 Teléfono Móvil</label>
                            <input type="tel" id="empPhone" class="form-control" placeholder="4141234567" required>
                        </div>

                        <div class="form-group">
                            <label>📧 Correo Electrónico</label>
                            <input type="email" id="empEmail" class="form-control" placeholder="correo@ejemplo.com" required>
                            <small style="color: var(--text-muted); font-size: 0.65rem; margin-top: 2px; display: block;">Se usará para iniciar sesión en la app.</small>
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                            <button type="button" class="btn btn-outline" id="cancelBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                            <button type="submit" class="btn btn-primary" id="saveBtn" style="flex: 1; height: 50px; font-weight: 800;">CREAR</button>
                        </div>
                    </div>
                </form>
            </div>
            <style>
                .iti { width: 100%; display: block; }
                .form-group label { margin-bottom: 2px !important; color: var(--text-muted) !important; font-weight: 800 !important; font-size: 0.75rem !important; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
                .form-control { 
                    border-radius: 10px; 
                    border: 1px solid var(--border); 
                    padding: 0 1rem; 
                    transition: var(--transition); 
                    background: var(--surface); 
                    color: var(--text-main); 
                    font-size: 0.9rem; 
                    font-family: 'Inter', sans-serif;
                    width: 100%;
                    height: 40px;
                    box-sizing: border-box;
                }
                .form-control:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1); outline: none; }
                .btn { border-radius: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid transparent; cursor: pointer; }
                .btn:hover { transform: translateY(-2px); }
                .btn-primary { background: var(--primary); color: white; }
                .btn-outline { background: transparent; border-color: var(--border); color: var(--text-main); }
                .iti__country-list { background-color: var(--surface) !important; color: var(--text-main) !important; border: 1px solid var(--border) !important; border-radius: 8px !important; box-shadow: var(--shadow-lg) !important; }
            </style>
        `;

        // Perfiles predeterminados → módulos
        const PROFILES = {
            vendedor:     ['ventas', 'clientes', 'cobros', 'productos'],
            cajero:       ['ventas', 'clientes', 'cobros'],
            almacen:      ['productos', 'compras', 'inventario', 'proveedores'],
            personalizado: [],
        };

        function applyProfile(profileKey) {
            const modules = PROFILES[profileKey] || [];
            container.querySelectorAll('input[name="modules"]').forEach(cb => {
                cb.checked = modules.includes(cb.value);
            });
            // Resaltar el botón activo
            container.querySelectorAll('.profile-btn').forEach(btn => {
                btn.classList.toggle('btn-primary', btn.dataset.profile === profileKey);
                btn.classList.toggle('btn-outline', btn.dataset.profile !== profileKey);
            });
        }

        container.querySelectorAll('.profile-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                applyProfile(btn.dataset.profile);
                // Auto-rellenar el cargo si está vacío
                const roleInput = container.querySelector('#empRole');
                if (!roleInput.value) {
                    const labels = { vendedor: 'Vendedor', cajero: 'Cajero', almacen: 'Almacenero', personalizado: '' };
                    roleInput.value = labels[btn.dataset.profile] || '';
                }
            });
        });

        container.querySelector('#cancelBtn').addEventListener('click', renderList);
        container.querySelector('#backHeaderBtn')?.addEventListener('click', () => container.querySelector('#cancelBtn').click());

        // Inicializar Intl Tel Input
        const phoneInput = container.querySelector('#empPhone');
        const iti = window.intlTelInput(phoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        container.querySelector('#employeeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#saveBtn');
            const errorMsg = container.querySelector('#errorMsg');
            errorMsg.textContent = '';
            
            try {
                const cedula = `V-${container.querySelector('#empCedula').value}`;
                const existingEmp = allEmployees.find(emp => emp.documentId === cedula);

                const name = toTitleCase(container.querySelector('#empName').value);
                const role = toTitleCase(container.querySelector('#empRole').value);
                const modules = [...container.querySelectorAll('input[name="modules"]:checked')].map(cb => cb.value);
                const phone = iti.getNumber();
                const email = container.querySelector('#empEmail').value;

                // Lógica de Restauración si el empleado existía pero fue eliminado
                if (existingEmp) {
                    if (existingEmp.status !== 'ELIMINADO') {
                        errorMsg.textContent = "Ya existe un empleado activo con esta cédula.";
                        return;
                    } else {
                        btn.disabled = true;
                        btn.textContent = 'Restaurando...';
                        const businessId = localStorage.getItem('businessId');
                        try {
                            await updateDoc(doc(db, "businesses", businessId, "employees", existingEmp.id), {
                                name, role, phone, status: 'ACTIVO'
                            });
                            showNotification(`¡Empleado recontratado/restaurado con éxito!\n\nNota: El empleado ya tenía una cuenta creada previamente en el sistema.\nCorreo: ${existingEmp.email}\nPIN (Clave anterior): ${existingEmp.pin || 'No se guardó el PIN de esta cuenta'}`, 'success');
                            await loadEmployees();
                            return;
                        } catch(err) {
                            console.error(err);
                            btn.disabled = false;
                            btn.textContent = 'Crear Empleado';
                            errorMsg.textContent = 'Error al restaurar: ' + err.message;
                            return;
                        }
                    }
                }

                // Si es un empleado nuevo
                btn.disabled = true;
                btn.textContent = 'Guardando...';
                
                const pin = Math.floor(100000 + Math.random() * 900000).toString();
                const businessId = localStorage.getItem('businessId');

                try {
                    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pin);
                    await updateProfile(userCredential.user, {
                        displayName: name
                    });
                    await signOut(secondaryAuth);

                    await addDoc(collection(db, "businesses", businessId, "employees"), {
                        name,
                        documentId: cedula,
                        role,
                        modules,
                        phone,
                        email,
                        pin,
                        status: 'ACTIVO',
                        createdAt: new Date().toISOString()
                    });

                    showNotification(`¡Empleado creado con éxito!\n\nPor favor anote los datos de acceso para el empleado:\n\nCorreo: ${email}\nPIN / Clave: ${pin}`, 'success');
                    await loadEmployees();
                } catch (error) {
                    console.error(error);
                    btn.disabled = false;
                    btn.textContent = 'Crear Empleado';
                    if (error.code === 'auth/email-already-in-use') {
                        errorMsg.textContent = 'Este correo ya está registrado en el sistema. Use uno diferente.';
                    } else {
                        errorMsg.textContent = 'Error al crear empleado: ' + error.message;
                    }
                }
            } catch (globalError) {
                console.error("Error crítico en formulario:", globalError);
                btn.disabled = false;
                btn.textContent = 'Crear Empleado';
                errorMsg.textContent = "Error inesperado: " + globalError.message;
            }
        });
    }

    function renderDetail(emp) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem; border-radius: var(--radius-full);">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">👤 Ficha de Empleado</h2>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 500px; margin: 0 auto; width: 100%;">
                <!-- Bloque de Identificación -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                        <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.1rem; color: var(--primary);">${emp.name}</h3>
                        <p style="font-family: monospace; font-size: 0.8rem; color: var(--primary); font-weight: 700; margin-bottom: 1rem;">ID: ${emp.documentId}</p>
                        
                        <div style="display: flex; justify-content: center; gap: 0.75rem;">
                            <a href="tel:${emp.phone.replace(/\s+/g, '')}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--primary); color: var(--primary); background: transparent;" title="Llamar">📞</a>
                            
                            <a target="_blank" href="https://wa.me/${emp.phone.replace(/[^0-9]/g, '')}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--primary); color: var(--primary); background: transparent;" title="WhatsApp">💬</a>
                            
                            ${emp.email ? `
                                <a href="mailto:${emp.email}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--primary); color: var(--primary); background: transparent;" title="Correo">📧</a>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Sección de Datos (Formulario Compacto) -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">📋 Datos del Empleado</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div class="form-group">
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">Cédula</label>
                            <input type="text" value="${emp.documentId}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit;" readonly>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">Correo</label>
                            <input type="text" value="${emp.email}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit;" readonly>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">Teléfono</label>
                            <input type="text" value="${emp.phone}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit;" readonly>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">PIN de Acceso</label>
                            <input type="text" value="${emp.pin || '---'}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit; font-weight: 800;" readonly>
                        </div>
                    </div>
                </div>

                <!-- Gestión de Estado -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">⚙️ Acciones y Estado</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div style="display: flex; gap: 0.5rem;" id="statusGroup">
                            <button class="status-pill ${emp.status === 'ACTIVO' ? 'active' : ''}" data-val="ACTIVO">ACTIVO</button>
                            <button class="status-pill ${emp.status === 'INACTIVO' ? 'active' : ''}" data-val="INACTIVO">INACTIVO</button>
                            <button class="status-pill ${emp.status === 'VACACIONES' ? 'active' : ''}" data-val="VACACIONES">VACACIONES</button>
                        </div>
                        <button class="btn" id="btnDeleteDetail" style="background: transparent; color: var(--danger); font-size: 0.75rem; font-weight: 700; border: 1px dashed var(--danger); height: 38px;">ELIMINAR REGISTRO 🗑️</button>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; width: 100%;">
                    <button class="btn btn-outline" id="cancelBtnDetail" style="flex: 1; height: 45px;">Volver</button>
                    <button class="btn btn-primary" id="saveStatusBtn" style="flex: 1; height: 45px; font-weight: 700;">Guardar Cambios</button>
                </div>
            </div>

            <style>
                .status-pill { flex: 1; height: 34px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); border-radius: var(--radius-full); font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: var(--transition); }
                .status-pill.active { background: var(--primary); color: white; border-color: var(--primary); box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); }
            </style>

            <!-- Modal de Confirmación -->
            <div id="deleteConfirmModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px); z-index: 100; align-items: center; justify-content: center;">
                <div class="card" style="padding: 2.5rem; max-width: 400px; text-align: center; width: 90%; border-radius: 1.5rem;">
                    <div style="font-size: 3.5rem; margin-bottom: 1.5rem;">🚨</div>
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--danger); margin-bottom: 0.75rem;">¿Estás seguro?</h3>
                    <p class="text-muted" style="font-size: 0.9rem; line-height: 1.5; margin-bottom: 2rem;">Esta acción marcará al empleado como eliminado. No aparecerá más en tus listas activas.</p>
                    <div style="display: flex; gap: 1rem;">
                        <button class="btn btn-outline" id="cancelDeleteBtn" style="flex: 1; height: 45px;">No, volver</button>
                        <button class="btn btn-primary" id="confirmDeleteBtn" style="flex: 1; background: var(--danger); border-color: var(--danger); height: 45px; font-weight: 700;">Sí, eliminar</button>
                    </div>
                </div>
            </div>
        `;

        let currentStatus = emp.status;
        
        container.querySelectorAll('#statusGroup .status-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                container.querySelectorAll('#statusGroup .status-pill').forEach(b => {
                    b.classList.remove('active');
                });
                e.target.classList.add('active');
                currentStatus = e.target.dataset.val;
            });
        });

        container.querySelector('#backBtn').addEventListener('click', renderList);
        container.querySelector('#cancelBtnDetail').addEventListener('click', renderList);
        
        container.querySelector('#saveStatusBtn').addEventListener('click', async () => {
            if (currentStatus !== emp.status) {
                const btn = container.querySelector('#saveStatusBtn');
                btn.disabled = true;
                btn.textContent = 'Guardando...';
                const businessId = localStorage.getItem('businessId');
                try {
                    await updateDoc(doc(db, "businesses", businessId, "employees", emp.id), {
                        status: currentStatus
                    });
                } catch (err) {
                    console.error(err);
                    showNotification("Error al actualizar estado");
                }
            }
            await loadEmployees();
        });

        container.querySelector('#btnDeleteDetail').addEventListener('click', (e) => {
            e.preventDefault();
            container.querySelector('#deleteConfirmModal').style.display = 'flex';
        });

        container.querySelector('#cancelDeleteBtn').addEventListener('click', (e) => {
            e.preventDefault();
            container.querySelector('#deleteConfirmModal').style.display = 'none';
        });

        container.querySelector('#confirmDeleteBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#confirmDeleteBtn');
            btn.disabled = true;
            btn.textContent = 'Eliminando...';
            const businessId = localStorage.getItem('businessId');
            try {
                await updateDoc(doc(db, "businesses", businessId, "employees", emp.id), {
                    status: 'ELIMINADO'
                });
                container.querySelector('#deleteConfirmModal').style.display = 'none';
                await loadEmployees();
            } catch (err) {
                showNotification("Error al eliminar el empleado: " + err.message);
                console.error(err);
                btn.disabled = false;
                btn.textContent = 'Sí, Eliminar';
            }
        });
    }

    loadEmployees();
}
