import { supabase } from './supabase'
import type {
  Exercise,
  WorkoutExercise,
  WorkoutSessionOptions,
  WorkoutSessionWithSets,
} from '../types/workout'
import type { RoutineWithDays } from '../types/routine'
import type { ExistingPrRecord } from './prLogic'
import { buildPrCandidates } from './prLogic'

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  if (!('code' in error)) return false
  const code = String((error as { code?: string }).code)
  return code === '42P01' || code === 'PGRST205'
}

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
      routine_id,
      routine_day_id,
      workout_sets (
        exercise_id,
        routine_exercise_id,
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
  sessionOptions?: WorkoutSessionOptions
}

async function fetchExistingPrRecords(exerciseIds: string[]): Promise<ExistingPrRecord[]> {
  if (exerciseIds.length === 0) return []
  const { data, error } = await supabase
    .from('personal_records')
    .select('exercise_id, record_type, value')
    .in('exercise_id', exerciseIds)

  if (error) {
    if (isMissingTableError(error)) return []
    throw error
  }

  return (data ?? []) as ExistingPrRecord[]
}

async function savePrEvents(
  userId: string,
  sessionId: string,
  candidates: ExistingPrRecord[],
) {
  if (candidates.length === 0) return

  const recordsPayload = candidates.map((candidate) => ({
    user_id: userId,
    exercise_id: candidate.exercise_id,
    record_type: candidate.record_type,
    value: candidate.value,
    session_id: sessionId,
  }))

  const { error: recordsError } = await supabase
    .from('personal_records')
    .upsert(recordsPayload, { onConflict: 'user_id,exercise_id,record_type' })

  if (recordsError && !isMissingTableError(recordsError)) throw recordsError

  const { error: eventsError } = await supabase
    .from('feed_events')
    .insert(
      candidates.map((candidate) => ({
        user_id: userId,
        session_id: sessionId,
        event_type: 'pr_achieved',
        payload: candidate,
      })),
    )

  if (eventsError && !isMissingTableError(eventsError)) throw eventsError
}

export async function finishWorkoutSession({
  startTime,
  workoutExercises,
  sessionOptions,
}: FinishWorkoutInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay usuario autenticado')

  const { data: newSession, error: sessionError } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: user.id,
      start_time: startTime,
      routine_id: sessionOptions?.routine_id ?? null,
      routine_day_id: sessionOptions?.routine_day_id ?? null,
      disable_prs: sessionOptions?.disable_prs ?? false,
      config: sessionOptions?.config ?? null,
    })
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
      routine_exercise_id: set.routine_exercise_id ?? workoutEx.meta?.routine_exercise_id ?? null,
      superset_id: set.superset_id ?? workoutEx.meta?.superset_id ?? null,
      set_type: set.set_type ?? workoutEx.meta?.set_type ?? 'normal',
      pr_opt_out: set.pr_opt_out ?? workoutEx.meta?.pr_mode === 'opt_out',
      pr_fixed_weight: set.pr_fixed_weight ?? workoutEx.meta?.pr_fixed_weight ?? null,
    })),
  )

  if (allSetsToInsert.length === 0) return

  const { error: setsError } = await supabase
    .from('workout_sets')
    .insert(allSetsToInsert)

  if (setsError) throw setsError

  if (sessionOptions?.disable_prs) return

  const exerciseIds = [...new Set(workoutExercises.map((item) => item.exercise.id))]
  const existingRecords = await fetchExistingPrRecords(exerciseIds)
  const candidates = buildPrCandidates(workoutExercises, existingRecords)
  await savePrEvents(user.id, newSession.id, candidates)
}

export async function fetchRoutines(): Promise<RoutineWithDays[]> {
  const { data, error } = await supabase
    .from('routines')
    .select(`
      id,
      name,
      folder,
      notes,
      version,
      is_pr_opt_out,
      config,
      routine_days (
        id,
        routine_id,
        name,
        day_order,
        config,
        routine_exercises (
          id,
          routine_day_id,
          exercise_id,
          target_sets,
          target_reps,
          superset_id,
          set_type,
          pr_mode,
          pr_fixed_weight,
          config
        )
      )
    `)
    .order('name')

  if (error) {
    if (isMissingTableError(error)) return []
    throw error
  }

  const routines = (data ?? []) as RoutineWithDays[]
  return routines.map((routine) => ({
    ...routine,
    routine_days: (routine.routine_days ?? []).sort((a, b) => a.day_order - b.day_order),
  }))
}

