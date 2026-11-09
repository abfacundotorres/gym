import type { SetEntry } from './types'

/** Menos de esto es una carga seguida (series anotadas de memoria o dos toques), no un descanso (D-44). */
export const MIN_REST_SEC = 10

/** Más de esto entre dos series se considera una pausa larga, no un descanso (D-44). */
export const MAX_REST_SEC = 30 * 60

/**
 * Descanso real entre dos series consecutivas del mismo ejercicio (D-44): segundos entre la hora de la
 * anterior y la de ahora. Sin dato si no hay serie anterior con hora, si pasó menos de MIN_REST_SEC o si la pausa supera MAX_REST_SEC.
 */
export function restBetween(prevDoneAt: number | null | undefined, now: number): number | undefined {
  if (prevDoneAt == null) return undefined
  const sec = Math.round((now - prevDoneAt) / 1000)
  return sec >= MIN_REST_SEC && sec <= MAX_REST_SEC ? sec : undefined
}

/** Promedio de descanso (s) de las series efectivas con dato, o null. */
export function averageRest(sets: SetEntry[]): number | null {
  const xs = sets.filter((s) => s.type === 'W' && s.restSec != null).map((s) => s.restSec!)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
