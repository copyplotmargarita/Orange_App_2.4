import { db } from '../services/firebase.js';
import { formatDateToDDMMYYYY, showConfirmModal } from '../utils.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { generateDocumentView } from './sales.js';

export async function renderReceivables(container) {
    if (!container) return;

    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');
    const storeId = role === 'admin' ? null : localStorage.getItem('storeId');
    
    // Obtener la tasa BCV del día desde el localStorage
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;

    container.innerHTML = `
        <div id="receivablesTopSticky" style="position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="btn btn-outline" id="backToDashboardBtn" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; width: auto; padding: 0 12px; height: 34px; font-size: 0.85rem; flex-shrink: 0;">&larr; Volver</button>
                    <h2 style="color: var(--primary); font-size: 1.25rem; font-weight: 800; margin-bottom: 0; white-space: nowrap;">📋 Cuentas por Cobrar</h2>
                </div>
                
                <div style="position: relative; flex-grow: 1; min-width: 260px; max-width: 400px; margin-left: auto;">
                    <input type="text" id="searchClientInput" placeholder="🔍 Buscar cliente..." style="padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #ffffff; width: 100%; box-sizing: border-box; font-size: 14px;">
                </div>
            </div>
            
            <div id="receivables-metrics"></div>
        </div>
        
        <div class="card" style="padding:0;overflow:visible;border-radius:12px;">
            <div id="receivables-content">
                <p style="padding: 1rem;">Cargando datos...</p>
            </div>
        </div>
        
        <style>
            .premium-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .premium-table th { text-align: left; padding: 12px; background: rgba(255,255,255,0.05); color: #a0aec0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .premium-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; color: #e2e8f0; }
            .premium-table tr.clickable-row { cursor: pointer; transition: background 0.2s; }
            .premium-table tr.clickable-row:hover { background: rgba(255,255,255,0.05); }
            .premium-table tr.sale-row { cursor: pointer; transition: background 0.2s; }
            .premium-table tr.sale-row:hover { background: rgba(255,255,255,0.05); }
            
            /* Responsive Grid */
            .clients-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 16px; margin-bottom: 20px; }
            @media (min-width: 768px) { .clients-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (min-width: 1024px) { .clients-grid { grid-template-columns: repeat(3, 1fr); } }
            @media (min-width: 1280px) { .clients-grid { grid-template-columns: repeat(4, 1fr); } }
            
            /* Responsive display classes */
            @media (min-width: 768px) { .mobile-only { display: none !important; } }
            @media (max-width: 767px) { .desktop-only { display: none !important; } }
            
            /* Obsidian Metric Cards */
            .data-card { background-color: #1E2230; border: 1px solid #2A2F3E; padding: 16px; border-radius: 12px; cursor: pointer; transition: transform 0.15s ease, background 0.2s; }
            .data-card:hover { background-color: #272a33; }
            .data-card:active { transform: scale(0.98); }
            .data-card-h3 { color: #e0e2ee; font-size: 16px; font-weight: 600; margin: 0; }
            .data-card-badge { background: #32343e; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #c1c7d3; }
            .data-card-amount { color: #ffb4ab; font-size: 13px; font-weight: bold; font-family: 'JetBrains Mono', monospace; text-align: right; }
            .data-card-amount.large { font-size: 16px; }
            .data-card-meta { font-size: 10px; color: #c1c7d3; text-transform: uppercase; margin-bottom: 2px; }
            .data-card-val { font-size: 14px; color: #e0e2ee; }
            .data-card-divider { border-top: 1px solid rgba(65, 71, 81, 0.3); margin-top: 12px; padding-top: 12px; }

            .invoice-card { background: #1c212d; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; margin-bottom: 16px; transition: transform 0.15s; }
            .invoice-card:active { transform: scale(0.98); }
            
            /* Metrics Grid */
            .metrics-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding-bottom: 8px; }
            .metrics-grid-2 .metric-box { background: #1E2230; border: 1px solid #2A2F3E; border-radius: 12px; padding: 16px; text-align: center; }
            .metrics-grid-2 .metric-box.danger-top { border-top: 2px solid #ef4444; }
            .metrics-grid-2 .title { font-size: 11px; color: #c1c7d3; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
            .metrics-grid-2 .value { font-size: 24px; font-weight: 700; color: #e0e2ee; }
            
            .metrics-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 20px; }
            .metrics-grid .metric-box { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); text-align: center; }
            .metrics-grid .title { font-size: 10px; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
            .metrics-grid .value { font-size: 18px; font-weight: bold; color: #ffffff; }
            
            #searchClientInput:focus { border-color: #63b3ed; outline: none; background: rgba(255,255,255,0.05); }
            
            /* Clases ultra-compactas para el modal */
            .form-group { margin-bottom: 0.6rem !important; }
            .form-group label { display: block; color: #a0aec0; font-size: 0.8rem; margin-bottom: 0.2rem !important; }
            
            .form-control { width: 100%; padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #ffffff; box-sizing: border-box; font-size: 13px; }
            .form-control:focus { border-color: #63b3ed; outline: none; }
            
            /* Forzar fondo oscuro en las opciones del select */
            .form-control option { background: #1a202c; color: #ffffff; }
        </style>
    `;

    const metricsDiv = container.querySelector('#receivables-metrics');
    const contentDiv = container.querySelector('#receivables-content');

    const backBtn = container.querySelector('#backToDashboardBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (window.lastViewBeforeReceivables === 'ventas') {
                window.lastViewBeforeReceivables = null;
                const navVentas = document.getElementById('navVentas');
                if (navVentas) {
                    navVentas.click();

                } else {
                    window.location.hash = '#dashboard';
                }
            } else {
                const navHome = document.getElementById('navHome');
                if (navHome) {
                    navHome.click();

                } else {
                    window.location.hash = '#dashboard';
                }
            }
        });
    }

    try {
        let q = query(collection(db, "businesses", businessId, "sales"), where("status", "in", ["credito", "abono"]));
        
        if (storeId) {
            q = query(q, where("storeId", "==", storeId));
        }

        const snap = await getDocs(q);
        const sales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calcular métricas
        const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Lunes
        const startOfWeek = new Date(today.setDate(diff));
        startOfWeek.setHours(0,0,0,0);

        let totalDebtUSD = 0;
        let totalDebtBs = 0;
        let debtToday = 0;
        let debtWeek = 0;
        const debtorsSet = new Set();

        // Agrupar por cliente
        const clientsMap = {};
        sales.forEach(sale => {
            const debt = sale.remainingUSD || 0;
            if (debt > 0) {
                debtorsSet.add(sale.clientId);
                totalDebtUSD += debt;
                totalDebtBs += debt * currentBcvRate; // Usar tasa del día
                
                if (sale.date === todayStr) {
                    debtToday += debt;
                }
                
                const saleDate = new Date(sale.date);
                if (saleDate >= startOfWeek) {
                    debtWeek += debt;
                }

                const clientId = sale.clientId;
                if (!clientsMap[clientId]) {
                    clientsMap[clientId] = {
                        clientId: clientId,
                        clientName: sale.clientName,
                        invoiceCount: 0,
                        totalDebt: 0,
                        totalDebtBs: 0,
                        oldestDate: sale.date,
                        newestDate: sale.date,
                        sales: []
                    };
                }
                clientsMap[clientId].invoiceCount++;
                clientsMap[clientId].totalDebt += debt;
                clientsMap[clientId].totalDebtBs += debt * currentBcvRate; // Usar tasa del día
                
                if (sale.date < clientsMap[clientId].oldestDate) {
                    clientsMap[clientId].oldestDate = sale.date;
                }
                if (sale.date > clientsMap[clientId].newestDate) {
                    clientsMap[clientId].newestDate = sale.date;
                }
                
                clientsMap[clientId].sales.push(sale);
            }
        });

        const clientsArray = Object.values(clientsMap);

        // Función para renderizar métricas globales
        function renderGlobalMetrics() {
            const metricsDiv = container.querySelector('#receivables-metrics');
            if (!metricsDiv) return;
            metricsDiv.innerHTML = `
                <div class="desktop-only">
                    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr);">
                        <div class="metric-box">
                            <div class="title">Total Deuda ($)</div>
                            <div class="value" style="color: #ef4444;">$ ${fmt(totalDebtUSD)}</div>
                        </div>
                        <div class="metric-box">
                            <div class="title">Total Deuda (Bs)</div>
                            <div class="value" style="color: #ef4444;">Bs. ${fmt(totalDebtBs)}</div>
                        </div>
                        <div class="metric-box">
                            <div class="title">Deuda Nueva (Hoy)</div>
                            <div class="value">$ ${fmt(debtToday)}</div>
                        </div>
                        <div class="metric-box">
                            <div class="title">Deuda Nueva (Esta Sem.)</div>
                            <div class="value">$ ${fmt(debtWeek)}</div>
                        </div>
                    </div>
                </div>
                <div class="mobile-only">
                    <div class="metrics-grid-2">
                        <div class="metric-box">
                            <div class="title">Clientes con Deuda</div>
                            <div class="value">${clientsArray.length}</div>
                        </div>
                        <div class="metric-box danger-top">
                            <div class="title">Total Deuda ($)</div>
                            <div class="value" style="color: #ffb4ab;">$ ${fmt(totalDebtUSD)}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        renderGlobalMetrics();

        if (clientsArray.length === 0) {
            contentDiv.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #718096;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🎉</div>
                    <p>No hay cuentas por cobrar pendientes.</p>
                </div>
            `;
            return;
        }

        contentDiv.innerHTML = `
            <div class="desktop-only">
                <table class="premium-table" id="clientsTable" style="margin-bottom:0;">
                    <thead>
                        <tr>
                            <th class="sticky-th" style="position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-left-radius: 12px;">Cliente</th>
                            <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Facturas</th>
                            <th class="sticky-th" style="text-align: right; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Deuda ($)</th>
                            <th class="sticky-th" style="text-align: right; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Deuda (Bs)</th>
                            <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">F. Más Antigua</th>
                            <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-right-radius: 12px;">Última Compra</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clientsArray.map(client => `
                            <tr class="clickable-row desktop-row" data-client-id="${client.clientId}">
                                <td style="font-weight: 500; color: #ffffff;">${client.clientName}</td>
                                <td style="text-align: center; color: #ffffff;">${client.invoiceCount}</td>
                                <td style="text-align: right; font-weight: bold; color: #e53e3e;">$ ${fmt(client.totalDebt)}</td>
                                <td style="text-align: right; font-weight: bold; color: #e53e3e;">Bs. ${fmt(client.totalDebtBs)}</td>
                                <td style="text-align: center; color: #ffffff;">${formatDateToDDMMYYYY(client.oldestDate)}</td>
                                <td style="text-align: center; color: #ffffff;">${formatDateToDDMMYYYY(client.newestDate)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="mobile-only">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 4px 12px 4px;">
                    <span style="font-size: 11px; font-weight: 700; color: #8b919d; text-transform: uppercase; letter-spacing: 0.05em;">Lista de Clientes</span>
                    <span style="font-size: 11px; font-weight: 700; color: #a4c9ff;">Ver todos</span>
                </div>
                <div class="clients-grid">
                    ${clientsArray.map(client => `
                        <div class="data-card clickable-row mobile-row" data-client-id="${client.clientId}">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <h3 class="data-card-h3">${client.clientName}</h3>
                                    <div style="margin-top: 4px;">
                                        <span class="data-card-badge">${client.invoiceCount} FACTURA${client.invoiceCount > 1 ? 'S' : ''}</span>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div class="data-card-amount large">$ ${fmt(client.totalDebt)}</div>
                                    <div class="data-card-amount large" style="opacity: 0.8; margin-top: 4px;">Bs. ${fmt(client.totalDebtBs)}</div>
                                </div>
                            </div>
                            <div class="data-card-divider" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                <div>
                                    <span class="data-card-meta block">F. Más Antigua</span>
                                    <span class="data-card-val font-mono-data">${formatDateToDDMMYYYY(client.oldestDate)}</span>
                                </div>
                                <div style="text-align: right;">
                                    <span class="data-card-meta block">Última Compra</span>
                                    <span class="data-card-val font-mono-data">${formatDateToDDMMYYYY(client.newestDate)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        // Init ResizeObserver for sticky header
        const topSticky = container.querySelector('#receivablesTopSticky');
        if (topSticky) {
            const updateSticky = () => {
                const h = topSticky.offsetHeight - 12;
                container.querySelectorAll('.sticky-th').forEach(th => th.style.top = h + 'px');
            };
            const ro = new ResizeObserver(updateSticky);
            ro.observe(topSticky);
            setTimeout(updateSticky, 50);
        }

        // Lógica del Buscador
        const searchInput = container.querySelector('#searchClientInput');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = contentDiv.querySelectorAll('.clickable-row');
            rows.forEach(row => {
                let clientName = "";
                if (row.classList.contains('desktop-row')) {
                    clientName = row.querySelector('td').textContent.toLowerCase();
                } else if (row.classList.contains('mobile-row')) {
                    clientName = row.querySelector('.data-card-h3').textContent.toLowerCase();
                }
                
                if (clientName.includes(term)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });

        // Add event listeners for rows
        contentDiv.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const clientId = row.dataset.clientId;
                renderClientReceivables(clientsMap[clientId], container, () => {
                    renderReceivables(container);
                });
            });
        });

    } catch (e) {
        console.error("Error loading receivables:", e);
        contentDiv.innerHTML = `<p style="color: #e53e3e; text-align: center; padding: 20px;">Error al cargar los datos.</p>`;
    }
}

function renderClientReceivables(clientData, container, backToMainCallback) {
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;

    container.innerHTML = `
        <div id="receivablesTopSticky" style="position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="btn btn-outline" id="backToReceivablesBtn" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; width: auto; padding: 0 12px; height: 34px; font-size: 0.85rem; flex-shrink: 0;">&larr; Volver</button>
                    <h2 style="color: var(--primary); font-size: 1.25rem; font-weight: 800; margin-bottom: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">📋 ${clientData.clientName}</h2>
                </div>
                
                <div style="width: 100%; display: flex; justify-content: flex-end; flex-grow: 1; max-width: 400px;">
                    <button class="btn btn-primary" id="massPayBtn" style="width: 100%; padding: 0 16px; height: 42px; font-weight: 700; font-size: 0.9rem; white-space: nowrap; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">💰 Cargar Pago Global</button>
                </div>
            </div>
            
            <div id="receivables-metrics">
                <div class="metrics-grid" style="display: flex; gap: 10px; width: 100%;">
                    <div class="metric-box desktop-only" style="flex: 1;">
                        <div class="title">Facturas Pendientes</div>
                        <div class="value">${clientData.invoiceCount}</div>
                    </div>
                    <div class="metric-box" style="flex: 1;">
                        <div class="title">Total Pendiente ($)</div>
                        <div class="value" style="color: #ef4444;">$ ${fmt(clientData.totalDebt)}</div>
                    </div>
                    <div class="metric-box" style="flex: 1;">
                        <div class="title">Total Pendiente (Bs)</div>
                        <div class="value" style="color: #ef4444;">Bs. ${fmt(clientData.totalDebt * currentBcvRate)}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="desktop-only">
            <div class="card" style="padding:0;overflow:visible;border-radius:12px;">
                <div id="receivables-content">
                    <table class="premium-table" style="margin-bottom:0;">
                        <thead>
                            <tr>
                                <th class="sticky-th" style="position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-left-radius: 12px; width: 15%;">Correlativo</th>
                                <th class="sticky-th" style="position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); width: 15%;">Fecha</th>
                                <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); width: 15%;">Monto ($)</th>
                                <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); width: 20%;">Monto (Bs)</th>
                                <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); width: 10%;">Estado</th>
                                <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-right-radius: 12px; width: 25%;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientData.sales.map(sale => `
                                <tr class="sale-row desktop-sale-row" data-sale-id="${sale.id}">
                                    <td style="font-family: monospace; font-weight: bold; color: #63b3ed;">${sale.correlative || sale.id.slice(-6).toUpperCase()}</td>
                                    <td style="color: #e2e8f0;">${formatDateToDDMMYYYY(sale.date)}</td>
                                    <td style="text-align: center; font-weight: bold; color: #e2e8f0;">$ ${fmt(sale.remainingUSD || 0)}</td>
                                    <td style="text-align: center; color: #a0aec0;">Bs. ${fmt(sale.remainingUSD * currentBcvRate)}</td>
                                    <td style="text-align: center;">
                                        <span style="color: ${sale.status === 'credito' ? '#ef4444' : '#f59e0b'}; font-weight: bold; text-transform: uppercase; font-size: 0.85rem;">${sale.status}</span>
                                    </td>
                                    <td style="text-align: center;">
                                        <div style="display: flex; gap: 0.4rem; justify-content: center;">
                                            <button class="btn btn-outline print-invoice-btn" data-sale-id="${sale.id}" style="width: auto; padding: 4px 12px; font-size: 12px;" title="Ver Factura">📄 Ver Factura</button>
                                            <button class="btn btn-primary pay-btn" data-sale-id="${sale.id}" style="width: auto; padding: 4px 12px; font-size: 12px;">Cargar Pago</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="mobile-only" style="padding: 0 4px; overflow: visible; border-radius: 12px; margin-top: 1rem;">
            <div id="receivables-content-mobile">
                <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px;">
                    <span style="font-size: 11px; font-weight: 700; color: #8b919d; text-transform: uppercase; letter-spacing: 0.05em;">Facturas Pendientes</span>
                    <span style="font-size: 11px; font-weight: 700; color: #4a90e2;">Ver todas</span>
                </div>
                
                <div class="clients-grid">
                    ${clientData.sales.map(sale => `
                        <article class="invoice-card sale-row mobile-sale-row" data-sale-id="${sale.id}">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                                <div>
                                    <h3 style="color: #4a90e2; font-weight: 700; font-size: 18px; margin: 0;">${sale.correlative || sale.id.slice(-6).toUpperCase()}</h3>
                                    <p style="font-size: 12px; color: #8b919d; font-weight: 500; margin: 4px 0 0 0;">Fecha: ${formatDateToDDMMYYYY(sale.date)}</p>
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <span style="background: ${sale.status === 'credito' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(251, 191, 36, 0.1)'}; color: ${sale.status === 'credito' ? '#f87171' : '#fbbf24'}; font-size: 10px; font-weight: 900; padding: 4px 8px; border-radius: 4px; border: 1px solid ${sale.status === 'credito' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(251, 191, 36, 0.2)'}; text-transform: uppercase;">
                                        ${sale.status}
                                    </span>
                                    <button class="print-invoice-btn" data-sale-id="${sale.id}" title="Ver Factura" style="background: none; border: none; cursor: pointer; padding: 0; color: #a4c9ff; display: flex; align-items: center;">
                                        <span class="material-symbols-outlined" style="font-size: 20px;">description</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 16px;">
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-size: 10px; color: #8b919d; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Monto ($)</span>
                                    <span style="color: #ffb4ab; font-weight: 800; font-size: 18px;">$ ${fmt(sale.remainingUSD || 0)}</span>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                    <span style="font-size: 10px; color: #8b919d; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Monto (BS)</span>
                                    <span style="color: #ffb4ab; opacity: 0.8; font-weight: 800; font-size: 18px;">Bs. ${fmt(sale.remainingUSD * currentBcvRate)}</span>
                                </div>
                            </div>
                            
                            <button class="pay-btn" data-sale-id="${sale.id}" style="width: 100%; background: #4a90e2; color: #ffffff; font-weight: 700; padding: 12px 16px; border-radius: 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; border: none; cursor: pointer; box-shadow: 0 4px 14px 0 rgba(74, 144, 226, 0.2); transition: background 0.15s;">
                                Cargar Pago
                            </button>
                        </article>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <style>
            .premium-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .premium-table th { text-align: left; padding: 12px; background: rgba(255,255,255,0.05); color: #a0aec0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
            .premium-table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; color: #e2e8f0; }
            .premium-table tr.clickable-row { cursor: pointer; transition: background 0.2s; }
            .premium-table tr.clickable-row:hover { background: rgba(255,255,255,0.05); }
            .premium-table tr.sale-row { cursor: pointer; transition: background 0.2s; }
            .premium-table tr.sale-row:hover { background: rgba(255,255,255,0.05); }
            .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 4px; }
            .badge { padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .badge-warning { background: #fef3c7; color: #d97706; }
            .badge-danger { background: #fee2e2; color: #ef4444; }
            
            /* Responsive display classes */
            @media (min-width: 768px) { .mobile-only { display: none !important; } }
            @media (max-width: 767px) { .desktop-only { display: none !important; } }
            
            /* Responsive Grid */
            .clients-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 16px; margin-bottom: 20px; }
            @media (min-width: 768px) { .clients-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (min-width: 1024px) { .clients-grid { grid-template-columns: repeat(3, 1fr); } }
            @media (min-width: 1280px) { .clients-grid { grid-template-columns: repeat(4, 1fr); } }
            
            /* Obsidian Metric Cards */
            .data-card { background-color: #1E2230; border: 1px solid #2A2F3E; padding: 16px; border-radius: 12px; cursor: pointer; transition: transform 0.15s ease, background 0.2s; }
            .data-card:hover { background-color: #272a33; }
            .data-card:active { transform: scale(0.98); }
            .data-card-h3 { color: #e0e2ee; font-size: 16px; font-weight: 600; margin: 0; }
            .data-card-badge { background: #32343e; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; color: #c1c7d3; }
            .data-card-amount { color: #ffb4ab; font-size: 13px; font-weight: bold; font-family: 'JetBrains Mono', monospace; text-align: right; }
            .data-card-amount.large { font-size: 16px; }
            .data-card-meta { font-size: 10px; color: #c1c7d3; text-transform: uppercase; margin-bottom: 2px; }
            .data-card-val { font-size: 14px; color: #e0e2ee; }
            .data-card-divider { border-top: 1px solid rgba(65, 71, 81, 0.3); margin-top: 12px; padding-top: 12px; }

            .invoice-card { background: #1c212d; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; margin-bottom: 16px; transition: transform 0.15s; }
            .invoice-card:active { transform: scale(0.98); }
            
            .metrics-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 20px; }
            .metric-box { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); text-align: center; }
            .metric-box .title { font-size: 10px; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
            .metric-box .value { font-size: 18px; font-weight: bold; color: #ffffff; }
            
            #searchClientInput:focus, #searchInvoiceInput:focus { border-color: #63b3ed; outline: none; background: rgba(255,255,255,0.05); }
            
            /* Clases ultra-compactas para el modal */
            .form-group { margin-bottom: 0.6rem !important; }
            .form-group label { display: block; color: #a0aec0; font-size: 0.8rem; margin-bottom: 0.2rem !important; }
            
            .form-control { width: 100%; padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #ffffff; box-sizing: border-box; font-size: 13px; }
            .form-control:focus { border-color: #63b3ed; outline: none; }
            
            /* Forzar fondo oscuro en las opciones del select */
            .form-control option { background: #1a202c; color: #ffffff; }
        </style>
    `;

    // Event listeners
    container.querySelector('#backToReceivablesBtn').addEventListener('click', () => {
        backToMainCallback();
    });
    
    // (Removed searchInvoiceInput listener)

    // Update sticky headers for detail view
    setTimeout(() => {
        const topSticky = container.querySelector('#receivablesTopSticky');
        if (topSticky) {
            const h = topSticky.offsetHeight - 12;
            container.querySelectorAll('.sticky-th').forEach(th => th.style.top = h + 'px');
        }
    }, 50);

    // Add listeners for sale rows (click to view detail)
    container.querySelectorAll('.sale-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.pay-btn') || e.target.closest('.print-invoice-btn')) return; // Ignore if button clicked
            const saleId = row.dataset.saleId;
            const sale = clientData.sales.find(s => s.id === saleId);
            showSaleDetail(sale); // Call local function
        });
    });

    container.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const saleId = btn.dataset.saleId;
            const sale = clientData.sales.find(s => s.id === saleId);
            e.stopPropagation(); // Stop row click event
            
            showPaymentModal(sale, () => {
                // Callback para refrescar la vista después de pagar
                renderClientReceivables(clientData, container, backToMainCallback);
            });
        });
    });

    container.querySelector('#massPayBtn').addEventListener('click', () => {
        showCustomAlert("Información", "Cargar pago global para " + clientData.clientName, () => {
            showMassPaymentModal(clientData, () => {
                // Callback para refrescar la vista después de pagar
                renderClientReceivables(clientData, container, backToMainCallback);
            });
        });
    });

    container.querySelectorAll('.print-invoice-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Stop row click event
            const btnEl = e.target.closest('.print-invoice-btn');
            btnEl.disabled = true;
            btnEl.style.opacity = '0.5';
            
            const saleId = btnEl.dataset.saleId;
            const sale = clientData.sales.find(s => s.id === saleId);
            
            const businessId = localStorage.getItem('businessId');
            let salePayments = [];
            try {
                const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id));
                const paySnap = await getDocs(q);
                salePayments = paySnap.docs.map(doc => doc.data());
                
                await generateDocumentView(sale, salePayments);
            } catch (err) {
                console.error("Error al generar PDF de factura:", err);
            } finally {
                btnEl.disabled = false;
                btnEl.style.opacity = '1';
            }
        });
    });
}

export function showPaymentModal(sale, onComplete, paymentData = null) {
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
    
    // Si estamos editando, el "monto pendiente real" incluye el monto del pago que estamos a punto de modificar
    let previousPaymentUSD = 0;
    let activeModalBcvRate = currentBcvRate;
    if (paymentData) {
        const isBs = paymentData.currency === 'BS' || paymentData.currency === 'Bs';
        activeModalBcvRate = paymentData.bcvRate || currentBcvRate;
        previousPaymentUSD = isBs ? paymentData.amount / activeModalBcvRate : paymentData.amount;
    }
    
    const trueRemainingUSD = (sale.remainingUSD || 0) + previousPaymentUSD;
    const remainingUSD = trueRemainingUSD;
    const remainingBs = remainingUSD * activeModalBcvRate;
    const todayStr = paymentData ? paymentData.date : new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    
    const businessId = localStorage.getItem('businessId');
    
    // Aplicar la misma lógica que el panel lateral (Dashboard)
    const userEmail = localStorage.getItem('userEmail');
    const cachedName = userEmail ? localStorage.getItem(`userName_${userEmail}`) : null;
    
    // Buscar en cascada: 1. Nombre en cache con email, 2. employeeName, 3. userName, 4. Por defecto
    const loggedInUser = cachedName || localStorage.getItem('employeeName') || localStorage.getItem('userName') || 'Usuario';
    const currentStore = localStorage.getItem('storeName') || 'Sede Principal';
    const storeId = localStorage.getItem('storeId') || 'general';

    const modal = document.createElement('div');
    modal.style = "position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;";
    
    modal.innerHTML = `
        <div style="background: #1a202c; border-radius: 12px; width: 100%; max-width: 380px; padding: 1.5rem; position: relative; border: 1px solid rgba(255,255,255,0.1);">
            <button id="closePayModalBtn" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #a0aec0;">×</button>
            
            <!-- Encabezado con alineación baseline para uniformidad -->
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.75rem;">
                <div>
                    <h3 style="color: #ffffff; margin: 0; font-size: 1.3rem;">${paymentData ? 'Editar Pago' : 'Cargar Pago'}</h3>
                    <div style="color: #63b3ed; font-family: monospace; font-weight: bold; font-size: 1rem; margin-top: 0.1rem;">#${sale.correlative || sale.id.slice(-6).toUpperCase()}</div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #a0aec0;">
                    <div>Atendido por: <strong>${loggedInUser}</strong></div>
                    <div>Tienda: <strong>${currentStore}</strong></div>
                </div>
            </div>
            
            <!-- Monto Pendiente más compacto -->
            <div style="margin-bottom: 0.75rem; background: rgba(255,255,255,0.02); padding: 6px 10px; border-radius: 6px;">
                <label style="color: #a0aec0; font-size: 0.75rem; display: block; margin-bottom: 0.1rem;">Monto Pendiente</label>
                <div style="color: #ffffff; font-size: 1.1rem; font-weight: bold;">$ ${fmt(remainingUSD)} <span style="font-size: 0.85rem; color: #a0aec0;">/ Bs. ${fmt(remainingBs)}</span></div>
            </div>

            <div class="form-group">
                <label for="payDate">Fecha de Pago</label>
                <input type="date" id="payDate" class="form-control">
            </div>

            <div class="form-group">
                <label for="payMethod">Método de Pago</label>
                <select id="payMethod" class="form-control">
                    <option value="BS_EFECTIVO">Bs. Efectivo</option>
                    <option value="BS_PAGO_MOVIL">Pago Móvil</option>
                    <option value="BS_PUNTO">Punto de Venta</option>
                    <option value="BS_BIO_PAGO">BioPago</option>
                    <option value="BS_TRANSFERENCIA">Transferencia</option>
                    <option value="USD_EFECTIVO">Dólares en Efectivo</option>
                    <option value="USD_BINANCE">Binance</option>
                    <option value="USD_PAYPAL">Paypal</option>
                    <option value="USD_ZELLE">Zelle</option>
                </select>
            </div>

            <div id="amountsWrapper" style="display: flex; flex-direction: column;">
                <div id="payAmountContainerUSD" class="form-group">
                    <label for="payAmountUSD" id="labelAmountUSD">Monto a Pagar ($)</label>
                    <input type="text" id="payAmountUSD" class="form-control" style="background: rgba(255,255,255,0.05);">
                </div>

                <div id="payAmountContainerBS" class="form-group">
                    <label for="payAmountBS" id="labelAmountBS">Monto a Pagar (Bs)</label>
                    <input type="text" id="payAmountBS" class="form-control" style="background: rgba(255,255,255,0.05);">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.2rem !important;">
                <label for="payReference" id="payReferenceLabel">Referencia / Notas</label>
                <input type="text" id="payReference" class="form-control" placeholder="Opcional">
            </div>

            <button id="confirmPayBtn" class="btn btn-primary" style="width: 100%; padding: 10px; font-weight: bold; font-size: 14px;">${paymentData ? 'Guardar Cambios' : 'Confirmar Pago'}</button>
        </div>
    `;

    document.body.appendChild(modal);

    const payMethodSelect = modal.querySelector('#payMethod');
    const payAmountContainerUSD = modal.querySelector('#payAmountContainerUSD');
    const payAmountContainerBS = modal.querySelector('#payAmountContainerBS');
    const payAmountUSDInput = modal.querySelector('#payAmountUSD');
    const payAmountBSInput = modal.querySelector('#payAmountBS');
    const payDateInput = modal.querySelector('#payDate');

    // Inicializar valores
    payDateInput.value = todayStr;
    if (window.flatpickr) {
        flatpickr(payDateInput, {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            defaultDate: todayStr,
            onChange: async function(selectedDates, dateStr) {
                if (dateStr) {
                    try {
                        const safeDateStr = dateStr.replace(/\//g, '-');
                        const docSnap = await getDoc(doc(db, "global_bcv_history", safeDateStr));
                        if (docSnap.exists()) {
                            activeModalBcvRate = docSnap.data().rate;
                        } else {
                            activeModalBcvRate = currentBcvRate;
                        }
                        const isBsMethod = payMethodSelect.value.startsWith('BS_');
                        if (isBsMethod) {
                            const valBs = parseFloat(payAmountBSInput.value.replace(/\D/g, '')) / 100 || 0;
                            if (valBs > 0) payAmountUSDInput.value = (valBs / activeModalBcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        } else {
                            const valUSD = parseFloat(payAmountUSDInput.value.replace(/\D/g, '')) / 100 || 0;
                            if (valUSD > 0) payAmountBSInput.value = (valUSD * activeModalBcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                    } catch(e) { console.error("Error al buscar tasa BCV:", e); }
                }
            }
        });
    }
    
    if (paymentData) {
        // Modo edición: pre-llenar valores
        const isBs = paymentData.currency === 'BS' || paymentData.currency === 'Bs';
        payMethodSelect.value = isBs ? `BS_${paymentData.method}` : `USD_${paymentData.method}`;
        
        if (isBs) {
            const valBs = paymentData.amount;
            const valUSD = valBs / currentBcvRate;
            payAmountBSInput.value = valBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            payAmountUSDInput.value = valUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            const valUSD = paymentData.amount;
            const valBs = valUSD * currentBcvRate;
            payAmountUSDInput.value = valUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            payAmountBSInput.value = valBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        modal.querySelector('#payReference').value = paymentData.reference || '';
    } else {
        // Modo nuevo pago
        payAmountUSDInput.value = remainingUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        payAmountBSInput.value = remainingBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Función para formatear en tiempo real (ATM style)
    function formatCurrencyInput(input) {
        let value = input.value.replace(/\D/g, ''); // Remover todo lo que no sea dígito
        if (value === '') {
            input.value = '';
            return 0;
        }
        
        // Convertir a float (los últimos 2 dígitos son decimales)
        let floatValue = parseFloat(value) / 100;
        
        // Formatear con . para miles y , para decimales
        input.value = floatValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return floatValue;
    }

    payAmountUSDInput.addEventListener('input', (e) => {
        const valUSD = formatCurrencyInput(e.target);
        if (valUSD !== 0 || e.target.value !== '') {
            const valBS = valUSD * activeModalBcvRate;
            payAmountBSInput.value = valBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            payAmountBSInput.value = '';
        }
    });

    payAmountBSInput.addEventListener('input', (e) => {
        const valBS = formatCurrencyInput(e.target);
        if (valBS !== 0 || e.target.value !== '') {
            const valUSD = valBS / activeModalBcvRate;
            payAmountUSDInput.value = valUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            payAmountUSDInput.value = '';
        }
    });

    // Lógica dinámica para mostrar campos y referencia
    payMethodSelect.addEventListener('change', (e) => {
        const methodVal = e.target.value;
        const isBs = methodVal.startsWith('BS_');
        
        const containerUSD = modal.querySelector('#payAmountContainerUSD');
        const containerBS = modal.querySelector('#payAmountContainerBS');
        
        if (isBs) {
            modal.querySelector('#labelAmountBS').textContent = 'Monto a Pagar (Bs)';
            modal.querySelector('#labelAmountUSD').textContent = 'Equivalente en $';
            containerBS.style.order = "1";
            containerUSD.style.order = "2";
            payAmountBSInput.readOnly = false;
            payAmountUSDInput.readOnly = true;
            payAmountUSDInput.style.opacity = "0.7";
            payAmountBSInput.style.opacity = "1";
        } else {
            modal.querySelector('#labelAmountUSD').textContent = 'Monto a Pagar ($)';
            modal.querySelector('#labelAmountBS').textContent = 'Equivalente en Bs';
            containerUSD.style.order = "1";
            containerBS.style.order = "2";
            payAmountUSDInput.readOnly = false;
            payAmountBSInput.readOnly = true;
            payAmountBSInput.style.opacity = "0.7";
            payAmountUSDInput.style.opacity = "1";
        }
        
        const methodID = methodVal.replace('BS_', '').replace('USD_', '');
        // Métodos que exigen referencia obligatoria
        const refMethods = ['PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'PAYPAL', 'ZELLE'];
        const requiresRef = refMethods.includes(methodID);
        
        const payReferenceLabel = modal.querySelector('#payReferenceLabel');
        const payReferenceInput = modal.querySelector('#payReference');
        
        if (requiresRef) {
            payReferenceLabel.innerHTML = 'Referencia <span style="color: #ef4444;">*</span>';
            payReferenceInput.placeholder = "Obligatorio";
        } else {
            payReferenceLabel.textContent = "Referencia / Notas";
            payReferenceInput.placeholder = "Opcional";
        }
    });
    // Disparar evento para cargar el estado inicial
    payMethodSelect.dispatchEvent(new Event('change'));

    modal.querySelector('#closePayModalBtn').addEventListener('click', () => modal.remove());
    
    modal.querySelector('#confirmPayBtn').addEventListener('click', () => {
        showConfirmModal("Confirmar Pago", "¿Está seguro de registrar este pago?", async () => {
            const methodVal = payMethodSelect.value;
            const isBs = methodVal.startsWith('BS_');
            const methodID = methodVal.replace('BS_', '').replace('USD_', '');
        
        let amountValue;
        if (isBs) {
            const rawBS = payAmountBSInput.value.replace(/\./g, '').replace(',', '.');
            amountValue = parseFloat(rawBS);
        } else {
            const rawUSD = payAmountUSDInput.value.replace(/\./g, '').replace(',', '.');
            amountValue = parseFloat(rawUSD);
        }
        
        const reference = modal.querySelector('#payReference').value;
        const payDate = modal.querySelector('#payDate').value;

        if (isNaN(amountValue) || amountValue <= 0) {
            showCustomAlert("Error", "Por favor ingresa un monto válido.");
            return;
        }

        // Validación de referencia obligatoria
        const refMethods = ['PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'PAYPAL', 'ZELLE'];
        const requiresRef = refMethods.includes(methodID);
        
        if (requiresRef && !reference.trim()) {
            showCustomAlert("Validación", `Este método de pago requiere un número de referencia.`);
            return;
        }

        // Calcular el equivalente en dólares si el pago fue en Bs
        let amountUSD = amountValue;
        if (isBs) {
            amountUSD = amountValue / activeModalBcvRate;
        }

        // Validar que no pague más de lo que debe (con un pequeño margen por decimales)
        if (amountUSD > trueRemainingUSD + 0.01) {
            showCustomAlert("Validación", "El monto no puede ser mayor a la deuda pendiente.");
            return;
        }

        try {
            const payRef = collection(db, "businesses", businessId, "payments");
            const today = new Date();
            
            if (paymentData) {
                // 1. EDITAR pago existente
                const docRef = doc(db, "businesses", businessId, "payments", paymentData.id);
                await updateDoc(docRef, {
                    amount: amountValue,
                    currency: isBs ? 'BS' : 'USD',
                    method: methodID,
                    reference: reference,
                    date: payDate,
                    bcvRate: activeModalBcvRate,
                    // No sobreescribir createdAt, recordedBy, etc.
                });
            } else {
                // 1. CREAR nuevo pago
                await addDoc(payRef, {
                    saleId: sale.id,
                    clientId: sale.clientId,
                    amount: amountValue, 
                    currency: isBs ? 'BS' : 'USD',
                    method: methodID,
                    reference: reference,
                    date: payDate,
                    bcvRate: activeModalBcvRate,
                    timestamp: today,
                    createdAt: today,
                    recordedBy: loggedInUser,
                    employeeEmail: userEmail || '',
                    storeName: currentStore,
                    storeId: storeId,
                    correlative: sale.correlative || sale.id.slice(-6).toUpperCase()
                });
            }

            // 2. Actualizar la factura
            const saleRef = doc(db, "businesses", businessId, "sales", sale.id);
            const newRemainingUSD = Math.max(0, trueRemainingUSD - amountUSD);
            const isFullyUnpaid = Math.abs(newRemainingUSD - (sale.totalUSD || 0)) < 0.02;
            const newStatus = newRemainingUSD <= 0.01 ? 'facturado' : (isFullyUnpaid ? 'credito' : 'abono'); 

            await updateDoc(saleRef, {
                remainingUSD: newRemainingUSD,
                status: newStatus
            });

            showCustomAlert("Éxito", paymentData ? "🎉 Pago actualizado con éxito." : "🎉 Pago registrado con éxito.");
            modal.remove();
            
            // Refrescar los datos en memoria del cliente
            sale.remainingUSD = newRemainingUSD;
            sale.status = newStatus;
            
            onComplete(); // Llama al callback para refrescar la vista
        } catch (error) {
            console.error("Error al registrar el pago:", error);
            showCustomAlert("Error", `Error al registrar el pago: ${error.message}`);
        }
        }, "Sí, Confirmar", "Cancelar");
    });
}

// Función para mostrar alertas personalizadas estilo modal
export function showCustomAlert(title, message, onAccept) {
    const modal = document.createElement('div');
    modal.style = "position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1rem;";
    
    modal.innerHTML = `
        <div style="background: #1a202c; border-radius: 12px; width: 100%; max-width: 300px; padding: 1.5rem; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${title === 'Éxito' ? '🎉' : '⚠️'}</div>
            <h4 style="color: #ffffff; margin: 0 0 0.5rem 0;">${title}</h4>
            <p style="color: #a0aec0; margin-bottom: 1.5rem; font-size: 13px;">${message}</p>
            <button id="closeAlertBtn" class="btn btn-primary" style="width: 100%; padding: 8px; font-size: 14px; font-weight: bold;">Aceptar</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#closeAlertBtn').addEventListener('click', () => {
        modal.remove();
        if (onAccept) onAccept();
    });
}

function showMassPaymentModal(clientData, onComplete) {
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
    let activeModalBcvRate = currentBcvRate;
    const totalDebtUSD = clientData.totalDebt || 0;
    const totalDebtBs = totalDebtUSD * activeModalBcvRate;
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    
    const businessId = localStorage.getItem('businessId');
    const userEmail = localStorage.getItem('userEmail');
    const cachedName = userEmail ? localStorage.getItem(`userName_${userEmail}`) : null;
    const loggedInUser = cachedName || localStorage.getItem('employeeName') || localStorage.getItem('userName') || 'Usuario';
    const currentStore = localStorage.getItem('storeName') || 'Sede Principal';
    const storeId = localStorage.getItem('storeId') || 'general';

    const modal = document.createElement('div');
    modal.style = "position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;";
    
    modal.innerHTML = `
        <div style="background: #1a202c; border-radius: 12px; width: 100%; max-width: 380px; padding: 1.5rem; position: relative; border: 1px solid rgba(255,255,255,0.1);">
            <button id="closePayModalBtn" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #a0aec0;">×</button>
            
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.75rem;">
                <div>
                    <h3 style="color: #ffffff; margin: 0; font-size: 1.3rem;">Pago Global</h3>
                    <div style="color: #63b3ed; font-family: monospace; font-weight: bold; font-size: 1rem; margin-top: 0.1rem;">👤 ${clientData.clientName}</div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #a0aec0;">
                    <div>Atendido por: <strong>${loggedInUser}</strong></div>
                    <div>Tienda: <strong>${currentStore}</strong></div>
                </div>
            </div>
            
            <div style="margin-bottom: 0.75rem; background: rgba(255,255,255,0.02); padding: 6px 10px; border-radius: 6px;">
                <label style="color: #a0aec0; font-size: 0.75rem; display: block; margin-bottom: 0.1rem;">Total Deuda Pendiente</label>
                <div style="color: #ffffff; font-size: 1.1rem; font-weight: bold;">$ ${fmt(totalDebtUSD)} <span style="font-size: 0.85rem; color: #a0aec0;">/ Bs. ${fmt(totalDebtBs)}</span></div>
            </div>

            <div class="form-group">
                <label for="payDate">Fecha de Pago</label>
                <input type="date" id="payDate" class="form-control">
            </div>

            <div class="form-group">
                <label for="payMethod">Método de Pago</label>
                <select id="payMethod" class="form-control">
                    <option value="BS_EFECTIVO">Bs. Efectivo</option>
                    <option value="BS_PAGO_MOVIL">Pago Móvil</option>
                    <option value="BS_PUNTO">Punto de Venta</option>
                    <option value="BS_BIO_PAGO">BioPago</option>
                    <option value="BS_TRANSFERENCIA">Transferencia</option>
                    <option value="USD_EFECTIVO">Dólares en Efectivo</option>
                    <option value="USD_BINANCE">Binance</option>
                    <option value="USD_PAYPAL">Paypal</option>
                    <option value="USD_ZELLE">Zelle</option>
                </select>
            </div>

            <div id="amountsWrapper_mass" style="display: flex; flex-direction: column;">
                <div id="payAmountContainerUSD" class="form-group">
                    <label for="payAmountUSD" id="labelAmountUSD_mass">Monto a Pagar ($)</label>
                    <input type="text" id="payAmountUSD" class="form-control" style="background: rgba(255,255,255,0.05);">
                </div>

                <div id="payAmountContainerBS" class="form-group">
                    <label for="payAmountBS" id="labelAmountBS_mass">Monto a Pagar (Bs)</label>
                    <input type="text" id="payAmountBS" class="form-control" style="background: rgba(255,255,255,0.05);">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.2rem !important;">
                <label for="payReference" id="payReferenceLabel">Referencia / Notas</label>
                <input type="text" id="payReference" class="form-control" placeholder="Opcional">
            </div>

            <button id="confirmPayBtn" class="btn btn-primary" style="width: 100%; padding: 10px; font-weight: bold; font-size: 14px;">Confirmar Pago</button>
        </div>
    `;

    document.body.appendChild(modal);

    const payMethodSelect = modal.querySelector('#payMethod');
    const payAmountContainerUSD = modal.querySelector('#payAmountContainerUSD');
    const payAmountContainerBS = modal.querySelector('#payAmountContainerBS');
    const payAmountUSDInput = modal.querySelector('#payAmountUSD');
    const payAmountBSInput = modal.querySelector('#payAmountBS');
    const payDateInput = modal.querySelector('#payDate');

    payDateInput.value = todayStr;
    if (window.flatpickr) {
        flatpickr(payDateInput, {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            defaultDate: todayStr,
            onChange: async function(selectedDates, dateStr) {
                if (dateStr) {
                    try {
                        const safeDateStr = dateStr.replace(/\//g, '-');
                        const docSnap = await getDoc(doc(db, "global_bcv_history", safeDateStr));
                        if (docSnap.exists()) {
                            activeModalBcvRate = docSnap.data().rate;
                        } else {
                            activeModalBcvRate = currentBcvRate;
                        }
                        const isBsMethod = payMethodSelect.value.startsWith('BS_');
                        if (isBsMethod) {
                            const valBs = parseFloat(payAmountBSInput.value.replace(/\D/g, '')) / 100 || 0;
                            if (valBs > 0) payAmountUSDInput.value = (valBs / activeModalBcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        } else {
                            const valUSD = parseFloat(payAmountUSDInput.value.replace(/\D/g, '')) / 100 || 0;
                            if (valUSD > 0) payAmountBSInput.value = (valUSD * activeModalBcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                    } catch(e) { console.error("Error al buscar tasa BCV:", e); }
                }
            }
        });
    }

    payAmountUSDInput.value = totalDebtUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    payAmountBSInput.value = totalDebtBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function formatCurrencyInput(input) {
        let value = input.value.replace(/\D/g, '');
        if (value === '') { input.value = ''; return 0; }
        let floatValue = parseFloat(value) / 100;
        input.value = floatValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return floatValue;
    }

    payAmountUSDInput.addEventListener('input', (e) => {
        const valUSD = formatCurrencyInput(e.target);
        if (valUSD !== 0 || e.target.value !== '') {
            const valBS = valUSD * activeModalBcvRate;
            payAmountBSInput.value = valBS.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            payAmountBSInput.value = '';
        }
    });

    payAmountBSInput.addEventListener('input', (e) => {
        const valBS = formatCurrencyInput(e.target);
        if (valBS !== 0 || e.target.value !== '') {
            const valUSD = valBS / activeModalBcvRate;
            payAmountUSDInput.value = valUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            payAmountUSDInput.value = '';
        }
    });

    payMethodSelect.addEventListener('change', (e) => {
        const methodVal = e.target.value;
        const isBs = methodVal.startsWith('BS_');
        
        const containerUSD = modal.querySelector('#payAmountContainerUSD');
        const containerBS = modal.querySelector('#payAmountContainerBS');
        
        if (isBs) {
            modal.querySelector('#labelAmountBS_mass').textContent = 'Monto a Pagar (Bs)';
            modal.querySelector('#labelAmountUSD_mass').textContent = 'Equivalente en $';
            containerBS.style.order = "1";
            containerUSD.style.order = "2";
            payAmountBSInput.readOnly = false;
            payAmountUSDInput.readOnly = true;
            payAmountUSDInput.style.opacity = "0.7";
            payAmountBSInput.style.opacity = "1";
        } else {
            modal.querySelector('#labelAmountUSD_mass').textContent = 'Monto a Pagar ($)';
            modal.querySelector('#labelAmountBS_mass').textContent = 'Equivalente en Bs';
            containerUSD.style.order = "1";
            containerBS.style.order = "2";
            payAmountUSDInput.readOnly = false;
            payAmountBSInput.readOnly = true;
            payAmountBSInput.style.opacity = "0.7";
            payAmountUSDInput.style.opacity = "1";
        }
        
        const methodID = methodVal.replace('BS_', '').replace('USD_', '');
        const refMethods = ['PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'PAYPAL', 'ZELLE'];
        const requiresRef = refMethods.includes(methodID);
        
        const payReferenceLabel = modal.querySelector('#payReferenceLabel');
        const payReferenceInput = modal.querySelector('#payReference');
        
        if (requiresRef) {
            payReferenceLabel.innerHTML = 'Referencia <span style="color: #ef4444;">*</span>';
            payReferenceInput.placeholder = "Obligatorio";
        } else {
            payReferenceLabel.textContent = "Referencia / Notas";
            payReferenceInput.placeholder = "Opcional";
        }
    });
    payMethodSelect.dispatchEvent(new Event('change'));

    modal.querySelector('#closePayModalBtn').addEventListener('click', () => modal.remove());
    
    modal.querySelector('#confirmPayBtn').addEventListener('click', () => {
        showConfirmModal("Confirmar Pago Global", "¿Está seguro de registrar este pago global? Esta acción afectará a múltiples facturas.", async () => {
            const methodVal = payMethodSelect.value;
            const isBs = methodVal.startsWith('BS_');
            const methodID = methodVal.replace('BS_', '').replace('USD_', '');
        
        let amountValue;
        if (isBs) {
            const rawBS = payAmountBSInput.value.replace(/\./g, '').replace(',', '.');
            amountValue = parseFloat(rawBS);
        } else {
            const rawUSD = payAmountUSDInput.value.replace(/\./g, '').replace(',', '.');
            amountValue = parseFloat(rawUSD);
        }
        
        const reference = modal.querySelector('#payReference').value;
        const payDate = modal.querySelector('#payDate').value;

        if (isNaN(amountValue) || amountValue <= 0) {
            showCustomAlert("Error", "Por favor ingresa un monto válido.");
            return;
        }

        const refMethods = ['PAGO_MOVIL', 'TRANSFERENCIA', 'BINANCE', 'PAYPAL', 'ZELLE'];
        const requiresRef = refMethods.includes(methodID);
        
        if (requiresRef && !reference.trim()) {
            showCustomAlert("Validación", `Este método de pago requiere un número de referencia.`);
            return;
        }

        let amountUSD = amountValue;
        if (isBs) { amountUSD = amountValue / activeModalBcvRate; }

        if (amountUSD > totalDebtUSD + 0.01) {
            showCustomAlert("Validación", "El monto no puede ser mayor a la deuda total.");
            return;
        }

        try {
            // Lógica en Cascada
            let remainingPayUSD = amountUSD;
            const sortedSales = [...clientData.sales]
                .filter(s => s.remainingUSD > 0)
                .sort((a, b) => new Date(a.date) - new Date(b.date)); // FIFO: Más viejas primero

            const payRef = collection(db, "businesses", businessId, "payments");
            const today = new Date();

            for (const sale of sortedSales) {
                if (remainingPayUSD <= 0) break;

                const amountToApplyUSD = Math.min(remainingPayUSD, sale.remainingUSD);
                const amountToApplyBs = amountToApplyUSD * activeModalBcvRate;

                // 1. Guardar el pago para esta factura
                await addDoc(payRef, {
                    saleId: sale.id,
                    clientId: sale.clientId,
                    amount: isBs ? amountToApplyBs : amountToApplyUSD, // Monto aplicado en la moneda del pago
                    currency: isBs ? 'BS' : 'USD',
                    method: methodID,
                    reference: reference,
                    date: payDate,
                    bcvRate: activeModalBcvRate,
                    timestamp: today,
                    createdAt: today,
                    recordedBy: loggedInUser,
                    employeeEmail: userEmail || '',
                    storeName: currentStore,
                    storeId: storeId,
                    correlative: sale.correlative || sale.id.slice(-6).toUpperCase(),
                    isMassPayment: true,
                    totalMassPaymentAmount: amountValue // Monto total del pago masivo
                });

                // 2. Actualizar la factura
                const saleRef = doc(db, "businesses", businessId, "sales", sale.id);
                const newRemainingUSD = Math.max(0, sale.remainingUSD - amountToApplyUSD);
                const newStatus = newRemainingUSD <= 0.01 ? 'facturado' : 'abono';

                await updateDoc(saleRef, {
                    remainingUSD: newRemainingUSD,
                    status: newStatus
                });

                // Actualizar en memoria
                sale.remainingUSD = newRemainingUSD;
                sale.status = newStatus;

                remainingPayUSD -= amountToApplyUSD;
            }

            showCustomAlert("Éxito", "🎉 Pago global registrado con éxito.");
            modal.remove();
            onComplete();
        } catch (error) {
            console.error("Error al registrar el pago global:", error);
            showCustomAlert("Error", `Error al registrar el pago global: ${error.message}`);
        }
        }, "Sí, Confirmar", "Cancelar");
    });
}

export async function showSaleDetail(sale) {
    const businessId = localStorage.getItem('businessId');
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
    const docType = sale.settings?.type || (sale.status === 'presupuesto' ? 'presupuesto' : (sale.status === 'pedido' ? 'pedido' : 'venta'));
    const isBudget = docType === 'presupuesto';
    
    let salePayments = [];
    if (!isBudget) {
        const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id));
        const paySnap = await getDocs(q);
        salePayments = paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // Crear modal dinámicamente
    const modal = document.createElement('div');
    modal.style = "position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;";
    
    modal.innerHTML = `
        <style>
            .sale-modal-container { background: #1a202c; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 2rem; position: relative; border: 1px solid rgba(255,255,255,0.1); }
            .obsidian-text-xs { font-size: 10px; font-weight: 700; color: #8b919d; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
            .obsidian-pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; letter-spacing: 0.05em; }
            .obsidian-pill.credito { color: #f87171; background: rgba(248, 113, 113, 0.2); border: 1px solid rgba(248, 113, 113, 0.2); }
            .obsidian-pill.pagado { color: #4ae183; background: rgba(74, 225, 131, 0.2); border: 1px solid rgba(74, 225, 131, 0.2); }
            .obsidian-pill.presupuesto { color: #fbbf24; background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.2); }
            
            /* Mobile adaptations */
            @media (max-width: 767px) {
                .sale-modal-container { background: #10131c; padding: 1.5rem; max-width: 450px; border-color: #363943; border-radius: 4px; }
                .desktop-only-modal { display: none !important; }
            }
            @media (min-width: 768px) {
                .mobile-only-modal { display: none !important; }
            }
            
            /* Scrollbar for mobile payments table */
            .mobile-payments-table-container::-webkit-scrollbar { width: 4px; height: 4px; }
            .mobile-payments-table-container::-webkit-scrollbar-thumb { background: #363943; border-radius: 10px; }
        </style>
        <div class="sale-modal-container">
            <button id="closeModalBtn" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #a0aec0; transition: color 0.2s;">×</button>
            
            <div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div class="obsidian-text-xs">
                    ${isBudget ? 'Resumen de Presupuesto' : 'Resumen de Venta'}
                </div>
                <h2 style="margin: 0.25rem 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">
                    ${sale.correlative || sale.id.slice(-6).toUpperCase()}
                </h2>
                <div style="font-size: 14px; color: #a0aec0;">${formatDateToDDMMYYYY(sale.date)}</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                <div>
                    <div class="obsidian-text-xs">Cliente</div>
                    <p style="font-size: 16px; font-weight: bold; margin: 0; color: #ffffff;">${sale.clientName}</p>
                    <p style="font-size: 14px; color: #a0aec0; margin: 0;">${sale.clientId}</p>
                </div>
                <div style="text-align: right;">
                    <div class="obsidian-text-xs">Estado</div>
                    <span class="obsidian-pill ${sale.status === 'credito' ? 'credito' : (sale.status === 'presupuesto' ? 'presupuesto' : 'pagado')}">${sale.status.toUpperCase()}</span>
                </div>
            </div>

            <!-- ====== DESKTOP VIEWS (Tables) ====== -->
            <div class="desktop-only-modal">
                <table class="premium-table" style="margin-bottom: 1.5rem;">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="text-align: center;">Cant.</th>
                            <th style="text-align: right;">Precio</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sale.items ? sale.items.map(item => `
                            <tr>
                                <td style="color: #e2e8f0;">${item.name}</td>
                                <td style="text-align: center; color: #e2e8f0;">${item.qty}</td>
                                <td style="text-align: right; color: #e2e8f0;">$ ${fmt(item.price)}</td>
                                <td style="text-align: right; font-weight: bold; color: #ffffff;">$ ${fmt(item.price * item.qty)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align: center; color: #a0aec0;">No hay items</td></tr>'}
                    </tbody>
                </table>

                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; margin-top: 1rem; text-align: left;">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: #a0aec0; margin-bottom: 0.5rem;">Pagos Recibidos</h4>
                    ${salePayments.length > 0 ? `
                        <table class="premium-table" style="margin-bottom: 1rem; font-size: 11px;">
                            <thead>
                                <tr>
                                    <th style="padding: 4px 6px;">Fecha</th>
                                    <th style="padding: 4px 6px;">Método</th>
                                    <th style="text-align: right; padding: 4px 6px;">Monto Bs.</th>
                                    <th style="text-align: right; padding: 4px 6px;">Monto $</th>
                                    <th style="text-align: right; padding: 4px 6px;">Eqv. $</th>
                                    <th style="text-align: center; padding: 4px 6px; width: 50px;">Acc.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${salePayments.map(p => {
                                    const isBs = p.currency === 'BS' || p.currency === 'Bs';
                                    const amount = p.amount || 0;
                                    const rate = p.bcvRate || currentBcvRate;
                                    
                                    let montoBs = '-';
                                    let montoUSD = '-';
                                    let equivalenteUSD = '-';
                                    
                                    if (isBs) {
                                        montoBs = `Bs. ${fmt(amount)}`;
                                        equivalenteUSD = `$ ${fmt(amount / rate)}`;
                                    } else {
                                        montoUSD = `$ ${fmt(amount)}`;
                                    }

                                    return `
                                        <tr>
                                            <td style="color: #e2e8f0; padding: 4px 6px; white-space: nowrap;">${p.date ? formatDateToDDMMYYYY(p.date) : 'N/A'}</td>
                                            <td style="color: #e2e8f0; padding: 4px 6px; white-space: nowrap; text-transform: uppercase;">${p.method}</td>
                                            <td style="text-align: right; color: #e2e8f0; padding: 4px 6px; white-space: nowrap;">${montoBs}</td>
                                            <td style="text-align: right; color: #e2e8f0; padding: 4px 6px; white-space: nowrap;">${montoUSD}</td>
                                            <td style="text-align: right; font-weight: bold; color: #ffffff; padding: 4px 6px; white-space: nowrap;">${equivalenteUSD}</td>
                                            <td style="text-align: center; padding: 4px 6px; white-space: nowrap;">
                                                <span class="material-symbols-outlined edit-pay-btn" data-id="${p.id}" style="color: #63b3ed; cursor: pointer; font-size: 1rem; margin-right: 4px;" title="Editar Pago">edit</span>
                                                <span class="material-symbols-outlined delete-pay-btn" data-id="${p.id}" style="color: #f87171; cursor: pointer; font-size: 1rem; font-weight: bold;" title="Eliminar Pago">delete</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    ` : '<p style="color: #a0aec0; font-size: 0.85rem; margin-bottom: 1rem;">No hay pagos registrados para esta factura.</p>'}
                </div>
                
                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; text-align: right;">
                    <div style="font-size: 0.9rem; color: #a0aec0;">Subtotal: $ ${fmt(sale.subtotal || sale.totalUSD)}</div>
                    <div style="font-size: 1.2rem; font-weight: bold; color: #ffffff; margin-top: 0.5rem;">Total Factura: $ ${fmt(sale.totalUSD)}</div>
                    <div style="font-size: 1rem; font-weight: bold; color: #ef4444; margin-top: 0.25rem;">Resta por Pagar: $ ${fmt(sale.remainingUSD || 0)}</div>
                    <div style="font-size: 0.9rem; color: #a0aec0;">Total Bs (Al cambio de hoy): Bs. ${fmt((sale.remainingUSD || 0) * currentBcvRate)}</div>
                </div>
            </div>

            <!-- ====== MOBILE VIEWS (Ticket / Obsidian Metric) ====== -->
            <div class="mobile-only-modal">
                <!-- Mobile Products -->
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #363943; padding-bottom: 0.5rem; margin-bottom: 1rem;">
                    <h2 class="obsidian-text-xs" style="margin: 0;">Productos</h2>
                    <div style="display: flex; gap: 1rem;" class="obsidian-text-xs">
                        <span style="width: 3rem; text-align: center; margin: 0;">Cant.</span>
                        <span style="width: 4rem; text-align: right; margin: 0;">Total</span>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
                    ${sale.items ? sale.items.map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1; padding-right: 1rem;">
                                <p style="font-size: 14px; font-weight: 500; color: #ffffff; margin: 0;">${item.name}</p>
                                <p style="font-size: 12px; color: #8b919d; margin: 2px 0 0 0;">P.U: $ ${fmt(item.price)}</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <span style="width: 3rem; text-align: center; font-size: 14px; font-weight: 600; color: #c1c7d3;">${fmt(item.qty)}</span>
                                <span style="width: 4rem; text-align: right; font-size: 14px; font-weight: 700; color: #ffffff;">$ ${fmt(item.price * item.qty)}</span>
                            </div>
                        </div>
                    `).join('') : '<p style="color: #8b919d; text-align: center; font-size: 14px;">No hay items</p>'}
                </div>

                <!-- Mobile Payments -->
                <div style="margin-bottom: 2rem;">
                    <h2 class="obsidian-text-xs" style="margin-bottom: 0.75rem;">Pagos Recibidos</h2>
                    <div class="mobile-payments-table-container" style="overflow-x: auto;">
                        <table style="width: 100%; text-align: left; border-collapse: collapse; min-width: 400px;">
                            <thead style="border-bottom: 1px solid #363943;">
                                <tr class="obsidian-text-xs" style="font-size: 10px;">
                                    <th style="padding-bottom: 0.5rem; padding-right: 0.25rem; font-weight: 700;">Fecha</th>
                                    <th style="padding-bottom: 0.5rem; padding-right: 0.25rem; font-weight: 700;">Método</th>
                                    <th style="padding-bottom: 0.5rem; padding-right: 0.25rem; text-align: right; font-weight: 700;">Bs.</th>
                                    <th style="padding-bottom: 0.5rem; padding-right: 0.25rem; text-align: right; font-weight: 700;">$</th>
                                    <th style="padding-bottom: 0.5rem; text-align: right; font-weight: 700;">Eqv.$</th>
                                    <th style="padding-bottom: 0.5rem; text-align: center; font-weight: 700;">Acc.</th>
                                </tr>
                            </thead>
                            <tbody style="border-bottom: 1px solid rgba(54, 57, 67, 0.3);">
                                ${salePayments.length > 0 ? salePayments.map(p => {
                                    const isBs = p.currency === 'BS' || p.currency === 'Bs';
                                    const amount = p.amount || 0;
                                    const rate = p.bcvRate || currentBcvRate;
                                    
                                    let montoBs = '-';
                                    let montoUSD = '-';
                                    let equivalenteUSD = '-';
                                    
                                    if (isBs) {
                                        montoBs = `Bs. ${fmt(amount)}`;
                                        equivalenteUSD = `$ ${fmt(amount / rate)}`;
                                    } else {
                                        montoUSD = `$ ${fmt(amount)}`;
                                    }

                                    return `
                                        <tr style="font-size: 11px; color: #c1c7d3; border-bottom: 1px solid rgba(54, 57, 67, 0.3);">
                                            <td style="padding: 0.5rem 0.25rem 0.5rem 0; white-space: nowrap;">${p.date ? formatDateToDDMMYYYY(p.date) : 'N/A'}</td>
                                            <td style="padding: 0.5rem 0.25rem 0.5rem 0; text-transform: uppercase; white-space: nowrap; max-width: 60px; overflow: hidden; text-overflow: ellipsis;">${p.method.replace('PAGO_MOVIL', 'P.MOVIL')}</td>
                                            <td style="padding: 0.5rem 0.25rem 0.5rem 0; text-align: right; white-space: nowrap;">${montoBs}</td>
                                            <td style="padding: 0.5rem 0.25rem 0.5rem 0; text-align: right; white-space: nowrap;">${montoUSD}</td>
                                            <td style="padding: 0.5rem 0; text-align: right; font-weight: bold; color: #ffffff; white-space: nowrap;">${equivalenteUSD}</td>
                                            <td style="padding: 0.5rem 0; text-align: center; white-space: nowrap;">
                                                <span class="material-symbols-outlined edit-pay-btn" data-id="${p.id}" style="color: #63b3ed; cursor: pointer; font-size: 1rem; margin-right: 4px;">edit</span>
                                                <span class="material-symbols-outlined delete-pay-btn" data-id="${p.id}" style="color: #f87171; cursor: pointer; font-size: 1rem; font-weight: bold;">delete</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('') : '<tr><td colspan="6" style="padding: 1rem 0; text-align: center; font-size: 12px; color: #8b919d;">No hay pagos registrados para esta factura.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Mobile Footer -->
                <div style="background: #181b24; border-top: 1px solid #363943; padding: 1.5rem; margin: 0 -1.5rem -1.5rem -1.5rem; border-radius: 0 0 4px 4px; display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #8b919d;">
                        <span style="font-size: 14px;">Subtotal:</span>
                        <span style="font-size: 14px; font-weight: 500;">$ ${fmt(sale.subtotal || sale.totalUSD)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #ffffff;">
                        <span style="font-size: 18px; font-weight: 700;">Total Factura:</span>
                        <span style="font-size: 24px; font-weight: 900;">$ ${fmt(sale.totalUSD)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 14px; font-weight: 700; color: #f87171;">Resta por Pagar:</span>
                        <span style="font-size: 18px; font-weight: 700; color: #f87171;">$ ${fmt(sale.remainingUSD || 0)}</span>
                    </div>
                    <div style="padding-top: 0.5rem; text-align: right; border-top: 1px solid rgba(54, 57, 67, 0.5);">
                        <p style="font-size: 12px; color: #8b919d; margin: 0;">
                            Total Bs (Al cambio de hoy): 
                            <span style="color: #c1c7d3; font-weight: 600; display: block; margin-top: 2px;">Bs. ${fmt((sale.remainingUSD || 0) * currentBcvRate)}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#closeModalBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    // Attach event listeners for payment actions
    modal.querySelectorAll('.edit-pay-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const payId = btn.dataset.id;
            const paymentData = salePayments.find(p => p.id === payId);
            if (paymentData) {
                modal.remove(); // Close detail modal first
                showPaymentModal(sale, () => {
                    showSaleDetail(sale); // Re-open after edit
                }, paymentData);
            }
        });
    });

    modal.querySelectorAll('.delete-pay-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const payId = btn.dataset.id;
            const paymentData = salePayments.find(p => p.id === payId);
            if (paymentData) {
                showCustomAlert("Confirmación", "¿Estás seguro de que deseas eliminar este pago? El monto adeudado aumentará.", async () => {
                    try {
                        const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
                        const isBs = paymentData.currency === 'BS' || paymentData.currency === 'Bs';
                        const rate = paymentData.bcvRate || currentBcvRate;
                        const paymentUSD = isBs ? paymentData.amount / rate : paymentData.amount;

                        // 1. Delete payment doc
                        await deleteDoc(doc(db, "businesses", businessId, "payments", payId));

                        // 2. Update sale remaining USD
                        const saleRef = doc(db, "businesses", businessId, "sales", sale.id);
                        const qRemaining = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id));
                        const remainingSnap = await getDocs(qRemaining);
                        
                        let newRemainingUSD, newStatus;
                        if (remainingSnap.empty) {
                            newRemainingUSD = sale.totalUSD || 0;
                            newStatus = 'credito';
                        } else {
                            newRemainingUSD = Math.min((sale.remainingUSD || 0) + paymentUSD, sale.totalUSD || 0);
                            const isFullyUnpaid = Math.abs(newRemainingUSD - (sale.totalUSD || 0)) < 0.02;
                            newStatus = newRemainingUSD <= 0.01 ? 'facturado' : (isFullyUnpaid ? 'credito' : 'abono');
                        }

                        await updateDoc(saleRef, {
                            remainingUSD: newRemainingUSD,
                            status: newStatus
                        });

                        // 3. Update local state and refresh modal
                        sale.remainingUSD = newRemainingUSD;
                        sale.status = newStatus;
                        showCustomAlert("Éxito", "Pago eliminado exitosamente.");
                        modal.remove();
                        showSaleDetail(sale); // Re-open to refresh data
                    } catch (error) {
                        console.error("Error al eliminar pago:", error);
                        showCustomAlert("Error", "Ocurrió un error al eliminar el pago.");
                    }
                });
            }
        });
    });
}

function fmt(val) {
    return parseFloat(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
