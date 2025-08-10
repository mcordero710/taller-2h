import React, { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '../../firebase/firebase';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Login.css';

// 👇 Ajusta la ruta según dónde esté tu Login.js.
// Si tu Login.js está en src/pages/Login.js, esta ruta funciona:
import logo from '../../assets/logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const showErrorMessage = (message) => {
    toast.error(message, {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      transition: Slide,
    });
  };

  const getErrorMessage = (code) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.';
      case 'auth/missing-email':
        return 'Por favor, ingresa tu correo electrónico.';
      case 'auth/internal-error':
        return 'Error interno. Intenta de nuevo.';
      case 'auth/wrong-password':
        return 'La contraseña es incorrecta.';
      case 'auth/user-not-found':
        return 'No existe una cuenta con ese correo.';
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Correo o contraseña incorrectos.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intenta más tarde.';
      default:
        return 'Ocurrió un error. Intenta nuevamente.';
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch (error) {
      const errorMessage = getErrorMessage(error.code);
      showErrorMessage(errorMessage);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="form-box">
          {/* 👇 Logo dentro del contenedor */}
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
              />
            </div>
            <div className="form-field">
              <label>Contraseña:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit">Iniciar Sesión</button>
          </form>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
};

export default Login;
