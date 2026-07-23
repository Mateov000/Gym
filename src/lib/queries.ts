import { supabase } from './supabase'
import type { Exercise, WorkoutExercise, WorkoutSessionWithSets } from '../types/workout'

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name')

  if (error) throw error
  return (data ?? []) as Exercise[]
}

export async function fetchWorkoutHistory(limit = 30): Promise<WorkoutSessionWithSets[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      id,
      start_time,
      workout_sets (
        exercise_id,
        weight,
        reps,
        is_completed
      )
    `)
    .order('start_time', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as WorkoutSessionWithSets[]
}

interface FinishWorkoutInput {
  startTime: string
  workoutExercises: WorkoutExercise[]
}

export async function finishWorkoutSession({ startTime, workoutExercises }: FinishWorkoutInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay usuario autenticado')

  const { data: newSession, error: sessionError } = await supabase
    .from('workout_sessions')
    .insert({ user_id: user.id, start_time: startTime })
    .select('id')
    .single()

  if (sessionError) throw sessionError

  const allSetsToInsert = workoutExercises.flatMap((workoutEx) =>
    workoutEx.sets.map((set) => ({
      session_id: newSession.id,
      exercise_id: workoutEx.exercise.id,
      weight: set.weight,
      reps: set.reps,
      is_completed: true,
    })),
  )

  if (allSetsToInsert.length === 0) return

  const { error: setsError } = await supabase
    .from('workout_sets')
    .insert(allSetsToInsert)

  if (setsError) throw setsError
}
