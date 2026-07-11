const fs = require('fs');
const path = require('path');

const salesFile = path.join(__dirname, 'js', 'views', 'sales.js');
let content = fs.readFileSync(salesFile, 'utf8');

// 1. Replace the footer class logic to handle currentMobileStep === 3
content = content.replace(
    '${currentMobileStep === 2 ? \'bg-surface-container-low',
    '${(currentMobileStep === 2 || currentMobileStep === 3) ? \'bg-surface-container-low'
);

// 2. Replace the PASO 3 footer content
const oldStep3Footer = `                    \${currentMobileStep === 3 ? \`
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
                    \` : ''}`;

const newStep3Footer = `                    \${currentMobileStep === 3 ? \`
                        <div class="flex flex-col w-full gap-sm">
                            <div class="flex gap-sm w-full">
                                <div class="flex-1 bg-surface-container-highest rounded-xl p-sm border border-outline-variant flex flex-col items-center justify-center">
                                    <span class="text-[10px] font-bold text-outline tracking-wider mb-1 uppercase">Total USD</span>
                                    <span class="text-body-lg font-bold text-white">$ \${fmt(effectiveTotalUSD)}</span>
                                </div>
                                <div class="flex-1 bg-surface-container-highest rounded-xl p-sm border border-outline-variant flex flex-col items-center justify-center">
                                    <span class="text-[10px] font-bold text-outline tracking-wider mb-1 uppercase">Total BS</span>
                                    <span class="text-body-lg font-bold text-white">Bs. \${fmt(totalBs)}</span>
                                </div>
                            </div>
                            <button id="btnNextStep3" class="btn w-full py-4 text-md font-bold rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2" style="background-color: #8ab4f8; color: #0f172a;">
                                <span class="material-symbols-outlined">shopping_cart</span> CONTINUAR AL PAGO (\${totalItems})
                            </button>
                        </div>
                    \` : ''}`;

if (content.includes('id="btnPrevStep3"')) {
    content = content.replace(oldStep3Footer, newStep3Footer);
}

// 3. Replace the PASO 3 cart content
const oldCartSectionRegex = /<!-- PASO 3: Carrito -->[\s\S]*?(?=<!-- PASO 4: Finalizar -->)/;
const newCartSection = `<!-- PASO 3: Carrito -->
                    <div class="flex-1 flex flex-col overflow-hidden \${isMobileStep3}">
                        <!-- Mobile Header -->
                        <div class="lg:hidden flex items-center justify-between p-sm border-b border-outline-variant bg-[#13151b] shrink-0">
                            <div class="flex items-center gap-2">
                                <button id="btnBackFromStep3" class="btn btn-icon material-symbols-outlined text-white hover:bg-white/10 rounded-full w-10 h-10 flex items-center justify-center">arrow_back</button>
                                <h2 class="text-title-md font-bold text-white m-0">Resumen de Carrito</h2>
                            </div>
                            \${cart.length > 0 ? \`<button id="cancelCartBtnMobile" class="btn btn-icon material-symbols-outlined text-primary hover:bg-primary/10 rounded-full w-10 h-10 flex items-center justify-center">delete_sweep</button>\` : ''}
                        </div>

                        <div class="p-md flex-1 overflow-y-auto">
                            <!-- Desktop Header -->
                            <div class="hidden lg:flex justify-between items-center mb-sm">
                                <label class="text-label-bold font-label-bold text-outline uppercase">Carrito</label>
                                \${cart.length > 0 ? '<button id="cancelCartBtn" class="text-error text-label-sm font-bold uppercase hover:underline">Vaciar</button>' : ''}
                            </div>
                            
                            <!-- Mobile Label -->
                            <div class="lg:hidden mb-sm mt-xs">
                                <label class="text-label-bold font-label-bold text-outline uppercase">PRODUCTOS (\${cart.length})</label>
                            </div>

                            <div class="flex flex-col gap-sm">
                                \${cart.length === 0 ? '<p class="text-outline text-center py-4 text-body-md">El carrito está vacío</p>' : ''}
                                \${cart.map((item, index) => {
                                    const prod = products.find(p => p.id === item.id);
                                    const bsPrice = (item.total * bcvRate);
                                    return \`
                                    <div class="flex flex-col p-md rounded-xl bg-[#1e293b] border border-outline-variant group">
                                        <div class="flex justify-between items-start mb-2">
                                            <p class="text-body-lg font-semibold text-white pr-2 leading-tight">\${item.name}</p>
                                            <div class="flex flex-col items-end whitespace-nowrap">
                                                <p class="text-title-md font-bold text-white">$ \${fmt(item.total)}</p>
                                                <p class="text-[10px] text-outline font-bold mt-1">Bs. \${fmt(bsPrice)}</p>
                                            </div>
                                        </div>
                                        <div class="flex justify-between items-center mt-1">
                                            <div class="bg-green-900/30 text-green-400 px-2 py-1 rounded-full text-[10px] font-bold border border-green-800/50">
                                                \${Number(Number(item.qty).toFixed(3))} \${item.sellUnit || 'ud'} x $ \${fmt(item.price)}
                                            </div>
                                            <div class="flex justify-end gap-2">
                                                <button class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline hover:text-white transition-colors edit-qty" data-index="\${index}">
                                                    <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
                                                </button>
                                                <button class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-outline hover:text-error transition-colors btn-remove" data-index="\${index}">
                                                    <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        \${(item.extras && item.extras.length > 0) ? \`
                                            <p class="text-label-sm text-primary mt-2 font-bold border-t border-outline-variant/30 pt-2">
                                                + Extras: \${item.extras.map(e => \`\${e.name} ($\${fmt(e.price)})\`).join(', ')}
                                            </p>
                                        \` : ''}
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
                    </div>
                    `;

content = content.replace(oldCartSectionRegex, newCartSection);

// 4. Add the event listeners for btnBackFromStep3 and cancelCartBtnMobile
const listenersAddition = \`
        container.querySelector('#btnBackFromStep3')?.addEventListener('click', () => {
            currentMobileStep = 2;
            render();
        });

        container.querySelector('#cancelCartBtnMobile')?.addEventListener('click', () => {
            const btn = container.querySelector('#cancelCartBtn');
            if (btn) btn.click();
        });

        // Client search logic\`;

content = content.replace('// Client search logic', listenersAddition);

fs.writeFileSync(salesFile, content, 'utf8');
console.log("Refactored Cart Step 3 UI successfully.");
