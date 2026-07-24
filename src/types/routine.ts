import type { ExerciseConfig } from './workout'

export interface Routine {
  id: string
  name: string
  notes?: string | null
  version?: number
  is_pr_opt_out?: boolean
  config?: ExerciseConfig | null
}

export interface RoutineDay {
  id: string
  routine_id: string
  name: string
  day_order: number
  config?: ExerciseConfig | null
}

export interface RoutineExercise {
  id: string
  routine_day_id: string
  exercise_id: string
  target_sets?: number | null
  target_reps?: number | null
  superset_id?: string | null
  set_type?: 'normal' | 'drop_set'
  pr_mode?: 'global' | 'fixed' | 'opt_out'
  pr_fixed_weight?: number | null
  config?: ExerciseConfig | null
}

export interface RoutineDayWithExercises extends RoutineDay {
  routine_exercises: RoutineExercise[]
}

export interface RoutineWithDays extends Routine {
  routine_days: RoutineDayWithExercises[]
}
