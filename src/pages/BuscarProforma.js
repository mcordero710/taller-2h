import React, { useState } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './BuscarProforma.css';
import { useLoading } from '../components/ui/LoadingContext'; // 👈 loader global

const BuscarProforma = () => {
  const [buscar, setBuscar] = useState('');
  const [proformas, setProformas] = useState([]);
  const [isSearching, setIsSearching] = useState(false); // 👈 para deshabilitar controles
  const navigate = useNavigate();
  const { withLoading } = useLoading(); // 👈 helper que muestra/oculta overlay

  const handleBuscar = async () => {
    const term = (buscar || '').trim();
    if (!term) return;

    // Armar query según cédula (9 dígitos) o número de proforma
    let q;
    if (/^\d{9}$/.test(term)) {
      q = query(collection(db, 'proformas'), where('cliente.cedula', '==', term));
    } else {
      const numero = parseInt(term, 10);
      if (Number.isNaN(numero)) {
        toast.info('Ingrese una cédula (9 dígitos) o un número de proforma válido.', {
          position: 'top-center',
          autoClose: 2500,
          hideProgressBar: true,
        });
        return;
      }
      q = query(collection(db, 'proformas'), where('numero', '==', numero));
    }

    try {
      setIsSearching(true);
      await withLoading(async () => {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const fetchedProformas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Ordenar por fecha (formato esperado: mm/dd/yyyy o m/d/yyyy)
          const proformasOrdenadas = fetchedProformas.sort((a, b) => {
            const convertirFecha = (fechaStr) => {
              if (!fechaStr || !fechaStr.includes('/')) return new Date(0);
              const [mes, dia, anio] = fechaStr.split('/');
              return new Date(`${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
            };
            return convertirFecha(b.fecha) - convertirFecha(a.fecha);
          });

          setProformas(proformasOrdenadas);
        } else {
          setProformas([]);
          toast.info('No existe proforma para los datos ingresados', {
            position: 'top-center',
            autoClose: 2500,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: false,
            closeButton: false,
            hideProgressBar: true,
          });
        }
      }, 'Buscando proformas…'); // 👈 texto del overlay
    } catch (err) {
      console.error('Error al buscar proformas:', err);
      toast.error('Ocurrió un error al buscar. Intenta nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerProforma = (proforma) => {
    navigate('/detalle-proforma', { state: { proforma } });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBuscar();
    }
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
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isSearching}                // 👈 bloquea mientras busca
          />
          <button onClick={handleBuscar} disabled={isSearching}>
            {isSearching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {proformas.length > 0 && (
        <table className="tabla-proformas">
          <thead>
            <tr>
              <th>Número de Proforma</th>
              <th>Cédula</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Placa</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {proformas.map((proforma) => (
              <tr key={proforma.id}>
                <td>{proforma.numero}</td>
                <td>{proforma.cliente?.cedula || '—'}</td>
                <td>{`${proforma.cliente?.nombre || ''} ${proforma.cliente?.apellido || ''}`.trim()}</td>
                <td>{proforma.fecha || '—'}</td>
                <td>{proforma.vehiculo?.placa || '—'}</td>
                <td>
                  <button onClick={() => handleVerProforma(proforma)}>Ver / Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default BuscarProforma;
