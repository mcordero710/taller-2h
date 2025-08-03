import React, { useState, useEffect } from 'react';
import './Factura.css';
import { db } from '../firebase/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
} from 'firebase/firestore';
import html2pdf from 'html2pdf.js';

const Factura = () => {
    const [numeroProforma, setNumeroProforma] = useState('');
    const [proforma, setProforma] = useState(null);
    const [abono, setAbono] = useState('');
    const [abonos, setAbonos] = useState([]);

    const buscarProforma = async () => {
        const q = query(collection(db, 'proformas'), where('numero', '==', parseInt(numeroProforma)));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docRef = snapshot.docs[0];
            const data = docRef.data();
            setProforma({ id: docRef.id, ...data });
            cargarAbonos(docRef.id);
        } else {
            setProforma(null);
            setAbonos([]);
        }
    };

    const cargarAbonos = async (proformaId) => {
        const q = query(collection(db, 'abonos'), where('proformaId', '==', proformaId));
        const snapshot = await getDocs(q);
        const resultados = snapshot.docs.map(doc => doc.data());
        setAbonos(resultados);
    };

    const calcularSaldo = () => {
        const totalAbonado = abonos.reduce((sum, a) => sum + a.monto, 0);
        return proforma.total - totalAbonado;
    };

    const ingresarAbono = async () => {
        if (!abono || isNaN(abono)) return;

        const saldo = calcularSaldo();
        if (saldo <= 0) {
            alert('La factura ya está saldada. No se pueden ingresar más abonos.');
            return;
        }

        const nuevoAbono = {
            proformaId: proforma.id,
            monto: parseInt(abono),
            fecha: new Date().toLocaleDateString(),
        };

        await addDoc(collection(db, 'abonos'), nuevoAbono);
        await cargarAbonos(proforma.id);
        setAbono('');
    };


    const descargarPDF = () => {
        const element = document.getElementById('factura-pdf');
        html2pdf().from(element).save(`Factura-Proforma-${numeroProforma}.pdf`);
    };

    return (
        <div className="factura-wrapper">
            <h2 className="factura-header">Registro de Abonos</h2>

            <div className="factura-busqueda">
                <label>Número de Proforma</label>
                <input
                    type="text"
                    value={numeroProforma}
                    onChange={(e) => setNumeroProforma(e.target.value)}
                />
                <button onClick={buscarProforma}>Buscar</button>
            </div>

            {proforma && (
                <div id="factura-pdf" className="factura-info">
                    <table>
                        <thead>
                            <tr>
                                <th>Total Proforma</th>
                                <th>Abonado</th>
                                <th>Saldo Pendiente</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{proforma.total}</td>
                                <td>{abonos.reduce((sum, a) => sum + a.monto, 0)}</td>
                                <td>{calcularSaldo()}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="factura-abono">
                        <input
                            type="number"
                            placeholder="Monto del abono"
                            value={abono}
                            onChange={(e) => setAbono(e.target.value)}
                            disabled={calcularSaldo() <= 0}
                        />
                        <button
                            onClick={ingresarAbono}
                            disabled={calcularSaldo() <= 0}
                        >
                            Ingresar Abono
                        </button>
                    </div>


                    <button className="btn-descargar" onClick={descargarPDF}>
                        Descargar PDF
                    </button>

                    {abonos.length > 0 && (
                        <div className="historial-abonos">
                            <h3>Historial de Abonos</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {abonos.map((abono, index) => (
                                        <tr key={index}>
                                            <td>{abono.fecha}</td>
                                            <td>{abono.monto.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}


                    {calcularSaldo() === 0 && (
                        <div className="firma-cliente">
                            <label>Firma</label>
                            <div className="linea-firma" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Factura;
