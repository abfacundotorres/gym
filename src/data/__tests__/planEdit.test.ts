import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, parseImportText } from '../backup'
import { createDB, type GymDB } from '../db'
import { createExercise } from '../exerciseRepo'
import { addExerciseToDay, moveExerciseInDay, removeExerciseFromDay } from '../planRepo'

let n = 0
const dbs: GymDB[] = []
async function seeded() {
  const db = createDB(`planedit-${n++}`)
  dbs.push(db)
  const r = parseImportText(JSON.stringify(fixture), 0)
  if (!r.ok) throw new Error(r.error)
  await applyImport(db, r.data, 'merge')
  return db
}
afterEach(async () => { for (const db of dbs.splice(0)) await db.delete() })

const ids = async (db: GymDB, day: string) => (await db.planDays.get(day))!.items.map((i) => i.exerciseId)

describe('plan editable desde la app (D-83)', () => {
  it('sumar, mover y sacar persisten, solo en el día pedido, y no tocan las sesiones', async () => {
    const db = await seeded()
    const days = await db.planDays.toArray()
    const day = days[0]!, other = days[1]!
    const before = await ids(db, day.id)
    const otherBefore = await ids(db, other.id)
    const sessions = await db.sessions.count()
    const outside = (await db.exercises.toArray()).find((e) => !before.includes(e.id) && !day.items.some((i) => i.alt.includes(e.id)))!

    await addExerciseToDay(db, day.id, outside.id)
    expect(await ids(db, day.id)).toEqual([...before, outside.id])
    expect((await db.planDays.get(day.id))!.items.at(-1)).toMatchObject({ sets: 3, alt: [] })

    await moveExerciseInDay(db, day.id, outside.id, -1)
    expect((await ids(db, day.id)).slice(-2)).toEqual([outside.id, before.at(-1)])

    await removeExerciseFromDay(db, day.id, outside.id)
    expect(await ids(db, day.id)).toEqual(before)
    expect(await ids(db, other.id)).toEqual(otherBefore)
    expect(await db.sessions.count()).toBe(sessions)
  })

  it('sacar un ejercicio conserva su historial', async () => {
    const db = await seeded()
    const day = (await db.planDays.toArray())[0]!
    const target = day.items[0]!.exerciseId
    const used = await db.sessions.where('exerciseIds').equals(target).count()
    await removeExerciseFromDay(db, day.id, target)
    expect(await ids(db, day.id)).not.toContain(target)
    expect(await db.sessions.where('exerciseIds').equals(target).count()).toBe(used)
    expect(await db.exercises.get(target)).toBeDefined()
  })

  it('createExercise: id único a partir del nombre, sin pisar uno existente', async () => {
    const db = await seeded()
    const input = { name: 'Remo raro', family: '', unit: 'per_hand' as const, range: [8, 12] as [number, number], increment: 2.5, restSec: 120, warmup: 'light' as const, primary: ['lats' as const] }
    const a = await createExercise(db, input)
    const b = await createExercise(db, input)
    expect(a.id).toBe('remo_raro')
    expect(b.id).toBe('remo_raro_2')
    expect(await db.exercises.get('remo_raro')).toMatchObject({ name: 'Remo raro', unit: 'per_hand', secondary: [] })
    // el id de uno existente del seed tampoco se pisa
    const existing = (await db.exercises.toArray())[0]!
    const c = await createExercise(db, { ...input, name: existing.name })
    expect(c.id).not.toBe(existing.id)
    expect(await db.exercises.get(existing.id)).toEqual(existing)
  })
})
