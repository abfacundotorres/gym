import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, parseImportText, previewImport } from '../backup'
import { createDB, type GymDB } from '../db'
import { deleteBodyweight, saveBodyweight } from '../bodyweightRepo'

let n = 0
const dbs: GymDB[] = []
const fresh = (name = `bw-${n++}`) => { const d = createDB(name); dbs.push(d); return d }
afterEach(async () => { for (const d of dbs.splice(0)) await d.delete() })

function seed() {
  const r = parseImportText(JSON.stringify(fixture), 0)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

describe('migración de la base a la versión 2', () => {
  it('abrir con el esquema nuevo una base de la v1 conserva todos los datos y agrega la tabla', async () => {
    const name = `mig-${n++}`
    // Una base como la que ya tenés en el celu: esquema v1, con datos.
    const old = new Dexie(name)
    old.version(1).stores({
      exercises: 'id, family, archived', planDays: 'id, weekday', mesocycles: 'id, startDate, status',
      sessions: 'id, date, planDayId, mesocycleId, status, *exerciseIds', dayMarks: 'id, date', settings: 'key', meta: 'key',
    })
    const data = seed()
    await old.table('exercises').bulkPut(data.exercises)
    await old.table('sessions').bulkPut(data.sessions)
    await old.table('mesocycles').bulkPut(data.mesocycles)
    await old.table('settings').put({ key: 'app', value: { theme: 'light' } })
    old.close()

    const db = fresh(name)
    await db.open()
    expect(await db.exercises.count()).toBe(data.exercises.length)
    expect(await db.sessions.count()).toBe(data.sessions.length)
    expect(await db.mesocycles.count()).toBe(data.mesocycles.length)
    expect((await db.settings.get('app'))!.value).toEqual({ theme: 'light' })
    expect(await db.sessions.where('exerciseIds').equals('incline_db_press').count()).toBeGreaterThan(0) // los índices siguen andando
    // La tabla nueva existe, está vacía y se puede usar.
    expect(await db.bodyweights.count()).toBe(0)
    expect(await saveBodyweight(db, '2026-11-17', '82,4')).toBe(true)
    expect((await db.bodyweights.toArray())[0]).toEqual({ id: 'bw-2026-11-17', date: '2026-11-17', kg: 82.4 })
  })
})

describe('guardar y borrar el peso', () => {
  it('uno por día: volver a guardar el mismo día lo reemplaza', async () => {
    const db = fresh()
    await saveBodyweight(db, '2026-11-17', '82,4')
    await saveBodyweight(db, '2026-11-17', '82,0')
    await saveBodyweight(db, '2026-11-18', '81,9')
    expect((await db.bodyweights.orderBy('date').toArray()).map((b) => [b.date, b.kg])).toEqual([['2026-11-17', 82], ['2026-11-18', 81.9]])
  })
  it('un valor inválido no guarda nada', async () => {
    const db = fresh()
    expect(await saveBodyweight(db, '2026-11-17', 'hola')).toBe(false)
    expect(await saveBodyweight(db, '2026-11-17', '5')).toBe(false)
    expect(await db.bodyweights.count()).toBe(0)
  })
  it('se borra', async () => {
    const db = fresh()
    await saveBodyweight(db, '2026-11-17', '82')
    await deleteBodyweight(db, '2026-11-17')
    expect(await db.bodyweights.count()).toBe(0)
  })
})

describe('el peso en el backup', () => {
  it('se exporta y se restaura en otra base', async () => {
    const a = fresh()
    await applyImport(a, seed(), 'merge')
    await saveBodyweight(a, '2026-11-10', '83,1')
    await saveBodyweight(a, '2026-11-17', '82,6')
    const exported = await exportBackup(a, 1_000)
    expect(exported.data.bodyweights).toHaveLength(2)

    const b = fresh()
    const parsed = parseImportText(JSON.stringify(exported), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    await applyImport(b, parsed.data, 'replace')
    expect((await b.bodyweights.orderBy('date').toArray()).map((x) => x.kg)).toEqual([83.1, 82.6])
    expect(await exportBackup(b, 1_000)).toEqual(exported)
  })

  it('un backup anterior (sin pesos) se lee igual: mezclar no toca los pesos que ya tenés', async () => {
    const db = fresh()
    await saveBodyweight(db, '2026-11-17', '82,6')
    const old = JSON.parse(JSON.stringify(await exportBackup(db)))
    delete old.data.bodyweights // como un backup de antes
    const parsed = parseImportText(JSON.stringify(old), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.data.bodyweights).toBeUndefined()
    await applyImport(db, parsed.data, 'merge')
    expect(await db.bodyweights.count()).toBe(1)
  })

  it('reemplazar con un backup sin pesos los borra, y la vista previa lo avisa', async () => {
    const db = fresh()
    await saveBodyweight(db, '2026-11-17', '82,6')
    const old = JSON.parse(JSON.stringify(await exportBackup(db)))
    delete old.data.bodyweights
    const parsed = parseImportText(JSON.stringify(old), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    expect((await previewImport(db, parsed.data, 'replace')).bodyweights.removed).toBe(1)
    expect((await previewImport(db, parsed.data, 'merge')).bodyweights.removed).toBe(0)
    await applyImport(db, parsed.data, 'replace')
    expect(await db.bodyweights.count()).toBe(0)
  })

  it('un peso fuera de rango en el archivo se rechaza', () => {
    const bad = JSON.stringify({ format: 'gym-backup', version: 1, exportedAt: 0, data: { exercises: [], planDays: [], mesocycles: [], sessions: [], dayMarks: [], settings: null, dataQuality: null, bodyweights: [{ id: 'x', date: '2026-11-17', kg: 5 }] } })
    expect(parseImportText(bad, 0).ok).toBe(false)
  })
})
