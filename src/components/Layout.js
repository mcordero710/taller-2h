import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { FaUsers, FaTruck, FaBoxes, FaTools, FaFileAlt } from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Layout.css';
import logo from '../assets/logo.png';

const Layout = () => {
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
                <span>Crear Proforma</span>
              </Link>
            </li>
            <li>
              <Link to="/proveedores">
                <FaTruck className="menu-icon" />
                <span>Proveedores</span>
              </Link>
            </li>
            <li>
              <Link to="/inventario">
                <FaBoxes className="menu-icon" />
                <span>Inventario</span>
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
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      {/* Contenedor de notificaciones */}
      <ToastContainer position="top-center" autoClose={3000} />
    </div>
  );
};

export default Layout;
