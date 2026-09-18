import { db } from './firebase.js';
import { runTransaction, doc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

/**
 * Actualiza el saldo de la billetera de un cliente de forma transaccional y registra el movimiento.
 * @param {string} businessId - ID del negocio
 * @param {string} clientId - ID del cliente
 * @param {number} amountUSD - Monto en USD (positivo)
 * @param {string} type - Tipo de movimiento ('abono' o 'consumo')
 * @param {string} reference - Referencia o nota del movimiento
 * @returns {Promise<void>}
 */
export async function updateWalletBalance(businessId, clientId, amountUSD, type, reference) {
    if (!businessId || !clientId) throw new Error("Faltan parámetros de negocio o cliente.");
    if (amountUSD <= 0) throw new Error("El monto debe ser mayor a cero.");
    if (type !== 'abono' && type !== 'consumo') throw new Error("Tipo de movimiento inválido.");

    const clientRef = doc(db, "businesses", businessId, "clients", clientId);
    const logRef = doc(collection(db, "businesses", businessId, "wallet_logs"));
    
    const employeeEmail = localStorage.getItem('userEmail') || 'Desconocido';
    const employeeName = localStorage.getItem(`userName_${employeeEmail}`) || localStorage.getItem('employeeName') || localStorage.getItem('userName') || 'Usuario';
    const storeId = localStorage.getItem('storeId') || 'general';
    const storeName = localStorage.getItem('storeName') || 'Sede Principal';

    await runTransaction(db, async (transaction) => {
        const clientDoc = await transaction.get(clientRef);
        if (!clientDoc.exists()) {
            throw new Error("El cliente no existe.");
        }
        
        const data = clientDoc.data();
        let currentBalance = data.walletBalance || 0;
        let newBalance = currentBalance;
        
        if (type === 'abono') {
            newBalance += amountUSD;
        } else if (type === 'consumo') {
            newBalance -= amountUSD;
            // Para evitar problemas de precisión flotante y redondeo en la interfaz (fmt)
            if (newBalance < -0.05) {
                throw new Error("Saldo insuficiente en la billetera del cliente.");
            }
            if (newBalance < 0) newBalance = 0;
        }
        
        transaction.update(clientRef, { walletBalance: newBalance });
        
        const logData = {
            clientId: clientId,
            clientName: data.fullName || 'Cliente',
            amount: type === 'abono' ? amountUSD : -amountUSD,
            type: type,
            reference: reference,
            employeeEmail: employeeEmail,
            employeeName: employeeName,
            storeId: storeId,
            storeName: storeName,
            createdAt: serverTimestamp(),
            previousBalance: currentBalance,
            newBalance: newBalance
        };
        
        transaction.set(logRef, logData);
    });
}
