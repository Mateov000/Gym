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
import { fetchExercises, fetchWorkoutHistory, fetchExerciseHistory, finishWorkoutSession, updateRoutineExerciseSwap } from '../lib/queries'
import type { Exercise, WorkoutExercise, WorkoutSessionWithSets } from '../types/workout'
import { resolveExerciseConfig } from '../lib/configCascade'
import { Trash2, Save, Timer, CheckCircle2, Check, EyeOff, Image, Dumbbell, X, AlignLeft, MoreVertical, History, ArrowUp, ArrowDown, Zap, Star, RefreshCw, Building2 } from 'lucide-react'

// --- CONVERSOR MATEMÁTICO ---
function convertWeight(value: number, fromUnit: string, toUnit: string, equivalencies: any[]): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'bodyweight' || toUnit === 'bodyweight') return 0;
  const graph: Record<string, { to: string, factor: number }[]> = {};
  const addEdge = (u: string, v: string, f: number) => {
    if (!graph[u]) graph[u] = [];
    graph[u].push({ to: v, factor: f });
  };
  addEdge('kg', 'lbs', 2.20462262); addEdge('lbs', 'kg', 0.45359237);
  equivalencies.forEach((eq: any) => { addEdge(eq.from, eq.to, eq.multiplier); addEdge(eq.to, eq.from, 1 / eq.multiplier); });
  const queue: { unit: string, val: number }[] = [{ unit: fromUnit, val: value }];
  const visited = new Set<string>([fromUnit]);
  while (queue.length > 0) {
    const { unit, val } = queue.shift()!;
    if (unit === toUnit) return Math.round(val * 4) / 4;
    for (const neighbor of (graph[unit] || [])) {
      if (!visited.has(neighbor.to)) { visited.add(neighbor.to); queue.push({ unit: neighbor.to, val: val * neighbor.factor }); }
    }
  }
  return Math.round(value * 4) / 4;
}

