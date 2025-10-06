import React, { useEffect, useMemo, useRef, useState } from 'react';
import './BuscarProforma.css';

import { db } from '../firebase/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

import { toast } from 'react-toastify';
import Pagination from '../components/Pagination/Pagination';
import { useLoading } from '../components/ui/LoadingContext';
import { useLocation, useNavigate } from 'react-router-dom';

import { FiSearch, FiX, FiEdit2 } from 'react-icons/fi';

const ITEMS_PER_PAGE = 10;

const convertirFecha = (fechaStr) => {
  // soporta "m/d/yyyy" o "mm/dd/yyyy"; si no hay fecha válida, devuelve epoch
  if (!fechaStr || !String(fechaStr).includes('/')) return new Date(0);
  const [mes, dia, anio] = String(fechaStr).split('/');
  const m = String(mes).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return new Date(`${anio}-${m}-${d}T00:00:00`);
};

const BuscarProforma = () => {
  const [proformas, setProformas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { show, hide, withLoading } = useLoading();
  const firstLoadRef = useRef(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Restaurar estado (volver desde detalle)
  useEffect(() => {
    const restored = location.state?.backTo;
    if (restored?.route === '/buscar-proforma') {
      setSearchTerm(restored.buscar || '');
      setCurrentPage(restored.page || 1);
    }
  }, [location.state]);

  // Suscripción a todas las proformas
  useEffect(() => {
    show('Cargando proformas…');

    const unsub = onSnapshot(
      collection(db, 'proformas'),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // ordenar por fecha descendente y luego por número
        data.sort((a, b) => {
          const f = convertirFecha(b.fecha) - convertirFecha(a.fecha);
          if (f !== 0) return f;
          return (b.numero || 0) - (a.numero || 0);
        });
        setProformas(data);

        if (firstLoadRef.current) {
          hide();
          firstLoadRef.current = false;
        }
      },
      (err) => {
        console.error('Error al cargar proformas:', err);
        toast.error('No se pudieron cargar las proformas.');
        hide();
      }
    );

    return () => unsub();
  }, [show, hide]);

  // Filtro por término (número, cédula, nombre, apellido, placa)
  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return proformas;

    return proformas.filter((p) => {
      const numero = String(p.numero ?? '').toLowerCase();
      const cedula = String(p?.cliente?.cedula ?? '').toLowerCase();
      const nombre = String(p?.cliente?.nombre ?? '').toLowerCase();
      const apellido = String(p?.cliente?.apellido ?? '').toLowerCase();
      const placa = String(p?.vehiculo?.placa ?? '').toLowerCase();

      return (
        numero.includes(t) ||
        cedula.includes(t) ||
        nombre.includes(t) ||
        apellido.includes(t) ||
        placa.includes(t)
      );
    });
  }, [proformas, searchTerm]);

  // Paginación
  const indexOfLast = currentPage * ITEMS_PER_PAGE;
  const current = filtered.slice(indexOfLast - ITEMS_PER_PAGE, indexOfLast);

  const clearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  const openDetalle = async (proforma) => {
    await withLoading(async () => {
      navigate('/detalle-proforma', {
        state: {
          proforma,
          backTo: {
            route: '/buscar-proforma',
            buscar: searchTerm,
            page: currentPage,
          },
        },
      });
    }, 'Abriendo proforma…');
  };

  return (
    <div className="proformas-page">
      <div className="proformas-card">
        {/* Header */}
        <header className="proformas-header">
          <div>
            <h2>Proformas</h2>
            <p className="subtitle">Consulta todas las proformas del sistema.</p>
          </div>
          {/* (Sin botón Agregar) */}
        </header>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search">
            <FiSearch className="search-icon" aria-hidden />
            <input
              className="search-input"
              type="text"
              placeholder="Buscar por número, cédula, cliente, placa…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            {searchTerm && (
              <button className="search-clear" onClick={clearSearch} aria-label="Limpiar búsqueda">
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
          <table className="tabla-proformas">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cédula</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Placa</th>
                <th className="th-actions">
                  <span className="th-actions-text">Acciones</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {current.map((p) => {
                const cliente = `${p?.cliente?.nombre || ''} ${p?.cliente?.apellido || ''}`.trim();
                return (
                  <tr
                    key={p.id}
                    onDoubleClick={() => openDetalle(p)}
                    style={{ cursor: 'pointer' }}
                    title="Doble clic para ver/editar"
                  >
                    <td>{p.numero ?? '—'}</td>
                    <td>{p?.cliente?.cedula || '—'}</td>
                    <td>{cliente || '—'}</td>
                    <td>{p.fecha || '—'}</td>
                    <td>{p?.vehiculo?.placa || '—'}</td>
                    <td className="td-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => openDetalle(p)}
                        aria-label="Ver / Editar"
                        title="Ver / Editar"
                      >
                        <FiEdit2 />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {current.length === 0 && (
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
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default BuscarProforma;
