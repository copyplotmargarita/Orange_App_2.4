import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderStores(container) {
    let stores = [];

    async function loadStores() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando tiendas...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;
        try {
            const q = query(collection(db, "businesses", businessId, "stores"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderList();
        } catch (error) {
            console.error("Error cargando tiendas:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar las tiendas. Asegúrate de que la base de datos Firestore esté configurada.</div>';
        }
    }

    function renderList() {
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px;">🏪 Tiendas y Sucursales</h2>
                    <p class="text-muted text-sm">Gestiona los puntos de venta de tu negocio</p>
                </div>
                <button class="btn btn-primary" id="addStoreBtn" style="width: auto; height: 42px; padding: 0 1.25rem; font-weight: 700; border-radius: var(--radius-full);">+ Nueva Tienda</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
        `;
        
        if (stores.length === 0) {
            html += `<p class="text-muted" style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">No hay tiendas registradas aún.</p>`;
        } else {
            stores.forEach(store => {
                html += `
                    <div class="card store-card" data-id="${store.id}" style="cursor: pointer; border-left: 4px solid var(--success); padding: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); color: var(--success); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">📍</div>
                            <h3 class="card-title" style="margin-bottom: 0; font-size: 1.15rem;">${store.name}</h3>
                        </div>
                        <p class="card-label">Dirección</p>
                        <p class="text-muted text-sm" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${store.address}</p>
                    </div>
                `;
            });
        }
        html += `</div>`;
        container.innerHTML = html;

        container.querySelector('#addStoreBtn').addEventListener('click', renderForm);
        
        container.querySelectorAll('.store-card').forEach(card => {
            card.addEventListener('click', () => {
                const store = stores.find(s => s.id === card.dataset.id);
                if(store) renderDetail(store);
            });
        });
    }

    function renderForm() {
        container.innerHTML = `
            <div style="margin-bottom: 2rem; text-align: center;">
                <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px;">✨ Nueva Sucursal</h2>
                <p class="text-muted text-sm">Registra un nuevo punto de venta para tu negocio</p>
            </div>
            
            <div class="card" style="max-width: 500px; margin: 0 auto; padding: 2.5rem; border-top: 4px solid var(--primary);">
                <form id="storeForm">
                    <div style="display: grid; gap: 1rem;">
                        <div class="form-group">
                            <label>🏪 Nombre de la Sucursal</label>
                            <input type="text" id="storeName" class="form-control" placeholder="Ej. Sede Principal o Tienda Norte" required>
                        </div>
                        <div class="form-group">
                            <label>📍 Dirección Completa</label>
                            <textarea id="storeAddress" class="form-control" placeholder="Calle, Avenida, Centro Comercial, Local..." required style="min-height: 100px; resize: none;"></textarea>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelBtn" style="flex: 1; height: 45px;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveBtn" style="flex: 2; height: 45px; font-weight: 700;">Registrar Tienda</button>
                    </div>
                </form>
            </div>
            <style>
                .form-group label { margin-bottom: 0.4rem; color: var(--text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; }
            </style>
        `;

        container.querySelector('#cancelBtn').addEventListener('click', renderList);
        container.querySelector('#storeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#saveBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const name = toTitleCase(container.querySelector('#storeName').value);
            const address = toTitleCase(container.querySelector('#storeAddress').value);
            const businessId = localStorage.getItem('businessId');

            try {
                await addDoc(collection(db, "businesses", businessId, "stores"), {
                    name, 
                    address, 
                    createdAt: new Date().toISOString()
                });
                await loadStores();
            } catch (error) {
                console.error("Error adding store: ", error);
                showNotification("Error al guardar la tienda.");
                btn.disabled = false;
                btn.textContent = 'Registrar Tienda';
            }
        });
    }

    function renderDetail(store) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem; border-radius: var(--radius-full);">← Volver</button>
                <h2 style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px;">Ficha de Sucursal</h2>
            </div>

            <div class="card" style="max-width: 550px; margin: 0 auto; padding: 2.5rem; border-top: 4px solid var(--success);">
                <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border);">
                    <div style="width: 64px; height: 64px; border-radius: 16px; background: rgba(16, 185, 129, 0.1); color: var(--success); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold;">
                        🏪
                    </div>
                    <div>
                        <h3 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 0.2rem;">${store.name}</h3>
                        <p style="color: var(--success); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Sucursal Activa</p>
                    </div>
                </div>
                
                <div style="display: grid; gap: 1.5rem;">
                    <div>
                        <p class="detail-label">📍 Dirección de la Tienda</p>
                        <p class="detail-value" style="font-size: 1.1rem; line-height: 1.5;">${store.address}</p>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div>
                            <p class="detail-label">📅 Registrada el</p>
                            <p class="detail-value">${new Date(store.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div style="text-align: right;">
                            <p class="detail-label">🆔 ID Sucursal</p>
                            <p class="detail-value" style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${store.id.substring(0, 8)}...</p>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .detail-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.4rem; letter-spacing: 0.5px; }
                .detail-value { font-size: 1rem; font-weight: 600; color: var(--text-main); }
            </style>
        `;

        container.querySelector('#backBtn').addEventListener('click', renderList);
    }

    // Iniciar carga al montar la vista
    loadStores();
}
