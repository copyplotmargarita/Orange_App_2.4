import { db, auth } from '../services/firebase.js';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

import { showNotification, toTitleCase } from '../utils.js';
import { FinanceService } from '../services/financeService.js';

export async function renderSettings(mainContentArea) {
    const businessId = localStorage.getItem('businessId');
    if (!businessId) return;

    let allBanks = [];
    let currentEditingId = null;
    let businessData = {}; // Para guardar el estado actual

    mainContentArea.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
            <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
            <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">⚙️ Ajustes del Sistema</h2>
        </div>
        <div class="settings-stack">

            <!-- 1. PERFIL DEL NEGOCIO -->
            <div class="card compact-card mb-3">
                <div class="card-header-custom">🏢 Perfil del Negocio</div>
                <form id="businessProfileForm">
                    <div class="form-group mb-2">
                        <label>Nombre Comercial <span style="font-size:0.65rem; color:var(--text-muted); font-weight:400; text-transform:none;">🔒 No editable</span></label>
                        <input type="text" id="editBusinessName" class="form-control sm" readonly style="opacity:0.6; cursor:not-allowed; background:var(--background);">
                    </div>
                    <div class="form-group mb-2">
                        <label>Documento (RIF / Cédula) <span style="font-size:0.65rem; color:var(--text-muted); font-weight:400; text-transform:none;">🔒 No editable</span></label>
                        <div class="input-group-custom" style="opacity:0.6; cursor:not-allowed;">
                            <select id="editBusinessDocPrefix" class="form-control sm prefix-select" disabled style="cursor:not-allowed; background:var(--background);">
                                <option value="J-">J-</option>
                                <option value="V-">V-</option>
                                <option value="G-">G-</option>
                                <option value="E-">E-</option>
                            </select>
                            <input type="text" id="editBusinessDoc" class="form-control sm" readonly style="cursor:not-allowed; background:var(--background);">
                        </div>
                        <p style="font-size:0.65rem; color:var(--text-muted); margin-top:0.25rem;">Para modificar estos datos contacta al soporte.</p>
                    </div>
                    <div class="form-group mb-2">
                        <label>País</label>
                        <input type="text" id="editCountry" class="form-control sm" readonly>
                    </div>
                    <div class="grid-2 mb-2">
                        <div class="form-group">
                            <label>Estado</label>
                            <input type="text" id="stateSelect" class="form-control sm" readonly>
                        </div>
                        <div class="form-group">
                            <label>Ciudad / Municipio</label>
                            <input type="text" id="municipalitySelect" class="form-control sm" readonly>
                        </div>
                    </div>
                    <div class="form-group mb-3">
                        <label>Dirección Física</label>
                        <input type="text" id="editBusinessAddress" class="form-control sm" required>
                    </div>
                    <div class="form-group mb-3">
                        <label>Correo Electrónico <span style="font-size:0.65rem; color:var(--text-muted); font-weight:400; text-transform:none;">🔒 No editable</span></label>
                        <input type="email" id="editBusinessEmail" class="form-control sm" readonly style="opacity:0.6; cursor:not-allowed; background:var(--background);">
                    </div>
                    <div class="logo-edit-box">
                        <div id="settingsLogoPreview" class="logo-preview-sm"><span>🖼️</span></div>
                        <div style="flex:1">
                            <label class="text-sm">Logo de la Empresa</label>
                            <input type="file" id="newLogoInput" accept="image/*" style="display: none;">
                            <button type="button" class="btn btn-outline btn-xs" style="width: fit-content;" onclick="document.getElementById('newLogoInput').click()">Subir nuevo logo</button>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-sm w-100 mt-3" id="saveBusinessBtn">💾 Actualizar Perfil</button>
                </form>
            </div>
            <!-- 2. CUENTAS BANCARIAS -->
            <div class="card compact-card mb-3">
                <div class="card-header-custom">🏦 Cuentas Bancarias</div>
                <form id="bankAccountForm" class="bank-form-compact mb-3">
                    <div class="form-group mb-2" style="position: relative;">
                        <label>Banco</label>
                        <input type="text" id="bankName" class="form-control sm" placeholder="Ej. Banesco" autocomplete="off" required>
                        <div id="bankSuggestions" class="suggestions-panel"></div>
                    </div>
                    <div class="grid-2 mb-2">
                        <div class="form-group"><label>Tipo</label><select id="accountType" class="form-control sm" required><option value="Corriente">Corriente</option><option value="Pago Móvil">Pago Móvil</option><option value="Ahorro">Ahorro</option><option value="Zelle / ACH">Zelle / ACH</option></select></div>
                        <div class="form-group"><label>Moneda</label><select id="accountCurrency" class="form-control sm" required><option value="BS">BS</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="COP">COP</option></select></div>
                    </div>
                    <div id="pagoMovilGrid" class="grid-2 mb-2" style="display: none;">
                        <div class="form-group"><label>Teléfono</label><input type="tel" id="pagoMovilPhone" class="form-control sm"></div>
                        <div class="form-group"><label>Documento ID</label><div class="input-group-custom"><select id="bankAccPrefix" class="form-control sm prefix-select"><option value="V-">V-</option><option value="E-">E-</option><option value="G-">G-</option><option value="J-">J-</option></select><input type="text" id="bankAccDoc" class="form-control sm"></div></div>
                    </div>
                    <div id="bankHolderGrid" class="grid-2 mb-2" style="display: grid;">
                        <div class="form-group"><label>Nombre del Titular</label><input type="text" id="bankAccHolder" class="form-control sm"></div>
                        <div class="form-group"><label>Documento ID</label><div class="input-group-custom"><select id="bankAccHolderPrefix" class="form-control sm prefix-select"><option value="V-">V-</option><option value="E-">E-</option><option value="G-">G-</option><option value="J-">J-</option></select><input type="text" id="bankAccHolderDoc" class="form-control sm"></div></div>
                    </div>
                    <div id="normalAccFormat" class="form-group mb-2"><label>Número de Cuenta</label><input type="text" id="accountNumber" class="form-control sm" required></div>
                    <button type="submit" class="btn btn-primary btn-sm w-100 mt-2">＋ Añadir Cuenta</button>
                </form>
                <div id="bankAccountsList"></div>
            </div>

            <!-- 3. DATOS DEL PROPIETARIO -->
            <div class="card compact-card mb-3">
                <div class="card-header-custom">👤 Datos del Propietario</div>
                <form id="ownerProfileForm">
                    <div class="form-group mb-2">
                        <label>Nombre Completo</label>
                        <input type="text" id="editOwnerName" class="form-control sm" required>
                    </div>
                    <div class="grid-2 mb-3">
                        <div class="form-group"><label>Teléfono de Contacto</label><input type="tel" id="editOwnerPhone" class="form-control sm" required></div>
                        <div class="form-group"><label>Cédula</label><div class="input-group-custom"><select id="editOwnerDocPrefix" class="form-control sm prefix-select"><option value="V-">V-</option><option value="E-">E-</option></select><input type="text" id="editOwnerDoc" class="form-control sm" required></div></div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-sm w-100">💾 Actualizar Propietario</button>
                </form>
            </div>

            <!-- 4. TEMAS -->
            <div class="card compact-card mb-5">
                <div class="card-header-custom">🎨 Tema de la App</div>
                <div class="theme-grid-compact">
                    <div class="theme-dot" data-theme="default" style="background: #e2e8f0; border: 2px solid #cbd5e1; color: #64748b; display: flex; align-items: center; justify-content: center; font-weight: bold;" title="Tema Original">∅</div>
                    <div id="settingsThemeToggle" class="theme-dot" style="background: var(--background); border: 2px solid var(--border); color: var(--text-main); display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer;" title="Cambiar Modo Claro/Oscuro">☀️</div>
                    <div class="theme-dot" data-theme="orange" style="background: #f97316;"></div>
                    <div class="theme-dot" data-theme="blue" style="background: #3b82f6;"></div>
                    <div class="theme-dot" data-theme="emerald" style="background: #10b981;"></div>
                    <div class="theme-dot" data-theme="slate" style="background: #94a3b8;"></div>
                    <div class="theme-dot" data-theme="gratitud" style="background: #85825a;" title="Tema Gratitud"></div>
                </div>
            </div>
        </div>

        <!-- MODAL -->
        <div id="bankEditModal" class="modal-overlay" style="display: none;">
            <div class="modal-content card compact-card">
                <div class="modal-header"><h3>🏦 Editar Cuenta</h3><button id="closeBankModal" class="btn-close">✕</button></div>
                <form id="editBankModalForm" class="bank-form-compact">
                    <div class="form-group mb-2" style="position: relative;"><label>Banco</label><input type="text" id="modalBankName" class="form-control sm" required><div id="modalBankSuggestions" class="suggestions-panel"></div></div>
                    <div class="grid-2 mb-2">
                        <div class="form-group"><label>Tipo</label><select id="modalAccountType" class="form-control sm"><option value="Corriente">Corriente</option><option value="Pago Móvil">Pago Móvil</option><option value="Ahorro">Ahorro</option><option value="Zelle / ACH">Zelle / ACH</option></select></div>
                        <div class="form-group"><label>Moneda</label><select id="modalAccountCurrency" class="form-control sm"><option value="BS">BS</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="COP">COP</option></select></div>
                    </div>
                    <div id="modalPmGrid" class="grid-2 mb-2" style="display: none;">
                        <div class="form-group"><label>Teléfono</label><input type="tel" id="modalPmPhone" class="form-control sm"></div>
                        <div class="form-group"><label>Documento</label><div class="input-group-custom"><select id="modalPmPrefix" class="form-control sm prefix-select"><option value="V-">V-</option><option value="E-">E-</option><option value="G-">G-</option><option value="J-">J-</option></select><input type="text" id="modalPmDoc" class="form-control sm"></div></div>
                    </div>
                    <div id="modalBankHolderGrid" class="grid-2 mb-2" style="display: grid;">
                        <div class="form-group"><label>Nombre del Titular</label><input type="text" id="modalBankAccHolder" class="form-control sm"></div>
                        <div class="form-group"><label>Documento ID</label><div class="input-group-custom"><select id="modalBankAccHolderPrefix" class="form-control sm prefix-select"><option value="V-">V-</option><option value="E-">E-</option><option value="G-">G-</option><option value="J-">J-</option></select><input type="text" id="modalBankAccHolderDoc" class="form-control sm"></div></div>
                    </div>
                    <div id="modalNormalAcc" class="form-group mb-3"><label>Número</label><input type="text" id="modalAccountNumber" class="form-control sm"></div>
                    <button type="submit" class="btn btn-primary btn-sm w-100">💾 Guardar Cambios</button>
                </form>
            </div>
        </div>

        <!-- MODAL ELIMINAR -->
        <div id="bankDeleteModal" class="modal-overlay" style="display: none;">
            <div class="modal-content card compact-card" style="max-width: 350px; text-align: center; padding: 2rem !important;">
                <div style="font-size: 3.5rem; margin-bottom: 1rem;">🗑️</div>
                <h3 style="color: var(--danger); font-size: 1.3rem; font-weight: 800; margin-bottom: 0.5rem;">Eliminar Cuenta</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.4;">¿Estás seguro de que deseas eliminar esta cuenta bancaria? Esta acción no se puede deshacer.</p>
                <div class="grid-2">
                    <button id="cancelDeleteBankBtn" class="btn btn-outline w-100">Cancelar</button>
                    <button id="confirmDeleteBankBtn" class="btn w-100" style="background: var(--danger); color: white; border: none;">Eliminar</button>
                </div>
            </div>
        </div>


        <style>
            .settings-stack { max-width: 500px; margin: 0 auto; animation: fadeIn 0.3s ease; }
            .compact-card { padding: 1.25rem !important; border-radius: 16px !important; background: var(--surface); border: 1px solid var(--border); border-top: 4px solid var(--primary); margin-bottom: 1.5rem; }
            .card-header-custom { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1rem; }
            .form-control.sm { padding: 0.5rem; border-radius: 8px; background: var(--background); border: 1px solid var(--border); color: var(--text-main); width: 100%; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
            .input-group-custom { display: flex; gap: 0.5rem; }
            .prefix-select { width: 75px !important; }
            #bankAccountsList { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem; }
            .bank-acc-item { background: var(--background); border: 1px solid var(--border); padding: 0.75rem; border-radius: 12px; position: relative; cursor: pointer; transition: 0.2s; }
            .bank-acc-item:hover { border-color: var(--primary); transform: translateY(-2px); }
            .bank-acc-item strong { color: var(--primary); font-size: 0.85rem; display: block; margin-bottom: 2px; }
            .bank-acc-item .acc-type { font-size: 0.65rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; display: block; }
            .bank-acc-item .acc-num { font-size: 0.75rem; color: var(--text-main); margin-top: 2px; }
            .delete-bank-btn { position: absolute; bottom: 8px; right: 8px; opacity: 0.4; background: transparent; border: none; cursor: pointer; }
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(4px); }
            .theme-grid-compact { display: flex; gap: 1rem; justify-content: center; }
            .theme-dot { width: 34px; height: 34px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; }
            .theme-dot.active { border-color: var(--text-main); }
            .logo-edit-box { display: flex; gap: 1rem; align-items: center; margin-bottom: 1.25rem; }
            .logo-preview-sm { width: 85px; height: 85px; background: var(--background); border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .logo-preview-sm img { width: 100%; height: 100%; object-fit: cover; }
            .logo-edit-box label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
            .suggestions-panel { position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; z-index: 1000; max-height: 200px; overflow-y: auto; display: none; box-shadow: var(--shadow-lg); }
            .suggestion-item { padding: 8px 12px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid var(--border); }
            .suggestion-item:hover { background: var(--background); color: var(--primary); }
            @keyframes fadeIn { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform: translateY(0); } }
        </style>
    `;



    // --- CARGA ---
    async function loadAllData() {
        try {
            const snap = await getDoc(doc(db, "businesses", businessId));
            if (snap.exists()) {
                businessData = snap.data();
                const d = businessData;
                mainContentArea.querySelector('#editBusinessName').value = d.name || '';
                mainContentArea.querySelector('#editBusinessAddress').value = d.address || '';
                if (mainContentArea.querySelector('#editBusinessEmail')) {
                    mainContentArea.querySelector('#editBusinessEmail').value = d.email || auth.currentUser?.email || localStorage.getItem('userEmail') || '';
                }
                mainContentArea.querySelector('#editOwnerName').value = d.ownerName || '';
                if (d.document?.includes('-')) {
                    const p = d.document.split('-');
                    mainContentArea.querySelector('#editBusinessDocPrefix').value = p[0] + '-';
                    mainContentArea.querySelector('#editBusinessDoc').value = p[1];
                }
                if (d.ownerDoc?.includes('-')) {
                    const p = d.ownerDoc.split('-');
                    mainContentArea.querySelector('#editOwnerDocPrefix').value = p[0] + '-';
                    mainContentArea.querySelector('#editOwnerDoc').value = p[1];
                }
                if (d.ownerPhone) window.intlTelInputGlobals.getInstance(mainContentArea.querySelector('#editOwnerPhone'))?.setNumber(d.ownerPhone);
                const pendingLogo = localStorage.getItem('pendingLogo');
                if (pendingLogo) {
                    mainContentArea.querySelector('#settingsLogoPreview').innerHTML = `<img src="${pendingLogo}">`;
                } else if (d.logoUrl) {
                    mainContentArea.querySelector('#settingsLogoPreview').innerHTML = `<img src="${d.logoUrl}">`;
                }
                
                loadBanks();

                mainContentArea.querySelector('#editCountry').value = d.country || '';
                mainContentArea.querySelector('#stateSelect').value = d.state || '';
                mainContentArea.querySelector('#municipalitySelect').value = d.municipality || '';
                
                if (d.countryCode) {
                    allBanks = await FinanceService.getBanksByCountry(d.countryCode);
                }
            }
        } catch (e) { console.error("Error cargando todo:", e); }
    }

    async function loadBanks() {
        const list = mainContentArea.querySelector('#bankAccountsList');
        const snap = await getDocs(collection(db, "businesses", businessId, "bank_accounts"));
        list.innerHTML = '';
        snap.forEach(docSnap => {
            const acc = docSnap.data();
            const div = document.createElement('div');
            div.className = 'bank-acc-item shadow-sm';
            let displayType = acc.type;
            if (acc.type === 'Corriente') displayType = 'Cuenta Corriente';
            else if (acc.type === 'Ahorro') displayType = 'Cuenta de Ahorros';
            div.innerHTML = `<span class="acc-type">${displayType}</span><strong>${acc.bank}</strong>${acc.holderDoc ? `<div class="acc-num">${acc.holderDoc}</div>` : ''}<div class="acc-num">${acc.number}</div>${acc.phone ? `<div class="acc-num" style="font-size:0.7rem; opacity:0.8;">📱 ${acc.phone}</div>` : ''}<button class="delete-bank-btn" data-id="${docSnap.id}">🗑️</button>`;
            div.onclick = (e) => { if(!e.target.classList.contains('delete-bank-btn')) openEditModal(docSnap.id, acc); };
            list.appendChild(div);
        });
        list.querySelectorAll('.delete-bank-btn').forEach(btn => {
            btn.onclick = (e) => { 
                e.stopPropagation(); 
                const bankId = btn.dataset.id;
                const deleteModal = mainContentArea.querySelector('#bankDeleteModal');
                deleteModal.style.display = 'flex';
                
                const confirmBtn = deleteModal.querySelector('#confirmDeleteBankBtn');
                const cancelBtn = deleteModal.querySelector('#cancelDeleteBankBtn');
                
                confirmBtn.onclick = async () => {
                    await deleteDoc(doc(db, "businesses", businessId, "bank_accounts", bankId)); 
                    deleteModal.style.display = 'none';
                    showNotification('Cuenta eliminada', 'success');
                    loadBanks(); 
                };
                
                cancelBtn.onclick = () => {
                    deleteModal.style.display = 'none';
                };
            };
        });
    }

    function openEditModal(id, data) {
        currentEditingId = id;
        const modal = mainContentArea.querySelector('#bankEditModal');
        modal.style.display = 'flex';
        modal.querySelector('#modalBankName').value = data.bank;
        modal.querySelector('#modalAccountCurrency').value = data.currency || 'BS';
        modal.querySelector('#modalAccountType').value = data.type;
        modal.querySelector('#modalAccountType').dispatchEvent(new Event('change'));
        
        modal.querySelector('#modalBankAccHolder').value = data.holderName || '';
        if (data.holderDoc?.includes('-')) {
            const p = data.holderDoc.split('-');
            modal.querySelector('#modalBankAccHolderPrefix').value = p[0] + '-';
            modal.querySelector('#modalBankAccHolderDoc').value = p[1];
        } else {
            modal.querySelector('#modalBankAccHolderDoc').value = data.holderDoc || '';
        }

        if (data.type === 'Pago Móvil') {
            if (data.number?.includes('-')) {
                const p = data.number.split('-');
                modal.querySelector('#modalPmPrefix').value = p[0] + '-';
                modal.querySelector('#modalPmDoc').value = p[1];
            } else modal.querySelector('#modalPmDoc').value = data.number;
            if (data.phone) window.intlTelInputGlobals.getInstance(modal.querySelector('#modalPmPhone'))?.setNumber(data.phone);
        } else {
            modal.querySelector('#modalAccountNumber').value = data.number;
        }
    }

    // --- LOGICA BANCOS ---
    const setupLogic = (area, prefix) => {
        const typeEl = area.querySelector(`#${prefix}accountType`) || area.querySelector(`#${prefix}AccountType`);
        const pmGrid = area.querySelector(`#${prefix}pagoMovilGrid`) || area.querySelector(`#${prefix}PmGrid`);
        const normalAcc = area.querySelector(`#${prefix}normalAccFormat`) || area.querySelector(`#${prefix}NormalAcc`);
        const bankHolderGrid = area.querySelector(`#${prefix}bankHolderGrid`) || area.querySelector(`#${prefix}BankHolderGrid`);
        const bankInput = area.querySelector(`#${prefix}bankName`) || area.querySelector(`#${prefix}BankName`);
        const suggestions = area.querySelector(`#${prefix}bankSuggestions`) || area.querySelector(`#${prefix}BankSuggestions`);

        if (typeEl) typeEl.onchange = (e) => {
            const isPM = e.target.value === 'Pago Móvil';
            const isNormalBank = e.target.value === 'Corriente' || e.target.value === 'Ahorro';
            if (pmGrid) pmGrid.style.display = isPM ? 'grid' : 'none';
            if (bankHolderGrid) bankHolderGrid.style.display = isNormalBank ? 'grid' : 'none';
            
            if (normalAcc) {
                normalAcc.style.display = isPM ? 'none' : 'block';
                const input = normalAcc.querySelector('input');
                if (input) input.required = !isPM;
            }
        };

        if (typeEl) typeEl.dispatchEvent(new Event('change'));

        if (bankInput) bankInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            if (!val) { suggestions.style.display = 'none'; return; }
            const filtered = allBanks.filter(b => b.toLowerCase().includes(val));
            if (filtered.length > 0) {
                suggestions.innerHTML = filtered.map(b => `<div class="suggestion-item">${b}</div>`).join('');
                suggestions.style.display = 'block';
                suggestions.querySelectorAll('.suggestion-item').forEach(item => {
                    item.onclick = () => { bankInput.value = item.textContent; suggestions.style.display = 'none'; };
                });
            } else suggestions.style.display = 'none';
        };
    };

    // --- GUARDADO ---
    mainContentArea.querySelector('#businessProfileForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const cSel = mainContentArea.querySelector('#editCountry');
            const countryName = cSel.selectedIndex > 0 ? cSel.options[cSel.selectedIndex].text : (businessData.country || '');
            
            const updates = { 
                name: toTitleCase(mainContentArea.querySelector('#editBusinessName').value),
                document: `${mainContentArea.querySelector('#editBusinessDocPrefix').value}${mainContentArea.querySelector('#editBusinessDoc').value}`,
                address: mainContentArea.querySelector('#editBusinessAddress').value,
                countryCode: cSel.value,
                country: countryName,
                state: mainContentArea.querySelector('#stateSelect')?.value || '',
                municipality: mainContentArea.querySelector('#municipalitySelect')?.value || ''
            };



            await updateDoc(doc(db, "businesses", businessId), updates);
            businessData = { ...businessData, ...updates };
            showNotification('Perfil actualizado', 'success');
        } catch (err) {
            console.error("Error guardando perfil:", err);
            showNotification('Error al guardar', 'error');
        }
    };

    mainContentArea.querySelector('#ownerProfileForm').onsubmit = async (e) => {
        e.preventDefault();
        await updateDoc(doc(db, "businesses", businessId), {
            ownerName: toTitleCase(mainContentArea.querySelector('#editOwnerName').value),
            ownerDoc: `${mainContentArea.querySelector('#editOwnerDocPrefix').value}${mainContentArea.querySelector('#editOwnerDoc').value}`,
            ownerPhone: window.intlTelInputGlobals.getInstance(mainContentArea.querySelector('#editOwnerPhone')).getNumber()
        });
        showNotification('Propietario actualizado', 'success');
    };

    mainContentArea.querySelector('#bankAccountForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const f = mainContentArea.querySelector('#bankAccountForm');
            const type = f.querySelector('#accountType').value;
            const num = (type === 'Pago Móvil') ? `${f.querySelector('#bankAccPrefix').value}${f.querySelector('#bankAccDoc').value}` : f.querySelector('#accountNumber').value;
            const data = { bank: toTitleCase(f.querySelector('#bankName').value), number: num, type: type, currency: f.querySelector('#accountCurrency').value, createdAt: new Date().toISOString() };
            
            if (type === 'Corriente' || type === 'Ahorro') {
                data.holderName = toTitleCase(f.querySelector('#bankAccHolder').value);
                const hDoc = f.querySelector('#bankAccHolderDoc').value;
                if (hDoc) data.holderDoc = `${f.querySelector('#bankAccHolderPrefix').value}${hDoc}`;
            }

            if (type === 'Pago Móvil') {
                const phoneInput = window.intlTelInputGlobals.getInstance(f.querySelector('#pagoMovilPhone'));
                if (phoneInput) {
                    data.phone = phoneInput.getNumber();
                } else {
                    console.warn("intlTelInput instance not found for #pagoMovilPhone");
                    data.phone = f.querySelector('#pagoMovilPhone').value;
                }
            }
            
            await addDoc(collection(db, "businesses", businessId, "bank_accounts"), data);
            await FinanceService.registerBankIfNew(mainContentArea.querySelector('#editCountry').value, data.bank);
            f.reset(); 
            loadBanks(); 
            showNotification('Cuenta añadida con éxito', 'success');
        } catch (err) {
            console.error("Error al añadir cuenta bancaria:", err);
            showNotification('Error al añadir cuenta: ' + err.message, 'error');
        }
    };

    mainContentArea.querySelector('#editBankModalForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = mainContentArea.querySelector('#editBankModalForm');
        const type = f.querySelector('#modalAccountType').value;
        const num = (type === 'Pago Móvil') ? `${f.querySelector('#modalPmPrefix').value}${f.querySelector('#modalPmDoc').value}` : f.querySelector('#modalAccountNumber').value;
        const data = { bank: toTitleCase(f.querySelector('#modalBankName').value), number: num, type: type, currency: f.querySelector('#modalAccountCurrency').value, updatedAt: new Date().toISOString() };
        
        if (type === 'Corriente' || type === 'Ahorro') {
            data.holderName = toTitleCase(f.querySelector('#modalBankAccHolder').value);
            const hDoc = f.querySelector('#modalBankAccHolderDoc').value;
            if (hDoc) data.holderDoc = `${f.querySelector('#modalBankAccHolderPrefix').value}${hDoc}`;
        }

        if (type === 'Pago Móvil') data.phone = window.intlTelInputGlobals.getInstance(f.querySelector('#modalPmPhone')).getNumber();
        await updateDoc(doc(db, "businesses", businessId, "bank_accounts", currentEditingId), data);
        mainContentArea.querySelector('#bankEditModal').style.display = 'none'; loadBanks(); showNotification('Actualizada', 'success');
    };

    // --- INICAR ---
    window.intlTelInput(mainContentArea.querySelector('#editOwnerPhone'), { initialCountry: "ve", preferredCountries: ["ve", "co"], utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js" });
    window.intlTelInput(mainContentArea.querySelector('#pagoMovilPhone'), { initialCountry: "ve", preferredCountries: ["ve", "co"], utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js" });
    window.intlTelInput(mainContentArea.querySelector('#modalPmPhone'), { initialCountry: "ve", preferredCountries: ["ve", "co"], utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js" });
    function resizeImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    const logoInput = mainContentArea.querySelector('#newLogoInput');
    if (logoInput) {
        logoInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    showNotification('⚙️ Procesando imagen...', 'info');
                    const base64 = await resizeImage(file, 200, 200);
                    mainContentArea.querySelector('#settingsLogoPreview').innerHTML = `<img src="${base64}">`;
                    
                    showNotification('💾 Guardando logo en la base de datos...', 'info');
                    console.log('Iniciando actualización de documento en Firestore...');
                    await updateDoc(doc(db, "businesses", businessId), { logoUrl: base64 });
                    console.log('Documento actualizado con éxito.');
                    
                    showNotification('✅ Logo guardado correctamente!', 'success');
                    localStorage.setItem('businessLogo', base64); // Actualizar cache local
                } catch (err) {
                    console.error("Error al procesar/guardar logo:", err);
                    showNotification('❌ Error al guardar el logo', 'error');
                }
            }
        };
    }
    setupLogic(mainContentArea, '');
    setupLogic(mainContentArea.querySelector('#bankEditModal'), 'modal');
    mainContentArea.querySelector('#closeBankModal').onclick = () => mainContentArea.querySelector('#bankEditModal').style.display = 'none';

    // Temas
    const themes = { orange: { p: '#f97316', h: '#ea580c', r: '249, 115, 22', bg: '#0f172a', surf: '#1e293b', bord: '#334155' }, blue: { p: '#3b82f6', h: '#2563eb', r: '59, 130, 246', bg: '#020617', surf: '#0f172a', bord: '#1e293b' }, emerald: { p: '#10b981', h: '#059669', r: '16, 185, 129', bg: '#061a14', surf: '#0a2e24', bord: '#134e4a' }, slate: { p: '#94a3b8', h: '#64748b', r: '148, 163, 184', bg: '#18181b', surf: '#27272a', bord: '#3f3f46' }, gratitud: { p: '#85825a', h: '#6c6a49', r: '133, 130, 90', bg: '#1c1c1a', surf: '#272724', bord: '#3c3c36' } };
    mainContentArea.querySelectorAll('.theme-dot').forEach(dot => {
        dot.onclick = () => {
            const k = dot.dataset.theme; 
            const root = document.documentElement;
            
            if (k === 'default') {
                localStorage.removeItem('accentTheme');
                ['--primary', '--primary-hover', '--primary-rgb', '--background', '--surface', '--border'].forEach(p => root.style.removeProperty(p));
                mainContentArea.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active')); 
                dot.classList.add('active');
                showNotification(`Tema original restaurado`, 'info');
                return;
            }
            
            const t = themes[k]; 
            root.style.setProperty('--primary', t.p); 
            root.style.setProperty('--primary-hover', t.h); 
            root.style.setProperty('--primary-rgb', t.r); 
            root.style.setProperty('--background', t.bg); 
            root.style.setProperty('--surface', t.surf); 
            root.style.setProperty('--border', t.bord);
            localStorage.setItem('accentTheme', k);
            mainContentArea.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active')); 
            dot.classList.add('active');
            showNotification(`Atmósfera aplicada`, 'info');
        };
    });

    // Lógica botón volver
    const backBtn = mainContentArea.querySelector('#backToDashboardBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('navHome')?.click();

        });
    }

    // Lógica para el botón de Modo Claro/Oscuro en Ajustes
    const settingsThemeToggle = mainContentArea.querySelector('#settingsThemeToggle');
    if (settingsThemeToggle) {
        const currentTheme = localStorage.getItem('theme') || 'dark';
        settingsThemeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
        
        settingsThemeToggle.onclick = () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                settingsThemeToggle.textContent = '🌙';
                showNotification('Modo claro activado', 'info');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                settingsThemeToggle.textContent = '☀️';
                showNotification('Modo oscuro activado', 'info');
            }
        };
    }

    loadAllData();
}
