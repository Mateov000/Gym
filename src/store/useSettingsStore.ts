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
  
  // Bóveda Global de Unidades Custom
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

  // ---> NUEVO: Memoria de la última unidad usada por ejercicio <---
  exerciseUnits: Record<string, string>
  setExerciseUnit: (routineExId: string, unit: string) => void
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

      // ---> NUEVO: Funciones para recordar unidades <---
      exerciseUnits: {},
      setExerciseUnit: (routineExId, unit) =>
        set((state) => ({ exerciseUnits: { ...state.exerciseUnits, [routineExId]: unit } })),
    }),
    {
      name: 'app-settings',
    }
  )
)