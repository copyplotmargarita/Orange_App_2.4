function renderEquipmentForm() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    let html = `
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; text-align: center; justify-content: center; flex-direction: column;">
            <h2 style="font-size: 1.75rem; font-weight: 800; letter-spacing: -0.5px; color: var(--primary);">🔧 Compra de Equipo</h2>
            <p class="text-muted text-sm">Registra la compra de herramientas, maquinaria y mobiliario</p>
        </div>
        
        <form id="purchaseForm" style="max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- 1. Datos del Documento -->
            <div class="card" style="padding: 2rem; border-top: 4px solid var(--primary);">
                <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">1. Datos del Documento</h3>
                
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <div class="form-group">
                        <label>PROVEEDOR <span class="text-danger">*</span></label>
                        <select id="pSupplier" class="form-control" required style="height: 40px;">
                            <option value="">Seleccione un proveedor...</option>
                            <option value="CREATE_NEW" style="font-weight: bold; color: var(--primary);">+ CREAR PROVEEDOR</option>
                            ${[...suppliers].sort((a,b)=>a.name.localeCompare(b.name)).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>EMISIÓN <span class="text-danger">*</span></label>
                            <input type="date" id="pEmissionDate" class="form-control" required value="${todayStr}" style="height: 40px;">
                        </div>
                        <div class="form-group">
                            <label>RECEPCIÓN <span class="text-danger">*</span></label>
                            <input type="date" id="pReceptionDate" class="form-control" required value="${todayStr}" style="height: 40px;">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>TASA BCV DE LA FACTURA <span class="text-danger">*</span></label>
                        <input type="text" inputmode="numeric" id="pBcvRate" class="form-control" required value="${bcvRate.toLocaleString('de-DE', {minimumFractionDigits:2})}" style="height: 40px;">
                        <small id="bcvWarning" style="color: var(--primary); display: none; margin-top: 4px; font-size: 0.7rem; font-weight: 700;">⚠️ No hay tasa cargada para la Fecha de Emisión.</small>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>DOC <span class="text-danger">*</span></label>
                            <select id="pDocType" class="form-control" required style="height: 40px;">
                                <option value="FACTURA">FACTURA</option>
                                <option value="GUIA">GUIA</option>
                                <option value="NOTA">NOTA</option>
                                <option value="RECIBO">RECIBO</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>NÚMERO <span class="text-danger">*</span></label>
                            <input type="text" id="pDocNumber" class="form-control" required placeholder="Ej. 001" style="height: 40px;">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>ESTADO DE LA COMPRA <span class="text-danger">*</span></label>
                        <select id="pStatus" class="form-control" required style="height: 40px;">
                            <option value="">Seleccione...</option>
                            <option value="ABONO">ABONO</option>
                            <option value="CONTADO">CONTADO</option>
                            <option value="CREDITO">CREDITO</option>
                            <option value="PAGADO">PAGADO</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- 2. Equipos -->
            <div class="card" style="padding: 2rem; border-top: 4px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin: 0;">2. Equipos</h3>
                    <button type="button" class="btn btn-outline" id="addEqBtn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; border-color: var(--primary); color: var(--primary);">+ Agregar Equipo</button>
                </div>
                
                <div id="equipmentList" style="display: flex; flex-direction: column; gap: 1rem;">
                    <!-- Equipos dinamicos -->
                </div>
                
                <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--border); padding-top: 1rem; margin-top: 1rem;">
                    <span style="font-weight: 800; color: var(--text-muted);">TOTAL $</span>
                    <span id="eqTotalUsd" style="font-weight: 900; font-size: 1.25rem; color: var(--primary);">$ 0.00</span>
                </div>
            </div>

            <!-- 3. Pagos (Condicional) -->
            <div class="card" id="paymentSection" style="display: none; padding: 2rem; border-top: 4px solid var(--primary);">
                <!-- Igual que PRODUCTO -->
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button type="button" class="btn btn-outline" id="cancelFormBtn" style="flex: 1; height: 50px; font-weight: 700;">CANCELAR</button>
                <button type="submit" class="btn btn-primary" id="savePurchaseBtn" style="flex: 1; height: 50px; font-weight: 800;">REGISTRAR EQUIPO</button>
            </div>
        </form>
    `;

    // Falta implementar lógica para añadir items de equipo.
}
