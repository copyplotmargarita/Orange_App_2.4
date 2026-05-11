import { renderLogin } from './views/login.js';
import { renderRegister } from './views/register.js';
import { renderConfig } from './views/config.js';
import { renderDashboard } from './views/dashboard.js';
import { renderPurchases } from './views/purchases.js';
import { renderProducts } from './views/products.js';
import { renderInventory } from './views/inventory.js';
import { renderClients } from './views/clients.js';
import { renderSuppliers } from './views/suppliers.js';
import { renderSales } from './views/sales.js';

const routes = {
    '': renderLogin,
    '#login': renderLogin,
    '#register': renderRegister,
    '#config': renderConfig,
    '#dashboard': renderDashboard,
    '#purchases': renderPurchases,
    '#products': renderProducts,
    '#inventory': renderInventory,
    '#clients': renderClients,
    '#suppliers': renderSuppliers,
    '#sales': renderSales,
    '#sales/history': renderSales
};

function router() {
    try {
        const app = document.getElementById('app');
        if (!app) return;
        
        let hash = window.location.hash || '#login';
        
        // Protección de rutas (Route Guards)
        const businessId = localStorage.getItem('businessId');
        
        if (businessId) {
            // Si está logueado, no permitir ir a login o vacío
            if (hash === '#login' || hash === '') {
                window.location.hash = '#dashboard';
                return;
            }
        } else {
            // Si NO está logueado, solo permitir login y register
            if (hash !== '#login' && hash !== '#register') {
                window.location.hash = '#login';
                return;
            }
        }
        
        const mainContent = document.getElementById('mainContentArea');
        
        if (mainContent && hash !== '#login' && hash !== '#register' && hash !== '#dashboard') {
            const renderFunc = routes[hash];
            if (renderFunc) {
                const view = renderFunc(mainContent);
                if (view && view !== mainContent) {
                    mainContent.innerHTML = '';
                    mainContent.appendChild(view);
                }
            }
        } else {
            app.innerHTML = ''; // Clear current view
            const renderFunc = routes[hash] || renderLogin;
            const view = renderFunc(app);
            if (view && view !== app) {
                app.appendChild(view);
            } else if (!view && app.innerHTML === '') {
                console.error("View returned undefined and didn't modify container for hash:", hash);
            }
        }
    } catch (err) {
        console.error("Router error:", err);
        alert("Router error: " + err.message);
    }
}

// Escuchar cambios en la URL (hash)
window.addEventListener('hashchange', router);

// Ejecutar router al cargar la página
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', router);
} else {
    router();
}

// Utilidad global para errores (opcional pero recomendado)
window.addEventListener('error', (e) => {
    console.error("Global error caught:", e.message);
});


