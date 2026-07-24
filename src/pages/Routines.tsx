import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, CalendarDays, Play, Plus, Share2, Trash2, Edit, Copy, Folder } from 'lucide-react'
import { fetchExercises, fetchRoutines, deleteRoutine } from '../lib/queries'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { resolveExerciseConfig } from '../lib/configCascade'
import type { Exercise } from '../types/workout'
import type { RoutineDayWithExercises, RoutineWithDays } from '../types/routine'

function buildExerciseMap(exercises: Exercise[]) {
  return new Map(exercises.map((exercise) => [exercise.id, exercise]))
}

export default function Routines() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { startSession, addExercise, activeSession } = useWorkoutStore()

  const { data: routines = [], isLoading } = useQuery({
    queryKey: ['routines'],
    queryFn: fetchRoutines,
  })

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  const exerciseMap = useMemo(() => buildExerciseMap(exercises), [exercises])

  // ---> NUEVO: Lógica que agrupa automáticamente las rutinas por su carpeta <---
  const groupedRoutines = useMemo(() => {
    return routines.reduce((acc, routine) => {
      const folderName = routine.folder || 'Mis Rutinas' // Si no tiene carpeta, va a "Mis Rutinas"
      if (!acc[folderName]) acc[folderName] = []
      acc[folderName].push(routine)
      return acc
    }, {} as Record<string, RoutineWithDays[]>)
  }, [routines])

  const deleteMutation = useMutation({
    mutationFn: deleteRoutine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
    },
    onError: (error: any) => alert(`Error al eliminar: ${error.message}`)
  })

  const startRoutineDay = (routine: RoutineWithDays, day: RoutineDayWithExercises) => {
    const resolvedSessionConfig = resolveExerciseConfig(null, routine.config, day.config)
    const shouldStartFresh = !activeSession || activeSession.routine_day_id !== day.id

    if (shouldStartFresh) {
      startSession({
        routine_id: routine.id,
        routine_day_id: day.id,
        disable_prs: routine.is_pr_opt_out,
        config: resolvedSessionConfig,
      })
    }

    for (const routineExercise of day.routine_exercises) {
      const baseExercise = exerciseMap.get(routineExercise.exercise_id)
      if (!baseExercise) continue
      const resolvedExerciseConfig = resolveExerciseConfig(resolvedSessionConfig, day.config, routineExercise.config ?? null)

      addExercise(baseExercise, {
        routine_exercise_id: routineExercise.id,
        superset_id: routineExercise.superset_id,
        set_type: routineExercise.set_type ?? 'normal',
        default_reps: routineExercise.target_reps,
        pr_mode: routineExercise.pr_mode ?? 'global',
        pr_fixed_weight: routineExercise.pr_fixed_weight,
        config: resolvedExerciseConfig,
      })
    }
    navigate('/workout')
  }

  const handleShare = async (e: React.MouseEvent, routine: RoutineWithDays) => {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/routines/shared/${routine.id}`
    const shareData = { title: `Rutina: ${routine.name}`, text: `¡Mira esta rutina en Gym PWA! 💪`, url: shareUrl }
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try { await navigator.share(shareData) } catch (err) { console.error(err) }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      alert('¡Enlace copiado al portapapeles!')
    }
  }

  const handleExportText = async (e: React.MouseEvent, routine: RoutineWithDays) => {
    e.stopPropagation()
    let text = `🏋️ Rutina: ${routine.name}\n`
    if (routine.notes) text += `📝 Notas: ${routine.notes}\n`
    text += `\n`
    const days = routine.routine_days || []
    days.forEach((day, index) => {
      text += `📅 ${day.name || `Día ${index + 1}`}\n`
      const routineExercises = day.routine_exercises || []
      routineExercises.forEach((ex) => {
        const baseEx = exerciseMap.get(ex.exercise_id)
        const exName = baseEx ? baseEx.name : 'Ejercicio Desconocido'
        text += `  • ${exName}: ${ex.target_sets} series × ${ex.target_reps} reps\n`
      })
      text += `\n`
    })
    try {
      await navigator.clipboard.writeText(text.trim())
      alert('¡Rutina copiada en formato texto!')
    } catch (err) { alert('Error al copiar el texto.') }
  }

  const handleDelete = (e: React.MouseEvent, routineId: string) => {
    e.stopPropagation()
    if (window.confirm('¿Estás seguro de eliminar esta rutina?')) {
      deleteMutation.mutate(routineId)
    }
  }

  return (
    <div className="p-6 pb-24 min-h-screen relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-zinc-100">Rutinas</h1>
      </div>

      {isLoading ? (
        <div className="text-center text-zinc-500 mt-10">Cargando rutinas...</div>
      ) : routines.length === 0 ? (
        <div className="text-center mt-10 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl flex flex-col items-center">
          <BookOpen className="w-12 h-12 text-zinc-600 mb-4" />
          <p className="text-zinc-400 mb-6">Todavía no hay rutinas creadas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* ---> NUEVO: Iteramos sobre las carpetas renderizando grupos <--- */}
          {Object.entries(groupedRoutines).map(([folderName, folderRoutines]) => (
            <div key={folderName} className="flex flex-col gap-4">
              
              {/* Título de la Carpeta */}
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Folder size={20} className="text-emerald-500" />
                <h2 className="text-lg font-bold uppercase tracking-wide">{folderName}</h2>
              </div>

              {/* Rutinas dentro de esta carpeta */}
              {folderRoutines.map((routine) => (
                <div key={routine.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-zinc-100">{routine.name}</h3>
                      {routine.notes && <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{routine.notes}</p>}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => handleExportText(e, routine)} className="text-zinc-400 hover:text-white bg-zinc-800 p-2 rounded-xl transition-colors active:scale-95"><Copy size={20} /></button>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/routines/${routine.id}/edit`); }} className="text-zinc-400 hover:text-blue-500 bg-zinc-800 p-2 rounded-xl transition-colors active:scale-95"><Edit size={20} /></button>
                      <button onClick={(e) => handleShare(e, routine)} className="text-zinc-400 hover:text-emerald-500 bg-zinc-800 p-2 rounded-xl transition-colors active:scale-95"><Share2 size={20} /></button>
                      <button onClick={(e) => handleDelete(e, routine.id)} disabled={deleteMutation.isPending} className="text-zinc-400 hover:text-red-500 bg-zinc-800 p-2 rounded-xl transition-colors active:scale-95 disabled:opacity-50"><Trash2 size={20} /></button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    {(routine.routine_days ?? []).map((day) => (
                      <button key={day.id} onClick={() => startRoutineDay(routine, day)} className="w-full border border-zinc-700 bg-zinc-950 rounded-xl p-3 text-left active:scale-[0.99] transition-transform flex flex-col">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 text-zinc-200">
                            <CalendarDays size={16} className="text-zinc-400"/>
                            <span className="font-semibold">{day.name}</span>
                          </div>
                          <span className="text-xs font-medium bg-zinc-800 px-2 py-1 rounded-md text-zinc-300">
                            {(day.routine_exercises ?? []).length} ej.
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-500 uppercase tracking-wide">
                          <Play size={12} fill="currentColor" /> Empezar sesión
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

        </div>
      )}

      <button onClick={() => navigate('/routines/new')} className="fixed bottom-24 right-6 bg-emerald-500 text-zinc-950 p-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-transform z-40">
        <Plus size={28} strokeWidth={3} />
      </button>
    </div>
  )
}
