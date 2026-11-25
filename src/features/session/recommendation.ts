import { exposuresOf, type ExerciseExposure } from '../../engine/history'
import { comebackFor, sessionLoadFactor, sessionSets } from '../../engine/comeback'
import { deloadWeight } from '../../engine/periodization'
import { recommend, type Recommendation } from '../../engine/progression'
import { validSets, workingWeight } from '../../engine/validity'
import { readinessLevel, suggestFewerSets } from '../../engine/readiness'
import type { Exercise, PlanItem, Session } from '../../engine/types'

/**
 * Recomendación de hoy para un ejercicio de la sesión: series planificadas, deload, día bajo y progresión.
 * Una sola fuente para la pantalla del ejercicio y la lista de la sesión.
 */
export function todaysRecommendation(
  ex: Exercise,
  session: Pick<Session, 'id' | 'date' | 'deload' | 'comebackDays' | 'readiness' | 'short'>,
  planItem: PlanItem | undefined,
  history: Session[],
  kgPerBrick: number,
) {
  const deload = !!session.deload
  const comeback = comebackFor(session.comebackDays)
  const factor = sessionLoadFactor(session) // deload o vuelta: carga reducida y menos series; no se suman, gana la más fuerte
  const reduced = factor != null
  const lowDay = !reduced && readinessLevel(session.readiness) === 'low'
  const fewer = !reduced && suggestFewerSets(session.readiness, session.short)
  const fullSets = planItem?.sets ?? 3
  const plannedSets = sessionSets(session, fullSets)
  const previous: ExerciseExposure[] = exposuresOf(history, ex.id, { before: session.date, excludeSessionId: session.id })
  const baseRec = recommend(ex, reduced ? fullSets : plannedSets, previous, { kgPerBrick, range: planItem?.rangeOverride, hold: lowDay })
  let rec: Recommendation = baseRec
  if (reduced) {
    // Deload: −10 % de la sugerencia. Vuelta tras una pausa: se parte del último peso de trabajo, sin la subida pendiente (no se
    // progresa al volver), con las mismas reps de la última vez; si no hay una última vez válida, como el deload.
    const last = comeback ? previous.at(-1) : undefined
    const valid = last ? validSets(last.item) : []
    const lastWeight = workingWeight(valid)
    const lastReps = lastWeight == null ? [] : valid.filter((v) => v.weight === lastWeight).map((v) => Math.min(baseRec.repCap, v.reps))
    const fromLast = lastWeight != null && lastReps.length >= plannedSets
    rec = {
      ...baseRec,
      status: 'same',
      weight: deloadWeight(ex, fromLast ? lastWeight : baseRec.weight, kgPerBrick, baseRec.pain === 'dolor' ? Math.min(factor, 0.9) : factor), // un dolor la última vez (D-52) también baja: gana la reducción más fuerte
      targets: (fromLast ? lastReps : baseRec.targets).slice(0, plannedSets),
      fatigue: false,
      message: deload ? 'Deload' : `Vuelta tras ${comeback!.days} días`,
    }
  }
  return { deload, comeback, lowDay, fewer, plannedSets, previous, rec }
}
