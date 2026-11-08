import { comparableKg } from './load'
import { epley } from './e1rm'
import type { ExerciseExposure } from './history'
import type { Exercise, SetEntry } from './types'
import { validSets } from './validity'

export type PRKind = 'e1rm' | 'reps'
export interface PR { setId: string; kind: PRKind; set: SetEntry }

/**
 * PRs de una exposición contra todas las anteriores de la misma variante (§6.4).
 * e1rm: mayor e1RM que cualquier serie válida previa. reps: más reps que nunca a ese mismo peso.
 * Sin historial previo válido no hay PR (la primera vez no cuenta).
 */
export function findPRs(
  ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg'>,
  current: Pick<ExerciseExposure, 'item'>,
  previous: ExerciseExposure[],
  kgPerBrick: number,
): PR[] {
  const prevValid = previous.flatMap((p) => validSets(p.item))
  if (!prevValid.length) return []
  const e1 = (w: number, r: number) => {
    const kg = comparableKg(ex, w, kgPerBrick)
    return kg == null ? null : epley(kg, r)
  }
  let bestE1 = Math.max(0, ...prevValid.map((v) => e1(v.weight, v.reps) ?? 0))
  const bestReps = new Map<number, number>()
  for (const v of prevValid) bestReps.set(v.weight, Math.max(bestReps.get(v.weight) ?? 0, v.reps))

  const out: PR[] = []
  for (const v of validSets(current.item)) {
    const e = e1(v.weight, v.reps)
    if (e != null && bestE1 > 0 && e > bestE1 + 1e-9) {
      out.push({ setId: v.set.id, kind: 'e1rm', set: v.set })
      bestE1 = e
    } else if (bestReps.has(v.weight) && v.reps > bestReps.get(v.weight)!) {
      out.push({ setId: v.set.id, kind: 'reps', set: v.set })
    }
    if (bestReps.has(v.weight)) bestReps.set(v.weight, Math.max(bestReps.get(v.weight)!, v.reps))
  }
  return out
}
