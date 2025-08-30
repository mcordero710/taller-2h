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

// ===== Helpers de formato =====
const LOCALE_NUMERIC = 'es-ES'; // Para inputs con punto de miles y coma decimal (50.000,00)

// deja LOCALE_NUMERIC = 'es-ES'
const formatCRC = (n) =>
  `₡${new Intl.NumberFormat(LOCALE_NUMERIC, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number(n) || 0)}`;

const formatNumber = (n) =>
  new Intl.NumberFormat(LOCALE_NUMERIC, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(Number(n) || 0);

// Acepta "50000", "50.000,00", "50,000.00", etc. y devuelve número JS
const parseMoney = (str) => {
  if (str == null) return 0;
  const s = String(str).replace(/[^\d.,-]/g, '').replace(/\s/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized = s;

  if (lastComma > -1 && lastDot > -1) {
    // Ambos presentes: el que esté más a la derecha es el decimal
    normalized = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // Solo coma: asúmela como decimal
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Solo punto o solo dígitos
    normalized = s.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const Proforma = () => {
  const [cedula, setCedula] = useState('');
  const [cliente, setCliente] = useState(null);

  // 👇 ahora incluye "modelo"
  const [vehiculo, setVehiculo] = useState({ placa: '', marca: '', modelo: '', anio: '', color: '' });

  // reparaciones: [{ concepto: string, precio: number, precioStr: string }]
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

  // helper para reactivar el botón cuando hay cambios
  const markDirty = () => setProformaGuardada(false);

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

        // Mapear para incluir precioStr (string formateado)
        const repars = (data.reparaciones || []).map((r) => {
          const p = Number(r.precio) || 0;
          return { concepto: r.concepto || '', precio: p, precioStr: formatNumber(p) };
        });
        setReparaciones(repars);

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

      const repars = (proformaDesdeDetalle.reparaciones || []).map((r) => {
        const p = Number(r.precio) || 0;
        return { concepto: r.concepto || '', precio: p, precioStr: formatNumber(p) };
      });
      setReparaciones(repars);

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

  // Cambiado: solo maneja descripción; el precio se maneja con handlers dedicados
  const handleReparacionChange = (index, field, value) => {
    if (field !== 'concepto') return;
    const nuevas = [...reparaciones];
    nuevas[index].concepto = value;
    setReparaciones(nuevas);
    markDirty();
  };

  // Handlers para el monto (input con formato)
  const handlePrecioInput = (index, str) => {
    setReparaciones(prev => {
      const next = [...prev];
      next[index] = { ...next[index], precioStr: str, precio: parseMoney(str) };
      return next;
    });
    markDirty();
  };

  const handlePrecioFocus = (index) => {
    setReparaciones(prev => {
      const next = [...prev];
      const n = Number(next[index].precio) || 0;
      // Mostrar sin separadores mientras se edita (coma decimal)
      next[index] = { ...next[index], precioStr: n.toFixed(2).replace('.', ',') };
      return next;
    });
  };

  const handlePrecioBlur = (index) => {
    setReparaciones(prev => {
      const next = [...prev];
      const n = parseMoney(next[index].precioStr);
      next[index] = { ...next[index], precio: n, precioStr: formatNumber(n) };
      return next;
    });
    markDirty();
  };

  const eliminarReparacionPorIndex = (index) => {
    const nuevas = [...reparaciones];
    nuevas.splice(index, 1);
    setReparaciones(nuevas);
    markDirty();
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
    setReparaciones(prev => [
      ...prev,
      { concepto: '', precio: 0, precioStr: formatNumber(0) }
    ]);
    markDirty();
  };

  const handleIvaChange = () => {
    setIvaChecked(!ivaChecked);
    markDirty();
  };

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
      reparaciones: reparaciones.map(({ concepto, precio }) => ({ concepto, precio })), // 👈 sin precioStr
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
        setProformaGuardada(true); // se deshabilita hasta que vuelvas a editar algo
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
        // Esta clase activa las reglas .exporting-pdf en el clon
        element.classList.add('exporting-pdf');

        // 1) Ocultar controles/acciones de la UI
        element
          .querySelectorAll(
            '.boton-guardar, .boton-nueva, .boton-descargar, .buscar-proforma, .btn-add'
          )
          .forEach((el) => el && (el.style.display = 'none'));

        // Columna de acciones de la tabla (ahora es la 3ra)
        element
          .querySelectorAll('th:nth-child(3), td:nth-child(3)')
          .forEach((col) => (col.style.display = 'none'));

        // Ocultar toggle IVA
        const ivaSection = element.querySelector('.iva-section');
        if (ivaSection) ivaSection.style.display = 'none';

        // Ocultar subtítulo bajo "Proforma"
        const subtitle = element.querySelector('.brand-text .subtitle');
        if (subtitle) subtitle.style.display = 'none';

        // 2) Info del TALLER ARRIBA A LA DERECHA, en vertical
        (() => {
          const head = element.querySelector('.proforma-head');

          let right = head?.querySelector('.head-right');
          if (!right) {
            right = document.createElement('div');
            right.className = 'head-right';
            head?.appendChild(right);
          }

          right.innerHTML = '';
          right.setAttribute(
            'style',
            'margin-left:auto;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:12px;color:#111;line-height:1.35;'
          );

          const lines = [
            'Taller automotriz 2H S.A',
            'Tel: 62756427',
            'Email: taller2hrosario@gmail.com',
            'Cédula Jurídica: 3-101-930294',
          ];

          lines.forEach((txt, i) => {
            const div = document.createElement('div');
            if (i === 0) div.style.fontWeight = '700';
            div.textContent = txt;
            right.appendChild(div);
          });
        })();

        // 3) Utilidad para filas de texto
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
          v.textContent = value ?? '';
          v.setAttribute('style', 'color:#334155;white-space:pre-wrap;');
          row.appendChild(l);
          row.appendChild(v);
          return row;
        };

        // 3.a) Cliente como texto (sin inputs)
        (() => {
          const clienteCard = Array.from(element.querySelectorAll('.card-section'))
            .find(sec => (sec.querySelector('h3')?.textContent || '').toLowerCase().includes('cliente'));
          if (!clienteCard) return;

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

        // 3.b) Vehículo como texto (sin inputs) — Placa puede ir vacía
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

          block.appendChild(makeRow('Placa', vehiculo?.placa ?? ''));
          block.appendChild(makeRow('Marca', vehiculo?.marca ?? ''));
          block.appendChild(makeRow('Modelo', vehiculo?.modelo ?? ''));
          block.appendChild(makeRow('Año', vehiculo?.anio ?? ''));
          block.appendChild(makeRow('Color', vehiculo?.color ?? ''));

          vehiculoCard.appendChild(title);
          vehiculoCard.appendChild(block);
        })();

        // 4) Logo un poco más grande
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
          // Respeta CSS (break-inside/page-break-inside) y evita cortar elementos
          pagebreak: { mode: ['css', 'legacy'] }
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
      setVehiculo(v => ({ ...v, marca: value.replace(/[^A-Za-záéíóúÁÉÍÓÚüÜ ]/g, '') }));
    } else if (campo === 'color') {
      setVehiculo(v => ({ ...v, color: value.replace(/[^A-Za-záéíóúÁÉÍÓÚüÜ\- ]/g, '') }));
    } else if (campo === 'modelo') {
      setVehiculo(v => ({ ...v, modelo: value.replace(/[^A-Za-z0-9áéíóúÁÉÍÓÚüÜ\- ]/g, '') }));
    } else if (campo === 'anio') {
      setVehiculo(v => ({ ...v, anio: value.replace(/\D/g, '') }));
    } else if (campo === 'placa') {
      setVehiculo(v => ({ ...v, placa: (value || '').toUpperCase() }));
    } else {
      setVehiculo(v => ({ ...v, [campo]: value }));
    }
    markDirty();
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
              <FontAwesomeIcon icon={faDownload} /> {isGeneratingPdf ? 'Generando…' : 'Descargar Proforma'}
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
              onChange={(e) => { setCedula(e.target.value.replace(/\D/g, '').slice(0, 9)); markDirty(); }}
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
                <th className="th-desc">Descripción</th>
                <th className="th-monto">Monto</th>
                <th className="th-acciones"></th>
              </tr>
            </thead>
            <tbody>
              {reparaciones.map((r, index) => (
                <tr key={index}>
                  <td className="td-desc">
                    <input
                      type="text"
                      value={r.concepto}
                      disabled={busy}
                      onChange={(e) => handleReparacionChange(index, 'concepto', e.target.value)}
                    />
                  </td>
                  <td className="td-monto">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input-monto"
                      value={r.precioStr ?? formatNumber(r.precio || 0)}
                      disabled={busy}
                      onFocus={() => handlePrecioFocus(index)}
                      onChange={(e) => handlePrecioInput(index, e.target.value)}
                      onBlur={() => handlePrecioBlur(index)}
                      style={{ textAlign: 'right' }}
                    />
                  </td>
                  <td className="td-acciones">
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
                  <td colSpan="3" className="empty">Sin reparaciones. Agrega al menos una.</td>
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
            <p><strong>Subtotal:</strong> {formatCRC(total - ivaAmount)}</p>
            {ivaChecked && <p><strong>IVA (13%):</strong> {formatCRC(ivaAmount)}</p>}
            <p className="total-line"><strong>Total:</strong> {formatCRC(total)}</p>
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
