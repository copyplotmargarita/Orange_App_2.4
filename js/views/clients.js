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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;" class="flex-stack-mobile">
                <div>
                    <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px;">👥 Cartera de Clientes</h2>
                    <p class="text-muted text-sm">Gestiona tus clientes y sus ubicaciones de entrega</p>
                </div>
                <button class="btn btn-primary" id="addClientBtn" style="width: auto; height: 42px; padding: 0 1.25rem; font-weight: 700; border-radius: var(--radius-full);">+ Crear Cliente</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
        `;
        
        if (clients.length === 0) {
            html += `<p class="text-muted" style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">No hay clientes registrados aún.</p>`;
        } else {
            clients.forEach(client => {
                html += `
                    <div class="card client-card" data-id="${client.id}" style="cursor: pointer; border-left: 4px solid var(--primary); padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(37, 99, 235, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 800;">
                                ${client.fullName.charAt(0).toUpperCase()}
                            </div>
                            <h3 class="card-title" style="margin-bottom: 0; font-size: 1.1rem;">${client.fullName}</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <p class="card-label">📞 Teléfono</p>
                            <p class="text-sm font-bold">${client.phone || 'Sin teléfono'}</p>
                            <p class="card-label" style="margin-top: 0.5rem;">📍 Dirección</p>
                            <p class="text-muted text-xs" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${client.address}</p>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;
        container.innerHTML = html;

        container.querySelector('#addClientBtn').addEventListener('click', () => renderForm());
        
        if (onFinish) {
            const backHeader = document.createElement('div');
            backHeader.style = 'margin-bottom: 1.5rem;';
            backHeader.innerHTML = `<button class="btn btn-outline" id="abortRedirectBtn" style="width: auto; height: 38px; font-size: 0.85rem; border-radius: var(--radius-full);">← Volver al Proceso Anterior</button>`;
            container.prepend(backHeader);
            container.querySelector('#abortRedirectBtn').onclick = () => onFinish(null);
        }
        
        container.querySelectorAll('.client-card').forEach(card => {
            card.addEventListener('click', () => {
                const client = clients.find(c => c.id === card.dataset.id);
                if (client) renderDetail(client);
            });
        });
    }

    function renderForm() {
        const isRedirect = !!onFinish;
        selectedLat = 10.992;
        selectedLng = -63.805;
        map = null;
        marker = null;

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; text-align: center; justify-content: center; flex-direction: column;">
                <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px;">✨ Nuevo Cliente</h2>
                <p class="text-muted text-sm">Registra los datos para facturación y delivery</p>
            </div>
            
            <div class="card" style="max-width: 600px; margin: 0 auto; padding: 2.5rem; border-top: 4px solid var(--primary);">
                <form id="clientForm">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-group" style="grid-column: span 2;">
                            <label>👤 Nombre Completo</label>
                            <input type="text" id="clientName" class="form-control" placeholder="Ej. Juan Pérez" required>
                        </div>
                        
                        <div class="form-group" style="grid-column: span 2;">
                            <label>🪪 Documento (Cédula o RIF)</label>
                            <div style="display: flex; gap: 0;">
                                <select id="docType" class="form-control" style="width: 80px; border-radius: var(--radius-md) 0 0 var(--radius-md); border-right: none;" required>
                                    <option value="V-">V-</option>
                                    <option value="J-">J-</option>
                                    <option value="E-">E-</option>
                                    <option value="G-">G-</option>
                                </select>
                                <input type="text" id="docNumber" class="form-control" style="border-radius: 0 var(--radius-md) var(--radius-md) 0;" placeholder="12345678" required pattern="[0-9]+" title="Solo números">
                            </div>
                        </div>

                        <div class="form-group" style="grid-column: span 2;">
                            <label>📧 Correo Electrónico</label>
                            <input type="email" id="clientEmail" class="form-control" placeholder="usuario@correo.com">
                        </div>

                        <div class="form-group" style="grid-column: span 2;">
                            <label>📱 Teléfono Móvil</label>
                            <input type="tel" id="clientPhone" class="form-control" placeholder="4141234567" required>
                        </div>

                        <div class="form-group" style="grid-column: span 2;">
                            <label>📍 Dirección Residencial</label>
                            <textarea id="clientAddress" class="form-control" rows="2" required style="resize: none;">PAMPATAR</textarea>
                        </div>

                        <div class="form-group" style="grid-column: span 2; background: var(--background); padding: 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--border);">
                            <label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0;">
                                <span style="font-size: 0.75rem; font-weight: 800;">🚚 ¿REQUIERE DELIVERY?</span>
                                <select id="deliverySelect" class="form-control" style="width: 90px; height: 32px; padding: 0 0.5rem; font-size: 0.75rem; font-weight: 700;">
                                    <option value="NO">NO</option>
                                    <option value="SI">SÍ</option>
                                </select>
                            </label>
                            
                            <div id="mapContainerWrapper" style="display: none; margin-top: 1rem;">
                                <p class="text-xs text-muted mb-2">Selecciona la ubicación exacta en el mapa</p>
                                <div id="map" style="height: 250px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
                                <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.7rem; font-family: monospace; color: var(--text-muted);" id="coordsDisplay">${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}</span>
                                    <button type="button" class="btn btn-outline" id="fullscreenMapBtn" style="width: auto; height: 30px; padding: 0 0.75rem; font-size: 0.7rem;">Ampliar Mapa ⛶</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelFormBtn" style="flex: 1; height: 45px;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveBtn" style="flex: 2; height: 45px; font-weight: 700;">Crear Cliente</button>
                    </div>
                </form>
            </div>

            <!-- Modal Mapa Pantalla Completa -->
            <div id="fullMapModal" style="display: none; position: fixed; inset: 0; background: var(--background); z-index: 1000; flex-direction: column;">
                <div style="padding: 1rem; background: var(--surface); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border);">
                    <h3 style="margin: 0; font-weight: 800;">📍 Ubicación de Entrega</h3>
                    <button id="closeFullMapBtn" class="btn btn-primary" style="width: auto; height: 40px; padding: 0 1.5rem;">Confirmar y Cerrar</button>
                </div>
                <div id="fullMap" style="flex: 1;"></div>
            </div>
            <style>
                .iti { width: 100%; }
                .form-group label { margin-bottom: 0.4rem; color: var(--text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; }
                /* Estilos para el dropdown de países */
                .iti__country-list { background-color: var(--surface) !important; color: var(--text-main) !important; border: 1px solid var(--border) !important; border-radius: 8px !important; box-shadow: var(--shadow-lg) !important; }
                .iti__country:hover { background-color: var(--background) !important; }
                .iti__country-name, .iti__dial-code { color: var(--text-main) !important; }
                .iti__divider { border-bottom: 1px solid var(--border) !important; }
            </style>
        `;

        const backBtn = container.querySelector('#backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (isRedirect) onFinish(null);
                else renderList();
            });
        }
        
        container.querySelector('#cancelFormBtn').addEventListener('click', () => {
            if (isRedirect) onFinish(null);
            else renderList();
        });

        if (initialName) {
            container.querySelector('#clientName').value = initialName;
        }

        // Inicializar Intl Tel Input (Mismo patrón que en Employees)
        const phoneInput = container.querySelector('#clientPhone');
        const iti = window.intlTelInput(phoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
            separateDialCode: true
        });

        // Lógica de Delivery y Mapa
        const deliverySelect = container.querySelector('#deliverySelect');
        const mapContainerWrapper = container.querySelector('#mapContainerWrapper');
        let fullMap = null;
        let fullMarker = null;

        deliverySelect.addEventListener('change', (e) => {
            if (e.target.value === 'SI') {
                mapContainerWrapper.style.display = 'block';
                
                if (!map && window.L) {
                    setTimeout(() => {
                        // Crear el mapa con la capa satelital de Google
                        map = L.map('map', {
                            center: [selectedLat, selectedLng],
                            zoom: 17,
                            zoomControl: false // Lo movemos para que no estorbe
                        });

                        L.control.zoom({ position: 'bottomright' }).addTo(map);

                        // Capa Satelital de Google (Máxima precisión y zoom)
                        L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                            maxZoom: 21,
                            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                            attribution: '&copy; Google Maps'
                        }).addTo(map);

                        // Marcador fijo en el centro (CSS)
                        const centerMarkerIcon = L.divIcon({
                            className: 'center-marker',
                            html: `<div style="position: relative; width: 40px; height: 40px; transform: translate(-50%, -50%);">
                                     <div style="position: absolute; top: 50%; left: 50%; width: 2px; height: 40px; background: #f97316; transform: translate(-50%, -50%);"></div>
                                     <div style="position: absolute; top: 50%; left: 50%; width: 40px; height: 2px; background: #f97316; transform: translate(-50%, -50%);"></div>
                                     <div style="position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; border: 2px solid #f97316; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 10px rgba(249,115,22,0.5);"></div>
                                     <div style="position: absolute; top: 50%; left: 50%; width: 4px; height: 4px; background: #f97316; border-radius: 50%; transform: translate(-50%, -50%);"></div>
                                   </div>`,
                            iconSize: [0, 0],
                            iconAnchor: [0, 0]
                        });

                        // El marcador es solo visual y queda "flotando" en el centro del contenedor
                        const crosshair = document.createElement('div');
                        crosshair.innerHTML = `
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); z-index: 1000; pointer-events: none; margin-top: -2px;">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#EA4335" stroke="#B31412" stroke-width="0.5"/>
                                    <circle cx="12" cy="9" r="3" fill="white"/>
                                </svg>
                                <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 8px; height: 3px; background: rgba(0,0,0,0.3); border-radius: 50%; filter: blur(1px);"></div>
                            </div>
                        `;
                        container.querySelector('#map').appendChild(crosshair);

                        // Actualizar coordenadas al mover el mapa
                        map.on('move', () => {
                            const center = map.getCenter();
                            selectedLat = center.lat;
                            selectedLng = center.lng;
                            container.querySelector('#coordsDisplay').textContent = `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;
                        });

                        // Intentar geolocalizar al inicio
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((position) => {
                                const lat = position.coords.latitude;
                                const lng = position.coords.longitude;
                                selectedLat = lat;
                                selectedLng = lng;
                                map.setView([lat, lng], 18);
                                container.querySelector('#coordsDisplay').textContent = `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;
                            }, (err) => {
                                console.warn("Error geolocalizando:", err);
                            });
                        }
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
        const hasLocation = client.needsDelivery && client.location;
        let selectedLat = hasLocation ? client.location.lat : 10.992;
        let selectedLng = hasLocation ? client.location.lng : -63.805;
        let detailMap = null;
        let detailMarker = null;

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                <button class="btn btn-outline" id="backDetailBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem; border-radius: var(--radius-full);">← Volver</button>
                <h2 style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px;">Ficha de Cliente</h2>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 1.5rem; max-width: 950px; margin: 0 auto;" class="grid-1-mobile">
                <div class="card" style="padding: 2rem; border-top: 4px solid var(--primary);">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border);">
                        <div style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary), #60a5fa); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.25rem; font-weight: 900; box-shadow: var(--shadow-md); margin-bottom: 1.25rem;">
                            ${client.fullName.charAt(0).toUpperCase()}
                        </div>
                        <h3 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.3rem;">${client.fullName}</h3>
                        <p style="font-family: monospace; font-size: 0.9rem; color: var(--primary); font-weight: 700;">ID: ${client.id}</p>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <a href="tel:${client.phone}" class="btn-action" style="background: var(--primary); border-color: var(--primary); color: white;">📞 Llamar</a>
                        <a target="_blank" href="https://wa.me/${client.phone.replace('+','')}" class="btn-action" style="background: #25D366; border-color: #25D366; color: white;">💬 WhatsApp</a>
                        ${client.email ? `<a href="mailto:${client.email}" class="btn-action" style="background: #475569; border-color: #475569; color: white;">📧 Correo</a>` : ''}
                        ${client.location ? `
                            <a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${client.location.lat},${client.location.lng}" class="btn-action" style="background: #4285F4; border-color: #4285F4; color: white;">📍 Ir a la Ubicación</a>
                        ` : ''}
                    </div>
                </div>

                <div class="card" style="padding: 2rem;">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">📋 Datos de Facturación</h3>
                    <form id="editClientForm">
                        <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>📱 Teléfono Principal</label>
                                <input type="tel" id="editPhone" class="form-control" value="${client.phone}" required>
                            </div>
                            <div class="form-group">
                                <label>📧 Correo de Contacto</label>
                                <input type="email" id="editEmail" class="form-control" value="${client.email || ''}" placeholder="Sin correo registrado">
                            </div>
                            <div class="form-group">
                                <label>🏠 Dirección de Entrega</label>
                                <textarea id="editAddress" class="form-control" rows="2" required style="resize: none;">${client.address}</textarea>
                                ${client.needsDelivery ? `
                                    <button type="button" id="showMapBtn" class="btn btn-outline" style="width: 100%; margin-top: 0.75rem; height: 35px; font-size: 0.75rem; border-style: dashed; font-weight: 700;">🗺️ EDITAR UBICACIÓN EN MAPA</button>
                                ` : ''}
                            </div>

                            <div class="form-group" style="background: var(--background); padding: 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--border); margin-top: 0.5rem;">
                                <label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0;">
                                    <span style="font-size: 0.75rem; font-weight: 800;">🚚 SERVICIO DE DELIVERY</span>
                                    <select id="editDelivery" class="form-control" style="width: 90px; height: 32px; padding: 0 0.5rem; font-size: 0.75rem; font-weight: 700;">
                                        <option value="NO" ${!client.needsDelivery ? 'selected' : ''}>NO</option>
                                        <option value="SI" ${client.needsDelivery ? 'selected' : ''}>SÍ</option>
                                    </select>
                                </label>
                                
                                <div id="editMapContainer" style="display: none; margin-top: 1.25rem;">
                                    <div id="detailMap" style="height: 200px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
                                    <p style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.5rem; text-align: center;">Mueve el mapa para ajustar la mira central</p>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                            <button type="button" class="btn btn-outline" id="cancelEditBtn" style="flex: 1; height: 45px;">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="saveEditBtn" style="flex: 1; height: 45px; font-weight: 700;">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
            <style>
                .detail-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.3rem; letter-spacing: 0.5px; }
                .form-group label { margin-bottom: 0.4rem; color: var(--text-muted); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .btn-action { display: flex; align-items: center; justify-content: center; height: 45px; border-radius: var(--radius-md); border: 1px solid var(--border); text-decoration: none; font-size: 0.85rem; font-weight: 700; transition: var(--transition); width: 100%; }
                .btn-action:hover { transform: translateY(-2px); filter: brightness(1.1); }
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
        const showMapBtn = container.querySelector('#showMapBtn');
        
        function initDetailMap() {
            if (!detailMap && window.L) {
                detailMap = L.map('detailMap', {
                    center: [selectedLat, selectedLng],
                    zoom: 17,
                    zoomControl: false
                });

                L.control.zoom({ position: 'bottomright' }).addTo(detailMap);

                L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                    maxZoom: 21,
                    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                    attribution: '&copy; Google Maps'
                }).addTo(detailMap);

                // Mira central fija
                const crosshair = document.createElement('div');
                crosshair.innerHTML = `
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); z-index: 1000; pointer-events: none; margin-top: -2px;">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#EA4335" stroke="#B31412" stroke-width="0.5"/>
                            <circle cx="12" cy="9" r="3" fill="white"/>
                        </svg>
                    </div>
                `;
                container.querySelector('#detailMap').appendChild(crosshair);

                detailMap.on('move', () => {
                    const center = detailMap.getCenter();
                    selectedLat = center.lat;
                    selectedLng = center.lng;
                });
            }
        }

        if (showMapBtn) {
            showMapBtn.addEventListener('click', () => {
                editMapContainer.style.display = 'block';
                showMapBtn.style.display = 'none';
                setTimeout(initDetailMap, 100);
            });
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
