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
import { renderResetPassword } from './views/reset_password.js';
import { renderPublicRegister } from './views/public_register.js';

const routes = {
    '': renderLogin,
    '#entrar': renderLogin,
    '#register': renderRegister,
    '#config': renderConfig,
    '#dashboard': renderDashboard,
    '#purchases': renderPurchases,
    '#products': renderProducts,
    '#inventory': renderInventory,
    '#clients': renderClients,
    '#suppliers': renderSuppliers,
    '#sales': renderSales,
    '#public_register': renderPublicRegister
};

function router() {
    try {
        const app = document.getElementById('app');
        if (!app) return;
        
        // INTERCEPTOR PARA RECUPERACIÓN DE CONTRASEÑA FIREBASE
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        if (mode === 'resetPassword') {
            app.innerHTML = ''; // Limpiar
            const view = renderResetPassword(app);
            if (view && view !== app) {
                app.appendChild(view);
            }
            return; // Detener router normal
        }

        let hash = window.location.hash || '#entrar';
        
        // Protección de rutas (Route Guards)
        const businessId = localStorage.getItem('businessId');
        
        if (businessId) {
            // Si está logueado, no permitir ir a login o vacío
            if (hash === '#entrar' || hash === '') {
                window.location.hash = '#dashboard';
                return;
            }
        } else {
            // Si NO está logueado, solo permitir login, register o rutas públicas
            if (hash !== '#entrar' && hash !== '#register' && !hash.startsWith('#public_register')) {
                window.location.hash = '#entrar';
                return;
            }
        }
        
        const mainContent = document.getElementById('mainContentArea');
        
        if (mainContent && hash !== '#entrar' && hash !== '#register' && hash !== '#dashboard' && !hash.startsWith('#public_register')) {
            const routeKey = hash.split('?')[0];
            const renderFunc = routes[routeKey];
            if (renderFunc) {
                const view = renderFunc(mainContent);
                if (view && view !== mainContent) {
                    mainContent.innerHTML = '';
                    mainContent.appendChild(view);
                }
            }
        } else {
            app.innerHTML = ''; // Clear current view
            const routeKey = hash.split('?')[0];
            const renderFunc = routes[routeKey] || renderLogin;
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


