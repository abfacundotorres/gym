import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, parseImportText } from '../backup'
import { createDB, SCHEMA_VERSION, type GymDB } from '../db'
import { diagnose, diagnosticText } from '../diagnostic'

let n = 0
const dbs: GymDB[] = []
async function seeded() {
  const db = createDB(`diag-${n++}`)
  dbs.push(db)
  const r = parseImportText(JSON.stringify(fixture), 0)
  if (!r.ok) throw new Error(r.error)
  await applyImport(db, r.data, 'merge')
  return db
}
afterEach(async () => { for (const db of dbs.splice(0)) await db.delete() })

describe('diagnóstico (D-84)', () => {
  it('una base sana: sin hallazgos, versión y cantidades', async () => {
    const db = await seeded()
    const r = await diagnose(db)
    expect(r.findings).toEqual([])
    expect(r.schemaVersion).toBe(SCHEMA_VERSION)
    expect(r.counts.sessions).toBe(6)
    expect(r.counts.exercises).toBe(22)
  })

  it('un dato que no cumple el formato del backup se marca (y se ve qué campo)', async () => {
    const db = await seeded()
    const s = (await db.sessions.toArray())[0]!
    await db.sessions.put({ ...s, status: 'rota' as never })
    const r = await diagnose(db)
    const f = r.findings.find((x) => x.code === 'formato')!
    expect(f.severity).toBe('error')
    expect(f.detail.join('\n')).toContain('status')
    expect(r.findings[0]!.code).toBe('formato') // lo más grave primero
  })

  it('una referencia rota aparece como problema', async () => {
    const db = await seeded()
    const day = (await db.planDays.toArray())[0]!
    await db.planDays.put({ ...day, items: [{ exerciseId: 'fantasma', sets: 3, alt: [] }, ...day.items] })
    expect((await diagnose(db)).findings.map((f) => f.code)).toEqual(['plan-ejercicio'])
  })

  it('el texto para avisar trae versiones, cantidades y hallazgos, sin datos de entrenamiento', async () => {
    const db = await seeded()
    const day = (await db.planDays.toArray())[0]!
    await db.planDays.put({ ...day, items: [{ exerciseId: 'fantasma', sets: 3, alt: [] }, ...day.items] })
    const text = diagnosticText(await diagnose(db), { commit: 'abc1234', builtAt: '25/11 21:00' })
    expect(text).toContain('App abc1234')
    expect(text).toContain(`esquema v${SCHEMA_VERSION}`)
    expect(text).toContain('sessions 6')
    expect(text).toContain('ERROR plan-ejercicio (1)')
    expect(text).not.toMatch(/\d+×\d+/) // ningún "peso×reps"
    const ok = diagnosticText(await diagnose(await seeded()), { commit: 'x', builtAt: 'y' })
    expect(ok).toContain('Chequeo: todo en orden')
  })
})
