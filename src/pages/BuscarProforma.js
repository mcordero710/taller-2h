import React, { useState } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './BuscarProforma.css'; // Asegúrate de tener los estilos

const BuscarProforma = () => {
  const [buscar, setBuscar] = useState('');
  const [proformas, setProformas] = useState([]);
  const navigate = useNavigate(); // Usamos React Router para redirigir a la página de edición

  const handleBuscar = async () => {
    if (!buscar) return; // Si no hay término de búsqueda, no hacer nada

    let q;
    if (buscar.length === 9) {
      // Si la búsqueda es una cédula (suponemos que son 9 caracteres)
      q = query(collection(db, 'proformas'), where('cliente.cedula', '==', buscar));
    } else {
      // Si la búsqueda es un número de proforma
      q = query(collection(db, 'proformas'), where('numero', '==', parseInt(buscar)));
    }

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const fetchedProformas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProformas(fetchedProformas.reverse()); // Ordenar de más reciente a la más antigua
    } else {
      setProformas([]);
      alert('No se encontraron resultados');
    }
  };

  const handleVerProforma = (id) => {
    // Redirigir a la pantalla de proforma para editarla
    navigate(`/proforma/${id}`);
  };

  return (
    <div className="buscar-proforma-wrapper">
      <h2>Buscar Proforma</h2>

      <div className="buscar-proforma">
        <input
          type="text"
          placeholder="Buscar por número de proforma o cédula"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <button onClick={handleBuscar}>Buscar</button>
      </div>

      {proformas.length > 0 ? (
        <table className="tabla-proformas">
          <thead>
            <tr>
              <th>Número de Proforma</th>
              <th>Cédula Cliente</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {proformas.map((proforma) => (
              <tr key={proforma.id}>
                <td>{proforma.numero}</td>
                <td>{proforma.cliente.cedula}</td>
                <td>{proforma.fecha}</td>
                <td>
                  <button onClick={() => handleVerProforma(proforma.id)}>Ver / Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No se encontraron proformas para el cliente.</p>
      )}
    </div>
  );
};

export default BuscarProforma;
