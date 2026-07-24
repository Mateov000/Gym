import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Exercise, LoggedSet, WorkoutExercise, WorkoutSessionOptions } from '../types/workout'

interface ActiveSession {
  start_time: string
  routine_id?: string | null
  routine_day_id?: string | null
  disable_prs?: boolean
  config?: WorkoutSessionOptions['config']
}

interface WorkoutStore {
  activeSession: ActiveSession | null
  isResting: boolean
  workoutExercises: WorkoutExercise[]

  startSession: (options?: WorkoutSessionOptions) => void
  addExercise: (exercise: Exercise, meta?: WorkoutExercise['meta']) => void
  replaceExercise: (fromExerciseId: string, toExercise: Exercise) => void
  addSet: (exerciseId: string, weight: number, reps: number, setMeta?: LoggedSet) => void
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
      startSession: (options) => set({
        activeSession: {
          start_time: new Date().toISOString(),
          routine_id: options?.routine_id ?? null,
          routine_day_id: options?.routine_day_id ?? null,
          disable_prs: options?.disable_prs ?? false,
          config: options?.config ?? null,
        },
        workoutExercises: [] 
      }),

      // Agrega un ejercicio nuevo al entrenamiento
      addExercise: (exercise, meta) => set((state) => {
        // Verificamos que no esté ya en la lista para no duplicarlo
        const exists = state.workoutExercises.find((item) => {
          if (meta?.routine_exercise_id && item.meta?.routine_exercise_id) {
            return item.meta.routine_exercise_id === meta.routine_exercise_id
          }
          return item.exercise.id === exercise.id
        })
        if (exists) return state;
        
        return { 
          workoutExercises: [...state.workoutExercises, { exercise, sets: [], meta }] 
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
      addSet: (exerciseId, weight, reps, setMeta) => set((state) => ({
        workoutExercises: state.workoutExercises.map(item => 
          item.exercise.id === exerciseId 
            ? { ...item, sets: [...item.sets, { weight, reps, ...setMeta } as LoggedSet] }
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