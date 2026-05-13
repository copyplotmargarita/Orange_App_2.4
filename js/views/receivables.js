import { db } from '../services/firebase.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export async function renderReceivables(container) {
    if (!container) return;

    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');
    const storeId = role === 'admin' ? null : localStorage.getItem('storeId');
    
    // Obtener la tasa BCV del día desde el localStorage
    const currentBcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;

    container.innerHTML = `
        <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0;">📊 Cuentas por Cobrar</h2>
            <div style="position: relative; width: 300px;">
                <input type="text" id="searchClientInput" placeholder="🔍 Buscar cliente..." style="padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #ffffff; width: 100%; box-sizing: border-box; font-size: 14px;">
            </div>
        </div>
        
        <div id="receivables-metrics"></div>
        
        <div class="card">
            <div id="receivables-content">
                <p>Cargando datos...</p>
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
            <table class="premium-table" id="clientsTable">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th style="text-align: center;">Facturas</th>
                        <th style="text-align: right;">Deuda ($)</th>
                        <th style="text-align: right;">Deuda (Bs)</th>
                        <th style="text-align: center;">F. Más Antigua</th>
                        <th style="text-align: center;">Última Compra</th>
                    </tr>
                </thead>
                <tbody>
                    ${clientsArray.map(client => `
                        <tr class="clickable-row" data-client-id="${client.clientId}">
                            <td style="font-weight: 500; color: #ffffff;">${client.clientName}</td>
                            <td style="text-align: center; color: #ffffff;">${client.invoiceCount}</td>
                            <td style="text-align: right; font-weight: bold; color: #e53e3e;">$ ${fmt(client.totalDebt)}</td>
                            <td style="text-align: right; font-weight: bold; color: #e53e3e;">Bs. ${fmt(client.totalDebtBs)}</td>
                            <td style="text-align: center; color: #ffffff;">${client.oldestDate}</td>
                            <td style="text-align: center; color: #ffffff;">${client.newestDate}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

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

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <button class="btn btn-outline" id="backToClientsBtn" style="width: auto; padding: 4px 10px; font-size: 13px;">⬅️ Volver</button>
                <span style="font-size: 18px; font-weight: bold; color: #ffffff;">${clientData.clientName}</span>
            </div>
            <button class="btn btn-primary" id="massPayBtn" style="width: auto; padding: 6px 12px; font-size: 13px;">💰 Cargar Pago Masivo</button>
        </div>
        
        <table class="premium-table">
            <thead>
                <tr>
                    <th>Correlativo</th>
                    <th>Fecha</th>
                    <th style="text-align: right;">Monto ($)</th>
                    <th style="text-align: right;">Monto (Bs)</th>
                    <th style="text-align: center;">Estado</th>
                    <th style="text-align: center;">Acción</th>
                </tr>
            </thead>
            <tbody>
                ${clientData.sales.map(sale => `
                    <tr class="sale-row" data-sale-id="${sale.id}">
                        <td style="font-family: monospace; font-weight: bold; color: #63b3ed;">${sale.correlative || sale.id.slice(-6).toUpperCase()}</td>
                        <td style="color: #e2e8f0;">${sale.date}</td>
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

    container.querySelector('#backToClientsBtn').addEventListener('click', () => {
        backToMainCallback(); // Re-render main view (restores global metrics)
    });

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

    container.querySelector('#massPayBtn').addEventListener('click', () => {
        showCustomAlert("Información", "Cargar pago masivo para " + clientData.clientName);
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
                    <option value="Dolares en Efectivo">Dolares en Efectivo</option>
                    <option value="Bs. Efectivo">Bs. Efectivo</option>
                    <option value="Pago Movil">Pago Movil</option>
                    <option value="Punto de Venta">Punto de Venta</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Binance">Binance</option>
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
        const isBs = method === 'Bs. Efectivo' || method === 'Pago Movil' || method === 'Punto de Venta' || method === 'Transferencia';
        
        if (isBs) {
            payAmountLabel.textContent = "Monto a Pagar (Bs)";
            const valBs = remainingUSD * currentBcvRate;
            payAmountInput.value = valBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            payAmountLabel.textContent = "Monto a Pagar ($)";
            payAmountInput.value = remainingUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        
        // Lógica de referencia obligatoria
        const electronicMethods = ['Pago Movil', 'Transferencia', 'Binance', 'Paypal', 'Zelle'];
        const isElectronic = electronicMethods.includes(method);
        
        const payReferenceLabel = modal.querySelector('#payReferenceLabel');
        const payReferenceInput = modal.querySelector('#payReference');
        
        if (isElectronic) {
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

        const isBs = method === 'Bs. Efectivo' || method === 'Pago Movil' || method === 'Punto de Venta' || method === 'Transferencia';

        if (isNaN(amountValue) || amountValue <= 0) {
            showCustomAlert("Error", "Por favor ingresa un monto válido.");
            return;
        }

        // Validación de referencia obligatoria
        const electronicMethods = ['Pago Movil', 'Transferencia', 'Binance', 'Paypal', 'Zelle'];
        const isElectronic = electronicMethods.includes(method);
        
        if (isElectronic && !reference.trim()) {
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
function showCustomAlert(title, message) {
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
                <div style="font-size: 0.85rem; color: #a0aec0;">${sale.date}</div>
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
