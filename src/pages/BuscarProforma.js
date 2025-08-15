import React, { useState } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './BuscarProforma.css';
import { useLoading } from '../components/ui/LoadingContext';

const BuscarProforma = () => {
  const [buscar, setBuscar] = useState('');
  const [proformas, setProformas] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const { withLoading } = useLoading();

  // Garantiza que el overlay aparezca en pantalla antes de ejecutar la query
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

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
        // ⬇️ Deja que se pinte el overlay antes de consultar
        await nextFrame();

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const fetchedProformas = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Ordenar por fecha (esperada mm/dd/yyyy o m/d/yyyy)
          const convertirFecha = (fechaStr) => {
            if (!fechaStr || !fechaStr.includes('/')) return new Date(0);
            const [mes, dia, anio] = fechaStr.split('/');
            return new Date(
              `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
            );
          };

          const proformasOrdenadas = fetchedProformas.sort(
            (a, b) => convertirFecha(b.fecha) - convertirFecha(a.fecha)
          );

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
      }, 'Buscando proformas…');
    } catch (err) {
      console.error('Error al buscar proformas:', err);
      toast.error('Ocurrió un error al buscar. Intenta nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerProforma = async (proforma) => {
    // Opcional: breve overlay al cambiar de pantalla
    await withLoading(async () => {
      // pequeño frame por si el render tarda
      await nextFrame();
      navigate('/detalle-proforma', { state: { proforma } });
    }, 'Abriendo proforma…');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBuscar();
    }
  };

  // ✅ Solo dígitos y máximo 9
  const handleBuscarChange = (e) => {
    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 9);
    setBuscar(onlyDigits);
  };

  // ✅ Bloquea teclas no numéricas (salvo controles) y dispara Enter
  const handleBuscarKeyDown = (e) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBuscar();
      return;
    }
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) {
      e.preventDefault();
    }
  };

  // ✅ Sanea pegado (paste)
  const handleBuscarPaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    const sanitized = text.replace(/\D/g, '').slice(0, 9);
    e.preventDefault();
    setBuscar(sanitized);
  };


  return (
    <div className="buscar-proforma-page">
      <div className="buscar-proforma-wrapper" aria-busy={isSearching}>
        <h2 className="buscar-proforma-header">Buscar Proforma</h2>

        <div className="buscar-proforma-barra">
          <label htmlFor="campoBuscar" className="buscar-proforma-label">
            Digite el número de cédula o el número de proforma que desea consultar
          </label>
          <div className="buscar-proforma-campos">
            <input
              id="campoBuscar"
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={9}
              value={buscar}
              onChange={handleBuscarChange}
              onKeyDown={handleBuscarKeyDown}
              onPaste={handleBuscarPaste}
              disabled={isSearching}
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
                    <button onClick={() => handleVerProforma(proforma)} disabled={isSearching}>
                      Ver / Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>

  );
};

export default BuscarProforma;
