// src/pages/Servicios.jsx
import React, { useEffect, useState } from 'react';
import './Servicios.css';
import html2pdf from 'html2pdf.js';
import { FaPrint } from 'react-icons/fa';
import { FiX, FiPlus } from 'react-icons/fi';
import { db } from '../firebase/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

export default function Servicios() {
  // ==== Estado ====
  const [descripcion, setDescripcion] = useState('');
  const [montoStr, setMontoStr] = useState('');
  const [servicios, setServicios] = useState([]); // <- IMPORTANTE: array vacío

  // ==== Helpers de formato ====
  const LOCALE_NUMERIC = 'es-CR';
  const formatNumber = (n) =>
    new Intl.NumberFormat(LOCALE_NUMERIC, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(Number(n) || 0);
  const formatearCRC = (n) => `₡${formatNumber(n)}`;
  const parseMoney = (s) => {
    if (s == null) return 0;
    const raw = String(s).replace(/[^\d.,-]/g, '').trim();
    if (!raw) return 0;
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    let norm = raw;
    if (lastComma > -1 && lastDot > -1) {
      norm = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    } else if (lastComma > -1) {
      norm = raw.replace(/\./g, '').replace(',', '.');
    } else {
      norm = raw.replace(/,/g, '');
    }
    const n = parseFloat(norm);
    return Number.isFinite(n) ? n : 0;
  };

  // ==== Cargar listado en vivo ====
  useEffect(() => {
    const qy = query(collection(db, 'servicios'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d, i) => ({ id: d.id, idx: i + 1, ...d.data() }));
      setServicios(rows || []); // <- siempre array
    });
    return () => unsub();
  }, []);

  // ==== Acciones ====
  const limpiar = () => {
    setDescripcion('');
    setMontoStr('');
  };

  const agregarServicio = async () => {
    const monto = parseMoney(montoStr);
    if (!descripcion.trim() || !monto) return;
    await addDoc(collection(db, 'servicios'), {
      descripcion: descripcion.trim(),
      monto,
      createdAt: serverTimestamp(),
    });
    limpiar();
  };

  const eliminarServicio = async (id) => {
    if (!id) return;
    await deleteDoc(doc(db, 'servicios', id));
  };

  // ==== PDF ====
  const imprimirServicios = async () => {
    const original = document.getElementById('servicios-pdf');
    if (!original) return;
    const copia = original.cloneNode(true);
    copia.querySelectorAll('input, button, .acciones-top, .fila-agregar').forEach((el) => el.remove());
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .servicios-root, .servicios-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .tabla-servicios thead th { background:#0f172a !important; color:#fff !important; }
      .tabla-servicios thead { display: table-header-group !important; }
      .tabla-servicios tbody { display: table-row-group !important; }
      table tr, table th, table td { break-inside: avoid !important; page-break-inside: avoid !important; }
    `;
    copia.insertBefore(styleEl, copia.firstChild);

    await html2pdf()
      .set({
        margin: 0.5,
        filename: 'Servicios.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] },
      })
      .from(copia)
      .save();
  };

  // ==== Render ====
  const rows = Array.isArray(servicios) ? servicios : [];
  const totalFilas = rows.length;

  // wrapper
  return (
    <div className="servicios-root">
      <div className="container">
        <div className="acciones-top">
          <button className="btn btn--sm" onClick={imprimirServicios}>
            <FaPrint /> Imprimir / Guardar PDF
          </button>
          <button className="btn btn--sm btn--ghost" onClick={limpiar}>
            <FiX /> Limpiar
          </button>
        </div>

        <h2 className="titulo">Servicios</h2>
        <p className="sub">
          Catálogo de servicios con campos <strong>Descripción</strong> y <strong>Monto</strong>.
        </p>

        <div id="servicios-pdf">
          <div className="card">
            <h3>Agregar servicio</h3>
            <div className="fila-agregar">
              <label>
                Descripción
                <input
                  className="input"
                  placeholder="Ej. lavado, pulido…"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </label>
              <label>
                Monto
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="₡0,00"
                  value={montoStr}
                  onChange={(e) => setMontoStr(e.target.value)}
                />
              </label>
              <button className="btn btn--sm btn--primary" onClick={agregarServicio}>
                <FiPlus /> Agregar
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Listado</h3>
            <table className="tabla-servicios">
              <thead>
                <tr>
                  <th style={{ width: 64 }}>#</th>
                  <th>Descripción</th>
                  <th style={{ width: 180 }}>Monto</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={s.id}>
                    <td className="is-center">{i + 1}</td>
                    <td>{s.descripcion}</td>
                    <td className="is-right tabular">{formatearCRC(s.monto)}</td>
                    <td className="is-center">
                      <button
                        className="btn-icon btn-icon--danger"
                        onClick={() => eliminarServicio(s.id)}
                        title="Eliminar"
                      >
                        🗑️
                        {/* Si prefieres ícono: <FiX /> o un trash de react-icons */}
                      </button>
                    </td>
                  </tr>
                ))}

                {totalFilas === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      Sin servicios
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

}
