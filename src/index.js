import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './components/Login/Login';
import Home from './pages/Home';
import AdminPanel from './pages/AdminPanel';
import Clientes from './pages/Clientes';
import Layout from './components/Layout';
import Proforma from './pages/Proforma';
import BuscarProforma from './pages/BuscarProforma'; // Ruta para Buscar Proforma
import EditarProforma from './pages/EditarProforma'; // Ruta para Editar Proforma (componente actualizado)
import DetalleProforma from './pages/DetalleProforma'; 
import Factura from './pages/Factura';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <Router>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route path="home" element={<Home />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="proforma" element={<Proforma />} />
        <Route path="buscar-proforma" element={<BuscarProforma />} /> 
        <Route path="proforma/:id" element={<EditarProforma />} /> 
        <Route path="detalle-proforma" element={<DetalleProforma />} />
        <Route path="factura" element={<Factura />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  </Router>
);
