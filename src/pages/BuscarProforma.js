import React, { useEffect, useMemo, useRef, useState } from 'react';
import './BuscarProforma.css';

import { db } from '../firebase/firebase';
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';

import { toast } from 'react-toastify';
import Pagination from '../components/Pagination/Pagination';
import { useLoading } from '../components/ui/LoadingContext';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  FiSearch,
  FiX,
  FiEdit2,
  FiCheck,
  FiClock,
  FiChevronDown,
  FiCheck as FiCheckSmall,
} from 'react-icons/fi';

const ITEMS_PER_PAGE = 10;
/* cuántas proformas calculamos por “oleada” además de la página visible */
const PREFETCH_SIZE = 40;
/* tamaño de cada lote paralelo para no saturar Firestore */
const PARALLEL_BATCH = 8;

/* Parse fechas tipo m/d/yyyy */
const convertirFecha = (fechaStr) => {
  if (!fechaStr || !String(fechaStr).includes('/')) return new Date(0);
  const [mes, dia, anio] = String(fechaStr).split('/');
  const m = String(mes).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return new Date(`${anio}-${m}-${d}T00:00:00`);
};

/* Tolerancia por redondeos de dinero */
const EPS = 0.01;

/* ----- Calcula estado de UNA proforma leyendo subcolecciones ----- */
async function calcularEstadoDe(db, p) {
  const pid = p.id;

  // 1) Abonos
  const abSnap = await getDocs(query(collection(db, 'abonos'), where('proformaId', '==', pid)));
  const totalAbonos = abSnap.docs.reduce((s, d) => s + (Number(d.data()?.monto) || 0), 0);

  // 2) Gastos
  const gSnap = await getDocs(query(collection(db, 'gastos'), where('proformaId', '==', pid)));
  const totalGastos = gSnap.docs.reduce((s, d) => s + (Number(d.data()?.monto) || 0), 0);

  // 3) Productos (factura_items)
  const itSnap = await getDocs(query(collection(db, 'factura_items'), where('proformaId', '==', pid)));
  const totalProductos = itSnap.docs.reduce((s, d) => {
    const data = d.data();
    const pu = Number(data?.precioVenta) || 0;
    const q = Number(data?.cantidad) || 0;
    return s + pu * q;
  }, 0);

  // 4) Total final = total proforma + gastos + productos
  const totalProforma = Number(p.total) || 0;
  const totalFinal = totalProforma + totalGastos + totalProductos;

  const saldoPendiente = totalFinal - totalAbonos;
  return saldoPendiente <= EPS ? 'Terminada' : 'Activa';
}

/* ----- Ejecuta promesas en lotes de tamaño fijo ----- */
async function runBatched(promisesFactories, batchSize) {
  const out = [];
  for (let i = 0; i < promisesFactories.length; i += batchSize) {
    const slice = promisesFactories.slice(i, i + batchSize).map((fn) => fn());
    const results = await Promise.all(slice);
    out.push(...results);
  }
  return out;
}

