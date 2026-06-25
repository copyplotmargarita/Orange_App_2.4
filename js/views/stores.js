import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderStores(container) {
    let stores = [];
    let currentSearchQuery = '';

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

    function renderGrid() {
        const gridContainer = container.querySelector('#storesGrid');
        if (!gridContainer) return;

        const filteredStores = stores.filter(s => 
            (s.name || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) || 
            (s.address || '').toLowerCase().includes(currentSearchQuery.toLowerCase())
        );

        let html = '';
        if (filteredStores.length === 0) {
            html = `<p class="text-muted" style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg); border: 2px dashed var(--border);">No hay tiendas registradas aún o no coinciden con la búsqueda.</p>`;
        } else {
            filteredStores.forEach(store => {
                html += `
                    <div class="card store-card" data-id="${store.id}" style="cursor: pointer; padding: 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); transition: transform 0.2s; border-left: 4px solid var(--success);">
                        <h3 style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--success); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${store.name}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${store.address}</p>
                    </div>
                `;
            });
        }
        gridContainer.innerHTML = html;
        
        gridContainer.querySelectorAll('.store-card').forEach(card => {
            card.addEventListener('click', () => {
                const store = stores.find(s => s.id === card.dataset.id);
                if(store) renderDetail(store);
            });
        });
    }

    function renderList() {
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--success); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">🏪 Tiendas y Sucursales</h2>
                <div style="margin-left: auto; display: flex; gap: 1rem; align-items: center;" class="flex-stack-mobile">
                    <input type="text" id="searchStoreInput" class="form-control" placeholder="🔍 Buscar tienda..." style="width: 250px; max-width: 100%; border-radius: 10px; height: 42px;" value="${currentSearchQuery}">
                    <button class="btn btn-primary" id="addStoreBtn" style="width: 180px; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">+ Nueva Tienda</button>
                </div>
            </div>
            <div id="storesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem;">
            </div>
        `;
        container.innerHTML = html;

        renderGrid();

        const searchInput = container.querySelector('#searchStoreInput');
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            renderGrid();
        });

        container.querySelector('#addStoreBtn').addEventListener('click', renderForm);
        
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
                <h2 style="color: var(--success); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">✨ Nueva Sucursal</h2>
            </div>
            
            <div class="card" style="max-width: 500px; margin: 0 auto; padding: 2rem; border-top: 4px solid var(--success);">
                <form id="storeForm">
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>🏪 Nombre de la Sucursal</label>
                            <input type="text" id="storeName" class="form-control" placeholder="Ej. Sede Principal o Tienda Norte" required style="height: 40px;">
                        </div>
                        <div class="form-group">
                            <label>📍 Dirección Completa</label>
                            <input type="text" id="storeAddress" class="form-control" placeholder="Calle, Avenida, Centro Comercial, Local..." required style="height: 40px;">
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                            <button type="button" class="btn btn-outline" id="cancelBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                            <button type="submit" class="btn btn-primary" id="saveBtn" style="flex: 1; height: 50px; font-weight: 800; background: var(--success); border-color: var(--success);">REGISTRAR</button>
                        </div>
                    </div>
                </form>
            </div>
            <style>
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

        container.querySelector('#cancelBtn').addEventListener('click', renderList);
        container.querySelector('#backHeaderBtn')?.addEventListener('click', () => container.querySelector('#cancelBtn').click());
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
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem; border-radius: var(--radius-full);">← Volver</button>
                <h2 style="color: var(--success); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">🏪 Ficha de Sucursal</h2>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 500px; margin: 0 auto; width: 100%;">
                <!-- Bloque de Identificación -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--success); width: 100%;">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                        <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 0.1rem; color: var(--success);">${store.name}</h3>
                        <p style="font-family: monospace; font-size: 0.8rem; color: var(--success); font-weight: 700; margin-bottom: 1rem;">ID: ${store.id}</p>
                    </div>
                </div>

                <!-- Sección de Datos (Formulario Compacto) -->
                <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--success); width: 100%;">
                    <h3 style="font-size: 0.9rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">📋 Datos de la Sucursal</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div class="form-group">
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">Dirección de la Tienda</label>
                            <input type="text" value="${store.address}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit;" readonly>
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.2rem; letter-spacing: 0.5px;">Registrada el</label>
                            <input type="text" value="${new Date(store.createdAt).toLocaleDateString()}" class="form-control" style="height: 40px; font-size: 0.85rem; font-family: inherit;" readonly>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#backBtn').addEventListener('click', renderList);
    }

    // Iniciar carga al montar la vista
    loadStores();
}
