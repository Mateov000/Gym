import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarDays, Play } from 'lucide-react'
import { fetchExercises, fetchRoutines } from '../lib/queries'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { resolveExerciseConfig } from '../lib/configCascade'
import type { Exercise } from '../types/workout'
import type { RoutineDayWithExercises, RoutineWithDays } from '../types/routine'

function buildExerciseMap(exercises: Exercise[]) {
  return new Map(exercises.map((exercise) => [exercise.id, exercise]))
}

export default function Routines() {
  const navigate = useNavigate()
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

      const resolvedExerciseConfig = resolveExerciseConfig(
        resolvedSessionConfig,
        day.config,
        routineExercise.config ?? null,
      )

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

  return (
    <div className="p-6 pb-24 min-h-screen">
      <h1 className="text-3xl font-bold text-zinc-100 mb-6">Rutinas</h1>

      {isLoading ? (
        <div className="text-center text-zinc-500 mt-10">Cargando rutinas...</div>
      ) : routines.length === 0 ? (
        <div className="text-center mt-10 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl">
          <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Todavía no hay rutinas creadas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {routines.map((routine) => (
            <div key={routine.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <h2 className="text-xl font-bold text-zinc-100">{routine.name}</h2>
              {routine.notes && <p className="text-sm text-zinc-400 mt-1">{routine.notes}</p>}

              <div className="mt-4 flex flex-col gap-2">
                {(routine.routine_days ?? []).map((day) => (
                  <button
                    key={day.id}
                    onClick={() => startRoutineDay(routine, day)}
                    className="w-full border border-zinc-700 bg-zinc-950 rounded-xl p-3 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-zinc-200">
                        <CalendarDays size={16} />
                        <span className="font-semibold">{day.name}</span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {(day.routine_exercises ?? []).length} ejercicios
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-500">
                      <Play size={14} />
                      Empezar día
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
