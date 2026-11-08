import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDB, type GymDB } from '../db'
import { activeSession, addSet, deleteSet, finishSession, setSkipped, startSession, updateSet } from '../sessionRepo'
import type { PlanDay } from '../../engine/types'

const plan: PlanDay = {
  id: 'p', name: 'Lunes: Torso', weekday: 1,
  items: [{ exerciseId: 'b', sets: 3, alt: [] }, { exerciseId: 'c', sets: 1, alt: [], optional: true }, { exerciseId: 'a', sets: 3, alt: [] }],
}
let db: GymDB
afterEach(() => db?.delete())

describe('sessionRepo', () => {
  it('registra, edita, deshace y cierra una sesión', async () => {
    db = createDB('repo-test')
    const s = await startSession(db, plan, '2026-11-09', null, { sleep: 4, energy: 3 }, 1000)
    expect(s.items.map((i) => i.exerciseId)).toEqual(['b', 'a', 'c']) // opcionales al final
    expect((await activeSession(db))?.id).toBe(s.id)

    await addSet(db, s.id, 0, { type: 'W', weight: 25, reps: 8 })
    await addSet(db, s.id, 0, { type: 'W', weight: 25, reps: 8, flag: 'rp', repsBeforePause: 6 })
    let cur = (await db.sessions.get(s.id))!
    const second = cur.items[0]!.sets[1]!
    await updateSet(db, s.id, 0, second.id, { flag: undefined, repsBeforePause: undefined, reps: 9 })
    cur = (await db.sessions.get(s.id))!
    expect(cur.items[0]!.sets[1]).toEqual({ id: second.id, type: 'W', weight: 25, reps: 9, doneAt: expect.any(Number) })

    await deleteSet(db, s.id, 0, cur.items[0]!.sets[0]!.id)
    await setSkipped(db, s.id, 1, true)
    await finishSession(db, s.id, ' bien ', 5000)
    cur = (await db.sessions.get(s.id))!
    expect(cur.items[0]!.sets).toHaveLength(1)
    expect(cur.items[1]!.skipped).toBe(true)
    expect(cur).toMatchObject({ status: 'finished', finishedAt: 5000, note: 'bien' })
    expect(await activeSession(db)).toBeUndefined()
  })
})
