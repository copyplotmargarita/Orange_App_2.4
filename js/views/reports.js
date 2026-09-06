import { auth, db } from '../services/firebase.js';
import { showNotification, formatDateToDDMMYYYY } from '../utils.js';
import { showSaleDetail } from './receivables.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderReports(container) {
    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');

    if (role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Acceso restringido solo para administradores.</div>';
        return;
    }

    let stores = [];
    let suppliersData = [];
    let creditorsData = [];
    let currentData = [];
    let currentType = 'sales'; // 'sales' or 'purchases'

    async function init() {
        // Load base data
        try {
            const [storesSnap, suppliersSnap, creditorsSnap] = await Promise.all([
                getDocs(collection(db, "businesses", businessId, "stores")),
                getDocs(collection(db, "businesses", businessId, "suppliers")),
                getDocs(collection(db, "businesses", businessId, "creditors"))
            ]);
            stores = storesSnap.docs.map(doc => ({id: doc.id, ...doc.data()})).sort((a,b)=>a.name.localeCompare(b.name));
            suppliersData = suppliersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
            creditorsData = creditorsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        } catch (e) {
            console.error("Error loading base data:", e);
        }
        render();
    }

    function getSupplierName(p) {
        if (p.supplierName) return p.supplierName;
        if (p.supplier) return p.supplier;
        
        const id = p.supplierId || p.creditorId;
        if (!id) return 'Desconocido';
        
        let found = suppliersData.find(s => s.id === id);
        if (found) return found.name;
        
        found = creditorsData.find(c => c.id === id);
        if (found) return found.name;
        
        return 'Desconocido';
    }

    function getPurchaseTotal(p) {
        return parseFloat(p.totalUsd || p.totalAmount || p.total || p.totalUSD || 0);
    }

    function render() {
        container.innerHTML = `
            <div class="reports-container" style="display: flex; flex-direction: column; gap: 1.5rem; height: 100%; overflow: hidden; padding-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0;" class="flex-stack-mobile">
                    <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                    <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">📊 Consultas / Reportes</h2>
                    
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-left: auto;" class="flex-stack-mobile">
                        <button id="btnExportPDF" class="btn btn-outline" style="width: auto; font-size: 0.85rem; padding: 0.5rem 1rem; white-space: nowrap; display: none;">📄 Exportar a PDF</button>
                        <button id="btnExportExcel" class="btn btn-primary" style="width: auto; font-size: 0.85rem; padding: 0.5rem 1rem; white-space: nowrap; display: none;">📊 Exportar a Excel</button>
                    </div>
                </div>

                <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; flex: 1; min-height: 0;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; align-items: flex-end; flex-shrink: 0;">
                        <div class="form-group">
                            <label>🔄 Tipo</label>
                            <select id="typeSelect" class="form-control">
                                <option value="sales">Ventas</option>
                                <option value="purchases">Compras</option>
                                <option value="payments_received">Pagos Recibidos</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>🏪 Tienda</label>
                            <select id="storeSelect" class="form-control">
                                <option value="all">Todas las Tiendas</option>
                                <option value="general">Almacén General</option>
                                ${stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>📅 Desde</label>
                            <input type="text" id="dateFrom" class="form-control" value="${new Date().toLocaleDateString('sv-SE')}">
                        </div>
                        <div class="form-group">
                            <label>📅 Hasta</label>
                            <input type="text" id="dateTo" class="form-control" value="${new Date().toLocaleDateString('sv-SE')}">
                        </div>
                        <div class="form-group">
                            <label>&nbsp;</label>
                            <button id="btnFilter" class="btn btn-primary" style="height: 40px; font-weight: 800; text-transform: uppercase; font-size: 0.75rem; width: 100%;">🔍 Consultar</button>
                        </div>
                    </div>
                    <div id="resultsContent" style="margin-top: 1rem; overflow-y: auto; flex: 1; min-height: 0;">
                        <div style="text-align: center; padding: 3rem; color: var(--text-muted);">Defina los filtros y presione Consultar.</div>
                    </div>
                </div>
            </div>
            
            <!-- Detail Modal Container -->
            <div id="purchaseDetailModalContainer" style="display: none;"></div>
            
            <style>
                .form-group { margin-bottom: 0 !important; }
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
                #resultsContent table th { position: sticky; top: 0; z-index: 10; background: var(--background); }
            </style>
        `;

        const backBtn = container.querySelector('#backToDashboardBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const navHome = document.getElementById('navHome');
                if (navHome) navHome.click();
                else window.location.hash = '#dashboard';
            });
        }

        container.querySelector('#btnFilter').onclick = executeQuery;
        container.querySelector('#btnExportExcel').onclick = exportToExcel;
        container.querySelector('#btnExportPDF').onclick = exportToPDF;

        if (typeof flatpickr !== 'undefined') {
            const fpConfig = {
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "d/m/Y"
            };
            flatpickr(container.querySelector('#dateFrom'), fpConfig);
            flatpickr(container.querySelector('#dateTo'), fpConfig);
        }
    }

    async function executeQuery() {
        const type = document.getElementById('typeSelect').value;
        const storeId = document.getElementById('storeSelect').value;
        const from = document.getElementById('dateFrom').value;
        const to = document.getElementById('dateTo').value;
        const results = document.getElementById('resultsContent');

        currentType = type;
        document.getElementById('btnExportExcel').style.display = 'none';
        document.getElementById('btnExportPDF').style.display = 'none';

        results.innerHTML = '<div class="text-center p-4">⌛ Consultando...</div>';

        try {
            let items = [];
            
            if (type === 'sales') {
                const q = query(
                    collection(db, "businesses", businessId, 'sales'),
                    where("date", ">=", from),
                    where("date", "<=", to)
                );
                const snap = await getDocs(q);
                items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else if (type === 'payments_received') {
                const payQ = query(
                    collection(db, "businesses", businessId, "payments"),
                    where("date", ">=", from),
                    where("date", "<=", to)
                );
                const paySnap = await getDocs(payQ);
                const saleIds = [...new Set(paySnap.docs.map(d => d.data().saleId).filter(id => id))];
                
                if (saleIds.length > 0) {
                    const salePromises = saleIds.map(id => getDoc(doc(db, "businesses", businessId, "sales", id)));
                    const saleSnaps = await Promise.all(salePromises);
                    saleSnaps.forEach(snap => {
                        if (snap.exists()) {
                            items.push({ id: snap.id, ...snap.data() });
                        }
                    });
                }
            } else {
                // purchases
                const q = collection(db, "businesses", businessId, 'purchases');
                const snap = await getDocs(q);
                items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                items = items.filter(p => {
                    const pDate = p.receptionDate || p.emissionDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
                    p.date = pDate; // Normalizamos para la tabla
                    return pDate >= from && pDate <= to;
                });
            }
            
            // Filter by store
            if (storeId !== 'all') {
                items = items.filter(i => i.storeId === storeId);
            }
            
            // Sort by Client (Sales) or Supplier (Purchases) A-Z, then newest to oldest
            items.sort((a, b) => {
                const isSalesType = type === 'sales' || type === 'payments_received';
                let nameA = (isSalesType ? (a.clientName || 'Desconocido') : (a.supplierName || 'Desconocido')).toUpperCase();
                let nameB = (isSalesType ? (b.clientName || 'Desconocido') : (b.supplierName || 'Desconocido')).toUpperCase();
                
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return b.date.localeCompare(a.date);
            });
            currentData = items;

            if (items.length === 0) {
                const typeName = type === 'sales' ? 'ventas' : (type === 'payments_received' ? 'pagos recibidos' : 'compras');
                results.innerHTML = `<div class="alert alert-info text-center">No se encontraron ${typeName} en este rango.</div>`;
                return;
            }

            document.getElementById('btnExportExcel').style.display = 'inline-flex';
            document.getElementById('btnExportPDF').style.display = 'inline-flex';

            renderTable(items, type, results);

        } catch (err) {
            results.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
        }
    }

    function renderTable(items, type, resultsContainer) {
        const isSales = type === 'sales' || type === 'payments_received';
        const entityLabel = isSales ? 'Cliente' : 'Proveedor';

        resultsContainer.innerHTML = `
            <div class="table-responsive">
                <table class="table" style="font-size: 0.9rem; width: 100%; min-width: 800px; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--background);">
                            <th style="width: 15%; padding: 1rem; text-align: center;">Fecha</th>
                            <th style="width: 30%; padding: 1rem; text-align: center;">${entityLabel}</th>
                            <th style="width: 15%; padding: 1rem; text-align: center;">Total USD</th>
                            <th style="width: 15%; padding: 1rem; text-align: center;">Estado</th>
                            <th style="width: 25%; padding: 1rem; text-align: center;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 1rem; text-align: center;">${formatDateToDDMMYYYY(item.date)}</td>
                                <td style="padding: 1rem; text-align: center;">${isSales ? item.clientName : getSupplierName(item)}</td>
                                <td style="padding: 1rem; text-align: center; font-weight: bold; color: var(--primary);">$ ${isSales ? (item.totalUSD || 0).toFixed(2) : getPurchaseTotal(item).toFixed(2)}</td>
                                <td style="padding: 1rem; text-align: center;">
                                    <span class="badge ${(item.status === 'contado' || item.status === 'pagada') ? 'badge-success' : 'badge-warning'}" style="padding: 0.4rem 0.6rem;">${(item.status || 'N/A').toUpperCase()}</span>
                                </td>
                                <td style="padding: 1rem; text-align: center;">
                                    <button class="btn btn-ghost btn-sm btn-detail" data-id="${item.id}" style="width: 100%; max-width: 150px; font-weight: 600;">👁️ Ver Detalle</button>
                                    ${isSales && (item.status === 'pagado' || item.status === 'PAGADO' || item.status === 'facturado' || item.status === 'FACTURADO' || item.status === 'pagada' || item.status === 'PAGADA' || item.status === 'contado' || item.status === 'CONTADO') ? 
                                    `<button class="btn btn-sm btn-manual-invoice" data-id="${item.id}" style="width: 100%; max-width: 150px; font-weight: 600; margin-top: 0.5rem; background-color: ${item.manualInvoiceGenerated ? 'var(--success)' : 'var(--primary)'}; color: white; border: none; padding: 0.4rem; display: block; margin-left: auto; margin-right: auto; cursor: pointer; border-radius: 8px;">📄 Generar Fac</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        resultsContainer.querySelectorAll('.btn-detail').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const item = items.find(i => i.id === id);
                if (!item) return;
                
                if (isSales) {
                    showSaleDetail(item);
                } else {
                    showPurchaseDetailView(item);
                }
            };
        });

        resultsContainer.querySelectorAll('.btn-manual-invoice').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                const item = items.find(i => i.id === id);
                if (!item) return;
                await generateManualInvoice(item, btn);
            };
        });
    }

    async function generateManualInvoice(sale, btnEl) {
        showNotification("Generando factura, por favor espere...", "info");
        btnEl.disabled = true;
        
        try {
            // Get payments
            const paySnap = await getDocs(query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id)));
            let payments = paySnap.docs.map(d => d.data());
            
            let isGlobal = false;
            let batchId = null;
            let allBatchPayments = [];
            let globalSaleIds = [sale.id];
            
            if (payments.length > 0) {
                // Find any payment flagged as a mass payment
                const globalPay = payments.find(p => p.isMassPayment);
                if (globalPay) {
                    if (globalPay.batchId) {
                        batchId = globalPay.batchId;
                        const batchSnap = await getDocs(query(collection(db, "businesses", businessId, "payments"), where("batchId", "==", batchId)));
                        allBatchPayments = batchSnap.docs.map(d => d.data());
                    } else {
                        // Legacy support: mass payments created before batchId was added
                        const batchSnap = await getDocs(query(
                            collection(db, "businesses", businessId, "payments"), 
                            where("clientId", "==", globalPay.clientId),
                            where("isMassPayment", "==", true),
                            where("date", "==", globalPay.date)
                        ));
                        // In memory filter to ensure exact match of the mass payment total amount
                        allBatchPayments = batchSnap.docs.map(d => d.data()).filter(d => d.totalMassPaymentAmount === globalPay.totalMassPaymentAmount);
                    }
                    
                    if (allBatchPayments.length > 0) {
                        isGlobal = true;
                    }
                }
            }

            // Calculate effective rate
            let totalBsPaid = 0;
            let effectiveRate = 1;
            let totalUSD = parseFloat(sale.totalUSD || sale.total || 0);
            let itemsList = sale.items || sale.products || [];
            
            if (isGlobal) {
                const saleIds = [...new Set(allBatchPayments.map(p => p.saleId))];
                globalSaleIds = saleIds;
                
                totalUSD = 0;
                itemsList = [];
                totalBsPaid = 0;
                
                const salesPromises = saleIds.map(id => getDoc(doc(db, "businesses", businessId, "sales", id)));
                const salesSnaps = await Promise.all(salesPromises);
                
                salesSnaps.forEach(snap => {
                    if (snap.exists()) {
                        const sData = snap.data();
                        totalUSD += parseFloat(sData.totalUSD || sData.total || 0);
                        itemsList = itemsList.concat(sData.items || sData.products || []);
                    }
                });
                
                allBatchPayments.forEach(p => {
                    let amountBs = parseFloat(p.amountBs || 0);
                    if (amountBs === 0 && (p.currency === 'BS' || p.currency === 'Bs')) {
                        amountBs = parseFloat(p.amount || 0);
                    } else if (amountBs === 0) {
                        amountBs = parseFloat(p.amount || 0) * parseFloat(p.bcvRate || 1);
                    }
                    totalBsPaid += amountBs;
                });
                
                if (totalUSD > 0) {
                    effectiveRate = totalBsPaid / totalUSD;
                }
            } else {
                if (payments.length > 0) {
                    payments.forEach(p => {
                        let amountBs = parseFloat(p.amountBs || 0);
                        if (amountBs === 0 && (p.currency === 'BS' || p.currency === 'Bs')) {
                            amountBs = parseFloat(p.amount || 0);
                        }
                        totalBsPaid += amountBs;
                    });
                    if (totalUSD > 0) {
                        effectiveRate = totalBsPaid / totalUSD;
                    }
                } else {
                    // If no payments, use global rate of the sale date or fallback
                    let dateStr = sale.date;
                    if (dateStr) {
                        const safeDateStr = dateStr.replace(/\//g, '-');
                        const docSnap = await getDoc(doc(db, "global_bcv_history", safeDateStr));
                        if (docSnap.exists()) {
                            effectiveRate = parseFloat(docSnap.data().rate);
                        } else {
                            effectiveRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
                        }
                    } else {
                        effectiveRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
                    }
                    totalBsPaid = totalUSD * effectiveRate;
                }
            }
            
            if (isNaN(effectiveRate) || effectiveRate <= 0) effectiveRate = 1;
            
            // Build products table
            let productsHTML = '';
            let sumSubTotalBs = 0;
            
            // Group items by name and price to avoid repetition
            let groupedItems = [];
            itemsList.forEach(item => {
                let itemName = item.name || item.productName || 'Producto';
                let itemPrice = parseFloat(item.price || item.priceUSD || 0);
                let itemQty = parseFloat(item.qty || item.quantity || 1);
                
                let existing = groupedItems.find(g => g.name === itemName && g.priceUSD === itemPrice);
                if (existing) {
                    existing.qty += itemQty;
                } else {
                    groupedItems.push({
                        name: itemName,
                        priceUSD: itemPrice,
                        qty: itemQty
                    });
                }
            });
            
            groupedItems.forEach((p, index) => {
                let qty = p.qty;
                let priceUSD = p.priceUSD;
                
                // Calculate Bs values
                let unitBs = priceUSD * effectiveRate;
                let subTotalBs = unitBs * qty;
                
                // Adjust last item rounding difference if any
                if (index === groupedItems.length - 1) {
                    let currentSum = sumSubTotalBs + subTotalBs;
                    let diff = totalBsPaid - currentSum;
                    subTotalBs += diff;
                }
                
                sumSubTotalBs += subTotalBs;
                
                productsHTML += `
                    <tr>
                        <td style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: center; vertical-align: middle;">${qty.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                        <td style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: left; vertical-align: middle;">${p.name || 'Producto'}</td>
                        <td style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: center; vertical-align: middle;">Bs ${unitBs.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                        <td style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: center; vertical-align: middle;">Bs ${subTotalBs.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                    </tr>
                `;
            });
            
            // Render hidden HTML
            const hiddenContainer = document.createElement('div');
            hiddenContainer.style.position = 'absolute';
            hiddenContainer.style.left = '-9999px';
            hiddenContainer.style.top = '-9999px';
            hiddenContainer.style.background = '#fff';
            hiddenContainer.style.color = '#000';
            hiddenContainer.style.width = '600px';
            hiddenContainer.style.padding = '20px';
            hiddenContainer.style.fontFamily = 'Arial, sans-serif';
            
            // Get last payment date or sale date
            let lastPaymentDate = sale.date;
            let paymentsToUse = isGlobal ? allBatchPayments : payments;
            if (paymentsToUse.length > 0) {
                let sorted = paymentsToUse.sort((a,b) => new Date(a.date) - new Date(b.date));
                lastPaymentDate = sorted[sorted.length-1].date;
            }
            
            let clientName = sale.clientName || 'Desconocido';
            let clientAddress = sale.clientAddress || sale.clientDirection || '';
            let clientDoc = sale.clientDocument || sale.clientRif || '';
            
            if ((!clientAddress || !clientDoc) && sale.clientId) {
                try {
                    const clientSnap = await getDoc(doc(db, "businesses", businessId, "clients", sale.clientId));
                    if (clientSnap.exists()) {
                        const cData = clientSnap.data();
                        clientAddress = clientAddress || cData.address || cData.direction || '-';
                        clientDoc = clientDoc || cData.document || cData.rif || cData.idNumber || clientSnap.id || '-';
                        clientName = clientName === 'Desconocido' ? (cData.name || 'Desconocido') : clientName;
                    }
                } catch (e) {
                    console.error("Error fetching client details:", e);
                }
            }
            
            clientDoc = clientDoc || sale.clientId || '-';
            clientAddress = clientAddress || '-';
            
            hiddenContainer.innerHTML = `
                <h2 style="text-align: center; font-size: 24px; font-weight: bold; margin: 0 0 10px 0;">FACTURA</h2>
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                    <div>
                        <div style="font-size: 14px; font-weight: bold;">${clientName.toUpperCase()}</div>
                        <div style="font-size: 14px;">${clientAddress}</div>
                        <div style="font-size: 14px;">${clientDoc}</div>
                    </div>
                    <div style="font-size: 14px; font-weight: bold; align-self: flex-end;">
                        ${formatDateToDDMMYYYY(lastPaymentDate)}
                    </div>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: center; vertical-align: middle;">CANTIDAD</th>
                            <th style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: center; vertical-align: middle;">PRODUCTO</th>
                            <th style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: center; vertical-align: middle;">PRECIO UNIT</th>
                            <th style="border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; text-align: center; vertical-align: middle;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productsHTML}
                    </tbody>
                </table>
                
                <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
                    <div style="background-color: #8fbc8f; border: 1px solid #000; padding: 0px 10px 15px 10px; line-height: 1; font-weight: bold; font-size: 16px;">
                        Bs ${totalBsPaid.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </div>
                </div>
            `;
            
            document.body.appendChild(hiddenContainer);
            
            const canvas = await html2canvas(hiddenContainer, {scale: 2});
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            
            document.body.removeChild(hiddenContainer);
            
            // Update db
            if (isGlobal) {
                for (const sid of globalSaleIds) {
                    await updateDoc(doc(db, "businesses", businessId, "sales", sid), {
                        manualInvoiceGenerated: true
                    });
                    
                    const relatedBtn = document.querySelector(`.btn-manual-invoice[data-id="${sid}"]`);
                    if (relatedBtn) {
                        relatedBtn.style.backgroundColor = 'var(--success)';
                    }
                    
                    if (typeof currentData !== 'undefined' && currentData) {
                        const memorySale = currentData.find(i => i.id === sid);
                        if (memorySale) memorySale.manualInvoiceGenerated = true;
                    }
                }
            } else {
                if (!sale.manualInvoiceGenerated) {
                    await updateDoc(doc(db, "businesses", businessId, "sales", sale.id), {
                        manualInvoiceGenerated: true
                    });
                    btnEl.style.backgroundColor = 'var(--success)';
                    sale.manualInvoiceGenerated = true;
                }
            }
            
            // Show Modal
            const [year, month, day] = (lastPaymentDate || '').split('-');
            const mmdd = (month && day) ? `${month}/${day}` : '';
            const copyText = `${mmdd} - ${clientName}`;
            
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.flexDirection = 'column';
            modal.style.padding = '20px';
            
            modal.innerHTML = `
                <div class="card" style="background: var(--surface); padding: 1.5rem; max-width: 700px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; align-items: center; border-radius: 12px; position: relative; color: var(--text-main);">
                    <button id="closeModalBtn" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; color: var(--text-main); cursor: pointer;">&times;</button>
                    <h3 style="margin-bottom: 1rem; color: var(--text-main);">Factura Generada</h3>
                    
                    <div style="flex: 1; overflow: auto; width: 100%; display: flex; justify-content: center; margin-bottom: 1.5rem; background: #e0e0e0; padding: 10px; border-radius: 8px;">
                        <img src="${dataUrl}" style="max-width: 100%; height: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3);" />
                    </div>
                    
                    <div style="width: 100%; display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="color: var(--text-muted); font-weight: bold; font-size: 0.8rem; text-transform: uppercase;">Nombre Sugerido para Archivo</label>
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                                <input type="text" class="form-control" id="copyInput" value="${copyText}" readonly style="flex: 1; font-family: monospace; font-size: 1rem; padding: 0.5rem;">
                                <button class="btn btn-outline" id="copyBtn" style="width: auto; padding: 0.5rem 1rem;">Copiar</button>
                            </div>
                        </div>
                        
                        <a href="${dataUrl}" download="${copyText.replace(/[\/\\?%*:|"<>]/g, '-')}.jpg" class="btn btn-primary" style="text-align: center; text-decoration: none; padding: 0.8rem; font-weight: bold;">⬇️ Descargar Imagen</a>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('#closeModalBtn').onclick = () => document.body.removeChild(modal);
            modal.querySelector('#copyBtn').onclick = () => {
                const input = modal.querySelector('#copyInput');
                input.select();
                document.execCommand('copy');
                showNotification("Copiado al portapapeles", "success");
            };
            
        } catch (e) {
            console.error(e);
            showNotification("Error al generar la factura", "error");
        } finally {
            btnEl.disabled = false;
        }
    }

    async function showPurchaseDetailView(purchase) {
        const reportsContainer = container.querySelector('.reports-container');
        const modalContainer = container.querySelector('#purchaseDetailModalContainer');
        
        showNotification("Cargando detalle de compra...", "info");

        let payments = [];
        try {
            const paySnap = await getDocs(collection(db, "businesses", businessId, "purchases", purchase.id, "payments"));
            payments = paySnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(a.date) - new Date(b.date));
        } catch (e) {
            console.error("Error fetching payments for " + purchase.id + ":", e);
        }

        const legacyAmount = purchase.equivalentUsd || (purchase.totalUsd - purchase.pendingBalanceUsd);
        if (payments.length === 0 && legacyAmount > 0.01) {
            payments.push({
                id: 'legacy',
                date: purchase.paymentDate || purchase.receptionDate || purchase.emissionDate,
                method: purchase.paymentMethod || 'Abono Registrado',
                reference: purchase.reference || '-',
                equivalentUsd: legacyAmount,
                type: 'LEGACY'
            });
        }

        const supName = getSupplierName(purchase);
        
        let badgeColor = 'var(--text-muted)';
        if (purchase.status === 'CREDITO') badgeColor = 'var(--danger)';
        if (purchase.status === 'PAGADO' || purchase.status === 'CONTADO') badgeColor = 'var(--success)';
        if (purchase.status === 'ABONO') badgeColor = 'var(--warning)';

        const productsList = purchase.products || purchase.items || [];

        let html = `
            <div class="desktop-only" style="padding-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                    <button class="btn btn-outline" id="backToDeckBtn" style="width: auto; padding: 0.5rem 1rem;">← Atrás</button>
                    <h2>Detalle de Compra</h2>
                </div>
                
                <div class="card mb-4" style="padding: 1rem 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <div>
                            <h3 style="color: var(--primary); margin-bottom: 0.25rem;">${supName}</h3>
                            <p style="color: var(--text-muted); font-size: 0.9rem;">Tasa Factura: Bs. ${purchase.bcvRate || 'N/A'} | Creado por: ${purchase.createdBy || 'Sistema'}</p>
                        </div>
                        
                        <div>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha Emisión</p>
                            <p style="font-weight: 500;">${formatDateToDDMMYYYY(purchase.emissionDate || purchase.date)}</p>
                        </div>
                        <div>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha Recepción</p>
                            <p style="font-weight: 500;">${formatDateToDDMMYYYY(purchase.receptionDate || purchase.date)}</p>
                        </div>
                        <div>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Moneda Original</p>
                            <p style="font-weight: 500;">${purchase.currency === 'BS' ? 'BOLÍVARES' : 'DÓLARES'}</p>
                        </div>
                        <div>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Total Items</p>
                            <p style="font-weight: 500;">${purchase.itemsCount || productsList.length}</p>
                        </div>

                        <div style="text-align: right;">
                            <span style="display: inline-block; padding: 0.3rem 0.6rem; border-radius: 12px; background: ${badgeColor}20; color: ${badgeColor}; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.5rem;">
                                ESTADO: ${purchase.status || 'N/A'}
                            </span>
                            <p style="font-weight: bold; font-size: 1.1rem;">${purchase.docType || 'Documento'} N° ${purchase.docNumber || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div class="detail-grid" style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                    <div class="card" style="padding: 1rem 1.5rem; display: flex; flex-direction: column;">
                        <div style="overflow-x: auto; flex: 1;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <th style="padding: 0.5rem;">Producto</th>
                                        <th style="padding: 0.5rem;">Cant.</th>
                                        <th style="padding: 0.5rem;">Costo $</th>
                                        <th style="padding: 0.5rem;">Costo Bs</th>
                                        <th style="padding: 0.5rem;">SubTotal $</th>
                                        <th style="padding: 0.5rem;">SubTotal Bs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productsList.map(p => {
                                        const subTotalBs = p.subTotalBs || ((p.costBs || 0) * p.qty) || 0;
                                        const subTotalUsd = p.subTotalUsd || ((p.costUsd || p.costUSD || 0) * p.qty) || 0;
                                        return `
                                        <tr>
                                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${p.name || 'Producto'}</td>
                                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${p.qty || p.quantity || 1} ${p.stockUnit || 'ud'}</td>
                                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">$ ${(p.costUsd || p.costUSD || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">Bs. ${(p.costBs || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border); font-weight: bold; color: var(--primary);">$ ${subTotalUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 0.5rem; border-bottom: 1px solid var(--border); font-weight: bold; color: var(--text-main);">Bs. ${subTotalBs.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; justify-content: center;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 1rem;">
                                <span style="color: var(--text-muted);">Total Facturado:</span>
                                <strong>$ ${getPurchaseTotal(purchase).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                                <span style="color: var(--text-muted);">Referencia BCV:</span>
                                <span style="font-size: 0.9rem;">Bs. ${(purchase.totalBs || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding-top: 1rem; border-top: 2px solid var(--border); font-size: 1.25rem; color: ${purchase.pendingBalanceUsd > 0 ? 'var(--danger)' : 'var(--success)'};">
                                <span>Saldo Pendiente:</span>
                                <strong>$ ${(purchase.pendingBalanceUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                            </div>
                        </div>

                        <div class="card" style="padding: 1.5rem; background: var(--background); flex: 1; display: flex; flex-direction: column;">
                            <h4 style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted);">Historial de Pagos</h4>
                            ${payments.length > 0 ? `
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                                        <thead>
                                            <tr style="border-bottom: 1px solid var(--border); color: var(--text-muted);">
                                                <th style="padding: 0.5rem;">Fecha</th>
                                                <th style="padding: 0.5rem;">Método</th>
                                                <th style="padding: 0.5rem;">Ref.</th>
                                                <th style="padding: 0.5rem; text-align: right;">Abono Bs.</th>
                                                <th style="padding: 0.5rem; text-align: right;">Equiv. $</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${payments.map(p => {
                                                const amtBs = p.amountBs || (p.id === 'legacy' ? (purchase.receivedBs || 0) : 0);
                                                return `
                                                <tr style="border-bottom: 1px solid var(--border);">
                                                    <td style="padding: 0.5rem;">${formatDateToDDMMYYYY(p.date)}</td>
                                                    <td style="padding: 0.5rem;">${p.method}</td>
                                                    <td style="padding: 0.5rem;"><small>${p.reference || '-'}</small></td>
                                                    <td style="padding: 0.5rem; text-align: right;">${amtBs > 0 ? `Bs. ${amtBs.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}</td>
                                                    <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: var(--success);">$ ${(p.equivalentUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : '<p class="text-muted">No se registraron pagos para esta factura.</p>'}
                        </div>
                    </div>
                </div>
            </div>

            <div class="mobile-only" style="padding-bottom: 6rem;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                    <button id="mobileBackToDeckBtn" style="background: none; border: none; color: var(--text-main); font-size: 1.5rem; padding: 0; cursor: pointer;">←</button>
                    <h2 style="margin: 0; font-size: 1.25rem;">Detalle de Compra</h2>
                </div>

                <div class="card" style="background: var(--surface); border: 1px solid var(--border); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <div>
                            <span style="font-size: 0.7rem; color: var(--primary-fixed-dim); font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase;">Proveedor</span>
                            <h3 style="font-size: 1.1rem; margin-top: 0.25rem; color: var(--text-main);">${supName}</h3>
                        </div>
                        <span style="padding: 0.35rem 0.75rem; border-radius: 999px; background: ${badgeColor}20; color: ${badgeColor}; font-size: 0.75rem; font-weight: 700;">${purchase.status || 'N/A'}</span>
                    </div>
                    <div style="height: 1px; background: var(--border); margin: 1rem 0;"></div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Doc.</span>
                            <div style="font-size: 0.9rem; margin-top: 0.25rem; color: var(--text-main);">N° ${purchase.docNumber || 'N/A'}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Tasa Factura</span>
                            <div style="font-size: 0.9rem; margin-top: 0.25rem; color: var(--text-main);">Bs. ${purchase.bcvRate || 'N/A'}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Emisión</span>
                            <div style="font-size: 0.9rem; margin-top: 0.25rem; color: var(--text-main);">${formatDateToDDMMYYYY(purchase.emissionDate || purchase.date)}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Recepción</span>
                            <div style="font-size: 0.9rem; margin-top: 0.25rem; color: var(--text-main);">${formatDateToDDMMYYYY(purchase.receptionDate || purchase.date)}</div>
                        </div>
                    </div>
                </div>

                <div class="card" style="background: var(--surface); border: 1px solid var(--border); padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Total Facturado</span>
                        <strong style="font-size: 1rem; color: var(--text-main);">$ ${getPurchaseTotal(purchase).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Referencia BCV</span>
                        <span style="font-size: 0.9rem; color: var(--text-muted);">Bs. ${(purchase.totalBs || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div style="height: 1px; background: var(--border); margin-bottom: 1rem;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: var(--primary-fixed-dim);">
                        <span style="font-size: 1rem; font-weight: bold;">Saldo Pendiente</span>
                        <strong style="font-size: 1.1rem; color: var(--text-main);">$ ${(purchase.pendingBalanceUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                    </div>
                </div>

                <h4 style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); margin-bottom: 0.75rem; text-transform: uppercase;">PRODUCTOS (${productsList.length} ITEMS)</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
                    ${productsList.map(p => {
                        const subUsd = p.subTotalUsd || ((p.costUsd || p.costUSD || 0) * p.qty) || 0;
                        return `
                        <div class="card" style="background: var(--surface); border: 1px solid var(--border); padding: 1rem; border-radius: 8px;">
                            <h4 style="font-size: 1rem; margin-bottom: 1rem; color: var(--text-main);">${p.name || 'Producto'}</h4>
                            <div style="display: flex; justify-content: space-between;">
                                <div>
                                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Cant.</span>
                                    <div style="font-size: 0.85rem; font-family: monospace; color: var(--text-main); margin-top: 0.25rem;">${p.qty || p.quantity || 1} ${p.stockUnit || 'Ud'}</div>
                                </div>
                                <div>
                                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Costo Ud.</span>
                                    <div style="font-size: 0.85rem; font-family: monospace; color: var(--text-main); margin-top: 0.25rem;">$ ${(p.costUsd || p.costUSD || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Subtotal</span>
                                    <div style="font-size: 0.85rem; font-family: monospace; color: var(--success); font-weight: bold; margin-top: 0.25rem;">$ ${subUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                </div>
                            </div>
                        </div>
                        `
                    }).join('')}
                </div>

                <h4 style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); margin-bottom: 0.75rem; text-transform: uppercase;">HISTORIAL DE PAGOS</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem;">
                    ${payments.length > 0 ? payments.map(p => {
                        const amtBs = p.amountBs || (p.id === 'legacy' ? (purchase.receivedBs || 0) : 0);
                        return `
                        <div class="card" style="background: var(--surface); border: 1px solid var(--border); padding: 1rem; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <h4 style="font-size: 1rem; margin-bottom: 0.25rem; color: var(--text-main);">${p.method}</h4>
                                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Ref: ${p.reference || '-'}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${formatDateToDDMMYYYY(p.date)}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.95rem; font-weight: bold; color: var(--success); margin-bottom: 0.25rem;">$ ${(p.equivalentUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Bs. ${amtBs.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                </div>
                            </div>
                        </div>
                        `
                    }).join('') : '<p class="text-muted" style="font-size: 0.9rem;">No se registraron pagos.</p>'}
                </div>

                <div style="position: fixed; bottom: 0; left: 0; right: 0; padding: 1rem; background: var(--surface); border-top: 1px solid var(--border); z-index: 10;">
                    <button class="btn btn-primary" id="mobileBackBtn2" style="width: 100%; padding: 0.8rem; font-size: 1rem; font-weight: bold; border-radius: 8px;">Volver</button>
                </div>
            </div>
        `;

        reportsContainer.style.display = 'none';
        modalContainer.innerHTML = html;
        modalContainer.style.display = 'block';

        const closeView = () => {
            modalContainer.innerHTML = '';
            modalContainer.style.display = 'none';
            reportsContainer.style.display = 'flex';
        };

        ['#backToDeckBtn', '#mobileBackToDeckBtn', '#mobileBackBtn2'].forEach(id => {
            const btn = modalContainer.querySelector(id);
            if(btn) btn.addEventListener('click', closeView);
        });
    }

    async function fetchPaymentsForExport() {
        const dataWithPayments = [];
        showNotification("Recopilando pagos, por favor espere...", "info");
        
        const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
        
        for (const item of currentData) {
            let payments = [];
            if (currentType === 'sales' || currentType === 'payments_received') {
                const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", item.id));
                const snap = await getDocs(q);
                payments = snap.docs.map(d => d.data());
            } else {
                const snap = await getDocs(collection(db, "businesses", businessId, "purchases", item.id, "payments"));
                payments = snap.docs.map(d => d.data());
            }
            
            // Asignar tasa BCV histórica si falta
            for (let p of payments) {
                if (!p.bcvRate) {
                    try {
                        const dateStr = p.date || item.date;
                        if (dateStr) {
                            const safeDateStr = dateStr.replace(/\//g, '-');
                            const docSnap = await getDoc(doc(db, "global_bcv_history", safeDateStr));
                            if (docSnap.exists()) {
                                p.bcvRate = docSnap.data().rate;
                            } else {
                                p.bcvRate = currentBcvRate;
                            }
                        } else {
                            p.bcvRate = currentBcvRate;
                        }
                    } catch (e) {
                        console.error("Error fetching historical rate:", e);
                        p.bcvRate = currentBcvRate;
                    }
                }
            }
            
            dataWithPayments.push({ ...item, _payments: payments });
        }
        return dataWithPayments;
    }

    async function exportToExcel() {
        if (!currentData || currentData.length === 0) return;
        
        try {
            const dataWithPayments = await fetchPaymentsForExport();
            const exportRows = [];
            
            dataWithPayments.forEach(item => {
                const isSales = currentType === 'sales' || currentType === 'payments_received';
                const entity = isSales ? item.clientName : getSupplierName(item);
                const total = isSales ? (item.totalUSD || 0) : getPurchaseTotal(item);
                const numFactura = isSales ? (item.correlative || item.id.slice(-6).toUpperCase()) : (item.docNumber || item.id.slice(-6).toUpperCase());
                
                // Formatear productos
                const productsList = item.items || item.products || [];
                const productosFormateados = productsList.map(p => `${p.qty || p.quantity || 1} - ${p.name || 'Producto'}`).join(', ');

                // Formatear pagos
                let pagosFormateados = "Sin pagos";
                let fechaUltimoPago = "---";

                if (item._payments && item._payments.length > 0) {
                    // Ordenar pagos del más antiguo al más reciente
                    const sortedPayments = [...item._payments].sort((a,b) => new Date(a.date) - new Date(b.date));
                    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
                    
                    pagosFormateados = sortedPayments.map(p => {
                        const method = p.method ? p.method.replace('_', ' ') : 'PAGO';
                        const isBs = p.currency === 'BS' || p.currency === 'Bs';
                        const amount = p.amount || 0;
                        const rate = p.bcvRate || currentBcvRate;
                        
                        let eqvUsd = 0;
                        let montoBs = 0;

                        if (isBs) {
                            montoBs = p.amountBs || amount;
                            eqvUsd = p.equivalentUsd || (montoBs / rate);
                        } else {
                            eqvUsd = p.equivalentUsd || amount;
                            montoBs = p.amountBs || (eqvUsd * rate);
                        }

                        const dateStr = formatDateToDDMMYYYY(p.date || item.date);
                        return `${dateStr} - ${method} - $ ${eqvUsd.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})} - Bs. ${montoBs.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
                    }).join(', ');

                    fechaUltimoPago = formatDateToDDMMYYYY(sortedPayments[sortedPayments.length - 1].date || item.date);
                }

                exportRows.push({
                    "Fecha": formatDateToDDMMYYYY(item.date),
                    "Nro Factura": numFactura,
                    "Cliente / Proveedor": entity,
                    "Estado": (item.status || '').toUpperCase(),
                    "Total Factura ($)": total,
                    "Productos": productosFormateados,
                    "Pagos Recibidos": pagosFormateados,
                    "Fecha Último Pago": fechaUltimoPago
                });
            });
            
            const worksheet = XLSX.utils.json_to_sheet(exportRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
            XLSX.writeFile(workbook, `Reporte_${currentType}_${new Date().getTime()}.xlsx`);
            showNotification("Excel exportado con éxito", "success");
        } catch (e) {
            console.error(e);
            showNotification("Error exportando a Excel. Verifique las librerías.", "error");
        }
    }

    async function exportToPDF() {
        if (!currentData || currentData.length === 0) return;
        
        try {
            const dataWithPayments = await fetchPaymentsForExport();
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape'); // Horizontal para que quepa todo el texto
            
            doc.setFontSize(16);
            doc.text(`Reporte de ${currentType === 'sales' ? 'Ventas' : (currentType === 'payments_received' ? 'Pagos Recibidos' : 'Compras')}`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 22);
            
            const tableColumn = ["Fecha", "Nro Fact.", "Entidad", "Estado", "Total $", "Productos", "Pagos Recibidos"];
            const tableRows = [];
            
            dataWithPayments.forEach(item => {
                const isSales = currentType === 'sales' || currentType === 'payments_received';
                const entity = isSales ? item.clientName : getSupplierName(item);
                const total = isSales ? (item.totalUSD || 0) : getPurchaseTotal(item);
                const numFactura = isSales ? (item.correlative || item.id.slice(-6).toUpperCase()) : (item.docNumber || item.id.slice(-6).toUpperCase());
                
                const productsList = item.items || item.products || [];
                const productosFormateados = productsList.map(p => `${p.qty || p.quantity || 1} - ${p.name || 'Producto'}`).join(', ');

                let pagosFormateados = "Sin pagos";
                if (item._payments && item._payments.length > 0) {
                    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
                    
                    pagosFormateados = sortedPayments.map(p => {
                        const method = p.method ? p.method.replace('_', ' ') : 'PAGO';
                        const isBs = p.currency === 'BS' || p.currency === 'Bs';
                        const amount = p.amount || 0;
                        const rate = p.bcvRate || currentBcvRate;
                        
                        let eqvUsd = 0;
                        let montoBs = 0;

                        if (isBs) {
                            montoBs = p.amountBs || amount;
                            eqvUsd = p.equivalentUsd || (montoBs / rate);
                        } else {
                            eqvUsd = p.equivalentUsd || amount;
                            montoBs = p.amountBs || (eqvUsd * rate);
                        }

                        const dateStr = formatDateToDDMMYYYY(p.date || item.date);
                        return `${dateStr} - ${method} - $ ${eqvUsd.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})} - Bs. ${montoBs.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
                    }).join('\n');
                }
                
                tableRows.push([
                    formatDateToDDMMYYYY(item.date),
                    numFactura,
                    entity,
                    (item.status || '').toUpperCase(),
                    `$ ${total.toFixed(2)}`,
                    productosFormateados,
                    pagosFormateados
                ]);
            });
            
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 30,
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: { 
                    5: { cellWidth: 70 }, // Productos
                    6: { cellWidth: 80 }  // Pagos
                }
            });
            
            doc.save(`Reporte_${currentType}_${new Date().getTime()}.pdf`);
            showNotification("PDF exportado con éxito", "success");
        } catch (e) {
            console.error(e);
            showNotification("Error exportando a PDF. Verifique las librerías.", "error");
        }
    }

    init();
}
