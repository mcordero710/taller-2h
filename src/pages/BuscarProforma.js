import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom'; // 👈 NUEVO
import { toast } from 'react-toastify';
import './BuscarProforma.css';
import { useLoading } from '../components/ui/LoadingContext';

const BuscarProforma = () => {
  const [buscar, setBuscar] = useState('');
  const [proformas, setProformas] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { withLoading } = useLoading();

  // 👇 NUEVO: si venimos de DetalleProforma, restaurar estado
  useEffect(() => {
    const restored = location.state?.restored;
    if (restored) {
      setBuscar(restored.buscar || '');
      setProformas(Array.isArray(restored.proformas) ? restored.proformas : []);
    }
  }, [location.state]);

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
    await withLoading(async () => {
      await nextFrame();
      navigate('/detalle-proforma', {
        state: {
          proforma,
          backTo: {
            // 👇 Si tu ruta real del buscador es distinta, cámbiala aquí
            route: '/buscar-proforma',
            buscar,
            proformas,
          },
        },
      });
    }, 'Abriendo proforma…');
  };

  // ✅ Solo dígitos (sin limitar a 9 para permitir números de proforma largos)
  const handleBuscarChange = (e) => {
    const onlyDigits = e.target.value.replace(/\D/g, '');
    setBuscar(onlyDigits);
  };

  // ✅ Permitir Enter para buscar y atajos (Ctrl/Cmd + V/C/X/A)
  const handleBuscarKeyDown = (e) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    const isShortcut =
      (e.ctrlKey || e.metaKey) &&
      ['a', 'c', 'x', 'v'].includes(e.key.toLowerCase());

    if (e.key === 'Enter') {
      e.preventDefault();
      handleBuscar();
      return;
    }

    if (isShortcut) return; // permitir pegar/copiar/cortar/seleccionar todo

    // bloquear cualquier otra tecla que no sea dígito o control
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) {
      e.preventDefault();
    }
  };

  // ✅ Sanea pegado (paste) desde menú contextual o atajo
  const handleBuscarPaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    const sanitized = text.replace(/\D/g, ''); // quitar espacios, guiones, etc.
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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
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
