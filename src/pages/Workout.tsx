import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { useWakeLock } from '../hooks/useWakeLock'
import SmartStepper from '../components/SmartStepper'
import CheckInButton from '../components/CheckInButton'
import RestTimer from '../components/RestTimer'
import PlateMath from '../components/PlateMath'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchExercises, fetchWorkoutHistory, finishWorkoutSession } from '../lib/queries'
import type { Exercise, WorkoutExercise, WorkoutSessionWithSets } from '../types/workout'
import { resolveExerciseConfig } from '../lib/configCascade'
import { Trash2, Save, Timer, CheckCircle2 } from 'lucide-react' // <-- Añadimos CheckCircle2

// ---> NUEVO: Añadido el prop "isExtra" para pintar de azul las series de más <---
function ActiveSetRow({ exerciseId, set, index, updateSet, removeSet, isExtra }: any) {
  const [weight, setWeight] = useState(set.weight)
  const [reps, setReps] = useState(set.reps)
  const [isEdited, setIsEdited] = useState(false)

  useEffect(() => {
    setWeight(set.weight)
    setReps(set.reps)
    setIsEdited(false)
  }, [set.weight, set.reps])

  const handleSave = () => {
    updateSet(exerciseId, index, weight, reps)
    setIsEdited(false)
  }

  return (
    <div className={`flex justify-between items-center px-3 py-3 rounded-xl text-sm border ${isExtra ? 'bg-blue-500/5 border-blue-500/20' : 'bg-zinc-950 border-zinc-800/50'}`}>
      <div className={`font-medium flex items-center gap-2 ${isExtra ? 'text-blue-400' : 'text-zinc-500'}`}>
        <span className="whitespace-nowrap">Serie {index + 1}</span>
        {isExtra && <span className="text-[9px] uppercase tracking-wider bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold">Extra</span>}
      </div>
      
      <div className="flex items-center gap-1.5 ml-auto">
        <input type="number" value={weight} onChange={(e) => { setWeight(Number(e.target.value)); setIsEdited(true) }} className={`w-14 bg-zinc-900 border rounded-lg p-1.5 text-center text-sm outline-none font-bold ${isExtra ? 'border-blue-500/30 text-blue-100 focus:border-blue-500' : 'border-zinc-700 text-zinc-100 focus:border-emerald-500'}`} />
        <span className="text-zinc-500 text-xs">kg</span>
        <span className="text-zinc-600">×</span>
        <input type="number" value={reps} onChange={(e) => { setReps(Number(e.target.value)); setIsEdited(true) }} className={`w-14 bg-zinc-900 border rounded-lg p-1.5 text-center text-sm outline-none font-bold ${isExtra ? 'border-blue-500/30 text-blue-100 focus:border-blue-500' : 'border-zinc-700 text-zinc-100 focus:border-emerald-500'}`} />
        <span className="text-zinc-500 text-xs">reps</span>
        
        {isEdited ? (
          <button onClick={handleSave} className="ml-2 text-emerald-500 p-2 bg-emerald-500/10 rounded-lg active:scale-95 transition-transform"><Save size={16}/></button>
        ) : (
          <button onClick={() => removeSet(exerciseId, index)} className="ml-2 text-red-500 hover:text-red-400 p-2 bg-red-500/10 rounded-lg transition-colors active:scale-95"><Trash2 size={16} /></button>
        )}
      </div>
    </div>
  )
}

interface ExerciseTrackerProps {
  workoutEx: WorkoutExercise
  defaultsMap: Map<string, { weight: number; reps: number }>
  swapCandidates: Exercise[]
  onSwapExercise: (targetExercise: Exercise) => void
}

