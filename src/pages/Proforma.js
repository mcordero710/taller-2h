import React, { useState, useEffect } from 'react';
import './Proforma.css';
import { db, obtenerNumeroProforma, actualizarNumeroProforma } from '../firebase/firebase';
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import logo from '../assets/logo.png';
import html2pdf from 'html2pdf.js';
import { toast, ToastContainer } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faSave, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router-dom';
import { FiTrash2 } from 'react-icons/fi';

const Proforma = () => {
  const [cedula, setCedula] = useState('');
  const [cliente, setCliente] = useState(null);
  const [vehiculo, setVehiculo] = useState({ placa: '', marca: '', anio: '', color: '' });
  const [reparaciones, setReparaciones] = useState([]);
  const [total, setTotal] = useState(0);
  const [ivaChecked, setIvaChecked] = useState(false);
  const [ivaAmount, setIvaAmount] = useState(0);
  const [numeroProforma, setNumeroProforma] = useState(null);
  const [isClienteLoaded, setIsClienteLoaded] = useState(false);
  const [proformaGuardada, setProformaGuardada] = useState(false);
  const [fecha, setFecha] = useState(null);
  const [proformaId, setProformaId] = useState(null);
  const [buscarProforma, setBuscarProforma] = useState('');

  const location = useLocation();
  const proformaDesdeDetalle = location.state?.proforma;

  const handleBuscarCliente = async (cedulaInput) => {
    if (cedulaInput.length === 9) {
      const q = query(collection(db, 'clientes'), where('cedula', '==', cedulaInput));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setCliente(snapshot.docs[0].data());
        setIsClienteLoaded(true);
      } else {
        setCliente(null);
        setIsClienteLoaded(false);
        toast.error('La cédula del cliente ingresada no existe.');
      }
    }
  };

  const handleBuscarProforma = async (numero) => {
    try {
      const q = query(collection(db, 'proformas'), where('numero', '==', parseInt(numero)));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error(`No se encontró la proforma #${numero}`);
        return;
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      setNumeroProforma(data.numero);
      setCedula(data.cliente?.cedula || '');
      setCliente(data.cliente);
      setVehiculo(data.vehiculo || { placa: '', marca: '', anio: '', color: '' });
      setReparaciones(data.reparaciones || []);
      setIvaChecked(data.iva > 0);
      setIvaAmount(data.iva || 0);
      setTotal(data.total || 0);
      setFecha(data.fecha || new Date().toLocaleDateString());
      setProformaGuardada(false);
      setIsClienteLoaded(true);
      setProformaId(docSnap.id);
      toast.success(`Proforma #${data.numero} cargada correctamente`);
    } catch (error) {
      console.error("Error al buscar proforma:", error);
      toast.error('Ocurrió un error al cargar la proforma');
    }
  };

  useEffect(() => {
    if (cedula === '') {
      setCliente(null);
      setIsClienteLoaded(false);
    } else {
      handleBuscarCliente(cedula);
    }
  }, [cedula]);

  useEffect(() => {
    const fetchNumeroProforma = async () => {
      if (!proformaDesdeDetalle) {
        const numero = await obtenerNumeroProforma();
        setNumeroProforma(numero);
      }
    };
    fetchNumeroProforma();
  }, [proformaDesdeDetalle]);

  useEffect(() => {
    if (proformaDesdeDetalle) {
      setNumeroProforma(proformaDesdeDetalle.numero || null);
      setCedula(proformaDesdeDetalle.cliente?.cedula || '');
      setCliente(proformaDesdeDetalle.cliente || null);
      setVehiculo(proformaDesdeDetalle.vehiculo || { placa: '', marca: '', anio: '', color: '' });
      setReparaciones(proformaDesdeDetalle.reparaciones || []);
      setIvaChecked((proformaDesdeDetalle.iva || 0) > 0);
      setIvaAmount(proformaDesdeDetalle.iva || 0);
      setTotal(proformaDesdeDetalle.total || 0);
      setFecha(proformaDesdeDetalle.fecha || new Date().toLocaleDateString());
      setProformaGuardada(false);
      setIsClienteLoaded(true);
      setProformaId(proformaDesdeDetalle.id || null);
      toast.info(`Editando proforma #${proformaDesdeDetalle.numero}`);
    }
  }, [proformaDesdeDetalle]);

  const handleNuevaProforma = async () => {
    setCedula('');
    setCliente(null);
    setVehiculo({ placa: '', marca: '', anio: '', color: '' });
    setReparaciones([]);
    setTotal(0);
    setIvaChecked(false);
    setIvaAmount(0);
    setIsClienteLoaded(false);
    setBuscarProforma('');
    const numero = await obtenerNumeroProforma();
    setNumeroProforma(numero);
    setProformaGuardada(false);
  };

  const handleReparacionChange = (index, field, value) => {
    const nuevas = [...reparaciones];
    nuevas[index][field] = field === 'precio' ? Number(value) : value;
    setReparaciones(nuevas);
  };

  const eliminarReparacionPorIndex = (index) => {
    const nuevas = [...reparaciones];
    nuevas.splice(index, 1);
    setReparaciones(nuevas);
  };

  // === Confirmación estandarizada (igual a Órdenes de Trabajo) ===
  const confirmarEliminarReparacion = async (idx) => {
    eliminarReparacionPorIndex(idx);
    toast.success('Reparación eliminada', { autoClose: 1800 });
  };

  const askDelete = (idx) => {
    toast.info(
      ({ closeToast }) => (
        <div className="toast-confirm-container">
          <p className="toast-confirm-message">
            ¿Seguro que deseas eliminar esta reparación?
          </p>
          <div className="toast-confirm-buttons">
            <button
              className="btn-confirm eliminar"
              onClick={async () => {
                await confirmarEliminarReparacion(idx);
                closeToast();
              }}
            >
              Eliminar
            </button>
            <button className="btn-confirm cancelar" onClick={closeToast}>
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
  // === fin confirmación ===

  const agregarReparacion = () => {
    setReparaciones([...reparaciones, { concepto: '', precio: 0 }]);
  };

  const handleIvaChange = () => setIvaChecked(!ivaChecked);

  useEffect(() => {
    let suma = reparaciones.reduce((acc, r) => acc + (Number(r.precio) || 0), 0);
    if (ivaChecked) {
      const iva = suma * 0.13;
      setIvaAmount(iva);
      suma += iva;
    } else {
      setIvaAmount(0);
    }
    setTotal(suma);
  }, [reparaciones, ivaChecked]);

  const handleGuardarProforma = async () => {
    if (!cliente) return toast.error('Debe cargar un cliente válido.');
    if (reparaciones.length === 0) return toast.error('Debe agregar al menos una reparación.');
    if (!vehiculo.placa || !vehiculo.marca || !vehiculo.anio || !vehiculo.color) {
      return toast.error('Debe completar todos los datos del vehículo.');
    }

    const nuevaProforma = {
      numero: numeroProforma,
      cliente,
      vehiculo,
      reparaciones,
      total,
      iva: ivaChecked ? ivaAmount : 0,
      fecha: fecha || new Date().toLocaleDateString(),
    };

    try {
      if (proformaId) {
        await updateDoc(doc(db, 'proformas', proformaId), nuevaProforma);
        toast.success('¡Proforma actualizada con éxito!');
      } else {
        const docRef = await addDoc(collection(db, 'proformas'), nuevaProforma);
        setProformaId(docRef.id);
        await actualizarNumeroProforma(numeroProforma + 1);
        toast.success('¡Proforma guardada con éxito!');
      }
      setProformaGuardada(true);
    } catch (error) {
      toast.error('Error al guardar la proforma');
      console.error(error);
    }
  };

  const handleDescargarPDF = () => {
    const element = document.getElementById('proformaPrintable').cloneNode(true);

    element.querySelectorAll(
      '.boton-guardar, .boton-nueva, .boton-descargar, .buscar-proforma, .proforma-toolbar'
    ).forEach(el => el && (el.style.display = 'none'));

    element.querySelectorAll('th:nth-child(4), td:nth-child(4)')
      .forEach(col => col.style.display = 'none');

    const ivaSection = element.querySelector('.iva-section');
    if (ivaSection) ivaSection.style.display = 'none';

    const logoImg = element.querySelector('.proforma-logo img');
    if (logoImg) logoImg.style.width = '150px';

    const options = {
      margin: 10,
      filename: `proforma-${numeroProforma ?? ''}.pdf`,
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    html2pdf(element, options);
  };

  const handleInputChange = (campo, value) => {
    if (campo === 'marca' || campo === 'color') {
      setVehiculo({ ...vehiculo, [campo]: value.replace(/[^A-Za-záéíóúÁÉÍÓÚüÜ]/g, '') });
    } else if (campo === 'anio') {
      setVehiculo({ ...vehiculo, [campo]: value.replace(/\D/g, '') });
    } else {
      setVehiculo({ ...vehiculo, [campo]: value });
    }
  };

  return (
    <div className="proforma-page">
      <ToastContainer
        enableMultiContainer
        containerId="center-toast"
        className="center-toast-container"
        newestOnTop
        closeOnClick={false}
      />

      <div className="proforma-wrapper" id="proformaPrintable">
        {/* Head */}
        <header className="proforma-head">
          <div className="head-left">
            <div className="proforma-logo">
              <img src={logo} alt="Logo Taller 2H" className="logo" />
            </div>
            <div className="brand-text">
              <h2>Proforma</h2>
              <p className="subtitle">Genera y administra presupuestos.</p>
            </div>
          </div>
          <div className="head-right">
            <button
              className="boton-guardar"
              onClick={handleGuardarProforma}
              disabled={!isClienteLoaded || proformaGuardada}
            >
              <FontAwesomeIcon icon={faSave} /> Guardar
            </button>
            <button className="boton-nueva" onClick={handleNuevaProforma}>
              <FontAwesomeIcon icon={faPlus} /> Nueva
            </button>
            <button className="boton-descargar" onClick={handleDescargarPDF}>
              <FontAwesomeIcon icon={faDownload} /> PDF
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="proforma-toolbar">
          <div className="datos-mini">
            <span className="badge">N° {numeroProforma ?? '—'}</span>
            <span className="fecha-mini">Fecha: {fecha || new Date().toLocaleDateString()}</span>
          </div>

          <div className="buscar-proforma">
            <label htmlFor="buscarProforma">Buscar Proforma</label>
            <input
              id="buscarProforma"
              type="text"
              className="input-buscar"
              value={buscarProforma}
              onChange={(e) => setBuscarProforma(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBuscarProforma(e.target.value);
                if (e.key && !/^\d$/.test(e.key) && e.key !== 'Backspace') e.preventDefault();
              }}
            />
          </div>
        </div>

        {/* Grid info */}
        <section className="grid-two">
          <div className="card-section">
            <h3>Cliente</h3>
            <label htmlFor="cedula">Cédula del cliente</label>
            <input
              id="cedula"
              type="text"
              className="cedula-input"
              value={cedula}
              onChange={(e) => setCedula(e.target.value.replace(/\D/g, '').slice(0, 9))}
            />
            {cliente && (
              <div className="cliente-info">
                <p><strong>Nombre:</strong> {cliente.nombre} {cliente.apellido}</p>
                <p><strong>Teléfono:</strong> {cliente.telefono}</p>
                <p><strong>Correo:</strong> {cliente.correo}</p>
              </div>
            )}
          </div>

          <div className="card-section">
            <h3>Vehículo</h3>
            <div className="vehiculo-detalle">
              {['placa', 'marca', 'anio', 'color'].map((campo) => {
                const label = campo === 'anio' ? 'Año' : campo.charAt(0).toUpperCase() + campo.slice(1);
                return (
                  <div className="input-group" key={campo}>
                    <label htmlFor={campo}>{label}</label>
                    <input
                      id={campo}
                      type="text"
                      placeholder={label}
                      value={vehiculo[campo]}
                      onChange={(e) => handleInputChange(campo, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Tabla reparaciones */}
        <div className="tabla-wrap">
          <div className="tabla-headbar">
            <h3>Detalle de reparaciones</h3>
            <button className="btn-add" onClick={agregarReparacion}>+ Agregar</button>
          </div>

          <table className="proforma-tabla">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reparaciones.map((r, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      value={r.concepto}
                      onChange={(e) => handleReparacionChange(index, 'concepto', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={r.precio}
                      onChange={(e) => handleReparacionChange(index, 'precio', e.target.value)}
                    />
                  </td>
                  <td>₡{Number(r.precio || 0).toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon btn-icon--danger"
                      onClick={() => askDelete(index)}
                      aria-label="Eliminar reparación"
                      title="Eliminar"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
              {reparaciones.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty">Sin reparaciones. Agrega al menos una.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totales + IVA */}
        <section className="totales-row">
          <div className="iva-section">
            <label className="switch">
              <input
                type="checkbox"
                checked={ivaChecked}
                onChange={handleIvaChange}
                aria-label="Aplicar Factura Electrónica (13%)"
              />
              <span className="slider" aria-hidden="true"></span>
            </label>
            <span className="switch-label">Factura Electrónica (13%)</span>
          </div>

          <div className="proforma-totales card-totales">
            <p><strong>Subtotal:</strong> ₡{(total - ivaAmount).toFixed(2)}</p>
            {ivaChecked && <p><strong>IVA (13%):</strong> ₡{ivaAmount.toFixed(2)}</p>}
            <p className="total-line"><strong>Total:</strong> ₡{total.toFixed(2)}</p>
          </div>
        </section>


        {/* Footer notas */}
        <footer className="proforma-footer">
          <div className="proforma-nota">
            <h4>Nota:</h4>
            <ol>
              <li>No nos responsabilizamos por trabajos realizados en otros talleres.</li>
              <li>No ofrecemos garantía en reparaciones de piezas plásticas.</li>
              <li>Durante la reparación, pueden surgir costos adicionales no contemplados en el presupuesto.</li>
            </ol>
          </div>
          <div className="proforma-info-adicional">
            <h4>Información Adicional:</h4>
            <ol>
              <li>Condiciones de pago: 50% pago adelantado y 50% contra entrega.</li>
              <li>Si se requieren repuestos adicionales, se informará tras el desarme.</li>
              <li>Precios de repuestos sujetos a cambios del proveedor.</li>
              <li>Validez de la oferta: 10 días.</li>
            </ol>
          </div>
          <p className="proforma-gracias">Gracias por su preferencia</p>
        </footer>
      </div>
    </div>
  );
};

export default Proforma;
