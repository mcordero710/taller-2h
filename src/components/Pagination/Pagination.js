// components/Pagination/Pagination.jsx
import React, { useMemo } from 'react';
import './Pagination.css';

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage || 0));

  const goTo = (p) => {
    if (p < 1 || p > totalPages || p === currentPage) return;
    onPageChange(p);
  };

  // Rango con elipsis: 1 … (c-1) c (c+1) … N
  const pages = useMemo(() => {
    const sib = 1; // cantidad de páginas vecinas a mostrar
    const range = [];
    const push = (v) => range.push(v);

    const first = 1;
    const last = totalPages;

    const start = Math.max(first, currentPage - sib);
    const end   = Math.min(last, currentPage + sib);

    // Siempre mostrar primera
    push(first);

    // Elipsis izquierda
    if (start > first + 1) push('…');

    // Centro
    for (let p = start; p <= end; p++) {
      if (p !== first && p !== last) push(p);
    }

    // Elipsis derecha
    if (end < last - 1) push('…');

    // Siempre mostrar última si hay más de 1 página
    if (last > first) push(last);

    // Deduplicar por si totalPages es 1
    return range.filter((v, i) => range.indexOf(v) === i);
  }, [currentPage, totalPages]);

  const disabledPrev = currentPage <= 1;
  const disabledNext = currentPage >= totalPages;

  return (
    <div className="pagination-footer">
      <nav className="pager" role="navigation" aria-label="Paginación">
        <button
          className="pager-btn pager-first"
          onClick={() => goTo(1)}
          disabled={disabledPrev}
          aria-label="Primera página"
        >
          «
        </button>
        <button
          className="pager-btn pager-prev"
          onClick={() => goTo(currentPage - 1)}
          disabled={disabledPrev}
          aria-label="Página anterior"
        >
          ‹
        </button>

        <ul className="pager-list">
          {pages.map((p, idx) =>
            p === '…' ? (
              <li key={`e-${idx}`} className="pager-ellipsis" aria-hidden>…</li>
            ) : (
              <li key={p}>
                <button
                  className={`pager-btn pager-number ${p === currentPage ? 'is-active' : ''}`}
                  onClick={() => goTo(p)}
                  aria-current={p === currentPage ? 'page' : undefined}
                  aria-label={`Ir a la página ${p}`}
                >
                  {p}
                </button>
              </li>
            )
          )}
        </ul>

        <button
          className="pager-btn pager-next"
          onClick={() => goTo(currentPage + 1)}
          disabled={disabledNext}
          aria-label="Página siguiente"
        >
          ›
        </button>
        <button
          className="pager-btn pager-last"
          onClick={() => goTo(totalPages)}
          disabled={disabledNext}
          aria-label="Última página"
        >
          »
        </button>

        <span className="pager-info">
          Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
        </span>
      </nav>
    </div>
  );
};

export default Pagination;
