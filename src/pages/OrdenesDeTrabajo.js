// src/pages/OrdenesDeTrabajo.jsx
import React, { useState, useEffect } from 'react';
import './OrdenesDeTrabajo.css';
import { toast, ToastContainer } from 'react-toastify';
import { FaSearch, FaCar, FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaHashtag, FaExclamationTriangle } from 'react-icons/fa';
import logo from '../assets/logo.png';

import { db, auth } from '../firebase/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';

import { useLoading } from '../components/ui/LoadingContext';

const OrdenesDeTrabajo = () => {
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  const [placa, setPlaca] = useState('');
  const [proformaNumero, setProformaNumero] = useState('');
  const [loadingVehiculo, setLoadingVehiculo] = useState(false);
  const [vehiculo, setVehiculo] = useState(null);

  // Cono asignado en la OT (campo de "Datos de la Orden")
  const [cono, setCono] = useState('');
  // Cono para BUSCAR (no confundir con el cono asignado de la OT)
  const [conoBuscar, setConoBuscar] = useState('');

  const [reparacion, setReparacion] = useState('');
  const [reparaciones, setReparaciones] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [otId, setOtId] = useState(null);

  const { withLoading } = useLoading();

  // ===== Modal confirmación Finalizar =====
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  // helpers para normalizar tipos de cono
  const toConoStr = v => (v === 0 || v ? String(v) : '');
  const toConoNum = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ===== Conos disponibles (con realtime) =====
  const ALL_CONOS = Array.from({ length: 60 }, (_, i) => String(i + 1));
  const [conosDisponibles, setConosDisponibles] = useState([]);
  const [conosUsados, setConosUsados] = useState(new Set());
  const [whitelistCono, setWhitelistCono] = useState(null);

  useEffect(() => {
    const qAbiertas = query(collection(db, 'ordenes_trabajo'), where('estado', '==', 'abierta'));
    const unsub = onSnapshot(
      qAbiertas,
      (snap) => {
        const usados = new Set(
          snap.docs
            .map(d => String(d.data()?.numeroCono ?? '').trim())
            .filter(Boolean)
        );
        setConosUsados(usados);
      },
      (err) => console.error('onSnapshot conos error:', err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const usados = new Set(Array.from(conosUsados));
    if (whitelistCono) usados.delete(String(whitelistCono).trim());
    const disponibles = ALL_CONOS.filter(n => !usados.has(n));
    setConosDisponibles(disponibles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conosUsados, whitelistCono]);

  const refrescarConosDisponibles = async (currentCono = null) => {
    try {
      setWhitelistCono(currentCono || null);
      const snap = await getDocs(
        query(collection(db, 'ordenes_trabajo'), where('estado', '==', 'abierta'))
      );
      const usados = new Set(
        snap.docs.map(d => String(d.data()?.numeroCono ?? '').trim()).filter(Boolean)
      );
      if (currentCono) usados.delete(String(currentCono).trim());
      const disponibles = ALL_CONOS.filter(n => !usados.has(n));
      setConosDisponibles(disponibles);
    } catch (e) {
      console.error('No se pudieron calcular los conos disponibles:', e);
      setConosDisponibles(ALL_CONOS);
    }
  };

  useEffect(() => {
    setWhitelistCono(null);
    refrescarConosDisponibles(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setWhitelistCono(otId ? (cono || null) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otId, cono]);

  // Cerrar modal con ESC
  useEffect(() => {
    if (!showFinishConfirm) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowFinishConfirm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFinishConfirm]);

  const convertirFecha = (fechaStr) => {
    if (!fechaStr || !fechaStr.includes('/')) return new Date(0);
    const [mes, dia, anio] = fechaStr.split('/');
       return new Date(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
  };

  const setReparacionesDesdeProforma = (p) => {
    const items = Array.isArray(p.reparaciones) ? p.reparaciones : [];
    const mapped = items
      .map((r, i) => ({
        id: `pf-${p.id}-${i}`,
        texto: String(r.concepto ?? r.descripcion ?? r.texto ?? r.detalle ?? '').trim(),
      }))
      .filter(x => x.texto.length > 0);
    setReparaciones(mapped);
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
        setCono(toConoStr(top.numeroCono));
        setWhitelistCono(top.numeroCono || null);

        // datos de vehículo desde la OT
        const placaFromOT = (top.placa || top.vehiculo?.placa || placaUpper).toUpperCase();
        setPlaca(placaFromOT);
        setVehiculo({
          placa: placaFromOT,
          marca: top.vehiculo?.marca || '',
          modelo: top.vehiculo?.modelo || '',
          anio: top.vehiculo?.anio || '',
          color: top.vehiculo?.color || '',
        });

        if (top.proformaNumero !== undefined && top.proformaNumero !== null) {
          setProformaNumero(String(top.proformaNumero));
        } else if (!preserveProforma) {
          setProformaNumero('');
        }

        setReparaciones(Array.isArray(top.reparaciones)
          ? top.reparaciones.map((r, i) => ({ id: `${top.id}-${i}`, texto: r.texto || String(r) }))
          : []);

        await refrescarConosDisponibles(top.numeroCono || null);
      } else {
        setWhitelistCono(null);
      }
    } catch (err) {
      console.error('Error consultando OT:', err);
    }
  };

  // ===== Búsqueda por PROFORMA (mejorada) =====
  const buscarPorProforma = async (proformaNum, placaUpper) => {
    if (!proformaNum) return null;

    // Limpia estado de cono para no arrastrar el anterior
    setCono('');
    setWhitelistCono(null);

    // 1) Traer proformas: intenta como número y como string
    let snap = await getDocs(query(collection(db, 'proformas'), where('numero', '==', proformaNum)));
    if (snap.empty) {
      snap = await getDocs(query(collection(db, 'proformas'), where('numero', '==', String(proformaNum))));
    }
    if (snap.empty) return null;

    // 2) Ordenar por fecha desc y preferir coincidencia de placa si fue digitada,
    //    pero SIN descartar el resto
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => convertirFecha(b.fecha) - convertirFecha(a.fecha));

    let p = docs[0];
    if (placaUpper) {
      const exact = docs.find(x => (x.vehiculo?.placa || '').toUpperCase() === placaUpper);
      if (exact) p = exact;
    }

    // 3) Setear datos base desde la proforma elegida
    const placaDoc = (p.vehiculo?.placa || placaUpper || '').toUpperCase();
    setPlaca(placaDoc);
    setVehiculo({
      placa: placaDoc,
      marca: p.vehiculo?.marca || '',
      modelo: p.vehiculo?.modelo || '',
      anio: p.vehiculo?.anio || p.vehiculo?.ano || '',
      color: p.vehiculo?.color || '',
    });
    setProformaNumero(String(p.numero ?? proformaNum));

    // 4) Intentar encontrar la OT por número de proforma (independiente de placa),
    //    probando como número y como string
    let otEncontrada = null;
    try {
      const pfNumber = Number(p.numero ?? proformaNum);
      let snapOT = await getDocs(query(collection(db, 'ordenes_trabajo'), where('proformaNumero', '==', pfNumber)));
      if (snapOT.empty) {
        snapOT = await getDocs(query(collection(db, 'ordenes_trabajo'), where('proformaNumero', '==', String(pfNumber))));
      }

      if (!snapOT.empty) {
        const list = snapOT.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
            const tb = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        otEncontrada = list[0];

        setOtId(otEncontrada.id);
        setCono(toConoStr(otEncontrada.numeroCono));
        setWhitelistCono(otEncontrada?.numeroCono || null);

        const placaFromOT = (otEncontrada.placa || otEncontrada.vehiculo?.placa || '').toUpperCase();
        if (placaFromOT) {
          setPlaca(placaFromOT);
          setVehiculo(v => ({
            ...v,
            placa: placaFromOT,
            marca: otEncontrada.vehiculo?.marca || v.marca || '',
            modelo: otEncontrada.vehiculo?.modelo || v.modelo || '',
            anio: otEncontrada.vehiculo?.anio || v.anio || '',
            color: otEncontrada.vehiculo?.color || v.color || '',
          }));
        }

        await refrescarConosDisponibles(otEncontrada?.numeroCono || null);
      }
    } catch (err) {
      console.error('Error buscando OT por proforma:', err);
    }

    // 5) Si NO hubo OT por proforma y sí tenemos placa, caer a la última OT por placa (preserva proforma en pantalla)
    if (!otEncontrada && placaDoc) {
      await loadUltimaOT(placaDoc, { preserveProforma: true });
      if (!otId) setWhitelistCono(null);
    }

    // 6) Reparaciones desde la proforma
    setReparacionesDesdeProforma(p);

    // 7) Si no hubo OT, refrescar lista de conos sin "actual"
    if (!otEncontrada) {
      setWhitelistCono(null);
      await refrescarConosDisponibles(null);
    }

    return p;
  };

  // ===== Búsqueda por PLACA =====
  async function buscarPorPlaca(placaUpper) {
    if (!placaUpper) return null;

    // Limpia estado de cono para no arrastrar el anterior
    setCono('');
    setWhitelistCono(null);

    let snapOT = await getDocs(query(collection(db, 'ordenes_trabajo'), where('placa', '==', placaUpper)));
    if (snapOT.empty) {
      snapOT = await getDocs(query(collection(db, 'ordenes_trabajo'), where('vehiculo.placa', '==', placaUpper)));
    }
    if (!snapOT.empty) {
      const list = snapOT.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
          const tb = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      const ot = list[0];

      setOtId(ot.id);
      setCono(toConoStr(ot.numeroCono));
      setWhitelistCono(ot.numeroCono || null);
      setPlaca(placaUpper);
      setVehiculo({
        placa: placaUpper,
        marca: ot.vehiculo?.marca || '',
        modelo: ot.vehiculo?.modelo || '',
        anio: ot.vehiculo?.anio || '',
        color: ot.vehiculo?.color || '',
      });
      if (ot.proformaNumero != null) setProformaNumero(String(ot.proformaNumero));
      setReparaciones(Array.isArray(ot.reparaciones) ? ot.reparaciones.map((r, i) => ({ id: `${ot.id}-${i}`, texto: r.texto || String(r) })) : []);

      await refrescarConosDisponibles(ot.numeroCono || null);
      return { origen: 'ot' };
    }

    const snapPro = await getDocs(query(collection(db, 'proformas'), where('vehiculo.placa', '==', placaUpper)));
    if (snapPro.empty) {
      setWhitelistCono(null);
      await refrescarConosDisponibles(null);
      return null;
    }

    const proformas = snapPro.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => convertirFecha(b.fecha) - convertirFecha(a.fecha));
    const p = proformas[0];

    const pfNumber = Number(p.numero);
    let snapOT2 = await getDocs(query(collection(db, 'ordenes_trabajo'), where('proformaNumero', '==', pfNumber)));
    if (snapOT2.empty) {
      snapOT2 = await getDocs(query(collection(db, 'ordenes_trabajo'), where('proformaNumero', '==', String(pfNumber))));
    }
    if (snapOT2.empty) {
      setPlaca(placaUpper);
      setVehiculo({
        placa: placaUpper,
        marca: p.vehiculo?.marca || '',
        modelo: p.vehiculo?.modelo || '',
        anio: p.vehiculo?.anio || p.vehiculo?.ano || '',
        color: p.vehiculo?.color || '',
      });
      setProformaNumero(String(p.numero || ''));
      setReparacionesDesdeProforma(p);

      setWhitelistCono(null);
      await refrescarConosDisponibles(null);
      return { origen: 'proforma' };
    }

    const list2 = snapOT2.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const tb = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
    const ot = list2[0];

    const needsBackfill = !ot.placa && !ot.vehiculo?.placa;
    if (needsBackfill) {
      const otRef = doc(db, 'ordenes_trabajo', ot.id);
      const updatePayload = {
        placa: placaUpper,
        'vehiculo.placa': placaUpper,
        updatedAt: serverTimestamp(),
      };
      if (!ot.vehiculo?.marca && p.vehiculo?.marca) updatePayload['vehiculo.marca'] = p.vehiculo.marca;
      if (!ot.vehiculo?.modelo && p.vehiculo?.modelo) updatePayload['vehiculo.modelo'] = p.vehiculo.modelo;
      if (!ot.vehiculo?.anio && (p.vehiculo?.anio || p.vehiculo?.ano)) updatePayload['vehiculo.anio'] = p.vehiculo.anio || p.vehiculo.ano;
      if (!ot.vehiculo?.color && p.vehiculo?.color) updatePayload['vehiculo.color'] = p.vehiculo.color;

      await updateDoc(otRef, updatePayload);
      ot.placa = placaUpper;
      ot.vehiculo = {
        ...(ot.vehiculo || {}),
        placa: placaUpper,
        marca: ot.vehiculo?.marca || p.vehiculo?.marca || '',
        modelo: ot.vehiculo?.modelo || p.vehiculo?.modelo || '',
        anio: ot.vehiculo?.anio || p.vehiculo?.anio || p.vehiculo?.ano || '',
        color: ot.vehiculo?.color || p.vehiculo?.color || '',
      };
    }

    setOtId(ot.id);
    setCono(toConoStr(ot.numeroCono));
    setWhitelistCono(ot.numeroCono || null);
    setPlaca(placaUpper);
    setVehiculo({
      placa: placaUpper,
      marca: ot.vehiculo?.marca || '',
      modelo: ot.vehiculo?.modelo || '',
      anio: ot.vehiculo?.anio || '',
      color: ot.vehiculo?.color || '',
    });
    if (ot.proformaNumero != null) setProformaNumero(String(ot.proformaNumero));
    setReparaciones(Array.isArray(ot.reparaciones) ? ot.reparaciones.map((r, i) => ({ id: `${ot.id}-${i}`, texto: r.texto || String(r) })) : []);

    await refrescarConosDisponibles(ot.numeroCono || null);
    return { origen: 'otPorProforma' };
  }

  // ===== Búsqueda por CONO asignado (OT abierta) =====
  const buscarPorCono = async (valorCono) => {
    const raw = String(valorCono ?? '').trim();
    if (!raw) return null;

    // Limpia estado de cono para no arrastrar el anterior
    setCono('');
    setWhitelistCono(null);

    const intentos = [];
    const n = Number(raw);
    if (Number.isFinite(n)) intentos.push(n);
    intentos.push(raw);

    let ot = null;
    for (const v of intentos) {
      const snap = await getDocs(
        query(
          collection(db, 'ordenes_trabajo'),
          where('estado', '==', 'abierta'),
          where('numeroCono', '==', v)
        )
      );
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
            const tb = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
            return tb - ta;
          });
        ot = list[0];
        break;
      }
    }

    if (!ot) return null;

    setOtId(ot.id);
    setCono(toConoStr(ot.numeroCono));
    setWhitelistCono(ot.numeroCono || null);

    const placaUpper = (ot.placa || ot.vehiculo?.placa || '').toUpperCase();
    setPlaca(placaUpper);
    setVehiculo({
      placa: placaUpper,
      marca: ot.vehiculo?.marca || '',
      modelo: ot.vehiculo?.modelo || '',
      anio: ot.vehiculo?.anio || '',
      color: ot.vehiculo?.color || '',
    });
    if (ot.proformaNumero != null) setProformaNumero(String(ot.proformaNumero));
    setReparaciones(Array.isArray(ot.reparaciones)
      ? ot.reparaciones.map((r, i) => ({ id: `${ot.id}-${i}`, texto: r.texto || String(r) }))
      : []);

    await refrescarConosDisponibles(ot.numeroCono || null);
    return { origen: 'otPorCono' };
  };

  // ===== Botón Cargar datos =====
  const cargarDatos = async () => {
    const placaUpper = (placa || '').replace(/\s+/g, '').toUpperCase();
    const pfStr = (proformaNumero || '').trim();
    const pfNum = /^\d+$/.test(pfStr) ? parseInt(pfStr, 10) : null;
    const coneStr = (conoBuscar || '').trim();

    if (!pfNum && !placaUpper && !coneStr) {
      toast.info('Ingrese Nº de proforma, placa y/o Nº de cono.');
      return;
    }

    // Limpieza previa para evitar que queden restos de la OT anterior
    setOtId(null);
    setCono('');
    setVehiculo(null);
    setReparaciones([]);
    setWhitelistCono(null);

    setLoadingVehiculo(true);
    try {
      await withLoading(async () => {
        let found = null;
        if (!found && pfNum) found = await buscarPorProforma(pfNum, placaUpper);
        if (!found && placaUpper) found = await buscarPorPlaca(placaUpper);
        if (!found && coneStr) found = await buscarPorCono(coneStr);

        if (!found) {
          setVehiculo(null); setOtId(null); setReparaciones([]);
          setWhitelistCono(null);
          toast.info('No se encontraron datos con los criterios ingresados.', { autoClose: 2200, hideProgressBar: true });
          await refrescarConosDisponibles(null);
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
    const conoSel = (cono || '').trim();

    try {
      const conflictSnap = await getDocs(
        query(
          collection(db, 'ordenes_trabajo'),
          where('estado', '==', 'abierta'),
          where('numeroCono', '==', conoSel)
        )
      );
      const conflicts = conflictSnap.docs.filter(d => d.id !== otId);
      if (conflicts.length > 0) {
        toast.error(`El cono ${conoSel} ya está ocupado. Elige otro.`);
        setWhitelistCono(otId ? conoSel : null);
        await refrescarConosDisponibles(otId ? conoSel : null);
        return;
      }
    } catch (e) {
      console.error('Error validando cono:', e);
    }

    const payload = {
      placa: placaNorm,
      placaRaw: vehiculo?.placa || placa,
      vehiculo: {
        marca: vehiculo?.marca || '',
        modelo: vehiculo?.modelo || '',
        anio: Number(vehiculo?.anio) || vehiculo?.anio || '',
        color: vehiculo?.color || '',
        placa: placaNorm
      },
      numeroCono: toConoNum(conoSel) ?? conoSel,
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
      setWhitelistCono(conoSel);
      await refrescarConosDisponibles(conoSel);
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
    setPlaca(''); setProformaNumero(''); setConoBuscar('');
    setVehiculo(null); setCono(''); setReparacion('');
    setReparaciones([]); setEditingId(null); setEditingText(''); setOtId(null);
    setWhitelistCono(null);
    refrescarConosDisponibles(null);
  };

  const confirmarEliminarReparacion = async (id) => {
    await withLoading(async () => {
      await nextFrame();
      setReparaciones(prev => prev.filter(r => r.id !== id));
      toast.success('Reparación eliminada', { autoClose: 2000 });
    }, 'Eliminando reparación…');
  };

  // ===== Finalizar Orden con modal bonito =====
  const finalizarOrden = () => {
    if (!otId) {
      toast.info('Primero guarda la orden para poder finalizarla.');
      return;
    }
    setShowFinishConfirm(true);
  };

  const finalizarOrdenConfirmada = async () => {
    if (!otId) return;
    setFinalizando(true);
    try {
      await withLoading(async () => {
        await updateDoc(doc(db, 'ordenes_trabajo', otId), {
          estado: 'finalizada',
          numeroCono: null,
          updatedAt: serverTimestamp()
        });
      }, 'Finalizando orden…');

      toast.success('Orden finalizada. Cono liberado.');
      setShowFinishConfirm(false);
      setFinalizando(false);
      // limpiar todo al finalizar
      limpiar();
    } catch (e) {
      console.error('No se pudo finalizar la orden:', e);
      setFinalizando(false);
      toast.error('No se pudo finalizar la orden.');
    }
  };

  const faltaCono = !cono.trim();
  const saveDisabled = !vehiculo || faltaCono || reparaciones.length === 0;
  const printDisabled = !vehiculo || faltaCono || reparaciones.length === 0;

  return (
    <div className="ordenesTrabajo-proforma-page">
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
            <p className="ot-subtitle">Crea la orden a partir de placa, número de proforma o cono</p>
          </div>
        </header>

        <div className="ot-grid">
          <section className="card card--span2">
            <div className="card-header">
              <h3>Búsqueda</h3>
              <p>Puedes cargar datos por <strong>Nº de Proforma</strong>, <strong>Placa</strong> o <strong>Nº de Cono</strong> asignado a una OT abierta.</p>
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

                {/* Buscar por Nº de Cono */}
                <div className="field" style={{ maxWidth: 160 }}>
                  <label htmlFor="conoBuscar">Nº Cono (asignado)</label>
                  <div className="input-icon">
                    <FaHashtag className="icon-left" />
                    <input
                      id="conoBuscar"
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="Ej: 27"
                      value={conoBuscar}
                      onChange={(e) => setConoBuscar(e.target.value.replace(/[^\d]/g, ''))}
                      onKeyDown={onEnterBuscar}
                      disabled={loadingVehiculo}
                    />
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

                <button type="button" className="btn" onClick={cargarDatos} disabled={loadingVehiculo}>
                  {loadingVehiculo ? 'Cargando…' : 'Cargar datos'}
                </button>
              </div>

              {vehiculo && (
                <div className="vehiculo-chipset">
                  <span className="chip chip--ghost">{vehiculo.marca}</span>
                  <span className="chip">{vehiculo.anio}</span>
                  <span className="chip">{vehiculo.color}</span>
                  <span className="chip chip--ghost">Placa: {vehiculo.placa || placa}</span>
                  {proformaNumero && <span className="chip">Proforma: {proformaNumero}</span>}
                  {cono && <span className="chip">Cono: {cono}</span>}
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
                  <select
                    id="cono"
                    value={cono}
                    onChange={(e) => { setCono(e.target.value); setWhitelistCono(e.target.value || null); }}
                    onFocus={() => { setWhitelistCono(cono || null); refrescarConosDisponibles(cono || null); }}
                  >
                    <option value="">Seleccione un cono…</option>
                    {conosDisponibles.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

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
                <th style={{ width: 80 }}>#</th>
                <th>Descripción</th>
                <th className="th-actions">
                  <span className="th-actions-text">Acciones</span>
                </th>
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

          <span className="tip-wrap" data-tip={faltaCono ? 'Debe ingresar el número de cono' : ''}>
            <button className="btn btn--sm" onClick={guardarOT} disabled={saveDisabled}>
              <FaSave className="mr-6" /> {otId ? 'Actualizar Orden' : 'Guardar Orden de Trabajo'}
            </button>
          </span>

          <span className="tip-wrap" data-tip={faltaCono ? 'Debe ingresar el número de cono' : ''}>
            <button className="btn btn--ghost btn--sm" onClick={imprimirOT} disabled={printDisabled}>
              Imprimir / Guardar PDF
            </button>
          </span>

          <button
            className="btn btn--danger btn--sm"
            onClick={finalizarOrden}
            disabled={!otId || !vehiculo || !cono.trim()}
          >
            Finalizar Orden
          </button>
        </div>

        {/* ===== Modal de confirmación "Finalizar orden" ===== */}
        {showFinishConfirm && (
          <div
            className="modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget && !finalizando) setShowFinishConfirm(false); }}
          >
            <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="finish-title">
              <div className="modal-icon danger">
                <FaExclamationTriangle />
              </div>
              <h4 id="finish-title" className="modal-title">Finalizar orden</h4>
              <p className="modal-text">
                ¿Deseas finalizar esta orden? El <strong>cono {cono || '—'}</strong> quedará liberado.
              </p>
              <div className="modal-actions">
                <button className="btn btn--ghost" onClick={() => setShowFinishConfirm(false)} disabled={finalizando}>
                  Cancelar
                </button>
                <button className="btn btn--danger" onClick={finalizarOrdenConfirmada} disabled={finalizando}>
                  {finalizando ? 'Finalizando…' : 'Finalizar orden'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======= Vista para imprimir ======= */}
        <div id="ot-print" className="ot-print">
          <div className="otp-header">
            <div className="otp-left">
              <img src={logo} alt="Taller 2H" className="otp-logo" />
              <div className="otp-titlewrap">
                <h1 className="otp-title">Orden de Trabajo</h1>
                <span className="otp-cono">Cono: {cono || '—'}</span>
              </div>
            </div>
            <div className="otp-empresa">
              <div className="otp-line">Taller Automotriz 2H S.A</div>
              <div className="otp-line">Céd. Jur.: 3-101-930294</div>
              <div className="otp-line">Tel: 6275-6427 • taller2hrosario@gmail.com</div>
              <div className="otp-fecha">
                <strong>Fecha:</strong>{' '}
                {new Date().toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              </div>
            </div>
          </div>

          <div className="otp-datos">
            {proformaNumero && <div><strong>Proforma:</strong> {proformaNumero}</div>}
            <div><strong>Placa:</strong> {vehiculo?.placa || placa || '—'}</div>
            <div><strong>Marca:</strong> {vehiculo?.marca || '—'}</div>
            <div><strong>Modelo:</strong> {vehiculo?.modelo || '—'}</div>
            <div><strong>Año:</strong> {vehiculo?.anio || '—'}</div>
            <div><strong>Color:</strong> {vehiculo?.color || '—'}</div>
          </div>

          <table className="otp-tabla">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Reparación</th>
                <th className="otp-th-check">Listo</th>
              </tr>
            </thead>
            <tbody>
              {reparaciones.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.texto}</td>
                  <td className="otp-check"><span className="check-box" /></td>
                </tr>
              ))}
              {reparaciones.length === 0 && (
                <tr>
                  <td>—</td>
                  <td>No hay reparaciones registradas</td>
                  <td className="otp-check"><span className="check-box" /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrdenesDeTrabajo;
