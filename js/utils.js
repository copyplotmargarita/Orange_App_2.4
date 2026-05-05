export function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

export function showNotification(msg, type = 'error') {
    const toast = document.createElement('div');
    const color = type === 'error' ? '#ef4444' : '#22c55e';
    const icon = type === 'error' ? '⚠️' : '✅';
    
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                to { opacity: 0; transform: translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
    }

    toast.style = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: white;
        color: #1f2937;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        border-left: 6px solid ${color};
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 1rem;
        font-weight: 600;
        animation: slideInRight 0.3s ease-out, fadeOut 0.5s ease-in 2.5s forwards;
        max-width: 350px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    `;
    
    toast.innerHTML = `
        <span style="font-size: 1.5rem;">${icon}</span>
        <span style="flex: 1;">${msg}</span>
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/**
 * Verifica si una fecha es fin de semana o feriado nacional en Venezuela
 */
export function isVenezuelaHoliday(date) {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const dayOfWeek = d.getDay(); // 0: Dom, 6: Sab

    // Fines de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;

    // Feriados fijos en Venezuela (Día-Mes)
    const fixedHolidays = [
        "1-1",   // Año Nuevo
        "19-4",  // Declaración Independencia
        "1-5",   // Día del Trabajador
        "24-6",  // Batalla de Carabobo
        "5-7",   // Día de la Independencia
        "24-7",  // Natalicio del Libertador
        "12-10", // Día de la Resistencia Indígena
        "24-12", // Víspera Navidad
        "25-12", // Navidad
        "31-12"  // Fin de Año
    ];

    return fixedHolidays.includes(`${day}-${month}`);
}

/**
 * Obtiene el siguiente día hábil (lunes a viernes, no feriado)
 */
export function getNextBusinessDay(date) {
    let next = new Date(date);
    do {
        next.setDate(next.getDate() + 1);
    } while (isVenezuelaHoliday(next));
    return next;
}

/**
 * Utilidad global para navegar cambiando el hash de la URL
 */
export function navigate(hash) {
    window.location.hash = hash;
}

/**
 * Muestra un modal de confirmación con estilo premium
 */
export function showConfirmModal(title, msg, onConfirm, confirmText = "Confirmar", cancelText = "Volver") {
    const modal = document.createElement('div');
    modal.style = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div class="card" style="width: 90%; max-width: 400px; padding: 2rem; text-align: center; animation: modalIn 0.3s ease-out;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🧾</div>
            <h3 style="margin-bottom: 0.5rem;">${title}</h3>
            <p style="color: var(--text-muted); margin-bottom: 2rem;">${msg}</p>
            <div style="display: flex; gap: 1rem;">
                <button id="cancelFinalBtn" class="btn btn-outline" style="flex: 1;">${cancelText}</button>
                <button id="confirmFinalBtn" class="btn btn-primary" style="flex: 1; background: var(--success); border-color: var(--success);">${confirmText}</button>
            </div>
        </div>
    `;
    
    // Add animation if not present
    if (!document.getElementById('modal-animations')) {
        const style = document.createElement('style');
        style.id = 'modal-animations';
        style.textContent = `
            @keyframes modalIn {
                from { transform: scale(0.9); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(modal);
    modal.querySelector('#cancelFinalBtn').onclick = () => modal.remove();
    modal.querySelector('#confirmFinalBtn').onclick = () => {
        modal.remove();
        onConfirm();
    };
}
