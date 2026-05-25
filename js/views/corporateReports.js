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
                
                <!-- Encabezado de Vista Plano (Justificado a la derecha) -->
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; justify-content: flex-end;" class="flex-stack-mobile">
                    <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 0.75rem; height: 38px; font-size: 0.85rem;">Volver</button>
                    <h2 style="color: var(--primary); font-size: 1.25rem; font-weight: 800; margin-bottom: 0; white-space: nowrap;">📈 Reportes Corporativos</h2>
                    
                    <button data-tab="dashboard" class="tab-chip ${currentTab === 'dashboard' ? 'active' : ''}">📊 Dashboard</button>
                    <button data-tab="cierre" class="tab-chip ${currentTab === 'cierre' ? 'active' : ''}">🔒 Cierre</button>
                    <button data-tab="ventas" class="tab-chip ${currentTab === 'ventas' ? 'active' : ''}">📝 Ventas</button>
                    <button data-tab="rankings" class="tab-chip ${currentTab === 'rankings' ? 'active' : ''}">🏆 Rendimiento</button>
                    <button data-tab="inventario" class="tab-chip ${currentTab === 'inventario' ? 'active' : ''}">📦 Inventario</button>

                    <select id="storeFilter" class="form-control" style="height: 38px; font-size: 0.85rem; width: auto; min-width: 180px; padding-top: 0; padding-bottom: 0;">
                        <option value="all">Todas las Sucursales</option>
                        <option value="centro">Centro</option>
                        <option value="este">Centro Comercial Este</option>
                        <option value="norte">Plaza Norte</option>
                    </select>
                    <input type="date" id="dateFilter" class="form-control" style="height: 38px; width: auto; font-size: 0.85rem;" value="${new Date().toISOString().split('T')[0]}">
                </div>

                <!-- Contenido Dinámico -->
                <div id="corpReportsContent" style="flex: 1; overflow-y: auto; min-height: 0; padding-right: 0.5rem;">
                    <!-- Se carga dinámicamente -->
                </div>
            </div>

            <style>
                .tab-chip {
                    background: transparent;
                    border: 1px solid transparent;
                    color: var(--text-muted);
                    padding: 0.35rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .tab-chip:hover {
                    color: var(--text-main);
                    background: var(--background);
                }
                .tab-chip.active {
                    background: var(--primary);
                    color: white;
                    border-color: var(--primary);
                }
                .grid-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1.25rem;
                }
                .premium-card {
                    background: var(--surface);
                    border-radius: 12px;
                    padding: 1.25rem;
                    border: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    position: relative;
                }
                .premium-card .card-title {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--text-muted);
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    margin-bottom: 0.5rem;
                }
                .premium-card .card-value {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: var(--text-main);
                    margin-bottom: 0.25rem;
                }
                .premium-card .card-sub {
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .premium-card .card-sub.success { color: var(--success); }
                .premium-card .card-sub.danger { color: var(--danger); }
                
                /* Estilos para tablas tipo el ejemplo */
                .custom-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }
                .custom-table th {
                    text-align: left;
                    padding: 0.75rem;
                    color: var(--text-muted);
                    font-weight: 600;
                    border-bottom: 1px solid var(--border);
                }
                .custom-table td {
                    padding: 0.75rem;
                    border-bottom: 1px solid var(--border);
                    color: var(--text-main);
                }
                .custom-table tr:last-child td {
                    border-bottom: none;
                }
                .badge-status {
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .badge-status.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
                .badge-status.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
                .badge-status.danger { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
            </style>
        `;

        // Eventos de navegación
        container.querySelectorAll('.tab-chip').forEach(btn => {
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
    // VISTA: DASHBOARD (Inspirado en Imagen 2)
    // ==========================================
    async function renderDashboardView(content) {
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- 4 Tarjetas Superiores -->
                <div class="grid-container">
                    <div class="premium-card">
                        <span class="card-title">Ventas Totales de Hoy</span>
                        <div class="card-value">$42,850.12</div>
                        <span class="card-sub success">+12.5% <span style="color:var(--text-muted); font-weight:400;">vs ayer</span></span>
                    </div>
                    <div class="premium-card">
                        <span class="card-title">Ticket Promedio</span>
                        <div class="card-value">$148.20</div>
                        <span class="card-sub danger">-2.1% <span style="color:var(--text-muted); font-weight:400;">vs promedio mensual</span></span>
                    </div>
                    <div class="premium-card">
                        <span class="card-title">Transacciones Activas</span>
                        <div class="card-value">24</div>
                        <span class="card-sub" style="color:var(--primary);">👥 Cajeros actuales</span>
                    </div>
                    <div class="premium-card">
                        <span class="card-title">Rendimiento vs Objetivo</span>
                        <div class="card-value">94.2%</div>
                        <div style="width: 100%; background: var(--border); height: 6px; border-radius: 3px; margin-top: 0.5rem;">
                            <div style="width: 94.2%; background: var(--primary); height: 100%; border-radius: 3px;"></div>
                        </div>
                    </div>
                </div>

                <!-- Sección Central: Gráfico + Comparación -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;" class="grid-1-mobile">
                    
                    <!-- Gráfico Tendencia Semanal -->
                    <div class="premium-card" style="padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 800;">Tendencia de Ventas Semanal</h3>
                            <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-muted);">
                                <span><span style="color:var(--primary);">●</span> Ingresos</span>
                                <span><span style="color:var(--text-muted);">●</span> Objetivo</span>
                            </div>
                        </div>
                        <div style="height: 300px; position: relative;">
                            <canvas id="chartTendenciaSemanal"></canvas>
                        </div>
                    </div>

                    <!-- Ventas por Comparación de Tiendas -->
                    <div class="premium-card" style="padding: 1.5rem;">
                        <h3 style="margin: 0 0 1.5rem 0; font-size: 1rem; font-weight: 800;">Ventas por Comparación</h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                            <!-- Tienda 1 -->
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                                    <span style="font-weight: 600;">Centro</span>
                                    <span style="font-weight: 700; color: var(--text-main);">$182.4k</span>
                                </div>
                                <div style="width: 100%; background: var(--border); height: 8px; border-radius: 4px;">
                                    <div style="width: 85%; background: var(--primary); height: 100%; border-radius: 4px;"></div>
                                </div>
                            </div>
                            <!-- Tienda 2 -->
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                                    <span style="font-weight: 600;">Centro Comercial Este</span>
                                    <span style="font-weight: 700; color: var(--text-main);">$144.1k</span>
                                </div>
                                <div style="width: 100%; background: var(--border); height: 8px; border-radius: 4px;">
                                    <div style="width: 65%; background: var(--primary); height: 100%; border-radius: 4px;"></div>
                                </div>
                            </div>
                            <!-- Tienda 3 -->
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                                    <span style="font-weight: 600;">Plaza Norte</span>
                                    <span style="font-weight: 700; color: var(--text-main);">$98.2k</span>
                                </div>
                                <div style="width: 100%; background: var(--border); height: 8px; border-radius: 4px;">
                                    <div style="width: 45%; background: var(--primary); height: 100%; border-radius: 4px;"></div>
                                </div>
                            </div>
                            <!-- Tienda 4 -->
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                                    <span style="font-weight: 600;">Terminal Aeropuerto</span>
                                    <span style="font-weight: 700; color: var(--text-main);">$210.8k</span>
                                </div>
                                <div style="width: 100%; background: var(--border); height: 8px; border-radius: 4px;">
                                    <div style="width: 95%; background: var(--primary); height: 100%; border-radius: 4px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sección Inferior: Alertas y Actividad -->
                <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 1.5rem;" class="grid-1-mobile">
                    
                    <!-- Alertas de Inventario -->
                    <div class="premium-card" style="padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 800;">Alertas de Inventario</h3>
                            <a href="#" style="font-size: 0.8rem; color: var(--primary); text-decoration: none; font-weight: 600;">Ver Todo el Inventario</a>
                        </div>
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Nombre del Artículo</th>
                                    <th style="text-align: center;">Stock Actual</th>
                                    <th style="text-align: center;">Umbral</th>
                                    <th style="text-align: center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="font-weight: 600;">Premium Leather Tote (Jet Black)</td>
                                    <td style="text-align: center;">3 unidades</td>
                                    <td style="text-align: center;">10 unidades</td>
                                    <td style="text-align: center;"><span class="badge-status danger">Agotado</span></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 600;">Audífonos Inalámbricos</td>
                                    <td style="text-align: center;">12 unidades</td>
                                    <td style="text-align: center;">15 unidades</td>
                                    <td style="text-align: center;"><span class="badge-status warning">Bajo</span></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 600;">Reloj Análogo Minimalista</td>
                                    <td style="text-align: center;">8 unidades</td>
                                    <td style="text-align: center;">20 unidades</td>
                                    <td style="text-align: center;"><span class="badge-status danger">Agotado</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Actividad Reciente -->
                    <div class="premium-card" style="padding: 1.5rem;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 800;">Actividad Reciente</h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <!-- Item 1 -->
                            <div style="display: flex; gap: 0.75rem; align-items: center;">
                                <div style="background: rgba(var(--primary-rgb), 0.1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary);">🛒</div>
                                <div style="flex: 1;">
                                    <p style="font-size: 0.85rem; font-weight: 700; margin: 0; color: var(--text-main);">Nueva Venta #TX-9042</p>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">3 artículos • Total $245.00</p>
                                </div>
                                <span style="font-size: 0.7rem; color: var(--text-muted);">hace 2m</span>
                            </div>
                            <!-- Item 2 -->
                            <div style="display: flex; gap: 0.75rem; align-items: center;">
                                <div style="background: rgba(239, 68, 68, 0.1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ef4444;">↩️</div>
                                <div style="flex: 1;">
                                    <p style="font-size: 0.85rem; font-weight: 700; margin: 0; color: var(--text-main);">Reembolso Procesado #TX-8891</p>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">1 artículo • -$45.00</p>
                                </div>
                                <span style="font-size: 0.7rem; color: var(--text-muted);">hace 14m</span>
                            </div>
                            <!-- Item 3 -->
                            <div style="display: flex; gap: 0.75rem; align-items: center;">
                                <div style="background: rgba(var(--primary-rgb), 0.1); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary);">🛒</div>
                                <div style="flex: 1;">
                                    <p style="font-size: 0.85rem; font-weight: 700; margin: 0; color: var(--text-main);">Nueva Venta #TX-9041</p>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">1 artículo • Total $1,200.00</p>
                                </div>
                                <span style="font-size: 0.7rem; color: var(--text-muted);">hace 32m</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Cargar Gráfico
        setTimeout(() => {
            initDashboardCharts();
        }, 100);
    }

    // ==========================================
    // VISTA: CIERRE DE CAJA (Inspirado en Imagen 1)
    // ==========================================
    function renderCierreView(content) {
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Cabecera de Cierre -->
                <div style="display: flex; justify-content: space-between; align-items: center;" class="flex-stack-mobile">
                    <div>
                        <h2 style="color: var(--text-main); font-size: 1.3rem; font-weight: 800; margin-bottom: 0.25rem;">Cierre de Caja Diario</h2>
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">Resumen del turno actual</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-outline" style="height: 38px; width: auto; font-size: 0.85rem; padding: 0 1rem;">🖨️ Imprimir Resumen</button>
                        <button class="btn btn-primary" style="height: 38px; width: auto; font-size: 0.85rem; padding: 0 1rem; background-color: #ef4444; border-color: #ef4444;">🔒 Cerrar Turno</button>
                    </div>
                </div>

                <!-- 3 Tarjetas Superiores -->
                <div class="grid-container">
                    <div class="premium-card">
                        <span class="card-title">Total Vendido</span>
                        <div class="card-value">$12,450.00</div>
                        <span class="card-sub danger">-4.2% <span style="color:var(--text-muted); font-weight:400;">vs ayer</span></span>
                    </div>
                    <div class="premium-card">
                        <span class="card-title">Transacciones Totales</span>
                        <div class="card-value">184</div>
                        <span class="card-sub success">+12.5% <span style="color:var(--text-muted); font-weight:400;">vs ayer</span></span>
                    </div>
                    <div class="premium-card">
                        <span class="card-title">Ticket Promedio</span>
                        <div class="card-value">$67.66</div>
                        <span class="card-sub success">+2.1% <span style="color:var(--text-muted); font-weight:400;">vs ayer</span></span>
                    </div>
                </div>

                <!-- Sección Central: Desglose y Detalles -->
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem;" class="grid-1-mobile">
                    
                    <!-- Desglose de Pagos -->
                    <div class="premium-card" style="padding: 1.5rem;">
                        <h3 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 800;">Desglose de Pagos</h3>
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Método</th>
                                    <th style="text-align: right;">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>💳 Tarjeta de Crédito</td>
                                    <td style="text-align: right; font-weight: 700;">$8,120.50</td>
                                </tr>
                                <tr>
                                    <td>💵 Efectivo</td>
                                    <td style="text-align: right; font-weight: 700;">$3,210.00</td>
                                </tr>
                                <tr>
                                    <td>🏦 Tarjeta de Débito</td>
                                    <td style="text-align: right; font-weight: 700;">$980.50</td>
                                </tr>
                                <tr style="background: var(--background); font-weight: 800;">
                                    <td style="color: var(--primary);">Gran Total</td>
                                    <td style="text-align: right; color: var(--primary);">$12,450.00</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Detalles de Productos Vendidos -->
                    <div class="premium-card" style="padding: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 800;">Detalles de Productos Vendidos</h3>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Filas: 5 de 42</span>
                        </div>
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>Nombre del Producto</th>
                                    <th style="text-align: center;">Cantidad</th>
                                    <th style="text-align: center;">Precio Unitario</th>
                                    <th style="text-align: center;">Total</th>
                                    <th style="text-align: center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="font-weight: 600;">Quantum Wireless Pro Headphones</td>
                                    <td style="text-align: center;">12</td>
                                    <td style="text-align: center;">$299.99</td>
                                    <td style="text-align: center; font-weight: 700;">$3,599.88</td>
                                    <td style="text-align: center;"><span class="badge-status success">En Stock</span></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 600;">Zenith Smart Watch S4</td>
                                    <td style="text-align: center;">8</td>
                                    <td style="text-align: center;">$450.00</td>
                                    <td style="text-align: center; font-weight: 700;">$3,600.00</td>
                                    <td style="text-align: center;"><span class="badge-status warning">Bajo</span></td>
                                </tr>
                                <tr>
                                    <td style="font-weight: 600;">Lumina OLED 27" Display</td>
                                    <td style="text-align: center;">3</td>
                                    <td style="text-align: center;">$899.00</td>
                                    <td style="text-align: center; font-weight: 700;">$2,697.00</td>
                                    <td style="text-align: center;"><span class="badge-status danger">Agotado</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Footer de Cierre: Responsable y Notas -->
                <div style="display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 1.5rem;" class="grid-1-mobile">
                    
                    <!-- Responsable -->
                    <div class="premium-card" style="padding: 1.25rem;">
                        <span class="card-title">Responsable del Turno</span>
                        <div style="display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem;">
                            <div style="background: var(--background); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">👤</div>
                            <div>
                                <p style="font-size: 0.85rem; font-weight: 700; margin: 0; color: var(--text-main);">Carlos Mendoza</p>
                                <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">ID: #R89-224</p>
                            </div>
                        </div>
                    </div>

                    <!-- Notas -->
                    <div class="premium-card" style="padding: 1.25rem;">
                        <span class="card-title">Notas del Auditor (Opcional)</span>
                        <textarea class="form-control" style="margin-top: 0.5rem; height: 60px; font-size: 0.85rem; resize: none;" placeholder="Ingrese discrepancias o notas de la terminal aquí..."></textarea>
                    </div>

                    <!-- Verificación -->
                    <div class="premium-card" style="padding: 1.25rem; text-align: center; justify-content: center;">
                        <span class="card-title">Suma de Verificación</span>
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 0.25rem 0;">TRX-7821-OK</div>
                        <span style="font-size: 0.75rem; color: var(--success); font-weight: 700;">✓ Listo para validación final</span>
                    </div>
                </div>
            </div>
        `;
    }

    // =-------------- [Otras vistas se mantienen como placeholders por ahora] --------------

    function renderVentasView(content) {
        content.innerHTML = `<div class="premium-card"><h3>📝 Registro de Ventas</h3><p>Módulo en construcción basado en el punto 2.</p></div>`;
    }
    function renderRankingsView(content) {
        content.innerHTML = `<div class="premium-card"><h3>🏆 Rendimiento y Rankings</h3><p>Módulo en construcción basado en el punto 4.</p></div>`;
    }
    function renderInventarioView(content) {
        content.innerHTML = `<div class="premium-card"><h3>📦 Inventario y Producción</h3><p>Módulo en construcción basado en el punto 5.</p></div>`;
    }

    // ==========================================
    // LÓGICA DE GRÁFICOS (Chart.js)
    // ==========================================
    
    function initDashboardCharts() {
        if (!Chart) {
            console.warn("Chart.js no está disponible.");
            return;
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#f8fafc' : '#0f172a';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = "'Inter', sans-serif";

        // Gráfico Tendencia Semanal (Línea con relleno)
        const ctxSemanal = document.getElementById('chartTendenciaSemanal')?.getContext('2d');
        if (ctxSemanal) {
            new Chart(ctxSemanal, {
                type: 'line',
                data: {
                    labels: ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁ', 'DOM'],
                    datasets: [
                        {
                            label: 'Ingresos',
                            data: [15000, 12000, 22000, 18000, 32000, 30000, 42850],
                            borderColor: '#0052cc', // Azul corporativo
                            backgroundColor: 'rgba(0, 82, 204, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: '#0052cc'
                        },
                        {
                            label: 'Objetivo',
                            data: [18000, 18000, 18000, 18000, 25000, 25000, 35000],
                            borderColor: '#94a3b8',
                            borderDash: [5, 5],
                            borderWidth: 2,
                            fill: false,
                            pointRadius: 0
                        }
                    ]
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
                            grid: { display: false },
                            ticks: { color: textColor }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    }

    // Inicializar
    render();
}
