import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

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
