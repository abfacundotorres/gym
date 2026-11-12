import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { nextSetDefaults, pendingWarmups, wouldBeRecord } from '../entry'
import { exposuresOf } from '../history'
import type { SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = (id: string) => data.exercises.find((e) => e.id === id)!
const incline = ex('incline_db_press')
const previous = exposuresOf(data.sessions, 'incline_db_press')

let n = 0
const W = (weight: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({ id: `s${n++}`, type: 'W', weight, reps, ...extra })
const A = (weight: number, reps: number): SetEntry => ({ id: `a${n++}`, type: 'A', weight, reps })
const rec = { weight: 25, targets: [8, 8, 7], repCap: 10 }

describe('nextSetDefaults: con qué se prellena la próxima serie', () => {
  it('la primera serie usa la sugerencia', () => {
    expect(nextSetDefaults([], rec)).toEqual({ weight: 25, reps: 8 })
  })
  it('después sigue el objetivo de cada serie y el peso de la última efectiva', () => {
    expect(nextSetDefaults([W(27.5, 8)], rec)).toEqual({ weight: 27.5, reps: 8 })
    expect(nextSetDefaults([W(27.5, 8), W(27.5, 8)], rec)).toEqual({ weight: 27.5, reps: 7 })
  })
  it('pasado el plan (serie extra) repite las reps de la última efectiva', () => {
    expect(nextSetDefaults([W(25, 8), W(25, 8), W(25, 7)], rec)).toEqual({ weight: 25, reps: 7 })
  })
  it('las aproximaciones no cuentan como serie efectiva para el objetivo de reps', () => {
    expect(nextSetDefaults([A(12.5, 12), A(17.5, 5)], rec)).toEqual({ weight: 25, reps: 8 })
  })
  it('sin sugerencia usa la última serie registrada; sin nada, queda vacío', () => {
    const none = { weight: null, targets: [8, 8, 7], repCap: 10 }
    expect(nextSetDefaults([A(17.5, 5)], none).weight).toBe(17.5)
    expect(nextSetDefaults([], none)).toEqual({ weight: null, reps: 8 })
  })
  it('si no quedan objetivos ni series efectivas, usa el tope de reps', () => {
    expect(nextSetDefaults([], { weight: 25, targets: [], repCap: 10 }).reps).toBe(10)
  })
})

describe('pendingWarmups: aproximaciones que faltan', () => {
  it('antes de la primera efectiva hay aproximaciones por debajo del peso de trabajo', () => {
    const w = pendingWarmups(incline, 25, 4.2, previous, [])
    expect(w.length).toBeGreaterThan(0)
    expect(w.every((s) => s.weight < 25)).toBe(true)
  })
  it('no repite las que ya registraste', () => {
    const all = pendingWarmups(incline, 25, 4.2, previous, [])
    const first = all[0]!
    const rest = pendingWarmups(incline, 25, 4.2, previous, [A(first.weight, first.reps)])
    expect(rest.map((s) => s.weight)).toEqual(all.slice(1).map((s) => s.weight))
  })
  it('después de la primera serie efectiva ya no se ofrecen', () => {
    expect(pendingWarmups(incline, 25, 4.2, previous, [W(25, 8)])).toEqual([])
  })
  it('sin peso de trabajo no hay nada que sugerir', () => {
    expect(pendingWarmups(incline, null, 4.2, previous, [])).toEqual([])
  })
})

describe('wouldBeRecord: aviso de récord antes de guardar', () => {
  const item = { exerciseId: 'incline_db_press', sets: [] as SetEntry[] }
  it('más reps que nunca al mismo peso es récord', () => {
    expect(wouldBeRecord(incline, item, { type: 'W', weight: 25, reps: 11 }, previous, 4.2)).toBe(true)
  })
  it('mayor e1RM con más peso es récord', () => {
    expect(wouldBeRecord(incline, item, { type: 'W', weight: 27.5, reps: 8 }, previous, 4.2)).toBe(true)
  })
  it('una serie común no es récord', () => {
    expect(wouldBeRecord(incline, item, { type: 'W', weight: 25, reps: 8 }, previous, 4.2)).toBe(false)
  })
  it('una aproximación nunca es récord', () => {
    expect(wouldBeRecord(incline, item, { type: 'A', weight: 25, reps: 30 }, previous, 4.2)).toBe(false)
  })
  it('una serie excluida de la progresión (rebote) no es récord', () => {
    expect(wouldBeRecord(incline, item, { type: 'W', weight: 25, reps: 15, flag: 'rebote' }, previous, 4.2)).toBe(false)
  })
  it('la primera vez que se hace el ejercicio no hay récord', () => {
    expect(wouldBeRecord(incline, item, { type: 'W', weight: 25, reps: 30 }, [], 4.2)).toBe(false)
  })
  it('una serie anterior de hoy sube la vara para la siguiente', () => {
    const today = { ...item, sets: [W(25, 11)] }
    expect(wouldBeRecord(incline, today, { type: 'W', weight: 25, reps: 11 }, previous, 4.2)).toBe(false)
    expect(wouldBeRecord(incline, today, { type: 'W', weight: 25, reps: 12 }, previous, 4.2)).toBe(true)
  })
})
