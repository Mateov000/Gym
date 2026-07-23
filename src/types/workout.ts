export interface Exercise {
  id: string
  name: string
  muscle_group: string | null
  alternative_exercise_ids?: string[] | null
  alternatives?: Exercise[]
}

export interface LoggedSet {
  weight: number
  reps: number
}

export interface WorkoutExercise {
  exercise: Exercise
  sets: LoggedSet[]
}

export interface PersistedWorkoutSet {
  exercise_id: string
  weight: number
  reps: number
  is_completed: boolean
}

export interface WorkoutSessionWithSets {
  id: string
  start_time: string
  workout_sets: PersistedWorkoutSet[] | null
}
