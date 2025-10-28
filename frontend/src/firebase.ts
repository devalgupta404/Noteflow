// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDN2mBpSwxb9Xng_VVf84U1339w46E1vXw",
  authDomain: "noteflow-941ab.firebaseapp.com",
  projectId: "noteflow-941ab",
  storageBucket: "noteflow-941ab.firebasestorage.app",
  messagingSenderId: "59757267195",
  appId: "1:59757267195:web:8a2b43a746588b1a96885e",
  measurementId: "G-F3WTXKQELD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
