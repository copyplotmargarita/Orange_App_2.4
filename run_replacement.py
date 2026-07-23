import os

filepath = r'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\products.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace UI for Price Detal
old_detal = """                            <div class="form-group">
                                <label id="lblPriceDetal">🛒 PRECIO DETAL (+30%)</label>
                                <div id="gridPriceDetal" style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
                                    <input type="text" inputmode="numeric" id="prodPriceDetal" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceDetal ? editProduct.priceDetal.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 800; border-left: 4px solid var(--primary);">
                                    <input type="text" id="marginDetalDisplay" class="form-control" readonly placeholder="% Real" style="display: none; background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);" value="${editProduct?.marginDetal ? editProduct.marginDetal.toLocaleString('de-DE', {maximumFractionDigits:2})+' %' : ''}" data-margin="${editProduct?.marginDetal || ''}">
                                    <input type="text" id="suggestedDetalDisplay" class="form-control" readonly placeholder="Sugerido $" style="display: none; background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);">
                                </div>
                            </div>"""

new_detal = """                            <div class="form-group">
                                <label id="lblPriceDetal">🛒 PRECIO DETAL</label>
                                <div id="gridPriceDetal" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <span style="position: absolute; left: 10px; font-weight: bold; color: var(--text-muted);">$.</span>
                                        <input type="text" inputmode="numeric" id="prodPriceDetal" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceDetal ? editProduct.priceDetal.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 800; border-left: 4px solid var(--primary); padding-left: 30px; width: 100%;">
                                    </div>
                                    <input type="text" id="marginDetalDisplay" class="form-control" readonly placeholder="% Ganancia" style="background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);" value="${editProduct?.marginDetal ? editProduct.marginDetal.toLocaleString('de-DE', {maximumFractionDigits:2})+' %' : ''}" data-margin="${editProduct?.marginDetal || ''}">
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <span style="position: absolute; left: 10px; font-weight: bold; color: var(--text-muted);">Bs.</span>
                                        <input type="text" id="bsDetalDisplay" class="form-control" readonly placeholder="Bs." style="background: var(--surface-variant); border: none; font-weight: bold; padding-left: 35px; width: 100%; color: var(--text-muted);">
                                    </div>
                                </div>
                            </div>"""

content = content.replace(old_detal, new_detal)

# Replace UI for Price Mayor
old_mayor = """                            <div class="form-group">
                                <label id="lblPriceMayor">🏢 PRECIO AL MAYOR (+25%)</label>
                                <div id="gridPriceMayor" style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
                                    <input type="text" inputmode="numeric" id="prodPriceMayor" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceMayor ? editProduct.priceMayor.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 700;">
                                    <input type="text" id="marginMayorDisplay" class="form-control" readonly placeholder="% Real" style="display: none; background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);" value="${editProduct?.marginMayor ? editProduct.marginMayor.toLocaleString('de-DE', {maximumFractionDigits:2})+' %' : ''}" data-margin="${editProduct?.marginMayor || ''}">
                                    <input type="text" id="suggestedMayorDisplay" class="form-control" readonly placeholder="Sugerido $" style="display: none; background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);">
                                </div>
                            </div>"""

new_mayor = """                            <div class="form-group">
                                <label id="lblPriceMayor">🏢 PRECIO AL MAYOR</label>
                                <div id="gridPriceMayor" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <span style="position: absolute; left: 10px; font-weight: bold; color: var(--text-muted);">$.</span>
                                        <input type="text" inputmode="numeric" id="prodPriceMayor" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceMayor ? editProduct.priceMayor.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 700; padding-left: 30px; width: 100%;">
                                    </div>
                                    <input type="text" id="marginMayorDisplay" class="form-control" readonly placeholder="% Ganancia" style="background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);" value="${editProduct?.marginMayor ? editProduct.marginMayor.toLocaleString('de-DE', {maximumFractionDigits:2})+' %' : ''}" data-margin="${editProduct?.marginMayor || ''}">
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <span style="position: absolute; left: 10px; font-weight: bold; color: var(--text-muted);">Bs.</span>
                                        <input type="text" id="bsMayorDisplay" class="form-control" readonly placeholder="Bs." style="background: var(--surface-variant); border: none; font-weight: bold; padding-left: 35px; width: 100%; color: var(--text-muted);">
                                    </div>
                                </div>
                            </div>"""

content = content.replace(old_mayor, new_mayor)

# Replace UI for Price Special
old_special = """                            <div class="form-group">
                                <label id="lblPriceSpecial">⭐ PRECIO ESPECIAL (+20%)</label>
                                <div id="gridPriceSpecial" style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
                                    <input type="text" inputmode="numeric" id="prodPriceSpecial" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceSpecial ? editProduct.priceSpecial.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 700;">
                                    <input type="text" id="marginSpecialDisplay" class="form-control" readonly placeholder="% Real" style="display: none; background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);" value="${editProduct?.marginSpecial ? editProduct.marginSpecial.toLocaleString('de-DE', {maximumFractionDigits:2})+' %' : ''}" data-margin="${editProduct?.marginSpecial || ''}">
                                    <input type="text" id="suggestedSpecialDisplay" class="form-control" readonly placeholder="Sugerido $" style="display: none; background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);">
                                </div>
                            </div>"""

new_special = """                            <div class="form-group">
                                <label id="lblPriceSpecial">⭐ PRECIO ESPECIAL</label>
                                <div id="gridPriceSpecial" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <span style="position: absolute; left: 10px; font-weight: bold; color: var(--text-muted);">$.</span>
                                        <input type="text" inputmode="numeric" id="prodPriceSpecial" class="form-control" ${isFromPurchase ? '' : 'required'} value="${editProduct?.priceSpecial ? editProduct.priceSpecial.toLocaleString('de-DE', {minimumFractionDigits:2}) : '0,00'}" style="font-weight: 700; padding-left: 30px; width: 100%;">
                                    </div>
                                    <input type="text" id="marginSpecialDisplay" class="form-control" readonly placeholder="% Ganancia" style="background: transparent; border: 1px dashed var(--primary); text-align: center; font-size: 0.85rem; color: var(--primary);" value="${editProduct?.marginSpecial ? editProduct.marginSpecial.toLocaleString('de-DE', {maximumFractionDigits:2})+' %' : ''}" data-margin="${editProduct?.marginSpecial || ''}">
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <span style="position: absolute; left: 10px; font-weight: bold; color: var(--text-muted);">Bs.</span>
                                        <input type="text" id="bsSpecialDisplay" class="form-control" readonly placeholder="Bs." style="background: var(--surface-variant); border: none; font-weight: bold; padding-left: 35px; width: 100%; color: var(--text-muted);">
                                    </div>
                                </div>
                            </div>"""

content = content.replace(old_special, new_special)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("UI Replacements Done.")