// --- COMPONENTE FILA DE SERIE ---
function ActiveSetRow({ exerciseId, set, index, updateSet, removeSet, isExtra, currentUnit, useRir }: any) {
  const [weight, setWeight] = useState(set.weight)
  const [reps, setReps] = useState(set.reps)
  const [rir, setRir] = useState(set.rir ?? '')
  const [isEdited, setIsEdited] = useState(false)
  const [setType, setSetType] = useState<'normal' | 'warm_up' | 'drop_set'>(set.set_type || 'normal')

  useEffect(() => { setWeight(set.weight); setReps(set.reps); setRir(set.rir ?? ''); setSetType(set.set_type || 'normal'); setIsEdited(false) }, [set])

  const handleSave = () => { updateSet(exerciseId, index, { weight, reps, rir: rir !== '' ? Number(rir) : undefined, set_type: setType }); setIsEdited(false) }
  const toggleSetType = () => { setSetType(setType === 'normal' ? 'warm_up' : setType === 'warm_up' ? 'drop_set' : 'normal'); setIsEdited(true) }
  const estimated1RM = (weight > 0 && reps > 1 && setType !== 'warm_up') ? Math.round(weight * (1 + reps / 30)) : weight

  return (
    <div className={`flex flex-col px-3 py-3 rounded-xl text-sm border ${isExtra ? 'bg-blue-500/5 border-blue-500/20' : 'bg-zinc-950 border-zinc-800/50'}`}>
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <button onClick={toggleSetType} className={`w-6 h-6 flex items-center justify-center font-bold text-xs rounded transition-colors ${setType === 'warm_up' ? 'bg-orange-500/20 text-orange-500' : setType === 'drop_set' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
            {setType === 'warm_up' ? 'W' : setType === 'drop_set' ? 'D' : index + 1}
          </button>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <input type="number" step="any" value={weight} onChange={(e) => { setWeight(parseFloat(e.target.value) || 0); setIsEdited(true) }} className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 text-center text-sm outline-none font-bold text-zinc-100 focus:border-emerald-500" />
          <span className="text-zinc-500 text-[10px] w-5 truncate text-center">{currentUnit}</span>
          <span className="text-zinc-600 text-xs">×</span>
          <input type="number" step="any" value={reps} onChange={(e) => { setReps(parseFloat(e.target.value) || 0); setIsEdited(true) }} className="w-12 bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 text-center text-sm outline-none font-bold text-zinc-100 focus:border-emerald-500" />
          <span className="text-zinc-500 text-[10px]">reps</span>
          {useRir && (
            <>
              <span className="text-zinc-600 text-xs ml-1">RIR</span>
              <input type="number" step="0.5" value={rir} onChange={(e) => { setRir(e.target.value); setIsEdited(true) }} className="w-10 bg-zinc-900 border border-zinc-700 rounded-lg p-1.5 text-center text-sm outline-none text-zinc-300 focus:border-emerald-500" placeholder="-" />
            </>
          )}
          {isEdited ? (
            <button onClick={handleSave} className="ml-2 text-emerald-500 p-2 bg-emerald-500/10 rounded-lg active:scale-95"><Save size={16}/></button>
          ) : (
            <button onClick={() => removeSet(exerciseId, index)} className="ml-2 text-red-500 hover:text-red-400 p-2 bg-red-500/10 rounded-lg active:scale-95"><Trash2 size={16} /></button>
          )}
        </div>
      </div>
      {setType !== 'warm_up' && estimated1RM > 0 && (
        <div className="text-[10px] text-zinc-500 text-right mt-1.5 pr-2 w-full">
          1RM Est: <span className="font-bold">~{estimated1RM}{currentUnit}</span>
        </div>
      )}
    </div>
  )
}

const HistoryModal = ({ exercise, onClose }: { exercise: Exercise, onClose: () => void }) => {
  const { data: history, isLoading } = useQuery({ queryKey: ['exercise-history', exercise.id], queryFn: () => fetchExerciseHistory(exercise.id) })
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="bg-zinc-900 w-full sm:w-[400px] sm:rounded-3xl rounded-t-3xl p-5 max-h-[80vh] flex flex-col relative animate-in slide-in-from-bottom-10">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-zinc-800 rounded-full text-zinc-400"><X size={20}/></button>
        <div className="flex items-center gap-3 mb-6 pr-8"><div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500"><History size={24}/></div><h2 className="text-xl font-bold text-zinc-100 truncate">Historial</h2></div>
        <div className="overflow-y-auto flex-1 pr-2 space-y-4 pb-10">
          {isLoading ? <p className="text-zinc-500 text-center py-4">Buscando...</p> : 
           history?.length === 0 ? <p className="text-zinc-500 text-center py-4">No hay historial para este ejercicio.</p> :
           history?.map((session: any) => (
             <div key={session.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
               <p className="text-xs font-bold text-emerald-500 mb-3 border-b border-zinc-800 pb-2">{new Date(session.start_time).toLocaleDateString()} a las {new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
               <div className="space-y-1">
                 {session.workout_sets.map((s: any, idx: number) => (
                   <div key={s.id} className="flex items-center gap-2 text-sm text-zinc-300">
                     <span className={`w-5 font-bold ${s.set_type === 'warm_up' ? 'text-orange-500' : 'text-zinc-500'}`}>{s.set_type === 'warm_up' ? 'W' : idx+1}</span>
                     <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded text-zinc-100">{s.weight} {s.unit}</span>
                     <span className="text-zinc-600">x</span>
                     <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded text-zinc-100">{s.reps}</span>
                     {s.rir !== null && s.rir !== undefined && <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 ml-auto">RIR {s.rir}</span>}
                   </div>
                 ))}
               </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  )
}

// --- TRACKER INDIVIDUAL DEL EJERCICIO ---
const ExerciseTracker = ({ workoutEx, allExercises, defaultsMap, learnedSwaps, swapCandidates, onSwapExercise, isLastInSuperset }: any) => {
  const { addSet, completeSet, removeSet, updateSet, updateExerciseUnit, activeSession } = useWorkoutStore()
  const { showQuickCompleteButton, enableRir, equivalencies, routineNotes, setRoutineNote, globalCustomUnits, addGlobalCustomUnit, exerciseUnits, setExerciseUnit, hotelMode, setHotelMode } = useSettingsStore()
  const [showMenu, setShowMenu] = useState(false); const [showHistoryModal, setShowHistoryModal] = useState(false)

  const exercise = useMemo(() => {
    const rawEx = workoutEx.exercise
    if (rawEx && typeof rawEx === 'object' && 'name' in rawEx && rawEx.name && rawEx.name !== 'Ejercicio' && rawEx.name !== 'Ejercicio sin nombre') return rawEx as Exercise
    const targetId = (rawEx as any)?.exercise_id || (workoutEx as any).exercise_id || (rawEx as any)?.id || (workoutEx as any).id
    if (targetId) { const catalogMatch = allExercises.find((e: Exercise) => e.id === targetId); if (catalogMatch) return catalogMatch }
    return { id: targetId || '', name: (rawEx as any)?.name || 'Ejercicio sin nombre', muscle_group: '', image_url: '', description: '', config: null } as Exercise
  }, [workoutEx, allExercises])

  const sets = workoutEx.sets || []
  const resolvedConfig = resolveExerciseConfig(null, null, workoutEx.meta?.config ?? exercise.config ?? null)
  
  const routineExId = workoutEx.meta?.routine_exercise_id || exercise.id
  const currentUnit = workoutEx.meta?.active_unit || exerciseUnits[routineExId] || resolvedConfig.weight_unit || 'kg'
  const currentNote = routineNotes[routineExId] || '' 
  
  const allAvailableUnits = Array.from(new Set(['kg', 'lbs', 'bodyweight', ...(resolvedConfig.custom_units || []), ...globalCustomUnits]))
  const [isCreatingUnit, setIsCreatingUnit] = useState(false); const [newUnitText, setNewUnitText] = useState('')
  const targetSets = resolvedConfig.sets_config?.length > 0 ? resolvedConfig.sets_config.length : ((workoutEx.meta as any)?.target_sets || 3);
  const currentSetIndex = sets.length; const isCompletedVisual = currentSetIndex >= targetSets
  const [weight, setWeight] = useState(workoutEx.meta?.default_weight ?? 20); const [reps, setReps] = useState(workoutEx.meta?.default_reps ?? 8)
  const [isCompleted, setIsCompleted] = useState(false); const [showSwapList, setShowSwapList] = useState(false); const [showImage, setShowImage] = useState(false)

  useEffect(() => {
    const smartKey = `${routineExId}-${exercise.id}-set-${currentSetIndex}`
    const rDef = defaultsMap.get(smartKey)
    const pDef = resolvedConfig.sets_config?.[currentSetIndex] || resolvedConfig.sets_config?.[(resolvedConfig.sets_config?.length || 1) - 1]
    const gDef = defaultsMap.get(`global-${exercise.id}`)
    if (rDef) { setWeight(rDef.weight); setReps(rDef.reps); if (rDef.unit && rDef.unit !== currentUnit) updateExerciseUnit(exercise.id, rDef.unit) } 
    else if (pDef) { setWeight(pDef.weight); setReps(pDef.reps) } 
    else if (gDef && currentSetIndex === 0) { setWeight(gDef.weight); setReps(gDef.reps); if (gDef.unit && gDef.unit !== currentUnit) updateExerciseUnit(exercise.id, gDef.unit) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSetIndex, exercise.id])

  const handleUnitChange = (newUnit: string) => { if (newUnit === 'NEW') { setIsCreatingUnit(true); return } setWeight(convertWeight(weight, currentUnit, newUnit, equivalencies)); updateExerciseUnit(exercise.id, newUnit); setExerciseUnit(routineExId, newUnit); }
  const handleSaveNewUnit = () => { if (newUnitText && newUnitText.trim()) { const cleanUnit = newUnitText.trim().toLowerCase(); updateExerciseUnit(exercise.id, cleanUnit); setExerciseUnit(routineExId, cleanUnit); addGlobalCustomUnit(cleanUnit) } setIsCreatingUnit(false); setNewUnitText('') }
  const handleCheckIn = () => { addSet(exercise.id, weight, reps, { routine_exercise_id: workoutEx.meta?.routine_exercise_id, superset_id: workoutEx.meta?.superset_id, set_type: 'normal', pr_opt_out: workoutEx.meta?.pr_mode === 'opt_out', unit: currentUnit }); setIsCompleted(true); if (isLastInSuperset) completeSet(resolvedConfig.rest_time_seconds); setTimeout(() => setIsCompleted(false), 2000) }

  const handleSwapSelection = async (candidate: Exercise) => {
    const isRoutine = !!activeSession?.routine_id
    if (isRoutine && workoutEx.meta?.routine_exercise_id) {
      if (window.confirm(`¿Quieres reemplazar "${exercise.name}" por "${candidate.name}" permanentemente en tu rutina plantilla de ahora en adelante?\n\n[Cancelar] = Solo por hoy`)) {
        await updateRoutineExerciseSwap(workoutEx.meta.routine_exercise_id, candidate.id).catch(() => alert('Error al actualizar rutina plantilla.'))
      }
    }
    onSwapExercise(candidate)
    setShowSwapList(false)
  }

  const routineAltsIds = resolvedConfig.routine_alternatives || []
  const routineAlts = routineAltsIds.map((id: string) => allExercises.find((e: Exercise) => e.id === id)).filter(Boolean)
  const smartSwaps = learnedSwaps.get(routineExId) ? Array.from(learnedSwaps.get(routineExId) as Set<string>).map(id => allExercises.find((e: Exercise) => e.id === id)).filter((c): c is Exercise => c !== undefined && !routineAlts.find((r: any) => r.id === c.id)) : []
  const genericSwaps = swapCandidates.filter((c: Exercise) => !routineAlts.find((r: any) => r.id === c.id) && !smartSwaps.find((s: any) => s.id === c.id))

  return (
    <div className={`bg-zinc-900 border rounded-2xl p-4 sm:p-5 mb-4 relative transition-all duration-500 ${isCompletedVisual ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'border-zinc-800'} ${workoutEx.meta?.superset_id ? 'border-l-4 border-l-blue-500' : ''}`}>
      <div className="absolute top-4 right-4 z-10">
        <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-zinc-500 hover:text-zinc-300 bg-zinc-950 rounded-xl"><MoreVertical size={18}/></button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-20">
            <button onClick={() => {setShowHistoryModal(true); setShowMenu(false)}} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"><History size={16}/> Ver Historial</button>
            <button onClick={() => {setShowSwapList(!showSwapList); setShowMenu(false)}} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"><RefreshCw size={16}/> Intercambiar</button>
          </div>
        )}
      </div>

      <div className="flex justify-between items-start mb-4 pr-12">
        <div>
          <h2 className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${isCompletedVisual ? 'text-emerald-400' : 'text-emerald-500'}`}>
            {exercise.name || 'Ejercicio'} {isCompletedVisual && <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />}
          </h2>
          <div className="flex flex-wrap gap-2 mt-1">
            {exercise.muscle_group && <span className="text-[10px] uppercase tracking-wider bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-bold">{exercise.muscle_group}</span>}
            {workoutEx.meta?.superset_id && <span className="text-[10px] uppercase tracking-wide bg-blue-500/20 text-blue-300 border border-blue-500/20 rounded px-2 py-0.5 font-bold">Superset</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 justify-between">
        <button onClick={() => setShowImage(!showImage)} className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-bold flex-1 justify-center ${showImage ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
          {showImage ? <EyeOff size={16} /> : <Image size={16} />} {showImage ? 'Ocultar Demo' : 'Ver Demo'}
        </button>
        <div className={`text-sm font-bold px-3 py-2.5 rounded-xl border transition-colors flex-1 text-center ${isCompletedVisual ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}>
          <span className={isCompletedVisual ? 'text-emerald-400' : 'text-zinc-100'}>{currentSetIndex}</span> / {targetSets} series
        </div>
      </div>

      {showImage && (
        <div className="mb-5 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 flex flex-col items-center">
          {exercise.image_url ? <img src={exercise.image_url} alt={exercise.name} className="max-h-60 rounded-xl" onError={(e) => {(e.target as HTMLElement).style.display = 'none'}}/> : <Dumbbell className="text-zinc-700 my-4" size={24} />}
          {exercise.description && <p className="text-xs text-zinc-400 mt-3 px-2 text-center border-t border-zinc-800/80 pt-2">{exercise.description}</p>}
        </div>
      )}

      <div className="mb-5 relative">
        <AlignLeft size={16} className="absolute top-3 left-3 text-zinc-600" />
        <textarea value={currentNote} onChange={(e) => setRoutineNote(routineExId, e.target.value)} placeholder="Notas para el futuro..." className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-xl py-3 pr-3 pl-10 text-sm text-zinc-300 outline-none focus:border-emerald-500 resize-none h-12 focus:h-24 transition-all" />
      </div>

      {sets.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {sets.map((set: any, idx: number) => <ActiveSetRow key={idx} exerciseId={exercise.id} set={set} index={idx} updateSet={updateSet} removeSet={removeSet} isExtra={idx >= targetSets} currentUnit={currentUnit} useRir={enableRir || resolvedConfig.use_rir}/>)}
        </div>
      )}

      <div className="flex items-center justify-between mb-3 mt-4 px-1">
        <span className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Unidad</span>
        {isCreatingUnit ? (
          <div className="flex items-center gap-2">
            <input autoFocus type="text" value={newUnitText} onChange={e => setNewUnitText(e.target.value)} className="bg-zinc-950 border border-emerald-500 rounded-lg px-2 py-1.5 text-xs text-zinc-100 w-24 outline-none" placeholder="ej. placas" />
            <button onClick={handleSaveNewUnit} className="text-emerald-500 bg-emerald-500/10 p-1.5 rounded-md"><Check size={14}/></button>
            <button onClick={() => setIsCreatingUnit(false)} className="text-zinc-500 bg-zinc-800 p-1.5 rounded-md"><X size={14}/></button>
          </div>
        ) : (
          <select value={currentUnit} onChange={(e) => handleUnitChange(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-emerald-400 font-bold text-xs rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500">
            {allAvailableUnits.map((u: string) => <option key={u} value={u}>{u}</option>)}
            <option value="NEW">+ Crear unidad...</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <SmartStepper label={`Peso (${currentUnit})`} value={weight} step={resolvedConfig.stepper_increment} unit={currentUnit} onChange={setWeight} />
        <SmartStepper label={`Reps`} value={reps} step={1} unit="reps" onChange={setReps} />
      </div>
      {(currentUnit === 'kg' || currentUnit === 'lbs') && resolvedConfig.uses_barbell && (
        <PlateMath weight={weight} barWeight={resolvedConfig.bar_weight} />
      )}
      
      <div className="mt-4 flex gap-2">
        <div className="flex-1"><CheckInButton isCompleted={isCompleted} onClick={handleCheckIn} /></div>
        {showQuickCompleteButton && !isCompleted && (
          <button onClick={handleCheckIn} className="w-16 h-16 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl flex items-center justify-center active:bg-emerald-500/20 flex-shrink-0"><Check size={28} strokeWidth={3} /></button>
        )}
      </div>

      {showSwapList && (
        <div className="mt-4 border-t border-zinc-800 pt-4 animate-in fade-in">
          
          {/* ---> NUEVO: TOGGLE MODO HOTEL <--- */}
          <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-500"><Building2 size={16} /></div>
              <div>
                <p className="text-sm font-bold text-zinc-200">Modo Hotel</p>
                <p className="text-[10px] text-zinc-400">Ocultar opciones de Barra y Máquina Smith</p>
              </div>
            </div>
            <button onClick={() => setHotelMode(!hotelMode)} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${hotelMode ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
              <div className={`absolute top-1 left-1 bg-zinc-950 w-4 h-4 rounded-full transition-transform ${hotelMode ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <p className="text-xs text-zinc-500 mb-2">Reemplazar por:</p>
          <div className="flex flex-wrap gap-2">
            
            {/* LÓGICA DE FILTRADO CONDICIONAL */}
            {(() => {
              const isHotelFriendly = (c: Exercise) => !hotelMode || !['barbell', 'smith'].includes(c.config?.equipment || 'other');
              
              const filteredRoutineAlts = routineAlts.filter(isHotelFriendly);
              const filteredSmartSwaps = smartSwaps.filter(isHotelFriendly);
              const filteredGenericSwaps = genericSwaps.filter(isHotelFriendly);
              const filteredCatalog = allExercises.filter((e: Exercise) => e.id !== exercise.id && isHotelFriendly(e)).sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));

              return (
                <>
                  {filteredRoutineAlts.map((c: any) => (
                    <button key={`routine-alt-${c.id}`} onClick={() => handleSwapSelection(c)} className="text-xs bg-yellow-500/20 border border-yellow-500/40 text-yellow-500 font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.15)]"><Star size={12} fill="currentColor"/> {c.name}</button>
                  ))}

                  {filteredSmartSwaps.map((c: any) => (
                    <button key={`smart-${c.id}`} onClick={() => handleSwapSelection(c)} className="text-xs bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.15)]"><Zap size={12} fill="currentColor"/> {c.name}</button>
                  ))}

                  {filteredGenericSwaps.slice(0, 5).map((c: Exercise) => (
                    <button key={c.id} onClick={() => handleSwapSelection(c)} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 px-3 py-2 rounded-lg active:bg-zinc-700">{c.name}</button>
                  ))}

                  {filteredCatalog.length > 0 && (
                    <select 
                      className="text-xs bg-zinc-900 border border-zinc-700 text-zinc-400 px-3 py-2 rounded-lg outline-none focus:border-emerald-500 max-w-[200px]"
                      onChange={(e) => {
                        const ex = filteredCatalog.find((a: Exercise) => a.id === e.target.value);
                        if(ex) handleSwapSelection(ex);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>+ Todo el catálogo...</option>
                      {filteredCatalog.map((e: Exercise) => (
                          <option key={e.id} value={e.id}>{e.name} {e.muscle_group ? `(${e.muscle_group})` : ''}</option>
                      ))}
                    </select>
                  )}

                  {filteredGenericSwaps.length === 0 && filteredSmartSwaps.length === 0 && filteredRoutineAlts.length === 0 && <span className="text-xs text-zinc-500">No hay alternativas válidas {hotelMode && 'para Modo Hotel'}.</span>}
                </>
              )
            })()}
          </div>
        </div>
      )}
      {showHistoryModal && <HistoryModal exercise={exercise} onClose={() => setShowHistoryModal(false)}/>}
    </div>
  )
}

function getSmartDefaults(sessions: WorkoutSessionWithSets[], routineDayId: string | null) {
  const defaults = new Map<string, { weight: number; reps: number; unit?: string }>()
  
  if (routineDayId) {
    const lastRoutineSession = sessions.find(s => s.routine_day_id === routineDayId)
    if (lastRoutineSession && lastRoutineSession.workout_sets) {
      const setCounters = new Map<string, number>()
      for (const set of lastRoutineSession.workout_sets) {
        if (set.routine_exercise_id && set.exercise_id) {
          const comboKey = `${set.routine_exercise_id}-${set.exercise_id}`
          const idx = setCounters.get(comboKey) || 0
          defaults.set(`${comboKey}-set-${idx}`, { weight: set.weight, reps: set.reps, unit: set.unit })
          setCounters.set(comboKey, idx + 1)
        }
      }
    }
  }
  for (const session of sessions) {
    for (const set of (session.workout_sets || [])) {
      if (!defaults.has(`global-${set.exercise_id}`)) defaults.set(`global-${set.exercise_id}`, { weight: set.weight, reps: set.reps, unit: set.unit })
    }
  }
  return defaults
}

function getLearnedSwaps(sessions: WorkoutSessionWithSets[]) {
  const learned = new Map<string, Set<string>>()
  sessions.forEach(session => {
    session.workout_sets?.forEach(set => {
      if (set.routine_exercise_id && set.exercise_id) {
        if (!learned.has(set.routine_exercise_id)) learned.set(set.routine_exercise_id, new Set())
        learned.get(set.routine_exercise_id)!.add(set.exercise_id)
      }
    })
  })
  return learned
}

function getExplicitAlternatives(exercise: Exercise, catalog: Exercise[]) {
  const byIds = new Set(exercise.alternative_exercise_ids ?? [])
  const byCatalogIds = catalog.filter((item) => byIds.has(item.id))
  return [...(exercise.alternatives ?? []), ...byCatalogIds].filter((candidate) => candidate.id !== exercise.id)
}

function getSwapCandidates(exercise: Exercise, catalog: Exercise[]) {
  const explicit = getExplicitAlternatives(exercise, catalog)
  if (explicit.length > 0) return explicit
  
  let candidates = catalog.filter((candidate) => candidate.id !== exercise.id)
  if (exercise.muscle_group) {
    const sameGroup = candidates.filter((c) => c.muscle_group === exercise.muscle_group)
    if (sameGroup.length > 0) candidates = sameGroup
  }
  return candidates
}

export default function Workout() {
  const { activeSession, workoutExercises, replaceExercise, clearSession, sessionNotes, setSessionNotes, adjustSessionStartTime, reorderExercises } = useWorkoutStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useWakeLock(!!activeSession)

  const { data: recentSessions = [] } = useQuery({ queryKey: ['workout-history', 'smart-defaults'], queryFn: () => fetchWorkoutHistory(20) })
  const { data: allExercises = [] } = useQuery({ queryKey: ['exercises', 'catalog'], queryFn: fetchExercises })
  const defaultsMap = useMemo(() => getSmartDefaults(recentSessions, activeSession?.routine_day_id ?? null), [recentSessions, activeSession?.routine_day_id])
  const learnedSwaps = useMemo(() => getLearnedSwaps(recentSessions), [recentSessions])

  const [elapsed, setElapsed] = useState(0)
  const [showTimeEditor, setShowTimeEditor] = useState(false)

  useEffect(() => {
    if (!activeSession?.start_time) return
    const startTimeMs = new Date(activeSession.start_time).getTime()
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeMs) / 1000)), 1000)
    setElapsed(Math.floor((Date.now() - startTimeMs) / 1000))
    return () => clearInterval(interval)
  }, [activeSession?.start_time])

  const formatTime = (secs: number) => {
    if (secs < 0) return '0:00'
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
        sessionNotes,
        sessionOptions: { routine_id: activeSession.routine_id, routine_day_id: activeSession.routine_day_id, disable_prs: activeSession.disable_prs, config: activeSession.config },
      })
    },
    onSuccess: async () => { 
      // 1. Navegamos primero
      navigate('/') 
      // 2. Limpiamos la sesión después para no romper los hooks de esta pantalla
      clearSession(); 
      await queryClient.invalidateQueries({ queryKey: ['workout-history'] }); 
    },
    onError: (error: any) => alert(`Error al guardar: ${error.message}`),
  })

  // ---- LA MAGIA DE LA PANTALLA BLANCA ----
  // Movemos todos los Hooks ARRIBA del `return`
  const groups = useMemo(() => {
    const result: WorkoutExercise[][] = [];
    let current: WorkoutExercise[] = [];
    workoutExercises.forEach((ex) => {
      if (current.length === 0) current.push(ex);
      else if (ex.meta?.superset_id && ex.meta.superset_id === current[0].meta?.superset_id) current.push(ex);
      else { result.push(current); current = [ex]; }
    });
    if (current.length > 0) result.push(current);
    return result;
  }, [workoutExercises])

  const handleMoveGroup = (fromIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && fromIndex === 0) return;
    if (direction === 'down' && fromIndex === groups.length - 1) return;
    const newGroups = [...groups];
    const targetIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    const temp = newGroups[fromIndex];
    newGroups[fromIndex] = newGroups[targetIndex];
    newGroups[targetIndex] = temp;
    reorderExercises(newGroups.flat());
  }

  // Y ahora sí, si no hay sesión, abortamos renderizado
  if (!activeSession) return <Navigate to="/exercises" replace />

  return (
    <div className="p-3 sm:p-4 relative min-h-[80vh] pb-40 max-w-2xl mx-auto">
      
      {/* ---> LA BARRA FLOTANTE CON EL RELOJ DE DESCANSO DENTRO <--- */}
      <div className="flex flex-col mb-6 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 shadow-lg sticky top-2 z-40 transition-all duration-300">
        <div className="flex justify-between items-center">
          <div className="flex-1 min-w-0 pr-4">
            <h1 className="text-xl font-bold text-zinc-100 truncate">Entrenamiento</h1>
            {(activeSession as any).name && <p className="text-xs text-emerald-500 font-bold mt-0.5 truncate">{(activeSession as any).name}</p>}
          </div>
          <div className="relative">
            <button onClick={() => setShowTimeEditor(!showTimeEditor)} className="flex items-center gap-2 text-zinc-400 font-mono font-bold bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-800 active:scale-95 transition-transform">
              <Timer size={16} /> {formatTime(elapsed)}
            </button>
            {showTimeEditor && (
              <div className="absolute top-full right-0 mt-2 bg-zinc-800 border border-zinc-700 p-2 rounded-xl shadow-2xl flex flex-col gap-2 w-32 z-50">
                <button onClick={() => { adjustSessionStartTime(-5); setShowTimeEditor(false) }} className="bg-zinc-900 text-zinc-300 text-xs font-bold py-2 rounded-lg active:scale-95">+ 5 mins</button>
                <button onClick={() => { adjustSessionStartTime(5); setShowTimeEditor(false) }} className="bg-zinc-900 text-zinc-300 text-xs font-bold py-2 rounded-lg active:scale-95">- 5 mins</button>
              </div>
            )}
          </div>
        </div>
        
        {/* Aquí vive el reloj de descanso ahora */}
        <RestTimer />
      </div>

      {workoutExercises.length === 0 ? (
        <div className="text-center text-zinc-500 my-10 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800 border-dashed">Agrega ejercicios desde el catálogo para comenzar.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group: WorkoutExercise[], gIdx: number) => {
            const isSuperset = group.length > 1;
            return (
              <div key={gIdx} className={`relative flex flex-col gap-2 ${isSuperset ? 'p-1.5 sm:p-2 bg-blue-900/5 border border-blue-500/20 rounded-3xl' : ''}`}>
                <div className="flex justify-end gap-1 mb-1 pr-2">
                   <button onClick={() => handleMoveGroup(gIdx, 'up')} disabled={gIdx === 0} className="p-1.5 bg-zinc-800 text-zinc-500 rounded-lg disabled:opacity-30 active:scale-95"><ArrowUp size={16}/></button>
                   <button onClick={() => handleMoveGroup(gIdx, 'down')} disabled={gIdx === groups.length - 1} className="p-1.5 bg-zinc-800 text-zinc-500 rounded-lg disabled:opacity-30 active:scale-95"><ArrowDown size={16}/></button>
                </div>
                {group.map((workoutEx: WorkoutExercise, exIdxInGroup: number) => (
                  <ExerciseTracker 
                    key={`${workoutEx.exercise.id}-${gIdx}-${exIdxInGroup}`} 
                    workoutEx={workoutEx} 
                    allExercises={allExercises} 
                    defaultsMap={defaultsMap} 
                    learnedSwaps={learnedSwaps} 
                    swapCandidates={getSwapCandidates(workoutEx.exercise, allExercises)} 
                    onSwapExercise={(targetEx: Exercise) => replaceExercise(workoutEx.exercise.id, targetEx)} 
                    isLastInSuperset={exIdxInGroup === group.length - 1}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
        <h3 className="text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2"><AlignLeft size={16}/> Notas de la Sesión</h3>
        <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="¿Cómo te sentiste hoy? (Sueño, comida, energía...)" className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 text-sm text-zinc-300 outline-none focus:border-emerald-500 resize-none h-20"/>
      </div>

      <div className="flex flex-col gap-3 mt-6">
        <button onClick={() => navigate('/exercises')} className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold p-4 rounded-xl active:bg-zinc-800 transition-colors">+ Añadir otro ejercicio</button>
        <button onClick={() => finishWorkoutMutation.mutate()} disabled={finishWorkoutMutation.isPending} className="w-full bg-emerald-500 text-zinc-950 font-bold p-4 rounded-xl active:scale-95 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.2)]">{finishWorkoutMutation.isPending ? 'Guardando...' : 'Terminar Entrenamiento'}</button>
        <button onClick={() => { if(window.confirm('¿Abandonar? Se perderán las series de hoy.')) { clearSession(); navigate('/') } }} className="w-full text-red-500 font-bold p-4 rounded-xl active:scale-95 transition-transform bg-transparent">Abandonar Entrenamiento</button>
      </div>
    </div>
  )
}
