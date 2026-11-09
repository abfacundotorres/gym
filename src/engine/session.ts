import { formatDDMM, type ISODate } from './dates'
import { formatRest, num } from './format'
import { averageRest } from './rest'
import { UNIT_SHORT } from './load'
import type { Exercise, PlanDay, Session, SessionItem, SetEntry } from './types'
import { effectiveSets } from './volume'
import { deloadSets } from './periodization'

export interface Exposure { date: ISODate; sessionId: string; item: SessionItem }

/** Última vez que se hizo el ejercicio (con al menos una serie), antes de `beforeDate`. */
export function lastExposure(sessions: Session[], exerciseId: string, beforeDate: ISODate, excludeSessionId?: string): Exposure | null {
  let best: Exposure | null = null
  for (const s of sessions) {
    if (s.id === excludeSessionId || s.date > beforeDate) continue
    if (s.date === beforeDate && s.status === 'in_progress') continue
    const item = s.items.find((i) => i.exerciseId === exerciseId && !i.skipped && i.sets.length > 0)
    if (item && (!best || s.date > best.date)) best = { date: s.date, sessionId: s.id, item }
  }
  return best
}

/** "25×8", "25×12 rp(8)", "20×4 drop", "12,5×—". Aproximaciones con prefijo "A ". */
export function formatSet(set: SetEntry): string {
  if (set.minutes != null) return `${num(set.minutes)} min`
  const w = set.weight == null ? '—' : num(set.weight)
  const r = set.reps == null ? '—' : String(set.reps)
  let s = `${w}×${r}`
  if (set.flag === 'rp') s += set.repsBeforePause != null ? ` rp(${set.repsBeforePause})` : ' rp'
  else if (set.flag) s += ` ${set.flag}`
  if (set.rir != null) s += ` @${set.rir}`
  return set.type === 'A' ? `A ${s}` : s
}

/** Ejercicios del día: los opcionales van al final y con poco tiempo se omiten (D-53). */
export function newSessionItems(plan: PlanDay, short = false): SessionItem[] {
  const item = (i: PlanDay['items'][number]): SessionItem => ({ exerciseId: i.exerciseId, sets: [] })
  return plan.items.filter((i) => !i.optional).map(item).concat(short ? [] : plan.items.filter((i) => i.optional).map(item))
}

export interface SessionStats {
  plannedSets: number
  doneSets: number
  exercisesDone: number
  exercisesPlanned: number
  minutes: number | null
}

export function sessionStats(session: Session, plan: PlanDay | undefined): SessionStats {
  const planned = new Map(plan?.items.filter((i) => !i.optional).map((i) => [i.exerciseId, session.deload ? deloadSets(i.sets) : i.sets]) ?? [])
  const plannedFor = (it: SessionItem) => planned.get(it.exerciseId) ?? (it.swappedFrom ? planned.get(it.swappedFrom) : undefined)
  let doneSets = 0
  for (const it of session.items) doneSets += effectiveSets(it)
  return {
    plannedSets: [...planned.values()].reduce((a, b) => a + b, 0),
    doneSets,
    exercisesPlanned: planned.size,
    exercisesDone: session.items.filter((it) => plannedFor(it) != null && it.sets.some((s) => s.type === 'W')).length,
    minutes: session.startedAt && session.finishedAt ? Math.round((session.finishedAt - session.startedAt) / 60_000) : null,
  }
}

/** Resumen compacto para pegar en un chat. */
export function summaryText(session: Session, plan: PlanDay | undefined, exercises: Map<string, Exercise>): string {
  const lines: string[] = []
  lines.push(`${plan?.name ?? session.planDayId} — ${formatDDMM(session.date)}${session.deload ? ' (deload)' : ''}`)
  if (session.readiness) lines.push(`Sueño ${session.readiness.sleep}/5 · Energía ${session.readiness.energy}/5`)
  for (const it of session.items) {
    const ex = exercises.get(it.exerciseId)
    const name = ex?.name ?? it.exerciseId
    if (it.skipped) {
      lines.push(`${name}: salteado`)
      continue
    }
    const w = it.sets.filter((s) => s.type === 'W')
    if (!w.length) continue
    const unit = ex && ex.unit !== 'total' && ex.unit !== 'minutes' ? ` (${UNIT_SHORT[ex.unit]})` : ''
    const swap = it.swappedFrom ? ` [en vez de ${exercises.get(it.swappedFrom)?.name ?? it.swappedFrom}]` : ''
    const rest = averageRest(w)
    lines.push(`${name}${unit}${swap}${it.pain ? ` [${it.pain}]` : ''}: ${w.map(formatSet).join(', ')}${rest != null ? ` · desc. ~${formatRest(rest)}` : ''}${it.note ? ` — ${it.note}` : ''}`)
  }
  if (session.note) lines.push(`Nota: ${session.note}`)
  return lines.join('\n')
}


