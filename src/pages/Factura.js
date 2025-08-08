import React, { useState, useEffect } from 'react';
import './Factura.css';
import { db } from '../firebase/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,  // Importar getDoc
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import { toast } from 'react-toastify';
import { FaEdit, FaTrashAlt, FaSave, FaTimes } from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';


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

  // Cargar cliente de Firestore
  useEffect(() => {
    if (proforma) {
      if (proforma.clienteId) {
        cargarCliente(proforma.clienteId); // cliente como referencia
      } else if (proforma.cliente && proforma.cliente.nombre && proforma.cliente.cedula) {
        setCliente(proforma.cliente); // cliente embebido
      }
    }
  }, [proforma]);


  const cargarCliente = async (clienteId) => {
    if (!clienteId) {
      toast.error('Cliente ID no disponible', { autoClose: 2500 });
      return;
    }

    const clienteRef = doc(db, 'clientes', clienteId);  // Obtener el documento de cliente por clienteId
    const clienteSnap = await getDoc(clienteRef);  // Usar getDoc aquí
    if (clienteSnap.exists()) {
      setCliente(clienteSnap.data());  // Si el cliente existe, establecerlo en el estado
    } else {
      toast.error('No se encontró el cliente', { autoClose: 2500 });
    }
  };

  const buscarProforma = async () => {
    const q = query(collection(db, 'proformas'), where('numero', '==', parseInt(numeroProforma)));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0];
      setProforma({ id: docRef.id, ...docRef.data() });  // Establecer la proforma y llamar a cargarAbonos y cargarGastos
      cargarAbonos(docRef.id);
      cargarGastos(docRef.id);
    } else {
      setProforma(null);
      setAbonos([]);
      setGastos([]);
      toast.info('Proforma no encontrada.', { autoClose: 2500 });
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

    const nuevoAbono = {
      proformaId: proforma.id,
      monto: parseInt(abono),
      fecha: new Date().toLocaleDateString(),
    };

    await addDoc(collection(db, 'abonos'), nuevoAbono);
    await cargarAbonos(proforma.id);

    setAbono('');
    toast.success('Abono registrado exitosamente', { autoClose: 2500 });
  };

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
  };

  const editarGasto = async (gasto) => {
    if (!gasto || !gasto.id) {
      toast.error('ID de gasto no válido', { autoClose: 2500 });
      return;
    }
    setEditGasto(gasto);
    setNewDetalle(gasto.detalle);
    setNewMonto(gasto.monto);
  };

  const guardarEdicion = async (gastoId) => {
    if (!gastoId) {
      toast.error('ID de gasto no válido', { autoClose: 2500 });
      return;
    }
    if (!newDetalle || !newMonto || isNaN(newMonto)) {
      toast.warn('Por favor ingresa un nombre y un monto válidos.', { autoClose: 2500 });
      return;
    }

    const gastoRef = doc(db, 'gastos', gastoId);
    await updateDoc(gastoRef, {
      detalle: newDetalle,
      monto: parseInt(newMonto),
    });

    setEditGasto(null);
    toast.success('Gasto actualizado exitosamente', { autoClose: 2500 });
    cargarGastos(proforma.id);
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


  const confirmarEliminacion = async (gastoId) => {
    const gastoRef = doc(db, 'gastos', gastoId);
    await deleteDoc(gastoRef);
    toast.success('Gasto eliminado exitosamente', { autoClose: 2500 });
    cargarGastos(proforma.id);
  };

  const cancelarEdicion = () => {
    setEditGasto(null);
    setNewDetalle('');
    setNewMonto('');
  };

  const descargarPDF = () => {
    const original = document.getElementById('factura-pdf');
    const copia = original.cloneNode(true);
  
    // Traer la fecha que está fuera y ponerla al inicio del clon
    const fechaOriginal = document.querySelector('.fecha-factura-centro');
    if (fechaOriginal) {
      const fechaClon = fechaOriginal.cloneNode(true);
      copia.insertBefore(fechaClon, copia.firstChild);
    }
  
    // Ocultar inputs/botones en la copia
    const elementosAEliminar = copia.querySelectorAll(
      'input, button, .boton-accion, .btn-descargar, .grupo-gasto-column, .buscar-proforma-barra'
    );
    elementosAEliminar.forEach(el => el.remove());
  
    // Ocultar columna Acciones
    const columnasAcciones = copia.querySelectorAll('.historial-gastos td:last-child, .historial-gastos th:last-child');
    columnasAcciones.forEach(col => col.style.display = 'none');
  
    const opt = {
      margin: 0.5,
      filename: `Factura-Proforma-${numeroProforma}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
  
    html2pdf().set(opt).from(copia).save();
  };
  


  return (
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
          />
          <button className="boton-accion" onClick={buscarProforma}>Buscar</button>
        </div>
      </div>

      {proforma && (
        <div id="factura-pdf" className="factura-pdf">
          <div className="factura-contacto-cliente">
            <div className="factura-contacto">
              <p>Tel: (506) 2222-2222</p>
              <p>Email: info@taller2h.com</p>
              <p>Dirección: San José, Costa Rica</p>
              <p>Cédula Jurídica: 123145644</p>
            </div>

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

          {/* Formularios para ingresar gastos y abonos */}
          <div className="grupo-gasto-column">
            <div className="grupo-gasto-inputs">
              <label htmlFor="detalleGasto">Detalle del Gasto:</label>
              <input
                id="detalleGasto"
                type="text"
                value={detalleGasto}
                onChange={(e) => setDetalleGasto(e.target.value)}
              />
            </div>

            <div className="grupo-gasto-inputs">
              <label htmlFor="montoGasto">Monto del Gasto:</label>
              <input
                id="montoGasto"
                type="number"
                value={montoGasto}
                onChange={(e) => setMontoGasto(e.target.value)}
              />
            </div>

            <button className="boton-accion" onClick={ingresarGasto}>Ingresar Gasto</button>
          </div>

          <div className="buscar-proforma-barra">
            <label htmlFor="montoAbono" className="buscar-proforma-label">Monto del Abono:</label>
            <div className="buscar-proforma-campos">
              <input
                id="montoAbono"
                type="number"
                value={abono}
                onChange={(e) => setAbono(e.target.value)}
                disabled={saldoPendiente <= 0}
              />
              <button className="boton-accion" onClick={ingresarAbono} disabled={saldoPendiente <= 0}>Ingresar Abono</button>
            </div>
          </div>

          <button className="boton-accion btn-descargar" onClick={descargarPDF}>
            Descargar Factura
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
                          />
                        ) : (
                          g.monto.toLocaleString()
                        )}
                      </td>
                      <td>
                        {editGasto && editGasto.id === g.id ? (
                          <>
                            <button onClick={() => guardarEdicion(g.id)}>
                              <FaSave />
                            </button>
                            <button onClick={cancelarEdicion}>
                              <FaTimes />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => editarGasto(g)}>
                              <FaEdit />
                            </button>
                            <button onClick={() => eliminarGasto(g.id)}>
                              <FaTrashAlt />
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
  );
};

export default Factura;
