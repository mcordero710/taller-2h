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
  const clientsPerPage = 10;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'clientes'), (snapshot) => {
      const datos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClientes(datos);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  // 🔢 Lógica de paginación
  const indexOfLastClient = currentPage * clientsPerPage;
  const indexOfFirstClient = indexOfLastClient - clientsPerPage;
  const currentClients = clientes.slice(indexOfFirstClient, indexOfLastClient);

  return (
    <div className="clientes-layout clientes-expandido">
      <h2>Gestión de Clientes</h2>
      <button className="boton-agregar" onClick={() => setShowModal(true)}>
        + Agregar Cliente
      </button>

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

      {/* Paginación */}
      <Pagination
        currentPage={currentPage}
        totalItems={clientes.length}
        itemsPerPage={clientsPerPage}
        onPageChange={setCurrentPage}
      />


      {/* Modal para nuevo cliente */}
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
                onChange={handleChange}
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
                required
              />
              <input
                type="text"
                name="telefono"
                placeholder="Teléfono"
                value={formData.telefono}
                onChange={handleChange}
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
