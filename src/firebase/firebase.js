// src/firebase/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyC4nrGxWj6XJvXwqn4GP0bE5AGg9yUDvf0',
  authDomain: 'taller-2h-4b2a1.firebaseapp.com',
  projectId: 'taller-2h-4b2a1',
  storageBucket: 'taller-2h-4b2a1.firebasestorage.app',
  messagingSenderId: '606248266110',
  appId: '1:606248266110:web:e078977af4dddc3c79ab2f',
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Obtener instancias de Firebase
const auth = getAuth(app);
const db = getFirestore(app);

// Función para obtener el número de proforma actual
const obtenerNumeroProforma = async () => {
  const docRef = doc(db, 'config', 'numeroProforma'); // Asegúrate de que este documento exista
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data().numero;
  } else {
    // Si no existe el documento, devolvemos 1
    return 1;
  }
};

// Función para actualizar el número de proforma
const actualizarNumeroProforma = async (nuevoNumero) => {
  const docRef = doc(db, 'config', 'numeroProforma'); 
  await setDoc(docRef, { numero: nuevoNumero });
};

// Exportar
export { auth, signInWithEmailAndPassword, db, obtenerNumeroProforma, actualizarNumeroProforma };
