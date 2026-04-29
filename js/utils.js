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
