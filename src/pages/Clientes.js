import React, { useState, useEffect } from 'react';
import './Clientes.css';
import { db } from '../firebase/firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-toastify';
import Pagination from '../components/Pagination/Pagination';

const Clientes = () => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    cedula: '',
    nombre: '',
    apellido: '',
    telefono: '',
    correo: '',
  });
  const [clientes, setClientes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const clientsPerPage = 10;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      const datos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClientes(datos);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Solo permite números en cédula y teléfono + limita longitud
  const handleNumberOnlyChange = (e) => {
    const { name, value } = e.target;
    const maxLengths = { cedula: 9, telefono: 8 };
    let numericValue = value.replace(/\D/g, '');
    if (maxLengths[name]) {
      numericValue = numericValue.slice(0, maxLengths[name]);
    }
    setFormData({ ...formData, [name]: numericValue });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cedula || !formData.nombre || !formData.telefono) {
      toast.error('Por favor, completa los campos obligatorios: cédula, nombre y teléfono.');
      return;
    }

    try {
      await addDoc(collection(db, 'clientes'), formData);
      setFormData({ cedula: '', nombre: '', apellido: '', telefono: '', correo: '' });
      setShowModal(false);
      toast.success('¡Cliente agregado con éxito!');
    } catch (error) {
      console.error('Error al guardar el cliente:', error);
      toast.error('Error al guardar el cliente');
    }
  };

  // 🔍 Filtrar clientes por cualquier campo
  const filteredClients = clientes.filter((cliente) =>
    Object.values(cliente).some((valor) =>
      typeof valor === 'string' &&
      valor.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // 🔢 Paginación
  const indexOfLastClient = currentPage * clientsPerPage;
  const indexOfFirstClient = indexOfLastClient - clientsPerPage;
  const currentClients = filteredClients.slice(indexOfFirstClient, indexOfLastClient);

  return (
    <div className="clientes-layout clientes-expandido">
      <h2>Gestión de Clientes</h2>

      <div className="barra-superior">
        <div className="contenedor-busqueda">
          <span className="icono-lupa">🔍</span>
          <input
            type="text"
            className="input-busqueda"
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="boton-agregar" onClick={() => setShowModal(true)}>
          + Agregar Cliente
        </button>
      </div>

      <table className="tabla-clientes">
        <thead>
          <tr>
            <th>Cédula</th>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Teléfono</th>
            <th>Correo</th>
          </tr>
        </thead>
        <tbody>
          {currentClients.map((cliente) => (
            <tr key={cliente.id}>
              <td>{cliente.cedula}</td>
              <td>{cliente.nombre}</td>
              <td>{cliente.apellido}</td>
              <td>{cliente.telefono}</td>
              <td>{cliente.correo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredClients.length}
        itemsPerPage={clientsPerPage}
        onPageChange={setCurrentPage}
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Nuevo Cliente</h3>
            <form onSubmit={handleSubmit} className="formulario">
              <input
                type="text"
                name="cedula"
                placeholder="Cédula"
                value={formData.cedula}
                onChange={handleNumberOnlyChange}
                required
              />
              <input
                type="text"
                name="nombre"
                placeholder="Nombre"
                value={formData.nombre}
                onChange={handleChange}
                required
              />
              <input
                type="text"
                name="apellido"
                placeholder="Apellido"
                value={formData.apellido}
                onChange={handleChange}
              />
              <input
                type="text"
                name="telefono"
                placeholder="Teléfono"
                value={formData.telefono}
                onChange={handleNumberOnlyChange}
                required
              />
              <input
                type="email"
                name="correo"
                placeholder="Correo electrónico"
                value={formData.correo}
                onChange={handleChange}
              />
              <div className="acciones">
                <button type="submit">Guardar</button>
                <button type="button" onClick={() => setShowModal(false)} className="cancelar">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;
