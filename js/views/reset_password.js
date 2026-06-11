import { auth } from '../services/firebase.js';
import { confirmPasswordReset } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

export function renderResetPassword(container) {
    container.innerHTML = `
        <div class="auth-layout">
            <div class="card auth-card" style="animation: modalIn 0.3s ease-out;">
                <div class="text-center mb-4">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
                    <h2>Crear Nueva Contraseña</h2>
                    <p class="text-muted text-sm">Establece tu nueva contraseña de acceso</p>
                </div>
                
                <form id="resetPwdForm">
                    <div id="errorMsg" style="color: var(--danger); font-size: 0.875rem; margin-bottom: 1rem; text-align: center;"></div>
                    
                    <div class="form-group mb-4">
                        <label>Nueva Contraseña</label>
                        <input type="password" id="newPassword" class="form-control" placeholder="••••••••" required minlength="6">
                    </div>
                    
                    <div class="form-group mb-4">
                        <label>Confirmar Contraseña</label>
                        <input type="password" id="confirmPassword" class="form-control" placeholder="••••••••" required minlength="6">
                    </div>
                    
                    <button type="submit" class="btn btn-primary mb-4" id="saveBtn">Guardar Contraseña</button>
                </form>
                
                <div class="text-center">
                    <p class="text-sm"><a href="#entrar" style="color: var(--primary); text-decoration: none; font-weight: 500;">← Volver al inicio de sesión</a></p>
                </div>
            </div>
        </div>
    `;

    const form = container.querySelector('#resetPwdForm');
    const errorMsg = container.querySelector('#errorMsg');
    const saveBtn = container.querySelector('#saveBtn');

    // Extraer el oobCode de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const oobCode = urlParams.get('oobCode');

    if (!oobCode) {
        errorMsg.textContent = 'Enlace inválido o expirado. Por favor, solicita un nuevo enlace de recuperación.';
        saveBtn.disabled = true;
        return container;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const pwd1 = container.querySelector('#newPassword').value;
        const pwd2 = container.querySelector('#confirmPassword').value;

        if (pwd1 !== pwd2) {
            errorMsg.style.color = 'var(--danger)';
            errorMsg.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        if (pwd1.length < 6) {
            errorMsg.style.color = 'var(--danger)';
            errorMsg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            return;
        }

        try {
            errorMsg.style.color = 'var(--text-muted)';
            errorMsg.textContent = 'Actualizando contraseña...';
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';

            await confirmPasswordReset(auth, oobCode, pwd1);

            errorMsg.style.color = 'var(--success)';
            errorMsg.textContent = '✅ ¡Contraseña actualizada con éxito!';
            
            // Limpiar la URL de parámetros para que no se quede pegado en reset mode
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Redirigir al login después de 2 segundos
            setTimeout(() => {
                window.location.hash = '#entrar';
                // Para asegurarnos que se re-renderice el app con la URL limpia, podemos forzar un reload
                window.location.reload();
            }, 2000);

        } catch (err) {
            console.error("Error al restablecer:", err);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar Contraseña';
            errorMsg.style.color = 'var(--danger)';
            
            if (err.code === 'auth/expired-action-code') {
                errorMsg.textContent = 'El enlace ha expirado. Por favor, solicita uno nuevo.';
            } else if (err.code === 'auth/invalid-action-code') {
                errorMsg.textContent = 'El enlace es inválido o ya fue utilizado.';
            } else if (err.code === 'auth/weak-password') {
                errorMsg.textContent = 'La contraseña es demasiado débil.';
            } else {
                errorMsg.textContent = 'Error al actualizar. Intenta de nuevo más tarde.';
            }
        }
    });

    return container;
}
