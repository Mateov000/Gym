// Tipos para el JSONB de Configuración
export interface GlobalConfig {
  show_images: boolean;
  show_google_search: boolean;
  weight_unit: 'kg' | 'lbs' | 'bodyweight';
  bar_weight: number;
  available_plates: number[];
}

export interface LocalUIOptions {
  stepper_increment: number;
  rest_time_seconds: number;
  use_rir: boolean;
}

// Estructura de la sesión activa (Lo que ocurre en el gimnasio)
export interface ActiveWorkoutSet {
  id: string; 
  routine_exercise_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  rir?: number;
  is_completed: boolean;
}

export interface ActiveSession {
  id: string;
  routine_id: string | null;
  start_time: string;
  sets: ActiveWorkoutSet[];
}