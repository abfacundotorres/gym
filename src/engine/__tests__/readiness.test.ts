import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { exposuresOf, type ExerciseExposure } from '../history'
import { deloadStart, mesocycleEnd, mesocycleWeek, nextMesocycleStart, pausedWeeks } from '../periodization'
import { recommend } from '../progression'
import { readinessLevel, reducedSets } from '../readiness'
import type { Mesocycle, SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const E = (id: string) => data.exercises.find((e) => e.id === id)!
const K = 4.2

describe('readiness del día (D-49)', () => {
  it('bajo si el promedio de sueño y energía es ≤ 2; sin dato no cambia nada', () => {
    expect(readinessLevel({ sleep: 2, energy: 2 })).toBe('low')
    expect(readinessLevel({ sleep: 1, energy: 3 })).toBe('low')
    expect(readinessLevel({ sleep: 3, energy: 2 })).toBe('ok')
    expect(readinessLevel({ sleep: 4, energy: 5 })).toBe('ok')
    expect(readinessLevel(undefined)).toBe('unknown')
  })

  it('serie menos sugerida, mínimo 2', () => {
    expect([1, 2, 3, 4, 5].map(reducedSets)).toEqual([1, 2, 2, 3, 4])
  })

  it('con día bajo no sube la carga ni suma una rep: repite la última vez', () => {
    const h = exposuresOf(data.sessions, 'incline_db_press', { before: '2026-10-29' })
    expect(recommend(E('incline_db_press'), 3, h, { kgPerBrick: K }).targets).toEqual([10, 9, 9])
    const held = recommend(E('incline_db_press'), 3, h, { kgPerBrick: K, hold: true })
    expect(held).toMatchObject({ status: 'same', weight: 25, targets: [10, 8, 8], held: true })
    expect(held.message).toMatch(/mantené el peso/)
  })

  it('si tocaba subir de peso, se queda en el actual', () => {
    const W = (r: number): SetEntry => ({ id: `s${r}`, type: 'W', weight: 25, reps: r })
    const top: ExerciseExposure[] = [{ date: 'd1', sessionId: 'd1', item: { exerciseId: 'x', sets: [W(10), W(10), W(10)] } }]
    const bench = E('bench_flat_barbell')
    expect(recommend(bench, 3, top, { kgPerBrick: K })).toMatchObject({ status: 'increase', weight: 27.5 })
    expect(recommend(bench, 3, top, { kgPerBrick: K, hold: true })).toMatchObject({ status: 'same', weight: 25, targets: [10, 10, 10], held: true })
  })

  it('con incremento >10 %: "listo para subir" pasa a mantener', () => {
    const W = (r: number): SetEntry => ({ id: `s${r}`, type: 'W', weight: 12.5, reps: r })
    const top: ExerciseExposure[] = [{ date: 'd1', sessionId: 'd1', item: { exerciseId: 'x', sets: [W(18), W(18), W(18), W(18)] } }]
    const lat = E('lateral_raise_db')
    expect(recommend(lat, 4, top, { kgPerBrick: K }).status).toBe('ready_big_jump')
    const held = recommend(lat, 4, top, { kgPerBrick: K, hold: true })
    expect(held).toMatchObject({ status: 'same', weight: 12.5, targets: [18, 18, 18, 18], held: true })
    expect(held.bigJumpPct).toBeUndefined()
  })

  it('sin datos suficientes o sin historial no se toca', () => {
    const h = exposuresOf(data.sessions, 'bench_flat_barbell', { before: '2026-11-02' })
    expect(recommend(E('bench_flat_barbell'), 3, h, { kgPerBrick: K, hold: true }).status).toBe('insufficient')
    const none = recommend(E('ohp_barbell'), 3, [], { kgPerBrick: K, hold: true })
    expect(none.status).toBe('no_history')
    expect(none.held).toBeUndefined()
  })
})

describe('mesociclo se pausa si te perdés una semana (D-50)', () => {
  const meso: Mesocycle = { id: 'm', startDate: '2026-10-19', accumulationWeeks: 5, deloadWeeks: 1, status: 'active', notes: '' }
  const fin = (date: string) => ({ date, status: 'finished' as const })
  const base = ['2026-10-19', '2026-10-26', '2026-11-09'].map(fin) // falta la semana del 2/11

  it('detecta solo semanas pasadas y sin sesión terminada', () => {
    expect(pausedWeeks(meso, base, '2026-11-16')).toEqual(['2026-11-02'])
    expect(pausedWeeks(meso, base, '2026-11-09')).toEqual(['2026-11-02']) // la semana actual nunca cuenta
    expect(pausedWeeks(meso, [...base, fin('2026-11-03')], '2026-11-16')).toEqual([])
    expect(pausedWeeks(meso, [{ date: '2026-11-03', status: 'in_progress' }, ...base], '2026-11-16')).toEqual(['2026-11-02'])
  })

  it('el contador y el deload se corren una semana', () => {
    const paused = pausedWeeks(meso, base, '2026-11-16')
    expect(mesocycleWeek(meso, '2026-11-16')).toEqual({ week: 5, total: 6, isDeload: false })
    expect(mesocycleWeek(meso, '2026-11-16', paused)).toEqual({ week: 4, total: 6, isDeload: false, pausedWeeks: 1 })
    expect(deloadStart(meso)).toBe('2026-11-23')
    expect(deloadStart(meso, paused)).toBe('2026-11-30')
    expect(mesocycleEnd(meso, paused)).toBe('2026-12-07')
    expect(mesocycleWeek(meso, '2026-11-30', paused)).toEqual({ week: 6, total: 6, isDeload: true, pausedWeeks: 1 })
    expect(nextMesocycleStart(meso, '2026-11-20', paused)).toBe('2026-12-07')
  })

  it('una semana perdida justo cuando tocaba el deload también lo corre', () => {
    const paused = ['2026-11-23']
    expect(deloadStart(meso, paused)).toBe('2026-11-30')
    // deload de 2 semanas (23/11 y 30/11) y la segunda se pierde: el fin se corre una semana
    const long: Mesocycle = { ...meso, deloadWeeks: 2 }
    expect(mesocycleEnd(long)).toBe('2026-12-07')
    expect(mesocycleEnd(long, ['2026-11-30'])).toBe('2026-12-14')
  })

  it('no cuenta semanas después de que el mesociclo ya terminó', () => {
    const all = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'].map(fin)
    expect(pausedWeeks(meso, all, '2027-02-01')).toEqual([])
  })

  it('con deload adelantado, las pausas anteriores no lo mueven de fecha', () => {
    const early: Mesocycle = { ...meso, deloadFrom: '2026-11-16' }
    const paused = pausedWeeks(early, base, '2026-11-16')
    expect(paused).toEqual(['2026-11-02'])
    expect(deloadStart(early, paused)).toBe('2026-11-16')
    expect(mesocycleWeek(early, '2026-11-16', paused)).toEqual({ week: 4, total: 4, isDeload: true, pausedWeeks: 1 })
    expect(mesocycleEnd(early, paused)).toBe('2026-11-23')
  })
})
