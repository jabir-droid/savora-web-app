import React, { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

export default function Help({ setActiveTab }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [openFaq, setOpenFaq] = useState(1)
  const [activeGuide, setActiveGuide] = useState(null)

  const toggleFaq = (id) => {
    if (openFaq === id) {
      setOpenFaq(null)
    } else {
      setOpenFaq(id)
    }
  }

  const openGuideModal = (id) => {
    setActiveGuide(id)
  }

  const closeGuideModal = () => {
    setActiveGuide(null)
  }

  return (
    <section className="space-y-6 animate-fade-in relative">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN - FAQ & Panduan */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
            <h3 className="font-bold text-lg text-slate-800 mb-4">{t('help.faq.title')}</h3>
            
            <div className="space-y-3">
              {/* FAQ 1 */}
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                <button 
                  onClick={() => toggleFaq(1)}
                  className="w-full flex items-center justify-between p-4 text-left font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  <span className="text-sm">{t('help.faq.1.q')}</span>
                  <i className={`fa-solid fa-chevron-${openFaq === 1 ? 'up' : 'down'} text-slate-400 text-xs transition-transform`}></i>
                </button>
                {openFaq === 1 && (
                  <div className="p-4 pt-0 text-xs text-slate-500 leading-relaxed">
                    {t('help.faq.1.a')}
                  </div>
                )}
              </div>

              {/* FAQ 2 */}
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                <button 
                  onClick={() => toggleFaq(2)}
                  className="w-full flex items-center justify-between p-4 text-left font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  <span className="text-sm">{t('help.faq.2.q')}</span>
                  <i className={`fa-solid fa-chevron-${openFaq === 2 ? 'up' : 'down'} text-slate-400 text-xs transition-transform`}></i>
                </button>
                {openFaq === 2 && (
                  <div className="p-4 pt-0 text-xs text-slate-500 leading-relaxed">
                    {t('help.faq.2.a')}
                  </div>
                )}
              </div>
            </div>

            <h3 className="font-bold text-lg text-slate-800 mt-8 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-book-open text-savora-orange"></i> {t('help.guide.title')}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => openGuideModal('ocr')} className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl flex items-center justify-between hover:border-savora-200 hover:shadow-sm cursor-pointer transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-savora-orange flex items-center justify-center text-xs">
                    <i className="fa-solid fa-camera"></i>
                  </div>
                  <span className="font-bold text-xs text-slate-700">{t('help.guide.ocr')}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{t('help.guide.read')} <i className="fa-solid fa-arrow-right ml-1"></i></span>
              </div>

              <div onClick={() => openGuideModal('ai')} className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl flex items-center justify-between hover:border-savora-200 hover:shadow-sm cursor-pointer transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-savora-orange flex items-center justify-center text-xs">
                    <i className="fa-solid fa-robot"></i>
                  </div>
                  <span className="font-bold text-xs text-slate-700">{t('help.guide.ai')}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{t('help.guide.read')} <i className="fa-solid fa-arrow-right ml-1"></i></span>
              </div>

              <div onClick={() => openGuideModal('savings')} className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl flex items-center justify-between hover:border-savora-200 hover:shadow-sm cursor-pointer transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-savora-orange flex items-center justify-center text-xs">
                    <i className="fa-solid fa-piggy-bank"></i>
                  </div>
                  <span className="font-bold text-xs text-slate-700">{t('help.guide.savings')}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{t('help.guide.read')} <i className="fa-solid fa-arrow-right ml-1"></i></span>
              </div>

              <div onClick={() => openGuideModal('limits')} className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl flex items-center justify-between hover:border-savora-200 hover:shadow-sm cursor-pointer transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-savora-orange flex items-center justify-center text-xs">
                    <i className="fa-solid fa-bell"></i>
                  </div>
                  <span className="font-bold text-xs text-slate-700">{t('help.guide.limits')}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{t('help.guide.read')} <i className="fa-solid fa-arrow-right ml-1"></i></span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Dukungan Form */}
        <div className="bg-slate-800 rounded-3xl p-6 shadow-sm flex flex-col text-white overflow-hidden relative h-fit border-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-bl-full opacity-10"></div>
          
          <div className="flex items-start justify-between mb-6 relative z-10">
            <div>
              <h3 className="font-bold text-lg text-emerald-400">{t('help.support.title')}</h3>
              <p className="text-xs text-slate-300 mt-1">{t('help.support.desc')}</p>
            </div>
            <button onClick={() => showToast(t('help.support.track_msg'), 'info')} className="bg-slate-900/50 text-emerald-400 border border-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-slate-700 transition">
              <i className="fa-solid fa-magnifying-glass"></i> {t('help.support.track')}
            </button>
          </div>

          <form className="space-y-4 relative z-10" onSubmit={(e) => { e.preventDefault(); showToast(t('help.support.send_msg'), 'success') }}>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t('help.support.name')}</label>
              <input type="text" required placeholder="Contoh: Budi Prasetyo" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t('help.support.email')} <span className="text-emerald-500">*</span></label>
              <input type="email" required placeholder="Contoh: budi@gmail.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t('help.support.problem')}</label>
              <textarea required rows="4" placeholder="Jelaskan pertanyaan Anda secara mendalam..." className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"></textarea>
            </div>

            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition shadow-md">
              {t('help.support.send')}
            </button>
          </form>
        </div>

      </div>

      {/* Guide Pop-up Modal */}
      {activeGuide === 'ocr' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeGuideModal}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-[480px] shadow-2xl p-6 md:p-8 border border-slate-200 animate-fade-in">
            
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-savora-orange text-xl shrink-0">
                  <i className="fa-solid fa-camera"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">{t('help.modal.ocr.title')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{t('help.modal.ocr.tag')}</p>
                </div>
              </div>
              <button onClick={closeGuideModal} className="text-slate-400 hover:text-slate-600 transition p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="text-[13px] text-slate-600 leading-relaxed mb-8 space-y-5">
              <p>{t('help.modal.ocr.desc')}</p>
              
              <div>
                <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider mb-3">{t('help.modal.how_to')}</h4>
                <ol className="list-decimal list-outside ml-4 space-y-2 text-slate-600">
                  <li>{t('help.modal.ocr.step1')}</li>
                  <li>{t('help.modal.ocr.step2')}</li>
                  <li>{t('help.modal.ocr.step3')}</li>
                </ol>
              </div>

              <div className="bg-orange-50/80 border border-orange-100 rounded-xl p-4 text-[13px] text-slate-600 mt-2">
                <p><i className="fa-regular fa-lightbulb text-savora-orange mr-1.5"></i> {t('help.modal.ocr.tips')}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setActiveTab('dashboard'); closeGuideModal(); }} className="flex-[3] bg-[#3b5973] hover:bg-[#2c4357] text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm">
                <i className="fa-solid fa-camera"></i> {t('help.btn.ocr')}
              </button>
              <button onClick={closeGuideModal} className="flex-[2] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm">
                {t('help.modal.btn_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Fallback Modal for other guides */}
      {activeGuide && !['ocr', 'ai', 'savings', 'limits'].includes(activeGuide) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeGuideModal}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-savora-orange">
                  <i className="fa-solid fa-book-open"></i>
                </div>
                <h3 className="font-bold text-lg text-slate-800">{t('help.guide.title')}</h3>
              </div>
              <button onClick={closeGuideModal} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-600 leading-relaxed mb-6">
              {t('help.desc')}
            </div>

            <button onClick={closeGuideModal} className="w-full bg-[#1e293b] hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition shadow-md">
              {t('help.modal.btn_understand')}
            </button>
          </div>
        </div>
      )}

      {/* Perintah Savora AI Chat Modal */}
      {activeGuide === 'ai' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeGuideModal}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-[480px] shadow-2xl p-6 md:p-8 border border-slate-200 animate-fade-in">
            
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-savora-orange text-xl shrink-0">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">{t('help.modal.ai.title')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{t('help.modal.ocr.tag')}</p>
                </div>
              </div>
              <button onClick={closeGuideModal} className="text-slate-400 hover:text-slate-600 transition p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="text-[13px] text-slate-600 leading-relaxed mb-8 space-y-5">
              <p>{t('help.modal.ai.desc')}</p>
              
              <div>
                <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider mb-3">{t('help.modal.how_to')}</h4>
                <ol className="list-decimal list-outside ml-4 space-y-2 text-slate-600">
                  <li>{t('help.modal.ai.step1')}</li>
                  <li>{t('help.modal.ai.step2')}</li>
                  <li>{t('help.modal.ai.step3')}</li>
                </ol>
              </div>

              <div className="bg-orange-50/80 border border-orange-100 rounded-xl p-4 text-[13px] text-slate-600 mt-2">
                <p><i className="fa-regular fa-lightbulb text-savora-orange mr-1.5"></i> {t('help.modal.ai.tips')}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setActiveTab('ai_assistant'); closeGuideModal(); }} className="flex-[3] bg-[#3b5973] hover:bg-[#2c4357] text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm">
                <i className="fa-solid fa-robot"></i> {t('help.btn.ai')}
              </button>
              <button onClick={closeGuideModal} className="flex-[2] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm">
                {t('help.modal.btn_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rencana Saku Tabungan Modal */}
      {activeGuide === 'savings' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeGuideModal}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-[480px] shadow-2xl p-6 md:p-8 border border-slate-200 animate-fade-in">
            
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-savora-orange text-xl shrink-0">
                  <i className="fa-solid fa-piggy-bank"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">{t('help.modal.savings.title')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{t('help.modal.ocr.tag')}</p>
                </div>
              </div>
              <button onClick={closeGuideModal} className="text-slate-400 hover:text-slate-600 transition p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="text-[13px] text-slate-600 leading-relaxed mb-8 space-y-5">
              <p>{t('help.modal.savings.desc')}</p>
              
              <div>
                <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider mb-3">{t('help.modal.how_to')}</h4>
                <ol className="list-decimal list-outside ml-4 space-y-2 text-slate-600">
                  <li>{t('help.modal.savings.step1')}</li>
                  <li>{t('help.modal.savings.step2')}</li>
                  <li>{t('help.modal.savings.step3')}</li>
                </ol>
              </div>

              <div className="bg-orange-50/80 border border-orange-100 rounded-xl p-4 text-[13px] text-slate-600 mt-2">
                <p><i className="fa-regular fa-lightbulb text-savora-orange mr-1.5"></i> {t('help.modal.savings.tips')}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setActiveTab('savings'); closeGuideModal(); }} className="flex-[3] bg-[#3b5973] hover:bg-[#2c4357] text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm">
                <i className="fa-solid fa-piggy-bank"></i> {t('help.btn.savings')}
              </button>
              <button onClick={closeGuideModal} className="flex-[2] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm">
                {t('help.modal.btn_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batas Anggaran & Limit Modal */}
      {activeGuide === 'limits' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeGuideModal}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-[480px] shadow-2xl p-6 md:p-8 border border-slate-200 animate-fade-in">
            
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-savora-orange text-xl shrink-0">
                  <i className="fa-solid fa-bell"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">{t('help.modal.limits.title')}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{t('help.modal.ocr.tag')}</p>
                </div>
              </div>
              <button onClick={closeGuideModal} className="text-slate-400 hover:text-slate-600 transition p-1">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="text-[13px] text-slate-600 leading-relaxed mb-8 space-y-5">
              <p>{t('help.modal.limits.desc')}</p>
              
              <div>
                <h4 className="font-bold text-[11px] text-slate-800 uppercase tracking-wider mb-3">{t('help.modal.how_to')}</h4>
                <ol className="list-decimal list-outside ml-4 space-y-2 text-slate-600">
                  <li>{t('help.modal.limits.step1')}</li>
                  <li>{t('help.modal.limits.step2')}</li>
                  <li>{t('help.modal.limits.step3')}</li>
                </ol>
              </div>

              <div className="bg-orange-50/80 border border-orange-100 rounded-xl p-4 text-[13px] text-slate-600 mt-2">
                <p><i className="fa-regular fa-lightbulb text-savora-orange mr-1.5"></i> {t('help.modal.limits.tips')}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setActiveTab('categories'); closeGuideModal(); }} className="flex-[3] bg-[#3b5973] hover:bg-[#2c4357] text-white font-bold py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm">
                <i className="fa-solid fa-bell"></i> {t('help.btn.limits')}
              </button>
              <button onClick={closeGuideModal} className="flex-[2] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm">
                {t('help.modal.btn_close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
