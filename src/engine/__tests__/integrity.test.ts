import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { checkIntegrity, isValidISODate, MAX_DETAIL, type IntegrityInput } from '../integrity'

const data = seedToData(seedSchema.parse(fixture), 0)
const base = (): IntegrityInput => structuredClone({ exercises: data.exercises, planDays: data.planDays, mesocycles: data.mesocycles, sessions: data.sessions })
const codes = (i: IntegrityInput) => checkIntegrity(i).map((f) => f.code)

describe('chequeo de integridad (D-84)', () => {
  it('los datos de prueba (seed) están limpios', () => {
    expect(checkIntegrity(base())).toEqual([])
  })

  it('isValidISODate', () => {
    expect(isValidISODate('2026-02-28')).toBe(true)
    expect(isValidISODate('2026-02-30')).toBe(false)
    expect(isValidISODate('2026-2-3')).toBe(false)
    expect(isValidISODate(20260203)).toBe(false)
  })

  it('sesión con un ejercicio que no existe (o una variante de la que se cambió)', () => {
    const d = base()
    d.sessions[0]!.items[0]!.exerciseId = 'fantasma'
    d.sessions[0]!.exerciseIds = d.sessions[0]!.items.map((i) => i.exerciseId)
    const f = checkIntegrity(d).find((x) => x.code === 'sesion-ejercicio')!
    expect(f.severity).toBe('error')
    expect(f.detail[0]).toContain('fantasma')
    const d2 = base()
    d2.sessions[0]!.items[0]!.swappedFrom = 'otro_fantasma'
    expect(checkIntegrity(d2).find((x) => x.code === 'sesion-ejercicio')!.detail[0]).toContain('otro_fantasma')
  })

  it('la lista de ejercicios de la sesión (índice) tiene que coincidir con lo anotado', () => {
    const d = base()
    d.sessions[1]!.exerciseIds = d.sessions[1]!.exerciseIds.slice(1)
    expect(codes(d)).toEqual(['sesion-indice'])
  })

  it('fecha imposible, series con valores imposibles y reps con decimales', () => {
    const d = base()
    d.sessions[0]!.date = '2026-13-45'
    d.sessions[1]!.items[0]!.sets[0]!.weight = -5
    d.sessions[2]!.items[0]!.sets[0]!.reps = 8.5
    d.sessions[3]!.items[0]!.sets[0]!.weight = Number.NaN
    const out = checkIntegrity(d)
    expect(out.find((f) => f.code === 'sesion-fecha')!.count).toBe(1)
    expect(out.find((f) => f.code === 'serie-valores')!.count).toBe(3)
  })

  it('dos mesociclos activos y más de una sesión sin terminar', () => {
    const d = base()
    d.mesocycles.push({ id: 'otro', status: 'active' })
    d.sessions[0]!.status = 'in_progress'
    d.sessions[1]!.status = 'in_progress'
    const c = codes(d)
    expect(c).toContain('mesociclo-activos')
    expect(c).toContain('sesion-abierta')
    // Una sola abierta es lo normal.
    const ok = base()
    ok.sessions[0]!.status = 'in_progress'
    expect(codes(ok)).not.toContain('sesion-abierta')
  })

  it('referencias a días del plan y mesociclos que no existen son avisos, no errores', () => {
    const d = base()
    d.sessions[0]!.planDayId = 'no_existe'
    d.sessions[1]!.mesocycleId = 'meso-fantasma'
    const out = checkIntegrity(d)
    expect(out.map((f) => [f.code, f.severity])).toEqual([['sesion-plan', 'aviso'], ['sesion-mesociclo', 'aviso']])
  })

  it('el plan: ejercicio inexistente, repetido en el día (como titular o como opción) y archivado', () => {
    const d = base()
    const day = d.planDays[0]!
    day.items[0]!.exerciseId = 'fantasma'
    day.items[1]!.alt.push(day.items[2]!.exerciseId) // una opción que ya es otro ejercicio del día
    d.exercises.find((e) => e.id === day.items[3]!.exerciseId)!.archived = true
    const out = checkIntegrity(d)
    expect(out.find((f) => f.code === 'plan-ejercicio')!.severity).toBe('error')
    expect(out.find((f) => f.code === 'plan-repetido')!.severity).toBe('error')
    expect(out.find((f) => f.code === 'plan-archivado')!.severity).toBe('aviso')
  })

  it('la plantilla del bloque siguiente se revisa aparte y con menos gravedad', () => {
    const d = base()
    const plan = structuredClone(d.planDays)
    plan[0]!.items[0]!.exerciseId = 'fantasma'
    d.mesocycles[0]!.nextPlan = plan
    const out = checkIntegrity(d)
    expect(out.map((f) => [f.code, f.severity])).toEqual([['siguiente-ejercicio', 'aviso']])
    expect(out[0]!.detail[0]).toMatch(/^bloque siguiente · /)
  })

  it('el detalle se acota y el conteo es el total', () => {
    const d = base()
    for (const s of d.sessions) s.items[0]!.sets[0]!.weight = -1
    const many = structuredClone(d.sessions).flatMap((s, i) => Array.from({ length: 3 }, (_, k) => ({ ...s, id: `${s.id}-${i}-${k}`, items: structuredClone(s.items) })))
    d.sessions = many
    const f = checkIntegrity(d).find((x) => x.code === 'serie-valores')!
    expect(f.count).toBe(many.length)
    expect(f.detail).toHaveLength(MAX_DETAIL)
  })
})
