import type { ISODate } from './dates'
import type { ExerciseExposure } from './history'
import { recommend } from './progression'
import { readinessLevel } from './readiness'
import type { Exercise, Session } from './types'
import { validSets, workingWeight } from './validity'

/**
 * Calibración con tus datos (D-81): se recalcula lo que la app te habría sugerido antes de cada sesión (con el historial de
 * entonces) y se compara con el peso con el que trabajaste. Es una aproximación: usa las series planificadas de hoy y el rango
 * base del ejercicio, y no sabe por qué elegiste otro peso (técnica, cansancio, discos disponibles).
 */

/** Mínimo de comparaciones para decir algo, ventana de las últimas, y qué parte tiene que repetirse para proponer. */
export const CAL_MIN_EVALUATED = 4
export const CAL_WINDOW = 6
export const CAL_SHARE = 0.6
export const CAL_MIN_INCREASES = 3
/** Cuánto se puede ampliar el tope de reps sobre el del ejercicio. */
export const CAL_MAX_WIDEN = 2

export type Adherence = 'followed' | 'lower' | 'higher'
export interface Evaluation { date: ISODate; suggested: number; actual: number; kind: Adherence; wasIncrease: boolean }

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9

/**
 * Compara, exposición por exposición (de la segunda en adelante), la sugerencia numérica que habría dado `recommend` con el peso de
 * trabajo real. `exposures` va de la más vieja a la más nueva y sin deload ni vuelta (como las arma `exposuresOf`). Un día de sueño y
 * energía bajos mantenía el peso, y se tiene en cuenta (`readiness`).
 */
export function evaluateSuggestions(
  ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg' | 'increment' | 'range'>,
  exposures: ExerciseExposure[],
  opts: { sets: number; kgPerBrick: number; readiness?: (sessionId: string) => Session['readiness'] },
): Evaluation[] {
  const out: Evaluation[] = []
  for (let i = 1; i < exposures.length; i++) {
    const cur = exposures[i]!
    const hold = readinessLevel(opts.readiness?.(cur.sessionId)) === 'low'
    const rec = recommend(ex, opts.sets, exposures.slice(0, i), { kgPerBrick: opts.kgPerBrick, hold })
    if (rec.weight == null || (rec.status !== 'increase' && rec.status !== 'same' && rec.status !== 'ready_big_jump')) continue
    const actual = workingWeight(validSets(cur.item))
    if (actual == null) continue
    out.push({
      date: cur.date,
      suggested: rec.weight,
      actual,
      kind: same(actual, rec.weight) ? 'followed' : actual < rec.weight ? 'lower' : 'higher',
      wasIncrease: rec.status === 'increase',
    })
  }
  return out
}

export interface Calibration {
  evaluated: number
  followed: number
  lower: number
  higher: number
  /** Cuántas de esas sugerencias eran subir de peso, y en cuántas no se subió. */
  increases: number
  declined: number
}

/** Resumen de las últimas `window` comparaciones. */
export function calibrate(evals: Evaluation[], window = CAL_WINDOW): Calibration {
  const last = evals.slice(-window)
  const inc = last.filter((e) => e.wasIncrease)
  return {
    evaluated: last.length,
    followed: last.filter((e) => e.kind === 'followed').length,
    lower: last.filter((e) => e.kind === 'lower').length,
    higher: last.filter((e) => e.kind === 'higher').length,
    increases: inc.length,
    declined: inc.filter((e) => e.kind === 'lower').length,
  }
}

export interface RangeProposal { reason: 'aggressive' | 'conservative'; from: [number, number]; to: [number, number] }

/**
 * Ajuste chico del tope de reps (el rango del plan; la palanca que ya tiene la doble progresión):
 * - Si la mayoría de las veces que sugirió subir de peso no subiste (3 o más comparaciones, 60 % o más), amplía el tope en 1
 *   (hasta 2 sobre el del ejercicio): sumás reps antes de que te pida subir.
 * - Si la mayoría de las veces trabajaste con más peso del sugerido (4 o más, 60 % o más), baja el tope en 1 (nunca a menos de 1 menos que el
 *   del ejercicio, ni a un rango de menos de 3 reps de ancho): subís de peso antes.
 * `base` es el rango del ejercicio y `current` el que rige hoy en el plan. Sin evidencia suficiente, null.
 */
export function rangeProposal(base: [number, number], current: [number, number], cal: Calibration): RangeProposal | null {
  const [min, max] = current
  if (cal.increases >= CAL_MIN_INCREASES && cal.declined / cal.increases >= CAL_SHARE && max < base[1] + CAL_MAX_WIDEN) {
    return { reason: 'aggressive', from: current, to: [min, max + 1] }
  }
  if (cal.evaluated >= CAL_MIN_EVALUATED && cal.higher / cal.evaluated >= CAL_SHARE && max - 1 >= min + 2 && max > base[1] - 1) {
    return { reason: 'conservative', from: current, to: [min, max - 1] }
  }
  return null
}
