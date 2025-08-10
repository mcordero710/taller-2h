import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '../../firebase/firebase';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Login.css';
import logo from '../../assets/logo.png';

// 👇 NEW: loader global
import { useLoading } from '../ui/LoadingContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // evita doble submit
  const navigate = useNavigate();
  const { withLoading } = useLoading(); // ← usamos el helper

  const showErrorMessage = (message) => {
    toast.error(message, {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      transition: Slide,
    });
  };

  const getErrorMessage = (code) => {
    switch (code) {
      case 'auth/invalid-email': return 'El correo electrónico no es válido.';
      case 'auth/missing-email': return 'Por favor, ingresa tu correo electrónico.';
      case 'auth/internal-error': return 'Error interno. Intenta de nuevo.';
      case 'auth/wrong-password': return 'La contraseña es incorrecta.';
      case 'auth/user-not-found': return 'No existe una cuenta con ese correo.';
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials': return 'Correo o contraseña incorrectos.';
      case 'auth/too-many-requests': return 'Demasiados intentos. Intenta más tarde.';
      default: return 'Ocurrió un error. Intenta nuevamente.';
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await withLoading(async () => {
        await signInWithEmailAndPassword(auth, email, password);
        // Navegamos dentro del withLoading para que el overlay se vea hasta cambiar de página
        navigate('/home');
      }, 'Iniciando sesión…');
    } catch (error) {
      const errorMessage = getErrorMessage(error.code);
      showErrorMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="form-box">
          <img src={logo} alt="Logo Taller 2H" className="logo-login" />
          <h2>TALLER 2H</h2>

          <form onSubmit={handleLogin}>
            <div className="form-field">
              <label>Correo Electrónico:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="form-field">
              <label>Contraseña:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando…' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default Login;
