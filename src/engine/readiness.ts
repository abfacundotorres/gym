import type { Readiness } from './types'

/** Promedio de sueño y energía a partir del cual el día se considera "bajo" (D-49). */
export const LOW_READINESS_AVG = 2

export type ReadinessLevel = 'low' | 'ok' | 'unknown'

export function readinessLevel(r?: Readiness): ReadinessLevel {
  if (!r) return 'unknown'
  return (r.sleep + r.energy) / 2 <= LOW_READINESS_AVG ? 'low' : 'ok'
}

/** Series que se sugieren en un día bajo: una menos, mínimo 2 (sin superar lo planificado). */
export function reducedSets(planned: number): number {
  return Math.min(planned, Math.max(2, planned - 1))
}

/** ¿Se sugiere una serie menos por ejercicio? Día bajo o poco tiempo (D-49, D-53). */
export function suggestFewerSets(r: Readiness | undefined, short: boolean | undefined): boolean {
  return !!short || readinessLevel(r) === 'low'
}
