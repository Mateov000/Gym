import type { WorkoutExercise } from '../types/workout'

export interface ExistingPrRecord {
  exercise_id: string
  record_type: 'max_weight' | 'max_volume'
  value: number
}

export interface PrEventCandidate {
  exercise_id: string
  record_type: 'max_weight' | 'max_volume'
  value: number
}

function shouldTrackSet(workoutEx: WorkoutExercise) {
  if (workoutEx.meta?.pr_mode === 'opt_out') return false
  return true
}

function getSetWeightForPr(
  workoutEx: WorkoutExercise,
  set: { weight: number; reps: number; pr_fixed_weight?: number | null },
) {
  if (workoutEx.meta?.pr_mode === 'fixed') {
    return set.pr_fixed_weight ?? workoutEx.meta.pr_fixed_weight ?? set.weight
  }
  return set.weight
}

export function buildPrCandidates(
  workoutExercises: WorkoutExercise[],
  existingRecords: ExistingPrRecord[],
): PrEventCandidate[] {
  const existingByKey = new Map<string, number>(
    existingRecords.map((record) => [`${record.exercise_id}:${record.record_type}`, record.value]),
  )
  const bestByKey = new Map<string, number>()

  for (const workoutEx of workoutExercises) {
    if (!shouldTrackSet(workoutEx)) continue

    for (const set of workoutEx.sets) {
      const effectiveWeight = getSetWeightForPr(workoutEx, set)
      const volume = effectiveWeight * set.reps

      const weightKey = `${workoutEx.exercise.id}:max_weight`
      const volumeKey = `${workoutEx.exercise.id}:max_volume`

      const bestWeight = Math.max(bestByKey.get(weightKey) ?? 0, effectiveWeight)
      const bestVolume = Math.max(bestByKey.get(volumeKey) ?? 0, volume)

      bestByKey.set(weightKey, bestWeight)
      bestByKey.set(volumeKey, bestVolume)
    }
  }

  const events: PrEventCandidate[] = []
  for (const [key, value] of bestByKey.entries()) {
    const [exerciseId, recordType] = key.split(':')
    const previous = existingByKey.get(key) ?? 0
    if (value > previous) {
      events.push({
        exercise_id: exerciseId,
        record_type: recordType as PrEventCandidate['record_type'],
        value,
      })
    }
  }

  return events
}
