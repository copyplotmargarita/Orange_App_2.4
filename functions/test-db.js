const admin = require('firebase-admin');
const crypto = require('crypto');

const serviceAccount = require('../service-account.json'); // Wait, I don't know if this exists. Let's use application default credentials if it's the emulator, or check what's there.
