import React, { useMemo, useState } from 'react';
import './OrdenesDeTrabajo.css';
import { toast } from 'react-toastify';
import { FaSearch, FaCar, FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaHashtag } from 'react-icons/fa';
import logo from '../assets/logo.png';

// 🔥 Firebase
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

// ⏳ Loader global
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

  const [placa, setPlaca] = useState('');
  const [loadingVehiculo, setLoadingVehiculo] = useState(false);
  const [vehiculo, setVehiculo] = useState(null);

  const [cono, setCono] = useState('');
  const [reparacion, setReparacion] = useState('');
  const [reparaciones, setReparaciones] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [otId, setOtId] = useState(null); // uso interno, no se imprime

  const { withLoading } = useLoading();

  const convertirFecha = (fechaStr) => {
    if (!fechaStr || !fechaStr.includes('/')) return new Date(0);
    const [mes, dia, anio] = fechaStr.split('/');
    return new Date(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
  };

  const loadUltimaOT = async (placaUpper) => {
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
        setReparaciones(Array.isArray(top.reparaciones)
          ? top.reparaciones.map((r, i) => ({ id: `${top.id}-${i}`, texto: r.texto || String(r) }))
          : []);
      }
    } catch (err) {
      console.error('Error consultando OT:', err);
    }
  };

  const buscarVehiculo = async () => {
    const term = (placa || '').replace(/\s+/g, '').toUpperCase();
    if (!term) return;

    setLoadingVehiculo(true);
    try {
      await withLoading(async () => {
        let vehEncontrado = null;

        const vehRef = doc(db, 'vehiculos', term);
        const vehSnap = await getDoc(vehRef);
        if (vehSnap.exists()) {
          const v = vehSnap.data();
          vehEncontrado = { placa: term, marca: v.marca || '', anio: v.anio || v.ano || '', color: v.color || '' };
        } else {
          const qPro = query(collection(db, 'proformas'), where('vehiculo.placa', '==', term));
          const snapPro = await getDocs(qPro);
          if (!snapPro.empty) {
            const docs = snapPro.docs.map(d => ({ id: d.id, ...d.data() }))
              .sort((a, b) => convertirFecha(b.fecha) - convertirFecha(a.fecha));
            const best = docs[0];
            const info = best.vehiculo || {};
            vehEncontrado = { placa: term, marca: info.marca || '', anio: info.anio || info.ano || '', color: info.color || '' };
          } else {
            const mock = vehiculosMock.find(v => v.placa.toUpperCase() === term);
            if (mock) vehEncontrado = { ...mock, placa: term };
          }
        }

        if (!vehEncontrado) {
          setVehiculo(null); setOtId(null); setCono(''); setReparaciones([]);
          toast.info('No se encontró un vehículo con esa placa.', { autoClose: 2200, hideProgressBar: true });
          return;
        }

        setVehiculo(vehEncontrado);
        await loadUltimaOT(term);
      }, 'Buscando vehículo…');
    } catch (e) {
      console.error('Error al buscar vehículo:', e);
      toast.error('Error al buscar el vehículo.');
      setVehiculo(null); setOtId(null); setCono(''); setReparaciones([]);
    } finally {
      setLoadingVehiculo(false);
    }
  };

  const onEnterBuscar = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscarVehiculo(); }
  };

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
  const eliminarReparacion = (id) => setReparaciones(prev => prev.filter(r => r.id !== id));

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
      updatedAt: serverTimestamp(),
      createdBy: user ? { uid: user.uid, email: user.email || null } : null,
    };

    try {
      await withLoading(async () => {
        if (otId) {
          await updateDoc(doc(db, 'ordenes_trabajo', otId), payload);
        } else {
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
    setPlaca(''); setVehiculo(null); setCono(''); setReparacion('');
    setReparaciones([]); setEditingId(null); setEditingText(''); setOtId(null);
  };

  return (
    <div className="ot-wrapper">
      <header className="ot-header">
        <div className="ot-header-icon"><FaCar /></div>
        <div>
          <h2 className="ot-title">Órdenes de Trabajo</h2>
          <p className="ot-subtitle">Crea la orden a partir de la placa registrada en proforma.</p>
        </div>
      </header>

      <div className="ot-grid">
        <section className="card card--span2">
          <div className="card-header">
            <h3>Búsqueda por Placa</h3>
            <p>Al ingresar una placa existente, se cargan automáticamente marca, año y color y (si existe) su última OT.</p>
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

              <button type="button" className="btn" onClick={buscarVehiculo} disabled={loadingVehiculo}>
                {loadingVehiculo ? 'Buscando…' : 'Cargar datos'}
              </button>

              {vehiculo === null && !loadingVehiculo && placa && (
                <span className="msg-warn">No se encontró un vehículo con esa placa.</span>
              )}
            </div>

            {vehiculo && (
              <div className="vehiculo-chipset">
                <span className="chip chip--ghost">{vehiculo.marca}</span>
                <span className="chip">{vehiculo.anio}</span>
                <span className="chip">{vehiculo.color}</span>
                <span className="chip chip--ghost">Placa: {vehiculo.placa || placa}</span>
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
                <input id="cono" placeholder="Ej: 27" value={cono} onChange={(e) => setCono(e.target.value)} disabled={!vehiculo} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="reparacion">Reparación</label>
              <textarea id="reparacion" placeholder="Describe la reparación a realizar" value={reparacion} onChange={(e) => setReparacion(e.target.value)} disabled={!vehiculo} rows={4} />
              <div className="actions-right">
                <button type="button" className="btn" onClick={agregarReparacion} disabled={!vehiculo || !reparacion.trim()}>
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
          <p>Se cargan si existe una OT previa para la placa.</p>
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
                        <button
                          className="btn-icon btn-icon--ghost"
                          onClick={guardarEdicion}
                          aria-label="Guardar"
                          title="Guardar"
                        >
                          <FaSave />
                        </button>
                        <button
                          className="btn-icon btn-icon--ghost"
                          onClick={cancelarEdicion}
                          aria-label="Cancelar"
                          title="Cancelar"
                        >
                          <FaTimes />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-icon btn-icon--ghost"
                          onClick={() => iniciarEdicion(r)}
                          aria-label="Editar"
                          title="Editar"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="btn-icon btn-icon--danger"
                          onClick={() => eliminarReparacion(r.id)}
                          aria-label="Eliminar"
                          title="Eliminar"
                        >
                          <FaTrash />
                        </button>
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
        <button className="btn btn--ghost" onClick={limpiar}>Limpiar</button>
        <button className="btn" onClick={guardarOT} disabled={!vehiculo || !cono.trim() || reparaciones.length === 0}>
          <FaSave className="mr-6" /> {otId ? 'Actualizar Orden' : 'Guardar Orden de Trabajo'}
        </button>
        <button className="btn btn--ghost" onClick={imprimirOT} disabled={!vehiculo || !cono.trim() || reparaciones.length === 0}>
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
