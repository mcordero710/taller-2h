import React, { useState, useEffect, useRef } from 'react';
import './Clientes.css';

import { db } from '../firebase/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore';

import { toast } from 'react-toastify';
import Pagination from '../components/Pagination/Pagination';
import { useLoading } from '../components/ui/LoadingContext';

import { FiSearch, FiX, FiEdit2 } from 'react-icons/fi';

const Clientes = () => {
  // UI state
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    cedula: '',
    nombre: '',
    apellido: '',
    telefono: '',
    correo: '',
  });

  // Data state
  const [clientes, setClientes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const clientsPerPage = 10;

  // Loader helpers
  const { show, hide, withLoading } = useLoading();
  const firstLoadRef = useRef(true);

  // Initial load (subscribe to collection)
  useEffect(() => {
    show('Cargando clientes…');

    const unsubscribe = onSnapshot(
      collection(db, 'clientes'),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setClientes(data);

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

  // Handlers
  const handleNumberOnlyChange = (e) => {
    const { name, value } = e.target;
    const max = { cedula: 9, telefono: 8 };
    let v = value.replace(/\D/g, '');
    if (max[name]) v = v.slice(0, max[name]);
    setFormData(prev => ({ ...prev, [name]: v }));
  };

  const handleChange = (e) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const openCreate = () => {
    setEditMode(false);
    setSelectedClientId(null);
    setFormData({ cedula: '', nombre: '', apellido: '', telefono: '', correo: '' });
    setShowModal(true);
  };

  const handleEdit = (cliente) => {
    setFormData({
      cedula: cliente.cedula || '',
      nombre: cliente.nombre || '',
      apellido: cliente.apellido || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
    });
    setSelectedClientId(cliente.id);
    setEditMode(true);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.cedula || !formData.nombre || !formData.telefono) {
      toast.error('Completa cédula, nombre y teléfono.');
      return;
    }

    try {
      await withLoading(async () => {
        if (editMode) {
          const ref = doc(db, 'clientes', selectedClientId);
          await updateDoc(ref, formData);
          toast.success('Cliente actualizado');
        } else {
          await addDoc(collection(db, 'clientes'), formData);
          toast.success('Cliente agregado');
        }
      }, editMode ? 'Actualizando cliente…' : 'Guardando cliente…');

      setShowModal(false);
      setEditMode(false);
      setSelectedClientId(null);
      setFormData({ cedula: '', nombre: '', apellido: '', telefono: '', correo: '' });
    } catch (err) {
      console.error('Error al guardar:', err);
      toast.error('Error al guardar el cliente');
    }
  };

  const clearSearch = () => setSearchTerm('');

  // Filter + sort + paginate
  const filtered = clientes
    .filter((c) =>
      Object.values(c).some(
        (val) => typeof val === 'string' && val.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

  const indexOfLast = currentPage * clientsPerPage;
  const currentClients = filtered.slice(indexOfLast - clientsPerPage, indexOfLast);

  return (
    <div className="clientes-page">
      <div className="clientes-card">
        {/* Header */}
        <header className="clientes-header">
          <div>
            <h2>Gestión de Clientes</h2>
            <p className="subtitle">
              Administra tu base de clientes. Doble clic en una fila para editar.
            </p>
          </div>

          <button className="boton-agregar boton-agregar--sm" onClick={openCreate}>
            Agregar Cliente
          </button>
        </header>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search">
            <FiSearch className="search-icon" aria-hidden />
            <input
              className="search-input"
              type="text"
              placeholder="Buscar por cédula, nombre, correo…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            {searchTerm && (
              <button
                className="search-clear"
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
              >
                <FiX />
              </button>
            )}
          </div>

          <div className="counter">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Tabla */}
        <div className="table-wrap">
          <table className="tabla-clientes">
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th className="th-actions is-center">
                  <span className="th-actions-text">Editar</span>
                </th>
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
                  <td className="email-cell">{cliente.correo}</td>
                  <td className="td-actions">
                    <button
                      type="button"
                      className="btn-icon btn-icon--edit"
                      onClick={() => handleEdit(cliente)}
                      aria-label="Editar"
                      title="Editar"
                    >
                      <FiEdit2 />
                    </button>
                  </td>
                </tr>
              ))}

              {currentClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">Sin resultados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={clientsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{editMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button
                className="btn-icon"
                onClick={() => setShowModal(false)}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>
              <label>
                <span>Cédula</span>
                <input
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleNumberOnlyChange}
                  inputMode="numeric"
                  required
                />
              </label>

              <label>
                <span>Nombre</span>
                <input
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                <span>Apellido</span>
                <input
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                />
              </label>

              <label>
                <span>Teléfono</span>
                <input
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleNumberOnlyChange}
                  inputMode="numeric"
                  required
                />
              </label>

              <label className="span-2">
                <span>Correo</span>
                <input
                  type="email"
                  name="correo"
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="nombre@correo.com"
                />
              </label>

              <div className="modal-actions span-2">
                <button
                  type="button"
                  className="btn-light cancelar"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editMode ? 'Guardar cambios' : 'Guardar'}
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
