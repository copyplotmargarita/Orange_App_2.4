// refactor_sales.js
function render() {
    if (currentView === 'history') {
        renderHistoryView();
    } else {
        renderSingleView();
    }
}

function renderSingleView() {
    const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
    const taxAmountUSD = taxConfig.enabled ? subtotalUSD * taxConfig.rate / 100 : 0;
    const baseWithTaxUSD = subtotalUSD + taxAmountUSD;
    const effectiveTotalUSD = includeOldDebt ? baseWithTaxUSD + clientDebt : baseWithTaxUSD;
    const totalBs = effectiveTotalUSD * bcvRate;
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    let paidUSD = 0;
    payments.forEach(p => {
        if (p.currency === 'USD') paidUSD += p.amount;
        else paidUSD += p.amount / p.rate;
    });

    const currentRemainingUSD = Math.max(0, effectiveTotalUSD - paidUSD);
    const currentChangeUSD = Math.max(0, paidUSD - effectiveTotalUSD);
    const saleStatus = container.querySelector('#saleStatus')?.value || (payments.length === 0 ? 'contado' : 'abono');

    container.innerHTML = \`
    <div class="app-container text-on-surface bg-background" style="font-family: 'Inter', sans-serif;">
        <!-- Top System Header Bar -->
        <header class="w-full shrink-0 h-10 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-container-margin">
            <div class="flex items-center gap-md">
                <div class="flex items-center gap-sm">
                    <span class="text-label-sm text-primary" id="clockSpan">--:--</span>
                    <span class="text-label-sm text-outline" id="dateSpan">--/--/----</span>
                </div>
                <div class="h-4 w-[1px] bg-outline-variant"></div>
                <div class="flex items-center gap-xs">
                    <span class="text-label-sm text-outline uppercase">Tasa BCV:</span>
                    <span class="text-label-sm font-bold text-secondary">Bs. \${fmt(bcvRate)}</span>
                </div>
            </div>
            <div class="flex items-center gap-sm">
                <button id="backToDashboardBtn" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant text-outline hover:text-primary transition-colors" title="Volver al inicio">
                    <span class="material-symbols-outlined text-[20px]">home</span>
                </button>
                <button id="viewHistoryBtn" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant text-outline hover:text-primary transition-colors" title="Historial">
                    <span class="material-symbols-outlined text-[20px]">history</span>
                </button>
            </div>
        </header>

        <div class="flex flex-1 overflow-hidden">
            <!-- Main Content Area -->
            <main class="flex-1 overflow-y-auto hide-scrollbar bg-surface-dim flex flex-col">
                <section class="flex-1 px-container-margin pt-container-margin pb-sm flex flex-col">
                    <div class="flex mb-md justify-between items-center">
                        <div class="flex items-center gap-sm mr-md">
                            <button id="backToDashboardBtn2" class="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-colors">
                                <span class="material-symbols-outlined">arrow_back</span>
                                <span class="text-label-bold uppercase">Volver</span>
                            </button>
                            <div class="h-4 w-[1px] bg-outline-variant mx-xs"></div>
                            <span class="text-headline-md text-on-surface font-semibold">Ventas</span>
                        </div>
                        <div class="relative flex items-center bg-surface-container-high rounded-xl px-md h-10 border border-outline-variant md:w-96">
                            <span class="material-symbols-outlined text-outline">search</span>
                            <input id="productSearch" class="bg-transparent border-none focus:ring-0 text-body-md w-full ml-sm text-on-surface placeholder-outline" placeholder="Buscar producto..." type="text" value="\${searchProductTerm}">
                        </div>
                    </div>
                    <div id="productList" class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md content-start pb-20">
                        \${renderProductList()}
                    </div>
                </section>
            </main>

            <!-- Right Sidebar (Cart) -->
            <aside class="w-80 lg:w-[400px] xl:w-[450px] bg-surface-container-low border-l border-outline-variant flex flex-col h-full shadow-2xl z-40">
                <div class="p-md border-b border-outline-variant">
                    <h3 class="font-headline-md text-headline-md mb-md text-on-surface">Detalles de Venta</h3>
                    
                    <div class="grid grid-cols-2 gap-sm mb-md">
                        <div class="form-group">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Operación</label>
                            <select id="saleType" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                <option value="venta" \${settings.type === 'venta' ? 'selected' : ''}>Venta</option>
                                <option value="presupuesto" \${settings.type === 'presupuesto' ? 'selected' : ''}>Presupuesto</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Tipo Precio</label>
                            <select id="priceType" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                <option value="precioDetal" \${settings.priceType === 'precioDetal' ? 'selected' : ''}>Detal</option>
                                <option value="precioMayor" \${settings.priceType === 'precioMayor' ? 'selected' : ''}>Mayor</option>
                                <option value="precioSpecial" \${settings.priceType === 'precioSpecial' ? 'selected' : ''}>Especial</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-sm mb-md">
                        <div class="form-group">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Estado de Venta</label>
                            <select id="saleStatus" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" \${settings.type === 'presupuesto' ? 'disabled' : ''}>
                                \${settings.type === 'presupuesto' ? '<option value="presupuesto" selected>PRESUPUESTO</option>' : \`
                                <option value="contado" \${saleStatus === 'contado' ? 'selected' : ''}>Contado</option>
                                <option value="abono" \${saleStatus === 'abono' ? 'selected' : ''}>Abono</option>
                                <option value="credito" \${saleStatus === 'credito' ? 'selected' : ''}>Crédito</option>
                                \`}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Ubicación</label>
                            <select id="saleTarget" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                <option value="tienda" \${settings.target === 'tienda' ? 'selected' : ''}>Tienda</option>
                                <option value="delivery" \${settings.target === 'delivery' ? 'selected' : ''}>Delivery</option>
                                <option value="envio" \${settings.target === 'envio' ? 'selected' : ''}>Envío</option>
                            </select>
                        </div>
                    </div>

                    <div class="mb-md relative">
                        <label class="text-label-bold font-label-bold text-outline uppercase">Cliente</label>
                        <div class="flex items-center gap-sm mt-xs p-sm bg-surface-container-high rounded-lg border border-outline-variant focus-within:border-primary transition-colors group">
                            <span class="material-symbols-outlined text-outline group-focus-within:text-primary">person</span>
                            <div class="flex-1 relative">
                                <input id="clientSearch" class="bg-transparent border-none focus:ring-0 text-body-md font-semibold text-on-surface w-full p-0 outline-none" placeholder="Buscar cliente..." type="text" value="\${selectedClient ? selectedClient.fullName : ''}"/>
                                \${selectedClient ? \`<p class="text-label-sm text-outline mt-1">\${selectedClient.id}</p>\` : ''}
                                <div id="clientResults" class="absolute top-full left-0 right-0 bg-surface border border-outline-variant z-50 max-h-48 overflow-y-auto rounded-lg shadow-xl mt-1 hidden"></div>
                            </div>
                            \${selectedClient ? \`
                            <button id="removeClientBtn" class="material-symbols-outlined text-error cursor-pointer hover:bg-error/10 rounded-full p-1 transition-colors" title="Remover cliente">close</button>
                            \` : \`
                            <button id="createNewClientBtn" class="material-symbols-outlined text-primary cursor-pointer hover:bg-primary/10 rounded-full p-1 transition-colors" title="Crear cliente">person_add</button>
                            \`}
                        </div>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-md hide-scrollbar">
                    <div class="flex justify-between items-center mb-sm">
                        <label class="text-label-bold font-label-bold text-outline uppercase">Carrito</label>
                        \${cart.length > 0 ? '<button id="cancelCartBtn" class="text-error text-label-sm font-bold uppercase hover:underline">Vaciar</button>' : ''}
                    </div>
                    <div class="flex flex-col gap-sm">
                        \${cart.length === 0 ? '<p class="text-outline text-center py-4 text-body-md">El carrito está vacío</p>' : ''}
                        \${cart.map((item, index) => {
                            const prod = products.find(p => p.id === item.id);
                            return \`
                            <div class="flex justify-between items-center p-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors border border-outline-variant group">
                                <div class="flex-1 min-w-0 pr-2">
                                    <p class="text-body-md font-semibold text-on-surface truncate cursor-pointer edit-qty hover:text-primary" data-index="\${index}">\${item.name}</p>
                                    <p class="text-label-sm text-outline">\${item.qty} \${item.sellUnit || 'ud'} x $\${fmt(item.price)}</p>
                                </div>
                                <div class="flex items-center gap-sm">
                                    <p class="font-label-sm text-primary font-bold">$\${fmt(item.total)}</p>
                                    <button class="material-symbols-outlined text-outline hover:text-error transition-colors btn-remove" data-index="\${index}" style="font-size: 18px;">delete</button>
                                </div>
                            </div>
                            \`;
                        }).join('')}
                    </div>
                </div>
            </aside>
        </div>

        <!-- Global Footer Section -->
        <footer class="bg-surface-container border-t border-outline-variant p-md z-50 shrink-0 h-[116px]">
            <div class="flex gap-md h-full items-center">
                <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                    <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">ITEMS</p>
                    <p class="text-display-metrics text-primary" style="font-size: 24px;">\${totalItems}</p>
                </div>
                
                <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm border-l-4 border-l-primary flex flex-col justify-center">
                    <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">TOTAL EN $</p>
                    <p class="text-headline-md font-display-metrics text-primary whitespace-nowrap">$ \${fmt(effectiveTotalUSD)}</p>
                </div>
                
                <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                    <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">TOTAL EN BS</p>
                    <p class="text-headline-md font-display-metrics text-primary whitespace-nowrap leading-tight text-[18px]">Bs \${fmt(totalBs)}</p>
                </div>
                
                <div id="pullDebtBtn" class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm border-l-4 \${clientDebt > 0 ? 'border-l-error cursor-pointer hover:bg-error/10' : 'border-l-outline'} flex flex-col justify-center transition-colors">
                    <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">DEUDA CLIENTE \${includeOldDebt ? '(CARGADA)' : ''}</p>
                    <p class="text-headline-md font-display-metrics \${clientDebt > 0 && !includeOldDebt ? 'text-error' : 'text-on-surface'} whitespace-nowrap">$ \${fmt(clientDebt)}</p>
                </div>
                
                <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                    <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">ENTREGADO</p>
                    <div class="flex flex-col">
                        <p class="text-body-lg font-bold text-primary">$ \${fmt(paidUSD)}</p>
                        <p class="text-label-sm text-outline">Bs \${fmt(paidUSD * bcvRate)}</p>
                    </div>
                </div>
                
                <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center border-l-4 border-l-secondary">
                    <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">\${currentChangeUSD > 0 ? 'VUELTO' : 'RESTA'}</p>
                    <div class="flex flex-col">
                        <p class="text-body-lg font-bold \${currentChangeUSD > 0 ? 'text-secondary' : 'text-error'}">$ \${currentChangeUSD > 0 ? fmt(currentChangeUSD) : fmt(currentRemainingUSD)}</p>
                        <p class="text-label-sm \${currentChangeUSD > 0 ? 'text-secondary' : 'text-error'}">Bs \${currentChangeUSD > 0 ? fmt(currentChangeUSD * bcvRate) : fmt(currentRemainingUSD * bcvRate)}</p>
                    </div>
                </div>
                
                <button id="openPaymentModalBtn" class="flex-1 h-full bg-primary text-white rounded-lg font-bold uppercase tracking-wider text-body-md hover:bg-primary/90 transition-all shadow-lg active:scale-[0.98]" \${settings.type === 'presupuesto' ? 'disabled style="opacity:0.5"' : ''}>CARGAR PAGO</button>
                <button id="finishBtn" class="flex-1 h-full border-2 border-primary text-primary rounded-lg font-bold uppercase tracking-wider text-body-md hover:bg-primary/10 transition-all shadow-sm active:scale-[0.98]">\${settings.type === 'presupuesto' ? 'PRESUPUESTO' : 'FINALIZAR'}</button>
            </div>
        </footer>

        <!-- Toast Notification -->
        <div id="toast" class="fixed bottom-container-margin left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-lg py-md rounded-xl shadow-2xl flex items-center gap-md transform translate-y-32 transition-transform duration-300 z-[100]">
            <span class="material-symbols-outlined text-secondary">check_circle</span>
            <span id="toastMsg" class="font-body-lg">Acción completada</span>
        </div>
    </div>
    \`;

    // Clock and Date
    const clockSpan = container.querySelector('#clockSpan');
    const dateSpan = container.querySelector('#dateSpan');
    if (clockSpan && dateSpan) {
        const now = new Date();
        clockSpan.textContent = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
        dateSpan.textContent = now.toLocaleDateString('es-VE');
    }

    // Bind events
    const navHomeLogic = () => {
        const navHome = document.getElementById('navHome');
        if (navHome) {
            navHome.click();
            const toggleIcon = document.getElementById('toggleIcon');
            if (toggleIcon && toggleIcon.innerText === '▶') document.getElementById('sidebarToggle')?.click();
        } else {
            window.location.hash = '#dashboard';
        }
    };
    container.querySelector('#backToDashboardBtn')?.addEventListener('click', navHomeLogic);
    container.querySelector('#backToDashboardBtn2')?.addEventListener('click', navHomeLogic);

    container.querySelector('#viewHistoryBtn')?.addEventListener('click', () => {
        currentView = 'history';
        render();
    });

    container.querySelector('#productSearch').addEventListener('input', (e) => {
        searchProductTerm = e.target.value.toLowerCase();
        container.querySelector('#productList').innerHTML = renderProductList();
        attachProductClickEvents();
    });

    container.querySelector('#saleType').addEventListener('change', (e) => { settings.type = e.target.value; render(); });
    container.querySelector('#saleTarget').addEventListener('change', (e) => { settings.target = e.target.value; render(); });
    container.querySelector('#priceType').addEventListener('change', (e) => {
        settings.priceType = e.target.value;
        cart = cart.map(item => {
            const prod = products.find(p => p.id === item.id);
            const newPrice = getPrice(prod);
            return { ...item, price: newPrice, total: newPrice * item.qty };
        });
        render();
    });
    container.querySelector('#saleStatus')?.addEventListener('change', (e) => {
        render();
    });

    container.querySelector('#pullDebtBtn')?.addEventListener('click', () => {
        if (clientDebt > 0 && !includeOldDebt) {
            showConfirmModal("Cargar Deuda Previa", \`¿Desea agregar la deuda de $\${fmt(clientDebt)} a esta cuenta?\`, () => {
                includeOldDebt = true;
                render();
            }, "Sí, Cargar", "Cancelar");
        }
    });

    container.querySelector('#cancelCartBtn')?.addEventListener('click', () => {
        showConfirmModal("Cancelar Venta", "¿Está seguro que desea cancelar esta venta y vaciar el carrito?", () => {
            cart = []; payments = []; selectedClient = null; clientDebt = 0; includeOldDebt = false;
            sessionStorage.removeItem('sales_temp_state');
            render();
        }, "Sí, Cancelar", "No, Volver");
    });

    // Client search logic
    const clientSearch = container.querySelector('#clientSearch');
    const clientResults = container.querySelector('#clientResults');
    if (clientSearch) {
        clientSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            if (term.length < 2) {
                clientResults.style.display = 'none';
                return;
            }
            const filtered = clients.filter(c => 
                (c.fullName && c.fullName.toLowerCase().includes(term)) ||
                (c.id && c.id.toLowerCase().includes(term)) ||
                (c.phone && c.phone.includes(term))
            );
            
            clientResults.innerHTML = filtered.map(c => \`
                <div class="client-option p-sm hover:bg-surface-variant cursor-pointer border-b border-outline-variant last:border-0" data-id="\${c.id}">
                    <p class="font-bold text-on-surface">\${c.fullName}</p>
                    <p class="text-label-sm text-outline">\${c.id} | \${c.phone || 'Sin tel.'}</p>
                </div>
            \`).join('');
            
            clientResults.style.display = filtered.length > 0 ? 'block' : 'none';
            
            container.querySelectorAll('.client-option').forEach(opt => {
                opt.addEventListener('click', async () => {
                    const selected = clients.find(c => c.id === opt.dataset.id);
                    selectedClient = selected;
                    clientSearch.value = selected.fullName;
                    clientResults.style.display = 'none';
                    clientDebt = await calculateClientDebt(selected.id);
                    render();
                });
            });
        });

        // Hide results on outside click
        document.addEventListener('click', (e) => {
            if (clientResults && !clientSearch.contains(e.target) && !clientResults.contains(e.target)) {
                clientResults.style.display = 'none';
            }
        });
    }

    container.querySelector('#removeClientBtn')?.addEventListener('click', () => {
        selectedClient = null;
        clientDebt = 0;
        includeOldDebt = false;
        render();
    });

    container.querySelector('#createNewClientBtn')?.addEventListener('click', () => {
        const currentSearch = clientSearch.value;
        sessionStorage.setItem('sales_temp_state', JSON.stringify({ cart, payments, currentView: 'cart' }));
        renderClients(container, (newClient) => {
            renderSales(container, newClient);
        }, currentSearch);
    });

    attachProductClickEvents();

    container.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            cart.splice(parseInt(btn.dataset.index), 1);
            render();
        });
    });

    container.querySelectorAll('.edit-qty').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            const item = cart[index];
            const prod = products.find(p => p.id === item.id);
            const stock = prod ? (prod.stockGeneral ?? prod.stock ?? 0) : 999999;
            showQuantityModal(item.name, (newQty) => {
                item.qty = parseFloat(newQty);
                item.total = item.qty * item.price;
                render();
            }, item.qty, stock);
        });
    });

    container.querySelector('#openPaymentModalBtn')?.addEventListener('click', () => {
        if (!selectedClient && settings.type !== 'presupuesto') {
            showToast("Debe seleccionar un cliente primero", true);
            return;
        }
        showPaymentModal(currentRemainingUSD);
    });

    container.querySelector('#finishBtn').addEventListener('click', () => {
        if (!selectedClient) {
            showToast("Debe seleccionar un cliente primero", true);
            return;
        }
        const status = container.querySelector('#saleStatus')?.value || 'contado';
        if ((status === 'contado' || status === 'abono') && payments.length === 0 && settings.type !== 'presupuesto') {
            showToast("Debe registrar al menos un pago", true);
            return;
        }
        processSale(currentRemainingUSD);
    });
}

function showPaymentModal(remainingUSD) {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-md animate-in fade-in";
    
    // Default currency to what was used last or BS
    const amountBS = remainingUSD * bcvRate;
    
    modal.innerHTML = \`
        <div class="bg-surface-container border border-outline-variant rounded-xl w-full max-w-lg p-lg shadow-2xl flex flex-col gap-md">
            <div class="flex justify-between items-center border-b border-outline-variant pb-sm">
                <h3 class="text-headline-md font-bold text-primary">Cargar Pago</h3>
                <button id="closePayModal" class="material-symbols-outlined text-outline hover:text-error transition-colors">close</button>
            </div>
            
            <div class="grid grid-cols-2 gap-md">
                <div class="form-group">
                    <label class="text-label-bold font-label-bold text-outline uppercase">Moneda</label>
                    <select id="payCurrency" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                        <option value="BS" \${activePayCurrency === 'BS' ? 'selected' : ''}>Bolívares (Bs)</option>
                        <option value="USD" \${activePayCurrency === 'USD' ? 'selected' : ''}>Dólares ($)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="text-label-bold font-label-bold text-outline uppercase">Método</label>
                    <select id="payMethod" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                    </select>
                </div>
                <div class="form-group">
                    <label class="text-label-bold font-label-bold text-outline uppercase">Monto</label>
                    <input type="text" id="payAmount" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" value="">
                </div>
                <div class="form-group" id="payRefGroup" style="display: none;">
                    <label class="text-label-bold font-label-bold text-outline uppercase">Referencia</label>
                    <input type="text" id="payRef" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" placeholder="Ej. 1234">
                </div>
            </div>
            
            <div class="mt-sm">
                <h4 class="text-label-sm uppercase text-outline mb-xs border-b border-outline-variant pb-xs">Pagos Actuales</h4>
                <div id="paymentsList" class="flex flex-col gap-xs max-h-32 overflow-y-auto hide-scrollbar">
                    \${payments.length === 0 ? '<p class="text-body-md text-outline text-center py-2">Ninguno</p>' : ''}
                </div>
            </div>

            <div class="flex gap-md mt-sm pt-md border-t border-outline-variant">
                <button id="addPaymentBtn" class="flex-1 bg-surface-variant text-primary border border-primary rounded-lg font-bold py-2 hover:bg-primary/10 transition-colors">AÑADIR PAGO</button>
                <button id="donePayBtn" class="flex-1 bg-primary text-white rounded-lg font-bold py-2 hover:bg-primary/90 transition-colors">LISTO</button>
            </div>
        </div>
    \`;
    
    document.body.appendChild(modal);

    const payCurrency = modal.querySelector('#payCurrency');
    const payMethod = modal.querySelector('#payMethod');
    const payAmount = modal.querySelector('#payAmount');
    const payRefGroup = modal.querySelector('#payRefGroup');
    const payRef = modal.querySelector('#payRef');
    const paymentsList = modal.querySelector('#paymentsList');

    const renderPaymentsList = () => {
        if(payments.length === 0) {
            paymentsList.innerHTML = '<p class="text-body-md text-outline text-center py-2">Ninguno</p>';
            return;
        }
        paymentsList.innerHTML = payments.map((p, i) => \`
            <div class="flex justify-between items-center p-xs bg-surface-container-highest rounded border border-outline-variant">
                <span class="text-label-sm font-bold">\${p.method.replace('_', ' ')} \${p.ref ? '(#'+p.ref+')' : ''}</span>
                <div class="flex items-center gap-sm">
                    <span class="text-label-sm text-primary font-bold">\${p.currency} \${fmt(p.amount)}</span>
                    <button class="material-symbols-outlined text-error hover:text-error/80 text-[18px] btn-rem-pay" data-index="\${i}">close</button>
                </div>
            </div>
        \`).join('');
        
        modal.querySelectorAll('.btn-rem-pay').forEach(b => {
            b.onclick = () => {
                payments.splice(parseInt(b.dataset.index), 1);
                renderPaymentsList();
                // update original remaining
                let paid = 0;
                payments.forEach(px => paid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
                const newRem = Math.max(0, (includeOldDebt ? remainingUSD : remainingUSD) - paid);
                updatePayMethods(newRem);
            };
        });
    };

    const updatePayMethods = (currRem) => {
        const currency = payCurrency.value;
        if (currency === 'USD') {
            payMethod.innerHTML = \`<option value="EFECTIVO">Efectivo ($)</option><option value="ZELLE">Zelle</option><option value="BINANCE">Binance</option><option value="PAYPAL">PayPal</option>\`;
        } else {
            payMethod.innerHTML = \`<option value="PAGO_MOVIL">Pago Móvil</option><option value="PUNTO">Punto de Venta</option><option value="EFECTIVO">Efectivo (Bs)</option><option value="TRANSFERENCIA">Transferencia</option>\`;
        }
        
        const isElectronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(payMethod.value);
        payRefGroup.style.display = isElectronic ? 'block' : 'none';
        
        const amount = currency === 'BS' ? (currRem * bcvRate) : currRem;
        payAmount.value = (Math.max(0, amount)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    payCurrency.onchange = () => {
        activePayCurrency = payCurrency.value;
        let paid = 0;
        payments.forEach(px => paid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
        const rem = Math.max(0, remainingUSD - paid);
        updatePayMethods(rem);
    };

    payMethod.onchange = () => {
        const isElectronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(payMethod.value);
        payRefGroup.style.display = isElectronic ? 'block' : 'none';
    };

    // input mask
    payAmount.oninput = (e) => {
        let value = e.target.value.replace(/\\D/g, ''); 
        if (!value) { e.target.value = ''; return; }
        let number = parseInt(value, 10);
        e.target.value = (number / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    payAmount.onfocus = (e) => { if (e.target.value === '0,00') e.target.value = ''; };
    payAmount.onblur = (e) => { if (!e.target.value) e.target.value = '0,00'; };

    const parseNum = (val) => parseFloat(val.toString().replace(/\\./g, '').replace(',', '.')) || 0;

    modal.querySelector('#addPaymentBtn').onclick = () => {
        const amount = parseNum(payAmount.value);
        if (amount <= 0) return;
        const method = payMethod.value;
        const isElectronic = ['PAGO_MOVIL', 'TRANSFERENCIA', 'ZELLE', 'PAYPAL', 'BINANCE'].includes(method);
        if (isElectronic && !payRef.value) {
            alert("Referencia es requerida");
            return;
        }
        
        payments.push({
            method,
            currency: payCurrency.value,
            amount,
            ref: payRef.value || null,
            rate: payCurrency.value === 'BS' ? bcvRate : 1,
            timestamp: new Date().toISOString()
        });
        
        payRef.value = '';
        renderPaymentsList();
        
        let paid = 0;
        payments.forEach(px => paid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
        const rem = Math.max(0, remainingUSD - paid);
        updatePayMethods(rem);
    };

    modal.querySelector('#closePayModal').onclick = () => { modal.remove(); render(); };
    modal.querySelector('#donePayBtn').onclick = () => { modal.remove(); render(); };

    renderPaymentsList();
    let initialPaid = 0;
    payments.forEach(px => initialPaid += (px.currency === 'USD' ? px.amount : px.amount / px.rate));
    updatePayMethods(Math.max(0, remainingUSD - initialPaid));
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const icon = toast.querySelector('.material-symbols-outlined');
    if(toast && toastMsg) {
        toastMsg.textContent = message;
        if(isError) {
            toast.classList.replace('bg-inverse-surface', 'bg-error-container');
            toast.classList.replace('text-inverse-on-surface', 'text-on-error-container');
            icon.textContent = 'error';
            icon.classList.replace('text-secondary', 'text-error');
        } else {
            toast.classList.replace('bg-error-container', 'bg-inverse-surface');
            toast.classList.replace('text-on-error-container', 'text-inverse-on-surface');
            icon.textContent = 'check_circle';
            icon.classList.replace('text-error', 'text-secondary');
        }
        
        toast.classList.remove('translate-y-32');
        toast.classList.add('translate-y-0');
        setTimeout(() => {
            toast.classList.add('translate-y-32');
            toast.classList.remove('translate-y-0');
        }, 3000);
    } else {
        showNotification(message); // fallback
    }
}
