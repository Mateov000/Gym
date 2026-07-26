import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useWakeLock } from '../hooks/useWakeLock'
import SmartStepper from '../components/SmartStepper'
import CheckInButton from '../components/CheckInButton'
import RestTimer from '../components/RestTimer'
import PlateMath from '../components/PlateMath'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchExercises, fetchWorkoutHistory, finishWorkoutSession, updateExercise } from '../lib/queries'
import type { Exercise, WorkoutExercise, WorkoutSessionWithSets } from '../types/workout'
import { resolveExerciseConfig } from '../lib/configCascade'
import { Trash2, Save, Timer, CheckCircle2, Check, EyeOff, Image, Dumbbell, X, AlignLeft } from 'lucide-react'

function convertWeight(value: number, fromUnit: string, toUnit: string, equivalencies: any[]): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'bodyweight' || toUnit === 'bodyweight') return 0;

  const graph: Record<string, { to: string, factor: number }[]> = {};
  const addEdge = (u: string, v: string, f: number) => {
    if (!graph[u]) graph[u] = [];
    graph[u].push({ to: v, factor: f });
  };

  addEdge('kg', 'lbs', 2.20462262);
  addEdge('lbs', 'kg', 0.45359237);

  equivalencies.forEach((eq: any) => {
    addEdge(eq.from, eq.to, eq.multiplier);
    addEdge(eq.to, eq.from, 1 / eq.multiplier);
  });

  const queue: { unit: string, val: number }[] = [{ unit: fromUnit, val: value }];
  const visited = new Set<string>([fromUnit]);

  while (queue.length > 0) {
    const { unit, val } = queue.shift()!;
    if (unit === toUnit) {
      return Math.round(val * 4) / 4;
    }
    for (const neighbor of (graph[unit] || [])) {
      if (!visited.has(neighbor.to)) {
        visited.add(neighbor.to);
        queue.push({ unit: neighbor.to, val: val * neighbor.factor });
      }
    }
  }
  return Math.round(value * 4) / 4;
}

function ActiveSetRow({ exerciseId, set, index, updateSet, removeSet, isExtra, currentUnit }: any) {
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
        <input type="number" step="any" value={weight} onChange={(e) => { setWeight(parseFloat(e.target.value) || 0); setIsEdited(true) }} className={`w-14 bg-zinc-900 border rounded-lg p-1.5 text-center text-sm outline-none font-bold ${isExtra ? 'border-blue-500/30 text-blue-100 focus:border-blue-500' : 'border-zinc-700 text-zinc-100 focus:border-emerald-500'}`} />
        <span className="text-zinc-500 text-xs w-6 truncate text-center">{currentUnit}</span>
        <span className="text-zinc-600">×</span>
        <input type="number" step="any" value={reps} onChange={(e) => { setReps(parseFloat(e.target.value) || 0); setIsEdited(true) }} className={`w-14 bg-zinc-900 border rounded-lg p-1.5 text-center text-sm outline-none font-bold ${isExtra ? 'border-blue-500/30 text-blue-100 focus:border-blue-500' : 'border-zinc-700 text-zinc-100 focus:border-emerald-500'}`} />
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
  allExercises: Exercise[]
  defaultsMap: Map<string, { weight: number; reps: number }>
  swapCandidates: Exercise[]
  onSwapExercise: (targetExercise: Exercise) => void
}

