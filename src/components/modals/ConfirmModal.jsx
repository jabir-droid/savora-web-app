import React from 'react'

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Konfirmasi', cancelText = 'Batal', type = 'danger' }) {
  if (!isOpen) return null

  const typeConfig = {
    danger: {
      icon: 'fa-triangle-exclamation',
      iconBg: 'bg-rose-100 text-rose-600',
      btnBg: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
    },
    warning: {
      icon: 'fa-circle-exclamation',
      iconBg: 'bg-amber-100 text-amber-600',
      btnBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
    },
    info: {
      icon: 'fa-circle-info',
      iconBg: 'bg-blue-100 text-blue-600',
      btnBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    }
  }

  const config = typeConfig[type] || typeConfig.danger

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-10 transform transition-all animate-fade-in-sm border border-slate-200/50">
        <div className="flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-4 ${config.iconBg}`}>
            <i className={`fa-solid ${config.icon}`}></i>
          </div>
          
          <h3 className="font-extrabold text-lg text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">{message}</p>
          
          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose}
              className="flex-1 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className={`flex-1 text-white font-bold py-2.5 px-4 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.btnBg}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
