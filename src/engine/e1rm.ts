import { comparableKg } from './load'
import type { Exercise, SessionItem } from './types'
import { validSets, workingWeight } from './validity'

/** Epley. Solo para 1 ≤ reps ≤ 12 (§6.4). */
export function epley(kg: number, reps: number): number | null {
  if (reps < 1 || reps > 12) return null
  return kg * (1 + reps / 30)
}

export interface ExposureMetrics {
  date: string
  sessionId: string
  /** Mejor e1RM de la sesión en kg comparables (D-07), o null. */
  e1rm: number | null
  workingWeight: number | null
  /** Reps válidas totales al peso de trabajo. */
  repsAtWorking: number
  /** Reps totales de todas las series efectivas con dato (para el gráfico). */
  totalReps: number
  validCount: number
}

export function exposureMetrics(
  ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg'>,
  item: SessionItem,
  date: string,
  sessionId: string,
  kgPerBrick: number,
): ExposureMetrics {
  const valid = validSets(item)
  const ww = workingWeight(valid)
  let best: number | null = null
  for (const v of valid) {
    const kg = comparableKg(ex, v.weight, kgPerBrick)
    const e = kg == null ? null : epley(kg, v.reps)
    if (e != null && (best == null || e > best)) best = e
  }
  return {
    date,
    sessionId,
    e1rm: best,
    workingWeight: ww,
    repsAtWorking: valid.filter((v) => v.weight === ww).reduce((a, v) => a + v.reps, 0),
    totalReps: item.sets.filter((s) => s.type === 'W' && s.minutes == null).reduce((a, s) => a + (s.reps ?? 0), 0),
    validCount: valid.length,
  }
}
