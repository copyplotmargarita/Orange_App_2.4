import { db } from '../services/firebase.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy,
    writeBatch,
    doc,
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { showNotification, formatDateToDDMMYYYY } from '../utils.js';

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

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--primary); text-align: center; cursor: pointer; transition: transform 0.2s;" id="btnHistoricoTasa">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📈</div>
                <h3 style="color: var(--primary); font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem;">Histórico Tasa BCV</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Consulta todas las tasas guardadas en la base de datos por registro.</p>
            </div>

            <div class="card" style="padding: 1.5rem; border-top: 4px solid var(--warning); text-align: center; cursor: pointer; transition: transform 0.2s;" id="btnMigrateBcv">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🧹</div>
                <h3 style="color: var(--warning); font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem;">Normalizar Histórico</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">Corrige IDs antiguos, añade creadores y horas faltantes a los registros.</p>
            </div>
        </div>

        <div id="maintenanceContentArea"></div>
    `;

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

    const btnHistoricoTasa = container.querySelector('#btnHistoricoTasa');
    const contentArea = container.querySelector('#maintenanceContentArea');

    btnHistoricoTasa.addEventListener('click', async () => {
        contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;"><p style="color: var(--text-muted);">Cargando histórico...</p></div>';
        
        try {
            const bcvRef = collection(db, "global_bcv_history");
            const snap = await getDocs(bcvRef);

            if (snap.empty) {
                contentArea.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--text-muted); margin: 0;">No hay registros de tasas.</p></div>';
                return;
            }

            const records = [];
            snap.forEach(docSnap => {
                records.push({ id: docSnap.id, ...docSnap.data() });
            });
            if (records.length === 0) {
                contentArea.innerHTML = '<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--text-muted); margin: 0;">No hay registros de tasas.</p></div>';
                return;
            }

            let tableHTML = `
                <div class="card" style="padding: 1.5rem; overflow-x: auto;">
                    <h3 style="margin-top: 0; margin-bottom: 1.5rem; color: var(--text-main);">Registros de Tasa BCV</h3>
                    <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); text-align: left;">
                                <th style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">ID (Fecha)</th>
                                <th style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Tasa</th>
                                <th style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Tipo</th>
                                <th style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Creado Por</th>
                                <th style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase;">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            function parseDocIdToDate(idStr) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(idStr)) return new Date(idStr + 'T12:00:00');
                if (/^\d{2}-\d{2}-\d{4}$/.test(idStr)) {
                    const parts = idStr.split('-');
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                }
                if (/^\d{4}\/\d{2}\/\d{2}$/.test(idStr)) return new Date(idStr.replace(/\//g, '-') + 'T12:00:00');
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(idStr)) {
                    const parts = idStr.split('/');
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                }
                const fallback = new Date(idStr);
                return isNaN(fallback.getTime()) ? null : fallback;
            }

            const recordsMap = {};
            let minTime = Infinity;
            let maxTime = -Infinity;

            records.forEach(r => {
                const d = parseDocIdToDate(r.id);
                if (d) {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const normId = `${yyyy}-${mm}-${dd}`;
                    recordsMap[normId] = r;
                    const time = d.getTime();
                    if (time < minTime) minTime = time;
                    if (time > maxTime) maxTime = time;
                } else {
                    recordsMap[r.id] = r; // Fallback
                }
            });

            if (minTime === Infinity) {
                // Failsafe, shouldn't happen unless completely corrupt data
                minTime = new Date().getTime();
                maxTime = new Date().getTime();
            }

            const newestDate = new Date(maxTime);
            const oldestDate = new Date(minTime);

            function formatFullDateES(dateObj) {
                const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                const dayName = days[dateObj.getDay()];
                const d = String(dateObj.getDate()).padStart(2, '0');
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const y = dateObj.getFullYear();
                return `${dayName} ${d}/${m}/${y}`;
            }

            let currentDate = new Date(newestDate);

            while (currentDate >= oldestDate) {
                const currentStr = currentDate.getFullYear() + '-' + String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(currentDate.getDate()).padStart(2, '0');
                const displayDate = formatFullDateES(currentDate);

                if (recordsMap[currentStr]) {
                    const data = recordsMap[currentStr];
                    const rate = data.rate ? parseFloat(data.rate).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'N/A';
                    const isManual = data.isManual ? '<span style="color: var(--warning); font-weight: bold;">Manual</span>' : '<span style="color: var(--success); font-weight: bold;">API</span>';
                    
                    let createdAtStr = 'N/A';
                    if (data.createdAt && data.createdAt.toDate) {
                        const d = data.createdAt.toDate();
                        createdAtStr = formatDateToDDMMYYYY(d) + ' ' + d.toLocaleTimeString('es-VE');
                    } else if (typeof data.createdAt === 'string') {
                        createdAtStr = data.createdAt;
                    }

                    const createdBy = data.createdBy || 'N/A';

                    tableHTML += `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 0.75rem; font-weight: bold;">${displayDate}</td>
                            <td style="padding: 0.75rem; color: var(--primary); font-weight: bold;">Bs. ${rate}</td>
                            <td style="padding: 0.75rem;">${isManual}</td>
                            <td style="padding: 0.75rem; font-size: 0.9rem; word-break: break-all;">${createdBy}</td>
                            <td style="padding: 0.75rem; font-size: 0.85rem; color: var(--text-muted);">${createdAtStr}</td>
                        </tr>
                    `;
                } else {
                    tableHTML += `
                        <tr style="border-bottom: 1px dashed var(--border); background: rgba(0,0,0,0.015);">
                            <td style="padding: 0.75rem; font-weight: bold; color: var(--text-muted);">${displayDate}</td>
                            <td style="padding: 0.75rem; color: var(--text-muted);">-</td>
                            <td style="padding: 0.75rem; color: var(--text-muted);">-</td>
                            <td style="padding: 0.75rem; color: var(--text-muted);">-</td>
                            <td style="padding: 0.75rem; color: var(--text-muted);">-</td>
                        </tr>
                    `;
                }

                currentDate.setDate(currentDate.getDate() - 1);
            }

            tableHTML += `
                        </tbody>
                    </table>
                </div>
            `;

            contentArea.innerHTML = tableHTML;

        } catch (error) {
            console.error("Error consultando histórico:", error);
            contentArea.innerHTML = `<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--danger); margin: 0;">Error al cargar el histórico: ${error.message}</p></div>`;
            showNotification("Error consultando histórico", "error");
        }
    });

    const btnMigrateBcv = container.querySelector('#btnMigrateBcv');
    btnMigrateBcv.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de que deseas migrar toda la base de datos de tasas BCV a la colección GLOBAL? Esta operación unificará las tasas y bloqueará ediciones pasadas.')) return;
        
        contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;"><p style="color: var(--warning); font-weight: bold; font-size: 1.1rem;">Normalizando base de datos, por favor espere...</p></div>';
        
        try {
            const bcvRef = collection(db, "businesses", businessId, "bcv_history");
            const snap = await getDocs(bcvRef);
            
            let batch = writeBatch(db);
            let count = 0;
            let totalProcessed = 0;

            function getStandardDate(idStr) {
                let d = null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(idStr)) d = new Date(idStr + 'T12:00:00');
                else if (/^\d{2}-\d{2}-\d{4}$/.test(idStr)) {
                    const parts = idStr.split('-');
                    d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                }
                else if (/^\d{4}\/\d{2}\/\d{2}$/.test(idStr)) d = new Date(idStr.replace(/\//g, '-') + 'T12:00:00');
                else if (/^\d{2}\/\d{2}\/\d{4}$/.test(idStr)) {
                    const parts = idStr.split('/');
                    d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
                }
                if (!d) {
                    const fallback = new Date(idStr);
                    d = isNaN(fallback.getTime()) ? null : fallback;
                }
                
                if (d) {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    return { normId: `${yyyy}-${mm}-${dd}`, dateObj: d };
                }
                return null;
            }

            const docs = snap.docs;
            for (let i = 0; i < docs.length; i++) {
                const docSnap = docs[i];
                const data = docSnap.data();
                const originalId = docSnap.id;
                
                const parsed = getStandardDate(originalId);
                if (!parsed) continue; 
                
                const normId = parsed.normId;
                const targetDate = new Date(`${normId}T12:01:00`);
                
                let finalCreatedAt = data.createdAt;
                if (!finalCreatedAt || typeof finalCreatedAt === 'string') {
                    finalCreatedAt = Timestamp.fromDate(targetDate);
                }
                
                const newData = {
                    rate: data.rate,
                    date: normId,
                    createdBy: data.createdBy || 'u7VmYmeLKFgEiUs6EKGLH1BRw4r2',
                    createdAt: finalCreatedAt,
                    isManual: data.isManual !== undefined ? data.isManual : true,
                    editCount: 3
                };

                const newDocRef = doc(db, "global_bcv_history", normId);
                batch.set(newDocRef, newData);
                count++;
                
                if (originalId) { // Eliminamos siempre el original local para completar la migración
                    const oldDocRef = doc(db, "businesses", businessId, "bcv_history", originalId);
                    batch.delete(oldDocRef);
                    count++;
                }
                
                totalProcessed++;
                
                if (count > 450) { 
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }

            if (count > 0) {
                await batch.commit();
            }
            
            contentArea.innerHTML = `<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--success); font-weight: bold; margin: 0; font-size: 1.2rem;">✅ ¡Base de datos normalizada con éxito! (${totalProcessed} registros unificados).</p></div>`;
            showNotification("Base de datos normalizada", "success");
            
        } catch (error) {
            console.error("Error migrando:", error);
            contentArea.innerHTML = `<div class="card" style="padding: 2rem; text-align: center;"><p style="color: var(--danger); margin: 0;">Error en la migración: ${error.message}</p></div>`;
        }
    });
}
