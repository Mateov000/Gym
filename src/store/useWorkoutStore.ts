import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Exercise, LoggedSet, WorkoutExercise } from '../types/workout'

interface ActiveSession {
  start_time: string
}

interface WorkoutStore {
  activeSession: ActiveSession | null
  isResting: boolean
  workoutExercises: WorkoutExercise[]

  startSession: () => void
  addExercise: (exercise: Exercise) => void
  replaceExercise: (fromExerciseId: string, toExercise: Exercise) => void
  addSet: (exerciseId: string, weight: number, reps: number) => void
  completeSet: () => void
  clearSession: () => void
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      activeSession: null,
      isResting: false,
      workoutExercises: [],

      // Inicia una sesión limpia
      startSession: () => set({ 
        activeSession: { start_time: new Date().toISOString() },
        workoutExercises: [] 
      }),

      // Agrega un ejercicio nuevo al entrenamiento
      addExercise: (exercise) => set((state) => {
        // Verificamos que no esté ya en la lista para no duplicarlo
        const exists = state.workoutExercises.find(e => e.exercise.id === exercise.id);
        if (exists) return state;
        
        return { 
          workoutExercises: [...state.workoutExercises, { exercise, sets: [] }] 
        };
      }),

      replaceExercise: (fromExerciseId, toExercise) => set((state) => ({
        workoutExercises: state.workoutExercises.map((item) =>
          item.exercise.id === fromExerciseId
            ? { ...item, exercise: toExercise }
            : item,
        ),
      })),

      // Agrega una serie a un ejercicio específico
      addSet: (exerciseId, weight, reps) => set((state) => ({
        workoutExercises: state.workoutExercises.map(item => 
          item.exercise.id === exerciseId 
            ? { ...item, sets: [...item.sets, { weight, reps } as LoggedSet] }
            : item
        )
      })),

      // Activa el temporizador
      completeSet: () => set({ isResting: true }),

      // Limpia todo al terminar
      clearSession: () => set({ 
        activeSession: null, 
        isResting: false, 
        workoutExercises: [] 
      })
    }),
    { name: 'workout-storage' }
  )
)