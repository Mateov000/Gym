import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkoutSessionOptions, WorkoutExercise, Exercise, LoggedSet, PendingSession } from '../types/workout'

interface WorkoutStore {
  activeSession: (WorkoutSessionOptions & { start_time: string; name?: string }) | null
  workoutExercises: WorkoutExercise[]
  sessionNotes: string
  restEndsAt: number | null
  isResting: boolean 
  
  // ---> NUEVO: Memoria de Sincronización <---
  pendingSync: PendingSession[]
  addPendingSession: (session: PendingSession) => void
  removePendingSession: (id: string) => void

  startSession: (options: WorkoutSessionOptions) => void
  startRoutine: (routine: any, day: any) => void
  adjustSessionStartTime: (deltaMinutes: number) => void 
  setSessionNotes: (notes: string) => void 

  addExercise: (exercise: Exercise, meta?: WorkoutExercise['meta']) => void
  replaceExercise: (oldExerciseId: string, newExercise: Exercise) => void
  removeExercise: (exerciseId: string) => void
  reorderExercises: (newList: WorkoutExercise[]) => void 
  updateExerciseUnit: (exerciseId: string, unit: string) => void 

  addSet: (exerciseId: string, weight: number, reps: number, meta?: Partial<LoggedSet>) => void
  updateSet: (exerciseId: string, setIndex: number, updates: Partial<LoggedSet>) => void
  removeSet: (exerciseId: string, setIndex: number) => void
  completeSet: (restTimeSeconds?: number) => void
  
  stopRest: () => void 
  clearRestTimer: () => void
  clearSession: () => void
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      activeSession: null,
      workoutExercises: [],
      sessionNotes: '',
      restEndsAt: null,
      isResting: false,

      // ---> NUEVO: Funciones de Sincronización <---
      pendingSync: [],
      addPendingSession: (session) => set((state) => ({ pendingSync: [...state.pendingSync, session] })),
      removePendingSession: (id) => set((state) => ({ pendingSync: state.pendingSync.filter(s => s.id !== id) })),

      startSession: (options) =>
        set({
          activeSession: { ...options, start_time: new Date().toISOString() },
          workoutExercises: [],
          sessionNotes: '',
          restEndsAt: null,
          isResting: false,
        }),

      startRoutine: (routine, day) =>
        set(() => {
          const rawExercises = day.routine_exercises || day.exercises || []
          
          const loadedExercises = rawExercises.map((rx: any) => {
            const baseExercise = rx.exercise || rx
            const realId = baseExercise.exercise_id || rx.exercise_id || baseExercise.id
            const targetReps = rx.target_reps || rx.config?.sets_config?.[0]?.reps || 10
            
            return {
              exercise: { ...baseExercise, id: realId },
              sets: [],
              meta: {
                routine_exercise_id: rx.id || rx.routine_exercise_id,
                superset_id: rx.superset_id || null, 
                set_type: 'normal',
                default_reps: targetReps,
                default_weight: 0,
                config: rx.config || null
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
            sessionNotes: '',
            restEndsAt: null,
            isResting: false
          }
        }),

      adjustSessionStartTime: (deltaMinutes: number) =>
        set((state) => {
          if (!state.activeSession) return state;
          const current = new Date(state.activeSession.start_time);
          current.setMinutes(current.getMinutes() - deltaMinutes);
          return { activeSession: { ...state.activeSession, start_time: current.toISOString() } }
        }),

      setSessionNotes: (notes: string) => set({ sessionNotes: notes }),

      addExercise: (exercise, meta) =>
        set((state) => ({
          workoutExercises: [...state.workoutExercises, { exercise, sets: [], meta }],
        })),

      replaceExercise: (oldId, newExercise) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.map((ex) =>
            ex.exercise.id === oldId ? { ...ex, exercise: newExercise } : ex
          ),
        })),

      removeExercise: (exerciseId) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.filter((ex) => ex.exercise.id !== exerciseId),
        })),

      reorderExercises: (newList) => set({ workoutExercises: newList }),

      updateExerciseUnit: (exerciseId, unit) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.map((ex) =>
            ex.exercise.id === exerciseId ? { ...ex, meta: { ...ex.meta, active_unit: unit } } : ex
          )
        })),

      addSet: (exerciseId, weight, reps, meta) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.map((ex) =>
            ex.exercise.id === exerciseId
              ? { ...ex, sets: [...ex.sets, { weight, reps, ...meta } as LoggedSet] }
              : ex
          )
        })),

      updateSet: (exerciseId, setIndex, updates) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.map((ex) => {
            if (ex.exercise.id === exerciseId) {
              const newSets = [...ex.sets]
              newSets[setIndex] = { ...newSets[setIndex], ...updates }
              return { ...ex, sets: newSets }
            }
            return ex
          })
        })),

      removeSet: (exerciseId, setIndex) =>
        set((state) => ({
          workoutExercises: state.workoutExercises.map((ex) => {
            if (ex.exercise.id === exerciseId) {
              const newSets = [...ex.sets]
              newSets.splice(setIndex, 1)
              return { ...ex, sets: newSets }
            }
            return ex
          })
        })),

      completeSet: (restTimeSeconds = 90) =>
        set({ restEndsAt: Date.now() + restTimeSeconds * 1000, isResting: true }),

      stopRest: () => set({ isResting: false, restEndsAt: null }),
      clearRestTimer: () => set({ isResting: false, restEndsAt: null }),
      
      clearSession: () =>
        set({ activeSession: null, workoutExercises: [], sessionNotes: '', restEndsAt: null, isResting: false }),
    }),
    {
      name: 'workout-storage',
    }
  )
)