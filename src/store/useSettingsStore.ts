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
  
  // ---> NUEVO: Bóveda Global de Unidades Custom <---
  globalCustomUnits: string[]
  addGlobalCustomUnit: (unit: string) => void
  removeGlobalCustomUnit: (unit: string) => void

  // Grafo de Unidades Custom
  equivalencies: Equivalency[]
  addEquivalency: (from: string, to: string, multiplier: number) => void
  removeEquivalency: (id: string) => void
  
  // Memoria de Notas Persistentes
  routineNotes: Record<string, string>
  setRoutineNote: (routineExId: string, note: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showQuickCompleteButton: true,
      setShowQuickCompleteButton: (val) => set({ showQuickCompleteButton: val }),
      
      globalCustomUnits: [],
      addGlobalCustomUnit: (unit) => set((state) => {
        if (state.globalCustomUnits.includes(unit)) return state;
        return { globalCustomUnits: [...state.globalCustomUnits, unit] }
      }),
      removeGlobalCustomUnit: (unit) => set((state) => ({
        globalCustomUnits: state.globalCustomUnits.filter(u => u !== unit),
        // Si borramos la unidad, borramos también las equivalencias que dependían de ella
        equivalencies: state.equivalencies.filter(eq => eq.from !== unit && eq.to !== unit)
      })),

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