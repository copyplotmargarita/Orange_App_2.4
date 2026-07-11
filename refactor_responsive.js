const fs = require('fs');
const path = require('path');

const salesFile = path.join(__dirname, 'js', 'views', 'sales.js');
let content = fs.readFileSync(salesFile, 'utf8');

// Replace activeMobileTab with currentMobileStep
content = content.replace(
    /let activeMobileTab = 'products'; \/\/ 'products' or 'cart'/,
    "let currentMobileStep = 1;\n    let activeMobileTab = 'products';"
);

// Define the new renderSingleView block
const newRenderSingleView = `    function renderSingleView() {
        const subtotalUSD = cart.reduce((sum, item) => sum + item.total, 0);
        const taxAmountUSD = taxConfig.enabled ? subtotalUSD * taxConfig.rate / 100 : 0;
        const baseWithTaxUSD = subtotalUSD + taxAmountUSD;
        const effectiveTotalUSD = includeOldDebt ? baseWithTaxUSD + clientDebt : baseWithTaxUSD;
        const totalBs = effectiveTotalUSD * bcvRate;
        const totalItems = cart.length;
        let netPaidUSD = 0;
        let grossPaidUSD = 0;
        let actualDeliveredUSD = 0;
        let actualDeliveredBS = 0;
        let actualVueltoUSD = 0;
        let actualVueltoBS = 0;
        
        payments.forEach(p => {
            const amountInUSD = p.currency === 'USD' ? p.amount : p.amount / p.rate;
            netPaidUSD += amountInUSD;
            if (amountInUSD > 0) {
                grossPaidUSD += amountInUSD;
            }
            if (p.amount > 0) {
                if (p.currency === 'USD') actualDeliveredUSD += p.amount;
                else actualDeliveredBS += p.amount;
            } else if (p.amount < 0) {
                if (p.currency === 'USD') actualVueltoUSD += Math.abs(p.amount);
                else actualVueltoBS += Math.abs(p.amount);
            }
        });

        const currentRemainingUSD = Math.max(0, effectiveTotalUSD - netPaidUSD);
        const currentChangeUSD = Math.max(0, netPaidUSD - effectiveTotalUSD);
        const isVueltoPending = currentChangeUSD > 0.009;
        const isRestaPending = currentRemainingUSD > 0.009;
        const isFullyPaid = !isVueltoPending && !isRestaPending;
        const saleStatus = container.querySelector('#saleStatus')?.value || (payments.length === 0 ? 'contado' : 'abono');

        // Responsive classes logic
        const isMobileStep1 = currentMobileStep === 1 ? 'block' : 'hidden lg:block';
        const isMobileStep2 = currentMobileStep === 2 ? 'flex' : 'hidden lg:flex';
        const isMobileStep3 = currentMobileStep === 3 ? 'flex' : 'hidden lg:flex';
        const isMobileStep4 = currentMobileStep === 4 ? 'block' : 'hidden lg:block';

        const mainIsVisible = currentMobileStep === 2 ? 'flex' : 'hidden lg:flex';
        const asideIsVisible = currentMobileStep !== 2 ? 'flex' : 'hidden lg:flex';

        container.innerHTML = \`
        <div class="app-container h-full flex flex-col text-on-surface bg-background" style="font-family: 'Inter', sans-serif;">
            <div class="flex flex-1 overflow-hidden">
                <!-- Main Content Area -->
                <main class="flex-1 overflow-hidden bg-surface-dim \${mainIsVisible} flex-col">
                    <section class="flex-1 flex flex-col overflow-hidden">
                        <div class="flex px-container-margin pt-sm pb-sm mb-sm justify-between items-center shrink-0" style="min-height: 60px;">
                            <div class="flex items-center flex-stack-mobile" style="gap: 1.5rem; flex: 1;">
                                <button id="backToDashboardBtn2" class="btn btn-outline flex-shrink-0" style="height: 38px; width: auto; font-size: 0.85rem; padding: 0 1rem; white-space: nowrap;">← Volver</button>
                                <h2 class="flex-shrink-0" style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 0; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem;">🛒 Ventas</h2>
                                <button id="viewHistoryBtn" class="btn btn-primary" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; margin-left: 0.5rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">calendar_today</span>
                                    Ventas del Día
                                </button>
                                <button id="viewBudgetsBtn" class="btn btn-outline" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; margin-left: 0.5rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">request_quote</span>
                                    Presupuestos
                                </button>
                                <button id="viewOrdersBtn" class="btn btn-outline" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; margin-left: 0.5rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">package</span>
                                    Pedidos
                                </button>
                            </div>
                            <div class="relative flex items-center bg-surface-container-high rounded-xl px-md h-10 border border-outline-variant md:w-96">
                                <span class="material-symbols-outlined text-outline">search</span>
                                <input id="productSearch" class="bg-transparent border-none focus:ring-0 text-body-md w-full ml-sm text-on-surface placeholder-outline" placeholder="Buscar producto..." type="text" value="\${searchProductTerm}">
                            </div>
                        </div>
                        <div id="productList" class="flex-1 overflow-y-auto px-container-margin pb-20">
                            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-md content-start">
                                \${renderProductList()}
                            </div>
                        </div>
                    </section>
                </main>

                <!-- Right Sidebar (Cart) -->
                <aside class="w-full lg:w-[400px] xl:w-[450px] bg-surface-container-low border-l border-outline-variant \${asideIsVisible} flex-col h-full shadow-2xl z-40">
                    
                    <!-- PASO 1: Configuración de Venta -->
                    <div class="p-md border-b border-outline-variant \${isMobileStep1}">
                        <div class="flex justify-between items-center mb-md">
                            <h3 class="font-headline-md text-headline-md text-on-surface m-0">Detalles de Venta</h3>
                            <div class="flex gap-2">
                                <button id="pauseSaleBtn" class="btn btn-primary" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">pause</span>
                                    <span>Pausar</span>
                                </button>
                                <button id="recoverSaleBtn" class="btn btn-primary" style="width: auto; flex: none; font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 1rem; font-size: 0.85rem; gap: 0.4rem;">
                                    <span class="material-symbols-outlined" style="font-size: 16px;">folder_open</span>
                                    <span>Recuperar</span>
                                </button>
                            </div>
                        </div>
                    
                        <div class="grid grid-cols-2 gap-sm mb-md">
                            <div class="form-group">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Operación</label>
                                <select id="saleType" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                    <option value="venta" \${settings.type === 'venta' ? 'selected' : ''}>Venta</option>
                                    <option value="presupuesto" \${settings.type === 'presupuesto' ? 'selected' : ''}>Presupuesto</option>
                                    <option value="pedido" \${settings.type === 'pedido' ? 'selected' : ''}>Pedidos</option>
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
                                <label class="text-label-bold font-label-bold text-outline uppercase">Tipo de Venta</label>
                                <select id="saleTarget" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                    <option value="mayor" \${settings.target === 'mayor' ? 'selected' : ''}>Mayor</option>
                                    <option value="detal" \${settings.target === 'detal' ? 'selected' : ''}>Detal</option>
                                </select>
                            </div>
                        </div>

                        \${settings.type === 'pedido' ? \`
                        <div class="mb-md relative">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Fecha de Entrega</label>
                            <input type="text" id="deliveryDateInput" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" value="\${deliveryDate}">
                        </div>\` : ''}
                    </div>

                    <!-- PASO 3: Carrito -->
                    <div class="flex-1 overflow-y-auto p-md \${isMobileStep3}">
                        <div class="flex justify-between items-center mb-sm">
                            <label class="text-label-bold font-label-bold text-outline uppercase">Carrito</label>
                            \${cart.length > 0 ? '<button id="cancelCartBtn" class="text-error text-label-sm font-bold uppercase hover:underline">Vaciar</button>' : ''}
                        </div>
                        <div class="flex flex-col gap-sm">
                            \${cart.length === 0 ? '<p class="text-outline text-center py-4 text-body-md">El carrito está vacío</p>' : ''}
                            \${cart.map((item, index) => {
                                const prod = products.find(p => p.id === item.id);
                                return \`
                                <div class="flex justify-between items-center p-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors border border-outline-variant group cursor-pointer edit-qty" data-index="\${index}">
                                    <div class="flex-1 min-w-0 pr-2">
                                        <p class="text-body-md font-semibold text-on-surface truncate group-hover:text-primary">\${item.name}</p>
                                        <p class="text-label-sm text-outline">
                                            \${Number(Number(item.qty).toFixed(3))} \${item.sellUnit || 'ud'}
                                            \${(item.unitContent && item.unitContent > 1) ? \` x \${item.unitContent} \${item.baseUnit || 'ud'} \` : ''}
                                            x $ \${fmt(item.price)}
                                        </p>
                                        \${(item.extras && item.extras.length > 0) ? \`
                                            <p class="text-label-sm text-primary mt-1 font-bold">
                                                + Extras: \${item.extras.map(e => \`\${e.name} ($\${fmt(e.price)})\`).join(', ')}
                                            </p>
                                        \` : ''}
                                    </div>
                                    <div class="flex items-center gap-sm">
                                        <p class="font-label-sm text-primary font-bold">$ \${fmt(item.total)}</p>
                                        <button class="material-symbols-outlined text-outline hover:text-error transition-colors btn-remove" data-index="\${index}" style="font-size: 18px;">delete</button>
                                    </div>
                                </div>
                                \`;
                            }).join('')}
                            \${includeOldDebt ? \`
                            <div class="flex justify-between items-center p-sm rounded-lg bg-error/10 border border-error/30">
                                <div class="flex-1 min-w-0 pr-2">
                                    <p class="text-body-md font-bold text-error truncate">DEUDA PENDIENTE</p>
                                    <p class="text-label-sm text-error/80">Referencial (No facturable)</p>
                                </div>
                                <div class="flex items-center gap-sm">
                                    <p class="font-label-sm text-error font-bold">$ \${fmt(clientDebt)}</p>
                                    <button class="material-symbols-outlined text-error/80 hover:text-error transition-colors btn-remove-debt" style="font-size: 18px;">delete</button>
                                </div>
                            </div>
                            \` : ''}
                        </div>
                    </div>

                    <!-- PASO 4: Finalizar (Cliente, Pago, Referencias) -->
                    <div class="p-md border-t border-outline-variant bg-surface-container-low \${isMobileStep4}">
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

                        <!-- Info de pagos ingresados -->
                        <div class="bg-surface border border-outline-variant rounded-lg p-sm mt-sm">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-label-sm font-bold text-outline">PAGADO ($)</span>
                                <span class="text-body-md font-bold text-green-400">$ \${fmt(netPaidUSD)}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-label-sm font-bold text-outline">RESTA ($)</span>
                                <span class="text-body-md font-bold text-red-400">$ \${fmt(currentRemainingUSD)}</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            <!-- Global Footer Section -->
            <footer class="bg-surface-container border-t border-outline-variant p-md z-50 shrink-0 h-[116px] lg:h-[116px] \${currentMobileStep === 2 ? 'h-auto py-sm' : ''}">
                <!-- DESKTOP FOOTER -->
                <div class="hidden lg:flex gap-md h-full items-center">
                    <!-- 1. ITEMS -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">ITEMS</p>
                        <p class="text-display-metrics text-white" style="font-size: 24px;">\${totalItems}</p>
                    </div>

                    <!-- 2. RESTA / VUELTO -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center border-l-4 \${(isVueltoPending || isFullyPaid) ? 'border-l-green-400' : 'border-l-red-500'}">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">\${isVueltoPending ? 'VUELTO' : 'RESTA'}</p>
                        <div class="flex flex-col">
                            <p class="text-body-lg font-bold \${(isVueltoPending || isFullyPaid) ? 'text-green-400' : 'text-red-500'} leading-tight">$ \${isVueltoPending ? fmt(currentChangeUSD) : fmt(currentRemainingUSD)}</p>
                            <p class="text-body-lg font-bold \${(isVueltoPending || isFullyPaid) ? 'text-green-400' : 'text-red-500'} leading-tight">Bs \${isVueltoPending ? fmt(currentChangeUSD * bcvRate) : fmt(currentRemainingUSD * bcvRate)}</p>
                        </div>
                    </div>

                    <!-- 3. VUELTOS (Delivered back) -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">VUELTOS</p>
                        <div class="flex flex-col">
                            <p class="text-body-lg font-bold text-green-400 leading-tight">$ \${fmt(actualVueltoUSD)}</p>
                            <p class="text-body-lg font-bold text-green-400 leading-tight">Bs \${fmt(actualVueltoBS)}</p>
                        </div>
                    </div>
                
                    <!-- 4. ENTREGADO -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">ENTREGADO</p>
                        <div class="flex flex-col">
                            <p class="text-body-lg font-bold text-white leading-tight">$ \${fmt(actualDeliveredUSD)}</p>
                            <p class="text-body-lg font-bold text-white leading-tight">Bs \${fmt(actualDeliveredBS)}</p>
                        </div>
                    </div>

                    <!-- 5. DEUDA CLIENTE -->
                    <div id="pullDebtBtn" class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm border-l-4 \${clientDebt > 0 ? 'border-l-error cursor-pointer hover:bg-error/10' : 'border-l-outline'} flex flex-col justify-center transition-colors">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">DEUDA CLIENTE \${includeOldDebt ? '(CARGADA)' : ''}</p>
                        <p class="text-headline-md font-display-metrics \${clientDebt > 0 ? 'animate-pulse-text-red' : 'text-white'} whitespace-nowrap">$ \${fmt(clientDebt)}</p>
                    </div>

                    <!-- 6. TOTAL EN BS -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">TOTAL EN BS</p>
                        <p class="text-headline-md font-display-metrics text-white whitespace-nowrap leading-tight text-[18px]">Bs \${fmt(totalBs)}</p>
                    </div>

                    <!-- 7. TOTAL EN $ -->
                    <div class="flex-1 h-full bg-surface-container-lowest border border-outline-variant rounded-xl px-md py-sm shadow-sm border-l-4 border-l-primary flex flex-col justify-center">
                        <p class="text-label-bold text-on-surface-variant uppercase tracking-wider text-[10px] mb-xs">TOTAL EN $</p>
                        <p class="text-headline-md font-display-metrics text-white whitespace-nowrap">$ \${fmt(effectiveTotalUSD)}</p>
                    </div>
                
                    <!-- 8. CARGAR PAGO -->
                    <button id="openPaymentModalBtn" class="flex-2 h-full border-2 border-primary text-primary bg-transparent rounded-lg font-bold uppercase tracking-wider text-body-md hover:bg-primary/10 transition-all shadow-sm active:scale-[0.98] focus:bg-primary focus:text-white focus:outline-none" style="min-width: 140px;" \${settings.type === 'presupuesto' ? 'disabled style="opacity:0.5"' : ''}>CARGAR PAGO</button>
                    <!-- 9. FINALIZAR -->
                    <button id="finishBtn" class="flex-2 h-full border-2 border-primary text-primary bg-transparent rounded-lg font-bold uppercase tracking-wider text-body-md hover:bg-primary/10 transition-all shadow-sm active:scale-[0.98] focus:bg-primary focus:text-white focus:outline-none" style="min-width: 140px;">\${settings.type === 'presupuesto' ? 'PRESUPUESTO' : 'FINALIZAR'}</button>
                </div>

                <!-- MOBILE FOOTER -->
                <div class="flex lg:hidden gap-sm h-full items-center justify-between">
                    \${currentMobileStep === 1 ? \`
                        <div class="flex-1 flex justify-end">
                            <button id="btnNextStep1" class="btn btn-primary w-full py-4 text-lg font-bold rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                                SIGUIENTE <span class="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>
                    \` : ''}
                    
                    \${currentMobileStep === 2 ? \`
                        <div class="flex-1 flex flex-col">
                            <span class="text-label-sm text-outline">TOTAL VENTA</span>
                            <span class="text-headline-md font-bold text-white">$ \${fmt(effectiveTotalUSD)}</span>
                        </div>
                        <button id="btnNextStep2" class="btn btn-primary py-3 px-6 text-md font-bold rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            IR A CARRITO <span class="material-symbols-outlined">shopping_cart</span>
                        </button>
                    \` : ''}

                    \${currentMobileStep === 3 ? \`
                        <button id="btnPrevStep3" class="btn btn-outline py-3 px-4 font-bold rounded-xl flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined">arrow_back</span> Atrás
                        </button>
                        <div class="flex-1 flex flex-col items-end mr-4">
                            <span class="text-label-sm text-outline">TOTAL ($)</span>
                            <span class="text-headline-md font-bold text-white">$ \${fmt(effectiveTotalUSD)}</span>
                        </div>
                        <button id="btnNextStep3" class="btn btn-primary py-3 px-6 font-bold rounded-xl flex items-center justify-center gap-2">
                            CONTINUAR <span class="material-symbols-outlined">arrow_forward</span>
                        </button>
                    \` : ''}

                    \${currentMobileStep === 4 ? \`
                        <button id="btnPrevStep4" class="btn btn-outline py-3 px-4 font-bold rounded-xl flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined">arrow_back</span> Atrás
                        </button>
                        <button id="openPaymentModalBtnMobile" class="btn border-2 border-primary text-primary hover:bg-primary/10 py-3 px-4 font-bold rounded-xl flex items-center justify-center gap-2" \${settings.type === 'presupuesto' ? 'disabled style="opacity:0.5"' : ''}>
                            CARGAR PAGO
                        </button>
                        <button id="finishBtnMobile" class="btn btn-primary py-3 px-4 font-bold rounded-xl flex-1 flex items-center justify-center gap-2">
                            \${settings.type === 'presupuesto' ? 'PRESUPUESTO' : 'FINALIZAR'}
                        </button>
                    \` : ''}
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
            historyFilter = 'ventas';
            currentView = 'history';
            render();
        });

        container.querySelector('#viewBudgetsBtn')?.addEventListener('click', () => {
            historyFilter = 'presupuestos';
            currentView = 'history';
            render();
        });

        container.querySelector('#viewOrdersBtn')?.addEventListener('click', () => {
            currentView = 'orders';
            render();
        });

        // Mobile Nav events
        container.querySelector('#btnNextStep1')?.addEventListener('click', () => { currentMobileStep = 2; render(); });
        container.querySelector('#btnNextStep2')?.addEventListener('click', () => { currentMobileStep = 3; render(); });
        container.querySelector('#btnPrevStep3')?.addEventListener('click', () => { currentMobileStep = 2; render(); });
        container.querySelector('#btnNextStep3')?.addEventListener('click', () => { currentMobileStep = 4; render(); });
        container.querySelector('#btnPrevStep4')?.addEventListener('click', () => { currentMobileStep = 3; render(); });

        const searchInput = container.querySelector('#productSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const rawVal = e.target.value.toLowerCase();
                
                // Atajo para Cliente
                if (rawVal === 'cc') {
                    e.target.value = '';
                    searchProductTerm = '';
                    const clientInput = container.querySelector('#clientSearch');
                    if (clientInput) {
                        clientInput.focus();
                        clientInput.select();
                    }
                    return; // Detenemos la búsqueda
                }
                
                // Atajo para Pagar
                if (rawVal === 'pp') {
                    e.target.value = '';
                    searchProductTerm = '';
                    const payBtn = container.querySelector('#openPaymentModalBtn');
                    if (payBtn) payBtn.focus();
                    return;
                }
                
                // Atajo para Finalizar
                if (rawVal === 'ff') {
                    e.target.value = '';
                    searchProductTerm = '';
                    const processBtn = container.querySelector('#finishBtn');
                    if (processBtn && !processBtn.disabled) processBtn.focus();
                    return;
                }

                searchProductTerm = rawVal;
                const productListWrapper = container.querySelector('#productList');
                if (productListWrapper) {
                    productListWrapper.innerHTML = \`
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-md content-start">
                            \${renderProductList()}
                        </div>
                    \`;
                }
                attachProductClickEvents();
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const firstCard = container.querySelector('.product-card');
                    if (firstCard) firstCard.focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstCard = container.querySelector('.product-card');
                    if (firstCard) firstCard.click();
                }
            });
            
            // Auto-focus on render (only desktop or step 2)
            setTimeout(() => {
                if (document.activeElement !== searchInput && (window.innerWidth >= 1024 || currentMobileStep === 2)) {
                    searchInput.focus();
                    const val = searchInput.value;
                    searchInput.value = '';
                    searchInput.value = val;
                }
            }, 50);
        }

        container.querySelector('#pauseSaleBtn')?.addEventListener('click', pauseCurrentSale);
        container.querySelector('#recoverSaleBtn')?.addEventListener('click', showPausedSalesModal);

        container.querySelector('#saleType')?.addEventListener('change', (e) => { settings.type = e.target.value; render(); });
        container.querySelector('#saleTarget')?.addEventListener('change', (e) => { settings.target = e.target.value; render(); });
        if (typeof flatpickr !== 'undefined' && container.querySelector('#deliveryDateInput')) {
            const parts = deliveryDate.split('-');
            const defDate = new Date(parts[0], parts[1] - 1, parts[2]);
            
            flatpickr(container.querySelector('#deliveryDateInput'), {
                dateFormat: "d/m/Y",
                defaultDate: defDate,
                locale: "es",
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        const d = selectedDates[0];
                        const yy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        deliveryDate = \`\${yy}-\${mm}-\${dd}\`;
                    }
                }
            });
        }
        
        container.querySelector('#priceType')?.addEventListener('change', (e) => {
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
                const termClean = term.replace(/[-.]/g, '');
                const isNumeric = /^[a-z]?\\d+$/.test(termClean);

                const filtered = clients.filter(c => {
                    if (isNumeric) {
                        const idClean = (c.id || '').toLowerCase().replace(/[-.]/g, '');
                        const idDigits = (c.id || '').replace(/\\D/g, '');
                        const phoneClean = (c.phone || '').replace(/\\D/g, '');
                        const termDigits = term.replace(/\\D/g, '');
                        
                        return idClean.startsWith(termClean) || 
                               (termDigits && idDigits.startsWith(termDigits)) || 
                               (termDigits.length > 2 && phoneClean.includes(termDigits));
                    } else {
                        return c.fullName && c.fullName.toLowerCase().includes(term);
                    }
                });
            
                if (filtered.length > 0) {
                    clientResults.innerHTML = filtered.map(c => \`
                        <div class="client-option p-sm hover:bg-surface-variant cursor-pointer border-b border-outline-variant last:border-0 focus:outline-none focus:bg-surface-variant focus:ring-2 focus:ring-primary" data-id="\${c.id}" tabindex="0">
                            <p class="font-bold text-on-surface">\${c.fullName}</p>
                            <p class="text-label-sm text-outline">\${c.id} | \${c.phone || 'Sin tel.'}</p>
                        </div>
                    \`).join('');
                } else {
                    clientResults.innerHTML = \`
                        <div class="create-client-option p-sm hover:bg-surface-variant cursor-pointer border-b border-outline-variant text-primary flex items-center gap-2 focus:outline-none focus:bg-surface-variant focus:ring-2 focus:ring-primary" tabindex="0">
                            <span class="material-symbols-outlined">person_add</span>
                            <p class="font-bold">Crear nuevo cliente: "\${e.target.value}"</p>
                        </div>
                    \`;
                }
            
                clientResults.style.display = 'block';
            
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
                
                const createOpt = container.querySelector('.create-client-option');
                if (createOpt) {
                    createOpt.addEventListener('click', () => {
                        const currentSearch = clientSearch.value;
                        sessionStorage.setItem('sales_temp_state', JSON.stringify({ cart, payments, currentView: 'cart', currentMobileStep }));
                        sessionStorage.setItem('prefill_client_name', currentSearch);
                        window.location.hash = '#clients';
                    });
                }
            });

            clientSearch.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const firstResult = container.querySelector('.client-option, .create-client-option');
                    if (firstResult) firstResult.focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstResult = container.querySelector('.client-option, .create-client-option');
                    if (firstResult) firstResult.click();
                }
            });

            document.addEventListener('click', (e) => {
                if (clientSearch && !clientSearch.contains(e.target) && !clientResults.contains(e.target)) {
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
            sessionStorage.setItem('sales_temp_state', JSON.stringify({ cart, payments, currentView: 'cart', currentMobileStep }));
            window.location.hash = '#clients';
        });

        const handleEditQty = (index) => {
            const item = cart[index];
            const p = products.find(prod => prod.id === item.id);
            if (!p) return;
            showProductSaleModal(p, (qty, unit, extras) => {
                const price = getPrice(p);
                const isBox = (unit === p.purchaseUnit && unit !== p.stockUnit);
                const unitContent = isBox ? (parseFloat(p.purchaseToStockQty) || 1) : 1;
                const realQty = qty * unitContent;
                
                const extraTotal = (extras || []).reduce((sum, e) => sum + e.price, 0);
                const totalUnitPrice = price + extraTotal;

                item.qty = qty;
                item.sellUnit = unit;
                item.unitContent = unitContent;
                item.realQty = realQty;
                item.total = realQty * totalUnitPrice;
                item.extras = extras || [];
                render();
            }, item.qty, item.sellUnit, item.extras);
        };

        container.querySelectorAll('.edit-qty').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.closest('.btn-remove')) return;
                const index = parseInt(btn.dataset.index);
                handleEditQty(index);
            });
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const index = parseInt(btn.dataset.index);
                    handleEditQty(index);
                }
            });
        });

        container.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                cart.splice(index, 1);
                render();
            });
        });

        container.querySelector('.btn-remove-debt')?.addEventListener('click', (e) => {
            e.stopPropagation();
            includeOldDebt = false;
            render();
        });

        // Payment and Finish actions
        const handleOpenPayment = () => {
            if (!selectedClient && settings.type !== 'presupuesto') {
                showToast("Debe seleccionar un cliente primero", true);
                return;
            }
            showPaymentModal(effectiveTotalUSD);
        };

        const handleFinishSale = () => {
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
        };

        container.querySelector('#openPaymentModalBtn')?.addEventListener('click', handleOpenPayment);
        container.querySelector('#openPaymentModalBtnMobile')?.addEventListener('click', handleOpenPayment);
        
        container.querySelector('#finishBtn')?.addEventListener('click', handleFinishSale);
        container.querySelector('#finishBtnMobile')?.addEventListener('click', handleFinishSale);
    }
`;

const startIndex = content.indexOf('    function renderSingleView() {');
const endIndex = content.indexOf('    function showProductSaleModal(');

if (startIndex !== -1 && endIndex !== -1) {
    const updatedContent = content.substring(0, startIndex) + newRenderSingleView + content.substring(endIndex);
    fs.writeFileSync(salesFile, updatedContent, 'utf8');
    console.log('sales.js successfully updated.');
} else {
    console.error('Could not find the function boundaries.');
}
