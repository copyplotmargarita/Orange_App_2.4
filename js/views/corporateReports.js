import { auth, db } from '../services/firebase.js';
import { showNotification } from '../utils.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc,
    orderBy, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// Intentamos importar Chart.js via ESM
let Chart;
try {
    const module = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.2/+esm');
    Chart = module.default;
} catch (e) {
    console.error("No se pudo cargar Chart.js desde el CDN:", e);
}

export function renderCorporateReports(container) {
    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');

    if (role !== 'admin' && role !== 'administrador') {
        container.innerHTML = '<div class="alert alert-danger">Acceso restringido solo para administradores.</div>';
        return;
    }

    let currentTab = 'dashboard'; // dashboard, cierre, ventas, rankings, inventario

    function render() {
        container.innerHTML = `
            <div class="corp-reports-container" style="display: flex; flex-direction: column; gap: 1.5rem; height: 100%; overflow: hidden; padding-bottom: 2rem;">
                
                <!-- Encabezado de Vista (Regla CONTEXT.md) -->
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0;" class="flex-stack-mobile">
                    <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
                    <h2 style="color: var(--primary); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">📈 Reportes Corporativos</h2>
                    
                    <!-- Tabs de Navegación -->
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-left: auto;" class="flex-stack-mobile">
                        <button data-tab="dashboard" class="tab-btn btn ${currentTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}">📊 Dashboard</button>
                        <button data-tab="cierre" class="tab-btn btn ${currentTab === 'cierre' ? 'btn-primary' : 'btn-outline'}">🔒 Cierre</button>
                        <button data-tab="ventas" class="tab-btn btn ${currentTab === 'ventas' ? 'btn-primary' : 'btn-outline'}">🛒 Ventas</button>
                        <button data-tab="rankings" class="tab-btn btn ${currentTab === 'rankings' ? 'btn-primary' : 'btn-outline'}">🏆 Rankings</button>
                        <button data-tab="inventario" class="tab-btn btn ${currentTab === 'inventario' ? 'btn-primary' : 'btn-outline'}">📦 Producción</button>
                    </div>
                </div>

                <!-- Contenido Dinámico -->
                <div id="corpReportsContent" style="flex: 1; overflow-y: auto; min-height: 0; padding-right: 0.5rem;">
                    <!-- Se carga dinámicamente -->
                </div>
            </div>

            <style>
                .tab-btn {
                    width: auto;
                    font-size: 0.85rem;
                    padding: 0.5rem 1rem;
                    white-space: nowrap;
                    height: 38px;
                    font-weight: 700;
                }
                .corp-card {
                    background: var(--surface);
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid var(--border);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .corp-card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-lg);
                }
                .stat-value {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: var(--text-main);
                    margin: 0.5rem 0;
                }
                .stat-label {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }
            </style>
        `;

        // Eventos de navegación
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                currentTab = btn.dataset.tab;
                render();
            };
        });

        // Botón Volver
        const backBtn = container.querySelector('#backBtn');
        if (backBtn) {
            backBtn.onclick = () => {
                document.getElementById('navHome')?.click();
                const toggleIcon = document.getElementById('toggleIcon');
                if (toggleIcon && toggleIcon.innerText === '▶') {
                    document.getElementById('sidebarToggle')?.click();
                }
            };
        }

        // Cargar vista específica
        const contentArea = container.querySelector('#corpReportsContent');
        if (currentTab === 'dashboard') renderDashboardView(contentArea);
        else if (currentTab === 'cierre') renderCierreView(contentArea);
        else if (currentTab === 'ventas') renderVentasView(contentArea);
        else if (currentTab === 'rankings') renderRankingsView(contentArea);
        else if (currentTab === 'inventario') renderInventarioView(contentArea);
    }

    // ==========================================
    // VISTA: DASHBOARD (Resumen + Gráficos)
    // ==========================================
    async function renderDashboardView(content) {
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Tarjetas de Impacto -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                    <div class="corp-card" style="border-left: 4px solid var(--primary);">
                        <div class="stat-label">Ventas del Mes</div>
                        <div class="stat-value" id="valMes">$ 0.00</div>
                        <div style="font-size: 0.8rem; color: var(--success);">+12% vs mes anterior</div>
                    </div>
                    <div class="corp-card" style="border-left: 4px solid var(--success);">
                        <div class="stat-label">Transacciones</div>
                        <div class="stat-value" id="valTransacciones">0</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Ticket Promedio: <span id="valTicketProm">$ 0</span></div>
                    </div>
                    <div class="corp-card" style="border-left: 4px solid var(--warning);">
                        <div class="stat-label">Producto Top</div>
                        <div class="stat-value" id="valTopProd" style="font-size: 1.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Cargando...</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">El más vendido</div>
                    </div>
                    <div class="corp-card" style="border-left: 4px solid #8b5cf6;">
                        <div class="stat-label">Efectividad Empleados</div>
                        <div class="stat-value" id="valTopEmp" style="font-size: 1.2rem;">Cargando...</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Líder en ventas</div>
                    </div>
                </div>

                <!-- Gráficos -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;" class="grid-1-mobile">
                    
                    <!-- Gráfico Principal: Ventas -->
                    <div class="corp-card">
                        <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 800;">📈 Tendencia de Ventas (Últimos 6 Meses)</h3>
                        <div style="height: 300px; position: relative;">
                            <canvas id="chartVentas"></canvas>
                        </div>
                    </div>

                    <!-- Gráfico Secundario: Métodos de Pago -->
                    <div class="corp-card">
                        <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 800;">💳 Métodos de Pago</h3>
                        <div style="height: 300px; position: relative;">
                            <canvas id="chartPagos"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Rendimiento por Tienda -->
                <div class="corp-card">
                    <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 800;">🏪 Rendimiento por Tienda</h3>
                    <div class="table-responsive">
                        <table class="table" style="width: 100%; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: var(--background);">
                                    <th style="padding: 0.75rem; text-align: left;">Tienda</th>
                                    <th style="padding: 0.75rem; text-align: center;">Ventas Totales</th>
                                    <th style="padding: 0.75rem; text-align: center;">Monto Generado</th>
                                    <th style="padding: 0.75rem; text-align: center;">Ticket Promedio</th>
                                </tr>
                            </thead>
                            <tbody id="tiendasTableBody">
                                <tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando datos...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Cargar Datos y Gráficos
        setTimeout(() => {
            initDashboardCharts();
            loadDashboardData();
        }, 100);
    }

    // ==========================================
    // VISTA: CIERRE DE CAJA
    // ==========================================
    function renderCierreView(content) {
        content.innerHTML = `
            <div class="corp-card">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 800;">🔒 Cierre de Caja Diario</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Aquí se mostrará el cierre de caja diario por tienda y empleado según los lineamientos del punto 1.</p>
                <div style="margin-top: 1.5rem; text-align: center; padding: 3rem; background: var(--background); border-radius: 12px; color: var(--text-muted);">
                    📊 Módulo en construcción. Se implementará la consulta de cierres históricos.
                </div>
            </div>
        `;
    }

    // ==========================================
    // VISTA: REGISTRO DE VENTAS
    // ==========================================
    function renderVentasView(content) {
        content.innerHTML = `
            <div class="corp-card">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 800;">🛒 Registro Detallado de Ventas</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Listado completo de ventas con filtros avanzados según el punto 2.</p>
                <div style="margin-top: 1.5rem; text-align: center; padding: 3rem; background: var(--background); border-radius: 12px; color: var(--text-muted);">
                    🔍 Módulo en construcción. Se conectará con la colección de ventas para auditoría.
                </div>
            </div>
        `;
    }

    // ==========================================
    // VISTA: RANKINGS
    // ==========================================
    function renderRankingsView(content) {
        content.innerHTML = `
            <div class="corp-card">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 800;">🏆 Rankings (Top 10)</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Rankings de productos, clientes y empleados según el punto 4.</p>
                <div style="margin-top: 1.5rem; text-align: center; padding: 3rem; background: var(--background); border-radius: 12px; color: var(--text-muted);">
                    🥇 Módulo en construcción. Se generarán las listas dinámicas.
                </div>
            </div>
        `;
    }

    // ==========================================
    // VISTA: INVENTARIO / PRODUCCIÓN
    // ==========================================
    function renderInventarioView(content) {
        content.innerHTML = `
            <div class="corp-card">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 800;">📦 Reportes de Producción e Inventario</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Alertas de stock y proyecciones según el punto 5.</p>
                <div style="margin-top: 1.5rem; text-align: center; padding: 3rem; background: var(--background); border-radius: 12px; color: var(--text-muted);">
                    📉 Módulo en construcción. Se implementará la lógica de proyección.
                </div>
            </div>
        `;
    }

    // ==========================================
    // LÓGICA DE DATOS Y GRÁFICOS
    // ==========================================
    
    async function loadDashboardData() {
        if (!businessId) return;

        try {
            // Simulación de carga de datos para el Dashboard "Impactante"
            // En producción, esto leería de Firestore agregando datos o haciendo queries complejos.
            
            // 1. Simular valores de tarjetas
            document.getElementById('valMes').textContent = "$ 15,420.00";
            document.getElementById('valTransacciones').textContent = "342";
            document.getElementById('valTicketProm').textContent = "$ 45.00";
            document.getElementById('valTopProd').textContent = "Hamburguesa Especial";
            document.getElementById('valTopEmp').textContent = "Carlos Pérez";

            // 2. Simular tabla de tiendas
            const tbody = document.getElementById('tiendasTableBody');
            tbody.innerHTML = `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.75rem;">Sucursal Las Mercedes</td>
                    <td style="padding: 0.75rem; text-align: center;">150</td>
                    <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: var(--success);">$ 7,500.00</td>
                    <td style="padding: 0.75rem; text-align: center;">$ 50.00</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.75rem;">Sucursal Chacao</td>
                    <td style="padding: 0.75rem; text-align: center;">120</td>
                    <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: var(--success);">$ 5,400.00</td>
                    <td style="padding: 0.75rem; text-align: center;">$ 45.00</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 0.75rem;">Almacén General</td>
                    <td style="padding: 0.75rem; text-align: center;">72</td>
                    <td style="padding: 0.75rem; text-align: center; font-weight: bold; color: var(--success);">$ 2,520.00</td>
                    <td style="padding: 0.75rem; text-align: center;">$ 35.00</td>
                </tr>
            `;

        } catch (err) {
            console.error("Error cargando datos del dashboard:", err);
            showNotification("Error al cargar datos de reportes", "error");
        }
    }

    function initDashboardCharts() {
        if (!Chart) {
            console.warn("Chart.js no está disponible. No se pueden renderizar los gráficos.");
            return;
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f8fafc' : '#0f172a';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        // Configuración global de Chart.js
        Chart.defaults.color = textColor;
        Chart.defaults.font.family = "'Inter', sans-serif";

        // 1. Gráfico de Ventas (Línea)
        const ctxVentas = document.getElementById('chartVentas')?.getContext('2d');
        if (ctxVentas) {
            new Chart(ctxVentas, {
                type: 'line',
                data: {
                    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Ventas ($)',
                        data: [12000, 14000, 11000, 15000, 18000, 15420],
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#f97316'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // 2. Gráfico de Pagos (Dona)
        const ctxPagos = document.getElementById('chartPagos')?.getContext('2d');
        if (ctxPagos) {
            new Chart(ctxPagos, {
                type: 'doughnut',
                data: {
                    labels: ['Dólares', 'Pago Móvil', 'Punto', 'Zelle'],
                    datasets: [{
                        data: [50, 25, 15, 10],
                        backgroundColor: [
                            '#10b981', // Verde
                            '#3b82f6', // Azul
                            '#f59e0b', // Amarillo
                            '#8b5cf6'  // Morado
                        ],
                        borderWidth: isDark ? 2 : 1,
                        borderColor: isDark ? '#1e293b' : '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: textColor,
                                padding: 15,
                                font: { size: 11 }
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
        }
    }

    // Inicializar
    render();
}
