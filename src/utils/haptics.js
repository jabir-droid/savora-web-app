import { settingsService } from '../services/settingsService'

export const triggerHaptic = async (pattern = [50]) => {
  try {
    const s = await settingsService.getSettings()
    if (s && s.haptic_enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  } catch (e) {
    // Abaikan jika tidak didukung
  }
}