const BuscarProforma = () => {
  const [proformas, setProformas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // mapa id -> 'Terminada' | 'Activa' | null (cargando)
  const [estadoMap, setEstadoMap] = useState({});

  // Filtro de estado (all | Activa | Terminada)
  const [estadoFilter, setEstadoFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const { show, hide, withLoading } = useLoading();
  const firstLoadRef = useRef(true);
  const navigate = useNavigate();
  const location = useLocation();

  /* Restaurar estado */
  useEffect(() => {
    const restored = location.state?.backTo;
    if (restored?.route === '/buscar-proforma') {
      setSearchTerm(restored.buscar || '');
      setCurrentPage(restored.page || 1);
    }
  }, [location.state]);

  /* Suscripción a todas las proformas */
  useEffect(() => {
    show('Cargando proformas…');

    const unsub = onSnapshot(
      collection(db, 'proformas'),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  /* Filtro por término */
  const filteredBySearch = useMemo(() => {
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

  /* Filtro por estado:
     - Si seleccionas un estado, ocultamos los que aún no tienen estado calculado (evita "Calculando…" en el filtro).
     - En "Todos" mostramos todo (aunque alguno esté en cálculo). */
  const filtered = useMemo(() => {
    if (estadoFilter === 'all') return filteredBySearch;
    return filteredBySearch.filter((p) => estadoMap[p.id] === estadoFilter);
  }, [filteredBySearch, estadoFilter, estadoMap]);

  /* Paginación */
  const indexOfLast = currentPage * ITEMS_PER_PAGE;
  const current = filtered.slice(indexOfLast - ITEMS_PER_PAGE, indexOfLast);

  /* ===== Cálculo del ESTADO con prioridad a la página visible y prefetch ===== */
  useEffect(() => {
    // 1) IDs que necesitamos con mayor prioridad (página actual)
    const priority = current.map((p) => p.id);

    // 2) Si el usuario está filtrando por estado, precalcula más filas
    //    (para que el filtro responda rápido) a partir del resultado de búsqueda.
    const extraPool = [];
    if (estadoFilter !== 'all') {
      for (const p of filteredBySearch) {
        if (extraPool.length >= PREFETCH_SIZE) break;
        if (!priority.includes(p.id)) extraPool.push(p.id);
      }
    }

    const idsObjetivo = [...priority, ...extraPool].filter((id) => !(id in estadoMap));

    if (idsObjetivo.length === 0) return;

    // Marca como "en cálculo" para mostrar chip neutral mientras llegan
    const preload = Object.fromEntries(idsObjetivo.map((id) => [id, null]));
    setEstadoMap((prev) => ({ ...prev, ...preload }));

    // Fabricamos funciones por id → calcula estado y devuelve [id, estado]
    const factories = idsObjetivo.map((id) => {
      const p = (current.find((x) => x.id === id) || filteredBySearch.find((x) => x.id === id));
      return async () => {
        const estado = await calcularEstadoDe(db, p);
        return [id, estado];
      };
    });

    (async () => {
      const pairs = await runBatched(factories, PARALLEL_BATCH);
      // volcamos en el mapa de una sola
      setEstadoMap((prev) => {
        const next = { ...prev };
        for (const [id, estado] of pairs) next[id] = estado;
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, filteredBySearch, estadoFilter]);

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

  /* ===== Popover estado: cierre por click afuera / Escape ===== */
  useEffect(() => {
    const onDown = (e) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const chooseEstado = (value) => {
    setEstadoFilter(value);
    setCurrentPage(1);
    setMenuOpen(false);
  };

  const labelEstado = estadoFilter === 'all' ? 'Estado' : `Estado: ${estadoFilter}`;

  return (
    <div className="proformas-page">
      <div className="proformas-card">
        {/* Header */}
        <header className="proformas-header">
          <div>
            <h2>Proformas</h2>
            <p className="subtitle">Consulta todas las proformas del sistema.</p>
          </div>
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

                {/* Encabezado con filtro elegante */}
                <th className="th-estado">
                  <div className="estado-filter" ref={menuRef}>
                    <button
                      type="button"
                      className={`estado-filter__btn ${menuOpen ? 'is-open' : ''}`}
                      onClick={() => setMenuOpen((o) => !o)}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen ? 'true' : 'false'}
                      title="Filtrar por estado"
                    >
                      {labelEstado}
                      <FiChevronDown className="chev" aria-hidden />
                    </button>

                    {menuOpen && (
                      <div className="estado-filter__menu" role="menu">
                        <button className="estado-filter__item" role="menuitem" onClick={() => chooseEstado('all')}>
                          {estadoFilter === 'all' && <FiCheckSmall />} Todos
                        </button>
                        <button className="estado-filter__item" role="menuitem" onClick={() => chooseEstado('Activa')}>
                          {estadoFilter === 'Activa' && <FiCheckSmall />} Activas
                        </button>
                        <button className="estado-filter__item" role="menuitem" onClick={() => chooseEstado('Terminada')}>
                          {estadoFilter === 'Terminada' && <FiCheckSmall />} Terminadas
                        </button>
                      </div>
                    )}
                  </div>
                </th>

                <th className="th-actions">
                  <span className="th-actions-text">Acciones</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {current.map((p) => {
                const cliente = `${p?.cliente?.nombre || ''} ${p?.cliente?.apellido || ''}`.trim();
                const est = estadoMap[p.id]; // ya viene de cache o en cálculo
                const isDone = est === 'Terminada';
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

                    <td className="td-estado">
                      {est == null ? (
                        <span className="badge badge--loading">Calculando…</span>
                      ) : (
                        <span className={`badge ${isDone ? 'badge--done' : 'badge--active'}`}>
                          {isDone ? <FiCheck /> : <FiClock />}
                          {est}
                        </span>
                      )}
                    </td>

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
                  <td colSpan={7} className="empty">Sin resultados.</td>
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
