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
                    <div class="card product-card" data-id="${prod.id}" style="padding: 0; overflow: hidden; cursor: ${role !== 'employee' ? 'pointer' : 'default'};">
                        ${imageHtml}
                        <div style="padding: 0.75rem;">
                            <h3 style="color: var(--primary); margin-bottom: 0.5rem; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${prod.name}">${prod.name}</h3>
                            <div style="margin-bottom: 0.5rem;">
                                <p style="font-weight: bold; font-size: 1rem; color: var(--text-main);">$ ${formatCurrency(prod.priceDetal)}</p>
                                <p style="font-weight: bold; font-size: 1rem; color: var(--text-main);">Bs. ${formatCurrency(priceBsNum)}</p>
                            </div>
                            <!-- Categoría eliminada para diseño más limpio -->
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;

        container.innerHTML = html;

        const addBtn = container.querySelector('#addProductBtn');
        if (addBtn) addBtn.addEventListener('click', () => renderForm());
        
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
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;" class="flex-stack-mobile">
                <button class="btn btn-outline" id="backBtn" style="width: auto; padding: 0.5rem 1rem;">← Cancelar</button>
                <h2>${editProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}</h2>
            </div>
            
            <form id="productForm" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start;" class="grid-1-mobile">
                <!-- Columna Izquierda: Datos Principales -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">Datos Principales</h3>
                    
                    <div class="form-group mb-4">
                        <label>Código de Barras <small class="text-muted">(Opcional)</small></label>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="text" id="prodBarcode" class="form-control" placeholder="Escanee o escriba el código" value="${editProduct?.barcode || ''}" style="font-family: monospace;">
                            <button type="button" class="btn btn-outline" style="width: auto; padding: 0.5rem;" title="El código de barras agilizará las ventas en el futuro" disabled>
                                <span>|||</span>
                            </button>
                        </div>
                    </div>

                    <div class="form-group mb-4">
                        <label>Nombre del Producto <span class="text-danger">*</span></label>
                        <input type="text" id="prodName" class="form-control" placeholder="Ej. Harina P.A.N" required value="${editProduct?.name || ''}">
                    </div>
                    
                    <div class="form-group mb-4">
                        <label>Categoría <span class="text-danger">*</span></label>
                        <select id="prodCategory" class="form-control" required ${editProduct ? 'disabled' : ''}>
                            <option value="">Seleccione...</option>
                            <option value="NEW" style="font-weight: bold; color: #3b82f6;">+ CREAR CATEGORIA</option>
                            <option value="SERVICIOS" ${editProduct?.category === 'SERVICIOS' ? 'selected' : ''}>SERVICIOS</option>
                            <option value="INSUMO" ${editProduct?.category === 'INSUMO' ? 'selected' : ''}>INSUMO</option>
                            <option value="INSUMO/RECETA" ${editProduct?.category === 'INSUMO/RECETA' ? 'selected' : ''}>INSUMO/RECETA</option>
                            <option value="RECETA" ${editProduct?.category === 'RECETA' ? 'selected' : ''}>RECETA</option>
                        </select>
                    </div>

                     <!-- Modal para Nueva Categoría -->
                     <div id="categoryModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; align-items: center; justify-content: center; padding: 1rem;">
                        <div class="card" style="width: 100%; max-width: 400px; border-top: 4px solid var(--primary);">
                            <h3 class="mb-4">Crear Nueva Categoría</h3>
                            <div class="form-group mb-4">
                                <label>Nombre de la Categoría</label>
                                <input type="text" id="newCategoryInput" class="form-control" placeholder="Ej. BEBIDAS" style="text-transform: uppercase;">
                            </div>
                            <div style="display: flex; gap: 1rem;">
                                <button type="button" class="btn btn-outline" id="cancelCatBtn">Cancelar</button>
                                <button type="button" class="btn btn-primary" id="confirmCatBtn">Crear Categoría</button>
                            </div>
                        </div>
                     </div>

                    <div class="form-group mb-4" id="supplierGroup" style="display: none;">
                        <label>Proveedor <span class="text-danger">*</span></label>
                        <select id="prodSupplier" class="form-control">
                            <option value="">Seleccione...</option>
                            ${suppliers.map(s => `<option value="${s.id}" ${(editProduct?.supplierId === s.id || (isFromPurchase && purchaseSupplierId === s.id)) ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Sistema Universal de Unidades (3 Niveles) -->
                    <div id="unitSection" style="display: none; flex-direction: column; gap: 1rem;" class="mb-4">
                        <h4 style="margin: 0; font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Unidades y Conversión</h4>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>Unidad de Compra <span class="text-danger">*</span><br><small class="text-muted" style="font-weight:normal;">¿Cómo llega del proveedor?</small></label>
                                <input type="text" id="prodPurchaseUnit" class="form-control" list="purchaseUnitList"
                                    placeholder="Saco, Caja, Kilo..." value="${editProduct?.purchaseUnit || ''}">
                                <datalist id="purchaseUnitList">
                                    <option value="Saco"><option value="Caja"><option value="Bulto">
                                    <option value="Paquete"><option value="Unidad"><option value="Kilo"><option value="Litro">
                                </datalist>
                            </div>
                            <div class="form-group">
                                <label>Cant. de Stock por Unidad de Compra <span class="text-danger">*</span><br><small class="text-muted" style="font-weight:normal;">¿Cuántas unidades de stock trae?</small></label>
                                <input type="number" step="0.0001" id="prodPurchaseToStockQty" class="form-control"
                                    placeholder="Ej. 45" value="${editProduct?.purchaseToStockQty || ''}">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Unidad de Stock <span class="text-danger">*</span><br><small class="text-muted" style="font-weight:normal;">¿En qué unidad se guarda, transfiere y vende?</small></label>
                            <select id="prodStockUnit" class="form-control">
                                <option value="Unidad" ${(editProduct?.stockUnit||'Unidad')==='Unidad'?'selected':''}>Unidad</option>
                                <option value="Kilo" ${editProduct?.stockUnit==='Kilo'?'selected':''}>Kilo</option>
                                <option value="Litro" ${editProduct?.stockUnit==='Litro'?'selected':''}>Litro</option>
                            </select>
                        </div>

                        <div style="background: var(--background); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border);">
                            <p style="font-size:0.75rem; color:var(--text-muted); margin:0 0 0.25rem;">Unidad de Receta (automática)</p>
                            <p id="recipeUnitDisplay" style="font-weight:bold; color:var(--primary); margin:0;">—</p>
                            <p id="stockToRecipeFactorDisplay" style="font-size:0.75rem; color:var(--text-muted); margin:0.25rem 0 0;">—</p>
                        </div>
                    </div>

                    <!-- Eliminado sellGroup para simplificar -->

                    <div class="form-group mb-4" id="recipeYieldGroup" style="display: none;">
                        <label>Unidades por Receta <span class="text-danger">*</span></label>
                        <input type="number" step="0.01" id="prodYield" class="form-control" value="${editProduct?.yield || ''}">
                        <button type="button" class="btn btn-outline mt-2" id="buildRecipeBtn" style="width: 100%; border-color: var(--primary); color: var(--primary);">📝 Construir Receta</button>
                    </div>

                    <div class="form-group mb-4">
                        <label>Imagen del Producto <span class="text-danger">*</span></label>
                        <div id="imagePreview" style="width: 80px; height: 80px; border-radius: 8px; background: var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            ${editProduct?.image ? `<img src="${editProduct.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="font-size: 2rem;">📷</span>'}
                        </div>
                        <input type="file" id="prodImage" accept="image/*" class="form-control" style="flex: 1;">
                    </div>
                </div>

                <!-- Columna Derecha: Costos y Precios -->
                <div class="card" style="display: ${isFromPurchase ? 'none' : 'block'};">
                    <h3 style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);">Costos y Precios</h3>

                    <div class="form-group mb-4">
                        <label id="costLabel">Costo $ <span class="text-danger">*</span></label>
                        <input type="number" step="0.0001" id="prodCost" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.cost || ''}">
                    </div>

                    <div class="form-group mb-4" id="costPerUnitGroup" style="display: none;">
                        <label>Costo $ por Unidad <small class="text-muted">(Auto-calculado)</small></label>
                        <input type="number" step="0.0001" id="prodCostPerUnit" class="form-control" readonly style="background-color: var(--background);" value="${editProduct?.costPerUnit || ''}">
                    </div>

                    <div class="form-group mb-4">
                        <label id="lblPriceDetal">Precio Detal $ (+30%) <span class="text-danger">*</span></label>
                        <input type="number" step="0.01" id="prodPriceDetal" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceDetal || ''}">
                    </div>

                    <div class="form-group mb-4">
                        <label id="lblPriceMayor">Precio Mayor $ (+25%) <span class="text-danger">*</span></label>
                        <input type="number" step="0.01" id="prodPriceMayor" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceMayor || ''}">
                    </div>

                    <div class="form-group mb-4">
                        <label id="lblPriceSpecial">Precio Especial $ (+20%) <span class="text-danger">*</span></label>
                        <input type="number" step="0.01" id="prodPriceSpecial" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceSpecial || ''}">
                    </div>

                    <div style="margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                        <button type="submit" class="btn btn-primary" id="saveBtn" style="width: 100%;">${editProduct ? 'Guardar Cambios' : 'Crear Producto'}</button>
                    </div>
                </div>

                ${isFromPurchase ? `
                <div class="card" style="display: flex; flex-direction: column; justify-content: center; text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚙️</div>
                    <h3>Configuración Automática</h3>
                    <p class="text-muted">Los costos y precios de venta de este producto se calcularán automáticamente al procesar la compra actual.</p>
                    <button type="submit" class="btn btn-primary" id="saveBtnPurchase" style="width: 100%; margin-top: 2rem;">Crear y Volver a la Compra</button>
                </div>
                ` : ''}
            </form>
            
            <!-- Modal/Pantalla Completa Constructor de Recetas -->
            <div id="recipeBuilderModal" style="display: none; position: fixed; inset: 0; background: var(--background); z-index: 2000; flex-direction: column;">
                <div style="height: auto; min-height: 64px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem;" class="flex-stack-mobile">
                    <h2 style="margin: 0; font-size: 1.25rem;">Constructor de Receta</h2>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <button type="button" class="btn btn-outline" id="cancelRecipeBtn" style="width: auto;">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="finishRecipeBtn" style="width: auto;">Finalizar Receta</button>
                    </div>
                </div>
                <div style="flex: 1; display: flex; overflow: hidden;" class="flex-stack-mobile">
                    <!-- Lado Izquierdo: Catálogo de Productos -->
                    <div style="flex: 1; display: flex; flex-direction: column; background: var(--background); border-right: 1px solid var(--border); overflow: hidden;">
                        <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: var(--surface);">
                            <input type="search" id="catalogSearch" class="form-control" placeholder="Buscar insumos para agregar...">
                        </div>
                        <div id="catalogGrid" style="flex: 1; padding: 1rem; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; align-content: start;">
                            <!-- Catalog cards -->
                        </div>
                    </div>

                    <!-- Lado Derecho: DECK (Ingredientes) -->
                    <div style="flex: 1; display: flex; flex-direction: column; background: var(--surface);">
                        <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                            <h3 style="margin: 0;">Ingredientes de la Receta</h3>
                        </div>
                        <div style="flex: 1; overflow-y: auto; padding: 1rem;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border);">
                                        <th style="padding: 0.5rem;">Insumo</th>
                                        <th style="padding: 0.5rem;">Cant.</th>
                                        <th style="padding: 0.5rem;">Costo Ud.</th>
                                        <th style="padding: 0.5rem;">SubTotal</th>
                                        <th style="padding: 0.5rem;"></th>
                                    </tr>
                                </thead>
                                <tbody id="recipeTableBody">
                                    <!-- Dynamic rows -->
                                </tbody>
                            </table>
                        </div>
                        <div style="padding: 1rem; border-top: 1px solid var(--border); background: var(--background);">
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; text-align: center;">
                                <div class="card" style="padding: 1rem;">
                                    <p class="text-sm text-muted mb-1">Unidades/Rendimiento</p>
                                    <p style="font-size: 1.25rem; font-weight: bold;" id="rbYieldDisplay">0</p>
                                </div>
                                <div class="card" style="padding: 1rem;">
                                    <p class="text-sm text-muted mb-1">Costo Total Receta</p>
                                    <p style="font-size: 1.25rem; font-weight: bold; color: var(--danger);" id="rbTotalCostDisplay">$ 0.0000</p>
                                </div>
                                <div class="card" style="padding: 1rem;">
                                    <p class="text-sm text-muted mb-1">Costo por Unidad</p>
                                    <p style="font-size: 1.25rem; font-weight: bold; color: var(--primary);" id="rbUnitCostDisplay">$ 0.0000</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal para Cantidad de Insumo en Receta -->
            <div id="recipeQtyModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); z-index: 5000; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="width: 100%; max-width: 400px; border-top: 5px solid var(--primary); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                    <h2 id="rqmTitle" style="color: var(--primary); margin-bottom: 0.5rem; font-size: 1.25rem;">Añadir Insumo</h2>
                    <p id="rqmSubtitle" class="text-muted mb-4" style="font-size: 0.9rem;">¿Qué cantidad de este ingrediente vas a usar?</p>
                    
                    <div class="form-group mb-4">
                        <label id="rqmLabel">Cantidad (<span id="rqmUnit">ud</span>) <span class="text-danger">*</span></label>
                        <input type="number" step="0.0001" id="rqmQtyInput" class="form-control" placeholder="Ej. 0.500" style="font-size: 1.25rem; font-weight: bold; text-align: center;">
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-outline" id="rqmCancelBtn" style="width: auto;">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="rqmConfirmBtn" style="width: auto;">Agregar a Receta</button>
                    </div>
                </div>
            </div>
        `;

        // DOM Elements
        const form = container.querySelector('#productForm');
        const catSelect = container.querySelector('#prodCategory');
        const supplierGroup = container.querySelector('#supplierGroup');
        const prodSupplier = container.querySelector('#prodSupplier');
        const unitSection = container.querySelector('#unitSection');
        const prodPurchaseUnit = container.querySelector('#prodPurchaseUnit');
        const prodPurchaseToStockQty = container.querySelector('#prodPurchaseToStockQty');
        const prodStockUnit = container.querySelector('#prodStockUnit');
        const recipeUnitDisplay = container.querySelector('#recipeUnitDisplay');
        const stockToRecipeFactorDisplay = container.querySelector('#stockToRecipeFactorDisplay');

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

        container.querySelector('#backBtn').addEventListener('click', renderList);

        // --- Lógica de UI Dinámica por Categoría ---
        function updateFormUI() {
            const cat = catSelect.value;

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

            supplierGroup.style.display = 'none';
            unitSection.style.display = 'none';
            recipeYieldGroup.style.display = 'none';
            costPerUnitGroup.style.display = 'none';

            if (cat === 'RECETA') {
                recipeYieldGroup.style.display = 'block';
                prodYield.required = true;
                costPerUnitGroup.style.display = 'block';
                prodCost.readOnly = true;
                costLabel.innerHTML = 'Costo $ Receta <span class="text-danger">*</span>';
                lblPriceDetal.innerHTML = 'Precio Detal $ (+160%) <span class="text-danger">*</span>';
                lblPriceMayor.innerHTML = 'Precio Mayor $ (+150%) <span class="text-danger">*</span>';
                lblPriceSpecial.innerHTML = 'Precio Especial $ (+140%) <span class="text-danger">*</span>';

            } else if (cat === 'SERVICIOS') {
                lblPriceDetal.innerHTML = 'Precio Detal $ <span class="text-muted" style="font-size:0.8rem;">(= Costo $)</span>';
                lblPriceMayor.innerHTML = 'Precio Mayor $ <span class="text-muted" style="font-size:0.8rem;">(= Costo $)</span>';
                lblPriceSpecial.innerHTML = 'Precio Especial $ <span class="text-muted" style="font-size:0.8rem;">(= Costo $)</span>';
                prodPriceDetal.readOnly = true;
                prodPriceMayor.readOnly = true;
                prodPriceSpecial.readOnly = true;

            } else if (cat === 'NEW') {
                const modal = container.querySelector('#categoryModal');
                modal.style.display = 'flex';
                container.querySelector('#newCategoryInput').focus();
                catSelect.value = '';

            } else if (cat !== '') {
                // INSUMO, INSUMO/RECETA y categorías personalizadas — productos físicos
                supplierGroup.style.display = 'block';
                prodSupplier.required = true;
                unitSection.style.display = 'flex';
                costPerUnitGroup.style.display = 'block';
            }

            calculateMath();
        }
        
        catSelect.addEventListener('change', updateFormUI);
        
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

        if (editProduct) updateFormUI(); // Init if editing

        // --- Lógica de Matemáticas y Conversión (Sistema 3 Niveles) ---
        function getRecipeUnitInfo(stockUnit) {
            if (stockUnit === 'Kilo')   return { recipeUnit: 'Gramo',      factor: 1000 };
            if (stockUnit === 'Litro')  return { recipeUnit: 'Mililitro',  factor: 1000 };
            return                             { recipeUnit: 'Unidad',     factor: 1    };
        }

        function calculateMath() {
            const cat = catSelect.value;
            const cost = parseFloat(prodCost.value) || 0;

            // --- Actualizar etiqueta de costo con unidad de stock ---
            if (cat !== 'RECETA' && cat !== 'SERVICIOS') {
                const su = prodStockUnit ? prodStockUnit.value : 'Ud';
                costLabel.innerHTML = `Costo $ por ${su} <span class="text-danger">*</span>`;
            }

            // --- Derivar unidad de receta y factor de conversión ---
            if (prodStockUnit && unitSection.style.display !== 'none') {
                const { recipeUnit, factor } = getRecipeUnitInfo(prodStockUnit.value);
                if (recipeUnitDisplay) recipeUnitDisplay.textContent = recipeUnit;
                if (stockToRecipeFactorDisplay) {
                    stockToRecipeFactorDisplay.textContent =
                        factor === 1
                            ? `1 ${prodStockUnit.value} = 1 ${recipeUnit}`
                            : `1 ${prodStockUnit.value} = ${factor.toLocaleString()} ${recipeUnit}s`;
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

        prodPurchaseToStockQty.addEventListener('input', calculateMath);
        prodStockUnit.addEventListener('change', calculateMath);
        prodCost.addEventListener('input', calculateMath);

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
            const supplierId = prodSupplier.value || null;
            const purchaseUnit = prodPurchaseUnit ? prodPurchaseUnit.value.trim() : '';
            const purchaseToStockQty = parseFloat(prodPurchaseToStockQty?.value) || 1;
            const stockUnit = prodStockUnit ? prodStockUnit.value : 'Unidad';
            const { recipeUnit, factor: stockToRecipeFactor } = getRecipeUnitInfo(stockUnit);
            const pYield = parseFloat(prodYield.value) || null;
            const cost = isFromPurchase ? 0 : (parseFloat(prodCost.value) || 0);
            const costPerStockUnit = cost; // cost IS per stockUnit
            const costPerRecipeUnit = isFromPurchase ? 0 : (stockToRecipeFactor > 0 ? cost / stockToRecipeFactor : 0);
            const priceDetal = isFromPurchase ? 0 : (parseFloat(prodPriceDetal.value) || 0);
            const priceMayor = isFromPurchase ? 0 : (parseFloat(prodPriceMayor.value) || 0);
            const priceSpecial = isFromPurchase ? 0 : (parseFloat(prodPriceSpecial.value) || 0);

            const businessId = localStorage.getItem('businessId');

            try {
                const prodData = {
                    barcode,
                    name,
                    category,
                    supplierId,
                    // Sistema universal de 3 niveles
                    purchaseUnit,
                    purchaseToStockQty,
                    stockUnit,
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
