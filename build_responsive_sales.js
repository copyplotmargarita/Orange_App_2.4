const fs = require('fs');
const path = require('path');

const salesPath = path.join(__dirname, 'js/views/sales.js');
let content = fs.readFileSync(salesPath, 'utf8');

// We need to add state variables at the top of the file
if (!content.includes('let currentMobileStep = 1;')) {
    content = content.replace(/let cart = \[\];/g, 'let cart = [];\n    let currentMobileStep = 1;');
}

const renderSingleViewLogic = `
    function renderSingleView() {
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

        const isMobile = window.innerWidth < 1024;

        if (isMobile) {
            // MOBILE RENDER LOGIC
            let mobileHTML = '';
            
            // Bottom Navbar
            const navBarHTML = `
            <nav class="flex justify-around items-center h-20 pb-safe px-2 fixed bottom-0 w-full z-50 bg-surface-container border-t border-outline-variant shadow-lg">
                <a id="navStep1" class="flex flex-col items-center justify-center \${currentMobileStep === 1 ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-primary'} rounded-xl px-4 py-1 transition-transform cursor-pointer">
                    <span class="material-symbols-outlined" \${currentMobileStep === 1 ? 'style="font-variation-settings: \\\\'FILL\\\\' 1;"' : ''}>receipt_long</span>
                    <span class="font-label-sm text-label-sm">Inicio</span>
                </a>
                <a id="navStep2" class="flex flex-col items-center justify-center \${currentMobileStep === 2 ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-primary'} rounded-xl px-4 py-1 transition-transform cursor-pointer">
                    <span class="material-symbols-outlined" \${currentMobileStep === 2 ? 'style="font-variation-settings: \\\\'FILL\\\\' 1;"' : ''}>inventory_2</span>
                    <span class="font-label-sm text-label-sm">Productos</span>
                </a>
                <a id="navStep3" class="flex flex-col items-center justify-center \${currentMobileStep === 3 ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-primary'} rounded-xl px-4 py-1 transition-transform cursor-pointer relative">
                    <span class="material-symbols-outlined" \${currentMobileStep === 3 ? 'style="font-variation-settings: \\\\'FILL\\\\' 1;"' : ''}>shopping_cart</span>
                    <span class="font-label-sm text-label-sm">Carrito</span>
                    \${cart.length > 0 ? `<span class="absolute top-0 right-2 bg-error text-white text-[10px] font-bold px-1.5 rounded-full">\${cart.length}</span>` : ''}
                </a>
                <a id="navStep4" class="flex flex-col items-center justify-center \${currentMobileStep === 4 ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-primary'} rounded-xl px-4 py-1 transition-transform cursor-pointer">
                    <span class="material-symbols-outlined" \${currentMobileStep === 4 ? 'style="font-variation-settings: \\\\'FILL\\\\' 1;"' : ''}>payments</span>
                    <span class="font-label-sm text-label-sm">Pago</span>
                </a>
            </nav>
            `;

            switch(currentMobileStep) {
                case 1:
                    mobileHTML = `
                    <header class="flex items-center justify-between px-4 h-16 w-full sticky top-0 bg-background z-50">
                        <div class="flex items-center gap-4">
                            <button id="backToDashboardBtn2" class="p-2 rounded-full hover:bg-surface-container-highest transition-colors duration-200 text-primary">
                                <span class="material-symbols-outlined">arrow_back</span>
                            </button>
                            <h1 class="font-headline-md text-headline-md font-bold text-on-surface">Nueva Venta</h1>
                        </div>
                    </header>
                    <main class="flex-grow px-margin-mobile pt-4 pb-32 overflow-y-auto w-full">
                        <div class="grid grid-cols-2 gap-gutter mb-6">
                            <div class="bg-surface-container border border-outline-variant rounded-xl p-card-padding">
                                <p class="text-label-sm font-label-sm text-outline uppercase mb-1">Tasa BCV</p>
                                <p class="text-secondary font-headline-md text-headline-md">Bs. \${fmt(bcvRate)}</p>
                            </div>
                            <div class="bg-surface-container border border-outline-variant rounded-xl p-card-padding">
                                <p class="text-label-sm font-label-sm text-outline uppercase mb-1">Fecha</p>
                                <p class="text-on-surface font-headline-md text-headline-md">\${new Date().toLocaleDateString('es-VE')}</p>
                            </div>
                        </div>
                        <div class="bg-surface-container border border-outline-variant rounded-xl p-card-padding flex flex-col gap-6">
                            <h2 class="text-on-surface-variant font-headline-md text-headline-md border-b border-outline-variant pb-2">Detalles de Operación</h2>
                            <div class="flex flex-col gap-2">
                                <label class="font-label-sm text-label-sm text-outline uppercase" for="saleType">Operación</label>
                                <select class="w-full h-[48px] bg-surface-container-highest border-outline-variant rounded-lg px-4 text-body-md font-body-md focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface" id="saleType">
                                    <option value="venta" \${settings.type === 'venta' ? 'selected' : ''}>Venta</option>
                                    <option value="presupuesto" \${settings.type === 'presupuesto' ? 'selected' : ''}>Presupuesto</option>
                                    <option value="pedido" \${settings.type === 'pedido' ? 'selected' : ''}>Pedido</option>
                                </select>
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="font-label-sm text-label-sm text-outline uppercase" for="priceType">Tipo de Precio</label>
                                <select class="w-full h-[48px] bg-surface-container-highest border-outline-variant rounded-lg px-4 text-body-md font-body-md focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface" id="priceType">
                                    <option value="precioDetal" \${settings.priceType === 'precioDetal' ? 'selected' : ''}>Detal</option>
                                    <option value="precioMayor" \${settings.priceType === 'precioMayor' ? 'selected' : ''}>Mayor</option>
                                    <option value="precioSpecial" \${settings.priceType === 'precioSpecial' ? 'selected' : ''}>Especial</option>
                                </select>
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="font-label-sm text-label-sm text-outline uppercase" for="saleStatus">Estado de Operación</label>
                                <select class="w-full h-[48px] bg-surface-container-highest border-outline-variant rounded-lg px-4 text-body-md font-body-md focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface" id="saleStatus" \${settings.type === 'presupuesto' ? 'disabled' : ''}>
                                    \${settings.type === 'presupuesto' ? '<option value="presupuesto" selected>PRESUPUESTO</option>' : `
                                    <option value="contado" \${saleStatus === 'contado' ? 'selected' : ''}>Contado</option>
                                    <option value="abono" \${saleStatus === 'abono' ? 'selected' : ''}>Abono</option>
                                    <option value="credito" \${saleStatus === 'credito' ? 'selected' : ''}>Crédito</option>
                                    `}
                                </select>
                            </div>
                            <div class="flex flex-col gap-2">
                                <label class="font-label-sm text-label-sm text-outline uppercase" for="saleTarget">Tipo de Venta</label>
                                <select class="w-full h-[48px] bg-surface-container-highest border-outline-variant rounded-lg px-4 text-body-md font-body-md focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface" id="saleTarget">
                                    <option value="detal" \${settings.target === 'detal' ? 'selected' : ''}>Detal</option>
                                    <option value="mayor" \${settings.target === 'mayor' ? 'selected' : ''}>Mayor</option>
                                </select>
                            </div>
                        </div>
                    </main>
                    <div class="fixed bottom-20 left-0 w-full p-4 bg-background/80 backdrop-blur-md z-40">
                        <button id="btnNextStep" class="w-full py-4 bg-primary-container text-on-primary-container font-headline-md text-headline-md rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                            Siguiente (Productos)
                            <span class="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                    `;
                    break;
                case 2:
                    mobileHTML = `
                    <header class="flex items-center justify-between px-4 h-16 w-full sticky top-0 bg-background z-50">
                        <div class="flex items-center gap-4">
                            <h1 class="font-headline-md text-headline-md font-bold text-on-surface">Productos</h1>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="text-right mr-2 hidden sm:block">
                                <p class="font-label-sm text-label-sm text-outline uppercase">Tasa BCV</p>
                                <p class="font-label-md text-label-md text-secondary">Bs. \${fmt(bcvRate)}</p>
                            </div>
                        </div>
                    </header>
                    <div class="sticky top-16 bg-background/95 backdrop-blur-md px-4 py-3 z-30 w-full">
                        <div class="relative w-full">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                            <input id="productSearch" class="w-full h-12 pl-11 bg-surface-container border border-outline-variant rounded-xl text-body-md text-on-surface focus:border-primary focus:ring-0 transition-all outline-none" placeholder="Buscar por nombre o código..." type="text" value="\${searchProductTerm}">
                        </div>
                    </div>
                    <main id="productList" class="px-4 py-4 grid grid-cols-2 gap-3 pb-32 w-full">
                        \${renderProductList()}
                    </main>
                    <div class="fixed bottom-20 left-0 w-full p-4 bg-background/80 backdrop-blur-md z-40">
                        <button id="btnNextStep" class="w-full py-4 bg-primary-container text-on-primary-container font-headline-md text-headline-md rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                            IR A CARRITO (\${cart.length})
                            <span class="material-symbols-outlined">shopping_cart</span>
                        </button>
                    </div>
                    `;
                    break;
                case 3:
                    mobileHTML = `
                    <header class="flex items-center justify-between px-4 h-16 w-full sticky top-0 bg-background z-50">
                        <div class="flex items-center gap-4">
                            <h1 class="font-headline-md text-headline-md font-bold text-on-surface">Resumen de Carrito</h1>
                        </div>
                        \${cart.length > 0 ? `
                        <button id="cancelCartBtn" class="p-2 transition-colors duration-200 hover:bg-surface-container-highest rounded-full flex items-center justify-center">
                            <span class="material-symbols-outlined text-error">delete_sweep</span>
                        </button>` : ''}
                    </header>
                    <main class="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-48 w-full">
                        <div class="flex flex-col gap-3">
                            <div class="text-label-md font-label-md text-outline uppercase tracking-wider mb-1">Productos (\${cart.length})</div>
                            \${cart.length === 0 ? '<p class="text-outline text-center py-4 text-body-md">El carrito está vacío</p>' : ''}
                            \${cart.map((item, index) => {
                                return `
                                <div class="bg-surface-container border border-outline-variant rounded-xl p-4 flex flex-col gap-3 transition-all">
                                    <div class="flex justify-between items-start">
                                        <div class="flex flex-col gap-1 max-w-[70%]">
                                            <span class="font-headline-md text-body-lg text-on-surface leading-tight">\${item.name}</span>
                                            <div class="flex items-center gap-2">
                                                <span class="bg-surface-container-highest text-secondary font-label-md text-label-md px-2 py-0.5 rounded-full">\${Number(item.qty).toFixed(3)} \${item.sellUnit || 'ud'} x $ \${fmt(item.price)}</span>
                                            </div>
                                        </div>
                                        <div class="flex flex-col items-end">
                                            <span class="font-price-lg text-price-lg text-primary">$ \${fmt(item.total)}</span>
                                            <span class="font-price-lg text-price-lg text-primary">Bs. \${fmt(item.total * bcvRate)}</span>
                                        </div>
                                    </div>
                                    <div class="flex justify-end gap-3 pt-2 border-t border-outline-variant/30">
                                        <button class="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors edit-qty" data-index="\${index}">
                                            <span class="material-symbols-outlined text-[20px] pointer-events-none">edit</span>
                                        </button>
                                        <button class="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant hover:text-error transition-colors btn-remove" data-index="\${index}">
                                            <span class="material-symbols-outlined text-[20px] pointer-events-none">delete</span>
                                        </button>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </main>
                    <footer class="fixed bottom-20 left-0 w-full z-40 bg-surface-container/95 backdrop-blur-md border-t border-outline-variant shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                        <div class="px-4 py-4 flex flex-col gap-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-surface-container-high rounded-xl p-3 flex flex-col items-center justify-center border border-outline-variant/50">
                                    <span class="font-label-sm text-label-sm text-outline uppercase">Total USD</span>
                                    <span class="font-headline-lg text-headline-lg-mobile text-on-surface">$ \${fmt(effectiveTotalUSD)}</span>
                                </div>
                                <div class="bg-surface-container-high rounded-xl p-3 flex flex-col items-center justify-center border border-outline-variant/50">
                                    <span class="font-label-sm text-label-sm text-outline uppercase">Total BS</span>
                                    <span class="font-headline-lg text-headline-lg-mobile text-on-surface">Bs. \${fmt(totalBs)}</span>
                                </div>
                            </div>
                            <button id="btnNextStep" class="flex items-center justify-center gap-2 w-full h-[56px] bg-primary-container text-on-primary-container font-headline-md text-headline-md rounded-xl shadow-lg active:scale-95 transition-transform" \${cart.length === 0 ? 'disabled style="opacity: 0.5"' : ''}>
                                <span class="material-symbols-outlined">shopping_cart_checkout</span>
                                <span>CONTINUAR AL PAGO (\${cart.length})</span>
                            </button>
                        </div>
                    </footer>
                    `;
                    break;
                case 4:
                    mobileHTML = `
                    <header class="flex items-center justify-between px-4 h-16 w-full sticky top-0 bg-background z-50">
                        <div class="flex items-center gap-4">
                            <h1 class="font-headline-md text-headline-md font-bold text-on-surface">Finalizar Venta</h1>
                        </div>
                    </header>
                    <main class="flex-1 px-margin-mobile pt-2 pb-40 flex flex-col gap-6 w-full">
                        <!-- Client Selection -->
                        <section class="flex flex-col gap-2">
                            <label class="font-label-md text-label-md text-on-surface-variant px-1 uppercase tracking-wider">CLIENTE</label>
                            <div class="flex gap-2 relative">
                                <div class="relative flex-1 group">
                                    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">person_search</span>
                                    <input id="clientSearch" class="w-full h-12 bg-surface-container border border-outline-variant rounded-xl pl-10 pr-4 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="Buscar cliente..." type="text" value="\${selectedClient ? selectedClient.fullName : ''}"/>
                                    \${selectedClient ? `<p class="text-label-sm text-outline mt-1">\${selectedClient.id}</p>` : ''}
                                    <div id="clientResults" class="absolute top-full left-0 right-0 bg-surface border border-outline-variant z-50 max-h-48 overflow-y-auto rounded-lg shadow-xl mt-1 hidden"></div>
                                </div>
                                \${selectedClient ? `
                                <button id="removeClientBtn" class="w-12 h-12 bg-error/20 text-error flex items-center justify-center rounded-xl active:scale-95 transition-transform">
                                    <span class="material-symbols-outlined">close</span>
                                </button>
                                ` : `
                                <button id="createNewClientBtn" class="w-12 h-12 bg-surface-container-highest text-primary flex items-center justify-center rounded-xl active:scale-95 transition-transform">
                                    <span class="material-symbols-outlined">person_add</span>
                                </button>
                                `}
                            </div>
                        </section>

                        <button id="openPaymentModalBtn" class="w-full h-12 bg-surface-container-high border border-primary/50 text-primary rounded-xl font-headline-md text-headline-md flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md">
                            <span class="material-symbols-outlined">add_circle</span>
                            AGREGAR PAGO MANUAL
                        </button>

                        <div class="bg-surface border border-outline-variant rounded-lg p-sm mt-sm">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-label-sm font-bold text-outline">PAGADO ($)</span>
                                <span class="text-body-md font-bold text-green-400">$ \${fmt(netPaidUSD)}</span>
                            </div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-label-sm font-bold text-outline">PAGADO (BS)</span>
                                <span class="text-body-md font-bold text-green-400">Bs. \${fmt(netPaidUSD * bcvRate)}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-label-sm font-bold text-outline">RESTA ($)</span>
                                <span class="text-body-md font-bold text-red-400">$ \${fmt(currentRemainingUSD)}</span>
                            </div>
                        </div>
                    </main>
                    <footer class="fixed bottom-20 w-full z-40 bg-surface-container shadow-[0_-8px_24px_rgba(0,0,0,0.5)] border-t border-outline-variant/30 safe-bottom">
                        <div class="flex justify-between items-center px-4 py-4 gap-4">
                            <div class="flex-1 bg-surface-container-high rounded-xl p-3 flex flex-col items-center">
                                <span class="text-[10px] font-bold text-outline uppercase">TOTAL USD</span>
                                <span class="text-price-lg font-price-lg text-on-surface">$ \${fmt(effectiveTotalUSD)}</span>
                            </div>
                            <div class="flex-1 bg-surface-container-high rounded-xl p-3 flex flex-col items-center">
                                <span class="text-[10px] font-bold text-outline uppercase">TOTAL BS</span>
                                <span class="text-price-lg font-price-lg text-on-surface">Bs. \${fmt(totalBs)}</span>
                            </div>
                        </div>
                        <div class="px-4 pb-4">
                            <button id="finishBtn" class="w-full h-14 bg-primary text-on-primary font-headline-md text-headline-md font-bold rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform" \${settings.type === 'presupuesto' ? '' : (isRestaPending ? 'disabled style="opacity:0.5"' : '')}>
                                <span class="material-symbols-outlined">shopping_cart_checkout</span>
                                \${settings.type === 'presupuesto' ? 'PRESUPUESTO' : 'FINALIZAR TRANSACCIÓN'}
                            </button>
                        </div>
                    </footer>
                    `;
                    break;
            }

            container.innerHTML = `
                <div class="app-container min-h-screen flex flex-col text-on-surface bg-background" style="font-family: 'Hanken Grotesk', sans-serif;">
                    \${mobileHTML}
                    \${navBarHTML}
                </div>
            `;
        } else {
            // DESKTOP RENDER LOGIC (ORIGINAL)
            container.innerHTML = `
            <div class="app-container h-full flex flex-col text-on-surface bg-background" style="font-family: 'Inter', sans-serif;">
                <div class="flex flex-1 overflow-hidden">
                    <!-- Main Content Area -->
                    <main class="flex-1 overflow-hidden bg-surface-dim flex flex-col">
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
                    <aside class="w-80 lg:w-[400px] xl:w-[450px] bg-surface-container-low border-l border-outline-variant flex flex-col h-full shadow-2xl z-40">
                        <div class="p-md border-b border-outline-variant">
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
                                    <label class="text-label-bold font-label-bold text-outline uppercase">Tipo de Precio</label>
                                    <select id="priceType" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none">
                                        <option value="precioDetal" \${settings.priceType === 'precioDetal' ? 'selected' : ''}>Detal</option>
                                        <option value="precioMayor" \${settings.priceType === 'precioMayor' ? 'selected' : ''}>Mayor</option>
                                        <option value="precioSpecial" \${settings.priceType === 'precioSpecial' ? 'selected' : ''}>Especial</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="text-label-bold font-label-bold text-outline uppercase">Estado</label>
                                    <select id="saleStatus" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" \${settings.type === 'presupuesto' ? 'disabled' : ''}>
                                        \${settings.type === 'presupuesto' ? '<option value="presupuesto" selected>PRESUPUESTO</option>' : `
                                        <option value="contado" \${saleStatus === 'contado' ? 'selected' : ''}>Contado</option>
                                        <option value="abono" \${saleStatus === 'abono' ? 'selected' : ''}>Abono</option>
                                        <option value="credito" \${saleStatus === 'credito' ? 'selected' : ''}>Crédito</option>
                                        `}
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

                            \${settings.type === 'pedido' ? `
                            <div class="mb-md relative">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Fecha de Entrega</label>
                                <input type="text" id="deliveryDateInput" class="w-full bg-surface-container-high border border-outline-variant rounded-lg text-body-md mt-xs text-on-surface px-sm py-2 font-bold focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" value="\${deliveryDate}">
                            </div>` : ''}
                        </div>

                        <!-- PASO 3: Carrito -->
                        <div class="flex-1 overflow-y-auto p-md block">
                            <div class="flex justify-between items-center mb-sm">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Carrito</label>
                                \${cart.length > 0 ? '<button id="cancelCartBtn" class="text-error text-label-sm font-bold uppercase hover:underline">Vaciar</button>' : ''}
                            </div>
                            <div class="flex flex-col gap-sm">
                                \${cart.length === 0 ? '<p class="text-outline text-center py-4 text-body-md">El carrito está vacío</p>' : ''}
                                \${cart.map((item, index) => {
                                    const prod = products.find(p => p.id === item.id);
                                    return `
                                    <div class="flex justify-between items-center p-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors border border-outline-variant group cursor-pointer edit-qty" data-index="\${index}">
                                        <div class="flex-1 min-w-0 pr-2">
                                            <p class="text-body-md font-semibold text-on-surface truncate group-hover:text-primary">\${item.name}</p>
                                            <p class="text-label-sm text-outline">
                                                \${Number(Number(item.qty).toFixed(3))} \${item.sellUnit || 'ud'}
                                                \${(item.unitContent && item.unitContent > 1) ? ` x \${item.unitContent} \${item.baseUnit || 'ud'} ` : ''}
                                                x $ \${fmt(item.price)}
                                            </p>
                                            \${(item.extras && item.extras.length > 0) ? `
                                                <p class="text-label-sm text-primary mt-1 font-bold">
                                                    + Extras: \${item.extras.map(e => `\${e.name} ($\${fmt(e.price)})`).join(', ')}
                                                </p>
                                            ` : ''}
                                        </div>
                                        <div class="flex items-center gap-sm">
                                            <p class="font-label-sm text-primary font-bold">$ \${fmt(item.total)}</p>
                                            <button class="material-symbols-outlined text-outline hover:text-error transition-colors btn-remove" data-index="\${index}" style="font-size: 18px;">delete</button>
                                        </div>
                                    </div>
                                    `;
                                }).join('')}
                                \${includeOldDebt ? `
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
                                ` : ''}
                            </div>
                        </div>

                        <!-- PASO 4: Finalizar (Cliente, Pago, Referencias) -->
                        <div class="p-md border-t border-outline-variant bg-surface-container-low block">
                            <div class="mb-md relative">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Cliente</label>
                                <div class="flex items-center gap-sm mt-xs p-sm bg-surface-container-high rounded-lg border border-outline-variant focus-within:border-primary transition-colors group">
                                    <span class="material-symbols-outlined text-outline group-focus-within:text-primary">person</span>
                                    <div class="flex-1 relative">
                                        <input id="clientSearch" class="bg-transparent border-none focus:ring-0 text-body-md font-semibold text-on-surface w-full p-0 outline-none" placeholder="Buscar cliente..." type="text" value="\${selectedClient ? selectedClient.fullName : ''}"/>
                                        \${selectedClient ? `<p class="text-label-sm text-outline mt-1">\${selectedClient.id}</p>` : ''}
                                        <div id="clientResults" class="absolute top-full left-0 right-0 bg-surface border border-outline-variant z-50 max-h-48 overflow-y-auto rounded-lg shadow-xl mt-1 hidden"></div>
                                    </div>
                                    \${selectedClient ? `
                                    <button id="removeClientBtn" class="material-symbols-outlined text-error cursor-pointer hover:bg-error/10 rounded-full p-1 transition-colors" title="Remover cliente">close</button>
                                    ` : `
                                    <button id="createNewClientBtn" class="material-symbols-outlined text-primary cursor-pointer hover:bg-primary/10 rounded-full p-1 transition-colors" title="Crear cliente">person_add</button>
                                    `}
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
                <footer class="bg-surface-container border-t border-outline-variant p-md z-50 shrink-0 h-[116px]">
                    <!-- DESKTOP FOOTER -->
                    <div class="flex gap-md h-full items-center">
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
                </footer>
            </div>
            `;
        }

        bindEvents();
    }`;

