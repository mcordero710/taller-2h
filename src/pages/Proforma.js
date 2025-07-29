import React, { useState, useEffect } from 'react';
import './Proforma.css';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const Proforma = () => {
  const [cedula, setCedula] = useState('');
  const [cliente, setCliente] = useState(null);
  const [vehiculo, setVehiculo] = useState({ placa: '', marca: '', anio: '', color: '' });
  const [reparaciones, setReparaciones] = useState([]);
  const [total, setTotal] = useState(0);

  const handleBuscarCliente = async (cedulaInput) => {
    const q = query(collection(db, 'clientes'), where('cedula', '==', cedulaInput));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      setCliente(snapshot.docs[0].data());
    } else {
      setCliente(null);
    }
  };

  useEffect(() => {
    if (cedula.length === 9) {
      handleBuscarCliente(cedula);
    } else {
      setCliente(null);
    }
  }, [cedula]);

  const handleReparacionChange = (index, field, value) => {
    const nuevas = [...reparaciones];
    nuevas[index][field] = field === 'cantidad' || field === 'precio' ? Number(value) : value;
    setReparaciones(nuevas);
  };

  const agregarReparacion = () => {
    setReparaciones([...reparaciones, { codigo: '', concepto: '', cantidad: 1, precio: 0 }]);
  };

  const eliminarReparacion = (index) => {
    const nuevas = [...reparaciones];
    nuevas.splice(index, 1);
    setReparaciones(nuevas);
  };

  useEffect(() => {
    const suma = reparaciones.reduce((acc, r) => acc + (r.cantidad * r.precio), 0);
    setTotal(suma);
  }, [reparaciones]);

  return (
    <div className="proforma-wrapper">
      <header className="proforma-header">
        <div className="proforma-top" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="proforma-logo">Taller 2H</div>
          <div className="proforma-contact" style={{ textAlign: 'right' }}>
            <p><strong>Tel:</strong> (506) 2222-2222</p>
            <p><strong>Email:</strong> info@taller2h.com</p>
            <p><strong>Dirección:</strong> San José, Costa Rica</p>
          </div>
        </div>
        <h1>PROFORMA</h1>
      </header>

      <section className="proforma-info">
        <div className="factura-detalle">
          <p><strong>N° Proforma:</strong> __________</p>
          <p><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
        </div>
        <div className="cliente-detalle">
          <input
            type="text"
            className="cedula-input"
            placeholder="Cédula del cliente"
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
        <input
          type="text"
          placeholder="# Placa"
          value={vehiculo.placa}
          onChange={(e) => setVehiculo({ ...vehiculo, placa: e.target.value })}
        />
        <input
          type="text"
          placeholder="Marca"
          value={vehiculo.marca}
          onChange={(e) => setVehiculo({ ...vehiculo, marca: e.target.value })}
        />
        <input
          type="text"
          placeholder="Año"
          value={vehiculo.anio}
          onChange={(e) => setVehiculo({ ...vehiculo, anio: e.target.value })}
        />
        <input
          type="text"
          placeholder="Color"
          value={vehiculo.color}
          onChange={(e) => setVehiculo({ ...vehiculo, color: e.target.value })}
        />
      </section>

      <table className="proforma-tabla">
        <thead>
          <tr>
            <th>SL No</th>
            <th>Descripción</th>
            <th>Cantidad</th>
            <th>Precio Unitario</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reparaciones.map((r, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
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
                  value={r.cantidad}
                  onChange={(e) => handleReparacionChange(index, 'cantidad', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={r.precio}
                  onChange={(e) => handleReparacionChange(index, 'precio', e.target.value)}
                />
              </td>
              <td>₡{(r.cantidad * r.precio).toFixed(2)}</td>
              <td>
                <button onClick={() => eliminarReparacion(index)}>❌</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="proforma-actions">
        <button onClick={agregarReparacion}>+ Agregar Reparación</button>
      </div>

      <div className="proforma-totales">
        <p><strong>Subtotal:</strong> ₡{total.toFixed(2)}</p>
        <p><strong>Total:</strong> ₡{total.toFixed(2)}</p>
      </div>

      <footer className="proforma-footer">
        <p>Gracias por su preferencia</p>
      </footer>
    </div>
  );
};

export default Proforma;
