import { db } from '../services/firebase.js';
import { collection, getDocs, getDoc, setDoc, doc, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// --- Helpers Globales ---
const parseNum = (val) => {
    if (!val) return 0;
    const str = val.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(str) || 0;
};

const fmtNum = (n) => {
    return parseFloat(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function applyNumericMask(input, callback) {
    if (!input) return;
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); 
        if (!value) { e.target.value = ''; if (callback) callback(); return; }
        let number = parseInt(value, 10);
        e.target.value = (number / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (callback) callback();
    });
    input.addEventListener('focus', (e) => { if (e.target.value === '0,00') e.target.value = ''; });
    input.addEventListener('blur', (e) => { if (!e.target.value) e.target.value = '0,00'; });
}

export function renderPurchases(container) {
    if (!container) {
        container = document.createElement('div');
        container.className = 'view-container';
    }
    let purchases = [];
    let suppliers = [];
    let products = [];
    let bcvRate = parseNum(localStorage.getItem('bcvRate')) || 0;
    const role = localStorage.getItem('userRole');

    // Función para notificaciones profesionales
    function showToast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'error') icon = '⚠️';
        if (type === 'success') icon = '✅';

        toast.innerHTML = `
            <span style="font-size: 1.25rem;">${icon}</span>
            <div style="flex: 1;">
                <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">${message}</p>
            </div>
        `;

        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 4s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    async function loadData() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando compras...</div>';
        try {
            const businessId = localStorage.getItem('businessId');
            if (!businessId) return;

            const supSnap = await getDocs(collection(db, "businesses", businessId, "suppliers"));
            suppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const prodSnap = await getDocs(collection(db, "businesses", businessId, "products"));
            products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            const purSnap = await getDocs(collection(db, "businesses", businessId, "purchases"));
            purchases = purSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (window.tempPurchaseState) {
                renderForm();
            } else {
                renderDeck();
            }
        } catch (error) {
            console.error("Error loading purchases data:", error);
            container.innerHTML = '<div class="alert alert-danger" style="margin: 2rem;">Error al cargar datos. Verifica la conexión.</div>';
        }
    }

    let currentFilterSupplier = '';
    let currentFilterStatus = '';

    function renderDeck() {
        let filteredPurchases = purchases;
        if (currentFilterSupplier) filteredPurchases = filteredPurchases.filter(p => p.supplierId === currentFilterSupplier);
        if (currentFilterStatus) filteredPurchases = filteredPurchases.filter(p => p.status === currentFilterStatus);

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;" class="flex-stack-mobile">
                <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px; color: var(--primary);">📋 Cuentas por Pagar</h2>
                <div style="display: flex; gap: 0.75rem; align-items: center;" class="flex-stack-mobile">
                    <select id="filterSupplier" class="form-control" style="width: auto; min-width: 180px; height: 42px; font-size: 0.85rem; border-radius: 10px;">
                        <option value="">Todos los Proveedores</option>
                        ${suppliers.map(s => `<option value="${s.id}" ${currentFilterSupplier === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                    <select id="filterStatus" class="form-control" style="width: auto; min-width: 150px; height: 42px; font-size: 0.85rem; border-radius: 10px;">
                        <option value="">Todos los Estados</option>
                        <option value="CREDITO" ${currentFilterStatus === 'CREDITO' ? 'selected' : ''}>A CRÉDITO</option>
                        <option value="ABONO" ${currentFilterStatus === 'ABONO' ? 'selected' : ''}>ABONO</option>
                        <option value="PAGADO" ${currentFilterStatus === 'PAGADO' ? 'selected' : ''}>PAGADO</option>
                        <option value="CONTADO" ${currentFilterStatus === 'CONTADO' ? 'selected' : ''}>CONTADO</option>
                    </select>
                    ${role !== 'employee' ? `<button class="btn btn-primary" id="addPurchaseBtn" style="width: auto; padding: 0.75rem 1.5rem; height: 42px; border-radius: 10px;">+ Cargar Compra</button>` : ''}
                </div>
            </div>
        `;

        // Group debt by supplier (based on filtered results)
        const supplierDebt = {};
        suppliers.forEach(s => {
            supplierDebt[s.id] = { id: s.id, name: s.name, debt: 0, invoices: 0 };
        });

        filteredPurchases.forEach(p => {
            if (!supplierDebt[p.supplierId]) {
                supplierDebt[p.supplierId] = { id: p.supplierId, name: 'Proveedor Desconocido', debt: 0, invoices: 0 };
            }
            // Solo mostramos tarjetas para facturas con deuda real
            if (p.status === 'CREDITO' || p.status === 'ABONO') {
                supplierDebt[p.supplierId].debt += parseFloat(p.pendingBalanceUsd || 0);
                supplierDebt[p.supplierId].invoices++;
            }
        });

        // Filtrar proveedores que realmente tienen deuda activa (> 0)
        const activeSuppliers = Object.values(supplierDebt).filter(s => s.debt > 0.01);

        if (activeSuppliers.length === 0) {
            html += `<div style="padding: 3rem; text-align: center; background: var(--surface); border-radius: 8px; border: 1px solid var(--border);">
                <p style="color: var(--text-muted); font-size: 1.1rem;">No hay registros que coincidan con los filtros.</p>
            </div>`;
        } else {
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 2rem;">`;
            
            activeSuppliers.forEach(sup => {
                html += `
                    <div class="card supplier-debt-card" data-id="${sup.id}" style="padding: 1rem; border-left: 4px solid var(--danger); cursor: pointer; transition: transform 0.2s;">
                        <h3 style="color: var(--primary); margin-bottom: 0.75rem; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sup.name}">${sup.name}</h3>
                        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                            <div>
                                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.15rem;">Deuda Total</p>
                                <p style="font-size: 1.25rem; font-weight: bold; color: var(--danger);">$ ${sup.debt.toFixed(2)}</p>
                            </div>
                            <div style="text-align: right;">
                                <p style="font-size: 0.95rem; font-weight: bold;">${sup.invoices} ${sup.invoices === 1 ? 'Factura' : 'Facturas'}</p>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        }

        // Tabla de Historial de Compras
        html += `
            <h3 style="margin-bottom: 1rem;">Historial de Compras</h3>
            <div class="card" style="padding: 0; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background-color: var(--background); border-bottom: 1px solid var(--border);">
                            <th style="padding: 1rem;">Fecha</th>
                            <th style="padding: 1rem;">Documento</th>
                            <th style="padding: 1rem;">Número</th>
                            <th style="padding: 1rem;">Proveedor</th>
                            <th style="padding: 1rem;">Estado</th>
                            <th style="padding: 1rem;">Total $</th>
                            <th style="padding: 1rem;">Deuda $</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (filteredPurchases.length === 0) {
            html += `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);">No se encontraron compras con los filtros seleccionados.</td></tr>`;
        } else {
            // Sort desc
            [...filteredPurchases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(p => {
                const supObj = suppliers.find(s => s.id === p.supplierId);
                const supName = supObj ? supObj.name : 'Desconocido';
                
                let badgeColor = 'var(--text-muted)';
                if (p.status === 'CREDITO') badgeColor = 'var(--danger)';
                if (p.status === 'PAGADO' || p.status === 'CONTADO') badgeColor = 'var(--success)';
                if (p.status === 'ABONO') badgeColor = 'var(--warning)';

                html += `
                    <tr class="purchase-row" data-id="${p.id}" style="border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;">
                        <td style="padding: 1rem;">${p.emissionDate}</td>
                        <td style="padding: 1rem;"><strong>${p.docType}</strong></td>
                        <td style="padding: 1rem;"><span style="color: var(--text-muted); font-size: 0.85rem;">${p.docNumber}</span></td>
                        <td style="padding: 1rem;">${supName}</td>
                        <td style="padding: 1rem;">
                            <span style="padding: 0.2rem 0.5rem; border-radius: 12px; background: ${badgeColor}20; color: ${badgeColor}; font-weight: bold; font-size: 0.75rem;">
                                ${p.status}
                            </span>
                        </td>
                        <td style="padding: 1rem; font-weight: bold;">$ ${(p.totalUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
                        <td style="padding: 1rem; color: ${p.pendingBalanceUsd > 0 ? 'var(--danger)' : 'var(--success)'};">
                            $ ${(p.pendingBalanceUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        // Listeners Filtros
        const filterSup = container.querySelector('#filterSupplier');
        const filterSta = container.querySelector('#filterStatus');

        filterSup.addEventListener('change', () => {
            currentFilterSupplier = filterSup.value;
            renderDeck();
        });
        filterSta.addEventListener('change', () => {
            currentFilterStatus = filterSta.value;
            renderDeck();
        });

        const addBtn = container.querySelector('#addPurchaseBtn');
        if (addBtn) addBtn.addEventListener('click', () => renderForm());

        container.querySelectorAll('.supplier-debt-card').forEach(card => {
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
            card.addEventListener('click', () => {
                renderSupplierDetail(card.dataset.id);
            });
        });

        container.querySelectorAll('.purchase-row').forEach(row => {
            row.addEventListener('mouseover', () => row.style.backgroundColor = 'var(--background)');
            row.addEventListener('mouseout', () => row.style.backgroundColor = 'transparent');
            row.addEventListener('click', () => {
                const purchase = purchases.find(p => p.id === row.dataset.id);
                if (purchase) renderDetail(purchase);
            });
        });
    }

    function renderSupplierDetail(supplierId) {
        const supObj = suppliers.find(s => s.id === supplierId);
        const supName = supObj ? supObj.name : 'Desconocido';
        const pending = purchases.filter(p => p.supplierId === supplierId && p.status !== 'PAGADO' && p.status !== 'CONTADO');
        const totalDebt = pending.reduce((acc, p) => acc + parseFloat(p.pendingBalanceUsd || 0), 0);

        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDeckBtn" style="width: auto; padding: 0.5rem 1rem;">← Volver</button>
                <h2 style="color: var(--primary);">Facturas Pendientes: ${supName}</h2>
            </div>

            <div class="card mb-4" style="padding: 1.5rem; background: var(--surface); border-left: 4px solid var(--danger);">
                <div style="display: flex; justify-content: space-between; align-items: center;" class="flex-stack-mobile">
                    <div>
                        <p class="text-sm text-muted">Monto Total Pendiente</p>
                        <h3 style="font-size: 2rem; color: var(--danger);">$ ${totalDebt.toLocaleString('de-DE', {minimumFractionDigits: 2})}</h3>
                    </div>
                    <div style="text-align: right;" class="text-left-mobile">
                        <p class="text-sm text-muted">Facturas por Pagar</p>
                        <p style="font-size: 1.25rem; font-weight: bold;">${pending.length} documentos</p>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 0; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background-color: var(--background); border-bottom: 1px solid var(--border);">
                            <th style="padding: 1rem;">Fecha</th>
                            <th style="padding: 1rem;">Documento</th>
                            <th style="padding: 1rem;">Numero</th>
                            <th style="padding: 1rem;">Proveedor</th>
                            <th style="padding: 1rem;">Estado</th>
                            <th style="padding: 1rem;">Total $</th>
                            <th style="padding: 1rem;">Deuda $</th>
                            <th style="padding: 1rem; text-align: right;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (pending.length === 0) {
            html += `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay deudas pendientes con este proveedor.</td></tr>`;
        } else {
            pending.sort((a, b) => new Date(a.emissionDate) - new Date(b.emissionDate)).forEach(p => {
                let badgeColor = 'var(--text-muted)';
                if (p.status === 'CREDITO') badgeColor = 'var(--danger)';
                if (p.status === 'ABONO') badgeColor = 'var(--warning)';

                html += `
                    <tr class="purchase-row" data-id="${p.id}" style="border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;">
                        <td style="padding: 1rem;">${p.emissionDate}</td>
                        <td style="padding: 1rem;"><strong>${p.docType}</strong></td>
                        <td style="padding: 1rem;"><span style="color: var(--text-muted); font-size: 0.85rem;">${p.docNumber}</span></td>
                        <td style="padding: 1rem;">${supName}</td>
                        <td style="padding: 1rem;">
                            <span style="padding: 0.2rem 0.5rem; border-radius: 12px; background: ${badgeColor}20; color: ${badgeColor}; font-weight: bold; font-size: 0.75rem;">
                                ${p.status}
                            </span>
                        </td>
                        <td style="padding: 1rem; font-weight: bold;">$ ${(p.totalUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
                        <td style="padding: 1rem; color: var(--danger); font-weight: bold;">
                            $ ${(p.pendingBalanceUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}
                        </td>
                        <td style="padding: 1rem; text-align: right;">
                            <button class="btn btn-primary pay-btn" data-id="${p.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 800; width: auto;">CARGAR PAGO</button>
                        </td>
                    </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        container.querySelector('#backToDeckBtn').addEventListener('click', renderDeck);

        container.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const purchase = pending.find(p => p.id === btn.dataset.id);
                if (purchase) renderPaymentForm(purchase);
            });
        });

        container.querySelectorAll('.purchase-row').forEach(row => {
            row.addEventListener('mouseover', () => row.style.backgroundColor = 'var(--background)');
            row.addEventListener('mouseout', () => row.style.backgroundColor = 'transparent');
            row.addEventListener('click', () => {
                const purchase = purchases.find(p => p.id === row.dataset.id);
                if (purchase) renderDetail(purchase);
            });
        });
    }

    function renderPaymentForm(purchase) {
        const todayStr = new Date().toISOString().split('T')[0];
        const supObj = suppliers.find(s => s.id === purchase.supplierId);
        const supName = supObj ? supObj.name : 'Desconocido';
        const docRate = purchase.bcvRate || bcvRate || 1;

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; text-align: center; justify-content: center; flex-direction: column;">
                <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px; color: var(--success);">💰 Cargar Pago</h2>
                <p class="text-muted text-sm">Registrar abono a factura pendiente</p>
            </div>

            <div style="max-width: 500px; margin: 0 auto;">
                <div class="card mb-4" style="padding: 1.5rem; border-top: 4px solid var(--success);">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">Detalle de Deuda</h3>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Factura:</span>
                        <strong>${purchase.docType} ${purchase.docNumber}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Proveedor:</span>
                        <strong>${supName}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--danger); font-size: 1.25rem;">
                        <span>Saldo Pendiente:</span>
                        <strong>$ ${purchase.pendingBalanceUsd.toLocaleString('de-DE', {minimumFractionDigits: 2})}</strong>
                    </div>
                </div>

                <div class="card" style="padding: 2rem;">
                    <form id="paymentForm">
                        <div class="form-group">
                            <label>Fecha del Pago <span class="text-danger">*</span></label>
                            <input type="date" id="pPaymentDate" class="form-control" required value="${todayStr}">
                        </div>
                        <div class="form-group">
                            <label>Forma de Pago <span class="text-danger">*</span></label>
                            <select id="pPaymentMethod" class="form-control" required>
                                <option value="">Seleccione...</option>
                                <option value="Binance">Binance</option>
                                <option value="BioPago">BioPago</option>
                                <option value="Bs. Efectivo">Bs. Efectivo</option>
                                <option value="Dólares en Efectivo">Dólares en Efectivo</option>
                                <option value="Pago Móvil">Pago Móvil</option>
                                <option value="Paypal">Paypal</option>
                                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Zelle">Zelle</option>
                            </select>
                        </div>

                        <div class="form-group" id="bsGroup" style="display: none;">
                            <label>Monto Bs <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pReceivedBs" class="form-control" placeholder="0,00">
                        </div>
                        <div class="form-group" id="usdGroup" style="display: none;">
                            <label>Monto $ <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pReceivedUsd" class="form-control" placeholder="0,00">
                        </div>

                        <div class="form-group" id="referenceGroup" style="display: none;">
                            <label>Número de Referencia <span class="text-danger">*</span></label>
                            <input type="text" id="pReference" class="form-control" placeholder="Ej. 123456">
                        </div>

                        <div style="background: var(--background); padding: 1rem; border-radius: 12px; margin-top: 1rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span>Abono Total $:</span>
                                <strong id="pTotalAbonoUsd">$ 0,00</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: var(--danger);">
                                <span>Nuevo Saldo $:</span>
                                <strong id="pNewPendingUsd">$ ${purchase.pendingBalanceUsd.toLocaleString('de-DE', {minimumFractionDigits: 2})}</strong>
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                            <button type="button" class="btn btn-outline" id="cancelPaymentBtn" style="flex: 1;">VOLVER</button>
                            <button type="submit" class="btn btn-primary" id="savePaymentBtn" style="flex: 1; background: var(--success); border-color: var(--success);">GUARDAR PAGO</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const pMethod = container.querySelector('#pPaymentMethod');
        const pRef = container.querySelector('#pReference');
        const refGroup = container.querySelector('#referenceGroup');
        const bsGroup = container.querySelector('#bsGroup');
        const usdGroup = container.querySelector('#usdGroup');
        const pBs = container.querySelector('#pReceivedBs');
        const pUsd = container.querySelector('#pReceivedUsd');
        const abonoDisplay = container.querySelector('#pTotalAbonoUsd');
        const newPendingDisplay = container.querySelector('#pNewPendingUsd');

        const updateCalc = () => {
            const bs = parseNum(pBs.value);
            const usd = parseNum(pUsd.value);
            const abonoFromBs = docRate > 0 ? bs / docRate : 0;
            const totalAbono = usd + abonoFromBs;
            const newPending = Math.max(0, purchase.pendingBalanceUsd - totalAbono);

            abonoDisplay.textContent = `$ ${totalAbono.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            newPendingDisplay.textContent = `$ ${newPending.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            return { totalAbono, newPending };
        };

        pMethod.addEventListener('change', () => {
            const val = pMethod.value;
            const bsMethods = ['BioPago', 'Bs. Efectivo', 'Pago Móvil', 'Tarjeta de Débito', 'Transferencia'];
            const usdMethods = ['Binance', 'Dólares en Efectivo', 'Paypal', 'Zelle'];
            const refMethods = ['Binance', 'Pago Móvil', 'Paypal', 'Transferencia', 'Zelle'];

            // Reset
            pBs.value = '';
            pUsd.value = '';
            pRef.value = '';
            bsGroup.style.display = 'none';
            usdGroup.style.display = 'none';
            refGroup.style.display = 'none';
            pBs.required = false;
            pUsd.required = false;
            pRef.required = false;

            if (bsMethods.includes(val)) {
                bsGroup.style.display = 'block';
                pBs.required = true;
                pBs.value = fmtNum(purchase.pendingBalanceUsd * docRate);
            } else if (usdMethods.includes(val)) {
                usdGroup.style.display = 'block';
                pUsd.required = true;
                pUsd.value = fmtNum(purchase.pendingBalanceUsd);
            }

            if (refMethods.includes(val)) {
                refGroup.style.display = 'block';
                pRef.required = true;
            }
            updateCalc();
        });

        [pBs, pUsd].forEach(inp => applyNumericMask(inp, updateCalc));

        container.querySelector('#cancelPaymentBtn').addEventListener('click', () => renderSupplierDetail(purchase.supplierId));

        container.querySelector('#paymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#savePaymentBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const { totalAbono, newPending } = updateCalc();
            if (totalAbono <= 0) {
                showToast("Ingrese un monto válido", "error");
                btn.disabled = false;
                btn.textContent = 'GUARDAR PAGO';
                return;
            }

            try {
                const businessId = localStorage.getItem('businessId');
                
                // 1. Crear el registro del pago (con su propio ID)
                const paymentRef = doc(collection(db, "businesses", businessId, "purchases", purchase.id, "payments"));
                const paymentData = {
                    date: container.querySelector('#pPaymentDate').value,
                    method: pMethod.value,
                    reference: pRef.value || null,
                    amountBs: parseNum(pBs.value),
                    amountUsd: parseNum(pUsd.value),
                    equivalentUsd: totalAbono,
                    createdAt: new Date().toISOString(),
                    type: 'MANUAL'
                };
                await setDoc(paymentRef, paymentData);

                // 2. Actualizamos la compra
                const updatedData = {
                    receivedBs: (purchase.receivedBs || 0) + parseNum(pBs.value),
                    receivedUsd: (purchase.receivedUsd || 0) + parseNum(pUsd.value),
                    pendingBalanceUsd: newPending,
                    status: newPending <= 0.01 ? 'PAGADO' : 'ABONO',
                    // Guardamos info del último pago para compatibilidad y fallback
                    paymentDate: paymentData.date,
                    paymentMethod: paymentData.method,
                    reference: paymentData.reference,
                    equivalentUsd: (purchase.equivalentUsd || 0) + totalAbono
                };

                await updateDoc(doc(db, "businesses", businessId, "purchases", purchase.id), updatedData);
                
                const supRef = doc(db, "businesses", businessId, "suppliers", purchase.supplierId);
                const supSnap = await getDoc(supRef);
                if (supSnap.exists()) {
                    const currentDebt = supSnap.data().debt || 0;
                    await updateDoc(supRef, { debt: Math.max(0, currentDebt - totalAbono) });
                }

                showToast("Pago registrado con éxito", "success");
                await loadData();
                renderSupplierDetail(purchase.supplierId);
            } catch (err) {
                console.error("Error guardando pago:", err);
                showToast("Error al guardar pago", "error");
                btn.disabled = false;
                btn.textContent = 'GUARDAR PAGO';
            }
        });
    }

    function renderForm() {
        const todayStr = new Date().toISOString().split('T')[0];
        
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; text-align: center; justify-content: center; flex-direction: column;">
                <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px;">📦 Cargar Compra</h2>
                <p class="text-muted text-sm">Registra la recepción de mercancía y facturas</p>
            </div>
            
            <form id="purchaseForm" style="max-width: 500px; margin: 0 auto;">
                <!-- 1. Datos del Documento -->
                <div class="card mb-3" style="padding: 2rem; border-top: 4px solid var(--primary);">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">1. Datos del Documento</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>Proveedor <span class="text-danger">*</span></label>
                            <select id="pSupplier" class="form-control" required>
                                <option value="">Seleccione un proveedor...</option>
                                <option value="CREATE_NEW" style="font-weight: bold; color: var(--primary);">+ CREAR PROVEEDOR</option>
                                ${[...suppliers].sort((a,b)=>a.name.localeCompare(b.name)).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>Emisión <span class="text-danger">*</span></label>
                                <input type="date" id="pEmissionDate" class="form-control" required value="${todayStr}">
                            </div>
                            <div class="form-group">
                                <label>Recepción <span class="text-danger">*</span></label>
                                <input type="date" id="pReceptionDate" class="form-control" required value="${todayStr}">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Tasa BCV de la Factura <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pBcvRate" class="form-control" required value="${bcvRate.toLocaleString('de-DE', {minimumFractionDigits:2})}">
                            <small id="bcvWarning" style="color: var(--warning); display: none; margin-top: 4px; font-size: 0.7rem; font-weight: 700;">⚠️ No hay tasa cargada para la Fecha de Emisión, por favor cargue acá la tasa para esa fecha.</small>
                        </div>

                        <div class="form-group">
                            <label>Tipo de Documento <span class="text-danger">*</span></label>
                            <select id="pDocType" class="form-control" required>
                                <option value="">Seleccione...</option>
                                <option value="FACTURA">FACTURA</option>
                                <option value="GUIA DE DESPACHO">GUIA DE DESPACHO</option>
                                <option value="NOTA DE ENTREGA">NOTA DE ENTREGA</option>
                                <option value="PRESUPUESTO">PRESUPUESTO</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Número de Documento <span class="text-danger">*</span></label>
                            <input type="text" id="pDocNumber" class="form-control" required placeholder="Ej. 001-A">
                        </div>
                        
                        <div class="form-group">
                            <label>Estado de la Compra <span class="text-danger">*</span></label>
                            <select id="pStatus" class="form-control" required>
                                <option value="">Seleccione...</option>
                                <option value="ABONO">ABONO</option>
                                <option value="CONTADO">CONTADO</option>
                                <option value="CREDITO">CREDITO</option>
                                <option value="PAGADO">PAGADO</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- 2. Moneda y Productos -->
                <div class="card mb-3" style="padding: 2rem;">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">2. Productos Recibidos</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>Moneda de la Factura <span class="text-danger">*</span></label>
                            <div style="display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; height: 40px;">
                                <div id="btnCurrencyBs" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; background: var(--primary); color: white; font-weight: 800; font-size: 0.7rem;">EN BOLÍVARES</div>
                                <div id="btnCurrencyUsd" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; background: var(--background); color: var(--text-main); font-weight: 800; font-size: 0.7rem;">EN DÓLARES</div>
                            </div>
                            <input type="hidden" id="pCurrency" value="BS">
                        </div>
                        
                        <button type="button" class="btn btn-outline" id="openProductBuilderBtn" style="height: 50px; font-weight: 800; border-style: dashed; border-width: 2px; color: var(--primary); border-color: var(--primary); margin-top: 0.5rem;">
                            📦 SELECCIONAR PRODUCTOS
                        </button>
                    </div>

                    <!-- Area to display selected products list summary (Removed as per redundancy request) -->

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; background: var(--background); padding: 1rem; border-radius: 12px; margin-top: 1rem;">
                        <div style="text-align: center;">
                            <p style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Items</p>
                            <p id="pItemsCount" style="font-size: 1rem; font-weight: 900; color: var(--text-main); margin: 0;">0</p>
                        </div>
                        <div style="text-align: center; border-left: 1px solid var(--border);">
                            <p style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">TOTAL BS</p>
                            <p id="pTotalBs" style="font-size: 1rem; font-weight: 900; color: var(--text-main); margin: 0;">Bs. 0.00</p>
                        </div>
                        <div style="text-align: center; border-left: 1px solid var(--border);">
                            <p style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">TOTAL DÓLARES</p>
                            <p id="pTotalUsd" style="font-size: 1.1rem; font-weight: 900; color: var(--primary); margin: 0;">$ 0.00</p>
                        </div>
                    </div>
                </div>

                <!-- 3. Pagos (Condicional) -->
                <div class="card mb-3" id="paymentSection" style="display: none; padding: 2rem; border-left: 4px solid var(--success);">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--success); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">3. Registro de Pago</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>Fecha del Pago <span class="text-danger">*</span></label>
                            <input type="date" id="pPaymentDate" class="form-control" value="${todayStr}">
                        </div>
                        <div class="form-group">
                            <label>Forma de Pago <span class="text-danger">*</span></label>
                            <select id="pPaymentMethod" class="form-control">
                                <option value="">Seleccione...</option>
                                <option value="Binance">Binance</option>
                                <option value="BioPago">BioPago</option>
                                <option value="Bs. Efectivo">Bs. Efectivo</option>
                                <option value="Dólares en Efectivo">Dólares en Efectivo</option>
                                <option value="Pago Móvil">Pago Móvil</option>
                                <option value="Paypal">Paypal</option>
                                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Zelle">Zelle</option>
                            </select>
                        </div>

                        <div class="form-group" id="receivedBsGroup" style="display: none;">
                            <label>Recibido Bs <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pReceivedBs" class="form-control" style="font-weight: bold; color: var(--success);">
                        </div>
                        <div class="form-group" id="receivedUsdGroup" style="display: none;">
                            <label>Recibido $ <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pReceivedUsd" class="form-control" style="font-weight: bold; color: var(--success);">
                        </div>
                        <div class="form-group" id="equivalentUsdGroup" style="display: none;">
                            <label>Equivalente $ <small class="text-muted">(Auto-calculado)</small></label>
                            <input type="text" id="pEquivalentUsd" class="form-control" readonly style="background: transparent; border-style: dashed;">
                        </div>
                        <div class="form-group" id="referenceGroup" style="display: none;">
                            <label>Número de Referencia <span class="text-danger">*</span></label>
                            <input type="text" id="pReference" class="form-control" placeholder="Ej. 123456">
                        </div>
                        <div class="form-group">
                            <label>Saldo Pendiente $</label>
                            <input type="text" id="pPendingBalance" class="form-control" readonly style="background: rgba(239, 68, 68, 0.05); color: var(--danger); font-weight: 900; font-size: 1.1rem; border-color: var(--danger);">
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="button" class="btn btn-outline" id="cancelFormBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                    <button type="submit" class="btn btn-primary" id="savePurchaseBtn" style="flex: 1; height: 50px; font-weight: 800;">CREAR COMPRA</button>
                </div>
            </form>

            <!-- Sub-view: Cargar Productos Modal -->
            <div id="productBuilderModal" style="display: none; position: absolute; inset: 0; background: var(--surface); z-index: 100; flex-direction: column;">
                <!-- To be rendered inside logic -->
            </div>

            <!-- Modal para Cantidad y Costo de Item -->
            <div id="itemModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="width: 100%; max-width: 450px; padding: 2rem; border-top: 5px solid var(--primary); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                    <h2 id="itemModalTitle" style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; color: var(--primary); margin-bottom: 0.5rem;">Cargar Producto</h2>
                    <p id="itemModalSubtitle" class="text-muted mb-4" style="font-size: 0.85rem;">Ingrese los datos de recepción.</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>¿Cómo lo recibe? <span class="text-danger">*</span></label>
                            <select id="itemReceptionType" class="form-control"></select>
                        </div>

                        <div class="form-group">
                            <label id="lblItemQty">Cantidad <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="itemQtyInput" class="form-control" placeholder="0,00">
                        </div>

                        <div class="form-group">
                            <label id="lblItemTotalCost">Costo TOTAL en factura <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="itemTotalCostInput" class="form-control" placeholder="0,00">
                            <small class="text-muted" style="display: block; margin-top: 4px; line-height: 1.2; font-size: 0.65rem;">
                                El sistema calculará el costo unitario automáticamente.
                            </small>
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                            <button type="button" class="btn btn-outline" id="cancelItemBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                            <button type="button" class="btn btn-primary" id="confirmItemBtn" style="flex: 1; height: 50px; font-weight: 800;">CONFIRMAR</button>
                        </div>
                    </div>
                </div>
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

        container.innerHTML = html;

        // Variables de estado interno
        let currentPurchaseProducts = [];
        let totalPurchaseUsd = 0;
        let totalPurchaseBs = 0;

        // Elements
        const btnCurrencyBs = container.querySelector('#btnCurrencyBs');
        const btnCurrencyUsd = container.querySelector('#btnCurrencyUsd');
        const pCurrency = container.querySelector('#pCurrency');
        const pSupplier = container.querySelector('#pSupplier');
        const pDocType = container.querySelector('#pDocType');
        const pDocNumber = container.querySelector('#pDocNumber');
        const pEmissionDate = container.querySelector('#pEmissionDate');
        const pReceptionDate = container.querySelector('#pReceptionDate');
        const pStatus = container.querySelector('#pStatus');
        const paymentSection = container.querySelector('#paymentSection');
        const pPaymentMethod = container.querySelector('#pPaymentMethod');
        const receivedBsGroup = container.querySelector('#receivedBsGroup');
        const receivedUsdGroup = container.querySelector('#receivedUsdGroup');
        const equivalentUsdGroup = container.querySelector('#equivalentUsdGroup');
        const pPaymentDate = container.querySelector('#pPaymentDate');
        const pReceivedBs = container.querySelector('#pReceivedBs');
        const pReceivedUsd = container.querySelector('#pReceivedUsd');
        const pEquivalentUsd = container.querySelector('#pEquivalentUsd');
        const pPendingBalance = container.querySelector('#pPendingBalance');
        const pBcvRate = container.querySelector('#pBcvRate');

        let shouldOpenBuilder = false;
        
        // Restore state if returning from Product Creation
        if (window.tempPurchaseState) {
            const st = window.tempPurchaseState;
            pSupplier.value = st.supplierId || '';
            pBcvRate.value = st.bcvRate || '';
            pEmissionDate.value = st.emissionDate || todayStr;
            pReceptionDate.value = st.receptionDate || todayStr;
            pDocType.value = st.docType || '';
            pDocNumber.value = st.docNumber || '';
            pStatus.value = st.status || '';
            pCurrency.value = st.currency || 'BS';
            pPaymentDate.value = st.paymentDate || todayStr;
            pPaymentMethod.value = st.paymentMethod || '';
            pReceivedBs.value = st.receivedBs || '';
            pReceivedUsd.value = st.receivedUsd || '';
            
            if (st.currency === 'USD') {
                btnCurrencyUsd.style.background = 'var(--primary)';
                btnCurrencyUsd.style.color = 'white';
                btnCurrencyBs.style.background = 'var(--background)';
                btnCurrencyBs.style.color = 'var(--text-main)';
            }
            
            currentPurchaseProducts = st.products || [];
            shouldOpenBuilder = st.openProductBuilder || false;
            
            if (st.autoOpenProductId) {
                window.autoOpenProductId = st.autoOpenProductId;
            }
            
            delete window.tempPurchaseState;
        }

        // Navigation
        container.querySelector('#cancelFormBtn').addEventListener('click', renderDeck);

        const updatePayments = () => {
            const bcv = parseNum(pBcvRate.value);
            const totalUsdStr = container.querySelector('#pTotalUsd').textContent.replace('$', '').trim();
            const totalUsd = parseNum(totalUsdStr);
            const receivedBs = parseNum(pReceivedBs.value);
            const receivedUsd = parseNum(pReceivedUsd.value);
            
            const eqUsd = bcv > 0 ? receivedBs / bcv : 0;
            if (pEquivalentUsd) pEquivalentUsd.value = fmtNum(eqUsd);
            
            const totalReceived = receivedUsd + eqUsd;
            const pending = totalUsd - totalReceived;
            if (pPendingBalance) pPendingBalance.value = fmtNum(Math.max(0, pending));
        };


        const bcvWarning = container.querySelector('#bcvWarning');

        // Función para buscar tasa por fecha
        const fetchRateByDate = async (date) => {
            const businessId = localStorage.getItem('businessId');
            if (!businessId || !date) return;
            
            try {
                const docRef = doc(db, "businesses", businessId, "bcv_history", date);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const rate = docSnap.data().rate;
                    pBcvRate.value = fmtNum(rate);
                    bcvWarning.style.display = 'none';
                    pBcvRate.classList.remove('input-warning');
                } else {
                    bcvWarning.style.display = 'block';
                    pBcvRate.classList.add('input-warning');
                    // Si es hoy, tal vez podamos usar la del localstorage si coincide
                    const savedRate = localStorage.getItem('bcvRate');
                    const savedDate = localStorage.getItem('bcvDate');
                    if (date === savedDate && savedRate) {
                        pBcvRate.value = fmtNum(parseNum(savedRate));
                    }
                }
                calculatePendingBalance();
            } catch (err) {
                console.error("Error fetching rate by date:", err);
            }
        };

        pEmissionDate.addEventListener('change', (e) => fetchRateByDate(e.target.value));
        // Ejecutar una vez al inicio
        fetchRateByDate(pEmissionDate.value);

        [pBcvRate, pReceivedBs, pReceivedUsd].forEach(inp => applyNumericMask(inp, updatePayments));
        
        const itemQtyInput = container.querySelector('#itemQtyInput');
        const itemTotalCostInput = container.querySelector('#itemTotalCostInput');
        [itemQtyInput, itemTotalCostInput].forEach(inp => applyNumericMask(inp));

        pSupplier.addEventListener('change', () => {
            if (pSupplier.value === 'CREATE_NEW') {
                window.tempPurchaseState = {
                    supplierId: '', 
                    bcvRate: pBcvRate.value,
                    emissionDate: pEmissionDate.value,
                    receptionDate: pReceptionDate.value,
                    docType: pDocType.value,
                    docNumber: pDocNumber.value,
                    status: pStatus.value,
                    currency: pCurrency.value,
                    paymentDate: pPaymentDate.value,
                    paymentMethod: pPaymentMethod.value,
                    receivedBs: pReceivedBs.value,
                    receivedUsd: pReceivedUsd.value,
                    products: currentPurchaseProducts
                };
                window.openCreateSupplierForPurchase = true;
                document.getElementById('navProveedores').click();
            }
        });
        
        // Currency Toggle Logic
        btnCurrencyBs.addEventListener('click', () => {
            pCurrency.value = 'BS';
            btnCurrencyBs.style.background = 'var(--primary)';
            btnCurrencyBs.style.color = 'white';
            btnCurrencyUsd.style.background = 'var(--background)';
            btnCurrencyUsd.style.color = 'var(--text-main)';
        });
        
        btnCurrencyUsd.addEventListener('click', () => {
            pCurrency.value = 'USD';
            btnCurrencyUsd.style.background = 'var(--primary)';
            btnCurrencyUsd.style.color = 'white';
            btnCurrencyBs.style.background = 'var(--background)';
            btnCurrencyBs.style.color = 'var(--text-main)';
        });

        // Status Logic
        pStatus.addEventListener('change', () => {
            const status = pStatus.value;
            if (status === 'CONTADO' || status === 'ABONO') {
                paymentSection.style.display = 'block';
                pPaymentDate.required = true;
                pPaymentMethod.required = true;
                
                // Trigger method check to prefill
                if (status === 'CONTADO' && pPaymentMethod.value) {
                    pPaymentMethod.dispatchEvent(new Event('change'));
                }
            } else {
                paymentSection.style.display = 'none';
                pPaymentDate.required = false;
                pPaymentMethod.required = false;
                pPaymentMethod.value = '';
                pReceivedBs.value = '';
                pReceivedUsd.value = '';
                calculatePendingBalance();
            }
        });

        // Payment Method Logic
        pPaymentMethod.addEventListener('change', () => {
            const method = pPaymentMethod.value;
            const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Transferencia', 'Tarjeta de Débito', 'BioPago'];
            const usdMethods = ['Dólares en Efectivo', 'Zelle', 'Paypal', 'Binance'];

            pReceivedBs.value = '';
            pReceivedUsd.value = '';
            pEquivalentUsd.value = '';
            const pReference = container.querySelector('#pReference');
            const referenceGroup = container.querySelector('#referenceGroup');
            pReference.value = '';
            referenceGroup.style.display = 'none';
            pReference.required = false;

            const refMethods = ['Binance', 'Pago Móvil', 'Paypal', 'Transferencia', 'Zelle'];
            if (refMethods.includes(method)) {
                referenceGroup.style.display = 'block';
                pReference.required = true;
            }

            if (bsMethods.includes(method)) {
                receivedBsGroup.style.display = 'block';
                equivalentUsdGroup.style.display = 'block';
                receivedUsdGroup.style.display = 'none';
                pReceivedBs.required = true;
                pReceivedUsd.required = false;

                if (pStatus.value === 'CONTADO') {
                    pReceivedBs.value = fmtNum(totalPurchaseBs);
                }
            } else if (usdMethods.includes(method)) {
                receivedUsdGroup.style.display = 'block';
                receivedBsGroup.style.display = 'none';
                equivalentUsdGroup.style.display = 'none';
                pReceivedUsd.required = true;
                pReceivedBs.required = false;

                if (pStatus.value === 'CONTADO') {
                    pReceivedUsd.value = fmtNum(totalPurchaseUsd);
                }
            } else {
                receivedBsGroup.style.display = 'none';
                receivedUsdGroup.style.display = 'none';
                equivalentUsdGroup.style.display = 'none';
                pReceivedBs.required = false;
                pReceivedUsd.required = false;
            }
            calculatePendingBalance();
        });

        // Calculations
        function calculatePendingBalance() {
            const docRate = parseNum(pBcvRate.value) || 1;
            let paidUsd = 0;

            if (pStatus.value === 'PAGADO') {
                paidUsd = totalPurchaseUsd;
            } else if (pStatus.value === 'CONTADO' || pStatus.value === 'ABONO') {
                const method = pPaymentMethod.value;
                const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Transferencia', 'Tarjeta de Débito', 'BioPago'];
                
                if (bsMethods.includes(method)) {
                    const recBs = parseNum(pReceivedBs.value) || 0;
                    paidUsd = recBs / docRate; 
                    pEquivalentUsd.value = fmtNum(paidUsd);
                } else {
                    paidUsd = parseNum(pReceivedUsd.value) || 0;
                }
            }

            let pending = totalPurchaseUsd - paidUsd;
            if (pending < 0) pending = 0;
            if (pStatus.value === 'CREDITO') pending = totalPurchaseUsd;

            pPendingBalance.value = fmtNum(pending);
        }

        pReceivedBs.addEventListener('input', calculatePendingBalance);
        pReceivedUsd.addEventListener('input', calculatePendingBalance);
        pBcvRate.addEventListener('input', calculatePendingBalance);

        // Product Builder logic
        container.querySelector('#openProductBuilderBtn').addEventListener('click', () => {
            const supplierId = pSupplier.value;
            if (!supplierId || supplierId === 'CREATE_NEW') {
                pSupplier.classList.add('input-error');
                showToast("Por favor, seleccione un proveedor antes de cargar productos.", "error");
                pSupplier.focus();
                
                // Quitar el error cuando cambie
                pSupplier.addEventListener('change', () => pSupplier.classList.remove('input-error'), { once: true });
                return;
            }
            renderProductBuilder(currentPurchaseProducts, pCurrency.value, parseNum(pBcvRate.value) || 1, supplierId);
        });

        // Este handler recibe los datos del modal cuando el usuario hace clic en "Procesar Selección"
        const handleProductsProcessed = (e) => {
            currentPurchaseProducts = e.detail.products;
            totalPurchaseUsd = e.detail.totalUsd;
            totalPurchaseBs = e.detail.totalBs;
            updateTotals();
        };
        // Remove previous to avoid duplicates if renderForm is called multiple times without unmounting
        container.removeEventListener('productsProcessed', handleProductsProcessed);
        container.addEventListener('productsProcessed', handleProductsProcessed);

        function updateTotals() {
            // First recount totals just in case
            totalPurchaseUsd = currentPurchaseProducts.reduce((acc, p) => acc + p.subTotalUsd, 0);
            totalPurchaseBs = currentPurchaseProducts.reduce((acc, p) => acc + p.subTotalBs, 0);

            container.querySelector('#pItemsCount').textContent = currentPurchaseProducts.length;
            container.querySelector('#pTotalBs').textContent = `Bs. ${totalPurchaseBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            container.querySelector('#pTotalUsd').textContent = `$ ${totalPurchaseUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            calculatePendingBalance();
        }

        // Initialize totals just in case state was restored
        updateTotals();

        // Re-trigger events to update UI AFTER listeners are attached
        if (pStatus.value === 'CONTADO' || pStatus.value === 'ABONO') {
            pStatus.dispatchEvent(new Event('change'));
            if (pPaymentMethod.value) {
                pPaymentMethod.dispatchEvent(new Event('change'));
            }
        }

        // Si venimos de crear un producto faltante, reabrimos el modal automáticamente
        if (shouldOpenBuilder) {
            renderProductBuilder(currentPurchaseProducts, pCurrency.value, parseNum(pBcvRate.value) || 1, pSupplier.value);
        }

        // Save Logic
        const purchaseForm = container.querySelector('#purchaseForm');
        purchaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (currentPurchaseProducts.length === 0) {
                showToast("Debe agregar al menos un producto a la compra.", "error");
                return;
            }

            const btn = container.querySelector('#savePurchaseBtn');
            btn.disabled = true;
            btn.textContent = 'Procesando...';

            const businessId = localStorage.getItem('businessId');
            
            // Build purchase object
            const purchaseData = {
                supplierId: container.querySelector('#pSupplier').value,
                bcvRate: parseNum(container.querySelector('#pBcvRate').value) || 1,
                emissionDate: container.querySelector('#pEmissionDate').value,
                receptionDate: container.querySelector('#pReceptionDate').value,
                docType: container.querySelector('#pDocType').value,
                docNumber: container.querySelector('#pDocNumber').value,
                status: pStatus.value,
                currency: pCurrency.value,
                totalBs: totalPurchaseBs,
                totalUsd: totalPurchaseUsd,
                itemsCount: currentPurchaseProducts.reduce((acc, curr) => acc + curr.qty, 0),
                products: currentPurchaseProducts,
                createdAt: new Date().toISOString(),
                createdBy: localStorage.getItem('userRole') || 'admin'
            };

            // Payment data if applicable
            if (pStatus.value === 'CONTADO' || pStatus.value === 'ABONO') {
                purchaseData.paymentDate = pPaymentDate.value;
                purchaseData.paymentMethod = pPaymentMethod.value;
                purchaseData.receivedBs = parseNum(pReceivedBs.value) || 0;
                purchaseData.receivedUsd = parseNum(pReceivedUsd.value) || 0;
                purchaseData.equivalentUsd = parseNum(pEquivalentUsd.value) || 0;
                purchaseData.reference = container.querySelector('#pReference').value || null;
            }
            purchaseData.pendingBalanceUsd = parseNum(pPendingBalance.value) || 0;

            try {
                // 1. Guardar la compra
                const newPurchaseRef = doc(collection(db, "businesses", businessId, "purchases"));
                await setDoc(newPurchaseRef, purchaseData);

                // 1.5 Si hay pago inicial, crear el registro en la sub-colección de pagos
                if (purchaseData.status === 'CONTADO' || purchaseData.status === 'ABONO') {
                    const firstPaymentRef = doc(collection(db, "businesses", businessId, "purchases", newPurchaseRef.id, "payments"));
                    await setDoc(firstPaymentRef, {
                        date: purchaseData.paymentDate,
                        method: purchaseData.paymentMethod,
                        reference: purchaseData.reference,
                        amountBs: purchaseData.receivedBs,
                        amountUsd: purchaseData.receivedUsd,
                        equivalentUsd: purchaseData.equivalentUsd,
                        createdAt: new Date().toISOString(),
                        type: 'INITIAL'
                    });
                }

                // 2. Actualizar Inventario y Costos
                // Iteramos los productos y lanzamos updates individuales a Firebase
                for (let item of currentPurchaseProducts) {
                    const prodRef = doc(db, "businesses", businessId, "products", item.id);
                    const prodSnap = await getDoc(prodRef);
                    if (prodSnap.exists()) {
                        const pData = prodSnap.data();
                        // Stock siempre en stockGeneral (Almacén General)
                        const currentGeneral = pData.stockGeneral ?? pData.stock ?? 0;
                        const newStockGeneral = currentGeneral + item.qty;
                        const newCostPerStockUnit = item.costPerStockUnitUsd || item.costUsd;
                        const factor = pData.stockToRecipeFactor || 1;
                        const newCostPerRecipeUnit = factor > 0 ? newCostPerStockUnit / factor : newCostPerStockUnit;

                        const roundTo05 = (num) => Math.round(num * 20) / 20;
                        let mDetal = 1.30, mMayor = 1.25, mSpecial = 1.20;
                        if (pData.category === 'RECETA') { mDetal = 2.60; mMayor = 2.50; mSpecial = 2.40; }

                        await updateDoc(prodRef, {
                            stockGeneral: newStockGeneral,
                            cost: newCostPerStockUnit,
                            costPerStockUnit: newCostPerStockUnit,
                            costPerRecipeUnit: newCostPerRecipeUnit,
                            priceDetal: roundTo05(newCostPerStockUnit * mDetal),
                            priceMayor: roundTo05(newCostPerStockUnit * mMayor),
                            priceSpecial: roundTo05(newCostPerStockUnit * mSpecial)
                        });
                    }
                }

                showToast("Compra registrada correctamente y el inventario ha sido actualizado.", "success");
                await loadData(); // Reload everything and go back to deck

            } catch (error) {
                console.error("Error guardando compra:", error);
                showToast("Ocurrió un error al guardar la compra.", "error");
                btn.disabled = false;
                btn.textContent = 'Crear Compra';
            }
        });
    }

    function renderProductBuilder(currentList, currency, rate, targetSupplierId) {
        const modal = container.querySelector('#productBuilderModal');
        let tempProducts = [...currentList]; // Copia de trabajo
        let tempTotalUsd = 0;
        let tempTotalBs = 0;
        
        // Render structure
        let html = `
            <div style="height: auto; min-height: 64px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem;" class="flex-stack-mobile">
                <h2 style="margin: 0; color: var(--primary); font-size: 1.25rem; font-weight: 800;">📦 SELECCIONAR PRODUCTOS</h2>
                <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                    <button type="button" class="btn btn-outline" id="pbCancelBtn" style="width: auto; height: 40px; font-weight: 700; padding: 0 1.5rem;">DESCARTAR</button>
                    <button type="button" class="btn btn-primary" id="pbProcessBtn" style="width: auto; height: 40px; font-weight: 800; padding: 0 1.5rem;">PROCESAR</button>
                </div>
            </div>
            <div style="flex: 1; display: flex; overflow: hidden;" class="flex-stack-mobile">
                <!-- Lado Izquierdo: Catálogo -->
                <div style="flex: 1; display: flex; flex-direction: column; background: var(--background); border-right: 1px solid var(--border);">
                    <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column; gap: 0.75rem;">
                        <div class="form-group">
                            <label style="margin-bottom: 4px; font-weight: 800; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Buscar en catálogo</label>
                            <input type="search" id="pbSearch" class="form-control" placeholder="Nombre del producto..." style="height: 40px;">
                        </div>
                        <button class="btn btn-outline" id="pbCreateProductBtn" style="height: 40px; border-color: var(--primary); color: var(--primary); font-weight: 700; font-size: 0.8rem; border-style: dashed;">+ CREAR PRODUCTO NUEVO</button>
                    </div>
                    <div id="pbCatalogGrid" style="flex: 1; padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
                        <!-- List Items -->
                    </div>
                </div>

                <!-- Lado Derecho: Lista de Recepción -->
                <div style="flex: 1; display: flex; flex-direction: column; background: var(--surface);">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                        <h3 style="margin: 0;">Lista de Recepción</h3>
                    </div>
                    <div style="flex: 1; overflow-y: auto; padding: 1rem;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border);">
                                    <th style="padding: 0.5rem;">Producto</th>
                                    <th style="padding: 0.5rem;">Cant.</th>
                                    <th style="padding: 0.5rem;">Costo Ud.</th>
                                    <th style="padding: 0.5rem;">SubTotal</th>
                                    <th style="padding: 0.5rem;"></th>
                                </tr>
                            </thead>
                            <tbody id="pbTableBody"></tbody>
                        </table>
                    </div>
                    <div style="padding: 1rem; border-top: 1px solid var(--border); background: var(--background);">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; text-align: center;">
                            <div class="card" style="padding: 0.75rem;">
                                <p class="text-sm text-muted mb-1">Items Totales</p>
                                <p style="font-size: 1.1rem; font-weight: bold;" id="pbItemsDisplay">0</p>
                            </div>
                            <div class="card" style="padding: 0.75rem;">
                                <p class="text-sm text-muted mb-1">Esta Compra Bs</p>
                                <p style="font-size: 1.1rem; font-weight: bold;" id="pbTotalBsDisplay">Bs. 0.00</p>
                            </div>
                            <div class="card" style="padding: 0.75rem;">
                                <p class="text-sm text-muted mb-1">Esta Compra $</p>
                                <p style="font-size: 1.1rem; font-weight: bold; color: var(--primary);" id="pbTotalUsdDisplay">$ 0.00</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        modal.innerHTML = html;
        modal.style.display = 'flex';

        // Elements
        const pbSearch = modal.querySelector('#pbSearch');
        const pbCatalogGrid = modal.querySelector('#pbCatalogGrid');
        const pbTableBody = modal.querySelector('#pbTableBody');
        const pbItemsDisplay = modal.querySelector('#pbItemsDisplay');
        const pbTotalBsDisplay = modal.querySelector('#pbTotalBsDisplay');
        const pbTotalUsdDisplay = modal.querySelector('#pbTotalUsdDisplay');

        // Logic functions
        function renderCatalog(filter = '') {
            let html = '';
            
            const filtered = products
                .filter(p => {
                    const matchesName = p.name.toLowerCase().includes(filter.toLowerCase());
                    const matchesSupplier = p.supplierId === targetSupplierId;
                    return matchesName && matchesSupplier;
                })
                .sort((a, b) => a.name.localeCompare(b.name));
            
            filtered.forEach(p => {
                const sUnit = p.stockUnit || 'ud';
                const pUnit = p.purchaseUnit || 'Unidad';
                html += `
                    <div class="card catalog-item" data-id="${p.id}" style="padding: 0.75rem 1rem; cursor: pointer; transition: background-color 0.2s; display: flex; justify-content: space-between; align-items: center; border-radius: 8px;">
                        <span style="font-weight: 500; color: var(--primary); font-size: 0.95rem;">${p.name}</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${p.stock || 0} ${sUnit} | Compra: ${pUnit}</span>
                    </div>
                `;
            });
            pbCatalogGrid.innerHTML = html;

            pbCatalogGrid.querySelectorAll('.catalog-item').forEach(item => {
                item.addEventListener('click', () => handleProductSelect(item.dataset.id));
            });
        }

        function handleProductSelect(productId) {
            const prod = products.find(p => p.id === productId);
            if (!prod) return;

            const itemModal = document.getElementById('itemModal');
            const itemReceptionType = document.getElementById('itemReceptionType');
            const itemQtyInput = document.getElementById('itemQtyInput');
            const itemTotalCostInput = document.getElementById('itemTotalCostInput');
            const confirmItemBtn = document.getElementById('confirmItemBtn');
            const cancelItemBtn = document.getElementById('cancelItemBtn');

            // Sistema de unidades: nuevo vs legado
            const purchaseUnit = prod.purchaseUnit || null;
            const stockUnit = prod.stockUnit || 'Unidad';
            const purchaseToStockQty = prod.purchaseToStockQty || 1;

            document.getElementById('itemModalTitle').textContent = prod.name;
            document.getElementById('lblItemTotalCost').textContent =
                `¿Costo TOTAL (subtotal factura en ${currency}) de toda la cantidad recibida?`;

            const receptionSelect = document.getElementById('itemReceptionType');
            const lblQty = document.getElementById('lblItemQty');

            const units = ["Unidad", "Caja", "Bulto", "Saco", "Paquete", "Kilo", "Litro", "Gramo"];
            receptionSelect.innerHTML = units.map(u => `<option value="${u}">${u}${u === 'Unidad' ? ' (Suelto)' : ''}</option>`).join('');
            receptionSelect.disabled = false;
            receptionSelect.style.background = '';

            if (purchaseUnit && units.includes(purchaseUnit)) {
                receptionSelect.value = purchaseUnit;
                if (lblQty) lblQty.textContent = `Cantidad recibida (${purchaseUnit})`;
            } else if (prod.presentationType && units.includes(prod.presentationType)) {
                receptionSelect.value = prod.presentationType;
                if (lblQty) lblQty.textContent = `Cantidad recibida`;
            } else {
                receptionSelect.value = "Unidad";
                if (lblQty) lblQty.textContent = `Cantidad recibida`;
            }

            itemQtyInput.value = '';
            itemTotalCostInput.value = '';
            itemModal.style.display = 'flex';
            setTimeout(() => itemQtyInput.focus(), 50);

            confirmItemBtn.onclick = () => {
                try {
                    const qty = parseNum(itemQtyInput.value);
                    const totalCost = parseNum(itemTotalCostInput.value);

                    if (!qty || qty <= 0) {
                        showToast("Por favor ingrese una cantidad válida.", "error");
                        return;
                    }
                    if (totalCost < 0) {
                        showToast("Por favor ingrese un costo válido.", "error");
                        return;
                    }

                    const stockQtyReceived = qty * purchaseToStockQty;
                    let costPerStockUnitUsd = 0;
                    let costPerStockUnitBs = 0;

                    if (currency === 'BS') {
                        costPerStockUnitBs = stockQtyReceived > 0 ? totalCost / stockQtyReceived : 0;
                        costPerStockUnitUsd = rate > 0 ? costPerStockUnitBs / rate : 0;
                    } else {
                        costPerStockUnitUsd = stockQtyReceived > 0 ? totalCost / stockQtyReceived : 0;
                        costPerStockUnitBs = costPerStockUnitUsd * rate;
                    }

                    const subTotalUsd = costPerStockUnitUsd * stockQtyReceived;
                    const subTotalBs = costPerStockUnitBs * stockQtyReceived;

                    const existingIndex = tempProducts.findIndex(p => p.id === prod.id);
                    const entry = {
                        id: prod.id,
                        name: prod.name,
                        stockUnit,
                        purchaseUnit,
                        purchaseToStockQty,
                        purchaseQty: qty,
                        qty: stockQtyReceived,
                        costPerStockUnitUsd,
                        costPerStockUnitBs,
                        costUsd: costPerStockUnitUsd,
                        costBs: costPerStockUnitBs,
                        subTotalUsd,
                        subTotalBs
                    };

                    if (existingIndex >= 0) {
                        if (confirm('Este producto ya está en la lista de recepción. ¿Desea reemplazarlo?')) {
                            tempProducts[existingIndex] = entry;
                        }
                    } else {
                        tempProducts.push(entry);
                    }

                    itemModal.style.display = 'none';
                    updateTempList();
                } catch (err) {
                    console.error("Error in handleConfirm:", err);
                    showToast("Error al procesar el item: " + err.message, "error");
                }
            };

            cancelItemBtn.onclick = () => {
                itemModal.style.display = 'none';
            };
        }

        function updateTempList() {
            tempTotalUsd = tempProducts.reduce((acc, p) => acc + (p.subTotalUsd || 0), 0);
            tempTotalBs = tempProducts.reduce((acc, p) => acc + (p.subTotalBs || 0), 0);

            pbTableBody.innerHTML = tempProducts.map((p, index) => {
                const costDisplay = (p.purchaseQty && p.purchaseQty > 0) ? (p.subTotalUsd / p.purchaseQty) : 0;
                return `
                <tr style="border-bottom: 1px solid var(--border);" data-index="${index}">
                    <td style="padding: 0.5rem; font-size: 0.9rem;">${p.name}</td>
                    <td style="padding: 0.5rem; font-size: 0.9rem;">
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <input type="text" inputmode="numeric" class="form-control edit-qty" value="${(p.purchaseQty || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" style="width: 80px; height: 30px; padding: 0.25rem; font-size: 0.85rem; text-align: center;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${p.purchaseUnit || 'ud'}</span>
                        </div>
                    </td>
                    <td style="padding: 0.5rem; font-size: 0.9rem; font-weight: 600; color: var(--text-muted);">
                        $ ${costDisplay.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </td>
                    <td style="padding: 0.5rem; font-size: 0.9rem;">
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <span style="font-size: 0.85rem; font-weight: bold; color: var(--primary);">$</span>
                            <input type="text" inputmode="numeric" class="form-control edit-subtotal" value="${(p.subTotalUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" style="width: 100px; height: 30px; padding: 0.25rem; font-size: 0.85rem; font-weight: bold; color: var(--primary);">
                        </div>
                    </td>
                    <td style="padding: 0.5rem; text-align: right;">
                        <button class="btn btn-outline" onclick="window.removeTempProduct(${index})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; border-color: var(--danger); color: var(--danger);" title="Eliminar">X</button>
                    </td>
                </tr>
                `;
            }).join('');

            pbTableBody.querySelectorAll('tr').forEach(tr => {
                const index = parseInt(tr.dataset.index);
                const p = tempProducts[index];
                if (!p) return;

                const qtyInp = tr.querySelector('.edit-qty');
                const subInp = tr.querySelector('.edit-subtotal');

                const syncData = () => {
                    const newQty = parseNum(qtyInp.value);
                    const newSub = parseNum(subInp.value);
                    
                    p.purchaseQty = newQty;
                    p.qty = newQty * (p.purchaseToStockQty || 1);
                    p.subTotalUsd = newSub;
                    p.subTotalBs = newSub * rate;
                    
                    if (p.qty > 0) {
                        p.costPerStockUnitUsd = p.subTotalUsd / p.qty;
                        p.costPerStockUnitBs = p.subTotalBs / p.qty;
                        p.costUsd = p.costPerStockUnitUsd;
                        p.costBs = p.costPerStockUnitBs;
                    }

                    tempTotalUsd = tempProducts.reduce((acc, prod) => acc + (prod.subTotalUsd || 0), 0);
                    tempTotalBs = tempProducts.reduce((acc, prod) => acc + (prod.subTotalBs || 0), 0);
                    pbItemsDisplay.textContent = tempProducts.length;
                    pbTotalBsDisplay.textContent = `Bs. ${tempTotalBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    pbTotalUsdDisplay.textContent = `$ ${tempTotalUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    
                    const currentCost = p.purchaseQty > 0 ? (p.subTotalUsd / p.purchaseQty) : 0;
                    tr.children[2].textContent = `$ ${currentCost.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                };

                applyNumericMask(qtyInp, syncData);
                applyNumericMask(subInp, syncData);
            });

            pbItemsDisplay.textContent = tempProducts.length;
            pbTotalBsDisplay.textContent = `Bs. ${tempTotalBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            pbTotalUsdDisplay.textContent = `$ ${tempTotalUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        window.editTempProduct = (index) => {
            const p = tempProducts[index];
            handleProductSelect(p.id); // Re-run the prompt logic which replaces the item
        };

        window.removeTempProduct = (index) => {
            tempProducts.splice(index, 1);
            updateTempList();
        };

        // Events
        pbSearch.addEventListener('input', (e) => renderCatalog(e.target.value));
        
        modal.querySelector('#pbCreateProductBtn').addEventListener('click', () => {
            // Save state to window
            window.tempPurchaseState = {
                supplierId: pSupplier.value,
                bcvRate: pBcvRate.value,
                emissionDate: pEmissionDate.value,
                receptionDate: pReceptionDate.value,
                docType: pDocType.value,
                docNumber: pDocNumber.value,
                status: pStatus.value,
                currency: pCurrency.value,
                paymentDate: pPaymentDate.value,
                paymentMethod: pPaymentMethod.value,
                receivedBs: pReceivedBs.value,
                receivedUsd: pReceivedUsd.value,
                products: tempProducts,
                openProductBuilder: true
            };
            window.openCreateProductForPurchase = true;
            document.getElementById('navProductos').click();
        });

        modal.querySelector('#pbCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.querySelector('#pbProcessBtn').addEventListener('click', () => {
            // Pasamos los datos temporales a las variables de estado del formulario principal
            // Inyectando las variables del scope padre no funcionará directamente porque estamos separando funciones,
            // pero podemos retornar y disparar el callback.
            const customEvent = new CustomEvent('productsProcessed', {
                detail: { products: tempProducts, totalUsd: tempTotalUsd, totalBs: tempTotalBs }
            });
            container.dispatchEvent(customEvent);
            modal.style.display = 'none';
        });

        renderCatalog();
        updateTempList();

        if (window.autoOpenProductId) {
            const prodId = window.autoOpenProductId;
            delete window.autoOpenProductId;
            // Esperar un momento a que el DOM del catálogo esté listo
            setTimeout(() => handleProductSelect(prodId), 100);
        }
    }

    async function renderDetail(purchase) {
        const businessId = localStorage.getItem('businessId');
        let payments = [];
        try {
            const paySnap = await getDocs(collection(db, "businesses", businessId, "purchases", purchase.id, "payments"));
            payments = paySnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(a.date) - new Date(b.date));
        } catch (e) {
            console.error("Error fetching payments for " + purchase.id + ":", e);
        }

        // Fallback para pagos registrados antes de la sub-colección o si falló la carga
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

        const supObj = suppliers.find(s => s.id === purchase.supplierId);
        const supName = supObj ? supObj.name : 'Proveedor Desconocido';
        
        let badgeColor = 'var(--text-muted)';
        if (purchase.status === 'CREDITO') badgeColor = 'var(--danger)';
        if (purchase.status === 'PAGADO' || purchase.status === 'CONTADO') badgeColor = 'var(--success)';
        if (purchase.status === 'ABONO') badgeColor = 'var(--warning)';

        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                <button class="btn btn-outline" id="backToDeckBtn" style="width: auto; padding: 0.5rem 1rem;">← Atrás</button>
                <h2>Detalle de Compra</h2>
            </div>
            
            <div class="card mb-4" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1rem;">
                    <div>
                        <h3 style="color: var(--primary); margin-bottom: 0.25rem;">${supName}</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">Tasa Factura: Bs. ${purchase.bcvRate} | Creado por: ${purchase.createdBy}</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: inline-block; padding: 0.3rem 0.6rem; border-radius: 12px; background: ${badgeColor}20; color: ${badgeColor}; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.5rem;">
                            ESTADO: ${purchase.status}
                        </span>
                        <p style="font-weight: bold; font-size: 1.1rem;">${purchase.docType} N° ${purchase.docNumber}</p>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha Emisión</p>
                        <p style="font-weight: 500;">${purchase.emissionDate}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha Recepción</p>
                        <p style="font-weight: 500;">${purchase.receptionDate}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Moneda Original</p>
                        <p style="font-weight: 500;">${purchase.currency === 'BS' ? 'BOLÍVARES' : 'DÓLARES'}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Total Items</p>
                        <p style="font-weight: 500;">${purchase.itemsCount || 0}</p>
                    </div>
                </div>
            </div>

            <div class="card mb-4" style="padding: 1.5rem;">
                <h4 style="margin-bottom: 1rem;">Productos Recibidos</h4>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <th style="padding: 0.5rem;">Producto</th>
                                <th style="padding: 0.5rem;">Cant.</th>
                                <th style="padding: 0.5rem;">Costo $</th>
                                <th style="padding: 0.5rem;">Costo Bs</th>
                                <th style="padding: 0.5rem;">SubTotal $</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${purchase.products.map(p => `
                                <tr>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${p.name}</td>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${p.qty} ${p.unit || 'ud'}</td>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">$ ${p.costUsd.toLocaleString('de-DE', {minimumFractionDigits: 4})}</td>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">Bs. ${p.costBs.toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid var(--border); font-weight: bold; color: var(--primary);">$ ${p.subTotalUsd.toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 1.5rem; align-items: stretch;">
                <!-- Historial de Pagos (Izquierda) -->
                <div class="card" style="padding: 1.5rem; background: var(--background);">
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
                                        <th style="padding: 0.5rem; text-align: right;">Abono $</th>
                                        <th style="padding: 0.5rem; text-align: right;">Equiv. $</th>
                                        <th style="padding: 0.5rem; text-align: right;"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(p => {
                                        const amtBs = p.amountBs || (p.id === 'legacy' ? (purchase.receivedBs || 0) : 0);
                                        const amtUsd = p.amountUsd || (p.id === 'legacy' ? (purchase.receivedUsd || 0) : 0);
                                        return `
                                        <tr style="border-bottom: 1px solid var(--border);">
                                            <td style="padding: 0.5rem;">${p.date}</td>
                                            <td style="padding: 0.5rem;">${p.method}</td>
                                            <td style="padding: 0.5rem;"><small>${p.reference || '-'}</small></td>
                                            <td style="padding: 0.5rem; text-align: right;">${amtBs > 0 ? `Bs. ${amtBs.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}</td>
                                            <td style="padding: 0.5rem; text-align: right;">${amtUsd > 0 ? `$ ${amtUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}</td>
                                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: var(--success);">$ ${(p.equivalentUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            <td style="padding: 0.5rem; text-align: right;">
                                                <button class="delete-pay-btn" data-id="${p.id}" data-amount="${p.equivalentUsd}" style="background: none; border: none; color: var(--danger); cursor: pointer; font-weight: bold; font-size: 1.2rem;">×</button>
                                            </td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted">No se registraron pagos para esta factura.</p>'}
                </div>

                <!-- Totales (Derecha) -->
                <div class="card" style="padding: 1.5rem; display: flex; flex-direction: column; justify-content: center;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 1rem;">
                        <span style="color: var(--text-muted);">Total Facturado:</span>
                        <strong>$ ${(purchase.totalUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
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
            </div>
        `;

        container.innerHTML = html;
        container.querySelector('#backToDeckBtn').addEventListener('click', renderDeck);

        container.querySelectorAll('.delete-pay-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Está seguro de eliminar este pago? El saldo de la factura y la deuda del proveedor se actualizarán.')) return;
                
                const payId = btn.dataset.id;
                const amount = parseFloat(btn.dataset.amount);
                const businessId = localStorage.getItem('businessId');

                try {
                    // 1. Eliminar de la sub-colección (si no es virtual/legacy)
                    if (payId !== 'legacy') {
                        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js");
                        await deleteDoc(doc(db, "businesses", businessId, "purchases", purchase.id, "payments", payId));
                    }

                    // 2. Revertir montos en la compra
                    const newPending = purchase.pendingBalanceUsd + amount;
                    const updatedPurchase = {
                        receivedUsd: Math.max(0, (purchase.receivedUsd || 0) - amount),
                        receivedBs: Math.max(0, (purchase.receivedBs || 0) - (amount * (purchase.bcvRate || 1))),
                        pendingBalanceUsd: newPending,
                        status: newPending >= (purchase.totalUsd - 0.01) ? 'CREDITO' : 'ABONO'
                    };
                    
                    // Si eliminamos el último pago y era legacy, limpiamos los campos del doc principal
                    if (payId === 'legacy') {
                        updatedPurchase.paymentDate = null;
                        updatedPurchase.paymentMethod = null;
                        updatedPurchase.reference = null;
                        updatedPurchase.equivalentUsd = 0;
                        updatedPurchase.receivedUsd = 0;
                        updatedPurchase.receivedBs = 0;
                        updatedPurchase.pendingBalanceUsd = purchase.totalUsd;
                    }

                    await updateDoc(doc(db, "businesses", businessId, "purchases", purchase.id), updatedPurchase);

                    // 3. Revertir deuda en el proveedor
                    const supRef = doc(db, "businesses", businessId, "suppliers", purchase.supplierId);
                    const supSnap = await getDoc(supRef);
                    if (supSnap.exists()) {
                        const currentDebt = supSnap.data().debt || 0;
                        await updateDoc(supRef, { debt: currentDebt + amount });
                    }

                    showToast("Pago eliminado y saldos revertidos", "success");
                    await loadData();
                    const freshPurchase = purchases.find(p => p.id === purchase.id);
                    if (freshPurchase) renderDetail(freshPurchase);
                    else renderDeck();
                } catch (err) {
                    console.error("Error eliminando pago:", err);
                    showToast("Error al revertir pago", "error");
                }
            });
        });
    }

    loadData();
    return container;
}
