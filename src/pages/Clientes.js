import React, { useState, useEffect, useRef } from 'react';
import './Clientes.css';

import { db } from '../firebase/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { toast } from 'react-toastify';
import Pagination from '../components/Pagination/Pagination';
import { useLoading } from '../components/ui/LoadingContext';

import { FiSearch, FiX, FiEdit2 } from 'react-icons/fi';

const Clientes = () => {
  // UI state
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [touched, setTouched] = useState({ cedula: false });

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

  // Flags para deshabilitar UI mientras hay tareas
  const [isCheckingCedula, setIsCheckingCedula] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const busy = isCheckingCedula || isSaving;

  // Helper: estado vacío del form
  const emptyForm = { cedula: '', nombre: '', apellido: '', telefono: '', correo: '' };

  // ✅ Cerrar modal y resetear estados (incluye error)
  const closeModal = () => {
    setShowModal(false);
    setEditMode(false);
    setSelectedClientId(null);
    setTouched({ cedula: false });
    setFormData(emptyForm);
  };

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
    if (busy) return;
    setEditMode(false);
    setSelectedClientId(null);
    setTouched({ cedula: false });      // 👈 limpia error al abrir
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleEdit = (cliente) => {
    if (busy) return;
    setTouched({ cedula: false });      // 👈 limpia error al editar
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

  // === Validación de cédula única (local + Firestore) ===
  const cedulaExiste = async (cedula, omitId = null) => {
    const ced = (cedula || '').trim();
    // Chequeo local
    const existeLocal = clientes.some(
      (c) => (c.cedula || '').trim() === ced && c.id !== omitId
    );
    if (existeLocal) return true;

    // Doble chequeo remoto
    const qRef = query(collection(db, 'clientes'), where('cedula', '==', ced));
    const snap = await getDocs(qRef);
    const existeRemoto = snap.docs.some((d) => d.id !== omitId);
    return existeRemoto;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // validación de formato (9 dígitos)
    if (formData.cedula.length !== 9) {
      setTouched(t => ({ ...t, cedula: true }));
      return; // no seguimos hasta que sea válido
    }

    if (!formData.nombre || !formData.telefono) {
      toast.error('Completa cédula, nombre y teléfono.');
      return;
    }

    // 1) Validar unicidad con loader
    setIsCheckingCedula(true);
    const duplicada = await withLoading(
      () => cedulaExiste(formData.cedula, editMode ? selectedClientId : null),
      'Validando cédula…'
    ).catch(() => false);
    setIsCheckingCedula(false);

    if (duplicada) {
      toast.error('La cédula ya existe en el sistema.');
      return;
    }

    // 2) Guardar con loader
    try {
      setIsSaving(true);
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

      // Puedes dejar tu lógica actual o usar closeModal(); ambas limpian estado.
      closeModal();
    } catch (err) {
      console.error('Error al guardar:', err);
      toast.error('Error al guardar el cliente');
    } finally {
      setIsSaving(false);
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

  // 👉 Formateador visual: x-xxxx-xxxx (sin cambiar lo que guardas)
  const formatCedula = (digits = '') => {
    const s = String(digits).replace(/\D/g, '').slice(0, 9);
    const p1 = s.slice(0, 1);
    const p2 = s.slice(1, 5);
    const p3 = s.slice(5, 9);
    if (!p1) return '';
    if (s.length <= 1) return p1;
    if (s.length <= 5) return `${p1}-${p2}`;
    return `${p1}-${p2}-${p3}`;
  };

  return (
    <div className="clientes-page">
      <div className="clientes-card" aria-busy={busy}>
        {/* Header */}
        <header className="clientes-header">
          <div>
            <h2>Gestión de Clientes</h2>
            <p className="subtitle">
              Administra tu base de clientes. Doble clic en una fila para editar.
            </p>
          </div>

          <button
            className="boton-agregar boton-agregar--sm"
            onClick={openCreate}
            disabled={busy}
          >
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
              disabled={busy}
            />
            {searchTerm && (
              <button
                className="search-clear"
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
                disabled={busy}
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
                  <span className="th-actions-text">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {currentClients.map((cliente) => (
                <tr
                  key={cliente.id}
                  onDoubleClick={() => !busy && handleEdit(cliente)}
                  style={{ cursor: busy ? 'default' : 'pointer' }}
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
                      disabled={busy}
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
          onPageChange={(p) => !busy && setCurrentPage(p)}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && closeModal()}  // 👈 cerrar y resetear
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{editMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button
                className="btn-icon"
                onClick={closeModal}             // 👈 cerrar y resetear
                aria-label="Cerrar"
                disabled={busy}
              >
                <FiX />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>
              <label className="span-2 cedula-field">
                <span>Cédula</span>
                <input
                  name="cedula"
                  value={formatCedula(formData.cedula)}     // muestra con guiones
                  onChange={handleNumberOnlyChange}         // guarda solo dígitos (máx 9)
                  onBlur={() => setTouched(t => ({ ...t, cedula: true }))}  // marca como “tocado”
                  inputMode="numeric"
                  //placeholder="x-xxxx-xxxx"
                  aria-describedby={`help-cedula${touched.cedula && formData.cedula.length !== 9 ? ' error-cedula' : ''}`}
                  aria-invalid={touched.cedula && formData.cedula.length !== 9 ? 'true' : 'false'}
                  required
                  disabled={busy || editMode}               // si editas, no permitir cambiar cédula
                  className={touched.cedula && formData.cedula.length !== 9 ? 'input--error' : ''}
                />
                <small id="help-cedula" className="field-hint">Formato: x-xxxx-xxxx</small>
                {touched.cedula && formData.cedula.length !== 9 && !editMode && (
                  <small id="error-cedula" className="field-error">
                    La cédula no tiene el formato correcto (debe tener 9 dígitos).
                  </small>
                )}
              </label>

              <label>
                <span>Nombre</span>
                <input
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                  disabled={busy}
                />
              </label>

              <label>
                <span>Apellido</span>
                <input
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                  disabled={busy}
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
                  disabled={busy}
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
                  disabled={busy}
                />
              </label>

              <div className="modal-actions span-2">
                <button
                  type="button"
                  className="btn-light cancelar"
                  onClick={closeModal}           // 👈 cerrar y resetear
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {isSaving
                    ? 'Guardando…'
                    : editMode
                      ? 'Guardar cambios'
                      : 'Guardar'}
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
