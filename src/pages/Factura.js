// src/pages/Factura.js
import React, { useState, useEffect } from 'react';
import './Factura.css';
import { db } from '../firebase/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import { toast, ToastContainer } from 'react-toastify';
import {
  FaEdit,
  FaTrashAlt,
  FaSave,
  FaTimes,
  FaBoxOpen,
  FaSearch,
} from 'react-icons/fa';
import logo from '../assets/logo.png';
import { useLoading } from '../components/ui/LoadingContext';
import Pagination from '../components/Pagination/Pagination';

/* ===== Helpers de formato ===== */
const LOCALE_NUMERIC = 'es-ES';

const formatNumber = (n) =>
  new Intl.NumberFormat(LOCALE_NUMERIC, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number(n) || 0);

const formatCRC = (n) => `₡${formatNumber(n)}`;

// Acepta "50000", "50.000,00", "50,000.00", etc.
const parseMoney = (str) => {
  if (str == null) return 0;
  const s = String(str).replace(/[^\d.,-]/g, '').replace(/\s/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized = s;

  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

/* ===== Caja: helpers globales ===== */
const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'sinpe', label: 'SINPE' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

const dateKeyFromNow = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/* === NUEVO: leer sesión del día, no crearla === */
const getTodaySession = async () => {
  const today = dateKeyFromNow();
  const qy = query(collection(db, 'cash_sessions'), where('dateKey', '==', today));
  const snap = await getDocs(qy);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

const Factura = () => {
  const [numeroProforma, setNumeroProforma] = useState('');
  const [proforma, setProforma] = useState(null);
  const [cliente, setCliente] = useState(null);

  // Abonos
  const [abonoStr, setAbonoStr] = useState('');
  const [abonos, setAbonos] = useState([]);
  const [abonoMethod, setAbonoMethod] = useState('efectivo');

  // Gastos
  const [gastos, setGastos] = useState([]);
  const [detalleGasto, setDetalleGasto] = useState('');
  const [montoGastoStr, setMontoGastoStr] = useState('');

  // Edición de gasto
  const [editGasto, setEditGasto] = useState(null);
  const [newDetalle, setNewDetalle] = useState('');
  const [newMontoStr, setNewMontoStr] = useState('');

  // Edición de abono
  const [editAbono, setEditAbono] = useState(null);
  const [newAbonoMontoStr, setNewAbonoMontoStr] = useState('');

  const [reparaciones, setReparaciones] = useState([]);

  // info del vehículo
  const [vehiculo, setVehiculo] = useState({
    placa: '',
    marca: '',
    modelo: '',
    anio: '',
    color: '',
  });

  // flags
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingGasto, setIsSavingGasto] = useState(false);
  const [isUpdatingGasto, setIsUpdatingGasto] = useState(false);
  const [isDeletingGasto, setIsDeletingGasto] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingAbono, setIsSavingAbono] = useState(false);

  const [isUpdatingAbono, setIsUpdatingAbono] = useState(false);
  const [isDeletingAbono, setIsDeletingAbono] = useState(false);

  const [deletingGastoId, setDeletingGastoId] = useState(null);
  const [deletingAbonoId, setDeletingAbonoId] = useState(null);

  // Productos
  const [productos, setProductos] = useState([]);

  // Picker de inventario
  const [showPicker, setShowPicker] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [inventarioList, setInventarioList] = useState([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerPage, setPickerPage] = useState(1);
  const pickerPerPage = 10;
  const [selectedInv, setSelectedInv] = useState(null);
  const [qtyInput, setQtyInput] = useState('1');

  const busy =
    isSearching ||
    isSavingGasto ||
    isUpdatingGasto ||
    isDeletingGasto ||
    isSavingAbono ||
    isUpdatingAbono ||
    isDeletingAbono ||
    isGeneratingPdf;

  const { withLoading } = useLoading();

  // Cargar cliente de Firestore
  useEffect(() => {
    if (proforma) {
      if (proforma.clienteId) {
        cargarCliente(proforma.clienteId);
      } else if (proforma.cliente && proforma.cliente.nombre && proforma.cliente.cedula) {
        setCliente(proforma.cliente);
      } else {
        setCliente(null);
      }
    } else {
      setCliente(null);
    }
  }, [proforma]);

  const cargarCliente = async (clienteId) => {
    if (!clienteId) {
      toast.error('Cliente ID no disponible', { autoClose: 2500 });
      return;
    }
    const clienteRef = doc(db, 'clientes', clienteId);
    const clienteSnap = await getDoc(clienteRef);
    if (clienteSnap.exists()) {
      setCliente(clienteSnap.data());
    } else {
      toast.error('No se encontró el cliente', { autoClose: 2500 });
    }
  };

  /* ===== Productos de factura: CRUD ===== */
  const cargarProductos = async (proformaId) => {
    try {
      const qy = query(
        collection(db, 'factura_items'),
        where('proformaId', '==', proformaId),
        orderBy('fecha', 'asc')
      );
      const snap = await getDocs(qy);
      setProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      const msg = String(e?.message || '');
      if (e?.code === 'failed-precondition' || msg.includes('index')) {
        const qy2 = query(collection(db, 'factura_items'), where('proformaId', '==', proformaId));
        const snap2 = await getDocs(qy2);
        const arr = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const as = a?.fecha?.seconds ?? 0;
          const bs = b?.fecha?.seconds ?? 0;
          return as - bs;
        });
        setProductos(arr);
        console.warn('Falta índice compuesto (proformaId asc, fecha asc) para factura_items. Usando orden en cliente.');
      } else {
        console.error('Error cargarProductos:', e);
        throw e;
      }
    }
  };

  const openPicker = async () => {
    if (!proforma?.id) {
      toast.info('Busca una proforma primero.');
      return;
    }
    try {
      setPickerBusy(true);
      const snap = await getDocs(query(collection(db, 'inventario'), orderBy('codigo')));
      setInventarioList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPickerSearch('');
      setSelectedInv(null);
      setQtyInput('1');
      setPickerPage(1);
      setShowPicker(true);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar el inventario.');
    } finally {
      setPickerBusy(false);
    }
  };

  const filteredInv = inventarioList.filter((it) => {
    const s = pickerSearch.trim().toLowerCase();
    if (!s) return true;
    return (
      String(it.codigo || '').toLowerCase().includes(s) ||
      String(it.descripcion || '').toLowerCase().includes(s)
    );
  });
  const invLast = pickerPage * pickerPerPage;
  const pickerRows = filteredInv.slice(invLast - pickerPerPage, invLast);

  const selectInv = (row) => {
    setSelectedInv(row);
    setQtyInput('1');
  };

  const confirmarProducto = async () => {
    if (!selectedInv) return;
    const cantDisp = Number(selectedInv.cantidad) || 0;
    const qty = Math.max(1, Math.floor(Number(qtyInput) || 0));
    if (qty > cantDisp) {
      toast.warn('No hay suficiente inventario para esa cantidad.');
      return;
    }

    const precioVenta = Number(selectedInv.precioVenta ?? selectedInv.precio ?? 0);

    try {
      setPickerBusy(true);
      // 1) Descontar stock
      await updateDoc(doc(db, 'inventario', selectedInv.id), {
        cantidad: increment(-qty),
        updatedAt: serverTimestamp(),
      });

      // 2) Crear renglón de factura
      await addDoc(collection(db, 'factura_items'), {
        proformaId: proforma.id,
        invId: selectedInv.id,
        codigo: selectedInv.codigo || '',
        descripcion: selectedInv.descripcion || '',
        precioVenta,
        cantidad: qty,
        fecha: serverTimestamp(),
      });

      // 3) Refrescar listado
      await cargarProductos(proforma.id);
      toast.success('Producto agregado y stock actualizado.');
      setShowPicker(false);
    } catch (e) {
      console.error('No se pudo agregar el producto:', e);
      toast.error('Error al agregar producto.');
    } finally {
      setPickerBusy(false);
    }
  };

  const eliminarProducto = async (item) => {
    toast.info(
      ({ closeToast }) => (
        <div className="toast-confirm-container">
          <p className="toast-confirm-message">¿Eliminar producto de la factura?</p>
          <div className="toast-confirm-buttons">
            <button
              className="btn-confirm eliminar"
              onClick={async () => {
                try {
                  // devolver stock
                  await updateDoc(doc(db, 'inventario', item.invId), {
                    cantidad: increment(Number(item.cantidad) || 0),
                    updatedAt: serverTimestamp(),
                  });
                } catch (e) {
                  console.error('No se pudo devolver stock:', e);
                }
                try {
                  await deleteDoc(doc(db, 'factura_items', item.id));
                  await cargarProductos(proforma.id);
                  toast.success('Producto eliminado.');
                } finally {
                  closeToast();
                }
              }}
              disabled={busy}
            >
              Eliminar
            </button>
            <button className="btn-confirm cancelar" onClick={closeToast} disabled={busy}>
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
        className: 'toast-confirm-wrapper',
      }
    );
  };

  // Buscar proforma con loader
  const buscarProforma = async () => {
    const term = (numeroProforma || '').trim();
    const numero = parseInt(term, 10);

    if (!term || Number.isNaN(numero)) {
      toast.info('Ingrese un número de proforma válido.', {
        position: 'top-center',
        autoClose: 2000,
        hideProgressBar: true,
      });
      return;
    }

    try {
      setIsSearching(true);
      await withLoading(async () => {
        const q = query(collection(db, 'proformas'), where('numero', '==', numero));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const docRef = snapshot.docs[0];
          const data = { id: docRef.id, ...docRef.data() };

          // normaliza vehículo
          setVehiculo({
            placa: data.vehiculo?.placa || '',
            marca: data.vehiculo?.marca || '',
            modelo: data.vehiculo?.modelo || '',
            anio: data.vehiculo?.anio || '',
            color: data.vehiculo?.color || '',
          });

          // normaliza reparaciones
          const repars = Array.isArray(data.reparaciones)
            ? data.reparaciones.map((r) => ({
              concepto: r.concepto ?? r.descripcion ?? '',
              precio: Number(r.precio ?? r.monto ?? 0),
            }))
            : [];
          setReparaciones(repars);

          setProforma(data);
          await Promise.all([cargarAbonos(docRef.id), cargarGastos(docRef.id), cargarProductos(docRef.id)]);
        } else {
          setProforma(null);
          setAbonos([]);
          setGastos([]);
          setProductos([]);
          setReparaciones([]);
          setVehiculo({ placa: '', marca: '', modelo: '', anio: '', color: '' });
          toast.info('Proforma no encontrada.', { autoClose: 2500 });
        }
      }, 'Buscando factura…');
    } catch (err) {
      console.error('Error al buscar la proforma:', err);
      toast.error('Ocurrió un error al buscar. Intenta nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  const cargarAbonos = async (proformaId) => {
    const qy = query(collection(db, 'abonos'), where('proformaId', '==', proformaId));
    const snapshot = await getDocs(qy);
    const resultados = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setAbonos(resultados);
  };

  const cargarGastos = async (proformaId) => {
    const qy = query(collection(db, 'gastos'), where('proformaId', '==', proformaId));
    const snapshot = await getDocs(qy);
    const resultados = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setGastos(resultados);
  };

  // Totales
  const totalAbonado = abonos.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);
  const totalGastos = gastos.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);
  const totalProductos = productos.reduce(
    (sum, p) => sum + (Number(p.precioVenta) || 0) * (Number(p.cantidad) || 0),
    0
  );
  const totalFinal = proforma ? (Number(proforma.total) || 0) + totalGastos + totalProductos : 0;
  const saldoPendiente = totalFinal - totalAbonado;

  /* ====== ABONO (ingreso) ====== */
  const onAbonoFocus = () => {
    if (abonoStr === '') return;
    const n = parseMoney(abonoStr);
    setAbonoStr(n.toFixed(2).replace('.', ','));
  };
  const onAbonoChange = (v) => setAbonoStr(v);
  const onAbonoBlur = () => {
    const n = parseMoney(abonoStr);
    setAbonoStr(n ? formatNumber(n) : '');
  };

  const ingresarAbono = async () => {
    const monto = parseMoney(abonoStr);
    let valid = true;

    if (!abonoStr || !monto) {
      toast.error('Por favor, ingrese el monto del abono.');
      valid = false;
    }
    if (saldoPendiente <= 0) {
      toast.warn('La factura ya está saldada. No se pueden ingresar más abonos.', { autoClose: 2500 });
      valid = false;
    }
    if (!valid) return;

    try {
      setIsSavingAbono(true);
      await withLoading(async () => {
        // 1) Verifica que la caja de hoy esté abierta
        const session = await getTodaySession();
        if (!session) {
          toast.error('Primero abre la caja del día en "Flujo de caja".');
          return;
        }
        if (session.isClosed) {
          toast.warn('La caja del día está cerrada. No se pueden registrar abonos.');
          return;
        }

        // 2) Crea abono con método
        const nuevoAbono = {
          proformaId: proforma.id,
          monto,
          method: abonoMethod,
          fecha: new Date().toLocaleDateString(),
          dateKey: dateKeyFromNow(),
          createdAt: serverTimestamp(),
        };
        const abRef = await addDoc(collection(db, 'abonos'), nuevoAbono);

        // 3) Movimiento de caja (ingreso)
        await addDoc(collection(db, 'cash_movements'), {
          sessionId: session.id,
          dateKey: dateKeyFromNow(),
          createdAt: serverTimestamp(),
          type: 'ingreso',
          method: abonoMethod,
          amount: monto,
          concept: `Abono factura ${proforma?.numero ?? ''}`.trim(),
          refType: 'abono',
          refId: abRef.id,
          proformaNumero: proforma?.numero ?? null,
        });

        await cargarAbonos(proforma.id);
        setAbonoStr('');
        toast.success('Abono registrado y reflejado en caja', { autoClose: 2500 });
      }, 'Registrando abono…');
    } finally {
      setIsSavingAbono(false);
    }
  };

  /* ====== GASTO ====== */
  const onGastoFocus = () => {
    if (montoGastoStr === '') return;
    const n = parseMoney(montoGastoStr);
    setMontoGastoStr(n.toFixed(2).replace('.', ','));
  };
  const onGastoChange = (v) => setMontoGastoStr(v);
  const onGastoBlur = () => {
    const n = parseMoney(montoGastoStr);
    setMontoGastoStr(n ? formatNumber(n) : '');
  };

  const ingresarGasto = async () => {
    const monto = parseMoney(montoGastoStr);
    let valid = true;

    if (!detalleGasto || detalleGasto.trim() === '') {
      toast.error('Por favor, ingrese la información del "Detalle del Gasto".');
      valid = false;
    }
    if (!montoGastoStr || !monto) {
      toast.error('Por favor, ingrese la información del "Monto del Gasto".');
      valid = false;
    }
    if (!valid) return;

    try {
      setIsSavingGasto(true);
      await withLoading(async () => {
        const nuevoGasto = {
          proformaId: proforma.id,
          detalle: detalleGasto,
          monto,
          fecha: new Date().toLocaleDateString(),
        };
        await addDoc(collection(db, 'gastos'), nuevoGasto);
        await cargarGastos(proforma.id);
        setDetalleGasto('');
        setMontoGastoStr('');
        toast.success('Gasto registrado exitosamente', { autoClose: 2500 });
      }, 'Registrando gasto…');
    } finally {
      setIsSavingGasto(false);
    }
  };

  /* ====== EDICIÓN GASTO ====== */
  const editarGasto = (gasto) => {
    if (!gasto || !gasto.id) {
      toast.error('ID de gasto no válido', { autoClose: 2500 });
      return;
    }
    setEditGasto(gasto);
    setNewDetalle(gasto.detalle);
    setNewMontoStr(formatNumber(Number(gasto.monto) || 0));
  };

  const onEditMontoFocus = () => {
    const n = parseMoney(newMontoStr);
    setNewMontoStr(n.toFixed(2).replace('.', ','));
  };
  const onEditMontoChange = (v) => setNewMontoStr(v);
  const onEditMontoBlur = () => {
    const n = parseMoney(newMontoStr);
    setNewMontoStr(formatNumber(n));
  };

  const guardarEdicion = async (gastoId) => {
    if (!gastoId) {
      toast.error('ID de gasto no válido', { autoClose: 2500 });
      return;
    }
    const monto = parseMoney(newMontoStr);
    if (!newDetalle || !monto) {
      toast.warn('Por favor ingresa un detalle y un monto válidos.', { autoClose: 2500 });
      return;
    }

    try {
      setIsUpdatingGasto(true);
      await withLoading(async () => {
        const gastoRef = doc(db, 'gastos', gastoId);
        await updateDoc(gastoRef, {
          detalle: newDetalle,
          monto,
        });
        setEditGasto(null);
        toast.success('Gasto actualizado exitosamente', { autoClose: 2500 });
        await cargarGastos(proforma.id);
      }, 'Actualizando gasto…');
    } finally {
      setIsUpdatingGasto(false);
    }
  };

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  const confirmarEliminacion = async (gastoId) => {
    try {
      setDeletingGastoId(gastoId);
      setIsDeletingGasto(true);
      await withLoading(async () => {
        await nextFrame();
        const gastoRef = doc(db, 'gastos', gastoId);
        await deleteDoc(gastoRef);
        await cargarGastos(proforma.id);
        toast.success('Gasto eliminado exitosamente', { autoClose: 2500 });
      }, 'Eliminando gasto…');
    } finally {
      setIsDeletingGasto(false);
      setDeletingGastoId(null);
    }
  };

  const eliminarGasto = async (gastoId) => {
    toast.info(
      ({ closeToast }) => (
        <div className="toast-confirm-container">
          <p className="toast-confirm-message">¿Estás seguro de que deseas eliminar este gasto?</p>
          <div className="toast-confirm-buttons">
            <button
              className="btn-confirm eliminar"
              onClick={async () => {
                await confirmarEliminacion(gastoId);
                closeToast();
              }}
              disabled={busy}
            >
              Eliminar
            </button>
            <button className="btn-confirm cancelar" onClick={closeToast} disabled={busy}>
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
        className: 'toast-confirm-wrapper',
      }
    );
  };

  /* ====== EDICIÓN / ELIMINACIÓN ABONO ====== */
  const editarAbono = (abono) => {
    if (!abono || !abono.id) {
      toast.error('ID de abono no válido', { autoClose: 2500 });
      return;
    }
    setEditAbono(abono);
    setNewAbonoMontoStr(formatNumber(Number(abono.monto) || 0));
  };

  const onEditAbonoFocus = () => {
    const n = parseMoney(newAbonoMontoStr);
    setNewAbonoMontoStr(n.toFixed(2).replace('.', ','));
  };
  const onEditAbonoChange = (v) => setNewAbonoMontoStr(v);
  const onEditAbonoBlur = () => {
    const n = parseMoney(newAbonoMontoStr);
    setNewAbonoMontoStr(formatNumber(n));
  };

  const guardarEdicionAbono = async (abonoId) => {
    if (!abonoId) {
      toast.error('ID de abono no válido', { autoClose: 2500 });
      return;
    }
    const monto = parseMoney(newAbonoMontoStr);
    if (!monto) {
      toast.warn('Por favor ingresa un monto válido.', { autoClose: 2500 });
      return;
    }

    try {
      setIsUpdatingAbono(true);
      await withLoading(async () => {
        // 1) Actualiza abono
        const abonoRef = doc(db, 'abonos', abonoId);
        await updateDoc(abonoRef, { monto });

        // 2) Sincroniza movimiento vinculado
        const qy = query(
          collection(db, 'cash_movements'),
          where('refType', '==', 'abono'),
          where('refId', '==', abonoId)
        );
        const snap = await getDocs(qy);
        if (!snap.empty) {
          const movRef = doc(db, 'cash_movements', snap.docs[0].id);
          await updateDoc(movRef, { amount: monto });
        }

        setEditAbono(null);
        toast.success('Abono actualizado (caja ajustada)', { autoClose: 2500 });
        await cargarAbonos(proforma.id);
      }, 'Actualizando abono…');
    } finally {
      setIsUpdatingAbono(false);
    }
  };

  const confirmarEliminacionAbono = async (abonoId) => {
    try {
      setDeletingAbonoId(abonoId);
      setIsDeletingAbono(true);
      await withLoading(async () => {
        await nextFrame();

        // 1) Elimina abono
        const abonoRef = doc(db, 'abonos', abonoId);
        await deleteDoc(abonoRef);

        // 2) Elimina movimientos vinculados
        const qy = query(
          collection(db, 'cash_movements'),
          where('refType', '==', 'abono'),
          where('refId', '==', abonoId)
        );
        const snap = await getDocs(qy);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'cash_movements', d.id));
        }

        await cargarAbonos(proforma.id);
        toast.success('Abono eliminado (caja ajustada)', { autoClose: 2500 });
      }, 'Eliminando abono…');
    } finally {
      setIsDeletingAbono(false);
      setDeletingAbonoId(null);
    }
  };

  const eliminarAbono = async (abonoId) => {
    toast.info(
      ({ closeToast }) => (
        <div className="toast-confirm-container">
          <p className="toast-confirm-message">¿Estás seguro de que deseas eliminar este abono?</p>
          <div className="toast-confirm-buttons">
            <button
              className="btn-confirm eliminar"
              onClick={async () => {
                await confirmarEliminacionAbono(abonoId);
                closeToast();
              }}
              disabled={busy}
            >
              Eliminar
            </button>
            <button className="btn-confirm cancelar" onClick={closeToast} disabled={busy}>
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
        className: 'toast-confirm-wrapper',
      }
    );
  };

  const cancelarEdicion = () => {
    setEditGasto(null);
    setNewDetalle('');
    setNewMontoStr('');
  };

  const cancelarEdicionAbono = () => {
    setEditAbono(null);
    setNewAbonoMontoStr('');
  };

  // Generar PDF con overlay
  const descargarPDF = async () => {
    const original = document.getElementById('factura-pdf');
    if (!original) return;

    try {
      setIsGeneratingPdf(true);
      await withLoading(async () => {
        const copia = original.cloneNode(true);

        // quitar controles
        copia
          .querySelectorAll(
            'input, select, textarea, button, .boton-accion, .btn-descargar, .buscar-proforma-barra, .grupo-gasto, .factura-abono-y-reparaciones .buscar-proforma-barra'
          )
          .forEach((el) => el.remove());

        // Estilos forzados para PDF
        const styleEl = document.createElement('style');
        styleEl.textContent = `
  .factura-pdf, .factura-pdf * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .factura-tabla-resumen thead th,
  .historial-abonos thead th,
  .historial-gastos thead th,
  .proforma-tabla thead th {
    background: #0f172a !important;
    color: #ffffff !important;
  }
  table tr.no-split-row, table th, table td {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .factura-tabla-resumen thead,
  .historial-abonos thead,
  .historial-gastos thead,
  .proforma-tabla thead {
    display: table-header-group !important;
  }
  .factura-tabla-resumen tbody,
  .historial-abonos tbody,
  .historial-gastos tbody,
  .proforma-tabla tbody {
    display: table-row-group !important;
  }

  /* --- Ajustes Productos en PDF --- */
  /* Ocultar columna Acciones (última) */
  .tabla thead th:last-child,
  .tabla tbody td:last-child {
    display: none !important;
  }

  /* Centrar P. Unit. (col 3) y Subtotal (col 5) */
  .tabla thead th:nth-child(3),
  .tabla tbody td:nth-child(3),
  .tabla thead th:nth-child(5),
  .tabla tbody td:nth-child(5) {
    text-align: center !important;
  }
`;
        copia.insertBefore(styleEl, copia.firstChild);

        // Header con logo + datos
        const header = document.createElement('div');
        header.setAttribute(
          'style',
          'display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;'
        );

        const logoImg = document.createElement('img');
        logoImg.src = logo;
        logoImg.alt = 'Taller 2H';
        logoImg.setAttribute('style', 'width:120px; height:auto;');

        const rightBox = document.createElement('div');
        rightBox.setAttribute(
          'style',
          'text-align:right; font-size:12px; color:#333; line-height:1.3;'
        );
        rightBox.innerHTML = `
          <div><strong></strong>Taller automotriz 2H S.A</div>
          <div><strong>Tel:</strong> 62756427</div>
          <div><strong>Correo:</strong> taller2hrosario@gmail.com</div>
          <div><strong>Cédula Jurídica:</strong> 3-101930294</div>
          <div style="margin-top:6px;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })}</div>
        `;
        header.appendChild(logoImg);
        header.appendChild(rightBox);
        copia.insertBefore(header, copia.firstChild);

        // Ocultar columnas Acciones en historiales
        copia
          .querySelectorAll(
            '.historial-gastos td:last-child, .historial-gastos th:last-child, .historial-abonos td:last-child, .historial-abonos th:last-child'
          )
          .forEach((col) => (col.style.display = 'none'));

        const opt = {
          margin: 0.5,
          filename: `Factura-Proforma-${numeroProforma}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['tr', '.no-split-row'],
          },
        };

        await html2pdf().set(opt).from(copia).save();
      }, 'Generando PDF…');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const onBuscarKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarProforma();
    }
  };

  return (
    <div className="factura-proforma-page">
      <div className="factura-wrapper">
        <ToastContainer
          enableMultiContainer
          containerId="center-toast"
          className="center-toast-container"
          newestOnTop={true}
          closeOnClick={false}
        />

        <div className="fecha-factura-centro">
          Fecha{' '}
          {new Date().toLocaleDateString('es-CR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })}
        </div>

        <h2 className="factura-header">Factura</h2>

        <div className="buscar-proforma-barra">
          <label htmlFor="proformaInput" className="buscar-proforma-label">
            Número de Proforma:
          </label>
          <div className="buscar-proforma-campos">
            <input
              id="proformaInput"
              type="text"
              value={numeroProforma}
              onChange={(e) => setNumeroProforma(e.target.value)}
              onKeyDown={onBuscarKeyDown}
              disabled={isSearching}
            />
            <button className="boton-accion" onClick={buscarProforma} disabled={isSearching}>
              {isSearching ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
        </div>

        {proforma && (
          <div id="factura-pdf" className="factura-pdf">
            <div className="factura-contacto-cliente">
              {cliente && (
                <div className="factura-cliente">
                  <p>
                    Cliente: <strong>{cliente.nombre} {cliente.apellido}</strong>
                  </p>
                  <p>
                    Cédula: <strong>{cliente.cedula}</strong>
                  </p>
                </div>
              )}

              {(vehiculo.marca || vehiculo.modelo || vehiculo.anio || vehiculo.color || vehiculo.placa) && (
                <div className="factura-vehiculo">
                  <p>
                    Vehículo:{' '}
                    <strong>{[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || '—'}</strong>
                  </p>
                  <p>
                    Año: <strong>{vehiculo.anio || '—'}</strong> &nbsp;•&nbsp; Color:{' '}
                    <strong>{vehiculo.color || '—'}</strong>
                  </p>
                  <p>
                    Placa: <strong>{vehiculo.placa || '—'}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Resumen de la proforma */}
            <table className="factura-tabla-resumen">
              <thead>
                <tr>
                  <th>Total Proforma</th>
                  <th>Gastos</th>
                  <th>Productos</th>
                  <th>Total Final</th>
                  <th>Abonado</th>
                  <th>Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatCRC(proforma.total)}</td>
                  <td>{formatCRC(totalGastos)}</td>
                  <td>{formatCRC(totalProductos)}</td>
                  <td>{formatCRC(totalFinal)}</td>
                  <td>{formatCRC(totalAbonado)}</td>
                  <td>{formatCRC(saldoPendiente)}</td>
                </tr>
              </tbody>
            </table>

            {/* ===== Gasto ===== */}
            <div className="grupo-gasto">
              <div className="grupo-gasto-inputs">
                <label htmlFor="detalleGasto">Detalle del Gasto:</label>
                <input
                  id="detalleGasto"
                  type="text"
                  value={detalleGasto}
                  onChange={(e) => setDetalleGasto(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grupo-gasto-inputs">
                <label htmlFor="montoGasto">Monto del Gasto:</label>
                <input
                  id="montoGasto"
                  type="text"
                  inputMode="decimal"
                  value={montoGastoStr}
                  onFocus={onGastoFocus}
                  onChange={(e) => onGastoChange(e.target.value)}
                  onBlur={onGastoBlur}
                  disabled={busy}
                  style={{ textAlign: 'left' }}
                />
              </div>

              <button className="boton-accion" onClick={ingresarGasto} disabled={busy}>
                {isSavingGasto ? 'Guardando…' : 'Ingresar Gasto'}
              </button>
            </div>

            {/* ===== Abono + Columna derecha ===== */}
            <div className="factura-abono-y-reparaciones">
              {/* Izquierda: Abono */}
              <div>
                <div className="buscar-proforma-barra">
                  <label htmlFor="montoAbono" className="buscar-proforma-label">
                    Monto del Abono:
                  </label>
                  <div className="buscar-proforma-campos">
                    <input
                      id="montoAbono"
                      type="text"
                      inputMode="decimal"
                      value={abonoStr}
                      onFocus={onAbonoFocus}
                      onChange={(e) => onAbonoChange(e.target.value)}
                      onBlur={onAbonoBlur}
                      disabled={saldoPendiente <= 0 || busy}
                      style={{ textAlign: 'left' }}
                    />
                    {/* Método de pago */}
                    <select
                      value={abonoMethod}
                      onChange={(e) => setAbonoMethod(e.target.value)}
                      disabled={saldoPendiente <= 0 || busy}
                      aria-label="Método de pago"
                      style={{ height: 36 }}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>

                    <button
                      className="boton-accion"
                      onClick={ingresarAbono}
                      disabled={saldoPendiente <= 0 || busy}
                    >
                      {isSavingAbono ? 'Registrando…' : 'Ingresar Abono'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Derecha: Productos + Reparaciones */}
              <div className="col-right">
                {/* Productos */}
                <div className="grupo-producto">
                  <div className="tabla-headbar">
                    <h3>Productos</h3>
                    <button
                      type="button"
                      className="btn btn--xs btn--auto"
                      onClick={openPicker}
                      disabled={!proforma?.id}
                    >
                      <FaBoxOpen /> Agregar producto
                    </button>
                  </div>

                  <div className="tabla-wrap">
                    <table className="tabla tabla--compact">
                      <thead>
                        <tr>
                          <th style={{ width: 140 }}>Código</th>
                          <th>Descripción</th>
                          <th style={{ width: 120 }} className="is-right">
                            P. Unit.
                          </th>
                          <th style={{ width: 100 }} className="is-center">
                            Cant.
                          </th>
                          <th style={{ width: 120 }} className="is-right">
                            Subtotal
                          </th>
                          <th style={{ width: 90 }} className="is-center">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.length === 0 && (
                          <tr>
                            <td colSpan={6} className="empty">
                              No hay productos agregados.
                            </td>
                          </tr>
                        )}
                        {productos.map((p) => (
                          <tr key={p.id}>
                            <td className="mono">{p.codigo}</td>
                            <td>{p.descripcion}</td>
                            <td className="is-right">{formatCRC(p.precioVenta)}</td>
                            <td className="is-center">{Number(p.cantidad) || 0}</td>
                            <td className="is-right">
                              {formatCRC((Number(p.precioVenta) || 0) * (Number(p.cantidad) || 0))}
                            </td>
                            <td className="is-center">
                              <button
                                className="btn-icon btn-icon--danger"
                                onClick={() => eliminarProducto(p)}
                                title="Eliminar"
                                aria-label="Eliminar producto"
                                disabled={busy}
                              >
                                <FaTrashAlt />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reparaciones */}
                <div className="tabla-wrap reparaciones-wrap">
                  <div className="tabla-headbar">
                    <h3>Reparaciones</h3>
                  </div>

                  <table className="proforma-tabla" role="table" style={{ listStyle: 'none' }}>
                    <thead>
                      <tr role="row">
                        <th role="columnheader" className="th-desc" style={{ textAlign: 'left' }}>
                          Descripción
                        </th>
                        <th role="columnheader" className="th-monto" style={{ textAlign: 'right' }}>
                          Monto
                        </th>
                      </tr>
                    </thead>

                    <tbody style={{ listStyle: 'none', paddingLeft: 0 }}>
                      {reparaciones.length > 0 ? (
                        reparaciones.map((r, idx) => (
                          <tr key={idx} role="row">
                            <td className="td-desc" style={{ textAlign: 'left' }}>
                              {r.concepto || '—'}
                            </td>
                            <td className="td-monto" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {formatCRC(r.precio)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="empty" style={{ textAlign: 'center' }}>
                            Esta proforma no tiene reparaciones.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <button className="boton-accion btn-descargar" onClick={descargarPDF} disabled={busy}>
              {isGeneratingPdf ? 'Generando PDF…' : 'Descargar Factura'}
            </button>

            {/* Historial de abonos con acciones */}
            {abonos.length > 0 && (
              <div className="historial-abonos">
                <h3>Historial de Abonos</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonos.map((ab) => (
                      <tr key={ab.id}>
                        <td>{ab.fecha}</td>
                        <td>
                          {editAbono && editAbono.id === ab.id ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={newAbonoMontoStr}
                              onFocus={onEditAbonoFocus}
                              onChange={(e) => onEditAbonoChange(e.target.value)}
                              onBlur={onEditAbonoBlur}
                              disabled={busy}
                              style={{ textAlign: 'left' }}
                            />
                          ) : (
                            formatCRC(ab.monto)
                          )}
                        </td>
                        <td>
                          {editAbono && editAbono.id === ab.id ? (
                            <>
                              <button onClick={() => guardarEdicionAbono(ab.id)} disabled={busy} title="Guardar">
                                <FaSave />
                              </button>
                              <button onClick={cancelarEdicionAbono} disabled={busy} title="Cancelar">
                                <FaTimes />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => editarAbono(ab)} disabled={busy} title="Editar">
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => eliminarAbono(ab.id)}
                                disabled={busy || deletingAbonoId === ab.id}
                                className={deletingAbonoId === ab.id ? 'btn-eliminando' : ''}
                                aria-busy={deletingAbonoId === ab.id}
                                title="Eliminar"
                              >
                                {deletingAbonoId === ab.id ? 'Eliminando…' : <FaTrashAlt />}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Historial de gastos */}
            {gastos.length > 0 && (
              <div className="historial-gastos">
                <h3>Gastos Registrados</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Detalle</th>
                      <th>Monto</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map((g) => (
                      <tr key={g.id}>
                        <td>{g.fecha}</td>
                        <td>
                          {editGasto && editGasto.id === g.id ? (
                            <input
                              type="text"
                              value={newDetalle}
                              onChange={(e) => setNewDetalle(e.target.value)}
                              disabled={busy}
                            />
                          ) : (
                            g.detalle
                          )}
                        </td>
                        <td>
                          {editGasto && editGasto.id === g.id ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={newMontoStr}
                              onFocus={onEditMontoFocus}
                              onChange={(e) => onEditMontoChange(e.target.value)}
                              onBlur={onEditMontoBlur}
                              disabled={busy}
                              style={{ textAlign: 'left' }}
                            />
                          ) : (
                            formatCRC(g.monto)
                          )}
                        </td>
                        <td>
                          {editGasto && editGasto.id === g.id ? (
                            <>
                              <button onClick={() => guardarEdicion(g.id)} disabled={busy} title="Guardar">
                                <FaSave />
                              </button>
                              <button onClick={cancelarEdicion} disabled={busy} title="Cancelar">
                                <FaTimes />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => editarGasto(g)} disabled={busy} title="Editar">
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => eliminarGasto(g.id)}
                                disabled={busy || deletingGastoId === g.id}
                                className={deletingGastoId === g.id ? 'btn-eliminando' : ''}
                                aria-busy={deletingGastoId === g.id}
                                title="Eliminar"
                              >
                                {deletingGastoId === g.id ? 'Eliminando…' : <FaTrashAlt />}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {saldoPendiente === 0 && (
              <>
                <div className="nota-final-cliente">
                  <p>
                    <strong>Nota:</strong> Al firmar esta factura, el cliente confirma que ha recibido el vehículo conforme y
                    acepta que <strong>una vez retirado del taller, no se ofrece garantía por daños posteriores</strong> que
                    no estén relacionados con los servicios prestados. Se recomienda revisar el vehículo antes de su entrega.
                  </p>
                </div>

                <div className="firma-cliente">
                  <label>Firma del Cliente:</label>
                  <div className="linea-firma" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== Modal Picker Inventario ===== */}
      {showPicker && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pickerBusy) setShowPicker(false);
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="picker-title">
            <div className="modal-icon">
              <FaBoxOpen />
            </div>
            <h4 id="picker-title" className="modal-title">
              Agregar producto del inventario
            </h4>

            {/* buscador */}
            <div className="picker-search">
              <FaSearch />
              <input
                placeholder="Buscar por código o descripción…"
                value={pickerSearch}
                onChange={(e) => {
                  setPickerSearch(e.target.value);
                  setPickerPage(1);
                }}
                disabled={pickerBusy}
              />
            </div>

            <div className="picker-meta">
              {filteredInv.length} resultado{filteredInv.length !== 1 ? 's' : ''}
            </div>

            <div className="picker-table-wrap">
              <table className="picker-table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Código</th>
                    <th>Descripción</th>
                    <th className="is-right" style={{ width: 140 }}>
                      P. Venta
                    </th>
                    <th className="is-center" style={{ width: 120 }}>
                      Disp.
                    </th>
                    <th className="is-center" style={{ width: 110 }}>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pickerRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="table-empty">Sin resultados</td>
                    </tr>
                  )}
                  {pickerRows.map((it) => {
                    const zero = (Number(it.cantidad) || 0) <= 0;
                    const selected = selectedInv?.id === it.id;
                    const pVenta = Number(it.precioVenta ?? it.precio ?? 0);
                    return (
                      <tr key={it.id} className={`${selected ? 'is-selected' : ''} ${zero ? 'is-zero' : ''}`}>
                        <td className="mono">{it.codigo}</td>
                        <td>{it.descripcion}</td>
                        <td className="is-right">{formatCRC(pVenta)}</td>
                        <td className="is-center">{Number(it.cantidad) || 0}</td>
                        <td className="is-center">
                          <button className="btn-pill" onClick={() => !zero && selectInv(it)} disabled={pickerBusy || zero}>
                            Usar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación del picker */}
            <div className="picker-pagination">
              <Pagination
                currentPage={pickerPage}
                totalItems={filteredInv.length}
                itemsPerPage={pickerPerPage}
                onPageChange={(p) => !pickerBusy && setPickerPage(p)}
              />
            </div>

            {/* Cantidad y confirmación */}
            <div className="picker-qty-row">
              <label>
                Cantidad a usar
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value.replace(/[^\d]/g, ''))}
                  disabled={pickerBusy || !selectedInv}
                />
              </label>
              <div className="modal-actions">
                <button className="btn btn--ghost" onClick={() => setShowPicker(false)} disabled={pickerBusy}>
                  Cancelar
                </button>
                <button className="btn" onClick={confirmarProducto} disabled={pickerBusy || !selectedInv}>
                  {pickerBusy ? 'Agregando…' : 'Agregar producto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Factura;
