import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-functions.js";

export const firebaseConfig = {
  apiKey: "AIzaSyD9aam0cysVQgVDi3pMHu-tP7johs7aeI0",
  authDomain: "app-ventas-db.firebaseapp.com",
  projectId: "app-ventas-db",
  storageBucket: "app-ventas-db.firebasestorage.app",
  messagingSenderId: "767590061980",
  appId: "1:767590061980:web:0631a07b64fa943e0ada59"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable Offline Persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Persistencia offline: Múltiples pestañas abiertas, solo se habilitará en una.");
    } else if (err.code == 'unimplemented') {
        console.warn("Persistencia offline: Navegador no soportado.");
    }
});

export const storage = getStorage(app);
export const functions = getFunctions(app);
