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
  unit?: string 
  rir?: number 
  routine_exercise_id?: string
  superset_id?: string | null
  set_type?: 'normal' | 'drop_set' | 'warm_up' 
  pr_opt_out?: boolean
  pr_fixed_weight?: number | null
}

export interface ExerciseConfig {
  stepper_increment?: number
  rest_time_seconds?: number
  use_rir?: boolean
  weight_unit?: string 
  custom_units?: string[] 
  bar_weight?: number
  available_plates?: number[]
  show_images?: boolean
  show_google_search?: boolean
  sets_config?: { reps: number; weight: number }[]
  routine_alternatives?: string[] 
  uses_barbell?: boolean
  equipment?: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'smith' | 'kettlebell' | 'other'
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
  set_type?: 'normal' | 'drop_set' | 'warm_up'
  default_reps?: number | null
  default_weight?: number | null
  pr_mode?: 'global' | 'fixed' | 'opt_out'
  pr_fixed_weight?: number | null
  config?: ExerciseConfig | null
  active_unit?: string 
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
  unit?: string 
  rir?: number 
  set_type?: 'normal' | 'drop_set' | 'warm_up' 
  is_completed: boolean
}

export interface WorkoutSessionWithSets {
  id: string
  start_time: string
  end_time?: string | null
  notes?: string | null 
  routine_id?: string | null
  routine_day_id?: string | null
  workout_sets: PersistedWorkoutSet[] | null
}

// ---> NUEVO: Cola de sincronización local <---
export interface PendingSession {
  id: string;
  startTime: string;
  endTime: string;
  workoutExercises: WorkoutExercise[];
  sessionNotes: string;
  sessionOptions: WorkoutSessionOptions;
}