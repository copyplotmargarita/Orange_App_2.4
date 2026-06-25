import { db } from '../services/firebase.js';
import { formatDateToDDMMYYYY } from '../utils.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export async function renderReceivables(container) {
    if (!container) return;

    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');
    const storeId = role === 'admin' ? null : localStorage.getItem('storeId');
    
    // Obtener la tasa BCV del día desde el localStorage
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;

    container.innerHTML = `
        <div id="receivablesTopSticky" style="position: sticky; top: -0.75rem; background: var(--background); z-index: 50; margin-top: -0.75rem; padding-top: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">📋 Cuentas por Cobrar</h2>
                
                <div style="position: relative; width: 300px; margin-left: auto;" class="flex-stack-mobile">
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
            .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 4px; }
            .badge { padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .badge-warning { background: #fef3c7; color: #d97706; }
            .badge-danger { background: #fee2e2; color: #ef4444; }
            
            .metrics-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 20px; }
            .metric-box { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); text-align: center; }
            .metric-box .title { font-size: 10px; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
            .metric-box .value { font-size: 18px; font-weight: bold; color: #ffffff; }
            
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
            metricsDiv.innerHTML = `
                <div class="metrics-grid">
                    <div class="metric-box">
                        <div class="title">Clientes con Deuda</div>
                        <div class="value">${debtorsSet.size}</div>
                    </div>
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

        // Renderizar Tabla de Clientes
        contentDiv.innerHTML = `
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
                        <tr class="clickable-row" data-client-id="${client.clientId}">
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
                const clientName = row.querySelector('td').textContent.toLowerCase();
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
                renderClientReceivables(clientsMap[clientId], contentDiv, () => {
                    renderGlobalMetrics();
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
    // Obtener la tasa BCV del día desde el localStorage
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;

    // Actualizar métricas para el cliente seleccionado
    const metricsDiv = document.querySelector('#receivables-metrics');
    if (metricsDiv) {
        metricsDiv.innerHTML = `
            <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
                <div class="metric-box">
                    <div class="title">Facturas Pendientes</div>
                    <div class="value">${clientData.invoiceCount}</div>
                </div>
                <div class="metric-box">
                    <div class="title">Total Pendiente ($)</div>
                    <div class="value" style="color: #ef4444;">$ ${fmt(clientData.totalDebt)}</div>
                </div>
                <div class="metric-box">
                    <div class="title">Total Pendiente (Bs)</div>
                    <div class="value" style="color: #ef4444;">Bs. ${fmt(clientData.totalDebt * currentBcvRate)}</div>
                </div>
            </div>
        `;
    }

    // Actualizar el encabezado principal
    const topHeader = document.querySelector('#mainContentArea > div:first-child');
    if (topHeader) {
        const title = topHeader.querySelector('h2');
        if (title) title.innerHTML = `👤 ${clientData.clientName}`;
        
        const actionArea = topHeader.querySelector('div:last-child');
        if (actionArea) {
            actionArea.style.display = 'flex';
            actionArea.style.justifyContent = 'flex-end';
            actionArea.innerHTML = `<button class="btn btn-primary" id="massPayBtn" style="width: 180px; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">💰 Pago Masivo</button>`;
        }
        
        const backBtn = topHeader.querySelector('#backToDashboardBtn');
        if (backBtn) {
            // Clonar el botón para eliminar todos los listeners anteriores (que abrían la barra lateral)
            const newBackBtn = backBtn.cloneNode(true);
            backBtn.parentNode.replaceChild(newBackBtn, backBtn);
            newBackBtn.onclick = () => {
                backToMainCallback();
            };
        }
    }

    container.innerHTML = `
        <table class="premium-table" style="margin-bottom:0;">
            <thead>
                <tr>
                    <th class="sticky-th" style="position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-left-radius: 12px;">Correlativo</th>
                    <th class="sticky-th" style="position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Fecha</th>
                    <th class="sticky-th" style="text-align: right; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Monto ($)</th>
                    <th class="sticky-th" style="text-align: right; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Monto (Bs)</th>
                    <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">Estado</th>
                    <th class="sticky-th" style="text-align: center; position: sticky; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border); border-top-right-radius: 12px;">Acción</th>
                </tr>
            </thead>
            <tbody>
                ${clientData.sales.map(sale => `
                    <tr class="sale-row" data-sale-id="${sale.id}">
                        <td style="font-family: monospace; font-weight: bold; color: #63b3ed;">${sale.correlative || sale.id.slice(-6).toUpperCase()}</td>
                        <td style="color: #e2e8f0;">${formatDateToDDMMYYYY(sale.date)}</td>
                        <td style="text-align: right; font-weight: bold; color: #e2e8f0;">$ ${fmt(sale.remainingUSD || 0)}</td>
                        <td style="text-align: right; color: #a0aec0;">Bs. ${fmt(sale.remainingUSD * currentBcvRate)}</td>
                        <td style="text-align: center;">
                            <span style="color: ${sale.status === 'credito' ? '#ef4444' : '#f59e0b'}; font-weight: bold; text-transform: uppercase; font-size: 0.85rem;">${sale.status}</span>
                        </td>
                        <td style="text-align: center;">
                            <button class="btn btn-primary pay-btn" data-sale-id="${sale.id}" style="width: auto; padding: 4px 12px; font-size: 12px;">Cargar Pago</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;



    // Update sticky headers for detail view
    setTimeout(() => {
        const topSticky = document.querySelector('#receivablesTopSticky');
        if (topSticky) {
            const h = topSticky.offsetHeight - 12;
            container.querySelectorAll('.sticky-th').forEach(th => th.style.top = h + 'px');
        }
    }, 50);

    // Add listeners for sale rows (click to view detail)
    container.querySelectorAll('.sale-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.classList.contains('pay-btn')) return; // Ignore if button clicked
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

    document.getElementById('massPayBtn')?.addEventListener('click', () => {
        showCustomAlert("Información", "Cargar pago masivo para " + clientData.clientName, () => {
            showMassPaymentModal(clientData, () => {
                // Callback para refrescar la vista después de pagar
                renderClientReceivables(clientData, container, backToMainCallback);
            });
        });
    });
}

function showPaymentModal(sale, onComplete) {
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
    const remainingUSD = sale.remainingUSD || 0;
    const remainingBs = remainingUSD * currentBcvRate;
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    
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
                    <h3 style="color: #ffffff; margin: 0; font-size: 1.3rem;">Cargar Pago</h3>
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
                    <option value="Bs. Efectivo">Bs. Efectivo</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Punto de Venta">Punto de Venta</option>
                    <option value="BioPago">BioPago</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Binance">Binance</option>
                    <option value="Dólares en Efectivo">Dólares en Efectivo</option>
                    <option value="Paypal">Paypal</option>
                    <option value="Zelle">Zelle</option>
                </select>
            </div>

            <div class="form-group">
                <label for="payAmount" id="payAmountLabel">Monto a Pagar ($)</label>
                <input type="text" id="payAmount" class="form-control">
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
    const payAmountLabel = modal.querySelector('#payAmountLabel');
    const payAmountInput = modal.querySelector('#payAmount');
    const payDateInput = modal.querySelector('#payDate');

    // Inicializar valores
    payDateInput.value = todayStr;
    payAmountInput.value = remainingUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Función para formatear en tiempo real (ATM style)
    function formatCurrencyInput(input) {
        let value = input.value.replace(/\D/g, ''); // Remover todo lo que no sea dígito
        if (value === '') {
            input.value = '';
            return;
        }
        
        // Convertir a float (los últimos 2 dígitos son decimales)
        let floatValue = parseFloat(value) / 100;
        
        // Formatear con . para miles y , para decimales
        input.value = floatValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    payAmountInput.addEventListener('input', (e) => {
        formatCurrencyInput(e.target);
    });

    // Lógica dinámica para cambiar de $ a Bs según el método de pago
    payMethodSelect.addEventListener('change', (e) => {
        const method = e.target.value;
        
        // Definir qué métodos son en Bolívares según CONTEXT.md
        const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Punto de Venta', 'BioPago', 'Transferencia'];
        const isBs = bsMethods.includes(method);
        
        if (isBs) {
            payAmountLabel.textContent = "Monto a Pagar (Bs)";
            const valBs = remainingUSD * currentBcvRate;
            payAmountInput.value = valBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            payAmountLabel.textContent = "Monto a Pagar ($)";
            payAmountInput.value = remainingUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        // Lógica de referencia obligatoria según CONTEXT.md
        const refMethods = ['Pago Móvil', 'Transferencia', 'Binance', 'Paypal', 'Zelle'];
        const requiresRef = refMethods.includes(method);
        
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

    modal.querySelector('#closePayModalBtn').addEventListener('click', () => modal.remove());
    
    modal.querySelector('#confirmPayBtn').addEventListener('click', async () => {
        // Convertir el valor formateado de vuelta a un número flotante estándar
        const rawValue = payAmountInput.value.replace(/\./g, '').replace(',', '.');
        const amountValue = parseFloat(rawValue);
        const method = payMethodSelect.value;
        const reference = modal.querySelector('#payReference').value;
        const payDate = modal.querySelector('#payDate').value;

        const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Punto de Venta', 'BioPago', 'Transferencia'];
        const isBs = bsMethods.includes(method);
        
        if (isNaN(amountValue) || amountValue <= 0) {
            showCustomAlert("Error", "Por favor ingresa un monto válido.");
            return;
        }

        // Validación de referencia obligatoria según CONTEXT.md
        const refMethods = ['Pago Móvil', 'Transferencia', 'Binance', 'Paypal', 'Zelle'];
        const requiresRef = refMethods.includes(method);
        
        if (requiresRef && !reference.trim()) {
            showCustomAlert("Validación", `El método ${method} requiere un número de referencia.`);
            return;
        }

        // Calcular el equivalente en dólares si el pago fue en Bs
        let amountUSD = amountValue;
        if (isBs) {
            amountUSD = amountValue / currentBcvRate;
        }

        // Validar que no pague más de lo que debe (con un pequeño margen por decimales)
        if (amountUSD > remainingUSD + 0.01) {
            showCustomAlert("Validación", "El monto no puede ser mayor a la deuda pendiente.");
            return;
        }

        try {
            // 1. Guardar el pago en la colección 'payments'
            const payRef = collection(db, "businesses", businessId, "payments");
            const today = new Date();
            await addDoc(payRef, {
                saleId: sale.id,
                clientId: sale.clientId,
                amount: amountValue, // Guardamos el monto numérico real
                currency: isBs ? 'BS' : 'USD', // DASHBOARD usa 'BS' en mayúsculas
                method: method,
                reference: reference,
                date: payDate, // Usamos la fecha seleccionada
                bcvRate: currentBcvRate, // Guardamos la tasa usada para este pago
                timestamp: today,
                createdAt: today, // DASHBOARD busca por 'createdAt'
                recordedBy: loggedInUser,
                employeeEmail: userEmail || '', // DASHBOARD filtra por email de empleado
                storeName: currentStore,
                storeId: storeId, // DASHBOARD filtra por storeId
                correlative: sale.correlative || sale.id.slice(-6).toUpperCase()
            });

            // 2. Actualizar la factura
            const saleRef = doc(db, "businesses", businessId, "sales", sale.id);
            const newRemainingUSD = Math.max(0, remainingUSD - amountUSD);
            const newStatus = newRemainingUSD <= 0.01 ? 'facturado' : 'abono'; 

            await updateDoc(saleRef, {
                remainingUSD: newRemainingUSD,
                status: newStatus
            });

            showCustomAlert("Éxito", "🎉 Pago registrado con éxito.");
            modal.remove();
            
            // Refrescar los datos en memoria del cliente
            sale.remainingUSD = newRemainingUSD;
            sale.status = newStatus;
            
            onComplete(); // Llama al callback para refrescar la vista
        } catch (error) {
            console.error("Error al registrar el pago:", error);
            showCustomAlert("Error", `Error al registrar el pago: ${error.message}`);
        }
    });
}

// Función para mostrar alertas personalizadas estilo modal
function showCustomAlert(title, message, onAccept) {
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
    const totalDebtUSD = clientData.totalDebt || 0;
    const totalDebtBs = totalDebtUSD * currentBcvRate;
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
                    <h3 style="color: #ffffff; margin: 0; font-size: 1.3rem;">Pago Masivo</h3>
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
                    <option value="Bs. Efectivo">Bs. Efectivo</option>
                    <option value="Pago Móvil">Pago Móvil</option>
                    <option value="Punto de Venta">Punto de Venta</option>
                    <option value="BioPago">BioPago</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Binance">Binance</option>
                    <option value="Dólares en Efectivo">Dólares en Efectivo</option>
                    <option value="Paypal">Paypal</option>
                    <option value="Zelle">Zelle</option>
                </select>
            </div>

            <div class="form-group">
                <label for="payAmount" id="payAmountLabel">Monto a Pagar ($)</label>
                <input type="text" id="payAmount" class="form-control">
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
    const payAmountLabel = modal.querySelector('#payAmountLabel');
    const payAmountInput = modal.querySelector('#payAmount');
    const payDateInput = modal.querySelector('#payDate');

    payDateInput.value = todayStr;
    payAmountInput.value = totalDebtUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function formatCurrencyInput(input) {
        let value = input.value.replace(/\D/g, '');
        if (value === '') { input.value = ''; return; }
        let floatValue = parseFloat(value) / 100;
        input.value = floatValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    payAmountInput.addEventListener('input', (e) => { formatCurrencyInput(e.target); });

    payMethodSelect.addEventListener('change', (e) => {
        const method = e.target.value;
        const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Punto de Venta', 'BioPago', 'Transferencia'];
        const isBs = bsMethods.includes(method);
        
        if (isBs) {
            payAmountLabel.textContent = "Monto a Pagar (Bs)";
            const valBs = totalDebtUSD * currentBcvRate;
            payAmountInput.value = valBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            payAmountLabel.textContent = "Monto a Pagar ($)";
            payAmountInput.value = totalDebtUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        const refMethods = ['Pago Móvil', 'Transferencia', 'Binance', 'Paypal', 'Zelle'];
        const requiresRef = refMethods.includes(method);
        
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

    modal.querySelector('#closePayModalBtn').addEventListener('click', () => modal.remove());
    
    modal.querySelector('#confirmPayBtn').addEventListener('click', async () => {
        const rawValue = payAmountInput.value.replace(/\./g, '').replace(',', '.');
        const amountValue = parseFloat(rawValue);
        const method = payMethodSelect.value;
        const reference = modal.querySelector('#payReference').value;
        const payDate = modal.querySelector('#payDate').value;

        const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Punto de Venta', 'BioPago', 'Transferencia'];
        const isBs = bsMethods.includes(method);

        if (isNaN(amountValue) || amountValue <= 0) {
            showCustomAlert("Error", "Por favor ingresa un monto válido.");
            return;
        }

        const refMethods = ['Pago Móvil', 'Transferencia', 'Binance', 'Paypal', 'Zelle'];
        const requiresRef = refMethods.includes(method);
        
        if (requiresRef && !reference.trim()) {
            showCustomAlert("Validación", `El método ${method} requiere un número de referencia.`);
            return;
        }

        let amountUSD = amountValue;
        if (isBs) { amountUSD = amountValue / currentBcvRate; }

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
                const amountToApplyBs = amountToApplyUSD * currentBcvRate;

                // 1. Guardar el pago para esta factura
                await addDoc(payRef, {
                    saleId: sale.id,
                    clientId: sale.clientId,
                    amount: isBs ? amountToApplyBs : amountToApplyUSD, // Monto aplicado en la moneda del pago
                    currency: isBs ? 'BS' : 'USD',
                    method: method,
                    reference: reference,
                    date: payDate,
                    bcvRate: currentBcvRate,
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

            showCustomAlert("Éxito", "🎉 Pago masivo registrado con éxito.");
            modal.remove();
            onComplete();
        } catch (error) {
            console.error("Error al registrar el pago masivo:", error);
            showCustomAlert("Error", `Error al registrar el pago masivo: ${error.message}`);
        }
    });
}

async function showSaleDetail(sale) {
    const businessId = localStorage.getItem('businessId');
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
    const isBudget = sale.status === 'presupuesto' || sale.status === 'facturado';
    
    let salePayments = [];
    if (!isBudget) {
        const q = query(collection(db, "businesses", businessId, "payments"), where("saleId", "==", sale.id));
        const paySnap = await getDocs(q);
        salePayments = paySnap.docs.map(doc => doc.data());
    }
    
    // Crear modal dinámicamente
    const modal = document.createElement('div');
    modal.style = "position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;";
    
    modal.innerHTML = `
        <div style="background: #1a202c; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 2rem; position: relative; border: 1px solid rgba(255,255,255,0.1);">
            <button id="closeModalBtn" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #a0aec0;">×</button>
            
            <div style="text-align: center; margin-bottom: 2rem;">
                <div style="font-size: 0.7rem; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.1em;">
                    ${isBudget ? 'Resumen de Presupuesto' : 'Resumen de Venta'}
                </div>
                <h2 style="margin: 0.5rem 0; color: #ffffff;">
                    ${sale.correlative || sale.id.slice(-6).toUpperCase()}
                </h2>
                <div style="font-size: 0.85rem; color: #a0aec0;">${formatDateToDDMMYYYY(sale.date)}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                <div>
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: #a0aec0; margin-bottom: 0.5rem;">Cliente</h4>
                    <p style="font-weight: bold; margin: 0; color: #e2e8f0;">${sale.clientName}</p>
                    <p style="font-size: 0.8rem; color: #a0aec0; margin: 0;">${sale.clientId}</p>
                </div>
                <div style="text-align: right;">
                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: #a0aec0; margin-bottom: 0.5rem;">Estado</h4>
                    <span class="badge ${sale.status === 'credito' ? 'badge-danger' : 'badge-warning'}">${sale.status}</span>
                </div>
            </div>

            <!-- Tabla de items -->
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

            <!-- Sección de Pagos Recibidos Modificada -->
            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; margin-top: 1rem; text-align: left;">
                <h4 style="font-size: 0.8rem; text-transform: uppercase; color: #a0aec0; margin-bottom: 0.5rem;">Pagos Recibidos</h4>
                ${salePayments.length > 0 ? `
                    <table class="premium-table" style="margin-bottom: 1rem; font-size: 12px;">
                        <thead>
                            <tr>
                                <th style="padding: 6px 8px;">Fecha</th>
                                <th style="padding: 6px 8px;">Método</th>
                                <th style="text-align: right; padding: 6px 8px;">Monto Bs.</th>
                                <th style="text-align: right; padding: 6px 8px;">Monto $</th>
                                <th style="text-align: right; padding: 6px 8px;">Equivalente $</th>
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
                                        <td style="color: #e2e8f0; padding: 6px 8px; white-space: nowrap;">${p.date || 'N/A'}</td>
                                        <td style="color: #e2e8f0; padding: 6px 8px; white-space: nowrap;">${p.method}</td>
                                        <td style="text-align: right; color: #e2e8f0; padding: 6px 8px; white-space: nowrap;">${montoBs}</td>
                                        <td style="text-align: right; color: #e2e8f0; padding: 6px 8px; white-space: nowrap;">${montoUSD}</td>
                                        <td style="text-align: right; font-weight: bold; color: #ffffff; padding: 6px 8px; white-space: nowrap;">${equivalenteUSD}</td>
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
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#closeModalBtn').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function fmt(val) {
    return parseFloat(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
