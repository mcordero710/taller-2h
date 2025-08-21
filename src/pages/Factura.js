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
import { toast } from 'react-toastify';
import { FaEdit, FaTrashAlt, FaSave, FaTimes } from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import logo from '../assets/logo.png';

// Loader global
import { useLoading } from '../components/ui/LoadingContext';

const Factura = () => {
  const [numeroProforma, setNumeroProforma] = useState('');
  const [proforma, setProforma] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [abono, setAbono] = useState('');
  const [abonos, setAbonos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [detalleGasto, setDetalleGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [editGasto, setEditGasto] = useState(null);
  const [newDetalle, setNewDetalle] = useState('');
  const [newMonto, setNewMonto] = useState('');
  const [reparaciones, setReparaciones] = useState([]);



  // flags para deshabilitar controles
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingGasto, setIsSavingGasto] = useState(false);
  const [isUpdatingGasto, setIsUpdatingGasto] = useState(false);
  const [isDeletingGasto, setIsDeletingGasto] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingAbono, setIsSavingAbono] = useState(false);
  const [deletingGastoId, setDeletingGastoId] = useState(null);

  const busy = isSearching || isSavingGasto || isUpdatingGasto || isDeletingGasto || isGeneratingPdf || isSavingAbono;

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

          // 👇 NUEVO: normaliza y guarda las reparaciones para la tabla
          const repars = Array.isArray(data.reparaciones)
            ? data.reparaciones.map((r) => ({
              concepto: r.concepto ?? r.descripcion ?? '',
              precio: Number(r.precio ?? r.monto ?? 0),
            }))
            : [];
          setReparaciones(repars);

          setProforma(data);
          await Promise.all([cargarAbonos(docRef.id), cargarGastos(docRef.id)]);

          // (opcional) feedback
          // toast.success(`Proforma #${data.numero} cargada (${repars.length} reparaciones)`);
        } else {
          setProforma(null);
          setAbonos([]);
          setGastos([]);
          setReparaciones([]); // 👈 NUEVO: limpia la tabla si no se encuentra
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
    const q = query(collection(db, 'abonos'), where('proformaId', '==', proformaId));
    const snapshot = await getDocs(q);
    const resultados = snapshot.docs.map(doc => doc.data());
    setAbonos(resultados);
  };

  const cargarGastos = async (proformaId) => {
    const q = query(collection(db, 'gastos'), where('proformaId', '==', proformaId));
    const snapshot = await getDocs(q);
    const resultados = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setGastos(resultados);
  };

  const totalAbonado = abonos.reduce((sum, a) => sum + a.monto, 0);
  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
  const totalFinal = proforma ? proforma.total + totalGastos : 0;
  const saldoPendiente = totalFinal - totalAbonado;

  // Ingresar abono (lo dejamos sin overlay porque pediste solo gastos/PDF)
  const ingresarAbono = async () => {
    let valid = true;

    if (!abono || abono.trim() === '' || isNaN(abono)) {
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
          monto: parseInt(abono, 10),
          fecha: new Date().toLocaleDateString(),
        };
        await addDoc(collection(db, 'abonos'), nuevoAbono);
        await cargarAbonos(proforma.id);
        setAbono('');
        toast.success('Abono registrado exitosamente', { autoClose: 2500 });
      }, 'Registrando abono…'); // 👈 texto del overlay
    } finally {
      setIsSavingAbono(false);
    }
  };


  // Ingresar gasto con overlay
  const ingresarGasto = async () => {
    let valid = true;

    if (!detalleGasto || detalleGasto.trim() === '') {
      toast.error('Por favor, ingrese la información del "Detalle del Gasto".');
      valid = false;
    }

    if (!montoGasto || isNaN(montoGasto) || montoGasto.trim() === '') {
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
          monto: parseInt(montoGasto),
          fecha: new Date().toLocaleDateString(),
        };
        await addDoc(collection(db, 'gastos'), nuevoGasto);
        await cargarGastos(proforma.id);
        setDetalleGasto('');
        setMontoGasto('');
        toast.success('Gasto registrado exitosamente', { autoClose: 2500 });
      }, 'Registrando gasto…');
    } finally {
      setIsSavingGasto(false);
    }
  };

  const editarGasto = (gasto) => {
    if (!gasto || !gasto.id) {
      toast.error('ID de gasto no válido', { autoClose: 2500 });
      return;
    }
    setEditGasto(gasto);
    setNewDetalle(gasto.detalle);
    setNewMonto(gasto.monto);
  };

  // Guardar edición con overlay
  const guardarEdicion = async (gastoId) => {
    if (!gastoId) {
      toast.error('ID de gasto no válido', { autoClose: 2500 });
      return;
    }
    if (!newDetalle || !newMonto || isNaN(newMonto)) {
      toast.warn('Por favor ingresa un detalle y un monto válidos.', { autoClose: 2500 });
      return;
    }

    try {
      setIsUpdatingGasto(true);
      await withLoading(async () => {
        const gastoRef = doc(db, 'gastos', gastoId);
        await updateDoc(gastoRef, {
          detalle: newDetalle,
          monto: parseInt(newMonto),
        });
        setEditGasto(null);
        toast.success('Gasto actualizado exitosamente', { autoClose: 2500 });
        await cargarGastos(proforma.id);
      }, 'Actualizando gasto…');
    } finally {
      setIsUpdatingGasto(false);
    }
  };

  // Confirm toast -> al dar "Eliminar" llama a esta con overlay
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

  const confirmarEliminacion = async (gastoId) => {
    try {
      setDeletingGastoId(gastoId);
      setIsDeletingGasto(true);
      await withLoading(async () => {
        // 👇 Deja que React pinte el overlay ANTES de borrar
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
            <button
              className="btn-confirm cancelar"
              onClick={closeToast}
              disabled={busy}
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

  const cancelarEdicion = () => {
    setEditGasto(null);
    setNewDetalle('');
    setNewMonto('');
  };

  // Generar PDF con overlay
  const descargarPDF = async () => {
    const original = document.getElementById('factura-pdf');
    if (!original) return;

    try {
      setIsGeneratingPdf(true);
      await withLoading(async () => {
        const copia = original.cloneNode(true);

        // --- estilos para PDF con colores (encabezados azules) ---
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
        `;
        copia.insertBefore(styleEl, copia.firstChild);

        // Fallback extra: pintamos inline por si algún motor ignora la hoja <style>
        copia
          .querySelectorAll(
            '.factura-tabla-resumen thead th, .historial-abonos thead th, .historial-gastos thead th'
          )
          .forEach((th) => {
            th.style.background = '#0f172a';
            th.style.color = '#fff';
          });
        // --- fin estilos para PDF con colores ---

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
          <div style="margin-top:6px;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
        `;

        header.appendChild(logoImg);
        header.appendChild(rightBox);
        copia.insertBefore(header, copia.firstChild);

        // Quitamos controles/inputs del clon
        copia
          .querySelectorAll(
            'input, button, .boton-accion, .btn-descargar, .grupo-gasto-column, .buscar-proforma-barra'
          )
          .forEach((el) => el.remove());
        copia
          .querySelectorAll('.historial-gastos td:last-child, .historial-gastos th:last-child')
          .forEach((col) => (col.style.display = 'none'));

        const opt = {
          margin: 0.5,
          filename: `Factura-Proforma-${numeroProforma}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
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
          Fecha: {new Date().toLocaleDateString('es-CR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })}
        </div>

        <h2 className="factura-header">Factura</h2>

        <div className="buscar-proforma-barra">
          <label htmlFor="proformaInput" className="buscar-proforma-label">Número de Proforma:</label>
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
                  <p>Cliente: <strong>{cliente.nombre} {cliente.apellido}</strong></p>
                  <p>Cédula: <strong>{cliente.cedula}</strong></p>
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
                  <td>{proforma.total.toLocaleString()}</td>
                  <td>{totalGastos.toLocaleString()}</td>
                  <td>{totalFinal.toLocaleString()}</td>
                  <td>{totalAbonado.toLocaleString()}</td>
                  <td>{saldoPendiente.toLocaleString()}</td>
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
                  type="number"
                  value={montoGasto}
                  onChange={(e) => setMontoGasto(e.target.value)}
                  disabled={busy}
                />
              </div>

              <button className="boton-accion" onClick={ingresarGasto} disabled={busy}>
                {isSavingGasto ? 'Guardando…' : 'Ingresar Gasto'}
              </button>
            </div>

            {/* === AQUÍ VA EL AJUSTE: Abono + Tabla de Reparaciones LADO A LADO === */}
            <div
              className="factura-abono-y-reparaciones"
            >
              {/* Columna izquierda: Monto del Abono (igual que ya lo tenías) */}
              <div>
                <div className="buscar-proforma-barra">
                  <label htmlFor="montoAbono" className="buscar-proforma-label">Monto del Abono:</label>
                  <div className="buscar-proforma-campos">
                    <input
                      id="montoAbono"
                      type="number"
                      value={abono}
                      onChange={(e) => setAbono(e.target.value)}
                      disabled={saldoPendiente <= 0 || busy}
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

              {/* Columna derecha: Tabla de Reparaciones de la Proforma */}
              {/* Columna derecha: Tabla de Reparaciones de la Proforma */}
              <div className="tabla-wrap">
                <div className="tabla-headbar">
                  <h3>Reparaciones de la Proforma</h3>
                </div>

                <table
                  className="proforma-tabla"
                  role="table"
                  style={{ listStyle: 'none' }}
                >
                  <thead>
                    <tr role="row">
                      <th
                        role="columnheader"
                        className="th-desc"
                        style={{ textAlign: 'left', display: 'table-cell', listStyle: 'none' }}
                      >
                        Descripción
                      </th>
                      <th
                        role="columnheader"
                        className="th-monto"
                        style={{ textAlign: 'right', display: 'table-cell', listStyle: 'none' }}
                      >
                        Monto
                      </th>
                    </tr>
                  </thead>

                  <tbody style={{ listStyle: 'none', paddingLeft: 0 }}>
                    {reparaciones.length > 0 ? (
                      reparaciones.map((r, idx) => (
                        <tr key={idx} role="row">
                          <td
                            className="td-desc"
                            style={{ textAlign: 'left', display: 'table-cell', listStyle: 'none' }}
                          >
                            {r.concepto || '—'}
                          </td>
                          <td
                            className="td-monto"
                            style={{
                              textAlign: 'right',
                              display: 'table-cell',
                              listStyle: 'none',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {'₡\u00A0' + Number(r.precio || 0).toLocaleString('es-CR')}
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
            {/* === FIN AJUSTE === */}

            <button className="boton-accion btn-descargar" onClick={descargarPDF} disabled={busy}>
              {isGeneratingPdf ? 'Generando PDF…' : 'Descargar Factura'}
            </button>

            {/* Historial de abonos */}
            {abonos.length > 0 && (
              <div className="historial-abonos">
                <h3>Historial de Abonos</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonos.map((ab, index) => (
                      <tr key={index}>
                        <td>{ab.fecha}</td>
                        <td>{ab.monto.toLocaleString()}</td>
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
                      <tr key={index}>
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
                              type="number"
                              value={newMonto}
                              onChange={(e) => setNewMonto(e.target.value)}
                              disabled={busy}
                            />
                          ) : (
                            g.monto.toLocaleString()
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