const regex = /function renderSingleView\(\) \{[\s\S]*?bindEvents\(\);\n    \}/;
if (regex.test(content)) {
    content = content.replace(regex, renderSingleViewLogic);
    
    // Also we need to inject the event listeners for the navigation!
    // Inside bindEvents()
    const navEvents = `
        // Mobile Navigation Events
        const btnNextStep = document.getElementById('btnNextStep');
        if (btnNextStep) {
            btnNextStep.addEventListener('click', () => {
                if (currentMobileStep < 4) {
                    currentMobileStep++;
                    renderSingleView();
                }
            });
        }
        
        const navStep1 = document.getElementById('navStep1');
        if (navStep1) navStep1.addEventListener('click', () => { currentMobileStep = 1; renderSingleView(); });
        const navStep2 = document.getElementById('navStep2');
        if (navStep2) navStep2.addEventListener('click', () => { currentMobileStep = 2; renderSingleView(); });
        const navStep3 = document.getElementById('navStep3');
        if (navStep3) navStep3.addEventListener('click', () => { currentMobileStep = 3; renderSingleView(); });
        const navStep4 = document.getElementById('navStep4');
        if (navStep4) navStep4.addEventListener('click', () => { currentMobileStep = 4; renderSingleView(); });
        
        const removeClientBtn = document.getElementById('removeClientBtn');
    `;
    content = content.replace(/const removeClientBtn = document\.getElementById\('removeClientBtn'\);/, navEvents);

    fs.writeFileSync(salesPath, content, 'utf8');
    console.log('Successfully updated renderSingleView and navigation events.');
} else {
    console.log('Could not find renderSingleView to replace.');
}
