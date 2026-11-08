import { baseKg, comparableKg } from './load'
import type { Exercise, SetEntry } from './types'

export interface WarmupSet { weight: number; reps: number; label: string }

const roundTo = (v: number, step: number) => Math.round(v / step) * step

/** Convierte kg comparables a la unidad del ejercicio. */
function fromComparable(ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg'>, kg: number, kgPerBrick: number): number {
  switch (ex.unit) {
    case 'per_side':
      return (kg - (baseKg(ex) ?? 0)) / 2
    case 'bricks':
      return kg / kgPerBrick
    default:
      return kg
  }
}

function dedupe(sets: WarmupSet[], work: number): WarmupSet[] {
  const out: WarmupSet[] = []
  for (const s of sets) {
    if (s.weight < 0 || s.weight >= work) continue
    if (out.some((o) => o.weight === s.weight)) continue
    out.push(s)
  }
  return out
}

/**
 * Aproximaciones (§6.3). Si en la última sesión se registraron aproximaciones, se reusan,
 * escaladas por la relación entre pesos de trabajo (en kg comparables). Nunca cuentan como volumen.
 */
export function warmupSets(
  ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg' | 'increment' | 'warmup'>,
  work: number | null,
  kgPerBrick: number,
  last?: { sets: SetEntry[]; workingWeight: number | null },
): WarmupSet[] {
  if (work == null || work <= 0 || ex.warmup === 'none' || ex.unit === 'minutes') return []
  const step = ex.increment
  const workKg = comparableKg(ex, work, kgPerBrick)!
  const toUnit = (kg: number) => Math.max(0, roundTo(fromComparable(ex, kg, kgPerBrick), step))

  const lastA = last?.sets.filter((s) => s.type === 'A' && s.weight != null) ?? []
  if (lastA.length && last?.workingWeight) {
    const lastKg = comparableKg(ex, last.workingWeight, kgPerBrick)!
    const ratio = workKg / lastKg
    return dedupe(
      lastA.map((s) => {
        const w = ratio === 1 || s.weight === 0 ? s.weight! : toUnit(comparableKg(ex, s.weight!, kgPerBrick)! * ratio)
        return { weight: w, reps: s.reps ?? 8, label: 'como la última vez' }
      }),
      work,
    )
  }

  if (ex.warmup === 'light') return dedupe([{ weight: toUnit(workKg * 0.6), reps: 10, label: '~60 %' }], work)

  const base = baseKg(ex)
  const first: WarmupSet =
    ex.unit === 'per_side' && base != null
      ? { weight: 0, reps: 12, label: 'barra sola' }
      : { weight: Math.max(step, toUnit(workKg * 0.3)), reps: 12, label: 'carga mínima' }
  return dedupe(
    [
      first,
      { weight: toUnit(workKg * 0.5), reps: 8, label: '~50 %' },
      { weight: toUnit(workKg * 0.7), reps: 5, label: '~70 %' },
      { weight: toUnit(workKg * 0.85), reps: 3, label: '~85 %, 2-3 reps' },
    ],
    work,
  )
}
