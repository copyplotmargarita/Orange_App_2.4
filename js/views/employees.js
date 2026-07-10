import { auth as mainAuth, db, firebaseConfig } from '../services/firebase.js';
import { toTitleCase, showNotification, showConfirmModal } from '../utils.js';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-functions.js";

const countryCodes = {
    'VE': '+58', 'CO': '+57', 'MX': '+52', 'US': '+1',
    'ES': '+34', 'AR': '+54', 'CL': '+56', 'PE': '+51'
};

export function renderEmployees(container) {
    function showPinModal(fullCode, name, actionMessage) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center;';
        
        modal.innerHTML = `
            <div class="card" style="padding: 2.5rem; max-width: 450px; text-align: center; width: 90%; border-radius: 1.5rem; border: 2px solid var(--primary);">
                <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔐</div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">${actionMessage}</h3>
                <p class="text-muted" style="font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem;">Empleado: <strong>${name}</strong></p>
                
                <div style="background: var(--background); padding: 1.5rem; border-radius: 12px; border: 1px dashed var(--primary); margin-bottom: 1.5rem;">
                    <p style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 800;">Código de Acceso</p>
                    <div style="font-family: monospace; font-size: 2.2rem; font-weight: 900; letter-spacing: 4px; color: var(--primary);">${fullCode}</div>
                </div>

                <div style="background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.5rem; text-align: left;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <p style="font-size: 0.85rem; color: var(--danger); margin: 0; line-height: 1.4; font-weight: 600;"><strong>¡Importante!</strong> Anote y guarde este PIN en un lugar seguro. Por motivos de seguridad, no podrá volver a verlo después de cerrar esta ventana.</p>
                </div>
                
                <button class="btn btn-primary" id="btnPinModalListo" style="width: 100%; height: 50px; font-size: 1rem; font-weight: 800; border-radius: 12px;">¡LISTO, YA LO ANOTÉ!</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#btnPinModalListo').addEventListener('click', () => {
            modal.remove();
        });
    }

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
                    <div class="card employee-card" data-id="${emp.id}" style="cursor: pointer; padding: 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); transition: transform 0.2s; border-left: 4px solid var(--primary); position: relative;">
                        <button class="delete-employee-btn material-symbols-outlined hover:text-error transition-colors" data-id="${emp.id}" style="position: absolute; top: 0.5rem; right: 0.5rem; font-size: 1.25rem; background: none; border: none; cursor: pointer; z-index: 10; color: var(--text-muted);">delete</button>
                        <h3 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 1.5rem;">${emp.name}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">💼 ${emp.role}</p>
                        <p style="font-size: 0.85rem; color: ${statusColor}; font-weight: bold;">🏷️ ${emp.status}</p>
                    </div>
                `;
            });
        }
        listGrid.innerHTML = html;
        
        listGrid.querySelectorAll('.employee-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-employee-btn')) {
                    e.stopPropagation();
                    return;
                }
                const emp = employees.find(e => e.id === card.dataset.id);
                if(emp) renderDetail(emp);
            });
        });

        listGrid.querySelectorAll('.delete-employee-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                showConfirmModal(
                    "Eliminar Empleado",
                    "¿Estás seguro de que deseas eliminar este empleado? El registro se marcará como ELIMINADO pero se conservará su historial.",
                    async () => {
                        try {
                            const businessId = localStorage.getItem('businessId');
                            const empRef = doc(db, "businesses", businessId, "employees", id);
                            await updateDoc(empRef, { status: 'ELIMINADO' });
                            showNotification("Empleado eliminado exitosamente.");
                            await loadEmployees();
                        } catch (error) {
                            console.error(error);
                            showNotification("Error al eliminar el empleado.", "error");
                        }
                    },
                    "Eliminar",
                    "Cancelar",
                    "🗑️"
                );
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
                    <button class="btn btn-primary" id="addEmployeeBtn" style="width: auto; min-width: 180px; padding: 0 1rem; white-space: nowrap; flex-shrink: 0; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">+ Crear Empleado</button>
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
                            <select id="empRole" class="form-control" required>
                                <option value="" disabled selected>Selecciona un cargo</option>
                                <option value="Administrador">Administrador</option>
                                <option value="Vendedor">Vendedor</option>
                                <option value="Cajero">Cajero</option>
                                <option value="Almacén">Almacén</option>
                                <option value="Personalizado">Personalizado</option>
                            </select>
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
                const roleInput = container.querySelector('#empRole');
                const labels = { vendedor: 'Vendedor', cajero: 'Cajero', almacen: 'Almacén', personalizado: 'Personalizado' };
                roleInput.value = labels[btn.dataset.profile] || '';
            });
        });

        const roleSelect = container.querySelector('#empRole');
        roleSelect.addEventListener('change', (e) => {
            const role = e.target.value;
            if (role === 'Administrador') {
                container.querySelectorAll('input[name="modules"]').forEach(cb => cb.checked = true);
                container.querySelectorAll('.profile-btn').forEach(btn => {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-outline');
                });
            } else if (role === 'Vendedor') {
                applyProfile('vendedor');
            } else if (role === 'Cajero') {
                applyProfile('cajero');
            } else if (role === 'Almacén') {
                applyProfile('almacen');
            } else if (role === 'Personalizado') {
                applyProfile('personalizado');
            }
        });

        // Event listener for manual checkbox changes to switch to "Personalizado" automatically
        container.querySelectorAll('input[name="modules"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const currentRole = roleSelect.value;
                if (currentRole === 'Administrador' || currentRole === 'Vendedor' || currentRole === 'Cajero' || currentRole === 'Almacén') {
                    roleSelect.value = 'Personalizado';
                    // Clear the active profile button styles
                    container.querySelectorAll('.profile-btn').forEach(btn => {
                        btn.classList.remove('btn-primary');
                        btn.classList.add('btn-outline');
                        if (btn.dataset.profile === 'personalizado') {
                            btn.classList.add('btn-primary');
                            btn.classList.remove('btn-outline');
                        }
                    });
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
                
                const businessId = localStorage.getItem('businessId');

                try {
                    const functions = getFunctions();
                    const createEmployeeFn = httpsCallable(functions, 'createEmployee');
                    
                    const result = await createEmployeeFn({
                        name,
                        documentId: cedula,
                        role,
                        modules,
                        phone,
                        email,
                        businessId
                    });

                    const { plainPin, businessCode } = result.data;
                    const fullCode = businessCode + plainPin;

                    showPinModal(fullCode, name, '¡Empleado Creado Exitosamente!');
                    
                    if (email && email.trim() !== '') {
                        const subject = encodeURIComponent("Tu Código de Acceso al Sistema");
                        const body = encodeURIComponent(`Hola ${name},\n\nTu cuenta ha sido creada exitosamente.\n\nTu Código de Acceso es: ${fullCode}\n\nPor favor, ingresa al sistema y utiliza este código para iniciar sesión.\n\nSaludos.`);
                        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                    }
                    
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
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">Cargo</label>
                            <input type="text" value="${emp.role || '---'}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit;" readonly>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">PIN de Acceso</label>
                            <input type="text" value="${emp.temporaryPin ? (emp.businessCode || '') + emp.temporaryPin : '•••••••••• (Encriptado)'}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit; font-weight: 800; ${emp.temporaryPin ? 'color: var(--danger);' : 'color: var(--text-muted);'}" readonly>
                            ${emp.temporaryPin ? '<small style="color: var(--danger); font-size: 0.65rem;">Comunique este código de 10 caracteres al empleado.</small>' : ''}
                        </div>
                    </div>
                </div>


                <!-- Módulos con Acceso -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">📄 Módulos con Acceso</h3>
                    <div id="editModulesGrid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; background: var(--background); padding: 0.75rem; border-radius: 10px; border: 1px solid var(--border);">
                        ${['ventas', 'clientes', 'cobros', 'productos', 'compras', 'inventario', 'proveedores', 'reportes', 'tiendas', 'empleados'].map(mod => {
                            const modNames = {
                                'ventas': '💰 Ventas', 'clientes': '👥 Clientes', 'cobros': '📋 Cobros',
                                'productos': '🛍️ Productos', 'compras': '🧾 Compras', 'inventario': '📦 Inventario',
                                'proveedores': '🏭 Proveedores', 'reportes': '📊 Reportes', 'tiendas': '🏪 Tiendas',
                                'empleados': '👤 Empleados'
                            };
                            const isChecked = (emp.modules || []).includes(mod) ? 'checked' : '';
                            return `
                                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:500; color:var(--text-main); cursor:pointer;">
                                    <input type="checkbox" name="edit_modules" value="${mod}" ${isChecked} style="width: 16px; height: 16px; accent-color: var(--primary);"> ${modNames[mod]}
                                </label>
                            `;
                        }).join('')}
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

                <!-- Gestión de Seguridad -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">🔒 Seguridad</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">Por seguridad, el PIN se guarda encriptado. Si el empleado olvidó su código, puedes generar uno nuevo. El anterior quedará invalidado inmediatamente.</p>
                        <button class="btn btn-outline" id="btnResetPin" style="border-color: var(--primary); color: var(--primary); font-weight: 700; height: 38px;">Generar Nuevo Código de Acceso</button>
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
        
        container.querySelector('#btnResetPin').addEventListener('click', async () => {
            const btn = container.querySelector('#btnResetPin');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Generando...';
            
            try {
                const businessId = localStorage.getItem('businessId');
                const functions = getFunctions();
                const resetPinFn = httpsCallable(functions, 'resetEmployeePin');
                
                const result = await resetPinFn({ employeeId: emp.id, businessId });
                const { plainPin, businessCode } = result.data;
                const fullCode = businessCode + plainPin;
                
                showPinModal(fullCode, emp.name, '¡Nuevo Código Generado Exitosamente!');
                
                if (emp.email && emp.email.trim() !== '') {
                    const subject = encodeURIComponent("Actualización de tu Código de Acceso");
                    const body = encodeURIComponent(`Hola ${emp.name},\n\nTu Código de Acceso ha sido restablecido.\n\nTu NUEVO Código de Acceso es: ${fullCode}\n\nPor favor, utiliza este código para iniciar sesión a partir de ahora.\n\nSaludos.`);
                    window.location.href = `mailto:${emp.email}?subject=${subject}&body=${body}`;
                }
            } catch (err) {
                console.error("Error reseteando PIN:", err);
                showNotification('Error al generar nuevo PIN: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });

        container.querySelector('#saveStatusBtn').addEventListener('click', async () => {
            const btn = container.querySelector('#saveStatusBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';
            
            const selectedModules = [...container.querySelectorAll('input[name="edit_modules"]:checked')].map(cb => cb.value);
            const oldModules = emp.modules || [];
            const modulesChanged = JSON.stringify(selectedModules.sort()) !== JSON.stringify([...oldModules].sort());
            
            if (currentStatus !== emp.status || modulesChanged) {
                const businessId = localStorage.getItem('businessId');
                try {
                    await updateDoc(doc(db, "businesses", businessId, "employees", emp.id), {
                        status: currentStatus,
                        modules: selectedModules
                    });
                    showNotification("Cambios guardados exitosamente.", "success");
                } catch (err) {
                    console.error(err);
                    showNotification("Error al guardar cambios", "error");
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
