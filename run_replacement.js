const fs = require('fs');
const path = require('path');

const salesPath = path.join(__dirname, 'js/views/sales.js');
let content = fs.readFileSync(salesPath, 'utf8');

if (!content.includes('let currentMobileStep = 1;')) {
    content = content.replace(/let cart = \[\];/g, 'let cart = [];\n    let currentMobileStep = 1;');
}

const newRender = fs.readFileSync(path.join(__dirname, 'new_render_logic.txt'), 'utf8');

const startStr = "const saleStatus = container.querySelector('#saleStatus')?.value || (payments.length === 0 ? 'contado' : 'abono');";
const endStr = "// Clock and Date";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex + startStr.length);
    const after = content.substring(endIndex);
    
    let newRenderContent = newRender.substring(newRender.indexOf('const isMobile = window.innerWidth < 1024;'), newRender.indexOf('bindEvents();'));
    
    content = before + '\n\n        ' + newRenderContent + '\n        ' + after;
    
    const endOfFunctionStr = "processSale(currentRemainingUSD);";
    const eventIndex = content.lastIndexOf(endOfFunctionStr);
    
    if (eventIndex !== -1) {
        const eventsToAdd = `
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
        `;
        
        // Let's insert eventsToAdd right after processSale(currentRemainingUSD);
        // We find the next closing brace `}` after `processSale(currentRemainingUSD);`
        const closingBraceIndex = content.indexOf('}', eventIndex);
        
        if (closingBraceIndex !== -1) {
            const beforeEnd = content.substring(0, closingBraceIndex + 1);
            const afterEnd = content.substring(closingBraceIndex + 1);
            
            content = beforeEnd + '\n' + eventsToAdd + afterEnd;
            
            fs.writeFileSync(salesPath, content, 'utf8');
            console.log('Successfully updated sales.js with exact substring replacement');
        } else {
            console.log('Could not find closing brace after processSale');
        }
    } else {
        console.log('Could not find processSale');
    }
} else {
    console.log('Could not find start or end strings for innerHTML block');
}
