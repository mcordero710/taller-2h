import React from 'react';
import { Link } from 'react-router-dom';
import { FaUsers, FaTruck, FaBoxes, FaTools } from 'react-icons/fa';
import logo from '../assets/logo.png';
import './Home.css';

const Home = () => {
  return (
    <div className="home-layout">
      <aside className="home-sidebar">
        <div className="home-logo-container">
          <img src={logo} alt="Taller 2H Logo" className="home-logo" />
          <h1 className="home-title">Taller 2H</h1>
        </div>
        <ul>
          <li><Link to="/clientes"><FaUsers className="menu-icon" /> Clientes</Link></li>
          <li><Link to="/proveedores"><FaTruck className="menu-icon" /> Proveedores</Link></li>
          <li><Link to="/inventario"><FaBoxes className="menu-icon" /> Inventario</Link></li>
          <li><Link to="/ordenes"><FaTools className="menu-icon" /> Órdenes de trabajo</Link></li>
        </ul>
      </aside>

      <main className="home-content">
        <h2>Bienvenido a la Página de Inicio</h2>
      </main>
    </div>
  );
};

export default Home;