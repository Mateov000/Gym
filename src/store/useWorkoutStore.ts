import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Definimos la estructura de nuestros datos
interface SetLog {
  weight: number;
  reps: number;
}

interface WorkoutExercise {
  exercise: any; // Aquí guardaremos los datos del catálogo (id, name, muscle_group)
  sets: SetLog[]; // Las series de ESTE ejercicio en particular
}

interface WorkoutStore {
  activeSession: { start_time: string } | null;
  isResting: boolean;
  workoutExercises: WorkoutExercise[]; // <-- Nuestro "carrito de compras"
  
  startSession: () => void;
  addExercise: (exercise: any) => void;
  addSet: (exerciseId: string, weight: number, reps: number) => void;
  completeSet: () => void;
  clearSession: () => void;
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

      // Agrega una serie a un ejercicio específico
      addSet: (exerciseId, weight, reps) => set((state) => ({
        workoutExercises: state.workoutExercises.map(item => 
          item.exercise.id === exerciseId 
            ? { ...item, sets: [...item.sets, { weight, reps }] }
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