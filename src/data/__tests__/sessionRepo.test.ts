import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDB, type GymDB } from '../db'
import { activeSession, addSet, deleteSet, finishSession, finishStaleSession, setItemPain, setSkipped, startSession, swapExercise, updateSet } from '../sessionRepo'
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

describe('descanso al registrar', () => {
  it('guarda el descanso desde la serie anterior del mismo ejercicio', async () => {
    db = createDB('rest-test')
    const s = await startSession(db, plan, '2026-11-09', null)
    const t0 = 1_000_000
    await addSet(db, s.id, 0, { type: 'W', weight: 25, reps: 8 }, t0)
    await addSet(db, s.id, 0, { type: 'W', weight: 25, reps: 8 }, t0 + 150_000)
    await addSet(db, s.id, 0, { type: 'W', weight: 25, reps: 8 }, t0 + 150_000 + 45 * 60_000) // pausa larga
    await addSet(db, s.id, 1, { type: 'W', weight: 10, reps: 10 }, t0 + 200_000) // otro ejercicio: primera serie
    const cur = (await db.sessions.get(s.id))!
    expect(cur.items[0]!.sets.map((x) => x.restSec)).toEqual([undefined, 150, undefined])
    expect(cur.items[1]!.sets[0]!.restSec).toBeUndefined()
    // editar una serie no pisa su descanso
    await updateSet(db, s.id, 0, cur.items[0]!.sets[1]!.id, { reps: 9 })
    expect((await db.sessions.get(s.id))!.items[0]!.sets[1]).toMatchObject({ reps: 9, restSec: 150 })
  })
})

describe('swapExercise', () => {
  it('reemplaza si no hay series; agrega después si ya hay', async () => {
    db = createDB('swap-test')
    const s = await startSession(db, plan, '2026-11-09', null)
    expect(await swapExercise(db, s.id, 0, 'b2')).toBe(0)
    let cur = (await db.sessions.get(s.id))!
    expect(cur.items[0]).toEqual({ exerciseId: 'b2', sets: [], swappedFrom: 'b' })
    await addSet(db, s.id, 0, { type: 'W', weight: 10, reps: 10 })
    expect(await swapExercise(db, s.id, 0, 'b3')).toBe(1)
    cur = (await db.sessions.get(s.id))!
    expect(cur.items.map((i) => [i.exerciseId, i.swappedFrom])).toEqual([['b2', 'b'], ['b3', 'b'], ['a', undefined], ['c', undefined]])
    expect(cur.exerciseIds).toEqual(['b2', 'b3', 'a', 'c'])
  })
})

describe('exerciseRepo', () => {
  it('crea variantes con id único y sin archivar', async () => {
    const { createVariant, slugify } = await import('../exerciseRepo')
    db = createDB('ex-test')
    const base = { id: 'a', name: 'A', family: 'f', unit: 'total', primary: [], secondary: [], range: [8, 10], increment: 5, restSec: 90, warmup: 'none', archived: true } as const
    await db.exercises.add({ ...base, primary: [], secondary: [], range: [8, 10] })
    expect(slugify('Jalón con agarre en V')).toBe('jalon_con_agarre_en_v')
    const v1 = await createVariant(db, { ...base, primary: [], secondary: [], range: [8, 10] }, 'Jalón V')
    const v2 = await createVariant(db, { ...base, primary: [], secondary: [], range: [8, 10] }, 'Jalón V')
    expect([v1.id, v2.id]).toEqual(['jalon_v', 'jalon_v_2'])
    expect(v1.archived).toBeUndefined()
    expect(v1.family).toBe('f')
  })
})

describe('molestia y poco tiempo', () => {
  it('guarda y quita la molestia; con poco tiempo no agrega opcionales', async () => {
    db = createDB('pain-test')
    const s = await startSession(db, plan, '2026-11-09', null, undefined, 1000, false, true)
    expect(s.short).toBe(true)
    expect(s.items.map((i) => i.exerciseId)).toEqual(['b', 'a']) // sin el opcional 'c'
    await setItemPain(db, s.id, 0, 'dolor')
    expect((await db.sessions.get(s.id))!.items[0]).toMatchObject({ exerciseId: 'b', pain: 'dolor' })
    await setItemPain(db, s.id, 0, null)
    expect((await db.sessions.get(s.id))!.items[0]!.pain).toBeUndefined()
  })
})

describe('sesión que quedó abierta', () => {
  it('se cierra en la última serie registrada, no en el momento de cerrarla', async () => {
    db = createDB('stale-test')
    const s = await startSession(db, plan, '2026-11-09', null, undefined, 1_000_000)
    await addSet(db, s.id, 0, { type: 'W', weight: 25, reps: 8 }, 1_600_000)
    await addSet(db, s.id, 1, { type: 'W', weight: 10, reps: 10 }, 2_200_000)
    await finishStaleSession(db, (await db.sessions.get(s.id))!)
    expect(await db.sessions.get(s.id)).toMatchObject({ status: 'finished', finishedAt: 2_200_000 })
    expect(await activeSession(db)).toBeUndefined()
  })
  it('sin series cierra en el inicio', async () => {
    db = createDB('stale-empty-test')
    const s = await startSession(db, plan, '2026-11-09', null, undefined, 1_000_000)
    await finishStaleSession(db, (await db.sessions.get(s.id))!)
    expect((await db.sessions.get(s.id))!.finishedAt).toBe(1_000_000)
  })
})
