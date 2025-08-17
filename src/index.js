import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './components/Login/Login';
import Home from './pages/Home';
import AdminPanel from './pages/AdminPanel';
import Clientes from './pages/Clientes';
import Layout from './components/Layout';
import Proforma from './pages/Proforma';
import BuscarProforma from './pages/BuscarProforma';
import EditarProforma from './pages/EditarProforma';
import DetalleProforma from './pages/DetalleProforma';
import Factura from './pages/Factura';
import OrdenesDeTrabajo from './pages/OrdenesDeTrabajo';

import { LoadingProvider } from './components/ui/LoadingContext';
import './components/ui/Loader.css';

/* ✅ SOLO UNA VEZ estos imports */
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/firebase';   // <- OJO a la ruta correcta

// 🔐 Wrapper que exige sesión
function RequireAuth({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setReady(true);
  }), []);

  if (!ready) return null; // aquí puedes renderizar tu Loader global si quieres
  return user ? children : <Navigate to="/login" replace />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <LoadingProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="home" element={<Home />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="proforma" element={<Proforma />} />
          <Route path="buscar-proforma" element={<BuscarProforma />} />
          <Route path="proforma/:id" element={<EditarProforma />} />
          <Route path="detalle-proforma" element={<DetalleProforma />} />
          <Route path="factura" element={<Factura />} />
          <Route path="ordenes" element={<OrdenesDeTrabajo />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  </LoadingProvider>
);
