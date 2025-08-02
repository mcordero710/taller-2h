import React, { useState, useEffect } from 'react';
import './Proforma.css';
import { db, obtenerNumeroProforma, actualizarNumeroProforma } from '../firebase/firebase';
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import logo from '../assets/logo.png';
import { FaTrashAlt } from 'react-icons/fa';
import html2pdf from 'html2pdf.js';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faSave, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router-dom';

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

  // ✅ Carga automática si vienes desde DetalleProforma
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
      setProformaId(proformaDesdeDetalle.id || null); // Asegúrate de incluirlo desde DetalleProforma si quieres editar
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

  const eliminarReparacion = (index) => {
    const nuevas = [...reparaciones];
    nuevas.splice(index, 1);
    setReparaciones(nuevas);
  };

  const agregarReparacion = () => {
    setReparaciones([...reparaciones, { concepto: '', precio: 0 }]);
  };

  const handleIvaChange = () => {
    setIvaChecked(!ivaChecked);
  };

  useEffect(() => {
    let suma = reparaciones.reduce((acc, r) => acc + r.precio, 0);
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
    if (!cliente) {
      toast.error('Debe cargar un cliente válido.');
      return;
    }
    if (reparaciones.length === 0) {
      toast.error('Debe agregar al menos una reparación.');
      return;
    }
    if (!vehiculo.placa || !vehiculo.marca || !vehiculo.anio || !vehiculo.color) {
      toast.error('Debe completar todos los datos del vehículo.');
      return;
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
    const element = document.getElementById('proformaContent').cloneNode(true);
    const eliminarColumnas = element.querySelectorAll("th:nth-child(4), td:nth-child(4)");
    eliminarColumnas.forEach(col => col.style.display = 'none');
    const eliminarBotones = element.querySelectorAll(".boton-eliminar");
    eliminarBotones.forEach(btn => btn.style.display = 'none');
    const ivaSection = element.querySelector(".iva-section");
    if (ivaSection) {
      ivaSection.style.display = 'none';
    }
    const options = {
      margin: 10,
      filename: 'proforma.pdf',
      html2canvas: { scale: 4 },
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
    <div className="proforma-wrapper">
      <header className="proforma-header">
        <div className="proforma-top">
          <div className="proforma-logo">
            <img src={logo} alt="Logo Taller 2H" className="logo" />
          </div>
          <div className="proforma-contact">
            <p><strong>Tel:</strong> (506) 2222-2222</p>
            <p><strong>Email:</strong> info@taller2h.com</p>
            <p><strong>Dirección:</strong> San José, Costa Rica</p>
            <p><strong>Cédula Jurídica:</strong> 123145644</p>
  
            <button
              className="boton-guardar"
              onClick={handleGuardarProforma}
              disabled={!isClienteLoaded || proformaGuardada}
            >
              <FontAwesomeIcon icon={faSave} /> Guardar Proforma
            </button>
  
            <button className="boton-nueva" onClick={handleNuevaProforma}>
              <FontAwesomeIcon icon={faPlus} /> Nueva Proforma
            </button>
  
            <button className="boton-descargar" onClick={handleDescargarPDF}>
              <FontAwesomeIcon icon={faDownload} /> Descargar PDF
            </button>
          </div>
        </div>
        <h1>PROFORMA</h1>
        <div className="buscar-proforma">
          <label htmlFor="buscarProforma">Buscar Proforma</label>
          <input
            id="buscarProforma"
            type="text"
            className="input-buscar"
            value={buscarProforma}
            onChange={(e) => setBuscarProforma(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleBuscarProforma(e.target.value);
              }
              if (e.key && !/^\d$/.test(e.key) && e.key !== 'Backspace') {
                e.preventDefault();
              }
            }}
          />
        </div>
      </header>
  
      <div id="proformaContent">
        <h2>N° Proforma: {numeroProforma ? numeroProforma : '___________'}</h2>
  
        <section className="proforma-info">
          <div className="factura-detalle">
            <p><strong>Fecha:</strong> {fecha ? fecha : new Date().toLocaleDateString()}</p>
          </div>
  
          <div className="cliente-detalle">
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
        </section>
  
        <section className="vehiculo-detalle">
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
        </section>
  
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
                <td>₡{(r.precio).toFixed(2)}</td>
                <td>
                  <button className="boton-eliminar" onClick={() => eliminarReparacion(index)}>
                    <FaTrashAlt />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
  
        <div className="proforma-actions">
          <button onClick={agregarReparacion}>+ Agregar Reparación</button>
        </div>
  
        <section className="iva-section">
          <label>
            <input
              type="checkbox"
              checked={ivaChecked}
              onChange={handleIvaChange}
            />
            Factura Electrónica (13%)
          </label>
        </section>
  
        <div className="proforma-totales">
          <p><strong>Subtotal:</strong> ₡{(total - ivaAmount).toFixed(2)}</p>
          {ivaChecked && <p><strong>IVA (13%):</strong> ₡{ivaAmount.toFixed(2)}</p>}
          <p><strong>Total:</strong> ₡{total.toFixed(2)}</p>
        </div>
  
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
              <li>En caso de necesitar algún repuesto adicional, se le indicará una vez procedamos con el desarme del vehículo.</li>
              <li>Monto de repuestos por tiempo limitado y sujeto a cambio por parte de la agencia vendedora.</li>
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
