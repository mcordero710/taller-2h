// src/firebase/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// ⚙️ Config desde ENV (CRA solo expone REACT_APP_*)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FB_API_KEY,
  authDomain: process.env.REACT_APP_FB_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FB_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FB_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FB_APP_ID,
};

if (!firebaseConfig.apiKey) {
  // Te ayuda a detectar si faltan variables
  // (no rompe, solo avisa en consola)
  // eslint-disable-next-line no-console
  console.warn('⚠️ Firebase ENV no configuradas. Revisa tus .env o Secrets de GitHub.');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// === Funciones que ya usas ===
export const obtenerNumeroProforma = async () => {
  const docRef = doc(db, 'config', 'numeroProforma');
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().numero : 1;
};

export const actualizarNumeroProforma = async (nuevoNumero) => {
  const docRef = doc(db, 'config', 'numeroProforma');
  await setDoc(docRef, { numero: nuevoNumero });
};

// Re-export del helper de auth para no romper tus imports existentes
export { signInWithEmailAndPassword } from 'firebase/auth';
