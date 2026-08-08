import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { triggerHaptic } from '../../utils/haptics'
import { useToast } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

export default function EditProfileModal({ isOpen, onClose, onSuccess, initialName, initialAvatar }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  
  const [displayName, setDisplayName] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setDisplayName(initialName || '')
      setAvatarPreview(initialAvatar || '')
    }
  }, [isOpen, initialName, initialAvatar])

  if (!isOpen) return null

  const handleClose = () => {
    if (!isSaving) onClose()
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Resize image to base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 150
        const MAX_HEIGHT = 150
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7) // 70% quality jpeg
        setAvatarPreview(dataUrl)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          display_name: displayName,
          avatar_url: avatarPreview
        }
      })
      if (error) throw error
      showToast(t('settings.profile_save_success') || 'Profil berhasil disimpan', 'success')
      triggerHaptic([50])
      onSuccess(displayName, avatarPreview)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col animate-slide-up">
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{t('settings.profile') || 'Edit Profil'}</h3>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center gap-6">
          <div className="relative group cursor-pointer" onClick={handleImageClick}>
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-savora-800 to-emerald-500 p-1 shadow-lg shadow-emerald-500/20">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full rounded-full object-cover border-2 border-white bg-white" />
              ) : (
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl font-bold text-savora-800 border-2 border-white">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fa-solid fa-camera text-white text-xl"></i>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div className="w-full space-y-2">
            <label className="text-xs font-bold text-slate-600">{t('settings.profile_name_label') || 'Nama Tampilan'}</label>
            <input 
              type="text" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Nama Anda"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl transition shadow flex justify-center items-center gap-2"
          >
            {isSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-check"></i>}
            {t('settings.profile_save') || 'Simpan Profil'}
          </button>
        </div>
      </div>
    </div>
  )
}
