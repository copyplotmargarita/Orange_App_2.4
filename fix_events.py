import os

sales_path = 'js/views/sales.js'
with open(sales_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix unsafe querySelectors
content = content.replace("container.querySelector('#saleType').addEventListener", "container.querySelector('#saleType')?.addEventListener")
content = content.replace("container.querySelector('#saleTarget').addEventListener", "container.querySelector('#saleTarget')?.addEventListener")
content = content.replace("container.querySelector('#priceType').addEventListener", "container.querySelector('#priceType')?.addEventListener")
content = content.replace("container.querySelector('#finishBtn').addEventListener", "container.querySelector('#finishBtn')?.addEventListener")

# Let's also fix others just in case they fail in mobile
content = content.replace("container.querySelector('#backToCartBtn').addEventListener", "container.querySelector('#backToCartBtn')?.addEventListener")
content = content.replace("container.querySelector('#closeDetailBtn').addEventListener", "container.querySelector('#closeDetailBtn')?.addEventListener")
content = content.replace("container.querySelector('#backToCartBtnOrders').addEventListener", "container.querySelector('#backToCartBtnOrders')?.addEventListener")
content = content.replace("container.querySelector('#orderStatusFilter').addEventListener", "container.querySelector('#orderStatusFilter')?.addEventListener")
content = content.replace("container.querySelector('#refreshOrdersBtn').addEventListener", "container.querySelector('#refreshOrdersBtn')?.addEventListener")
content = content.replace("container.querySelector('#productionTodayBtn').addEventListener", "container.querySelector('#productionTodayBtn')?.addEventListener")

with open(sales_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("sales.js safe event listeners successfully applied.")
