import { navigate } from '../utils.js';

export function renderConfig() {
    const container = document.createElement('div');
    container.className = 'auth-layout';
    
    container.innerHTML = `
        <div class="card auth-card" style="max-width: 500px;">
            <div class="text-center mb-4">
                <h2>Configuración Inicial</h2>
                <p class="text-muted text-sm">Ajusta los parámetros de tu negocio</p>
            </div>
            
            <form id="configForm">
                <div class="form-group mb-4">
                    <label>¿Tiene sucursales?</label>
                    <div style="display: flex; gap: 1rem;">
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="hasBranches" value="yes"> Sí
                        </label>
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="hasBranches" value="no" checked> No
                        </label>
                    </div>
                </div>

                <div class="form-group mb-4">
                    <label>¿Desea manejar sistema de dos monedas?</label>
                    <div style="display: flex; gap: 1rem;">
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="dualCurrency" value="yes"> Sí (USD + Local)
                        </label>
                        <label style="font-weight: normal; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="radio" name="dualCurrency" value="no" checked> No
                        </label>
                    </div>
                </div>
                
                <div id="currencySelection" style="display: none;" class="mb-4">
                    <div class="form-group">
                        <label>Selecciona Moneda Local</label>
                        <select class="form-control" id="localCurrency">
                            <option value="VES">Bolívares (VES)</option>
                            <option value="COP">Pesos Colombianos (COP)</option>
                            <option value="MXN">Pesos Mexicanos (MXN)</option>
                            <option value="EUR">Euros (EUR)</option>
                        </select>
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary mt-4">Comenzar a usar la app</button>
            </form>
        </div>
    `;

    // Lógica del formulario
    const dualCurrencyRadios = container.querySelectorAll('input[name="dualCurrency"]');
    const currencySelection = container.querySelector('#currencySelection');
    const form = container.querySelector('#configForm');

    dualCurrencyRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'yes') {
                currencySelection.style.display = 'block';
            } else {
                currencySelection.style.display = 'none';
            }
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Guardar configuración localmente por ahora
        const hasBranches = container.querySelector('input[name="hasBranches"]:checked').value;
        const isDual = container.querySelector('input[name="dualCurrency"]:checked').value;
        const localCur = container.querySelector('#localCurrency').value;

        localStorage.setItem('appConfig', JSON.stringify({
            hasBranches: hasBranches === 'yes',
            isDual: isDual === 'yes',
            localCurrency: isDual === 'yes' ? localCur : 'Default' // Tomaría por default según país en prod
        }));

        // Redirigir al dashboard
        navigate('#dashboard');
    });

    return container;
}
