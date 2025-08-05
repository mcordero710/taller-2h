import React, { useState } from 'react';
import './Factura.css';
import { db } from '../firebase/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import { toast } from 'react-toastify';
import { FaEdit, FaTrashAlt, FaSave, FaTimes } from 'react-icons/fa'; // Importamos los íconos

const Factura = () => {
  const [numeroProforma, setNumeroProforma] = useState('');
  const [proforma, setProforma] = useState(null);
  const [abono, setAbono] = useState('');
  const [abonos, setAbonos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [detalleGasto, setDetalleGasto] = useState('');
  const [montoGasto, setMontoGasto] = useState('');
  const [editGasto, setEditGasto] = useState(null);
  const [newDetalle, setNewDetalle] = useState('');
  const [newMonto, setNewMonto] = useState('');

  const buscarProforma = async () => {
    const q = query(collection(db, 'proformas'), where('numero', '==', parseInt(numeroProforma)));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docRef = snapshot.docs[0];
      setProforma({ id: docRef.id, ...docRef.data() });
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
    if (!abono || isNaN(abono)) return;
    if (saldoPendiente <= 0) {
      toast.warn('La factura ya está saldada. No se pueden ingresar más abonos.', { autoClose: 2500 });
      return;
    }

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
    if (!detalleGasto || !montoGasto || isNaN(montoGasto)) return;

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
    const confirmacion = window.confirm("¿Estás seguro de que deseas eliminar este gasto?");
    if (confirmacion) {
      const gastoRef = doc(db, 'gastos', gastoId);
      await deleteDoc(gastoRef);
      toast.success('Gasto eliminado exitosamente', { autoClose: 2500 });
      cargarGastos(proforma.id);
    }
  };

  const cancelarEdicion = () => {
    setEditGasto(null); // Cancelar la edición
    setNewDetalle('');  // Limpiar el detalle
    setNewMonto('');    // Limpiar el monto
  };

  const descargarPDF = () => {
    const element = document.getElementById('factura-pdf');
    html2pdf().from(element).save(`Factura-Proforma-${numeroProforma}.pdf`);
  };

  return (
    <div className="factura-wrapper">
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
          <button onClick={buscarProforma}>Buscar</button>
        </div>
      </div>

      {proforma && (
        <div id="factura-pdf" className="factura-info">
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

            <button onClick={ingresarGasto}>Ingresar Gasto</button>
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
              <button onClick={ingresarAbono} disabled={saldoPendiente <= 0}>Ingresar Abono</button>
            </div>
          </div>

          <button className="btn-descargar" onClick={descargarPDF}>
            Descargar Factura
          </button>

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
                              <FaTimes /> {/* Ícono para cancelar */}
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
            <div className="firma-cliente">
              <label>Firma del Cliente:</label>
              <div className="linea-firma" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Factura;
