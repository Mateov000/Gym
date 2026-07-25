import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutSessionOptions, WorkoutExercise, Exercise, LoggedSet } from '../types/workout'

interface WorkoutStore {
  activeSession: (WorkoutSessionOptions & { start_time: string }) | null
  workoutExercises: WorkoutExercise[]
  restEndsAt: number | null
  isResting: boolean 
  startSession: (options: WorkoutSessionOptions) => void
  startRoutine: (routine: any, day: any) => void // <-- NUEVO: Función para iniciar rutinas
  addExercise: (exercise: Exercise, meta?: WorkoutExercise['meta']) => void
  replaceExercise: (oldExerciseId: string, newExercise: Exercise) => void
  removeExercise: (exerciseId: string) => void
  addSet: (exerciseId: string, weight: number, reps: number, meta?: Partial<LoggedSet>) => void
  completeSet: (restTimeSeconds?: number) => void
  removeSet: (exerciseId: string, setIndex: number) => void
  updateSet: (exerciseId: string, setIndex: number, weight: number, reps: number) => void
  stopRest: () => void 
  clearRestTimer: () => void
  clearSession: () => void
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      activeSession: null,
      workoutExercises: [],
      restEndsAt: null,
      isResting: false,

      startSession: (options) =>
        set({
          activeSession: { ...options, start_time: new Date().toISOString() },
          workoutExercises: [],
          restEndsAt: null,
          isResting: false,
        }),

      // ---> NUEVO: Lógica para cargar una rutina armada en el entrenamiento <---
      startRoutine: (routine, day) =>
        set(() => {
          // Soportamos las dos formas en que puede venir la info de la base de datos
          const rawExercises = day.routine_exercises || day.exercises || []
          
          const loadedExercises = rawExercises.map((rx: any) => {
            const exercise = rx.exercise || rx
            // Buscamos las reps objetivo configuradas (o ponemos 10 por defecto)
            const targetReps = rx.target_reps || rx.config?.sets_config?.[0]?.reps || 10
            
            return {
              exercise,
              sets: [],
              meta: {
                set_type: 'normal',
                default_reps: targetReps,
                default_weight: 0
              }
            }
          })

          return {
            // Nombramos la sesión con el formato "Rutina - Día"
            activeSession: { 
              name: `${routine.name} - ${day.name}`,
              start_time: new Date().toISOString() 
            },
            workoutExercises: loadedExercises,
            restEndsAt: null,
            isResting: false
          }
        }),

      addExercise: (exercise, meta) =>
        set((state) => ({
          workoutExercises: [
            ...state.workoutExercises,
            { exercise, sets: [], meta },
          ],
        })),

      replaceExercise: (oldId, newExercise) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.map((ex) =>
            ex.exercise.id === oldId
              ? { ...ex, exercise: newExercise }
              : ex
          ),
        })),

      removeExercise: (exerciseId) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.filter(
            (ex) => ex.exercise.id !== exerciseId
          ),
        })),

      addSet: (exerciseId, weight, reps, meta) =>
        set((state) => {
          const updated = state.workoutExercises.map((ex) => {
            if (ex.exercise.id === exerciseId) {
              return {
                ...ex,
                sets: [...ex.sets, { weight, reps, ...meta } as LoggedSet],
              }
            }
            return ex
          })
          return { workoutExercises: updated }
        }),

      completeSet: (restTimeSeconds = 90) =>
        set({ 
          restEndsAt: Date.now() + restTimeSeconds * 1000,
          isResting: true 
        }),

      removeSet: (exerciseId, setIndex) =>
        set((state) => {
          const updated = state.workoutExercises.map((ex) => {
            if (ex.exercise.id === exerciseId) {
              const newSets = [...ex.sets]
              newSets.splice(setIndex, 1)
              return { ...ex, sets: newSets }
            }
            return ex
          })
          return { workoutExercises: updated }
        }),

      updateSet: (exerciseId, setIndex, weight, reps) =>
        set((state) => {
          const updated = state.workoutExercises.map((ex) => {
            if (ex.exercise.id === exerciseId) {
              const newSets = [...ex.sets]
              newSets[setIndex] = { ...newSets[setIndex], weight, reps }
              return { ...ex, sets: newSets }
            }
            return ex
          })
          return { workoutExercises: updated }
        }),

      stopRest: () => set({ isResting: false, restEndsAt: null }),
      clearRestTimer: () => set({ isResting: false, restEndsAt: null }),

      clearSession: () =>
        set({ activeSession: null, workoutExercises: [], restEndsAt: null, isResting: false }),
    }),
    {
      name: 'workout-storage',
    }
  )
)
