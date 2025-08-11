import React, { useMemo, useState } from 'react';
import './OrdenesDeTrabajo.css';
import { toast, ToastContainer } from 'react-toastify';
import { FaSearch, FaCar, FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaHashtag } from 'react-icons/fa';
import logo from '../assets/logo.png';

import { db, auth } from '../firebase/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { useLoading } from '../components/ui/LoadingContext';

const OrdenesDeTrabajo = () => {
  const vehiculosMock = useMemo(
    () => [
      { placa: 'ABC123', marca: 'Toyota', anio: 2015, color: 'Rojo' },
      { placa: 'BCD456', marca: 'Hyundai', anio: 2018, color: 'Azul' },
      { placa: 'PQR789', marca: 'Kia', anio: 2020, color: 'Blanco' },
      { placa: 'CR123456', marca: 'Nissan', anio: 2016, color: 'Gris' },
    ],
    []
  );
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  const [placa, setPlaca] = useState('');
  const [proformaNumero, setProformaNumero] = useState('');
  const [loadingVehiculo, setLoadingVehiculo] = useState(false);
  const [vehiculo, setVehiculo] = useState(null);

  const [cono, setCono] = useState('');
  const [reparacion, setReparacion] = useState('');
  const [reparaciones, setReparaciones] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [otId, setOtId] = useState(null);

  const { withLoading } = useLoading();

  const convertirFecha = (fechaStr) => {
    if (!fechaStr || !fechaStr.includes('/')) return new Date(0);
    const [mes, dia, anio] = fechaStr.split('/');
    return new Date(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
  };

  // ===== Última OT por placa (con opción de preservar proforma en pantalla) =====
  const loadUltimaOT = async (placaUpper, opts = {}) => {
    const preserveProforma = !!opts.preserveProforma;

    setOtId(null);
    setCono('');
    setReparaciones([]);

    try {
      let snapOT = await getDocs(query(collection(db, 'ordenes_trabajo'), where('placa', '==', placaUpper)));
      if (snapOT.empty) {
        snapOT = await getDocs(query(collection(db, 'ordenes_trabajo'), where('vehiculo.placa', '==', placaUpper)));
      }
      if (!snapOT.empty) {
        const docs = snapOT.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? a.updatedAt?.toMillis?.() ?? 0;
            const tb = b.createdAt?.toMillis?.() ?? b.updatedAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        const top = docs[0];
        setOtId(top.id);
        setCono(top.numeroCono || '');

        // ⬇️ Solo actualiza proforma si la OT realmente trae valor.
        if (top.proformaNumero !== undefined && top.proformaNumero !== null) {
          setProformaNumero(String(top.proformaNumero));
        } else if (!preserveProforma) {
          // si NO queremos preservar (casos antiguos), recién entonces limpiaríamos
          setProformaNumero('');
        }

        setReparaciones(Array.isArray(top.reparaciones)
          ? top.reparaciones.map((r, i) => ({ id: `${top.id}-${i}`, texto: r.texto || String(r) }))
          : []);
      }
    } catch (err) {
      console.error('Error consultando OT:', err);
    }
  };

  // ===== Búsquedas individuales =====
  const buscarPorCono = async (coneVal, placaUpper) => {
    const snap = await getDocs(query(collection(db, 'ordenes_trabajo'), where('numeroCono', '==', coneVal)));
    if (snap.empty) return null;

    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (placaUpper) {
      docs = docs.filter(d => (d.placa || d.vehiculo?.placa || '').toUpperCase() === placaUpper);
      if (docs.length === 0) return null;
    }
    docs.sort((a, b) => {
      const ta = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const tb = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    const ot = docs[0];

    setOtId(ot.id);
    setCono(ot.numeroCono || '');
    const placaDoc = (ot.placa || ot.vehiculo?.placa || '').toUpperCase();
    setPlaca(placaDoc);
    setVehiculo({
      placa: placaDoc,
      marca: ot.vehiculo?.marca || '',
      anio: ot.vehiculo?.anio || '',
      color: ot.vehiculo?.color || '',
    });

    // ⬇️ Solo setear si existe en la OT; si no, respetamos lo que esté en pantalla.
    if (ot.proformaNumero !== undefined && ot.proformaNumero !== null) {
      setProformaNumero(String(ot.proformaNumero));
    }

    setReparaciones(Array.isArray(ot.reparaciones) ? ot.reparaciones.map((r, i) => ({ id: `${ot.id}-${i}`, texto: r.texto || String(r) })) : []);
    return ot;
  };

  const buscarPorProforma = async (proformaNum, placaUpper) => {
    if (!proformaNum) return null;
    const snap = await getDocs(query(collection(db, 'proformas'), where('numero', '==', proformaNum)));
    if (snap.empty) return null;

    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (placaUpper) {
      docs = docs.filter(p => (p.vehiculo?.placa || '').toUpperCase() === placaUpper);
      if (docs.length === 0) return null;
    }
    docs.sort((a, b) => convertirFecha(b.fecha) - convertirFecha(a.fecha));
    const p = docs[0];

    const placaDoc = (p.vehiculo?.placa || placaUpper || '').toUpperCase();
    setPlaca(placaDoc);
    setVehiculo({
      placa: placaDoc,
      marca: p.vehiculo?.marca || '',
      anio: p.vehiculo?.anio || p.vehiculo?.ano || '',
      color: p.vehiculo?.color || '',
    });
    // ⬇️ El usuario buscó por proforma: mantenla en pantalla
    setProformaNumero(String(p.numero || ''));

    if (placaDoc) await loadUltimaOT(placaDoc, { preserveProforma: true });
    return p;
  };

  const buscarPorPlaca = async (placaUpper) => {
    if (!placaUpper) return null;

    const vehRef = doc(db, 'vehiculos', placaUpper);
    const vehSnap = await getDoc(vehRef);
    if (vehSnap.exists()) {
      const v = vehSnap.data();
      setVehiculo({ placa: placaUpper, marca: v.marca || '', anio: v.anio || v.ano || '', color: v.color || '' });
      await loadUltimaOT(placaUpper, { preserveProforma: true });
      return { origen: 'vehiculos' };
    }

    const qPro = query(collection(db, 'proformas'), where('vehiculo.placa', '==', placaUpper));
    const snapPro = await getDocs(qPro);
    if (!snapPro.empty) {
      const docs = snapPro.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => convertirFecha(b.fecha) - convertirFecha(a.fecha));
      const best = docs[0];
      const info = best.vehiculo || {};
      setVehiculo({ placa: placaUpper, marca: info.marca || '', anio: info.anio || info.ano || '', color: info.color || '' });
      await loadUltimaOT(placaUpper, { preserveProforma: true });
      return { origen: 'proformas' };
    }

    const mock = vehiculosMock.find(v => v.placa.toUpperCase() === placaUpper);
    if (mock) {
      setVehiculo({ ...mock, placa: placaUpper });
      await loadUltimaOT(placaUpper, { preserveProforma: true });
      return { origen: 'mock' };
    }

    return null;
  };

  // ===== Botón Cargar datos =====
  const cargarDatos = async () => {
    const placaUpper = (placa || '').replace(/\s+/g, '').toUpperCase();
    const coneVal = (cono || '').trim();
    const pfStr = (proformaNumero || '').trim();
    const pfNum = /^\d+$/.test(pfStr) ? parseInt(pfStr, 10) : null;

    if (!coneVal && !pfNum && !placaUpper) {
      toast.info('Ingrese Nº de cono, o Nº de proforma y/o placa.');
      return;
    }

    setLoadingVehiculo(true);
    try {
      await withLoading(async () => {
        let found = null;
        if (coneVal) found = await buscarPorCono(coneVal, placaUpper);
        if (!found && pfNum) found = await buscarPorProforma(pfNum, placaUpper);
        if (!found && placaUpper) found = await buscarPorPlaca(placaUpper);

        if (!found) {
          setVehiculo(null); setOtId(null); setReparaciones([]);
          toast.info('No se encontraron datos con los criterios ingresados.', { autoClose: 2200, hideProgressBar: true });
        }
      }, 'Cargando datos…');
    } catch (e) {
      console.error('Error al cargar datos:', e);
      toast.error('Ocurrió un error al cargar los datos.');
    } finally {
      setLoadingVehiculo(false);
    }
  };

  const onEnterBuscar = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); cargarDatos(); }
  };

  // ===== Reparaciones =====
  const agregarReparacion = () => {
    const texto = (reparacion || '').trim();
    if (!texto) return;
    setReparaciones(prev => [{ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, texto }, ...prev]);
    setReparacion('');
  };

  const iniciarEdicion = (item) => { setEditingId(item.id); setEditingText(item.texto); };
  const guardarEdicion = () => {
    const texto = (editingText || '').trim(); if (!texto) return;
    setReparaciones(prev => prev.map(r => r.id === editingId ? { ...r, texto } : r));
    setEditingId(null); setEditingText('');
  };
  const cancelarEdicion = () => { setEditingId(null); setEditingText(''); };
  const eliminarReparacion = (id) => {
    toast.info(
      ({ closeToast }) => (
        <div className="toast-confirm-container">
          <p className="toast-confirm-message">¿Estás seguro de eliminar esta reparación?</p>
          <div className="toast-confirm-buttons">
            <button
              className="btn-confirm eliminar"
              onClick={async () => {
                await confirmarEliminarReparacion(id);
                closeToast();
              }}
            >
              Eliminar
            </button>
            <button
              className="btn-confirm cancelar"
              onClick={closeToast}
            >
              Cancelar
            </button>
          </div>
        </div>
      ),
      {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        closeButton: false,
        containerId: 'center-toast',
        className: 'toast-confirm-wrapper'
      }
    );
  };


  // ===== Guardar / Imprimir =====
  const puedeGuardarOT = !!vehiculo && cono.trim() && reparaciones.length > 0;

  const guardarOT = async () => {
    if (!puedeGuardarOT) {
      toast.info('Completa los datos: vehículo, número de cono y al menos una reparación.');
      return;
    }
    const user = auth?.currentUser;
    const placaNorm = (vehiculo?.placa || placa).replace(/\s+/g, '').toUpperCase();

    const payload = {
      placa: placaNorm,
      placaRaw: vehiculo?.placa || placa,
      vehiculo: { marca: vehiculo?.marca || '', anio: Number(vehiculo?.anio) || vehiculo?.anio || '', color: vehiculo?.color || '', placa: placaNorm },
      numeroCono: cono.trim(),
      reparaciones: reparaciones.map(r => ({ texto: r.texto })),
      estado: 'abierta',
      proformaNumero: proformaNumero ? Number(proformaNumero) : null,
      updatedAt: serverTimestamp(),
      createdBy: user ? { uid: user.uid, email: user.email || null } : null,
    };

    try {
      await withLoading(async () => {
        if (otId) await updateDoc(doc(db, 'ordenes_trabajo', otId), payload);
        else {
          const ref = await addDoc(collection(db, 'ordenes_trabajo'), { ...payload, createdAt: serverTimestamp() });
          setOtId(ref.id);
        }
      }, otId ? 'Actualizando orden…' : 'Guardando orden de trabajo…');
      toast.success(otId ? 'Orden actualizada.' : 'Orden creada.');
    } catch (e) {
      console.error('No se pudo guardar la orden:', e);
      toast.error('No se pudo guardar la orden de trabajo.');
    }
  };

  const imprimirOT = () => {
    if (!vehiculo || !cono.trim() || reparaciones.length === 0) {
      toast.info('Carga el vehículo, número de cono y al menos una reparación para imprimir.');
      return;
    }
    window.print();
  };

  const limpiar = () => {
    setPlaca(''); setProformaNumero('');
    setVehiculo(null); setCono(''); setReparacion('');
    setReparaciones([]); setEditingId(null); setEditingText(''); setOtId(null);
  };

  const confirmarEliminarReparacion = async (id) => {
    await withLoading(async () => {
      await nextFrame();
      setReparaciones(prev => prev.filter(r => r.id !== id));
      toast.success('Reparación eliminada', { autoClose: 2000 });
    }, 'Eliminando reparación…');
  };



  return (
    <div className="ot-wrapper">
      <ToastContainer
        enableMultiContainer
        containerId="center-toast"
        className="center-toast-container"
        newestOnTop
        closeOnClick={false}
      />
      <header className="ot-header">
        <div className="ot-header-icon"><FaCar /></div>
        <div>
          <h2 className="ot-title">Órdenes de Trabajo</h2>
          <p className="ot-subtitle">Crea la orden a partir de placa, proforma o número de cono.</p>
        </div>
      </header>

      <div className="ot-grid">
        <section className="card card--span2">
          <div className="card-header">
            <h3>Búsqueda</h3>
            <p>Puedes cargar datos por <strong>Nº de Cono</strong>, <strong>Nº de Proforma</strong> y/o <strong>Placa</strong>.</p>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="field">
                <label htmlFor="placa">Placa</label>
                <div className="input-icon">
                  <FaSearch className="icon-left" />
                  <input
                    id="placa"
                    placeholder="Ej: ABC123"
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                    onKeyDown={onEnterBuscar}
                    disabled={loadingVehiculo}
                  />
                  {loadingVehiculo && <div className="spinner" />}
                </div>
              </div>

              <div className="field" style={{ maxWidth: 200 }}>
                <label htmlFor="proforma">Nº Proforma</label>
                <input
                  id="proforma"
                  inputMode="numeric"
                  pattern="\d*"
                  placeholder="Ej: 1024"
                  value={proformaNumero}
                  onChange={(e) => setProformaNumero(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={onEnterBuscar}
                  disabled={loadingVehiculo}
                />
              </div>

              <div className="field" style={{ maxWidth: 140 }}>
                <label htmlFor="conoBusqueda">Nº Cono</label>
                <input
                  id="conoBusqueda"
                  placeholder="Ej: 27"
                  value={cono}
                  onChange={(e) => setCono(e.target.value)}
                  onKeyDown={onEnterBuscar}
                  disabled={loadingVehiculo}
                />
              </div>

              <button type="button" className="btn" onClick={cargarDatos} disabled={loadingVehiculo}>
                {loadingVehiculo ? 'Cargando…' : 'Cargar datos'}
              </button>

              {vehiculo === null && !loadingVehiculo && (placa || proformaNumero || cono) && (
                <span className="msg-warn">No se encontraron datos con los criterios ingresados.</span>
              )}
            </div>

            {vehiculo && (
              <div className="vehiculo-chipset">
                <span className="chip chip--ghost">{vehiculo.marca}</span>
                <span className="chip">{vehiculo.anio}</span>
                <span className="chip">{vehiculo.color}</span>
                <span className="chip chip--ghost">Placa: {vehiculo.placa || placa}</span>
                {proformaNumero && <span className="chip">Proforma: {proformaNumero}</span>}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h3>Datos de la Orden</h3>
            <p>Completa estos campos y agrega reparaciones.</p>
          </div>
          <div className="card-body">
            <div className="field">
              <label htmlFor="cono">Número de Cono</label>
              <div className="input-icon">
                <FaHashtag className="icon-left" />
                <input id="cono" placeholder="Ej: 27" value={cono} onChange={(e) => setCono(e.target.value)} />
              </div>
            </div>

            {/* Solo-lectura para ver la proforma detectada */}
            <div className="field">
              <label htmlFor="proformaRO">Nº Proforma (detectado)</label>
              <div className="input-icon">
                <input id="proformaRO" value={proformaNumero || ''} readOnly className="input-readonly" placeholder="—" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="reparacion">Reparación</label>
              <textarea
                id="reparacion"
                placeholder="Describe la reparación a realizar"
                value={reparacion}
                onChange={(e) => setReparacion(e.target.value)}
                disabled={!vehiculo}
                rows={4}
              />
              <div className="actions-right">
                <button type="button" className="btn btn--sm" onClick={agregarReparacion} disabled={!vehiculo || !reparacion.trim()}>
                  <FaPlus className="mr-6" /> Agregar reparación
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h3>Reparaciones</h3>
          <p>Se cargan si existe una OT previa para la placa o la OT por cono.</p>
        </div>
        <div className="card-body">
          <table className="tabla">
            <thead>
              <tr>
                <th style={{ width: 80 }}>#</th>
                <th>Descripción</th>
                <th style={{ width: 220, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reparaciones.length === 0 && (
                <tr><td colSpan={3} className="table-empty">No hay reparaciones agregadas.</td></tr>
              )}
              {reparaciones.map((r, idx) => (
                <tr key={r.id}>
                  <td className="idx">{reparaciones.length - idx}</td>
                  <td>
                    {editingId === r.id
                      ? <input className="input-inline" value={editingText} onChange={(e) => setEditingText(e.target.value)} autoFocus />
                      : <span>{r.texto}</span>}
                  </td>
                  <td className="td-actions">
                    {editingId === r.id ? (
                      <>
                        <button className="btn-icon btn-icon--ghost" onClick={guardarEdicion} aria-label="Guardar" title="Guardar"><FaSave /></button>
                        <button className="btn-icon btn-icon--ghost" onClick={cancelarEdicion} aria-label="Cancelar" title="Cancelar"><FaTimes /></button>
                      </>
                    ) : (
                      <>
                        <button className="btn-icon btn-icon--ghost" onClick={() => iniciarEdicion(r)} aria-label="Editar" title="Editar"><FaEdit /></button>
                        <button className="btn-icon btn-icon--danger" onClick={() => eliminarReparacion(r.id)} aria-label="Eliminar" title="Eliminar"><FaTrash /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="footer-actions no-print">
        <button className="btn btn--ghost btn--sm" onClick={limpiar}>Limpiar</button>
        <button className="btn btn--sm" onClick={guardarOT} disabled={!vehiculo || !cono.trim() || reparaciones.length === 0}>
          <FaSave className="mr-6" /> {otId ? 'Actualizar Orden' : 'Guardar Orden de Trabajo'}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={imprimirOT} disabled={!vehiculo || !cono.trim() || reparaciones.length === 0}>
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* ======= Vista para imprimir ======= */}
      <div id="ot-print" className="ot-print">
        <div className="otp-header">
          <img src={logo} alt="Taller 2H" className="otp-logo" />
          <div className="otp-empresa">
            <div><strong>Tel:</strong> (506) 2222-2222</div>
            <div><strong>Email:</strong> info@taller2h.com</div>
            <div><strong>Dirección:</strong> San José, Costa Rica</div>
            <div className="otp-fecha">
              <strong>Fecha:</strong>{' '}
              {new Date().toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
            </div>
          </div>
        </div>

        <h2 className="otp-title">Orden de Trabajo <span className="otp-cono">Cono: {cono}</span></h2>

        <div className="otp-datos">
          {proformaNumero && <div><strong>Proforma:</strong> {proformaNumero}</div>}
          <div><strong>Placa:</strong> {vehiculo?.placa || placa}</div>
          <div><strong>Marca:</strong> {vehiculo?.marca}</div>
          <div><strong>Año:</strong> {vehiculo?.anio}</div>
          <div><strong>Color:</strong> {vehiculo?.color}</div>
        </div>

        <table className="otp-tabla">
          <thead><tr><th style={{ width: 60 }}>#</th><th>Reparación</th></tr></thead>
          <tbody>
            {reparaciones.map((r, i) => (
              <tr key={r.id}><td>{i + 1}</td><td>{r.texto}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdenesDeTrabajo;
