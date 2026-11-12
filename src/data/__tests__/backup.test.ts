import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, markBackupDone, needsBackupReminder, parseImportText, previewImport, toCSV } from '../backup'
import { createDB, type GymDB } from '../db'

const NOW = 1_762_600_000_000
let n = 0
const dbs: GymDB[] = []
function freshDB() {
  const db = createDB(`test-${n++}`)
  dbs.push(db)
  return db
}
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
})

function seedData() {
  const r = parseImportText(JSON.stringify(fixture), NOW)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

describe('backup', () => {
  it('exportar e importar da una base idéntica', async () => {
    const a = freshDB()
    await applyImport(a, seedData(), 'merge')
    await markBackupDone(a, NOW) // incluye settings en el export
    const exported = await exportBackup(a, NOW)

    const b = freshDB()
    const parsed = parseImportText(JSON.stringify(exported), NOW)
    expect(parsed.ok && parsed.kind).toBe('backup')
    if (!parsed.ok) return
    await applyImport(b, parsed.data, 'replace')

    expect(await exportBackup(b, NOW)).toEqual(exported)
  })

  it('las superseries sobreviven al backup, y un backup viejo sin ellas se sigue leyendo', async () => {
    const a = freshDB()
    const data = seedData()
    await applyImport(a, data, 'merge')
    const base = data.sessions[0]!
    await a.sessions.put({ ...base, id: 'app-superserie', source: 'app', items: base.items.map((it, i) => (i < 2 ? { ...it, group: 'g-1' } : it)) })
    const exported = await exportBackup(a, NOW)
    expect(exported.data.sessions.find((x) => x.id === 'app-superserie')!.items.filter((it) => it.group === 'g-1')).toHaveLength(2)

    const b = freshDB()
    const parsed = parseImportText(JSON.stringify(exported), NOW)
    if (!parsed.ok) throw new Error(parsed.error)
    await applyImport(b, parsed.data, 'replace')
    expect((await b.sessions.get('app-superserie'))!.items.filter((it) => it.group === 'g-1')).toHaveLength(2)

    // Un backup anterior a las superseries (sin el campo) importa igual.
    expect(seedData().sessions.every((x) => x.items.every((it) => it.group === undefined))).toBe(true)
  })

  it('vista previa: reemplazar vs mezclar', async () => {
    const db = freshDB()
    const data = seedData()
    await applyImport(db, data, 'merge')
    await db.sessions.put({ ...data.sessions[0]!, id: 'app-extra', source: 'app' })

    const incoming = structuredClone(data)
    incoming.sessions[1]!.note = 'cambiada'

    const merge = await previewImport(db, incoming, 'merge')
    expect(merge.sessions).toEqual({ added: 0, updated: 1, unchanged: 5, removed: 0 })
    const replace = await previewImport(db, incoming, 'replace')
    expect(replace.sessions.removed).toBe(1)

    await applyImport(db, incoming, 'merge')
    expect(await db.sessions.count()).toBe(7) // mezclar no borra
    await applyImport(db, incoming, 'replace')
    expect(await db.sessions.count()).toBe(6)
  })

  it('rechaza backups inválidos con un mensaje corto', () => {
    const r = parseImportText(JSON.stringify({ format: 'gym-backup', version: 1, exportedAt: 0, data: {} }))
    expect(r.ok).toBe(false)
    expect(parseImportText('{no json').ok).toBe(false)
  })

  it('CSV: una fila por serie, con escape', () => {
    const data = seedData()
    const csv = toCSV(data)
    const lines = csv.trim().split('\n')
    const totalSets = data.sessions.flatMap((s) => s.items.flatMap((i) => i.sets)).length
    expect(lines).toHaveLength(totalSets + 1)
    expect(lines[0]).toMatch(/^fecha,dia,sesion_id/)
    expect(csv).toContain('2026-10-22,jueves_full_body,seed-2026-10-22,rdl_barbell,Peso muerto rumano (barra),per_side,3,W,30,10,,rp,8,,,alta,,')
  })

  it('aviso de backup: más de 7 días y sesiones nuevas', () => {
    const day = 86_400_000
    expect(needsBackupReminder(null, [], NOW)).toBe(false)
    expect(needsBackupReminder(null, [NOW], NOW)).toBe(true)
    expect(needsBackupReminder(NOW - 8 * day, [NOW - day], NOW)).toBe(true)
    expect(needsBackupReminder(NOW - 8 * day, [NOW - 9 * day], NOW)).toBe(false)
    expect(needsBackupReminder(NOW - 3 * day, [NOW - day], NOW)).toBe(false)
  })
})
