import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { doc, setDoc, getDocs, getDoc, collection, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderClients(container, onFinish = null, initialName = '') {
    let clients = [];
    let map = null;
    let marker = null;
    let selectedLat = 10.992; 
    let selectedLng = -63.805;

    async function loadClients() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando clientes...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;
        try {
            const q = query(collection(db, "businesses", businessId, "clients"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderList();
        } catch (error) {
            console.error("Error cargando clientes:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar los clientes. Asegúrate de que la base de datos Firestore esté configurada.</div>';
        }
    }

    function renderList() {
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <h2>Clientes</h2>
                <button class="btn btn-primary" id="addClientBtn" style="width: auto;">+ Crear Cliente</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem;">
        `;
        
        if (clients.length === 0) {
            html += `<p class="text-muted" style="grid-column: 1 / -1;">No hay clientes registrados aún.</p>`;
        } else {
            clients.forEach(client => {
                html += `
                    <div class="card client-card" data-id="${client.id}" style="cursor: pointer; border-left: 4px solid var(--primary);">
                        <h3 class="card-title" title="${client.fullName}">${client.fullName}</h3>
                        <p class="card-label">Teléfono</p>
                        <p class="text-sm" style="margin-bottom: 0.25rem;">${client.phone || 'Sin teléfono'}</p>
                        <p class="text-sm text-muted" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 0.5rem;">${client.address}</p>
                    </div>
                `;
            });
        }
        html += `</div>`;
        container.innerHTML = html;

        container.querySelector('#addClientBtn').addEventListener('click', () => renderForm());
        
        if (onFinish) {
            // Add a return button if in "redirect" mode
            const backHeader = document.createElement('div');
            backHeader.style = 'margin-bottom: 1rem;';
            backHeader.innerHTML = `<button class="btn btn-outline" id="abortRedirectBtn" style="width: auto;">← Volver al Proceso Anterior</button>`;
            container.prepend(backHeader);
            container.querySelector('#abortRedirectBtn').onclick = () => onFinish(null);
        }
        
        container.querySelectorAll('.client-card').forEach(card => {
            card.addEventListener('click', () => {
                const client = clients.find(c => c.id === card.dataset.id);
                if (client) renderDetail(client);
            });
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
        });
    }

    function renderForm() {
        const isRedirect = !!onFinish;
        // Reset coordinates for new client
        selectedLat = 10.992;
        selectedLng = -63.805;
        map = null;
        marker = null;

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem;">← ${isRedirect ? 'Volver' : 'Cancelar'}</button>
                <h2>Creación de Cliente</h2>
            </div>
            <div class="card" style="max-width: 600px;">
                <form id="clientForm">
                    <div class="form-group mb-4">
                        <label>Nombre Completo <span class="text-danger">*</span></label>
                        <input type="text" id="clientName" class="form-control" placeholder="Ej. Juan Perez" required>
                        <small class="text-muted">Debe contener al menos un nombre y un apellido separados por un espacio.</small>
                    </div>
                    
                    <div class="form-group mb-4">
                        <label>Documento de Identidad (Cédula o RIF) <span class="text-danger">*</span></label>
                        <div style="display: flex; gap: 0.5rem;">
                            <select id="docType" class="form-control" style="width: 80px;" required>
                                <option value="V-">V-</option>
                                <option value="J-">J-</option>
                                <option value="E-">E-</option>
                                <option value="G-">G-</option>
                            </select>
                            <input type="text" id="docNumber" class="form-control" placeholder="Ej. 14789652" required pattern="[0-9]+" title="Solo números">
                        </div>
                        <small class="text-muted">Este campo es único, no pueden existir dos clientes con el mismo documento.</small>
                    </div>

                    <div class="form-group mb-4">
                        <label>Correo Electrónico</label>
                        <input type="email" id="clientEmail" class="form-control" placeholder="usuario@correo.com">
                    </div>

                    <div class="form-group mb-4">
                        <label>Teléfono Móvil <span class="text-danger">*</span></label>
                        <input type="tel" id="phoneNumber" class="form-control" placeholder="Ej. 4241234567" required style="width: 100%;">
                        <small class="text-muted" style="display: block; margin-top: 0.5rem;">El sistema guarda automáticamente el número en formato internacional (+58...).</small>
                    </div>

                    <div class="form-group mb-4">
                        <label>Dirección Residencial <span class="text-danger">*</span></label>
                        <textarea id="clientAddress" class="form-control" rows="2" required>PAMPATAR</textarea>
                    </div>

                    <div class="form-group mb-4" style="border: 1px solid var(--border); padding: 1rem; border-radius: 8px;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0;">
                            <span>¿Necesita Delivery?</span>
                            <select id="deliverySelect" class="form-control" style="width: 100px; padding: 0.2rem 0.5rem;">
                                <option value="NO">NO</option>
                                <option value="SI">SI</option>
                            </select>
                        </label>
                        
                        <div id="mapContainerWrapper" style="display: none; margin-top: 1rem;">
                            <p class="text-sm text-muted mb-2">Seleccione la ubicación exacta en el mapa arrastrando el marcador.</p>
                            <div id="map" style="height: 300px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
                            <div style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                                <span class="text-sm" id="coordsDisplay">Coords: ${selectedLat}, ${selectedLng}</span>
                                <button type="button" class="btn btn-outline text-sm" id="fullscreenMapBtn" style="width: auto; padding: 0.25rem 0.5rem;">Pantalla Completa</button>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelFormBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveBtn">Crear Cliente</button>
                    </div>
                </form>
            </div>

            <!-- Modal Mapa Pantalla Completa -->
            <div id="fullMapModal" style="display: none; position: fixed; inset: 0; background: var(--background); z-index: 1000; flex-direction: column;">
                <div style="padding: 1rem; background: var(--surface); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);">
                    <h3 style="margin: 0;">Seleccionar Ubicación Exacta</h3>
                    <button id="closeFullMapBtn" class="btn btn-primary" style="width: auto;">Seleccionar y Cerrar</button>
                </div>
                <div id="fullMap" style="flex: 1;"></div>
            </div>
            <style>
                .iti { width: 100%; display: block; }
            </style>
        `;

        container.querySelector('#backBtn').addEventListener('click', () => {
            if (isRedirect) onFinish(null);
            else renderList();
        });
        container.querySelector('#cancelFormBtn').addEventListener('click', () => {
            if (isRedirect) onFinish(null);
            else renderList();
        });

        // Pre-fill initial name
        if (initialName) {
            container.querySelector('#clientName').value = initialName;
        }

        // Inicializar Intl Tel Input
        const phoneInput = container.querySelector('#phoneNumber');
        const iti = window.intlTelInput(phoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        // Lógica de Delivery y Mapa
        const deliverySelect = container.querySelector('#deliverySelect');
        const mapContainerWrapper = container.querySelector('#mapContainerWrapper');
        let fullMap = null;
        let fullMarker = null;

        deliverySelect.addEventListener('change', (e) => {
            if (e.target.value === 'SI') {
                mapContainerWrapper.style.display = 'block';
                // Initialize map if not already done
                if (!map && window.L) {
                    setTimeout(() => {
                        map = L.map('map').setView([selectedLat, selectedLng], 17);
                        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                            maxZoom: 21
                        }).addTo(map);
                        
                        marker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(map);
                        
                        marker.on('dragend', function (event) {
                            var position = marker.getLatLng();
                            selectedLat = position.lat;
                            selectedLng = position.lng;
                            container.querySelector('#coordsDisplay').textContent = `Coords: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
                        });
                    }, 100);
                }
            } else {
                mapContainerWrapper.style.display = 'none';
            }
        });

        // Pantalla Completa Mapa
        container.querySelector('#fullscreenMapBtn').addEventListener('click', () => {
            const modal = container.querySelector('#fullMapModal');
            modal.style.display = 'flex';
            
            if (!fullMap && window.L) {
                setTimeout(() => {
                    fullMap = L.map('fullMap').setView([selectedLat, selectedLng], 18);
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri',
                        maxZoom: 21
                    }).addTo(fullMap);
                    fullMarker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(fullMap);
                    
                    fullMarker.on('dragend', function (event) {
                        var position = fullMarker.getLatLng();
                        selectedLat = position.lat;
                        selectedLng = position.lng;
                        // update mini map
                        if(marker) marker.setLatLng(position);
                        if(map) map.setView(position);
                        container.querySelector('#coordsDisplay').textContent = `Coords: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
                    });
                }, 200);
            } else if (fullMap && fullMarker) {
                fullMap.invalidateSize();
                fullMap.setView([selectedLat, selectedLng], 18);
                fullMarker.setLatLng([selectedLat, selectedLng]);
            }
        });

        container.querySelector('#closeFullMapBtn').addEventListener('click', () => {
            container.querySelector('#fullMapModal').style.display = 'none';
        });

        // Form Submit
        container.querySelector('#clientForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validaciones manuales
            const rawName = container.querySelector('#clientName').value.trim();
            if (!rawName.includes(' ')) {
                showNotification("El Nombre Completo debe contener por lo menos un nombre y un apellido (separados por un espacio).");
                return;
            }

            const name = toTitleCase(rawName);
            const docType = container.querySelector('#docType').value;
            const docNum = container.querySelector('#docNumber').value.trim();
            const documentId = `${docType}${docNum}`; // Ej: V-14789652
            
            const email = container.querySelector('#clientEmail').value.trim();
            
            // Obtiene el número en formato E.164 (Ej. +584241234567)
            const fullPhone = iti.getNumber();

            const address = toTitleCase(container.querySelector('#clientAddress').value.trim());
            const needsDelivery = deliverySelect.value === 'SI';
            
            const btn = container.querySelector('#saveBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const businessId = localStorage.getItem('businessId');

            try {
                // Verificar si ya existe un cliente con ese documento
                const clientRef = doc(db, "businesses", businessId, "clients", documentId);
                const docSnap = await getDoc(clientRef);
                
                if (docSnap.exists()) {
                    showNotification(`Ya existe un cliente registrado con el documento ${documentId}.`);
                    btn.disabled = false;
                    btn.textContent = 'Crear Cliente';
                    return;
                }

                const clientData = {
                    fullName: name,
                    email: email,
                    phone: fullPhone,
                    address: address,
                    needsDelivery: needsDelivery,
                    createdAt: new Date().toISOString()
                };

                if (needsDelivery) {
                    clientData.location = {
                        lat: selectedLat,
                        lng: selectedLng
                    };
                }

                const fullClient = { id: documentId, ...clientData };
                await setDoc(clientRef, clientData);
                
                if (onFinish) {
                    onFinish(fullClient);
                } else {
                    await loadClients();
                }
            } catch (error) {
                console.error("Error creating client: ", error);
                showNotification("Error al guardar el cliente. Revisa la consola.");
                btn.disabled = false;
                btn.textContent = 'Crear Cliente';
            }
        });
    }

    function renderDetail(client) {
        // Prepare map data if available
        const hasLocation = client.needsDelivery && client.location;
        let selectedLat = hasLocation ? client.location.lat : 10.992;
        let selectedLng = hasLocation ? client.location.lng : -63.805;
        let detailMap = null;
        let detailMarker = null;

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backDetailBtn" style="width: auto; padding: 0.5rem 1rem;">← Volver</button>
                <h2>Detalle del Cliente</h2>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem; max-width: 800px;">
                <!-- Tarjeta de Acciones Rápidas -->
                <div class="card" style="background: var(--surface);">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 1.5rem;">
                        <div style="width: 64px; height: 64px; background-color: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; margin-bottom: 1rem;">
                            ${client.fullName.charAt(0).toUpperCase()}
                        </div>
                        <h3 style="font-size: 1.5rem; margin-bottom: 0.25rem;">${client.fullName}</h3>
                        <p class="text-muted" style="font-weight: 500;">${client.id}</p>
                    </div>
                    
                    <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
                        <a href="tel:${client.phone}" class="btn btn-outline" style="width: auto; display: flex; align-items: center; gap: 0.5rem; border-color: #3b82f6; color: #3b82f6; text-decoration: none;">
                            📞 Llamar
                        </a>
                        ${client.email ? `
                        <a href="mailto:${client.email}" class="btn btn-outline" style="width: auto; display: flex; align-items: center; gap: 0.5rem; text-decoration: none;">
                            ✉️ Enviar Correo
                        </a>` : ''}
                        <a target="_blank" href="https://wa.me/${client.phone.replace('+','')}" class="btn btn-outline" style="width: auto; display: flex; align-items: center; gap: 0.5rem; border-color: #25D366; color: #25D366; text-decoration: none;">
                            💬 WhatsApp
                        </a>
                    </div>
                </div>

                <!-- Formulario de Edición -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">Datos del Cliente</h3>
                    <form id="editClientForm">
                        <div class="form-group mb-4">
                            <label>Teléfono Móvil (Formato Internacional)</label>
                            <input type="tel" id="editPhone" class="form-control" value="${client.phone}" required style="width: 100%;">
                        </div>
                        <div class="form-group mb-4">
                            <label>Correo Electrónico</label>
                            <input type="email" id="editEmail" class="form-control" value="${client.email || ''}">
                        </div>
                        <div class="form-group mb-4">
                            <label>Dirección Residencial</label>
                            <textarea id="editAddress" class="form-control" rows="2" required>${client.address}</textarea>
                        </div>

                        <div class="form-group mb-4">
                            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0;">
                                <span>¿Necesita Delivery?</span>
                                <select id="editDelivery" class="form-control" style="width: 100px; padding: 0.2rem 0.5rem;">
                                    <option value="NO" ${!client.needsDelivery ? 'selected' : ''}>NO</option>
                                    <option value="SI" ${client.needsDelivery ? 'selected' : ''}>SI</option>
                                </select>
                            </label>
                            
                            <div id="editMapContainer" style="display: ${client.needsDelivery ? 'block' : 'none'}; margin-top: 1rem;">
                                <p class="text-sm text-muted mb-2">Arrastra el marcador para actualizar la ubicación.</p>
                                <div id="detailMap" style="height: 250px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
                                <div style="margin-top: 0.5rem;">
                                    <span class="text-sm" id="editCoordsDisplay">Coords: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}</span>
                                </div>
                            </div>
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

        // Inicializar Intl Tel Input para edición
        const editPhoneInput = container.querySelector('#editPhone');
        const itiEdit = window.intlTelInput(editPhoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        // Lógica de Mapa Edición
        const editDelivery = container.querySelector('#editDelivery');
        const editMapContainer = container.querySelector('#editMapContainer');
        
        function initDetailMap() {
            if (!detailMap && window.L) {
                detailMap = L.map('detailMap').setView([selectedLat, selectedLng], 17);
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri',
                    maxZoom: 21
                }).addTo(detailMap);
                detailMarker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(detailMap);
                
                detailMarker.on('dragend', function (event) {
                    var position = detailMarker.getLatLng();
                    selectedLat = position.lat;
                    selectedLng = position.lng;
                    container.querySelector('#editCoordsDisplay').textContent = `Coords: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
                });
            }
        }

        // Si ya estaba en SI, inicializar el mapa enseguida (con un pequeño delay para asegurar el render)
        if (client.needsDelivery) {
            setTimeout(initDetailMap, 100);
        }

        editDelivery.addEventListener('change', (e) => {
            if (e.target.value === 'SI') {
                editMapContainer.style.display = 'block';
                setTimeout(initDetailMap, 100);
            } else {
                editMapContainer.style.display = 'none';
            }
        });

        container.querySelector('#editClientForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = container.querySelector('#saveEditBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const phone = itiEdit.getNumber();
            const email = container.querySelector('#editEmail').value.trim();
            const address = toTitleCase(container.querySelector('#editAddress').value.trim());
            const needsDelivery = editDelivery.value === 'SI';

            const businessId = localStorage.getItem('businessId');
            
            try {
                const updateData = {
                    phone,
                    email,
                    address,
                    needsDelivery
                };

                if (needsDelivery) {
                    updateData.location = { lat: selectedLat, lng: selectedLng };
                } else {
                    // Firebase doesn't delete fields via setDoc(..., {merge: true}) easily unless using deleteField(), 
                    // but since we overwrite specific fields we can just set it to null or leave it. 
                    // Let's set it to null if no delivery.
                    updateData.location = null;
                }

                // Usamos setDoc con merge: true para no sobreescribir fullName o createdAt
                await setDoc(doc(db, "businesses", businessId, "clients", client.id), updateData, { merge: true });
                await loadClients();
            } catch (error) {
                console.error("Error actualizando cliente: ", error);
                showNotification("Error al actualizar. Revisa la consola.");
                btn.disabled = false;
                btn.textContent = 'Guardar Cambios';
            }
        });
    }

    if (onFinish) {
        renderForm();
    } else {
        loadClients();
    }
}
