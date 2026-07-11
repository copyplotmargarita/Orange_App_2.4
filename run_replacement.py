import os

sales_path = 'js/views/sales.js'
with open(sales_path, 'r', encoding='utf-8') as f:
    content = f.read()

with open('new_render_logic.txt', 'r', encoding='utf-8') as f:
    new_logic = f.read()

# 1. Add currentMobileStep
if 'let currentMobileStep = 1;' not in content:
    content = content.replace('let cart = [];', 'let cart = [];\n    let currentMobileStep = 1;')

# 2. Extract innerHTML from new_logic
start_idx_new = new_logic.find('const isMobile = window.innerWidth < 1024;')
end_idx_new = new_logic.find('bindEvents();')
new_html_block = new_logic[start_idx_new:end_idx_new]

# 3. Find target in sales.js
start_str = "const saleStatus = container.querySelector('#saleStatus')?.value || (payments.length === 0 ? 'contado' : 'abono');"
end_str = "// Clock and Date"

start_idx_orig = content.find(start_str)
end_idx_orig = content.find(end_str, start_idx_orig)

if start_idx_orig != -1 and end_idx_orig != -1:
    before = content[:start_idx_orig + len(start_str)]
    after = content[end_idx_orig:]
    
    content = before + '\n\n        ' + new_html_block + '\n        ' + after
    print("Replaced innerHTML block")
else:
    print("Could not find innerHTML block bounds")

# 4. Inject event listeners
# Find the finishBtn listener
finish_btn_str = """        container.querySelector('#finishBtn').addEventListener('click', () => {
            if (!selectedClient) {
                showToast("Debe seleccionar un cliente primero", true);
                return;
            }
            const status = container.querySelector('#saleStatus')?.value || 'contado';
            if ((status === 'contado' || status === 'abono') && payments.length === 0 && settings.type !== 'presupuesto' && settings.type !== 'pedido') {
                showToast("Debe registrar al menos un pago", true);
                return;
            }
            processSale(currentRemainingUSD);
        });"""

events_to_add = """
        const btnNextStep = container.querySelector('#btnNextStep');
        if (btnNextStep) {
            btnNextStep.addEventListener('click', () => {
                if (currentMobileStep < 4) {
                    currentMobileStep++;
                    renderSingleView();
                }
            });
        }
        
        const navStep1 = container.querySelector('#navStep1');
        if (navStep1) navStep1.addEventListener('click', () => { currentMobileStep = 1; renderSingleView(); });
        const navStep2 = container.querySelector('#navStep2');
        if (navStep2) navStep2.addEventListener('click', () => { currentMobileStep = 2; renderSingleView(); });
        const navStep3 = container.querySelector('#navStep3');
        if (navStep3) navStep3.addEventListener('click', () => { currentMobileStep = 3; renderSingleView(); });
        const navStep4 = container.querySelector('#navStep4');
        if (navStep4) navStep4.addEventListener('click', () => { currentMobileStep = 4; renderSingleView(); });
"""

if finish_btn_str in content:
    content = content.replace(finish_btn_str, finish_btn_str + '\n' + events_to_add)
    print("Injected event listeners")
else:
    print("Could not find finishBtn block to inject event listeners")

# 5. Fix currentMobileStep reset when cart is emptied or sale is processed
# Wait, processSale clears the UI by calling `renderSales()`. So it will be reset because `let currentMobileStep = 1;` is in the initialization!
# What about cancelCartBtn? It empties the cart and calls render(). We need to reset `currentMobileStep = 1;` there.
cancel_cart_str = """        container.querySelector('#cancelCartBtn')?.addEventListener('click', () => {
            showConfirmModal("Cancelar Venta", "¿Está seguro que desea cancelar esta venta y vaciar el carrito?", () => {
                cart = []; payments = []; selectedClient = null; clientDebt = 0; includeOldDebt = false;
                sessionStorage.removeItem('sales_temp_state');
                render();
            }, "Sí, Cancelar", "No, Volver");
        });"""

cancel_cart_replacement = """        container.querySelector('#cancelCartBtn')?.addEventListener('click', () => {
            showConfirmModal("Cancelar Venta", "¿Está seguro que desea cancelar esta venta y vaciar el carrito?", () => {
                cart = []; payments = []; selectedClient = null; clientDebt = 0; includeOldDebt = false; currentMobileStep = 1;
                sessionStorage.removeItem('sales_temp_state');
                render();
            }, "Sí, Cancelar", "No, Volver");
        });"""

if cancel_cart_str in content:
    content = content.replace(cancel_cart_str, cancel_cart_replacement)
    print("Updated cancelCartBtn logic")
else:
    print("Could not find cancelCartBtn block")

with open(sales_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("sales.js successfully modified by python script.")
