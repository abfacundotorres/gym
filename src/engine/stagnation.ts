import { exposureMetrics, type ExposureMetrics } from './e1rm'
import type { ExerciseExposure } from './history'
import type { Exercise } from './types'

export type Trend = 'progressing' | 'stagnant' | 'regressing' | 'insufficient'

export interface TrendResult { trend: Trend; metrics: ExposureMetrics[] }

function improved(cur: ExposureMetrics, prior: ExposureMetrics[]): boolean {
  const bestE1 = Math.max(0, ...prior.map((p) => p.e1rm ?? 0))
  if (cur.e1rm != null && cur.e1rm > bestE1 + 1e-9) return true
  const sameWeight = prior.filter((p) => p.workingWeight === cur.workingWeight)
  return sameWeight.length > 0 && cur.repsAtWorking > Math.max(...sameWeight.map((p) => p.repsAtWorking))
}

/**
 * Estancamiento (§6.4): 3 exposiciones seguidas sin mejora de e1RM ni de reps totales al mismo peso.
 * Regresión (D-05): e1RM bajó en cada una de las últimas 2 exposiciones.
 * Solo usa exposiciones con datos válidos.
 */
export function trendOf(ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg'>, history: ExerciseExposure[], kgPerBrick: number): TrendResult {
  const metrics = history
    .map((h) => exposureMetrics(ex, h.item, h.date, h.sessionId, kgPerBrick))
    .filter((m) => m.validCount > 0)
  const n = metrics.length
  if (n >= 3) {
    const [a, b, c] = [metrics[n - 3]!, metrics[n - 2]!, metrics[n - 1]!]
    if (a.e1rm != null && b.e1rm != null && c.e1rm != null && b.e1rm < a.e1rm && c.e1rm < b.e1rm) return { trend: 'regressing', metrics }
  }
  if (n < 4) return { trend: 'insufficient', metrics }
  const lastThree = [n - 3, n - 2, n - 1]
  const stuck = lastThree.every((i) => !improved(metrics[i]!, metrics.slice(0, i)))
  return { trend: stuck ? 'stagnant' : 'progressing', metrics }
}
