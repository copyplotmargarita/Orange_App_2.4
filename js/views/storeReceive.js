import { auth, db } from '../services/firebase.js';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderStoreReceive(container) {
    const businessId = localStorage.getItem('businessId');
    const storeId    = localStorage.getItem('storeId');
    const storeName  = localStorage.getItem('storeName') || 'Mi Tienda';

    let pendingOrders   = [];
    let receivedOrders  = [];
    let selectedOrderId = null;

    async function loadOrders() {
        try {
            container.innerHTML = '<div style="padding:2rem;text-align:center;">Cargando órdenes...</div>';
            if (!businessId || !storeId) {
                container.innerHTML = '<div class="text-danger" style="padding:2rem;text-align:center;">Error: No se identificó la tienda o el negocio.</div>';
                return;
            }

            const qPend = query(
                collection(db, "businesses", businessId, "storeTransfers"),
                where("storeId", "==", storeId),
                where("status",  "==", "PENDIENTE")
            );
            const qRecv = query(
                collection(db, "businesses", businessId, "storeTransfers"),
                where("storeId", "==", storeId),
                where("status",  "==", "RECIBIDO")
            );

            const [snapP, snapR] = await Promise.all([getDocs(qPend), getDocs(qRecv)]);
            
            pendingOrders  = snapP.docs.map(d => ({ id: d.id, ...d.data() }));
            receivedOrders = snapR.docs.map(d => ({ id: d.id, ...d.data() }));

            // Sort in memory
            pendingOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            receivedOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            renderList();
        } catch (err) {
            console.error("Error loading orders:", err);
            container.innerHTML = '<div class="text-danger" style="padding:2rem;text-align:center;">Error al conectar con el servidor. Reintente.</div>';
        }
    }

    function renderList() {
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;" class="flex-stack-mobile">
                <div>
                    <h2 style="margin:0;">📦 Recibir Productos</h2>
                    <p class="text-muted" style="margin:0.25rem 0 0;font-size:0.9rem;">Tienda: <strong>${storeName}</strong></p>
                </div>
            </div>

            ${pendingOrders.length > 0 ? `
            <div style="margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem;">
                <span style="width:10px;height:10px;border-radius:50%;background:#f97316;display:inline-block;animation:pulse-dot 1.5s infinite;"></span>
                <h4 style="margin:0;color:#f97316;">Órdenes Pendientes (${pendingOrders.length})</h4>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:2rem;">
                ${pendingOrders.map(o => `
                    <div class="card order-card" data-id="${o.id}" style="padding:1rem;border-left:4px solid #f97316;cursor:pointer;transition:box-shadow 0.2s;" onmouseenter="this.style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'" onmouseleave="this.style.boxShadow=''">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                            <div>
                                <span style="font-weight:bold;font-size:1rem;">🧾 Orden del ${o.date || '—'}</span>
                                <p style="margin:0.2rem 0 0;font-size:0.85rem;color:var(--text-muted);">Enviado por: ${o.createdBy} · ${(o.items||[]).length} producto(s)</p>
                            </div>
                            <button class="btn btn-primary receive-btn" data-id="${o.id}" style="width:auto;background:#f97316;border-color:#f97316;">Ver y Recibir →</button>
                        </div>
                        <div style="margin-top:0.5rem;font-size:0.83rem;color:var(--text-muted);">
                            ${(o.items||[]).map(i => `<span style="margin-right:0.75rem;">• ${i.qty} ${i.stockUnit} de <strong>${i.productName}</strong></span>`).join('')}
                        </div>
                    </div>`).join('')}
            </div>` : `
            <div class="card" style="padding:2rem;text-align:center;margin-bottom:2rem;border-left:4px solid var(--success);">
                <div style="font-size:2.5rem;margin-bottom:0.5rem;">✅</div>
                <p style="margin:0;color:var(--text-muted);">No hay órdenes pendientes por recibir.</p>
            </div>`}

            ${receivedOrders.length > 0 ? `
            <h4 style="margin-bottom:0.75rem;color:var(--text-muted);">Historial Recibido (${receivedOrders.length})</h4>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                ${receivedOrders.slice(0, 10).map(o => `
                    <div class="card" style="padding:0.75rem 1rem;border-left:4px solid var(--success);opacity:0.75;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                            <span style="font-weight:500;">✅ Orden del ${o.date || '—'}</span>
                            <span style="font-size:0.8rem;color:var(--text-muted);">Recibido por ${o.receivedBy || '—'}</span>
                        </div>
                        <p style="margin:0.2rem 0 0;font-size:0.82rem;color:var(--text-muted);">
                            ${(o.items||[]).map(i => `${i.qty} ${i.stockUnit} de ${i.productName}`).join(' · ')}
                        </p>
                    </div>`).join('')}
            </div>` : ''}

            <style>
                @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
            </style>`;

        container.querySelectorAll('.receive-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openOrderDetail(btn.dataset.id);
            });
        });
        container.querySelectorAll('.order-card').forEach(card => {
            card.addEventListener('click', () => openOrderDetail(card.dataset.id));
        });
    }

    function openOrderDetail(orderId) {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;
        selectedOrderId = orderId;

        container.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;">
                <button class="btn btn-outline" id="backToListBtn" style="width:auto;">← Atrás</button>
                <div>
                    <h2 style="margin:0;">📋 Detalle de Orden</h2>
                    <p class="text-muted" style="margin:0.2rem 0 0;font-size:0.9rem;">Enviado el ${order.date} por ${order.createdBy}</p>
                </div>
            </div>

            <div class="card" style="padding:0;overflow:hidden;margin-bottom:1.5rem;">
                <div style="padding:1rem 1.5rem;background:rgba(249,115,22,0.1);border-bottom:1px solid var(--border);">
                    <p style="margin:0;color:#f97316;font-weight:bold;">⏳ ORDEN PENDIENTE — Revisa el contenido y acepta cuando hayas verificado que los productos llegaron.</p>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
                    <thead><tr style="background:var(--surface);border-bottom:2px solid var(--border);">
                        <th style="padding:0.75rem 1.5rem;">Producto</th>
                        <th style="padding:0.75rem;text-align:right;">Cantidad</th>
                        <th style="padding:0.75rem;">Unidad</th>
                    </tr></thead>
                    <tbody>
                        ${(order.items || []).map(i => `
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:0.75rem 1.5rem;font-weight:500;">${i.productName}</td>
                                <td style="padding:0.75rem;text-align:right;font-weight:bold;font-size:1.1rem;color:var(--primary);">${i.qty}</td>
                                <td style="padding:0.75rem;color:var(--text-muted);">${i.stockUnit}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display:flex;gap:1rem;justify-content:flex-end;">
                <button class="btn btn-outline" id="rejectOrderBtn" style="width:auto;">Cancelar</button>
                <button class="btn btn-primary" id="acceptOrderBtn" style="width:auto;background:var(--success);border-color:var(--success);font-size:1rem;padding:0.75rem 2rem;">
                    ✅ Recibir Todo — Agregar a Mi Stock
                </button>
            </div>`;

        container.querySelector('#backToListBtn').addEventListener('click', renderList);
        container.querySelector('#rejectOrderBtn').addEventListener('click', renderList);
        container.querySelector('#acceptOrderBtn').addEventListener('click', () => acceptOrder(order));
    }

    async function acceptOrder(order) {
        const btn = container.querySelector('#acceptOrderBtn');
        btn.disabled = true; btn.textContent = 'Procesando...';

        try {
            // 1. Sumar stock a cada producto en el inventario de la tienda
            for (const item of order.items || []) {
                const invRef = doc(db, "businesses", businessId, "stores", storeId, "inventory", item.productId);
                const snap = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js")
                    .then(m => m.getDoc(invRef));

                const currentQty = snap.exists() ? (snap.data().qty || 0) : 0;
                await setDoc(invRef, {
                    productId:   item.productId,
                    productName: item.productName,
                    qty:         currentQty + item.qty,
                    stockUnit:   item.stockUnit,
                    priceDetal:  item.priceDetal  || 0,
                    priceMayor:  item.priceMayor  || 0,
                    priceSpecial: item.priceSpecial || 0,
                    category:    item.category    || '',
                    lastUpdated: serverTimestamp()
                });
            }

            // 2. Marcar la orden como RECIBIDA
            const transferRef = doc(db, "businesses", businessId, "storeTransfers", order.id);
            await updateDoc(transferRef, {
                status:     'RECIBIDO',
                receivedBy: auth.currentUser?.email || 'empleado',
                receivedAt: serverTimestamp()
            });

            showToast('✅ Productos recibidos y agregados a tu stock de tienda.', 'success');
            await loadOrders();
        } catch (err) {
            console.error(err);
            showToast('Error al procesar la orden.', 'error');
            btn.disabled = false;
            btn.textContent = '✅ Recibir Todo — Agregar a Mi Stock';
        }
    }

    function showToast(msg, type = 'success') {
        let tc = document.querySelector('.toast-container');
        if (!tc) { tc = document.createElement('div'); tc.className = 'toast-container'; document.body.appendChild(tc); }
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
        tc.appendChild(t);
        setTimeout(() => t.classList.add('show'), 50);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4500);
    }

    loadOrders();
}
