const admin = require('firebase-admin');

admin.initializeApp();

async function checkClaims() {
    try {
        const user = await admin.auth().getUserByEmail('COPYPLOTMARGARITA@gmail.com');
        console.log("User Claims:", user.customClaims);
    } catch (e) {
        console.error("Error:", e);
    }
}
checkClaims();
