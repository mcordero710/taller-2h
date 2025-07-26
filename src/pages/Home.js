// src/Home.js
import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="home-container">
      <h1>Bienvenido a la Página de Inicio</h1>
      <nav>
        <ul>
          <li>
            <Link to="/admin">Panel de Administración</Link>
          </li>
          <li>
            <Link to="/profile">Mi Perfil</Link> {/* Agregar más enlaces si lo necesitas */}
          </li>
          <li>
            <Link to="/settings">Configuraciones</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Home;
