import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { applyImport, parseImportText } from '../backup'
import { createDB, type GymDB } from '../db'
import { createVariant } from '../exerciseRepo'
import { setPlanAlt } from '../planRepo'

let db: GymDB
let n = 0
afterEach(() => db?.delete())

async function fresh() {
  db = createDB(`variants-${n++}`)
  const r = parseImportText(JSON.stringify(fixture), 0)
  if (!r.ok) throw new Error(r.error)
  await applyImport(db, r.data, 'merge')
  return db
}

describe('crear una variante', () => {
  it('copia la configuración con otro nombre y sin historial', async () => {
    await fresh()
    const base = (await db.exercises.get('lateral_raise_db'))!
    const v = await createVariant(db, base, 'Vuelos laterales (máquina)')
    expect(v).toMatchObject({ name: 'Vuelos laterales (máquina)', family: base.family, unit: base.unit, range: base.range, primary: base.primary })
    expect(v.id).not.toBe(base.id)
    expect(await db.sessions.where('exerciseIds').equals(v.id).count()).toBe(0)
  })
  it('con otra unidad usa el paso de la unidad y no arrastra la barra', async () => {
    await fresh()
    const bench = (await db.exercises.get('bench_flat_barbell'))!
    expect(bench.barKg).toBeDefined()
    const v = await createVariant(db, bench, 'Press banco (máquina)', 'bricks')
    expect(v).toMatchObject({ unit: 'bricks', increment: 1 })
    expect(v.barKg).toBeUndefined()
    const same = await createVariant(db, bench, 'Press banco (smith)')
    expect(same.barKg).toBe(bench.barKg)
  })
  it('un nombre repetido recibe otro id', async () => {
    await fresh()
    const base = (await db.exercises.get('lateral_raise_db'))!
    const a = await createVariant(db, base, 'Vuelos (máquina)')
    const b = await createVariant(db, base, 'Vuelos (máquina)')
    expect(a.id).not.toBe(b.id)
  })
})

describe('opciones del plan', () => {
  const alts = async (id: string) => (await db.planDays.toArray()).flatMap((d) => d.items.filter((i) => i.exerciseId === id).map((i) => [d.id, i.alt] as const))

  it('se agrega en todos los días donde aparece el ejercicio, sin repetir', async () => {
    await fresh()
    const days = await alts('lateral_raise_db')
    expect(days.length).toBeGreaterThan(1) // el vuelo lateral está en más de un día
    await setPlanAlt(db, 'lateral_raise_db', 'lateral_raise_machine', true)
    await setPlanAlt(db, 'lateral_raise_db', 'lateral_raise_machine', true)
    for (const [, alt] of await alts('lateral_raise_db')) expect(alt.filter((a) => a === 'lateral_raise_machine')).toHaveLength(1)
  })
  it('se quita, y no toca otros ejercicios ni las otras opciones', async () => {
    await fresh()
    const before = await alts('pulldown_supine_close')
    await setPlanAlt(db, 'lateral_raise_db', 'x', true)
    await setPlanAlt(db, 'lateral_raise_db', 'x', false)
    for (const [, alt] of await alts('lateral_raise_db')) expect(alt).not.toContain('x')
    expect(await alts('pulldown_supine_close')).toEqual(before)
  })
  it('un ejercicio no puede ser opción de sí mismo', async () => {
    await fresh()
    await setPlanAlt(db, 'lateral_raise_db', 'lateral_raise_db', true)
    for (const [, alt] of await alts('lateral_raise_db')) expect(alt).not.toContain('lateral_raise_db')
  })
})