export async function createRoutine(
  name: string,
  notes: string,
  exercises: { exercise_id: string; sets: number; reps: number | null }[]
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuario no autenticado')

  const { data: routine, error: routineErr } = await supabase
    .from('routines')
    .insert({ user_id: user.id, name, notes })
    .select('id')
    .single()

  if (routineErr) throw routineErr

  const { data: day, error: dayErr } = await supabase
    .from('routine_days')
    .insert({ routine_id: routine.id, name: 'Día 1', day_order: 1 })
    .select('id')
    .single()

  if (dayErr) throw dayErr

  const exercisesPayload = exercises.map((ex) => ({
    routine_day_id: day.id,
    exercise_id: ex.exercise_id,
    target_sets: ex.sets,
    target_reps: ex.reps,
  }))

  if (exercisesPayload.length > 0) {
    const { error: exercisesErr } = await supabase
      .from('routine_exercises')
      .insert(exercisesPayload)
      
    if (exercisesErr) throw exercisesErr
  }

  return routine.id
}

export async function deleteRoutine(routineId: string) {
  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', routineId)

  if (error) throw error
}

export async function fetchRoutineById(id: string): Promise<RoutineWithDays | null> {
  const { data, error } = await supabase
    .from('routines')
    .select(`
      id, name, folder, notes, version, is_pr_opt_out, config,
      routine_days (
        id, routine_id, name, day_order, config,
        routine_exercises (
          id, routine_day_id, exercise_id, target_sets, target_reps, superset_id, set_type, pr_mode, pr_fixed_weight, config
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }

  const routine = data as RoutineWithDays
  routine.routine_days = (routine.routine_days ?? []).sort((a, b) => a.day_order - b.day_order)
  return routine
}

export async function cloneRoutine(routineId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuario no autenticado')

  const original = await fetchRoutineById(routineId)
  if (!original) throw new Error('Rutina no encontrada')

  const { data: newRoutine, error: routineErr } = await supabase
    .from('routines')
    .insert({ 
      user_id: user.id, 
      name: `${original.name} (Clon)`, 
      folder: original.folder,
      notes: original.notes,
      is_pr_opt_out: original.is_pr_opt_out,
      config: original.config 
    })
    .select('id')
    .single()

  if (routineErr) throw routineErr

  for (const day of original.routine_days) {
    const { data: newDay, error: dayErr } = await supabase
      .from('routine_days')
      .insert({ 
        routine_id: newRoutine.id, 
        name: day.name, 
        day_order: day.day_order, 
        config: day.config 
      })
      .select('id')
      .single()
      
    if (dayErr) throw dayErr

    const exercisesPayload = (day.routine_exercises ?? []).map((ex) => ({
      routine_day_id: newDay.id,
      exercise_id: ex.exercise_id,
      target_sets: ex.target_sets,
      target_reps: ex.target_reps,
      superset_id: ex.superset_id,
      set_type: ex.set_type,
      pr_mode: ex.pr_mode,
      pr_fixed_weight: ex.pr_fixed_weight,
      config: ex.config
    }))

    if (exercisesPayload.length > 0) {
      const { error: exercisesErr } = await supabase
        .from('routine_exercises')
        .insert(exercisesPayload)
      if (exercisesErr) throw exercisesErr
    }
  }

  return newRoutine.id
}

export async function updateRoutine(
  routineId: string,
  name: string,
  notes: string,
  folder: string | null,
  days: any[]
) {
  const { error: updateErr } = await supabase
    .from('routines')
    .update({ name, notes, folder: folder || null })
    .eq('id', routineId);
  
  if (updateErr) throw updateErr;

  const { error: delErr } = await supabase
    .from('routine_days')
    .delete()
    .eq('routine_id', routineId);

  if (delErr) throw delErr;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const { data: newDay, error: dayErr } = await supabase
      .from('routine_days')
      .insert({ routine_id: routineId, name: day.name, day_order: day.day_order })
      .select('id')
      .single();
    
    if (dayErr) throw dayErr;

    if (day.exercises.length > 0) {
      const exPayload = day.exercises.map((ex: any) => ({
        routine_day_id: newDay.id,
        exercise_id: ex.exercise_id,
        target_sets: ex.target_sets,
        target_reps: ex.target_reps,
      }));
      const { error: exErr } = await supabase.from('routine_exercises').insert(exPayload);
      if (exErr) throw exErr;
    }
  }
}
// ---> NUEVO: CRUD de Ejercicios <---
export async function createExercise(exerciseData: Partial<Exercise>) {
  const { data, error } = await supabase
    .from('exercises')
    .insert(exerciseData)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateExercise(id: string, exerciseData: Partial<Exercise>) {
  const { data, error } = await supabase
    .from('exercises')
    .update(exerciseData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExercise(id: string) {
  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('id', id)
  if (error) throw error
}