const ExerciseTracker = ({ workoutEx, allExercises, defaultsMap, swapCandidates, onSwapExercise }: ExerciseTrackerProps) => {
  const { addSet, completeSet, removeSet, updateSet, updateExerciseUnit } = useWorkoutStore()
  const { 
    showQuickCompleteButton, 
    equivalencies, 
    routineNotes, 
    setRoutineNote, 
    globalCustomUnits, 
    addGlobalCustomUnit,
    exerciseUnits,        // <-- Añadido
    setExerciseUnit       // <-- Añadido
  } = useSettingsStore()
  
  const queryClient = useQueryClient()

  const exercise = useMemo(() => {
    const rawEx = workoutEx.exercise
    if (rawEx && typeof rawEx === 'object' && 'name' in rawEx && rawEx.name && rawEx.name !== 'Ejercicio' && rawEx.name !== 'Ejercicio sin nombre') {
      return rawEx as Exercise
    }

    const targetId = (rawEx as any)?.exercise_id || (workoutEx as any).exercise_id || (rawEx as any)?.id || (workoutEx as any).id
    if (targetId) {
      const catalogMatch = allExercises.find(e => e.id === targetId)
      if (catalogMatch) return catalogMatch
    }
    return { id: targetId || '', name: (rawEx as any)?.name || 'Ejercicio sin nombre', muscle_group: '', image_url: '', description: '', config: null } as Exercise
  }, [workoutEx, allExercises])

  const sets = workoutEx.sets || []
  const resolvedConfig = resolveExerciseConfig(null, null, workoutEx.meta?.config ?? exercise.config ?? null)
  
  const routineExId = workoutEx.meta?.routine_exercise_id || exercise.id
  
  // ---> MAGIA: Lee la unidad guardada para este ejercicio, y si no hay, cae en el default de configuración <---
  const currentUnit = workoutEx.meta?.active_unit || exerciseUnits[routineExId] || resolvedConfig.weight_unit || 'kg'
  
  const customUnitsLegacy = resolvedConfig.custom_units || [] 
  const allAvailableUnits = Array.from(new Set(['kg', 'lbs', 'bodyweight', ...customUnitsLegacy, ...globalCustomUnits]))
  
  const [isCreatingUnit, setIsCreatingUnit] = useState(false)
  const [newUnitText, setNewUnitText] = useState('')

  const targetSets = resolvedConfig.sets_config?.length > 0 ? resolvedConfig.sets_config.length : ((workoutEx.meta as any)?.target_sets || 3);
  const currentSetIndex = sets.length
  const isCompletedVisual = currentSetIndex >= targetSets

  const routineSpecificDefault = defaultsMap.get(`${routineExId}-set-${currentSetIndex}`)
  const predefinedSet = resolvedConfig.sets_config?.[currentSetIndex]
  const globalDefault = defaultsMap.get(`global-${exercise.id}`)

  const [weight, setWeight] = useState(workoutEx.meta?.default_weight ?? 20)
  const [reps, setReps] = useState(workoutEx.meta?.default_reps ?? 8)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showSwapList, setShowSwapList] = useState(false)
  const [showImage, setShowImage] = useState(false)

  const currentNote = routineNotes[routineExId] || ''

  useEffect(() => {
    if (routineSpecificDefault) { setWeight(routineSpecificDefault.weight); setReps(routineSpecificDefault.reps) } 
    else if (predefinedSet) { setWeight(predefinedSet.weight); setReps(predefinedSet.reps) } 
    else if (globalDefault && currentSetIndex === 0) { setWeight(globalDefault.weight); setReps(globalDefault.reps) }
  }, [currentSetIndex, routineSpecificDefault, predefinedSet, globalDefault])

  const updateExConfigMutation = useMutation({
     mutationFn: async ({ id, config }: { id: string, config: any }) => updateExercise(id, { config }),
     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises', 'catalog'] })
  })

  const handleUnitChange = (newUnit: string) => {
    if (newUnit === 'NEW') {
      setIsCreatingUnit(true)
      return
    }
    const newWeight = convertWeight(weight, currentUnit, newUnit, equivalencies);
    setWeight(newWeight);
    updateExerciseUnit(exercise.id, newUnit);
    setExerciseUnit(routineExId, newUnit); // Guardado permanente para la próxima vez
  }

  const handleSaveNewUnit = () => {
    if (newUnitText && newUnitText.trim()) {
      const cleanUnit = newUnitText.trim().toLowerCase()
      updateExerciseUnit(exercise.id, cleanUnit)
      setExerciseUnit(routineExId, cleanUnit) // Guardado permanente para la próxima vez
      addGlobalCustomUnit(cleanUnit) 
    }
    setIsCreatingUnit(false)
    setNewUnitText('')
  }

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
    <div className={`bg-zinc-900 border rounded-2xl p-5 mb-6 transition-all duration-500 ${isCompletedVisual ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'border-zinc-800'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className={`text-xl font-bold flex items-center gap-2 ${isCompletedVisual ? 'text-emerald-400' : 'text-emerald-500'}`}>
            {exercise.name || 'Ejercicio'}
            {isCompletedVisual && <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />}
          </h2>
          <div className="flex flex-wrap gap-2 mt-1">
            {exercise.muscle_group && <span className="text-[10px] uppercase tracking-wider bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-bold">{exercise.muscle_group}</span>}
            {workoutEx.meta?.superset_id && <span className="text-[10px] uppercase tracking-wide bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded px-2 py-0.5">Superset</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImage(!showImage)} className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-bold ${showImage ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
            {showImage ? <EyeOff size={16} /> : <Image size={16} />}
            <span className="hidden sm:inline">{showImage ? 'Ocultar Demo' : 'Ver Demo'}</span>
          </button>
          <div className={`text-sm font-bold px-3 py-1.5 rounded-xl border transition-colors ${isCompletedVisual ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
            <span className={isCompletedVisual ? 'text-emerald-400' : 'text-zinc-100'}>{currentSetIndex}</span>
            <span> / {targetSets} series</span>
          </div>
        </div>
      </div>

      {showImage && (
        <div className="mb-5 bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden p-3 flex flex-col items-center justify-center animate-in fade-in duration-200">
          {exercise.image_url ? (
            <img src={exercise.image_url} alt={exercise.name} className="max-h-60 w-auto object-contain rounded-xl" onError={(e) => {(e.target as HTMLElement).style.display = 'none'}}/>
          ) : (
            <div className="py-6 text-center text-zinc-500 text-xs flex flex-col items-center gap-2"><Dumbbell size={24} className="text-zinc-700" />Sin imagen</div>
          )}
          {exercise.description && <p className="text-xs text-zinc-400 mt-3 px-2 text-center border-t border-zinc-800/80 pt-2 w-full leading-relaxed">{exercise.description}</p>}
        </div>
      )}

      <div className="mb-5">
        <div className="relative">
          <AlignLeft size={16} className="absolute top-3 left-3 text-zinc-600" />
          <textarea 
            value={currentNote}
            onChange={(e) => setRoutineNote(routineExId, e.target.value)}
            placeholder="Añade notas para este ejercicio (se guardarán para la próxima vez)..."
            className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-xl py-3 pr-3 pl-10 text-sm text-zinc-300 outline-none focus:border-emerald-500 resize-none h-14 focus:h-24 transition-all"
          />
        </div>
      </div>

      {sets.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {sets.map((set, idx) => (
            <ActiveSetRow key={idx} exerciseId={exercise.id} set={set} index={idx} updateSet={updateSet} removeSet={removeSet} isExtra={idx >= targetSets} currentUnit={currentUnit}/>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3 mt-4 px-1">
        <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Unidad</span>
        {isCreatingUnit ? (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
            <input autoFocus type="text" value={newUnitText} onChange={e => setNewUnitText(e.target.value)} className="bg-zinc-950 border border-emerald-500 rounded-lg px-2 py-1.5 text-xs text-zinc-100 w-24 outline-none" placeholder="ej. placas" />
            <button onClick={handleSaveNewUnit} className="text-emerald-500 bg-emerald-500/10 p-1.5 rounded-md active:scale-95"><Check size={14}/></button>
            <button onClick={() => setIsCreatingUnit(false)} className="text-zinc-500 bg-zinc-800 p-1.5 rounded-md active:scale-95"><X size={14}/></button>
          </div>
        ) : (
          <select value={currentUnit} onChange={(e) => handleUnitChange(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-emerald-400 font-bold text-xs rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500">
            {allAvailableUnits.map(u => <option key={u} value={u}>{u}</option>)}
            <option value="NEW">+ Crear unidad...</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <SmartStepper label={`Peso (${currentUnit})`} value={weight} step={resolvedConfig.stepper_increment} unit={currentUnit} onChange={setWeight} />
        <SmartStepper label={`Reps (Serie ${currentSetIndex + 1})`} value={reps} step={1} unit="reps" onChange={setReps} />
      </div>
      
      {(currentUnit === 'kg' || currentUnit === 'lbs') && <PlateMath weight={weight} />}
      
      <div className="mt-4 flex gap-2">
        <div className="flex-1"><CheckInButton isCompleted={isCompleted} onClick={handleCheckIn} /></div>
        {showQuickCompleteButton && !isCompleted && (
          <button onClick={handleCheckIn} className="w-16 h-16 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl flex items-center justify-center active:bg-emerald-500/20 transition-colors flex-shrink-0" aria-label="Completado rápido"><Check size={28} strokeWidth={3} /></button>
        )}
      </div>

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
  const { data: allExercises = [] } = useQuery({ queryKey: ['exercises', 'catalog'], queryFn: fetchExercises })
  const defaultsMap = useMemo(() => getSmartDefaults(recentSessions, activeSession?.routine_day_id ?? null), [recentSessions, activeSession?.routine_day_id])

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!activeSession?.start_time) return
    const startTimeMs = new Date(activeSession.start_time).getTime()
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeMs) / 1000)), 1000)
    setElapsed(Math.floor((Date.now() - startTimeMs) / 1000))
    return () => clearInterval(interval)
  }, [activeSession?.start_time])

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60); const s = secs % 60;
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
    onSuccess: async () => { clearSession(); await queryClient.invalidateQueries({ queryKey: ['workout-history'] }); navigate('/') },
    onError: (error: any) => alert(`Error al guardar: ${error.message}`),
  })

  if (!activeSession) return <Navigate to="/exercises" replace />

  return (
    <div className="p-4 relative min-h-[80vh] pb-32">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Entrenamiento</h1>
          {(activeSession as any).name && <p className="text-xs text-emerald-500 font-bold mt-0.5">{(activeSession as any).name}</p>}
        </div>
        <div className="flex items-center gap-2 text-emerald-500 font-mono font-bold bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <Timer size={18} /> {formatTime(elapsed)}
        </div>
      </div>

      {workoutExercises.length === 0 ? (
        <div className="text-center text-zinc-500 my-10">Agrega ejercicios desde el catálogo.</div>
      ) : (
        workoutExercises.map((workoutEx, index) => (
          <ExerciseTracker key={`${workoutEx.exercise?.id || index}-${index}`} workoutEx={workoutEx} allExercises={allExercises} defaultsMap={defaultsMap} swapCandidates={getSwapCandidates(workoutEx.exercise, allExercises)} onSwapExercise={(targetExercise) => replaceExercise(workoutEx.exercise.id, targetExercise)} />
        ))
      )}

      <div className="flex flex-col gap-3 mt-8">
        <button onClick={() => navigate('/exercises')} className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold p-4 rounded-xl active:bg-zinc-800 transition-colors">+ Añadir otro ejercicio</button>
        <button onClick={() => finishWorkoutMutation.mutate()} disabled={finishWorkoutMutation.isPending} className="w-full bg-emerald-500 text-zinc-950 font-bold p-4 rounded-xl active:scale-95 transition-transform mt-4">{finishWorkoutMutation.isPending ? 'Guardando...' : 'Terminar Entrenamiento'}</button>
        <button onClick={() => { if(window.confirm('¿Abandonar? Se perderán las series de hoy.')) { clearSession(); navigate('/') } }} className="w-full bg-red-500/10 text-red-500 border border-red-500/20 font-bold p-4 rounded-xl active:scale-95 transition-transform">Abandonar Entrenamiento</button>
      </div>

      <RestTimer />
    </div>
  )
}