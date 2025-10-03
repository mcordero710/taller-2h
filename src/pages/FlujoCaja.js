import React, { useEffect, useMemo, useState } from 'react';
import './FlujoCaja.css';
import { db } from '../firebase/firebase';
import {
    collection, addDoc, query, where, getDocs, doc, updateDoc,
    serverTimestamp, orderBy
} from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';

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

    // apertura
    const [openingStr, setOpeningStr] = useState('');

    // egreso manual (sin método)
    const [egresoDetalle, setEgresoDetalle] = useState('');
    const [egresoMonto, setEgresoMonto] = useState('');
    const [loading, setLoading] = useState(false);

    const loadSession = async (dk) => {
        // 1) Sesión del día
        const q1 = query(collection(db, 'cash_sessions'), where('dateKey', '==', dk));
        const s1 = await getDocs(q1);
        let sess = null;
        if (!s1.empty) sess = { id: s1.docs[0].id, ...s1.docs[0].data() };
        setSession(sess);

        // 2) Movimientos del día (con fallback si falta índice)
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
                console.warn('⚠️ Falta índice compuesto (cash_movements: dateKey asc, createdAt asc). Usando orden en cliente.');
            } else {
                throw e;
            }
        }
    };

    useEffect(() => { loadSession(selectedDate); }, [selectedDate]);

    const totals = useMemo(() => {
        const byType = { ingreso: 0, egreso: 0 };
        const byMethod = { efectivo: 0, sinpe: 0, transferencia: 0, tarjeta: 0 };
        movs.forEach(m => {
            if (m.type === 'ingreso') byType.ingreso += Number(m.amount) || 0;
            if (m.type === 'egreso') byType.egreso += Number(m.amount) || 0;
            // solo sumará ingresos que tengan method, los egresos ahora no traen method
            if (byMethod[m.method] != null) byMethod[m.method] += Number(m.amount) || 0;
        });
        const opening = Number(session?.openingAmount || 0);
        const closingComputed = opening + byType.ingreso - byType.egreso;
        return { ...byType, byMethod, opening, closingComputed };
    }, [movs, session]);

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
                // method: (se omite en egresos)
                amount,
                concept: egresoDetalle,
                refType: 'manual',
            });
            setEgresoDetalle(''); setEgresoMonto('');
            toast.success('Egreso registrado');
            await loadSession(selectedDate);
        } finally { setLoading(false); }
    };

    return (
        <div className="cash-page">
            <ToastContainer newestOnTop />

            <h2>Flujo de caja</h2>

            {/* Calendario / selector de día */}
            <div className="cash-toolbar">
                <label>
                    Fecha
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
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
                        {!session.isClosed && <button onClick={cerrarCaja} disabled={loading}>Cerrar caja</button>}
                    </div>
                )}
            </div>

            {/* Registrar egreso manual */}
            <div className="card">
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

            {/* Resumen por método (solo ingresos con method) */}
            <div className="card">
                <h3>Resumen por método</h3>
                <ul className="method-grid">
                    {METHODS.map(m => (
                        <li key={m}><span>{m.toUpperCase()}</span><strong>{formatCRC(totals.byMethod[m])}</strong></li>
                    ))}
                </ul>
            </div>

            {/* Movimientos del día */}
            <div className="card">
                <h3>Movimientos del día</h3>
                <table className="movs">
                    <thead>
                        <tr>
                            <th>Hora</th><th>Tipo</th><th>Método</th><th>Concepto</th><th>Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        {movs.length === 0 && <tr><td colSpan="5" className="empty">Sin movimientos</td></tr>}
                        {movs.map(m => (
                            <tr key={m.id}>
                                <td>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString() : '—'}</td>
                                <td className={m.type}>{m.type.toUpperCase()}</td>
                                <td>{m.type === 'egreso' ? '—' : (m.method?.toUpperCase() || '—')}</td>
                                <td>{m.concept}</td>
                                <td className="num">{formatCRC(m.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
