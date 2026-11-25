import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, parseImportText, previewImport } from '../backup'
import { createDB, type GymDB } from '../db'
import { markZone, resolveZone } from '../zoneRepo'

let db: GymDB
let n = 0
afterEach(() => db?.delete())
const fresh = (name = `zones-${n++}`) => (db = createDB(name))
const seed = () => {
  const r = parseImportText(JSON.stringify(fixture), 0)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

describe('migración de la base a la versión 3 (D-76)', () => {
  it('abrir con el esquema nuevo una base de la v2 conserva todos los datos y agrega la tabla', async () => {
    const name = `mig3-${n++}`
    // Una base como la que ya tenés en el celu: esquema v2 (con el peso corporal), con datos.
    const old = new Dexie(name)
    old.version(1).stores({
      exercises: 'id, family, archived', planDays: 'id, weekday', mesocycles: 'id, startDate, status',
      sessions: 'id, date, planDayId, mesocycleId, status, *exerciseIds', dayMarks: 'id, date', settings: 'key', meta: 'key',
    })
    old.version(2).stores({ bodyweights: 'id, date' })
    const data = seed()
    await old.table('exercises').bulkPut(data.exercises)
    await old.table('sessions').bulkPut(data.sessions)
    await old.table('mesocycles').bulkPut(data.mesocycles)
    await old.table('bodyweights').put({ id: 'bw-2026-11-02', date: '2026-11-02', kg: 83 })
    await old.table('settings').put({ key: 'app', value: { theme: 'light' } })
    old.close()

    const nuevo = fresh(name)
    await nuevo.open()
    expect(await nuevo.exercises.count()).toBe(data.exercises.length)
    expect(await nuevo.sessions.count()).toBe(data.sessions.length)
    expect(await nuevo.mesocycles.count()).toBe(data.mesocycles.length)
    expect(await nuevo.bodyweights.toArray()).toEqual([{ id: 'bw-2026-11-02', date: '2026-11-02', kg: 83 }])
    expect((await nuevo.settings.get('app'))!.value).toEqual({ theme: 'light' })
    expect(await nuevo.sessions.where('exerciseIds').equals('incline_db_press').count()).toBeGreaterThan(0) // los índices siguen andando
    // La tabla nueva existe, está vacía y se puede usar.
    expect(await nuevo.zoneIssues.count()).toBe(0)
    await markZone(nuevo, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    expect(await nuevo.zoneIssues.count()).toBe(1)
  })
})

describe('anotar y cerrar molestias de zona', () => {
  it('una molestia nueva guarda solo lo que se dio', async () => {
    fresh()
    const i = await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    expect(await db.zoneIssues.get(i.id)).toEqual({ id: i.id, zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    const j = await markZone(db, { zone: 'knee', severity: 'dolor', startedOn: '2026-11-21', exerciseId: 'hack_squat', sessionId: 's1', note: 'al bajar' })
    expect(await db.zoneIssues.get(j.id)).toMatchObject({ zone: 'knee', severity: 'dolor', exerciseId: 'hack_squat', sessionId: 's1', note: 'al bajar' })
  })

  it('la misma zona activa no se duplica: se queda la fecha más vieja y el dolor no baja solo', async () => {
    fresh()
    const a = await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    const b = await markZone(db, { zone: 'neck', severity: 'dolor', startedOn: '2026-11-22' })
    expect(b.id).toBe(a.id)
    expect(await db.zoneIssues.count()).toBe(1)
    expect(await db.zoneIssues.get(a.id)).toMatchObject({ severity: 'dolor', startedOn: '2026-11-20' })
    await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-18' }) // una fecha anterior la corrige hacia atrás
    expect(await db.zoneIssues.get(a.id)).toMatchObject({ severity: 'dolor', startedOn: '2026-11-18' })
  })

  it('zonas distintas son molestias distintas', async () => {
    fresh()
    await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    await markZone(db, { zone: 'hip', severity: 'molestia', startedOn: '2026-11-20' })
    expect(await db.zoneIssues.count()).toBe(2)
  })

  it('"ya pasó" cierra las activas de esa zona con la fecha, sin tocar otras zonas ni las ya cerradas', async () => {
    fresh()
    const neck = await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    const hip = await markZone(db, { zone: 'hip', severity: 'molestia', startedOn: '2026-11-20' })
    await resolveZone(db, 'neck', '2026-11-27')
    expect((await db.zoneIssues.get(neck.id))!.resolvedOn).toBe('2026-11-27')
    expect((await db.zoneIssues.get(hip.id))!.resolvedOn).toBeUndefined()
    await resolveZone(db, 'neck', '2026-12-05') // ya estaba cerrada: no cambia la fecha
    expect((await db.zoneIssues.get(neck.id))!.resolvedOn).toBe('2026-11-27')
    await resolveZone(db, 'knee', '2026-11-27') // sin activa: no hace nada
    expect(await db.zoneIssues.count()).toBe(2)
  })

  it('una fecha de cierre anterior al inicio se corrige al inicio, y después de cerrar vuelve a poder anotarse', async () => {
    fresh()
    const a = await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    await resolveZone(db, 'neck', '2026-11-10')
    expect((await db.zoneIssues.get(a.id))!.resolvedOn).toBe('2026-11-20')
    const b = await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-12-01' })
    expect(b.id).not.toBe(a.id) // una molestia nueva, no reabre la vieja
    expect(await db.zoneIssues.count()).toBe(2)
  })
})

describe('las zonas en el backup', () => {
  it('molestias y zonas corregidas de un ejercicio se conservan al exportar e importar, y un backup viejo se lee igual', async () => {
    fresh()
    await applyImport(db, seed(), 'merge')
    expect((await exportBackup(db)).data.zoneIssues).toEqual([]) // el seed no las trae
    expect((await exportBackup(db)).data.exercises.every((e) => e.zones === undefined)).toBe(true)

    const issue = await markZone(db, { zone: 'neck', severity: 'dolor', startedOn: '2026-11-20', note: 'contractura' })
    await resolveZone(db, 'neck', '2026-11-27')
    await db.exercises.update('rdl_barbell', { zones: ['neck', 'lower_back'] })
    const parsed = parseImportText(JSON.stringify(await exportBackup(db)), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    const other = createDB(`zones-${n++}`)
    try {
      await applyImport(other, parsed.data, 'replace')
      expect(await other.zoneIssues.get(issue.id)).toEqual({ ...issue, resolvedOn: '2026-11-27' })
      expect((await other.exercises.get('rdl_barbell'))!.zones).toEqual(['neck', 'lower_back'])
    } finally {
      await other.delete()
    }
  })

  it('una zona inventada se rechaza, no se importa a medias', async () => {
    fresh()
    await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    await db.exercises.put({ ...seed().exercises[0]!, zones: ['neck'] })
    const backup = await exportBackup(db)
    expect(parseImportText(JSON.stringify(backup), 0).ok).toBe(true) // control
    const badIssue = JSON.parse(JSON.stringify(backup))
    badIssue.data.zoneIssues[0].zone = 'cabeza'
    expect(parseImportText(JSON.stringify(badIssue), 0).ok).toBe(false)
    const badSeverity = JSON.parse(JSON.stringify(backup))
    badSeverity.data.zoneIssues[0].severity = 'grave'
    expect(parseImportText(JSON.stringify(badSeverity), 0).ok).toBe(false)
    const badZones = JSON.parse(JSON.stringify(backup))
    badZones.data.exercises.find((e: { zones?: string[] }) => e.zones).zones = ['cabeza']
    expect(parseImportText(JSON.stringify(badZones), 0).ok).toBe(false)
  })

  it('mezclar no toca las molestias existentes; reemplazar con un archivo sin ellas las borra; la vista previa lo cuenta', async () => {
    fresh()
    await markZone(db, { zone: 'neck', severity: 'molestia', startedOn: '2026-11-20' })
    const sinZonas = seed() // un backup anterior, sin zoneIssues
    expect((await previewImport(db, sinZonas, 'merge')).zoneIssues).toEqual({ added: 0, updated: 0, unchanged: 0, removed: 0 })
    expect((await previewImport(db, sinZonas, 'replace')).zoneIssues).toEqual({ added: 0, updated: 0, unchanged: 0, removed: 1 })
    await applyImport(db, sinZonas, 'merge')
    expect(await db.zoneIssues.count()).toBe(1)
    await applyImport(db, sinZonas, 'replace')
    expect(await db.zoneIssues.count()).toBe(0)
  })
})
