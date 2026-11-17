import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, parseImportText } from '../backup'
import { createDB, type GymDB } from '../db'
import { saveNextPlan, startNextMesocycle } from '../planRepo'
import type { Mesocycle, PlanDay } from '../../engine/types'

let db: GymDB
let n = 0
afterEach(() => db?.delete())
const fresh = () => (db = createDB(`nextblock-${n++}`))
const meso = (extra: Partial<Mesocycle> = {}): Mesocycle => ({ id: 'm1', startDate: '2026-10-19', accumulationWeeks: 5, deloadWeeks: 1, status: 'active', notes: '', ...extra })
const draft: PlanDay[] = [{ id: 'p', name: 'P', weekday: 1, items: [{ exerciseId: 'a', sets: 5, alt: ['b'] }] }]

describe('plantilla del bloque siguiente en la base', () => {
  it('se guarda en el mesociclo activo, se reemplaza y se descarta, sin tocar el resto', async () => {
    fresh()
    await db.mesocycles.put(meso({ phase: 'cut', notes: 'hola' }))
    await saveNextPlan(db, 'm1', draft)
    expect(await db.mesocycles.get('m1')).toEqual(meso({ phase: 'cut', notes: 'hola', nextPlan: draft }))
    await saveNextPlan(db, 'm1', [{ ...draft[0]!, name: 'P2' }])
    expect((await db.mesocycles.get('m1'))!.nextPlan![0]!.name).toBe('P2')
    await saveNextPlan(db, 'm1', null)
    const m = (await db.mesocycles.get('m1'))!
    expect('nextPlan' in m).toBe(false)
    expect(m).toEqual(meso({ phase: 'cut', notes: 'hola' }))
  })

  it('no se guarda en un mesociclo cerrado ni en uno que no existe', async () => {
    fresh()
    await db.mesocycles.put(meso({ status: 'finished' }))
    await saveNextPlan(db, 'm1', draft)
    await saveNextPlan(db, 'nada', draft)
    expect('nextPlan' in (await db.mesocycles.get('m1'))!).toBe(false)
    expect(await db.mesocycles.get('nada')).toBeUndefined()
  })

  it('al empezar el siguiente bloque se aplica el plan resuelto y la plantilla no queda ni en el cerrado ni en el nuevo', async () => {
    fresh()
    await db.mesocycles.put(meso({ nextPlan: draft }))
    const next = await startNextMesocycle(db, meso({ nextPlan: draft }), '2026-11-30', draft)
    expect(await db.planDays.get('p')).toEqual(draft[0])
    expect('nextPlan' in next).toBe(false)
    expect('nextPlan' in (await db.mesocycles.get('m1'))!).toBe(false)
    expect((await db.mesocycles.get('m1'))!.status).toBe('finished')
    expect((await db.mesocycles.get(next.id))!.status).toBe('active')
  })
})

describe('la plantilla en el backup', () => {
  it('se conserva al exportar e importar, y un backup sin ella se lee igual', async () => {
    fresh()
    const r = parseImportText(JSON.stringify(fixture), 0)
    if (!r.ok) throw new Error(r.error)
    await applyImport(db, r.data, 'merge')
    expect((await exportBackup(db)).data.mesocycles.every((m) => m.nextPlan === undefined)).toBe(true) // el seed no la trae

    await db.mesocycles.put(meso({ id: 'con-plantilla', nextPlan: draft }))
    const parsed = parseImportText(JSON.stringify(await exportBackup(db)), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    const other = createDB(`nextblock-${n++}`)
    try {
      await applyImport(other, parsed.data, 'replace')
      expect((await other.mesocycles.get('con-plantilla'))!.nextPlan).toEqual(draft)
    } finally {
      await other.delete()
    }
  })

  it('una plantilla mal formada se rechaza, no se importa a medias', async () => {
    fresh()
    await db.mesocycles.put(meso({ nextPlan: draft }))
    const backup = await exportBackup(db)
    expect(parseImportText(JSON.stringify(backup), 0).ok).toBe(true) // control: el mismo backup sano entra
    const bad = JSON.parse(JSON.stringify(backup))
    bad.data.mesocycles[0].nextPlan[0].weekday = 9
    expect(parseImportText(JSON.stringify(bad), 0).ok).toBe(false)
  })
})
