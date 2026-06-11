import { navigate } from '../utils.js';
import { COUNTRY_CONFIG, DEFAULT_COUNTRY } from '../data/countries.js';

export function renderConfig() {
    const container = document.createElement('div');
    container.className = 'auth-layout';

    const countryCode = localStorage.getItem('businessCountry') || DEFAULT_COUNTRY;
    const country = COUNTRY_CONFIG[countryCode] || COUNTRY_CONFIG[DEFAULT_COUNTRY];
    const businessName = localStorage.getItem('businessName') || 'tu negocio';

    // Monedas disponibles para el selector (la del país siempre primera)
    const allCurrencies = [
        { code: 'VES', name: 'Bolívares (VES)' },
        { code: 'COP', name: 'Pesos Colombianos (COP)' },
        { code: 'ARS', name: 'Pesos Argentinos (ARS)' },
        { code: 'MXN', name: 'Pesos Mexicanos (MXN)' },
        { code: 'UYU', name: 'Pesos Uruguayos (UYU)' },
        { code: 'CLP', name: 'Pesos Chilenos (CLP)' },
        { code: 'PEN', name: 'Soles (PEN)' },
        { code: 'EUR', name: 'Euros (EUR)' },
        { code: 'USD', name: 'Dólares (USD)' },
    ];

    const currencyOptions = allCurrencies
        .map(c => `<option value="${c.code}" ${c.code === country.currency.code ? 'selected' : ''}>${c.name}</option>`)
        .join('');

    container.innerHTML = `
        <div class="card auth-card" style="max-width: 520px; padding: 2.5rem;">
            <div class="text-center mb-5">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
                <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 0.4rem;">¡Casi listo!</h2>
                <p class="text-muted text-sm">Configura los últimos detalles de <strong>${businessName}</strong></p>
            </div>

            <form id="configForm">

                <!-- SUCURSALES -->
                <div class="section-divider" style="margin-bottom: 1.25rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
                    <h3 style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 800;">🏪 Tiendas / Sucursales</h3>
                </div>
                <div class="form-group mb-4">
                    <label>¿Tu negocio tiene más de una tienda o sucursal?</label>
                    <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem;">
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="hasBranches" value="yes"> Sí
                        </label>
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="hasBranches" value="no" checked> No, tienda única
                        </label>
                    </div>
                </div>

                <!-- MONEDAS -->
                <div class="section-divider" style="margin-bottom: 1.25rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
                    <h3 style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 800;">💱 Sistema de Monedas</h3>
                </div>
                <div class="form-group mb-3">
                    <label>¿Manejas precios en dólares (USD) y moneda local?</label>
                    <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem;">
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="dualCurrency" value="yes"> Sí (USD + Local)
                        </label>
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="dualCurrency" value="no" checked> No, una sola moneda
                        </label>
                    </div>
                </div>
                <div id="currencySelection" style="display: none;" class="mb-4">
                    <div class="form-group">
                        <label>Moneda local de tu país</label>
                        <select class="form-control" id="localCurrency">
                            ${currencyOptions}
                        </select>
                    </div>
                </div>

                <!-- IMPUESTO -->
                <div class="section-divider" style="margin-bottom: 1.25rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
                    <h3 style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 800;">🧾 Impuesto sobre Ventas</h3>
                </div>
                <div class="form-group mb-3">
                    <label>¿Tu región aplica impuesto sobre ventas?</label>
                    <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem;">
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="hasTax" value="yes" ${country.tax.enabled ? 'checked' : ''}> Sí
                        </label>
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="hasTax" value="no" ${!country.tax.enabled ? 'checked' : ''}> No
                        </label>
                    </div>
                </div>
                <div id="taxDetails" style="display: ${country.tax.enabled ? 'block' : 'none'};" class="mb-4">
                    <div style="display: flex; gap: 1rem;">
                        <div class="form-group" style="flex: 1;">
                            <label>Nombre del impuesto</label>
                            <input type="text" class="form-control" id="taxName" value="${country.tax.name}" placeholder="Ej. IVA, Tax, IGV...">
                        </div>
                        <div class="form-group" style="width: 120px;">
                            <label>Tasa (%)</label>
                            <input type="number" class="form-control" id="taxRate" value="${country.tax.rate}" min="0" max="100" step="0.1" placeholder="0">
                        </div>
                    </div>
                    <p class="text-muted" style="font-size: 0.7rem; margin-top: 0.25rem;">Puedes modificar esto después desde Ajustes.</p>
                </div>

                <button type="submit" class="btn btn-primary mt-3" style="height: 52px; font-size: 1rem; font-weight: 800;">
                    Comenzar a usar Orange →
                </button>
            </form>
        </div>
    `;

    // Mostrar/ocultar selector de moneda local
    container.querySelectorAll('input[name="dualCurrency"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            container.querySelector('#currencySelection').style.display =
                e.target.value === 'yes' ? 'block' : 'none';
        });
    });

    // Mostrar/ocultar detalles de impuesto
    container.querySelectorAll('input[name="hasTax"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            container.querySelector('#taxDetails').style.display =
                e.target.value === 'yes' ? 'block' : 'none';
        });
    });

    container.querySelector('#configForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const hasBranches = container.querySelector('input[name="hasBranches"]:checked').value === 'yes';
        const isDual = container.querySelector('input[name="dualCurrency"]:checked').value === 'yes';
        const hasTax = container.querySelector('input[name="hasTax"]:checked').value === 'yes';
        const localCurrency = isDual ? container.querySelector('#localCurrency').value : null;
        const taxName = hasTax ? (container.querySelector('#taxName').value.trim() || country.tax.name) : null;
        const taxRate = hasTax ? parseFloat(container.querySelector('#taxRate').value) || 0 : 0;

        localStorage.setItem('appConfig', JSON.stringify({
            hasBranches,
            isDual,
            localCurrency: isDual ? localCurrency : null,
            tax: {
                enabled: hasTax,
                name: taxName,
                rate: taxRate,
            },
        }));

        navigate('#dashboard');
    });

    return container;
}
