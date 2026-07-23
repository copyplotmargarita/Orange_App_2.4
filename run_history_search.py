import os

filepath = r'c:\Users\Admin\.gemini\antigravity-ide\scratch\Orange_App_2.4\js\views\purchases.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Search Input HTML
old_html = """                    <label style="font-size: 0.85rem; color: var(--text-muted); margin: 0; margin-left: 0.5rem;">Hasta:</label>
                    <input type="date" id="filterEndDate" class="form-control" style="width: auto; height: 35px; font-size: 0.85rem; border-radius: 8px;" value="${currentFilterEndDate}">
                </div>
            </div>"""

new_html = """                    <label style="font-size: 0.85rem; color: var(--text-muted); margin: 0; margin-left: 0.5rem;">Hasta:</label>
                    <input type="date" id="filterEndDate" class="form-control" style="width: auto; height: 35px; font-size: 0.85rem; border-radius: 8px;" value="${currentFilterEndDate}">
                    
                    <input type="text" id="historySearchInput" class="form-control" placeholder="🔍 Buscar documento, proveedor..." style="width: 250px; height: 35px; font-size: 0.85rem; border-radius: 8px; margin-left: auto;">
                </div>
            </div>"""

content = content.replace(old_html, new_html)


# 2. Add Event Listener logic
old_js = """        const backBtn = container.querySelector('#backToPurchasesBtn');
        if (backBtn) backBtn.addEventListener('click', goBackToDeck);"""

new_js = """        const backBtn = container.querySelector('#backToPurchasesBtn');
        if (backBtn) backBtn.addEventListener('click', goBackToDeck);
        
        const searchInput = container.querySelector('#historySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                const rows = container.querySelectorAll('.purchase-row');
                
                if (term.length === 1) return; // Wait for at least 2 chars or empty
                
                rows.forEach(row => {
                    if (term.length === 0) {
                        row.style.display = '';
                    } else {
                        const rowText = Array.from(row.children).slice(0, 7).map(td => td.textContent.toLowerCase()).join(' ');
                        if (rowText.includes(term)) {
                            row.style.display = '';
                        } else {
                            row.style.display = 'none';
                        }
                    }
                });
            });
        }"""

content = content.replace(old_js, new_js)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Search bar added to history view.")
