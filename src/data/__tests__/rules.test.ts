import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, exportBackup, getSettings, parseImportText } from '../backup'
import { createDB, type GymDB } from '../db'
import { saveRules } from '../settingsRepo'
import { DEFAULT_RULES, resolveRules } from '../../engine/rules'

let db: GymDB
let n = 0
afterEach(() => db?.delete())
const fresh = () => (db = createDB(`rules-${n++}`))
const seed = () => {
  const r = parseImportText(JSON.stringify(fixture), 0)
  if (!r.ok) throw new Error(r.error)
  return r.data
}

describe('guardar las reglas (D-78)', () => {
  it('guarda solo lo que difiere de los valores por defecto y no toca el resto de los ajustes', async () => {
    fresh()
    await db.settings.put({ key: 'app', value: { ...(await getSettings(db)), kgPerBrick: 5, theme: 'light' } })
    await saveRules(db, resolveRules({ comebackMinDays: 14, deloadMode: 'rest', spikePct: 50 }))
    const s = await getSettings(db)
    expect(s.rules).toEqual({ comebackMinDays: 14, deloadMode: 'rest' }) // spikePct es el de siempre: no se guarda
    expect(s).toMatchObject({ kgPerBrick: 5, theme: 'light' })
  })

  it('volver a los valores por defecto borra el campo', async () => {
    fresh()
    await saveRules(db, resolveRules({ failureStreakMin: 4 }))
    expect((await getSettings(db)).rules).toEqual({ failureStreakMin: 4 })
    await saveRules(db, DEFAULT_RULES)
    expect('rules' in (await getSettings(db))).toBe(false)
  })

  it('un valor inválido no se guarda: se normaliza al guardar', async () => {
    fresh()
    await saveRules(db, { ...DEFAULT_RULES, comebackMinDays: 99, spikeMinExtra: 5 })
    expect((await getSettings(db)).rules).toEqual({ spikeMinExtra: 5 })
  })
})

describe('las reglas en el backup', () => {
  it('se conservan al exportar e importar, y un backup sin ellas se lee igual', async () => {
    fresh()
    await applyImport(db, seed(), 'merge')
    expect((await exportBackup(db)).data.settings?.rules).toBeUndefined() // el seed no las trae
    await saveRules(db, resolveRules({ comebackMinDays: 14, comebackLoadPct: [90, 85, 70], deloadMode: 'light' }))
    const parsed = parseImportText(JSON.stringify(await exportBackup(db)), 0)
    if (!parsed.ok) throw new Error(parsed.error)
    const other = createDB(`rules-${n++}`)
    try {
      await applyImport(other, parsed.data, 'replace')
      expect((await getSettings(other)).rules).toEqual({ comebackMinDays: 14, comebackLoadPct: [90, 85, 70], deloadMode: 'light' })
    } finally {
      await other.delete()
    }
  })

  it('valores fuera de rango o de tipo equivocado se rechazan', async () => {
    fresh()
    await applyImport(db, seed(), 'merge')
    await saveRules(db, resolveRules({ comebackMinDays: 14 }))
    const backup = await exportBackup(db)
    expect(parseImportText(JSON.stringify(backup), 0).ok).toBe(true) // control
    type B = { data: { settings: { rules: Record<string, unknown> } } }
    const mutations: [string, (b: B) => void][] = [
      ['días bajo el mínimo', (b) => { b.data.settings.rules.comebackMinDays = 3 }],
      ['días sobre el máximo', (b) => { b.data.settings.rules.comebackMinDays = 40 }],
      ['no entero', (b) => { b.data.settings.rules.comebackMinDays = 10.5 }],
      ['cargas de vuelta incompletas', (b) => { b.data.settings.rules.comebackLoadPct = [90, 85] }],
      ['carga de vuelta fuera de rango', (b) => { b.data.settings.rules.comebackLoadPct = [90, 10, 70] }],
      ['umbral de avisos', (b) => { b.data.settings.rules.failureSessionMin = 1 }],
      ['porcentaje de salto', (b) => { b.data.settings.rules.spikePct = 500 }],
      ['modo de deload', (b) => { b.data.settings.rules.deloadMode = 'extremo' }],
    ]
    for (const [name, mutate] of mutations) {
      const bad = JSON.parse(JSON.stringify(backup)) as B
      mutate(bad)
      expect(parseImportText(JSON.stringify(bad), 0).ok, name).toBe(false)
    }
  })
})
