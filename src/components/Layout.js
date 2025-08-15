import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { FaUsers, FaTools, FaFileAlt, FaSearch, FaFileInvoice, FaSignOutAlt } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import 'react-toastify/dist/ReactToastify.css';
import './Layout.css';
import logo from '../assets/logo.png';

const Layout = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (e) {
      toast.error('No se pudo cerrar sesión');
    }
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo-container">
          <img src={logo} alt="Taller 2H" className="logo" />
          <span className="logo-text">Taller 2H</span>
        </div>

        <nav>
          <ul>
            <li>
              <Link to="/clientes">
                <FaUsers className="menu-icon" />
                <span>Clientes</span>
              </Link>
            </li>
            <li>
              <Link to="/proforma">
                <FaFileAlt className="menu-icon" />
                <span>Proforma</span>
              </Link>
            </li>
            <li>
              <Link to="/buscar-proforma">
                <FaSearch className="menu-icon" />
                <span>Buscar Proforma</span>
              </Link>
            </li>
            <li>
              <Link to="/factura">
                <FaFileInvoice className="menu-icon" />
                <span>Factura</span>
              </Link>
            </li>
            <li>
              <Link to="/ordenes">
                <FaTools className="menu-icon" />
                <span>Órdenes de trabajo</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* --- Cerrar sesión al fondo --- */}
        <div className="sidebar-logout">
          <button className="logout-link" onClick={handleLogout}>
            <FaSignOutAlt className="menu-icon menu-icon--sm" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <ToastContainer
        position="top-center"
        autoClose={2500}
        hideProgressBar
        closeButton={false}
        closeOnClick
        pauseOnHover={false}
        draggable={false}
      />
    </div>
  );
};

export default Layout;
