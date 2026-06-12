import { db } from '../services/firebase.js';
import { 
    collection, 
    getDocs, 
    writeBatch, 
    doc, 
    query, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { showNotification } from '../utils.js';

export function renderMaintenance(container) {
    const businessId = localStorage.getItem('businessId');
    const role = localStorage.getItem('userRole');

    if (role !== 'admin' && role !== 'administrador') {
        container.innerHTML = '<div class="alert alert-danger">Acceso restringido solo para administradores.</div>';
        return;
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
            <button class="btn btn-outline" id="backToDashboardBtn" style="width: auto; padding: 0.5rem 1rem; height: 38px; font-size: 0.85rem;">← Volver</button>
            <h2 style="color: var(--danger); font-size: 1.5rem; font-weight: 800; margin-bottom: 0;">⚙️ Mantenimiento</h2>
        </div>

        <div style="max-width: 500px; margin: 0 auto; padding: 2rem; border-top: 4px solid var(--danger); display: flex; flex-direction: column; gap: 0.35rem;" class="card">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <p class="text-muted" style="margin-top: 0;">Limpieza profunda de datos de prueba</p>
            </div>

            <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="color: var(--danger); font-size: 1rem; font-weight: 800; margin-bottom: 0.5rem; text-transform: uppercase;">⚠️ Zona de Peligro</h3>
                <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; margin: 0;">
                    Esta acción eliminará permanentemente todos los registros seleccionados. Use esta herramienta solo para limpiar datos de prueba antes de iniciar operaciones reales.
                </p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="products" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">🛍️ Productos e Inventarios</span>
                        <small class="text-muted">Elimina catálogo, recetas y existencias actuales.</small>
                    </div>
                </label>

                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="sales" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">💰 Ventas y Pagos</span>
                        <small class="text-muted">Elimina historial de facturación y cobros recaudados.</small>
                    </div>
                </label>

                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="purchases" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">🧾 Compras y Recepciones</span>
                        <small class="text-muted">Elimina facturas de proveedores y registros de entrada.</small>
                    </div>
                </label>

                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="transfers" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">🔄 Transferencias y Tasas</span>
                        <small class="text-muted">Elimina envíos entre tiendas e historial del BCV.</small>
                    </div>
                </label>

                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="clients" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">👥 Clientes</span>
                        <small class="text-muted">Elimina la base de datos de clientes.</small>
                    </div>
                </label>

                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="suppliers" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">🏭 Proveedores</span>
                        <small class="text-muted">Elimina el registro de proveedores.</small>
                    </div>
                </label>

                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="employees" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">👨‍💼 Empleados y Permisos</span>
                        <small class="text-muted">Elimina empleados (excepto el admin actual).</small>
                    </div>
                </label>

                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 1rem; background: var(--background); border-radius: 10px; border: 1px solid var(--border);">
                    <input type="checkbox" class="reset-check" value="stores" checked style="width: 20px; height: 20px; accent-color: var(--primary);">
                    <div>
                        <span style="display: block; font-weight: 700;">🏪 Tiendas y Cajas</span>
                        <small class="text-muted">Elimina sucursales adicionales.</small>
                    </div>
                </label>
            </div>

            <div style="margin-bottom: 1.5rem;" class="form-group">
                <label style="display: block; font-weight: 800; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem;">Escriba "BORRAR TODO" para confirmar</label>
                <input type="text" id="confirmInput" class="form-control" placeholder="Escriba aquí..." style="text-align: center; height: 50px; font-weight: 900; letter-spacing: 2px;">
            </div>

            <button id="btnResetSystem" class="btn btn-primary" disabled style="width: 100%; height: 50px; font-weight: 800; background: var(--danger); border-color: var(--danger);">
                💥 EJECUTAR LIMPIEZA DE DATOS
            </button>
            
            <p id="resetProgress" style="display: none; text-align: center; margin-top: 1rem; font-weight: bold; color: var(--primary);"></p>
        </div>

        <style>
            .form-control { 
                border-radius: 10px; 
                border: 1px solid var(--border); 
                padding: 0 1rem; 
                transition: var(--transition); 
                background: var(--surface); 
                color: var(--text-main); 
                width: 100%;
                box-sizing: border-box;
            }
            .form-control:focus { border-color: var(--danger); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); outline: none; }
        </style>
    `;

    const confirmInput = container.querySelector('#confirmInput');
    const btnReset = container.querySelector('#btnResetSystem');
    const progressEl = container.querySelector('#resetProgress');

    const backBtn = container.querySelector('#backToDashboardBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const navHome = document.getElementById('navHome');
            if (navHome) {
                navHome.click();
                const toggleIcon = document.getElementById('toggleIcon');
                if (toggleIcon && toggleIcon.innerText === '▶') {
                    document.getElementById('sidebarToggle')?.click();
                }
            } else {
                window.location.hash = '#dashboard';
            }
        });
    }

    confirmInput.addEventListener('input', (e) => {
        btnReset.disabled = e.target.value !== 'BORRAR TODO';
    });

    btnReset.onclick = async () => {
        const selected = Array.from(container.querySelectorAll('.reset-check:checked')).map(cb => cb.value);
        if (selected.length === 0) {
            showNotification("Seleccione al menos un módulo", "error");
            return;
        }

        if (!confirm("⚠️ ¿ESTÁ TOTALMENTE SEGURO?\nEsta acción es irreversible y borrará los datos de producción.")) return;

        btnReset.disabled = true;
        btnReset.textContent = "BORRANDO...";
        progressEl.style.display = 'block';
        progressEl.textContent = "⌛ Iniciando limpieza...";

        try {
            const collectionsToWipe = [];
            if (selected.includes('products')) collectionsToWipe.push('products', 'inventoryMovements', 'productionBatches');
            if (selected.includes('sales')) collectionsToWipe.push('sales', 'payments');
            if (selected.includes('purchases')) collectionsToWipe.push('purchases');
            if (selected.includes('transfers')) collectionsToWipe.push('storeTransfers', 'bcv_history');
            if (selected.includes('clients')) collectionsToWipe.push('clients');
            if (selected.includes('suppliers')) collectionsToWipe.push('suppliers');
            if (selected.includes('employees')) collectionsToWipe.push('employees');
            if (selected.includes('stores')) collectionsToWipe.push('stores');

            for (const colName of collectionsToWipe) {
                progressEl.textContent = `🧹 Limpiando ${colName}...`;
                await deleteCollection(colName, businessId);
            }

            progressEl.textContent = "✅ ¡Limpieza completada con éxito!";
            progressEl.style.color = "var(--success)";
            showNotification("Sistema reseteado correctamente", "success");
            
            setTimeout(() => {
                location.reload(); // Recargar para limpiar estados locales
            }, 2000);

        } catch (error) {
            console.error("Error en reset:", error);
            showNotification("Error durante el borrado: " + error.message, "error");
            btnReset.disabled = false;
            btnReset.textContent = "💥 EJECUTAR LIMPIEZA DE DATOS";
        }
    };
}

async function deleteCollection(colName, businessId) {
    const colRef = collection(db, "businesses", businessId, colName);
    const userEmail = localStorage.getItem('userEmail');
    
    const docsSnap = await getDocs(colRef);
    const docs = docsSnap.docs;
    
    let i = 0;
    while (i < docs.length) {
        const batch = writeBatch(db);
        let currentBatchCount = 0;
        
        while (currentBatchCount < 500 && i < docs.length) {
            const d = docs[i];
            if (colName === 'employees' && d.data().email === userEmail) {
                // Omitir el usuario/admin actual para que no se auto-elimine
            } else {
                batch.delete(d.ref);
                currentBatchCount++;
            }
            i++;
        }
        
        if (currentBatchCount > 0) {
            await batch.commit();
            console.log(`Borrados ${currentBatchCount} documentos de ${colName}`);
        }
    }
}
