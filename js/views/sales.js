import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { doc, setDoc, getDocs, getDoc, collection, query, orderBy, where, addDoc, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { renderClients } from './clients.js';

export function renderSales(container, preSelectedClient = null) {
    // State
    let products = [];
    let clients = [];
    let cart = [];
    let payments = [];
    let currentView = 'cart';
    let includeOldDebt = false;
    
    // Attempt to restore state if returning from client creation
    const savedState = sessionStorage.getItem('sales_temp_state');
    if (savedState) {
        const state = JSON.parse(savedState);
        cart = state.cart || [];
        payments = state.payments || [];
        currentView = state.currentView || 'cart';
        sessionStorage.removeItem('sales_temp_state');
    }

    let bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
    let settings = {
        type: 'venta',
        target: 'detal',
        priceType: 'precioDetal'
    };
    let selectedClient = preSelectedClient;
    let clientDebt = 0;
    let searchProductTerm = '';
    let dailySales = [];
    let stores = [];
    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');
    const storeId = role === 'admin' ? null : localStorage.getItem('storeId');
    const storeName = role === 'admin' ? 'Almacén General' : (localStorage.getItem('storeName') || 'Sucursal');

    // Helper: format numbers
    const fmt = (n) => {
        const val = parseFloat(n || 0);
        return isNaN(val) ? '0,00' : val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const getToday = () => new Date().toLocaleDateString('sv-SE');



    async function loadData() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando catálogo y clientes...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) {
            container.innerHTML = '<div class="text-danger">Error: No se encontró el ID del negocio. Por favor, reincie sesión.</div>';
            return;
        }
        
        try {
            // Load products - Simplified query to avoid index errors
            const snapProd = await getDocs(collection(db, "businesses", businessId, "products"));
            products = snapProd.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // If employee, merge local store stock
            if (role === 'employee') {
                const localStoreId = localStorage.getItem('storeId');
                if (localStoreId) {
                    const snapStoreInv = await getDocs(collection(db, "businesses", businessId, "stores", localStoreId, "inventory"));
                    const storeStockMap = {};
                    snapStoreInv.forEach(doc => {
                        storeStockMap[doc.id] = doc.data().qty || 0;
                    });
                    products = products.map(p => ({
                        ...p,
                        stockGeneral: storeStockMap[p.id] || 0
                    }));
                }
            }

            products.sort((a, b) => a.name.localeCompare(b.name));

            // Load clients
            const snapCli = await getDocs(collection(db, "businesses", businessId, "clients"));
            clients = snapCli.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            clients.sort((a, b) => a.fullName.localeCompare(b.fullName));

            // Load stores for admin filtering
            if (role === 'admin') {
                const snapStores = await getDocs(collection(db, "businesses", businessId, "stores"));
                stores = snapStores.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                stores.sort((a, b) => a.name.localeCompare(b.name));
            }

            // Load daily sales
            await loadDailySales();

            render();
        } catch (error) {
            console.error("Error cargando datos:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar los datos.</div>';
        }
    }

    async function loadDailySales() {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;

        const q = query(collection(db, "businesses", businessId, "sales"), where("date", "==", todayStr));
        const snap = await getDocs(q);
        const allSales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const activeStoreId = role === 'admin' ? 'general' : (localStorage.getItem('storeId') || 'general');

        dailySales = allSales.filter(sale => {
            if (role !== 'admin') {
                return sale.employeeEmail === auth.currentUser?.email;
            } else {
                // Admin sees ONLY "Almacén General" in this view as requested
                return (sale.storeId === 'general') || (!sale.storeId) || (sale.storeName === 'Almacén General');
            }
        });

        dailySales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }

    async function loadHistorySummary(summaryContainer) {
        if (!summaryContainer) return;
        try {
            const businessId = localStorage.getItem('businessId');
            if (!businessId) return;

            const todayStr = new Date().toLocaleDateString('sv-SE');
            const todayStart = new Date();
            todayStart.setHours(0,0,0,0);
            
            // Use createdAt for the query since older payments may not have the 'date' field
            const q = query(collection(db, "businesses", businessId, "payments"), 
                           where("createdAt", ">=", todayStart));
            const snap = await getDocs(q);

            const totals = {
                'PUNTO': 0, 'PAGO_MOVIL': 0, 'TRANSFERENCIA': 0, 'EFECTIVO_BS': 0,
                'EFECTIVO_USD': 0, 'ZELLE': 0, 'PAYPAL': 0, 'BINANCE': 0
            };

            snap.forEach(doc => {
                const p = doc.data();

                let pass = false;
                if (role !== 'admin') {
                    pass = (p.employeeEmail === auth.currentUser?.email);
                } else {
                    // For admin, show ONLY the main warehouse (general store) in this personal view
                    pass = (p.storeId === 'general') || (!p.storeId) || (p.storeName === 'Almacén General');
                }

                if (pass) {
                    const method = p.method || 'EFECTIVO';
                    const amount = p.amount || 0;
                    const currency = p.currency || 'USD';

                    if (currency === 'BS') {
                        if (method === 'PUNTO') totals.PUNTO += amount;
                        else if (method === 'PAGO_MOVIL') totals.PAGO_MOVIL += amount;
                        else if (method === 'TRANSFERENCIA') totals.TRANSFERENCIA += amount;
                        else if (method === 'EFECTIVO') totals.EFECTIVO_BS += amount;
                    } else {
                        if (method === 'EFECTIVO') totals.EFECTIVO_USD += amount;
                        else if (method === 'ZELLE') totals.ZELLE += amount;
                        else if (method === 'PAYPAL') totals.PAYPAL += amount;
                        else if (method === 'BINANCE') totals.BINANCE += amount;
                        // Fallback case if method is somehow a BS method but currency is USD
                        else if (totals[method] !== undefined) totals[method] += amount;
                    }
                }
            });

            summaryContainer.innerHTML = `
                <div class="card" style="background: var(--surface); border: 1px solid var(--border); padding: 0.6rem 1.25rem; flex: none; margin: 0;">
                    <h3 style="font-size: 0.75rem; margin-bottom: 0.4rem; color: var(--primary); display: flex; align-items: center; gap: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">
                        <span>📊</span> Resumen de Recaudación (Caja)
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 0.4rem;">
                        <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Punto de Venta</p>
                            <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.PUNTO)}</p>
                        </div>
                        <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Pago Móvil</p>
                            <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.PAGO_MOVIL)}</p>
                        </div>
                        <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Transferencia</p>
                            <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.TRANSFERENCIA)}</p>
                        </div>
                        <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Bs. Efectivo</p>
                            <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.EFECTIVO_BS)}</p>
                        </div>
                        <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">$ Efectivo</p>
                            <p style="font-weight: 800; font-size: 0.9rem; color: var(--success);">$ ${fmt(totals.EFECTIVO_USD)}</p>
                        </div>
                        <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Zelle</p>
                            <p style="font-weight: 800; font-size: 0.9rem; color: var(--primary);">$ ${fmt(totals.ZELLE)}</p>
                        </div>
                        <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">PayPal</p>
                            <p style="font-weight: 800; font-size: 0.9rem; color: #003087;">$ ${fmt(totals.PAYPAL)}</p>
                        </div>
                        <div style="padding: 0.2rem 0.5rem;">
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Binance</p>
                            <p style="font-weight: 800; font-size: 0.9rem; color: #F3BA2F;">$ ${fmt(totals.BINANCE)}</p>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error("Error loading summary:", e);
        }
    }

    function render() {
        if (currentView === 'cart') {
            renderCartView();
        } else if (currentView === 'payment') {
            renderPaymentView();
        } else {
            renderHistoryView();
        }
    }

    function renderCartView() {
        const totalUSD = cart.reduce((sum, item) => sum + item.total, 0);
        const grandTotalUSD = includeOldDebt ? totalUSD + clientDebt : totalUSD;
        const totalBs = grandTotalUSD * bcvRate;
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

        container.innerHTML = `
            <div style="width: 100%; height: calc(100vh - 4.5rem); display: flex; flex-direction: column; gap: 1rem; overflow: hidden; padding-bottom: 1.5rem;">
                <!-- Header / Settings -->
                <div class="card" style="width: 100%; padding: 0.5rem 1.5rem; display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: nowrap; flex: none;">
                    <div style="display: flex; gap: 1rem; align-items: center; flex: 1;">
                        <h2 style="margin: 0; font-size: 1.1rem; white-space: nowrap;">🛒 Ventas</h2>
                        
                        <!-- Search Bar Integrated in Header -->
                        <div style="flex: 1; max-width: 500px; margin: 0 1rem;">
                            <input type="text" id="productSearch" class="form-control" placeholder="🔍 Buscar producto..." value="${searchProductTerm}" style="padding: 0.45rem 0.75rem; font-size: 0.9rem; width: 100%;">
                        </div>

                        <div style="display: flex; gap: 0.5rem;" class="hide-mobile">
                            <select id="saleType" class="form-control" style="width: auto; padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                                <option value="venta" ${settings.type === 'venta' ? 'selected' : ''}>Venta</option>
                                <option value="presupuesto" ${settings.type === 'presupuesto' ? 'selected' : ''}>Presupuesto</option>
                            </select>
                            <select id="saleTarget" class="form-control" style="width: auto; padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                                <option value="detal" ${settings.target === 'detal' ? 'selected' : ''}>Detal</option>
                                <option value="mayor" ${settings.target === 'mayor' ? 'selected' : ''}>Mayor</option>
                            </select>
                            <select id="priceType" class="form-control" style="width: auto; padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                                <option value="precioDetal" ${settings.priceType === 'precioDetal' ? 'selected' : ''}>P. Detal</option>
                                <option value="precioMayor" ${settings.priceType === 'precioMayor' ? 'selected' : ''}>P. Mayor</option>
                                <option value="precioSpecial" ${settings.priceType === 'precioSpecial' ? 'selected' : ''}>P. Especial</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.75rem; align-items: center; flex: none;">
                        <button id="viewHistoryBtn" class="btn btn-outline" style="width: auto; padding: 0.45rem 1rem; font-size: 0.85rem;">📅 Ventas del Día</button>
                        <div class="text-muted hide-mobile" style="font-weight: 500; font-size: 0.85rem;">🏪 ${storeName}</div>
                    </div>
                </div>

                <!-- Main Content Grid -->
                <div style="width: 100%; flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; min-height: 0; overflow: hidden;" class="grid-1-mobile">
                    <!-- Left Column: Products (Scrollable) -->
                    <div style="width: 100%; height: 100%; overflow-y: auto; padding-right: 0.5rem;">
                        <div id="productList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; width: 100%;">
                            ${renderProductList()}
                        </div>
                    </div>

                    <!-- Right Column: Cart (Stationary) -->
                    <div style="width: 100%; height: 100%; overflow: hidden;">
                        <div class="card" style="width: 100%; height: 100%; display: flex; flex-direction: column; padding: 0.8rem 1.25rem; overflow: hidden;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.35rem; gap: 0.5rem; flex: none;">
                                <h3 style="margin: 0; font-size: 1rem; white-space: nowrap;">Carrito de Ventas</h3>
                                <div style="display: flex; gap: 0.4rem;">
                                    <button id="cancelCartBtn" class="btn btn-outline" style="width: auto; padding: 0.3rem 0.7rem; font-size: 0.75rem; color: var(--danger); border-color: var(--danger); background: rgba(239, 68, 68, 0.05);" ${cart.length === 0 ? 'disabled' : ''}>
                                        ✕ CANCELAR
                                    </button>
                                    <button id="continueBtn" class="btn btn-primary" style="width: auto; padding: 0.35rem 0.9rem; font-size: 0.8rem; font-weight: bold; white-space: nowrap;" ${cart.length === 0 ? 'disabled' : ''}>
                                        CONTINUAR →
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Items list in Cart -->
                            <div style="flex: 1; overflow-y: auto; margin-bottom: 1rem;">
                                ${cart.length === 0 
                                    ? '<div style="text-align: center; padding: 3rem 0; color: var(--text-muted);">El carrito está vacío</div>'
                                    : `
                                    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                                        <thead>
                                            <tr style="border-bottom: 2px solid var(--border); text-align: left;">
                                                <th style="padding: 0.5rem 0;">Producto</th>
                                                <th style="padding: 0.5rem 0; text-align: center;">Cant.</th>
                                                <th style="padding: 0.5rem 0; text-align: right;">Precio</th>
                                                <th style="padding: 0.5rem 0; text-align: right;">Total</th>
                                                <th style="padding: 0.5rem 0;"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${cart.map((item, index) => `
                                                <tr style="border-bottom: 1px solid var(--border);">
                                                    <td style="padding: 0.75rem 0;">
                                                        <div style="font-weight: 600;">${item.name}</div>
                                                        <div style="font-size: 0.7rem; color: var(--text-muted);">${item.id}</div>
                                                    </td>
                                                    <td style="padding: 0.75rem 0; text-align: center;">
                                                        <span class="edit-qty" data-index="${index}" style="cursor: pointer; background: var(--background); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold; border: 1px solid var(--border);">
                                                            ${item.qty}
                                                        </span>
                                                    </td>
                                                    <td style="padding: 0.75rem 0; text-align: right;">$${fmt(item.price)}</td>
                                                    <td style="padding: 0.75rem 0; text-align: right; font-weight: bold;">$${fmt(item.total)}</td>
                                                    <td style="padding: 0.75rem 0; text-align: right;">
                                                        <button class="btn-remove" data-index="${index}" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1.1rem; padding: 0.2rem;">✕</button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                    `
                                }
                            </div>

                            <!-- Metrics Row (4 columns) -->
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: auto;">
                                <div class="card" style="padding: 0.5rem; background: var(--background); border-left: 3px solid var(--primary);">
                                    <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Items</p>
                                    <p style="font-size: 0.9rem; font-weight: 800; margin: 0;">${totalItems}</p>
                                </div>
                                <div class="card" style="padding: 0.5rem; background: var(--background); border-left: 3px solid var(--success);">
                                    <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Total $</p>
                                    <p style="font-size: 0.9rem; font-weight: 800; margin: 0; color: var(--success);">$${fmt(grandTotalUSD)}</p>
                                </div>
                                <div class="card" style="padding: 0.5rem; background: var(--background); border-left: 3px solid #3b82f6;">
                                    <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Total Bs</p>
                                    <p style="font-size: 0.9rem; font-weight: 800; margin: 0; color: #3b82f6;">${fmt(totalBs)}</p>
                                </div>
                                <div id="pullDebtBtn" class="card" style="padding: 0.5rem; background: ${clientDebt > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--background)'}; border-left: 3px solid var(--danger); cursor: ${clientDebt > 0 ? 'pointer' : 'default'};">
                                    <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Deuda</p>
                                    <p style="font-size: 0.9rem; font-weight: 800; margin: 0; color: var(--danger);">$${fmt(clientDebt)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event Listeners
        container.querySelector('#productSearch').addEventListener('input', (e) => {
            searchProductTerm = e.target.value.toLowerCase();
            container.querySelector('#productList').innerHTML = renderProductList();
            attachProductClickEvents();
        });

        container.querySelector('#viewHistoryBtn').addEventListener('click', () => {
            currentView = 'history';
            render();
        });

        container.querySelector('#saleType').addEventListener('change', (e) => { settings.type = e.target.value; });
        container.querySelector('#saleTarget').addEventListener('change', (e) => { settings.target = e.target.value; });
        container.querySelector('#priceType').addEventListener('change', (e) => {
            settings.priceType = e.target.value;
            // Update cart prices if needed? User didn't specify, but usually yes.
            cart = cart.map(item => {
                const prod = products.find(p => p.id === item.id);
                const newPrice = getPrice(prod);
                return { ...item, price: newPrice, total: newPrice * item.qty };
            });
            render();
        });

        container.querySelector('#pullDebtBtn')?.addEventListener('click', () => {
            if (clientDebt > 0 && !includeOldDebt) {
                showConfirmModal("Cargar Deuda Previa", `¿Desea agregar la deuda de $${fmt(clientDebt)} a esta cuenta?`, () => {
                    includeOldDebt = true;
                    render();
                }, "Sí, Cargar", "Cancelar");
            }
        });

        attachProductClickEvents();

        container.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                cart.splice(index, 1);
                render();
            });
        });

        container.querySelectorAll('.edit-qty').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const item = cart[index];
                showQuantityModal(item.name, (newQty) => {
                    item.qty = parseFloat(newQty);
                    item.total = item.qty * item.price;
                    render();
                }, item.qty);
            });
        });

        container.querySelector('#continueBtn').addEventListener('click', () => {
            currentView = 'payment';
            render();
        });

        container.querySelector('#cancelCartBtn')?.addEventListener('click', () => {
            showConfirmModal("Cancelar Venta", "¿Está seguro que desea cancelar esta venta y vaciar el carrito?", () => {
                // Limpiar todo el estado
                cart = [];
                payments = [];
                selectedClient = null;
                sessionStorage.removeItem('sales_temp_state');
                
                // Intentar navegar al dashboard principal
                const navHome = document.getElementById('navHome');
                if (navHome) {
                    navHome.click();
                } else {
                    // Fallback directo si el sidebar no es accesible
                    navigate('#dashboard');
                }
            }, "Sí, Cancelar", "No, Volver");
        });
    }

    function renderProductList() {
        const filtered = products.filter(p => {
            const isMatch = p.name.toLowerCase().includes(searchProductTerm) || 
                            (p.barcode && p.barcode.includes(searchProductTerm));
            
            // Si es admin, ve todo. Si es empleado, solo lo vendible (isSaleable !== false)
            const canSee = (role === 'admin') || (p.isSaleable !== false);
            
            return isMatch && canSee;
        });

        if (filtered.length === 0) return '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No se encontraron productos.</p>';

        return filtered.map(prod => {
            const stock = prod.stockGeneral ?? prod.stock ?? 0;
            const price = getPrice(prod);
            const priceBs = price * bcvRate;

            let stockBadge = '';
            if (prod.category !== 'SERVICIOS') {
                const sUnit = prod.stockUnit || 'ud';
                if (stock <= 0) {
                    stockBadge = `<span style="position: absolute; bottom: 0.2rem; right: 0.2rem; background: var(--danger); color: white; padding: 0.1rem 0.25rem; border-radius: 3px; font-size: 0.5rem; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">SIN STOCK</span>`;
                } else {
                    stockBadge = `<span style="position: absolute; bottom: 0.2rem; right: 0.2rem; background: var(--success); color: white; padding: 0.1rem 0.25rem; border-radius: 3px; font-size: 0.5rem; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">STOCK: ${stock}</span>`;
                }
            }

            const imageHtml = prod.image 
                ? `<div style="width: 100%; height: 75px; background: white; display: flex; align-items: center; justify-content: center; position: relative;"><img src="${prod.image}" alt="${prod.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">${stockBadge}</div>`
                : `<div style="width: 100%; height: 75px; background: var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); position: relative; font-size: 0.5rem;">Sin Imagen${stockBadge}</div>`;

            return `
                <div class="card product-card" data-id="${prod.id}" style="padding: 0; overflow: hidden; cursor: pointer; transition: transform 0.2s;">
                    ${imageHtml}
                    <div style="padding: 0.5rem;">
                        <h3 style="color: var(--primary); margin-bottom: 0.35rem; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${prod.name}">${prod.name}</h3>
                        <div style="margin-bottom: 0.25rem;">
                            <p style="font-weight: bold; font-size: 0.8rem; color: var(--text-main); margin: 0;">$ ${fmt(price)}</p>
                            <p style="font-weight: bold; font-size: 0.8rem; color: var(--text-main); margin: 0;">Bs. ${fmt(priceBs)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function attachProductClickEvents() {
        container.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const prod = products.find(p => p.id === card.dataset.id);
                if (prod) promptAddToCart(prod);
            });
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
        });
    }

    function getPrice(prod) {
        if (!prod) return 0;
        if (settings.priceType === 'precioMayor') return prod.priceMayor || prod.priceDetal || 0;
        if (settings.priceType === 'precioSpecial') return prod.priceSpecial || prod.priceDetal || 0;
        return prod.priceDetal || 0;
    }

    function promptAddToCart(prod) {
        showQuantityModal(prod.name, (qty) => {
            const existing = cart.find(item => item.id === prod.id);
            const price = getPrice(prod);
            if (existing) {
                existing.qty += qty;
                existing.total = existing.qty * existing.price;
            } else {
                cart.push({
                    id: prod.id,
                    name: prod.name,
                    qty: qty,
                    price: price,
                    total: price * qty,
                    stockUnit: prod.stockUnit || 'ud'
                });
            }
            render();
        });
    }

    function showQuantityModal(title, onConfirm, defaultValue = "") {
        const modal = document.createElement('div');
        modal.style = "position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1rem;";
        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 350px; border-top: 4px solid var(--primary); animation: fadeInScale 0.2s ease-out;">
                <h3 style="margin-bottom: 1rem; font-size: 1rem;">Cantidad para:</h3>
                <p style="font-weight: bold; color: var(--primary); margin-bottom: 1.5rem;">${title}</p>
                
                <div class="form-group mb-4">
                    <input type="number" id="modalQtyInput" class="form-control" step="any" placeholder="0.00" style="font-size: 1.5rem; text-align: center; font-weight: bold;" value="">
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button id="modalCancelBtn" class="btn btn-outline">Cancelar</button>
                    <button id="modalConfirmBtn" class="btn btn-primary">Agregar</button>
                </div>
                
                <style>
                    @keyframes fadeInScale {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    /* Remove arrows from number input */
                    #modalQtyInput::-webkit-outer-spin-button,
                    #modalQtyInput::-webkit-inner-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                    }
                </style>
            </div>
        `;
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#modalQtyInput');
        input.focus();

        const confirm = () => {
            const val = parseFloat(input.value);
            if (!isNaN(val) && val > 0) {
                onConfirm(val);
                modal.remove();
            } else {
                input.style.borderColor = 'var(--danger)';
                input.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }], { duration: 100, iterations: 3 });
            }
        };

        modal.querySelector('#modalConfirmBtn').onclick = confirm;
        modal.querySelector('#modalCancelBtn').onclick = () => modal.remove();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') modal.remove();
        };
    }

    async function renderPaymentView() {
        const productsUSD = cart.reduce((sum, item) => sum + item.total, 0);
        const totalUSD = includeOldDebt ? (productsUSD + clientDebt) : productsUSD;
        const totalBs = totalUSD * bcvRate;
        const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

        let paidUSD = 0;
        payments.forEach(p => {
            if (p.currency === 'USD') paidUSD += p.amount;
            else paidUSD += p.amount / p.rate;
        });

        const remainingUSD = totalUSD - paidUSD;
        const changeUSD = paidUSD > totalUSD ? paidUSD - totalUSD : 0;
        const saleStatus = payments.length === 0 ? 'contado' : (container.querySelector('#saleStatus')?.value || 'contado');

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; gap: 1rem;">
                <div class="card" style="padding: 0.4rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex: none;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <button id="backToCartBtn" class="btn btn-outline" style="width: auto; padding: 0.35rem 0.8rem; font-size: 0.85rem;">← Volver al Carrito</button>
                        <h3 style="margin: 0; font-size: 1rem; color: var(--text-muted); font-weight: 500;">Checkout</h3>
                    </div>
                    <button id="finishBtn" class="btn btn-primary" style="width: auto; padding: 0.45rem 1.5rem; font-size: 0.9rem; font-weight: bold; background: var(--success); border-color: var(--success); box-shadow: 0 2px 8px rgba(34, 197, 94, 0.2);">
                        ✅ FINALIZAR VENTA
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 1rem; flex: 1; overflow: hidden;" class="grid-1-mobile">
                    <!-- Block 1: Client Selection -->
                    <div style="display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; min-width: 0;">
                        <div class="card" style="padding: 1.5rem; flex: 1;">
                            <h3 style="margin-bottom: 1.25rem; color: var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                                <span>1</span> Selección de Cliente
                            </h3>
                            <div class="form-group mb-4">
                                <label style="font-weight: 600; font-size: 0.9rem;">Buscar Cliente (Nombre o Cédula)</label>
                                <div style="position: relative; margin-top: 0.5rem;">
                                    <input type="text" id="clientSearch" class="form-control" placeholder="Escriba para buscar..." value="${selectedClient ? selectedClient.fullName : ''}" style="padding: 0.75rem;">
                                    <div id="clientResults" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-top: none; z-index: 100; max-height: 250px; overflow-y: auto; box-shadow: var(--shadow-lg); border-radius: 0 0 8px 8px;"></div>
                                </div>
                            </div>

                            ${selectedClient ? `
                                <div style="position: relative; background: rgba(59, 130, 246, 0.1); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.3); animation: fadeIn 0.3s ease;">
                                    <p style="margin: 0; font-weight: bold; color: var(--primary); font-size: 1.1rem;">${selectedClient.fullName}</p>
                                    <div style="margin-top: 0.75rem; display: grid; gap: 0.4rem;">
                                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);"><span style="opacity: 0.7;">ID:</span> ${selectedClient.id}</p>
                                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);"><span style="opacity: 0.7;">Tel:</span> ${selectedClient.phone || 'No registrado'}</p>
                                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);"><span style="opacity: 0.7;">Dirección:</span> ${selectedClient.address || 'No registrada'}</p>
                                    </div>
                                    <button id="removeClientBtn" style="position: absolute; bottom: 0.75rem; right: 0.75rem; background: var(--danger); color: white; border: none; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.3); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                        ✕
                                    </button>
                                </div>
                            ` : `
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1.5rem; text-align: center; border: 2px dashed var(--border); border-radius: 12px; opacity: 0.7;">
                                    <span style="font-size: 2.5rem; margin-bottom: 1rem;">👤</span>
                                    <p class="text-danger" style="font-weight: 500;">Debe seleccionar un cliente <span class="text-danger">*</span></p>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Block 2: Payment Methods -->
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto; min-width: 0;">
                        <div class="card" style="padding: 1.25rem; flex: 1; display: flex; flex-direction: column;">
                            <h3 style="margin-bottom: 1rem; color: var(--primary); font-size: 1.1rem;">
                                2. Métodos de Pago
                            </h3>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                                <div class="form-group">
                                    <label style="font-size: 0.8rem; opacity: 0.8;">Moneda</label>
                                    <select id="payCurrency" class="form-control" style="margin-top: 0.2rem; padding: 0.4rem; height: 35px; font-size: 0.85rem;">
                                        <option value="BS">Bolívares (Bs)</option>
                                        <option value="USD">Dólares ($)</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label style="font-size: 0.8rem; opacity: 0.8;">Método</label>
                                    <select id="payMethod" class="form-control" style="margin-top: 0.2rem; padding: 0.4rem; height: 35px; font-size: 0.85rem;">
                                        <!-- Opciones cargadas dinámicamente -->
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label style="font-size: 0.8rem; opacity: 0.8;">Monto</label>
                                    <input type="text" inputmode="numeric" id="payAmount" class="form-control" placeholder="0,00" style="margin-top: 0.2rem; padding: 0.4rem; height: 35px; font-size: 0.85rem; font-weight: bold;">
                                </div>
                                <div class="form-group" id="refGroup" style="display: none;">
                                    <label style="font-size: 0.8rem; opacity: 0.8;">Referencia</label>
                                    <input type="text" id="payRef" class="form-control" placeholder="Ej. 1234" style="margin-top: 0.2rem; padding: 0.4rem; height: 35px; font-size: 0.85rem;">
                                </div>
                            </div>
                            <button id="addPaymentBtn" class="btn btn-outline" style="width: 100%; padding: 0.5rem; font-weight: 600; font-size: 0.85rem;">➕ Agregar Pago</button>

                            <!-- Payments List -->
                            <div style="margin-top: 1rem; flex: 1;">
                                <h4 style="font-size: 0.85rem; margin-bottom: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 0.4rem;">Pagos Recibidos</h4>
                                ${payments.length === 0 
                                    ? '<p style="text-align: center; padding: 1rem 0; font-size: 0.8rem; opacity: 0.6;">Sin pagos.</p>'
                                    : `
                                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        ${payments.map((p, i) => `
                                            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--background); padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid var(--border);">
                                                <div style="line-height: 1.2;">
                                                    <div style="font-weight: bold; font-size: 0.85rem;">${p.method}</div>
                                                    <div style="color: var(--primary); font-weight: 700; font-size: 0.8rem;">${p.currency} ${fmt(p.amount)}</div>
                                                </div>
                                                <button class="remove-payment" data-index="${i}" style="background: rgba(239, 68, 68, 0.1); border: none; color: var(--danger); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.7rem;">✕</button>
                                            </div>
                                        `).join('')}
                                    </div>
                                    `
                                }
                            </div>
                        </div>
                    </div>

                    <!-- Block 3: Invoice Summary -->
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto; min-width: 0;">
                        <div class="card" style="padding: 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 1rem;">
                            <h3 style="margin-bottom: 0.2rem; color: var(--primary); font-size: 1.1rem;">
                                3. Resumen de Factura
                            </h3>

                            <div class="form-group">
                                <label style="font-weight: 600; font-size: 0.85rem;">Estado de Venta <span class="text-danger">*</span></label>
                                <select id="saleStatus" class="form-control" style="font-weight: bold; margin-top: 0.4rem; border-color: var(--primary); height: 42px; padding: 0 0.75rem; font-size: 0.9rem; line-height: 42px;">
                                    <option value="abono" ${saleStatus === 'abono' ? 'selected' : ''}>ABONO / PARCIAL</option>
                                    <option value="credito" ${saleStatus === 'credito' ? 'selected' : ''}>A CRÉDITO</option>
                                    <option value="contado" ${saleStatus === 'contado' ? 'selected' : ''}>CONTADO</option>
                                </select>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                                ${(() => {
                                    const productsUSD = cart.reduce((sum, item) => sum + item.total, 0);
                                    const effectiveTotalUSD = includeOldDebt ? (productsUSD + clientDebt) : productsUSD;
                                    const effectiveTotalBs = effectiveTotalUSD * bcvRate;
                                    const paymentsTotalUSD = payments.reduce((sum, p) => {
                                        if (p.currency === 'USD') return sum + p.amount;
                                        return sum + (p.amount / bcvRate);
                                    }, 0);
                                    const currentRemainingUSD = Math.max(0, effectiveTotalUSD - paymentsTotalUSD);
                                    const currentChangeUSD = Math.max(0, paymentsTotalUSD - effectiveTotalUSD);

                                    return `
                                    <div class="card" style="padding: 0.6rem; background: var(--background); border-left: 3px solid var(--primary); margin: 0;">
                                        <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Total USD</p>
                                        <p style="font-size: 1rem; font-weight: 800; margin: 0;">$ ${fmt(effectiveTotalUSD)}</p>
                                    </div>
                                    <div class="card" style="padding: 0.6rem; background: var(--background); border-left: 3px solid #3b82f6; margin: 0;">
                                        <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Total BS</p>
                                        <p style="font-size: 1rem; font-weight: 800; margin: 0;">Bs. ${fmt(effectiveTotalBs)}</p>
                                    </div>
                                    <div id="pullDebtBtn" class="card" style="padding: 0.6rem; background: ${includeOldDebt ? 'rgba(239, 68, 68, 0.1)' : 'var(--background)'}; border-left: 3px solid var(--danger); margin: 0; cursor: ${clientDebt > 0 && !includeOldDebt ? 'pointer' : 'default'}; transition: all 0.2s; position: relative;" onmouseover="${clientDebt > 0 && !includeOldDebt ? "this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" : ''}" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                                        <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Deuda Cliente</p>
                                        <p style="font-size: 1rem; font-weight: 800; margin: 0; color: var(--danger);">$ ${fmt(clientDebt)}</p>
                                        ${clientDebt > 0 && !includeOldDebt ? `
                                            <div style="position: absolute; top: 2px; right: 5px; font-size: 0.6rem; color: var(--primary); font-weight: bold;">+ CARGAR</div>
                                        ` : includeOldDebt ? `
                                            <div style="position: absolute; top: 2px; right: 5px; font-size: 0.6rem; color: var(--success); font-weight: bold;">✓ CARGADA</div>
                                        ` : ''}
                                    </div>
                                    <div class="card" style="padding: 0.6rem; background: var(--background); border-left: 3px solid var(--success); margin: 0;">
                                        <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--text-muted); margin: 0;">Pendiente</p>
                                        <div style="font-size: 1rem; font-weight: 800; line-height: 1.2; margin-top: 0.2rem; color: ${currentRemainingUSD > 0.01 ? 'var(--danger)' : 'var(--success)'};">
                                            <div>$ ${fmt(currentRemainingUSD)}</div>
                                            <div>Bs. ${fmt(currentRemainingUSD * bcvRate)}</div>
                                        </div>
                                    </div>
                                    ${currentChangeUSD > 0.01 ? `
                                    <div class="card" style="padding: 0.6rem; background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); grid-column: span 2; margin: 0;">
                                        <p style="font-size: 0.6rem; text-transform: uppercase; color: var(--success); margin: 0; font-weight: bold;">Vuelto / Cambio</p>
                                        <p style="font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--success);">$ ${fmt(currentChangeUSD)} | Bs. ${fmt(currentChangeUSD * bcvRate)}</p>
                                    </div>` : ''}
                                    `;
                                })()}
                            </div>

                            <div style="margin-top: auto; padding: 1rem; background: rgba(var(--primary-rgb), 0.03); border-radius: 12px; border: 1px dashed var(--border);">
                                <p style="text-align: center; color: var(--text-muted); font-size: 0.75rem; margin: 0; line-height: 1.4;">Verifique los montos y el cliente antes de procesar la factura definitiva.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Event Listeners for Payment View
        container.querySelector('#backToCartBtn').addEventListener('click', () => {
            currentView = 'cart';
            render();
        });

        // Client Search Logic
        const clientSearch = container.querySelector('#clientSearch');
        const clientResults = container.querySelector('#clientResults');

        clientSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if (term.length < 1) { clientResults.style.display = 'none'; return; }

            const filtered = clients.filter(c => c.fullName.toLowerCase().includes(term) || c.id.toLowerCase().includes(term));
            let resultsHtml = '';
            
            if (filtered.length > 0) {
                resultsHtml = filtered.map(c => `
                    <div class="client-opt" data-id="${c.id}" style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s;" onmouseover="this.style.background='rgba(var(--primary-rgb), 0.05)'" onmouseout="this.style.background='transparent'">
                        <div style="font-weight: bold;">${c.fullName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${c.id}</div>
                    </div>
                `).join('');
            }
            
            // Always show 'New Client' option if typing
            resultsHtml += `
                <div id="createNewClientBtn" style="padding: 1rem; cursor: pointer; background: rgba(34, 197, 94, 0.05); border-top: 1px dashed var(--success); color: var(--success); display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 600; font-size: 0.9rem;" onmouseover="this.style.background='rgba(34, 197, 94, 0.1)'" onmouseout="this.style.background='rgba(34, 197, 94, 0.05)'">
                    <span>➕</span> Nuevo Cliente: "${clientSearch.value}"
                </div>
            `;
            
            clientResults.innerHTML = resultsHtml;
            clientResults.style.display = 'block';

            // Add events to existing options
            container.querySelectorAll('.client-opt').forEach(opt => {
                opt.addEventListener('click', async () => {
                    const client = clients.find(c => c.id === opt.dataset.id);
                    selectedClient = client;
                    clientResults.style.display = 'none';
                    // Load client debt
                    clientDebt = await calculateClientDebt(client.id);
                    render();
                });
            });

            // Add event to Create New Client - NAVIGATE TO CLIENTS
            const newBtn = container.querySelector('#createNewClientBtn');
            if (newBtn) {
                newBtn.onclick = () => {
                    clientResults.style.display = 'none';
                    // Persist current state before leaving
                    sessionStorage.setItem('sales_temp_state', JSON.stringify({
                        cart,
                        payments,
                        currentView: 'payment'
                    }));
                    // Deep navigation with return callback
                    renderClients(container, (newClient) => {
                        renderSales(container, newClient);
                    }, ''); // Empty string to keep the name field blank
                };
            }
        });

        // Remove client event
        const removeClientBtn = container.querySelector('#removeClientBtn');
        if (removeClientBtn) {
            removeClientBtn.onclick = () => {
                selectedClient = null;
                clientDebt = 0;
                render();
            };
        }

        // Payment logic
        const payCurrency = container.querySelector('#payCurrency');
        const payMethod = container.querySelector('#payMethod');
        const refGroup = container.querySelector('#refGroup');

        const updatePayMethods = () => {
            const currency = payCurrency.value;
            let options = '';
            if (currency === 'USD') {
                options = `
                    <option value="BINANCE">Binance</option>
                    <option value="EFECTIVO">Dólares Efectivo</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="ZELLE">Zelle</option>
                `;
            } else {
                options = `
                    <option value="EFECTIVO">Bs. Efectivo</option>
                    <option value="PAGO_MOVIL">Pago Móvil</option>
                    <option value="PUNTO">Punto de Venta</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                `;
            }
            payMethod.innerHTML = options;
            refGroup.style.display = 'none'; // Reset ref display

            // Pre-fill amount based on currency
            const payAmountInput = container.querySelector('#payAmount');
            if (payAmountInput) {
                const amount = currency === 'BS' ? (remainingUSD * bcvRate) : remainingUSD;
                payAmountInput.value = (Math.max(0, amount)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        };

        const applyNumericMask = (input) => {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, ''); 
                if (!value) { e.target.value = ''; return; }
                let number = parseInt(value, 10);
                e.target.value = (number / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            });
            input.addEventListener('focus', (e) => { if (e.target.value === '0,00') e.target.value = ''; });
            input.addEventListener('blur', (e) => { if (!e.target.value) e.target.value = '0,00'; });
        };

        const parseNum = (val) => {
            if (!val) return 0;
            return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0;
        };

        const payAmountInput = container.querySelector('#payAmount');
        if (payAmountInput) applyNumericMask(payAmountInput);

        payCurrency.addEventListener('change', updatePayMethods);
        updatePayMethods(); // Initial load

        payMethod.addEventListener('change', (e) => {
            const electronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(e.target.value);
            refGroup.style.display = electronic ? 'block' : 'none';
        });

        container.querySelector('#addPaymentBtn').addEventListener('click', () => {
            const amount = parseNum(container.querySelector('#payAmount').value);
            const method = container.querySelector('#payMethod').value;
            const currency = container.querySelector('#payCurrency').value;
            const ref = container.querySelector('#payRef')?.value;

            if (isNaN(amount) || amount <= 0) { showNotification("Monto inválido"); return; }
            const electronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(method);
            if (electronic && !ref) { showNotification("La referencia es obligatoria para pagos electrónicos"); return; }

            // Custom confirmation modal
            const confirmModal = document.createElement('div');
            confirmModal.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center;';
            confirmModal.innerHTML = `
                <div class="card" style="width: 90%; max-width: 400px; padding: 2rem; text-align: center; animation: modalIn 0.3s ease-out;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">💰</div>
                    <h3 style="margin-bottom: 0.5rem;">Cargar Pago</h3>
                    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">¿Está seguro de cargar este pago de <b style="color: var(--primary);">${currency} ${fmt(amount)}</b> vía <b>${method}</b>?</p>
                    <div style="display: flex; gap: 1rem;">
                        <button id="cancelPayBtn" class="btn btn-outline" style="flex: 1;">Cancelar</button>
                        <button id="confirmPayBtn" class="btn btn-primary" style="flex: 1; background: var(--success); border-color: var(--success);">Confirmar</button>
                    </div>
                </div>
                <style>
                    @keyframes modalIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                </style>
            `;
            document.body.appendChild(confirmModal);

            confirmModal.querySelector('#cancelPayBtn').onclick = () => confirmModal.remove();
            confirmModal.querySelector('#confirmPayBtn').onclick = () => {
                payments.push({
                    method,
                    currency,
                    amount,
                    ref,
                    rate: currency === 'BS' ? bcvRate : 1,
                    timestamp: new Date().toISOString()
                });
                confirmModal.remove();
                render();
            };
        });

        container.querySelectorAll('.remove-payment').forEach(btn => {
            btn.addEventListener('click', () => {
                payments.splice(parseInt(btn.dataset.index), 1);
                render();
            });
        });

        container.querySelector('#pullDebtBtn')?.addEventListener('click', () => {
            if (clientDebt > 0 && !includeOldDebt) {
                showConfirmModal("Cargar Deuda Previa", `¿Desea agregar la deuda de $${fmt(clientDebt)} a esta cuenta?`, () => {
                    includeOldDebt = true;
                    render();
                }, "Sí, Cargar", "Cancelar");
            }
        });

        container.querySelector('#finishBtn').addEventListener('click', () => {
            const status = container.querySelector('#saleStatus').value;
            
            // Final Validation
            if (!selectedClient) {
                showNotification("❌ Error: Debe seleccionar un cliente para procesar la venta.");
                container.querySelector('#clientSearch').focus();
                return;
            }

            if ((status === 'contado' || status === 'abono') && payments.length === 0) {
                showNotification(`❌ Error: Para una venta a ${status.toUpperCase()}, debe registrar al menos un método de pago.`);
                return;
            }

            processSale(remainingUSD);
        });
    }

    function showNewClientModal(initialName, onCreated) {
        const modal = document.createElement('div');
        modal.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 3000; display: flex; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div class="card" style="width: 90%; max-width: 450px; padding: 2rem; animation: modalIn 0.3s ease-out;">
                <h3 style="margin-bottom: 1.5rem; color: var(--primary);">Registrar Nuevo Cliente</h3>
                
                <div class="form-group mb-3">
                    <label style="font-size: 0.85rem;">Nombre Completo <span class="text-danger">*</span></label>
                    <input type="text" id="newClientName" class="form-control" value="${initialName}" placeholder="Nombre y Apellido" style="margin-top: 0.4rem;">
                </div>
                
                <div class="form-group mb-3">
                    <label style="font-size: 0.85rem;">Cédula / RIF <span class="text-danger">*</span></label>
                    <input type="text" id="newClientID" class="form-control" placeholder="V-12345678" style="margin-top: 0.4rem;">
                </div>

                <div class="form-group mb-4">
                    <label style="font-size: 0.85rem;">Teléfono</label>
                    <input type="text" id="newClientPhone" class="form-control" placeholder="0412-0000000" style="margin-top: 0.4rem;">
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button id="cancelNewClient" class="btn btn-outline" style="flex: 1;">Cancelar</button>
                    <button id="saveNewClient" class="btn btn-primary" style="flex: 1;">Registrar y Seleccionar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const nameInp = modal.querySelector('#newClientName');
        const idInp = modal.querySelector('#newClientID');
        const phoneInp = modal.querySelector('#newClientPhone');
        
        idInp.focus();

        modal.querySelector('#cancelNewClient').onclick = () => modal.remove();
        modal.querySelector('#saveNewClient').onclick = async () => {
            const name = nameInp.value.trim();
            const id = idInp.value.trim();
            if (!name || !id) { showNotification("Nombre y Cédula son obligatorios"); return; }
            
            const newClient = { fullName: name, id: id, phone: phoneInp.value.trim(), address: '', createdAt: new Date().toISOString() };
            
            // Optimistically add to database
            try {
                await addDoc(collection(db, "businesses", businessId, "clients"), newClient);
                onCreated(newClient);
                modal.remove();
            } catch (err) {
                console.error(err);
                showNotification("Error al registrar cliente");
            }
        };
    }

    async function calculateClientDebt(clientId) {
        try {
            const q = query(collection(db, "businesses", businessId, "sales"), 
                            where("clientId", "==", clientId), 
                            where("status", "in", ["abono", "credito"]));
            const snap = await getDocs(q);
            let debt = 0;
            snap.forEach(doc => {
                const data = doc.data();
                debt += (data.totalUSD - (data.paidUSD || 0));
            });
            return debt;
        } catch (e) {
            console.error("Error calculating debt:", e);
            return 0;
        }
    }

    async function processSale(remainingUSD) {
        if (!selectedClient) { showNotification("Debe seleccionar un cliente."); return; }
        const status = container.querySelector('#saleStatus').value;

        if (status === 'contado' && remainingUSD > 0.01) {
            showNotification(`Para una venta de CONTADO debe cubrir el total de la factura. Faltan $${fmt(remainingUSD)}`);
            return;
        }

        const confirmMsg = status === 'contado' ? "¿Está seguro de finalizar esta venta?" :
                          status === 'abono' ? "¿Está seguro que desea finalizar esta venta con abono?" :
                          "¿Está seguro que desea finalizar esta venta a crédito?";

        showConfirmModal("Confirmar Venta", confirmMsg, async () => {
            const finishBtn = container.querySelector('#finishBtn');
            finishBtn.disabled = true;
            finishBtn.textContent = 'Procesando...';

            try {
                const totalUSD_original = cart.reduce((sum, item) => sum + item.total, 0);
                const paymentsTotalUSD = payments.reduce((sum, p) => {
                    if (p.currency === 'USD') return sum + p.amount;
                    return sum + (p.amount / bcvRate);
                }, 0);

                // Determinar cuánto se paga realmente
                // El total pagado se aplica primero a la venta actual
                const paidToCurrentSale = Math.min(totalUSD_original, paymentsTotalUSD);
                const currentRemaining = Math.max(0, totalUSD_original - paidToCurrentSale);
                
                // El excedente se distribuye a deudas anteriores
                let surplus = paymentsTotalUSD - totalUSD_original;
                
                // Buscar ventas antiguas con deuda antes de la transacción
                let pendingSales = [];
                if (surplus > 0.01) {
                    const qOld = query(
                        collection(db, "businesses", businessId, "sales"),
                        where("clientId", "==", selectedClient.id),
                        where("status", "in", ["abono", "credito"])
                    );
                    const snapOld = await getDocs(qOld);
                    // Filtrar y ordenar en memoria para evitar errores de índice compuesto
                    pendingSales = snapOld.docs
                        .map(d => ({id: d.id, ...d.data()}))
                        .filter(s => s.remainingUSD > 0)
                        .sort((a, b) => {
                            const timeA = a.createdAt?.seconds || 0;
                            const timeB = b.createdAt?.seconds || 0;
                            return timeA - timeB;
                        });
                }

                await runTransaction(db, async (transaction) => {
                    // 1. Descontar Inventario
                    for (const item of cart) {
                        const prodRef = doc(db, "businesses", businessId, "products", item.id);
                        const prodSnap = await transaction.get(prodRef);
                        if (prodSnap.exists()) {
                            const p = prodSnap.data();
                            if (storeId) {
                                const storeInvRef = doc(db, "businesses", businessId, "stores", storeId, "inventory", item.id);
                                const siSnap = await transaction.get(storeInvRef);
                                const currentStoreStock = siSnap.exists() ? (siSnap.data().stock || 0) : 0;
                                transaction.set(storeInvRef, { stock: currentStoreStock - item.qty }, { merge: true });
                            } else {
                                const currentStock = p.stockGeneral ?? p.stock ?? 0;
                                transaction.update(prodRef, { stockGeneral: currentStock - item.qty });
                            }
                        }
                    }

                    // 2. Registrar Venta Actual
                    const saleRef = doc(collection(db, "businesses", businessId, "sales"));
                    transaction.set(saleRef, {
                        items: cart,
                        totalUSD: totalUSD_original,
                        totalBs: totalUSD_original * bcvRate,
                        paidUSD: paidToCurrentSale,
                        remainingUSD: currentRemaining,
                        status: currentRemaining < 0.01 ? 'contado' : (paidToCurrentSale > 0.01 ? 'abono' : 'credito'),
                        clientId: selectedClient.id,
                        clientName: selectedClient.fullName,
                        employeeEmail: auth.currentUser?.email,
                        employeeName: localStorage.getItem('employeeName') || 'Admin',
                        storeId: storeId || 'general',
                        storeName: storeName,
                        bcvRate,
                        settings,
                        createdAt: serverTimestamp(),
                        date: new Date().toLocaleDateString('sv-SE')
                    });

                    // 3. Distribuir excedente a ventas antiguas
                    let remainingSurplus = surplus;
                    for (const oldSale of pendingSales) {
                        if (remainingSurplus <= 0.01) break;
                        
                        const amountToApply = Math.min(oldSale.remainingUSD, remainingSurplus);
                        const newRemainingUSD = oldSale.remainingUSD - amountToApply;
                        const newPaidUSD = (oldSale.paidUSD || 0) + amountToApply;
                        
                        const oldSaleRef = doc(db, "businesses", businessId, "sales", oldSale.id);
                        transaction.update(oldSaleRef, {
                            paidUSD: newPaidUSD,
                            remainingUSD: newRemainingUSD,
                            status: newRemainingUSD < 0.01 ? 'contado' : 'abono'
                        });

                        remainingSurplus -= amountToApply;
                    }

                    // 4. Crear Registros de Pago (vinculados a la venta actual pero con nota si hubo excedente)
                    const todayStr = new Date().toLocaleDateString('sv-SE');
                    for (const p of payments) {
                        const payRef = doc(collection(db, "businesses", businessId, "payments"));
                        transaction.set(payRef, {
                            ...p,
                            saleId: saleRef.id,
                            clientId: selectedClient.id,
                            clientName: selectedClient.fullName,
                            businessId,
                            storeId: storeId || 'general',
                            storeName: storeName,
                            employeeEmail: auth.currentUser?.email,
                            employeeName: localStorage.getItem('employeeName') || 'Admin',
                            date: todayStr,
                            createdAt: serverTimestamp(),
                            isCombinedPayment: surplus > 0.01,
                            surplusAppliedToDebt: surplus > 0.01 ? surplus : 0
                        });
                    }
                });

                showNotification("✅ Venta procesada y deuda actualizada.");
                includeOldDebt = false;
                cart = [];
                payments = [];
                selectedClient = null;
                currentView = 'cart';
                render();
                
            } catch (err) {
                console.error("Sale error:", err);
                showNotification("Error al procesar la venta: " + err.message);
                finishBtn.disabled = false;
                finishBtn.textContent = '✅ FINALIZAR VENTA';
            }
        });
    }

    function showConfirmModal(title, msg, onConfirm, confirmText = "Confirmar", cancelText = "Volver") {
        const modal = document.createElement('div');
        modal.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 4000; display: flex; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div class="card" style="width: 90%; max-width: 400px; padding: 2rem; text-align: center; animation: modalIn 0.3s ease-out;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🧾</div>
                <h3 style="margin-bottom: 0.5rem;">${title}</h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">${msg}</p>
                <div style="display: flex; gap: 1rem;">
                    <button id="cancelFinalBtn" class="btn btn-outline" style="flex: 1;">${cancelText}</button>
                    <button id="confirmFinalBtn" class="btn btn-primary" style="flex: 1; background: var(--success); border-color: var(--success);">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#cancelFinalBtn').onclick = () => modal.remove();
        modal.querySelector('#confirmFinalBtn').onclick = () => {
            modal.remove();
            onConfirm();
        };
    }

    function renderHistoryView() {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; gap: 4px;">
                <div class="card" style="padding: 0.5rem 1.25rem; display: flex; align-items: center; gap: 1rem; justify-content: space-between; flex: none; margin: 0;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <button id="backToCartBtn" class="btn btn-outline" style="width: auto; padding: 0.35rem 0.7rem; font-size: 0.8rem;">← Volver</button>
                        <h2 style="margin: 0; font-size: 1.1rem;">📅 Ventas del Día</h2>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button id="refreshHistoryBtn" class="btn btn-outline" style="width: auto; padding: 0.35rem 0.7rem; font-size: 0.8rem;">🔄 Actualizar</button>
                    </div>
                </div>

                <div id="historySummary" style="margin-bottom: 4px; flex: none;"></div>

                <div class="card" style="flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem; margin: 0;">
                    ${dailySales.length === 0 
                        ? '<p class="text-muted" style="text-align: center; padding: 3rem;">No hay ventas registradas hoy.</p>'
                        : `
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border); text-align: left; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                                    <th style="padding: 0.45rem 0.75rem;">Hora</th>
                                    <th style="padding: 0.45rem 0.75rem;">Cliente</th>
                                    <th style="padding: 0.45rem 0.75rem;">Tienda / Vendedor</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: right;">Total</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: center;">Estado</th>
                                    <th style="padding: 0.45rem 0.75rem;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${dailySales.map((sale, i) => {
                                    const time = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--';
                                    const statusColor = sale.status === 'contado' ? 'var(--success)' : sale.status === 'abono' ? 'var(--warning)' : 'var(--danger)';
                                    return `
                                    <tr style="border-bottom: 1px solid var(--border); font-size: 0.8rem;">
                                        <td style="padding: 0.45rem 0.75rem;">${time}</td>
                                        <td style="padding: 0.45rem 0.75rem;">
                                            <div style="font-weight: bold;">${sale.clientName}</div>
                                            <div style="font-size: 0.65rem; color: var(--text-muted);">${sale.clientId}</div>
                                        </td>
                                        <td style="padding: 0.45rem 0.75rem;">
                                            <div style="font-size: 0.7rem;">🏪 ${sale.storeName}</div>
                                            <div style="font-size: 0.7rem; color: var(--text-muted);">👤 ${sale.employeeName}</div>
                                        </td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: right; font-weight: 800;">$${fmt(sale.totalUSD)}</td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: center;">
                                            <span style="padding: 0.15rem 0.4rem; border-radius: 4px; background: ${statusColor}1A; color: ${statusColor}; font-weight: bold; font-size: 0.65rem; text-transform: uppercase;">
                                                ${sale.status}
                                            </span>
                                        </td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: right;">
                                            <button class="btn btn-outline view-sale-detail" data-index="${i}" style="width: auto; padding: 0.2rem 0.4rem; font-size: 0.7rem;">Ver Detalle</button>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        `
                    }
                </div>
            </div>

            <!-- Detail Modal -->
            <div id="saleDetailModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 2rem; position: relative;">
                    <button id="closeDetailBtn" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer;">✕</button>
                    <div id="modalContent"></div>
                </div>
            </div>
        `;

        container.querySelector('#backToCartBtn').addEventListener('click', () => {
            currentView = 'cart';
            render();
        });

        container.querySelector('#refreshHistoryBtn').addEventListener('click', async () => {
            const btn = container.querySelector('#refreshHistoryBtn');
            btn.disabled = true;
            btn.textContent = '⏳...';
            await loadDailySales();
            render();
        });


        container.querySelectorAll('.view-sale-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const sale = dailySales[parseInt(btn.dataset.index)];
                showSaleDetail(sale);
            });
        });

        const modal = container.querySelector('#saleDetailModal');
        container.querySelector('#closeDetailBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        loadHistorySummary(container.querySelector('#historySummary'));
    }

    async function loadHistorySummary(summaryContainer) {
        if (!summaryContainer) return;
        const todayStr = new Date().toLocaleDateString('sv-SE');
        
        let pq = query(collection(db, "businesses", businessId, "payments"), 
                       where("date", "==", todayStr));
        
        if (role !== 'admin') {
            pq = query(pq, where("employeeEmail", "==", auth.currentUser.email));
        }

        const pSnap = await getDocs(pq);
        const totals = {
            'PUNTO': 0, 'PAGO_MOVIL': 0, 'TRANSFERENCIA': 0, 'EFECTIVO_BS': 0,
            'EFECTIVO_USD': 0, 'ZELLE': 0, 'PAYPAL': 0, 'BINANCE': 0
        };

        pSnap.forEach(doc => {
            const p = doc.data();
            // Strict filter based on session
            let pass = false;
            if (role !== 'admin') {
                pass = (p.employeeEmail === auth.currentUser?.email);
            } else {
                pass = (p.storeId === 'general') || (!p.storeId) || (p.storeName === 'Almacén General');
            }

            if (!pass) return;

            const method = p.method;
            const currency = p.currency;
            
            if (currency === 'BS') {
                if (method === 'PUNTO') totals.PUNTO += p.amount;
                else if (method === 'PAGO_MOVIL') totals.PAGO_MOVIL += p.amount;
                else if (method === 'TRANSFERENCIA') totals.TRANSFERENCIA += p.amount;
                else if (method === 'EFECTIVO') totals.EFECTIVO_BS += p.amount;
            } else {
                if (method === 'EFECTIVO') totals.EFECTIVO_USD += p.amount;
                else if (method === 'ZELLE') totals.ZELLE += p.amount;
                else if (method === 'PAYPAL') totals.PAYPAL += p.amount;
                else if (method === 'BINANCE') totals.BINANCE += p.amount;
            }
        });

        summaryContainer.innerHTML = `
            <div class="card" style="background: var(--surface); border: 1px solid var(--border); padding: 0.6rem 1.25rem; flex: none; margin: 0;">
                <h3 style="font-size: 0.75rem; margin-bottom: 0.4rem; color: var(--primary); display: flex; align-items: center; gap: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em;">
                    <span>📊</span> Resumen de Recaudación (Caja)
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 0.4rem;">
                    <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Punto de Venta</p>
                        <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.PUNTO)}</p>
                    </div>
                    <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Pago Móvil</p>
                        <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.PAGO_MOVIL)}</p>
                    </div>
                    <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Transferencia</p>
                        <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.TRANSFERENCIA)}</p>
                    </div>
                    <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Bs. Efectivo</p>
                        <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.EFECTIVO_BS)}</p>
                    </div>
                    <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">$ Efectivo</p>
                        <p style="font-weight: 800; font-size: 0.9rem; color: var(--success);">$ ${fmt(totals.EFECTIVO_USD)}</p>
                    </div>
                    <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Zelle</p>
                        <p style="font-weight: 800; font-size: 0.9rem; color: var(--success);">$ ${fmt(totals.ZELLE)}</p>
                    </div>
                    <div style="padding: 0.2rem 0.5rem; border-right: 1px solid var(--border);">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">PayPal</p>
                        <p style="font-weight: 800; font-size: 0.9rem; color: var(--success);">$ ${fmt(totals.PAYPAL)}</p>
                    </div>
                    <div style="padding: 0.2rem 0.5rem;">
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Binance</p>
                        <p style="font-weight: 800; font-size: 0.9rem; color: var(--success);">$ ${fmt(totals.BINANCE)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    async function showSaleDetail(sale) {
        const modal = container.querySelector('#saleDetailModal');
        const content = container.querySelector('#modalContent');

        const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id));
        const paySnap = await getDocs(q);
        const salePayments = paySnap.docs.map(doc => doc.data());

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em;">Resumen de Venta</div>
                <h2 style="margin: 0.5rem 0;">Factura: ${sale.id.slice(-6).toUpperCase()}</h2>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleString() : sale.date}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <div>
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Cliente</h4>
                    <p style="font-weight: bold; margin: 0;">${sale.clientName}</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">ID: ${sale.clientId}</p>
                </div>
                <div style="text-align: right;">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Estado</h4>
                    <span style="padding: 0.2rem 0.6rem; border-radius: 4px; background: var(--primary)1A; color: var(--primary); font-weight: bold; font-size: 0.8rem; text-transform: uppercase;">
                        ${sale.status}
                    </span>
                </div>
            </div>

            <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">Productos</h4>
            <div style="margin-bottom: 2rem;">
                ${sale.items.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.9rem;">
                        <span>${item.qty} x ${item.name}</span>
                        <span style="font-weight: bold;">$${fmt(item.total)}</span>
                    </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--border); padding-top: 0.75rem; margin-top: 0.75rem; font-weight: 800; font-size: 1.1rem;">
                    <span>TOTAL</span>
                    <span style="color: var(--primary);">$${fmt(sale.totalUSD)}</span>
                </div>
                <div style="text-align: right; color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem;">Bs. ${fmt(sale.totalBs)}</div>
            </div>

            <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">Pagos Recibidos</h4>
            <div style="margin-bottom: 1rem;">
                ${salePayments.length === 0 ? '<p class="text-sm text-muted">No se registraron pagos.</p>' : 
                  salePayments.map(p => `
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                        <span>${p.method} ${p.ref ? `(Ref: ${p.ref})` : ''}</span>
                        <span style="font-weight: bold;">${p.currency} ${fmt(p.amount)}</span>
                    </div>
                  `).join('')
                }
            </div>

            <div style="background: var(--background); padding: 1rem; border-radius: 8px; margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Pendiente de Cobro</div>
                    <div style="font-size: 1.1rem; font-weight: 800; color: var(--danger);">$${fmt(sale.remainingUSD || 0)}</div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: var(--text-muted);">
                    Registrado por: ${sale.employeeName}<br>
                    Tienda: ${sale.storeName}
                </div>
            </div>

            <div style="margin-top: 2rem;">
                <button id="modalCloseBtn" class="btn btn-primary">Cerrar Detalle</button>
            </div>
        `;

        content.querySelector('#modalCloseBtn').onclick = () => {
            modal.style.display = 'none';
        };

        modal.style.display = 'flex';
    }

    loadData();
}
