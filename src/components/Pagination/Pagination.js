// components/Pagination/Pagination.jsx
import React from 'react';
import './Pagination.css';

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handlePrevious = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="pagination-footer">
      <button onClick={handlePrevious} disabled={currentPage === 1}>
        ◀
      </button>
      <span>
        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
      </span>
      <button onClick={handleNext} disabled={currentPage === totalPages}>
        ▶
      </button>
    </div>
  );
};

export default Pagination;
