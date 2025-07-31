import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import './Proforma.css'; // Estilos similares a la pantalla original

const ProformaEdit = () => {
  const { id } = useParams(); // Obtiene el ID de la proforma
  const [proforma, setProforma] = useState(null);

  useEffect(() => {
    const fetchProforma = async () => {
      const docRef = doc(db, 'proformas', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProforma(docSnap.data());
      } else {
        alert('No se encontró la proforma');
      }
    };

    fetchProforma();
  }, [id]);

  if (!proforma) return <div>Cargando...</div>;

  return (
    <div className="proforma-wrapper">
      <h2>Proforma N° {proforma.numero}</h2>
      <div className="proforma-details">
        <p><strong>Cliente:</strong> {proforma.cliente.nombre} {proforma.cliente.apellido}</p>
        <p><strong>Cédula:</strong> {proforma.cliente.cedula}</p>
        <p><strong>Vehículo:</strong> {proforma.vehiculo.marca} {proforma.vehiculo.modelo} ({proforma.vehiculo.anio})</p>
        <p><strong>Total:</strong> ₡{proforma.total.toFixed(2)}</p>
        <p><strong>IVA:</strong> ₡{proforma.iva.toFixed(2)}</p>
        <button onClick={() => alert('Imprimir PDF')}>Imprimir</button>
        <button onClick={() => alert('Editar proforma')}>Editar</button>
      </div>
    </div>
  );
};

export default ProformaEdit;
