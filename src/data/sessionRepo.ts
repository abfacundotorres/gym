import { newSessionItems } from '../engine/session'
import { restBetween } from '../engine/rest'
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
  deload = false,
  short = false,
): Promise<Session> {
  const items = newSessionItems(plan, short)
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
    ...(deload ? { deload: true } : {}),
    ...(short ? { short: true } : {}),
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

export function addSet(db: GymDB, sessionId: string, index: number, set: Omit<SetEntry, 'id'>, now = Date.now()): Promise<void> {
  return mutateItem(db, sessionId, index, (it) => {
    const { skipped: _skipped, ...rest } = it
    const doneAt = set.doneAt ?? now
    // Descanso = tiempo desde la serie anterior de este mismo ejercicio (D-44).
    const rest_ = set.restSec ?? restBetween(it.sets.at(-1)?.doneAt, doneAt)
    const entry: SetEntry = { ...set, id: newId(), doneAt, ...(rest_ != null ? { restSec: rest_ } : {}) }
    return { ...rest, sets: [...it.sets, entry] }
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

/**
 * "Ocupado → alternativa" (§6.5): si el ejercicio no tiene series, se reemplaza por la variante;
 * si ya tiene, se agrega la variante a continuación. Devuelve el índice a abrir.
 */
export async function swapExercise(db: GymDB, sessionId: string, index: number, toId: string): Promise<number> {
  let target = index
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId)
    const it = s?.items[index]
    if (!s || !it) throw new Error('Sesión o ejercicio inexistente')
    const origin = it.swappedFrom ?? it.exerciseId
    const fresh: SessionItem = { exerciseId: toId, sets: [], ...(origin !== toId ? { swappedFrom: origin } : {}) }
    const items = [...s.items]
    if (it.sets.length === 0) items[index] = fresh
    else {
      items.splice(index + 1, 0, fresh)
      target = index + 1
    }
    await db.sessions.put({ ...s, items, exerciseIds: [...new Set(items.map((i) => i.exerciseId))] })
  })
  return target
}

/** Marca o desmarca molestia o dolor en el ejercicio (D-52). */
export function setItemPain(db: GymDB, sessionId: string, index: number, pain: 'molestia' | 'dolor' | null): Promise<void> {
  return mutateItem(db, sessionId, index, (it) => {
    const { pain: _p, ...rest } = it
    return pain ? { ...rest, pain } : rest
  })
}
