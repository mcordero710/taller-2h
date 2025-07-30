import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'; // ← Agregamos los métodos necesarios

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

// Función para obtener e incrementar el número de proforma
const obtenerNumeroProforma = async () => {
  const proformaRef = doc(db, 'contadores', 'proforma'); // Referencia al documento que guarda el contador de proformas
  const docSnap = await getDoc(proformaRef);

  if (!docSnap.exists()) {
    // Si no existe, creamos el contador con el valor inicial (0000001)
    await setDoc(proformaRef, { proforma: 1 });
    return '0000001';
  } else {
    // Si existe, incrementamos el número de proforma
    const siguienteNumero = docSnap.data().proforma + 1;
    await updateDoc(proformaRef, { proforma: siguienteNumero });

    // Formatear el número con ceros a la izquierda (7 dígitos)
    return String(siguienteNumero).padStart(7, '0');
  }
};

// Exportar instancias y funciones necesarias
export { auth, signInWithEmailAndPassword, db, obtenerNumeroProforma };
