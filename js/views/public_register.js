import { db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { doc, getDoc, setDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderPublicRegister() {
    const container = document.getElementById('app');
    
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const type = urlParams.get('type');
    const businessId = urlParams.get('bid');

    if (!businessId || (type !== 'client' && type !== 'supplier')) {
        container.innerHTML = `
            <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--background);">
                <div class="card" style="padding: 2rem; text-align: center; max-width: 400px;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h2 class="text-danger">Enlace Inválido</h2>
                    <p class="text-muted">El enlace proporcionado no es válido o está incompleto.</p>
                </div>
            </div>`;
        return container;
    }

    const isClient = type === 'client';
    const title = isClient ? '✨ Registro de Cliente' : '🏭 Registro de Proveedor';
    const color = isClient ? 'var(--primary)' : 'var(--warning)';

    let selectedLat = 10.9878; // Default Margarita
    let selectedLng = -63.8562;
    let needsDelivery = false;
    let map = null;
    let crosshair = null;

    // Construcción del formulario
    let formHtml = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--background); padding: 1rem;">
            <div class="card" style="max-width: 500px; width: 100%; padding: 2rem; border-top: 4px solid ${color};">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <h2 style="color: ${color}; font-weight: 800; margin-bottom: 0.5rem;">${title}</h2>
                    <p class="text-muted" style="font-size: 0.9rem;">Por favor completa los siguientes datos para registrarte en el sistema.</p>
                </div>

                <form id="publicRegisterForm">
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        
                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">👤 Nombre / Razón Social <span class="text-danger">*</span></label>
                            <input type="text" id="regName" class="form-control" placeholder="Ej. Juan Pérez / Distribuidora XYZ" required style="height: 45px; font-size: 1rem;">
                        </div>

                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">🪪 Documento (Cédula o RIF) <span class="text-danger">*</span></label>
                            <div style="display: flex; gap: 0;">
                                <select id="regDocType" class="form-control" style="width: 80px; border-radius: 10px 0 0 10px; border-right: none; height: 45px;" required>
                                    <option value="V-" selected>V-</option>
                                    <option value="E-">E-</option>
                                    <option value="J-">J-</option>
                                    <option value="G-">G-</option>
                                </select>
                                <input type="text" id="regDocNumber" class="form-control" style="border-radius: 0 10px 10px 0; height: 45px; font-size: 1rem;" placeholder="12345678" required pattern="[0-9]+" title="Solo números">
                            </div>
                        </div>

                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">📧 Correo Electrónico</label>
                            <input type="email" id="regEmail" class="form-control" placeholder="usuario@correo.com" style="height: 45px; font-size: 1rem; text-transform: lowercase;">
                        </div>

                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">📱 Teléfono Móvil <span class="text-danger">*</span></label>
                            <input type="tel" id="regPhone" class="form-control" placeholder="Ej. 4241234567" required style="height: 45px; font-size: 1rem;">
                        </div>

                        ${isClient ? `
                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">📍 Dirección Residencial <span class="text-danger">*</span></label>
                            <input type="text" id="regAddress" class="form-control" placeholder="Av. Principal, Edif. Centro" required style="height: 45px; font-size: 1rem;">
                        </div>

                        <div class="form-group" style="background: var(--surface); padding: 1rem; border-radius: 12px; border: 1px solid var(--border);">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                                <label style="margin-bottom: 0; font-size: 0.8rem; font-weight: 800; color: var(--text-muted);">🚚 ¿REQUIERES DELIVERY?</label>
                                <select id="regDeliverySelect" class="form-control" style="width: 100px; height: 40px; font-weight: 700;">
                                    <option value="NO">NO</option>
                                    <option value="SI">SÍ</option>
                                </select>
                            </div>
                            
                            <div id="mapContainerWrapper" style="display: none; margin-top: 1rem;">
                                <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 0.5rem;">Por favor, ajusta tu ubicación exacta en el mapa para el repartidor.</p>
                                <div id="map" style="height: 250px; border-radius: 8px; border: 1px solid var(--border); z-index: 1;"></div>
                                <div style="margin-top: 0.75rem; text-align: center;">
                                    <button type="button" class="btn btn-outline" id="gpsBtn" style="font-size: 0.8rem; padding: 0.5rem 1rem;">📍 Usar mi ubicación actual (GPS)</button>
                                </div>
                            </div>
                        </div>
                        ` : `
                        <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-top: 1rem; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">👤 Contacto de Ventas</h3>
                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Nombre del Vendedor</label>
                            <input type="text" id="regSellerName" class="form-control" placeholder="Ej. Carlos Silva" style="height: 45px; font-size: 1rem;">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Teléfono del Vendedor</label>
                            <input type="tel" id="regSellerPhone" class="form-control" placeholder="Ej. 4141234567" style="height: 45px; font-size: 1rem;">
                        </div>
                        `}

                        <button type="submit" class="btn btn-primary" id="submitRegBtn" style="height: 50px; font-weight: 800; font-size: 1.1rem; margin-top: 1rem; background-color: ${color}; border-color: ${color}; width: 100%;">ENVIAR DATOS</button>
                    </div>
                </form>
            </div>
            
            <style>
                .iti { width: 100%; display: block; }
                .form-control { 
                    border-radius: 10px; 
                    border: 1px solid var(--border); 
                    padding: 0 1rem; 
                    transition: var(--transition); 
                    background: var(--surface); 
                    color: var(--text-main); 
                    font-family: 'Inter', sans-serif;
                    box-sizing: border-box;
                    width: 100%;
                }
                .form-control:focus { border-color: ${color}; box-shadow: 0 0 0 4px ${isClient ? 'rgba(249, 115, 22, 0.1)' : 'rgba(245, 158, 11, 0.1)'}; outline: none; }
                .btn { border-radius: 12px; transition: all 0.3s ease; border: 1px solid transparent; cursor: pointer; color: white; }
                .btn:hover { filter: brightness(1.1); transform: translateY(-2px); }
            </style>
        </div>
    `;

    container.innerHTML = formHtml;

    // Inicializar inputs telefónicos
    const phoneInput = container.querySelector('#regPhone');
    let itiPhone = null;
    if (phoneInput && window.intlTelInput) {
        itiPhone = window.intlTelInput(phoneInput, {
            initialCountry: "ve",
            preferredCountries: ["ve", "co", "pa", "es", "us"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
            separateDialCode: true
        });
    }

    let itiSellerPhone = null;
    if (!isClient) {
        const sellerPhoneInput = container.querySelector('#regSellerPhone');
        if (sellerPhoneInput && window.intlTelInput) {
            itiSellerPhone = window.intlTelInput(sellerPhoneInput, {
                initialCountry: "ve",
                preferredCountries: ["ve", "co", "pa", "es", "us"],
                utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
                separateDialCode: true
            });
        }
    }

    if (isClient) {
        const deliverySelect = container.querySelector('#regDeliverySelect');
        const mapWrapper = container.querySelector('#mapContainerWrapper');
        const gpsBtn = container.querySelector('#gpsBtn');

        deliverySelect.addEventListener('change', (e) => {
            needsDelivery = e.target.value === 'SI';
            if (needsDelivery) {
                mapWrapper.style.display = 'block';
                if (!map && window.L) {
                    setTimeout(() => {
                        map = L.map('map', { zoomControl: false }).setView([selectedLat, selectedLng], 15);
                        L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                            maxZoom: 20,
                            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
                        }).addTo(map);

                        crosshair = document.createElement('div');
                        crosshair.innerHTML = '📍';
                        crosshair.style.position = 'absolute';
                        crosshair.style.top = '50%';
                        crosshair.style.left = '50%';
                        crosshair.style.transform = 'translate(-50%, -100%)';
                        crosshair.style.fontSize = '2rem';
                        crosshair.style.zIndex = '1000';
                        crosshair.style.pointerEvents = 'none';
                        container.querySelector('#map').appendChild(crosshair);

                        map.on('move', () => {
                            const center = map.getCenter();
                            selectedLat = center.lat;
                            selectedLng = center.lng;
                        });

                        // Intentar geolocalizar de inmediato
                        gpsBtn.click();
                    }, 100);
                }
            } else {
                mapWrapper.style.display = 'none';
            }
        });

        gpsBtn.addEventListener('click', () => {
            // En móviles, el GPS requiere HTTPS o Localhost.
            if (window.isSecureContext === false) {
                showNotification("El GPS requiere una conexión segura (HTTPS) para funcionar en tu celular.", "error");
                return;
            }

            if (navigator.geolocation) {
                gpsBtn.textContent = 'Buscando ubicación...';
                navigator.geolocation.getCurrentPosition((position) => {
                    selectedLat = position.coords.latitude;
                    selectedLng = position.coords.longitude;
                    if (map) {
                        map.setView([selectedLat, selectedLng], 18);
                    }
                    gpsBtn.textContent = '📍 Usar mi ubicación actual (GPS)';
                }, (err) => {
                    console.warn("GPS Error", err);
                    let errorMsg = "No pudimos obtener tu ubicación.";
                    if (err.code === 1) errorMsg = "Permiso denegado. Activa el GPS de tu navegador.";
                    else if (err.code === 2) errorMsg = "Ubicación no disponible por el momento.";
                    else if (err.code === 3) errorMsg = "Se agotó el tiempo de espera. Intenta de nuevo.";
                    
                    showNotification(errorMsg + " Por favor mueve el mapa manualmente.", "error");
                    gpsBtn.textContent = '📍 Usar mi ubicación actual (GPS)';
                }, {
                    enableHighAccuracy: true, 
                    timeout: 10000, 
                    maximumAge: 0
                });
            } else {
                showNotification("Geolocalización no soportada o bloqueada por tu navegador.", "error");
            }
        });
    }

    container.querySelector('#publicRegisterForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = container.querySelector('#submitRegBtn');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const rawName = container.querySelector('#regName').value.trim();
            const name = toTitleCase(rawName);
            const docType = container.querySelector('#regDocType').value;
            const docNum = container.querySelector('#regDocNumber').value.trim();
            const documentId = `${docType}${docNum}`;
            const email = container.querySelector('#regEmail').value.trim().toLowerCase();
            
            const fullPhone = itiPhone ? itiPhone.getNumber() : phoneInput.value;

            const colName = isClient ? "clients" : "suppliers";
            const docRef = doc(db, "businesses", businessId, colName, documentId);
            const docSnap = await getDoc(docRef);

            let dataToSave = {};

            if (isClient) {
                const address = toTitleCase(container.querySelector('#regAddress').value.trim());
                dataToSave = {
                    fullName: name,
                    email: email,
                    phone: fullPhone,
                    address: address,
                    needsDelivery: needsDelivery
                };
                if (needsDelivery) {
                    dataToSave.location = { lat: selectedLat, lng: selectedLng };
                }
            } else {
                const sellerName = toTitleCase(container.querySelector('#regSellerName').value.trim());
                const sellerPhone = itiSellerPhone ? itiSellerPhone.getNumber() : container.querySelector('#regSellerPhone').value.trim();
                dataToSave = {
                    supplierName: name,
                    email: email,
                    phone: fullPhone,
                    sellerName: sellerName,
                    sellerPhone: sellerPhone
                };
            }

            const exists = docSnap.exists();
            if (!exists) {
                dataToSave.createdAt = new Date().toISOString();
            }

            // Guardar datos (Upsert)
            await setDoc(docRef, dataToSave, { merge: true });

            // Enviar notificación silenciosa al sistema
            try {
                await addDoc(collection(db, "businesses", businessId, "system_notifications"), {
                    title: isClient ? "Nuevo Cliente Registrado" : "Nuevo Proveedor Registrado",
                    message: `${name} se acaba de registrar como ${isClient ? 'cliente' : 'proveedor'} (Documento: ${documentId}).`,
                    read: false,
                    createdAt: new Date().toISOString()
                });
            } catch (notifErr) {
                console.warn("No se pudo enviar la notificación", notifErr);
            }

            // Mostrar éxito
            container.innerHTML = `
                <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--background);">
                    <div class="card" style="padding: 3rem; text-align: center; max-width: 500px; border-top: 4px solid var(--success);">
                        <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
                        <h2 class="text-success" style="margin-bottom: 1rem; color: #22c55e;">¡Registro Exitoso!</h2>
                        <p class="text-muted" style="font-size: 1.1rem;">Tus datos han sido guardados correctamente en el sistema de la empresa.</p>
                        <p class="text-muted" style="margin-top: 2rem; font-size: 0.85rem;">Ya puedes cerrar esta ventana.</p>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("Error en registro público:", error);
            btn.disabled = false;
            btn.textContent = 'INTENTAR DE NUEVO';
            showNotification("Ocurrió un error al enviar los datos: " + error.message, "error");
        }
    });

    return container;
}
