import { newSessionItems } from '../engine/session'
import type { PlanDay, Readiness, Session, SessionItem, SetEntry } from '../engine/types'
import type { ISODate } from '../engine/dates'
import type { GymDB } from './db'

export const newId = () => crypto.randomUUID()

export async function activeSession(db: GymDB): Promise<Session | undefined> {
  return db.sessions.where('status').equals('in_progress').first()
}

export async function startSession(
  db: GymDB,
  plan: PlanDay,
  date: ISODate,
  mesocycleId: string | null,
  readiness?: Readiness,
  now = Date.now(),
): Promise<Session> {
  const items = newSessionItems(plan)
  const s: Session = {
    id: `s-${date}-${newId().slice(0, 8)}`,
    date,
    planDayId: plan.id,
    mesocycleId,
    note: '',
    startedAt: now,
    finishedAt: null,
    status: 'in_progress',
    source: 'app',
    items,
    exerciseIds: items.map((i) => i.exerciseId),
    ...(readiness ? { readiness } : {}),
  }
  await db.sessions.add(s)
  return s
}

/** Modifica un item de la sesión de forma atómica. */
async function mutateItem(db: GymDB, sessionId: string, index: number, fn: (it: SessionItem) => SessionItem): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId)
    if (!s || !s.items[index]) throw new Error('Sesión o ejercicio inexistente')
    const items = s.items.map((it, i) => (i === index ? fn(it) : it))
    await db.sessions.put({ ...s, items, exerciseIds: [...new Set(items.map((i) => i.exerciseId))] })
  })
}

export function addSet(db: GymDB, sessionId: string, index: number, set: Omit<SetEntry, 'id'>): Promise<void> {
  return mutateItem(db, sessionId, index, (it) => {
    const { skipped: _skipped, ...rest } = it
    return { ...rest, sets: [...it.sets, { ...set, id: newId() }] }
  })
}

export function updateSet(db: GymDB, sessionId: string, index: number, setId: string, patch: Partial<SetEntry>): Promise<void> {
  return mutateItem(db, sessionId, index, (it) => ({
    ...it,
    sets: it.sets.map((s) => {
      if (s.id !== setId) return s
      const next = { ...s, ...patch }
      for (const k of Object.keys(next) as (keyof SetEntry)[]) if (next[k] === undefined) delete next[k]
      return next
    }),
  }))
}

export function deleteSet(db: GymDB, sessionId: string, index: number, setId: string): Promise<void> {
  return mutateItem(db, sessionId, index, (it) => ({ ...it, sets: it.sets.filter((s) => s.id !== setId) }))
}

export function setSkipped(db: GymDB, sessionId: string, index: number, skipped: boolean): Promise<void> {
  return mutateItem(db, sessionId, index, (it) => {
    const { skipped: _s, ...rest } = it
    return skipped ? { ...rest, skipped: true } : rest
  })
}

export function setItemNote(db: GymDB, sessionId: string, index: number, note: string): Promise<void> {
  return mutateItem(db, sessionId, index, (it) => {
    const { note: _n, ...rest } = it
    return note.trim() ? { ...rest, note: note.trim() } : rest
  })
}

export async function finishSession(db: GymDB, sessionId: string, note: string, now = Date.now()): Promise<void> {
  await db.sessions.update(sessionId, { status: 'finished', finishedAt: now, note: note.trim() })
}

export async function discardSession(db: GymDB, sessionId: string): Promise<void> {
  await db.sessions.delete(sessionId)
}
