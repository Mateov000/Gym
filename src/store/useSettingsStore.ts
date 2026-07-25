import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  showQuickCompleteButton: boolean
  setShowQuickCompleteButton: (val: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showQuickCompleteButton: true, // Activado por defecto
      setShowQuickCompleteButton: (val) => set({ showQuickCompleteButton: val }),
    }),
    {
      name: 'app-settings', // Se guarda en el almacenamiento del dispositivo
    }
  )
)