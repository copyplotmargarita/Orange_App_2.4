import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { doc, setDoc, getDocs, getDoc, collection, query, orderBy, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderClients(container, onFinish = null, initialName = '') {
    let clients = [];
    let map = null;
    let marker = null;
    let selectedLat = 10.992; 
    let selectedLng = -63.805;
    let currentSearchQuery = '';

    async function loadClients() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando clientes...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;
        try {
            const q = query(collection(db, "businesses", businessId, "clients"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            clients.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
            renderList();
        } catch (error) {
            console.error("Error cargando clientes:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar los clientes. Asegúrate de que la base de datos Firestore esté configurada.</div>';
        }
    }

    function renderGrid() {
        const gridContainer = container.querySelector('#clientsGrid');
        if (!gridContainer) return;

        const filteredClients = clients.filter(c => 
            (c.fullName || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) || 
            (c.phone || '').includes(currentSearchQuery) || 
            (c.docNumber || '').includes(currentSearchQuery)
        );

        let html = '';
        if (filteredClients.length === 0) {
            html = `<p class="text-muted" style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">No se encontraron clientes.</p>`;
        } else {
            filteredClients.forEach(client => {
                html += `
                    <div class="card client-card" data-id="${client.id}" style="cursor: pointer; border-left: 4px solid var(--primary); padding: 1rem; position: relative;">
                        <button type="button" class="btn-delete-client" data-id="${client.id}" data-name="${client.fullName}" style="position: absolute; top: 0.5rem; right: 0.5rem; background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: var(--danger); padding: 0.2rem; transition: transform 0.2s;" title="Eliminar Cliente">🗑️</button>
                        <div style="margin-bottom: 0.75rem; padding-right: 1.5rem;">
                            <h3 class="card-title" style="margin-bottom: 0; font-size: 1.1rem; color: var(--primary);">${client.fullName}</h3>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <p class="text-sm font-bold">📞 ${client.phone || 'Sin teléfono'}</p>
                            <p class="text-muted text-xs" style="display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">📍 ${client.address}</p>
                        </div>
                    </div>
                `;
            });
        }
        gridContainer.innerHTML = html;

        gridContainer.querySelectorAll('.client-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-client')) return;
                const client = clients.find(c => c.id === card.dataset.id);
                if (client) renderDetail(client);
            });
        });

        gridContainer.querySelectorAll('.btn-delete-client').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const clientId = btn.dataset.id;
                const clientName = btn.dataset.name;
                showDeleteClientModal(clientId, clientName);
            });
            btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.2)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
        });
    }

    function showDeleteClientModal(clientId, clientName) {
        const modal = document.createElement('div');
        modal.style = "position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1.5rem;";
        
        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 400px; padding: 2rem; border-top: 4px solid var(--danger); text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="color: var(--danger); font-weight: 800; margin-bottom: 1rem;">¿Eliminar Cliente?</h3>
                <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 2rem;">¿Estás seguro de que deseas eliminar permanentemente a <strong style="color: var(--text-main);">${clientName}</strong>? Esta acción no se puede deshacer.</p>
                
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-outline" id="cancelDeleteClient" style="flex: 1;">Cancelar</button>
                    <button class="btn btn-primary" id="confirmDeleteClient" style="flex: 1; background: var(--danger); border-color: var(--danger);">Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#cancelDeleteClient').onclick = () => modal.remove();
        
        modal.querySelector('#confirmDeleteClient').onclick = async () => {
            const btn = modal.querySelector('#confirmDeleteClient');
            btn.disabled = true;
            btn.textContent = "Eliminando...";
            
            try {
                const businessId = localStorage.getItem('businessId');
                await deleteDoc(doc(db, "businesses", businessId, "clients", clientId));
                showNotification("Cliente eliminado exitosamente.", "success");
                modal.remove();
                await loadClients();
            } catch (error) {
                console.error("Error al eliminar:", error);
                showNotification("Error: No tienes permisos o hubo un fallo de red.", "error");
                btn.disabled = false;
                btn.textContent = "Eliminar";
            }
        };
    }

    function renderList() {
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">👥 Cartera de Clientes</h2>
                <div style="margin-left: auto; display: flex; gap: 1rem; align-items: center;" class="flex-stack-mobile">
                    <input type="text" id="searchClientInput" class="form-control" placeholder="🔍 Buscar cliente..." style="width: 250px; max-width: 100%; border-radius: 10px; height: 42px;" value="${currentSearchQuery}">
                    <button class="btn btn-outline" id="copyClientLinkBtn" style="width: 180px; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;" title="Copiar enlace para autoregistro">🔗 Enlace Público</button>
                    <button class="btn btn-primary" id="addClientBtn" style="width: 180px; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;">+ Crear Cliente</button>
                </div>
            </div>
            <div id="clientsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem;">
            </div>
        `;
        container.innerHTML = html;

        renderGrid();

        const searchInput = container.querySelector('#searchClientInput');
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderGrid();
        });

        container.querySelector('#addClientBtn').addEventListener('click', () => renderForm());
        
        container.querySelector('#copyClientLinkBtn').addEventListener('click', () => {
            const businessId = localStorage.getItem('businessId');
            const url = `${window.location.origin}${window.location.pathname}#public_register?type=client&bid=${businessId}`;
            navigator.clipboard.writeText(url).then(() => {
                showNotification("¡Enlace público copiado al portapapeles!");
            }).catch(err => {
                console.error("Error copiando enlace: ", err);
                prompt("Copia este enlace manualmente:", url);
            });
        });
        
        container.querySelector('#backToDashboardBtn').addEventListener('click', () => {
            const navHome = document.getElementById('navHome');
            if (navHome) {
                navHome.click();
                
                // Abrir la barra lateral si está cerrada

            } else {
                window.location.hash = '#dashboard';
            }
        });
        
        if (onFinish) {
            const backHeader = document.createElement('div');
            backHeader.style = 'margin-bottom: 1.5rem;';
            backHeader.innerHTML = `<button class="btn btn-outline" id="abortRedirectBtn" style="width: auto; height: 38px; font-size: 0.85rem; border-radius: var(--radius-full);">← Volver al Proceso Anterior</button>`;
            container.prepend(backHeader);
            container.querySelector('#abortRedirectBtn').onclick = () => onFinish(null);
        }
    }

    function renderForm() {
        const isRedirect = !!onFinish;
        selectedLat = 10.992;
        selectedLng = -63.805;
        map = null;
        marker = null;

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button type="button" class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">✨ Nuevo Cliente</h2>
            </div>
            
            <div class="card" style="max-width: 500px; margin: 0 auto; padding: 2rem; border-top: 4px solid var(--primary);">
                <form id="clientForm">
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>👤 Nombre Completo</label>
                            <input type="text" id="clientName" class="form-control" placeholder="Ej. Juan Pérez" required style="height: 40px;">
                        </div>
                        
                        <div class="form-group">
                            <label>🪪 Documento (Cédula o RIF)</label>
                            <div style="display: flex; gap: 0;">
                                <select id="docType" class="form-control" style="width: 80px; border-radius: var(--radius-md) 0 0 var(--radius-md); border-right: none; height: 40px;" required>
                                    <option value="V-" selected>V-</option>
                                    <option value="E-">E-</option>
                                    <option value="G-">G-</option>
                                    <option value="J-">J-</option>
                                </select>
                                <input type="text" id="docNumber" class="form-control" style="border-radius: 0 var(--radius-md) var(--radius-md) 0; height: 40px;" placeholder="12345678" required pattern="[0-9]+" title="Solo números">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>📧 Correo Electrónico</label>
                            <input type="email" id="clientEmail" class="form-control" placeholder="usuario@correo.com" style="height: 40px; text-transform: lowercase;" list="emailSuggestions">
                            <datalist id="emailSuggestions"></datalist>
                        </div>

                        <div class="form-group">
                            <label>📱 Teléfono Móvil</label>
                            <input type="tel" id="clientPhone" class="form-control" placeholder="4141234567" required style="height: 40px;">
                        </div>

                        <div class="form-group">
                            <label>📍 Dirección Residencial</label>
                            <input type="text" id="clientAddress" class="form-control" required placeholder="Ej. Av. Principal, Edif. Centro" style="height: 40px;">
                        </div>

                        <div class="form-group" style="background: var(--background); padding: 0.75rem 1rem; border-radius: var(--radius-lg); border: 1px solid var(--border);">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                                <label style="margin-bottom: 0; font-size: 0.75rem; font-weight: 800; flex: 1;">🚚 ¿REQUIERE DELIVERY?</label>
                                <select id="deliverySelect" class="form-control" style="width: 100px; height: 40px; padding: 0 0.75rem; font-size: 0.75rem; font-weight: 700;">
                                    <option value="NO">NO</option>
                                    <option value="SI">SÍ</option>
                                </select>
                            </div>
                            
                            <div id="mapContainerWrapper" style="display: none; margin-top: 1rem;">
                                <p class="text-xs text-muted mb-2">Selecciona la ubicación exacta en el mapa</p>
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <input type="text" id="mapSearchInput" class="form-control" placeholder="Buscar lugar (Ej. Pampatar)..." style="height: 35px; font-size: 0.8rem; border-radius: 6px;">
                                    <button type="button" class="btn btn-primary" id="mapSearchBtn" style="height: 35px; padding: 0 1rem; border-radius: 6px; font-size: 0.8rem; width: auto;">🔍</button>
                                </div>
                                <div id="mapSearchResults" style="display: none; max-height: 120px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.5rem; font-size: 0.8rem;"></div>
                                <div id="map" style="height: 250px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
                                <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.7rem; font-family: monospace; color: var(--text-muted);" id="coordsDisplay">${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}</span>
                                    <button type="button" class="btn btn-outline" id="fullscreenMapBtn" style="width: auto; height: 30px; padding: 0 0.75rem; font-size: 0.7rem;">Ampliar Mapa ⛶</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelFormBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                        <button type="submit" class="btn btn-primary" id="saveBtn" style="flex: 1; height: 50px; font-weight: 700;">CREAR CLIENTE</button>
                    </div>
                </form>
            </div>

            <!-- Modal Mapa Pantalla Completa -->
            <div id="fullMapModal" style="display: none; position: fixed; inset: 0; background: var(--background); z-index: 1000; flex-direction: column;">
                <div style="padding: 1rem; background: var(--surface); display: flex; flex-direction: column; gap: 0.5rem; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-weight: 800;">📍 Ubicación de Entrega</h3>
                        <button id="closeFullMapBtn" class="btn btn-primary" style="width: auto; height: 40px; padding: 0 1.5rem;">Confirmar y Cerrar</button>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="fullMapSearchInput" class="form-control" placeholder="Buscar lugar (Ej. Pampatar)..." style="height: 35px; font-size: 0.8rem; border-radius: 6px;">
                        <button type="button" class="btn btn-primary" id="fullMapSearchBtn" style="height: 35px; padding: 0 1rem; border-radius: 6px; font-size: 0.8rem; width: auto;">🔍</button>
                    </div>
                    <div id="fullMapSearchResults" style="display: none; max-height: 120px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 0.8rem; margin-bottom: 0;"></div>
                </div>
                <div id="fullMap" style="flex: 1;"></div>
            </div>
            <style>
                .iti { width: 100%; }
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
            const trimmed = initialName.trim();
            const digitsOnly = trimmed.replace(/[-.\s]/g, '');
            if (/^\d+$/.test(digitsOnly) && digitsOnly.length > 0) {
                container.querySelector('#docNumber').value = digitsOnly;
            } else {
                container.querySelector('#clientName').value = initialName;
            }
        }

        const clientEmailInput = container.querySelector('#clientEmail');
        const emailSuggestions = container.querySelector('#emailSuggestions');
        const popularDomains = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@outlook.com'];

        if (clientEmailInput && emailSuggestions) {
            clientEmailInput.addEventListener('input', function() {
                this.value = this.value.toLowerCase();
                const val = this.value;
                if (val.includes('@')) {
                    const [user, domainQuery] = val.split('@');
                    
                    // Si ya coincide exactamente con un dominio sugerido, limpiamos para evitar el bug del tooltip nativo (cuadro negro)
                    if (popularDomains.some(d => val === user + d)) {
                        emailSuggestions.innerHTML = '';
                        return;
                    }

                    emailSuggestions.innerHTML = popularDomains
                        .filter(d => d.includes(domainQuery))
                        .map(d => `<option value="${user}${d}">`)
                        .join('');
                } else {
                    emailSuggestions.innerHTML = '';
                }
            });
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
        
        const mapSearchBtn = container.querySelector('#mapSearchBtn');
        const mapSearchInput = container.querySelector('#mapSearchInput');
        const mapSearchResults = container.querySelector('#mapSearchResults');
        
        if (mapSearchBtn) {
            const performSearch = async () => {
                const q = mapSearchInput.value.trim();
                if (!q) return;
                mapSearchBtn.textContent = '...';
                try {
                    const ext = `${selectedLng-1},${selectedLat-1},${selectedLng+1},${selectedLat+1}`;
                    const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(q)}&outFields=Match_addr,Addr_type&maxLocations=5&location=${selectedLng},${selectedLat}&distance=50000&countryCode=VEN&searchExtent=${ext}`);
                    const data = await res.json();
                    mapSearchResults.innerHTML = '';
                    if (data && data.candidates && data.candidates.length > 0) {
                        data.candidates.forEach(item => {
                            const div = document.createElement('div');
                            div.style.padding = '0.5rem';
                            div.style.borderBottom = '1px solid var(--border)';
                            div.style.cursor = 'pointer';
                            div.textContent = item.address;
                            div.onclick = () => {
                                selectedLat = parseFloat(item.location.y);
                                selectedLng = parseFloat(item.location.x);
                                if (map) map.setView([selectedLat, selectedLng], 18);
                                mapSearchResults.style.display = 'none';
                                mapSearchInput.value = item.address.split(',')[0] || q;
                                const coordDisp = container.querySelector('#coordsDisplay');
                                if(coordDisp) coordDisp.textContent = `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;
                            };
                            mapSearchResults.appendChild(div);
                        });
                        mapSearchResults.style.display = 'block';
                    } else {
                        mapSearchResults.innerHTML = '<div style="padding: 0.5rem; color: var(--text-muted);">No se encontraron resultados</div>';
                        mapSearchResults.style.display = 'block';
                    }
                } catch (e) {
                    console.error('Error buscando', e);
                }
                mapSearchBtn.textContent = '🔍';
            };
            mapSearchBtn.addEventListener('click', performSearch);
            mapSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performSearch();
                }
            });
        }
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
                    L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                        maxZoom: 21,
                        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                        attribution: '&copy; Google Maps'
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

        const fullMapSearchBtn = container.querySelector('#fullMapSearchBtn');
        const fullMapSearchInput = container.querySelector('#fullMapSearchInput');
        const fullMapSearchResults = container.querySelector('#fullMapSearchResults');
        
        if (fullMapSearchBtn) {
            const performFullSearch = async () => {
                const q = fullMapSearchInput.value.trim();
                if (!q) return;
                fullMapSearchBtn.textContent = '...';
                try {
                    const ext = `${selectedLng-1},${selectedLat-1},${selectedLng+1},${selectedLat+1}`;
                    const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(q)}&outFields=Match_addr,Addr_type&maxLocations=5&location=${selectedLng},${selectedLat}&distance=50000&countryCode=VEN&searchExtent=${ext}`);
                    const data = await res.json();
                    fullMapSearchResults.innerHTML = '';
                    if (data && data.candidates && data.candidates.length > 0) {
                        data.candidates.forEach(item => {
                            const div = document.createElement('div');
                            div.style.padding = '0.5rem';
                            div.style.borderBottom = '1px solid var(--border)';
                            div.style.cursor = 'pointer';
                            div.textContent = item.address;
                            div.onclick = () => {
                                selectedLat = parseFloat(item.location.y);
                                selectedLng = parseFloat(item.location.x);
                                if (fullMap) fullMap.setView([selectedLat, selectedLng], 18);
                                if (fullMarker) fullMarker.setLatLng([selectedLat, selectedLng]);
                                if (map) map.setView([selectedLat, selectedLng], 18);
                                fullMapSearchResults.style.display = 'none';
                                fullMapSearchInput.value = item.address.split(',')[0] || q;
                                const coordDisp = container.querySelector('#coordsDisplay');
                                if(coordDisp) coordDisp.textContent = `${selectedLat.toFixed(6)}, ${selectedLng.toFixed(6)}`;
                            };
                            fullMapSearchResults.appendChild(div);
                        });
                        fullMapSearchResults.style.display = 'block';
                    } else {
                        fullMapSearchResults.innerHTML = '<div style="padding: 0.5rem; color: var(--text-muted);">No se encontraron resultados</div>';
                        fullMapSearchResults.style.display = 'block';
                    }
                } catch (e) {
                    console.error('Error buscando', e);
                }
                fullMapSearchBtn.textContent = '🔍';
            };
            fullMapSearchBtn.addEventListener('click', performFullSearch);
            fullMapSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performFullSearch();
                }
            });
        }

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
            
            const email = container.querySelector('#clientEmail').value.trim().toLowerCase();
            
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

    async function renderDetail(client) {
        const hasLocation = client.needsDelivery && client.location;
        let selectedLat = hasLocation ? client.location.lat : 10.992;
        let selectedLng = hasLocation ? client.location.lng : -63.805;
        let detailMap = null;
        let detailMarker = null;

        // Fetch sales
        const businessId = localStorage.getItem('businessId');
        let sales = [];
        try {
            const q = query(collection(db, "businesses", businessId, "sales"), where("clientId", "==", client.id));
            const snapshot = await getDocs(q);
            sales = snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error("Error fetching sales:", e);
        }

        const totalPurchases = sales.length;
        const totalSpent = sales.reduce((sum, s) => sum + (s.totalUSD || s.total || 0), 0);
        const avgPurchase = totalPurchases > 0 ? totalSpent / totalPurchases : 0;

        // Calculate top products
        const productCounts = {};
        sales.forEach(sale => {
            if (sale.items) {
                sale.items.forEach(item => {
                    const name = item.name || item.productName || 'Producto';
                    const qty = item.qty || 1;
                    if (!productCounts[name]) {
                        productCounts[name] = { name, qty: 0 };
                    }
                    productCounts[name].qty += qty;
                });
            }
        });
        const topProducts = Object.values(productCounts)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 4);

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                <button class="btn btn-outline" id="backDetailBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem; border-radius: var(--radius-full);">← Volver</button>
                <h2 style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px;">Ficha de Cliente</h2>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 500px; margin: 0 auto; width: 100%;">
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                        <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.1rem; color: var(--primary);">${client.fullName}</h3>
                        <p style="font-family: monospace; font-size: 0.8rem; color: var(--primary); font-weight: 700; margin-bottom: 1rem;">ID: ${client.id}</p>
                        
                        <div style="display: flex; justify-content: center; gap: 0.75rem;">
                            <a href="tel:${client.phone}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--primary); color: var(--primary); background: transparent;" title="Llamar">📞</a>
                            
                            <a target="_blank" href="https://wa.me/${client.phone.replace('+','')}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--primary); color: var(--primary); background: transparent;" title="WhatsApp">💬</a>
                            
                            ${client.email ? `
                                <a href="mailto:${client.email}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--primary); color: var(--primary); background: transparent;" title="Correo">📧</a>
                            ` : ''}
                            
                            ${client.location ? `
                                <a target="_blank" href="https://www.google.com/maps/search/?api=1&query=${client.location.lat},${client.location.lng}" class="btn btn-outline" style="height: 38px; width: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; border-color: var(--primary); color: var(--primary); background: transparent;" title="Ubicación">📍</a>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">📋 Datos de Facturación</h3>
                    <form id="editClientForm">
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <div class="form-group">
                                <label style="margin-bottom: 0.2rem; font-size: 0.65rem;">📱 Teléfono Principal</label>
                                <input type="tel" id="editPhone" class="form-control" value="${client.phone}" required style="height: 40px; font-size: 0.85rem;">
                            </div>
                            <div class="form-group">
                                <label style="margin-bottom: 0.2rem; font-size: 0.65rem;">📧 Correo de Contacto</label>
                                <input type="email" id="editEmail" class="form-control" value="${client.email || ''}" placeholder="Sin correo registrado" style="height: 40px; font-size: 0.85rem; text-transform: lowercase;" list="editEmailSuggestions">
                                <datalist id="editEmailSuggestions"></datalist>
                            </div>
                            <div class="form-group">
                                <label style="margin-bottom: 0.2rem; font-size: 0.65rem;">🏠 Dirección de Entrega</label>
                                <input type="text" id="editAddress" class="form-control" value="${client.address}" required style="height: 40px; font-size: 0.85rem; font-family: inherit;">
                                ${client.needsDelivery ? `
                                    <button type="button" id="showMapBtn" class="btn btn-outline" style="width: 100%; margin-top: 0.5rem; height: 30px; font-size: 0.7rem; border-style: dashed; font-weight: 700;">🗺️ EDITAR UBICACIÓN EN MAPA</button>
                                ` : ''}
                            </div>

                            <div class="form-group" style="background: var(--background); padding: 1rem; border-radius: var(--radius-lg); border: 1px solid var(--border); margin-top: 0.25rem;">
                                <label style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0;">
                                    <span style="font-size: 0.7rem; font-weight: 800;">🚚 SERVICIO DE DELIVERY</span>
                                    <select id="editDelivery" class="form-control" style="width: 80px; height: 30px; padding: 0 0.5rem; font-size: 0.7rem; font-weight: 700;">
                                        <option value="NO" ${!client.needsDelivery ? 'selected' : ''}>NO</option>
                                        <option value="SI" ${client.needsDelivery ? 'selected' : ''}>SÍ</option>
                                    </select>
                                </label>
                                
                                <div id="editMapContainer" style="display: none; margin-top: 1rem;">
                                    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                                        <input type="text" id="editMapSearchInput" class="form-control" placeholder="Buscar lugar..." style="height: 35px; font-size: 0.8rem; border-radius: 6px;">
                                        <button type="button" class="btn btn-primary" id="editMapSearchBtn" style="height: 35px; padding: 0 1rem; border-radius: 6px; font-size: 0.8rem; width: auto;">🔍</button>
                                    </div>
                                    <div id="editMapSearchResults" style="display: none; max-height: 120px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.5rem; font-size: 0.8rem;"></div>
                                    <div id="detailMap" style="height: 180px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
                                    <p style="font-size: 0.6rem; color: var(--text-muted); margin-top: 0.4rem; text-align: center;">Mueve el mapa para ajustar la mira central</p>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                <!-- Métricas de Compra -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">📊 Métricas de Compra</h3>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                        <div>
                            <p style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem;">Compras</p>
                            <p style="font-size: 1.2rem; font-weight: 800; color: var(--text-main);">${totalPurchases}</p>
                        </div>
                        <div>
                            <p style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem;">Promedio</p>
                            <p style="font-size: 1.2rem; font-weight: 800; color: var(--success);">$${avgPurchase.toFixed(2)}</p>
                        </div>
                        <div>
                            <p style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem;">Total Gastado</p>
                            <p style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">$${totalSpent.toFixed(2)}</p>
                        </div>
                    </div>

                    <!-- Productos más comprados -->
                    <div style="margin-top: 1.25rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                        <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px;">🛒 Productos más comprados</p>
                        <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                            ${topProducts.length === 0 ? `<p style="font-size: 0.7rem; color: var(--text-muted); text-align: center;">No hay productos registrados.</p>` : ''}
                            ${topProducts.map(p => `
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; background: var(--background); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm);">
                                    <span style="font-weight: 600; color: var(--text-main);">${p.name}</span>
                                    <span style="color: var(--primary); font-weight: 800;">x${p.qty}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <button class="btn btn-outline" id="viewHistoryBtn" style="width: 100%; height: 36px; font-size: 0.85rem; font-weight: 700;">📜 Ver Historial de Compras</button>
                    </div>

                    <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem;">
                        <button type="button" class="btn btn-outline" id="cancelEditBtn" style="flex: 1; height: 36px; font-size: 0.85rem;">Cancelar</button>
                        <button type="submit" form="editClientForm" class="btn btn-primary" id="saveEditBtn" style="flex: 1; height: 36px; font-size: 0.85rem; font-weight: 700;">Guardar Cambios</button>
                    </div>
                </div>
            </div>

            <!-- Modal Historial de Compras -->
            <div id="historyModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center;">
                <div class="card" style="width: 90%; max-width: 500px; padding: 1.5rem; max-height: 80vh; overflow-y: auto; background: var(--surface);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800;">📜 Historial de Compras</h3>
                        <button id="closeHistoryBtn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
                    </div>
                    <div id="historyList" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${sales.length === 0 ? `<p class="text-muted" style="text-align: center;">No hay compras registradas.</p>` : ''}
                        ${sales.map(s => `
                            <div style="background: var(--background); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border);">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <p style="font-size: 0.8rem; font-weight: 700; margin: 0;">${s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString() : 'Sin Fecha'}</p>
                                        <p style="font-size: 0.65rem; color: var(--text-muted); margin: 0;">🏪 ${s.storeName || 'Sucursal'} | 🕒 ${s.createdAt?.toDate ? s.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <p style="font-size: 0.9rem; font-weight: 800; color: var(--success); margin: 0;">$${(s.totalUSD || s.total || 0).toFixed(2)}</p>
                                        <p style="font-size: 0.7rem; color: var(--text-muted); margin: 0;">Bs. ${(s.totalBs || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <style>
                .detail-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.3rem; letter-spacing: 0.5px; }
                .form-group label { margin-bottom: 0.4rem; color: var(--text-muted); font-weight: 600; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; }
                .btn-action { display: flex; align-items: center; justify-content: center; height: 40px; border-radius: var(--radius-md); border: 1px solid var(--border); text-decoration: none; font-size: 0.85rem; font-weight: 700; transition: var(--transition); width: 100%; }
                .btn-action:hover { transform: translateY(-2px); filter: brightness(1.1); }
            </style>
        `;

        container.querySelector('#backDetailBtn').addEventListener('click', renderList);
        container.querySelector('#cancelEditBtn').addEventListener('click', renderList);

        // Modal History Events
        container.querySelector('#viewHistoryBtn').onclick = () => {
            container.querySelector('#historyModal').style.display = 'flex';
        };
        container.querySelector('#closeHistoryBtn').onclick = () => {
            container.querySelector('#historyModal').style.display = 'none';
        };
        container.querySelector('#historyModal').onclick = (e) => {
            if (e.target === container.querySelector('#historyModal')) {
                container.querySelector('#historyModal').style.display = 'none';
            }
        };

        // Inicializar Intl Tel Input para edición
        const editPhoneInput = container.querySelector('#editPhone');
        const itiEdit = window.intlTelInput(editPhoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
        });

        const editEmailInput = container.querySelector('#editEmail');
        const editEmailSuggestions = container.querySelector('#editEmailSuggestions');
        if (editEmailInput && editEmailSuggestions) {
            const popularDomainsEdit = ['@gmail.com', '@hotmail.com', '@yahoo.com', '@outlook.com'];
            editEmailInput.addEventListener('input', function() {
                this.value = this.value.toLowerCase();
                const val = this.value;
                if (val.includes('@')) {
                    const [user, domainQuery] = val.split('@');
                    
                    if (popularDomainsEdit.some(d => val === user + d)) {
                        editEmailSuggestions.innerHTML = '';
                        return;
                    }

                    editEmailSuggestions.innerHTML = popularDomainsEdit
                        .filter(d => d.includes(domainQuery))
                        .map(d => `<option value="${user}${d}">`)
                        .join('');
                } else {
                    editEmailSuggestions.innerHTML = '';
                }
            });
        }

        // Lógica de Mapa Edición
        const editDelivery = container.querySelector('#editDelivery');
        const editMapContainer = container.querySelector('#editMapContainer');
        const showMapBtn = container.querySelector('#showMapBtn');
        
        const editMapSearchBtn = container.querySelector('#editMapSearchBtn');
        const editMapSearchInput = container.querySelector('#editMapSearchInput');
        const editMapSearchResults = container.querySelector('#editMapSearchResults');
        
        if (editMapSearchBtn) {
            const performEditSearch = async () => {
                const q = editMapSearchInput.value.trim();
                if (!q) return;
                editMapSearchBtn.textContent = '...';
                try {
                    const vb = `${selectedLng-0.5},${selectedLat+0.5},${selectedLng+0.5},${selectedLat-0.5}`;
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ve&viewbox=${vb}&bounded=0&limit=5`);
                    const data = await res.json();
                    editMapSearchResults.innerHTML = '';
                    if (data && data.length > 0) {
                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.style.padding = '0.5rem';
                            div.style.borderBottom = '1px solid var(--border)';
                            div.style.cursor = 'pointer';
                            div.textContent = item.display_name;
                            div.onclick = () => {
                                selectedLat = parseFloat(item.lat);
                                selectedLng = parseFloat(item.lon);
                                if (detailMap) detailMap.setView([selectedLat, selectedLng], 18);
                                editMapSearchResults.style.display = 'none';
                                editMapSearchInput.value = item.name || q;
                            };
                            editMapSearchResults.appendChild(div);
                        });
                        editMapSearchResults.style.display = 'block';
                    } else {
                        editMapSearchResults.innerHTML = '<div style="padding: 0.5rem; color: var(--text-muted);">No se encontraron resultados</div>';
                        editMapSearchResults.style.display = 'block';
                    }
                } catch (e) {
                    console.error('Error buscando', e);
                }
                editMapSearchBtn.textContent = '🔍';
            };
            editMapSearchBtn.addEventListener('click', performEditSearch);
            editMapSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performEditSearch();
                }
            });
        }
        
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
            const email = container.querySelector('#editEmail').value.trim().toLowerCase();
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
                    updateData.location = null;
                }

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
