import React from 'react';
import './Loader.css';

export default function Loader({ open, text = 'Cargando…' }) {
  if (!open) return null;
  return (
    <div className="ui-loader-overlay" role="status" aria-live="polite">
      <div className="ui-loader-spinner" />
      <p className="ui-loader-text">{text}</p>
    </div>
  );
}
