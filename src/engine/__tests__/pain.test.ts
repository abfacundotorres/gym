import { describe, expect, it } from 'vitest'
import type { ExerciseExposure } from '../history'
import { reviewMesocycle } from '../periodization'
import { recommend } from '../progression'
import { newSessionItems, summaryText } from '../session'
import { suggestFewerSets } from '../readiness'
import { defaultSettings, type Exercise, type Mesocycle, type PlanDay, type Session, type SessionItem, type SetEntry } from '../types'

const bench = { unit: 'per_side', barKg: 20, increment: 2.5, range: [8, 10] } as Exercise
const K = 4.2
let n = 0
const W = (reps: number): SetEntry => ({ id: `p${n++}`, type: 'W', weight: 25, reps })
const expo = (sets: SetEntry[], pain?: SessionItem['pain']): ExerciseExposure => ({ date: 'd1', sessionId: 'd1', item: { exerciseId: 'x', sets, ...(pain ? { pain } : {}) } })
const rec = (e: ExerciseExposure, hold = false) => recommend(bench, 3, [e], { kgPerBrick: K, hold })

describe('molestia y dolor en la progresión (D-52)', () => {
  it('sin marca todo sigue igual', () => {
    expect(rec(expo([W(10), W(10), W(10)]))).toMatchObject({ status: 'increase', weight: 27.5 })
  })

  it('molestia: no sube, mismo peso y repite lo de la última vez', () => {
    const r = rec(expo([W(10), W(10), W(10)], 'molestia'))
    expect(r).toMatchObject({ status: 'same', weight: 25, targets: [10, 10, 10], pain: 'molestia' })
    expect(r.message).toMatch(/molestia/)
    expect(rec(expo([W(8), W(9), W(8)], 'molestia')).targets).toEqual([8, 9, 8]) // sin sumar rep
  })

  it('dolor: baja la carga un 10 %', () => {
    const r = rec(expo([W(10), W(10), W(10)], 'dolor'))
    expect(r).toMatchObject({ status: 'same', weight: 22.5, targets: [10, 10, 10], pain: 'dolor' })
  })

  it('manda por encima del día bajo y sin datos suficientes solo marca el aviso', () => {
    expect(rec(expo([W(10), W(10), W(10)], 'dolor'), true).weight).toBe(22.5)
    const few = rec(expo([W(8), W(8)], 'molestia'))
    expect(few).toMatchObject({ status: 'insufficient', pain: 'molestia' })
    expect(few.weight).toBe(25)
  })
})

describe('poco tiempo (D-53)', () => {
  const plan: PlanDay = {
    id: 'p', name: 'P', weekday: 1,
    items: [{ exerciseId: 'a', sets: 3, alt: [] }, { exerciseId: 'c', sets: 1, alt: [], optional: true }, { exerciseId: 'b', sets: 3, alt: [] }],
  }
  it('sin ejercicios opcionales', () => {
    expect(newSessionItems(plan).map((i) => i.exerciseId)).toEqual(['a', 'b', 'c'])
    expect(newSessionItems(plan, true).map((i) => i.exerciseId)).toEqual(['a', 'b'])
  })
  it('se sugiere una serie menos con día bajo o poco tiempo', () => {
    expect(suggestFewerSets(undefined, false)).toBe(false)
    expect(suggestFewerSets({ sleep: 4, energy: 4 }, false)).toBe(false)
    expect(suggestFewerSets({ sleep: 4, energy: 4 }, true)).toBe(true)
    expect(suggestFewerSets({ sleep: 1, energy: 2 }, false)).toBe(true)
  })
})

describe('resumen y revisión con molestias', () => {
  it('el resumen marca la molestia', () => {
    const ex = new Map<string, Exercise>([['b', { id: 'b', name: 'Banca', unit: 'total' } as Exercise]])
    const plan = { id: 'p', name: 'P', weekday: 1, items: [] } as PlanDay
    const s = { id: 's', date: '2026-11-09', planDayId: 'p', note: '', status: 'finished', exerciseIds: ['b'], items: [{ exerciseId: 'b', pain: 'molestia', sets: [W(8)] }] } as Session
    expect(summaryText(s, plan, ex)).toContain('Banca [molestia]: 25×8')
  })

  it('molestias en 2 de las últimas 3 veces proponen rotar la variante (tildado)', () => {
    const exs = new Map<string, Exercise>([
      ['row', { id: 'row', name: 'Remo bajo', family: 'remo', unit: 'total', primary: ['upper_back'], secondary: [], range: [8, 12], increment: 5, restSec: 90, warmup: 'none' } as Exercise],
      ['row2', { id: 'row2', name: 'Remo 45', family: 'remo', unit: 'total', primary: ['upper_back'], secondary: [], range: [8, 12], increment: 5, restSec: 90, warmup: 'none' } as Exercise],
    ])
    const planDays: PlanDay[] = [{ id: 'p', name: 'P', weekday: 1, items: [{ exerciseId: 'row', sets: 3, alt: ['row2'] }] }]
    const meso: Mesocycle = { id: 'm', startDate: '2026-10-19', accumulationWeeks: 5, deloadWeeks: 1, status: 'active', notes: '' }
    const mk = (date: string, reps: number, pain?: 'molestia'): Session => ({
      id: date, date, planDayId: 'p', mesocycleId: 'm', note: '', startedAt: 1, finishedAt: 2, status: 'finished', source: 'app',
      items: [{ exerciseId: 'row', sets: [W(reps), W(reps), W(reps)], ...(pain ? { pain } : {}) }], exerciseIds: ['row'],
    })
    const sessions = [mk('2026-10-19', 9), mk('2026-10-26', 10, 'molestia'), mk('2026-11-02', 11, 'molestia')]
    const r = reviewMesocycle(meso, sessions, exs, planDays, { ...defaultSettings(), kgPerBrick: K })
    const rot = r.proposals.filter((p) => p.kind === 'rotate')
    expect(rot).toHaveLength(1) // sin duplicar con la rotación opcional
    expect(rot[0]).toMatchObject({ exerciseId: 'row', to: 'row2', reason: 'molestias repetidas: rotar variante' })
    expect((rot[0] as { optional?: boolean }).optional).toBeUndefined()
    // con una sola molestia no la propone como obligatoria
    const one = reviewMesocycle(meso, [mk('2026-10-19', 9), mk('2026-10-26', 10, 'molestia'), mk('2026-11-02', 11)], exs, planDays, { ...defaultSettings(), kgPerBrick: K })
    expect(one.proposals.filter((p) => p.kind === 'rotate').every((p) => (p as { optional?: boolean }).optional)).toBe(true)
  })
})
