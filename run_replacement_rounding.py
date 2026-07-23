import os

# --- products.js ---
filepath_prod = r'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\products.js'
with open(filepath_prod, 'r', encoding='utf-8') as f:
    content_prod = f.read()

# 1. Initialization of prodCost
old_cost_init = """<input type="text" inputmode="numeric" id="prodCost" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.cost ? editProduct.cost.toLocaleString('de-DE', {minimumFractionDigits:3, maximumFractionDigits:3}) : '0,000'}" style="font-size: 1.1rem; font-weight: 800; color: var(--primary);">"""
new_cost_init = """<input type="text" inputmode="numeric" id="prodCost" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.cost ? editProduct.cost.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0,00'}" style="font-size: 1.1rem; font-weight: 800; color: var(--primary);">"""
content_prod = content_prod.replace(old_cost_init, new_cost_init)

# 2. applyNumericMask for prodCost
old_mask = """applyNumericMask(prodCost, 3);"""
new_mask = """applyNumericMask(prodCost, 2);"""
content_prod = content_prod.replace(old_mask, new_mask)

# 3. formatPriceStr
old_format = """            const formatPriceStr = (val) => {
                if (val < 1) return val.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 4});
                return (Math.round(val * 20) / 20).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            };"""
new_format = """            const formatPriceStr = (val) => {
                return (Math.round(val * 20) / 20).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            };"""
content_prod = content_prod.replace(old_format, new_format)

with open(filepath_prod, 'w', encoding='utf-8') as f:
    f.write(content_prod)


# --- purchases.js ---
filepath_purch = r'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\purchases.js'
with open(filepath_purch, 'r', encoding='utf-8') as f:
    content_purch = f.read()

old_format_purch = """                                const formatPrice = (num) => {
                                    if (num < 1) return Number(num.toFixed(3));
                                    return Math.round(num * 20) / 20;
                                };"""
new_format_purch = """                                const formatPrice = (num) => {
                                    return Math.round(num * 20) / 20;
                                };"""
content_purch = content_purch.replace(old_format_purch, new_format_purch)

with open(filepath_purch, 'w', encoding='utf-8') as f:
    f.write(content_purch)

print("Rounding and Decimals fixed.")
