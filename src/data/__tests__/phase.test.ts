import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, parseImportText } from '../backup'
import { createDB, type GymDB } from '../db'
import { startNextMesocycle } from '../planRepo'
import type { Mesocycle } from '../../engine/types'

let db: GymDB
let n = 0
afterEach(() => db?.delete())
const fresh = () => (db = createDB(`phase-${n++}`))
const meso = (extra: Partial<Mesocycle> = {}): Mesocycle => ({ id: 'm1', startDate: '2026-10-19', accumulationWeeks: 5, deloadWeeks: 1, status: 'active', notes: '', ...extra })

describe('fase del siguiente mesociclo', () => {
  it('hereda la del anterior por defecto', async () => {
    fresh()
    const next = await startNextMesocycle(db, meso({ phase: 'cut' }), '2026-11-30', null)
    expect(next.phase).toBe('cut')
    expect((await db.mesocycles.get(next.id))!.phase).toBe('cut')
    expect((await db.mesocycles.get('m1'))!.status).toBe('finished')
  })
  it('se puede elegir otra, o dejarla sin definir', async () => {
    fresh()
    expect((await startNextMesocycle(db, meso({ phase: 'cut' }), '2026-11-30', null, '', 'bulk')).phase).toBe('bulk')
    const none = await startNextMesocycle(db, meso({ id: 'm2', phase: 'cut' }), '2026-12-14', null, '', null)
    expect('phase' in none).toBe(false)
  })
  it('un mesociclo sin fase sigue sin fase', async () => {
    fresh()
    expect('phase' in (await startNextMesocycle(db, meso(), '2026-11-30', null))).toBe(false)
  })
})

describe('la fase en el backup', () => {
  it('se conserva al exportar e importar, y un backup sin fase se lee igual', async () => {
    fresh()
    const r = parseImportText(JSON.stringify(fixture), 0)
    if (!r.ok) throw new Error(r.error)
    await applyImport(db, r.data, 'merge')
    const exported = await exportBackup(db)
    expect(exported.data.mesocycles.every((m) => m.phase === undefined)).toBe(true) // el seed no trae fase

    await db.mesocycles.put({ ...meso({ id: 'con-fase', phase: 'cut' }) })
    const withPhase = await exportBackup(db)
    const parsed = parseImportText(JSON.stringify(withPhase), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    const other = createDB(`phase-${n++}`)
    try {
      await applyImport(other, parsed.data, 'replace')
      expect((await other.mesocycles.get('con-fase'))!.phase).toBe('cut')
    } finally {
      await other.delete()
    }
  })
})
