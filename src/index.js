// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './components/Login/Login';
import Home from './pages/Home';
import AdminPanel from './pages/AdminPanel';
import Clientes from './pages/Clientes';
import Layout from './components/Layout';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <Router>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route path="home" element={<Home />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="admin" element={<AdminPanel />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  </Router>
);
