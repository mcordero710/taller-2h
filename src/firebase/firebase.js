// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

// Obtener la instancia de autenticación
const auth = getAuth(app);

export { auth, signInWithEmailAndPassword };  // Exporta para usar en el login
