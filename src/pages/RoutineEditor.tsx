import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchRoutineById, fetchExercises, updateRoutine, deleteRoutine } from '../lib/queries'
import { Trash2, Plus, ArrowLeft, Save, X } from 'lucide-react'

export default function RoutineEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: routine, isLoading } = useQuery({
    queryKey: ['routine-edit', id],
    queryFn: () => fetchRoutineById(id!),
    enabled: !!id,
  })

  const { data: allExercises = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [folder, setFolder] = useState('')
  const [days, setDays] = useState<any[]>([])

  useEffect(() => {
    if (routine) {
      setName(routine.name)
      setNotes(routine.notes || '')
      setFolder(routine.folder || '')
      const mappedDays = routine.routine_days.map((d: any) => ({
        name: d.name,
        day_order: d.day_order,
        exercises: (d.routine_exercises || []).map((ex: any) => ({
          exercise_id: ex.exercise_id,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          weight: ex.config?.sets_config?.[0]?.weight || '',
          config: ex.config || {}
        })),
      }))
      setDays(mappedDays)
    }
  }, [routine])

  const saveMutation = useMutation({
    mutationFn: () => {
      const formattedDays = days.map(day => ({
        ...day,
        exercises: day.exercises.map((ex: any) => ({
          ...ex,
          config: {
            ...ex.config,
            sets_config: Array(ex.target_sets).fill(null).map(() => ({
              reps: ex.target_reps,
              weight: parseFloat(ex.weight) || 0
            }))
          }
        }))
      }))
      return updateRoutine(id!, name, notes, folder, formattedDays)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (err: any) => alert(`Error al guardar: ${err.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRoutine(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (err: any) => alert(`Error al eliminar: ${err.message}`)
  })

  const addDay = () => setDays([...days, { name: `Día ${days.length + 1}`, day_order: days.length + 1, exercises: [] }])
  
  const addExercise = (dayIndex: number) => {
    if (allExercises.length === 0) return
    const newDays = [...days]
    newDays[dayIndex].exercises.push({ exercise_id: allExercises[0].id, target_sets: 3, target_reps: 10, weight: '', config: {} })
    setDays(newDays)
  }

  const updateExercise = (dayIndex: number, exIndex: number, field: string, value: string | number) => {
    const newDays = [...days]; newDays[dayIndex].exercises[exIndex][field] = value; setDays(newDays)
  }

  const removeExercise = (dayIndex: number, exIndex: number) => {
    const newDays = [...days]; newDays[dayIndex].exercises.splice(exIndex, 1); setDays(newDays)
  }

  const removeDay = (dayIndex: number) => {
    const newDays = [...days]; newDays.splice(dayIndex, 1); setDays(newDays)
  }

  // ---> NUEVO: Lógica de la UI para Alternativas <---
  const addAlternative = (dIdx: number, eIdx: number) => {
    const newDays = [...days]
    if (!newDays[dIdx].exercises[eIdx].config) newDays[dIdx].exercises[eIdx].config = {}
    if (!newDays[dIdx].exercises[eIdx].config.routine_alternatives) newDays[dIdx].exercises[eIdx].config.routine_alternatives = []
    newDays[dIdx].exercises[eIdx].config.routine_alternatives.push(allExercises[0]?.id || '')
    setDays(newDays)
  }

  const updateAlternative = (dIdx: number, eIdx: number, aIdx: number, val: string) => {
    const newDays = [...days]
    newDays[dIdx].exercises[eIdx].config.routine_alternatives[aIdx] = val
    setDays(newDays)
  }

  const removeAlternative = (dIdx: number, eIdx: number, aIdx: number) => {
    const newDays = [...days]
    newDays[dIdx].exercises[eIdx].config.routine_alternatives.splice(aIdx, 1)
    setDays(newDays)
  }

  if (isLoading) return <div className="p-6 text-zinc-500">Cargando editor...</div>

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/routines')} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Editar Rutina</h1>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-500 text-zinc-950 p-2 rounded-xl flex items-center gap-2 font-bold disabled:opacity-50">
          <Save size={20} /> {saveMutation.isPending ? '...' : 'Guardar'}
        </button>
      </div>

      <div className="bg-zinc-900 p-4 rounded-2xl mb-6">
        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Nombre de la Rutina</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 transition-colors mb-4" />
        
        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Carpeta (Opcional)</label>
        <input type="text" placeholder="Ej: Hipertrofia, Pierna, Viajes..." value={folder} onChange={(e) => setFolder(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 transition-colors mb-4" />

        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Notas u Objetivo</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 transition-colors resize-none h-24" />
      </div>

      {days.map((day, dIdx) => (
        <div key={dIdx} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <input type="text" value={day.name} onChange={(e) => { const newDays = [...days]; newDays[dIdx].name = e.target.value; setDays(newDays) }} className="bg-transparent text-lg font-bold text-emerald-500 border-b border-zinc-700 outline-none w-1/2 focus:border-emerald-400" />
            <button onClick={() => removeDay(dIdx)} className="text-red-500 p-2 bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            {day.exercises.map((ex: any, eIdx: number) => (
              <div key={eIdx} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <select value={ex.exercise_id} onChange={(e) => updateExercise(dIdx, eIdx, 'exercise_id', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 text-sm font-bold rounded-lg p-2 outline-none text-zinc-200">
                    {allExercises.map((catEx: any) => <option key={catEx.id} value={catEx.id}>{catEx.name}</option>)}
                  </select>
                  <button onClick={() => removeExercise(dIdx, eIdx)} className="text-zinc-500 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Series</label>
                    <input type="number" value={ex.target_sets} onChange={(e) => updateExercise(dIdx, eIdx, 'target_sets', parseInt(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-center mt-1 outline-none focus:border-emerald-500 text-sm font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Reps</label>
                    <input type="number" value={ex.target_reps} onChange={(e) => updateExercise(dIdx, eIdx, 'target_reps', parseInt(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-center mt-1 outline-none focus:border-emerald-500 text-sm font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold truncate block">Peso inicial</label>
                    <input type="number" step="any" placeholder="-" value={ex.weight} onChange={(e) => updateExercise(dIdx, eIdx, 'weight', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-center mt-1 outline-none focus:border-emerald-500 text-sm text-emerald-400 font-bold" />
                  </div>
                </div>

                {/* ---> NUEVO: UI DE REEMPLAZOS FAVORITOS <--- */}
                <div className="mt-1 border-t border-zinc-800/50 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] text-yellow-500/80 uppercase font-bold tracking-wider">Reemplazos Fijos (Favoritos)</label>
                    <button onClick={() => addAlternative(dIdx, eIdx)} className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider bg-yellow-500/10 px-2 py-1 rounded">+ Añadir</button>
                  </div>
                  {ex.config?.routine_alternatives?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {ex.config.routine_alternatives.map((altId: string, aIdx: number) => (
                        <div key={aIdx} className="flex items-center gap-2">
                          <select value={altId} onChange={(e) => updateAlternative(dIdx, eIdx, aIdx, e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-800 text-xs font-medium rounded-lg p-2 outline-none text-zinc-300">
                            {allExercises.map((catEx: any) => <option key={catEx.id} value={catEx.id}>{catEx.name}</option>)}
                          </select>
                          <button onClick={() => removeAlternative(dIdx, eIdx, aIdx)} className="text-zinc-500 hover:text-red-500 p-1"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>

          <button onClick={() => addExercise(dIdx)} className="w-full py-3 bg-zinc-800/50 border border-zinc-700 border-dashed rounded-xl text-zinc-400 text-sm flex justify-center items-center gap-2">
            <Plus size={16} /> Agregar Ejercicio
          </button>
        </div>
      ))}

      <button onClick={addDay} className="w-full py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl font-bold flex justify-center items-center gap-2">
        <Plus size={20} /> Añadir Día de Entrenamiento
      </button>

      {showDeleteConfirm ? (
        <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-200 mt-12 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
          <p className="text-red-500 text-center font-bold text-sm">¿Seguro que quieres borrar esta rutina definitivamente?</p>
          <div className="flex gap-2">
            <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="flex-1 bg-red-500 text-white font-bold p-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50">
              {deleteMutation.isPending ? 'Borrando...' : 'Sí, borrar'}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold p-3 rounded-xl active:scale-95 transition-transform">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold active:scale-95 transition-transform mt-12">
          <Trash2 size={20} /> Eliminar Rutina
        </button>
      )}
    </div>
  )
}