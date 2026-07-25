import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, Save, Plus, GripVertical, Trash2, Dumbbell 
} from 'lucide-react'
import { 
  fetchRoutineById, 
  fetchExercises, 
  updateRoutine, 
  deleteRoutine 
} from '../lib/queries'
import type { 
  RoutineWithDays, 
  RoutineDayWithExercises, 
  RoutineExerciseWithDetails, 
  Exercise 
} from '../types/workout'
import ExerciseConfigModal from '../components/ExerciseConfigModal'

export default function RoutineEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 1. Estados Locales
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [days, setDays] = useState<Partial<RoutineDayWithExercises>[]>([])
  
  // Estado para controlar qué día estamos editando (añadiendo ejercicios)
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null)
  
  // Estado para el modal de configuración de un ejercicio específico
  const [editingConfigEx, setEditingConfigEx] = useState<{
    dayIdx: number
    exIdx: number
    data: Partial<RoutineExerciseWithDetails>
  } | null>(null)

  // ---> NUEVO: Estado para la confirmación visual de borrado <---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 2. Consultas (Queries)
  const { data: catalog = [] } = useQuery<Exercise[]>({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises
  })

  const { data: initialRoutine, isLoading } = useQuery<RoutineWithDays | null>({
    queryKey: ['routine', id],
    queryFn: () => (id ? fetchRoutineById(id) : Promise.resolve(null)),
    enabled: !!id
  })

  // 3. Inicializar el formulario cuando llegan los datos
  useEffect(() => {
    if (initialRoutine) {
      setName(initialRoutine.name)
      setDescription(initialRoutine.description || '')
      setDays(
        (initialRoutine.routine_days || []).map(day => ({
          ...day,
          routine_exercises: [...(day.routine_exercises || [])]
        }))
      )
    }
  }, [initialRoutine])

  // 4. Mutaciones
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No hay ID de rutina')
      return updateRoutine(id, { name, description }, days)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      queryClient.invalidateQueries({ queryKey: ['routine', id] })
      navigate('/routines')
    },
    onError: (err: any) => alert(`Error al guardar: ${err.message}`)
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error('No hay ID de rutina')
      return deleteRoutine(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (err: any) => alert(`Error al eliminar: ${err.message}`)
  })

  // 5. Manejadores de Días
  const handleAddDay = () => {
    setDays([...days, { name: `Día ${days.length + 1}`, routine_exercises: [] }])
  }

  const handleUpdateDayName = (idx: number, newName: string) => {
    const updated = [...days]
    updated[idx] = { ...updated[idx], name: newName }
    setDays(updated)
  }

  const handleRemoveDay = (idx: number) => {
    if (window.confirm('¿Seguro que quieres eliminar este día y todos sus ejercicios?')) {
      const updated = [...days]
      updated.splice(idx, 1)
      setDays(updated)
      if (activeDayIndex === idx) setActiveDayIndex(null)
    }
  }

  // 6. Manejadores de Ejercicios
  const handleAddExerciseToDay = (ex: Exercise) => {
    if (activeDayIndex === null) return

    const newRoutineExercise: Partial<RoutineExerciseWithDetails> = {
      exercise_id: ex.id,
      exercise: ex,
      order_index: days[activeDayIndex].routine_exercises?.length || 0,
      config: null
    }

    const updatedDays = [...days]
    const currentExercises = updatedDays[activeDayIndex].routine_exercises || []
    updatedDays[activeDayIndex].routine_exercises = [...currentExercises, newRoutineExercise as any]
    
    setDays(updatedDays)
    setActiveDayIndex(null) // Cerramos el selector
  }

  const handleRemoveExercise = (dayIdx: number, exIdx: number) => {
    const updatedDays = [...days]
    const currentExercises = [...(updatedDays[dayIdx].routine_exercises || [])]
    currentExercises.splice(exIdx, 1)
    updatedDays[dayIdx].routine_exercises = currentExercises
    setDays(updatedDays)
  }

  const handleSaveConfig = (config: any) => {
    if (!editingConfigEx) return
    const { dayIdx, exIdx } = editingConfigEx
    
    const updatedDays = [...days]
    const currentExercises = [...(updatedDays[dayIdx].routine_exercises || [])]
    currentExercises[exIdx] = { ...currentExercises[exIdx], config }
    updatedDays[dayIdx].routine_exercises = currentExercises
    
    setDays(updatedDays)
    setEditingConfigEx(null)
  }

  // 7. Renderizado
  if (isLoading) {
    return <div className="p-6 text-center text-zinc-500 min-h-screen">Cargando rutina...</div>
  }

  return (
    <div className="p-4 pb-32 min-h-screen text-zinc-100 relative">
      {/* Cabecera */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/routines')} 
          className="text-zinc-400 p-2 bg-zinc-900 rounded-xl"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold flex-1 truncate">Editar Rutina</h1>
        <button 
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !name.trim() || days.length === 0}
          className="p-2 bg-emerald-500 text-zinc-950 rounded-xl font-bold disabled:opacity-50"
        >
          <Save size={20} />
        </button>
      </div>

      {/* Información Básica */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl mb-6">
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la rutina (ej. Push Pull Legs)"
          className="w-full bg-transparent text-xl font-bold text-zinc-100 outline-none mb-3"
        />
        <textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción o notas generales (opcional)"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-300 outline-none focus:border-emerald-500 resize-none h-20"
        />
      </div>

      {/* Días de la Rutina */}
      <div className="space-y-6 mb-8">
        {days.map((day, dayIdx) => (
          <div key={dayIdx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4">
              <input 
                type="text" 
                value={day.name}
                onChange={(e) => handleUpdateDayName(dayIdx, e.target.value)}
                className="bg-transparent text-lg font-bold text-emerald-500 outline-none flex-1"
                placeholder="Nombre del día (ej. Pecho y Tríceps)"
              />
              <button 
                onClick={() => handleRemoveDay(dayIdx)}
                className="text-zinc-500 hover:text-red-500 p-2"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Ejercicios del Día */}
            <div className="flex flex-col gap-2 mb-4">
              {(day.routine_exercises || []).map((routineEx, exIdx) => (
                <div 
                  key={exIdx} 
                  className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3"
                >
                  <GripVertical size={16} className="text-zinc-600 flex-shrink-0 cursor-grab" />
                  
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {routineEx.exercise?.image_url ? (
                      <img src={routineEx.exercise.image_url} alt="demo" className="w-full h-full object-cover" />
                    ) : (
                      <Dumbbell size={16} className="text-zinc-700" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-zinc-100 truncate">{routineEx.exercise?.name}</p>
                    <p className="text-[10px] text-emerald-500 uppercase">
                      {routineEx.config?.sets_config?.length || 3} Series
                    </p>
                  </div>

                  <button 
                    onClick={() => setEditingConfigEx({ dayIdx, exIdx, data: routineEx })}
                    className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs font-bold text-zinc-300"
                  >
                    Config
                  </button>
                  <button 
                    onClick={() => handleRemoveExercise(dayIdx, exIdx)}
                    className="p-2 text-zinc-500 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setActiveDayIndex(dayIdx)}
              className="w-full py-3 bg-zinc-950 border border-zinc-800 border-dashed rounded-xl text-zinc-400 font-bold text-sm hover:text-emerald-500 hover:border-emerald-500/50 transition-colors"
            >
              + Añadir Ejercicio
            </button>
          </div>
        ))}
      </div>

      <button 
        onClick={handleAddDay}
        className="w-full py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl font-bold flex items-center justify-center gap-2 mb-12"
      >
        <Plus size={20} /> Añadir un nuevo Día
      </button>

      {/* ---> NUEVO: Confirmación visual sin window.confirm (Problema INP resuelto) <--- */}
      {showDeleteConfirm ? (
        <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-200 mt-8 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
          <p className="text-red-500 text-center font-bold text-sm">¿Seguro que quieres borrar esta rutina definitivamente?</p>
          <div className="flex gap-2">
            <button
              onClick={() => deleteMutation.mutate()}
              className="flex-1 bg-red-500 text-white font-bold p-3 rounded-xl active:scale-95 transition-transform"
            >
              Sí, borrar
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold p-3 rounded-xl active:scale-95 transition-transform"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold active:scale-95 transition-transform mt-8"
        >
          <Trash2 size={20} /> Eliminar Rutina
        </button>
      )}

      {/* Modal del Catálogo */}
      {activeDayIndex !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col animate-in slide-in-from-bottom">
          <div className="p-4 bg-zinc-950 flex justify-between items-center border-b border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-100">Seleccionar Ejercicio</h2>
            <button onClick={() => setActiveDayIndex(null)} className="p-2 text-zinc-400 font-bold">X</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {catalog.map(ex => (
              <div 
                key={ex.id}
                onClick={() => handleAddExerciseToDay(ex)}
                className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex items-center gap-4 cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 bg-zinc-950 rounded-lg flex items-center justify-center overflow-hidden">
                  {ex.image_url ? (
                    <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" />
                  ) : (
                    <Dumbbell size={16} className="text-zinc-700" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-zinc-100">{ex.name}</p>
                  <p className="text-[10px] text-zinc-500 uppercase">{ex.muscle_group}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Configuración (Series, Reps, etc) */}
      {editingConfigEx && (
        <ExerciseConfigModal 
          isOpen={true}
          onClose={() => setEditingConfigEx(null)}
          onSave={handleSaveConfig}
          initialConfig={editingConfigEx.data.config || undefined}
          exerciseName={editingConfigEx.data.exercise?.name || 'Ejercicio'}
        />
      )}
    </div>
  )
}
