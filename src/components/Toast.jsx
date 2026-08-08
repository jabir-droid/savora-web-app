import React, { useEffect, useState } from 'react';

export default function Toast({ toast, onRemove }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onRemove();
    }, 300); // Wait for exit animation
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <i className="fa-solid fa-circle-check text-emerald-500 text-lg"></i>;
      case 'error':
        return <i className="fa-solid fa-circle-exclamation text-rose-500 text-lg"></i>;
      case 'info':
        return <i className="fa-solid fa-circle-info text-blue-500 text-lg"></i>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 bg-white p-4 rounded-xl shadow-lg border border-slate-100 min-w-[300px] w-full md:w-auto md:min-w-[300px] max-w-sm transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 md:translate-x-0 opacity-100 scale-100' : '-translate-y-4 md:-translate-y-0 md:translate-x-8 opacity-0 scale-95'
      }`}
    >
      <div className="shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">{toast.type === 'success' ? 'Berhasil' : toast.type === 'error' ? 'Gagal' : 'Informasi'}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{toast.message}</p>
      </div>
      <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition shrink-0 p-1">
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}
