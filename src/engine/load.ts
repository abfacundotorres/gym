import type { Exercise } from './types'
import { num } from './format'

type LoadExercise = Pick<Exercise, 'unit' | 'barKg' | 'sledKg'>

/** Carga base conocida (barra o carro), o null si no se sabe. */
export function baseKg(ex: LoadExercise): number | null {
  if (ex.unit !== 'per_side') return null
  return ex.barKg ?? ex.sledKg ?? null
}

/**
 * Carga comparable en kg para e1RM y comparaciones dentro de la variante (D-07).
 * per_side: base + 2×lado (sin base conocida: 2×lado, escala relativa).
 */
export function comparableKg(ex: LoadExercise, weight: number | null, kgPerBrick: number): number | null {
  if (weight == null) return null
  switch (ex.unit) {
    case 'per_side':
      return (baseKg(ex) ?? 0) + 2 * weight
    case 'per_hand':
    case 'total':
      return weight
    case 'bricks':
      return weight * kgPerBrick
    case 'minutes':
      return null
  }
}

/** Texto corto de la carga, p. ej. "25 por lado → 70 kg". */
export function formatLoad(ex: LoadExercise, weight: number | null, kgPerBrick: number): string {
  if (weight == null) return '—'
  switch (ex.unit) {
    case 'per_side': {
      const base = baseKg(ex)
      return base == null ? `${num(weight)} por lado` : `${num(weight)} por lado → ${num(base + 2 * weight)} kg`
    }
    case 'per_hand':
      return `${num(weight)} por mano`
    case 'total':
      return `${num(weight)} kg`
    case 'bricks':
      return `${num(weight)} ladr. (≈${num(Math.round(weight * kgPerBrick))} kg)`
    case 'minutes':
      return `${num(weight)} min`
  }
}

export const UNIT_SHORT: Record<Exercise['unit'], string> = {
  per_side: 'por lado',
  per_hand: 'por mano',
  total: 'kg',
  bricks: 'ladr.',
  minutes: 'min',
}
