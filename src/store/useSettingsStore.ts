import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Equivalency {
  id: string
  from: string
  to: string
  multiplier: number
}

interface SettingsStore {
  showQuickCompleteButton: boolean
  setShowQuickCompleteButton: (val: boolean) => void
  
  // ---> NUEVO: Grafo de Unidades Custom <---
  equivalencies: Equivalency[]
  addEquivalency: (from: string, to: string, multiplier: number) => void
  removeEquivalency: (id: string) => void
  
  // ---> NUEVO: Memoria de Notas Persistentes <---
  routineNotes: Record<string, string>
  setRoutineNote: (routineExId: string, note: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showQuickCompleteButton: true,
      setShowQuickCompleteButton: (val) => set({ showQuickCompleteButton: val }),
      
      equivalencies: [],
      addEquivalency: (from, to, multiplier) => 
        set((state) => ({
          equivalencies: [
            ...state.equivalencies, 
            { id: crypto.randomUUID(), from, to, multiplier }
          ]
        })),
      removeEquivalency: (id) => 
        set((state) => ({
          equivalencies: state.equivalencies.filter(eq => eq.id !== id)
        })),

      routineNotes: {},
      setRoutineNote: (routineExId, note) =>
        set((state) => ({ routineNotes: { ...state.routineNotes, [routineExId]: note } })),
    }),
    {
      name: 'app-settings',
    }
  )
)