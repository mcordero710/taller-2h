// src/pages/FlujoDeCaja.js
import React, { useEffect, useMemo, useState } from 'react';
import './FlujoCaja.css';
import { db } from '../firebase/firebase';
import {
    collection, addDoc, query, where, getDocs, doc, updateDoc,
    serverTimestamp, orderBy
} from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import html2pdf from 'html2pdf.js';
import logo from '../assets/logo.png';

const METHODS = ['efectivo', 'sinpe', 'transferencia', 'tarjeta'];

const dateKey = (d) => {
    const dt = d instanceof Date ? d : new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatCRC = (n) =>
    `₡${new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)}`;

export default function FlujoDeCaja() {
    const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
    const [session, setSession] = useState(null);
    const [movs, setMovs] = useState([]);

    // apertura digitada
    const [openingStr, setOpeningStr] = useState('');

    // egreso manual
    const [egresoDetalle, setEgresoDetalle] = useState('');
    const [egresoMonto, setEgresoMonto] = useState('');
    const [loading, setLoading] = useState(false);

    const loadSession = async (dk) => {
        // Sesión del día
        const q1 = query(collection(db, 'cash_sessions'), where('dateKey', '==', dk));
        const s1 = await getDocs(q1);
        let sess = null;
        if (!s1.empty) sess = { id: s1.docs[0].id, ...s1.docs[0].data() };
        setSession(sess);

        // Movimientos del día (fallback si falta índice)
        try {
            const q2 = query(
                collection(db, 'cash_movements'),
                where('dateKey', '==', dk),
                orderBy('createdAt', 'asc')
            );
            const s2 = await getDocs(q2);
            setMovs(s2.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            const msg = String(e?.message || '');
            if (e?.code === 'failed-precondition' || msg.includes('index')) {
                const q2b = query(collection(db, 'cash_movements'), where('dateKey', '==', dk));
                const s2b = await getDocs(q2b);
                const arr = s2b.docs.map(d => ({ id: d.id, ...d.data() }));
                arr.sort((a, b) => {
                    const at = a?.createdAt?.seconds ?? 0;
                    const bt = b?.createdAt?.seconds ?? 0;
                    return at - bt;
                });
                setMovs(arr);
                console.warn('⚠️ Falta índice (cash_movements: dateKey asc, createdAt asc). Ordenando en cliente.');
            } else {
                throw e;
            }
        }
    };

    useEffect(() => { loadSession(selectedDate); }, [selectedDate]);

    // Totales y split por tipo
    const totals = useMemo(() => {
        const byType = { ingreso: 0, egreso: 0 };
        const byMethod = { efectivo: 0, sinpe: 0, transferencia: 0, tarjeta: 0 };
        movs.forEach(m => {
            if (m.type === 'ingreso') byType.ingreso += Number(m.amount) || 0;
            if (m.type === 'egreso') byType.egreso += Number(m.amount) || 0;
            if (byMethod[m.method] != null) byMethod[m.method] += Number(m.amount) || 0;
        });
        const opening = Number(session?.openingAmount || 0);
        const closingComputed = opening + byType.ingreso - byType.egreso;
        return { ...byType, byMethod, opening, closingComputed };
    }, [movs, session]);

    // Listas separadas
    const ingresos = useMemo(() => movs.filter(m => m.type === 'ingreso'), [movs]);
    const egresos = useMemo(() => movs.filter(m => m.type === 'egreso'), [movs]);

    const abrirCaja = async () => {
        const amount = Number(String(openingStr).replace(/[^\d.-]/g, '')) || 0;
        if (!amount) { toast.error('Digite el monto de apertura.'); return; }
        try {
            setLoading(true);
            const ex = query(collection(db, 'cash_sessions'), where('dateKey', '==', selectedDate));
            const snap = await getDocs(ex);
            if (!snap.empty) { toast.info('La caja de este día ya está abierta.'); return; }
            await addDoc(collection(db, 'cash_sessions'), {
                dateKey: selectedDate,
                openingAmount: amount,
                openingAt: serverTimestamp(),
                isClosed: false,
            });
            toast.success('Apertura creada');
            setOpeningStr('');
            await loadSession(selectedDate);
        } finally { setLoading(false); }
    };

    const cerrarCaja = async () => {
        if (!session?.id) return;
        try {
            setLoading(true);
            await updateDoc(doc(db, 'cash_sessions', session.id), {
                closingAmount: totals.closingComputed,
                closingAt: serverTimestamp(),
                isClosed: true,
            });
            toast.success('Caja cerrada');
            await loadSession(selectedDate);
        } finally { setLoading(false); }
    };

    const registrarEgreso = async () => {
        if (!session?.id) { toast.error('Primero abre la caja del día.'); return; }
        const amount = Number(String(egresoMonto).replace(/[^\d.-]/g, '')) || 0;
        if (!egresoDetalle || !amount) { toast.error('Detalle y monto son obligatorios.'); return; }
        try {
            setLoading(true);
            await addDoc(collection(db, 'cash_movements'), {
                sessionId: session.id,
                dateKey: selectedDate,
                createdAt: serverTimestamp(),
                type: 'egreso',
                amount,
                concept: egresoDetalle,
                refType: 'manual',
            });
            setEgresoDetalle(''); setEgresoMonto('');
            toast.success('Egreso registrado');
            await loadSession(selectedDate);
        } finally { setLoading(false); }
    };

    // ===== PDF: Descargar cierre =====
    const descargarPDF = async () => {
        const original = document.getElementById('cash-pdf');
        if (!original) return;

        const fechaLocal = new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('es-CR', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });

        try {
            // clonar y limpiar
            const copia = original.cloneNode(true);

            // 1) Quitar controles/elementos no deseados en el PDF
            copia.querySelectorAll(`
        input,
        button,
        .form-row,
        .cash-footer,
        .Toastify__toast-container,
        .Toastify__toast,
        .toast-confirm-wrapper
      `).forEach(el => el.remove());

            // 2) Quitar label "Fecha" (pero mantener estado/badge)
            const fechaLabel = copia.querySelector('.cash-toolbar > label');
            if (fechaLabel) fechaLabel.remove();

            // 3) Quitar por completo la tarjeta de egreso
            copia.querySelectorAll('.card-egreso').forEach(el => el.remove());

            // 4) Encabezado minimal: logo + empresa + fecha
            const header = document.createElement('div');
            header.setAttribute(
                'style',
                'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;'
            );

            const img = document.createElement('img');
            img.src = logo;
            img.alt = 'Taller 2H';
            img.setAttribute('style', 'width:120px;height:auto;');

            const info = document.createElement('div');
            info.setAttribute('style', 'text-align:right;font-size:12px;color:#333;line-height:1.3;');
            info.innerHTML = `
        <div><strong>Taller automotriz 2H S.A.</strong></div>
        <div><strong>Fecha cierre:</strong> ${fechaLocal}</div>
      `;

            header.appendChild(img);
            header.appendChild(info);
            copia.insertBefore(header, copia.firstChild);

            // 5) Estilos forzados para PDF
            const styleEl = document.createElement('style');
            styleEl.textContent = `
        .movs thead th { background:#0f172a !important; color:#fff !important; }
        table tr, table th, table td { break-inside: avoid !important; page-break-inside: avoid !important; }
        .movs thead { display: table-header-group !important; }
        .movs tbody { display: table-row-group !important; }
      `;
            copia.insertBefore(styleEl, copia.firstChild);

            const opt = {
                margin: 0.5,
                filename: `Cierre-Caja-${selectedDate}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.no-split-row'] },
            };

            await html2pdf().set(opt).from(copia).save();
        } catch (e) {
            console.error('Error generando PDF cierre:', e);
            toast.error('No se pudo generar el PDF del cierre.');
        }
    };

    // Confirmación de cierre
    const confirmarCierreCaja = () => {
        if (!session?.id || session.isClosed) return;

        toast.info(
            ({ closeToast }) => (
                <div className="toast-confirm-container">
                    <p className="toast-confirm-message">¿Estás seguro de cerrar caja?</p>
                    <div className="toast-confirm-buttons">
                        <button
                            className="btn-confirm eliminar"
                            onClick={async () => {
                                await cerrarCaja();
                                closeToast();
                            }}
                            disabled={loading}
                        >
                            Sí, cerrar
                        </button>
                        <button
                            className="btn-confirm cancelar"
                            onClick={closeToast}
                            disabled={loading}
                        >
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
                className: 'toast-confirm-wrapper',
            }
        );
    };

    // Meta de métodos (para KPIs)
    const METHOD_META = {
        efectivo: { label: 'Efectivo', icon: '💵', hue: 160 },
        sinpe: { label: 'SINPE', icon: '⚡️', hue: 200 },
        transferencia: { label: 'Transferencia', icon: '🔁', hue: 220 },
        tarjeta: { label: 'Tarjeta', icon: '💳', hue: 265 },
    };

    const methodArr = Object.entries(totals.byMethod)
        .map(([key, amount]) => ({
            key,
            amount,
            ...METHOD_META[key]
        }))
        .sort((a, b) => b.amount - a.amount);

    const totalByMethods = methodArr.reduce((s, m) => s + (Number(m.amount) || 0), 0);

    return (
        <div className="cash-page">
            {/* Igual que Proforma: multi-contenedor + mismo containerId */}
            <ToastContainer
                enableMultiContainer
                containerId="center-toast"
                className="center-toast-container"
                newestOnTop
                closeOnClick={false}
            />

            {/* Botón descargar */}
            <button
                className="btn-descargar"
                onClick={descargarPDF}
                title="Descargar cierre"
                aria-label="Descargar cierre"
            >
                Descargar cierre
            </button>

            <h2>Flujo de caja</h2>

            {/* Contenido imprimible */}
            <div id="cash-pdf">
                {/* Toolbar */}
                <div className="cash-toolbar">
                    <label>
                        Fecha
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </label>

                    {!session ? (
                        <div className="apertura">
                            <label>Monto de apertura</label>
                            <input
                                value={openingStr}
                                onChange={(e) => setOpeningStr(e.target.value.replace(/[^\d]/g, ''))}
                            />
                            <button onClick={abrirCaja} disabled={loading}>Abrir caja</button>
                        </div>
                    ) : (
                        <div className="estado">
                            <span className={`badge ${session.isClosed ? 'closed' : 'open'}`}>
                                {session.isClosed ? 'Cerrada' : 'Abierta'}
                            </span>
                            <span>Apertura: <strong>{formatCRC(session.openingAmount)}</strong></span>
                            <span>Ingresos: <strong>{formatCRC(totals.ingreso)}</strong></span>
                            <span>Egresos: <strong>{formatCRC(totals.egreso)}</strong></span>
                            <span>Estimado cierre: <strong>{formatCRC(totals.closingComputed)}</strong></span>
                        </div>
                    )}
                </div>

                {/* Registrar egreso manual (marcada para ocultar en PDF) */}
                <div className="card card-egreso">
                    <h3>Registrar salida (egreso)</h3>
                    <div className="form-row">
                        <input
                            placeholder="Detalle (ej. Compra de materiales)"
                            value={egresoDetalle}
                            onChange={(e) => setEgresoDetalle(e.target.value)}
                        />
                        <input
                            placeholder="Monto"
                            value={egresoMonto}
                            onChange={(e) => setEgresoMonto(e.target.value.replace(/[^\d]/g, ''))}
                        />
                        <button
                            onClick={registrarEgreso}
                            disabled={loading || !session || session.isClosed}
                        >
                            Agregar
                        </button>
                    </div>
                </div>

                {/* Resumen por método (KPIs) */}
                <div className="card">
                    <h3>Resumen por método</h3>

                    <div className="method-summary">
                        {methodArr.map(m => {
                            const pct = totalByMethods ? Math.round((m.amount / totalByMethods) * 100) : 0;
                            return (
                                <div key={m.key} className="method-kpi" style={{ '--h': m.hue + '' }}>
                                    <div className="mkpi-top">
                                        <div className="mkpi-left">
                                            <span className="mkpi-icon" aria-hidden>{m.icon}</span>
                                            <span className="mkpi-label">{m.label}</span>
                                        </div>
                                        <div className="mkpi-amount">{formatCRC(m.amount)}</div>
                                    </div>
                                    <div className="mkpi-bar">
                                        <span className="mkpi-bar__fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="mkpi-footer">{pct}% del total</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="method-total-line">
                        Total por métodos: <strong>{formatCRC(totalByMethods)}</strong>
                    </div>
                </div>

                {/* ====== Tabla: INGRESOS ====== */}
                <div className="card">
                    <h3>Ingresos del día</h3>
                    <table className="movs">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Tipo</th>
                                <th>Método</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ingresos.length === 0 && (
                                <tr><td colSpan="5" className="empty">Sin ingresos</td></tr>
                            )}
                            {ingresos.map(m => (
                                <tr key={m.id}>
                                    <td>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString() : '—'}</td>
                                    <td className="INGRESO">INGRESO</td>
                                    <td>{m.method?.toUpperCase() || '—'}</td>
                                    <td>{m.concept}</td>
                                    <td className="num">{formatCRC(m.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ====== Tabla: EGRESOS ====== */}
                <div className="card">
                    <h3>Egresos del día</h3>
                    <table className="movs">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Tipo</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {egresos.length === 0 && (
                                <tr><td colSpan="4" className="empty">Sin egresos</td></tr>
                            )}
                            {egresos.map(m => (
                                <tr key={m.id}>
                                    <td>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString() : '—'}</td>
                                    <td className="EGRESO">EGRESO</td>
                                    <td>{m.concept || '—'}</td>
                                    <td className="num">{formatCRC(m.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Botón fuera de la tabla */}
                    {session && !session.isClosed && (
                        <div className="cash-footer">
                            <button className="btn-close" onClick={confirmarCierreCaja} disabled={loading}>
                                Cerrar caja
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
