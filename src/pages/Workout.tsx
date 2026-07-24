import { useMemo, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useWorkoutStore } from '../store/useWorkoutStore'
import SmartStepper from '../components/SmartStepper'
import CheckInButton from '../components/CheckInButton'
import RestTimer from '../components/RestTimer'
import PlateMath from '../components/PlateMath'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchExercises, fetchWorkoutHistory, finishWorkoutSession } from '../lib/queries'
import type { Exercise, WorkoutExercise, WorkoutSessionWithSets } from '../types/workout'
import { resolveExerciseConfig } from '../lib/configCascade'

interface ExerciseTrackerProps {
  workoutEx: WorkoutExercise
  defaultWeight: number
  defaultReps: number
  swapCandidates: Exercise[]
  onSwapExercise: (targetExercise: Exercise) => void
}

// --- SUB-COMPONENTE: Maneja los controles de un solo ejercicio ---
const ExerciseTracker = ({
  workoutEx,
  defaultWeight,
  defaultReps,
  swapCandidates,
  onSwapExercise,
}: ExerciseTrackerProps) => {
  const { addSet, completeSet } = useWorkoutStore()
  const { exercise, sets } = workoutEx
  const resolvedConfig = resolveExerciseConfig(null, null, workoutEx.meta?.config ?? exercise.config ?? null)
  
  const [weight, setWeight] = useState(workoutEx.meta?.default_weight ?? defaultWeight)
  const [reps, setReps] = useState(workoutEx.meta?.default_reps ?? defaultReps)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showSwapList, setShowSwapList] = useState(false)

  const handleCheckIn = () => {
    addSet(exercise.id, weight, reps, {
      routine_exercise_id: workoutEx.meta?.routine_exercise_id,
      superset_id: workoutEx.meta?.superset_id,
      set_type: workoutEx.meta?.set_type ?? 'normal',
      pr_opt_out: workoutEx.meta?.pr_mode === 'opt_out',
      pr_fixed_weight: workoutEx.meta?.pr_fixed_weight,
    })
    setIsCompleted(true)
    completeSet(resolvedConfig.rest_time_seconds) // Disparamos el temporizador
    setTimeout(() => setIsCompleted(false), 2000) // Reseteamos el botón
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold text-emerald-500">{exercise.name}</h2>
          <div className="flex gap-2 mt-1">
            {workoutEx.meta?.superset_id && (
              <span className="text-[10px] uppercase tracking-wide bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded px-2 py-0.5">
                Superset
              </span>
            )}
            {workoutEx.meta?.set_type === 'drop_set' && (
              <span className="text-[10px] uppercase tracking-wide bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded px-2 py-0.5">
                Drop set
              </span>
            )}
            {workoutEx.meta?.pr_mode === 'opt_out' && (
              <span className="text-[10px] uppercase tracking-wide bg-zinc-700/40 text-zinc-300 border border-zinc-600 rounded px-2 py-0.5">
                PR Off
              </span>
            )}
          </div>
        </div>
        <span className="text-sm text-zinc-400">{sets.length} series</span>
      </div>

      {/* Historial de series de este ejercicio */}
      {sets.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {sets.map((set, idx: number) => (
            <div key={idx} className="flex justify-between bg-zinc-950 px-4 py-2 rounded-lg text-sm">
              <span className="text-zinc-400">Serie {idx + 1}</span>
              <span className="font-bold text-zinc-100">{set.weight}kg × {set.reps} reps</span>
            </div>
          ))}
        </div>
      )}

      {/* Controles para la nueva serie */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <SmartStepper
          label="Peso"
          value={weight}
          step={resolvedConfig.stepper_increment}
          unit={resolvedConfig.weight_unit}
          onChange={setWeight}
        />
        <SmartStepper label="Reps" value={reps} step={1} unit="reps" onChange={setReps} />
      </div>
      
      <PlateMath weight={weight} />
      
      <div className="mt-4">
        <CheckInButton isCompleted={isCompleted} onClick={handleCheckIn} />
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-4">
        <button
          onClick={() => setShowSwapList((prev) => !prev)}
          className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-700"
        >
          Quick Swap
        </button>

        {showSwapList && (
          <div className="mt-3 flex flex-wrap gap-2">
            {swapCandidates.length === 0 ? (
              <span className="text-xs text-zinc-500">No hay alternativas disponibles.</span>
            ) : (
              swapCandidates.slice(0, 5).map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => {
                    onSwapExercise(candidate)
                    setShowSwapList(false)
                  }}
                  className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 px-3 py-2 rounded-lg"
                >
                  {candidate.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getLatestDefaultsByExercise(sessions: WorkoutSessionWithSets[]) {
  const defaults = new Map<string, { weight: number; reps: number }>()

  for (const session of sessions) {
    const sessionSets = session.workout_sets ?? []
    for (const set of sessionSets) {
      if (!defaults.has(set.exercise_id)) {
        defaults.set(set.exercise_id, {
          weight: set.weight,
          reps: set.reps,
        })
      }
    }
  }

  return defaults
}

function getExplicitAlternatives(exercise: Exercise, catalog: Exercise[]) {
  const byEmbeddedAlternatives = exercise.alternatives ?? []
  const byIds = new Set(exercise.alternative_exercise_ids ?? [])

  const byCatalogIds = catalog.filter((item) => byIds.has(item.id))
  return [...byEmbeddedAlternatives, ...byCatalogIds].filter((candidate) => candidate.id !== exercise.id)
}

function getSwapCandidates(exercise: Exercise, catalog: Exercise[]) {
  const explicit = getExplicitAlternatives(exercise, catalog)
  if (explicit.length > 0) return explicit

  return catalog.filter(
    (candidate) =>
      candidate.id !== exercise.id &&
      candidate.muscle_group &&
      candidate.muscle_group === exercise.muscle_group,
  )
}

// --- PANTALLA PRINCIPAL ---
export default function Workout() {
  const { activeSession, workoutExercises, replaceExercise, clearSession } = useWorkoutStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: recentSessions = [] } = useQuery({
    queryKey: ['workout-history', 'smart-defaults'],
    queryFn: () => fetchWorkoutHistory(20),
  })

  const { data: allExercises = [] } = useQuery({
    queryKey: ['exercises', 'quick-swap'],
    queryFn: fetchExercises,
  })

  const defaultsByExercise = useMemo(
    () => getLatestDefaultsByExercise(recentSessions),
    [recentSessions],
  )

  const finishWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) return
      await finishWorkoutSession({
        startTime: activeSession.start_time,
        workoutExercises,
        sessionOptions: {
          routine_id: activeSession.routine_id,
          routine_day_id: activeSession.routine_day_id,
          disable_prs: activeSession.disable_prs,
          config: activeSession.config,
        },
      })
    },
    onSuccess: async () => {
      clearSession()
      await queryClient.invalidateQueries({ queryKey: ['workout-history'] })
      navigate('/')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Fallo desconocido'
      alert(`Error al guardar: ${message}`)
    },
  })

  const handleFinishWorkout = () => {
    if (!activeSession) return
    finishWorkoutMutation.mutate()
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
          <ExerciseTracker
            key={`${workoutEx.exercise.id}-${index}`}
            workoutEx={workoutEx}
            defaultWeight={defaultsByExercise.get(workoutEx.exercise.id)?.weight ?? 60}
            defaultReps={defaultsByExercise.get(workoutEx.exercise.id)?.reps ?? 8}
            swapCandidates={getSwapCandidates(workoutEx.exercise, allExercises)}
            onSwapExercise={(targetExercise) => replaceExercise(workoutEx.exercise.id, targetExercise)}
          />
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
          disabled={finishWorkoutMutation.isPending}
          className="w-full bg-red-500/10 text-red-500 border border-red-500/20 font-bold p-4 rounded-xl active:scale-95 transition-transform"
        >
          {finishWorkoutMutation.isPending ? 'Guardando...' : 'Terminar Entrenamiento'}
        </button>
      </div>

      <RestTimer />
    </div>
  )
}