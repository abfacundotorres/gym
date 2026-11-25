import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDB, type GymDB } from '../db'
import { setRangeOverride } from '../planRepo'
import type { PlanDay } from '../../engine/types'

let db: GymDB
let n = 0
afterEach(() => db?.delete())
const plan = (): PlanDay[] => [
  { id: 'a', name: 'A', weekday: 1, items: [{ exerciseId: 'press', sets: 3, alt: ['press_maq'], optional: true }, { exerciseId: 'curl', sets: 3, alt: [] }] },
  { id: 'b', name: 'B', weekday: 3, items: [{ exerciseId: 'press', sets: 4, alt: [], rangeOverride: [6, 9] }] },
]

describe('rango de reps del plan (D-81)', () => {
  it('se aplica en todos los días donde está el ejercicio y no toca el resto', async () => {
    db = createDB(`cal-${n++}`)
    await db.planDays.bulkPut(plan())
    await setRangeOverride(db, 'press', [7, 11])
    const days = await db.planDays.orderBy('weekday').toArray()
    expect(days[0]!.items[0]).toEqual({ exerciseId: 'press', sets: 3, alt: ['press_maq'], optional: true, rangeOverride: [7, 11] }) // conserva alternativas y opcional
    expect(days[0]!.items[1]).toEqual({ exerciseId: 'curl', sets: 3, alt: [] })
    expect(days[1]!.items[0]).toEqual({ exerciseId: 'press', sets: 4, alt: [], rangeOverride: [7, 11] }) // pisa el que tenía
  })
  it('restablecer quita el campo (no lo deja en undefined) y vuelve a regir el del ejercicio', async () => {
    db = createDB(`cal-${n++}`)
    await db.planDays.bulkPut(plan())
    await setRangeOverride(db, 'press', [7, 11])
    await setRangeOverride(db, 'press', null)
    for (const d of await db.planDays.toArray()) for (const i of d.items) expect('rangeOverride' in i).toBe(false)
  })
  it('un ejercicio que no está en el plan no cambia nada', async () => {
    db = createDB(`cal-${n++}`)
    await db.planDays.bulkPut(plan())
    await setRangeOverride(db, 'no_esta', [7, 11])
    expect(await db.planDays.orderBy('weekday').toArray()).toEqual(plan())
  })
})
