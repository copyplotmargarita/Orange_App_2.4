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

    function renderList() {
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2>Empleados</h2>
                <button class="btn btn-primary" id="addEmployeeBtn" style="width: auto;">+ Crear Empleado</button>
            </div>
            <div id="employeeGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
        `;
        
        if (employees.length === 0) {
            html += `<p class="text-muted" style="grid-column: 1 / -1;">No hay empleados registrados activos.</p>`;
        } else {
            employees.forEach(emp => {
                const statusColor = emp.status === 'ACTIVO' ? 'var(--success)' : (emp.status === 'INACTIVO' ? 'var(--danger)' : 'var(--warning)');
                html += `
                    <div class="card employee-card" data-id="${emp.id}" style="cursor: pointer; position: relative; transition: transform 0.2s;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background-color: var(--border); display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                ${emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 style="font-size: 1.1rem; margin-bottom: 0.2rem;">${emp.name}</h3>
                                <p class="text-muted text-sm">${emp.role}</p>
                            </div>
                        </div>
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.75rem; font-weight: bold; color: ${statusColor};">${emp.status}</span>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;
        container.innerHTML = html;

        container.querySelector('#addEmployeeBtn').addEventListener('click', renderForm);
        
        const listGrid = container.querySelector('#employeeGrid');
        if (listGrid) {
            listGrid.addEventListener('click', async (e) => {
                const card = e.target.closest('.employee-card');
                if (card) {
                    const emp = employees.find(e => e.id === card.dataset.id);
                    if(emp) renderDetail(emp);
                }
            });
        }
    }

    function renderForm() {
        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h2>Crear Empleado</h2>
            </div>
            <div class="card" style="max-width: 600px;">
                <form id="employeeForm">
                    <div id="errorMsg" class="text-danger mb-4 text-center"></div>
                    
                    <div class="form-group mb-4">
                        <label>Nombre y Apellido</label>
                        <input type="text" id="empName" class="form-control" required>
                    </div>
                    
                    <div class="form-group mb-4">
                        <label>Cédula</label>
                        <div style="display: flex; align-items: center;">
                            <span style="padding: 0.75rem; background: var(--border); border-radius: var(--radius-md) 0 0 var(--radius-md); font-weight: bold;">V-</span>
                            <input type="text" id="empCedula" class="form-control" style="border-radius: 0 var(--radius-md) var(--radius-md) 0;" required pattern="[0-9]+" title="Solo números">
                        </div>
                    </div>

                    <div class="form-group mb-4">
                        <label>Cargo</label>
                        <select id="empRole" class="form-control mb-2" required>
                            <option value="Administrador">Administrador</option>
                            <option value="Cajero">Cajero</option>
                            <option value="Vendedor">Vendedor</option>
                            <option value="Otro">Otro (Especificar)</option>
                        </select>
                        <input type="text" id="empRoleCustom" class="form-control" placeholder="Escriba el cargo" style="display: none;">
                    </div>

                    <div class="form-group mb-4">
                        <label>Teléfono Móvil</label>
                        <input type="tel" id="empPhone" class="form-control" placeholder="Ej. 4141234567" required style="width: 100%;">
                        <small class="text-muted" style="display: block; margin-top: 0.5rem;">El sistema guarda automáticamente el número en formato internacional (+58...).</small>
                    </div>

                    <div class="form-group mb-4">
                        <label>Correo Electrónico (para inicio de sesión)</label>
                        <input type="email" id="empEmail" class="form-control" required>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveBtn">Crear Empleado</button>
                    </div>
                </form>
            </div>
            <style>
                .iti { width: 100%; display: block; }
            </style>
        `;

        const roleSelect = container.querySelector('#empRole');
        const roleCustom = container.querySelector('#empRoleCustom');
        
        roleSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Otro') {
                roleCustom.style.display = 'block';
                roleCustom.required = true;
            } else {
                roleCustom.style.display = 'none';
                roleCustom.required = false;
            }
        });

        container.querySelector('#cancelBtn').addEventListener('click', renderList);

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
            
            const cedula = `V-${container.querySelector('#empCedula').value}`;
            const existingEmp = allEmployees.find(emp => emp.documentId === cedula);

            const name = toTitleCase(container.querySelector('#empName').value);
            const rawRole = roleSelect.value === 'Otro' ? roleCustom.value : roleSelect.value;
            const role = toTitleCase(rawRole);
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
                    phone,
                    email,
                    pin, // Guardar el PIN en la base de datos para consulta del admin
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
        });
    }

    function renderDetail(emp) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem;">← Atrás</button>
                <h2>Detalle de Empleado</h2>
            </div>
            <div class="card" style="max-width: 600px; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border);">
                    <div style="width: 64px; height: 64px; border-radius: 50%; background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold;">
                        ${emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 style="font-size: 1.5rem; margin-bottom: 0.25rem;">${emp.name}</h3>
                        <p class="text-muted">${emp.role}</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                    <div>
                        <p class="text-sm text-muted mb-1">Cédula</p>
                        <p style="font-weight: 500;">${emp.documentId}</p>
                    </div>
                    <div>
                        <p class="text-sm text-muted mb-1">Correo</p>
                        <p style="font-weight: 500;">${emp.email}</p>
                    </div>
                    <div>
                        <p class="text-sm text-muted mb-1">Teléfono</p>
                        <p style="font-weight: 500;">${emp.phone}</p>
                    </div>
                    <div>
                        <p class="text-sm text-muted mb-1">PIN de Acceso</p>
                        <p style="font-weight: bold; letter-spacing: 2px; color: var(--primary);">${emp.pin || 'No disponible'}</p>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    <a href="tel:${emp.phone.replace(/\s+/g, '')}" class="btn btn-outline" style="flex: 1;">📞 Llamar</a>
                    <a href="mailto:${emp.email}" class="btn btn-outline" style="flex: 1;">📧 Correo</a>
                    <a href="https://wa.me/${emp.phone.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-outline" style="flex: 1; border-color: #25D366; color: #25D366;">💬 WhatsApp</a>
                </div>

                <div class="form-group">
                    <label class="mb-2">Acciones y Estado del Empleado</label>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <div style="display: flex; gap: 0.5rem; flex: 3;" id="statusGroup">
                            <button class="btn status-btn ${emp.status === 'ACTIVO' ? 'btn-primary' : 'btn-outline'}" data-val="ACTIVO" style="padding: 0.5rem; font-size: 0.875rem; flex: 1;">ACTIVO</button>
                            <button class="btn status-btn ${emp.status === 'INACTIVO' ? 'btn-primary' : 'btn-outline'}" data-val="INACTIVO" style="padding: 0.5rem; font-size: 0.875rem; flex: 1;">INACTIVO</button>
                            <button class="btn status-btn ${emp.status === 'VACACIONES' ? 'btn-primary' : 'btn-outline'}" data-val="VACACIONES" style="padding: 0.5rem; font-size: 0.875rem; flex: 1;">VACACIONES</button>
                        </div>
                        <button class="btn btn-outline" id="btnDeleteDetail" style="padding: 0.5rem; font-size: 0.875rem; flex: 1; border-color: var(--danger); color: var(--danger);">ELIMINAR 🗑️</button>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; max-width: 600px;">
                <button class="btn btn-outline" id="cancelBtnDetail" style="flex: 1;">Cancelar / Volver</button>
                <button class="btn btn-primary" id="saveStatusBtn" style="flex: 1;">Finalizar Cambios</button>
            </div>

            <!-- Modal de Confirmación -->
            <div id="deleteConfirmModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px); z-index: 100; align-items: center; justify-content: center;">
                <div class="card" style="padding: 2rem; max-width: 400px; text-align: center; width: 90%;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 class="mb-2 text-danger">¿Confirmar Eliminación?</h3>
                    <p class="text-muted mb-4">El registro se conservará en la base de datos para historial, pero desaparecerá de la lista principal.</p>
                    <div style="display: flex; gap: 1rem;">
                        <button class="btn btn-outline" id="cancelDeleteBtn" style="flex: 1;">Cancelar</button>
                        <button class="btn btn-primary" id="confirmDeleteBtn" style="flex: 1; background-color: var(--danger); border-color: var(--danger);">Sí, Eliminar</button>
                    </div>
                </div>
            </div>
        `;

        let currentStatus = emp.status;
        
        container.querySelectorAll('#statusGroup .status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                container.querySelectorAll('#statusGroup .status-btn').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-outline');
                });
                e.target.classList.remove('btn-outline');
                e.target.classList.add('btn-primary');
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
            // Mostrar modal personalizado
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
                // Asegurarse de que el modal se cierre visualmente antes de cargar
                container.querySelector('#deleteConfirmModal').style.display = 'none';
                await loadEmployees(); // Esto recargará la vista principal de la lista
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
