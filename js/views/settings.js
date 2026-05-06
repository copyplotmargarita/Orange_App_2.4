import { db, auth, storage } from '../services/firebase.js';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";
import { showNotification, toTitleCase } from '../utils.js';
import { FinanceService } from '../services/financeService.js';

export async function renderSettings(mainContentArea) {
    const businessId = localStorage.getItem('businessId');
    if (!businessId) return;

    let allBanks = [];
    let currentEditingId = null;
    let businessData = {}; // Para guardar el estado actual

    mainContentArea.innerHTML = `
        <div class="settings-stack">
            <div class="settings-header text-center">
                <h2>⚙️ Ajustes del Sistema</h2>
                <p>Configura tu identidad y preferencias</p>
            </div>

            <!-- 1. PERFIL DEL NEGOCIO -->
            <div class="card compact-card mb-3">
                <div class="card-header-custom">🏢 Perfil del Negocio</div>
                <form id="businessProfileForm">
                    <div class="form-group mb-2">
                        <label>Nombre Comercial</label>
                        <input type="text" id="editBusinessName" class="form-control sm" required>
                    </div>
                    <div class="form-group mb-2">
                        <label>Documento (RIF / Cédula)</label>
                        <div class="input-group-custom">
                            <select id="editBusinessDocPrefix" class="form-control sm prefix-select">
                                <option value="J-">J-</option>
                                <option value="V-">V-</option>
                                <option value="G-">G-</option>
                                <option value="E-">E-</option>
                            </select>
                            <input type="text" id="editBusinessDoc" class="form-control sm" required>
                        </div>
                    </div>
                    <div class="form-group mb-2">
                        <label>País</label>
                        <select id="editCountry" class="form-control sm" required>
                            <option value="">Seleccione país</option>
                        </select>
                    </div>
                    <div class="grid-2 mb-2">
                        <div class="form-group" id="stateContainer">
                            <label>Estado</label>
                            <select id="stateSelect" class="form-control sm" required>
                                <option value="">Seleccione país</option>
                            </select>
                        </div>
                        <div class="form-group" id="municipalityContainer">
                            <label>Ciudad / Municipio</label>
                            <select id="municipalitySelect" class="form-control sm" required>
                                <option value="">Seleccione estado</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group mb-3">
                        <label>Dirección Física</label>
                        <input type="text" id="editBusinessAddress" class="form-control sm" required>
                    </div>
                    <div class="logo-edit-box">
                        <div id="settingsLogoPreview" class="logo-preview-sm"><span>🖼️</span></div>
                        <div style="flex:1">
                            <label class="text-sm">Logo de la Empresa</label>
                            <input type="file" id="newLogoInput" accept="image/*" style="display: none;">
                            <button type="button" class="btn btn-outline btn-xs w-100" onclick="document.getElementById('newLogoInput').click()">Subir nuevo logo</button>
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
                        <div class="form-group"><label>Documento ID</label><div class="input-group-custom"><select id="bankAccPrefix" class="form-control sm prefix-select"><option value="V-">V-</option><option value="J-">J-</option></select><input type="text" id="bankAccDoc" class="form-control sm"></div></div>
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
                    <div class="theme-dot" data-theme="orange" style="background: #f97316;"></div>
                    <div class="theme-dot" data-theme="blue" style="background: #3b82f6;"></div>
                    <div class="theme-dot" data-theme="emerald" style="background: #10b981;"></div>
                    <div class="theme-dot" data-theme="slate" style="background: #94a3b8;"></div>
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
                        <div class="form-group"><label>Tipo</label><select id="modalAccountType" class="form-control sm"><option value="Corriente">Corriente</option><option value="Pago Móvil">Pago Móvil</option></select></div>
                        <div class="form-group"><label>Moneda</label><select id="modalAccountCurrency" class="form-control sm"><option value="BS">BS</option><option value="USD">USD</option></select></div>
                    </div>
                    <div id="modalPmGrid" class="grid-2 mb-2" style="display: none;">
                        <div class="form-group"><label>Teléfono</label><input type="tel" id="modalPmPhone" class="form-control sm"></div>
                        <div class="form-group"><label>Documento</label><div class="input-group-custom"><select id="modalPmPrefix" class="form-control sm prefix-select"><option value="V-">V-</option></select><input type="text" id="modalPmDoc" class="form-control sm"></div></div>
                    </div>
                    <div id="modalNormalAcc" class="form-group mb-3"><label>Número</label><input type="text" id="modalAccountNumber" class="form-control sm"></div>
                    <button type="submit" class="btn btn-primary btn-sm w-100">💾 Guardar Cambios</button>
                </form>
            </div>
        </div>

        <style>
            .settings-stack { max-width: 500px; margin: 0 auto; animation: fadeIn 0.3s ease; }
            .compact-card { padding: 1.25rem !important; border-radius: 16px !important; background: var(--surface); border: 1px solid var(--border); }
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
            .logo-preview-sm img { width: 45px; height: 45px; object-fit: cover; border-radius: 8px; }
            .suggestions-panel { position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; z-index: 1000; max-height: 200px; overflow-y: auto; display: none; box-shadow: var(--shadow-lg); }
            .suggestion-item { padding: 8px 12px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid var(--border); }
            .suggestion-item:hover { background: var(--background); color: var(--primary); }
            @keyframes fadeIn { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform: translateY(0); } }
        </style>
    `;

    // --- GEOGRAFÍA ---
    async function toggleField(containerId, fieldId, isSelect) {
        const container = mainContentArea.querySelector(`#${containerId}`);
        if (!container) return;
        const label = fieldId === 'municipalitySelect' ? 'Ciudad / Municipio' : 'Estado';
        if (isSelect) {
            container.innerHTML = `<label>${label}</label><select id="${fieldId}" class="form-control sm" required><option value="">Seleccione...</option></select>`;
            if (fieldId === 'stateSelect') container.querySelector('select').onchange = (e) => handleStateChange(e.target.value);
        } else container.innerHTML = `<label>${label}</label><input type="text" id="${fieldId}" class="form-control sm" required>`;
    }

    async function loadStates(iso2, initialValue = null) {
        await toggleField('stateContainer', 'stateSelect', true);
        const sel = mainContentArea.querySelector('#stateSelect');
        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ iso2 })
            });
            const data = await res.json();
            if (!data.error && data.data.states.length > 0) {
                sel.innerHTML = '<option value="">Seleccione...</option>';
                data.data.states.forEach(s => {
                    const opt = document.createElement('option'); opt.value = s.name; opt.textContent = s.name;
                    if (s.name === initialValue) opt.selected = true;
                    sel.appendChild(opt);
                });
                if (initialValue) await handleStateChange(initialValue);
            } else await toggleField('stateContainer', 'stateSelect', false);
        } catch (e) { await toggleField('stateContainer', 'stateSelect', false); }
    }

    async function handleStateChange(stateName, initialCity = null) {
        await toggleField('municipalityContainer', 'municipalitySelect', true);
        const sel = mainContentArea.querySelector('#municipalitySelect');
        const countrySelect = mainContentArea.querySelector('#editCountry');
        const countryName = countrySelect.options[countrySelect.selectedIndex]?.text || businessData.country || '';
        if (!countryName || !stateName || countryName.includes('Seleccione')) return;
        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: countryName, state: stateName })
            });
            const data = await res.json();
            if (!data.error && data.data.length > 0) {
                sel.innerHTML = '<option value="">Seleccione...</option>';
                data.data.forEach(c => {
                    const opt = document.createElement('option'); opt.value = c; opt.textContent = c;
                    if (c === initialCity) opt.selected = true;
                    sel.appendChild(opt);
                });
            } else await toggleField('municipalityContainer', 'municipalitySelect', false);
        } catch (e) { await toggleField('municipalityContainer', 'municipalitySelect', false); }
    }

    // --- CARGA ---
    async function loadAllData() {
        try {
            const snap = await getDoc(doc(db, "businesses", businessId));
            if (snap.exists()) {
                businessData = snap.data();
                const d = businessData;
                mainContentArea.querySelector('#editBusinessName').value = d.name || '';
                mainContentArea.querySelector('#editBusinessAddress').value = d.address || '';
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
                if (d.logoUrl) mainContentArea.querySelector('#settingsLogoPreview').innerHTML = `<img src="${d.logoUrl}">`;
                
                loadBanks();

                const res = await fetch('https://countriesnow.space/api/v0.1/countries/iso');
                const geo = await res.json();
                if (geo.data) {
                    const countrySelect = mainContentArea.querySelector('#editCountry');
                    countrySelect.innerHTML = '<option value="">Seleccione país</option>' + geo.data.sort((a,b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.Iso2}" ${c.Iso2 === d.countryCode ? 'selected' : ''}>${c.name}</option>`).join('');
                    
                    if (d.countryCode) {
                        allBanks = await FinanceService.getBanksByCountry(d.countryCode);
                        await loadStates(d.countryCode, d.state);
                        if (d.state) await handleStateChange(d.state, d.municipality);
                    }
                    
                    countrySelect.onchange = async (e) => {
                        if (e.target.value) {
                            await loadStates(e.target.value);
                            allBanks = await FinanceService.getBanksByCountry(e.target.value);
                        }
                    };
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
            div.innerHTML = `<span class="acc-type">${acc.type}</span><strong>${acc.bank}</strong><div class="acc-num">${acc.number}</div>${acc.phone ? `<div class="acc-num" style="font-size:0.7rem; opacity:0.8;">📱 ${acc.phone}</div>` : ''}<button class="delete-bank-btn" data-id="${docSnap.id}">🗑️</button>`;
            div.onclick = (e) => { if(!e.target.classList.contains('delete-bank-btn')) openEditModal(docSnap.id, acc); };
            list.appendChild(div);
        });
        list.querySelectorAll('.delete-bank-btn').forEach(btn => {
            btn.onclick = async (e) => { e.stopPropagation(); if (confirm('¿Eliminar?')) { await deleteDoc(doc(db, "businesses", businessId, "bank_accounts", btn.dataset.id)); loadBanks(); } };
        });
    }

    function openEditModal(id, data) {
        currentEditingId = id;
        const modal = mainContentArea.querySelector('#bankEditModal');
        modal.style.display = 'flex';
        modal.querySelector('#modalBankName').value = data.bank;
        modal.querySelector('#modalAccountType').value = data.type;
        modal.querySelector('#modalAccountType').dispatchEvent(new Event('change'));
        if (data.type === 'Pago Móvil') {
            if (data.number?.includes('-')) {
                const p = data.number.split('-');
                modal.querySelector('#modalPmPrefix').value = p[0] + '-';
                modal.querySelector('#modalPmDoc').value = p[1];
            } else modal.querySelector('#modalPmDoc').value = data.number;
            if (data.phone) window.intlTelInputGlobals.getInstance(modal.querySelector('#modalPmPhone'))?.setNumber(data.phone);
        } else modal.querySelector('#modalAccountNumber').value = data.number;
    }

    // --- LOGICA BANCOS ---
    const setupLogic = (area, prefix) => {
        const typeEl = area.querySelector(`#${prefix}accountType`) || area.querySelector(`#${prefix}AccountType`);
        const pmGrid = area.querySelector(`#${prefix}pagoMovilGrid`) || area.querySelector(`#${prefix}PmGrid`);
        const normalAcc = area.querySelector(`#${prefix}normalAccFormat`) || area.querySelector(`#${prefix}NormalAcc`);
        const bankInput = area.querySelector(`#${prefix}bankName`) || area.querySelector(`#${prefix}BankName`);
        const suggestions = area.querySelector(`#${prefix}bankSuggestions`) || area.querySelector(`#${prefix}BankSuggestions`);

        if (typeEl) typeEl.onchange = (e) => {
            const isPM = e.target.value === 'Pago Móvil';
            if (pmGrid) pmGrid.style.display = isPM ? 'grid' : 'none';
            if (normalAcc) normalAcc.style.display = isPM ? 'none' : 'block';
        };

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

            const logoFile = mainContentArea.querySelector('#newLogoInput').files[0];
            if (logoFile) {
                const refS = ref(storage, `logos/${businessId}/logo`);
                await uploadBytes(refS, logoFile);
                updates.logoUrl = await getDownloadURL(refS);
            }

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
        const f = mainContentArea.querySelector('#bankAccountForm');
        const type = f.querySelector('#accountType').value;
        const num = (type === 'Pago Móvil') ? `${f.querySelector('#bankAccPrefix').value}${f.querySelector('#bankAccDoc').value}` : f.querySelector('#accountNumber').value;
        const data = { bank: f.querySelector('#bankName').value, number: num, type: type, currency: f.querySelector('#accountCurrency').value, createdAt: new Date().toISOString() };
        if (type === 'Pago Móvil') data.phone = window.intlTelInputGlobals.getInstance(f.querySelector('#pagoMovilPhone')).getNumber();
        await addDoc(collection(db, "businesses", businessId, "bank_accounts"), data);
        await FinanceService.registerBankIfNew(mainContentArea.querySelector('#editCountry').value, data.bank);
        f.reset(); loadBanks(); showNotification('Añadida', 'success');
    };

    mainContentArea.querySelector('#editBankModalForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = mainContentArea.querySelector('#editBankModalForm');
        const type = f.querySelector('#modalAccountType').value;
        const num = (type === 'Pago Móvil') ? `${f.querySelector('#modalPmPrefix').value}${f.querySelector('#modalPmDoc').value}` : f.querySelector('#modalAccountNumber').value;
        const data = { bank: f.querySelector('#modalBankName').value, number: num, type: type, currency: f.querySelector('#modalAccountCurrency').value, updatedAt: new Date().toISOString() };
        if (type === 'Pago Móvil') data.phone = window.intlTelInputGlobals.getInstance(f.querySelector('#modalPmPhone')).getNumber();
        await updateDoc(doc(db, "businesses", businessId, "bank_accounts", currentEditingId), data);
        mainContentArea.querySelector('#bankEditModal').style.display = 'none'; loadBanks(); showNotification('Actualizada', 'success');
    };

    // --- INICAR ---
    window.intlTelInput(mainContentArea.querySelector('#editOwnerPhone'), { initialCountry: "ve", preferredCountries: ["ve", "co"], utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js" });
    window.intlTelInput(mainContentArea.querySelector('#pagoMovilPhone'), { initialCountry: "ve", preferredCountries: ["ve", "co"], utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js" });
    window.intlTelInput(mainContentArea.querySelector('#modalPmPhone'), { initialCountry: "ve", preferredCountries: ["ve", "co"], utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js" });
    setupLogic(mainContentArea, '');
    setupLogic(mainContentArea.querySelector('#bankEditModal'), 'modal');
    mainContentArea.querySelector('#closeBankModal').onclick = () => mainContentArea.querySelector('#bankEditModal').style.display = 'none';

    // Temas
    const themes = { orange: { p: '#f97316', h: '#ea580c', r: '249, 115, 22', bg: '#0f172a', surf: '#1e293b', bord: '#334155' }, blue: { p: '#3b82f6', h: '#2563eb', r: '59, 130, 246', bg: '#020617', surf: '#0f172a', bord: '#1e293b' }, emerald: { p: '#10b981', h: '#059669', r: '16, 185, 129', bg: '#061a14', surf: '#0a2e24', bord: '#134e4a' }, slate: { p: '#94a3b8', h: '#64748b', r: '148, 163, 184', bg: '#18181b', surf: '#27272a', bord: '#3f3f46' } };
    mainContentArea.querySelectorAll('.theme-dot').forEach(dot => {
        dot.onclick = () => {
            const k = dot.dataset.theme; const t = themes[k]; const root = document.documentElement;
            root.style.setProperty('--primary', t.p); root.style.setProperty('--primary-hover', t.h); root.style.setProperty('--primary-rgb', t.r); root.style.setProperty('--background', t.bg); root.style.setProperty('--surface', t.surf); root.style.setProperty('--border', t.bord);
            localStorage.setItem('accentTheme', k);
            mainContentArea.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active')); dot.classList.add('active');
            showNotification(`Atmósfera aplicada`, 'info');
        };
    });

    loadAllData();
}
