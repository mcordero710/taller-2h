import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './DetalleProforma.css';
import { FiChevronLeft } from 'react-icons/fi'; // 👈 usa react-icons

const DetalleProforma = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const proforma = location.state?.proforma;

  if (!proforma) {
    return <p>No se proporcionó información de la proforma.</p>;
  }

  // Asegura que vehiculo exista y usa fallback “—” en campos faltantes
  const vehiculo = proforma.vehiculo || {};

  const redirigirAProforma = () => {
    navigate('/proforma', { state: { proforma } });
  };

  // 👇 NUEVO: volver preservando resultados del buscador
  const volverAResultados = () => {
    const back = location.state?.backTo;
    if (back?.route) {
      navigate(back.route, {
        state: {
          restored: {
            buscar: back.buscar,
            proformas: back.proformas,
          },
        },
      });
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="detalle-proforma-page">
      <div className="detalle-proforma-wrapper">
        <div className="detalle-proforma-topbar">
          <button
            className="back-icon-btn"
            onClick={volverAResultados}
            aria-label="Volver a resultados"
            title="Volver a resultados"
          >
            <FiChevronLeft />
          </button>
        </div>

        <h2>Detalle del Vehículo</h2>
        <ul>
          <li><strong>Placa:</strong> {vehiculo.placa ?? '—'}</li>
          <li><strong>Marca:</strong> {vehiculo.marca ?? '—'}</li>
          <li><strong>Modelo:</strong> {vehiculo.modelo ?? '—'}</li>
          <li><strong>Año:</strong> {vehiculo.anio ?? '—'}</li>
          <li><strong>Color:</strong> {vehiculo.color ?? '—'}</li>
        </ul>

        <button className="boton-principal" onClick={redirigirAProforma}>
          Editar o Imprimir Proforma
        </button>
      </div>
    </div>
  );
};

export default DetalleProforma;
