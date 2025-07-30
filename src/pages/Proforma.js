import React, { useState, useEffect, useRef } from 'react';
import './Proforma.css';
import { db, obtenerNumeroProforma, actualizarNumeroProforma } from '../firebase/firebase'; 
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore'; 
import logo from '../assets/logo.png';
import { FaTrashAlt } from 'react-icons/fa';
import html2pdf from 'html2pdf.js';

const Proforma = () => {
  const [cedula, setCedula] = useState('');
  const [cliente, setCliente] = useState(null);
  const [vehiculo, setVehiculo] = useState({ placa: '', marca: '', anio: '', color: '' });
  const [reparaciones, setReparaciones] = useState([]);
  const [total, setTotal] = useState(0);
  const [ivaChecked, setIvaChecked] = useState(false);
  const [ivaAmount, setIvaAmount] = useState(0);
  const [numeroProforma, setNumeroProforma] = useState(null);
  const [clienteNoExiste, setClienteNoExiste] = useState(false); // Estado para controlar el error de cliente no encontrado

  // Crear referencia para el proforma content
  const proformaContentRef = useRef(null);

  // Función para buscar cliente por cédula
  const handleBuscarCliente = async (cedulaInput) => {
    if (cedulaInput.length === 9) { // Validar que la cédula tenga 9 dígitos
      const q = query(collection(db, 'clientes'), where('cedula', '==', cedulaInput));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setCliente(snapshot.docs[0].data());
        setClienteNoExiste(false); // Si el cliente existe, ocultamos el mensaje de error
      } else {
        setCliente(null);
        setClienteNoExiste(true); // Si no se encuentra el cliente, mostramos el mensaje de error
      }
    } else {
      setClienteNoExiste(false); // Si la cédula no es válida, no mostramos mensaje de error
    }
  };

  // Llamar a la función de búsqueda cada vez que la cédula cambia
  useEffect(() => {
    handleBuscarCliente(cedula);
  }, [cedula]); // Esto se ejecuta cada vez que la cédula cambia

  // Obtener el número de la proforma
  useEffect(() => {
    const fetchNumeroProforma = async () => {
      const numero = await obtenerNumeroProforma();
      setNumeroProforma(numero); 
    };
    fetchNumeroProforma();
  }, []); // Esto solo se ejecuta cuando el componente se monta

  // Función para generar el número de proforma
  const handleNuevaProforma = async () => {
    const numero = await obtenerNumeroProforma();
    setNumeroProforma(numero);
  };

  const handleReparacionChange = (index, field, value) => {
    const nuevas = [...reparaciones];
    nuevas[index][field] = field === 'precio' ? Number(value) : value;
    setReparaciones(nuevas);
  };

  const agregarReparacion = () => {
    setReparaciones([...reparaciones, { concepto: '', precio: 0 }]);
  };

  const eliminarReparacion = (index) => {
    const nuevas = [...reparaciones];
    nuevas.splice(index, 1);
    setReparaciones(nuevas);
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
    const nuevaProforma = {
      numero: numeroProforma,
      cliente: cliente,
      vehiculo: vehiculo,
      reparaciones: reparaciones,
      total: total,
      iva: ivaChecked ? ivaAmount : 0,
      fecha: new Date().toLocaleDateString(),
    };

    // Guardar la nueva proforma en la base de datos
    await addDoc(collection(db, 'proformas'), nuevaProforma);

    // Actualizar el número de la proforma para la siguiente
    await actualizarNumeroProforma(numeroProforma + 1);

    setNumeroProforma(null); // Limpiar el número de la proforma
  };

  // Descargar PDF
  const handleDescargarPDF = () => {
    const element = document.getElementById('proformaContent').cloneNode(true);

    // Ahora generamos el PDF usando la copia del contenido
    const options = {
      margin: 10,
      filename: 'proforma.pdf',
      html2canvas: { scale: 4 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf(element, options); // Genera el PDF sin ocultar nada
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

            <button className="boton-descargar" onClick={handleDescargarPDF}>
              Descargar PDF
            </button>
            <button className="boton-guardar" onClick={handleGuardarProforma}>
              Guardar Proforma
            </button>
            <button className="boton-nueva" onClick={handleNuevaProforma}>
              Nueva Proforma
            </button>
          </div>
        </div>
        <h1>PROFORMA</h1>
      </header>

      <div id="proformaContent" ref={proformaContentRef}>
        <h2>N° Proforma: {numeroProforma ? numeroProforma : '___________'}</h2>
        <section className="proforma-info">
          <div className="factura-detalle">
            <p><strong>N° Proforma:</strong> {numeroProforma ? numeroProforma : '___________'}</p>
            <p><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
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
            {clienteNoExiste && (
              <p style={{ color: 'red', fontSize: '0.9rem' }}>
                El cliente con el número de cédula {cedula} no existe.
              </p>
            )}
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
          <div className="input-group">
            <input
              id="placa"
              type="text"
              placeholder="# Placa"
              value={vehiculo.placa}
              onChange={(e) => setVehiculo({ ...vehiculo, placa: e.target.value })}
            />
          </div>
          <div className="input-group">
            <input
              id="marca"
              type="text"
              placeholder="Marca"
              value={vehiculo.marca}
              onChange={(e) => setVehiculo({ ...vehiculo, marca: e.target.value })}
            />
          </div>
          <div className="input-group">
            <input
              id="anio"
              type="text"
              placeholder="Año"
              value={vehiculo.anio}
              onChange={(e) => setVehiculo({ ...vehiculo, anio: e.target.value })}
            />
          </div>
          <div className="input-group">
            <input
              id="color"
              type="text"
              placeholder="Color"
              value={vehiculo.color}
              onChange={(e) => setVehiculo({ ...vehiculo, color: e.target.value })}
            />
          </div>
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
            Factura Electrónica
          </label>
        </section>

        <div className="proforma-totales">
          <p><strong>Subtotal:</strong> ₡{total.toFixed(2)}</p>
          {ivaChecked && (
            <p><strong>IVA (13%):</strong> ₡{ivaAmount.toFixed(2)}</p>
          )}
          <p><strong>Total:</strong> ₡{(total + ivaAmount).toFixed(2)}</p>
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
              <li>Monto de repuestos por tiempo limitado y sujeto a cambio por parte de la agencia vendedora (en caso de ser requerido).</li>
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
