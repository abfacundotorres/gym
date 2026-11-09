import type { Session, SessionItem } from './types'

export interface ExerciseExposure { date: string; sessionId: string; item: SessionItem }

/**
 * Exposiciones de una variante, de la más vieja a la más nueva (sin salteadas ni vacías).
 * Las sesiones de deload se omiten salvo `includeDeload`: no son base de progresión, PRs ni tendencias (D-29).
 */
export function exposuresOf(sessions: Session[], exerciseId: string, opts: { before?: string; excludeSessionId?: string; includeDeload?: boolean } = {}): ExerciseExposure[] {
  const out: ExerciseExposure[] = []
  for (const s of sessions) {
    if (s.id === opts.excludeSessionId) continue
    if (s.deload && !opts.includeDeload) continue
    if (opts.before && s.date > opts.before) continue
    for (const item of s.items) {
      if (item.exerciseId === exerciseId && !item.skipped && item.sets.length) out.push({ date: s.date, sessionId: s.id, item })
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sessionId < b.sessionId ? -1 : 1))
}
