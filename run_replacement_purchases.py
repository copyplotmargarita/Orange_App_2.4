import os

filepath = r'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\purchases.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """                                const formatPrice = (num) => {
                                    if (num < 1) return Number(num.toFixed(3));
                                    return Math.round(num * 20) / 20;
                                };
                                let mDetal = 1.30, mMayor = 1.25, mSpecial = 1.20;
                                if (pData.category === 'RECETA') { mDetal = 2.60; mMayor = 2.50; mSpecial = 2.40; }

                                await updateDoc(prodRef, {
                                    stockGeneral: newStockGeneral,
                                    cost: newCostPerStockUnit,
                                    costPerStockUnit: newCostPerStockUnit,
                                    costPerRecipeUnit: newCostPerRecipeUnit,
                                    priceDetal: formatPrice(newCostPerStockUnit * mDetal),
                                    priceMayor: formatPrice(newCostPerStockUnit * mMayor),
                                    priceSpecial: formatPrice(newCostPerStockUnit * mSpecial)
                                });"""

new_logic = """                                const formatPrice = (num) => {
                                    if (num < 1) return Number(num.toFixed(3));
                                    return Math.round(num * 20) / 20;
                                };
                                
                                const oldCost = pData.cost || 0;
                                let newPriceDetal = pData.priceDetal || 0;
                                let newPriceMayor = pData.priceMayor || 0;
                                let newPriceSpecial = pData.priceSpecial || 0;
                                
                                if (oldCost === 0) {
                                    let mDetal = 1.30, mMayor = 1.25, mSpecial = 1.20;
                                    if (pData.category === 'RECETA') { mDetal = 2.60; mMayor = 2.50; mSpecial = 2.40; }
                                    newPriceDetal = formatPrice(newCostPerStockUnit * mDetal);
                                    newPriceMayor = formatPrice(newCostPerStockUnit * mMayor);
                                    newPriceSpecial = formatPrice(newCostPerStockUnit * mSpecial);
                                } else {
                                    if (newCostPerStockUnit > oldCost) {
                                        // Escenario B: Costo sube -> Mantener márgenes, recalcular precios
                                        const mDetal = (oldCost > 0 && pData.priceDetal) ? (pData.priceDetal / oldCost) : (pData.category === 'RECETA' ? 2.60 : 1.30);
                                        const mMayor = (oldCost > 0 && pData.priceMayor) ? (pData.priceMayor / oldCost) : (pData.category === 'RECETA' ? 2.50 : 1.25);
                                        const mSpecial = (oldCost > 0 && pData.priceSpecial) ? (pData.priceSpecial / oldCost) : (pData.category === 'RECETA' ? 2.40 : 1.20);
                                        
                                        newPriceDetal = formatPrice(newCostPerStockUnit * mDetal);
                                        newPriceMayor = formatPrice(newCostPerStockUnit * mMayor);
                                        newPriceSpecial = formatPrice(newCostPerStockUnit * mSpecial);
                                    }
                                    // Escenario A: Si el costo baja, los precios se mantienen (ya están en newPriceDetal, etc)
                                }

                                await updateDoc(prodRef, {
                                    stockGeneral: newStockGeneral,
                                    cost: newCostPerStockUnit,
                                    costPerStockUnit: newCostPerStockUnit,
                                    costPerRecipeUnit: newCostPerRecipeUnit,
                                    priceDetal: newPriceDetal,
                                    priceMayor: newPriceMayor,
                                    priceSpecial: newPriceSpecial
                                });"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Logic Replacements Done in purchases.js.")
else:
    print("Error: Could not find old_logic in purchases.js.")
