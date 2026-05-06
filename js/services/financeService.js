import { db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

/**
 * Servicio para gestionar la base de datos global de bancos auto-alimentada
 */
export const FinanceService = {
    /**
     * Obtiene la lista de bancos sugeridos para un país
     * @param {string} countryCode - ISO2 del país (VE, CO, ES, etc)
     */
    async getBanksByCountry(countryCode) {
        try {
            const banksRef = collection(db, 'public_banks');
            const q = query(banksRef, where('country', '==', countryCode));
            const snap = await getDocs(q);
            
            let banks = snap.docs.map(doc => doc.data().name);
            
            // Si la base de datos está vacía para este país, devolvemos semillas iniciales
            if (banks.length === 0) {
                banks = this.getSeedsByCountry(countryCode);
            }
            
            return [...new Set(banks)].sort();
        } catch (error) {
            console.error("Error cargando bancos:", error);
            return [];
        }
    },

    /**
     * Registra un nuevo banco si no existe en la base de datos global
     */
    async registerBankIfNew(countryCode, bankName) {
        if (!bankName || !countryCode) return;
        
        const normalizedName = bankName.trim().toUpperCase();
        const banks = await this.getBanksByCountry(countryCode);
        
        const exists = banks.some(b => b.toUpperCase() === normalizedName);
        
        if (!exists) {
            try {
                await addDoc(collection(db, 'public_banks'), {
                    country: countryCode,
                    name: bankName.trim(),
                    addedAt: serverTimestamp(),
                    isVerified: false // Para auditoría interna si fuera necesario
                });
                console.log(`🏦 Nuevo banco registrado globalmente: ${bankName} (${countryCode})`);
            } catch (error) {
                console.error("Error registrando banco global:", error);
            }
        }
    },

    /**
     * Bancos "Semilla" para que el sistema no empiece totalmente en blanco
     */
    getSeedsByCountry(iso) {
        const seeds = {
            'VE': ['Banesco', 'Mercantil', 'BBVA Provincial', 'Banco de Venezuela', 'BNC', 'Bancaribe', 'Bancamiga', 'Banplus', 'BOD', 'Banco Exterior'],
            'CO': ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA Colombia', 'Nequi', 'Daviplata', 'Scotiabank Colpatria'],
            'PA': ['Banco General', 'Banistmo', 'BAC Credomatic', 'Caja de Ahorros', 'Global Bank'],
            'ES': ['Santander', 'BBVA', 'CaixaBank', 'Sabadell', 'Bankinter', 'ING'],
            'US': ['Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'PNC', 'US Bank']
        };
        return seeds[iso] || [];
    }
};
