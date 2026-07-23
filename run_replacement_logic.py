import os

filepath = r'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\products.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace initialization
old_init = """        const purchaseSupplierId = window.tempPurchaseState?.supplierId || '';"""
new_init = """        const purchaseSupplierId = window.tempPurchaseState?.supplierId || '';
        window.previousCostForAsymmetricLogic = editProduct ? (editProduct.cost || 0) : null;"""
content = content.replace(old_init, new_init)

# Replace calculateMath logic
old_math = """            // --- SERVICIOS: precios = costo exacto ---
            if (cat === 'SERVICIOS') {
                prodPriceDetal.value = cost.toFixed(2);
                prodPriceMayor.value = cost.toFixed(2);
                prodPriceSpecial.value = cost.toFixed(2);
                return;
            }

            // --- Calcular precios con márgenes ---
            const formatPriceStr = (c, margin) => {
                const n = c * margin;
                if (n < 1) {
                    return n.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 4});
                }
                return (Math.round(n * 20) / 20).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            };

            if (cat !== 'RECETA' && (document.activeElement === prodCost || !prodPriceDetal.value)) {
                let mDetal = 1.30, mMayor = 1.25, mSpecial = 1.20;
                prodPriceDetal.value  = formatPriceStr(cost, mDetal);
                prodPriceMayor.value  = formatPriceStr(cost, mMayor);
                prodPriceSpecial.value = formatPriceStr(cost, mSpecial);
            }
            
            if (cat === 'RECETA' && (!prodPriceDetal.value || parseNum(prodPriceDetal.value) === 0)) {
                prodPriceDetal.value  = formatPriceStr(cost, 2.60);
                prodPriceMayor.value  = formatPriceStr(cost, 2.50);
                prodPriceSpecial.value = formatPriceStr(cost, 2.40);
                container.querySelector('#marginDetalDisplay').dataset.margin = "160";
                container.querySelector('#marginMayorDisplay').dataset.margin = "150";
                container.querySelector('#marginSpecialDisplay').dataset.margin = "140";
            }

            if (cat === 'RECETA') {
                ['Detal', 'Mayor', 'Special'].forEach(lvl => {
                    const priceInput = container.querySelector(`#prodPrice${lvl}`);
                    const marginInput = container.querySelector(`#margin${lvl}Display`);
                    const suggestedInput = container.querySelector(`#suggested${lvl}Display`);
                    
                    const priceVal = parseNum(priceInput.value) || 0;
                    
                    // Si el usuario edita el precio manualmente, actualizamos su margen objetivo
                    if (document.activeElement === priceInput && cost > 0) {
                        const newMargin = ((priceVal / cost) - 1) * 100;
                        marginInput.dataset.margin = newMargin;
                    }

                    const savedMarginStr = marginInput.dataset.margin;
                    
                    if (priceVal > 0 && cost > 0) {
                        const realMargin = ((priceVal / cost) - 1) * 100;
                        marginInput.value = realMargin.toLocaleString('de-DE', {maximumFractionDigits: 2}) + ' %';
                        
                        if (savedMarginStr) {
                            const savedMargin = parseFloat(savedMarginStr) / 100;
                            const suggested = cost * (1 + savedMargin);
                            suggestedInput.value = suggested.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        }
                    } else {
                        marginInput.value = '';
                        suggestedInput.value = '';
                    }
                });
            }"""

new_math = """            // --- SERVICIOS: precios = costo exacto ---
            if (cat === 'SERVICIOS') {
                prodPriceDetal.value = cost.toLocaleString('de-DE', {minimumFractionDigits: 2});
                prodPriceMayor.value = cost.toLocaleString('de-DE', {minimumFractionDigits: 2});
                prodPriceSpecial.value = cost.toLocaleString('de-DE', {minimumFractionDigits: 2});
                return;
            }

            const formatPriceStr = (val) => {
                if (val < 1) return val.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 4});
                return (Math.round(val * 20) / 20).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            };

            const isNewProduct = (window.previousCostForAsymmetricLogic === null);
            const bcvRate = parseFloat(localStorage.getItem('bcvRate')) || 1;
            
            // Si estamos editando el costo
            if (document.activeElement === prodCost || !prodPriceDetal.value || parseNum(prodPriceDetal.value) === 0) {
                if (isNewProduct || window.previousCostForAsymmetricLogic === 0) {
                    // Producto nuevo o sin costo previo -> márgenes por defecto
                    let mDetal = cat === 'RECETA' ? 1.60 : 0.30;
                    let mMayor = cat === 'RECETA' ? 1.50 : 0.25;
                    let mSpecial = cat === 'RECETA' ? 1.40 : 0.20;
                    
                    prodPriceDetal.value = formatPriceStr(cost * (1 + mDetal));
                    prodPriceMayor.value = formatPriceStr(cost * (1 + mMayor));
                    prodPriceSpecial.value = formatPriceStr(cost * (1 + mSpecial));
                } else {
                    // Producto existente, aplicar regla asimétrica
                    const previousCost = window.previousCostForAsymmetricLogic;
                    if (cost < previousCost) {
                        // Escenario A: Costo baja -> Precios fijos, recalcular márgenes automáticamente abajo
                    } else if (cost > previousCost) {
                        // Escenario B: Costo sube -> Márgenes fijos, recalcular precios
                        ['Detal', 'Mayor', 'Special'].forEach(lvl => {
                            const marginInput = container.querySelector(`#margin${lvl}Display`);
                            const savedMargin = parseFloat(marginInput.dataset.margin || (lvl==='Detal'?30:(lvl==='Mayor'?25:20))) / 100;
                            const priceInput = container.querySelector(`#prodPrice${lvl}`);
                            priceInput.value = formatPriceStr(cost * (1 + savedMargin));
                        });
                    }
                }
                // Actualizamos costo previo
                window.previousCostForAsymmetricLogic = cost;
            }

            // --- Recálculo de % y Precio Bs (Siempre activo, bidireccional) ---
            ['Detal', 'Mayor', 'Special'].forEach(lvl => {
                const priceInput = container.querySelector(`#prodPrice${lvl}`);
                const marginInput = container.querySelector(`#margin${lvl}Display`);
                const bsInput = container.querySelector(`#bs${lvl}Display`);
                
                const priceVal = parseNum(priceInput.value) || 0;
                
                if (priceVal > 0 && cost > 0) {
                    const realMargin = ((priceVal / cost) - 1) * 100;
                    if (marginInput) {
                        marginInput.value = realMargin.toLocaleString('de-DE', {maximumFractionDigits: 2}) + ' %';
                        marginInput.dataset.margin = realMargin; // Guardar para Escenario B
                    }
                    if (bsInput) {
                        const bsVal = priceVal * bcvRate;
                        bsInput.value = bsVal.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    }
                } else {
                    if (marginInput) marginInput.value = '';
                    if (bsInput) bsInput.value = '';
                }
            });"""

content = content.replace(old_math, new_math)

# Cleanup orphaned suggested display resets
# In original products.js:
# `container.querySelector('#suggested${lvl}Display').style.display = 'block';`
# I replaced this grid initialization logic earlier, but let's just make sure.

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Logic Replacements Done.")
