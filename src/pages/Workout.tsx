import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWorkoutStore } from '../store/useWorkoutStore'
import SmartStepper from '../components/SmartStepper'
import CheckInButton from '../components/CheckInButton'
import RestTimer from '../components/RestTimer'
import PlateMath from '../components/PlateMath'

// --- SUB-COMPONENTE: Maneja los controles de un solo ejercicio ---
const ExerciseTracker = ({ workoutEx }: { workoutEx: any }) => {
  const { addSet, completeSet } = useWorkoutStore()
  const { exercise, sets } = workoutEx
  
  const [weight, setWeight] = useState(60)
  const [reps, setReps] = useState(8)
  const [isCompleted, setIsCompleted] = useState(false)

  const handleCheckIn = () => {
    addSet(exercise.id, weight, reps) // Guardamos la serie en Zustand
    setIsCompleted(true)
    completeSet() // Disparamos el temporizador
    setTimeout(() => setIsCompleted(false), 2000) // Reseteamos el botón
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-emerald-500">{exercise.name}</h2>
        <span className="text-sm text-zinc-400">{sets.length} series</span>
      </div>

      {/* Historial de series de este ejercicio */}
      {sets.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {sets.map((set: any, idx: number) => (
            <div key={idx} className="flex justify-between bg-zinc-950 px-4 py-2 rounded-lg text-sm">
              <span className="text-zinc-400">Serie {idx + 1}</span>
              <span className="font-bold text-zinc-100">{set.weight}kg × {set.reps} reps</span>
            </div>
          ))}
        </div>
      )}

      {/* Controles para la nueva serie */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <SmartStepper label="Peso" value={weight} step={2.5} unit="kg" onChange={setWeight} />
        <SmartStepper label="Reps" value={reps} step={1} unit="reps" onChange={setReps} />
      </div>
      
      <PlateMath weight={weight} />
      
      <div className="mt-4">
        <CheckInButton isCompleted={isCompleted} onClick={handleCheckIn} />
      </div>
    </div>
  )
}

// --- PANTALLA PRINCIPAL ---
export default function Workout() {
  const { activeSession, workoutExercises, clearSession } = useWorkoutStore()
  const navigate = useNavigate()

  // Guardado Masivo en Supabase
  const handleFinishWorkout = async () => {
    if (!activeSession) return
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No hay usuario autenticado")

      // 1. Creamos la sesión principal
      const { data: newSession, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({ user_id: user.id, start_time: activeSession.start_time })
        .select().single()

      if (sessionError) throw sessionError

      // 2. Empaquetamos TODAS las series de TODOS los ejercicios
      const allSetsToInsert: any[] = []
      
      workoutExercises.forEach((workoutEx) => {
        workoutEx.sets.forEach((set) => {
          allSetsToInsert.push({
            session_id: newSession.id,
            exercise_id: workoutEx.exercise.id,
            weight: set.weight,
            reps: set.reps,
            is_completed: true
          })
        })
      })

      // 3. Guardamos todo de golpe si hay series
      if (allSetsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(allSetsToInsert)

        if (setsError) throw setsError
      }

      // 4. Limpiamos Zustand y volvemos al Feed
      clearSession()
      navigate('/')
      
    } catch (error: any) {
      console.error("Error al guardar:", error)
      alert(`Error al guardar: ${error.message || 'Fallo desconocido'}`)
    }
  }

  // Si llegamos aquí y no hay sesión, mostramos un aviso amigable
  // Si llegamos aquí y no hay sesión, devolvemos al usuario al catálogo automáticamente
  if (!activeSession) {
    return <Navigate to="/exercises" replace />
  }

  return (
    <div className="p-4 relative min-h-[80vh] pb-32">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Entrenamiento Activo</h1>
      </div>

      {/* Renderizamos una tarjeta por cada ejercicio agregado */}
      {workoutExercises.length === 0 ? (
        <div className="text-center text-zinc-500 my-10">Agrega ejercicios desde el catálogo.</div>
      ) : (
        workoutExercises.map((workoutEx, index) => (
          <ExerciseTracker key={index} workoutEx={workoutEx} />
        ))
      )}

      {/* Botones de acción general */}
      <div className="flex flex-col gap-3 mt-8">
        <button 
          onClick={() => navigate('/exercises')}
          className="w-full bg-zinc-900 border border-zinc-800 text-emerald-500 font-bold p-4 rounded-xl active:bg-zinc-800 transition-colors"
        >
          + Añadir otro ejercicio
        </button>

        <button 
          onClick={handleFinishWorkout}
          className="w-full bg-red-500/10 text-red-500 border border-red-500/20 font-bold p-4 rounded-xl active:scale-95 transition-transform"
        >
          Terminar Entrenamiento
        </button>
      </div>

      <RestTimer />
    </div>
  )
}