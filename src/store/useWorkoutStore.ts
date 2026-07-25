import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutSessionOptions, WorkoutExercise, Exercise, LoggedSet } from '../types/workout'

interface WorkoutStore {
  activeSession: (WorkoutSessionOptions & { start_time: string }) | null
  workoutExercises: WorkoutExercise[]
  restEndsAt: number | null
  startSession: (options: WorkoutSessionOptions) => void
  addExercise: (exercise: Exercise, meta?: WorkoutExercise['meta']) => void
  replaceExercise: (oldExerciseId: string, newExercise: Exercise) => void
  removeExercise: (exerciseId: string) => void
  addSet: (exerciseId: string, weight: number, reps: number, meta?: Partial<LoggedSet>) => void
  completeSet: (restTimeSeconds?: number) => void
  removeSet: (exerciseId: string, setIndex: number) => void
  updateSet: (exerciseId: string, setIndex: number, weight: number, reps: number) => void // <-- NUEVA FUNCIÓN
  clearRestTimer: () => void
  clearSession: () => void
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      activeSession: null,
      workoutExercises: [],
      restEndsAt: null,

      startSession: (options) =>
        set({
          activeSession: { ...options, start_time: new Date().toISOString() },
          workoutExercises: [],
          restEndsAt: null,
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
        set({ restEndsAt: Date.now() + restTimeSeconds * 1000 }),

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

      // ---> NUEVA LÓGICA DE EDICIÓN <---
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

      clearRestTimer: () => set({ restEndsAt: null }),

      clearSession: () =>
        set({ activeSession: null, workoutExercises: [], restEndsAt: null }),
    }),
    {
      name: 'workout-storage',
    }
  )
)