const ExerciseTracker = ({ workoutEx, defaultsMap, swapCandidates, onSwapExercise }: ExerciseTrackerProps) => {
  const { addSet, completeSet, removeSet, updateSet } = useWorkoutStore()
  const { exercise, sets } = workoutEx
  const resolvedConfig = resolveExerciseConfig(null, null, workoutEx.meta?.config ?? exercise.config ?? null)
  
  // ---> NUEVO: Lógica de Objetivo de Series <---
  // Buscamos cuántas series tenías programadas (o asumimos 3 si es un ejercicio suelto sin rutina)
  const targetSets = resolvedConfig.sets_config?.length > 0 
    ? resolvedConfig.sets_config.length 
    : ((workoutEx.meta as any)?.target_sets || 3);
  
  const currentSetIndex = sets.length
  const isCompletedVisual = currentSetIndex >= targetSets // ¿Ya cumplimos el objetivo?

  const routineSpecificDefault = defaultsMap.get(`${workoutEx.meta?.routine_exercise_id}-set-${currentSetIndex}`)
  const predefinedSet = resolvedConfig.sets_config?.[currentSetIndex]
  const globalDefault = defaultsMap.get(`global-${exercise.id}`)

  const [weight, setWeight] = useState(workoutEx.meta?.default_weight ?? 20)
  const [reps, setReps] = useState(workoutEx.meta?.default_reps ?? 8)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showSwapList, setShowSwapList] = useState(false)

  useEffect(() => {
    if (routineSpecificDefault) { setWeight(routineSpecificDefault.weight); setReps(routineSpecificDefault.reps) } 
    else if (predefinedSet) { setWeight(predefinedSet.weight); setReps(predefinedSet.reps) } 
    else if (globalDefault && currentSetIndex === 0) { setWeight(globalDefault.weight); setReps(globalDefault.reps) }
  }, [currentSetIndex, routineSpecificDefault, predefinedSet, globalDefault])

  const handleCheckIn = () => {
    addSet(exercise.id, weight, reps, {
      routine_exercise_id: workoutEx.meta?.routine_exercise_id,
      superset_id: workoutEx.meta?.superset_id,
      set_type: workoutEx.meta?.set_type ?? 'normal',
      pr_opt_out: workoutEx.meta?.pr_mode === 'opt_out',
      pr_fixed_weight: workoutEx.meta?.pr_fixed_weight,
    })
    setIsCompleted(true)
    completeSet(resolvedConfig.rest_time_seconds)
    setTimeout(() => setIsCompleted(false), 2000)
  }

  return (
    // ---> NUEVO: El contenedor brilla en verde si ya cumpliste la meta <---
    <div className={`bg-zinc-900 border rounded-2xl p-5 mb-6 transition-all duration-500 ${isCompletedVisual ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'border-zinc-800'}`}>
      <div className="flex justify-between items-center mb-4">
        <div>
          {/* El título agrega un Check verde si ya terminaste */}
          <h2 className={`text-xl font-bold flex items-center gap-2 ${isCompletedVisual ? 'text-emerald-400' : 'text-emerald-500'}`}>
            {exercise.name}
            {isCompletedVisual && <CheckCircle2 className="text-emerald-500 w-5 h-5" />}
          </h2>
          <div className="flex gap-2 mt-1">
            {workoutEx.meta?.superset_id && <span className="text-[10px] uppercase tracking-wide bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded px-2 py-0.5">Superset</span>}
            {workoutEx.meta?.set_type === 'drop_set' && <span className="text-[10px] uppercase tracking-wide bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded px-2 py-0.5">Drop set</span>}
          </div>
        </div>
        
        {/* Etiqueta de X / Y series. Se vuelve verde al completar. */}
        <div className={`text-sm font-bold px-3 py-1 rounded-lg border transition-colors ${isCompletedVisual ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
          <span className={isCompletedVisual ? 'text-emerald-400' : 'text-zinc-100'}>{currentSetIndex}</span>
          <span> / {targetSets} series</span>
        </div>
      </div>

      {sets.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {sets.map((set, idx) => (
            <ActiveSetRow 
              key={idx} 
              exerciseId={exercise.id} 
              set={set} 
              index={idx} 
              updateSet={updateSet} 
              removeSet={removeSet} 
              isExtra={idx >= targetSets} // Le avisamos a la fila si es extra
            />
          ))}
        </div>
      )}

      {/* Separador visual si decides seguir haciendo series después de la meta */}
      {isCompletedVisual && (
        <div className="flex items-center gap-2 mb-4 mt-2 opacity-60">
          <div className="h-px bg-zinc-700 flex-1"></div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Series Extra (Opcional)</span>
          <div className="h-px bg-zinc-700 flex-1"></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <SmartStepper label={`Peso (Serie ${currentSetIndex + 1})`} value={weight} step={resolvedConfig.stepper_increment} unit={resolvedConfig.weight_unit} onChange={setWeight} />
        <SmartStepper label={`Reps (Serie ${currentSetIndex + 1})`} value={reps} step={1} unit="reps" onChange={setReps} />
      </div>
      
      <PlateMath weight={weight} />
      
      <div className="mt-4"><CheckInButton isCompleted={isCompleted} onClick={handleCheckIn} /></div>

      <div className="mt-4 border-t border-zinc-800 pt-4">
        <button onClick={() => setShowSwapList((prev) => !prev)} className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg border border-zinc-700 active:scale-95 transition-transform">Quick Swap</button>
        {showSwapList && (
          <div className="mt-3 flex flex-wrap gap-2">
            {swapCandidates.length === 0 ? <span className="text-xs text-zinc-500">No hay alternativas.</span> : swapCandidates.slice(0, 5).map((candidate) => (
              <button key={candidate.id} onClick={() => { onSwapExercise(candidate); setShowSwapList(false) }} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 px-3 py-2 rounded-lg active:bg-zinc-700">{candidate.name}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getSmartDefaults(sessions: WorkoutSessionWithSets[], routineDayId: string | null) {
  const defaults = new Map<string, { weight: number; reps: number }>()
  if (routineDayId) {
    const lastRoutineSession = sessions.find(s => s.routine_day_id === routineDayId)
    if (lastRoutineSession && lastRoutineSession.workout_sets) {
      const setCounters = new Map<string, number>()
      for (const set of lastRoutineSession.workout_sets) {
        if (set.routine_exercise_id) {
          const idx = setCounters.get(set.routine_exercise_id) || 0
          defaults.set(`${set.routine_exercise_id}-set-${idx}`, { weight: set.weight, reps: set.reps })
          setCounters.set(set.routine_exercise_id, idx + 1)
        }
      }
    }
  }
  for (const session of sessions) {
    for (const set of (session.workout_sets || [])) {
      if (!defaults.has(`global-${set.exercise_id}`)) defaults.set(`global-${set.exercise_id}`, { weight: set.weight, reps: set.reps })
    }
  }
  return defaults
}

function getExplicitAlternatives(exercise: Exercise, catalog: Exercise[]) {
  const byIds = new Set(exercise.alternative_exercise_ids ?? [])
  const byCatalogIds = catalog.filter((item) => byIds.has(item.id))
  return [...(exercise.alternatives ?? []), ...byCatalogIds].filter((candidate) => candidate.id !== exercise.id)
}
function getSwapCandidates(exercise: Exercise, catalog: Exercise[]) {
  const explicit = getExplicitAlternatives(exercise, catalog)
  if (explicit.length > 0) return explicit
  return catalog.filter((candidate) => candidate.id !== exercise.id && candidate.muscle_group && candidate.muscle_group === exercise.muscle_group)
}

export default function Workout() {
  const { activeSession, workoutExercises, replaceExercise, clearSession } = useWorkoutStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useWakeLock(!!activeSession)

  const { data: recentSessions = [] } = useQuery({ queryKey: ['workout-history', 'smart-defaults'], queryFn: () => fetchWorkoutHistory(20) })
  const { data: allExercises = [] } = useQuery({ queryKey: ['exercises', 'quick-swap'], queryFn: fetchExercises })
  const defaultsMap = useMemo(() => getSmartDefaults(recentSessions, activeSession?.routine_day_id ?? null), [recentSessions, activeSession?.routine_day_id])

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!activeSession?.start_time) return
    const startTimeMs = new Date(activeSession.start_time).getTime()
    
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeMs) / 1000))
    }, 1000)
    
    setElapsed(Math.floor((Date.now() - startTimeMs) / 1000))

    return () => clearInterval(interval)
  }, [activeSession?.start_time])

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const finishWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (!activeSession) return
      await finishWorkoutSession({
        startTime: activeSession.start_time,
        workoutExercises,
        sessionOptions: { routine_id: activeSession.routine_id, routine_day_id: activeSession.routine_day_id, disable_prs: activeSession.disable_prs, config: activeSession.config },
      })
    },
    onSuccess: async () => {
      clearSession()
      await queryClient.invalidateQueries({ queryKey: ['workout-history'] })
      navigate('/')
    },
    onError: (error: any) => alert(`Error al guardar: ${error.message}`),
  })

  if (!activeSession) return <Navigate to="/exercises" replace />

  return (
    <div className="p-4 relative min-h-[80vh] pb-32">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Entrenamiento</h1>
        
        <div className="flex items-center gap-2 text-emerald-500 font-mono font-bold bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <Timer size={18} />
          {formatTime(elapsed)}
        </div>
      </div>

      {workoutExercises.length === 0 ? (
        <div className="text-center text-zinc-500 my-10">Agrega ejercicios desde el catálogo.</div>
      ) : (
        workoutExercises.map((workoutEx, index) => (
          <ExerciseTracker key={`${workoutEx.exercise.id}-${index}`} workoutEx={workoutEx} defaultsMap={defaultsMap} swapCandidates={getSwapCandidates(workoutEx.exercise, allExercises)} onSwapExercise={(targetExercise) => replaceExercise(workoutEx.exercise.id, targetExercise)} />
        ))
      )}

      <div className="flex flex-col gap-3 mt-8">
        <button onClick={() => navigate('/exercises')} className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold p-4 rounded-xl active:bg-zinc-800 transition-colors">
          + Añadir otro ejercicio
        </button>

        <button onClick={() => finishWorkoutMutation.mutate()} disabled={finishWorkoutMutation.isPending} className="w-full bg-emerald-500 text-zinc-950 font-bold p-4 rounded-xl active:scale-95 transition-transform mt-4">
          {finishWorkoutMutation.isPending ? 'Guardando...' : 'Terminar Entrenamiento'}
        </button>

        <button onClick={() => { if(window.confirm('¿Abandonar? Se perderán las series de hoy.')) { clearSession(); navigate('/') } }} className="w-full bg-red-500/10 text-red-500 border border-red-500/20 font-bold p-4 rounded-xl active:scale-95 transition-transform">
          Abandonar Entrenamiento
        </button>
      </div>

      <RestTimer />
    </div>
  )
}