import { describe, expect, it } from 'vitest'
import { addableExercises, addPlanItem, buildExercise, DEFAULT_PLAN_SETS, inDay, moveItem, removePlanItem, UNIT_DEFAULTS, validNewExercise } from '../planEdit'
import type { Exercise, PlanDay } from '../types'

const it_ = (exerciseId: string, extra: Partial<PlanDay['items'][number]> = {}) => ({ exerciseId, sets: 3, alt: [], ...extra })
const plan = (): PlanDay[] => [
  { id: 'a', name: 'A', weekday: 1, items: [it_('x'), it_('y', { alt: ['y2'] }), it_('z')] },
  { id: 'b', name: 'B', weekday: 4, items: [it_('y', { alt: ['y2'], rangeOverride: [6, 8] })] },
]
const ex = (id: string, extra: Partial<Exercise> = {}): Exercise => ({ id, name: id, family: id, unit: 'total', primary: ['lats'], secondary: [], range: [8, 12], increment: 2.5, restSec: 90, warmup: 'light', ...extra })

describe('editar el plan (D-83)', () => {
  it('moveItem sube y baja, y en los extremos no hace nada', () => {
    const items = plan()[0]!.items
    expect(moveItem(items, 'y', -1).map((i) => i.exerciseId)).toEqual(['y', 'x', 'z'])
    expect(moveItem(items, 'y', 1).map((i) => i.exerciseId)).toEqual(['x', 'z', 'y'])
    expect(moveItem(items, 'x', -1)).toBe(items)
    expect(moveItem(items, 'z', 1)).toBe(items)
    expect(moveItem(items, 'nope', 1)).toBe(items)
  })

  it('addPlanItem suma al final con 3 series y no toca los otros días', () => {
    const out = addPlanItem(plan(), 'a', 'w')
    expect(out[0]!.items.at(-1)).toEqual({ exerciseId: 'w', sets: DEFAULT_PLAN_SETS, alt: [] })
    expect(out[1]).toEqual(plan()[1])
  })

  it('addPlanItem de un ejercicio que ya está en otro día trae sus opciones y su rango', () => {
    const out = addPlanItem(plan(), 'a', 'y')
    expect(out).toEqual(plan()) // ya está en a: no se duplica
    const base = plan()
    base[0]!.items = base[0]!.items.filter((i) => i.exerciseId !== 'y')
    const added = addPlanItem(base, 'a', 'y')
    expect(added[0]!.items.at(-1)).toEqual({ exerciseId: 'y', sets: 3, alt: ['y2'], rangeOverride: [6, 8] })
    // y las opciones no quedan compartidas por referencia
    added[0]!.items.at(-1)!.alt.push('otra')
    expect(added[1]!.items[0]!.alt).toEqual(['y2'])
  })

  it('no se suma un ejercicio que ya es opción de otro del día', () => {
    expect(inDay(plan()[0]!, 'y2')).toBe(true)
    expect(addPlanItem(plan(), 'a', 'y2')).toEqual(plan())
  })

  it('removePlanItem saca solo del día pedido, y un día se queda al menos con uno', () => {
    const out = removePlanItem(plan(), 'a', 'y')
    expect(out[0]!.items.map((i) => i.exerciseId)).toEqual(['x', 'z'])
    expect(out[1]!.items.map((i) => i.exerciseId)).toEqual(['y'])
    expect(removePlanItem(plan(), 'b', 'y')).toEqual(plan())
  })

  it('addableExercises: sin archivados, sin los del día ni sus opciones, por nombre', () => {
    const all = [ex('x'), ex('y'), ex('y2'), ex('w2', { name: 'B' }), ex('w', { name: 'A' }), ex('old', { archived: true })]
    expect(addableExercises(plan()[0]!, all).map((e) => e.id)).toEqual(['w', 'w2'])
  })
})

describe('ejercicio nuevo (D-83)', () => {
  const base = { id: 'remo_x', name: '  Remo X ', family: '', unit: 'total' as const, range: [10, 15] as [number, number], increment: 2.5, restSec: 90, warmup: 'light' as const, primary: ['lats' as const] }

  it('construye un ejercicio válido: familia propia por defecto, sin secundarios', () => {
    expect(buildExercise(base)).toEqual({ id: 'remo_x', name: 'Remo X', family: 'remo_x', unit: 'total', primary: ['lats'], secondary: [], range: [10, 15], increment: 2.5, restSec: 90, warmup: 'light' })
    expect(buildExercise({ ...base, family: ' remo ' }).family).toBe('remo')
  })

  it('en minutos es cardio: sin músculos ni aproximaciones', () => {
    const c = buildExercise({ ...base, unit: 'minutes', primary: ['lats'], warmup: 'heavy' })
    expect(c).toMatchObject({ cardio: true, primary: [], warmup: 'none', unit: 'minutes' })
  })

  it('validación: nombre, rango, incremento y un músculo primario (salvo cardio)', () => {
    expect(validNewExercise(base)).toBe(true)
    expect(validNewExercise({ ...base, name: '  ' })).toBe(false)
    expect(validNewExercise({ ...base, range: [12, 8] })).toBe(false)
    expect(validNewExercise({ ...base, range: [0, 8] })).toBe(false)
    expect(validNewExercise({ ...base, increment: 0 })).toBe(false)
    expect(validNewExercise({ ...base, primary: [] })).toBe(false)
    expect(validNewExercise({ ...base, primary: [], unit: 'minutes' })).toBe(true)
  })

  it('cada unidad arranca con valores válidos', () => {
    for (const d of Object.values(UNIT_DEFAULTS)) expect(d.range[0]).toBeLessThanOrEqual(d.range[1])
  })
})
