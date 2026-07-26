export interface Exercise {
  id: string
  name: string
  muscle_group: string | null
  description?: string | null 
  image_url?: string | null   

  alternative_exercise_ids?: string[] | null
  alternatives?: Exercise[]
  config?: ExerciseConfig | null
  user_id?: string | null 
  is_public?: boolean     
}

export interface LoggedSet {
  weight: number
  reps: number
  unit?: string // <--- NUEVO: La unidad se pega a la serie
  routine_exercise_id?: string
  superset_id?: string | null
  set_type?: 'normal' | 'drop_set'
  pr_opt_out?: boolean
  pr_fixed_weight?: number | null
}

export interface ExerciseConfig {
  stepper_increment?: number
  rest_time_seconds?: number
  use_rir?: boolean
  weight_unit?: string // <--- AHORA ACEPTA CUALQUIER TEXTO
  custom_units?: string[] // <--- NUEVO: Para guardar unidades creadas
  bar_weight?: number
  available_plates?: number[]
  show_images?: boolean
  show_google_search?: boolean
  sets_config?: { reps: number; weight: number }[]
}

export interface WorkoutSessionOptions {
  routine_id?: string | null
  routine_day_id?: string | null
  disable_prs?: boolean
  config?: ExerciseConfig | null
}

export interface WorkoutExerciseMeta {
  routine_exercise_id?: string
  superset_id?: string | null
  set_type?: 'normal' | 'drop_set'
  default_reps?: number | null
  default_weight?: number | null
  pr_mode?: 'global' | 'fixed' | 'opt_out'
  pr_fixed_weight?: number | null
  config?: ExerciseConfig | null
  active_unit?: string // <--- NUEVO: La unidad activa durante el entrenamiento
}

export interface WorkoutExercise {
  exercise: Exercise
  sets: LoggedSet[]
  meta?: WorkoutExerciseMeta
}

export interface PersistedWorkoutSet {
  id?: string
  exercise_id: string
  routine_exercise_id?: string | null
  weight: number
  reps: number
  unit?: string // <--- NUEVO: La unidad viene de la BD
  is_completed: boolean
}

export interface WorkoutSessionWithSets {
  id: string
  start_time: string
  end_time?: string | null
  routine_id?: string | null
  routine_day_id?: string | null
  workout_sets: PersistedWorkoutSet[] | null
}