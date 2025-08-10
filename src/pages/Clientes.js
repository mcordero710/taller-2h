import React, { useState, useEffect, useRef } from 'react'; // <- + useRef
import './Clientes.css';
import { db } from '../firebase/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import Pagination from '../components/Pagination/Pagination';
import { useLoading } from '../components/ui/LoadingContext'; // <- NEW: loader global

const Clientes = () => {
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
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

  // NEW: loader
  const { show, hide, withLoading } = useLoading();
  const firstLoadRef = useRef(true); // para ocultar el loader solo la primera vez

  useEffect(() => {
    // mostrar loader mientras llega el primer snapshot
    show('Cargando clientes…');

    const unsubscribe = onSnapshot(
      collection(db, 'clientes'),
      (snapshot) => {
        const datos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setClientes(datos);

        if (firstLoadRef.current) {
          hide();
          firstLoadRef.current = false;
        }
      },
      (error) => {
        console.error('Error al cargar clientes:', error);
        toast.error('No se pudieron cargar los clientes.');
        hide();
      }
    );

    return () => unsubscribe();
  }, [show, hide]);

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

  const handleEdit = (cliente) => {
    setFormData({
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      correo: cliente.correo,
    });
    setSelectedClientId(cliente.id);
    setEditMode(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.cedula || !formData.nombre || !formData.telefono) {
      toast.error('Por favor, completa los campos obligatorios: cédula, nombre y teléfono.');
      return;
    }

    try {
      await withLoading(async () => {
        if (editMode) {
          const clienteRef = doc(db, 'clientes', selectedClientId);
          await updateDoc(clienteRef, formData);
          toast.success('¡Cliente actualizado con éxito!');
        } else {
          await addDoc(collection(db, 'clientes'), formData);
          toast.success('¡Cliente agregado con éxito!');
        }
      }, editMode ? 'Actualizando cliente…' : 'Guardando cliente…');

      setFormData({ cedula: '', nombre: '', apellido: '', telefono: '', correo: '' });
      setEditMode(false);
      setSelectedClientId(null);
      setShowModal(false);
    } catch (error) {
      console.error('Error al guardar el cliente:', error);
      toast.error('Error al guardar el cliente');
    }
  };

  const filteredClients = clientes
    .filter((cliente) =>
      Object.values(cliente).some(
        (valor) =>
          typeof valor === 'string' &&
          valor.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );

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
        <button className="boton-agregar" onClick={() => {
          setEditMode(false);
          setFormData({ cedula: '', nombre: '', apellido: '', telefono: '', correo: '' });
          setShowModal(true);
        }}>
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
            <tr
              key={cliente.id}
              onDoubleClick={() => handleEdit(cliente)}
              style={{ cursor: 'pointer' }}
            >
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
            <h3>{editMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
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
                <button type="submit">
                  {editMode ? 'Guardar cambios' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="cancelar"
                  onClick={() => {
                    setShowModal(false);
                    setEditMode(false);
                    setFormData({ cedula: '', nombre: '', apellido: '', telefono: '', correo: '' });
                    setSelectedClientId(null);
                  }}
                >
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
