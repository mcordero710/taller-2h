// src/pages/Inventario.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Inventario.css';

import { db } from '../firebase/firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    updateDoc,
    doc,
    serverTimestamp,
    getDocs,
    where,
} from 'firebase/firestore';

import { toast } from 'react-toastify';
import { useLoading } from '../components/ui/LoadingContext';
import Pagination from '../components/Pagination/Pagination';
import { FiSearch, FiX, FiEdit2 } from 'react-icons/fi';

const LOCALE_NUMERIC = 'es-ES';
const formatNumber = (n) =>
    new Intl.NumberFormat(LOCALE_NUMERIC, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
    }).format(Number(n) || 0);

// Formato/parseo de enteros para Cantidad
const formatInt = (n) =>
    new Intl.NumberFormat(LOCALE_NUMERIC, {
        maximumFractionDigits: 0,
        useGrouping: true,
    }).format(Math.trunc(Number(n) || 0));

const intOrZero = (v) => {
    const s = String(v ?? '').replace(/\D/g, '');
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
};

const numberOrZero = (n) => Number(n || 0);

// Estado vacío del form
const EMPTY = {
    codigo: '',
    descripcion: '',
    precioCosto: '',
    precio: '',
    cantidad: '',
};

const Inventario = () => {
    // Modal & edición
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedId, setSelectedId] = useState(null);

    // Form
    const [form, setForm] = useState(EMPTY);

    // Datos
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const perPage = 10;

    // Loader helpers
    const { show, hide, withLoading } = useLoading();
    const firstLoadRef = useRef(true);

    // Flags
    const [isSaving, setIsSaving] = useState(false);
    const [isCheckingCode, setIsCheckingCode] = useState(false);
    const busy = isSaving || isCheckingCode;

    // ===== Subscribirse a la colección =====
    useEffect(() => {
        show('Cargando inventario…');

        const q = query(collection(db, 'inventario'), orderBy('codigo'));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setItems(list);
                if (firstLoadRef.current) {
                    hide();
                    firstLoadRef.current = false;
                }
            },
            (err) => {
                console.error('Inventario onSnapshot error:', err);
                toast.error('No se pudo cargar el inventario.');
                hide();
            }
        );

        return () => unsub();
    }, [show, hide]);

    // ===== Filtro + orden + paginación =====
    const filtered = useMemo(() => {
        const s = searchTerm.trim().toLowerCase();
        const base = !s
            ? items
            : items.filter(
                (it) =>
                    String(it.codigo || '').toLowerCase().includes(s) ||
                    String(it.descripcion || '').toLowerCase().includes(s)
            );
        return [...base].sort((a, b) =>
            String(a.codigo || '').localeCompare(String(b.codigo || ''), 'es', { sensitivity: 'base' })
        );
    }, [items, searchTerm]);

    const indexLast = currentPage * perPage;
    const currentRows = filtered.slice(indexLast - perPage, indexLast);

    // ===== UI helpers =====
    const clearSearch = () => {
        setSearchTerm('');
        setCurrentPage(1);
    };

    const openCreate = () => {
        if (busy) return;
        setEditMode(false);
        setSelectedId(null);
        setForm(EMPTY);
        setShowModal(true);
    };

    const handleEdit = (row) => {
        if (busy) return;
        setEditMode(true);
        setSelectedId(row.id);
        setForm({
            codigo: row.codigo || '',
            descripcion: row.descripcion || '',
            precioCosto: String(row.precioCosto ?? ''),
            precio: String(row.precio ?? ''),
            cantidad: String(row.cantidad ?? ''),
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditMode(false);
        setSelectedId(null);
        setForm(EMPTY);
    };

    // ===== Form handlers =====
    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    // Solo dígitos para Cantidad
    const onChangeCantidad = (e) => {
        const digits = e.target.value.replace(/\D/g, '');
        setForm((f) => ({ ...f, cantidad: digits }));
    };

    // ===== Validación simple =====
    const validate = () => {
        if (!form.codigo.trim()) return 'El campo "Código" es obligatorio.';
        if (!form.descripcion.trim()) return 'El campo "Descripción" es obligatorio.';
        const pc = numberOrZero(form.precioCosto);
        const p = numberOrZero(form.precio);
        const c = intOrZero(form.cantidad);
        if (pc < 0 || p < 0 || c < 0) return 'Los valores numéricos no pueden ser negativos.';
        return null;
    };

    // ===== Validación de código único (local + Firestore) =====
    const codigoExiste = async (codigo, omitId = null) => {
        const cod = (codigo || '').trim();

        // 1) Chequeo local inmediato
        const existeLocal = items.some(
            (it) => (String(it.codigo || '').trim() === cod) && it.id !== omitId
        );
        if (existeLocal) return true;

        // 2) Doble chequeo remoto (por si otro cliente lo agregó en paralelo)
        const qRef = query(collection(db, 'inventario'), where('codigo', '==', cod));
        const snap = await getDocs(qRef);
        const existeRemoto = snap.docs.some((d) => d.id !== omitId);
        return existeRemoto;
    };

    // ===== Guardar =====
    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        const err = validate();
        if (err) {
            toast.warn(err);
            return;
        }

        // Validar unicidad del código
        setIsCheckingCode(true);
        const duplicado = await withLoading(
            () => codigoExiste(form.codigo, editMode ? selectedId : null),
            'Validando código…'
        ).catch(() => false);
        setIsCheckingCode(false);

        if (duplicado) {
            toast.error('El código ya existe en el inventario.');
            return;
        }

        // Guardar
        try {
            setIsSaving(true);
            await withLoading(async () => {
                if (editMode && selectedId) {
                    await updateDoc(doc(db, 'inventario', selectedId), {
                        codigo: form.codigo.trim(),
                        descripcion: form.descripcion.trim(),
                        precioCosto: numberOrZero(form.precioCosto),
                        precio: numberOrZero(form.precio),
                        cantidad: intOrZero(form.cantidad),
                        updatedAt: serverTimestamp(),
                    });
                    toast.success('Artículo actualizado');
                } else {
                    await addDoc(collection(db, 'inventario'), {
                        codigo: form.codigo.trim(),
                        descripcion: form.descripcion.trim(),
                        precioCosto: numberOrZero(form.precioCosto),
                        precio: numberOrZero(form.precio),
                        cantidad: intOrZero(form.cantidad),
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                    toast.success('Artículo agregado');
                }
            }, editMode ? 'Guardando cambios…' : 'Guardando artículo…');

            closeModal();
        } catch (e) {
            console.error(e);
            toast.error('No se pudo guardar el artículo');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="inventario-page">
            <div className="inventario-card" aria-busy={busy}>
                {/* Header */}
                <header className="inventario-header">
                    <div>
                        <h2>Inventario</h2>
                        <p className="subtitle">Administra tus artículos. Doble clic en una fila para editar.</p>
                    </div>

                    <button className="boton-agregar boton-agregar--sm" onClick={openCreate} disabled={busy}>
                        Agregar Artículo
                    </button>
                </header>

                {/* Toolbar */}
                <div className="toolbar">
                    <div className="search">
                        <FiSearch className="search-icon" aria-hidden />
                        <input
                            className="search-input"
                            type="text"
                            placeholder="Buscar por código o descripción…"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            disabled={busy}
                        />
                        {searchTerm && (
                            <button
                                className="search-clear"
                                onClick={clearSearch}
                                aria-label="Limpiar búsqueda"
                                disabled={busy}
                            >
                                <FiX />
                            </button>
                        )}
                    </div>

                    <div className="counter">
                        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* Tabla */}
                <div className="table-wrap">
                    <table className="tabla-inventario">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th className="is-right">Precio Costo</th>
                                <th className="is-right">Precio Venta</th>
                                <th className="is-center">Cantidad</th>
                                <th className="th-actions is-center">
                                    <span className="th-actions-text">Acciones</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentRows.map((row) => (
                                <tr
                                    key={row.id}
                                    onDoubleClick={() => !busy && handleEdit(row)}
                                    style={{ cursor: busy ? 'default' : 'pointer' }}
                                >
                                    <td className="mono">{row.codigo}</td>
                                    <td>{row.descripcion}</td>
                                    <td className="is-right">₡{formatNumber(row.precioCosto)}</td>
                                    <td className="is-right">₡{formatNumber(row.precio)}</td>
                                    <td className="is-center">{formatInt(row.cantidad)}</td>
                                    <td className="td-actions">
                                        <button
                                            type="button"
                                            className="btn-icon btn-icon--edit"
                                            onClick={() => handleEdit(row)}
                                            aria-label="Editar"
                                            title="Editar"
                                            disabled={busy}
                                        >
                                            <FiEdit2 />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {currentRows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="empty">
                                        Sin resultados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                <Pagination
                    currentPage={currentPage}
                    totalItems={filtered.length}
                    itemsPerPage={perPage}
                    onPageChange={(p) => !busy && setCurrentPage(p)}
                />
            </div>

            {/* Modal */}
            {showModal && (
                <div
                    className="modal-overlay"
                    onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
                >
                    <div className="modal" role="dialog" aria-modal="true">
                        <div className="modal-head">
                            <h3>{editMode ? 'Editar Artículo' : 'Nuevo Artículo'}</h3>
                            <button className="btn-icon" onClick={closeModal} aria-label="Cerrar" disabled={busy}>
                                <FiX />
                            </button>
                        </div>

                        <form className="modal-form" onSubmit={handleSubmit}>
                            <label>
                                <span>Código *</span>
                                <input
                                    name="codigo"
                                    value={form.codigo}
                                    onChange={onChange}
                                    autoComplete="off"
                                    required
                                    disabled={busy}
                                />
                            </label>

                            <label>
                                <span>Descripción *</span>
                                <input
                                    name="descripcion"
                                    value={form.descripcion}
                                    onChange={onChange}
                                    autoComplete="off"
                                    required
                                    disabled={busy}
                                />
                            </label>

                            <label>
                                <span>Precio Costo</span>
                                <input
                                    name="precioCosto"
                                    value={form.precioCosto}
                                    onChange={onChange}
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    disabled={busy}
                                />
                            </label>

                            <label>
                                <span>Precio Venta</span>
                                <input
                                    name="precio"
                                    value={form.precio}
                                    onChange={onChange}
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    disabled={busy}
                                />
                            </label>

                            <label>
                                <span>Cantidad</span>
                                <input
                                    name="cantidad"
                                    value={form.cantidad}
                                    onChange={onChangeCantidad}
                                    inputMode="numeric"
                                    pattern="\d*"
                                    placeholder="0"
                                    disabled={busy}
                                />
                            </label>

                            <div className="modal-actions span-2">
                                <button type="button" className="btn-light cancelar" onClick={closeModal} disabled={busy}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={busy}>
                                    {isSaving ? 'Guardando…' : editMode ? 'Guardar cambios' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventario;
