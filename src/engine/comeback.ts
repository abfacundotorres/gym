import { daysBetween, type ISODate } from './dates'
import { deloadSets } from './periodization'
import { DEFAULT_RULES, deloadFactor, type Rules } from './rules'
import type { Session } from './types'

/** Desde cuántos días sin entrenar se sugiere una sesión de vuelta por defecto (D-74). Con tres sesiones por semana, 10 días es haber faltado a una semana. */
export const COMEBACK_MIN_DAYS = DEFAULT_RULES.comebackMinDays

export type ComebackTier = 'short' | 'medium' | 'long'

export interface Comeback {
  days: number
  tier: ComebackTier
  /** Factor sobre la carga comparable de la última vez. */
  loadFactor: number
  /** Cuántas repeticiones dejar en reserva, para el cartel. */
  rir: string
}

/** Días desde la última sesión terminada, o null si nunca entrenó. */
export function daysOff(sessions: Pick<Session, 'date' | 'status'>[], today: ISODate): number | null {
  let last: ISODate | null = null
  for (const s of sessions) if (s.status === 'finished' && (last == null || s.date > last)) last = s.date
  return last == null ? null : Math.max(0, daysBetween(last, today))
}

/**
 * Cómo volver tras `days` días sin entrenar (D-74). Pautas generales mías, no una prescripción: con pausas cortas se pierde poco
 * y lo que más pesa es volver de golpe con todo el volumen; cuanto más larga, más carga y series se bajan.
 */
export function comebackFor(days: number | null | undefined, rules: Pick<Rules, 'comebackMinDays' | 'comebackLoadPct'> = DEFAULT_RULES): Comeback | null {
  if (days == null || days < rules.comebackMinDays) return null
  const [short, medium, long] = rules.comebackLoadPct.map((p) => p / 100) as [number, number, number]
  if (days < 21) return { days, tier: 'short', loadFactor: short, rir: '2' }
  if (days < 42) return { days, tier: 'medium', loadFactor: medium, rir: '2 o 3' }
  return { days, tier: 'long', loadFactor: long, rir: '3' }
}

/** Series de vuelta: una menos (pausa corta), dos tercios (media) o la mitad (larga); nunca menos de 2 ni más de lo planificado. */
export function comebackSets(planned: number, c: Comeback): number {
  const n = c.tier === 'short' ? planned - 1 : c.tier === 'medium' ? Math.ceil((planned * 2) / 3) : Math.ceil(planned / 2)
  return Math.min(planned, Math.max(2, n))
}

/**
 * Series que se hacen hoy por ejercicio: las planificadas, o menos en deload y en una sesión de vuelta. Si coinciden, gana
 * la reducción más fuerte (no se suman).
 */
export function sessionSets(session: { deload?: boolean; comebackDays?: number }, planned: number, rules: Rules = DEFAULT_RULES): number {
  const cb = comebackFor(session.comebackDays, rules)
  const a = session.deload ? deloadSets(planned) : planned
  return cb ? Math.min(a, comebackSets(planned, cb)) : a
}

/** Factor de carga de hoy: el deload (según el modo) y la vuelta no se suman, gana el más bajo. */
export function sessionLoadFactor(session: { deload?: boolean; comebackDays?: number }, rules: Rules = DEFAULT_RULES): number | null {
  const cb = comebackFor(session.comebackDays, rules)
  if (!session.deload && !cb) return null
  return Math.min(session.deload ? deloadFactor(rules.deloadMode) : 1, cb?.loadFactor ?? 1)
}
