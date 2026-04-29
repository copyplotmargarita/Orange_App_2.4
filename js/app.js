import { renderLogin } from './views/login.js';
import { renderRegister } from './views/register.js';
import { renderConfig } from './views/config.js';
import { renderDashboard } from './views/dashboard.js';

const routes = {
    '': renderLogin,
    '#login': renderLogin,
    '#register': renderRegister,
    '#config': renderConfig,
    '#dashboard': renderDashboard
};

function router() {
    const app = document.getElementById('app');
    app.innerHTML = ''; // Clear current view
    
    let hash = window.location.hash || '#login';
    
    const renderFunc = routes[hash] || renderLogin;
    
    // Render the view and append it
    const view = renderFunc();
    app.appendChild(view);
}

// Escuchar cambios en la URL (hash)
window.addEventListener('hashchange', router);

// Ejecutar router al cargar la página
window.addEventListener('DOMContentLoaded', router);

// Utilidad global para navegar
export function navigate(hash) {
    window.location.hash = hash;
}
