// src/pages/Proforma.jsx
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
// Loader global
import { useLoading } from '../components/ui/LoadingContext';

const Proforma = () => {
  const [cedula, setCedula] = useState('');
  const [cliente, setCliente] = useState(null);

  // 👇 ahora incluye "modelo"
  const [vehiculo, setVehiculo] = useState({ placa: '', marca: '', modelo: '', anio: '', color: '' });

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

  // flags UI
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { withLoading } = useLoading();
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

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
    const n = String(numero || '').trim();
    if (!/^\d+$/.test(n)) {
      toast.info('Ingrese un número de proforma válido.');
      return;
    }

    try {
      setIsSearching(true);
      await withLoading(async () => {
        await nextFrame();
        const q = query(collection(db, 'proformas'), where('numero', '==', parseInt(n, 10)));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          toast.error(`No se encontró la proforma #${n}`);
          return;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        setNumeroProforma(data.numero);
        setCedula(data.cliente?.cedula || '');
        setCliente(data.cliente || null);
        // 👇 soporta proformas antiguas sin "modelo"
        setVehiculo({
          placa: data.vehiculo?.placa || '',
          marca: data.vehiculo?.marca || '',
          modelo: data.vehiculo?.modelo || '',
          anio: data.vehiculo?.anio || '',
          color: data.vehiculo?.color || '',
        });
        setReparaciones(data.reparaciones || []);
        setIvaChecked((data.iva || 0) > 0);
        setIvaAmount(data.iva || 0);
        setTotal(data.total || 0);
        setFecha(data.fecha || new Date().toLocaleDateString());
        setProformaGuardada(false);
        setIsClienteLoaded(true);
        setProformaId(docSnap.id);
        toast.success(`Proforma #${data.numero} cargada correctamente`);
      }, 'Buscando proforma…');
    } catch (error) {
      console.error('Error al buscar proforma:', error);
      toast.error('Ocurrió un error al cargar la proforma');
    } finally {
      setIsSearching(false);
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
        await withLoading(async () => {
          const numero = await obtenerNumeroProforma();
          setNumeroProforma(numero);
        }, 'Cargando proforma…');
      }
    };
    fetchNumeroProforma();
  }, [proformaDesdeDetalle, withLoading]);

  useEffect(() => {
    if (proformaDesdeDetalle) {
      setNumeroProforma(proformaDesdeDetalle.numero || null);
      setCedula(proformaDesdeDetalle.cliente?.cedula || '');
      setCliente(proformaDesdeDetalle.cliente || null);
      // 👇 soporta que venga o no "modelo"
      setVehiculo({
        placa: proformaDesdeDetalle.vehiculo?.placa || '',
        marca: proformaDesdeDetalle.vehiculo?.marca || '',
        modelo: proformaDesdeDetalle.vehiculo?.modelo || '',
        anio: proformaDesdeDetalle.vehiculo?.anio || '',
        color: proformaDesdeDetalle.vehiculo?.color || '',
      });
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
    try {
      setIsCreatingNew(true);
      await withLoading(async () => {
        await nextFrame();
        setCedula('');
        setCliente(null);
        setVehiculo({ placa: '', marca: '', modelo: '', anio: '', color: '' });
        setReparaciones([]);
        setTotal(0);
        setIvaChecked(false);
        setIvaAmount(0);
        setIsClienteLoaded(false);
        setBuscarProforma('');
        const numero = await obtenerNumeroProforma();
        setNumeroProforma(numero);
        setProformaGuardada(false);
        setProformaId(null);
        setFecha(new Date().toLocaleDateString());
      }, 'Nueva proforma…');
    } finally {
      setIsCreatingNew(false);
    }
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

  const confirmarEliminarReparacion = async (idx) => {
    eliminarReparacionPorIndex(idx);
    toast.success('Reparación eliminada', { autoClose: 1800 });
  };

  const askDelete = (idx) => {
    toast.info(
      ({ closeToast }) => (
        <div className="toast-confirm-container">
          <p className="toast-confirm-message">¿Seguro que deseas eliminar esta reparación?</p>
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

    // 🔹 Placa OPCIONAL: solo validamos marca, modelo, año y color
    if (!vehiculo.marca || !vehiculo.modelo || !vehiculo.anio || !vehiculo.color) {
      return toast.error('Debe completar marca, modelo, año y color del vehículo.');
    }

    const nuevaProforma = {
      numero: numeroProforma,
      cliente,
      vehiculo, // puede llevar placa '' si no la tienen aún
      reparaciones,
      total,
      iva: ivaChecked ? ivaAmount : 0,
      fecha: fecha || new Date().toLocaleDateString(),
    };

    try {
      setIsSaving(true);
      await withLoading(async () => {
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
      }, proformaId ? 'Actualizando proforma…' : 'Guardando proforma…');
    } catch (error) {
      toast.error('Error al guardar la proforma');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };


  const handleDescargarPDF = async () => {
    const original = document.getElementById('proformaPrintable');
    if (!original) return;
  
    try {
      setIsGeneratingPdf(true);
      await withLoading(async () => {
        await nextFrame();
  
        const element = original.cloneNode(true);
  
        // 1) Ocultar controles/acciones
        element
          .querySelectorAll(
            '.boton-guardar, .boton-nueva, .boton-descargar, .buscar-proforma, .proforma-toolbar, .btn-add'
          )
          .forEach((el) => el && (el.style.display = 'none'));
  
        // ocultar columna de acciones en tabla
        element
          .querySelectorAll('th:nth-child(4), td:nth-child(4)')
          .forEach((col) => (col.style.display = 'none'));
  
        // ocultar toggle IVA en impresión
        const ivaSection = element.querySelector('.iva-section');
        if (ivaSection) ivaSection.style.display = 'none';
  
        // ocultar subtítulo
        const subtitle = element.querySelector('.brand-text .subtitle');
        if (subtitle) subtitle.style.display = 'none';
  
        // 2) Bloque de información de contacto bajo el header
        (() => {
          const head = element.querySelector('.proforma-head');
          const contacto = document.createElement('div');
          contacto.setAttribute(
            'style',
            'display:flex;flex-wrap:wrap;gap:18px;margin:8px 0 12px 0;font-size:12px;color:#333;'
          );
          contacto.innerHTML = `
            <div><strong></strong>Taller automotriz 2H S.A</div>
            <div><strong>Tel:</strong>62756427</div>
            <div><strong>Email:</strong>taller2hrosario@gmail.com</div>
            <div><strong>Cédula Jurídica:</strong>3-101-930294</div>
          `;
          if (head && head.parentNode) head.parentNode.insertBefore(contacto, head.nextSibling);
          else element.insertBefore(contacto, element.firstChild);
        })();
  
        // 3) Cliente y Vehículo como texto limpio (sin inputs)
        const makeRow = (label, value = '') => {
          const row = document.createElement('div');
          row.setAttribute(
            'style',
            'display:flex;gap:8px;align-items:flex-start;margin:4px 0;font-size:14px;'
          );
          const l = document.createElement('strong');
          l.textContent = `${label}:`;
          l.setAttribute('style', 'min-width:140px;color:#0f172a;');
          const v = document.createElement('span');
          v.textContent = value ?? ''; // si no hay, queda vacío
          v.setAttribute('style', 'color:#334155;white-space:pre-wrap;');
          row.appendChild(l);
          row.appendChild(v);
          return row;
        };
  
        // 3.a) Sección Cliente
        (() => {
          const clienteCard = Array.from(element.querySelectorAll('.card-section'))
            .find(sec => (sec.querySelector('h3')?.textContent || '').toLowerCase().includes('cliente'));
          if (!clienteCard) return;
  
          // limpiar todo y reconstruir
          clienteCard.innerHTML = '';
          const title = document.createElement('h3');
          title.textContent = 'Cliente';
          title.setAttribute('style', 'margin:0 0 8px;font-size:16px;color:#0f172a;');
          const block = document.createElement('div');
          block.setAttribute('style', 'padding:4px 2px;');
  
          block.appendChild(makeRow('Cédula', (cedula || '').toString()));
          block.appendChild(makeRow('Nombre', cliente ? `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim() : ''));
          block.appendChild(makeRow('Teléfono', cliente?.telefono ?? ''));
          block.appendChild(makeRow('Correo', cliente?.correo ?? ''));
  
          clienteCard.appendChild(title);
          clienteCard.appendChild(block);
        })();
  
        // 3.b) Sección Vehículo
        (() => {
          const vehiculoCard = Array.from(element.querySelectorAll('.card-section'))
            .find(sec => (sec.querySelector('h3')?.textContent || '').toLowerCase().includes('vehículo'));
          if (!vehiculoCard) return;
  
          vehiculoCard.innerHTML = '';
          const title = document.createElement('h3');
          title.textContent = 'Vehículo';
          title.setAttribute('style', 'margin:0 0 8px;font-size:16px;color:#0f172a;');
          const block = document.createElement('div');
          block.setAttribute('style', 'padding:4px 2px;');
  
          // Placa -> si no hay, valor vacío (sin "—")
          block.appendChild(makeRow('Placa', vehiculo?.placa ?? ''));
  
          block.appendChild(makeRow('Marca', vehiculo?.marca ?? ''));
          block.appendChild(makeRow('Modelo', vehiculo?.modelo ?? ''));
          block.appendChild(makeRow('Año', vehiculo?.anio ?? ''));
          block.appendChild(makeRow('Color', vehiculo?.color ?? ''));
  
          vehiculoCard.appendChild(title);
          vehiculoCard.appendChild(block);
        })();
  
        // 4) Logo más grande en PDF
        const logoImg = element.querySelector('.proforma-logo img');
        if (logoImg) {
          logoImg.style.width = '120px';
          logoImg.style.height = 'auto';
          logoImg.style.objectFit = 'contain';
        }
  
        const options = {
          margin: 10,
          filename: `proforma-${numeroProforma ?? ''}.pdf`,
          html2canvas: { scale: 3, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };
  
        await html2pdf().set(options).from(element).save();
      }, 'Generando PDF…');
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  

  // 👇 validación/normalización de inputs vehículo (incluye "modelo")
  const handleInputChange = (campo, value) => {
    if (campo === 'marca') {
      // Solo letras y espacios
      setVehiculo(v => ({ ...v, marca: value.replace(/[^A-Za-záéíóúÁÉÍÓÚüÜ ]/g, '') }));
    } else if (campo === 'color') {
      // Solo letras, espacios y guiones (p.ej. "Gris-Perla")
      setVehiculo(v => ({ ...v, color: value.replace(/[^A-Za-záéíóúÁÉÍÓÚüÜ\- ]/g, '') }));
    } else if (campo === 'modelo') {
      // Letras, números, espacios y guiones (ej: "CX-5", "320i")
      setVehiculo(v => ({ ...v, modelo: value.replace(/[^A-Za-z0-9áéíóúÁÉÍÓÚüÜ\- ]/g, '') }));
    } else if (campo === 'anio') {
      // Solo dígitos
      setVehiculo(v => ({ ...v, anio: value.replace(/\D/g, '') }));
    } else {
      setVehiculo(v => ({ ...v, [campo]: value }));
    }
  };

  const busy = isSearching || isSaving || isCreatingNew || isGeneratingPdf;

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
        {/* Header */}
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
              disabled={!isClienteLoaded || proformaGuardada || busy}
            >
              <FontAwesomeIcon icon={faSave} /> {isSaving ? 'Guardando…' : 'Guardar'}
            </button>
            <button className="boton-nueva" onClick={handleNuevaProforma} disabled={busy}>
              <FontAwesomeIcon icon={faPlus} /> {isCreatingNew ? 'Creando…' : 'Nueva'}
            </button>
            <button className="boton-descargar" onClick={handleDescargarPDF} disabled={busy}>
              <FontAwesomeIcon icon={faDownload} /> {isGeneratingPdf ? 'Generando…' : 'PDF'}
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
              disabled={busy}
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
              disabled={busy}
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
              {['placa', 'marca', 'modelo', 'anio', 'color'].map((campo) => {
                const label =
                  campo === 'anio' ? 'Año' :
                    campo === 'placa' ? 'Placa (opcional)' :
                      campo.charAt(0).toUpperCase() + campo.slice(1);

                const commonProps = {
                  id: campo,
                  type: 'text',
                  placeholder: label,
                  value: vehiculo[campo] ?? '',
                  disabled: busy,
                  onChange: (e) => handleInputChange(campo, e.target.value),
                };

                return (
                  <div className="input-group" key={campo}>
                    <label htmlFor={campo}>{label}</label>
                    {campo === 'color' ? (
                      <input
                        {...commonProps}
                        inputMode="text"
                        pattern="[A-Za-zÁÉÍÓÚáéíóúÜü\\s\\-]+"
                        onKeyDown={(e) => { if (/\d/.test(e.key)) e.preventDefault(); }}
                      />
                    ) : (
                      <input {...commonProps} />
                    )}
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
            <button className="btn-add" onClick={agregarReparacion} disabled={busy}>+ Agregar</button>
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
                      disabled={busy}
                      onChange={(e) => handleReparacionChange(index, 'concepto', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={r.precio}
                      disabled={busy}
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
                      disabled={busy}
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
                disabled={busy}
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
