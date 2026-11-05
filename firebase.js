import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getDatabase } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
    getAuth,
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// =====================================================
// FIREBASE CONFIG
// =====================================================

const firebaseConfig = {
    apiKey: "AIzaSyDWYYS09i4YN9tnCmAzeiicD9T4YZ3a6HE",
    authDomain: "hv-novitas-beheer.firebaseapp.com",
    databaseURL: "https://hv-novitas-beheer-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "hv-novitas-beheer",
    storageBucket: "hv-novitas-beheer.appspot.com",
    messagingSenderId: "71716605241",
    appId: "1:71716605241:web:b7e87d680b7499421a6ce8"
};

// =====================================================
// APP
// =====================================================

const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

// =====================================================
// DATABASE
// =====================================================

export const db = getDatabase(app);

// =====================================================
// AUTH
// =====================================================

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// =====================================================
// APP EXPORT
// =====================================================

export { app };
