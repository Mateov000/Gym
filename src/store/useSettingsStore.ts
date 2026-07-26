import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  showQuickCompleteButton: boolean
  setShowQuickCompleteButton: (val: boolean) => void
  
  // ---> NUEVO: Memoria de Unidades y Notas <---
  unitEquivalencies: Record<string, number>
  setUnitEquivalency: (unit: string, valueInKg: number) => void
  removeUnitEquivalency: (unit: string) => void
  
  routineNotes: Record<string, string>
  setRoutineNote: (routineExId: string, note: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showQuickCompleteButton: true,
      setShowQuickCompleteButton: (val) => set({ showQuickCompleteButton: val }),
      
      unitEquivalencies: {},
      setUnitEquivalency: (unit, value) => 
        set((state) => ({ unitEquivalencies: { ...state.unitEquivalencies, [unit]: value } })),
      removeUnitEquivalency: (unit) => 
        set((state) => {
          const newEq = { ...state.unitEquivalencies }
          delete newEq[unit]
          return { unitEquivalencies: newEq }
        }),

      routineNotes: {},
      setRoutineNote: (routineExId, note) =>
        set((state) => ({ routineNotes: { ...state.routineNotes, [routineExId]: note } })),
    }),
    {
      name: 'app-settings',
    }
  )
)