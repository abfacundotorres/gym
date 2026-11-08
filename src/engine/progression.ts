import { comparableKg } from './load'
import type { Exercise } from './types'
import type { ExerciseExposure } from './history'
import { validSets, workingWeight, type ValidSet } from './validity'

export type RecStatus = 'increase' | 'same' | 'ready_big_jump' | 'insufficient' | 'no_history'

export interface Recommendation {
  status: RecStatus
  /** Peso sugerido (unidad del ejercicio). null = sin base, elegir a mano. */
  weight: number | null
  /** Reps objetivo por serie (length = targetSets). */
  targets: number[]
  /** Aviso de fatiga: ≥2 series bajo el mínimo en dos exposiciones seguidas. */
  fatigue: boolean
  /** Con incrementos > 10 % (D-02): % del salto y tope de reps extendido. */
  bigJumpPct?: number
  repCap: number
  message: string
  basedOn: string | null
}

export const MAX_AUTO_JUMP = 0.1

/** % de aumento de carga comparable al sumar un incremento. */
export function jumpPct(ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg' | 'increment'>, weight: number, kgPerBrick: number): number {
  const a = comparableKg(ex, weight, kgPerBrick)
  const b = comparableKg(ex, weight + ex.increment, kgPerBrick)
  if (a == null || b == null || a <= 0) return Infinity
  return (b - a) / a
}

function belowMin(valid: ValidSet[], min: number): number {
  return valid.filter((v) => v.reps < min).length
}

/**
 * Doble progresión (§6.2 con D-01, D-02, D-03). `history` va de la más vieja a la más nueva.
 * Solo mira la última exposición (más la anterior para el aviso de fatiga): no busca hacia atrás
 * una "buena" si la última no sirve.
 */
export function recommend(
  ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg' | 'increment' | 'range'>,
  targetSets: number,
  history: ExerciseExposure[],
  opts: { kgPerBrick: number; range?: [number, number] },
): Recommendation {
  const [min, max] = opts.range ?? ex.range
  const last = history.at(-1)
  if (!last) {
    return { status: 'no_history', weight: null, targets: Array(targetSets).fill(min), fatigue: false, repCap: max, message: 'Sin historial: elegí el peso.', basedOn: null }
  }

  const valid = validSets(last.item)
  const ww = workingWeight(valid)
  const big = ww != null ? jumpPct(ex, ww, opts.kgPerBrick) : 0
  const extended = ww != null && big > MAX_AUTO_JUMP
  const cap = extended ? max + 3 : max
  const work = ww == null ? [] : valid.filter((v) => v.weight === ww)
  const repsFor = (i: number) => work[i]?.reps ?? work.at(-1)?.reps

  const prev = history.at(-2)
  const fatigue = belowMin(valid, min) >= 2 && !!prev && belowMin(validSets(prev.item), min) >= 2

  if (work.length < targetSets) {
    // Sin datos suficientes: no se sugiere subida. Peso: el de trabajo, o el más alto registrado como referencia.
    const ref = ww ?? maxWeight(last.item.sets.filter((s) => s.type === 'W').map((s) => s.weight))
    return {
      status: 'insufficient',
      weight: ref,
      targets: Array.from({ length: targetSets }, (_, i) => {
        const r = repsFor(i)
        return r == null ? min : Math.min(cap, r + 1)
      }),
      fatigue,
      repCap: cap,
      message: 'Sin datos suficientes',
      basedOn: last.date,
    }
  }

  const allAtCap = work.slice(0, targetSets).every((v) => v.reps >= cap)
  if (allAtCap && !extended) {
    return {
      status: 'increase',
      weight: ww! + ex.increment,
      targets: Array(targetSets).fill(min),
      fatigue: false,
      repCap: cap,
      message: `Subí a ${ww! + ex.increment}`,
      basedOn: last.date,
    }
  }
  if (allAtCap && extended) {
    const pct = Math.round(big * 100)
    return {
      status: 'ready_big_jump',
      weight: ww,
      targets: Array(targetSets).fill(cap),
      fatigue: false,
      bigJumpPct: pct,
      repCap: cap,
      message: `Listo para subir (+${pct} %), confirmá vos`,
      basedOn: last.date,
    }
  }
  return {
    status: 'same',
    weight: ww,
    targets: Array.from({ length: targetSets }, (_, i) => Math.min(cap, repsFor(i)! + 1)),
    fatigue,
    ...(extended ? { bigJumpPct: Math.round(big * 100) } : {}),
    repCap: cap,
    message: fatigue ? 'Mismo peso. Dos sesiones flojas: considerá bajar 5-10 % o revisar la fatiga.' : 'Mismo peso, sumá una rep',
    basedOn: last.date,
  }
}

function maxWeight(ws: (number | null)[]): number | null {
  const xs = ws.filter((w): w is number => w != null)
  return xs.length ? Math.max(...xs) : null
}
