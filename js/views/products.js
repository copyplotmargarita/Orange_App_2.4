import { auth, db } from '../services/firebase.js';
import { toTitleCase, showNotification } from '../utils.js';
import { doc, setDoc, getDocs, getDoc, collection, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function renderProducts(container) {
    let products = [];
    let suppliers = [];
    let bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 0;
    const role = localStorage.getItem('userRole');

    async function loadData() {
        container.innerHTML = '<div style="padding: 2rem; text-align: center;">Cargando inventario...</div>';
        const businessId = localStorage.getItem('businessId');
        if (!businessId) return;
        
        try {
            // Load products
            const qProd = query(collection(db, "businesses", businessId, "products"), orderBy("name", "asc"));
            const snapProd = await getDocs(qProd);
            products = snapProd.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // If employee, load store inventory and merge
            if (role === 'employee') {
                const storeId = localStorage.getItem('storeId');
                if (storeId) {
                    const qStoreInv = query(collection(db, "businesses", businessId, "stores", storeId, "inventory"));
                    const snapStoreInv = await getDocs(qStoreInv);
                    const storeStockMap = {};
                    snapStoreInv.forEach(doc => {
                        storeStockMap[doc.id] = doc.data().qty || 0;
                    });
                    
                    // Override product stock with store stock
                    products = products.map(p => ({
                        ...p,
                        stockGeneral: storeStockMap[p.id] || 0 // Use store stock instead of general
                    }));
                }
            }

            // Load suppliers for dropdowns
            const qSup = query(collection(db, "businesses", businessId, "suppliers"), orderBy("name", "asc"));
            const snapSup = await getDocs(qSup);
            suppliers = snapSup.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            renderList();

            if (window.openCreateProductForPurchase) {
                window.openCreateProductForPurchase = false;
                renderForm();
            }
        } catch (error) {
            console.error("Error cargando datos:", error);
            container.innerHTML = '<div class="text-danger">Error al cargar los datos.</div>';
        }
    }

    function renderList() {
        let html = `
            <div class="flex-stack-mobile" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2>Productos</h2>
                ${role !== 'employee' ? `<button class="btn btn-primary" id="addProductBtn" style="width: auto;">+ Crear Producto</button>` : ''}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1.5rem;">
        `;
        
        if (products.length === 0) {
            html += `<p class="text-muted" style="grid-column: 1 / -1;">No hay productos registrados aún.</p>`;
        } else {
            products.forEach(prod => {
                const stock = prod.stockGeneral ?? prod.stock ?? 0;
                const bcvRateLocal = parseFloat(localStorage.getItem('bcvRate')) || 1;
                const priceBsNum = prod.priceDetal * bcvRateLocal;
                const formatCurrency = (num) => parseFloat(num).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                let stockBadge = '';
                if (prod.category !== 'SERVICIOS') {
                    const sUnit = prod.stockUnit || 'ud';
                    if (stock <= 0) {
                        stockBadge = `<span style="position: absolute; bottom: 0.25rem; right: 0.25rem; background: var(--danger); color: white; padding: 0.15rem 0.3rem; border-radius: 4px; font-size: 0.6rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">SIN STOCK</span>`;
                    } else {
                        stockBadge = `<span style="position: absolute; bottom: 0.25rem; right: 0.25rem; background: var(--success); color: white; padding: 0.15rem 0.3rem; border-radius: 4px; font-size: 0.6rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">STOCK: ${stock} ${sUnit}</span>`;
                    }
                }

                const imageHtml = prod.image 
                    ? `<div style="width: 100%; height: 130px; background: white; display: flex; align-items: center; justify-content: center; position: relative;"><img src="${prod.image}" alt="${prod.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">${stockBadge}</div>`
                    : `<div style="width: 100%; height: 130px; background: var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-muted); position: relative;">Sin Imagen${stockBadge}</div>`;

                html += `
                    <div class="card product-card" data-id="${prod.id}" style="padding: 0; overflow: hidden; position: relative; cursor: ${role !== 'employee' ? 'pointer' : 'default'};">
                        ${role !== 'employee' ? `<button class="delete-product-btn" data-id="${prod.id}" style="position: absolute; top: 0.5rem; left: 0.5rem; background: rgba(239, 68, 68, 0.9); color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; z-index: 10; font-weight: bold; border: 1px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">×</button>` : ''}
                        ${imageHtml}
                        <div style="padding: 0.75rem;">
                            <h3 style="color: var(--primary); margin-bottom: 0.5rem; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${prod.name}">${prod.name}</h3>
                            <div style="margin-bottom: 0.5rem;">
                                <p style="font-weight: bold; font-size: 1rem; color: var(--text-main);">$ ${formatCurrency(prod.priceDetal)}</p>
                                <p style="font-weight: bold; font-size: 1rem; color: var(--text-main);">Bs. ${formatCurrency(priceBsNum)}</p>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;

        container.innerHTML = html;

        const addBtn = container.querySelector('#addProductBtn');
        if (addBtn) addBtn.addEventListener('click', () => renderForm());
        
        container.querySelectorAll('.delete-product-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const prod = products.find(p => p.id === id);
                if (!prod) return;

                if (confirm(`¿Eliminar permanentemente "${prod.name}"?`)) {
                    try {
                        const businessId = localStorage.getItem('businessId');
                        await deleteDoc(doc(db, "businesses", businessId, "products", id));
                        showNotification("Producto eliminado", "success");
                        loadData();
                    } catch (error) {
                        console.error("Error al eliminar:", error);
                        showNotification("Error al eliminar", "error");
                    }
                }
            });
        });

        container.querySelectorAll('.product-card').forEach(card => {
            if (role !== 'employee') {
                card.addEventListener('click', () => {
                    const prod = products.find(p => p.id === card.dataset.id);
                    if (prod) renderDetail(prod);
                });
            }
            card.addEventListener('mouseover', () => card.style.transform = 'translateY(-4px)');
            card.addEventListener('mouseout', () => card.style.transform = 'translateY(0)');
        });
    }

    function renderForm(editProduct = null) {
        let recipeIngredients = editProduct?.recipeIngredients || [];
        const isFromPurchase = !!window.tempPurchaseState;
        const purchaseSupplierId = window.tempPurchaseState?.supplierId || '';

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; flex-direction: column; text-align: center;">
                <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px;">✨ ${editProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                <p class="text-muted text-sm">Configura los detalles técnicos, costos y precios de venta</p>
            </div>
            
            <form id="productForm">
                <div style="max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem;">
                    
                    <!-- Sección: Identidad y Configuración -->
                    <div class="card" style="border-top: 4px solid var(--primary); padding: 2rem;">
                        <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">📦 Identidad del Producto</h3>
                        
                        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                            <div class="form-group">
                            <label>🔍 CÓDIGO DE BARRAS <small class="text-muted">(SCANNER)</small></label>
                            <div style="display: flex; gap: 0.35rem;">
                                <input type="text" id="prodBarcode" class="form-control" placeholder="Escanea o escribe el código" value="${editProduct?.barcode || ''}" style="font-family: monospace; font-weight: bold; letter-spacing: 1px;">
                                <button type="button" class="btn btn-outline" style="width: auto; padding: 0 1rem; background: var(--background); height: 40px;" title="Escaneo Activo">
                                    <span style="font-size: 1.2rem;">📡</span>
                                </button>
                            </div>
                        </div>

                            <div class="form-group">
                                <label>🛍️ NOMBRE DEL PRODUCTO</label>
                                <input type="text" id="prodName" class="form-control" placeholder="Ej. Harina P.A.N 1kg" required value="${editProduct?.name || ''}">
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label>🏷️ CATEGORÍA</label>
                                    <select id="prodCategory" class="form-control" required ${editProduct ? 'disabled' : ''}>
                                        <option value="">Seleccione...</option>
                                        <option value="NEW" style="font-weight: bold; color: var(--primary);">+ CREAR CATEGORIA</option>
                                        <option value="INSUMO" ${editProduct?.category === 'INSUMO' ? 'selected' : ''}>INSUMO</option>
                                        <option value="RECETA" ${editProduct?.category === 'RECETA' ? 'selected' : ''}>RECETA</option>
                                        <option value="SERVICIOS" ${editProduct?.category === 'SERVICIOS' ? 'selected' : ''}>SERVICIOS</option>
                                        ${[...new Set(products.map(p => p.category).filter(c => c && !['INSUMO', 'RECETA', 'SERVICIOS'].includes(c)))].sort().map(cat => `
                                            <option value="${cat}" ${editProduct?.category === cat ? 'selected' : ''}>${cat}</option>
                                        `).join('')}
                                    </select>
                                </div>

                                <div class="form-group" id="subCategoryGroup" style="display: none;">
                                    <label>📂 SUB-CATEGORÍA</label>
                                    <select id="prodSubCategory" class="form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="NEW_SUB" style="font-weight: bold; color: var(--primary);">+ CREAR SUB-CATEGORIA</option>
                                        ${[...new Set(products.filter(p => p.category === 'RECETA').map(p => p.subCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map(sub => `<option value="${sub}" ${editProduct?.subCategory === sub ? 'selected' : ''}>${sub}</option>`).join('')}
                                    </select>
                                </div>

                                <div class="form-group" id="saleableGroup" style="display: none;">
                                    <label>🛒 ¿DISPONIBLE PARA VENTA?</label>
                                    <div style="display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; height: 40px;">
                                        <div id="btnSaleableYes" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; background: var(--background); color: var(--text-main); font-weight: 800; font-size: 0.8rem;">SÍ</div>
                                        <div id="btnSaleableNo" style="flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; background: var(--primary); color: white; font-weight: 800; font-size: 0.8rem;">NO</div>
                                    </div>
                                    <input type="hidden" id="prodIsSaleable" value="${editProduct?.isSaleable ? 'true' : 'false'}">
                                </div>

                                <div class="form-group" id="supplierGroup" style="display: none;">
                                    <label>🏭 PROVEEDOR</label>
                                    <select id="prodSupplier" class="form-control">
                                        <option value="">Seleccione...</option>
                                        ${[...suppliers].sort((a, b) => a.name.localeCompare(b.name)).map(s => `<option value="${s.id}" ${(editProduct?.supplierId === s.id || (isFromPurchase && purchaseSupplierId === s.id)) ? 'selected' : ''}>${s.name}</option>`).join('')}
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>🖼️ IMAGEN DEL PRODUCTO</label>
                                <div style="display: flex; align-items: center; gap: 1.5rem; background: var(--background); padding: 1rem; border-radius: 12px; border: 1px dashed var(--border);">
                                    <div id="imagePreview" style="width: 70px; height: 70px; border-radius: 12px; background: var(--surface); display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: var(--shadow-sm); border: 2px solid var(--border);">
                                        ${editProduct?.image ? `<img src="${editProduct.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="font-size: 2rem; opacity: 0.5;">📷</span>'}
                                    </div>
                                    <div style="flex: 1;">
                                        <input type="file" id="prodImage" accept="image/*" class="form-control" style="font-size: 0.8rem; height: auto; padding: 0.5rem; border: none; background: transparent;">
                                        <p class="text-xs text-muted mt-2">Formatos: JPG, PNG. Máx 1MB.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sistema de Unidades -->
                    <div id="unitSection" class="card" style="display: none; border: none; border-left: 5px solid #8b5cf6; padding: 2rem; background: var(--surface); position: relative;">
                        <div style="margin-bottom: 2rem; text-align: left;">
                            <h3 style="font-size: 1.25rem; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #8b5cf6; margin: 0; line-height: 1.2;">
                                UNIDADES Y CONVERSIÓN
                            </h3>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr; gap: 0.35rem;">
                            <div class="form-group">
                                <label>📦 UNIDAD DE COMPRA</label>
                                <select id="prodPurchaseUnit" class="form-control">
                                    <option value="" disabled ${!editProduct?.purchaseUnit ? 'selected' : ''}>Seleccionar unidad...</option>
                                    <option value="Saco" ${editProduct?.purchaseUnit==='Saco'?'selected':''}>Saco</option>
                                    <option value="Caja" ${editProduct?.purchaseUnit==='Caja'?'selected':''}>Caja</option>
                                    <option value="Bulto" ${editProduct?.purchaseUnit==='Bulto'?'selected':''}>Bulto</option>
                                    <option value="Paquete" ${editProduct?.purchaseUnit==='Paquete'?'selected':''}>Paquete</option>
                                    <option value="Unidad" ${editProduct?.purchaseUnit==='Unidad'?'selected':''}>Unidad</option>
                                    <option value="Kilo" ${editProduct?.purchaseUnit==='Kilo'?'selected':''}>Kilo</option>
                                    <option value="Litro" ${editProduct?.purchaseUnit==='Litro'?'selected':''}>Litro</option>
                                    <option value="Gramo" ${editProduct?.purchaseUnit==='Gramo'?'selected':''}>Gramo</option>
                                    <option value="Mililitro" ${editProduct?.purchaseUnit==='Mililitro'?'selected':''}>Mililitro</option>
                                </select>
                            </div>

                            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 0.75rem; align-items: end;">
                                <div class="form-group" style="flex: 1;">
                                    <label id="lblPurchaseToStock">CONTENIDO NETO</label>
                                    <input type="text" inputmode="numeric" id="prodPurchaseToStockQty" class="form-control" required value="${editProduct?.purchaseToStockQty ? editProduct.purchaseToStockQty.toLocaleString('de-DE') : '1'}">
                                </div>

                                <div class="form-group">
                                    <label>🔄 UNIDAD</label>
                                    <select id="prodStockUnit" class="form-control">
                                        <option value="Unidad" ${(editProduct?.stockUnit||'Unidad')==='Unidad'?'selected':''}>Unidad</option>
                                        <option value="Kilo" ${editProduct?.stockUnit==='Kilo'?'selected':''}>Kilo</option>
                                        <option value="Litro" ${editProduct?.stockUnit==='Litro'?'selected':''}>Litro</option>
                                        <option value="Gramo" ${editProduct?.stockUnit==='Gramo'?'selected':''}>Gramo</option>
                                        <option value="Mililitro" ${editProduct?.stockUnit==='Mililitro'?'selected':''}>Mililitro</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Nivel 3: Contenido de la Unidad (Ej. 750g) -->
                            <div id="unitContentRow" style="display: none; grid-template-columns: 1.5fr 1fr; gap: 0.75rem; align-items: end;">
                                <div class="form-group" style="flex: 1;">
                                    <label>CONTENIDO POR UNIDAD</label>
                                    <input type="text" inputmode="numeric" id="prodUnitContentQty" class="form-control" value="${editProduct?.unitContentQty ? editProduct.unitContentQty.toLocaleString('de-DE') : '1'}">
                                </div>

                                <div class="form-group">
                                    <label>📏 UNIDAD MEDIDA</label>
                                    <select id="prodUnitContentUnit" class="form-control">
                                        <option value="Gramo" ${editProduct?.unitContentUnit==='Gramo'?'selected':''}>Gramo</option>
                                        <option value="Mililitro" ${editProduct?.unitContentUnit==='Mililitro'?'selected':''}>Mililitro</option>
                                        <option value="Unidad" ${editProduct?.unitContentUnit==='Unidad'?'selected':''}>Unidad</option>
                                        <option value="Kilo" ${editProduct?.unitContentUnit==='Kilo'?'selected':''}>Kilo</option>
                                        <option value="Litro" ${editProduct?.unitContentUnit==='Litro'?'selected':''}>Litro</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Tarjeta de Resumen Centrada (100px altura aprox) -->
                            <div id="unitSummaryCard" style="background: rgba(139, 92, 246, 0.05); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.2); padding: 0.75rem; display: flex; align-items: center; justify-content: space-around; height: 100px; box-sizing: border-box;">
                                <div style="text-align: center;">
                                    <p style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">UNIDAD DE RECETA</p>
                                    <p id="recipeUnitDisplay" style="font-size: 1.25rem; font-weight: 900; color: #8b5cf6; margin: 0;">—</p>
                                </div>
                                <div style="width: 1px; background: rgba(139, 92, 246, 0.1); height: 50px;"></div>
                                <div style="text-align: center;">
                                    <p style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">FACTOR DE PRECISIÓN</p>
                                    <p id="stockToRecipeFactorDisplay" style="font-size: 0.9rem; font-weight: 800; color: var(--text-main); margin: 0;">—</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sección de Recetas (Si aplica) -->
                    <div id="recipeYieldGroup" class="card" style="display: none; border-left: 4px solid #ec4899; padding: 2rem;">
                        <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #ec4899; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">👩‍🍳 Configuración de Receta</h3>
                        <div class="form-group">
                            <label>🍽️ RENDIMIENTO (PORCIONES/UNIDADES)</label>
                            <input type="number" step="0.01" id="prodYield" class="form-control" placeholder="¿Cuánto produce esta receta?" value="${editProduct?.yield || ''}">
                            <button type="button" class="btn btn-primary mt-4" id="buildRecipeBtn" style="width: 100%; background: #ec4899; border-color: #ec4899; height: 50px; font-weight: 800;">
                                ➕ CONSTRUIR RECETA / INGREDIENTES
                            </button>
                        </div>
                    </div>

                    <!-- Sección: Costos y Precios (Ahora debajo) -->
                    <div class="card" style="border-top: 4px solid var(--success); padding: 2rem;">
                        <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--success); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">💰 Estructura de Costos y Precios</h3>

                        <div id="costPriceInputsWrapper" style="${isFromPurchase ? 'display: none;' : 'display: flex; flex-direction: column; gap: 0.35rem;'}">
                            <div class="form-group">
                                <label id="costLabel">💵 COSTO DE ADQUISICIÓN</label>
                                <input type="text" inputmode="numeric" id="prodCost" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.cost ? editProduct.cost.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-size: 1.1rem; font-weight: 800; color: var(--success);">
                            </div>

                            <div class="form-group" id="costPerUnitGroup" style="display: none; background: rgba(34, 197, 94, 0.05); padding: 1rem; border-radius: 12px; border: 1px dashed var(--success);">
                                <label class="text-success" style="font-size: 0.65rem;">📉 COSTO POR UNIDAD MÍNIMA</label>
                                <input type="text" id="prodCostPerUnit" class="form-control" readonly style="background: transparent; border: none; font-size: 1.1rem; font-weight: 800; padding: 0; height: auto;" value="${editProduct?.costPerUnit ? editProduct.costPerUnit.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}">
                            </div>

                            <div class="form-group">
                                <label id="lblPriceDetal">🛒 PRECIO DETAL (+30%)</label>
                                <input type="text" inputmode="numeric" id="prodPriceDetal" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceDetal ? editProduct.priceDetal.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 800; border-left: 4px solid var(--primary);">
                            </div>

                            <div class="form-group">
                                <label id="lblPriceMayor">🏢 PRECIO AL MAYOR (+25%)</label>
                                <input type="text" inputmode="numeric" id="prodPriceMayor" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceMayor ? editProduct.priceMayor.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 700;">
                            </div>

                            <div class="form-group">
                                <label id="lblPriceSpecial">⭐ PRECIO ESPECIAL (+20%)</label>
                                <input type="text" inputmode="numeric" id="prodPriceSpecial" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceSpecial ? editProduct.priceSpecial.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 700;">
                            </div>
                        </div>

                        ${isFromPurchase ? `
                        <div style="background: rgba(34, 197, 94, 0.05); padding: 1.5rem; border-radius: 12px; border: 1px dashed var(--success); text-align: center; margin-bottom: 1.5rem;">
                            <span style="font-size: 2rem;">🔗</span>
                            <p style="margin: 0.75rem 0 0.25rem; font-weight: bold; color: var(--success);">Modo Enlazado a Compra</p>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Los costos y precios se calcularán automáticamente al procesar la compra.</p>
                        </div>
                        ` : ''}

                        <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                            <button type="button" class="btn btn-outline" id="backBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                            <button type="submit" class="btn btn-primary" id="saveBtn" style="flex: 1; height: 50px; font-weight: 900;">
                                ${editProduct ? 'GUARDAR CAMBIOS' : 'CREAR PRODUCTO'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            <!-- Modal para Nueva Categoría -->
            <div id="categoryModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px); z-index: 2000; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="width: 100%; max-width: 400px; border-top: 5px solid var(--primary); padding: 2rem; box-shadow: var(--shadow-2xl);">
                    <div style="text-align: center; margin-bottom: 1.5rem;">
                        <span style="font-size: 3rem;">📁</span>
                        <h2 style="font-weight: 900; margin-top: 1rem;">Nueva Categoría</h2>
                        <p class="text-muted text-xs">Define un nuevo grupo para tus productos</p>
                    </div>
                    <div class="form-group mb-4">
                        <label>NOMBRE DEL GRUPO</label>
                        <input type="text" id="newCategoryInput" class="form-control" placeholder="Ej. BEBIDAS FRÍAS" style="text-transform: uppercase; font-weight: 800; text-align: center;">
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="button" class="btn btn-outline" id="cancelCatBtn" style="flex: 1;">CANCELAR</button>
                        <button type="button" class="btn btn-primary" id="confirmCatBtn" style="flex: 1;">CREAR</button>
                    </div>
                </div>
            </div>

            <!-- Modal/Pantalla Completa Constructor de Recetas -->
            <div id="recipeBuilderModal" style="display: none; position: fixed; inset: 0; background: var(--background); z-index: 2000; flex-direction: column;">
                <div style="height: auto; min-height: 64px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem;" class="flex-stack-mobile">
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 900;">👩‍🍳 Constructor de Receta</h2>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <button type="button" class="btn btn-outline" id="cancelRecipeBtn" style="width: auto;">CANCELAR</button>
                        <button type="button" class="btn btn-primary" id="finishRecipeBtn" style="width: auto; background: #ec4899; border-color: #ec4899;">FINALIZAR RECETA</button>
                    </div>
                </div>
                <div style="flex: 1; display: flex; overflow: hidden;" class="flex-stack-mobile">
                    <!-- Lado Izquierdo: Catálogo de Productos -->
                    <div style="flex: 1; display: flex; flex-direction: column; background: var(--background); border-right: 1px solid var(--border); overflow: hidden;">
                        <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: var(--surface);">
                            <input type="search" id="catalogSearch" class="form-control" placeholder="🔍 Buscar insumos para agregar...">
                        </div>
                        <div id="catalogGrid" style="flex: 1; padding: 1rem; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; align-content: start;">
                            <!-- Catalog cards -->
                        </div>
                    </div>

                    <!-- Lado Derecho: DECK (Ingredientes) -->
                    <div style="flex: 1; display: flex; flex-direction: column; background: var(--surface);">
                        <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--text-muted);">📋 INGREDIENTES SELECCIONADOS</h3>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding: 1rem;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); text-transform: uppercase; font-size: 0.65rem; letter-spacing: 1px;">
                                        <th style="padding: 0.75rem;">Insumo</th>
                                        <th style="padding: 0.75rem;">Cant.</th>
                                        <th style="padding: 0.75rem;">Costo Ud.</th>
                                        <th style="padding: 0.75rem;">SubTotal</th>
                                        <th style="padding: 0.75rem;"></th>
                                    </tr>
                                </thead>
                                <tbody id="recipeTableBody">
                                    <!-- Dynamic rows -->
                                </tbody>
                            </table>
                        </div>
                        <div style="padding: 1.5rem; border-top: 1px solid var(--border); background: var(--background);">
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; text-align: center;">
                                <div class="card" style="padding: 1rem;">
                                    <p style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.25rem;">Rendimiento</p>
                                    <p style="font-size: 1.25rem; font-weight: 900;" id="rbYieldDisplay">0</p>
                                </div>
                                <div class="card" style="padding: 1rem;">
                                    <p style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.25rem;">Costo Total</p>
                                    <p style="font-size: 1.25rem; font-weight: 900; color: var(--danger);" id="rbTotalCostDisplay">$ 0.0000</p>
                                </div>
                                <div class="card" style="padding: 1rem;">
                                    <p style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.25rem;">Costo Unit.</p>
                                    <p style="font-size: 1.25rem; font-weight: 900; color: var(--primary);" id="rbUnitCostDisplay">$ 0.0000</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal para Cantidad de Insumo en Receta -->
            <div id="recipeQtyModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(10px); z-index: 5000; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="width: 100%; max-width: 400px; border-top: 5px solid var(--primary); padding: 2rem; box-shadow: var(--shadow-2xl);">
                    <div style="text-align: center; margin-bottom: 1.5rem;">
                        <h2 id="rqmTitle" style="color: var(--primary); margin-bottom: 0.5rem; font-size: 1.5rem; font-weight: 900;">Añadir Insumo</h2>
                        <p id="rqmSubtitle" class="text-muted" style="font-size: 0.8rem;">Indica la cantidad exacta para la receta</p>
                    </div>
                    
                    <div class="form-group mb-4">
                        <label id="rqmLabel" style="text-align: center;">CANTIDAD A USAR (<span id="rqmUnit">ud</span>)</label>
                        <input type="number" step="0.0001" id="rqmQtyInput" class="form-control" placeholder="0.000" style="font-size: 1.75rem; font-weight: 900; text-align: center; height: 70px; border-color: var(--primary);">
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button type="button" class="btn btn-outline" id="rqmCancelBtn" style="flex: 1;">CANCELAR</button>
                        <button type="button" class="btn btn-primary" id="rqmConfirmBtn" style="flex: 1;">AGREGAR</button>
                    </div>
                </div>
            </div>

            <!-- Modal Sub-Categoría -->
            <div id="subCategoryModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(4px); z-index:2000; align-items:center; justify-content:center; padding:1rem;">
                <div class="card" style="width:100%; max-width:400px; padding:2rem; border-top:4px solid var(--primary);">
                    <h3 style="margin-bottom:1rem;">Nueva Sub-Categoría</h3>
                    <div class="form-group mb-4">
                        <label>NOMBRE DE LA SUB-CATEGORÍA</label>
                        <input type="text" id="newSubCategoryInput" class="form-control" placeholder="Ej. TORTAS">
                    </div>
                    <div style="display:flex; gap:1rem; justify-content:flex-end;">
                        <button class="btn btn-outline" id="cancelSubCatBtn">Cancelar</button>
                        <button class="btn btn-primary" id="confirmSubCatBtn">Crear</button>
                    </div>
                </div>
            </div>

            <style>
                .form-group label { margin-bottom: 2px; color: var(--text-muted); font-weight: 700; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; }
                .form-control { 
                    border-radius: 10px; 
                    border: 1px solid var(--border); 
                    padding: 0 1rem; 
                    transition: var(--transition); 
                    background: var(--surface); 
                    color: var(--text-main); 
                    font-size: 0.9rem; 
                    font-family: 'Inter', sans-serif;
                    width: 100%;
                    height: 40px;
                    box-sizing: border-box;
                }
                .form-control:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1); outline: none; }
                .card { background: var(--surface); border-radius: 16px; box-shadow: var(--shadow-md); transition: var(--transition); }
                .btn { border-radius: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid transparent; cursor: pointer; }
                .btn:hover { transform: translateY(-2px); }
                .btn-primary { background: var(--primary); color: white; }
                .btn-outline { background: transparent; border-color: var(--border); color: var(--text-main); }
            </style>
        `;

        // DOM Elements
        const form = container.querySelector('#productForm');
        const catSelect = container.querySelector('#prodCategory');
        const supplierGroup = container.querySelector('#supplierGroup');
        const subCategoryGroup = container.querySelector('#subCategoryGroup');
        const prodSubCategory = container.querySelector('#prodSubCategory');
        const prodSupplier = container.querySelector('#prodSupplier');
        const saleableGroup = container.querySelector('#saleableGroup');
        const prodIsSaleable = container.querySelector('#prodIsSaleable');
        const btnSaleableYes = container.querySelector('#btnSaleableYes');
        const btnSaleableNo = container.querySelector('#btnSaleableNo');
        const unitSection = container.querySelector('#unitSection');
        const prodPurchaseUnit = container.querySelector('#prodPurchaseUnit');
        const prodPurchaseToStockQty = container.querySelector('#prodPurchaseToStockQty');
        const prodStockUnit = container.querySelector('#prodStockUnit');
        const unitContentRow = container.querySelector('#unitContentRow');
        const prodUnitContentQty = container.querySelector('#prodUnitContentQty');
        const prodUnitContentUnit = container.querySelector('#prodUnitContentUnit');

        const recipeUnitDisplay = container.querySelector('#recipeUnitDisplay');
        const stockToRecipeFactorDisplay = container.querySelector('#stockToRecipeFactorDisplay');
        const unitSummaryCard = container.querySelector('#unitSummaryCard');

        const recipeYieldGroup = container.querySelector('#recipeYieldGroup');
        const prodYield = container.querySelector('#prodYield');
        const prodCost = container.querySelector('#prodCost');
        const costLabel = container.querySelector('#costLabel');
        const costPerUnitGroup = container.querySelector('#costPerUnitGroup');
        const prodCostPerUnit = container.querySelector('#prodCostPerUnit');
        const prodPriceDetal = container.querySelector('#prodPriceDetal');
        const prodPriceMayor = container.querySelector('#prodPriceMayor');
        const prodPriceSpecial = container.querySelector('#prodPriceSpecial');
        const lblPriceDetal = container.querySelector('#lblPriceDetal');
        const lblPriceMayor = container.querySelector('#lblPriceMayor');
        const lblPriceSpecial = container.querySelector('#lblPriceSpecial');
        const prodImage = container.querySelector('#prodImage');
        const imagePreview = container.querySelector('#imagePreview');
        let imageBase64 = editProduct?.image || null;

        container.querySelector('#backBtn').addEventListener('click', () => {
            if (window.tempPurchaseState) {
                document.getElementById('navCompras').click();
            } else {
                renderList();
            }
        });

        // --- Lógica de UI Dinámica por Categoría ---
        function updateFormUI() {
            const cat = catSelect.value;
            recipeYieldGroup.style.display = 'none';
            unitSection.style.display = 'none';
            supplierGroup.style.display = 'none';
            subCategoryGroup.style.display = 'none';
            costPerUnitGroup.style.display = 'none';
            unitSummaryCard.style.display = 'flex';
            saleableGroup.style.display = 'none';

            // Defaults
            prodSupplier.required = false;
            prodYield.required = false;
            prodCost.readOnly = false;
            prodPriceDetal.readOnly = false;
            prodPriceMayor.readOnly = false;
            prodPriceSpecial.readOnly = false;

            costLabel.innerHTML = 'Costo $ por <span id="costUnitLabel">Ud</span> <span class="text-danger">*</span>';
            lblPriceDetal.innerHTML = 'Precio Detal $ (+30%) <span class="text-danger">*</span>';
            lblPriceMayor.innerHTML = 'Precio Mayor $ (+25%) <span class="text-danger">*</span>';
            lblPriceSpecial.innerHTML = 'Precio Especial $ (+20%) <span class="text-danger">*</span>';

            if (cat === 'RECETA') {
                recipeYieldGroup.style.display = 'block';
                prodYield.required = true;
                costPerUnitGroup.style.display = 'block';
                prodCost.readOnly = true;
                costLabel.innerHTML = 'Costo $ Receta <span class="text-danger">*</span>';
                lblPriceDetal.innerHTML = 'Precio Detal $ (+160%) <span class="text-danger">*</span>';
                lblPriceMayor.innerHTML = 'Precio Mayor $ (+150%) <span class="text-danger">*</span>';
                lblPriceSpecial.innerHTML = 'Precio Especial $ (+140%) <span class="text-danger">*</span>';
                prodIsSaleable.value = 'true';
                subCategoryGroup.style.display = 'block';

            } else if (cat === 'SERVICIOS') {
                lblPriceDetal.innerHTML = 'Precio Detal $ <span class="text-muted" style="font-size:0.8rem;">(= Costo $)</span>';
                lblPriceMayor.innerHTML = 'Precio Mayor $ <span class="text-muted" style="font-size:0.8rem;">(= Costo $)</span>';
                lblPriceSpecial.innerHTML = 'Precio Especial $ <span class="text-muted" style="font-size:0.8rem;">(= Costo $)</span>';
                prodPriceDetal.readOnly = true;
                prodPriceMayor.readOnly = true;
                prodPriceSpecial.readOnly = true;
                prodIsSaleable.value = 'true';
                unitSummaryCard.style.display = 'none';

            } else if (cat === 'NEW') {
                const modal = container.querySelector('#categoryModal');
                modal.style.display = 'flex';
                container.querySelector('#newCategoryInput').focus();
                catSelect.value = '';

            } else if (cat === 'INSUMO') {
                supplierGroup.style.display = 'block';
                prodSupplier.required = true;
                unitSection.style.display = 'block';
                costPerUnitGroup.style.display = 'block';
                saleableGroup.style.display = 'block';
            } else if (cat !== '') {
                // Categorías personalizadas
                supplierGroup.style.display = 'block';
                prodSupplier.required = true;
                unitSection.style.display = 'block';
                costPerUnitGroup.style.display = 'none';
                unitSummaryCard.style.display = 'none';
                saleableGroup.style.display = 'none';
                prodIsSaleable.value = 'true'; // Por defecto a la venta
            }

            // Sync Saleable UI
            if (prodIsSaleable.value === 'true') {
                btnSaleableYes.style.background = 'var(--primary)';
                btnSaleableYes.style.color = 'white';
                btnSaleableNo.style.background = 'var(--background)';
                btnSaleableNo.style.color = 'var(--text-main)';
            } else {
                btnSaleableNo.style.background = 'var(--primary)';
                btnSaleableNo.style.color = 'white';
                btnSaleableYes.style.background = 'var(--background)';
                btnSaleableYes.style.color = 'var(--text-main)';
            }

            // Toggle Nivel 3 (Contenido por Unidad)
            const basicUnits = ['Unidad', 'Kilo', 'Litro', 'Gramo', 'Mililitro'];
            const isBasicPurchase = basicUnits.includes(prodPurchaseUnit.value);
            
            if (unitSection.style.display !== 'none' && prodStockUnit.value === 'Unidad' && !isBasicPurchase) {
                unitContentRow.style.display = 'grid';
            } else {
                unitContentRow.style.display = 'none';
            }

            calculateMath();
        }
        
        catSelect.addEventListener('change', updateFormUI);
        
        prodSubCategory.addEventListener('change', (e) => {
            if (e.target.value === 'NEW_SUB') {
                const modal = container.querySelector('#subCategoryModal');
                modal.style.display = 'flex';
                container.querySelector('#newSubCategoryInput').focus();
                e.target.value = '';
            }
        });

        // Lógica del Modal de Categoría
        const categoryModal = container.querySelector('#categoryModal');
        const newCategoryInput = container.querySelector('#newCategoryInput');
        
        container.querySelector('#confirmCatBtn').addEventListener('click', () => {
            const newCat = newCategoryInput.value.trim().toUpperCase();
            if (!newCat) return;
            
            // Añadir al select si no existe
            let exists = false;
            Array.from(catSelect.options).forEach(opt => {
                if (opt.value === newCat) exists = true;
            });
            
            if (!exists) {
                const newOpt = document.createElement('option');
                newOpt.value = newCat;
                newOpt.textContent = newCat;
                newOpt.selected = true;
                catSelect.add(newOpt, catSelect.options[catSelect.options.length - 1]);
            } else {
                catSelect.value = newCat;
            }
            
            categoryModal.style.display = 'none';
            newCategoryInput.value = "";
            updateFormUI();
        });
        
        container.querySelector('#cancelCatBtn').addEventListener('click', () => {
            categoryModal.style.display = 'none';
            newCategoryInput.value = "";
            catSelect.value = "";
            updateFormUI();
        });

        // Lógica del Modal de Sub-Categoría
        const subCategoryModal = container.querySelector('#subCategoryModal');
        const newSubCategoryInput = container.querySelector('#newSubCategoryInput');

        container.querySelector('#confirmSubCatBtn').addEventListener('click', () => {
            const newSub = newSubCategoryInput.value.trim().toUpperCase();
            if (!newSub) return;

            let exists = false;
            Array.from(prodSubCategory.options).forEach(opt => {
                if (opt.value === newSub) exists = true;
            });

            if (!exists) {
                const newOpt = document.createElement('option');
                newOpt.value = newSub;
                newOpt.textContent = newSub;
                newOpt.selected = true;
                prodSubCategory.add(newOpt, prodSubCategory.options[prodSubCategory.options.length - 1]);
            } else {
                prodSubCategory.value = newSub;
            }

            subCategoryModal.style.display = 'none';
            newSubCategoryInput.value = "";
        });

        container.querySelector('#cancelSubCatBtn').addEventListener('click', () => {
            subCategoryModal.style.display = 'none';
            newSubCategoryInput.value = "";
            prodSubCategory.value = "";
        });

        if (editProduct) updateFormUI(); // Init if editing

        // --- Helper: Máscara Numérica (Calculadora POS) ---
        function applyNumericMask(input) {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, ''); 
                if (!value) { e.target.value = ''; return; }
                let number = parseInt(value, 10);
                e.target.value = (number / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                calculateMath(); // Trigger math update
            });
            // Focus events to help the user
            input.addEventListener('focus', (e) => { if (e.target.value === '0,00') e.target.value = ''; });
            input.addEventListener('blur', (e) => { if (!e.target.value) e.target.value = '0,00'; });
        }

        function applyIntegerMask(input) {
            input.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, ''); 
                if (!value) { e.target.value = ''; return; }
                let number = parseInt(value, 10);
                e.target.value = number.toLocaleString('de-DE'); 
                calculateMath();
            });
            input.addEventListener('focus', (e) => { if (e.target.value === '0' || e.target.value === '1') e.target.value = ''; });
            input.addEventListener('blur', (e) => { if (!e.target.value) e.target.value = '1'; });
        }

        function parseNum(val) {
            if (!val) return 0;
            return parseFloat(val.toString().replace(/\./g, '').replace(',', '.')) || 0;
        }

        [prodCost, prodPriceDetal, prodPriceMayor, prodPriceSpecial, prodYield].forEach(applyNumericMask);
        [prodPurchaseToStockQty, prodUnitContentQty].forEach(applyIntegerMask);

        // --- Lógica de Matemáticas y Conversión (Sistema 3 Niveles) ---
        function getRecipeUnitInfo(stockUnit) {
            if (stockUnit === 'Kilo')      return { recipeUnit: 'Gramo',      factor: 1000 };
            if (stockUnit === 'Litro')     return { recipeUnit: 'Mililitro',  factor: 1000 };
            if (stockUnit === 'Gramo')     return { recipeUnit: 'Gramo',      factor: 1    };
            if (stockUnit === 'Mililitro') return { recipeUnit: 'Mililitro',  factor: 1    };
            return                             { recipeUnit: 'Unidad',     factor: 1    };
        }

        function calculateMath() {
            const cat = catSelect.value;
            const cost = parseNum(prodCost.value);

            // --- Actualizar visibilidad de Nivel 3 ---
            const basicUnits = ['Unidad', 'Kilo', 'Litro', 'Gramo', 'Mililitro'];
            const isBasicPurchase = basicUnits.includes(prodPurchaseUnit.value);

            if (unitSection.style.display !== 'none' && prodStockUnit.value === 'Unidad' && !isBasicPurchase) {
                unitContentRow.style.display = 'grid';
            } else {
                unitContentRow.style.display = 'none';
            }

            // --- Actualizar etiqueta de costo con unidad de stock ---
            if (cat !== 'RECETA' && cat !== 'SERVICIOS') {
                const su = prodStockUnit ? prodStockUnit.value : 'Ud';
                costLabel.innerHTML = `Costo $ por ${su} <span class="text-danger">*</span>`;
            }

            // --- Derivar unidad de receta y factor de conversión ---
            if (prodStockUnit && unitSection.style.display !== 'none') {
                let recipeUnit, factor;
                
                if (prodStockUnit.value === 'Unidad' && !isBasicPurchase) {
                    // Si es Unidad y NO es compra básica, miramos el Nivel 3
                    const info = getRecipeUnitInfo(prodUnitContentUnit.value);
                    recipeUnit = info.recipeUnit;
                    factor = (parseNum(prodUnitContentQty.value) || 1) * info.factor;
                } else {
                    // Si es Kilo/Litro/Gramo/ML O es compra básica de Unidad, derivamos automáticamente
                    const info = getRecipeUnitInfo(prodStockUnit.value);
                    recipeUnit = info.recipeUnit;
                    factor = info.factor;
                }

                if (recipeUnitDisplay) recipeUnitDisplay.textContent = recipeUnit;
                
                const purchaseQty = parseFloat(prodPurchaseToStockQty.value) || 1;
                const totalFactor = purchaseQty * factor;

                if (stockToRecipeFactorDisplay) {
                    stockToRecipeFactorDisplay.textContent =
                        `1 ${prodPurchaseUnit.value} = ${totalFactor.toLocaleString()} ${recipeUnit}${totalFactor > 1 ? 's' : ''}`;
                }
                // Costo por unidad de receta
                const costPerRecipeUnit = factor > 0 ? cost / factor : 0;
                prodCostPerUnit.value = costPerRecipeUnit.toFixed(6);
                window.lastCpru = costPerRecipeUnit;
                window.lastRecipeUnit = recipeUnit;
                window.lastStockToRecipeFactor = factor;
            }

            // --- SERVICIOS: precios = costo exacto ---
            if (cat === 'SERVICIOS') {
                prodPriceDetal.value = cost.toFixed(2);
                prodPriceMayor.value = cost.toFixed(2);
                prodPriceSpecial.value = cost.toFixed(2);
                return;
            }

            // --- Calcular precios con márgenes ---
            if (document.activeElement === prodCost || !prodPriceDetal.value || cat === 'RECETA') {
                let mDetal = 1.30, mMayor = 1.25, mSpecial = 1.20;
                if (cat === 'RECETA') { mDetal = 2.60; mMayor = 2.50; mSpecial = 2.40; }
                const roundTo05 = (n) => Math.round(n * 20) / 20;
                prodPriceDetal.value  = roundTo05(cost * mDetal).toFixed(2);
                prodPriceMayor.value  = roundTo05(cost * mMayor).toFixed(2);
                prodPriceSpecial.value = roundTo05(cost * mSpecial).toFixed(2);
            }
        }

        prodPurchaseUnit.addEventListener('change', calculateMath);
        prodPurchaseToStockQty.addEventListener('input', calculateMath);
        prodStockUnit.addEventListener('change', calculateMath);
        prodUnitContentQty.addEventListener('input', calculateMath);
        prodUnitContentUnit.addEventListener('change', calculateMath);
        prodCost.addEventListener('input', calculateMath);

        btnSaleableYes.addEventListener('click', () => {
            prodIsSaleable.value = 'true';
            updateFormUI();
        });
        btnSaleableNo.addEventListener('click', () => {
            prodIsSaleable.value = 'false';
            updateFormUI();
        });

        // --- Image Upload (Base64) ---
        prodImage.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    imageBase64 = event.target.result;
                    imagePreview.innerHTML = `<img src="${imageBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
                };
                reader.readAsDataURL(file);
            }
        });

        // --- RECIPE BUILDER LOGIC ---
        const builderModal = container.querySelector('#recipeBuilderModal');
        const rbTableBody = container.querySelector('#recipeTableBody');
        const rbYieldDisplay = container.querySelector('#rbYieldDisplay');
        const rbTotalCostDisplay = container.querySelector('#rbTotalCostDisplay');
        const rbUnitCostDisplay = container.querySelector('#rbUnitCostDisplay');
        const catalogGrid = container.querySelector('#catalogGrid');
        const catalogSearch = container.querySelector('#catalogSearch');

        function openRecipeBuilder() {
            const yieldVal = parseFloat(prodYield.value);
            if (!yieldVal || yieldVal <= 0) {
                showNotification("Por favor indique primero las Unidades por Receta antes de construirla.");
                prodYield.focus();
                return;
            }
            rbYieldDisplay.textContent = yieldVal;
            
            // Populate Catalog (Excluding SERVICIOS)
            const allowedCatalog = products.filter(p => p.category !== 'SERVICIOS');
            renderCatalog(allowedCatalog);
            
            renderDeck();
            builderModal.style.display = 'flex';
        }

        container.querySelector('#buildRecipeBtn')?.addEventListener('click', openRecipeBuilder);

        container.querySelector('#finishRecipeBtn').addEventListener('click', () => {
            builderModal.style.display = 'none';
            // Pushing the calculated cost to the main form
            const totalCost = recipeIngredients.reduce((acc, ing) => acc + ing.subTotal, 0);
            prodCost.value = totalCost.toFixed(4);
            calculateMath();
        });

        container.querySelector('#cancelRecipeBtn').addEventListener('click', () => {
            builderModal.style.display = 'none';
        });

        function renderCatalog(filteredProducts) {
            catalogGrid.innerHTML = '';
            filteredProducts.forEach(p => {
                // RECALCULO FORZADO: Ignoramos valores guardados viejos y calculamos en tiempo real
                // para garantizar que se use la nueva lógica de precisión (Costo / Contenido)
                const cost = parseFloat(p.cost) || 0;
                const content = parseFloat(p.unitContentQty) || 1;
                const unitCost = cost / content;

                const card = document.createElement('div');
                card.className = 'card';
                card.style.cssText = 'padding: 0.75rem; cursor: pointer; transition: transform 0.1s; display: flex; flex-direction: column; align-items: center; text-align: center; border-radius: 12px; min-height: 150px; justify-content: space-between;';
                card.innerHTML = `
                    <div style="width: 80px; height: 80px; background: var(--border); border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-top: 0.25rem;">
                        ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '📦'}
                    </div>
                    <div style="width: 100%; margin-top: 0.5rem;">
                        <p style="font-size: 0.75rem; font-weight: bold; margin: 0; line-height: 1.2; height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--text-main);">${p.name}</p>
                    </div>
                `;
                
                card.addEventListener('mouseover', () => card.style.transform = 'scale(1.02)');
                card.addEventListener('mouseout', () => card.style.transform = 'scale(1)');
                
                card.addEventListener('click', () => {
                    // Pasamos el costo recalculado en tiempo real para evitar errores de base de datos
                    const unitLabel = p.recipeUnitLabel || (p.recipeUnits ? p.recipeUnits.split(' ')[1] : 'ud');
                    openQtyModal(p, unitCost, unitLabel);
                });
                
                catalogGrid.appendChild(card);
            });
        }

        const recipeQtyModal = container.querySelector('#recipeQtyModal');
        const rqmTitle = container.querySelector('#rqmTitle');
        const rqmUnit = container.querySelector('#rqmUnit');
        const rqmQtyInput = container.querySelector('#rqmQtyInput');
        const rqmConfirmBtn = container.querySelector('#rqmConfirmBtn');
        const rqmCancelBtn = container.querySelector('#rqmCancelBtn');

        let currentSelectedProduct = null;
        let currentSelectedCost = 0;
        let currentSelectedUnitLabel = 'ud';

        function openQtyModal(product, unitCost, unitLabel) {
            currentSelectedProduct = product;
            currentSelectedCost = unitCost;
            currentSelectedUnitLabel = unitLabel;
            
            rqmTitle.textContent = product.name;
            rqmUnit.textContent = unitLabel;
            rqmQtyInput.value = '';
            
            recipeQtyModal.style.display = 'flex';
            setTimeout(() => rqmQtyInput.focus(), 50);
        }

        const confirmQty = () => {
            const qty = parseFloat(rqmQtyInput.value);
            if (!isNaN(qty) && qty > 0) {
                addIngredientToRecipe(currentSelectedProduct, qty, currentSelectedCost, currentSelectedUnitLabel);
                recipeQtyModal.style.display = 'none';
            } else {
                showNotification("Por favor ingrese una cantidad válida.");
            }
        };

        rqmConfirmBtn.addEventListener('click', confirmQty);
        rqmCancelBtn.addEventListener('click', () => recipeQtyModal.style.display = 'none');
        rqmQtyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmQty();
        });

        catalogSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = products.filter(p => p.category !== 'SERVICIOS' && p.name.toLowerCase().includes(term));
            renderCatalog(filtered);
        });

        function addIngredientToRecipe(product, qty, unitCost, unitLabel) {
            // Check if already exists, then update qty, else push
            const existing = recipeIngredients.find(i => i.productId === product.id);
            if (existing) {
                existing.qty += qty;
                existing.subTotal = existing.qty * existing.unitCost;
            } else {
                recipeIngredients.push({
                    productId: product.id,
                    name: product.name,
                    unit: unitLabel,
                    qty: qty,
                    unitCost: unitCost,
                    subTotal: qty * unitCost
                });
            }
            renderDeck();
        }

        window.removeIngredient = function(index) {
            recipeIngredients.splice(index, 1);
            renderDeck();
        }

        function renderDeck() {
            rbTableBody.innerHTML = '';
            let totalCost = 0;
            
            recipeIngredients.forEach((ing, index) => {
                // Forzamos el recalculo del subtotal para asegurar precisión matemática
                const rowSubtotal = ing.qty * ing.unitCost;
                totalCost += rowSubtotal;
                
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.innerHTML = `
                    <td style="padding: 0.5rem;">${ing.name}</td>
                    <td style="padding: 0.5rem;">${ing.qty} <span class="text-muted text-sm">${ing.unit}</span></td>
                    <td style="padding: 0.5rem;">$ ${ing.unitCost.toFixed(6)}</td>
                    <td style="padding: 0.5rem; font-weight: bold;">$ ${rowSubtotal.toFixed(4)}</td>
                    <td style="padding: 0.5rem; text-align: right;">
                        <button type="button" class="btn text-danger" style="padding: 0.2rem 0.5rem; width: auto;" onclick="removeIngredient(${index})">❌</button>
                    </td>
                `;
                rbTableBody.appendChild(tr);
            });

            const yieldVal = parseFloat(prodYield.value) || 1;
            rbTotalCostDisplay.textContent = `$ ${totalCost.toFixed(4)}`;
            rbUnitCostDisplay.textContent = `$ ${(totalCost / yieldVal).toFixed(4)}`;
        }


        // --- FORM SUBMIT LOGIC ---
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#saveBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando...';

            const category = catSelect.value;
            const subCategory = prodSubCategory.value || null;
            if (!category) {
                showNotification('Por favor seleccione una categoría');
                btn.disabled = false;
                btn.textContent = editProduct ? 'Guardar Cambios' : 'Crear Producto';
                return;
            }

            if (!imageBase64) {
                showNotification('La imagen del producto es obligatoria');
                btn.disabled = false;
                btn.textContent = editProduct ? 'Guardar Cambios' : 'Crear Producto';
                return;
            }

            const barcode = container.querySelector('#prodBarcode').value.trim() || null;
            const name = toTitleCase(container.querySelector('#prodName').value.trim());
            const isSaleable = prodIsSaleable.value === 'true';
            const supplierId = prodSupplier.value || null;
            const purchaseUnit = prodPurchaseUnit ? prodPurchaseUnit.value.trim() : '';
            const purchaseToStockQty = parseNum(prodPurchaseToStockQty?.value) || 1;
            const stockUnit = prodStockUnit ? prodStockUnit.value : 'Unidad';
            
            const basicUnits = ['Unidad', 'Kilo', 'Litro', 'Gramo', 'Mililitro'];
            const isBasicPurchase = basicUnits.includes(purchaseUnit);

            let recipeUnit, stockToRecipeFactor;
            const unitContentQty = parseNum(prodUnitContentQty?.value) || 1;
            const unitContentUnit = prodUnitContentUnit?.value || 'Unidad';

            if (stockUnit === 'Unidad' && !isBasicPurchase) {
                const info = getRecipeUnitInfo(unitContentUnit);
                recipeUnit = info.recipeUnit;
                stockToRecipeFactor = unitContentQty * info.factor;
            } else {
                const info = getRecipeUnitInfo(stockUnit);
                recipeUnit = info.recipeUnit;
                stockToRecipeFactor = info.factor;
            }

            const pYield = parseNum(prodYield.value) || null;
            const cost = parseNum(prodCost.value) || 0;
            const costPerStockUnit = cost; // cost IS per stockUnit
            const costPerRecipeUnit = stockToRecipeFactor > 0 ? cost / stockToRecipeFactor : 0;
            const priceDetal = parseNum(prodPriceDetal.value) || 0;
            const priceMayor = parseNum(prodPriceMayor.value) || 0;
            const priceSpecial = parseNum(prodPriceSpecial.value) || 0;

            const businessId = localStorage.getItem('businessId');

            try {
                const prodData = {
                    barcode,
                    name,
                    category,
                    subCategory,
                    isSaleable,
                    supplierId,
                    // Sistema universal de 3 niveles
                    purchaseUnit,
                    purchaseToStockQty,
                    stockUnit,
                    // Nivel 3 (Contenido de Unidad)
                    unitContentQty: stockUnit === 'Unidad' ? unitContentQty : null,
                    unitContentUnit: stockUnit === 'Unidad' ? unitContentUnit : null,
                    recipeUnit,
                    stockToRecipeFactor,
                    // Costos
                    cost,
                    costPerStockUnit,
                    costPerRecipeUnit,
                    // Precios (siempre por stockUnit)
                    priceDetal,
                    priceMayor,
                    priceSpecial,
                    // Receta
                    yield: pYield,
                    recipeIngredients: category === 'RECETA' ? recipeIngredients : [],
                    // Imagen
                    image: imageBase64,
                    businessId,
                    createdAt: editProduct?.createdAt || new Date().toISOString()
                };

                if (!editProduct) {
                    prodData.stock = 0;
                    prodData.createdAt = new Date().toISOString();
                    const newDocRef = doc(collection(db, "businesses", businessId, "products"));
                    await setDoc(newDocRef, prodData);
                    
                    if (window.tempPurchaseState) {
                        window.tempPurchaseState.autoOpenProductId = newDocRef.id;
                    }
                } else {
                    await setDoc(doc(db, "businesses", businessId, "products", editProduct.id), prodData, { merge: true });
                }

                if (window.tempPurchaseState) {
                    // Navigate back to purchases
                    document.getElementById('navCompras').click();
                    return;
                }

                await loadData();
            } catch (error) {
                console.error("Error guardando producto: ", error);
                showNotification("Error al guardar. Revisa la consola.");
                btn.disabled = false;
                btn.textContent = editProduct ? 'Guardar Cambios' : 'Crear Producto';
            }
        });
    }

    function renderDetail(product) {
        // En lugar de una vista detallada custom muy larga, 
        // usaremos directamente el formulario inyectando la data para que sirva de edición.
        renderForm(product);
    }

    loadData();
}
