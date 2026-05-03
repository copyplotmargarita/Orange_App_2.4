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
    '#sales': renderSales
};

function router() {
    try {
        const app = document.getElementById('app');
        if (!app) return;
        app.innerHTML = ''; // Clear current view
        
        let hash = window.location.hash || '#login';
        
        // Render the view
        const renderFunc = routes[hash] || renderLogin;
        const view = renderFunc(app);
        
        // If the view returned an element, append it (if it didn't already modify app)
        if (view && view !== app) {
            app.appendChild(view);
        } else if (!view && app.innerHTML === '') {
            console.error("View returned undefined and didn't modify container for hash:", hash);
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


