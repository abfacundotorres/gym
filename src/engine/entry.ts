import type { ExerciseExposure } from './history'
import { findPRs } from './prs'
import type { Recommendation } from './progression'
import { validSets, workingWeight } from './validity'
import { warmupSets, type WarmupSet } from './warmup'
import type { Exercise, SessionItem, SetEntry } from './types'

/** Una serie todavía sin guardar (sin id). */
export type SetDraft = Omit<SetEntry, 'id'>

/**
 * Con qué se prellena la próxima serie. El peso sigue al de la última serie efectiva (o la sugerencia; sin ninguna, el de la
 * última serie registrada, p. ej. una aproximación); las reps siguen el objetivo de esa serie y, pasado el plan (series
 * extra), repiten las de la última efectiva.
 */
export function nextSetDefaults(
  done: SetEntry[],
  rec: Pick<Recommendation, 'weight' | 'targets' | 'repCap'>,
): { weight: number | null; reps: number } {
  const doneWork = done.filter((s) => s.type === 'W')
  const lastWork = doneWork.at(-1)
  return {
    weight: lastWork?.weight ?? rec.weight ?? done.at(-1)?.weight ?? null,
    reps: rec.targets[doneWork.length] ?? lastWork?.reps ?? rec.repCap,
  }
}

/**
 * Aproximaciones que faltan: solo antes de la primera serie efectiva, sin repetir pesos ya registrados como aproximación.
 * Si la última vez hubo aproximaciones, se reusan escaladas por el peso de trabajo.
 */
export function pendingWarmups(
  ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg' | 'increment' | 'warmup'>,
  workWeight: number | null,
  kgPerBrick: number,
  previous: ExerciseExposure[],
  done: SetEntry[],
): WarmupSet[] {
  if (done.some((s) => s.type === 'W')) return []
  const lastItem = previous.at(-1)?.item
  return warmupSets(ex, workWeight, kgPerBrick, lastItem ? { sets: lastItem.sets, workingWeight: workingWeight(validSets(lastItem)) } : undefined).filter(
    (w) => !done.some((d) => d.type === 'A' && d.weight === w.weight),
  )
}

/** ¿Guardar esta serie sería récord? Solo para avisar: no cambia lo que se guarda. */
export function wouldBeRecord(
  ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg'>,
  item: SessionItem,
  draft: SetDraft,
  previous: ExerciseExposure[],
  kgPerBrick: number,
): boolean {
  if (draft.type !== 'W') return false
  const probe: SetEntry = { ...draft, id: '__nueva__' }
  return findPRs(ex, { item: { ...item, sets: [...item.sets, probe] } }, previous, kgPerBrick).some((p) => p.setId === probe.id)
}
