import type { ExerciseConfig } from '../types/workout'

const DEFAULT_CONFIG: Required<ExerciseConfig> = {
  stepper_increment: 2.5,
  rest_time_seconds: 90,
  use_rir: false,
  weight_unit: 'kg',
  bar_weight: 20,
  available_plates: [1.25, 2.5, 5, 10, 15, 20],
  show_images: true,
  show_google_search: false,
}

export function resolveExerciseConfig(
  globalConfig?: ExerciseConfig | null,
  routineConfig?: ExerciseConfig | null,
  exerciseConfig?: ExerciseConfig | null,
): Required<ExerciseConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...(globalConfig ?? {}),
    ...(routineConfig ?? {}),
    ...(exerciseConfig ?? {}),
  }
}
