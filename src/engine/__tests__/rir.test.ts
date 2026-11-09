import { describe, expect, it } from 'vitest'
import type { ExerciseExposure } from '../history'
import { recommend } from '../progression'
import type { Exercise, SetEntry } from '../types'

const bench = { unit: 'per_side', barKg: 20, increment: 2.5, range: [8, 10] } as Exercise
const K = 4.2
let n = 0
const W = (reps: number, rir?: number, weight = 25): SetEntry => ({ id: `r${n++}`, type: 'W', weight, reps, ...(rir != null ? { rir } : {}) })
const expo = (date: string, sets: SetEntry[]): ExerciseExposure => ({ date, sessionId: date, item: { exerciseId: 'x', sets } })
const rec = (h: ExerciseExposure[], hold = false) => recommend(bench, 3, h, { kgPerBrick: K, hold })

describe('RIR en la progresión (D-51)', () => {
  it('sin RIR todo sigue igual', () => {
    expect(rec([expo('d1', [W(10), W(10), W(10)])])).toMatchObject({ status: 'increase', weight: 27.5 })
    expect(rec([expo('d1', [W(8), W(8), W(8)])])).toMatchObject({ status: 'same', targets: [9, 9, 9] })
  })

  it('tope de reps con RIR 0 la primera vez: repetir, sin subir', () => {
    const r = rec([expo('d1', [W(10), W(10), W(10, 0)])])
    expect(r).toMatchObject({ status: 'same', weight: 25, targets: [10, 10, 10], note: 'rir_defer' })
    expect(r.message).toMatch(/sin reservas/)
  })

  it('si ya lo repetiste en el tope, se sube (no se traba)', () => {
    const h = [expo('d1', [W(10), W(10), W(10, 0)]), expo('d2', [W(10), W(10), W(10, 0)])]
    expect(rec(h)).toMatchObject({ status: 'increase', weight: 27.5 })
  })

  it('tope de reps con 1 de reserva o más: sube', () => {
    expect(rec([expo('d1', [W(10), W(10), W(10, 1)])]).status).toBe('increase')
    expect(rec([expo('d1', [W(10), W(10), W(10, 3)])]).status).toBe('increase')
  })

  it('solo cuenta el RIR de la última serie al peso de trabajo', () => {
    expect(rec([expo('d1', [W(10, 0), W(10), W(10, 2)])]).status).toBe('increase')
    expect(rec([expo('d1', [W(10), W(10), W(10, 0)])]).note).toBe('rir_defer')
  })

  it('te sobraron 3 o más: sumá hasta 2 reps, sin pasar el tope', () => {
    expect(rec([expo('d1', [W(8), W(8), W(8, 3)])])).toMatchObject({ status: 'same', targets: [10, 10, 10], note: 'rir_fast' })
    expect(rec([expo('d1', [W(9), W(9), W(9, 3)])]).targets).toEqual([10, 10, 10]) // tope
    expect(rec([expo('d1', [W(8), W(8), W(8, 2)])])).toMatchObject({ targets: [9, 9, 9] })
    expect(rec([expo('d1', [W(8), W(8), W(8, 2)])]).note).toBeUndefined()
  })

  it('con día bajo (hold) manda el día bajo, sin notas de RIR', () => {
    const held = rec([expo('d1', [W(10), W(10), W(10, 0)])], true)
    expect(held).toMatchObject({ status: 'same', weight: 25, targets: [10, 10, 10], held: true })
    expect(held.note).toBeUndefined()
  })

  it('un RIR en series excluidas no cuenta', () => {
    const rebote: SetEntry = { ...W(10, 0), flag: 'rebote' }
    expect(rec([expo('d1', [W(10), W(10), W(10, 1), rebote])]).status).toBe('increase')
  })
})

describe('orden de sesiones del mismo día', () => {
  it('ordena por hora de inicio y no por id', async () => {
    const { exposuresOf } = await import('../history')
    const mk = (id: string, startedAt: number): import('../types').Session => ({
      id, date: '2026-11-09', planDayId: 'p', mesocycleId: null, note: '', startedAt, finishedAt: null, status: 'finished', source: 'app',
      items: [{ exerciseId: 'x', sets: [W(8)] }], exerciseIds: ['x'],
    })
    const out = exposuresOf([mk('zzz', 1000), mk('aaa', 2000)], 'x')
    expect(out.map((e) => e.sessionId)).toEqual(['zzz', 'aaa'])
  })
})
