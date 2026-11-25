import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, parseImportText } from '../backup'
import { createDB, SCHEMA_VERSION } from '../db'
import { backupSchema } from '../schemas'
import { deleteSnapshot, listSnapshots, MAX_SNAPSHOTS, readRawBackup, snapshotBeforeMigration } from '../safety'

const NOW = 1_762_600_000_000
let n = 0
const names: string[] = []
const fresh = (p: string) => {
  const name = `${p}-${n++}`
  names.push(name)
  return name
}
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name)
})

/** Una base como la que dejó la versión 1 de la app: sin las tablas de peso ni de molestias. */
async function oldDB(name: string, version: 1 | 2) {
  const db = new Dexie(name)
  db.version(1).stores({
    exercises: 'id, family, archived', planDays: 'id, weekday', mesocycles: 'id, startDate, status',
    sessions: 'id, date, planDayId, mesocycleId, status, *exerciseIds', dayMarks: 'id, date', settings: 'key', meta: 'key',
  })
  if (version === 2) db.version(2).stores({ bodyweights: 'id, date' })
  const r = parseImportText(JSON.stringify(fixture), NOW)
  if (!r.ok) throw new Error(r.error)
  const d = r.data
  await db.table('exercises').bulkPut(d.exercises)
  await db.table('planDays').bulkPut(d.planDays)
  await db.table('mesocycles').bulkPut(d.mesocycles)
  await db.table('sessions').bulkPut(d.sessions)
  await db.table('dayMarks').bulkPut(d.dayMarks)
  if (d.settings) await db.table('settings').put({ key: 'app', value: d.settings })
  db.close()
  return d
}

describe('copia previa a la migración (D-82)', () => {
  it('la versión del esquema declarada es la que crea createDB', () => {
    expect(createDB(fresh('v')).verno).toBe(SCHEMA_VERSION)
  })

  it('una base vieja se copia antes de migrar, y la migración conserva todo', async () => {
    const name = fresh('gym'), safety = fresh('safety')
    const original = await oldDB(name, 1)

    const r = await snapshotBeforeMigration(NOW, name, safety)
    expect(r.status).toBe('saved')
    if (r.status !== 'saved') return
    expect(r.snapshot).toMatchObject({ fromVersion: 1, toVersion: SCHEMA_VERSION, sessions: original.sessions.length })
    expect(r.snapshot.backup.data.sessions).toEqual([...original.sessions].sort((a, b) => (a.id < b.id ? -1 : 1)))

    // Recién ahora migra: nada se pierde y la copia guardada sigue siendo la de antes.
    const db = createDB(name)
    await db.open()
    expect(db.verno).toBe(SCHEMA_VERSION)
    expect(await db.sessions.count()).toBe(original.sessions.length)
    const [saved] = await listSnapshots(safety)
    expect(saved!.backup.data.sessions).toHaveLength(original.sessions.length)
    db.close()
  })

  it('la copia es un backup válido que se importa en una base nueva', async () => {
    const name = fresh('gym'), safety = fresh('safety')
    await oldDB(name, 2)
    await snapshotBeforeMigration(NOW, name, safety)
    const [saved] = await listSnapshots(safety)
    expect(backupSchema.safeParse(JSON.parse(JSON.stringify(saved!.backup))).success).toBe(true)

    const target = createDB(fresh('gym'))
    await applyImport(target, saved!.backup.data, 'replace')
    const copy = await exportBackup(target, NOW)
    expect(copy.data.sessions).toEqual(saved!.backup.data.sessions)
    expect(copy.data.exercises).toEqual(saved!.backup.data.exercises)
    target.close()
  })

  it('sin base (instalación nueva) o con la base al día no copia nada ni crea bases vacías', async () => {
    const name = fresh('gym'), safety = fresh('safety')
    expect(await snapshotBeforeMigration(NOW, name, safety)).toEqual({ status: 'none' })
    expect((await indexedDB.databases()).some((d) => d.name === name)).toBe(false)

    const db = createDB(name)
    await db.open()
    db.close()
    expect(await snapshotBeforeMigration(NOW, name, safety)).toEqual({ status: 'none' })
    expect(await listSnapshots(safety)).toEqual([])
  })

  it('conserva solo las últimas copias y se pueden borrar', async () => {
    const safety = fresh('safety')
    for (let i = 0; i < MAX_SNAPSHOTS + 2; i++) {
      const name = fresh('gym')
      await oldDB(name, 1)
      await snapshotBeforeMigration(NOW + i * 1000, name, safety)
    }
    const kept = await listSnapshots(safety)
    expect(kept.map((s) => s.takenAt)).toEqual([NOW + 3000, NOW + 2000])
    await deleteSnapshot(kept[0]!.id, safety)
    expect((await listSnapshots(safety)).map((s) => s.takenAt)).toEqual([NOW + 2000])
  })

  it('si no se puede guardar la copia, lo avisa y devuelve lo leído para descargar', async () => {
    const name = fresh('gym')
    const original = await oldDB(name, 1)
    // Una "base de seguridad" que no se puede usar: ya existe con otra clave primaria.
    const safety = fresh('safety')
    await new Promise<void>((res, rej) => {
      const q = indexedDB.open(safety, 10)
      q.onupgradeneeded = () => q.result.createObjectStore('snapshots', { keyPath: 'otra' })
      q.onsuccess = () => { q.result.close(); res() }
      q.onerror = () => rej(q.error)
    })
    const r = await snapshotBeforeMigration(NOW, name, safety)
    expect(r.status).toBe('failed')
    if (r.status === 'failed') expect(r.backup?.data.sessions).toHaveLength(original.sessions.length)
  })

  it('readRawBackup lee la base sin migrarla', async () => {
    const name = fresh('gym')
    const original = await oldDB(name, 1)
    const b = await readRawBackup(name, NOW)
    expect(b?.data.sessions).toHaveLength(original.sessions.length)
    const idb = await new Promise<IDBDatabase>((res) => { const q = indexedDB.open(name); q.onsuccess = () => res(q.result) })
    expect(idb.version).toBe(10) // sigue en la v1 de Dexie
    idb.close()
    expect(await readRawBackup(fresh('gym'), NOW)).toBeNull()
  })
})
