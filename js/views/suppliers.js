import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { doc, setDoc, getDocs, getDoc, collection, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderSuppliers(container) {
    let suppliers = [];

    async function loadSuppliers() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando proveedores...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;
        try {
            const q = query(collection(db, "businesses", businessId, "suppliers"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderList();
            
            if (window.openCreateSupplierForPurchase) {
                window.openCreateSupplierForPurchase = false;
                renderForm();
            }
        } catch (error) {
            console.error("Error cargando proveedores:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar los proveedores.</div>';
        }
    }

    function renderList() {
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <h2>Proveedores</h2>
                <button class="btn btn-primary" id="addSupplierBtn" style="width: auto;">+ Crear Proveedor</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem;">
        `;
        
        if (suppliers.length === 0) {
            html += `<p class="text-muted" style="grid-column: 1 / -1;">No hay proveedores registrados aún.</p>`;
        } else {
            suppliers.forEach(supplier => {
                html += `
                    <div class="card supplier-card" data-id="${supplier.id}" style="cursor: pointer; border-left: 4px solid var(--warning);">
                        <h3 class="card-title" title="${supplier.name}">${supplier.name}</h3>
                        <p class="card-label">Contacto</p>
                        <p class="text-sm" style="margin-bottom: 0.25rem;">${supplier.phone || 'Sin teléfono'}</p>
                        ${supplier.sellerName ? `<p class="text-sm text-muted" style="margin-top: 0.5rem;"><strong>Vendedor:</strong> ${supplier.sellerName}</p>` : ''}
                    </div>
                `;
            });
        }
        html += `</div>`;
        container.innerHTML = html;

        container.querySelector('#addSupplierBtn').addEventListener('click', renderForm);
        
        container.querySelectorAll('.supplier-card').forEach(card => {
            card.addEventListener('click', () => {
                const supplier = suppliers.find(s => s.id === card.dataset.id);
                if (supplier) renderDetail(supplier);
            });
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
        });
    }

    function renderForm() {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem;">← Cancelar</button>
                <h2>Creación de Proveedor</h2>
            </div>
            <div class="card" style="max-width: 600px;">
                <form id="supplierForm">
                    <h3 style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">Datos del Proveedor</h3>
                    
                    <div class="form-group mb-4">
                        <label>Nombre del Proveedor <span class="text-danger">*</span></label>
                        <input type="text" id="supName" class="form-control" placeholder="Ej. Distribuidora XYZ" required>
                    </div>
                    
                    <div class="form-group mb-4">
                        <label>Documento de Identidad (Cédula o RIF) <span class="text-danger">*</span></label>
                        <div style="display: flex; gap: 0.5rem;">
                            <select id="supDocType" class="form-control" style="width: 80px;" required>
                                <option value="V-">V-</option>
                                <option value="J-">J-</option>
                                <option value="E-">E-</option>
                                <option value="G-">G-</option>
                            </select>
                            <input type="text" id="supDocNumber" class="form-control" placeholder="Ej. 14789652" required pattern="[0-9]+" title="Solo números">
                        </div>
                        <small class="text-muted">Este campo es único para evitar duplicados en el sistema.</small>
                    </div>

                    <div class="form-group mb-4">
                        <label>Correo Electrónico</label>
                        <input type="email" id="supEmail" class="form-control" placeholder="usuario@correo.com">
                    </div>

                    <div class="form-group mb-4">
                        <label>Teléfono del Proveedor</label>
                        <input type="tel" id="supPhone" class="form-control" placeholder="Ej. 4241234567" style="width: 100%;">
                    </div>

                    <h3 style="margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">Datos del Vendedor / Contacto</h3>

                    <div class="form-group mb-4">
                        <label>Nombre del Vendedor</label>
                        <input type="text" id="sellerName" class="form-control" placeholder="Ej. Carlos Silva">
                    </div>

                    <div class="form-group mb-4">
                        <label>Teléfono del Vendedor</label>
                        <input type="tel" id="sellerPhone" class="form-control" placeholder="Ej. 4141234567" style="width: 100%;">
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelFormBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveBtn">Crear Proveedor</button>
                    </div>
                </form>
            </div>
            <style>
                .iti { width: 100%; display: block; }
            </style>
        `;

        container.querySelector('#backBtn').addEventListener('click', renderList);
        container.querySelector('#cancelFormBtn').addEventListener('click', renderList);

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
                    document.getElementById('navCompras').click();
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
                <button class="btn btn-outline" id="backDetailBtn" style="width: auto; padding: 0.5rem 1rem;">← Volver</button>
                <h2>Detalle del Proveedor</h2>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem; max-width: 800px;">
                <!-- Tarjeta de Acciones Rápidas -->
                <div class="card" style="background: var(--surface);">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 1.5rem;">
                        <div style="width: 64px; height: 64px; background-color: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; margin-bottom: 1rem;">
                            ${supplier.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 style="font-size: 1.5rem; margin-bottom: 0.25rem;">${supplier.name}</h3>
                        <p class="text-muted" style="font-weight: 500;">${supplier.id}</p>
                    </div>
                    
                    <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                        ${phoneToContact ? `
                            <a href="tel:${phoneToContact}" class="btn btn-outline" style="width: auto; display: flex; align-items: center; gap: 0.5rem; border-color: #3b82f6; color: #3b82f6; text-decoration: none;" title="Llamar al vendedor">
                                📞 Llamar
                            </a>
                        ` : ''}
                        
                        ${emailToContact ? `
                        <a href="mailto:${emailToContact}" class="btn btn-outline" style="width: auto; display: flex; align-items: center; gap: 0.5rem; text-decoration: none;">
                            ✉️ Enviar Correo
                        </a>` : ''}
                        
                        ${phoneToContact ? `
                        <a target="_blank" href="https://wa.me/${phoneToContact.replace('+','')}" class="btn btn-outline" style="width: auto; display: flex; align-items: center; gap: 0.5rem; border-color: #25D366; color: #25D366; text-decoration: none;" title="WhatsApp al vendedor">
                            💬 WhatsApp
                        </a>` : ''}
                    </div>
                    ${!phoneToContact && !emailToContact ? '<p class="text-muted text-sm text-center">No hay datos de contacto registrados.</p>' : ''}
                </div>

                <!-- Formulario de Edición -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">Editar Datos</h3>
                    <form id="editSupplierForm">
                        <div class="form-group mb-4">
                            <label>Correo Electrónico (Proveedor)</label>
                            <input type="email" id="editEmail" class="form-control" value="${supplier.email || ''}">
                        </div>

                        <div class="form-group mb-4">
                            <label>Teléfono del Proveedor</label>
                            <input type="tel" id="editSupPhone" class="form-control" value="${supplier.phone || ''}" style="width: 100%;">
                        </div>

                        <div class="form-group mb-4">
                            <label>Nombre del Vendedor</label>
                            <input type="text" id="editSellerName" class="form-control" value="${supplier.sellerName || ''}">
                        </div>

                        <div class="form-group mb-4">
                            <label>Teléfono del Vendedor</label>
                            <input type="tel" id="editSellerPhone" class="form-control" value="${supplier.sellerPhone || ''}" style="width: 100%;">
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                            <button type="button" class="btn btn-outline" id="cancelEditBtn">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="saveEditBtn">Guardar Cambios</button>
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
