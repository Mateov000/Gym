import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Equivalency {
  id: string
  from: string
  to: string
  multiplier: number
}

// ---> NUEVO: Interfaz de Biometría <---
export interface BiometricEntry {
  id: string
  date: string
  weight: number
}

interface SettingsStore {
  showQuickCompleteButton: boolean
  setShowQuickCompleteButton: (val: boolean) => void
  
  enableRir: boolean
  setEnableRir: (val: boolean) => void

  globalCustomUnits: string[]
  addGlobalCustomUnit: (unit: string) => void
  removeGlobalCustomUnit: (unit: string) => void

  equivalencies: Equivalency[]
  addEquivalency: (from: string, to: string, multiplier: number) => void
  removeEquivalency: (id: string) => void
  
  routineNotes: Record<string, string>
  setRoutineNote: (routineExId: string, note: string) => void

  exerciseUnits: Record<string, string>
  setExerciseUnit: (routineExId: string, unit: string) => void

  subscribedRoutines: string[]
  addSubscribedRoutine: (id: string) => void
  removeSubscribedRoutine: (id: string) => void

  // ---> NUEVO: Funciones de Biometría <---
  biometrics: BiometricEntry[]
  addBiometric: (weight: number, date?: string) => void
  removeBiometric: (id: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showQuickCompleteButton: true,
      setShowQuickCompleteButton: (val) => set({ showQuickCompleteButton: val }),
      
      enableRir: false,
      setEnableRir: (val) => set({ enableRir: val }),
      
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

      exerciseUnits: {},
      setExerciseUnit: (routineExId, unit) =>
        set((state) => ({ exerciseUnits: { ...state.exerciseUnits, [routineExId]: unit } })),

      subscribedRoutines: [],
      addSubscribedRoutine: (id) => set((state) => ({
        subscribedRoutines: state.subscribedRoutines.includes(id) ? state.subscribedRoutines : [...state.subscribedRoutines, id]
      })),
      removeSubscribedRoutine: (id) => set((state) => ({
        subscribedRoutines: state.subscribedRoutines.filter(r => r !== id)
      })),

      // ---> NUEVO: Lógica de Biometría <---
      biometrics: [],
      addBiometric: (weight, date = new Date().toISOString()) => set((state) => ({
        biometrics: [...state.biometrics, { id: crypto.randomUUID(), date, weight }].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      })),
      removeBiometric: (id) => set((state) => ({
        biometrics: state.biometrics.filter(b => b.id !== id)
      })),
    }),
    {
      name: 'app-settings',
    }
  )
)