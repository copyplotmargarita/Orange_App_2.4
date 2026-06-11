/**
 * Configuración de países para el onboarding dinámico.
 * Cada país define: tipos de documento, impuesto, moneda local y labels de región.
 */
export const COUNTRY_CONFIG = {
    VE: {
        name: 'Venezuela',
        regionLabel: 'Estado',
        municipalityLabel: 'Municipio',
        currency: { code: 'VES', name: 'Bolívares', symbol: 'Bs.' },
        tax: { enabled: true, name: 'IVA', rate: 16 },
        businessDocTypes: [
            { label: 'V - Venezolano (Natural)', prefix: 'V-' },
            { label: 'J - Jurídico (Empresa)', prefix: 'J-' },
            { label: 'G - Gubernamental', prefix: 'G-' },
            { label: 'E - Extranjero', prefix: 'E-' },
        ],
        ownerDocTypes: [
            { label: 'V - Cédula Venezolana', prefix: 'V-' },
            { label: 'E - Cédula Extranjero', prefix: 'E-' },
        ],
    },
    CO: {
        name: 'Colombia',
        regionLabel: 'Departamento',
        municipalityLabel: 'Municipio',
        currency: { code: 'COP', name: 'Pesos Colombianos', symbol: '$' },
        tax: { enabled: true, name: 'IVA', rate: 19 },
        businessDocTypes: [
            { label: 'NIT - Empresa', prefix: 'NIT-' },
            { label: 'CC - Cédula de Ciudadanía', prefix: 'CC-' },
            { label: 'CE - Cédula de Extranjería', prefix: 'CE-' },
        ],
        ownerDocTypes: [
            { label: 'CC - Cédula de Ciudadanía', prefix: 'CC-' },
            { label: 'CE - Cédula de Extranjería', prefix: 'CE-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    AR: {
        name: 'Argentina',
        regionLabel: 'Provincia',
        municipalityLabel: 'Ciudad',
        currency: { code: 'ARS', name: 'Pesos Argentinos', symbol: '$' },
        tax: { enabled: true, name: 'IVA', rate: 21 },
        businessDocTypes: [
            { label: 'CUIT - Empresa', prefix: 'CUIT-' },
            { label: 'CUIL - Personal', prefix: 'CUIL-' },
        ],
        ownerDocTypes: [
            { label: 'DNI', prefix: 'DNI-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    MX: {
        name: 'México',
        regionLabel: 'Estado',
        municipalityLabel: 'Municipio',
        currency: { code: 'MXN', name: 'Pesos Mexicanos', symbol: '$' },
        tax: { enabled: true, name: 'IVA', rate: 16 },
        businessDocTypes: [
            { label: 'RFC - Persona Moral (Empresa)', prefix: 'RFC-' },
            { label: 'RFC - Persona Física', prefix: 'RFC-' },
        ],
        ownerDocTypes: [
            { label: 'CURP', prefix: 'CURP-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    UY: {
        name: 'Uruguay',
        regionLabel: 'Departamento',
        municipalityLabel: 'Localidad',
        currency: { code: 'UYU', name: 'Pesos Uruguayos', symbol: '$' },
        tax: { enabled: true, name: 'IVA', rate: 22 },
        businessDocTypes: [
            { label: 'RUT - Empresa', prefix: 'RUT-' },
            { label: 'CI - Cédula de Identidad', prefix: 'CI-' },
        ],
        ownerDocTypes: [
            { label: 'CI - Cédula de Identidad', prefix: 'CI-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    CL: {
        name: 'Chile',
        regionLabel: 'Región',
        municipalityLabel: 'Comuna',
        currency: { code: 'CLP', name: 'Pesos Chilenos', symbol: '$' },
        tax: { enabled: true, name: 'IVA', rate: 19 },
        businessDocTypes: [
            { label: 'RUT - Empresa / Persona', prefix: 'RUT-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
        ownerDocTypes: [
            { label: 'RUT', prefix: 'RUT-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    PE: {
        name: 'Perú',
        regionLabel: 'Región',
        municipalityLabel: 'Distrito',
        currency: { code: 'PEN', name: 'Soles', symbol: 'S/.' },
        tax: { enabled: true, name: 'IGV', rate: 18 },
        businessDocTypes: [
            { label: 'RUC - Empresa', prefix: 'RUC-' },
            { label: 'DNI - Persona Natural', prefix: 'DNI-' },
            { label: 'CE - Carnet de Extranjería', prefix: 'CE-' },
        ],
        ownerDocTypes: [
            { label: 'DNI', prefix: 'DNI-' },
            { label: 'CE', prefix: 'CE-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    EC: {
        name: 'Ecuador',
        regionLabel: 'Provincia',
        municipalityLabel: 'Cantón',
        currency: { code: 'USD', name: 'Dólares', symbol: '$' },
        tax: { enabled: true, name: 'IVA', rate: 12 },
        businessDocTypes: [
            { label: 'RUC - Empresa', prefix: 'RUC-' },
            { label: 'Cédula - Persona Natural', prefix: 'CI-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
        ownerDocTypes: [
            { label: 'Cédula', prefix: 'CI-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    PA: {
        name: 'Panamá',
        regionLabel: 'Provincia',
        municipalityLabel: 'Corregimiento',
        currency: { code: 'USD', name: 'Dólares', symbol: '$' },
        tax: { enabled: true, name: 'ITBMS', rate: 7 },
        businessDocTypes: [
            { label: 'RUC - Empresa', prefix: 'RUC-' },
            { label: 'Cédula', prefix: 'CI-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
        ownerDocTypes: [
            { label: 'Cédula', prefix: 'CI-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    ES: {
        name: 'España',
        regionLabel: 'Provincia',
        municipalityLabel: 'Municipio',
        currency: { code: 'EUR', name: 'Euros', symbol: '€' },
        tax: { enabled: true, name: 'IVA', rate: 21 },
        businessDocTypes: [
            { label: 'CIF - Empresa', prefix: 'CIF-' },
            { label: 'DNI - Persona', prefix: 'DNI-' },
            { label: 'NIE - Extranjero', prefix: 'NIE-' },
        ],
        ownerDocTypes: [
            { label: 'DNI', prefix: 'DNI-' },
            { label: 'NIE', prefix: 'NIE-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
    US: {
        name: 'Estados Unidos',
        regionLabel: 'Estado',
        municipalityLabel: 'Ciudad',
        currency: { code: 'USD', name: 'Dólares', symbol: '$' },
        tax: { enabled: false, name: 'Tax', rate: 0 },
        businessDocTypes: [
            { label: 'EIN - Empresa', prefix: 'EIN-' },
            { label: 'SSN - Personal', prefix: 'SSN-' },
        ],
        ownerDocTypes: [
            { label: 'SSN', prefix: 'SSN-' },
            { label: 'Pasaporte', prefix: 'PAS-' },
        ],
    },
};

export const DEFAULT_COUNTRY = 'VE';
