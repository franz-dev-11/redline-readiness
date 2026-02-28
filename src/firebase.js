import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "REDACTED_API_KEY",
  authDomain: "redline-readiness.firebaseapp.com",
  projectId: "redline-readiness",
  storageBucket: "redline-readiness.firebasestorage.app",
  messagingSenderId: "181606770054",
  appId: "1:181606770054:web:494ebf17b3cb2cbde97807",
  measurementId: "G-804YRRJQXT"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);