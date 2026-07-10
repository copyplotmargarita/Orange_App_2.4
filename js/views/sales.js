import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification, formatDateToDDMMYYYY } from '../utils.js';
import { doc, setDoc, getDocs, getDoc, updateDoc, collection, query, orderBy, where, addDoc, serverTimestamp, runTransaction, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { renderClients } from './clients.js';

export function renderSales(container, preSelectedClient = null) {
    // State
    let products = [];
    let clients = [];
    let cart = [];
    let payments = [];
    const hash = window.location.hash;
    let currentView = 'cart';
    if (hash === '#sales/history') {
        currentView = 'history';
    }
    let activeMobileTab = 'products'; // 'products' or 'cart'
    let includeOldDebt = false;
    let currentPausedSaleId = null;

    
    // Attempt to restore state if returning from client creation or history
    const savedState = sessionStorage.getItem('sales_temp_state');
    if (savedState) {
        const state = JSON.parse(savedState);
        cart = state.cart || [];
        payments = state.payments || [];
        
        // Only overwrite currentView if not forced by hash
        if (hash !== '#sales/history') {
            currentView = state.currentView || 'cart';
        }
        
        // Clear state once it's been restored
        sessionStorage.removeItem('sales_temp_state');
    }

    let bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
    const appConfig = JSON.parse(localStorage.getItem('appConfig') || '{}');
    const taxConfig = appConfig.tax || { enabled: false, name: 'Impuesto', rate: 0 };

    let settings = {
        type: 'venta',
        target: 'detal',
        priceType: 'precioDetal'
    };

    const resetSettings = () => {
        settings = {
            type: 'venta',
            target: 'detal',
            priceType: 'precioDetal'
        };
        // Update header dropdowns if they exist
        const typeSelect = container.querySelector('#saleType');
        const targetSelect = container.querySelector('#saleTarget');
        const priceSelect = container.querySelector('#priceType');
        if (typeSelect) typeSelect.value = 'venta';
        if (targetSelect) targetSelect.value = 'detal';
        if (priceSelect) priceSelect.value = 'precioDetal';
    };
    let convertingBudgetId = null;
    let historyFilter = 'todos'; // 'todos', 'ventas', 'presupuestos'
    let selectedClient = preSelectedClient;
    let clientDebt = 0;
    let searchProductTerm = '';
    let activePayCurrency = 'BS';
    let tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    let deliveryDate = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
    
    let dailySales = [];
    let allPedidos = [];
    
    let today = new Date();
    let selectedPedidoDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let selectedOrderStatusFilter = 'Todos';

    let stores = [];
    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    const cachedName = userEmail ? localStorage.getItem(`userName_${userEmail}`) : null;
    const currentEmployeeName = cachedName || 'Admin';
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
            const todayStr = new Date().toLocaleDateString('sv-SE');
            const shiftStartStr = localStorage.getItem('shiftStartTime');
            // Si hay turno, se usa esa fecha, si no (caso borde), se usa un inicio muy lejano
            const shiftStart = shiftStartStr ? new Date(shiftStartStr) : new Date('2099-01-01T00:00:00Z');
            const localStoreId = localStorage.getItem('storeId');

            // Arreglo de promesas para ejecutar en paralelo y ahorrar tiempo de carga
            const promises = [];

            // 0: Products
            promises.push(getDocs(collection(db, "businesses", businessId, "products")).then(snap => {
                const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                prods.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
                return prods;
            }));

            // 1: Local Inventory (if employee)
            if (role === 'employee' && localStoreId) {
                promises.push(getDocs(collection(db, "businesses", businessId, "stores", localStoreId, "inventory"))
                    .then(snap => {
                        const storeStockMap = {};
                        snap.forEach(doc => storeStockMap[doc.id] = doc.data().qty || 0);
                        return storeStockMap;
                    })
                    .catch(e => {
                        console.warn("No se pudo cargar inventario local:", e.message);
                        return {};
                    })
                );
            } else {
                promises.push(Promise.resolve(null));
            }

            // 2: Clients
            promises.push(getDocs(collection(db, "businesses", businessId, "clients")).then(snap => {
                const clis = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                clis.sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
                return clis;
            }));

            // 3: Stores (if admin)
            if (role === 'admin') {
                promises.push(getDocs(collection(db, "businesses", businessId, "stores")).then(snap => {
                    const sts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    sts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
                    return sts;
                }));
            } else {
                promises.push(Promise.resolve(null));
            }

            // 4: Daily Sales (filtradas por el inicio del turno actual)
            let qSales = query(collection(db, "businesses", businessId, "sales"), where("createdAt", ">=", shiftStart));
            promises.push(getDocs(qSales).then(snap => {
                let s = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return s.filter(sale => sale.employeeEmail === userEmail);
            }));

            // 5: Payments (filtrados por el inicio del turno actual)
            let pq = query(collection(db, "businesses", businessId, "payments"), where("createdAt", ">=", shiftStart));
            promises.push(getDocs(pq).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

            // 6: Pedidos
            let qPed = query(collection(db, "businesses", businessId, "sales"), where("deliveryDate", "==", selectedPedidoDate));
            promises.push(getDocs(qPed).then(snap => {
                let p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                p = p.filter(s => s.employeeEmail === userEmail);
                return p;
            }).catch(async e => {
                let qFallback = query(collection(db, "businesses", businessId, "sales"), where("isOrder", "==", true));
                const snap = await getDocs(qFallback);
                let p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                p = p.filter(s => s.employeeEmail === userEmail);
                return p.filter(s => s.deliveryDate === selectedPedidoDate);
            }));

            // Esperar que todas las peticiones terminen SIMULTANEAMENTE
            const [prodsRes, storeStockMap, clisRes, stsRes, allSales, allPayments, pedidosRes] = await Promise.all(promises);

            // Asignar variables globales
            products = prodsRes || [];
            clients = clisRes || [];
            if (stsRes) stores = stsRes;
            allPedidos = pedidosRes || [];

            // Merge local inventory
            if (role === 'employee' && storeStockMap) {
                products = products.map(p => ({
                    ...p,
                    stockGeneral: storeStockMap[p.id] !== undefined ? storeStockMap[p.id] : (p.stockGeneral ?? p.stock ?? 0)
                }));
            }

            // Process Daily Sales
            const activeStoreId = role === 'admin' ? 'general' : (localStorage.getItem('storeId') || 'general');
            dailySales = (allSales || []).filter(sale => {
                return sale.employeeEmail === userEmail;
            }).map(sale => {
                const salePayments = (allPayments || []).filter(p => p.saleId === sale.id);
                const methods = [...new Set(salePayments.map(p => {
                    let m = p.method || 'Efectivo';
                    if (m.includes('EFECTIVO')) return 'Efectivo';
                    if (m === 'PAGO_MOVIL') return 'Pago Móvil';
                    if (m === 'TRANSFERENCIA') return 'Transferencia';
                    if (m === 'PUNTO') return 'Punto';
                    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
                }))];
                let paymentMethodStr = methods.length === 0 ? '--' : (methods.length > 1 ? 'Múltiple' : methods[0]);
                if (sale.status === 'presupuesto') paymentMethodStr = '--';
                return { ...sale, paymentMethodStr };
            });
            dailySales.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            // Renderizar la vista principal
            if (window.openOrderRecovery) {
                delete window.openOrderRecovery;
                setTimeout(() => {
                    historyFilter = 'pedidos';
                    currentView = 'orders';
                    render();
                }, 100);
            } else {
                render();
            }

            // Listen for paused sales to toggle pulse animation
            const pausedQuery = query(collection(db, "businesses", businessId, "paused_sales"));
            onSnapshot(pausedQuery, (snap) => {
                const btn = container.querySelector('#recoverSaleBtn');
                if (btn) {
                    if (!snap.empty) {
                        btn.classList.add('pulse-recover-btn');
                    } else {
                        btn.classList.remove('pulse-recover-btn');
                    }
                }
            });

        } catch (error) {
            console.error("Error cargando datos:", error);
            container.innerHTML = `<div class="text-danger">Error al cargar los datos. Detalle: ${error.message}</div>`;
        }
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
                'PUNTO': 0, 'PAGO_MOVIL': 0, 'TRANSFERENCIA': 0, 'EFECTIVO_BS': 0, 'BIO_PAGO': 0,
                'EFECTIVO_USD': 0, 'ZELLE': 0, 'PAYPAL': 0, 'BINANCE': 0
            };

            snap.forEach(doc => {
                const p = doc.data();

                if (role === 'admin' || p.employeeEmail === userEmail) {
                    const method = p.method || 'EFECTIVO';
                    const amount = p.amount || 0;
                    const currency = p.currency || 'USD';

                    if (currency === 'BS') {
                        if (method === 'PUNTO') totals.PUNTO += amount;
                        else if (method === 'PAGO_MOVIL') totals.PAGO_MOVIL += amount;
                        else if (method === 'TRANSFERENCIA') totals.TRANSFERENCIA += amount;
                        else if (method === 'EFECTIVO') totals.EFECTIVO_BS += amount;
                        else if (method === 'BIO_PAGO') totals.BIO_PAGO += amount;
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
                            <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Bio Pago</p>
                            <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.BIO_PAGO)}</p>
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

    // refactor_sales.js
    function render() {
        if (currentView === 'history') {
            renderHistoryView();
        } else if (currentView === 'orders') {
            renderOrdersView();
        } else {
            renderSingleView();
        }
    }

    function getPrice(product) {
        if (!product) return 0;
        let type = settings.priceType || 'precioDetal';
        if (type === 'precioDetal') type = 'priceDetal';
        if (type === 'precioMayor') type = 'priceMayor';
        if (type === 'precioSpecial') type = 'priceSpecial';
        return product[type] || product.priceDetal || 0;
    }

    function renderProductList() {
        const term = searchProductTerm.trim().toLowerCase();
        let filtered = products.filter(p => !(p.category === 'INSUMO' && p.isSaleable === false));
        
        if (term) {
            filtered = filtered.filter(p => (p.name && p.name.toLowerCase().includes(term)) || (p.barcode && p.barcode.includes(term)));
        }

        if (filtered.length === 0) {
            return `
            <div class="col-span-full py-12 flex flex-col items-center justify-center text-outline">
                <span class="material-symbols-outlined text-[48px] mb-sm opacity-50">inventory_2</span>
                <p class="text-body-lg">No se encontraron productos</p>
            </div>`;
        }

        return filtered.map(p => {
            const price = getPrice(p);
            const stock = p.stockGeneral ?? p.stock ?? 0;
            return `
            <div class="product-card group bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 transition-all cursor-pointer relative focus:outline-none focus:ring-4 focus:ring-primary focus:border-primary" data-id="${p.id}" tabindex="0">
                <div class="h-28 bg-surface-variant/30 flex items-center justify-center p-sm border-b border-outline-variant relative overflow-hidden group-hover:bg-primary/5 transition-colors bg-white">
                    ${p.image ? `<img src="${p.image}" alt="${p.name}" class="max-h-full max-w-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform duration-300">` : `<span class="material-symbols-outlined text-[48px] text-outline-variant group-hover:text-primary/40 transition-colors" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">inventory_2</span>`}
                </div>
                <div class="p-sm flex-1 flex flex-col justify-between bg-surface-container-lowest" style="height: 120px;">
                    <div>
                        <h4 class="text-body-sm font-semibold text-on-surface leading-tight group-hover:text-primary transition-colors" title="${p.name}" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.8em; font-size: 0.75rem; line-height: 1.4em;">${p.name}</h4>
                        ${p.barcode ? `<p class="text-label-sm text-outline mt-xs font-mono truncate" style="font-size: 0.65rem;">${p.barcode}</p>` : ''}
                    </div>
                    <div class="flex flex-col items-end mt-auto gap-1 pb-1">
                        <span class="text-body-sm font-bold ${stock > 10 ? 'text-green-500' : (stock > 0 ? 'text-yellow-500' : 'text-red-500')}">${Number(Number(stock).toFixed(3))} ${p.stockUnit || 'ud'}</span>
                        <span class="text-body-md font-bold text-white leading-none">$ ${fmt(price)}</span>
                        <span class="text-body-md font-bold text-white leading-none">Bs. ${fmt(price * bcvRate)}</span>
                    </div>
                </div>
                <div class="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors pointer-events-none"></div>
            </div>`;
        }).join('');
    }

    function attachProductClickEvents() {
        const cards = Array.from(container.querySelectorAll('.product-card'));
        cards.forEach((card, index) => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const p = products.find(prod => prod.id === id);
                if (!p) return;
                const stock = p.stockGeneral ?? p.stock ?? 0;
                if (stock <= 0) {
                    showToast("Atención: Producto sin stock (Inventario Negativo)", true);
                }
                
                showProductSaleModal(p, (qty, unit, extras) => {
                    const price = getPrice(p);
                    const isBox = (unit === p.purchaseUnit && unit !== p.stockUnit);
                    const unitContent = isBox ? (parseFloat(p.purchaseToStockQty) || 1) : 1;
                    const realQty = qty * unitContent;

                    const extraTotal = (extras || []).reduce((sum, e) => sum + e.price, 0);
                    const totalUnitPrice = price + extraTotal;

                    const existing = cart.find(i => i.id === id && i.sellUnit === unit && JSON.stringify(i.extras || []) === JSON.stringify(extras || []));
                    if (existing) {
                        if ((existing.realQty || existing.qty) + realQty > stock) {
                            showToast("Atención: Stock insuficiente (Inventario Negativo)", true);
                        }
                        existing.qty += qty;
                        existing.realQty = (existing.realQty || existing.qty) + realQty;
                        existing.total = existing.realQty * totalUnitPrice;
                        searchProductTerm = "";
                        render();
                    } else {
                        if (realQty > stock) {
                            showToast("Atención: Stock insuficiente (Inventario Negativo)", true);
                        }
                        cart.push({ 
                            id: p.id, 
                            name: p.name, 
                            price: price, 
                            qty: qty, 
                            unitContent: unitContent,
                            realQty: realQty,
                            total: totalUnitPrice * realQty, 
                            sellUnit: unit,
                            baseUnit: p.stockUnit || 'Unidad',
                            baseCostUSD: p.costPerUnit || p.cost || 0,
                            extras: extras || []
                        });
                        searchProductTerm = "";
                        render();
                    }
                }, 1, p.stockUnit || 'Unidad');
            });
            
            // Keyboard navigation
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    card.click();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (index < cards.length - 1) cards[index + 1].focus();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (index > 0) cards[index - 1].focus();
                    else container.querySelector('#productSearch')?.focus();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const rect = card.getBoundingClientRect();
                    let target = null;
                    let minXDiff = Infinity;
                    for (let i = index + 1; i < cards.length; i++) {
                        const nextRect = cards[i].getBoundingClientRect();
                        if (nextRect.top > rect.bottom - 10) {
                            const xDiff = Math.abs(nextRect.left - rect.left);
                            if (xDiff < minXDiff) {
                                minXDiff = xDiff;
                                target = cards[i];
                            }
                        }
                    }
                    if (target) target.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const rect = card.getBoundingClientRect();
                    let target = null;
                    let minXDiff = Infinity;
                    for (let i = index - 1; i >= 0; i--) {
                        const prevRect = cards[i].getBoundingClientRect();
                        if (prevRect.bottom < rect.top + 10) {
                            const xDiff = Math.abs(prevRect.left - rect.left);
                            if (xDiff < minXDiff) {
                                minXDiff = xDiff;
                                target = cards[i];
                            }
                        }
                    }
                    if (target) target.focus();
                    else container.querySelector('#productSearch')?.focus();
                }
            });
        });
    }

    function renderSingleView() {
        const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
        const taxAmountUSD = taxConfig.enabled ? subtotalUSD * taxConfig.rate / 100 : 0;
        const baseWithTaxUSD = subtotalUSD + taxAmountUSD;
        const effectiveTotalUSD = includeOldDebt ? baseWithTaxUSD + clientDebt : baseWithTaxUSD;
        const totalBs = effectiveTotalUSD * bcvRate;
        const totalItems = cart.length;
        let netPaidUSD = 0;
        let grossPaidUSD = 0;
        let actualDeliveredUSD = 0;
        let actualDeliveredBS = 0;
        let actualVueltoUSD = 0;
        let actualVueltoBS = 0;
        
        payments.forEach(p => {
            const amountInUSD = p.currency === 'USD' ? p.amount : p.amount / p.rate;
            netPaidUSD += amountInUSD;
            if (amountInUSD > 0) {
                grossPaidUSD += amountInUSD;
            }
            if (p.amount > 0) {
                if (p.currency === 'USD') actualDeliveredUSD += p.amount;
                else actualDeliveredBS += p.amount;
            } else if (p.amount < 0) {
                if (p.currency === 'USD') actualVueltoUSD += Math.abs(p.amount);
                else actualVueltoBS += Math.abs(p.amount);
            }
        });

        const currentRemainingUSD = Math.max(0, effectiveTotalUSD - netPaidUSD);
        const currentChangeUSD = Math.max(0, netPaidUSD - effectiveTotalUSD);
        const isVueltoPending = currentChangeUSD > 0.009;
        const isRestaPending = currentRemainingUSD > 0.009;
        const isFullyPaid = !isVueltoPending && !isRestaPending;
        const saleStatus = container.querySelector('#saleStatus')?.value || (payments.length === 0 ? 'contado' : 'abono');

        container.innerHTML = `
        <div class="app-container h-full flex flex-col text-on-surface bg-background" style="font-family: 'Inter', sans-serif;">
            <div class="flex flex-1 overflow-hidden">
                <!-- Main Content Area -->
                <main class="flex-1 overflow-hidden bg-surface-dim flex flex-col">
                    <section class="flex-1 flex flex-col overflow-hidden">
                        <div class="flex px-container-margin pt-sm pb-sm mb-sm justify-between items-center shrink-0" style="min-height: 60px;">
                            <div class="flex items-center flex-stack-mobile" style="gap: 1.5rem; flex: 1;">
                                <button id="backToDashboardBtn2" class="btn btn-outline flex-shrink-0" style="height: 38px; width: auto; font-size: 0.85rem; padding: 0 1rem; white-space: nowrap;">← Volver</button>
                                <h2 class="flex-shrink-0" style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 0; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem;">🛒 Ventas</h2>
                                <button id="viewHistoryBtn" class="btn btn-primary" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; margin-left: 0.5rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">calendar_today</span>
                                    Ventas del Día
                                </button>
                                <button id="viewBudgetsBtn" class="btn btn-outline" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; margin-left: 0.5rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">request_quote</span>
                                    Presupuestos
                                </button>
                                <button id="viewOrdersBtn" class="btn btn-outline" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; margin-left: 0.5rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">package</span>
                                    Pedidos
                                </button>
                            </div>
                            <div class="relative flex items-center bg-surface-container-high rounded-xl px-md h-10 border border-outline-variant md:w-96">
                                <span class="material-symbols-outlined text-outline">search</span>
                                <input id="productSearch" class="bg-transparent border-none focus:ring-0 text-body-md w-full ml-sm text-on-surface placeholder-outline" placeholder="Buscar producto..." type="text" value="${searchProductTerm}">
                            </div>
                        </div>
                        <div id="productList" class="flex-1 overflow-y-auto px-container-margin pb-20">
                            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-md content-start">
                                ${renderProductList()}
                            </div>
                        </div>
                    </section>
                </main>

                <!-- Right Sidebar (Cart) -->
                <aside class="w-80 lg:w-[400px] xl:w-[450px] bg-surface-container-low border-l border-outline-variant flex flex-col h-full shadow-2xl z-40">
                    <div class="p-md border-b border-outline-variant">
                        <div class="flex justify-between items-center mb-md">
                            <h3 class="font-headline-md text-headline-md text-on-surface m-0">Detalles de Venta</h3>
                            <div class="flex gap-2">
                                <button id="pauseSaleBtn" class="btn btn-primary" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">pause</span>
                                    <span>Pausar</span>
                                </button>
                                <button id="recoverSaleBtn" class="btn btn-primary" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">folder_open</span>
                                    <span>Recuperar</span>
                                </button>
                            </div>
                        </div>
                    
                        <div class="grid grid-cols-2 gap-sm mb-md">
                            <div class="form-group">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Operación</label>
                                <select id="saleType" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                    <option value="venta" ${settings.type === 'venta' ? 'selected' : ''}>Venta</option>
                                    <option value="presupuesto" ${settings.type === 'presupuesto' ? 'selected' : ''}>Presupuesto</option>
                                    <option value="pedido" ${settings.type === 'pedido' ? 'selected' : ''}>Pedidos</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Tipo Precio</label>
                                <select id="priceType" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                    <option value="precioDetal" ${settings.priceType === 'precioDetal' ? 'selected' : ''}>Detal</option>
                                    <option value="precioMayor" ${settings.priceType === 'precioMayor' ? 'selected' : ''}>Mayor</option>
                                    <option value="precioSpecial" ${settings.priceType === 'precioSpecial' ? 'selected' : ''}>Especial</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-sm mb-md">
                            <div class="form-group">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Estado de Venta</label>
                                <select id="saleStatus" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" ${settings.type === 'presupuesto' ? 'disabled' : ''}>
                                    ${settings.type === 'presupuesto' ? '<option value="presupuesto" selected>PRESUPUESTO</option>' : `
                                    <option value="contado" ${saleStatus === 'contado' ? 'selected' : ''}>Contado</option>
                                    <option value="abono" ${saleStatus === 'abono' ? 'selected' : ''}>Abono</option>
                                    <option value="credito" ${saleStatus === 'credito' ? 'selected' : ''}>Crédito</option>
                                    `}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Tipo de Venta</label>
                                <select id="saleTarget" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                    <option value="mayor" ${settings.target === 'mayor' ? 'selected' : ''}>Mayor</option>
                                    <option value="detal" ${settings.target === 'detal' ? 'selected' : ''}>Detal</option>
                                </select>
                            </div>
                        </div>

                        ${settings.type === 'pedido' ? `
                        <div class="mb-md relative">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Fecha de Entrega</label>
                            <input type="text" id="deliveryDateInput" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" value="${deliveryDate}">
                        </div>` : ''}

                        <div class="mb-md relative">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Cliente</label>
                            <div class="flex items-center gap-sm mt-xs p-sm bg-surface-container-high rounded-lg border border-outline-variant focus-within:border-primary transition-colors group">
                                <span class="material-symbols-outlined text-outline group-focus-within:text-primary">person</span>
                                <div class="flex-1 relative">
                                    <input id="clientSearch" class="bg-transparent border-none focus:ring-0 text-body-md font-semibold text-on-surface w-full p-0 outline-none" placeholder="Buscar cliente..." type="text" value="${selectedClient ? selectedClient.fullName : ''}"/>
                                    ${selectedClient ? `<p class="text-label-sm text-outline mt-1">${selectedClient.id}</p>` : ''}
                                    <div id="clientResults" class="absolute top-full left-0 right-0 bg-surface border border-outline-variant z-50 max-h-48 overflow-y-auto rounded-lg shadow-xl mt-1 hidden"></div>
                                </div>
                                ${selectedClient ? `
                                <button id="removeClientBtn" class="material-symbols-outlined text-error cursor-pointer hover:bg-error/10 rounded-full p-1 transition-colors" title="Remover cliente">close</button>
                                ` : `
                                <button id="createNewClientBtn" class="material-symbols-outlined text-primary cursor-pointer hover:bg-primary/10 rounded-full p-1 transition-colors" title="Crear cliente">person_add</button>
                                `}
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto p-md">
                        <div class="flex justify-between items-center mb-sm">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Carrito</label>
                            ${cart.length > 0 ? '<button id="cancelCartBtn" class="text-error text-label-sm font-bold uppercase hover:underline">Vaciar</button>' : ''}
                        </div>
                        <div class="flex flex-col gap-sm">
                            ${cart.length === 0 ? '<p class="text-outline text-center py-4 text-body-md">El carrito está vacío</p>' : ''}
                            ${cart.map((item, index) => {
                                const prod = products.find(p => p.id === item.id);
                                return `
                                <div class="flex justify-between items-center p-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors border border-outline-variant group cursor-pointer edit-qty" data-index="${index}">
                                    <div class="flex-1 min-w-0 pr-2">
                                        <p class="text-body-md font-semibold text-on-surface truncate group-hover:text-primary">${item.name}</p>
                                        <p class="text-label-sm text-outline">
                                            ${Number(Number(item.qty).toFixed(3))} ${item.sellUnit || 'ud'}
                                            ${(item.unitContent && item.unitContent > 1) ? ` x ${item.unitContent} ${item.baseUnit || 'ud'} ` : ''}
                                            x $ ${fmt(item.price)}
                                        </p>
                                        ${(item.extras && item.extras.length > 0) ? `
                                            <p class="text-label-sm text-primary mt-1 font-bold">
                                                + Extras: ${item.extras.map(e => `${e.name} ($${fmt(e.price)})`).join(', ')}
                                            </p>
                                        ` : ''}
                                    </div>
                                    <div class="flex items-center gap-sm">
                                        <p class="font-label-sm text-primary font-bold">$ ${fmt(item.total)}</p>
                                        <button class="material-symbols-outlined text-outline hover:text-error transition-colors btn-remove" data-index="${index}" style="font-size: 18px;">delete</button>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                            ${includeOldDebt ? `
                            <div class="flex justify-between items-center p-sm rounded-lg bg-error/10 border border-error/30">
                                <div class="flex-1 min-w-0 pr-2">
                                    <p class="text-body-md font-bold text-error truncate">DEUDA PENDIENTE</p>
                                    <p class="text-label-sm text-error/80">Referencial (No facturable)</p>
                                </div>
                                <div class="flex items-center gap-sm">
                                    <p class="font-label-sm text-error font-bold">$ ${fmt(clientDebt)}</p>
                                    <button class="material-symbols-outlined text-error/80 hover:text-error transition-colors btn-remove-debt" style="font-size: 18px;">delete</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </aside>
            </div>

            <!-- Global Footer Section -->
            <footer class="bg-surface-container border-t border-outline-variant p-md z-50 shrink-0 h-[116px]">
                <div class="flex gap-md h-full items-center">
                    <!-- 1. ITEMS -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">ITEMS</p>
                        <p class="text-display-metrics text-white" style="font-size: 24px;">${totalItems}</p>
                    </div>

                    <!-- 2. RESTA / VUELTO -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center border-l-4 ${(isVueltoPending || isFullyPaid) ? 'border-l-green-400' : 'border-l-red-500'}">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">${isVueltoPending ? 'VUELTO' : 'RESTA'}</p>
                        <div class="flex flex-col">
                            <p class="text-body-lg font-bold ${(isVueltoPending || isFullyPaid) ? 'text-green-400' : 'text-red-500'} leading-tight">$ ${isVueltoPending ? fmt(currentChangeUSD) : fmt(currentRemainingUSD)}</p>
                            <p class="text-body-lg font-bold ${(isVueltoPending || isFullyPaid) ? 'text-green-400' : 'text-red-500'} leading-tight">Bs ${isVueltoPending ? fmt(currentChangeUSD * bcvRate) : fmt(currentRemainingUSD * bcvRate)}</p>
                        </div>
                    </div>

                    <!-- 3. VUELTOS (Delivered back) -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">VUELTOS</p>
                        <div class="flex flex-col">
                            <p class="text-body-lg font-bold text-green-400 leading-tight">$ ${fmt(actualVueltoUSD)}</p>
                            <p class="text-body-lg font-bold text-green-400 leading-tight">Bs ${fmt(actualVueltoBS)}</p>
                        </div>
                    </div>
                
                    <!-- 4. ENTREGADO -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">ENTREGADO</p>
                        <div class="flex flex-col">
                            <p class="text-body-lg font-bold text-white leading-tight">$ ${fmt(actualDeliveredUSD)}</p>
                            <p class="text-body-lg font-bold text-white leading-tight">Bs ${fmt(actualDeliveredBS)}</p>
                        </div>
                    </div>

                    <!-- 5. DEUDA CLIENTE -->
                    <div id="pullDebtBtn" class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm border-l-4 ${clientDebt > 0 ? 'border-l-error cursor-pointer hover:bg-error/10' : 'border-l-outline'} flex flex-col justify-center transition-colors">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">DEUDA CLIENTE ${includeOldDebt ? '(CARGADA)' : ''}</p>
                        <p class="text-headline-md font-display-metrics ${clientDebt > 0 ? 'animate-pulse-text-red' : 'text-white'} whitespace-nowrap">$ ${fmt(clientDebt)}</p>
                    </div>

                    <!-- 6. TOTAL EN BS -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">TOTAL EN BS</p>
                        <p class="text-headline-md font-display-metrics text-white whitespace-nowrap leading-tight text-[18px]">Bs ${fmt(totalBs)}</p>
                    </div>

                    <!-- 7. TOTAL EN $ -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm border-l-4 border-l-primary flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">TOTAL EN $</p>
                        <p class="text-headline-md font-display-metrics text-white whitespace-nowrap">$ ${fmt(effectiveTotalUSD)}</p>
                    </div>
                
                    <!-- 8. CARGAR PAGO -->
                    <button id="openPaymentModalBtn" class="flex-2 h-full border-2 border-primary text-primary bg-transparent rounded-lg font-bold uppercase tracking-wider text-body-md hover:bg-primary/10 transition-all shadow-sm active:scale-[0.98] focus:bg-primary focus:text-white focus:outline-none" style="min-width: 140px;" ${settings.type === 'presupuesto' ? 'disabled style="opacity:0.5"' : ''}>CARGAR PAGO</button>
                    <!-- 9. FINALIZAR -->
                    <button id="finishBtn" class="flex-2 h-full border-2 border-primary text-primary bg-transparent rounded-lg font-bold uppercase tracking-wider text-body-md hover:bg-primary/10 transition-all shadow-sm active:scale-[0.98] focus:bg-primary focus:text-white focus:outline-none" style="min-width: 140px;">${settings.type === 'presupuesto' ? 'PRESUPUESTO' : 'FINALIZAR'}</button>
                </div>
            </footer>

            <!-- Toast Notification -->
            <div id="toast" class="fixed bottom-container-margin left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-lg py-md rounded-xl shadow-2xl flex items-center gap-md transform translate-y-32 transition-transform duration-300 z-[100]">
                <span class="material-symbols-outlined text-secondary">check_circle</span>
                <span id="toastMsg" class="font-body-lg">Acción completada</span>
            </div>
        </div>
        `;

        // Clock and Date
        const clockSpan = container.querySelector('#clockSpan');
        const dateSpan = container.querySelector('#dateSpan');
        if (clockSpan && dateSpan) {
            const now = new Date();
            clockSpan.textContent = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
            dateSpan.textContent = now.toLocaleDateString('es-VE');
        }

        // Bind events
        const navHomeLogic = () => {
            const navHome = document.getElementById('navHome');
            if (navHome) {
                navHome.click();
                const toggleIcon = document.getElementById('toggleIcon');
                if (toggleIcon && toggleIcon.innerText === '▶') document.getElementById('sidebarToggle')?.click();
            } else {
                window.location.hash = '#dashboard';
            }
        };
        container.querySelector('#backToDashboardBtn')?.addEventListener('click', navHomeLogic);
        container.querySelector('#backToDashboardBtn2')?.addEventListener('click', navHomeLogic);

        container.querySelector('#viewHistoryBtn')?.addEventListener('click', () => {
            historyFilter = 'ventas';
            currentView = 'history';
            render();
        });

        container.querySelector('#viewBudgetsBtn')?.addEventListener('click', () => {
            historyFilter = 'presupuestos';
            currentView = 'history';
            render();
        });

        container.querySelector('#viewOrdersBtn')?.addEventListener('click', () => {
            currentView = 'orders';
            render();
        });

        const searchInput = container.querySelector('#productSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const rawVal = e.target.value.toLowerCase();
                
                // Atajo para Cliente
                if (rawVal === 'cc') {
                    e.target.value = '';
                    searchProductTerm = '';
                    const clientInput = container.querySelector('#clientSearch');
                    if (clientInput) {
                        clientInput.focus();
                        clientInput.select();
                    }
                    return; // Detenemos la búsqueda
                }
                
                // Atajo para Pagar
                if (rawVal === 'pp') {
                    e.target.value = '';
                    searchProductTerm = '';
                    const payBtn = container.querySelector('#openPaymentModalBtn');
                    if (payBtn) payBtn.focus();
                    return;
                }
                
                // Atajo para Finalizar
                if (rawVal === 'ff') {
                    e.target.value = '';
                    searchProductTerm = '';
                    const processBtn = container.querySelector('#finishBtn');
                    if (processBtn && !processBtn.disabled) processBtn.focus();
                    return;
                }

                searchProductTerm = rawVal;
                const productListWrapper = container.querySelector('#productList');
                if (productListWrapper) {
                    productListWrapper.innerHTML = `
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-md content-start">
                            ${renderProductList()}
                        </div>
                    `;
                }
                attachProductClickEvents();
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const firstCard = container.querySelector('.product-card');
                    if (firstCard) firstCard.focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstCard = container.querySelector('.product-card');
                    if (firstCard) firstCard.click();
                }
            });
            
            // Auto-focus on render
            setTimeout(() => {
                if (document.activeElement !== searchInput) {
                    searchInput.focus();
                    const val = searchInput.value;
                    searchInput.value = '';
                    searchInput.value = val;
                }
            }, 50);
        }

        container.querySelector('#pauseSaleBtn')?.addEventListener('click', pauseCurrentSale);
        container.querySelector('#recoverSaleBtn')?.addEventListener('click', showPausedSalesModal);

        container.querySelector('#saleType').addEventListener('change', (e) => { settings.type = e.target.value; render(); });
        container.querySelector('#saleTarget').addEventListener('change', (e) => { settings.target = e.target.value; render(); });
        if (typeof flatpickr !== 'undefined' && container.querySelector('#deliveryDateInput')) {
            // Parse YYYY-MM-DD into a valid Date object to avoid flatpickr format confusion
            const parts = deliveryDate.split('-');
            const defDate = new Date(parts[0], parts[1] - 1, parts[2]);
            
            flatpickr(container.querySelector('#deliveryDateInput'), {
                dateFormat: "d/m/Y",
                defaultDate: defDate,
                locale: "es",
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        const d = selectedDates[0];
                        const yy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        deliveryDate = `${yy}-${mm}-${dd}`;
                    }
                }
            });
        }
        
        container.querySelector('#priceType').addEventListener('change', (e) => {
            settings.priceType = e.target.value;
            cart = cart.map(item => {
                const prod = products.find(p => p.id === item.id);
                const newPrice = getPrice(prod);
                return { ...item, price: newPrice, total: newPrice * item.qty };
            });
            render();
        });
        container.querySelector('#saleStatus')?.addEventListener('change', (e) => {
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

        container.querySelector('#cancelCartBtn')?.addEventListener('click', () => {
            showConfirmModal("Cancelar Venta", "¿Está seguro que desea cancelar esta venta y vaciar el carrito?", () => {
                cart = []; payments = []; selectedClient = null; clientDebt = 0; includeOldDebt = false;
                sessionStorage.removeItem('sales_temp_state');
                render();
            }, "Sí, Cancelar", "No, Volver");
        });

        // Client search logic
        const clientSearch = container.querySelector('#clientSearch');
        const clientResults = container.querySelector('#clientResults');
        if (clientSearch) {
            clientSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                if (term.length < 2) {
                    clientResults.style.display = 'none';
                    return;
                }
                const termClean = term.replace(/[-.]/g, '');
                const isNumeric = /^[a-z]?\d+$/.test(termClean);

                const filtered = clients.filter(c => {
                    if (isNumeric) {
                        const idClean = (c.id || '').toLowerCase().replace(/[-.]/g, '');
                        const idDigits = (c.id || '').replace(/\D/g, '');
                        const phoneClean = (c.phone || '').replace(/\D/g, '');
                        const termDigits = term.replace(/\D/g, '');
                        
                        return idClean.startsWith(termClean) || 
                               (termDigits && idDigits.startsWith(termDigits)) || 
                               (termDigits.length > 2 && phoneClean.includes(termDigits));
                    } else {
                        return c.fullName && c.fullName.toLowerCase().includes(term);
                    }
                });
            
                if (filtered.length > 0) {
                    clientResults.innerHTML = filtered.map(c => `
                        <div class="client-option p-sm hover:bg-surface-variant cursor-pointer border-b border-outline-variant last:border-0 focus:outline-none focus:bg-surface-variant focus:ring-2 focus:ring-primary" data-id="${c.id}" tabindex="0">
                            <p class="font-bold text-on-surface">${c.fullName}</p>
                            <p class="text-label-sm text-outline">${c.id} | ${c.phone || 'Sin tel.'}</p>
                        </div>
                    `).join('');
                } else {
                    clientResults.innerHTML = `
                        <div class="create-client-option p-sm hover:bg-surface-variant cursor-pointer border-b border-outline-variant text-primary flex items-center gap-2 focus:outline-none focus:bg-surface-variant focus:ring-2 focus:ring-primary" tabindex="0">
                            <span class="material-symbols-outlined">person_add</span>
                            <p class="font-bold">Crear nuevo cliente: "${e.target.value}"</p>
                        </div>
                    `;
                }
            
                clientResults.style.display = 'block';
            
                container.querySelectorAll('.client-option').forEach(opt => {
                    opt.addEventListener('click', async () => {
                        const selected = clients.find(c => c.id === opt.dataset.id);
                        selectedClient = selected;
                        clientSearch.value = selected.fullName;
                        clientResults.style.display = 'none';
                        clientDebt = await calculateClientDebt(selected.id);
                        render();
                    });
                });
                
                const createOpt = container.querySelector('.create-client-option');
                if (createOpt) {
                    createOpt.addEventListener('click', () => {
                        const currentSearch = clientSearch.value;
                        sessionStorage.setItem('sales_temp_state', JSON.stringify({ cart, payments, currentView: 'cart' }));
                        renderClients(container, (newClient) => {
                            renderSales(container, newClient);
                        }, currentSearch);
                    });
                }

                // Keyboard navigation for dropdown
                const options = Array.from(clientResults.querySelectorAll('.client-option, .create-client-option'));
                options.forEach((opt, index) => {
                    opt.addEventListener('keydown', (e) => {
                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (index < options.length - 1) options[index + 1].focus();
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (index > 0) options[index - 1].focus();
                            else clientSearch.focus();
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            opt.click();
                        }
                    });
                });
            });

            clientSearch.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const firstOption = clientResults.querySelector('.client-option, .create-client-option');
                    if (firstOption && clientResults.style.display !== 'none') firstOption.focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstOption = clientResults.querySelector('.client-option, .create-client-option');
                    if (firstOption && clientResults.style.display !== 'none') firstOption.click();
                }
            });

            // Hide results on outside click
            document.addEventListener('click', (e) => {
                if (clientResults && !clientSearch.contains(e.target) && !clientResults.contains(e.target)) {
                    clientResults.style.display = 'none';
                }
            });
        }

        container.querySelector('#removeClientBtn')?.addEventListener('click', () => {
            selectedClient = null;
            clientDebt = 0;
            includeOldDebt = false;
            render();
        });

        container.querySelector('#createNewClientBtn')?.addEventListener('click', () => {
            const currentSearch = clientSearch.value;
            sessionStorage.setItem('sales_temp_state', JSON.stringify({ cart, payments, currentView: 'cart' }));
            renderClients(container, (newClient) => {
                renderSales(container, newClient);
            }, currentSearch);
        });

        attachProductClickEvents();

        container.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                cart.splice(parseInt(btn.dataset.index), 1);
                render();
            });
        });

        const btnRemoveDebt = container.querySelector('.btn-remove-debt');
        if (btnRemoveDebt) {
            btnRemoveDebt.addEventListener('click', (e) => {
                e.stopPropagation();
                includeOldDebt = false;
                render();
            });
        }

        container.querySelectorAll('.edit-qty').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.closest('.btn-remove')) return;
                const index = parseInt(btn.dataset.index);
                const item = cart[index];
                const prod = products.find(p => p.id === item.id);
                if (!prod) return;
                const stock = prod ? (prod.stockGeneral ?? prod.stock ?? 0) : 999999;
                showProductSaleModal(prod, (newQty, newUnit, newExtras) => {
                    const isBox = (newUnit === prod.purchaseUnit && newUnit !== prod.stockUnit);
                    const unitContent = isBox ? (parseFloat(prod.purchaseToStockQty) || 1) : 1;
                    const realQty = newQty * unitContent;

                    if (realQty > stock) {
                        showToast("Atención: Stock insuficiente (Inventario Negativo)", true);
                    }
                    
                    const extraTotal = (newExtras || []).reduce((sum, e) => sum + e.price, 0);
                    item.extras = newExtras || [];
                    item.qty = parseFloat(newQty);
                    item.sellUnit = newUnit;
                    item.unitContent = unitContent;
                    item.realQty = realQty;
                    item.total = realQty * (item.price + extraTotal);
                    item.baseUnit = prod.stockUnit || 'Unidad';
                    render();
                }, item.qty, item.sellUnit, item.extras || []);
            });
        });

        container.querySelector('#openPaymentModalBtn')?.addEventListener('click', () => {
            if (!selectedClient && settings.type !== 'presupuesto') {
                showToast("Debe seleccionar un cliente primero", true);
                return;
            }
            showPaymentModal(effectiveTotalUSD);
        });

        container.querySelector('#finishBtn').addEventListener('click', () => {
            if (!selectedClient) {
                showToast("Debe seleccionar un cliente primero", true);
                return;
            }
            const status = container.querySelector('#saleStatus')?.value || 'contado';
            if ((status === 'contado' || status === 'abono') && payments.length === 0 && settings.type !== 'presupuesto' && settings.type !== 'pedido') {
                showToast("Debe registrar al menos un pago", true);
                return;
            }
            processSale(currentRemainingUSD);
        });
    }

    function showProductSaleModal(product, callback, initialQty = 1, initialUnit = null, initialExtras = []) {
        const modal = document.createElement('div');
        modal.className = "fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-md animate-in fade-in";
        
        const sellU = product.stockUnit || 'Unidad';
        const purchU = product.purchaseUnit || 'Caja';
        const currentUnit = initialUnit || sellU;

        const isReceta = product.category === 'RECETA';
        let extrasAvailable = [];
        let extrasHtml = '';
        if (isReceta) {
            extrasAvailable = products.filter(p => p.category?.toUpperCase() === 'EXTRAS' || p.category?.toUpperCase() === 'EXTRA');
            if (extrasAvailable.length > 0) {
                extrasHtml = `
                <div class="form-group mt-sm">
                    <label class="text-label-bold font-label-bold text-outline uppercase">Extras (Opcional)</label>
                    <div class="flex flex-col gap-xs mt-xs max-h-32 overflow-y-auto custom-scrollbar">
                        ${extrasAvailable.map(ext => {
                            const isChecked = initialExtras.find(e => e.id === ext.id) ? 'checked' : '';
                            return `
                            <label class="flex items-center gap-sm p-xs bg-surface-container-high rounded border border-outline-variant cursor-pointer hover:border-primary transition-colors">
                                <input type="checkbox" class="extra-checkbox accent-primary" value="${ext.id}" ${isChecked}>
                                <span class="text-body-sm flex-1 truncate">${ext.name}</span>
                                <span class="text-label-bold text-primary">+$${fmt(getPrice(ext))}</span>
                            </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                `;
            } else {
                extrasHtml = `<div class="form-group mt-sm text-label-sm text-outline italic">No hay extras disponibles (Cree productos con categoría 'EXTRAS')</div>`;
            }
        }

        modal.innerHTML = `
            <div class="bg-surface-container border border-outline-variant rounded-xl w-full max-w-sm p-lg shadow-2xl flex flex-col gap-md">
                <h3 class="text-headline-md font-bold text-primary">${product.name}</h3>
                
                <div class="form-group">
                    <label class="text-label-bold font-label-bold text-outline uppercase">Tipo de Venta</label>
                    <select id="saleUnitType" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                        <option value="${sellU}" ${currentUnit === sellU ? 'selected' : ''}>🔄 ${sellU.toUpperCase()}</option>
                        ${sellU.toLowerCase() !== purchU.toLowerCase() ? `<option value="${purchU}" ${currentUnit === purchU ? 'selected' : ''}>📦 ${purchU.toUpperCase()}</option>` : ''}
                    </select>
                </div>
                
                ${extrasHtml}

                <div class="form-group">
                    <label class="text-label-bold font-label-bold text-outline uppercase">Cantidad</label>
                    <input type="text" inputmode="numeric" id="saleQty" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" value="">
                </div>

                <div class="flex gap-md mt-sm pt-md border-t border-outline-variant">
                    <button id="cancelModalBtn" class="flex-1 bg-surface-variant text-primary border border-primary rounded-lg font-bold py-2 hover:bg-primary/10 transition-colors">CANCELAR</button>
                    <button id="confirmModalBtn" class="flex-1 bg-primary text-white rounded-lg font-bold py-2 hover:bg-primary/90 transition-colors">AÑADIR</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Autofocus and format for ATM styling
        const qtyInput = modal.querySelector('#saleQty');
        
        const initialVal = parseFloat(initialQty) || 1;
        qtyInput.value = initialVal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        qtyInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (!val) val = '0';
            const num = parseInt(val, 10) / 100;
            e.target.value = num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });

        qtyInput.addEventListener('click', () => {
            qtyInput.value = '';
        });

        setTimeout(() => { 
            qtyInput.focus(); 
            // Select text if we don't clear, but since we clear on click, we don't necessarily need select here. 
            // However, focus() triggers when modal opens, we might just clear it immediately or keep it highlighted?
            // If we clear it immediately, they can't just hit enter for 1. Let's keep the initial value but highlight it.
            // On click, clear it.
            qtyInput.select();
        }, 100);

        qtyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') modal.querySelector('#confirmModalBtn').click();
        });

        modal.querySelector('#cancelModalBtn').onclick = () => { modal.remove(); };
        modal.querySelector('#confirmModalBtn').onclick = () => {
            const cleanStr = qtyInput.value.replace(/\./g, '').replace(',', '.');
            const qty = parseFloat(cleanStr) || 1;
            const unit = modal.querySelector('#saleUnitType').value;
            
            const selectedExtras = [];
            modal.querySelectorAll('.extra-checkbox:checked').forEach(cb => {
                const ext = extrasAvailable.find(e => e.id === cb.value);
                if (ext) {
                    selectedExtras.push({ id: ext.id, name: ext.name, price: getPrice(ext) });
                }
            });

            modal.remove();
            callback(qty, unit, selectedExtras);
        };
    }

    function showPaymentModal(remainingUSD) {
        const modal = document.createElement('div');
        modal.className = "fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-md animate-in fade-in";
    
        // Default currency to empty so user has to select it
        activePayCurrency = '';
        const amountBS = remainingUSD * bcvRate;
    
        modal.innerHTML = `
            <div class="bg-surface-container border border-outline-variant rounded-xl w-full max-w-lg p-lg shadow-2xl flex flex-col gap-md">
                <div class="flex justify-between items-center border-b border-outline-variant pb-sm">
                    <h3 class="text-headline-md font-bold text-primary">Cargar Pago</h3>
                    <button id="closePayModal" class="material-symbols-outlined text-outline hover:text-error transition-colors">close</button>
                </div>
            
                <div class="grid grid-cols-2 gap-md">
                    <div class="col-span-2 form-group">
                        <label class="text-label-bold font-label-bold text-outline uppercase">Moneda</label>
                        <div class="flex gap-sm mt-xs" id="currencyGroup">
                            <button class="pay-currency-btn flex-1 py-2 rounded-lg font-bold border transition-all bg-surface-container-high border-outline-variant text-on-surface hover:bg-surface-variant focus:outline-none focus:border-primary focus:text-primary focus:bg-primary/5" data-value="BS">Bolívares (Bs)</button>
                            <button class="pay-currency-btn flex-1 py-2 rounded-lg font-bold border transition-all bg-surface-container-high border-outline-variant text-on-surface hover:bg-surface-variant focus:outline-none focus:border-primary focus:text-primary focus:bg-primary/5" data-value="USD">Dólares ($)</button>
                        </div>
                        <input type="hidden" id="payCurrency" value="${activePayCurrency}">
                    </div>
                    <div class="col-span-2 form-group">
                        <label class="text-label-bold font-label-bold text-outline uppercase">Método</label>
                        <div class="flex flex-nowrap overflow-x-auto gap-sm mt-xs pb-1 custom-scrollbar" id="methodGroup">
                        </div>
                        <input type="hidden" id="payMethod" value="">
                    </div>
                    <div class="col-span-2 sm:col-span-1 form-group">
                        <label class="text-label-bold font-label-bold text-outline uppercase">Monto</label>
                        <input type="text" id="payAmount" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" value="">
                    </div>
                    <div class="form-group" id="payRefGroup" style="display: none;">
                        <label class="text-label-bold font-label-bold text-outline uppercase">Referencia</label>
                        <input type="text" id="payRef" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" placeholder="Ej. 1234">
                    </div>
                </div>
            
                <div class="mt-sm">
                    <h4 class="text-label-sm uppercase text-outline mb-xs border-b border-outline-variant pb-xs">Pagos Actuales</h4>
                    <div id="paymentsList" class="flex flex-col gap-xs max-h-32 overflow-y-auto hide-scrollbar">
                        ${payments.length === 0 ? '<p class="text-body-md text-outline text-center py-2">Ninguno</p>' : ''}
                    </div>
                </div>

                <div id="changeSection" class="mt-sm" style="display: none;">
                    <div class="bg-surface-container-highest rounded-lg border border-outline-variant border-l-4 border-l-green-500 p-md flex flex-col mb-sm shadow-md">
                        <span class="text-label-md font-bold uppercase text-on-surface mb-xs">Vuelto a Entregar</span>
                        <div class="flex flex-col gap-0">
                            <span class="text-headline-sm font-bold text-green-400" id="vueltoUSD">$ 0,00</span>
                            <span class="text-headline-sm font-bold text-green-400" id="vueltoBS">Bs 0,00</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-sm">
                        <div class="form-group">
                            <label class="text-[10px] font-label-bold text-white uppercase">Entregado en Bs</label>
                            <input type="text" id="changeGivenBs" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none" value="">
                        </div>
                        <div class="form-group">
                            <label class="text-[10px] font-label-bold text-white uppercase">Entregado en $</label>
                            <input type="text" id="changeGivenUSD" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none" value="">
                        </div>
                    </div>
                    <button id="addChangeBtn" class="w-full mt-sm bg-surface-variant text-green-400 border border-green-500/30 rounded-lg font-bold py-2 hover:bg-green-500/10 transition-colors uppercase text-sm">Registrar Vuelto</button>
                </div>

                <div class="flex gap-md mt-sm pt-md border-t border-outline-variant">
                    <button id="addPaymentBtn" class="flex-1 bg-surface-variant text-primary border border-primary rounded-lg font-bold py-2 hover:bg-primary/10 transition-colors">AÑADIR PAGO</button>
                    <button id="donePayBtn" class="flex-1 bg-primary text-white rounded-lg font-bold py-2 hover:bg-primary/90 transition-colors">LISTO</button>
                </div>
            </div>
        `;
    
        document.body.appendChild(modal);

        const payCurrency = modal.querySelector('#payCurrency');
        const payMethod = modal.querySelector('#payMethod');
        const payAmount = modal.querySelector('#payAmount');
        const payRefGroup = modal.querySelector('#payRefGroup');
        const payRef = modal.querySelector('#payRef');
        const paymentsList = modal.querySelector('#paymentsList');

        const renderPaymentsList = () => {
            if(payments.length === 0) {
                paymentsList.innerHTML = '<p class="text-body-md text-outline text-center py-2">Ninguno</p>';
                return;
            }
            paymentsList.innerHTML = payments.map((p, i) => {
                const isVuelto = p.amount < 0;
                const label = isVuelto ? `VUELTO (${p.method.replace('_', ' ')})` : `${p.method.replace('_', ' ')} ${p.ref ? '(#'+p.ref+')' : ''}`;
                const color = isVuelto ? 'text-green-400' : 'text-primary';
                return `
                <div class="flex justify-between items-center p-xs bg-surface-container-highest rounded border border-outline-variant ${isVuelto ? 'border-l-4 border-l-green-400' : ''}">
                    <span class="text-label-sm font-bold ${isVuelto ? 'text-green-400' : ''}">${label}</span>
                    <div class="flex items-center gap-sm">
                        <span class="text-label-sm ${color} font-bold">${p.currency} ${fmt(Math.abs(p.amount))}</span>
                        <button class="material-symbols-outlined text-error hover:text-error/80 text-[18px] btn-rem-pay" data-index="${i}">close</button>
                    </div>
                </div>
            `}).join('');
        
            modal.querySelectorAll('.btn-rem-pay').forEach(b => {
                b.onclick = () => {
                    payments.splice(parseInt(b.dataset.index), 1);
                    renderPaymentsList();
                    // update original remaining
                    let paid = 0;
                    payments.forEach(px => paid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
                    const newRem = Math.max(0, (includeOldDebt ? remainingUSD : remainingUSD) - paid);
                    updatePayMethods(newRem);
                };
            });
        };

        const currencyGroupBtns = Array.from(modal.querySelectorAll('.pay-currency-btn'));
        currencyGroupBtns.forEach((btn, index) => {
            btn.onclick = () => {
                payCurrency.value = btn.dataset.value;
                activePayCurrency = payCurrency.value;
                currencyGroupBtns.forEach(b => {
                    if (b.dataset.value === payCurrency.value) {
                        b.className = "pay-currency-btn flex-1 py-2 rounded-lg font-bold border transition-all bg-primary text-white border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";
                    } else {
                        b.className = "pay-currency-btn flex-1 py-2 rounded-lg font-bold border transition-all bg-surface-container-high border-outline-variant text-on-surface hover:bg-surface-variant focus:outline-none focus:border-primary focus:text-primary focus:bg-primary/5";
                    }
                });
                let paid = 0;
                payments.forEach(px => paid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
                const rem = Math.max(0, remainingUSD - paid);
                updatePayMethods(rem, true);
                
                // Keyboard flow: Focus first method after selecting currency
                setTimeout(() => {
                    const firstMethod = modal.querySelector('.pay-method-btn');
                    if (firstMethod) firstMethod.focus();
                }, 50);
            };
            
            // Allow selecting currency with Enter and navigating with arrows
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btn.click();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (index < currencyGroupBtns.length - 1) currencyGroupBtns[index + 1].focus();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (index > 0) currencyGroupBtns[index - 1].focus();
                }
            });
        });

        const updatePayMethods = (currRem, resetAmount = true) => {
            const currency = payCurrency.value;
            let methods = [];
            if (currency === 'USD') {
                methods = [
                    {val: 'EFECTIVO', label: 'Efectivo'},
                    {val: 'ZELLE', label: 'Zelle'},
                    {val: 'BINANCE', label: 'Binance'},
                    {val: 'PAYPAL', label: 'PayPal'}
                ];
            } else {
                methods = [
                    {val: 'PUNTO', label: 'Punto'},
                    {val: 'PAGO_MOVIL', label: 'Pago Móvil'},
                    {val: 'BIO_PAGO', label: 'Bio Pago'},
                    {val: 'EFECTIVO', label: 'Efectivo'},
                    {val: 'TRANSFERENCIA', label: 'Transf.'}
                ];
            }

            if (!methods.find(m => m.val === payMethod.value)) {
                payMethod.value = ''; // Start unselected
            }

            const methodGroup = modal.querySelector('#methodGroup');
            methodGroup.innerHTML = methods.map(m => `
                <button class="pay-method-btn flex-shrink-0 min-w-max py-2 px-3 rounded-lg font-bold border transition-all text-sm truncate focus:outline-none ${payMethod.value === m.val ? 'bg-primary text-white border-primary focus:ring-2 focus:ring-primary focus:ring-offset-1' : 'bg-surface-container-high border-outline-variant text-on-surface hover:bg-surface-variant focus:border-primary focus:text-primary focus:bg-primary/5'}" data-value="${m.val}">${m.label}</button>
            `).join('');

            const methodBtns = Array.from(modal.querySelectorAll('.pay-method-btn'));
            methodBtns.forEach((btn, index) => {
                btn.onclick = () => {
                    payMethod.value = btn.dataset.value;
                    const amountValStr = payAmount.value.replace(/\./g, '').replace(',', '.');
                    updatePayMethods(parseFloat(amountValStr) || currRem, false);
                    
                    // Keyboard flow: Focus amount after selecting method
                    setTimeout(() => {
                        payAmount.focus();
                    }, 50);
                };

                btn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        btn.click();
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        if (index < methodBtns.length - 1) methodBtns[index + 1].focus();
                    } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        if (index > 0) methodBtns[index - 1].focus();
                        else {
                            const selectedCurr = modal.querySelector('.pay-currency-btn.bg-primary');
                            if (selectedCurr) selectedCurr.focus();
                        }
                    }
                });
            });
        
            const isElectronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(payMethod.value);
            payRefGroup.style.display = isElectronic ? 'block' : 'none';
        
            if (resetAmount) {
                const amount = currency === 'BS' ? (currRem * bcvRate) : currRem;
                payAmount.value = (Math.max(0, amount)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            let totalPaid = 0;
            payments.forEach(px => totalPaid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
            const actualRem = remainingUSD - totalPaid;
            const changeSec = modal.querySelector('#changeSection');
            if (changeSec) {
                if (actualRem < -0.009) {
                    changeSec.style.display = 'block';
                    modal.querySelector('#vueltoUSD').textContent = `$ ${fmt(-actualRem)}`;
                    modal.querySelector('#vueltoBS').textContent = `Bs ${fmt(-actualRem * bcvRate)}`;
                    modal.querySelector('#changeGivenBs').dataset.suggested = (-actualRem * bcvRate).toString();
                    modal.querySelector('#changeGivenUSD').dataset.suggested = (-actualRem).toString();
                } else {
                    changeSec.style.display = 'none';
                }
            }
        };

        // input mask - ATM style and clear on click
        payAmount.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (!val) val = '0';
            const num = parseInt(val, 10) / 100;
            e.target.value = num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });

        payAmount.addEventListener('click', (e) => {
            e.target.value = '';
        });

        payAmount.addEventListener('focus', (e) => {
            // Also select on focus for tab navigation
            e.target.select();
        });

        payAmount.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const amount = parseNum(payAmount.value);
                
                let paid = 0;
                payments.forEach(px => paid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
                const actualRem = remainingUSD - paid;
                
                // Si la deuda está saldada (ni debe, ni hay vuelto) y el monto actual es 0, completamos
                if (amount <= 0 && actualRem <= 0.009 && actualRem >= -0.009) {
                    modal.querySelector('#donePayBtn').click();
                    return;
                }

                const isElectronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(payMethod.value);
                if (isElectronic && amount > 0) {
                    payRef.focus();
                } else {
                    modal.querySelector('#addPaymentBtn').click();
                }
            }
        });

        payRef.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                modal.querySelector('#addPaymentBtn').click();
            }
        });

        const parseNum = (val) => {
            let s = val.toString().trim().replace(/[^\d.,]/g, '');
            if (!s) return 0;
            const lastComma = s.lastIndexOf(',');
            const lastDot = s.lastIndexOf('.');
            const lastSep = Math.max(lastComma, lastDot);
            if (lastSep === -1) return parseFloat(s) || 0;
            const whole = s.substring(0, lastSep).replace(/[.,]/g, '');
            const frac = s.substring(lastSep + 1);
            return parseFloat(whole + '.' + frac) || 0;
        };

        modal.querySelector('#addPaymentBtn').onclick = () => {
            if (!payCurrency.value) {
                showToast("Debe seleccionar una Moneda primero", true);
                return;
            }
            if (!payMethod.value) {
                showToast("Debe seleccionar un Método de pago", true);
                return;
            }
            const amount = parseNum(payAmount.value);
            if (amount <= 0) return;
            const method = payMethod.value;
            const isElectronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(method);
            if (isElectronic && !payRef.value) {
                showToast("Referencia es requerida", true);
                payRef.focus();
                return;
            }
        
            payments.push({
                method,
                currency: payCurrency.value,
                amount,
                ref: payRef.value || null,
                rate: payCurrency.value === 'BS' ? bcvRate : 1,
                timestamp: new Date().toISOString()
            });
        
            payRef.value = '';
            renderPaymentsList();
        
            let paid = 0;
            payments.forEach(px => paid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
            const rem = Math.max(0, remainingUSD - paid);

            // Flow after adding payment
            if (rem > 0) {
                // Still money to pay, restart cycle: Moneda -> Método
                payCurrency.value = '';
                payMethod.value = '';
                
                modal.querySelectorAll('.pay-currency-btn').forEach(b => {
                    b.className = "pay-currency-btn flex-1 py-2 rounded-lg font-bold border transition-all bg-surface-container-high border-outline-variant text-on-surface hover:bg-surface-variant focus:outline-none focus:border-primary focus:text-primary focus:bg-primary/5";
                });
                
                updatePayMethods(rem);
                
                setTimeout(() => {
                    const firstCurr = modal.querySelector('.pay-currency-btn');
                    if (firstCurr) firstCurr.focus();
                }, 50);
            } else {
                updatePayMethods(rem);
                
                setTimeout(() => {
                    // Paid in full or change needed
                    const actualRem = remainingUSD - paid;
                    if (actualRem < -0.009) {
                        // Needs change
                        const bsInput = modal.querySelector('#changeGivenBs');
                        const usdInput = modal.querySelector('#changeGivenUSD');
                        if (bsInput && bsInput.dataset.suggested > 0) {
                            bsInput.focus();
                        } else if (usdInput) {
                            usdInput.focus();
                        }
                    } else {
                        // Done
                        modal.querySelector('#donePayBtn')?.focus();
                    }
                }, 50);
            }
        };

        modal.querySelector('#closePayModal').onclick = () => { modal.remove(); render(); };
        modal.querySelector('#donePayBtn').onclick = () => { modal.remove(); render(); };

        const addChangeBtn = modal.querySelector('#addChangeBtn');
        if (addChangeBtn) {
            addChangeBtn.onclick = () => {
                const bsVal = parseNum(modal.querySelector('#changeGivenBs').value);
                const usdVal = parseNum(modal.querySelector('#changeGivenUSD').value);
                
                if (bsVal > 0) {
                    payments.push({ method: 'EFECTIVO', currency: 'BS', amount: -bsVal, rate: bcvRate, isChange: true });
                }
                if (usdVal > 0) {
                    payments.push({ method: 'EFECTIVO', currency: 'USD', amount: -usdVal, rate: 1, isChange: true });
                }
                
                if (bsVal > 0 || usdVal > 0) {
                    modal.querySelector('#changeGivenBs').value = '';
                    modal.querySelector('#changeGivenUSD').value = '';
                    renderPaymentsList();
                    let totalPaid = 0;
                    payments.forEach(px => totalPaid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
                    const actualRem = remainingUSD - totalPaid;
                    updatePayMethods(Math.max(0, actualRem), true);
                    
                    setTimeout(() => {
                        if (actualRem < -0.009) {
                            const bsInput = modal.querySelector('#changeGivenBs');
                            if (bsInput) bsInput.focus();
                        } else {
                            const doneBtn = modal.querySelector('#donePayBtn');
                            if (doneBtn) doneBtn.focus();
                        }
                    }, 50);
                }
            };
        }

        const setupChangeInput = (inp, nextElemSelector) => {
            if(!inp) return;
            inp.oninput = (e) => { 
                let val = e.target.value.replace(/\D/g, '');
                if (!val) val = '0';
                const num = parseInt(val, 10) / 100;
                e.target.value = num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };
            inp.onfocus = (e) => { 
                if (inp.id === 'changeGivenBs') {
                    const usdInp = modal.querySelector('#changeGivenUSD');
                    if (usdInp) usdInp.value = '';
                } else if (inp.id === 'changeGivenUSD') {
                    const bsInp = modal.querySelector('#changeGivenBs');
                    if (bsInp) bsInp.value = '';
                }
                
                if (!e.target.value || e.target.value === '0,00') {
                    if (e.target.dataset.suggested) {
                        e.target.value = parseFloat(e.target.dataset.suggested).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                }
                e.target.select();
            };
            inp.onblur = (e) => { 
                if (e.target.value) {
                    e.target.value = parseNum(e.target.value).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            };
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (nextElemSelector) {
                        modal.querySelector(nextElemSelector)?.focus();
                    }
                } else if (e.key === 'ArrowRight' && inp.id === 'changeGivenBs') {
                    e.preventDefault();
                    inp.value = '';
                    const usdInp = modal.querySelector('#changeGivenUSD');
                    if (usdInp) usdInp.focus();
                } else if (e.key === 'ArrowLeft' && inp.id === 'changeGivenUSD') {
                    e.preventDefault();
                    inp.value = '';
                    const bsInp = modal.querySelector('#changeGivenBs');
                    if (bsInp) bsInp.focus();
                }
            });
        };
        setupChangeInput(modal.querySelector('#changeGivenBs'), '#addChangeBtn');
        setupChangeInput(modal.querySelector('#changeGivenUSD'), '#addChangeBtn');
        
        if (addChangeBtn) {
            addChangeBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addChangeBtn.click();
                }
            });
        }

        renderPaymentsList();
        let initialPaid = 0;
        payments.forEach(px => initialPaid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
        updatePayMethods(Math.max(0, remainingUSD - initialPaid));
        
        // Initial focus on open
        setTimeout(() => {
            const firstCurr = modal.querySelector('.pay-currency-btn');
            if (firstCurr) {
                firstCurr.focus();
            }
        }, 100);
    }

    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMsg');
        const icon = toast.querySelector('.material-symbols-outlined');
        if(toast && toastMsg) {
            toastMsg.textContent = message;
            if(isError) {
                toast.classList.replace('bg-inverse-surface', 'bg-error-container');
                toast.classList.replace('text-inverse-on-surface', 'text-on-error-container');
                icon.textContent = 'error';
                icon.classList.replace('text-secondary', 'text-error');
            } else {
                toast.classList.replace('bg-error-container', 'bg-inverse-surface');
                toast.classList.replace('text-on-error-container', 'text-inverse-on-surface');
                icon.textContent = 'check_circle';
                icon.classList.replace('text-error', 'text-secondary');
            }
        
            toast.classList.remove('translate-y-32');
            toast.classList.add('translate-y-0');
            setTimeout(() => {
                toast.classList.add('translate-y-32');
                toast.classList.remove('translate-y-0');
            }, 3000);
        } else {
            showNotification(message); // fallback
        }
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

    async function pauseCurrentSale() {
        if (cart.length === 0 && !selectedClient) {
            showNotification('El carrito está vacío.', 'error');
            return;
        }
        
        const note = selectedClient ? `Venta a ${selectedClient.fullName || selectedClient.name}` : `Venta en espera (${cart.length} items)`;
        
        const pauseBtn = container.querySelector('#pauseSaleBtn');
        if(pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.innerHTML = '<span class="material-symbols-outlined spin" style="font-size: 18px;">autorenew</span>';
        }
        
        try {
            const businessId = localStorage.getItem('businessId');
            const dataToSave = {
                note,
                cart,
                selectedClient,
                payments,
                settings,
                includeOldDebt,
                updatedAt: new Date()
            };

            if (currentPausedSaleId) {
                await updateDoc(doc(db, "businesses", businessId, "paused_sales", currentPausedSaleId), dataToSave);
                showNotification('Venta pausada actualizada.', 'success');
            } else {
                dataToSave.createdAt = new Date();
                await addDoc(collection(db, "businesses", businessId, "paused_sales"), dataToSave);
                showNotification('Venta pausada correctamente.', 'success');
            }
            
            cart = [];
            payments = [];
            selectedClient = null;
            includeOldDebt = false;
            currentPausedSaleId = null;
            render();
        } catch (err) {
            console.error("Error pausing sale:", err);
            showNotification("Error al pausar la venta.", "error");
        } finally {
            if(pauseBtn) {
                pauseBtn.disabled = false;
                pauseBtn.innerHTML = '<span class="material-symbols-outlined text-outline" style="font-size: 18px;">pause</span>';
            }
        }
    }

    async function showPausedSalesModal() {
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
        modal.style.zIndex = '5000';
        modal.innerHTML = `
            <div class="bg-surface rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" style="max-height: 90vh;">
                <div class="p-lg border-b border-outline-variant flex justify-between items-center relative">
                    <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 m-0"><span class="material-symbols-outlined text-primary">folder_open</span> Ventas Pausadas</h2>
                    <button class="btn btn-icon absolute top-4 right-4 text-on-surface-variant hover:text-on-surface" id="closePausedSalesBtn" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;"><span class="material-symbols-outlined" style="font-size: 20px;">close</span></button>
                </div>
                <div class="p-lg overflow-y-auto flex-1 bg-surface-container-lowest" id="pausedSalesContainer">
                    <div class="flex justify-center p-lg"><span class="material-symbols-outlined spin text-4xl text-primary">autorenew</span></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#closePausedSalesBtn').addEventListener('click', () => modal.remove());

        try {
            const q = query(collection(db, "businesses", businessId, "paused_sales"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const containerNode = modal.querySelector('#pausedSalesContainer');
            
            if (snap.empty) {
                containerNode.innerHTML = '<div class="text-center p-lg text-outline">No hay ventas pausadas.</div>';
                return;
            }
            
            let html = '<div class="flex flex-col gap-sm">';
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const total = data.cart.reduce((sum, item) => sum + ((item.price||0) * (item.qty||1)), 0);
                const dateStr = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'Fecha desconocida';
                
                html += `
                    <div class="bg-surface border border-outline-variant rounded-xl p-md flex items-center justify-between hover:border-primary transition-colors">
                        <div>
                            <div class="font-title-md text-title-md text-on-surface font-bold">${data.note || 'Venta'}</div>
                            <div class="text-body-sm text-outline mt-1">${(data.cart||[]).length} ítems • Total: $${total.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
                            <div class="text-label-sm text-outline mt-1">${dateStr}</div>
                        </div>
                        <div class="flex gap-2">
                            <button class="btn btn-outline text-danger border-danger hover:bg-danger hover:text-white flex items-center justify-center p-2 rounded-lg recover-delete-btn" data-id="${docSnap.id}" title="Eliminar">
                                <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
                            </button>
                            <button class="btn btn-primary recover-sale-btn" data-id="${docSnap.id}">
                                Recuperar
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            containerNode.innerHTML = html;

            containerNode.querySelectorAll('.recover-sale-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const docSnap = snap.docs.find(d => d.id === id);
                    if (docSnap) {
                        const data = docSnap.data();
                        cart = data.cart || [];
                        selectedClient = data.selectedClient || null;
                        payments = data.payments || [];
                        settings = data.settings || settings;
                        includeOldDebt = data.includeOldDebt || false;
                        currentPausedSaleId = id;
                        render();
                        modal.remove();
                        showNotification('Venta recuperada.', 'success');
                    }
                });
            });

            containerNode.querySelectorAll('.recover-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = btn.getAttribute('data-id');
                    const itemDiv = e.target.closest('.bg-surface');

                    const confirmModal = document.createElement('div');
                    confirmModal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
                    confirmModal.style.zIndex = '6000';
                    confirmModal.innerHTML = `
                        <div class="bg-surface rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div class="p-lg border-b border-outline-variant">
                                <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 m-0"><span class="material-symbols-outlined text-danger">warning</span> Eliminar Venta</h2>
                            </div>
                            <div class="p-lg text-body-md text-on-surface">
                                ¿Estás seguro de eliminar esta venta pausada? Esta acción no se puede deshacer.
                            </div>
                            <div class="p-lg bg-surface-container-low flex justify-end gap-sm border-t border-outline-variant">
                                <button class="btn btn-outline" id="cancelDeleteBtn">Cancelar</button>
                                <button class="btn btn-primary" style="background-color: var(--danger); border-color: var(--danger);" id="confirmDeleteBtn">Eliminar</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(confirmModal);

                    confirmModal.querySelector('#cancelDeleteBtn').addEventListener('click', () => confirmModal.remove());
                    confirmModal.querySelector('#confirmDeleteBtn').addEventListener('click', async () => {
                        confirmModal.remove();
                        try {
                            itemDiv.style.opacity = '0.5';
                            await deleteDoc(doc(db, "businesses", businessId, "paused_sales", id));
                            itemDiv.remove();
                            if (containerNode.children[0].children.length === 0) {
                                 containerNode.innerHTML = '<div class="text-center p-lg text-outline">No hay ventas pausadas.</div>';
                            }
                            showNotification("Venta pausada eliminada.", "success");
                        } catch (err) {
                            console.error(err);
                            showNotification("Error al eliminar.", "error");
                            itemDiv.style.opacity = '1';
                        }
                    });
                });
            });

        } catch (err) {
            console.error("Error loading paused sales:", err);
            modal.querySelector('#pausedSalesContainer').innerHTML = '<div class="text-center text-danger p-lg">Error al cargar ventas.</div>';
        }
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

        const isPresupuesto = settings.type === 'presupuesto';
        const isPedido = settings.type === 'pedido';

        if (status === 'contado' && remainingUSD > 0.01 && !isPresupuesto && !isPedido) {
            showNotification(`Para una venta de CONTADO debe cubrir el total de la factura. Faltan $${fmt(remainingUSD)}`);
            return;
        }


        let confirmMsg = '';
        let confirmTitle = "Confirmar Venta";

        if (isPresupuesto) {
            confirmTitle = "Confirmar Presupuesto";
            confirmMsg = "¿Está seguro que desea generar este presupuesto? (No afectará el inventario)";
        } else if (isPedido) {
            confirmTitle = "Confirmar Pedido";
            confirmMsg = "¿Está seguro que desea registrar este pedido? (No afectará el inventario hasta facturar)";
        } else {
            confirmMsg = status === 'contado' ? "¿Está seguro de finalizar esta venta?" :
                         status === 'abono' ? "¿Está seguro que desea finalizar esta venta con abono?" :
                         "¿Está seguro que desea finalizar esta venta a crédito?";
        }

        showConfirmModal(confirmTitle, confirmMsg, async () => {
            const finishBtn = container.querySelector('#finishBtn');
            finishBtn.disabled = true;
            finishBtn.textContent = isPresupuesto ? 'Generando...' : isPedido ? 'Guardando...' : 'Procesando...';

            try {
                const subtotalUSD_original = cart.reduce((sum, item) => sum + item.total, 0);
                const totalCostUSD = cart.reduce((sum, item) => sum + ((item.baseCostUSD || 0) * (item.realQty || item.qty * (item.unitContent || 1))), 0);
                const profitUSD = subtotalUSD_original - totalCostUSD;
                const taxAmountUSD_original = taxConfig.enabled ? subtotalUSD_original * taxConfig.rate / 100 : 0;
                const totalUSD_original = subtotalUSD_original + taxAmountUSD_original;
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
                    // Obtener o inicializar correlativo (LECTURA)
                    const counterRef = doc(db, "businesses", businessId, "config", "counters");
                    const counterSnap = await transaction.get(counterRef);

                    // 1. PRIMERO: Realizar todas las LECTURAS (Solo si NO es presupuesto)
                    const prodSnaps = [];
                    const storeSnaps = [];

                    if (!isPresupuesto) {
                        for (const item of cart) {
                            const prodRef = doc(db, "businesses", businessId, "products", item.id);
                            prodSnaps.push({
                                item,
                                ref: prodRef,
                                snap: await transaction.get(prodRef)
                            });

                            if (storeId) {
                                const storeInvRef = doc(db, "businesses", businessId, "stores", storeId, "inventory", item.id);
                                storeSnaps.push({
                                    itemId: item.id,
                                    ref: storeInvRef,
                                    snap: await transaction.get(storeInvRef)
                                });
                            }
                        }
                    }

                    // 2. SEGUNDO: Realizar todas las ESCRITURAS
                    
                    // Actualizar Inventario (Solo si NO es presupuesto y NO es pedido)
                    if (!isPresupuesto && !isPedido) {
                        for (const ps of prodSnaps) {
                            if (ps.snap.exists()) {
                                const pData = ps.snap.data();
                                if (storeId) {
                                    const ss = storeSnaps.find(s => s.itemId === ps.item.id);
                                    const currentStoreStock = (ss && ss.snap.exists()) ? (ss.snap.data().stock || 0) : 0;
                                    const deductQty = ps.item.realQty || ps.item.qty;
                                    transaction.set(ss.ref, { stock: currentStoreStock - deductQty }, { merge: true });
                                } else {
                                    const currentStock = pData.stockGeneral ?? pData.stock ?? 0;
                                    const deductQty = ps.item.realQty || ps.item.qty;
                                    transaction.update(ps.ref, { stockGeneral: currentStock - deductQty });
                                }
                            }
                        }
                    }

                    let isEditingPedido = isPedido && convertingBudgetId;
                    let correlative = '';

                    if (!isEditingPedido) {
                        // Calcular correlativo (Ya leímos el snap arriba)
                        let count = 1;
                        if (isPresupuesto) {
                            count = (counterSnap.exists() ? counterSnap.data().budgets || 0 : 0) + 1;
                            transaction.set(counterRef, { budgets: count }, { merge: true });
                        } else if (isPedido) {
                            count = (counterSnap.exists() ? counterSnap.data().orders || 0 : 0) + 1;
                            transaction.set(counterRef, { orders: count }, { merge: true });
                        } else {
                            count = (counterSnap.exists() ? counterSnap.data().sales || 0 : 0) + 1;
                            transaction.set(counterRef, { sales: count }, { merge: true });
                        }
                        
                        correlative = isPresupuesto ? `PRE-${String(count).padStart(8, '0')}` : 
                                            isPedido ? `PED-${String(count).padStart(8, '0')}` :
                                            `FAC-${String(count).padStart(8, '0')}`;
                    }

                    // Registrar Venta / Presupuesto Actual
                    let saleRef;
                    if (isEditingPedido) {
                        saleRef = doc(db, "businesses", businessId, "sales", convertingBudgetId);
                        transaction.set(saleRef, {
                            items: cart,
                            subtotalUSD: subtotalUSD_original,
                            totalCostUSD: totalCostUSD,
                            profitUSD: profitUSD,
                            taxName: taxConfig.enabled ? taxConfig.name : null,
                            taxRate: taxConfig.enabled ? taxConfig.rate : 0,
                            taxAmountUSD: taxAmountUSD_original,
                            totalUSD: totalUSD_original,
                            totalBs: totalUSD_original * bcvRate,
                            paidUSD: paidToCurrentSale,
                            remainingUSD: currentRemaining,
                            status: currentRemaining < 0.01 ? 'contado' : (paidToCurrentSale > 0.01 ? 'abono' : 'credito'),
                            deliveryDate: deliveryDate,
                            settings: settings,
                            clientId: selectedClient.id,
                            clientName: selectedClient.fullName
                        }, { merge: true });
                    } else {
                        saleRef = doc(collection(db, "businesses", businessId, "sales"));
                        transaction.set(saleRef, {
                            correlative: correlative,
                            items: cart,
                            subtotalUSD: subtotalUSD_original,
                            totalCostUSD: totalCostUSD,
                            profitUSD: profitUSD,
                            taxName: taxConfig.enabled ? taxConfig.name : null,
                            taxRate: taxConfig.enabled ? taxConfig.rate : 0,
                            taxAmountUSD: taxAmountUSD_original,
                            totalUSD: totalUSD_original,
                            totalBs: totalUSD_original * bcvRate,
                            paidUSD: isPresupuesto ? 0 : paidToCurrentSale,
                            remainingUSD: isPresupuesto ? totalUSD_original : currentRemaining,
                            status: isPresupuesto ? 'presupuesto' : isPedido ? 'pedido' : (currentRemaining < 0.01 ? 'contado' : (paidToCurrentSale > 0.01 ? 'abono' : 'credito')),
                            orderStatus: isPedido ? 'Por Entregar' : null,
                            deliveryDate: isPedido ? deliveryDate : null,
                            isOrder: isPedido ? true : null,
                            clientId: selectedClient.id,
                            clientName: selectedClient.fullName,
                            employeeEmail: userEmail,
                            employeeName: currentEmployeeName,
                            storeId: storeId || 'general',
                            storeName: storeName,
                            bcvRate,
                            settings,
                            createdAt: new Date(),
                            date: new Date().toLocaleDateString('sv-SE')
                        });
                    }

                    // Distribuir excedente a ventas antiguas (Solo si NO es presupuesto)
                    let remainingSurplus = surplus;
                    if (!isPresupuesto) {
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
                    }

                    // Crear Registros de Pago (Solo si NO es presupuesto)
                    const todayStr = new Date().toLocaleDateString('sv-SE');
                    if (!isPresupuesto) {
                        for (const p of payments) {
                            if (p.isOld && p.id && convertingBudgetId && !isEditingPedido) {
                                // Transferir el pago antiguo a la nueva factura
                                const oldPayRef = doc(db, "businesses", businessId, "payments", p.id);
                                transaction.update(oldPayRef, { saleId: saleRef.id });
                                continue;
                            }
                            if (p.isOld) continue; // Do not duplicate old payments!
                            
                            const payRef = doc(collection(db, "businesses", businessId, "payments"));
                            transaction.set(payRef, {
                                ...p,
                                saleId: saleRef.id,
                                clientId: selectedClient.id,
                                clientName: selectedClient.fullName,
                                businessId,
                                storeId: storeId || 'general',
                                storeName: storeName,
                                employeeEmail: userEmail,
                                employeeName: currentEmployeeName,
                                date: todayStr,
                                createdAt: new Date(),
                                isCombinedPayment: surplus > 0.01,
                                surplusAppliedToDebt: surplus > 0.01 ? surplus : 0
                            });
                        }
                    }
                });

                showNotification(isPresupuesto ? "✅ Presupuesto generado correctamente." : "✅ Venta procesada y deuda actualizada.");
                includeOldDebt = false;
                cart = [];
                payments = [];
                selectedClient = null;
                currentView = 'cart';
                // Update original budget status if applicable
                if (convertingBudgetId && !isPresupuesto) {
                    const budgetRef = doc(db, "businesses", businessId, "sales", convertingBudgetId);
                    await updateDoc(budgetRef, { status: 'facturado', orderStatus: 'Facturado' });
                }

                if (currentPausedSaleId) {
                    try {
                        await deleteDoc(doc(db, "businesses", businessId, "paused_sales", currentPausedSaleId));
                    } catch (e) {
                        console.error("Error deleting paused sale after process:", e);
                    }
                }
                currentPausedSaleId = null;

                resetSettings();
                convertingBudgetId = null;
                loadData(); // Re-load everything to refresh stocks
                
            } catch (err) {
                console.error("Sale error:", err);
                showNotification("Error al procesar la venta: " + err.message);
                finishBtn.disabled = false;
                finishBtn.textContent = isPresupuesto ? '✅ GENERAR PRESUPUESTO' : '✅ FINALIZAR VENTA';
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
        setTimeout(() => {
            const confirmBtn = modal.querySelector('#confirmFinalBtn');
            if (confirmBtn) confirmBtn.focus();
        }, 50);
    }

    function renderHistoryView() {
        let title = "📅 Ventas del Día";
        if (historyFilter === 'presupuestos') title = "📝 Presupuestos";

        container.innerHTML = `
            <div style="position: absolute; top: 0.75rem; bottom: 0.75rem; left: 0.75rem; right: 0.75rem; display: flex; flex-direction: column; gap: 8px; overflow: hidden;">
                <div class="card" style="padding: 0.5rem 1.25rem; display: flex; align-items: center; gap: 1rem; justify-content: space-between; flex: none; margin: 0;">
                    <div class="flex items-center flex-stack-mobile" style="gap: 1rem;">
                        <button id="backToCartBtn" class="btn btn-outline" style="height: 38px; width: auto; font-size: 0.85rem; padding: 0.5rem 1rem;">← Volver</button>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 0;">${title}</h2>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button id="refreshHistoryBtn" class="btn btn-outline" style="width: auto; padding: 0.35rem 0.7rem; font-size: 0.8rem;">🔄 Actualizar</button>
                    </div>
                </div>

                <div id="historySummary" style="flex: none;"></div>

                <div class="card" style="flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem; margin: 0;">
                    ${dailySales.length === 0 
                        ? '<p class="text-muted" style="text-align: center; padding: 3rem;">No hay ventas registradas hoy.</p>'
                        : `
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="position: sticky; top: -0.76rem; background: var(--surface-container, #1e293b); z-index: 10; border-bottom: 2px solid var(--border); text-align: left; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                                    <th style="padding: 0.45rem 0.75rem;">Hora</th>
                                    <th style="padding: 0.45rem 0.75rem;">Cliente</th>
                                    <th style="padding: 0.45rem 0.75rem;">Tienda / Vendedor</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: right;">Total $</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: right;">Total Bs</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: right;">Ganancia $</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: center;">Método</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: center;">Estado</th>
                                    <th style="padding: 0.45rem 0.75rem;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${dailySales
                                    .filter(sale => {
                                        if (historyFilter === 'ventas') return sale.status !== 'presupuesto' && sale.status !== 'facturado';
                                        if (historyFilter === 'presupuestos') return sale.status === 'presupuesto' || sale.status === 'facturado';
                                        return true;
                                    })
                                    .map((sale, i) => {
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
                                        <td style="padding: 0.45rem 0.75rem; text-align: right; font-weight: bold;">$ ${fmt(sale.totalUSD)}</td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: right; font-weight: bold; color: white;">Bs ${fmt(sale.totalBs)}</td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: right; font-weight: bold; color: white;">$ ${fmt(sale.profitUSD || 0)}</td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: center;">
                                            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-main); background: var(--surface-variant); padding: 0.2rem 0.5rem; border-radius: 4px;">
                                                ${sale.paymentMethodStr || '--'}
                                            </span>
                                        </td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: center;">
                                            <span style="font-size: 0.7rem; font-weight: 800; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: uppercase;">
                                                ${sale.status}
                                            </span>
                                        </td>
                                        <td style="padding: 0.45rem 0.75rem; text-align: right; white-space: nowrap;">
                                            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                                                ${sale.status === 'presupuesto' || sale.status === 'facturado' ? `
                                                    ${sale.status === 'presupuesto' ? `
                                                        <button class="btn btn-primary convert-to-sale" data-index="${i}" style="width: 110px; padding: 0.2rem 0; font-size: 0.65rem; font-weight: 600; background: var(--primary); border-color: var(--primary); display: flex; align-items: center; justify-content: center; gap: 4px;">🛒 Facturar</button>
                                                    ` : ''}
                                                    <button class="btn btn-outline print-presupuesto" data-index="${i}" style="width: 110px; padding: 0.2rem 0; font-size: 0.65rem; font-weight: 600; border-color: var(--primary); color: var(--primary); display: flex; align-items: center; justify-content: center; gap: 4px;">📄 Presupuesto</button>
                                                ` : `
                                                    <button class="btn btn-outline print-presupuesto" data-index="${i}" style="width: 110px; padding: 0.2rem 0; font-size: 0.65rem; font-weight: 600; border-color: var(--primary); color: var(--primary); display: flex; align-items: center; justify-content: center; gap: 4px;">📄 Ver Factura</button>
                                                `}
                                                <button class="btn btn-outline view-sale-detail" data-index="${i}" style="width: 110px; padding: 0.2rem 0; font-size: 0.65rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">Ver Detalle</button>
                                            </div>
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

        container.querySelector('#refreshHistoryBtn')?.addEventListener('click', async () => {
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

        container.querySelectorAll('.print-presupuesto').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sale = dailySales[parseInt(btn.dataset.index)];
                
                let salePayments = [];
                if (sale.status !== 'presupuesto') {
                    const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id));
                    const paySnap = await getDocs(q);
                    salePayments = paySnap.docs.map(doc => doc.data());
                }
                
                await generateDocumentView(sale, salePayments);
            });
        });

        container.querySelectorAll('.convert-to-sale').forEach(btn => {
            btn.addEventListener('click', () => {
                const sale = dailySales[parseInt(btn.dataset.index)];
                convertToSale(sale);
            });
        });

        const modal = container.querySelector('#saleDetailModal');
        container.querySelector('#closeDetailBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        loadHistorySummary(container.querySelector('#historySummary'));
    }

    function renderOrdersView() {
        const displayedPedidos = allPedidos.filter(p => selectedOrderStatusFilter === 'Todos' || p.orderStatus === selectedOrderStatusFilter || (!p.orderStatus && selectedOrderStatusFilter === 'Por Entregar'));
        container.innerHTML = `
            <div style="position: absolute; top: 0.75rem; bottom: 0.75rem; left: 0.75rem; right: 0.75rem; display: flex; flex-direction: column; gap: 8px; overflow: hidden;">
                <div class="card" style="padding: 0.5rem 1.25rem; display: flex; align-items: center; gap: 1rem; justify-content: space-between; flex: none; margin: 0;">
                    <div class="flex items-center flex-stack-mobile" style="gap: 1rem;">
                        <button id="backToCartBtnOrders" class="btn btn-outline" style="height: 38px; width: auto; font-size: 0.85rem; padding: 0.5rem 1rem;">← Volver</button>
                        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 0;">📦 Pedidos</h2>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <select id="orderStatusFilter" class="bg-surface-container-high border border-outline-variant text-on-surface" style="width: auto; padding: 0.3rem 0.6rem; font-size: 0.8rem; height: 38px; border-radius: 8px; outline: none; cursor: pointer;">
                            <option value="Todos" ${selectedOrderStatusFilter === 'Todos' ? 'selected' : ''}>Todos los Estados</option>
                            <option value="Por Entregar" ${selectedOrderStatusFilter === 'Por Entregar' ? 'selected' : ''}>Por Entregar</option>
                            <option value="Entregado" ${selectedOrderStatusFilter === 'Entregado' ? 'selected' : ''}>Entregado</option>
                            <option value="Facturado" ${selectedOrderStatusFilter === 'Facturado' ? 'selected' : ''}>Facturado</option>
                        </select>
                        <button id="productionTodayBtn" class="btn btn-primary" style="width: auto; padding: 0.35rem 0.7rem; font-size: 0.8rem; background: var(--secondary); border-color: var(--secondary);">👨‍🍳 PRODUCCIÓN HOY</button>
                        <input type="text" id="orderDateFilter" class="bg-surface-container-high border border-outline-variant text-on-surface" style="width: auto; padding: 0.3rem 0.6rem; font-size: 0.8rem; height: 38px; border-radius: 8px;" value="${selectedPedidoDate}">
                        <button id="refreshOrdersBtn" class="btn btn-outline" style="width: auto; padding: 0.35rem 0.7rem; font-size: 0.8rem;">🔄 Actualizar</button>
                    </div>
                </div>

                <div class="card" style="flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem; margin: 0;">
                    ${displayedPedidos.length === 0 
                        ? '<p class="text-muted" style="text-align: center; padding: 3rem;">No hay pedidos para esta fecha.</p>'
                        : `
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="position: sticky; top: -0.76rem; background: var(--surface-container, #1e293b); z-index: 10; border-bottom: 2px solid var(--border); text-align: left; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
                                    <th style="padding: 0.45rem 0.75rem;">Correlativo</th>
                                    <th style="padding: 0.45rem 0.75rem;">Cliente</th>
                                    <th style="padding: 0.45rem 0.75rem;">Fecha Entrega</th>
                                    <th style="padding: 0.45rem 0.75rem;">Monto</th>
                                    <th style="padding: 0.45rem 0.75rem;">Abonado</th>
                                    <th style="padding: 0.45rem 0.75rem;">Estado</th>
                                    <th style="padding: 0.45rem 0.75rem; text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${displayedPedidos.map((pedido, idx) => {
                                    const estadoColor = pedido.orderStatus === 'Entregado' ? '#10b981' : (pedido.orderStatus === 'Facturado' ? '#0ea5e9' : '#f59e0b');
                                    return `
                                    <tr style="border-bottom: 1px solid var(--surface-container-high); transition: background 0.2s;">
                                        <td style="padding: 0.75rem; font-weight: 600;">${pedido.correlative}</td>
                                        <td style="padding: 0.75rem; font-weight: 500;">
                                            ${pedido.clientName}
                                        </td>
                                        <td style="padding: 0.75rem; font-weight: 500;">
                                            ${pedido.deliveryDate ? pedido.deliveryDate.split('-').reverse().join('/') : ''}
                                        </td>
                                        <td style="padding: 0.75rem; font-weight: 800;">$${fmt(pedido.totalUSD)}</td>
                                        <td style="padding: 0.75rem; font-weight: 600; color: var(--success);">$${fmt(pedido.paidUSD)}</td>
                                        <td style="padding: 0.75rem;">
                                            ${pedido.orderStatus === 'Facturado' || pedido.orderStatus === 'Entregado' ? `
                                                <span style="background: ${estadoColor}20; color: ${estadoColor}; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; border: 1px solid ${estadoColor}40;">
                                                    ${pedido.orderStatus}
                                                </span>
                                            ` : `
                                                <select class="order-status-select" data-index="${idx}" style="padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; background-color: ${estadoColor}20; color: ${estadoColor}; border: 1px solid ${estadoColor}40; outline: none; cursor: pointer;">
                                                    <option value="Por Entregar" ${pedido.orderStatus === 'Por Entregar' ? 'selected' : ''}>Por Entregar</option>
                                                    <option value="Entregado" ${pedido.orderStatus === 'Entregado' ? 'selected' : ''}>Entregado</option>
                                                </select>
                                            `}
                                        </td>
                                        <td style="padding: 0.75rem; text-align: right;">
                                            <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
                                                <button class="btn btn-outline view-order-detail" data-index="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" title="Ver Detalle">👁️ Ver Detalle</button>
                                                <button class="btn btn-outline print-order" data-index="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" title="Imprimir PDF">🖨️ Imprimir</button>
                                                ${pedido.orderStatus !== 'Facturado' ? `<button class="btn btn-outline edit-order" data-index="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" title="Editar">✏️ Editar</button>` : `<button class="btn btn-outline" disabled style="padding: 0.25rem 0.5rem; font-size: 0.75rem; opacity: 0.5; cursor: not-allowed; border-color: var(--border);" title="No disponible">✏️ Editar</button>`}
                                                <button class="btn btn-outline delete-order" data-index="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" title="Eliminar">🗑️ Eliminar</button>
                                                ${pedido.orderStatus !== 'Facturado' ? `<button class="btn btn-primary bill-order" data-index="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" title="Facturar">🛒 Facturar</button>` : `<button class="btn" disabled style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background-color: var(--surface-container-highest, rgba(255,255,255,0.05)); color: var(--text-muted); opacity: 0.5; cursor: not-allowed; border: 1px solid transparent;" title="Ya facturado">🛒 Facturar</button>`}
                                            </div>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                        `}
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

        container.querySelector('#backToCartBtnOrders').addEventListener('click', () => {
            currentView = 'cart';
            render();
        });

        container.querySelector('#orderStatusFilter').addEventListener('change', (e) => {
            selectedOrderStatusFilter = e.target.value;
            renderOrdersView();
        });

        const modal = container.querySelector('#saleDetailModal');
        container.querySelector('#closeDetailBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        container.querySelector('#refreshOrdersBtn').addEventListener('click', async () => {
            const btn = container.querySelector('#refreshOrdersBtn');
            btn.innerHTML = '⏳';
            await loadPedidos(selectedPedidoDate);
            renderOrdersView();
        });

        if (typeof flatpickr !== 'undefined') {
            const pParts = selectedPedidoDate.split('-');
            const defPDate = new Date(pParts[0], pParts[1] - 1, pParts[2]);

            flatpickr(container.querySelector('#orderDateFilter'), {
                dateFormat: "d/m/Y",
                defaultDate: defPDate,
                locale: "es",
                onChange: async function(selectedDates) {
                    if (selectedDates.length > 0) {
                        const d = selectedDates[0];
                        const yy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        selectedPedidoDate = `${yy}-${mm}-${dd}`;
                        await loadPedidos(selectedPedidoDate);
                        renderOrdersView();
                    }
                }
            });
        }

        container.querySelector('#productionTodayBtn').addEventListener('click', () => {
            showProductionSummaryModal();
        });

        container.querySelectorAll('.order-status-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const newStatus = e.target.value;
                const pedido = displayedPedidos[parseInt(sel.dataset.index)];
                const pedidoRef = doc(db, "businesses", businessId, "sales", pedido.id);
                await updateDoc(pedidoRef, { orderStatus: newStatus });
                showNotification("✅ Estado actualizado.");
                await loadPedidos(selectedPedidoDate);
                renderOrdersView();
            });
        });

        container.querySelectorAll('.view-order-detail').forEach(btn => {
            btn.addEventListener('click', () => {
                const pedido = displayedPedidos[parseInt(btn.dataset.index)];
                showSaleDetail(pedido);
            });
        });

        container.querySelectorAll('.print-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pedido = displayedPedidos[parseInt(btn.dataset.index)];
                let salePayments = [];
                const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", pedido.id));
                const paySnap = await getDocs(q);
                salePayments = paySnap.docs.map(doc => doc.data());
                await generateDocumentView(pedido, salePayments);
            });
        });

        container.querySelectorAll('.delete-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pedido = displayedPedidos[parseInt(btn.dataset.index)];
                
                const modal = document.createElement('div');
                modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1rem;';
                
                modal.innerHTML = `
                    <div class="card" style="width: 100%; max-width: 400px; padding: 2rem; text-align: center; position: relative;">
                        <div style="font-size: 3.5rem; margin-bottom: 1rem; line-height: 1;">🗑️</div>
                        <h3 style="margin-bottom: 0.5rem; font-weight: 700; font-size: 1.25rem;">Eliminar Pedido</h3>
                        <p style="margin-bottom: 1.5rem; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5;">¿Estás seguro de que deseas eliminar este pedido? Esta acción borrará el pedido y sus pagos asociados, y <b>no se puede deshacer</b>.</p>
                        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
                            <button class="btn btn-outline" id="cancelConfirmBtn" style="flex: 1; padding: 0.75rem;">Cancelar</button>
                            <button class="btn btn-primary" id="acceptConfirmBtn" style="flex: 1; padding: 0.75rem; background: #ef4444; border-color: #ef4444; color: white;">Sí, Eliminar</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                
                modal.querySelector('#cancelConfirmBtn').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
                
                modal.querySelector('#acceptConfirmBtn').addEventListener('click', async () => {
                    document.body.removeChild(modal);
                    btn.innerHTML = '⏳';
                    btn.disabled = true;
                    try {
                        const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", pedido.id));
                        const paySnap = await getDocs(q);
                        const deletePromises = paySnap.docs.map(payDoc => deleteDoc(doc(db, "businesses", businessId, "payments", payDoc.id)));
                        await Promise.all(deletePromises);
                        await deleteDoc(doc(db, "businesses", businessId, "sales", pedido.id));
                        showNotification("✅ Pedido eliminado");
                        await loadPedidos(selectedPedidoDate);
                        renderOrdersView();
                    } catch (err) {
                        console.error("Error al eliminar:", err);
                        showNotification("Error al eliminar pedido");
                        btn.innerHTML = '🗑️ Eliminar';
                        btn.disabled = false;
                    }
                });
            });
        });

        container.querySelectorAll('.edit-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pedido = allPedidos[parseInt(btn.dataset.index)];
                convertingBudgetId = pedido.id;
                cart = [...(pedido.items || [])];
                settings = { ...pedido.settings, type: 'pedido' };
                deliveryDate = pedido.deliveryDate || selectedPedidoDate;
                const cli = clients.find(c => c.id === pedido.clientId);
                if (cli) selectedClient = cli;
                
                const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", pedido.id));
                const paySnap = await getDocs(q);
                payments = paySnap.docs.map(doc => ({ ...doc.data(), isOld: true, id: doc.id }));

                currentView = 'cart';
                render();
            });
        });

        container.querySelectorAll('.bill-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pedido = allPedidos[parseInt(btn.dataset.index)];
                convertingBudgetId = pedido.id;
                cart = [...(pedido.items || [])];
                settings = { ...pedido.settings, type: 'venta' }; // Changed to venta to finalize
                const cli = clients.find(c => c.id === pedido.clientId);
                if (cli) selectedClient = cli;
                
                const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", pedido.id));
                const paySnap = await getDocs(q);
                payments = paySnap.docs.map(doc => ({ ...doc.data(), isOld: true, id: doc.id }));

                currentView = 'cart';
                render();
            });
        });
    }

    function showProductionSummaryModal() {
        const summary = {};
        let totalOrders = 0;
        
        allPedidos.forEach(pedido => {
            if (pedido.orderStatus === 'Facturado' || pedido.orderStatus === 'Entregado') return; // optional: include only pending? Or include all? The user says "producción hoy", maybe include all orders for that date. Let's include all.
            totalOrders++;
            (pedido.items || []).forEach(item => {
                const key = item.id;
                if (!summary[key]) {
                    summary[key] = { name: item.name, qty: 0, unit: item.sellUnit || item.baseUnit, extras: {} };
                }
                summary[key].qty += item.qty;
                
                (item.extras || []).forEach(ext => {
                    if (!summary[key].extras[ext.name]) {
                        summary[key].extras[ext.name] = 0;
                    }
                    summary[key].extras[ext.name] += item.qty; // extra qty is 1 per item qty
                });
            });
        });

        const itemsHtml = Object.values(summary).map(item => {
            let extrasHtml = '';
            if (Object.keys(item.extras).length > 0) {
                extrasHtml = '<ul style="margin-top: 0.2rem; padding-left: 1rem; font-size: 0.8rem; color: var(--text-muted);">';
                for (const [extName, extQty] of Object.entries(item.extras)) {
                    extrasHtml += `<li>${extQty}x ${extName}</li>`;
                }
                extrasHtml += '</ul>';
            }
            return `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                    <div>
                        <div style="font-weight: 600;">${item.name}</div>
                        ${extrasHtml}
                    </div>
                    <div style="font-weight: 800; font-size: 1.1rem;">${fmt(item.qty)} <span style="font-size: 0.7rem; color: var(--text-muted);">${item.unit}</span></div>
                </div>
            `;
        }).join('');

        const modal = document.createElement('div');
        modal.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 4000; display: flex; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div class="card" style="width: 90%; max-width: 500px; padding: 2rem; max-height: 90vh; display: flex; flex-direction: column; animation: modalIn 0.3s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">👨‍🍳 Producción: ${selectedPedidoDate}</h3>
                    <button id="closeProdModalBtn" class="btn btn-outline" style="padding: 0.2rem 0.5rem;">❌</button>
                </div>
                <p style="color: var(--text-muted); margin-bottom: 1rem; font-size: 0.85rem;">Total pedidos pendientes para esta fecha: ${totalOrders}</p>
                
                <div style="flex: 1; overflow-y: auto; margin-bottom: 1rem; padding-right: 0.5rem;">
                    ${Object.keys(summary).length === 0 ? '<p class="text-muted" style="text-align: center; padding: 2rem;">No hay productos para producir.</p>' : itemsHtml}
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: auto;">
                    <button id="printProdModalBtn" class="btn btn-primary" style="flex: 1;">🖨️ Imprimir Reporte</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#closeProdModalBtn').onclick = () => modal.remove();
        modal.querySelector('#printProdModalBtn').onclick = () => {
            printProductionReport(summary, selectedPedidoDate);
        };
    }

    function printProductionReport(summary, dateStr) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ format: 'a4', unit: 'mm' });
        
        doc.setFontSize(18);
        doc.text(`Reporte de Producción: ${dateStr}`, 10, 20);
        
        doc.setFontSize(12);
        let y = 30;
        
        for (const item of Object.values(summary)) {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.setFont("helvetica", "bold");
            doc.text(`${fmt(item.qty)} ${item.unit} - ${item.name}`, 10, y);
            y += 6;
            
            if (Object.keys(item.extras).length > 0) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                for (const [extName, extQty] of Object.entries(item.extras)) {
                    doc.text(`    • ${fmt(extQty)}x ${extName}`, 10, y);
                    y += 5;
                }
                doc.setFontSize(12);
            }
            y += 2; // Extra space between items
        }
        
        window.open(doc.output('bloburl'), '_blank');
    }

    async function loadHistorySummary(summaryContainer) {
        if (!summaryContainer) return;
        const shiftStartStr = localStorage.getItem('shiftStartTime');
        const shiftStart = shiftStartStr ? new Date(shiftStartStr) : new Date('2099-01-01T00:00:00Z');
        
        let pq = query(collection(db, "businesses", businessId, "payments"), 
                       where("createdAt", ">=", shiftStart));

        const pSnap = await getDocs(pq);
        let payments = pSnap.docs.map(doc => doc.data());
        payments = payments.filter(p => p.employeeEmail === userEmail);
        const totals = {
            'PUNTO': 0, 'PAGO_MOVIL': 0, 'TRANSFERENCIA': 0, 'EFECTIVO_BS': 0, 'BIO_PAGO': 0,
            'EFECTIVO_USD': 0, 'ZELLE': 0, 'PAYPAL': 0, 'BINANCE': 0
        };

        pSnap.forEach(doc => {
            const p = doc.data();
            // Strict filter based on session
            let pass = false;
            pass = (p.employeeEmail === userEmail);

            if (!pass) return;

            const method = p.method;
            const currency = p.currency;
            
            if (currency === 'BS') {
                if (method === 'PUNTO') totals.PUNTO += p.amount;
                else if (method === 'PAGO_MOVIL') totals.PAGO_MOVIL += p.amount;
                else if (method === 'TRANSFERENCIA') totals.TRANSFERENCIA += p.amount;
                else if (method === 'EFECTIVO') totals.EFECTIVO_BS += p.amount;
                else if (method === 'BIO_PAGO') totals.BIO_PAGO += p.amount;
            } else {
                if (method === 'EFECTIVO') totals.EFECTIVO_USD += p.amount;
                else if (method === 'ZELLE') totals.ZELLE += p.amount;
                else if (method === 'PAYPAL') totals.PAYPAL += p.amount;
                else if (method === 'BINANCE') totals.BINANCE += p.amount;
            }
        });

        summaryContainer.innerHTML = `
            <div class="card" style="background: var(--surface); border: 1px solid var(--border); padding: 0.6rem 1.25rem; flex: none; margin: 0;">
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
                        <p class="text-muted" style="font-size: 0.6rem; text-transform: uppercase; margin-bottom: 0.1rem;">Bio Pago</p>
                        <p style="font-weight: 800; font-size: 0.9rem;">Bs. ${fmt(totals.BIO_PAGO)}</p>
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
        const isBudget = sale.status === 'presupuesto' || (sale.status === 'facturado' && !sale.isOrder);
        const isOrder = sale.isOrder || sale.status === 'pedido';
        
        const modal = container.querySelector('#saleDetailModal');
        const content = container.querySelector('#modalContent');

        let salePayments = [];
        if (!isBudget) {
            const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id));
            const paySnap = await getDocs(q);
            salePayments = paySnap.docs.map(doc => doc.data());
        }

        let headerType = isBudget ? 'Presupuesto' : isOrder ? 'Pedido' : 'Venta';
        let headerLabel = isBudget ? 'Presupuesto:' : isOrder ? 'Pedido:' : 'Factura:';
        let correlativeStr = sale.correlative || sale.id.slice(-6).toUpperCase();
        let displayStatus = isOrder ? (sale.orderStatus || sale.status) : sale.status;
        
        let displayDate = '';
        if (isOrder && sale.deliveryDate) {
            const [y, m, d] = sale.deliveryDate.split('-');
            displayDate = `Entrega: ${d}/${m}/${y}`;
        } else {
            displayDate = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleString('es-VE') : formatDateToDDMMYYYY(sale.date);
        }

        let statusColor = 'var(--primary)';
        let statusBg = 'var(--primary)1A';
        const lowerStatus = (displayStatus || '').toLowerCase();
        if (lowerStatus === 'facturado' || lowerStatus === 'contado' || lowerStatus === 'entregado') {
            statusColor = '#10b981';
            statusBg = 'rgba(16, 185, 129, 0.1)';
        } else if (lowerStatus === 'abono' || lowerStatus === 'por entregar') {
            statusColor = '#f59e0b';
            statusBg = 'rgba(245, 158, 11, 0.1)';
        }

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em;">
                    Resumen de ${headerType}
                </div>
                <h2 style="margin: 0.5rem 0;">
                    ${headerLabel} ${correlativeStr}
                </h2>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${displayDate}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <div>
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Cliente</h4>
                    <p style="font-weight: bold; margin: 0;">${sale.clientName}</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">ID: ${sale.clientId}</p>
                </div>
                <div style="text-align: right;">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Estado</h4>
                    <span style="padding: 0.2rem 0.6rem; border-radius: 4px; background: ${statusBg}; color: ${statusColor}; font-weight: bold; font-size: 0.8rem; text-transform: uppercase;">
                        ${displayStatus}
                    </span>
                </div>
            </div>

            <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">Productos</h4>
            <div style="margin-bottom: 2rem;">
                ${sale.items.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.9rem;">
                        <div>
                            <div>${item.qty} x ${item.name}</div>
                            ${(item.unitContent && item.unitContent > 1) ? `<div style="font-size:0.75rem; color:var(--text-muted);">${item.qty} ${item.sellUnit} x ${item.unitContent} ${item.baseUnit || 'ud'}</div>` : ''}
                        </div>
                        <span style="font-weight: bold;">$${fmt(item.total)}</span>
                    </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--border); padding-top: 0.75rem; margin-top: 0.75rem; font-weight: 800; font-size: 1.1rem;">
                    <span>TOTAL</span>
                    <span style="color: var(--primary);">$${fmt(sale.totalUSD)}</span>
                </div>
                <div style="text-align: right; color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem;">Bs. ${fmt(sale.totalBs)}</div>
            </div>

            ${isBudget ? '' : `
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
            `}

            <div style="margin-top: 2rem;">
                <button id="modalCloseBtn" class="btn btn-primary">Cerrar Detalle</button>
            </div>
        `;

        content.querySelector('#modalCloseBtn').onclick = () => {
            modal.style.display = 'none';
        };

        modal.style.display = 'flex';
    }

    function convertToSale(budget) {
        showConfirmModal("Facturar Presupuesto", "¿Desea cargar los datos de este presupuesto al carrito para generar una venta?", () => {
            convertingBudgetId = budget.id;
            // 1. Cargar Carrito
            cart = budget.items.map(item => ({...item}));
            
            // 2. Seleccionar Cliente
            selectedClient = clients.find(c => c.id === budget.clientId) || {
                id: budget.clientId,
                fullName: budget.clientName
            };
            
            // 3. Resetear configuración a Venta
            settings.type = 'venta';
            settings.target = budget.target || 'detal';
            settings.priceType = budget.priceType || 'precioDetal';
            
            // 4. Navegar al Checkout
            currentView = 'payment';
            render();
            showNotification("🛒 Presupuesto cargado. Proceda a registrar los pagos.");
        }, "Sí, Facturar", "Cancelar");
    }

    async function generateDocumentView(sale, salePayments = []) {
        const isBudget = sale.status === 'presupuesto' || sale.status === 'facturado';
        const printWindow = window.open('', '_blank');
        const businessId = localStorage.getItem('businessId');
        let businessData = {};
        try {
            const snap = await getDoc(doc(db, "businesses", businessId));
            if (snap.exists()) businessData = snap.data();
        } catch (e) {
            console.error("Error fetching business data:", e);
        }
        
        const bName = businessData.name || localStorage.getItem('businessName') || 'ORANGE APP';
        const logoUrl = businessData.logoUrl || localStorage.getItem('businessLogo');
        const sName = sale.storeName || 'Sucursal';
        
        // Formatear fecha: martes, 12-05-2026
        let formattedDate = sale.date;
        try {
            const [year, month, day] = sale.date.split('-');
            const dateObj = new Date(year, month - 1, day);
            const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const dayName = days[dateObj.getDay()];
            formattedDate = `${dayName}, ${day}-${month}-${year}`;
        } catch (e) {
            console.error("Error formatting date:", e);
        }
        
        let bankAccounts = [];
        try {
            const q = query(collection(db, "businesses", businessId, "bank_accounts"));
            const snap = await getDocs(q);
            bankAccounts = snap.docs.map(doc => doc.data());
        } catch (e) {
            console.error("Error fetching bank accounts for document:", e);
        }
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${isBudget ? 'Presupuesto' : 'Factura'} - ${sale.id.slice(-6).toUpperCase()}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 30px; color: #1a202c; line-height: 1.5; background: #f8fafc; margin: 0; }
                    .page { background: white; width: 210mm; min-height: 297mm; padding: 20mm; margin: 20px auto; box-shadow: 0 0 20px rgba(0,0,0,0.1); border-radius: 8px; position: relative; box-sizing: border-box; }
                    .no-print-toolbar { position: sticky; top: 0; background: #2d3748; padding: 10px; display: flex; justify-content: center; gap: 20px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
                    .btn-print { background: #48bb78; color: white; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; font-size: 14px; }
                    .btn-pdf { background: #4299e1; color: white; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; font-size: 14px; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #edf2f7; padding-bottom: 20px; }
                    .company h1 { margin: 0; color: #2b6cb0; font-size: 22px; text-transform: uppercase; }
                    .company p { margin: 2px 0; font-size: 12px; color: #718096; }
                    .budget-id { text-align: right; }
                    .budget-id h2 { margin: 0; color: #2d3748; font-size: 18px; }
                    .budget-id p { margin: 4px 0; font-weight: bold; color: #4a5568; font-size: 14px; }
                    .client-box { background: #f7fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
                    .client-box h3 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #718096; letter-spacing: 0.05em; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th { text-align: left; padding: 10px; background: #edf2f7; color: #4a5568; font-size: 12px; text-transform: uppercase; }
                    td { padding: 10px; border-bottom: 1px solid #edf2f7; font-size: 13px; }
                    .totals { margin-left: auto; width: 250px; }
                    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
                    .total-row.main { font-weight: bold; font-size: 18px; color: #2b6cb0; border-top: 2px solid #2b6cb0; margin-top: 10px; padding-top: 12px; }
                    .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px; }
                    @media print { 
                        body { background: white; padding: 0; } 
                        .no-print-toolbar { display: none !important; } 
                        .page { margin: 0; box-shadow: none; width: 100%; padding: 10mm; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print-toolbar">
                    <button class="btn-print" onclick="window.print()">🖨️ IMPRIMIR</button>
                    <button class="btn-pdf" onclick="window.print()">💾 GUARDAR PDF</button>
                </div>
                
                <div class="page">
                    <div class="header" style="align-items: flex-start;">
                        <div class="company" style="display: flex; align-items: flex-start; gap: 15px;">
                            ${logoUrl ? `<img src="${logoUrl}" style="height: 50px; width: 50px; object-fit: cover; border-radius: 50%;">` : ''}
                            <div>
                                <h1 style="margin: 0; color: #2b6cb0; font-size: 16px; font-weight: bold; text-transform: uppercase;">${bName}</h1>
                                <p style="margin: 2px 0; font-size: 12px; color: #718096;">${localStorage.getItem('userRole') === 'admin' ? 'Sede Principal' : sName}</p>
                                <p style="margin: 2px 0; font-size: 12px; color: #718096;">Vendedor: ${sale.employeeName}</p>
                            </div>
                        </div>
                        <div class="budget-id">
                            <h2 style="margin: 0; color: #2d3748; font-size: 16px; font-weight: bold; text-transform: uppercase;">${isBudget ? 'PRESUPUESTO' : 'FACTURA NO FISCAL'}</h2>
                            <p>${isBudget ? 'N°:' : 'Factura N°:'} ${sale.correlative || sale.id.slice(-6).toUpperCase()}</p>
                            <div style="font-size: 12px; color: #000;">${formattedDate} - Tasa BCV: Bs. ${fmt(sale.bcvRate || (sale.totalBs / sale.totalUSD))}</div>
                            <div style="color: #2b6cb0; font-weight: bold; font-size: 12px; margin-top: 5px; text-transform: uppercase;">ESTADO: ${sale.status}</div>
                        </div>
                    </div>

                    <div class="client-box">
                        <h3>Cliente</h3>
                        <div style="font-weight: bold; font-size: 15px;">${sale.clientName}</div>
                        <div style="font-size: 13px; color: #4a5568;">${sale.clientId}</div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Cant.</th>
                                <th>Descripción</th>
                                <th style="text-align: right;">P. Unit ($)</th>
                                <th style="text-align: right;">Total ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sale.items.map(item => `
                                <tr>
                                    <td style="width: 50px;">${item.qty}</td>
                                    <td>
                                        ${item.name}
                                        ${(item.unitContent && item.unitContent > 1) ? `<br><small style="color:#718096">${item.qty} ${item.sellUnit} x ${item.unitContent} ${item.baseUnit || 'ud'}</small>` : ''}
                                    </td>
                                    <td style="text-align: right; width: 100px;">$ ${fmt(item.price)}</td>
                                    <td style="text-align: right; width: 100px;">$ ${fmt(item.total)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div class="total-row">
                            <span>SUBTOTAL USD:</span>
                            <span>$ ${fmt(sale.totalUSD)}</span>
                        </div>
                        <div class="total-row main">
                            <span>TOTAL USD:</span>
                            <span>$ ${fmt(sale.totalUSD)}</span>
                        </div>
                        <div style="text-align: right; margin-top: 8px; font-weight: bold; color: #4a5568; font-size: 15px;">
                            TOTAL BS: ${fmt(sale.totalBs)}
                        </div>

                    </div>

                    ${!isBudget && salePayments.length > 0 ? `
                    <div style="margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px;">
                        <h3 style="font-size: 11px; text-transform: uppercase; color: #718096; margin-bottom: 10px;">Pagos Registrados</h3>
                        <div style="font-size: 12px;">
                            ${salePayments.map(p => `
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>${p.method} ${p.ref ? `(Ref: ${p.ref})` : ''}</span>
                                    <span style="font-weight: bold;">${p.currency} ${fmt(p.amount)}</span>
                                </div>
                            `).join('')}
                            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-weight: bold; color: #e53e3e; border-top: 1px dashed #edf2f7; padding-top: 8px;">
                                <span>PENDIENTE POR COBRAR:</span>
                                <span>$ ${fmt(sale.remainingUSD || 0)}</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Cuentas Bancarias -->
                    ${bankAccounts.length > 0 ? `
                    <div style="margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 20px;">
                        <h3 style="font-size: 11px; text-transform: uppercase; color: #718096; margin-bottom: 10px;">🏦 Datos de Pago</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; font-size: 11px;">
                            ${bankAccounts.map(acc => `
                                <div style="background: #f7fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                    <div style="font-weight: bold; color: #2b6cb0;">${acc.bank}</div>
                                    <div style="color: #718096; font-size: 10px; text-transform: uppercase;">${acc.type} (${acc.currency})</div>
                                    <div style="font-family: monospace; font-size: 11px; margin-top: 4px;">${acc.number}</div>
                                    ${acc.phone ? `<div style="font-size: 11px; margin-top: 2px;">📱 ${acc.phone}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    <div class="footer">
                        <p>${isBudget ? 'Este presupuesto es informativo y tiene una validez de 24 horas.' : 'Gracias por su compra. Este documento es su comprobante de pago.'}</p>
                        <p>Los precios expresados en Bolívares están sujetos a la tasa BCV del día.</p>
                        <p>¡Gracias por elegirnos!</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    }

    loadData();
}
