import { db } from '../services/firebase.js';
import { showConfirmModal, formatDateToDDMMYYYY } from '../utils.js';
import { collection, getDocs, getDoc, setDoc, doc, updateDoc, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// --- Helpers Globales ---
const parseNum = (val) => {
    if (!val) return 0;
    const str = val.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(str) || 0;
};

const fmtNum = (n) => {
    return parseFloat(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function applyNumericMask(input, callback, decimals = 2) {
    if (!input) return;
    
    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); 
        if (!value) { 
            e.target.value = ''; 
            if (callback) callback(); 
            return; 
        }
        let number = parseInt(value, 10);
        let divisor = Math.pow(10, decimals);
        e.target.value = (number / divisor).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        if (callback) callback();
    });

    input.addEventListener('focus', (e) => { 
        let zeroStr = (0).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        if (e.target.value === zeroStr) {
            e.target.value = ''; 
        }
    });

    input.addEventListener('blur', (e) => { 
        if (!e.target.value) { 
            e.target.value = (0).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); 
        }
        if (callback) callback();
    });
}

export function renderPurchases(container) {
    if (!container) {
        container = document.createElement('div');
        container.className = 'view-container';
    }
    let purchases = [];
    let suppliers = [];
    let creditors = [];
    let products = [];
    let expenseTemplates = [];
    let equipmentList = [];
    let bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 0;
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

            const [supSnap, credSnap, tempSnap, eqSnap, prodSnap, purSnap] = await Promise.all([
                getDocs(collection(db, "businesses", businessId, "suppliers")),
                getDocs(collection(db, "businesses", businessId, "creditors")),
                getDocs(collection(db, "businesses", businessId, "expense_templates")),
                getDocs(collection(db, "businesses", businessId, "equipment")),
                getDocs(collection(db, "businesses", businessId, "products")),
                getDocs(collection(db, "businesses", businessId, "purchases"))
            ]);

            suppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            creditors = credSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            expenseTemplates = tempSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            equipmentList = eqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            purchases = purSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (window.openCreatePurchase) {
                delete window.openCreatePurchase;
                setTimeout(() => {
                    if (window.tempPurchaseState) {
                        renderForm(window.tempPurchaseState.purchaseType || 'PRODUCTO');
                    } else {
                        renderTypeSelector();
                    }
                }, 100);
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
    let currentFilterType = 'TODOS';
    
    // Rango de fechas por defecto: últimos 7 días
    const initialEndDateObj = new Date();
    const initialStartDateObj = new Date();
    initialStartDateObj.setDate(initialEndDateObj.getDate() - 7);
    let currentFilterStartDate = initialStartDateObj.toISOString().split('T')[0];
    let currentFilterEndDate = initialEndDateObj.toISOString().split('T')[0];
    
    let currentView = 'deck';

    function goBackToDeck() {
        if (currentView === 'history') {
            renderHistoryDeck();
        } else {
            renderDeck();
        }
    }

    function renderDeck() {
        currentView = 'deck';
        let filteredPurchases = purchases;
        if (currentFilterType !== 'TODOS') {
            filteredPurchases = filteredPurchases.filter(p => p.purchaseType === currentFilterType);
        }
        if (currentFilterSupplier) filteredPurchases = filteredPurchases.filter(p => (p.supplierId === currentFilterSupplier || p.creditorId === currentFilterSupplier));
        if (currentFilterStatus) filteredPurchases = filteredPurchases.filter(p => p.status === currentFilterStatus);

        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">🧾 Cuentas por Pagar</h2>
                <div style="display: flex; gap: 0.75rem; align-items: center; margin-left: auto;" class="flex-stack-mobile">
                    <select id="filterType" class="form-control filter-dropdown">
                        <option value="TODOS" ${currentFilterType === 'TODOS' ? 'selected' : ''}>Todas las Compras</option>
                        <option value="PRODUCTO" ${currentFilterType === 'PRODUCTO' ? 'selected' : ''}>Insumos / Productos</option>
                        <option value="EQUIPO_UTENSILIO" ${currentFilterType === 'EQUIPO_UTENSILIO' ? 'selected' : ''}>Equipos</option>
                        <option value="GASTO_SERVICIO" ${currentFilterType === 'GASTO_SERVICIO' ? 'selected' : ''}>Gastos y Servicios</option>
                    </select>
                    <select id="filterSupplier" class="form-control filter-dropdown ts-filter">
                        <option value="">Todos los Proveedores</option>
                        ${[...suppliers].sort((a,b)=>a.name.localeCompare(b.name)).map(s => `<option value="${s.id}" ${currentFilterSupplier === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                    <select id="filterStatus" class="form-control filter-dropdown">
                        <option value="">Todos los Estados</option>
                        <option value="CREDITO" ${currentFilterStatus === 'CREDITO' ? 'selected' : ''}>A CRÉDITO</option>
                        <option value="ABONO" ${currentFilterStatus === 'ABONO' ? 'selected' : ''}>ABONO</option>
                        <option value="PAGADO" ${currentFilterStatus === 'PAGADO' ? 'selected' : ''}>PAGADO</option>
                        <option value="CONTADO" ${currentFilterStatus === 'CONTADO' ? 'selected' : ''}>CONTADO</option>
                    </select>
                    ${role !== 'employee' ? `
                    <button class="btn btn-primary" id="historyPurchaseBtn" style="width: auto; padding: 0 1rem; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;">📜 Historial</button>
                    <button class="btn btn-primary" id="addPurchaseBtn" style="width: auto; padding: 0 1rem; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;">+ Cargar Compra</button>
                    ` : ''}
                </div>
            </div>
            
            ${currentFilterType === 'EQUIPO_UTENSILIO' ? `
            <div style="margin-bottom: 1.5rem; display: flex; justify-content: flex-end;">
                <button class="btn btn-secondary" id="viewEquipmentBtn" style="padding: 0.5rem 1rem; border-radius: 8px; font-weight: bold; background: var(--surface); color: var(--primary); border: 2px solid var(--primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span>📋</span> Ver Inventario de Equipos
                </button>
            </div>
            ` : ''}
        `;

        // Banner de Compra Pausada
        const pausedStr = localStorage.getItem('pausedPurchaseState');
        if (pausedStr) {
            html += `
                <div style="display: flex; margin-bottom: 1.5rem;">
                    <div class="card" style="padding: 1rem; border-left: 4px solid var(--info, #3b82f6); background: var(--surface); width: 100%; max-width: 350px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 style="margin: 0 0 0.25rem 0; font-size: 0.9rem; font-weight: 800; color: var(--info, #3b82f6);">⏸️ Compra en Progreso</h3>
                            <p style="margin: 0 0 0.75rem 0; font-size: 0.75rem; color: var(--text-muted);">Tienes una compra que pusiste en espera.</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-sm" id="resumePausedBtn" style="flex: 1; padding: 0.4rem; font-size: 0.75rem; font-weight: 700; background: var(--info, #3b82f6); color: white; border: none; border-radius: 8px;">Recuperar</button>
                            <button class="btn btn-sm btn-outline" id="discardPausedBtn" style="flex: 1; padding: 0.4rem; font-size: 0.75rem; border-color: var(--danger); color: var(--danger); border-radius: 8px;">Descartar</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Banner de Gastos Recurrentes
        const today = new Date();
        const upcomingTemplates = expenseTemplates.filter(t => {
            if (!t.nextDueDate) return false;
            const dueDate = new Date(t.nextDueDate);
            const diffTime = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffTime <= 7; // Muestra si vence en 7 días o ya está vencido
        });

        if (upcomingTemplates.length > 0) {
            html += `
                <div style="background: var(--warning); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; color: #fff;">
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem; font-weight: 800;">🔔 Recordatorio de Gastos</h3>
                    <p style="margin: 0 0 1rem 0; font-size: 0.85rem; opacity: 0.9;">Tienes ${upcomingTemplates.length} gasto(s) recurrente(s) próximo(s) a vencer o vencido(s).</p>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            `;
            upcomingTemplates.forEach(t => {
                const cred = creditors.find(c => c.id === t.creditorId);
                const credName = cred ? cred.name : 'Acreedor Desconocido';
                html += `
                    <button class="btn template-btn" data-id="${t.id}" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 0.75rem; padding: 0.5rem 1rem; border-radius: 8px;">
                        Pagar: ${t.description} (${credName})
                    </button>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }

        // --- SECTION: Category Totals ---
        let insumosTotal = 0;
        let insumosCount = 0;
        let gastosTotal = 0;
        let gastosCount = 0;
        let equiposTotal = 0;
        let equiposCount = 0;

        filteredPurchases.forEach(p => {
            if (p.status === 'CREDITO' || p.status === 'ABONO' || p.status === 'PENDIENTE') {
                const debt = parseFloat(p.pendingBalanceUsd || 0);
                if (p.purchaseType === 'PRODUCTO') {
                    insumosTotal += debt;
                    insumosCount++;
                } else if (p.purchaseType === 'GASTO_SERVICIO') {
                    gastosTotal += debt;
                    gastosCount++;
                } else if (p.purchaseType === 'EQUIPO_UTENSILIO') {
                    equiposTotal += debt;
                    equiposCount++;
                }
            }
        });

        html += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="padding: 1.5rem; background: var(--surface); border-left: 4px solid var(--danger);">
                    <div style="display: flex; justify-content: space-between; align-items: center;" class="flex-stack-mobile">
                        <div>
                            <p class="text-sm text-muted">Insumos / Productos</p>
                            <h3 style="font-size: 1.75rem; color: var(--danger);">$ ${insumosTotal.toLocaleString('de-DE', {minimumFractionDigits: 2})}</h3>
                        </div>
                        <div style="text-align: right;" class="text-left-mobile">
                            <p class="text-sm text-muted">Facturas por Pagar</p>
                            <p style="font-size: 1.25rem; font-weight: bold;">${insumosCount} doc(s)</p>
                        </div>
                    </div>
                </div>
                <div class="card" style="padding: 1.5rem; background: var(--surface); border-left: 4px solid var(--danger);">
                    <div style="display: flex; justify-content: space-between; align-items: center;" class="flex-stack-mobile">
                        <div>
                            <p class="text-sm text-muted">Gastos y Servicios</p>
                            <h3 style="font-size: 1.75rem; color: var(--danger);">$ ${gastosTotal.toLocaleString('de-DE', {minimumFractionDigits: 2})}</h3>
                        </div>
                        <div style="text-align: right;" class="text-left-mobile">
                            <p class="text-sm text-muted">Facturas por Pagar</p>
                            <p style="font-size: 1.25rem; font-weight: bold;">${gastosCount} doc(s)</p>
                        </div>
                    </div>
                </div>
                <div class="card" style="padding: 1.5rem; background: var(--surface); border-left: 4px solid var(--danger);">
                    <div style="display: flex; justify-content: space-between; align-items: center;" class="flex-stack-mobile">
                        <div>
                            <p class="text-sm text-muted">Equipos</p>
                            <h3 style="font-size: 1.75rem; color: var(--danger);">$ ${equiposTotal.toLocaleString('de-DE', {minimumFractionDigits: 2})}</h3>
                        </div>
                        <div style="text-align: right;" class="text-left-mobile">
                            <p class="text-sm text-muted">Facturas por Pagar</p>
                            <p style="font-size: 1.25rem; font-weight: bold;">${equiposCount} doc(s)</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Group debt by entity (supplier or creditor) based on filtered results
        const entityDebt = {};
        suppliers.forEach(s => {
            entityDebt[s.id] = { id: s.id, name: s.name, debt: 0, invoices: 0 };
        });
        creditors.forEach(c => {
            entityDebt[c.id] = { id: c.id, name: c.name, debt: 0, invoices: 0 };
        });

        filteredPurchases.forEach(p => {
            const entId = p.purchaseType === 'GASTO_SERVICIO' ? p.creditorId : p.supplierId;
            if (entId) {
                if (!entityDebt[entId]) {
                    entityDebt[entId] = { id: entId, name: 'Desconocido', debt: 0, invoices: 0 };
                }
                if (p.status === 'CREDITO' || p.status === 'ABONO' || p.status === 'PENDIENTE') {
                    entityDebt[entId].debt += parseFloat(p.pendingBalanceUsd || 0);
                    entityDebt[entId].invoices++;
                }
            }
        });

        // Filtrar entidades que realmente tienen deuda activa (> 0)
        const activeEntities = Object.values(entityDebt).filter(s => s.debt > 0.01);

        if (activeEntities.length === 0) {
            html += `<div style="padding: 3rem; text-align: center; background: var(--surface); border-radius: 8px; border: 1px solid var(--border);">
                <p style="color: var(--text-muted); font-size: 1.1rem;">No hay registros que coincidan con los filtros.</p>
            </div>`;
        } else {
            html += `<div style="max-height: 500px; overflow-y: auto; padding-right: 0.5rem; margin-bottom: 2rem;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem;">`;
            
            activeEntities.forEach(sup => {
                html += `
                    <div class="card supplier-debt-card" data-id="${sup.id}" style="cursor: pointer; padding: 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); transition: transform 0.2s; border-left: 4px solid var(--danger);">
                        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--danger); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${sup.name}">${sup.name}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">💰 Deuda: <span style="color: var(--danger); font-weight: bold;">$ ${sup.debt.toFixed(2)}</span></p>
                        <p style="font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📄 Facturas: ${sup.invoices}</p>
                    </div>
                `;
            });

            html += `   </div>
                     </div>`;
        }

        container.innerHTML = html;

        if (typeof TomSelect !== 'undefined') {
            const filterSupEl = container.querySelector('#filterSupplier');
            if (filterSupEl) {
                new TomSelect(filterSupEl, { create: false, placeholder: "Todos los Proveedores" });
            }
        }

        // Listeners Filtros
        const filterSup = container.querySelector('#filterSupplier');
        const filterSta = container.querySelector('#filterStatus');
        const filterTyp = container.querySelector('#filterType');

        filterSup.addEventListener('change', () => {
            currentFilterSupplier = filterSup.value;
            renderDeck();
        });
        filterSta.addEventListener('change', () => {
            currentFilterStatus = filterSta.value;
            renderDeck();
        });
        filterTyp.addEventListener('change', () => {
            currentFilterType = filterTyp.value;
            renderDeck();
        });

        const historyPurchaseBtn = document.getElementById('historyPurchaseBtn');
        if (historyPurchaseBtn) {
            historyPurchaseBtn.addEventListener('click', () => {
                renderHistoryDeck();
            });
        }

        container.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const templateId = e.currentTarget.dataset.id;
                const template = expenseTemplates.find(t => t.id === templateId);
                if (template) {
                    renderForm('GASTO_SERVICIO', {
                        templateId: template.id,
                        creditorId: template.creditorId,
                        categoryId: template.categoryId,
                        description: template.description,
                        recurrenceType: template.recurrenceType,
                        amountUsd: template.amountUsd
                    });
                }
            });
        });

        const resumePausedBtn = container.querySelector('#resumePausedBtn');
        if (resumePausedBtn) {
            resumePausedBtn.addEventListener('click', () => {
                const dataStr = localStorage.getItem('pausedPurchaseState');
                if (dataStr) {
                    try {
                        const data = JSON.parse(dataStr);
                        localStorage.removeItem('pausedPurchaseState');
                        window.tempPurchaseState = data;
                        renderForm(data.purchaseType || 'PRODUCTO');
                    } catch (e) {
                        console.error('Error parsing paused state', e);
                    }
                }
            });
        }

        const discardPausedBtn = container.querySelector('#discardPausedBtn');
        if (discardPausedBtn) {
            discardPausedBtn.addEventListener('click', () => {
                localStorage.removeItem('pausedPurchaseState');
                renderDeck();
            });
        }

        const addBtn = container.querySelector('#addPurchaseBtn');
        if (addBtn) addBtn.addEventListener('click', () => renderTypeSelector());
        
        const viewEqBtn = container.querySelector('#viewEquipmentBtn');
        if (viewEqBtn) {
            viewEqBtn.addEventListener('click', () => {
                renderEquipmentInventory();
            });
        }
        
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

        container.querySelectorAll('.supplier-debt-card').forEach(card => {
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
            card.addEventListener('click', () => {
                renderSupplierDetail(card.dataset.id);
            });
        });
    }

    function renderHistoryDeck() {
        currentView = 'history';
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToPurchasesBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">📜 Historial de Compras</h2>
            </div>
            
            <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <label style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Desde:</label>
                    <input type="date" id="filterStartDate" class="form-control" style="width: auto; height: 35px; font-size: 0.85rem; border-radius: 8px;" value="${currentFilterStartDate}">
                    <label style="font-size: 0.85rem; color: var(--text-muted); margin: 0; margin-left: 0.5rem;">Hasta:</label>
                    <input type="date" id="filterEndDate" class="form-control" style="width: auto; height: 35px; font-size: 0.85rem; border-radius: 8px;" value="${currentFilterEndDate}">
                </div>
            </div>

            <div class="card" style="padding: 0; overflow-x: auto; max-height: calc(100vh - 250px); overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead style="position: sticky; top: 0; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <tr style="background-color: var(--background); border-bottom: 1px solid var(--border);">
                            <th style="padding: 1rem;">Fecha</th>
                            <th style="padding: 1rem;">Días</th>
                            <th style="padding: 1rem;">Documento</th>
                            <th style="padding: 1rem;">Número</th>
                            <th style="padding: 1rem;">Proveedor</th>
                            <th style="padding: 1rem;">Estado</th>
                            <th style="padding: 1rem;">Total $</th>
                            <th style="padding: 1rem;">Deuda $</th>
                            <th style="padding: 1rem; text-align: center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        let tablePurchases = purchases;
        if (currentFilterStartDate) {
            tablePurchases = tablePurchases.filter(p => {
                const pDate = p.receptionDate || p.emissionDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
                return pDate >= currentFilterStartDate;
            });
        }
        if (currentFilterEndDate) {
            tablePurchases = tablePurchases.filter(p => {
                const pDate = p.receptionDate || p.emissionDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
                return pDate <= currentFilterEndDate;
            });
        }

        if (tablePurchases.length === 0) {
            html += `<tr><td colspan="9" style="padding: 2rem; text-align: center; color: var(--text-muted);">No se encontraron compras con los filtros seleccionados.</td></tr>`;
        } else {
            // Sort by receptionDate asc (oldest to newest)
            [...tablePurchases].sort((a, b) => new Date(b.receptionDate || b.createdAt) - new Date(a.receptionDate || a.createdAt)).forEach(p => {
                let supName = 'Desconocido';
                if (p.purchaseType === 'GASTO_SERVICIO') {
                    const credObj = creditors.find(c => c.id === p.creditorId);
                    if (credObj) supName = credObj.name;
                } else {
                    const supObj = suppliers.find(s => s.id === p.supplierId);
                    if (supObj) supName = supObj.name;
                }
                
                let badgeColor = 'var(--text-muted)';
                if (p.status === 'CREDITO' || p.status === 'PENDIENTE') badgeColor = 'var(--danger)';
                if (p.status === 'PAGADO' || p.status === 'CONTADO') badgeColor = 'var(--success)';
                if (p.status === 'ABONO') badgeColor = 'var(--warning)';

                const rDate = new Date(p.receptionDate || p.emissionDate || p.createdAt);
                const diffTime = new Date() - rDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const displayDays = diffDays >= 0 ? diffDays : 0;

                html += `
                    <tr class="purchase-row" data-id="${p.id}" style="border-bottom: 1px solid var(--border); transition: background 0.2s;">
                        <td style="padding: 1rem;">${formatDateToDDMMYYYY(p.receptionDate || p.emissionDate)}</td>
                        <td style="padding: 1rem;"><span style="color: var(--text-muted); font-size: 0.85rem;">${displayDays}</span></td>
                        <td style="padding: 1rem;"><strong>${p.docType}</strong></td>
                        <td style="padding: 1rem;"><span style="color: var(--text-muted); font-size: 0.85rem;">${p.docNumber}</span></td>
                        <td style="padding: 1rem;">${supName}</td>
                        <td style="padding: 1rem;">
                            <span style="padding: 0.2rem 0.5rem; border-radius: 12px; background: ${badgeColor}20; color: ${badgeColor}; font-weight: bold; font-size: 0.75rem;">
                                ${p.status}
                            </span>
                        </td>
                        <td style="padding: 1rem; font-weight: bold;">$ ${parseFloat(p.totalUsd || p.totalAmount || p.total || 0).toFixed(2)}</td>
                        <td style="padding: 1rem; color: ${p.pendingBalanceUsd > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">
                            $ ${parseFloat(p.pendingBalanceUsd || 0).toFixed(2)}
                        </td>
                        <td style="padding: 1rem;">
                            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                                <button class="btn btn-outline edit-metadata-btn" data-id="${p.id}" style="padding: 0 0.5rem; width: auto; height: 32px; display: flex; gap: 0.25rem; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; border-color: var(--warning); color: var(--warning);" title="Editar datos">✏️ Editar</button>
                                <button class="btn btn-outline delete-purchase-btn" data-id="${p.id}" style="padding: 0 0.5rem; width: auto; height: 32px; display: flex; gap: 0.25rem; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; border-color: var(--danger); color: var(--danger);" title="Eliminar Compra">🗑️ Eliminar</button>
                            </div>
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

        const backBtn = container.querySelector('#backToPurchasesBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                renderDeck();
            });
        }

        const filterStart = container.querySelector('#filterStartDate');
        const filterEnd = container.querySelector('#filterEndDate');
        
        if (typeof flatpickr !== 'undefined') {
            const fpConfig = { locale: "es", altInput: true, altFormat: "d/m/Y", dateFormat: "Y-m-d", altInputClass: "form-control" };
            if (filterStart) {
                const fp1 = flatpickr(filterStart, fpConfig);
                if (fp1.altInput) fp1.altInput.style.cssText = filterStart.style.cssText;
            }
            if (filterEnd) {
                const fp2 = flatpickr(filterEnd, fpConfig);
                if (fp2.altInput) fp2.altInput.style.cssText = filterEnd.style.cssText;
            }
        }
        if (filterStart) {
            filterStart.addEventListener('change', () => {
                currentFilterStartDate = filterStart.value;
                renderHistoryDeck();
            });
        }
        if (filterEnd) {
            filterEnd.addEventListener('change', () => {
                currentFilterEndDate = filterEnd.value;
                renderHistoryDeck();
            });
        }
        
        container.querySelectorAll('.purchase-row').forEach(row => {
            row.addEventListener('mouseover', () => row.style.backgroundColor = 'var(--background)');
            row.addEventListener('mouseout', () => row.style.backgroundColor = 'transparent');
            row.addEventListener('click', (e) => {
                if (e.target.closest('.edit-metadata-btn') || e.target.closest('.delete-purchase-btn')) return;
                const purchase = purchases.find(p => p.id === row.dataset.id);
                if (purchase) renderDetail(purchase);
            });
        });

        container.querySelectorAll('.edit-metadata-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const purchase = purchases.find(p => p.id === e.currentTarget.dataset.id);
                if (purchase) renderEditMetadataForm(purchase);
            });
        });

        container.querySelectorAll('.delete-purchase-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const purchaseId = e.currentTarget.dataset.id;
                showConfirmModal(
                    'Eliminar Compra',
                    '¿Estás seguro de que deseas eliminar esta compra? (Esta acción es temporal y no revertirá el inventario)',
                    async () => {
                        try {
                            const businessId = localStorage.getItem('businessId');
                            await deleteDoc(doc(db, "businesses", businessId, "purchases", purchaseId));
                            showToast('Compra eliminada exitosamente', 'success');
                            await loadData();
                            renderHistoryDeck();
                        } catch (err) {
                            console.error('Error deleting purchase:', err);
                            showToast('Error al eliminar la compra', 'error');
                        }
                    },
                    'Sí, Eliminar',
                    'Cancelar',
                    '🗑️'
                );
            });
        });
    }

    function renderEditMetadataForm(purchase) {
        currentView = 'editMetadata';
        const supList = purchase.purchaseType === 'GASTO_SERVICIO' ? creditors : suppliers;
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDeckBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--warning); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">✏️ Editar Factura</h2>
            </div>

            <div class="card" style="max-width: 500px; margin: 0 auto; padding: 2rem; border-top: 4px solid var(--warning);">
                <form id="editMetadataForm">
                    <div style="display: flex; gap: 1rem;">
                        <div class="form-group" style="flex: 1;">
                            <label>Fecha Emisión <span class="text-danger">*</span></label>
                            <input type="date" id="eEmissionDate" class="form-control" required value="${purchase.emissionDate}">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label>Fecha Recepción</label>
                            <input type="date" id="eReceptionDate" class="form-control" value="${purchase.receptionDate || ''}">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Documento <span class="text-danger">*</span></label>
                        <select id="eDocType" class="form-control" required>
                            <option value="FACTURA" ${purchase.docType === 'FACTURA' ? 'selected' : ''}>FACTURA</option>
                            <option value="NOTA DE ENTREGA" ${purchase.docType === 'NOTA DE ENTREGA' ? 'selected' : ''}>NOTA DE ENTREGA</option>
                            <option value="PRESUPUESTO" ${purchase.docType === 'PRESUPUESTO' ? 'selected' : ''}>PRESUPUESTO</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Número de Documento <span class="text-danger">*</span></label>
                        <input type="text" id="eDocNumber" class="form-control" required value="${purchase.docNumber}">
                    </div>

                    <div class="form-group">
                        <label>Proveedor <span class="text-danger">*</span></label>
                        <select id="eEntity" class="form-control" required>
                            ${supList.map(s => `<option value="${s.id}" ${(purchase.supplierId === s.id || purchase.creditorId === s.id) ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                        <button type="button" class="btn btn-outline" id="cancelEditBtn" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="saveEditBtn" style="flex: 1; background: var(--warning); border-color: var(--warning);">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        `;
        container.innerHTML = html;

        if (typeof flatpickr !== 'undefined') {
            const fpConfig = {
                locale: "es",
                altInput: true,
                altFormat: "d/m/Y",
                dateFormat: "Y-m-d"
            };
            const eEmission = container.querySelector('#eEmissionDate');
            const eReception = container.querySelector('#eReceptionDate');
            flatpickr(eEmission, fpConfig);
            const fpReception = flatpickr(eReception, fpConfig);
            
            if (eEmission && eReception) {
                fpReception.set('minDate', eEmission.value);
                eEmission.addEventListener('change', () => {
                    if (eReception.value < eEmission.value) {
                        fpReception.setDate(eEmission.value);
                    }
                    fpReception.set('minDate', eEmission.value);
                });
            }
        }

        container.querySelector('#backToDeckBtn').addEventListener('click', goBackToDeck);
        container.querySelector('#cancelEditBtn').addEventListener('click', goBackToDeck);

        container.querySelector('#editMetadataForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#saveEditBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            try {
                const businessId = localStorage.getItem('businessId');
                const updateData = {
                    emissionDate: container.querySelector('#eEmissionDate').value,
                    receptionDate: container.querySelector('#eReceptionDate').value,
                    docType: container.querySelector('#eDocType').value,
                    docNumber: container.querySelector('#eDocNumber').value,
                    updatedAt: new Date().toISOString()
                };

                const entityId = container.querySelector('#eEntity').value;
                if (purchase.purchaseType === 'GASTO_SERVICIO') {
                    updateData.creditorId = entityId;
                } else {
                    updateData.supplierId = entityId;
                }

                await updateDoc(doc(db, "businesses", businessId, "purchases", purchase.id), updateData);
                showToast('Factura actualizada correctamente.', 'success');
                await loadData();
                renderHistoryDeck();
            } catch (err) {
                console.error("Error updating metadata:", err);
                showToast('Error al actualizar la factura.', 'error');
                btn.disabled = false;
                btn.textContent = 'Guardar Cambios';
            }
        });
    }

    function renderEquipmentInventory() {
        currentView = 'equipment';
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDeckBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">📋 Inventario de Equipos y Utensilios</h2>
            </div>
            
            <div class="card" style="padding: 0; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;">
                    <thead>
                        <tr style="background-color: var(--background); border-bottom: 1px solid var(--border);">
                            <th style="padding: 1rem;">Nombre del Equipo</th>
                            <th style="padding: 1rem;">Serial / Marca</th>
                            <th style="padding: 1rem; text-align: center;">Cant.</th>
                            <th style="padding: 1rem;">Costo Unit. ($)</th>
                            <th style="padding: 1rem;">Costo Total ($)</th>
                            <th style="padding: 1rem;">Fecha Compra</th>
                            <th style="padding: 1rem;">Estado</th>
                            <th style="padding: 1rem;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (equipmentList.length === 0) {
            html += `<tr><td colspan="8" style="padding: 2rem; text-align: center; color: var(--text-muted);">No hay equipos registrados.</td></tr>`;
        } else {
            [...equipmentList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(eq => {
                const isDischarged = eq.status === 'BAJA';
                html += `
                    <tr style="border-bottom: 1px solid var(--border); ${isDischarged ? 'opacity: 0.5; background: var(--background);' : ''}">
                        <td style="padding: 1rem; font-weight: bold;">${eq.name}</td>
                        <td style="padding: 1rem; color: var(--text-muted);">${eq.serial || '-'}</td>
                        <td style="padding: 1rem; text-align: center; font-weight: bold;">${eq.qty}</td>
                        <td style="padding: 1rem;">$ ${parseFloat(eq.costUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
                        <td style="padding: 1rem;">$ ${parseFloat(eq.totalCostUsd || 0).toLocaleString('de-DE', {minimumFractionDigits: 2})}</td>
                        <td style="padding: 1rem; font-size: 0.85rem;">${eq.purchaseDate || '-'}</td>
                        <td style="padding: 1rem;">
                            <span style="padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold; background: ${isDischarged ? 'var(--danger)20' : 'var(--success)20'}; color: ${isDischarged ? 'var(--danger)' : 'var(--success)'};">
                                ${eq.status || 'ACTIVO'}
                            </span>
                        </td>
                        <td style="padding: 1rem;">
                            ${!isDischarged ? `
                            <button class="btn btn-sm btn-danger discharge-btn" data-id="${eq.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 6px; background: var(--danger); border: none; color: white; cursor: pointer;">Dar de Baja</button>
                            ` : '-'}
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
        
        container.querySelector('#backToDeckBtn')?.addEventListener('click', () => {
            currentFilterType = 'EQUIPO_UTENSILIO';
            goBackToDeck();
        });
        
        container.querySelectorAll('.discharge-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('¿Está seguro que desea dar de baja este equipo? Esto actualizará su estado en el inventario.')) {
                    e.currentTarget.disabled = true;
                    e.currentTarget.textContent = '...';
                    try {
                        const businessId = localStorage.getItem('businessId');
                        await updateDoc(doc(db, "businesses", businessId, "equipment", id), {
                            status: 'BAJA',
                            dischargeDate: new Date().toISOString()
                        });
                        showToast('Equipo dado de baja correctamente.', 'success');
                        await loadData(); 
                        renderEquipmentInventory();
                    } catch (err) {
                        console.error(err);
                        showToast('Error al dar de baja el equipo.', 'error');
                        e.currentTarget.disabled = false;
                        e.currentTarget.textContent = 'Dar de Baja';
                    }
                }
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
                <button class="btn btn-outline" id="backToDeckBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800;">Facturas Pendientes: ${supName}</h2>
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
                            <th style="padding: 1rem;">Días</th>
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
            pending.sort((a, b) => new Date(a.receptionDate || a.createdAt) - new Date(b.receptionDate || b.createdAt)).forEach(p => {
                let badgeColor = 'var(--text-muted)';
                if (p.status === 'CREDITO') badgeColor = 'var(--danger)';
                if (p.status === 'ABONO') badgeColor = 'var(--warning)';

                const rDate = new Date(p.receptionDate || p.emissionDate || p.createdAt);
                const diffTime = new Date() - rDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const displayDays = diffDays >= 0 ? diffDays : 0;

                html += `
                    <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 1rem;">${formatDateToDDMMYYYY(p.receptionDate || p.emissionDate)}</td>
                        <td style="padding: 1rem;"><span style="color: var(--text-muted); font-size: 0.85rem;">${displayDays}</span></td>
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

        container.querySelector('#backToDeckBtn').addEventListener('click', goBackToDeck);

        container.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const purchase = pending.find(p => p.id === btn.dataset.id);
                if (purchase) renderPaymentForm(purchase);
            });
        });
    }

    function renderPaymentForm(purchase) {
        const localNow = new Date();
        const todayStr = localNow.getFullYear() + '-' + String(localNow.getMonth() + 1).padStart(2, '0') + '-' + String(localNow.getDate()).padStart(2, '0');
        const supObj = suppliers.find(s => s.id === purchase.supplierId);
        const supName = supObj ? supObj.name : 'Desconocido';
        const docRate = purchase.bcvRate || bcvRate || 1;

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button type="button" class="btn btn-outline" id="backHeaderBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--success); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">💰 Cargar Pago</h2>
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

                        <div class="form-group" id="bcvRateGroup" style="display: none;">
                            <label>Tasa BCV <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pBcvRate" class="form-control" placeholder="0,00">
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

        if (typeof flatpickr !== 'undefined') {
            container.querySelectorAll('input[type="date"]').forEach(el => {
                flatpickr(el, {
                    locale: "es",
                    altInput: true,
                    altFormat: "d/m/Y",
                    dateFormat: "Y-m-d"
                });
            });
        }

        const pMethod = container.querySelector('#pPaymentMethod');
        const pRef = container.querySelector('#pReference');
        const refGroup = container.querySelector('#referenceGroup');
        const bsGroup = container.querySelector('#bsGroup');
        const usdGroup = container.querySelector('#usdGroup');
        const pBs = container.querySelector('#pReceivedBs');
        const pUsd = container.querySelector('#pReceivedUsd');
        const abonoDisplay = container.querySelector('#pTotalAbonoUsd');
        const newPendingDisplay = container.querySelector('#pNewPendingUsd');
        const pBcvRateInput = container.querySelector('#pBcvRate');
        const bcvRateGroup = container.querySelector('#bcvRateGroup');
        const pPaymentDate = container.querySelector('#pPaymentDate');

        const updateCalc = () => {
            const bs = parseNum(pBs.value);
            const usd = parseNum(pUsd.value);
            const currentRate = parseNum(pBcvRateInput.value) || docRate;
            const abonoFromBs = currentRate > 0 ? bs / currentRate : 0;
            const totalAbono = usd + abonoFromBs;
            const newPending = Math.max(0, purchase.pendingBalanceUsd - totalAbono);

            abonoDisplay.textContent = `$ ${totalAbono.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            newPendingDisplay.textContent = `$ ${newPending.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            return { totalAbono, newPending };
        };

        const loadBcvRateForDate = async (dateStr) => {
            const businessId = localStorage.getItem('businessId');
            if (!businessId) return;
            
            try {
                const safeDateStr = dateStr.replace(/\//g, '-');
                const docSnap = await getDoc(doc(db, "global_bcv_history", safeDateStr));
                if (docSnap.exists()) {
                    const rate = docSnap.data().rate;
                    pBcvRateInput.value = fmtNum(rate);
                    pBcvRateInput.readOnly = true;
                    pBcvRateInput.style.background = 'var(--background)';
                } else {
                    pBcvRateInput.value = '';
                    const isAdmin = localStorage.getItem('userRole') === 'admin' || localStorage.getItem('isOwner') === 'true';
                    if (isAdmin) {
                        pBcvRateInput.readOnly = false;
                        pBcvRateInput.style.background = 'var(--surface)';
                        showToast('Por favor, ingrese la Tasa BCV para esta fecha.', 'warning');
                        setTimeout(() => pBcvRateInput.focus(), 100);
                    } else {
                        pBcvRateInput.readOnly = true;
                        pBcvRateInput.style.background = 'var(--background)';
                        showToast('La tasa BCV para esta fecha no ha sido configurada. Contacte a un administrador.', 'error');
                    }
                }
                updateCalc();
            } catch (error) {
                console.error("Error loading BCV rate for date:", error);
                pBcvRateInput.value = fmtNum(bcvRate);
                pBcvRateInput.readOnly = false;
                pBcvRateInput.style.background = 'var(--surface)';
                updateCalc();
            }
        };

        pBcvRateInput.addEventListener('change', async () => {
            const currentRate = parseNum(pBcvRateInput.value);
            const isAdmin = localStorage.getItem('userRole') === 'admin' || localStorage.getItem('isOwner') === 'true';
            if (currentRate > 0 && !pBcvRateInput.readOnly && pPaymentDate.value && isAdmin) {
                const safeDateStr = pPaymentDate.value.replace(/\//g, '-');
                try {
                    const globalRef = doc(db, "global_bcv_history", safeDateStr);
                    const snap = await getDoc(globalRef);
                    let currentEditCount = 1;
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data.editCount >= 3) {
                            showToast('La tasa ya ha alcanzado el límite de 3 ediciones.', 'error');
                            pBcvRateInput.value = fmtNum(data.rate);
                            pBcvRateInput.readOnly = true;
                            return;
                        }
                        currentEditCount = (data.editCount || 1) + 1;
                    }
                    
                    await setDoc(globalRef, {
                        rate: currentRate,
                        date: safeDateStr,
                        createdAt: snap.exists() ? snap.data().createdAt : new Date().toISOString(),
                        createdBy: localStorage.getItem('employeeName') || 'admin',
                        isManual: true,
                        editCount: currentEditCount
                    }, { merge: true });
                    pBcvRateInput.readOnly = true;
                    pBcvRateInput.style.background = 'var(--background)';
                    showToast('Tasa BCV guardada para la fecha ' + safeDateStr, 'success');
                } catch (error) {
                    console.error("Error saving BCV rate:", error);
                }
            }
        });

        pMethod.addEventListener('change', async () => {
            const val = pMethod.value;
            const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Punto de Venta', 'BioPago', 'Transferencia'];
            const usdMethods = ['Binance', 'Dólares en Efectivo', 'Paypal', 'Zelle'];
            const refMethods = ['Pago Móvil', 'Transferencia', 'Binance', 'Paypal', 'Zelle'];

            // Reset
            pBs.value = '';
            pUsd.value = '';
            pRef.value = '';
            bsGroup.style.display = 'none';
            usdGroup.style.display = 'none';
            refGroup.style.display = 'none';
            bcvRateGroup.style.display = 'none';
            pBs.required = false;
            pUsd.required = false;
            pRef.required = false;
            pBcvRateInput.required = false;

            if (bsMethods.includes(val)) {
                bcvRateGroup.style.display = 'block';
                pBcvRateInput.required = true;
                
                await loadBcvRateForDate(pPaymentDate.value);
                
                bsGroup.style.display = 'block';
                pBs.required = true;
                const currentRate = parseNum(pBcvRateInput.value) || docRate;
                pBs.value = fmtNum(purchase.pendingBalanceUsd * currentRate);
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

        pPaymentDate.addEventListener('change', async () => {
            const val = pMethod.value;
            const bsMethods = ['BioPago', 'Bs. Efectivo', 'Pago Móvil', 'Tarjeta de Débito', 'Transferencia'];
            if (bsMethods.includes(val)) {
                await loadBcvRateForDate(pPaymentDate.value);
                const currentRate = parseNum(pBcvRateInput.value) || docRate;
                pBs.value = fmtNum(purchase.pendingBalanceUsd * currentRate);
                updateCalc();
            }
        });

        [pBs, pUsd].forEach(inp => applyNumericMask(inp, updateCalc));
        
        applyNumericMask(pBcvRateInput, () => {
            const currentRate = parseNum(pBcvRateInput.value) || docRate;
            pBs.value = fmtNum(purchase.pendingBalanceUsd * currentRate);
            updateCalc();
        });

        container.querySelector('#cancelPaymentBtn').addEventListener('click', () => renderSupplierDetail(purchase.supplierId));
        container.querySelector('#backHeaderBtn')?.addEventListener('click', () => container.querySelector('#cancelPaymentBtn').click());

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

    function renderTypeSelector() {
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backToDeckBtnType" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">📦 Registrar Compra o Gasto</h2>
            </div>
            
            <div style="max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; text-align: center;">
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 1rem;">¿Qué tipo de compra vas a registrar?</h3>
                
                <button class="btn btn-outline type-btn" data-type="PRODUCTO" style="height: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; border-radius: 12px; border: 2px solid var(--border);">
                    <span style="font-size: 2rem;">📦</span>
                    <span style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">Compra de Productos</span>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">Mercancía, insumos de producción o venta directa</span>
                </button>

                <button class="btn btn-outline type-btn" data-type="EQUIPO_UTENSILIO" style="height: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; border-radius: 12px; border: 2px solid var(--border);">
                    <span style="font-size: 2rem;">🔧</span>
                    <span style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">Equipo o Utensilio</span>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">Herramientas, maquinaria, mobiliario, utensilios</span>
                </button>

                <button class="btn btn-outline type-btn" data-type="GASTO_SERVICIO" style="height: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; border-radius: 12px; border: 2px solid var(--border);">
                    <span style="font-size: 2rem;">📋</span>
                    <span style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">Gasto / Servicio</span>
                    <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">Alquiler, electricidad, agua, aseo, internet</span>
                </button>
            </div>
            
            <style>
                .type-btn:hover { border-color: var(--primary) !important; background: var(--surface); }
            </style>
        `;

        container.innerHTML = html;
        
        container.querySelector('#backToDeckBtnType').addEventListener('click', () => {
            goBackToDeck();
        });

        container.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                renderForm(type);
            });
        });
    }

    function renderForm(purchaseType = 'PRODUCTO', prefillData = null) {
        const localNow = new Date();
        const todayStr = localNow.getFullYear() + '-' + String(localNow.getMonth() + 1).padStart(2, '0') + '-' + String(localNow.getDate()).padStart(2, '0');
        
        let html = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button type="button" class="btn btn-outline" id="backToTypeSelectorBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">
                    ${purchaseType === 'PRODUCTO' ? '📦 Cargar Factura de Compra' : (purchaseType === 'EQUIPO_UTENSILIO' ? '🔧 Cargar Equipo' : '📋 Cargar Gasto/Servicio')}
                </h2>
            </div>
            
            <form id="purchaseForm" style="max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;" data-type="${purchaseType}">
                <!-- 1. Datos del Documento -->
                <div class="card" style="padding: 2rem; border-top: 4px solid var(--primary); ${purchaseType === 'GASTO_SERVICIO' ? 'display: none;' : ''}">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">1. Datos del Documento</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>PROVEEDOR <span class="text-danger">*</span></label>
                            <select id="pSupplier" class="form-control" ${purchaseType !== 'GASTO_SERVICIO' ? 'required' : ''} style="height: 40px;">
                                <option value="">Seleccione un proveedor...</option>
                                <option value="CREATE_NEW" style="font-weight: bold; color: var(--primary);">+ CREAR PROVEEDOR</option>
                                ${[...suppliers].sort((a,b)=>a.name.localeCompare(b.name)).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>EMISIÓN <span class="text-danger">*</span></label>
                                <input type="date" id="pEmissionDate" class="form-control" ${purchaseType !== 'GASTO_SERVICIO' ? 'required' : ''} value="${todayStr}" style="height: 40px;">
                            </div>
                            <div class="form-group">
                                <label>RECEPCIÓN <span class="text-danger">*</span></label>
                                <input type="date" id="pReceptionDate" class="form-control" ${purchaseType !== 'GASTO_SERVICIO' ? 'required' : ''} value="${todayStr}" style="height: 40px;">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>TASA BCV DE LA FACTURA <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pBcvRate" class="form-control" ${purchaseType !== 'GASTO_SERVICIO' ? 'required' : ''} value="${bcvRate.toLocaleString('de-DE', {minimumFractionDigits:2})}" style="height: 40px;">
                            <small id="bcvWarning" style="color: var(--primary); display: none; margin-top: 4px; font-size: 0.7rem; font-weight: 700;">⚠️ No hay tasa cargada para la Fecha de Emisión.</small>
                        </div>

                        <div class="form-group">
                            <label>TIPO DE DOCUMENTO <span class="text-danger">*</span></label>
                            <select id="pDocType" class="form-control" ${purchaseType !== 'GASTO_SERVICIO' ? 'required' : ''} style="height: 40px;">
                                <option value="">Seleccione...</option>
                                <option value="FACTURA">FACTURA</option>
                                <option value="GUIA DE DESPACHO">GUIA DE DESPACHO</option>
                                <option value="NOTA DE ENTREGA">NOTA DE ENTREGA</option>
                                <option value="PRESUPUESTO">PRESUPUESTO</option>
                                <option value="RECIBO">RECIBO</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>NÚMERO DE DOCUMENTO <span class="text-danger">*</span></label>
                            <input type="text" id="pDocNumber" class="form-control" ${purchaseType !== 'GASTO_SERVICIO' ? 'required' : ''} placeholder="Ej. 001-A" style="height: 40px;">
                            <div id="pDocNumberError" style="color: var(--danger); font-size: 0.8rem; margin-top: 0.2rem; display: none; font-weight: bold;">Este documento ya fue registrado para este proveedor.</div>
                        </div>
                        
                        <div class="form-group">
                            <label>ESTADO DE LA COMPRA <span class="text-danger">*</span></label>
                            <select id="pStatus" class="form-control" ${purchaseType !== 'GASTO_SERVICIO' ? 'required' : ''} style="height: 40px;">
                                <option value="">Seleccione...</option>
                                <option value="ABONO">ABONO</option>
                                <option value="CONTADO">CONTADO</option>
                                <option value="CREDITO">CREDITO</option>
                                <option value="PAGADO">PAGADO</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${purchaseType === 'GASTO_SERVICIO' ? `
                <div class="card" style="padding: 2rem; border-top: 4px solid var(--primary);">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">1. Detalles del Gasto</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>ACREEDOR / INSTITUCIÓN <span class="text-danger">*</span></label>
                            <select id="pCreditor" class="form-control" required style="height: 40px;">
                                <option value="">Seleccione acreedor...</option>
                                <option value="CREATE_NEW" style="font-weight: bold; color: var(--primary);">+ CREAR ACREEDOR</option>
                                ${[...creditors].sort((a,b)=>a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>CATEGORÍA DEL GASTO <span class="text-danger">*</span></label>
                            <select id="pCategory" class="form-control" required style="height: 40px;">
                                <option value="">Seleccione...</option>
                                <option value="ALQUILER">Alquiler</option>
                                <option value="ELECTRICIDAD">Electricidad</option>
                                <option value="AGUA">Agua</option>
                                <option value="INTERNET">Internet</option>
                                <option value="ASEO">Aseo / Basura</option>
                                <option value="NOMINA">Nómina</option>
                                <option value="MANTENIMIENTO">Mantenimiento</option>
                                <option value="OTROS">Otros</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>DESCRIPCIÓN / MOTIVO <span class="text-danger">*</span></label>
                            <input type="text" id="pDescription" class="form-control" required placeholder="Ej. Pago alquiler Local 1" style="height: 40px;">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>FECHA DE REGISTRO <span class="text-danger">*</span></label>
                                <input type="date" id="pExpenseDate" class="form-control" required value="${todayStr}" style="height: 40px;">
                            </div>
                            <div class="form-group">
                                <label>TASA BCV <span class="text-danger">*</span></label>
                                <input type="text" inputmode="numeric" id="pExpenseBcvRate" class="form-control" required value="${bcvRate.toLocaleString('de-DE', {minimumFractionDigits:2})}" style="height: 40px;">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>ESTADO DEL PAGO <span class="text-danger">*</span></label>
                            <select id="pExpenseStatus" class="form-control" required style="height: 40px;">
                                <option value="">Seleccione...</option>
                                <option value="PAGADO">PAGADO AL CONTADO</option>
                                <option value="PENDIENTE">PENDIENTE POR PAGAR</option>
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin-top: 1rem; border-top: 1px dashed var(--border); padding-top: 1rem;">
                            <label>¿ES UN GASTO RECURRENTE?</label>
                            <select id="pExpenseRecurrence" class="form-control" style="height: 40px;">
                                <option value="NONE">No, es un pago único</option>
                                <option value="MENSUAL">Sí, se repite mensualmente</option>
                                <option value="ANUAL">Sí, se repite anualmente</option>
                            </select>
                        </div>
                        <div class="form-group" id="pExpenseNextDueDateGroup" style="display: none; margin-top: 0.5rem;">
                            <label>FECHA DEL PRÓXIMO PAGO <span class="text-danger">*</span></label>
                            <input type="date" id="pExpenseNextDueDate" class="form-control" style="height: 40px;">
                        </div>
                        
                        <div class="form-group" style="margin-top: 1rem; border-top: 1px dashed var(--border); padding-top: 1rem;">
                            <label>MONEDA DEL GASTO <span class="text-danger">*</span></label>
                            <div style="display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; height: 40px;">
                                <div id="btnExpenseCurrencyBs" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; background: var(--background); color: var(--text-main); font-weight: 800; font-size: 0.7rem;">BOLÍVARES</div>
                                <div id="btnExpenseCurrencyUsd" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; background: var(--primary); color: white; font-weight: 800; font-size: 0.7rem;">DÓLARES</div>
                            </div>
                            <input type="hidden" id="pExpenseCurrency" value="USD">
                        </div>
                        
                        <div class="form-group" style="margin-top: 1rem;">
                            <label style="font-size: 0.9rem;">MONTO TOTAL <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pExpenseAmount" class="form-control" required style="height: 50px; font-size: 1.5rem; font-weight: 900; color: var(--primary); text-align: center;">
                        </div>
                    </div>
                </div>
                ` : ''}

                ${purchaseType === 'PRODUCTO' ? `
                <!-- 2. Moneda y Productos -->
                <div class="card" style="padding: 2rem; border-top: 4px solid var(--primary);">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">2. Productos Recibidos</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>MONEDA DE LA FACTURA <span class="text-danger">*</span></label>
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
                ` : ''}

                ${purchaseType === 'EQUIPO_UTENSILIO' ? `
                <!-- 2. Equipos -->
                <div class="card" style="padding: 2rem; border-top: 4px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin: 0;">2. Lista de Equipos</h3>
                        <button type="button" class="btn btn-primary" id="addEqBtn" style="width: 180px; height: 42px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-left: auto;">+ Agregar Item</button>
                    </div>
                    
                    <div id="equipmentList" style="display: flex; flex-direction: column; gap: 1rem;">
                        <!-- Equipos dinamicos -->
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--border); padding-top: 1rem; margin-top: 1rem; background: var(--background); padding: 1rem; border-radius: 12px;">
                        <span style="font-weight: 800; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase;">TOTAL FACTURA $</span>
                        <span id="eqTotalUsd" style="font-weight: 900; font-size: 1.5rem; color: var(--primary);">$ 0.00</span>
                    </div>
                </div>
                ` : ''}

                <!-- 3. Pagos (Condicional) -->
                <div class="card" id="paymentSection" style="display: none; padding: 2rem; border-top: 4px solid var(--primary);">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">3. Registro de Pago</h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                        <div class="form-group">
                            <label>FECHA DEL PAGO <span class="text-danger">*</span></label>
                            <input type="date" id="pPaymentDate" class="form-control" value="${todayStr}" style="height: 40px;">
                        </div>
                        <div class="form-group">
                            <label>FORMA DE PAGO <span class="text-danger">*</span></label>
                            <select id="pPaymentMethod" class="form-control" style="height: 40px;">
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
                            <label>RECIBIDO BS <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pReceivedBs" class="form-control" style="font-weight: bold; color: var(--primary); height: 40px;">
                        </div>
                        <div class="form-group" id="receivedUsdGroup" style="display: none;">
                            <label>RECIBIDO $ <span class="text-danger">*</span></label>
                            <input type="text" inputmode="numeric" id="pReceivedUsd" class="form-control" style="font-weight: bold; color: var(--primary); height: 40px;">
                        </div>
                        <div class="form-group" id="equivalentUsdGroup" style="display: none;">
                            <label>EQUIVALENTE $ <small class="text-muted">(Auto-calculado)</small></label>
                            <input type="text" id="pEquivalentUsd" class="form-control" readonly style="background: transparent; border-style: dashed; height: 40px;">
                        </div>
                        <div class="form-group" id="referenceGroup" style="display: none;">
                            <label>NÚMERO DE REFERENCIA <span class="text-danger">*</span></label>
                            <input type="text" id="pReference" class="form-control" placeholder="Ej. 123456" style="height: 40px;">
                        </div>
                        <div class="form-group">
                            <label>SALDO PENDIENTE $</label>
                            <input type="text" id="pPendingBalance" class="form-control" readonly style="background: rgba(239, 68, 68, 0.05); color: var(--danger); font-weight: 900; font-size: 1.1rem; border-color: var(--danger); height: 40px;">
                        </div>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="button" class="btn btn-outline" id="pausePurchaseBtn" style="flex: 1; height: 50px; font-size: 0.85rem; white-space: nowrap; font-weight: 700; border-color: var(--info, #3b82f6); color: var(--info, #3b82f6); padding: 0 0.5rem;">PAUSAR COMPRA</button>
                    <button type="button" class="btn btn-outline" id="cancelFormBtn" style="flex: 1; height: 50px; font-size: 0.85rem; white-space: nowrap; font-weight: 700; padding: 0 0.5rem;">CANCELAR</button>
                    <button type="submit" class="btn btn-primary" id="savePurchaseBtn" style="flex: 1; height: 50px; font-size: 0.85rem; white-space: nowrap; font-weight: 800; padding: 0 0.5rem;">CREAR COMPRA</button>
                </div>
            </form>

            <!-- Sub-view: Cargar Productos Modal -->
            <div id="productBuilderModal" style="display: none; position: fixed; inset: 0; background: var(--surface); z-index: 9999; flex-direction: column;">
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

            <!-- Modal para Crear Acreedor -->
            <div id="creditorModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="width: 100%; max-width: 450px; padding: 2rem; border-top: 5px solid var(--primary); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                    <h2 style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; color: var(--primary); margin-bottom: 0.5rem;">Nuevo Acreedor</h2>
                    <p class="text-muted mb-4" style="font-size: 0.85rem;">Registre la institución o persona a quien se le paga el servicio o gasto.</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label>Nombre del Acreedor <span class="text-danger">*</span></label>
                            <input type="text" id="newCreditorName" class="form-control" placeholder="Ej. Corpoelec">
                        </div>
                        <div class="form-group">
                            <label>RIF / Cédula</label>
                            <input type="text" id="newCreditorRif" class="form-control" placeholder="Ej. J-123456789">
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <button type="button" class="btn btn-outline" id="cancelCreditorBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                            <button type="button" class="btn btn-primary" id="saveCreditorBtn" style="flex: 1; height: 50px; font-weight: 800;">GUARDAR</button>
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
                /* Tom Select Dark Theme adjustments */
                .ts-wrapper { height: 40px; }
                .ts-control { background: var(--surface) !important; border: 1px solid var(--border) !important; border-radius: 10px !important; color: var(--text-main) !important; font-family: 'Inter', sans-serif !important; padding: 0.4rem 1rem !important; min-height: 40px !important; display: flex !important; align-items: center !important; }
                .ts-control > input { color: var(--text-main) !important; font-size: 0.9rem !important; }
                .ts-dropdown { background: #131b2e !important; border: 1px solid var(--border) !important; border-radius: 10px !important; color: var(--text-main) !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5) !important; font-size: 0.9rem !important; margin-top: 4px !important; z-index: 1000 !important; }
                .ts-dropdown .option { padding: 0.6rem 1rem !important; cursor: pointer !important; transition: background 0.2s !important; }
                .ts-dropdown .active { background: var(--primary) !important; color: white !important; }
                .ts-control.focus { border-color: var(--primary) !important; box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1) !important; }
            </style>
        `;

        container.innerHTML = html;

        if (typeof TomSelect !== 'undefined') {
            const tsOptions = { create: false };
            const supplierSelect = container.querySelector('#pSupplier');
            if (supplierSelect) new TomSelect(supplierSelect, tsOptions);
            
            const creditorSelect = container.querySelector('#pCreditor');
            if (creditorSelect) new TomSelect(creditorSelect, tsOptions);
        }

        if (typeof flatpickr !== 'undefined') {
            const fpConfig = {
                locale: "es",
                altInput: true,
                altFormat: "d/m/Y",
                dateFormat: "Y-m-d"
            };
            container.querySelectorAll('input[type="date"]').forEach(el => {
                flatpickr(el, fpConfig);
            });
            
            const fpEmission = container.querySelector('#pEmissionDate');
            const fpReception = container.querySelector('#pReceptionDate');
            if (fpEmission && fpReception && fpReception._flatpickr) {
                fpReception._flatpickr.set('minDate', fpEmission.value);
            }
        }

        // Variables de estado interno
        let currentPurchaseProducts = [];
        let totalPurchaseUsd = 0;
        let totalPurchaseBs = 0;

        // Elements
        const btnCurrencyBs = container.querySelector('#btnCurrencyBs');
        const btnCurrencyUsd = container.querySelector('#btnCurrencyUsd');
        const pCurrency = container.querySelector('#pCurrency');
        const pSupplier = container.querySelector('#pSupplier');
        const pCreditor = container.querySelector('#pCreditor');
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
        const pDocNumberError = container.querySelector('#pDocNumberError');

        let shouldOpenBuilder = false;

        if (pDocNumber && pSupplier) {
            const checkDuplicateDoc = () => {
                const docVal = pDocNumber.value.trim().toLowerCase();
                const supVal = pSupplier.value;
                if (!docVal || !supVal) {
                    if (pDocNumberError) pDocNumberError.style.display = 'none';
                    pDocNumber.style.borderColor = '';
                    return;
                }
                
                const exists = purchases.find(p => p.supplierId === supVal && p.docNumber && p.docNumber.toLowerCase() === docVal);
                if (exists) {
                    if (pDocNumberError) pDocNumberError.style.display = 'block';
                    pDocNumber.style.borderColor = 'var(--danger)';
                } else {
                    if (pDocNumberError) pDocNumberError.style.display = 'none';
                    pDocNumber.style.borderColor = '';
                }
            };

            pDocNumber.addEventListener('blur', checkDuplicateDoc);
            pSupplier.addEventListener('change', checkDuplicateDoc);
        }
        
        // Restore state if returning from Product Creation
        if (window.tempPurchaseState) {
            const st = window.tempPurchaseState;
            
            if (st.products && st.products.length > 0) {
                currentPurchaseProducts = st.products;
            }
            if (st.equipmentItems && st.equipmentItems.length > 0) {
                window.currentEquipmentItems = st.equipmentItems;
            }
            
            if (pSupplier && st.supplierId) {
                let opt = pSupplier.querySelector(`option[value="${st.supplierId}"]`);
                if (!opt) {
                    opt = document.createElement('option');
                    opt.value = st.supplierId;
                    opt.textContent = `Proveedor (${st.supplierId})`;
                    pSupplier.appendChild(opt);
                    if (pSupplier.tomselect) {
                        pSupplier.tomselect.addOption({value: st.supplierId, text: opt.textContent});
                    }
                }
                pSupplier.value = st.supplierId;
                if (pSupplier.tomselect) pSupplier.tomselect.setValue(st.supplierId);
            } else if (pSupplier) {
                pSupplier.value = '';
                if (pSupplier.tomselect) pSupplier.tomselect.clear();
            }
            if (pCreditor) {
                pCreditor.value = st.creditorId || '';
                if (pCreditor.tomselect) pCreditor.tomselect.setValue(st.creditorId || '');
            }
            
            const pCategory = container.querySelector('#pCategory');
            if (pCategory) pCategory.value = st.categoryId || '';
            
            const pDescription = container.querySelector('#pDescription');
            if (pDescription) pDescription.value = st.description || '';
            
            const pExpenseBcvRate = container.querySelector('#pExpenseBcvRate');
            if (pExpenseBcvRate && st.bcvRate) pExpenseBcvRate.value = st.bcvRate;
            
            const pExpenseDate = container.querySelector('#pExpenseDate');
            if (pExpenseDate && st.emissionDate) pExpenseDate.value = st.emissionDate;
            
            const pExpenseStatus = container.querySelector('#pExpenseStatus');
            if (pExpenseStatus && st.status) pExpenseStatus.value = st.status;
            
            const pExpenseCurrency = container.querySelector('#pExpenseCurrency');
            if (pExpenseCurrency && st.currency) pExpenseCurrency.value = st.currency;

            if (pBcvRate) pBcvRate.value = st.bcvRate || '';
            
            if (pEmissionDate) {
                pEmissionDate.value = st.emissionDate || todayStr;
                if (pEmissionDate._flatpickr) pEmissionDate._flatpickr.setDate(pEmissionDate.value);
            }
            if (pReceptionDate) {
                pReceptionDate.value = st.receptionDate || todayStr;
                if (pReceptionDate._flatpickr) pReceptionDate._flatpickr.setDate(pReceptionDate.value);
            }
            if (pDocType) pDocType.value = st.docType || '';
            if (pDocNumber) pDocNumber.value = st.docNumber || '';
            if (pStatus) pStatus.value = st.status || '';
            if (pCurrency) pCurrency.value = st.currency || 'BS';
            if (pPaymentDate) pPaymentDate.value = st.paymentDate || todayStr;
            if (pPaymentMethod) pPaymentMethod.value = st.paymentMethod || '';
            if (pReceivedBs) pReceivedBs.value = st.receivedBs || '';
            if (pReceivedUsd) pReceivedUsd.value = st.receivedUsd || '';
            
            if (st.currency === 'USD' && btnCurrencyUsd && btnCurrencyBs) {
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
        container.querySelector('#backToTypeSelectorBtn').addEventListener('click', renderTypeSelector);
        container.querySelector('#cancelFormBtn').addEventListener('click', goBackToDeck);

        // Save Paused State
        window.savePurchaseStateAndExit = function(overrideProducts = null) {
            let stateData = {
                purchaseType: purchaseType,
                supplierId: container.querySelector('#pSupplier') ? container.querySelector('#pSupplier').value : null,
                creditorId: container.querySelector('#pCreditor') ? container.querySelector('#pCreditor').value : null,
                categoryId: container.querySelector('#pCategory') ? container.querySelector('#pCategory').value : null,
                description: container.querySelector('#pDescription') ? container.querySelector('#pDescription').value : null,
                bcvRate: parseNum((container.querySelector('#pBcvRate') && container.querySelector('#pBcvRate').value) ? container.querySelector('#pBcvRate').value : (container.querySelector('#pExpenseBcvRate') ? container.querySelector('#pExpenseBcvRate').value : 1)),
                emissionDate: (container.querySelector('#pEmissionDate') && container.querySelector('#pEmissionDate').value) ? container.querySelector('#pEmissionDate').value : (container.querySelector('#pExpenseDate') ? container.querySelector('#pExpenseDate').value : todayStr),
                receptionDate: (container.querySelector('#pReceptionDate') && container.querySelector('#pReceptionDate').value) ? container.querySelector('#pReceptionDate').value : todayStr,
                docType: container.querySelector('#pDocType') ? container.querySelector('#pDocType').value : null,
                docNumber: container.querySelector('#pDocNumber') ? container.querySelector('#pDocNumber').value : null,
                status: (container.querySelector('#pStatus') && container.querySelector('#pStatus').value) ? container.querySelector('#pStatus').value : (container.querySelector('#pExpenseStatus') ? container.querySelector('#pExpenseStatus').value : ''),
                currency: (pCurrency && pCurrency.value) ? pCurrency.value : (container.querySelector('#pExpenseCurrency') ? container.querySelector('#pExpenseCurrency').value : 'BS'),
                paymentDate: pPaymentDate ? pPaymentDate.value : null,
                paymentMethod: pPaymentMethod ? pPaymentMethod.value : null,
                receivedBs: pReceivedBs ? pReceivedBs.value : null,
                receivedUsd: pReceivedUsd ? pReceivedUsd.value : null,
                reference: container.querySelector('#pReference') ? container.querySelector('#pReference').value : null,
                products: overrideProducts !== null ? overrideProducts : (currentPurchaseProducts || []),
                equipmentItems: window.currentEquipmentItems || []
            };
            localStorage.setItem('pausedPurchaseState', JSON.stringify(stateData));
            showToast('Compra en espera guardada.', 'info');
            renderDeck();
        };

        const pauseFormBtn = container.querySelector('#pausePurchaseBtn');
        if (pauseFormBtn) pauseFormBtn.addEventListener('click', window.savePurchaseStateAndExit);

        const updatePayments = () => {
            if (typeof calculatePendingBalance === 'function') {
                calculatePendingBalance();
            }
        };

        const bcvWarning = container.querySelector('#bcvWarning');

        // Función para buscar tasa por fecha
        const fetchRateByDate = async (date) => {
            const businessId = localStorage.getItem('businessId');
            if (!businessId || !date) return;
            
            try {
                const safeDate = date.replace(/\//g, '-');
                const docRef = doc(db, "global_bcv_history", safeDate);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const rate = docSnap.data().rate;
                    if (pBcvRate) pBcvRate.value = fmtNum(rate);
                    if (bcvWarning) bcvWarning.style.display = 'none';
                    if (pBcvRate) pBcvRate.classList.remove('input-warning');
                } else {
                    const savedRate = localStorage.getItem('bcvRate');
                    const savedDate = localStorage.getItem('bcvDate');
                    
                    if (date === savedDate && savedRate) {
                        if (pBcvRate) pBcvRate.value = fmtNum(parseFloat(savedRate));
                        if (bcvWarning) bcvWarning.style.display = 'none';
                        if (pBcvRate) pBcvRate.classList.remove('input-warning');
                    } else {
                        if (bcvWarning) {
                            bcvWarning.innerHTML = '⚠️ No hay tasa cargada para la Fecha de Emisión.';
                            bcvWarning.style.display = 'block';
                        }
                        if (pBcvRate) {
                            pBcvRate.classList.add('input-warning');
                            pBcvRate.value = '';
                        }
                    }
                }
                calculatePendingBalance();
            } catch (err) {
                console.error("Error fetching rate by date:", err);
            }
        };

        if (pEmissionDate) pEmissionDate.addEventListener('change', (e) => fetchRateByDate(e.target.value));
        // Ejecutar una vez al inicio
        if (pEmissionDate) fetchRateByDate(pEmissionDate.value);

        // Guardar la tasa inmediatamente cuando el usuario la ingresa/edita
        if (pBcvRate) {
            pBcvRate.addEventListener('change', async (e) => {
                const enteredRate = parseNum(e.target.value);
                const selectedDate = pEmissionDate ? pEmissionDate.value : null;
                const businessId = localStorage.getItem('businessId');
                const isAdmin = localStorage.getItem('userRole') === 'admin' || localStorage.getItem('isOwner') === 'true';
                if (enteredRate > 0 && selectedDate && businessId && isAdmin) {
                    try {
                        const safeDate = selectedDate.replace(/\//g, '-');
                        const bcvRef = doc(db, "global_bcv_history", safeDate);
                        const snap = await getDoc(bcvRef);
                        let currentEditCount = 1;
                        if (snap.exists()) {
                            const data = snap.data();
                            if (data.editCount >= 3) {
                                showToast('Límite de ediciones de tasa (3) alcanzado.', 'error');
                                pBcvRate.value = fmtNum(data.rate);
                                return;
                            }
                            currentEditCount = (data.editCount || 1) + 1;
                        }
                        
                        await setDoc(bcvRef, { 
                            rate: enteredRate, 
                            updatedAt: new Date().toISOString(),
                            createdAt: snap.exists() ? snap.data().createdAt : new Date().toISOString(),
                            createdBy: localStorage.getItem('employeeName') || 'admin',
                            isManual: true,
                            editCount: currentEditCount
                        }, { merge: true });
                        // Ocultar la advertencia ya que ahora existe
                        if (bcvWarning) bcvWarning.style.display = 'none';
                        if (pBcvRate) pBcvRate.classList.remove('input-warning');
                        // Actualizar localStorage si es hoy
                        if (selectedDate === localStorage.getItem('bcvDate') || !localStorage.getItem('bcvDate')) {
                            localStorage.setItem('bcvRate', enteredRate);
                            localStorage.setItem('bcvDate', selectedDate);
                        }
                    } catch (err) {
                        console.error("Error saving rate instantly:", err);
                    }
                }
            });
        }

        if (pEmissionDate) {
            pEmissionDate.addEventListener('change', () => {
                if (pReceptionDate) {
                    pReceptionDate.value = pEmissionDate.value;
                    if (pReceptionDate._flatpickr) {
                        pReceptionDate._flatpickr.setDate(pEmissionDate.value);
                        pReceptionDate._flatpickr.set('minDate', pEmissionDate.value);
                    }
                }
                if (pStatus && (pStatus.value === 'CONTADO' || pStatus.value === 'ABONO')) {
                    const pPaymentDate = container.querySelector('#pPaymentDate');
                    if (pPaymentDate) {
                        pPaymentDate.value = pEmissionDate.value;
                        if (pPaymentDate._flatpickr) pPaymentDate._flatpickr.setDate(pEmissionDate.value);
                    }
                }
            });
        }

        if (pStatus) {
            pStatus.addEventListener('change', () => {
                if (pStatus.value === 'CONTADO' || pStatus.value === 'ABONO') {
                    const pPaymentDate = container.querySelector('#pPaymentDate');
                    const pEmiDate = container.querySelector('#pEmissionDate');
                    if (pPaymentDate && pEmiDate) {
                        pPaymentDate.value = pEmiDate.value;
                        if (pPaymentDate._flatpickr) pPaymentDate._flatpickr.setDate(pEmiDate.value);
                    }
                }
            });
        }

        [pBcvRate, pReceivedBs, pReceivedUsd].forEach(inp => {
            if (inp) applyNumericMask(inp, updatePayments);
        });
        
        const itemQtyInput = container.querySelector('#itemQtyInput');
        const itemTotalCostInput = container.querySelector('#itemTotalCostInput');
        [itemQtyInput, itemTotalCostInput].forEach(inp => {
            if (inp) applyNumericMask(inp);
        });

        pSupplier?.addEventListener('change', () => {
            if (pSupplier.value === 'CREATE_NEW') {
                window.tempPurchaseState = {
                    purchaseType: purchaseType,
                    supplierId: '', 
                    bcvRate: container.querySelector('#pBcvRate') ? container.querySelector('#pBcvRate').value : '',
                    emissionDate: container.querySelector('#pEmissionDate') ? container.querySelector('#pEmissionDate').value : '',
                    receptionDate: container.querySelector('#pReceptionDate') ? container.querySelector('#pReceptionDate').value : '',
                    docType: container.querySelector('#pDocType') ? container.querySelector('#pDocType').value : '',
                    docNumber: container.querySelector('#pDocNumber') ? container.querySelector('#pDocNumber').value : '',
                    status: container.querySelector('#pStatus') ? container.querySelector('#pStatus').value : '',
                    currency: container.querySelector('#pCurrency')?.value || '',
                    paymentDate: container.querySelector('#pPaymentDate')?.value || '',
                    paymentMethod: container.querySelector('#pPaymentMethod')?.value || '',
                    receivedBs: container.querySelector('#pReceivedBs')?.value || '',
                    receivedUsd: container.querySelector('#pReceivedUsd')?.value || '',
                    products: currentPurchaseProducts
                };
                window.openCreateSupplierForPurchase = true;
                document.getElementById('navProveedores').click();
            }
        });

        const creditorModal = container.querySelector('#creditorModal');
        const newCreditorName = container.querySelector('#newCreditorName');
        const newCreditorRif = container.querySelector('#newCreditorRif');
        const saveCreditorBtn = container.querySelector('#saveCreditorBtn');
        const cancelCreditorBtn = container.querySelector('#cancelCreditorBtn');

        pCreditor?.addEventListener('change', () => {
            if (pCreditor.value === 'CREATE_NEW') {
                if (creditorModal) creditorModal.style.display = 'flex';
                if (newCreditorName) {
                    newCreditorName.value = '';
                    newCreditorName.focus();
                }
                if (newCreditorRif) newCreditorRif.value = '';
                pCreditor.value = ''; 
            }
        });

        if (cancelCreditorBtn) cancelCreditorBtn.addEventListener('click', () => creditorModal.style.display = 'none');

        if (saveCreditorBtn) saveCreditorBtn.addEventListener('click', async () => {
            const name = newCreditorName.value.trim();
            if (!name) {
                showToast("El nombre del acreedor es requerido.", "error");
                return;
            }
            saveCreditorBtn.disabled = true;
            saveCreditorBtn.textContent = 'Guardando...';

            try {
                const businessId = localStorage.getItem('businessId');
                const newRef = doc(collection(db, "businesses", businessId, "creditors"));
                await setDoc(newRef, {
                    name,
                    rif: newCreditorRif.value.trim(),
                    createdAt: new Date().toISOString()
                });

                creditors.push({ id: newRef.id, name, rif: newCreditorRif.value.trim() });
                
                // Re-render the select options
                pCreditor.innerHTML = `
                    <option value="">Seleccione acreedor...</option>
                    <option value="CREATE_NEW" style="font-weight: bold; color: var(--primary);">+ CREAR ACREEDOR</option>
                    ${[...creditors].sort((a,b)=>a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                `;
                pCreditor.value = newRef.id;

                showToast("Acreedor creado correctamente.", "success");
                creditorModal.style.display = 'none';
                newCreditorName.value = '';
                newCreditorRif.value = '';
            } catch (error) {
                console.error("Error creating creditor:", error);
                showToast("Error al crear acreedor.", "error");
            } finally {
                saveCreditorBtn.disabled = false;
                saveCreditorBtn.textContent = 'GUARDAR';
            }
        });
        
        // Currency Toggle Logic
        if (btnCurrencyBs && btnCurrencyUsd) {
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
        }

        // Status Logic
        pStatus.addEventListener('change', () => {
            const status = pStatus.value;
            if (status === 'CONTADO' || status === 'ABONO') {
                paymentSection.style.display = 'block';
                pPaymentDate.required = true;
                pPaymentMethod.required = true;
                
                // Copiar la fecha de emisión a la fecha de pago
                if (pEmissionDate && pEmissionDate.value) {
                    pPaymentDate.value = pEmissionDate.value;
                }
                
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
            const docRate = pBcvRate ? (parseNum(pBcvRate.value) || 1) : 1;
            let paidUsd = 0;

            if (pStatus && pStatus.value === 'PAGADO') {
                paidUsd = totalPurchaseUsd;
            } else if (pStatus && (pStatus.value === 'CONTADO' || pStatus.value === 'ABONO')) {
                const method = pPaymentMethod ? pPaymentMethod.value : '';
                const bsMethods = ['Bs. Efectivo', 'Pago Móvil', 'Transferencia', 'Tarjeta de Débito', 'BioPago'];
                
                if (bsMethods.includes(method)) {
                    const recBs = pReceivedBs ? parseNum(pReceivedBs.value) : 0;
                    paidUsd = recBs / docRate; 
                    if (pEquivalentUsd) pEquivalentUsd.value = fmtNum(paidUsd);
                } else {
                    paidUsd = pReceivedUsd ? parseNum(pReceivedUsd.value) : 0;
                }
            }

            let pending = totalPurchaseUsd - paidUsd;
            if (pending < 0) pending = 0;
            if (pStatus && pStatus.value === 'CREDITO') pending = totalPurchaseUsd;

            if (pPendingBalance) pPendingBalance.value = fmtNum(pending);
        }

        if (pReceivedBs) pReceivedBs.addEventListener('input', calculatePendingBalance);
        if (pReceivedUsd) pReceivedUsd.addEventListener('input', calculatePendingBalance);
        if (pBcvRate) pBcvRate.addEventListener('input', calculatePendingBalance);

        // Equipment Builder logic
        if (purchaseType === 'EQUIPO_UTENSILIO') {
            const addEqBtn = container.querySelector('#addEqBtn');
            const equipmentList = container.querySelector('#equipmentList');
            const eqTotalUsd = container.querySelector('#eqTotalUsd');
            
            let equipmentItems = [];
            
            const updateEqTotals = () => {
                const bcv = parseNum(pBcvRate.value) || 1;
                totalPurchaseUsd = equipmentItems.reduce((sum, item) => {
                    const itemCostUsd = item.currency === 'BS' ? (bcv > 0 ? item.cost / bcv : 0) : item.cost;
                    return sum + (itemCostUsd * item.qty);
                }, 0);
                totalPurchaseBs = totalPurchaseUsd * bcv;
                if (eqTotalUsd) eqTotalUsd.textContent = `$ ${totalPurchaseUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                calculatePendingBalance();
            };

            if (addEqBtn) {
                addEqBtn.addEventListener('click', () => {
                    const id = Date.now().toString();
                    equipmentItems.push({ id, name: '', description: '', serial: '', qty: 1, cost: 0, currency: 'USD' });
                    renderEquipmentList();
                });
            }

            const renderEquipmentList = () => {
                equipmentList.innerHTML = equipmentItems.map((item, index) => `
                    <div style="margin-bottom: 1.5rem;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>Nombre del Equipo <span class="text-danger">*</span></label>
                                <input type="text" class="form-control eq-name" data-index="${index}" value="${item.name}" required>
                            </div>
                            <div class="form-group">
                                <label>Serial / Marca</label>
                                <input type="text" class="form-control eq-serial" data-index="${index}" value="${item.serial}">
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-top: 0.5rem;">
                            <label>Descripción breve</label>
                            <input type="text" class="form-control eq-desc" data-index="${index}" value="${item.description}">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 40px; gap: 1rem; margin-top: 0.5rem; align-items: flex-end;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Cantidad <span class="text-danger">*</span></label>
                                <input type="text" inputmode="numeric" class="form-control eq-qty" data-index="${index}" value="${fmtNum(item.qty)}" required>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Moneda <span class="text-danger">*</span></label>
                                <select class="form-control eq-currency" data-index="${index}">
                                    <option value="USD" ${item.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                                    <option value="BS" ${item.currency === 'BS' ? 'selected' : ''}>VES (Bs)</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label>Costo Unid. <span class="text-danger">*</span></label>
                                <input type="text" inputmode="numeric" class="form-control eq-cost" data-index="${index}" value="${fmtNum(item.cost)}" required>
                            </div>
                            <button type="button" class="btn btn-outline eq-remove-btn" title="Eliminar Ítem" data-index="${index}" style="width: 40px; height: 38px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: bold; border-color: var(--danger); color: var(--danger); border-radius: 8px; margin-bottom: 0;">&times;</button>
                        </div>
                    </div>
                `).join('');

                equipmentList.querySelectorAll('.eq-name').forEach(inp => inp.addEventListener('input', (e) => equipmentItems[e.target.dataset.index].name = e.target.value));
                equipmentList.querySelectorAll('.eq-serial').forEach(inp => inp.addEventListener('input', (e) => equipmentItems[e.target.dataset.index].serial = e.target.value));
                equipmentList.querySelectorAll('.eq-desc').forEach(inp => inp.addEventListener('input', (e) => equipmentItems[e.target.dataset.index].description = e.target.value));
                
                equipmentList.querySelectorAll('.eq-currency').forEach(sel => {
                    sel.addEventListener('change', (e) => {
                        equipmentItems[e.target.dataset.index].currency = e.target.value;
                        updateEqTotals();
                    });
                });

                equipmentList.querySelectorAll('.eq-qty').forEach(inp => {
                    applyNumericMask(inp, () => {
                        equipmentItems[inp.dataset.index].qty = parseNum(inp.value) || 0;
                        updateEqTotals();
                    });
                });

                equipmentList.querySelectorAll('.eq-cost').forEach(inp => {
                    applyNumericMask(inp, () => {
                        equipmentItems[inp.dataset.index].cost = parseNum(inp.value) || 0;
                        updateEqTotals();
                    });
                });

                equipmentList.querySelectorAll('.eq-remove-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        equipmentItems.splice(e.target.dataset.index, 1);
                        renderEquipmentList();
                        updateEqTotals();
                    });
                });
            };
            
            window.currentEquipmentItems = equipmentItems;
        }

        if (purchaseType === 'GASTO_SERVICIO') {
            const btnExpenseCurrencyBs = container.querySelector('#btnExpenseCurrencyBs');
            const btnExpenseCurrencyUsd = container.querySelector('#btnExpenseCurrencyUsd');
            const pExpenseCurrency = container.querySelector('#pExpenseCurrency');
            const pExpenseAmount = container.querySelector('#pExpenseAmount');
            const pExpenseBcvRate = container.querySelector('#pExpenseBcvRate');
            
            applyNumericMask(pExpenseAmount, () => {
                calculateExpenseTotals();
            });
            applyNumericMask(pExpenseBcvRate, () => {
                calculateExpenseTotals();
            });

            const calculateExpenseTotals = () => {
                const amt = parseNum(pExpenseAmount.value) || 0;
                const bcv = parseNum(pExpenseBcvRate.value) || 1;
                if (pExpenseCurrency.value === 'USD') {
                    totalPurchaseUsd = amt;
                    totalPurchaseBs = amt * bcv;
                } else {
                    totalPurchaseBs = amt;
                    totalPurchaseUsd = amt / bcv;
                }
            };

            btnExpenseCurrencyBs?.addEventListener('click', () => {
                pExpenseCurrency.value = 'BS';
                btnExpenseCurrencyBs.style.background = 'var(--primary)';
                btnExpenseCurrencyBs.style.color = 'white';
                btnExpenseCurrencyUsd.style.background = 'var(--background)';
                btnExpenseCurrencyUsd.style.color = 'var(--text-main)';
                calculateExpenseTotals();
            });

            btnExpenseCurrencyUsd?.addEventListener('click', () => {
                pExpenseCurrency.value = 'USD';
                btnExpenseCurrencyUsd.style.background = 'var(--primary)';
                btnExpenseCurrencyUsd.style.color = 'white';
                btnExpenseCurrencyBs.style.background = 'var(--background)';
                btnExpenseCurrencyBs.style.color = 'var(--text-main)';
                calculateExpenseTotals();
            });

            const pExpenseRecurrence = container.querySelector('#pExpenseRecurrence');
            const pExpenseNextDueDateGroup = container.querySelector('#pExpenseNextDueDateGroup');
            const pExpenseNextDueDate = container.querySelector('#pExpenseNextDueDate');
            
            pExpenseRecurrence?.addEventListener('change', () => {
                if (pExpenseRecurrence.value === 'NONE') {
                    pExpenseNextDueDateGroup.style.display = 'none';
                    pExpenseNextDueDate.required = false;
                } else {
                    pExpenseNextDueDateGroup.style.display = 'block';
                    pExpenseNextDueDate.required = true;
                    if (!pExpenseNextDueDate.value) {
                        const d = new Date();
                        if (pExpenseRecurrence.value === 'MENSUAL') d.setMonth(d.getMonth() + 1);
                        if (pExpenseRecurrence.value === 'ANUAL') d.setFullYear(d.getFullYear() + 1);
                        pExpenseNextDueDate.value = d.toISOString().split('T')[0];
                    }
                }
            });

            if (prefillData) {
                // Wait a tick for elements to be fully ready
                setTimeout(() => {
                    container.querySelector('#pCreditor').value = prefillData.creditorId || '';
                    container.querySelector('#pCategory').value = prefillData.categoryId || '';
                    container.querySelector('#pDescription').value = prefillData.description || '';
                    if (prefillData.amountUsd) {
                        pExpenseCurrency.value = 'USD';
                        btnExpenseCurrencyUsd.style.background = 'var(--primary)';
                        btnExpenseCurrencyUsd.style.color = 'white';
                        btnExpenseCurrencyBs.style.background = 'var(--background)';
                        btnExpenseCurrencyBs.style.color = 'var(--text-main)';
                        pExpenseAmount.value = fmtNum(prefillData.amountUsd);
                    }
                    if (prefillData.recurrenceType) {
                        pExpenseRecurrence.value = prefillData.recurrenceType;
                        pExpenseRecurrence.dispatchEvent(new Event('change'));
                    }
                    calculateExpenseTotals();
                }, 50);
            }
        }

        // Product Builder logic
        const openProductBuilderBtn = container.querySelector('#openProductBuilderBtn');
        if (openProductBuilderBtn) {
            openProductBuilderBtn.addEventListener('click', () => {
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
        }

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

            const pItemsCount = container.querySelector('#pItemsCount');
            const pTotalBs = container.querySelector('#pTotalBs');
            const pTotalUsd = container.querySelector('#pTotalUsd');

            if (pItemsCount) pItemsCount.textContent = currentPurchaseProducts.length;
            if (pTotalBs) pTotalBs.textContent = `Bs. ${totalPurchaseBs.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (pTotalUsd) pTotalUsd.textContent = `$ ${totalPurchaseUsd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
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
            
            if (purchaseType === 'PRODUCTO' && currentPurchaseProducts.length === 0) {
                showToast("Debe agregar al menos un producto a la compra.", "error");
                return;
            }

            const docVal = container.querySelector('#pDocNumber')?.value.trim().toLowerCase();
            const supVal = container.querySelector('#pSupplier')?.value;
            if (docVal && supVal) {
                const exists = purchases.find(p => p.supplierId === supVal && p.docNumber && p.docNumber.toLowerCase() === docVal);
                if (exists) {
                    showToast("Este número de documento ya fue registrado para el proveedor seleccionado.", "error");
                    return;
                }
            }
            if (purchaseType === 'EQUIPO_UTENSILIO') {
                if (!window.currentEquipmentItems || window.currentEquipmentItems.length === 0) {
                    showToast("Debe agregar al menos un equipo a la compra.", "error");
                    return;
                }
                if (window.currentEquipmentItems.some(i => !i.name || i.qty <= 0 || i.costUsd < 0)) {
                    showToast("Complete los datos requeridos para cada equipo.", "error");
                    return;
                }
            }

            const btn = container.querySelector('#savePurchaseBtn');
            btn.disabled = true;
            btn.textContent = 'Procesando...';

            const businessId = localStorage.getItem('businessId');
            const currentShiftId = localStorage.getItem('currentShiftId');
            let creatorName = localStorage.getItem('employeeName') || localStorage.getItem('userRole') || 'admin';
            
            if (currentShiftId) {
                try {
                    const shiftDoc = await getDoc(doc(db, "businesses", businessId, "turnos", currentShiftId));
                    if (shiftDoc.exists() && shiftDoc.data().NOMBRE_USUARIO_LOGUEADO) {
                        creatorName = shiftDoc.data().NOMBRE_USUARIO_LOGUEADO;
                    }
                } catch (e) {
                    console.error("Error al buscar el turno para el creador:", e);
                }
            }
            
            // Build purchase object
            let purchaseData = {};

            if (purchaseType === 'GASTO_SERVICIO') {
                const pCreditorEl = container.querySelector('#pCreditor').value;
                const amt = parseNum(container.querySelector('#pExpenseAmount').value);
                if (!pCreditorEl || pCreditorEl === 'CREATE_NEW' || amt <= 0) {
                    showToast("Por favor complete el acreedor y el monto.", "error");
                    btn.disabled = false;
                    btn.textContent = 'Crear Gasto';
                    return;
                }
                
                purchaseData = {
                    purchaseType,
                    creditorId: pCreditorEl,
                    categoryId: container.querySelector('#pCategory').value,
                    description: container.querySelector('#pDescription').value,
                    bcvRate: parseNum(container.querySelector('#pExpenseBcvRate').value) || 1,
                    emissionDate: container.querySelector('#pExpenseDate').value,
                    receptionDate: container.querySelector('#pExpenseDate').value,
                    docType: 'RECIBO',
                    docNumber: 'S/N',
                    status: container.querySelector('#pExpenseStatus').value,
                    currency: container.querySelector('#pExpenseCurrency').value,
                    totalBs: totalPurchaseBs,
                    totalUsd: totalPurchaseUsd,
                    createdAt: new Date().toISOString(),
                    createdBy: creatorName
                };
            } else {
                purchaseData = {
                    purchaseType,
                    supplierId: container.querySelector('#pSupplier')?.value || null,
                    bcvRate: parseNum(container.querySelector('#pBcvRate')?.value) || 1,
                    emissionDate: container.querySelector('#pEmissionDate')?.value || todayStr,
                    receptionDate: container.querySelector('#pReceptionDate')?.value || todayStr,
                    docType: container.querySelector('#pDocType')?.value || null,
                    docNumber: container.querySelector('#pDocNumber')?.value || null,
                    status: pStatus?.value || 'PAGADO',
                    currency: pCurrency?.value || 'BS',
                    totalBs: totalPurchaseBs,
                    totalUsd: totalPurchaseUsd,
                    createdAt: new Date().toISOString(),
                    createdBy: creatorName
                };

                if (purchaseType === 'PRODUCTO') {
                    purchaseData.itemsCount = currentPurchaseProducts.reduce((acc, curr) => acc + curr.qty, 0);
                    purchaseData.products = currentPurchaseProducts;
                } else if (purchaseType === 'EQUIPO_UTENSILIO') {
                    purchaseData.itemsCount = window.currentEquipmentItems.reduce((acc, curr) => acc + curr.qty, 0);
                    purchaseData.equipmentItems = window.currentEquipmentItems;
                }
            }

            // Payment data if applicable
            if (purchaseType === 'GASTO_SERVICIO') {
                if (purchaseData.status === 'PAGADO') {
                    purchaseData.paymentDate = purchaseData.emissionDate;
                    purchaseData.paymentMethod = 'Efectivo'; // Default
                    purchaseData.receivedBs = purchaseData.currency === 'BS' ? totalPurchaseBs : 0;
                    purchaseData.receivedUsd = purchaseData.currency === 'USD' ? totalPurchaseUsd : 0;
                    purchaseData.equivalentUsd = totalPurchaseUsd;
                    purchaseData.reference = null;
                    purchaseData.pendingBalanceUsd = 0;
                } else {
                    purchaseData.pendingBalanceUsd = totalPurchaseUsd;
                }
            } else {
                if (pStatus.value === 'CONTADO' || pStatus.value === 'ABONO') {
                    purchaseData.paymentDate = pPaymentDate.value || pEmissionDate.value || todayStr;
                    purchaseData.paymentMethod = pPaymentMethod.value || 'Efectivo';
                    purchaseData.receivedBs = parseNum(pReceivedBs.value) || 0;
                    purchaseData.receivedUsd = parseNum(pReceivedUsd.value) || 0;
                    purchaseData.equivalentUsd = parseNum(pEquivalentUsd.value) || 0;
                    const pref = container.querySelector('#pReference');
                    purchaseData.reference = (pref && pref.value) ? pref.value : null;
                }
                purchaseData.pendingBalanceUsd = parseNum(pPendingBalance.value) || 0;
            }

            // Sanitizar currentPurchaseProducts (eliminar posibles undefined)
            if (purchaseType === 'PRODUCTO' && purchaseData.products) {
                purchaseData.products = purchaseData.products.map(p => {
                    const cleanP = {};
                    Object.keys(p).forEach(k => {
                        if (p[k] !== undefined) cleanP[k] = p[k];
                    });
                    return cleanP;
                });
            }

            try {
                // 0. Guardar la tasa BCV ingresada en el historial si es válida
                const selectedDate = purchaseData.emissionDate;
                const enteredRate = purchaseData.bcvRate;
                const isAdmin = localStorage.getItem('userRole') === 'admin' || localStorage.getItem('isOwner') === 'true';
                if (selectedDate && enteredRate > 0 && isAdmin) {
                    const safeDate = selectedDate.replace(/\//g, '-');
                    const bcvRef = doc(db, "global_bcv_history", safeDate);
                    const snap = await getDoc(bcvRef);
                    let currentEditCount = 1;
                    let canEdit = true;
                    if (snap.exists()) {
                        const data = snap.data();
                        if (data.editCount >= 3) canEdit = false;
                        else currentEditCount = (data.editCount || 1) + 1;
                    }
                    if (canEdit) {
                        await setDoc(bcvRef, { 
                            rate: enteredRate, 
                            updatedAt: new Date().toISOString(),
                            createdAt: snap.exists() ? snap.data().createdAt : new Date().toISOString(),
                            createdBy: localStorage.getItem('employeeName') || 'admin',
                            isManual: true,
                            editCount: currentEditCount
                        }, { merge: true });
                    }
                }

                // 1. Guardar la compra
                const newPurchaseRef = doc(collection(db, "businesses", businessId, "purchases"));
                await setDoc(newPurchaseRef, purchaseData);

                // 1.2 Si es un gasto recurrente, guardar/actualizar la plantilla
                if (purchaseType === 'GASTO_SERVICIO') {
                    const rec = container.querySelector('#pExpenseRecurrence').value;
                    if (rec !== 'NONE') {
                        const nextDate = container.querySelector('#pExpenseNextDueDate').value;
                        const templateData = {
                            creditorId: purchaseData.creditorId,
                            categoryId: purchaseData.categoryId,
                            description: purchaseData.description,
                            recurrenceType: rec,
                            amountUsd: totalPurchaseUsd, 
                            nextDueDate: nextDate,
                            updatedAt: new Date().toISOString()
                        };
                        
                        if (prefillData && prefillData.templateId) {
                            await updateDoc(doc(db, "businesses", businessId, "expense_templates", prefillData.templateId), templateData);
                        } else {
                            templateData.createdAt = new Date().toISOString();
                            await setDoc(doc(collection(db, "businesses", businessId, "expense_templates")), templateData);
                        }
                    }
                }

                // 1.5 Si hay pago inicial, crear el registro en la sub-colección de pagos
                if ((purchaseType !== 'GASTO_SERVICIO' && (purchaseData.status === 'CONTADO' || purchaseData.status === 'ABONO')) ||
                    (purchaseType === 'GASTO_SERVICIO' && purchaseData.status === 'PAGADO')) {
                    try {
                        const firstPaymentRef = doc(collection(db, "businesses", businessId, "purchases", newPurchaseRef.id, "payments"));
                        await setDoc(firstPaymentRef, {
                            date: purchaseData.paymentDate,
                            method: purchaseData.paymentMethod || 'Efectivo',
                            reference: purchaseData.reference || null,
                            amountBs: purchaseData.receivedBs || 0,
                            amountUsd: purchaseData.receivedUsd || 0,
                            equivalentUsd: purchaseData.equivalentUsd || 0,
                            createdAt: new Date().toISOString(),
                            type: 'INITIAL'
                        });
                    } catch(err) {
                        throw new Error("Error guardando el Pago: " + err.message);
                    }
                }

                // 2. Actualizar Inventario y Costos solo si es PRODUCTO
                if (purchaseType === 'PRODUCTO') {
                    for (let item of currentPurchaseProducts) {
                        try {
                            const prodRef = doc(db, "businesses", businessId, "products", item.id);
                            const prodSnap = await getDoc(prodRef);
                            if (prodSnap.exists()) {
                                const pData = prodSnap.data();
                                // Stock siempre en stockGeneral (Almacén General)
                                const currentGeneral = pData.stockGeneral ?? pData.stock ?? 0;
                                const newStockGeneral = currentGeneral + item.qty;
                                const newCostPerStockUnit = item.costPerStockUnitUsd || item.costUsd || 0;
                                const factor = pData.stockToRecipeFactor || 1;
                                const newCostPerRecipeUnit = factor > 0 ? newCostPerStockUnit / factor : newCostPerStockUnit;

                                const formatPrice = (num) => {
                                    if (num < 1) return Number(num.toFixed(3));
                                    return Math.round(num * 20) / 20;
                                };
                                let mDetal = 1.30, mMayor = 1.25, mSpecial = 1.20;
                                if (pData.category === 'RECETA') { mDetal = 2.60; mMayor = 2.50; mSpecial = 2.40; }

                                await updateDoc(prodRef, {
                                    stockGeneral: newStockGeneral,
                                    cost: newCostPerStockUnit,
                                    costPerStockUnit: newCostPerStockUnit,
                                    costPerRecipeUnit: newCostPerRecipeUnit,
                                    priceDetal: formatPrice(newCostPerStockUnit * mDetal),
                                    priceMayor: formatPrice(newCostPerStockUnit * mMayor),
                                    priceSpecial: formatPrice(newCostPerStockUnit * mSpecial)
                                });
                            }
                        } catch(err) {
                            throw new Error("Error actualizando inventario (" + item.name + "): " + err.message);
                        }
                    }
                } else if (purchaseType === 'EQUIPO_UTENSILIO') {
                    for (let eq of window.currentEquipmentItems) {
                        try {
                            const eqRef = doc(collection(db, "businesses", businessId, "equipment"));
                            await setDoc(eqRef, {
                                name: eq.name,
                                description: eq.description || null,
                                serial: eq.serial || null,
                                qty: eq.qty || 1,
                                costUsd: eq.costUsd || 0,
                                totalCostUsd: (eq.qty || 1) * (eq.costUsd || 0),
                                purchaseId: newPurchaseRef.id,
                                supplierId: purchaseData.supplierId,
                                purchaseDate: purchaseData.emissionDate,
                                status: 'ACTIVO',
                                createdAt: new Date().toISOString(),
                                createdBy: creatorName
                            });
                        } catch(err) {
                            throw new Error("Error registrando equipo: " + err.message);
                        }
                    }
                }

                showToast("Compra registrada correctamente y el inventario ha sido actualizado.", "success");
                await loadData(); // Reload everything and go back to deck

            } catch (error) {
                console.error("Error guardando compra:", error);
                showToast("Error: " + (error.message || "Desconocido"), "error");
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
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <button type="button" class="btn btn-outline" id="pbBackBtn" style="height: 38px; width: auto; border-radius: 12px; font-weight: 700; font-size: 0.85rem; padding: 0.5rem 1rem; flex-shrink: 0;">← Volver</button>
                    <h2 style="margin: 0; color: var(--primary); font-size: 1.5rem; font-weight: 800; white-space: nowrap;">📦 Seleccionar Productos</h2>
                </div>
                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" class="btn btn-outline" id="pbPauseBtn" style="width: auto; height: 42px; font-weight: 700; padding: 0 1.5rem; border-radius: 12px; color: var(--info, #3b82f6); border-color: var(--info, #3b82f6);">PAUSAR</button>
                    <button type="button" class="btn btn-outline" id="pbCancelBtn" style="width: auto; height: 42px; font-weight: 700; padding: 0 1.5rem; border-radius: 12px;">DESCARTAR</button>
                    <button type="button" class="btn btn-primary" id="pbProcessBtn" style="width: auto; height: 42px; font-weight: 800; padding: 0 1.5rem; border-radius: 12px;">PROCESAR</button>
                </div>
            </div>
            <div style="flex: 1; display: flex; overflow: hidden;" class="flex-stack-mobile">
                <!-- Lado Izquierdo: Catálogo -->
                <div style="flex: 1; display: flex; flex-direction: column; background: var(--background); border-right: 1px solid var(--border);">
                    <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column; gap: 0.75rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="margin-bottom: 4px; font-weight: 800; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Buscar en catálogo</label>
                            <div style="display: flex; gap: 0.5rem;">
                                <input type="search" id="pbSearch" class="form-control" placeholder="Nombre del producto..." style="height: 40px; flex: 1;">
                                <button class="btn btn-outline" id="pbCreateProductBtn" style="height: 40px; border-color: var(--primary); color: var(--primary); font-weight: 700; font-size: 0.8rem; border-style: dashed; padding: 0; white-space: nowrap; flex: 1;">+ CREAR PRODUCTO</button>
                            </div>
                        </div>
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
        // Bugfix: Evitar que si había scroll en el body el modal no se vea completo
        window.scrollTo({ top: 0, behavior: 'smooth' });

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
                    const matchesSupplier = p.supplierId === targetSupplierId || (p.supplierIds && p.supplierIds.includes(targetSupplierId));
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
                if (lblQty) lblQty.textContent = `CANTIDAD RECIBIDA (${purchaseUnit.toUpperCase()})`;
            } else if (prod.presentationType && units.includes(prod.presentationType)) {
                receptionSelect.value = prod.presentationType;
                if (lblQty) lblQty.textContent = `CANTIDAD RECIBIDA`;
            } else {
                receptionSelect.value = "Unidad";
                if (lblQty) lblQty.textContent = `CANTIDAD RECIBIDA`;
            }

            receptionSelect.addEventListener('change', (e) => {
                if (lblQty) {
                    lblQty.textContent = `CANTIDAD RECIBIDA (${e.target.value === 'Unidad' ? 'UNIDAD (SUELTO)' : e.target.value.toUpperCase()})`;
                }
            });

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

                    const selectedRecType = receptionSelect.value;
                    let actualPurchaseToStockQty = 1;
                    
                    if (selectedRecType === purchaseUnit) {
                        actualPurchaseToStockQty = purchaseToStockQty;
                    } else if (selectedRecType === 'Unidad') {
                        actualPurchaseToStockQty = 1;
                    } else {
                        actualPurchaseToStockQty = 1; 
                    }

                    // El stockGeneral siempre debe guardar la unidad de stock (nivel 2), no la unidad base (nivel 3).
                    // La conversión a unidad base (receta) se hace con el factor de precisión en inventory.js.

                    const stockQtyReceived = qty * actualPurchaseToStockQty;
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
                        purchaseUnit: selectedRecType,
                        purchaseToStockQty: actualPurchaseToStockQty,
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
                const costDisplay = (p.qty && p.qty > 0) ? (p.subTotalUsd / p.qty) : 0;
                return `
                <tr style="border-bottom: 1px solid var(--border);" data-index="${index}">
                    <td style="padding: 0.5rem; font-size: 0.9rem;">${p.name}</td>
                    <td style="padding: 0.5rem; font-size: 0.9rem;">
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <input type="text" inputmode="numeric" class="form-control edit-qty" value="${(p.qty || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}" style="width: 80px; height: 30px; padding: 0.25rem; font-size: 0.85rem; text-align: center;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${p.stockUnit || 'ud'}</span>
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
                    
                    p.qty = newQty;
                    p.purchaseQty = (p.purchaseToStockQty || 1) > 0 ? newQty / (p.purchaseToStockQty || 1) : newQty;
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
                purchaseType: 'PRODUCTO',
                supplierId: container.querySelector('#pSupplier')?.value || '',
                bcvRate: container.querySelector('#pBcvRate')?.value || '',
                emissionDate: container.querySelector('#pEmissionDate')?.value || '',
                receptionDate: container.querySelector('#pReceptionDate')?.value || '',
                docType: container.querySelector('#pDocType')?.value || '',
                docNumber: container.querySelector('#pDocNumber')?.value || '',
                status: container.querySelector('#pStatus')?.value || '',
                currency: container.querySelector('#pCurrency')?.value || 'BS',
                paymentDate: container.querySelector('#pPaymentDate')?.value || '',
                paymentMethod: container.querySelector('#pPaymentMethod')?.value || '',
                receivedBs: container.querySelector('#pReceivedBs')?.value || '',
                receivedUsd: container.querySelector('#pReceivedUsd')?.value || '',
                products: tempProducts,
                openProductBuilder: true
            };
            window.openCreateProductForPurchase = true;
            document.getElementById('navProductos').click();
        });

        modal.querySelector('#pbPauseBtn').addEventListener('click', () => {
            if (typeof window.savePurchaseStateAndExit === 'function') {
                window.savePurchaseStateAndExit(tempProducts);
            }
            modal.style.display = 'none';
        });

        modal.querySelector('#pbCancelBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.querySelector('#pbBackBtn').addEventListener('click', () => {
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
            
            <div class="card mb-4" style="padding: 1rem 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <!-- Left -->
                    <div>
                        <h3 style="color: var(--primary); margin-bottom: 0.25rem;">${supName}</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">Tasa Factura: Bs. ${purchase.bcvRate} | Creado por: ${purchase.createdBy}</p>
                    </div>
                    
                    <!-- Metadata Items -->
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha Emisión</p>
                        <p style="font-weight: 500;">${formatDateToDDMMYYYY(purchase.emissionDate)}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Fecha Recepción</p>
                        <p style="font-weight: 500;">${formatDateToDDMMYYYY(purchase.receptionDate)}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Moneda Original</p>
                        <p style="font-weight: 500;">${purchase.currency === 'BS' ? 'BOLÍVARES' : 'DÓLARES'}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Total Items</p>
                        <p style="font-weight: 500;">${purchase.itemsCount || 0}</p>
                    </div>

                    <!-- Right -->
                    <div style="text-align: right;">
                        <span style="display: inline-block; padding: 0.3rem 0.6rem; border-radius: 12px; background: ${badgeColor}20; color: ${badgeColor}; font-weight: bold; font-size: 0.8rem; margin-bottom: 0.5rem;">
                            ESTADO: ${purchase.status}
                        </span>
                        <p style="font-weight: bold; font-size: 1.1rem;">${purchase.docType} N° ${purchase.docNumber}</p>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 1.5rem; align-items: stretch; margin-bottom: 1.5rem;">
                <!-- Productos Recibidos (Izquierda) -->
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
                                ${purchase.products.map(p => {
                                    const subTotalBs = p.subTotalBs || (p.costBs * p.qty);
                                    return `
                                    <tr>
                                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${p.name}</td>
                                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">${p.qty} ${p.stockUnit || 'ud'}</td>
                                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">$ ${p.costUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border);">Bs. ${p.costBs.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border); font-weight: bold; color: var(--primary);">$ ${p.subTotalUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border); font-weight: bold; color: var(--text-main);">Bs. ${subTotalBs.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Columna Derecha -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <!-- Totales (Arriba) -->
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

                    <!-- Historial de Pagos (Abajo) -->
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
                                                <td style="padding: 0.5rem;">${formatDateToDDMMYYYY(p.date)}</td>
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
                </div>
            </div>
        `;

        container.innerHTML = html;
        container.querySelector('#backToDeckBtn').addEventListener('click', goBackToDeck);

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
                    else goBackToDeck();
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
