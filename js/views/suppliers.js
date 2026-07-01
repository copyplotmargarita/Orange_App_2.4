import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification, showConfirmModal } from '../utils.js';
import { doc, setDoc, getDocs, getDoc, collection, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderSuppliers(container) {
    let suppliers = [];
    let currentSearchQuery = '';

    async function loadSuppliers() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando proveedores...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;
        try {
            const q = query(collection(db, "businesses", businessId, "suppliers"));
            const snapshot = await getDocs(q);
            suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            renderList();
            
            if (window.openCreateSupplierForPurchase) {
                window.openCreateSupplierForPurchase = false;
                renderForm();
            }

            if (window.openCreateSupplierForProduct) {
                window.openCreateSupplierForProduct = false;
                renderForm();
            }
        } catch (error) {
            console.error("Error cargando proveedores:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar los proveedores.</div>';
        }
    }

    function renderGrid() {
        const gridContainer = container.querySelector('#suppliersGrid');
        if (!gridContainer) return;

        const filteredSuppliers = suppliers.filter(s => 
            (s.name || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) || 
            (s.sellerName || '').toLowerCase().includes(currentSearchQuery.toLowerCase())
        );

        let html = '';
        if (filteredSuppliers.length === 0) {
            html = `<p class="text-muted" style="grid-column: 1 / -1;">No hay proveedores registrados aún o no coinciden con la búsqueda.</p>`;
        } else {
            filteredSuppliers.forEach(supplier => {
                html += `
                    <div class="card supplier-card" data-id="${supplier.id}" style="cursor: pointer; padding: 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); transition: transform 0.2s; border-left: 4px solid var(--warning); position: relative;">
                        <button class="delete-supplier-btn" data-id="${supplier.id}" style="position: absolute; top: 0.5rem; right: 0.5rem; background: transparent; border: none; cursor: pointer; font-size: 1.2rem; color: var(--danger); transition: transform 0.2s; z-index: 2;" title="Eliminar proveedor">
                            🗑️
                        </button>
                        <div style="margin-bottom: 0.5rem; padding-right: 2rem;">
                            <h3 style="font-size: 1rem; margin-bottom: 0; color: var(--warning); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${supplier.name}">${supplier.name}</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <p style="font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">👤 ${supplier.sellerName || 'Sin Vendedor'}</p>
                            <p style="font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📞 ${supplier.sellerPhone || supplier.phone || 'Sin teléfono'}</p>
                        </div>
                    </div>
                `;
            });
        }
        gridContainer.innerHTML = html;

        gridContainer.querySelectorAll('.supplier-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-supplier-btn')) return;
                const supplier = suppliers.find(s => s.id === card.dataset.id);
                if (supplier) renderDetail(supplier);
            });
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
        });

        gridContainer.querySelectorAll('.delete-supplier-btn').forEach(btn => {
            btn.addEventListener('mouseover', () => btn.style.transform = 'scale(1.2)');
            btn.addEventListener('mouseout', () => btn.style.transform = 'scale(1)');
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const supplierId = btn.dataset.id;
                const supplier = suppliers.find(s => s.id === supplierId);
                
                showConfirmModal(
                    '¿Eliminar proveedor?',
                    `Se eliminará el proveedor "${supplier.name}". Esta acción no se puede deshacer.`,
                    () => {
                        deleteSupplierDoc(supplierId);
                    },
                    'Sí, eliminar',
                    'Cancelar',
                    '🗑️'
                );
            });
        });
    }

    async function deleteSupplierDoc(id) {
        try {
            const businessId = localStorage.getItem('businessId');
            await deleteDoc(doc(db, "businesses", businessId, "suppliers", id));
            showNotification("Proveedor eliminado", "success");
            loadSuppliers(); // Wait, this calls loadSuppliers from the outer scope, which is fine!
        } catch (error) {
            console.error("Error al eliminar proveedor: ", error);
            showNotification("Error al eliminar proveedor", "error");
        }
    }

    function renderList() {
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--warning); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">🏭 Proveedores</h2>
                <div style="margin-left: auto; display: flex; gap: 1rem; align-items: center;" class="flex-stack-mobile">
                    <input type="text" id="searchSupplierInput" class="form-control" placeholder="🔍 Buscar proveedor..." style="width: 250px; max-width: 100%; border-radius: 10px; height: 42px;" value="${currentSearchQuery}">
                    <button class="btn btn-primary" id="addSupplierBtn" style="width: 180px; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">+ Crear Proveedor</button>
                </div>
            </div>
            <div id="suppliersGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem;">
            </div>
        `;
        container.innerHTML = html;

        renderGrid();

        const searchInput = container.querySelector('#searchSupplierInput');
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderGrid();
        });

        container.querySelector('#addSupplierBtn').addEventListener('click', renderForm);
        
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
                <h2 style="color: var(--warning); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">🏭 Nuevo Proveedor</h2>
            </div>
            
            <div class="card" style="max-width: 500px; margin: 0 auto; padding: 2rem; border-top: 4px solid var(--warning);">
                <form id="supplierForm">
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">📦 Datos del Proveedor</h3>
                        
                        <div class="form-group">
                            <label>Nombre del Proveedor <span class="text-danger">*</span></label>
                            <input type="text" id="supName" class="form-control" placeholder="Ej. Distribuidora XYZ" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Identidad (Cédula o RIF) <span class="text-danger">*</span></label>
                            <div style="display: flex; gap: 0;">
                                <select id="supDocType" class="form-control" style="width: 80px; border-radius: 10px 0 0 10px; border-right: none;" required>
                                    <option value="V-">V-</option>
                                    <option value="J-">J-</option>
                                    <option value="E-">E-</option>
                                    <option value="G-">G-</option>
                                </select>
                                <input type="text" id="supDocNumber" class="form-control" style="border-radius: 0 10px 10px 0;" placeholder="Ej. 14789652" required pattern="[0-9]+" title="Solo números">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Correo Electrónico</label>
                            <input type="email" id="supEmail" class="form-control" placeholder="usuario@correo.com">
                        </div>

                        <div class="form-group">
                            <label>Teléfono Principal</label>
                            <input type="tel" id="supPhone" class="form-control" placeholder="Ej. 4241234567">
                        </div>

                        <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-top: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">👤 Contacto / Vendedor</h3>

                        <div class="form-group">
                            <label>Nombre del Vendedor</label>
                            <input type="text" id="sellerName" class="form-control" placeholder="Ej. Carlos Silva">
                        </div>

                        <div class="form-group">
                            <label>Teléfono del Vendedor</label>
                            <input type="tel" id="sellerPhone" class="form-control" placeholder="Ej. 4141234567">
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                            <button type="button" class="btn btn-outline" id="cancelFormBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
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
            </style>
        `;

        container.querySelector('#cancelFormBtn').addEventListener('click', renderList);
        container.querySelector('#backHeaderBtn')?.addEventListener('click', () => container.querySelector('#cancelFormBtn').click());

        // Inicializar Intl Tel Input
        const supPhoneInput = container.querySelector('#supPhone');
        const itiSup = window.intlTelInput(supPhoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        const sellerPhoneInput = container.querySelector('#sellerPhone');
        const itiSeller = window.intlTelInput(sellerPhoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        container.querySelector('#supplierForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = toTitleCase(container.querySelector('#supName').value.trim());
            const docType = container.querySelector('#supDocType').value;
            const docNum = container.querySelector('#supDocNumber').value.trim();
            const documentId = `${docType}${docNum}`;
            
            const email = container.querySelector('#supEmail').value.trim();
            const supPhoneVal = supPhoneInput.value.trim() ? itiSup.getNumber() : "";
            
            const rawSellerName = container.querySelector('#sellerName').value.trim();
            const sellerName = rawSellerName ? toTitleCase(rawSellerName) : "";
            const sellerPhoneVal = sellerPhoneInput.value.trim() ? itiSeller.getNumber() : "";
            
            const btn = container.querySelector('#saveBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const businessId = localStorage.getItem('businessId');

            try {
                // Verificar si ya existe
                const supRef = doc(db, "businesses", businessId, "suppliers", documentId);
                const docSnap = await getDoc(supRef);
                
                if (docSnap.exists()) {
                    showNotification(`Ya existe un proveedor registrado con el documento ${documentId}.`);
                    btn.disabled = false;
                    btn.textContent = 'Crear Proveedor';
                    return;
                }

                const supData = {
                    name,
                    email,
                    phone: supPhoneVal,
                    sellerName,
                    sellerPhone: sellerPhoneVal,
                    createdAt: new Date().toISOString()
                };

                await setDoc(supRef, supData);
                
                if (window.tempPurchaseState) {
                    window.tempPurchaseState.supplierId = documentId;
                    window.openCreatePurchase = true;
                    document.getElementById('navCompras').click();
                    return;
                }

                if (window.tempProductState) {
                    window.tempProductState.newSupplierId = documentId;
                    document.getElementById('navProductos').click();
                    return;
                }

                await loadSuppliers();
            } catch (error) {
                console.error("Error creating supplier: ", error);
                showNotification("Error al guardar. Revisa la consola.");
                btn.disabled = false;
                btn.textContent = 'Crear Proveedor';
            }
        });
    }

    function renderDetail(supplier) {
        // Prepare action buttons (point to sellerPhone if it exists, else supPhone, or hide if neither)
        // Wait, the user specifically requested them to point to the SELLER.
        // What if sellerPhone doesn't exist? I will hide the buttons or gray them out.
        const phoneToContact = supplier.sellerPhone;
        const emailToContact = supplier.email; // Supplier email

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backDetailBtn" style="height: 38px; width: auto; font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 12px; font-weight: 700; flex-shrink: 0;">← Volver</button>
                <h2 style="margin: 0; color: var(--warning); font-size: 1.5rem; font-weight: 800; white-space: nowrap;">Ficha de Proveedor</h2>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 500px; margin: 0 auto; width: 100%;">
                <!-- Tarjeta de Acciones Rápidas -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--warning); width: 100%;">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                        <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.1rem; color: var(--warning);">${supplier.name}</h3>
                        <p style="font-family: monospace; font-size: 0.8rem; color: var(--warning); font-weight: 700; margin-bottom: 1rem;">ID: ${supplier.id}</p>
                        
                        <div style="display: flex; justify-content: center; gap: 0.75rem;">
                            ${phoneToContact ? `
                                <a href="tel:${phoneToContact}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--warning); color: var(--warning); background: transparent;" title="Llamar al vendedor">📞</a>
                            ` : ''}
                            
                            ${phoneToContact ? `
                                <a target="_blank" href="https://wa.me/${phoneToContact.replace('+','')}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--warning); color: var(--warning); background: transparent;" title="WhatsApp al vendedor">💬</a>
                            ` : ''}
                            
                            ${emailToContact ? `
                                <a href="mailto:${emailToContact}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--warning); color: var(--warning); background: transparent;" title="Enviar Correo">✉️</a>
                            ` : ''}
                        </div>
                        ${!phoneToContact && !emailToContact ? '<p class="text-muted text-sm text-center">No hay datos de contacto registrados.</p>' : ''}
                    </div>
                </div>

                <!-- Formulario de Edición -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--warning); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">✏️ Editar Datos</h3>
                    <form id="editSupplierForm">
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <div class="form-group">
                                <label style="margin-bottom: 0.2rem; font-size: 0.65rem;">📧 Correo Electrónico (Proveedor)</label>
                                <input type="email" id="editEmail" class="form-control" value="${supplier.email || ''}" style="height: 40px; font-size: 0.85rem; font-family: inherit;">
                            </div>

                            <div class="form-group">
                                <label style="margin-bottom: 0.2rem; font-size: 0.65rem;">📞 Teléfono del Proveedor</label>
                                <input type="tel" id="editSupPhone" class="form-control" value="${supplier.phone || ''}" style="height: 40px; font-size: 0.85rem; font-family: inherit;">
                            </div>

                            <div class="form-group">
                                <label style="margin-bottom: 0.2rem; font-size: 0.65rem;">👤 Nombre del Vendedor</label>
                                <input type="text" id="editSellerName" class="form-control" value="${supplier.sellerName || ''}" style="height: 40px; font-size: 0.85rem; font-family: inherit;">
                            </div>

                            <div class="form-group">
                                <label style="margin-bottom: 0.2rem; font-size: 0.65rem;">📱 Teléfono del Vendedor</label>
                                <input type="tel" id="editSellerPhone" class="form-control" value="${supplier.sellerPhone || ''}" style="height: 40px; font-size: 0.85rem; font-family: inherit;">
                            </div>

                            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                                <button type="button" class="btn btn-outline" id="cancelEditBtn" style="flex: 1; height: 42px; font-weight: 700; border-radius: 12px;">CANCELAR</button>
                                <button type="submit" class="btn btn-primary" id="saveEditBtn" style="flex: 1; height: 42px; font-weight: 800; border-radius: 12px;">GUARDAR</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            <style>
                .iti { width: 100%; display: block; }
            </style>
        `;

        container.querySelector('#backDetailBtn').addEventListener('click', renderList);
        container.querySelector('#cancelEditBtn').addEventListener('click', renderList);

        // Inicializar Intl Tel Input
        const editSupPhoneInput = container.querySelector('#editSupPhone');
        const itiEditSup = window.intlTelInput(editSupPhoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        const editSellerPhoneInput = container.querySelector('#editSellerPhone');
        const itiEditSeller = window.intlTelInput(editSellerPhoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        container.querySelector('#editSupplierForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = container.querySelector('#saveEditBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const email = container.querySelector('#editEmail').value.trim();
            const supPhoneVal = editSupPhoneInput.value.trim() ? itiEditSup.getNumber() : "";
            const rawSellerName = container.querySelector('#editSellerName').value.trim();
            const sellerName = rawSellerName ? toTitleCase(rawSellerName) : "";
            const sellerPhoneVal = editSellerPhoneInput.value.trim() ? itiEditSeller.getNumber() : "";

            const businessId = localStorage.getItem('businessId');
            
            try {
                const updateData = {
                    email,
                    phone: supPhoneVal,
                    sellerName,
                    sellerPhone: sellerPhoneVal
                };

                await setDoc(doc(db, "businesses", businessId, "suppliers", supplier.id), updateData, { merge: true });
                await loadSuppliers();
            } catch (error) {
                console.error("Error actualizando proveedor: ", error);
                showNotification("Error al actualizar. Revisa la consola.");
                btn.disabled = false;
                btn.textContent = 'Guardar Cambios';
            }
        });
    }

    loadSuppliers();
}
