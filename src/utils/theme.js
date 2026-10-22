// Mode Gelap (Fase 3): tema disimpan di localStorage 'savora_theme'
// ('dark' | 'light'). Tanpa pilihan tersimpan, mengikuti preferensi
// sistem. Kelas 'dark' pada <html> mengaktifkan lapisan penimpa
// di index.css; skrip kecil di index.html menerapkan kelas yang
// sama sebelum render pertama agar tidak ada kedip terang.
export const THEME_KEY = 'savora_theme'
export const THEME_EVENT = 'savora-theme-change'

export function currentTheme() {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* abaikan */ }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.classList.toggle('dark', next === 'dark')
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch { /* abaikan */ }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }))
  return next
}

export function toggleTheme() {
  return applyTheme(currentTheme() === 'dark' ? 'light' : 'dark')
}
