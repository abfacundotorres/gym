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

/** Descanso por defecto entre aproximaciones (s), editable en Ajustes; 0 = sin temporizador (D-71). Pauta general: corto. */
export const DEFAULT_WARMUP_REST_SEC = 45
export const MAX_WARMUP_REST_SEC = 600

/** Una marca de "Saltar" más vieja que esto no se usa: ya no se refiere a la serie que se está guardando. */
export const MAX_SKIP_AGE_SEC = 15 * 60

/**
 * Descanso real usando el momento en que tocaste "Saltar" o "Cerrar" en el temporizador, que es cuando empezaste la serie
 * siguiente (no cuando la guardás, que es después de hacerla). Solo vale si la marca es posterior a la serie anterior, no es
 * del futuro y es reciente; si no, `undefined` y se usa el descanso entre guardados de siempre (D-71).
 */
export function restFromSkip(prevDoneAt: number | null | undefined, skippedAt: number | null | undefined, now = Date.now()): number | undefined {
  if (prevDoneAt == null || skippedAt == null) return undefined
  // `skippedAt <= prevDoneAt` ya lo cubre `restBetween` (diferencia < MIN_REST_SEC); queda explícito como defensa en profundidad.
  if (skippedAt <= prevDoneAt || skippedAt > now || now - skippedAt > MAX_SKIP_AGE_SEC * 1000) return undefined
  return restBetween(prevDoneAt, skippedAt)
}

/** Promedio de descanso (s) de las series efectivas con dato, o null. */
export function averageRest(sets: SetEntry[]): number | null {
  const xs = sets.filter((s) => s.type === 'W' && s.restSec != null).map((s) => s.restSec!)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
