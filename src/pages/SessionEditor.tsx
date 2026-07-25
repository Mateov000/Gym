import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2, Save, Calendar } from 'lucide-react'
import { fetchSessionById, deleteWorkoutSession, updateWorkoutSet, deleteWorkoutSet, fetchExercises } from '../lib/queries'

export default function SessionEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => fetchSessionById(id!),
    enabled: !!id
  })

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  const deleteSessionMutation = useMutation({
    mutationFn: deleteWorkoutSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history'] })
      navigate('/')
    },
    onError: (err: any) => alert(`Error al eliminar: ${err.message}`)
  })

  const updateSetMutation = useMutation({
    mutationFn: ({ setId, weight, reps }: { setId: string, weight: number, reps: number }) => updateWorkoutSet(setId, weight, reps),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session', id] })
  })

  const deleteSetMutation = useMutation({
    mutationFn: deleteWorkoutSet,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session', id] })
  })

  const handleDeleteSession = () => {
    if (window.confirm('¿Eliminar este entrenamiento completo de tu historial? Esto no se puede deshacer.')) {
      deleteSessionMutation.mutate(id!)
    }
  }

  if (sessionLoading) return <div className="p-6 text-zinc-500">Cargando entrenamiento...</div>
  if (!session) return <div className="p-6 text-zinc-500">Entrenamiento no encontrado.</div>

  // Agrupamos las series por ejercicio para visualizarlas mejor
  const groupedSets = (session.workout_sets || []).reduce((acc, set) => {
    if (!acc[set.exercise_id]) acc[set.exercise_id] = []
    acc[set.exercise_id].push(set)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Editar Historial</h1>
        <button onClick={handleDeleteSession} className="text-red-500 p-2 bg-red-500/10 rounded-xl">
          <Trash2 size={20} />
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <Calendar className="text-emerald-500" />
        <div>
          <p className="font-bold">{new Date(session.start_time).toLocaleDateString()}</p>
          <p className="text-xs text-zinc-400">{new Date(session.start_time).toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {Object.entries(groupedSets).map(([exerciseId, sets]) => {
          const exName = exercises.find(e => e.id === exerciseId)?.name || 'Ejercicio Desconocido'
          
          return (
            <div key={exerciseId} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
              <h3 className="font-bold text-emerald-500 mb-4">{exName}</h3>
              <div className="flex flex-col gap-3">
                {sets.map((set, idx) => (
                  <SetRow key={set.id} set={set} index={idx} onUpdate={updateSetMutation.mutate} onDelete={deleteSetMutation.mutate} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Componente individual para editar una serie en vivo
function SetRow({ set, index, onUpdate, onDelete }: any) {
  const [weight, setWeight] = useState(set.weight)
  const [reps, setReps] = useState(set.reps)
  const [isEdited, setIsEdited] = useState(false)

  const handleSave = () => {
    onUpdate({ setId: set.id, weight, reps })
    setIsEdited(false)
  }

  const handleWeightChange = (e: any) => { setWeight(Number(e.target.value)); setIsEdited(true) }
  const handleRepsChange = (e: any) => { setReps(Number(e.target.value)); setIsEdited(true) }

  return (
    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
      <span className="text-xs text-zinc-500 w-12 font-bold">Set {index + 1}</span>
      <input type="number" value={weight} onChange={handleWeightChange} className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-center text-sm outline-none focus:border-emerald-500" />
      <span className="text-zinc-500 text-xs">kg</span>
      <span className="text-zinc-700">×</span>
      <input type="number" value={reps} onChange={handleRepsChange} className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-center text-sm outline-none focus:border-emerald-500" />
      <span className="text-zinc-500 text-xs flex-1">reps</span>
      
      {isEdited ? (
        <button onClick={handleSave} className="p-2 text-emerald-500 bg-emerald-500/10 rounded-lg"><Save size={16}/></button>
      ) : (
        <button onClick={() => { if(window.confirm('¿Borrar serie?')) onDelete(set.id) }} className="p-2 text-red-500 bg-red-500/10 rounded-lg"><Trash2 size={16}/></button>
      )}
    </div>
  )
}