import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Share2, Dumbbell, Play } from 'lucide-react'
import { fetchRoutines, deleteRoutine } from '../lib/queries'
import { useWorkoutStore } from '../store/useWorkoutStore'

export default function Routines() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // Traemos la función para iniciar rutinas desde tu estado global
  const { startRoutine } = useWorkoutStore() 
  
  const { data: routines = [], isLoading } = useQuery({
    queryKey: ['routines'],
    queryFn: fetchRoutines
  })

  const deleteRoutineMutation = useMutation({
    mutationFn: deleteRoutine,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routines'] }),
    onError: (err: any) => alert(`Error al eliminar: ${err.message}`)
  })

  const [routineToDelete, setRoutineToDelete] = useState<string | null>(null)

  const handleShare = (e: React.MouseEvent, routineId: string) => {
    e.stopPropagation()
    const url = `${window.location.origin}/routines/shared/${routineId}`
    navigator.clipboard.writeText(url)
    alert('¡Enlace para clonar rutina copiado al portapapeles!')
  }

  const handleStartDay = (routine: any, day: any) => {
    // Iniciamos la sesión en el store y saltamos a la pantalla de Workout
    startRoutine(routine, day)
    navigate('/workout')
  }

  return (
    <div className="p-4 pb-24 min-h-screen text-zinc-100 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tus Rutinas</h1>
      </div>

      {isLoading ? (
        <div className="text-center text-zinc-500 mt-10 animate-pulse">Cargando rutinas...</div>
      ) : routines.length === 0 ? (
        <div className="text-center mt-10 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl">
          <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No tienes rutinas guardadas.</p>
          <p className="text-sm text-zinc-500 mt-2">Crea una plantilla para no tener que elegir ejercicios todos los días.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {routines.map((routine: any) => (
            <div 
              key={routine.id} 
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">{routine.name}</h3>
                  {routine.description && (
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{routine.description}</p>
                  )}
                </div>
              </div>

              {/* ---> NUEVO: Botones para Iniciar cada Día de la Rutina <--- */}
              <div className="mt-2 mb-2">
                {routine.routine_days && routine.routine_days.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Iniciar Entrenamiento:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {routine.routine_days.map((day: any) => (
                        <button
                          key={day.id}
                          onClick={() => handleStartDay(routine, day)}
                          className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                        >
                          <Play size={14} fill="currentColor" />
                          <span className="truncate max-w-[150px]">{day.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600 italic">No hay días configurados.</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800/50">
                <button 
                  onClick={(e) => { e.stopPropagation(); navigate(`/routines/${routine.id}/edit`) }}
                  className="flex-1 text-zinc-300 hover:text-emerald-500 bg-zinc-950 p-2.5 rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-2 text-sm font-bold border border-zinc-800"
                >
                  <Edit2 size={16} /> Editar
                </button>
                
                <button 
                  onClick={(e) => handleShare(e, routine.id)}
                  className="text-zinc-400 hover:text-blue-400 bg-zinc-950 p-2.5 rounded-xl transition-colors active:scale-95 border border-zinc-800"
                  aria-label="Compartir rutina"
                >
                  <Share2 size={18} />
                </button>

                {routineToDelete === routine.id ? (
                  <div className="flex items-center gap-2 animate-in fade-in duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteRoutineMutation.mutate(routine.id)
                        setRoutineToDelete(null)
                      }}
                      className="bg-red-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
                    >
                      Sí, borrar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRoutineToDelete(null)
                      }}
                      className="bg-zinc-700 text-zinc-300 font-bold px-4 py-2.5 rounded-xl text-sm active:scale-95 transition-transform"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRoutineToDelete(routine.id)
                    }}
                    disabled={deleteRoutineMutation.isPending}
                    className="text-zinc-400 hover:text-red-500 bg-zinc-950 p-2.5 rounded-xl transition-colors active:scale-95 border border-zinc-800 disabled:opacity-50"
                    aria-label="Eliminar rutina"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button 
        onClick={() => navigate('/routines/new')}
        className="fixed bottom-24 right-6 bg-emerald-500 text-zinc-950 p-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-transform z-40"
      >
        <Plus size={28} strokeWidth={3} />
      </button>
    </div>
  )
}
