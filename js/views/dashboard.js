import { navigate } from '../app.js';
import { showNotification } from '../utils.js';
import { renderStores } from './stores.js';
import { renderEmployees } from './employees.js';
import { renderClients } from './clients.js';
import { renderSuppliers } from './suppliers.js';
import { renderProducts } from './products.js';
import { renderPurchases } from './purchases.js?v=2';
import { renderInventory } from './inventory.js';
import { renderStoreReceive } from './storeReceive.js';
import { renderSales } from './sales.js';
import { renderReports } from './reports.js';

import { auth, db } from '../services/firebase.js';
import { doc, getDoc, setDoc, collection, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderDashboard() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.height = '100vh';
    container.style.width = '100%';
    
    const roleRaw = localStorage.getItem('userRole') || '';
    const isAdmin = roleRaw.toLowerCase() === 'admin' || roleRaw.toLowerCase() === 'administrador';
    const isEmployee = roleRaw.toLowerCase() === 'employee' || roleRaw.toLowerCase() === 'empleado';
    
    const todayStr = new Date().toISOString().split('T')[0];
    let bcvRateLoaded = localStorage.getItem('bcvRate') !== null && localStorage.getItem('bcvDate') === todayStr;
    
    container.innerHTML = `
        <aside id="sidebar" class="sidebar">
            <div class="sidebar-brand" id="navHome">
                ORANGE APP
            </div>
            
            <div class="sidebar-user">
                <p id="greetingName">Hola, ${localStorage.getItem('employeeName') || localStorage.getItem('businessName') || 'Usuario'}</p>
                <div class="status-indicator">
                    <span class="online-dot"></span>
                    <span class="status-text">Sesión Activa</span>
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <ul class="nav-list">
                    <li><a href="#" id="navClientes" class="sidebar-link">👥 Clientes</a></li>
                    <li><a href="#" id="navProductos" class="sidebar-link">🛍️ Productos</a></li>
                    <li><a href="#" id="navProveedores" class="sidebar-link">🏭 Proveedores</a></li>
                    <li><a href="#" id="navCompras" class="sidebar-link">🧾 Compras</a></li>
                    <li><a href="#" id="navInventarios" class="sidebar-link">📦 Inventarios</a></li>
                    <li><a href="#" id="navVentas" class="sidebar-link">💰 Ventas</a></li>
                    ${isAdmin ? '<li><a href="#" id="navReportes" class="sidebar-link">📊 Consultas / Reportes</a></li>' : ''}
                    <li><a href="#" class="sidebar-link">📋 Cuentas por Cobrar</a></li>
                    <li><a href="#" id="navEmpleados" class="sidebar-link">👤 Empleados</a></li>
                    <li><a href="#" id="navTiendas" class="sidebar-link">🏪 Tiendas</a></li>
                </ul>
            </nav>

            <div class="sidebar-bottom">
                <button id="logoutBtn" class="btn btn-outline sidebar-logout-btn">🚪 Cerrar Sesión</button>
            </div>

            <button id="sidebarToggle" class="toggle-btn">
                <span id="toggleIcon">◀</span>
            </button>
        </aside>

        <main class="main-content">
            <header class="header">
                <div class="header-left">
                    <div class="time-box">
                        <span id="currentTime">--:--</span>
                        <span id="currentDate" class="hide-mobile">--/--/----</span>
                    </div>
                    <div class="bcv-box">
                        <span class="bcv-label hide-mobile">Tasa BCV</span>
                        <div class="bcv-value-container">
                            <span id="bcvDisplay" class="bcv-value ${bcvRateLoaded ? 'success' : 'danger'}">
                                ${bcvRateLoaded ? `Bs. ${parseFloat(localStorage.getItem('bcvRate')).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : (isAdmin ? 'Actualizar' : 'Cargar tasa')}
                            </span>
                            ${!isEmployee ? `<button id="editBcvBtn" class="edit-bcv-btn" title="Editar Tasa BCV">✏️</button>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="header-right">
                    <button id="themeToggle" class="btn btn-outline theme-btn">☀️ <span class="hide-mobile">Modo Claro</span></button>
                    ${isEmployee ? `
                    <button id="bellBtn" style="position:relative;background:none;border:none;cursor:pointer;font-size:1.4rem;padding:0.3rem;" title="Notificaciones">
                        🔔
                        <span id="bellBadge" style="display:none;position:absolute;top:-2px;right:-4px;background:var(--danger);color:white;border-radius:50%;min-width:18px;height:18px;font-size:0.65rem;font-weight:bold;display:none;align-items:center;justify-content:center;border:2px solid var(--surface);">0</span>
                    </button>` : ''}
                </div>
            </header>
            
            <div id="mainContentArea" class="content-area">
                <!-- Aquí se cargarán las subvistas dinámicamente -->
            </div>

            <div id="bcvOverlay" style="display: ${!bcvRateLoaded && isAdmin ? 'flex' : 'none'}; position: absolute; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(4px); z-index: 50; align-items: center; justify-content: center;">
                <div class="card text-center" style="max-width: 400px; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 class="mb-2 text-danger">CARGAR TASA BCV DEL DÍA</h3>
                    <p class="text-muted mb-4">Debe cargar la tasa del Banco Central de Venezuela correspondiente al día de hoy (${todayStr}) antes de registrar operaciones.</p>
                    <form id="bcvForm">
                        <input type="number" step="0.01" class="form-control mb-4" placeholder="Ej. 36.45" required id="bcvInput">
                        <button type="submit" class="btn btn-primary">Guardar Tasa</button>
                    </form>
                </div>
            </div>
        </main>

        <aside id="chatSidebar" class="chat-sidebar collapsed">
            <button id="chatToggle" class="chat-toggle-btn">
                <span id="chatToggleIcon">◀</span>
                <span id="chatBadge" class="chat-badge" style="display: none;">0</span>
            </button>
            <div class="chat-header">
                <h3 style="margin: 0; font-size: 1rem;">Chat Corporativo</h3>
                <span id="activeChatName" style="font-size: 0.75rem; color: var(--primary);">Admin</span>
            </div>
            
            <div id="chatStoresList" style="display: none; flex-direction: column; overflow-y: auto;">
                <!-- Aquí se listarán las tiendas para el Admin -->
            </div>

            <div id="chatMessagesArea" class="chat-messages">
                <!-- Los mensajes aparecerán aquí -->
            </div>

            <div class="chat-footer">
                <form id="chatForm" class="chat-input-group">
                    <input type="text" id="chatInput" class="form-control" placeholder="Escribe un mensaje..." autocomplete="off">
                    <button type="submit" class="btn btn-primary" style="width: auto; padding: 0 0.75rem;">➤</button>
                </form>
            </div>
        </aside>
        
        <style>
            .sidebar {
                width: 250px;
                background-color: var(--surface);
                border-right: 1px solid var(--border);
                display: flex;
                flex-direction: column;
                transition: transform 0.3s ease, margin-left 0.3s ease;
                position: relative;
                z-index: 1000;
                overflow: visible;
            }
            
            .sidebar-brand {
                padding: 1.5rem;
                font-weight: 900;
                font-size: 1.5rem;
                border-bottom: 1px solid var(--border);
                cursor: pointer;
                color: #f97316;
                letter-spacing: 1px;
            }
            
            .sidebar-user {
                padding: 1.5rem 1.5rem 0.5rem 1.5rem;
                border-bottom: 1px solid var(--border);
            }
            
            .sidebar-user p {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 0.25rem;
                color: var(--text-main);
            }
            
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .online-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: var(--success);
                display: inline-block;
                box-shadow: 0 0 5px var(--success);
            }
            
            .status-text {
                font-size: 0.75rem;
                color: var(--text-muted);
                font-weight: 500;
            }
            
            .sidebar-nav {
                flex: 1;
                padding: 1rem 0;
                overflow-y: auto;
            }
            
            .nav-list {
                list-style: none;
                padding: 0;
            }
            
            .sidebar-footer {
                padding: 1rem;
                border-top: 1px solid var(--border);
            }
            
            .section-title {
                padding: 0 1.5rem;
                font-size: 0.75rem;
                font-weight: bold;
                color: var(--text-muted);
                text-transform: uppercase;
                margin-bottom: 0.5rem;
            }
            
            .sidebar-bottom {
                padding: 1rem;
                border-top: 1px solid var(--border);
                flex-shrink: 0;
            }

            .sidebar-logout-btn {
                width: 100%;
                text-align: left;
                border-color: var(--border);
                color: var(--text-muted);
                font-size: 0.9rem;
                padding: 0.6rem 1rem;
                border-radius: 8px;
                transition: var(--transition);
            }

            .sidebar-logout-btn:hover {
                border-color: var(--danger);
                color: var(--danger);
                background: rgba(239,68,68,0.08);
            }

            .toggle-btn {
                position: absolute;
                top: 1rem;
                right: -28px;
                width: 28px;
                height: 48px;
                background: var(--surface);
                color: var(--text-main);
                border: 1px solid var(--border);
                border-left: none;
                border-radius: 0 8px 8px 0;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1001;
                font-size: 0.8rem;
                box-shadow: 2px 0 4px rgba(0,0,0,0.05);
            }
            
            .main-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                background-color: var(--background);
                position: relative;
                overflow-x: hidden;
            }
            
            .header {
                height: 50px;
                background-color: var(--surface);
                border-bottom: 1px solid var(--border);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 1.25rem;
            }
            
            .header-left {
                display: flex;
                gap: 1rem;
                align-items: center;
            }
            
            .time-box {
                display: flex;
                align-items: center;
                font-weight: 500;
            }
            
            .bcv-box {
                display: flex;
                flex-direction: column;
                justify-content: center;
                margin-left: 1rem;
                padding-left: 1rem;
                border-left: 1px solid var(--border);
            }
            
            .bcv-label {
                font-size: 0.75rem;
                font-weight: 500;
                color: var(--text-muted);
                line-height: 1;
                margin-bottom: 0.2rem;
            }
            
            .bcv-value-container {
                display: flex;
                align-items: center;
                gap: 0.8rem;
            }
            
            .bcv-value {
                font-weight: bold;
                font-size: 1.1rem;
                line-height: 1;
                white-space: nowrap;
            }
            
            .bcv-value.success { color: var(--success); }
            .bcv-value.danger { color: var(--danger); }
            
            .edit-bcv-btn {
                padding: 0;
                font-size: 0.8rem;
                border: none;
                background: transparent;
                cursor: pointer;
                display: flex;
                align-items: center;
                height: auto;
            }
            
            .header-right {
                display: flex;
                gap: 1rem;
                align-items: center;
            }
            
            .content-area {
                padding: 0.75rem;
                flex: 1;
                overflow-y: auto;
            }

            @media (max-width: 768px) {
                .sidebar {
                    position: fixed;
                    height: 100%;
                    left: 0;
                    top: 0;
                    margin-left: 0 !important;
                    transform: translateX(-250px);
                }
                
                .sidebar.open {
                    transform: translateX(0);
                    box-shadow: 10px 0 20px rgba(0,0,0,0.1);
                }
                
                .header {
                    padding: 0 1rem;
                }
                
                .content-area {
                    padding: 1rem;
                }
                
                .theme-btn, .logout-btn {
                    padding: 0.5rem !important;
                    width: 40px !important;
                    height: 40px !important;
                    border-radius: 50% !important;
                }
                
                .time-box {
                    font-size: 0.9rem;
                }
                
                .bcv-value {
                    font-size: 0.9rem;
                }
            }

            .sidebar-link {
                display: block; padding: 0.75rem 1.5rem; color: var(--text-main); text-decoration: none; transition: var(--transition); border-left: 3px solid transparent;
            }
            .sidebar-link:hover {
                background-color: var(--background); border-left-color: var(--primary);
            }

            /* Estilos para la burbuja de notificación */
            .chat-badge {
                position: absolute;
                top: -8px;
                right: -8px;
                background: var(--danger);
                color: white;
                border-radius: 50%;
                min-width: 18px;
                height: 18px;
                padding: 0 4px;
                font-size: 0.65rem;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                border: 2px solid var(--surface);
                animation: pulse-badge 2s infinite;
            }

            @keyframes pulse-badge {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }

            /* Estilos para Toasts Profesionales */
            .toast-container {
                position: fixed;
                top: 2rem;
                right: 2rem;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
                pointer-events: none;
            }

            .toast {
                background: var(--surface);
                color: var(--text-main);
                padding: 1rem 1.5rem;
                border-radius: 12px;
                box-shadow: var(--shadow-lg);
                border-left: 4px solid var(--primary);
                display: flex;
                align-items: center;
                gap: 0.75rem;
                min-width: 300px;
                transform: translateX(120%);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                pointer-events: auto;
            }

            .toast.show { transform: translateX(0); }
            .toast.error { border-left-color: var(--danger); }
            .toast.success { border-left-color: var(--success); }
            
            .input-error {
                border-color: var(--danger) !important;
                box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
                animation: shake 0.4s ease-in-out;
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
        </style>
    `;

    const mainContentArea = container.querySelector('#mainContentArea');

    function renderHome() {
        mainContentArea.innerHTML = `
            <h2 class="mb-4">Resumen del Día</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div class="card" style="border-left: 4px solid var(--primary);">
                    <p class="card-label">Cantidad de Ventas</p>
                    <p class="card-value" id="metricSalesCount">0</p>
                    <p class="text-muted" style="font-size: 0.75rem; margin-top: 0.5rem;">Hoy</p>
                </div>
                <div class="card" style="border-left: 4px solid var(--success);">
                    <p class="card-label">Total Recaudado</p>
                    <p class="card-value" id="metricCashSales">$ 0.00</p>
                    <p class="text-muted" style="font-size: 0.75rem; margin-top: 0.5rem;">Efectivo, Transferencias, etc.</p>
                </div>
                <div class="card" style="border-left: 4px solid var(--warning);">
                    <p class="card-label">Pendiente por Cobrar</p>
                    <p class="card-value" id="metricCreditSales">$ 0.00</p>
                    <p class="text-muted" style="font-size: 0.75rem; margin-top: 0.5rem;">Deuda generada hoy</p>
                </div>
            </div>

            <h2 class="mb-4">Desempeño y Tendencias</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                <div class="card" style="border-left: 4px solid #8b5cf6;">
                    <p class="card-label">Mejor Venta del Día</p>
                    <p class="card-value" id="metricBestSale" style="font-size: 1.25rem;">$ 0.00</p>
                    <p class="text-muted" id="metricBestSaleStore" style="font-size: 0.75rem; margin-top: 0.5rem;">Sin datos</p>
                </div>
                <div class="card" style="border-left: 4px solid #ec4899;">
                    <p class="card-label">Producto más Vendido</p>
                    <p class="card-value" id="metricTopProduct" style="font-size: 1.25rem;">N/A</p>
                    <p class="text-muted" id="metricTopProductQty" style="font-size: 0.75rem; margin-top: 0.5rem;">0 unidades</p>
                </div>
                <div class="card" style="border-left: 4px solid #06b6d4;">
                    <p class="card-label">Cliente más Frecuente</p>
                    <p class="card-value" id="metricTopClient" style="font-size: 1.25rem;">N/A</p>
                    <p class="text-muted" id="metricTopClientSales" style="font-size: 0.75rem; margin-top: 0.5rem;">0 ventas</p>
                </div>
            </div>
        `;
        loadDashboardMetrics();
    }

    async function loadDashboardMetrics() {
        const businessId = localStorage.getItem('businessId');
        const storeId = localStorage.getItem('storeId');
        const role = localStorage.getItem('userRole');
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);

        if (!businessId) return;

        // Helper para UI
        const setVal = (id, val) => { const el = mainContentArea.querySelector('#'+id); if(el) el.textContent = val; };

        // 1. Listen for Sales
        const salesQ = query(
            collection(db, "businesses", businessId, "sales"),
            where("createdAt", ">=", todayStart)
        );

        onSnapshot(salesQ, (snap) => {
            let count = 0;
            let pendingTotal = 0;
            let bestSaleVal = 0;
            let bestSaleStore = 'N/A';
            const productStats = {};
            const clientStats = {};

            snap.forEach(doc => {
                const data = doc.data();

                // Strict session filter
                let pass = false;
                if (isEmployee) {
                    // Employee: must match their email AND their store
                    pass = (data.employeeEmail === auth.currentUser?.email);
                    if (storeId && data.storeId && data.storeId !== storeId) pass = false;
                } else {
                    // Admin: only Almacén General
                    pass = (data.storeId === 'general') || (!data.storeId) || (data.storeName === 'Almacén General');
                }
                if (!pass) return;
                
                count++;
                pendingTotal += (data.remainingUSD || 0);

                // Best Sale
                if (data.totalUSD > bestSaleVal) {
                    bestSaleVal = data.totalUSD;
                    bestSaleStore = data.storeName || 'Tienda';
                }

                // Products Stats
                if (data.items) {
                    data.items.forEach(item => {
                        productStats[item.name] = (productStats[item.name] || 0) + (item.qty || 0);
                    });
                }

                // Client Stats
                if (data.clientName) {
                    clientStats[data.clientName] = (clientStats[data.clientName] || 0) + 1;
                }
            });

            setVal('metricSalesCount', count);
            setVal('metricCreditSales', `$ ${pendingTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
            setVal('metricBestSale', `$ ${bestSaleVal.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
            setVal('metricBestSaleStore', bestSaleVal > 0 ? `Tienda: ${bestSaleStore}` : 'Sin datos');

            // Find Top Product
            let topProd = 'N/A';
            let topQty = 0;
            for (const [name, qty] of Object.entries(productStats)) {
                if (qty > topQty) { topQty = qty; topProd = name; }
            }
            setVal('metricTopProduct', topProd);
            setVal('metricTopProductQty', `${topQty} unidades`);

            // Find Top Client
            let topClient = 'N/A';
            let topCSales = 0;
            for (const [name, c] of Object.entries(clientStats)) {
                if (c > topCSales) { topCSales = c; topClient = name; }
            }
            setVal('metricTopClient', topClient);
            setVal('metricTopClientSales', `${topCSales} ventas`);
        });

        // 2. Listen for Payments (Total Cash Collected)
        const paymentsQ = query(
            collection(db, "businesses", businessId, "payments"),
            where("createdAt", ">=", todayStart)
        );

        onSnapshot(paymentsQ, (snap) => {
            let totalUSD = 0;
            let totalBs = 0;
            snap.forEach(doc => {
                const data = doc.data();

                // Strict session filter (same as sales)
                let pass = false;
                if (isEmployee) {
                    pass = (data.employeeEmail === auth.currentUser?.email);
                    if (storeId && data.storeId && data.storeId !== storeId) pass = false;
                } else {
                    pass = (data.storeId === 'general') || (!data.storeId) || (data.storeName === 'Almacén General');
                }
                if (!pass) return;
                
                if (data.currency === 'USD') totalUSD += (data.amount || 0);
                else if (data.currency === 'BS') totalBs += (data.amount || 0);
            });
            setVal('metricCashSales', `$ ${totalUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} | Bs. ${totalBs.toLocaleString('es-VE', {minimumFractionDigits: 2})}`);
        });
    }

    // Navegación interna del Dashboard
    container.querySelector('#navHome').addEventListener('click', renderHome);
    
    container.querySelector('#navClientes').addEventListener('click', (e) => {
        e.preventDefault();
        renderClients(mainContentArea);
    });

    container.querySelector('#navProductos').addEventListener('click', (e) => {
        e.preventDefault();
        renderProducts(mainContentArea);
    });

    container.querySelector('#navProveedores').addEventListener('click', (e) => {
        e.preventDefault();
        renderSuppliers(mainContentArea);
    });

    container.querySelector('#navCompras').addEventListener('click', (e) => {
        e.preventDefault();
        renderPurchases(mainContentArea);
    });

    container.querySelector('#navTiendas').addEventListener('click', (e) => {
        e.preventDefault();
        renderStores(mainContentArea);
    });

    container.querySelector('#navEmpleados').addEventListener('click', (e) => {
        e.preventDefault();
        renderEmployees(mainContentArea);
    });

    container.querySelector('#navInventarios').addEventListener('click', (e) => {
        e.preventDefault();
        renderInventory(mainContentArea);
    });

    container.querySelector('#navVentas').addEventListener('click', (e) => {
        e.preventDefault();
        renderSales(mainContentArea);
        if (sidebarOpen) toggleSidebar();
    });

    const navReportes = container.querySelector('#navReportes');
    if (navReportes) {
        navReportes.addEventListener('click', (e) => {
            e.preventDefault();
            renderReports(mainContentArea);
            if (sidebarOpen) toggleSidebar();
        });
    }

    // Recibir Productos (empleados)
    const navRecibir = container.querySelector('#navRecibirProductos');
    if (navRecibir) {
        navRecibir.addEventListener('click', (e) => {
            e.preventDefault();
            renderStoreReceive(mainContentArea);
        });
    }

    // Vista temporal para módulos en construcción
    function renderUnderConstruction(moduleName, icon) {
        mainContentArea.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;gap:1.5rem;">
                <div style="font-size:5rem;animation:float 3s ease-in-out infinite;">${icon}</div>
                <div>
                    <h2 style="font-size:2rem;font-weight:800;margin-bottom:0.5rem;">${moduleName}</h2>
                    <p style="color:var(--text-muted);font-size:1rem;max-width:380px;">Este módulo está siendo desarrollado y estará disponible próximamente. ¡Estamos trabajando en ello!</p>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;padding:0.6rem 1.5rem;border-radius:999px;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);">
                    <span style="width:8px;height:8px;border-radius:50%;background:#f97316;display:inline-block;animation:pulse-dot 1.5s infinite;"></span>
                    <span style="color:#f97316;font-weight:600;font-size:0.9rem;">En Construcción</span>
                </div>
                <style>
                    @keyframes float {
                        0%,100% { transform: translateY(0); }
                        50% { transform: translateY(-12px); }
                    }
                    @keyframes pulse-dot {
                        0%,100% { opacity:1; transform:scale(1); }
                        50% { opacity:0.5; transform:scale(1.3); }
                    }
                </style>
            </div>`;
    }

    container.querySelectorAll('.sidebar-link').forEach(link => {
        if (!link.id) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const name = link.textContent.trim();
                const iconMap = { '📋 Cuentas por Cobrar': ['📋', 'Cuentas por Cobrar'] };
                const [icon, label] = iconMap[name] || ['🚧', name];
                renderUnderConstruction(label, icon);
            });
        }
    });

    // Lógica para el Toggle del Sidebar
    const sidebar = container.querySelector('#sidebar');
    const sidebarToggle = container.querySelector('#sidebarToggle');
    const toggleIcon = container.querySelector('#toggleIcon');
    let sidebarOpen = true;
    
    const toggleSidebar = () => {
        sidebarOpen = !sidebarOpen;
        const sidebar = container.querySelector('#sidebar');
        const toggleIcon = container.querySelector('#toggleIcon');
        
        if (window.innerWidth <= 768) {
            // Comportamiento móvil
            if (sidebarOpen) {
                sidebar.classList.add('open');
                toggleIcon.innerText = '◀';
                // Añadir un overlay si no existe
                if (!document.getElementById('sidebarOverlay')) {
                    const overlay = document.createElement('div');
                    overlay.id = 'sidebarOverlay';
                    overlay.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999;';
                    overlay.onclick = toggleSidebar;
                    document.body.appendChild(overlay);
                }
            } else {
                sidebar.classList.remove('open');
                toggleIcon.innerText = '▶';
                const overlay = document.getElementById('sidebarOverlay');
                if (overlay) overlay.remove();
            }
        } else {
            // Comportamiento desktop
            sidebar.style.marginLeft = sidebarOpen ? '0' : '-250px';
            toggleIcon.innerText = sidebarOpen ? '◀' : '▶';
        }
    };
    
    sidebarToggle.addEventListener('click', toggleSidebar);

    // Cargar nombre del usuario para el saludo y configurar rol
    async function loadUserName() {
        const greetingEl = container.querySelector('#greetingName');
        const storeName = localStorage.getItem('storeName');
        
        // Si es empleado, ocultamos el menú de administración
        if (isEmployee) {
            // Ocultar módulos restringidos para empleados
            const restricted = ['navProveedores', 'navCompras', 'navInventarios', 'navEmpleados', 'navTiendas'];
            restricted.forEach(id => {
                const el = container.querySelector(`#${id}`);
                if (el) el.parentElement.style.display = 'none';
            });

            // Mostrar enlace Recibir Productos solo para empleados (evitando duplicados)
            const navList = container.querySelector('.nav-list');
            if (navList && !container.querySelector('#navRecibirProductos')) {
                const li = document.createElement('li');
                li.innerHTML = `<a href="#" id="navRecibirProductos" class="sidebar-link" style="color:#f97316;">📥 Recibir Productos</a>`;
                navList.appendChild(li);
                li.querySelector('a').addEventListener('click', (e) => {
                    e.preventDefault();
                    renderStoreReceive(mainContentArea);
                });
            }
            
            // Mostrar saludo para empleado incluyendo la tienda actual
            const empNameLocal = localStorage.getItem('employeeName');
            const empName = empNameLocal ? empNameLocal : (auth.currentUser?.displayName || "Empleado");
            
            if (storeName) {
                greetingEl.textContent = `Hola, ${empName} - ${storeName}`;
            } else {
                greetingEl.textContent = `Hola, ${empName}`;
            }

            // 🔔 Campana en tiempo real: escuchar órdenes pendientes para esta tienda
            const empStoreId = localStorage.getItem('storeId');
            if (empStoreId && businessId) {
                const pendingQ = query(
                    collection(db, "businesses", businessId, "storeTransfers"),
                    where("storeId", "==", empStoreId),
                    where("status",  "==", "PENDIENTE")
                );
                onSnapshot(pendingQ, (snap) => {
                    const count = snap.size;
                    const bellBtn   = container.querySelector('#bellBtn');
                    const bellBadge = container.querySelector('#bellBadge');
                    if (!bellBtn) return;
                    if (count > 0) {
                        bellBadge.textContent = count;
                        bellBadge.style.display = 'flex';
                        bellBtn.title = `${count} orden(es) pendiente(s) por recibir`;
                    } else {
                        bellBadge.style.display = 'none';
                    }
                });

                // Click en campana → va a Recibir Productos
                const bellBtn = container.querySelector('#bellBtn');
                if (bellBtn) {
                    bellBtn.addEventListener('click', () => renderStoreReceive(mainContentArea));
                }
            }

            return;
        }

        // Si no es empleado (es decir, es Administrador)
        if (auth.currentUser) {
            // Primero mostramos lo que tengamos en caché
            const cachedName = localStorage.getItem('businessName');
            if (cachedName) greetingEl.textContent = "Hola, " + cachedName;

            // Si el usuario tiene un displayName guardado
            if (auth.currentUser.displayName) {
                const name = auth.currentUser.displayName;
                greetingEl.textContent = "Hola, " + name;
                localStorage.setItem('businessName', name);
                return;
            }

            try {
                const docRef = doc(db, "businesses", auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const name = docSnap.data().name;
                    greetingEl.textContent = "Hola, " + name;
                    localStorage.setItem('businessName', name);
                } else {
                    greetingEl.textContent = "Hola, Administrador";
                }
            } catch (error) {
                console.error("Error cargando nombre:", error);
                greetingEl.textContent = "Hola, Administrador";
            }
        }
    }
    loadUserName();

    // Reloj
    const updateTime = () => {
        const now = new Date();
        const timeEl = container.querySelector('#currentTime');
        const dateEl = container.querySelector('#currentDate');
        if (timeEl && dateEl) {
            timeEl.textContent = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            dateEl.textContent = now.toLocaleDateString();
        }
    };
    setInterval(updateTime, 1000);
    updateTime();

    // Dark Mode Toggle
    const themeToggle = container.querySelector('#themeToggle');
    // Theme Toggle Logic
    const theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️ Modo Claro';
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.textContent = '🌙 Modo Oscuro';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggle.textContent = '🌙 Modo Oscuro';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.textContent = '☀️ Modo Claro';
        }
    });

    // Logout
    const logoutBtn = container.querySelector('#logoutBtn');
    logoutBtn.addEventListener('click', () => {
        // En un caso real se cerraría sesión de Firebase aquí
        navigate('#login');
    });

    // Tasa BCV Logic
    const bcvForm = container.querySelector('#bcvForm');
    const bcvOverlay = container.querySelector('#bcvOverlay');
    const bcvDisplay = container.querySelector('#bcvDisplay');
    const editBcvBtn = container.querySelector('#editBcvBtn');

    if (editBcvBtn) {
        editBcvBtn.addEventListener('click', () => {
            const input = container.querySelector('#bcvInput');
            if (localStorage.getItem('bcvRate')) {
                input.value = localStorage.getItem('bcvRate');
            }
            bcvOverlay.style.display = 'flex';
            fetchBcvRate(); // Intentar actualizar al abrir manual también
        });
    }

    // Función centralizada para guardar la tasa (reutilizable para manual y automático)
    async function saveBcvRate(rate) {
        const businessId = localStorage.getItem('businessId');
        if (!rate || !businessId) return;

        try {
            const dateId = new Date().toISOString().split('T')[0];
            
            // 1. Guardar en Historial de Firebase (Redondeado a 2 decimales)
            const formattedRate = parseFloat(rate).toFixed(2);
            
            await setDoc(doc(db, "businesses", businessId, "bcv_history", dateId), {
                rate: parseFloat(formattedRate),
                date: dateId,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.uid || 'admin'
            });

            // 2. Actualizar LocalStorage y UI
            localStorage.setItem('bcvRate', formattedRate);
            localStorage.setItem('bcvDate', todayStr);
            
            bcvRateLoaded = true;
            bcvOverlay.style.display = 'none';
            
            // Formatear con coma para la vista
            const displayRate = parseFloat(formattedRate).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            bcvDisplay.textContent = `Bs. ${displayRate}`;
            bcvDisplay.className = 'bcv-value success';
            
            showNotification(`Tasa BCV actualizada: Bs. ${displayRate}`, 'success');

            // Recargar para que los precios se actualicen
            const evt = new Event('hashchange');
            window.dispatchEvent(evt);
            return true;
        } catch (error) {
            console.error("Error guardando tasa BCV:", error);
            return false;
        }
    }

    bcvForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rate = container.querySelector('#bcvInput').value;
        const btn = bcvForm.querySelector('button');
        const originalText = btn.textContent;
        
        btn.disabled = true;
        btn.textContent = "Guardando...";
        
        const success = await saveBcvRate(rate);
        if (!success) {
            showNotification("Error al guardar en la base de datos.", "error");
        }
        
        btn.disabled = false;
        btn.textContent = originalText;
    });

    // Lógica de Automatización de BCV 100% Autónoma (VERSIÓN DEFINITIVA Y ROBUSTA)
    async function fetchBcvRate() {
        const bcvInput = container.querySelector('#bcvInput');
        const bcvStatusMsg = document.createElement('p');
        bcvStatusMsg.style = "font-size: 0.8rem; color: var(--primary); margin-top: 0.5rem; font-weight: 500;";
        bcvStatusMsg.id = "bcvStatusMsg";
        
        const existingMsg = bcvForm.querySelector('#bcvStatusMsg');
        if (existingMsg) existingMsg.remove();
        bcvForm.appendChild(bcvStatusMsg);

        const sources = [
            {
                name: 'GitHub Community (fjtrujillo)',
                url: 'https://raw.githubusercontent.com/fjtrujillo/dolar-venezuela-api/master/dolar.json',
                parse: (data) => data.bcv || data.BCV || (data.dolares && data.dolares.bcv)
            },
            {
                name: 'DolarApi Oficial',
                url: 'https://ve.dolarapi.com/v1/dolares/oficial',
                parse: (data) => data.promedio || data.price || data.venta
            },
            {
                name: 'PyDolar Vercel',
                url: 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv',
                parse: (data) => {
                    if (data.monitors && data.monitors.bcv) return data.monitors.bcv.price;
                    return data.price || data.promedio || (data.monitors && data.monitors.usd && data.monitors.usd.price);
                }
            },
            {
                name: 'ExchangeRate Global',
                url: 'https://api.exchangerate-api.com/v4/latest/USD',
                parse: (data) => data.rates ? data.rates.VES : null
            }
        ];

        for (const source of sources) {
            try {
                bcvStatusMsg.textContent = `🔍 Conectando con ${source.name}...`;
                
                // Usamos una técnica de fetch más simple para evitar problemas de compatibilidad
                const response = await fetch(source.url);
                if (!response.ok) throw new Error('Status ' + response.status);
                
                const data = await response.json();
                console.log(`Datos de ${source.name}:`, data);
                
                let rate = source.parse(data);
                
                // Si el rate es un string con comas, lo limpiamos
                if (typeof rate === 'string') {
                    rate = parseFloat(rate.replace(',', '.'));
                }

                if (rate && !isNaN(rate) && rate > 10) { 
                    const cleanRate = parseFloat(rate).toFixed(2);
                    bcvInput.value = cleanRate;
                    bcvStatusMsg.innerHTML = `✅ ¡Tasa de <strong>Bs. ${cleanRate}</strong> obtenida desde ${source.name}!`;
                    bcvStatusMsg.style.color = "var(--success)";
                    
                    // Notificar y Guardar
                    setTimeout(() => {
                        saveBcvRate(cleanRate);
                    }, 800);
                    return;
                }
            } catch (error) {
                console.warn(`Error en ${source.name}:`, error.message);
                continue;
            }
        }

        bcvStatusMsg.innerHTML = "❌ No se pudo obtener la tasa de ninguna fuente oficial.<br>Por favor, ingrésela manualmente para continuar.";
        bcvStatusMsg.style.color = "var(--danger)";
    }

    // Ejecutar la búsqueda de tasa con un pequeño delay
    setTimeout(() => {
        if (!bcvRateLoaded) {
            // Ambos roles intentan buscar la tasa automáticamente para ayudarse mutuamente
            fetchBcvRate();
        }
    }, 1500);

    // Toggle Chat y Lógica de Inactividad
    const chatSidebar = container.querySelector('#chatSidebar');
    const chatToggle = container.querySelector('#chatToggle');
    const chatToggleIcon = container.querySelector('#chatToggleIcon');
    const chatBadge = container.querySelector('#chatBadge');
    
    let chatInactiveTimer = null;
    let unreadCount = 0;

    const resetChatTimer = () => {
        if (chatInactiveTimer) clearTimeout(chatInactiveTimer);
        // Si el chat NO está colapsado, iniciar temporizador de 30s
        if (!chatSidebar.classList.contains('collapsed')) {
            chatInactiveTimer = setTimeout(() => {
                chatSidebar.classList.add('collapsed');
                chatToggleIcon.textContent = '◀';
            }, 30000); // 30 segundos
        }
    };

    chatToggle.addEventListener('click', () => {
        const isCollapsed = chatSidebar.classList.toggle('collapsed');
        chatToggleIcon.textContent = isCollapsed ? '◀' : '▶';
        
        if (!isCollapsed) {
            // Se abrió el chat: resetear notificaciones y temporizador
            unreadCount = 0;
            chatBadge.style.display = 'none';
            chatBadge.textContent = '0';
            resetChatTimer();
        } else {
            if (chatInactiveTimer) clearTimeout(chatInactiveTimer);
        }
    });

    // Resetear temporizador con cualquier actividad en el chat
    chatSidebar.addEventListener('click', resetChatTimer);
    container.querySelector('#chatInput')?.addEventListener('input', resetChatTimer);

    // Iniciar Chat Global
    initChat();

    function playBeep() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota La
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
        } catch (e) {
            console.log("Audio no permitido aún por el navegador");
        }
    }

    async function initChat() {
        const businessId = localStorage.getItem('businessId');
        const role = localStorage.getItem('userRole');
        
        // Esperar a que el usuario esté autenticado si no lo está ya
        const currentUserId = auth.currentUser?.uid || await new Promise(resolve => {
            const unsub = auth.onAuthStateChanged(user => { unsub(); resolve(user?.uid); });
        });

        if (!currentUserId || !businessId) return;

        const chatMessagesArea = container.querySelector('#chatMessagesArea');
        const chatForm = container.querySelector('#chatForm');
        const chatInput = container.querySelector('#chatInput');
        const activeChatName = container.querySelector('#activeChatName');

        activeChatName.textContent = "General";
        let firstLoad = true;

        // Obtener el nombre del remitente con máxima precisión
        let senderName = isAdmin ? "Administración" : "Sucursal...";
        try {
            if (isAdmin) {
                senderName = "Administración";
            } else {
                // PRIMERO: Intentar obtener el storeId de la sesión activa (el que eligen al entrar)
                const sessionStoreId = localStorage.getItem('storeId');
                
                if (sessionStoreId) {
                    const storeSnap = await getDoc(doc(db, "businesses", businessId, "stores", sessionStoreId));
                    if (storeSnap.exists()) {
                        senderName = storeSnap.data().name;
                    }
                } else {
                    // SEGUNDO: Si no hay en sesión, intentar del perfil de usuario
                    const userSnap = await getDoc(doc(db, "users", currentUserId));
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        if (userData.storeId) {
                            const storeSnap = await getDoc(doc(db, "businesses", businessId, "stores", userData.storeId));
                            senderName = storeSnap.exists() ? storeSnap.data().name : userData.name;
                        } else {
                            senderName = userData.name || "Colaborador";
                        }
                    }
                }
            }
        } catch (e) { 
            console.error("Error obteniendo nombre:", e);
            senderName = "Sucursal";
        }

        const q = query(
            collection(db, "businesses", businessId, "global_chat"),
            orderBy("createdAt", "asc")
        );

        onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
            chatMessagesArea.innerHTML = '';
            snap.forEach(d => {
                const msg = d.data();
                if (!msg.createdAt && !msg.text) return; 

                const isMine = msg.senderId === currentUserId;
                const div = document.createElement('div');
                div.className = `message-bubble ${isMine ? 'message-mine' : 'message-other'}`;
                
                // Mostrar siempre el nombre del remitente (Administración o Nombre de Tienda)
                const displayName = msg.senderName || (msg.senderRole === 'admin' ? "Administración" : "Tienda");

                div.innerHTML = `
                    <div style="font-size: 0.65rem; font-weight: bold; margin-bottom: 2px; opacity: 0.8;">
                        ${displayName} dice:
                    </div>
                    <div>${msg.text || ''}</div>
                `;
                chatMessagesArea.appendChild(div);
            });
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
            
            if (!firstLoad && snap.docChanges().some(change => change.type === "added")) {
                const changes = snap.docChanges();
                const newMessages = changes.filter(c => c.type === "added");
                
                newMessages.forEach(change => {
                    const msg = change.doc.data();
                    if (msg.senderId !== currentUserId) {
                        playBeep();
                        
                        // Si el chat está cerrado, aumentar contador de no leídos
                        if (chatSidebar.classList.contains('collapsed')) {
                            unreadCount++;
                            chatBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                            chatBadge.style.display = 'flex';
                        }
                    }
                });
            }
            firstLoad = false;
        });

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;

            // Asegurar que tenemos el nombre antes de enviar
            if (!senderName || senderName.includes("...")) {
                try {
                    const userSnap = await getDoc(doc(db, "users", currentUserId));
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        if (role === 'admin') {
                            senderName = "Administración";
                        } else if (userData.storeId) {
                            const storeSnap = await getDoc(doc(db, "businesses", businessId, "stores", userData.storeId));
                            senderName = storeSnap.exists() ? storeSnap.data().name : "Sucursal";
                        }
                    }
                } catch (err) { senderName = "Usuario"; }
            }

            chatInput.value = '';
            try {
                await addDoc(collection(db, "businesses", businessId, "global_chat"), {
                    text,
                    senderId: currentUserId,
                    senderName: senderName || (role === 'admin' ? "Administración" : "Tienda"),
                    senderRole: role,
                    createdAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Error enviando mensaje:", error);
            }
        });
    }

    // Renderizar página inicial al montar
    loadUserName();
    renderHome();

    return container;
}
