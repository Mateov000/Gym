import type { ExerciseConfig } from '../types/workout'

const DEFAULT_CONFIG: Required<ExerciseConfig> = {
  stepper_increment: 2.5,
  rest_time_seconds: 90,
  use_rir: false,
  weight_unit: 'kg',
  bar_weight: 20,
  available_plates: [20, 15, 10, 5, 2.5, 1.25],
  show_images: true,
  show_google_search: false,
  sets_config: [], // <-- ¡Esta es la línea que faltaba para calmar a TypeScript!
}

export function resolveExerciseConfig(
  ...configs: (ExerciseConfig | null | undefined)[]
): Required<ExerciseConfig> {
  // Combinamos la configuración por defecto con todas las configuraciones pasadas,
  // de menor a mayor prioridad (ej. global -> rutina -> día -> ejercicio)
  return configs.reduce((acc, current) => {
    if (!current) return acc
    
    // Filtramos solo las propiedades que realmente tienen un valor definido
    const validProps = Object.fromEntries(
      Object.entries(current).filter(([_, value]) => value !== undefined && value !== null)
    )
    
    return { ...acc, ...validProps }
  }, DEFAULT_CONFIG) as Required<ExerciseConfig>
}
