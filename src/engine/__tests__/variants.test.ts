import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { familyReference, planVariants, variantLabel, variantOptions, variantOverrides } from '../variants'

const data = seedToData(seedSchema.parse(fixture), 0)
const E = (id: string) => data.exercises.find((e) => e.id === id)!

describe('variantes', () => {
  it('opciones: alternativas del plan primero, después la familia', () => {
    const plan = data.planDays.find((d) => d.id === 'lunes_torso')!.items.find((i) => i.exerciseId === 'pulldown_supine_close')
    expect(variantOptions(E('pulldown_supine_close'), plan, data.exercises).map((e) => e.id)).toEqual(['pulldown_neutral', 'pulldown_pronated_wide'])
    expect(variantOptions(E('bench_flat_barbell'), undefined, data.exercises)).toEqual([])
  })

  it('variante sin historial: referencia de familia, sin inventar', () => {
    // jalón prono no tiene datos en el fixture; la referencia es el último jalón supino (05/11, 70)
    expect(familyReference(E('pulldown_pronated_wide'), data.exercises, data.sessions)).toEqual({ exerciseId: 'pulldown_supine_close', date: '2026-11-05', weight: 70 })
    expect(familyReference(E('bench_flat_barbell'), data.exercises, data.sessions)).toBeNull()
  })
})

describe('elegir variante en el ejercicio', () => {
  it('el nombre corto es lo que va entre paréntesis, con mayúscula', () => {
    expect(variantLabel('Vuelos laterales (mancuernas)')).toBe('Mancuernas')
    expect(variantLabel('Vuelos laterales (máquina)')).toBe('Máquina')
    expect(variantLabel('Tríceps polea (cuerda/barra)')).toBe('Cuerda/barra')
    expect(variantLabel('Camilla femoral sentado')).toBe('Camilla femoral sentado')
    expect(variantLabel('Jalón (agarre neutro)  ')).toBe('Agarre neutro')
  })

  const ex = (id: string, extra: object = {}) => ({ ...E('lateral_raise_db'), id, name: id, ...extra })
  const all = [ex('a'), ex('b'), ex('c'), ex('d', { archived: true })]

  it('las opciones son la del plan y sus alternativas, en ese orden', () => {
    expect(planVariants('a', { exerciseId: 'a', alt: ['c', 'b'] }, all).map((e) => e.id)).toEqual(['a', 'c', 'b'])
  })
  it('la actual siempre está, aunque no sea del plan; sin repetir', () => {
    expect(planVariants('c', { exerciseId: 'a', alt: ['b'] }, all).map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(planVariants('a', { exerciseId: 'a', alt: ['a', 'b'] }, all).map((e) => e.id)).toEqual(['a', 'b'])
  })
  it('sin plan, solo la actual', () => {
    expect(planVariants('b', undefined, all).map((e) => e.id)).toEqual(['b'])
  })
  it('se ignoran las archivadas y las que ya no existen, salvo que sea la actual', () => {
    expect(planVariants('a', { exerciseId: 'a', alt: ['d', 'zzz', 'b'] }, all).map((e) => e.id)).toEqual(['a', 'b'])
    expect(planVariants('d', { exerciseId: 'a', alt: ['d'] }, all).map((e) => e.id)).toEqual(['a', 'd'])
  })
  it('una variante con otra unidad lleva un paso de carga razonable', () => {
    expect(variantOverrides({ unit: 'per_hand' }, 'per_hand')).toEqual({})
    expect(variantOverrides({ unit: 'per_hand' }, 'bricks')).toEqual({ unit: 'bricks', increment: 1 })
    expect(variantOverrides({ unit: 'per_hand' }, 'total')).toEqual({ unit: 'total', increment: 2.5 })
  })
})
