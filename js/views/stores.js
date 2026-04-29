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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2>Tiendas / Sucursales</h2>
                <button class="btn btn-primary" id="addStoreBtn" style="width: auto;">+ Agregar Tienda</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem;">
        `;
        
        if (stores.length === 0) {
            html += `<p class="text-muted" style="grid-column: 1 / -1;">No hay tiendas registradas aún.</p>`;
        } else {
            stores.forEach(store => {
                html += `
                    <div class="card store-card" data-id="${store.id}" style="cursor: pointer; border-left: 4px solid var(--success);">
                        <h3 class="card-title" title="${store.name}">${store.name}</h3>
                        <p class="card-label">Dirección</p>
                        <p class="text-muted text-sm" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${store.address}</p>
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
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
        });
    }

    function renderForm() {
        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h2>Agregar Nueva Tienda</h2>
                <p class="text-muted">Registra una nueva sucursal de tu negocio</p>
            </div>
            <div class="card" style="max-width: 500px;">
                <form id="storeForm">
                    <div class="form-group mb-4">
                        <label>Nombre de la Sucursal</label>
                        <input type="text" id="storeName" class="form-control" placeholder="Ej. Sede Principal" required>
                    </div>
                    <div class="form-group mb-4">
                        <label>Dirección de la Sucursal</label>
                        <input type="text" id="storeAddress" class="form-control" placeholder="Calle, Avenida, Local..." required>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelBtn">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveBtn">Crear Tienda</button>
                    </div>
                </form>
            </div>
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
                showNotification("Error al guardar la tienda. Revisa la consola.");
                btn.disabled = false;
                btn.textContent = 'Crear Tienda';
            }
        });
    }

    function renderDetail(store) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem;">← Atrás</button>
                <h2>Detalles de la Tienda</h2>
            </div>
            <div class="card" style="max-width: 600px;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
                    <div style="width: 48px; height: 48px; background-color: var(--primary); color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
                        ${store.name.charAt(0).toUpperCase()}
                    </div>
                    <h3 style="font-size: 1.5rem;">${store.name}</h3>
                </div>
                
                <div style="display: grid; gap: 1.5rem;">
                    <div>
                        <p class="text-sm text-muted mb-1">Dirección Completa</p>
                        <p style="font-weight: 500; font-size: 1.1rem;">${store.address}</p>
                    </div>
                    <div>
                        <p class="text-sm text-muted mb-1">Fecha de Creación</p>
                        <p style="font-weight: 500;">${new Date(store.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#backBtn').addEventListener('click', renderList);
    }

    // Iniciar carga al montar la vista
    loadStores();
}
