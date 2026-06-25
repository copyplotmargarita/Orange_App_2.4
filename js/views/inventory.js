import { auth, db } from '../services/firebase.js';
import { collection, getDocs, query, orderBy, doc, updateDoc, addDoc, setDoc, serverTimestamp, getDoc, where } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderInventory(container) {
    let products = [];
    let movements = [];
    let batches = [];
    let stores = [];
    let storeTransfers = [];
    let activeTab = 'general';
    let currentAdjProduct = null;
    let selectedStoreId = '';
    let storeStocks = {}; // productId -> qty
    let currentSearchQuery = '';
    const businessId = localStorage.getItem('businessId');
    const userRole = localStorage.getItem('userRole'); // 'admin' or 'employee'
    const fmt = (n) => parseFloat(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function getRecipeUnitInfo(stockUnit) {
        if (stockUnit === 'Kilo')      return { recipeUnit: 'Gramo',      factor: 1000 };
        if (stockUnit === 'Litro')     return { recipeUnit: 'Mililitro',  factor: 1000 };
        if (stockUnit === 'Gramo')     return { recipeUnit: 'Gramo',      factor: 1    };
        if (stockUnit === 'Mililitro') return { recipeUnit: 'Mililitro',  factor: 1    };
        return                             { recipeUnit: 'Unidad',     factor: 1    };
    }

    function getFactorForProduct(insumo) {
        if (!insumo) return 1;
        if (insumo.stockToRecipeFactor !== undefined) return parseFloat(insumo.stockToRecipeFactor) || 1;
        
        const stockUnit = insumo.stockUnit || 'Unidad';
        const isBasic = ['Unidad', 'Kilo', 'Litro', 'Gramo', 'Mililitro'].includes(insumo.purchaseUnit);
        if (stockUnit === 'Unidad' && !isBasic) {
            const info = getRecipeUnitInfo(insumo.unitContentUnit || 'Unidad');
            return (parseFloat(insumo.unitContentQty) || 1) * info.factor;
        } else {
            return getRecipeUnitInfo(stockUnit).factor;
        }
    }

    async function loadData() {
        if (!businessId) {
            container.innerHTML = '<div style="padding:2rem;text-align:center;">Error: No se encontró ID de negocio.</div>';
            return;
        }
        container.innerHTML = '<div style="padding:2rem;text-align:center;">Cargando inventario...</div>';
        try {
            const qProd = query(collection(db, "businesses", businessId, "products"));
            const snap = await getDocs(qProd);
            products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            const qMov = query(collection(db, "businesses", businessId, "inventoryMovements"));
            const snapMov = await getDocs(qMov);
            movements = snapMov.docs.map(d => ({ id: d.id, ...d.data() }));
            movements.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            const qBat = query(collection(db, "businesses", businessId, "productionBatches"));
            const snapBat = await getDocs(qBat);
            batches = snapBat.docs.map(d => ({ id: d.id, ...d.data() }));
            batches.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            const qSt = query(collection(db, "businesses", businessId, "storeTransfers"));
            const snapSt = await getDocs(qSt);
            storeTransfers = snapSt.docs.map(d => ({ id: d.id, ...d.data() }));
            storeTransfers.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            const qStores = query(collection(db, "businesses", businessId, "stores"));
            const snapStores = await getDocs(qStores);
            stores = snapStores.docs.map(d => ({ id: d.id, ...d.data() }));
            stores.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            renderShell();
        } catch (err) {
            console.error(err);
            container.innerHTML = '<div class="text-danger" style="padding:2rem;">Error al cargar el inventario. Revisa la consola.</div>';
        }
    }

    function renderShell() {
        container.innerHTML = `
            <div id="inventoryTopSticky" style="position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                    <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                    <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">📦 Inventarios</h2>
                    <div style="margin-left: auto; display: flex; align-items: center;" class="flex-stack-mobile">
                        <input type="text" id="searchInventoryInput" class="form-control" placeholder="🔍 Buscar producto..." style="width: 250px; max-width: 100%; border-radius: 10px; height: 42px;" value="${currentSearchQuery}">
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
                    <button class="tab-btn btn ${activeTab==='general'?'btn-primary':'btn-outline'}" data-tab="general" style="width:auto;">Almacén General</button>
                    <button class="tab-btn btn ${activeTab==='produccion'?'btn-primary':'btn-outline'}" data-tab="produccion" style="width:auto;">Almacén Producción</button>
                    
                    <button class="tab-btn btn ${activeTab==='transferir'?'btn-primary':'btn-outline'}" data-tab="transferir" style="width:auto;">→ Transferir a Producción</button>
                    
                    <button class="tab-btn btn ${activeTab==='cargar'?'btn-primary':'btn-outline'}" data-tab="cargar" style="width:auto;">⚙️ Cargar Producción</button>
                    <button class="tab-btn btn ${activeTab==='tiendas'?'btn-primary':'btn-outline'}" data-tab="tiendas" style="width:auto;">🚚 Mover a Tiendas</button>
                    
                    ${userRole === 'admin' ? `
                        <select id="storeSelector" class="btn btn-outline" style="width:auto; cursor:pointer; color:${activeTab==='store'?'var(--primary)':'var(--text-main)'}; border-color:${activeTab==='store'?'var(--primary)':'var(--border)'};">
                            <option value="">🏪 Seleccionar Tienda...</option>
                            ${stores.map(s => `<option value="${s.id}" ${selectedStoreId===s.id?'selected':''}>Tienda: ${s.name}</option>`).join('')}
                        </select>
                    ` : ''}

                    <button class="tab-btn btn ${activeTab==='historial'?'btn-primary':'btn-outline'}" data-tab="historial" style="width:auto;">Historial</button>
                </div>
            </div>
            <div id="tabContent" style="margin-top: 1.5rem;"></div>
            <style>
                /* Ocultar flechitas en todos los inputs numéricos de este módulo */
                input[type=number]::-webkit-inner-spin-button,
                input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            </style>

            <!-- Modal Ajuste Manual -->
            <div id="adjustmentModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(4px);z-index:2000;align-items:center;justify-content:center;padding:1rem;">
                <div class="card" style="width:100%;max-width:450px;border-top:4px solid #f59e0b;padding:1.5rem;">
                    <h3 style="margin-bottom:1rem;">✏️ Ajustar Inventario Manual</h3>
                    <p id="adjProductName" style="font-weight:bold;color:var(--primary);margin-bottom:1rem;"></p>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem;">
                        <div class="form-group">
                            <label>STOCK ACTUAL</label>
                            <input type="text" id="adjCurrentStock" class="form-control" readonly style="background:var(--background);">
                        </div>
                        <div class="form-group">
                            <label>NUEVO STOCK</label>
                            <input type="number" step="0.01" id="adjNewStock" class="form-control" placeholder="0.00" style="border-color:#f59e0b;font-weight:bold;">
                        </div>
                    </div>

                    <div class="form-group mb-4">
                        <label>MOTIVO DEL AJUSTE</label>
                        <select id="adjReason" class="form-control">
                            <option value="Inventario Físico">📝 Inventario Físico (Conteo)</option>
                            <option value="Merma / Dañado">🗑️ Merma / Producto Dañado</option>
                            <option value="Donación">🎁 Donación / Muestra</option>
                            <option value="Error de Carga">❌ Error de Carga Previo</option>
                            <option value="Otro">❓ Otro</option>
                        </select>
                    </div>

                    <div style="display:flex;gap:1rem;justify-content:flex-end;">
                        <button class="btn btn-outline" id="adjCancelBtn" style="width:auto;">Cancelar</button>
                        <button class="btn btn-primary" id="adjConfirmBtn" style="width:auto;background:#f59e0b;border-color:#f59e0b;">Guardar Ajuste</button>
                    </div>
                </div>
            </div>
        `;

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

        container.querySelector('#storeSelector')?.addEventListener('change', async (e) => {
            const storeId = e.target.value;
            if (storeId) {
                selectedStoreId = storeId;
                activeTab = 'store';
                await loadStoreData(storeId);
                renderShell();
            } else {
                activeTab = 'general';
                renderShell();
            }
        });

        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                currentSearchQuery = '';
                renderShell();
            });
        });

        const searchInput = container.querySelector('#searchInventoryInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchQuery = e.target.value;
                const tabContent = container.querySelector('#tabContent');
                if (activeTab === 'general') renderGeneral(tabContent);
                else if (activeTab === 'produccion') renderProduccion(tabContent);
                else if (activeTab === 'store') renderStoreInventory(tabContent, selectedStoreId);
                
                setTimeout(() => {
                    const topSticky = container.querySelector('#inventoryTopSticky');
                    if (topSticky) {
                        const h = topSticky.offsetHeight - 12;
                        container.querySelectorAll('.sticky-th').forEach(th => th.style.top = h + 'px');
                    }
                }, 50);
            });
        }

        container.querySelector('#adjCancelBtn').addEventListener('click', () => {
            container.querySelector('#adjustmentModal').style.display = 'none';
        });
        container.querySelector('#adjConfirmBtn').addEventListener('click', confirmAdjustment);

        const tabContent = container.querySelector('#tabContent');
        if (activeTab === 'general') renderGeneral(tabContent);
        else if (activeTab === 'produccion') renderProduccion(tabContent);
        else if (activeTab === 'cargar') renderCargar(tabContent);
        else if (activeTab === 'tiendas') renderMovimientoTiendas(tabContent);
        else if (activeTab === 'store') renderStoreInventory(tabContent, selectedStoreId);
        else if (activeTab === 'transferir') renderTransferir(tabContent);
        else renderHistorial(tabContent);

        const topSticky = container.querySelector('#inventoryTopSticky');
        if (topSticky) {
            const updateSticky = () => {
                const h = topSticky.offsetHeight - 12;
                container.querySelectorAll('.sticky-th').forEach(th => {
                    th.style.top = h + 'px';
                });
            };
            const ro = new ResizeObserver(updateSticky);
            ro.observe(topSticky);
            setTimeout(updateSticky, 50);
        }
    }

    async function loadStoreData(storeId) {
        try {
            const q = query(collection(db, "businesses", businessId, "stores", storeId, "inventory"));
            const snap = await getDocs(q);
            storeStocks = {};
            snap.forEach(doc => { storeStocks[doc.id] = doc.data().qty || 0; });
        } catch (err) {
            console.error("Error loading store data:", err);
            showToast("Error al cargar inventario de la tienda.", "error");
        }
    }

    // ─── TAB TIENDA ESPECÍFICA (Admin Only) ───────────────────────────
    function renderStoreInventory(el, storeId) {
        const store = stores.find(s => s.id === storeId);
        const physicals = products.filter(p => p.category !== 'SERVICIOS' && ((p.name || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) || (p.barcode || '').includes(currentSearchQuery)));
        let rows = physicals.map(p => {
            const stock = storeStocks[p.id] || 0;
            const minStock = p.minStock || 0;
            const unit = p.stockUnit || 'ud';
            const isNeg = stock < 0;
            const isLow = stock <= minStock && stock > 0;
            const rowBg = isLow ? 'rgba(245, 158, 11, 0.05)' : '';

            return `<tr style="background:${rowBg}; border-bottom: 1px solid var(--border);">
                <td style="padding:0.6rem;">${p.name} ${isLow ? '⚠️' : ''}</td>
                <td style="padding:0.6rem; text-align: center;"><span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:12px;background:var(--border);color:var(--text-muted);">${p.category}</span></td>
                <td style="padding:0.6rem; text-align: center; font-weight:bold; color:${isNeg?'var(--danger)':isLow?'#f59e0b':stock===0?'var(--text-muted)':'var(--success)'};">${fmt(stock)}</td>
                <td style="padding:0.6rem; text-align: center; color:var(--text-muted); font-size:0.85rem;">${unit}</td>
                <td style="padding:0.6rem; text-align: right;">
                    <button class="btn btn-outline adjust-stock-btn" data-id="${p.id}" data-is-store="true" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; width: auto;">✏️ Ajustar</button>
                </td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h4 style="margin:0;color:var(--primary);">🏪 Inventario: ${store?.name || 'Tienda'}</h4>
                <p class="text-muted" style="margin:0;">${physicals.length} productos</p>
            </div>
            <div class="card" style="padding:0;overflow:visible;border-radius:12px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead><tr>
                        <th class="sticky-th" style="padding:0.75rem; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-left-radius: 12px;">Producto</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Categoría</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Stock Tienda</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Unidad</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: right; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-right-radius: 12px;">Acciones</th>
                    </tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="padding:1rem;text-align:center;color:var(--text-muted);">Sin productos registrados</td></tr>'}</tbody>
                </table>
            </div>`;

        el.querySelectorAll('.adjust-stock-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prod = products.find(p => p.id === btn.dataset.id);
                if (prod) {
                    const storeStock = storeStocks[prod.id] || 0;
                    openAdjustmentModal({ ...prod, isStore: true, currentStoreStock: storeStock, storeId });
                }
            });
        });
    }

    // ─── TAB 1: ALMACÉN GENERAL ────────────────────────────────────────
    function renderGeneral(el) {
        const physicals = products.filter(p => p.category !== 'SERVICIOS' && ((p.name || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) || (p.barcode || '').includes(currentSearchQuery)));
        let rows = physicals.map(p => {
            const stock = p.stockGeneral ?? p.stock ?? 0;
            const minStock = p.minStock || 0;
            const unit = p.stockUnit || 'ud';
            const isNeg = stock < 0;
            const isLow = stock <= minStock && stock > 0;
            const rowBg = isLow ? 'rgba(245, 158, 11, 0.05)' : '';

            return `<tr style="background:${rowBg}; border-bottom: 1px solid var(--border);">
                <td style="padding:0.6rem;">${p.name} ${isLow ? '⚠️' : ''}</td>
                <td style="padding:0.6rem; text-align: center;"><span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:12px;background:var(--border);color:var(--text-muted);">${p.category}</span></td>
                <td style="padding:0.6rem; text-align: center; font-weight:bold; color:${isNeg?'var(--danger)':isLow?'#f59e0b':stock===0?'var(--text-muted)':'var(--success)'};">${fmt(stock)}</td>
                <td style="padding:0.6rem; text-align: center; color:var(--text-muted); font-size:0.85rem;">${unit}</td>
                <td style="padding:0.6rem; text-align: right;">
                    <button class="btn btn-outline adjust-stock-btn" data-id="${p.id}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; width: auto;">✏️ Ajustar</button>
                </td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <p class="text-muted" style="margin:0;">${physicals.length} productos</p>
            </div>
            <div class="card" style="padding:0;overflow:visible;border-radius:12px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead><tr>
                        <th class="sticky-th" style="padding:0.75rem; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-left-radius: 12px;">Producto</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Categoría</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Stock General</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Unidad</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: right; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-right-radius: 12px;">Acciones</th>
                    </tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="padding:1rem;text-align:center;color:var(--text-muted);">Sin productos registrados</td></tr>'}</tbody>
                </table>
            </div>`;

        el.querySelectorAll('.adjust-stock-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prod = products.find(p => p.id === btn.dataset.id);
                if (prod) openAdjustmentModal(prod);
            });
        });
    }

    // ─── TAB 2: ALMACÉN PRODUCCIÓN ─────────────────────────────────────
    function renderProduccion(el) {
        const insumos = products.filter(p => (p.category === 'INSUMO' || (p.category && p.category !== 'SERVICIOS' && p.category !== 'RECETA')) && ((p.name || '').toLowerCase().includes(currentSearchQuery.toLowerCase()) || (p.barcode || '').includes(currentSearchQuery)));
        let rows = insumos.map(p => {
            const stock = p.stockProduccion ?? 0;
            const unit = p.recipeUnit || p.stockUnit || 'ud';
            const isNeg = stock < 0;
            return `<tr>
                <td style="padding:0.6rem;">${p.name}</td>
                <td style="padding:0.6rem; text-align: center;"><span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:12px;background:var(--border);color:var(--text-muted);">${p.category}</span></td>
                <td style="padding:0.6rem; text-align: center; font-weight:bold; color:${isNeg?'var(--danger)':stock===0?'var(--text-muted)':'var(--success)'};">${fmt(stock)}</td>
                <td style="padding:0.6rem; text-align: center; color:var(--text-muted); font-size:0.85rem;">${unit}</td>
                <td style="padding:0.6rem; text-align: right;">
                    <button class="btn btn-outline adjust-stock-btn" data-id="${p.id}" data-is-production="true" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; width: auto;">✏️ Ajustar</button>
                </td>
            </tr>`;
        }).join('');

        el.innerHTML = `
            <div style="margin-bottom:1rem;padding:0.75rem 1rem;background:rgba(251,146,60,0.1);border-radius:8px;border:1px solid rgba(251,146,60,0.3);">
                <p style="margin:0;font-size:0.85rem;color:#f97316;">💡 Este almacén se alimenta desde las transferencias del Almacén General. El stock negativo indica que se usó más de lo transferido.</p>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <p class="text-muted" style="margin:0;">${insumos.length} insumos</p>
            </div>
            <div class="card" style="padding:0;overflow:visible;border-radius:12px;">
                <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead><tr>
                        <th class="sticky-th" style="padding:0.75rem; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-left-radius: 12px;">Producto</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Categoría</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Stock Producción</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Unidad</th>
                        <th class="sticky-th" style="padding:0.75rem; text-align: right; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-right-radius: 12px;">Acciones</th>
                    </tr></thead>
                    <tbody>${rows || '<tr><td colspan="5" style="padding:1rem;text-align:center;color:var(--text-muted);">Sin insumos registrados</td></tr>'}</tbody>
                </table>
            </div>`;

        el.querySelectorAll('.adjust-stock-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prod = products.find(p => p.id === btn.dataset.id);
                if (prod) openAdjustmentModal({ ...prod, isProduction: true });
            });
        });
    }

    // ─── TAB 3: CARGAR PRODUCCIÓN (múltiples recetas) ─────────────────────────
    function renderCargar(el) {
        const recetas = products.filter(p => p.category === 'RECETA');
        let productionList = []; // [{ recipe, qty }]

        if (recetas.length === 0) {
            el.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><p class="text-muted">No hay productos con categoría RECETA registrados aún.</p></div>`;
            return;
        }

        function renderUI() {
            // Calcular consumo consolidado de insumos
            const consumoMap = {}; // productId -> { name, unit, total, stockActual, stockAfter }
            let hasNegative = false;

            productionList.forEach(({ recipe, qty }) => {
                const yieldVal = recipe.yield || 1;
                (recipe.recipeIngredients || []).forEach(ing => {
                    const total = (ing.qty / yieldVal) * qty;
                    if (!consumoMap[ing.productId]) {
                        const insumo = products.find(p => p.id === ing.productId);
                        const factor = getFactorForProduct(insumo);
                        const stockG = insumo ? (parseFloat(insumo.stockGeneral ?? insumo.stock ?? 0)) : 0;
                        consumoMap[ing.productId] = {
                            name: ing.name, unit: ing.unit,
                            total: 0, stockActual: stockG * factor // Convertido a unidad de receta
                        };
                    }
                    consumoMap[ing.productId].total += total;
                });
            });

            Object.values(consumoMap).forEach(c => {
                c.total = Math.ceil(c.total); // Redondear a entero superior
                c.stockAfter = c.stockActual - c.total;
                if (c.stockAfter < 0) hasNegative = true;
            });

            const consumoRows = Object.entries(consumoMap).map(([, c]) => {
                const col = c.stockAfter < 0 ? 'var(--danger)' : 'var(--success)';
                return `<tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:0.5rem;">${c.name}</td>
                    <td style="padding:0.5rem;text-align:right;">${c.total.toLocaleString('de-DE')}</td>
                    <td style="padding:0.5rem;text-align:right;color:var(--text-muted);">${c.stockActual.toLocaleString('de-DE', {maximumFractionDigits: 2})}</td>
                    <td style="padding:0.5rem;text-align:right;font-weight:bold;color:${col};">${c.stockAfter.toLocaleString('de-DE')}</td>
                    <td style="padding:0.5rem;text-align:center;color:var(--text-muted);font-size:0.8rem;">${c.unit}</td>
                </tr>`;
            }).join('');

            el.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;" class="grid-1-mobile">

                <!-- Panel Izquierdo: Agregar recetas -->
                <div>
                    <div class="card" style="padding:1.5rem;margin-bottom:1rem;">
                        <h4 style="margin-bottom:1rem;">Agregar Receta Producida</h4>
                        <div class="form-group mb-3">
                            <label>Producto (RECETA) <span class="text-danger">*</span></label>
                            <select id="recipeSelect" class="form-control">
                                <option value="">Seleccione...</option>
                                ${recetas.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group mb-4">
                            <label>Cantidad Producida <span class="text-danger">*</span></label>
                            <input type="number" id="qtyProduced" class="form-control"
                                placeholder="Ej. 20" inputmode="numeric" style="-moz-appearance:textfield;">
                        </div>
                        <button class="btn btn-primary" id="addToListBtn" style="width:100%;">➕ Agregar a la Lista</button>
                    </div>

                    <!-- Lista de lote actual -->
                    <div class="card" style="padding:1.5rem;">
                        <h4 style="margin-bottom:0.75rem;">Lote de Producción</h4>
                        ${productionList.length === 0
                            ? `<p class="text-muted" style="text-align:center;padding:1rem 0;">Agrega al menos una receta para comenzar.</p>`
                            : `<table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:1rem;">
                                <thead><tr style="border-bottom:2px solid var(--border);">
                                    <th style="padding:0.4rem;">Receta</th>
                                    <th style="padding:0.4rem;text-align:right;">Cant.</th>
                                    <th style="padding:0.4rem;"></th>
                                </tr></thead>
                                <tbody>
                                    ${productionList.map((item, i) => `
                                    <tr style="border-bottom:1px solid var(--border);">
                                        <td style="padding:0.4rem;font-weight:500;">${item.recipe.name}</td>
                                        <td style="padding:0.4rem;text-align:right;font-weight:bold;color:var(--primary);">${item.qty} ud.</td>
                                        <td style="padding:0.4rem;text-align:right;">
                                            <button class="btn btn-outline remove-item-btn" data-index="${i}"
                                                style="padding:0.15rem 0.5rem;font-size:0.75rem;border-color:var(--danger);color:var(--danger);width:auto;">✕</button>
                                        </td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                            <button class="btn btn-primary" id="processAllBtn"
                                style="width:100%;background:var(--success);border-color:var(--success);font-size:1rem;padding:0.75rem;">
                                ⚙️ Cargar y Procesar Todo
                            </button>`
                        }
                    </div>
                </div>

                <!-- Panel Derecho: Vista previa de consumo -->
                <div class="card" style="padding:1.5rem;">
                    <h4 style="margin-bottom:0.75rem;">Vista Previa de Consumo</h4>
                    ${consumoRows
                        ? `${hasNegative ? `<div style="padding:0.6rem 0.75rem;background:rgba(249,115,22,0.12);border-radius:6px;border:1px solid rgba(249,115,22,0.3);margin-bottom:0.75rem;">
                                <p style="margin:0;font-size:0.83rem;color:#f97316;">⚠️ Algunos insumos quedarán en stock negativo. Puedes continuar.</p>
                            </div>` : ''}
                            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                                <thead><tr style="border-bottom:2px solid var(--border);background:var(--surface);">
                                    <th style="padding:0.4rem;">Insumo</th>
                                    <th style="padding:0.4rem;text-align:right;">Consumo</th>
                                    <th style="padding:0.4rem;text-align:right;">Stock Actual</th>
                                    <th style="padding:0.4rem;text-align:right;">Después</th>
                                    <th style="padding:0.4rem;">Ud.</th>
                                </tr></thead>
                                <tbody>${consumoRows}</tbody>
                            </table>`
                        : `<p class="text-muted" style="text-align:center;padding:2rem 0;">El consumo de insumos aparecerá aquí cuando agregues recetas.</p>`
                    }
                </div>
            </div>`;

            // Events
            el.querySelector('#addToListBtn')?.addEventListener('click', () => {
                const sel = el.querySelector('#recipeSelect');
                const qty = parseFloat(el.querySelector('#qtyProduced').value);
                const recipe = recetas.find(r => r.id === sel.value);
                if (!recipe) { showToast('Selecciona una receta.', 'error'); return; }
                if (!qty || qty <= 0) { showToast('Ingresa una cantidad válida.', 'error'); return; }
                // Si ya está en la lista, suma la cantidad
                const existing = productionList.find(i => i.recipe.id === recipe.id);
                if (existing) { existing.qty += qty; } else { productionList.push({ recipe, qty }); }
                renderUI();
            });

            el.querySelectorAll('.remove-item-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    productionList.splice(parseInt(btn.dataset.index), 1);
                    renderUI();
                });
            });

            el.querySelector('#processAllBtn')?.addEventListener('click', () => processAllProduction(productionList, hasNegative));
        }

        renderUI();
    }

    // ─── TAB 4: MOVIMIENTO A TIENDAS (carrito) ─────────────────────────
    function renderMovimientoTiendas(el) {
        const eligible = products.filter(p => p.category !== 'SERVICIOS');
        let sendList = []; // [{ productId, productName, qty, stockUnit, priceDetal, priceMayor, priceSpecial, category }]
        let storeId   = '';
        let storeName = '';

        function renderUI() {
            const recent = storeTransfers.slice(0, 6);

            el.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;" class="grid-1-mobile">

                <!-- Panel Izquierdo: Formulario de envío -->
                <div>
                    <div class="card" style="padding:1.5rem;margin-bottom:1rem;">
                        <h4 style="margin-bottom:1rem;">Configurar Envío</h4>

                        <div class="form-group mb-3">
                            <label>Tienda Destino <span class="text-danger">*</span></label>
                            <select id="storeDestSelect" class="form-control">
                                <option value="">Seleccione una tienda...</option>
                                ${stores.map(s => `<option value="${s.id}" data-name="${s.name}" ${s.id===storeId?'selected':''}>${s.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group mb-3">
                            <label>Producto <span class="text-danger">*</span></label>
                            <select id="productDestSelect" class="form-control">
                                <option value="">Seleccione un producto...</option>
                                ${eligible.map(p => {
                                    const avail = p.stockGeneral ?? p.stock ?? 0;
                                    return `<option value="${p.id}"
                                        data-name="${p.name}" data-unit="${p.stockUnit||'ud'}"
                                        data-avail="${avail}"
                                        data-detal="${p.priceDetal||0}" data-mayor="${p.priceMayor||0}"
                                        data-special="${p.priceSpecial||0}" data-cat="${p.category}">
                                        ${p.name} (Disp: ${fmt(avail)} ${p.stockUnit||'ud'})
                                    </option>`;
                                }).join('')}
                            </select>
                        </div>

                        <div class="form-group mb-4">
                            <label>Cantidad a Enviar <span class="text-danger">*</span></label>
                            <input type="number" id="qtyToSend" class="form-control"
                                placeholder="Ej. 20" inputmode="numeric">
                        </div>

                        <button class="btn btn-primary" id="addToSendListBtn" style="width:100%;">➕ Agregar al Envío</button>
                    </div>

                    <!-- Lista del envío actual -->
                    <div class="card" style="padding:1.5rem;">
                        <h4 style="margin-bottom:0.75rem;">📦 Lote de Envío
                            ${storeId ? `<span style="font-size:0.8rem;font-weight:400;color:var(--primary);"> → 🏪 ${storeName}</span>` : ''}
                        </h4>
                        ${sendList.length === 0
                            ? `<p class="text-muted" style="text-align:center;padding:1rem 0;">Agrega productos al envío para comenzar.</p>`
                            : `<table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:1rem;">
                                <thead><tr style="border-bottom:2px solid var(--border);">
                                    <th style="padding:0.4rem;">Producto</th>
                                    <th style="padding:0.4rem;text-align:right;">Cant.</th>
                                    <th style="padding:0.4rem;text-align:center;">Ud.</th>
                                    <th style="padding:0.4rem;"></th>
                                </tr></thead>
                                <tbody>
                                    ${sendList.map((item, i) => `
                                    <tr style="border-bottom:1px solid var(--border);">
                                        <td style="padding:0.4rem;font-weight:500;">${item.productName}</td>
                                        <td style="padding:0.4rem;text-align:right;font-weight:bold;color:var(--primary);">${item.qty}</td>
                                        <td style="padding:0.4rem;text-align:center;color:var(--text-muted);font-size:0.82rem;">${item.stockUnit}</td>
                                        <td style="padding:0.4rem;text-align:right;">
                                            <button class="btn btn-outline remove-send-btn" data-index="${i}"
                                                style="padding:0.15rem 0.5rem;font-size:0.75rem;border-color:var(--danger);color:var(--danger);width:auto;">✕</button>
                                        </td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                            <button class="btn btn-primary" id="confirmSendBtn"
                                style="width:100%;background:var(--success);border-color:var(--success);font-size:1rem;padding:0.75rem;">
                                🚚 Confirmar Envío a Tienda
                            </button>`
                        }
                    </div>
                </div>

                <!-- Panel Derecho: Historial reciente -->
                <div class="card" style="padding:1.5rem;">
                    <h4 style="margin-bottom:0.75rem;">Últimos Envíos</h4>
                    ${recent.length === 0
                        ? `<p class="text-muted" style="text-align:center;padding:2rem 0;">No hay envíos registrados aún.</p>`
                        : `<div style="display:flex;flex-direction:column;gap:0.6rem;">
                            ${recent.map(t => {
                                const isPending = t.status === 'PENDIENTE';
                                const color = isPending ? '#f97316' : 'var(--success)';
                                const badge = isPending
                                    ? `<span style="font-size:0.72rem;padding:0.15rem 0.5rem;border-radius:10px;background:rgba(249,115,22,0.15);color:#f97316;font-weight:bold;">⏳ PENDIENTE</span>`
                                    : `<span style="font-size:0.72rem;padding:0.15rem 0.5rem;border-radius:10px;background:rgba(34,197,94,0.15);color:var(--success);font-weight:bold;">✅ RECIBIDO</span>`;
                                const summary = (t.items||[]).map(i => `${i.qty} ${i.stockUnit} de ${i.productName}`).join(' · ');
                                return `<div class="card" style="padding:0.75rem;border-left:4px solid ${color};">
                                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                                        <span style="font-weight:bold;font-size:0.9rem;">🏪 ${t.storeName||'—'}</span>
                                        <div style="display:flex;gap:0.4rem;align-items:center;">${badge}<span style="font-size:0.75rem;color:var(--text-muted);">${t.date||'—'}</span></div>
                                    </div>
                                    <p style="margin:0.2rem 0 0;font-size:0.78rem;color:var(--text-muted);">${summary}</p>
                                </div>`;
                            }).join('')}
                        </div>`
                    }
                </div>
            </div>`;

            // Events
            el.querySelector('#storeDestSelect').addEventListener('change', (e) => {
                const opt = e.target.options[e.target.selectedIndex];
                storeId   = e.target.value;
                storeName = opt.dataset.name || '';
                renderUI();
            });

            el.querySelector('#addToSendListBtn').addEventListener('click', () => {
                const prodSel = el.querySelector('#productDestSelect');
                const qty     = parseFloat(el.querySelector('#qtyToSend').value);
                if (!storeId)            { showToast('Selecciona una tienda destino.', 'error'); return; }
                if (!prodSel.value)      { showToast('Selecciona un producto.', 'error'); return; }
                if (!qty || qty <= 0)    { showToast('Ingresa una cantidad válida.', 'error'); return; }

                const opt = prodSel.options[prodSel.selectedIndex];
                const existing = sendList.find(i => i.productId === prodSel.value);
                if (existing) {
                    existing.qty += qty;
                } else {
                    sendList.push({
                        productId:   prodSel.value,
                        productName: opt.dataset.name,
                        qty,
                        stockUnit:   opt.dataset.unit,
                        priceDetal:  parseFloat(opt.dataset.detal)   || 0,
                        priceMayor:  parseFloat(opt.dataset.mayor)   || 0,
                        priceSpecial: parseFloat(opt.dataset.special) || 0,
                        category:    opt.dataset.cat
                    });
                }
                renderUI();
            });

            el.querySelectorAll('.remove-send-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    sendList.splice(parseInt(btn.dataset.index), 1);
                    renderUI();
                });
            });

            el.querySelector('#confirmSendBtn')?.addEventListener('click', () => doConfirmStoreTransfer(storeId, storeName, sendList));
        }

        renderUI();
    }

    async function doConfirmStoreTransfer(storeId, storeName, items) {
        if (!storeId)          { showToast('Selecciona una tienda destino.', 'error'); return; }
        if (items.length === 0){ showToast('Agrega al menos un producto al envío.', 'error'); return; }

        const btn = document.querySelector('#confirmSendBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

        try {
            const today = new Date().toISOString().split('T')[0];

            for (const item of items) {
                const prodRef = doc(db, "businesses", businessId, "products", item.productId);
                const snap = await getDoc(prodRef);
                if (snap.exists()) {
                    const d = snap.data();
                    await updateDoc(prodRef, { stockGeneral: (d.stockGeneral ?? d.stock ?? 0) - item.qty });
                }
            }

            await addDoc(collection(db, "businesses", businessId, "storeTransfers"), {
                type: 'STORE_TRANSFER', status: 'PENDIENTE',
                date: today, storeId, storeName,
                createdBy: auth.currentUser?.email || 'admin',
                businessId, items,
                receivedBy: null, receivedAt: null,
                createdAt: serverTimestamp()
            });

            showToast(`✅ Envío a ${storeName} registrado. El empleado verá la notificación.`, 'success');
            activeTab = 'tiendas';
            await loadData();
        } catch (err) {
            console.error(err);
            showToast('Error al registrar el envío.', 'error');
            if (btn) { btn.disabled = false; btn.textContent = '🚚 Confirmar Envío a Tienda'; }
        }
    }

    function renderHistorial(el) {
        // Filtrar duplicados y consolidar movimientos
        const uniqueAll = [];
        const ids = new Set();
        [...movements, ...batches, ...storeTransfers].forEach(m => {
            if (!ids.has(m.id)) {
                let type = 'TRANSFER';
                if (m.type === 'PRODUCTION_LOAD') type = 'PRODUCTION';
                if (m.type === 'STORE_TRANSFER') type = 'STORE';
                if (m.type === 'MANUAL_ADJUSTMENT') type = 'ADJUST';
                uniqueAll.push({ ...m, _type: type });
                ids.add(m.id);
            }
        });
        uniqueAll.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        if (uniqueAll.length === 0) {
            el.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><p class="text-muted">No hay movimientos registrados aún.</p></div>`;
            return;
        }

        const colorMap = { TRANSFER: 'var(--primary)', PRODUCTION: '#f97316', STORE: 'var(--success)', ADJUST: '#f59e0b' };
        const iconMap  = { TRANSFER: '→', PRODUCTION: '⚙️', STORE: '🚚', ADJUST: '✏️' };

        el.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.75rem;">
            ${uniqueAll.map(m => {
                const color = colorMap[m._type];
                const icon  = iconMap[m._type];
                let title, detail;
                if (m._type === 'TRANSFER') {
                    title  = 'Transferencia → Producción';
                    detail = (m.items||[]).map(i => `${i.qty} ${i.stockUnit} de ${i.productName}`).join(', ');
                } else if (m._type === 'PRODUCTION') {
                    title  = `Producción: ${m.recipeName}`;
                    detail = `${m.qtyProduced} ud. producidas${m.hadStockWarning ? ' ⚠️' : ''}`;
                } else if (m._type === 'ADJUST') {
                    const loc = m.storeName ? ` (${m.storeName})` : '';
                    title  = `Ajuste Manual: ${m.productName}${loc}`;
                    detail = `Cambio: ${m.adjustment > 0 ? '+' : ''}${fmt(m.adjustment)} ${m.unit}. Motivo: ${m.reason}`;
                } else {
                    const st = m.status === 'RECIBIDO' ? '✅ RECIBIDO' : '⏳ PENDIENTE';
                    title  = `Envío → ${m.storeName} (${st})`;
                    detail = (m.items||[]).map(i => `${i.qty} ${i.stockUnit} de ${i.productName}`).join(', ');
                }
                return `<div class="card" style="padding:1rem;border-left:4px solid ${color};">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:bold;color:${color};">${icon} ${title}</span>
                        <span style="font-size:0.8rem;color:var(--text-muted);">${m.date||'—'}</span>
                    </div>
                    <p style="margin:0.25rem 0 0;font-size:0.85rem;color:var(--text-muted);">${detail}</p>
                </div>`;
            }).join('')}
        </div>`;
    }

    // ─── MODAL: TRANSFERENCIA (Único modal restante para Almacén General) ─
    function renderTransferir(el) {
        const insumos = products.filter(p =>
            p.category === 'INSUMO' ||
            (p.category && p.category !== 'SERVICIOS' && p.category !== 'RECETA')
        );

        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h4 style="margin:0;color:var(--primary);">Transferir al Almacén de Producción</h4>
                <p class="text-muted" style="margin:0;">${insumos.length} insumos disponibles</p>
            </div>
            <div class="card" style="padding:0;overflow:hidden;margin-bottom:1rem;">
                <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                    <thead><tr style="background:var(--surface);border-bottom:2px solid var(--border);">
                        <th style="padding:0.75rem;">Producto</th>
                        <th style="padding:0.75rem;text-align:center;">Disp. General</th>
                        <th style="padding:0.75rem;text-align:center;">Disp. Producción</th>
                        <th style="padding:0.75rem;text-align:center;">Cant. a Transferir</th>
                        <th style="padding:0.75rem;text-align:center;">Ud.</th>
                    </tr></thead>
                    <tbody>
                        ${insumos.map(p => {
                            const avail = p.stockGeneral ?? p.stock ?? 0;
                            const prodStock = p.stockProduccion ?? 0;
                            return `<tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:0.6rem;">${p.name}</td>
                                <td style="padding:0.6rem;text-align:center;color:var(--text-muted);">${fmt(avail)}</td>
                                <td style="padding:0.6rem;text-align:center;color:var(--text-muted);">${fmt(prodStock)}</td>
                                <td style="padding:0.6rem;text-align:center;">
                                    <input type="number" step="0.01" min="0" class="form-control transfer-qty"
                                        data-id="${p.id}" data-name="${p.name}" data-unit="${p.stockUnit||'ud'}"
                                        style="text-align:center; height: 32px; width: 80px; margin: 0 auto;" placeholder="0">
                                </td>
                                <td style="padding:0.6rem;text-align:center;color:var(--text-muted);">${p.stockUnit||'ud'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:1rem;">
                <button class="btn btn-outline" id="cancelTransferBtn" style="width:auto;">Cancelar</button>
                <button class="btn btn-primary" id="transferConfirmBtn" style="width:auto;">Confirmar Transferencia</button>
            </div>
        `;

        el.querySelector('#cancelTransferBtn').addEventListener('click', () => {
            activeTab = 'general';
            renderShell();
        });
        el.querySelector('#transferConfirmBtn').addEventListener('click', confirmTransfer);
    }

    function openAdjustmentModal(prod) {
        currentAdjProduct = prod;
        const modal = container.querySelector('#adjustmentModal');
        container.querySelector('#adjProductName').textContent = (prod.isStore ? '🏪 ' : prod.isProduction ? '🏭 ' : '') + prod.name;
        
        let currentStock = 0;
        if (prod.isStore) currentStock = prod.currentStoreStock;
        else if (prod.isProduction) currentStock = prod.stockProduccion ?? 0;
        else currentStock = prod.stockGeneral ?? prod.stock ?? 0;
        
        container.querySelector('#adjCurrentStock').value = fmt(currentStock);
        container.querySelector('#adjNewStock').value = '';
        container.querySelector('#adjReason').value = 'Inventario Físico';
        modal.style.display = 'flex';
    }

    async function confirmAdjustment() {
        if (!currentAdjProduct) return;
        const newStock = parseFloat(container.querySelector('#adjNewStock').value);
        const reason = container.querySelector('#adjReason').value;

        if (isNaN(newStock)) { showToast('Ingresa un stock válido.', 'error'); return; }

        const btn = container.querySelector('#adjConfirmBtn');
        btn.disabled = true; btn.textContent = 'Guardando...';

        try {
            const currentStock = currentAdjProduct.isStore 
                ? currentAdjProduct.currentStoreStock 
                : (currentAdjProduct.stockGeneral ?? currentAdjProduct.stock ?? 0);
                
            const adjustment = newStock - currentStock;
            const today = new Date().toISOString().split('T')[0];

            if (currentAdjProduct.isStore) {
                const storeProdRef = doc(db, "businesses", businessId, "stores", currentAdjProduct.storeId, "inventory", currentAdjProduct.id);
                await setDoc(storeProdRef, { qty: newStock }, { merge: true });
                storeStocks[currentAdjProduct.id] = newStock;
            } else if (currentAdjProduct.isProduction) {
                const prodRef = doc(db, "businesses", businessId, "products", currentAdjProduct.id);
                await updateDoc(prodRef, { stockProduccion: newStock });
            } else {
                const prodRef = doc(db, "businesses", businessId, "products", currentAdjProduct.id);
                await updateDoc(prodRef, { 
                    stockGeneral: newStock,
                    stock: newStock 
                });
            }

            const storeName = currentAdjProduct.isStore 
                ? stores.find(s => s.id === currentAdjProduct.storeId)?.name 
                : currentAdjProduct.isProduction ? 'Almacén Producción' : 'Almacén General';
            
            await addDoc(collection(db, "businesses", businessId, "inventoryMovements"), {
                type: 'MANUAL_ADJUSTMENT',
                date: today,
                productId: currentAdjProduct.id,
                productName: currentAdjProduct.name,
                adjustment,
                unit: currentAdjProduct.stockUnit || 'ud',
                reason,
                isStore: !!currentAdjProduct.isStore,
                isProduction: !!currentAdjProduct.isProduction,
                storeId: currentAdjProduct.storeId || null,
                storeName: storeName,
                createdBy: auth.currentUser?.email || 'admin',
                businessId,
                createdAt: serverTimestamp()
            });

            showToast('Inventario ajustado correctamente.', 'success');
            container.querySelector('#adjustmentModal').style.display = 'none';
            if (currentAdjProduct.isStore) {
                renderShell(); 
            } else {
                await loadData();
            }
        } catch (err) {
            console.error(err);
            showToast('Error al ajustar inventario.', 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Guardar Ajuste';
        }
    }

    async function confirmTransfer() {
        const inputs = container.querySelectorAll('.transfer-qty');
        const items = [];
        inputs.forEach(inp => {
            const qty = parseFloat(inp.value);
            if (qty > 0) items.push({ productId: inp.dataset.id, productName: inp.dataset.name, qty, stockUnit: inp.dataset.unit });
        });

        if (items.length === 0) { showToast('Ingresa al menos una cantidad mayor a 0.', 'error'); return; }

        const btn = container.querySelector('#transferConfirmBtn');
        btn.disabled = true; btn.textContent = 'Procesando...';

        try {
            const today = new Date().toISOString().split('T')[0];
            for (const item of items) {
                const prodRef = doc(db, "businesses", businessId, "products", item.productId);
                const snap = await getDoc(prodRef);
                if (snap.exists()) {
                    const d = snap.data();
                    const factor = d.stockToRecipeFactor || 1;
                    const newGeneral = (d.stockGeneral ?? d.stock ?? 0) - item.qty;
                    const newProduccion = (d.stockProduccion ?? 0) + (item.qty * factor);
                    await updateDoc(prodRef, { stockGeneral: newGeneral, stockProduccion: newProduccion });
                }
            }

            await addDoc(collection(db, "businesses", businessId, "inventoryMovements"), {
                type: 'TRANSFER_TO_PRODUCTION', date: today,
                createdBy: auth.currentUser?.email || 'admin',
                businessId, items, createdAt: serverTimestamp()
            });

            showToast('Transferencia registrada correctamente.', 'success');
            activeTab = 'produccion';
            await loadData();
        } catch (err) {
            console.error(err);
            showToast('Error al registrar la transferencia.', 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Confirmar Transferencia';
        }
    }

    async function processAllProduction(productionList, hadWarning) {
        if (productionList.length === 0) return;
        const btn = document.querySelector('#processAllBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

        try {
            const today = new Date().toISOString().split('T')[0];
            for (const { recipe, qty: qtyProduced } of productionList) {
                const ingredients = recipe.recipeIngredients || [];
                const ingredientsConsumed = [];

                for (const ing of ingredients) {
                    const yieldVal = recipe.yield || 1;
                    const totalConsumoRaw = (ing.qty / yieldVal) * qtyProduced;
                    const totalConsumo = Math.ceil(totalConsumoRaw);
                    const prodRef = doc(db, "businesses", businessId, "products", ing.productId);
                    const snap = await getDoc(prodRef);
                    if (snap.exists()) {
                        const d = snap.data();
                        const before = parseFloat(d.stockGeneral ?? d.stock ?? 0);
                        const factor = getFactorForProduct(d);
                        const consumedStockUnits = totalConsumo / factor;
                        const after = before - consumedStockUnits;
                        await updateDoc(prodRef, { stockGeneral: after });
                        ingredientsConsumed.push({ ...ing, qty: totalConsumo, stockBefore: before, stockAfter: after, factor });
                    }
                }

                const recipeRef = doc(db, "businesses", businessId, "products", recipe.id);
                const recipeSnap = await getDoc(recipeRef);
                if (recipeSnap.exists()) {
                    const rd = recipeSnap.data();
                    await updateDoc(recipeRef, { stockGeneral: (rd.stockGeneral ?? rd.stock ?? 0) + qtyProduced });
                }

                await addDoc(collection(db, "businesses", businessId, "productionBatches"), {
                    type: 'PRODUCTION_LOAD', date: today,
                    createdBy: auth.currentUser?.email || 'admin',
                    businessId, recipeId: recipe.id, recipeName: recipe.name,
                    qtyProduced, hadStockWarning: hadWarning,
                    ingredientsConsumed, createdAt: serverTimestamp()
                });
            }

            showToast(`✅ ${productionList.length} receta(s) procesadas.`, 'success');
            activeTab = 'general';
            await loadData();
        } catch (err) {
            console.error(err);
            showToast('Error al procesar la producción.', 'error');
            if (btn) { btn.disabled = false; btn.textContent = '⚙️ Cargar y Procesar Todo'; }
        }
    }

    function showToast(msg, type = 'success') {
        let tc = document.querySelector('.toast-container');
        if (!tc) { tc = document.createElement('div'); tc.className = 'toast-container'; document.body.appendChild(tc); }
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
        tc.appendChild(t);
        setTimeout(() => t.classList.add('show'), 50);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4000);
    }

    loadData();
}
