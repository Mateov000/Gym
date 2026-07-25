import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutSessionOptions, WorkoutExercise, Exercise, LoggedSet } from '../types/workout'

interface WorkoutStore {
  activeSession: (WorkoutSessionOptions & { start_time: string; name?: string }) | null
  workoutExercises: WorkoutExercise[]
  restEndsAt: number | null
  isResting: boolean 
  startSession: (options: WorkoutSessionOptions) => void
  startRoutine: (routine: any, day: any) => void
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

      startRoutine: (routine, day) =>
        set(() => {
          const rawExercises = day.routine_exercises || day.exercises || []
          
          const loadedExercises = rawExercises.map((rx: any) => {
            const baseExercise = rx.exercise || rx
            // Normalizamos el ID para que nunca sea undefined
            const realId = baseExercise.id || baseExercise.exercise_id || rx.exercise_id
            const targetReps = rx.target_reps || rx.config?.sets_config?.[0]?.reps || 10
            
            return {
              exercise: {
                ...baseExercise,
                id: realId,
              },
              sets: [],
              meta: {
                routine_exercise_id: rx.id || rx.routine_exercise_id,
                set_type: 'normal',
                default_reps: targetReps,
                default_weight: 0
              }
            }
          })

          return {
            activeSession: { 
              name: `${routine.name} - ${day.name}`,
              routine_id: routine.id,
              routine_day_id: day.id,
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
