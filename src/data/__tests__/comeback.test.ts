import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, parseImportText } from '../backup'
import { createDB, type GymDB } from '../db'
import { startSession } from '../sessionRepo'
import type { PlanDay } from '../../engine/types'

let db: GymDB
let n = 0
afterEach(() => db?.delete())
const fresh = () => (db = createDB(`comeback-${n++}`))
const plan: PlanDay = { id: 'p', name: 'P', weekday: 1, items: [{ exerciseId: 'a', sets: 3, alt: [] }] }

describe('la vuelta tras una pausa en la base (D-74)', () => {
  it('startSession guarda los días sin entrenar, y sin pausa no agrega el campo', async () => {
    fresh()
    const back = await startSession(db, plan, '2026-12-01', null, undefined, 1, false, false, 26)
    expect((await db.sessions.get(back.id))!.comebackDays).toBe(26)
    const normal = await startSession(db, plan, '2026-12-02', null)
    expect('comebackDays' in (await db.sessions.get(normal.id))!).toBe(false)
  })

  it('se conserva al exportar e importar, y un backup sin el campo se lee igual', async () => {
    fresh()
    const r = parseImportText(JSON.stringify(fixture), 0)
    if (!r.ok) throw new Error(r.error)
    await applyImport(db, r.data, 'merge')
    expect((await exportBackup(db)).data.sessions.every((s) => s.comebackDays === undefined)).toBe(true) // el seed no lo trae

    const s = await startSession(db, plan, '2026-12-01', null, undefined, 1, false, false, 14)
    const parsed = parseImportText(JSON.stringify(await exportBackup(db)), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    const other = createDB(`comeback-${n++}`)
    try {
      await applyImport(other, parsed.data, 'replace')
      expect((await other.sessions.get(s.id))!.comebackDays).toBe(14)
    } finally {
      await other.delete()
    }
  })

  it('un valor imposible se rechaza', async () => {
    fresh()
    await startSession(db, plan, '2026-12-01', null, undefined, 1, false, false, 14)
    const backup = await exportBackup(db)
    expect(parseImportText(JSON.stringify(backup), 0).ok).toBe(true) // control
    for (const bad of [0, -3, 4.5, '14']) {
      const copy = JSON.parse(JSON.stringify(backup))
      copy.data.sessions.find((x: { comebackDays?: unknown }) => x.comebackDays != null).comebackDays = bad
      expect(parseImportText(JSON.stringify(copy), 0).ok, String(bad)).toBe(false)
    }
  })
})
