import React, { useState } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import './BuscarProforma.css';

const BuscarProforma = () => {
  const [buscar, setBuscar] = useState('');
  const [proformas, setProformas] = useState([]);
  const navigate = useNavigate();

  const handleBuscar = async () => {
    if (!buscar) return;

    let q;
    if (buscar.length === 9) {
      q = query(collection(db, 'proformas'), where('cliente.cedula', '==', buscar));
    } else {
      q = query(collection(db, 'proformas'), where('numero', '==', parseInt(buscar)));
    }

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const fetchedProformas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProformas(fetchedProformas.reverse());
    } else {
      setProformas([]);
      alert('No se encontraron resultados');
    }
  };

  const handleVerProforma = (id) => {
    navigate(`/proforma/${id}`);
  };

  return (
    <div className="buscar-proforma-wrapper">
      <h2 className="buscar-proforma-header">Buscar Proforma</h2>

      <div className="buscar-proforma-barra">
        <label htmlFor="campoBuscar" className="buscar-proforma-label">
          Digite el número de cédula o el número de proforma que desea consultar
        </label>
        <div className="buscar-proforma-campos">
          <input
            id="campoBuscar"
            type="text"
            placeholder=""
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <button onClick={handleBuscar}>Buscar</button>
        </div>
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
        <p className="buscar-proforma-resultados">No se encontraron proformas para el cliente.</p>
      )}
    </div>
  );
};

export default BuscarProforma;
