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
  deleteDoc
} from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import { toast, ToastContainer } from 'react-toastify';
import { FaEdit, FaTrashAlt, FaSave, FaTimes } from 'react-icons/fa';
import logo from '../assets/logo.png';

// Loader global
import { useLoading } from '../components/ui/LoadingContext';

/* ===== Helpers de formato (mismo estilo que Proforma) ===== */
const LOCALE_NUMERIC = 'es-ES'; // 100.000,00

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
    normalized = lastComma > lastDot
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

const Factura = () => {
  const [numeroProforma, setNumeroProforma] = useState('');
  const [proforma, setProforma] = useState(null);
  const [cliente, setCliente] = useState(null);

  // Abonos
  const [abonoStr, setAbonoStr] = useState(''); // input mostrado
  const [abonos, setAbonos] = useState([]);

  // Gastos
  const [gastos, setGastos] = useState([]);
  const [detalleGasto, setDetalleGasto] = useState('');
  const [montoGastoStr, setMontoGastoStr] = useState(''); // input mostrado

  // Edición de gasto
  const [editGasto, setEditGasto] = useState(null);
  const [newDetalle, setNewDetalle] = useState('');
  const [newMontoStr, setNewMontoStr] = useState(''); // input mostrado en edición

  // Edición de abono (mismo look&feel que gastos)
  const [editAbono, setEditAbono] = useState(null);
  const [newAbonoMontoStr, setNewAbonoMontoStr] = useState('');

  const [reparaciones, setReparaciones] = useState([]);

  // info del vehículo (como en Proforma)
  const [vehiculo, setVehiculo] = useState({
    placa: '',
    marca: '',
    modelo: '',
    anio: '',
    color: '',
  });

  // flags para deshabilitar controles
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingGasto, setIsSavingGasto] = useState(false);
  const [isUpdatingGasto, setIsUpdatingGasto] = useState(false);
  const [isDeletingGasto, setIsDeletingGasto] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingAbono, setIsSavingAbono] = useState(false);

  // flags iguales para abonos
  const [isUpdatingAbono, setIsUpdatingAbono] = useState(false);
  const [isDeletingAbono, setIsDeletingAbono] = useState(false);

  const [deletingGastoId, setDeletingGastoId] = useState(null);
  const [deletingAbonoId, setDeletingAbonoId] = useState(null);

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
        cargarCliente(proforma.clienteId); // cliente como referencia
      } else if (proforma.cliente && proforma.cliente.nombre && proforma.cliente.cedula) {
        setCliente(proforma.cliente); // cliente embebido
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

          // normaliza vehículo (soporta proformas viejas sin "modelo")
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
          await Promise.all([cargarAbonos(docRef.id), cargarGastos(docRef.id)]);
        } else {
          setProforma(null);
          setAbonos([]);
          setGastos([]);
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
    const resultados = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })); // 👈 incluye id
    setAbonos(resultados);
  };

  const cargarGastos = async (proformaId) => {
    const qy = query(collection(db, 'gastos'), where('proformaId', '==', proformaId));
    const snapshot = await getDocs(qy);
    const resultados = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setGastos(resultados);
  };

  const totalAbonado = abonos.reduce((sum, a) => sum + (Number(a.monto) || 0), 0);
  const totalGastos = gastos.reduce((sum, g) => sum + (Number(g.monto) || 0), 0);
  const totalFinal = proforma ? (Number(proforma.total) || 0) + totalGastos : 0;
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
        const nuevoAbono = {
          proformaId: proforma.id,
          monto, // número (puede tener decimales)
          fecha: new Date().toLocaleDateString(),
        };
        await addDoc(collection(db, 'abonos'), nuevoAbono);
        await cargarAbonos(proforma.id);
        setAbonoStr('');
        toast.success('Abono registrado exitosamente', { autoClose: 2500 });
      }, 'Registrando abono…');
    } finally {
      setIsSavingAbono(false);
    }
  };

  /* ====== GASTO (ingreso) ====== */
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
          monto, // número
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

  /* ====== EDICIÓN DE GASTO ====== */
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

  // Confirm toast -> al dar "Eliminar" llama a esta con overlay (Gastos)
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

  /* ====== EDICIÓN / ELIMINACIÓN DE ABONO (igual que gastos) ====== */
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
        const abonoRef = doc(db, 'abonos', abonoId);
        await updateDoc(abonoRef, { monto });
        setEditAbono(null);
        toast.success('Abono actualizado exitosamente', { autoClose: 2500 });
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
        const abonoRef = doc(db, 'abonos', abonoId);
        await deleteDoc(abonoRef);
        await cargarAbonos(proforma.id);
        toast.success('Abono eliminado exitosamente', { autoClose: 2500 });
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
  
        // Marcar todas las filas para que NO se corten entre páginas
        copia.querySelectorAll('table tr').forEach(tr => tr.classList.add('no-split-row'));
  
        // --- estilos para PDF (colores + evitar cortes + repetir thead) ---
        const styleEl = document.createElement('style');
        styleEl.textContent = `
          .factura-pdf, .factura-pdf * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .factura-tabla-resumen thead th,
          .historial-abonos thead th,
          .historial-gastos thead th {
            background: #0f172a !important;
            color: #ffffff !important;
          }
          /* Evitar cortar filas entre páginas */
          table tr.no-split-row, table th, table td {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
            -moz-column-break-inside: avoid !important;
          }
          /* Repetir encabezados de todas las tablas en cada página */
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
        `;
        copia.insertBefore(styleEl, copia.firstChild);
  
        // Forzar colores de encabezados en el clon
        copia
          .querySelectorAll(
            '.factura-tabla-resumen thead th, .historial-abonos thead th, .historial-gastos thead th'
          )
          .forEach((th) => {
            th.style.background = '#0f172a';
            th.style.color = '#fff';
          });
  
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
        rightBox.setAttribute('style', 'text-align:right; font-size:12px; color:#333; line-height:1.3;');
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
  
        // Quitar controles/inputs del clon
        copia
          .querySelectorAll('input, button, .boton-accion, .btn-descargar, .grupo-gasto-column, .buscar-proforma-barra')
          .forEach((el) => el.remove());
  
        // Ocultar la columna de acciones en ambos historiales
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
          // Indicar a html2pdf que use reglas CSS y evite cortar <tr>
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['tr', '.no-split-row']
          }
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
          Fecha:{' '}
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
                  <th>Total Final</th>
                  <th>Abonado</th>
                  <th>Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{formatCRC(proforma.total)}</td>
                  <td>{formatCRC(totalGastos)}</td>
                  <td>{formatCRC(totalFinal)}</td>
                  <td>{formatCRC(totalAbonado)}</td>
                  <td>{formatCRC(saldoPendiente)}</td>
                </tr>
              </tbody>
            </table>

            {/* Formularios para ingresar gastos */}
            <div className="grupo-gasto-column">
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

            {/* Abono + Tabla de Reparaciones */}
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

              {/* Derecha: Reparaciones */}
              <div className="tabla-wrap">
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

            <button className="boton-accion btn-descargar" onClick={descargarPDF} disabled={busy}>
              {isGeneratingPdf ? 'Generando PDF…' : 'Descargar Factura'}
            </button>

            {/* Historial de abonos con acciones (igual a gastos) */}
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
                    {abonos.map((ab, index) => (
                      <tr key={ab.id || index}>
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
                              <button onClick={() => guardarEdicionAbono(ab.id)} disabled={busy}>
                                <FaSave />
                              </button>
                              <button onClick={cancelarEdicionAbono} disabled={busy}>
                                <FaTimes />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => editarAbono(ab)} disabled={busy}>
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => eliminarAbono(ab.id)}
                                disabled={busy || deletingAbonoId === ab.id}
                                className={deletingAbonoId === ab.id ? 'btn-eliminando' : ''}
                                aria-busy={deletingAbonoId === ab.id}
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
                    {gastos.map((g, index) => (
                      <tr key={g.id || index}>
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
                              <button onClick={() => guardarEdicion(g.id)} disabled={busy}>
                                <FaSave />
                              </button>
                              <button onClick={cancelarEdicion} disabled={busy}>
                                <FaTimes />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => editarGasto(g)} disabled={busy}>
                                <FaEdit />
                              </button>
                              <button
                                onClick={() => eliminarGasto(g.id)}
                                disabled={busy || deletingGastoId === g.id}
                                className={deletingGastoId === g.id ? 'btn-eliminando' : ''}
                                aria-busy={deletingGastoId === g.id}
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
                    <strong>Nota:</strong> Al firmar esta factura, el cliente confirma que ha recibido el vehículo conforme
                    y acepta que <strong>una vez retirado del taller, no se ofrece garantía por daños posteriores</strong>
                    que no estén relacionados con los servicios prestados. Se recomienda revisar el vehículo antes de su entrega.
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
    </div>
  );
};

export default Factura;
