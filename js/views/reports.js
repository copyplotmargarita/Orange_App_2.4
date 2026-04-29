import { auth, db } from '../services/firebase.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderReports(container) {
    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');

    if (role !== 'admin') {
        container.innerHTML = '<div class="alert alert-danger">Acceso restringido solo para administradores.</div>';
        return;
    }

    let currentSubView = 'stores'; // stores, employees, reconciliation

    async function init() {
        render();
    }

    function render() {
        container.innerHTML = `
            <div class="reports-container" style="display: flex; flex-direction: column; gap: 1.5rem; height: 100%; overflow: hidden; padding-bottom: 2rem;">
                <div class="card" style="padding: 1rem; flex: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                        <h2 style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span>📊</span> Consultas / Reportes
                        </h2>
                        <div class="btn-group" style="display: flex; gap: 0.5rem; background: var(--background); padding: 0.25rem; border-radius: 8px; border: 1px solid var(--border);">
                            <button id="btnStoreReports" class="btn ${currentSubView === 'stores' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">🏪 Por Tienda</button>
                            <button id="btnEmployeeReports" class="btn ${currentSubView === 'employees' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">👤 Por Empleado</button>
                            <button id="btnReconciliation" class="btn ${currentSubView === 'reconciliation' ? 'btn-primary' : 'btn-ghost'}" style="font-size: 0.85rem; padding: 0.5rem 1rem;">🔄 Conciliación</button>
                        </div>
                    </div>
                </div>

                <div id="reportsContent" style="flex: 1; overflow-y: auto; min-height: 0;">
                    <!-- Subviews render here -->
                </div>
            </div>
        `;

        container.querySelector('#btnStoreReports').onclick = () => { currentSubView = 'stores'; render(); };
        container.querySelector('#btnEmployeeReports').onclick = () => { currentSubView = 'employees'; render(); };
        container.querySelector('#btnReconciliation').onclick = () => { currentSubView = 'reconciliation'; render(); };

        if (currentSubView === 'stores') renderStoreReports();
        else if (currentSubView === 'employees') renderEmployeeReports();
        else if (currentSubView === 'reconciliation') renderReconciliation();
    }

    async function renderStoreReports() {
        const content = container.querySelector('#reportsContent');
        content.innerHTML = `
            <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: flex-end;">
                    <div class="form-group">
                        <label>Seleccionar Tienda</label>
                        <select id="storeSelect" class="form-control"></select>
                    </div>
                    <div class="form-group">
                        <label>Desde</label>
                        <input type="date" id="dateFrom" class="form-control" value="${new Date().toLocaleDateString('sv-SE')}">
                    </div>
                    <div class="form-group">
                        <label>Hasta</label>
                        <input type="date" id="dateTo" class="form-control" value="${new Date().toLocaleDateString('sv-SE')}">
                    </div>
                    <button id="btnFilterStore" class="btn btn-primary" style="height: 42px;">🔍 Consultar</button>
                </div>
                <div id="storeResults" style="margin-top: 1rem;">
                    <div style="text-align: center; padding: 3rem; color: var(--text-muted);">Seleccione una tienda y rango de fechas para consultar.</div>
                </div>
            </div>
        `;

        // Load stores
        const storesSnap = await getDocs(collection(db, "businesses", businessId, "stores"));
        const storeSelect = content.querySelector('#storeSelect');
        storeSelect.innerHTML = '<option value="general">Almacén General</option>' + 
            storesSnap.docs.map(doc => `<option value="${doc.id}">${doc.data().name}</option>`).join('');

        content.querySelector('#btnFilterStore').onclick = async () => {
            const storeId = storeSelect.value;
            const from = content.querySelector('#dateFrom').value;
            const to = content.querySelector('#dateTo').value;
            const results = content.querySelector('#storeResults');

            results.innerHTML = '<div class="text-center p-4">⌛ Cargando datos...</div>';

            try {
                // Fetch by date range and filter storeId in memory to avoid index requirement
                const q = query(
                    collection(db, "businesses", businessId, "sales"),
                    where("date", ">=", from),
                    where("date", "<=", to)
                );
                const snap = await getDocs(q);
                let sales = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // In-memory store filter
                sales = sales.filter(s => s.storeId === storeId);
                
                sales.sort((a, b) => b.date.localeCompare(a.date));

                if (sales.length === 0) {
                    results.innerHTML = '<div class="alert alert-info text-center">No se encontraron ventas en este rango.</div>';
                    return;
                }

                results.innerHTML = `
                    <div class="table-responsive" style="margin-top: 1rem;">
                        <table class="table" style="font-size: 0.9rem; width: 100%; min-width: 800px; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--background);">
                                    <th style="width: 15%; padding: 1rem; text-align: center;">Fecha</th>
                                    <th style="width: 30%; padding: 1rem; text-align: center;">Cliente</th>
                                    <th style="width: 15%; padding: 1rem; text-align: center;">Total USD</th>
                                    <th style="width: 15%; padding: 1rem; text-align: center;">Estado</th>
                                    <th style="width: 25%; padding: 1rem; text-align: center;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sales.map(s => `
                                    <tr style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 1rem; text-align: center;">${s.date}</td>
                                        <td style="padding: 1rem; text-align: center;">${s.clientName}</td>
                                        <td style="padding: 1rem; text-align: center; font-weight: bold; color: var(--primary);">$ ${s.totalUSD.toFixed(2)}</td>
                                        <td style="padding: 1rem; text-align: center;">
                                            <span class="badge ${s.status === 'contado' ? 'badge-success' : 'badge-warning'}" style="padding: 0.4rem 0.6rem;">${s.status.toUpperCase()}</span>
                                        </td>
                                        <td style="padding: 1rem; text-align: center;">
                                            <button class="btn btn-ghost btn-sm btn-detail" data-id="${s.id}" style="width: 100%; max-width: 150px; font-weight: 600;">👁️ Ver Detalle</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

            } catch (err) {
                results.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
            }
        };
    }

    async function renderEmployeeReports() {
        const content = container.querySelector('#reportsContent');
        content.innerHTML = `
            <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: flex-end;">
                    <div class="form-group">
                        <label>Seleccionar Empleado</label>
                        <select id="employeeSelect" class="form-control"></select>
                    </div>
                    <div class="form-group">
                        <label>Desde</label>
                        <input type="date" id="dateFrom" class="form-control" value="${new Date().toLocaleDateString('sv-SE')}">
                    </div>
                    <div class="form-group">
                        <label>Hasta</label>
                        <input type="date" id="dateTo" class="form-control" value="${new Date().toLocaleDateString('sv-SE')}">
                    </div>
                    <button id="btnFilterEmployee" class="btn btn-primary" style="height: 42px;">🔍 Consultar</button>
                </div>
                <div id="employeeResults" style="margin-top: 1rem;"></div>
            </div>
        `;

        // Load employees
        const empSnap = await getDocs(collection(db, "businesses", businessId, "employees"));
        const employeeSelect = content.querySelector('#employeeSelect');
        employeeSelect.innerHTML = '<option value="">Seleccione...</option>' + 
            empSnap.docs.map(doc => `<option value="${doc.data().email}">${doc.data().name}</option>`).join('');

        content.querySelector('#btnFilterEmployee').onclick = async () => {
            const email = employeeSelect.value;
            if (!email) return;
            const from = content.querySelector('#dateFrom').value;
            const to = content.querySelector('#dateTo').value;
            const results = content.querySelector('#employeeResults');

            results.innerHTML = '<div class="text-center p-4">⌛ Calculando métricas...</div>';

            try {
                // Fetch by date range and filter employeeEmail in memory to avoid index requirement
                const qSales = query(
                    collection(db, "businesses", businessId, "sales"),
                    where("date", ">=", from),
                    where("date", "<=", to)
                );
                const sSnap = await getDocs(qSales);
                const sales = sSnap.docs.map(doc => doc.data()).filter(s => s.employeeEmail === email);

                // Fetch payments by date range and filter in memory
                const qPay = query(
                    collection(db, "businesses", businessId, "payments"),
                    where("date", ">=", from),
                    where("date", "<=", to)
                );
                const pSnap = await getDocs(qPay);
                
                const totals = {};
                pSnap.forEach(doc => {
                    const p = doc.data();
                    if (p.employeeEmail !== email) return;
                    
                    const key = `${p.currency}_${p.method}`;
                    if (!totals[key]) totals[key] = 0;
                    totals[key] += (p.amount || 0);
                });

                results.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;" class="grid-1-mobile">
                        <div>
                            <h4 style="margin-bottom: 1rem; color: var(--primary);">💰 Totales Recaudados</h4>
                            <div class="card" style="padding: 1rem; background: var(--background);">
                                <table style="width: 100%; border-collapse: collapse;">
                                    ${Object.entries(totals).length > 0 ? Object.entries(totals).map(([key, val]) => {
                                        const [cur, meth] = key.split('_');
                                        return `<tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.5rem 0;">${meth.replace('_', ' ')}</td>
                                            <td style="padding: 0.5rem 0; text-align: right; font-weight: bold; color: ${cur === 'USD' ? 'var(--success)' : 'inherit'}">${cur} ${val.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                        </tr>`;
                                    }).join('') : '<tr><td colspan="2" class="text-center py-4">Sin pagos registrados</td></tr>'}
                                </table>
                            </div>
                        </div>
                        <div>
                            <h4 style="margin-bottom: 1rem; color: var(--primary);">📈 Resumen de Actividad</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="card" style="padding: 1rem; text-align: center;">
                                    <p style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Ventas</p>
                                    <p style="font-size: 1.5rem; font-weight: bold;">${sales.length}</p>
                                </div>
                                <div class="card" style="padding: 1rem; text-align: center;">
                                    <p style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Monto Total</p>
                                    <p style="font-size: 1.25rem; font-weight: bold; color: var(--primary);">$ ${sales.reduce((acc, s) => acc + (s.totalUSD || 0), 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

            } catch (err) {
                results.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
            }
        };
    }

    async function renderReconciliation() {
        const content = container.querySelector('#reportsContent');
        content.innerHTML = `
            <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; background: var(--background); padding: 0.6rem 1rem; border-radius: 12px; border: 1px solid var(--border); width: fit-content;">
                    <label style="margin: 0; white-space: nowrap; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">Tienda:</label>
                    <select id="reconStoreSelect" class="form-control" style="width: auto; min-width: 180px; height: 32px; font-size: 0.85rem; padding: 0 0.5rem; margin: 0;"></select>
                    <button id="btnLoadRecon" class="btn btn-primary" style="height: 32px; padding: 0 1rem; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; white-space: nowrap;">🔄 Cargar Pagos</button>
                </div>
                <div id="reconResults" style="margin-top: 0.5rem;">
                    <div style="text-align: center; padding: 4rem; color: var(--text-muted);">
                        <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">🔎</span>
                        Seleccione una tienda y haga clic en <b>Cargar Pagos</b>.
                    </div>
                </div>
            </div>
        `;

        const storesSnap = await getDocs(collection(db, "businesses", businessId, "stores"));
        const reconStoreSelect = content.querySelector('#reconStoreSelect');
        reconStoreSelect.innerHTML = '<option value="all">Todas las Tiendas</option><option value="general">Almacén General</option>' + 
            storesSnap.docs.map(doc => `<option value="${doc.id}">${doc.data().name}</option>`).join('');

        content.querySelector('#btnLoadRecon').onclick = async () => {
            const storeId = reconStoreSelect.value;
            const results = content.querySelector('#reconResults');
            results.innerHTML = '<div class="text-center p-4">⌛ Buscando pagos...</div>';

            try {
                const electronicMethods = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'];
                let q = query(
                    collection(db, "businesses", businessId, "payments"),
                    where("method", "in", electronicMethods)
                );

                const snap = await getDocs(q);
                let payments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Filter out verified manually
                payments = payments.filter(p => p.verified !== true);

                if (storeId !== 'all') {
                    payments = payments.filter(p => p.storeId === storeId);
                }
                
                payments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                if (payments.length === 0) {
                    results.innerHTML = '<div class="alert alert-success text-center" style="padding: 2rem;">🎉 Sin pagos pendientes por verificar.</div>';
                    return;
                }

                results.innerHTML = `
                    <div class="table-responsive" style="margin-top: 1rem;">
                        <table class="table" style="font-size: 0.85rem; width: 100%; min-width: 900px; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--background);">
                                    <th style="width: 12%; padding: 1rem; text-align: center;">Fecha</th>
                                    <th style="width: 13%; padding: 1rem; text-align: center;">Método</th>
                                    <th style="width: 15%; padding: 1rem; text-align: center;">Monto</th>
                                    <th style="width: 18%; padding: 1rem; text-align: center;">Referencia</th>
                                    <th style="width: 24%; padding: 1rem;">Tienda / Empleado</th>
                                    <th style="width: 18%; padding: 1rem; text-align: center;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${payments.map(p => `
                                    <tr id="pay-row-${p.id}" style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 1rem; text-align: center;">${p.date || '---'}</td>
                                        <td style="padding: 1rem; text-align: center;"><span class="badge badge-primary" style="padding: 0.4rem 0.6rem;">${p.method.replace('_', ' ')}</span></td>
                                        <td style="padding: 1rem; text-align: center; font-weight: 800; color: ${p.currency === 'USD' ? 'var(--success)' : 'inherit'}; font-size: 0.95rem;">
                                            ${p.currency} ${p.amount.toFixed(2)}
                                        </td>
                                        <td style="padding: 1rem; text-align: center;"><code style="background: var(--background); padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: bold; color: var(--primary);">${p.ref || 'N/A'}</code></td>
                                        <td style="padding: 1rem;">
                                            <div style="font-weight: 600; color: var(--text-main);">${p.storeName || 'Tienda'}</div>
                                            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.employeeName || 'Empleado'}</div>
                                        </td>
                                        <td style="padding: 1rem; text-align: center;">
                                            <button class="btn btn-primary btn-sm btn-verify" data-id="${p.id}" data-ref="${p.ref || 'N/A'}" style="background: var(--success); border-color: var(--success); width: 100%; font-weight: bold;">✅ VERIFICADO</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

                results.querySelectorAll('.btn-verify').forEach(btn => {
                    btn.onclick = async () => {
                        const id = btn.dataset.id;
                        const ref = btn.dataset.ref;
                        
                        if (!confirm(`¿Está seguro de marcar el pago REF: ${ref} como VERIFICADO?\nEsta acción lo ocultará de esta lista.`)) return;

                        btn.disabled = true;
                        btn.textContent = '...';
                        try {
                            await updateDoc(doc(db, "businesses", businessId, "payments", id), {
                                verified: true,
                                verifiedAt: new Date().toISOString(),
                                verifiedBy: auth.currentUser.email
                            });
                            document.getElementById(`pay-row-${id}`).style.opacity = '0.3';
                            document.getElementById(`pay-row-${id}`).style.pointerEvents = 'none';
                            showNotification("Pago marcado como verificado");
                        } catch (err) {
                            showNotification("Error: " + err.message);
                            btn.disabled = false;
                            btn.textContent = '✅ Pago Verificado';
                        }
                    };
                });

            } catch (err) {
                results.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
            }
        };
    }

    init();
}
