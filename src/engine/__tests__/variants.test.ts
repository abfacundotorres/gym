import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { familyReference, variantOptions } from '../variants'

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
