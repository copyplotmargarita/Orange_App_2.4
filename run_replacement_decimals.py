import os

filepath = r'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\products.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Detal
old_detal = """editProduct.priceDetal.toLocaleString('de-DE', {minimumFractionDigits:2})"""
new_detal = """editProduct.priceDetal.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})"""
content = content.replace(old_detal, new_detal)

# Fix Mayor
old_mayor = """editProduct.priceMayor.toLocaleString('de-DE', {minimumFractionDigits:2})"""
new_mayor = """editProduct.priceMayor.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})"""
content = content.replace(old_mayor, new_mayor)

# Fix Special
old_special = """editProduct.priceSpecial.toLocaleString('de-DE', {minimumFractionDigits:2})"""
new_special = """editProduct.priceSpecial.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2})"""
content = content.replace(old_special, new_special)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Decimals fixed in HTML rendering.")
