import { exposuresOf, type ExerciseExposure } from '../../engine/history'
import { deloadSets, deloadWeight } from '../../engine/periodization'
import { recommend, type Recommendation } from '../../engine/progression'
import { readinessLevel, suggestFewerSets } from '../../engine/readiness'
import type { Exercise, PlanItem, Session } from '../../engine/types'

/**
 * Recomendación de hoy para un ejercicio de la sesión: series planificadas, deload, día bajo y progresión.
 * Una sola fuente para la pantalla del ejercicio y la lista de la sesión.
 */
export function todaysRecommendation(
  ex: Exercise,
  session: Pick<Session, 'id' | 'date' | 'deload' | 'readiness' | 'short'>,
  planItem: PlanItem | undefined,
  history: Session[],
  kgPerBrick: number,
) {
  const deload = !!session.deload
  const lowDay = !deload && readinessLevel(session.readiness) === 'low'
  const fewer = !deload && suggestFewerSets(session.readiness, session.short)
  const plannedSets = deload ? deloadSets(planItem?.sets ?? 3) : (planItem?.sets ?? 3)
  const previous: ExerciseExposure[] = exposuresOf(history, ex.id, { before: session.date, excludeSessionId: session.id })
  const baseRec = recommend(ex, deload ? (planItem?.sets ?? 3) : plannedSets, previous, { kgPerBrick, range: planItem?.rangeOverride, hold: lowDay })
  const rec: Recommendation = deload
    ? { ...baseRec, status: 'same', weight: deloadWeight(ex, baseRec.weight, kgPerBrick), targets: baseRec.targets.slice(0, plannedSets), fatigue: false, message: 'Deload' }
    : baseRec
  return { deload, lowDay, fewer, plannedSets, previous, rec }
}
