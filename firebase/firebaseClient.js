// UCL, Bartlett, RC5
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    setDoc,
    deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";


///IMPORTANT
const firebaseConfig = {
    apiKey: "AIzaSyD79I-GkZu8GbHSa0s4FBfQyCqzA9a_xtk",
    authDomain: "rc5-yuxin.firebaseapp",
    projectId: "rc5-yuxin"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

export const AuthApi = {
    onAuthStateChanged,
    signInWithGoogle: () => signInWithPopup(auth, googleProvider),
    signInAnonymously: () => signInAnonymously(auth),
    signOut: () => signOut(auth),
};

export const FsApi = {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    orderBy,
    setDoc,
    deleteDoc,
};
