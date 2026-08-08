import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function AboutModal({ isOpen, onClose }) {
  const { t } = useLanguage()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-circle-info text-slate-400"></i>
            {t('settings.about') || 'Tentang Savora'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-savora-800 rounded-3xl flex items-center justify-center text-savora-orange shadow-lg shadow-savora-800/20 mb-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent"></div>
            <i className="fa-solid fa-robot text-3xl relative z-10"></i>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Savora AI</h2>
          <p className="text-sm text-slate-500 mt-3 max-w-[250px] leading-relaxed">
            {t('settings.about_desc') || 'Aplikasi pencatatan keuangan cerdas dengan integrasi AI (LLaMA 3) untuk analisis dan kemudahan Anda.'}
          </p>
          
          <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-8 text-left space-y-3.5 shadow-inner">
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Versi</span>
              <span className="text-xs font-bold text-slate-700">{t('settings.about_version') || '1.0.0 (AI Edition)'}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200/60 pb-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Developer</span>
              <span className="text-xs font-bold text-slate-700">{t('settings.about_dev') || 'Dikembangkan oleh Anda'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mesin AI</span>
              <span className="text-[10px] font-bold text-savora-orange bg-savora-orange/10 px-2.5 py-1 rounded-md border border-savora-orange/20">LLaMA 3 (Groq API)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
