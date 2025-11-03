// src/pages/Servicios.jsx
import React, { useEffect, useState } from 'react';
import './Servicios.css';
import { FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaPrint, FaBroom } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { db } from '../firebase/firebase';
import {
    collection, addDoc, getDocs, query, orderBy, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { useLoading } from '../components/ui/LoadingContext';

const LOCALE_NUMERIC = 'es-ES';
const fmtMoney = (n) =>
    new Intl.NumberFormat(LOCALE_NUMERIC, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(Number(n) || 0);

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

const Servicios = () => {
    const { withLoading } = useLoading();

    // Form
    const [desc, setDesc] = useState('');
    const [montoStr, setMontoStr] = useState('0,00');

    // Listado
    const [items, setItems] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editDesc, setEditDesc] = useState('');
    const [editMontoStr, setEditMontoStr] = useState('');

    const colRef = collection(db, 'servicios_catalogo');

    const load = async () => {
        const snap = await getDocs(query(colRef, orderBy('descripcion')));
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setItems(rows);
    };
    useEffect(() => { load(); }, []);

    const resetForm = () => { setDesc(''); setMontoStr('0,00'); };
    const clearScreen = () => { resetForm(); setItems([]); setEditingId(null); setEditDesc(''); setEditMontoStr(''); };

    const add = async () => {
        const d = (desc || '').trim();
        const m = parseMoney(montoStr);
        if (!d) return toast.info('Escribe una descripción.');
        if (m <= 0) return toast.info('Ingresa un monto mayor a 0.');
        try {
            await withLoading(async () => {
                await addDoc(colRef, {
                    descripcion: d,
                    monto: m,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }, 'Guardando servicio…');
            toast.success('Servicio agregado.');
            resetForm();
            load();
        } catch (e) {
            console.error(e);
            toast.error('No se pudo guardar.');
        }
    };

    const startEdit = (row) => {
        setEditingId(row.id);
        setEditDesc(row.descripcion || '');
        setEditMontoStr(fmtMoney(row.monto || 0));
    };
    const cancelEdit = () => { setEditingId(null); setEditDesc(''); setEditMontoStr(''); };

    const saveEdit = async (id) => {
        const d = (editDesc || '').trim();
        const m = parseMoney(editMontoStr);
        if (!d || m <= 0) return;
        try {
            await withLoading(async () => {
                await updateDoc(doc(db, 'servicios_catalogo', id), {
                    descripcion: d,
                    monto: m,
                    updatedAt: serverTimestamp()
                });
            }, 'Actualizando…');
            toast.success('Servicio actualizado.');
            cancelEdit();
            load();
        } catch (e) {
            console.error(e);
            toast.error('No se pudo actualizar.');
        }
    };

    const delRow = async (id) => {
        try {
            await withLoading(async () => {
                await deleteDoc(doc(db, 'servicios_catalogo', id));
            }, 'Eliminando…');
            toast.success('Servicio eliminado.');
            load();
        } catch (e) {
            console.error(e);
            toast.error('No se pudo eliminar.');
        }
    };

    // Imprimir (no limpia automáticamente para evitar hoja en blanco)
    const imprimir = () => {
        if (items.length === 0) { toast.info('No hay servicios para imprimir.'); return; }
        window.print();
    };

    return (
        <div className="servicios-page servicios">
            <header className="serv-head">
                <div>
                    <h2>Servicios</h2>
                    <p>Catálogo de servicios con campos <strong>Descripción</strong> y <strong>Monto</strong>.</p>
                </div>
                <div className="head-actions">
                    <button className="btn btn--ghost" onClick={imprimir}>
                        <FaPrint className="mr-6" /> Imprimir / Guardar PDF
                    </button>
                    <button className="btn btn--subtle" onClick={clearScreen}>
                        <FaBroom className="mr-6" /> Limpiar
                    </button>
                </div>
            </header>

            {/* Agregar */}
            <section className="card">
                <div className="card-header"><h3>Agregar servicio</h3></div>
                <div className="card-body">
                    <div className="add-vertical">
                        {/* Descripción */}
                        <div className="field">
                            <label>Descripción</label>
                            <input
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                            />
                        </div>

                        {/* Monto (compacto) */}
                        <div className="field field--monto">
                            <label>Monto</label>
                            <div className="money-wrap">
                                <span className="money-prefix">₡</span>
                                <input
                                    className="money-input"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    value={montoStr}
                                    onFocus={(e) => {
                                        const n = parseMoney(e.target.value);
                                        setMontoStr(n.toFixed(2).replace('.', ','));
                                    }}
                                    onChange={(e) => setMontoStr(e.target.value)}
                                    onBlur={(e) => setMontoStr(fmtMoney(parseMoney(e.target.value)))}
                                />
                            </div>
                        </div>

                        {/* Botón Agregar */}
                        <div className="actions-right">
                            <button className="btn btn--sm" onClick={add}>
                                <FaPlus className="mr-6" /> Agregar
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Listado */}
            <section className="card">
                <div className="card-header"><h3>Listado</h3></div>
                <div className="card-body">
                    <table className="tabla tabla--bluehead tabla-servicios">
                        <thead>
                            <tr>
                                <th style={{ width: 80 }}>#</th>
                                <th>Descripción</th>
                                <th className="col-monto" style={{ width: 160 }}>Monto</th>
                                <th className="is-center" style={{ width: 120 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr><td colSpan={4} className="table-empty">No hay resultados.</td></tr>
                            )}
                            {items.map((r, idx) => (
                                <tr key={r.id}>
                                    <td className="idx">{idx + 1}</td>
                                    <td>
                                        {editingId === r.id ? (
                                            <input
                                                className="input-inline"
                                                value={editDesc}
                                                onChange={(e) => setEditDesc(e.target.value)}
                                                autoFocus
                                            />
                                        ) : r.descripcion}
                                    </td>
                                    <td className="col-monto">
                                        {editingId === r.id ? (
                                            <input
                                                className="input-inline input-inline--money"
                                                value={editMontoStr}
                                                onChange={(e) => setEditMontoStr(e.target.value)}
                                                onFocus={(e) => {
                                                    const n = parseMoney(e.target.value);
                                                    setEditMontoStr(n.toFixed(2).replace('.', ','));
                                                }}
                                                onBlur={(e) => setEditMontoStr(fmtMoney(parseMoney(e.target.value)))}
                                            />
                                        ) : `₡${fmtMoney(r.monto)}`}
                                    </td>
                                    <td className="is-center">
                                        {editingId === r.id ? (
                                            <>
                                                <button className="btn-icon btn-icon--ghost" onClick={() => saveEdit(r.id)} title="Guardar"><FaSave /></button>
                                                <button className="btn-icon btn-icon--ghost" onClick={cancelEdit} title="Cancelar"><FaTimes /></button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn-icon btn-icon--ghost" onClick={() => startEdit(r)} title="Editar"><FaEdit /></button>
                                                <button className="btn-icon btn-icon--danger" onClick={() => delRow(r.id)} title="Eliminar"><FaTrash /></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Sección oculta para impresión */}
            <div className="print-root">
                <h1 className="pr-title">Catálogo de servicios</h1>
                <div className="pr-meta">
                    {new Date().toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
                <table className="pr-table">
                    <thead>
                        <tr>
                            <th style={{ width: 48 }}>#</th>
                            <th>Descripción</th>
                            <th style={{ width: 160 }}>Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((r, i) => (
                            <tr key={r.id}>
                                <td>{i + 1}</td>
                                <td>{r.descripcion}</td>
                                <td>₡{fmtMoney(r.monto)}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr><td colSpan={3}>— Sin servicios —</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Servicios;
