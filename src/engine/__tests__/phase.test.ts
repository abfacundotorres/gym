import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import type { ExerciseExposure } from '../history'
import { phaseAt, phaseBlockSuggestion, phaseVolumeTarget } from '../phase'
import { deloadSuggestion, reviewMesocycle } from '../periodization'
import { trendOf } from '../stagnation'
import { defaultSettings, type Phase, type Session, type SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const E = (id: string) => data.exercises.find((e) => e.id === id)!
const incline = E('incline_db_press')

let n = 0
const W = (weight: number, reps: number): SetEntry => ({ id: `s${n++}`, type: 'W', weight, reps })
const expo = (date: string, sets: SetEntry[]): ExerciseExposure => ({ date, sessionId: `s-${date}`, item: { exerciseId: incline.id, sets } })
const flat = (reps: number[]) => reps.map((r, i) => expo(`2026-10-${String(10 + i * 7).padStart(2, '0')}`, [W(25, r), W(25, r), W(25, r)]))

describe('tendencia según la fase', () => {
  const stuck = flat([8, 8, 8, 8]) // 4 exposiciones sin mejora
  it('sin fase, estancado es estancado (como siempre)', () => {
    expect(trendOf(incline, stuck, 4.2).trend).toBe('stagnant')
    for (const p of ['bulk', 'maintain'] as Phase[]) expect(trendOf(incline, stuck, 4.2, p).trend).toBe('stagnant')
  })
  it('en cut, no mejorar es mantener', () => {
    expect(trendOf(incline, stuck, 4.2, 'cut').trend).toBe('maintaining')
  })
  it('lo que progresa sigue progresando en cut', () => {
    expect(trendOf(incline, flat([8, 8, 9, 10]), 4.2, 'cut').trend).toBe('progressing')
  })
  it('sin datos suficientes sigue siendo insuficiente en cut', () => {
    expect(trendOf(incline, flat([8, 8, 8]), 4.2, 'cut').trend).toBe('insufficient')
  })

  // e1RM (Epley, 25 kg): 10 reps = 33,3 · 9 = 32,5 · 8 = 31,7 · 7 = 30,8 · 5 = 29,2
  it('una baja chica (4,9 %) es regresión salvo en cut, donde es ruido del déficit', () => {
    const small = flat([10, 9, 8])
    expect(trendOf(incline, small, 4.2).trend).toBe('regressing')
    expect(trendOf(incline, small, 4.2, 'bulk').trend).toBe('regressing')
    expect(trendOf(incline, small, 4.2, 'cut').trend).toBe('maintaining')
  })
  it('una baja mayor a la tolerancia (7,5 %) sigue siendo regresión en cut', () => {
    expect(trendOf(incline, flat([10, 9, 7]), 4.2, 'cut').trend).toBe('regressing')
    expect(trendOf(incline, flat([10, 7, 5]), 4.2, 'cut').trend).toBe('regressing')
  })
  it('que baje una vez y suba no es regresión en ninguna fase', () => {
    expect(trendOf(incline, flat([10, 9, 10]), 4.2).trend).not.toBe('regressing')
  })
})

describe('volumen objetivo por fase', () => {
  it('en cut baja a 80 % (en medias series); en el resto no cambia', () => {
    expect(phaseVolumeTarget([10, 20], 'cut')).toEqual([8, 16])
    expect(phaseVolumeTarget([12, 18], 'cut')).toEqual([9.5, 14.5])
    for (const p of ['bulk', 'maintain', undefined] as (Phase | undefined)[]) expect(phaseVolumeTarget([10, 20], p)).toEqual([10, 20])
  })
  it('el largo de bloque sugerido: cut 4+1, el resto 5+1', () => {
    expect(phaseBlockSuggestion('cut')).toEqual({ accumulationWeeks: 4, deloadWeeks: 1 })
    expect(phaseBlockSuggestion('bulk')).toEqual({ accumulationWeeks: 5, deloadWeeks: 1 })
    expect(phaseBlockSuggestion('maintain')).toEqual({ accumulationWeeks: 5, deloadWeeks: 1 })
  })
})

describe('fase de una semana', () => {
  const mesos = [
    { startDate: '2026-10-19', phase: 'bulk' as Phase },
    { startDate: '2026-11-30', phase: 'cut' as Phase },
    { startDate: '2027-01-11' },
  ]
  it('es la del último mesociclo que ya había empezado', () => {
    expect(phaseAt(mesos, '2026-10-12')).toBeUndefined()
    expect(phaseAt(mesos, '2026-11-23')).toBe('bulk')
    expect(phaseAt(mesos, '2026-11-30')).toBe('cut')
    expect(phaseAt(mesos, '2027-01-18')).toBeUndefined() // el último no tiene fase
    expect(phaseAt([], '2026-11-23')).toBeUndefined()
  })
})

describe('deload sugerido y revisión según la fase', () => {
  const ids = ['incline_db_press', 'lateral_raise_db']
  const exMap = new Map(data.exercises.map((e) => [e.id, e]))
  const session = (date: string): Session => ({
    id: `s-${date}`, date, planDayId: 'p', mesocycleId: null, note: '', startedAt: 1, finishedAt: 2, status: 'finished', source: 'app',
    exerciseIds: ids,
    items: ids.map((exerciseId) => ({ exerciseId, sets: [W(20, 8), W(20, 8), W(20, 8)] })),
  })
  const sessions = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].map(session) // todo estancado

  it('estancamiento general sugiere deload, salvo en cut', () => {
    expect(deloadSuggestion(ids, exMap, sessions, 4.2).reasons).toContain('stagnation')
    expect(deloadSuggestion(ids, exMap, sessions, 4.2, false, 'bulk').reasons).toContain('stagnation')
    expect(deloadSuggestion(ids, exMap, sessions, 4.2, false, 'cut').reasons).not.toContain('stagnation')
  })
  it('en cut sí se sugiere por "me siento quemado" y por sueño/energía bajos', () => {
    expect(deloadSuggestion(ids, exMap, sessions, 4.2, true, 'cut').reasons).toContain('burned_out')
  })

  it('la revisión usa el volumen objetivo de la fase', () => {
    const meso = data.mesocycles[0]!
    const settings = { kgPerBrick: 4.2, volumeTarget: defaultSettings().volumeTarget }
    const base = reviewMesocycle(meso, data.sessions, exMap, data.planDays, settings)
    const cut = reviewMesocycle({ ...meso, phase: 'cut' }, data.sessions, exMap, data.planDays, settings)
    const bulk = reviewMesocycle({ ...meso, phase: 'bulk' }, data.sessions, exMap, data.planDays, settings)
    for (const [i, v] of base.volume.entries()) {
      expect(cut.volume[i]!.target).toEqual(phaseVolumeTarget(v.target, 'cut'))
      expect(bulk.volume[i]!.target).toEqual(v.target)
    }
  })
  it('en cut no se propone rotar por estancamiento (sin fase sí)', () => {
    const meso = data.mesocycles[0]!
    const settings = { kgPerBrick: 4.2, volumeTarget: defaultSettings().volumeTarget }
    // El jalón del lunes tiene alternativas en el plan; 4 sesiones iguales lo dejan estancado.
    const pull = (date: string): Session => ({
      id: `p-${date}`, date, planDayId: 'lunes_torso', mesocycleId: null, note: '', startedAt: 1, finishedAt: 2, status: 'finished', source: 'app',
      exerciseIds: ['pulldown_supine_close'],
      items: [{ exerciseId: 'pulldown_supine_close', sets: [W(60, 8), W(60, 8), W(60, 8)] }],
    })
    const withStall = [...data.sessions.filter((x) => !x.exerciseIds.includes('pulldown_supine_close')), ...['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'].map(pull)]
    const reasons = (phase?: Phase) =>
      reviewMesocycle({ ...meso, ...(phase ? { phase } : {}) }, withStall, exMap, data.planDays, settings).proposals.filter((p) => p.kind === 'rotate' && !p.optional).map((p) => p.reason)
    expect(reasons().filter((r) => r.startsWith('estancado')).length).toBeGreaterThan(0)
    expect(reasons('bulk').filter((r) => r.startsWith('estancado')).length).toBeGreaterThan(0)
    expect(reasons('cut').filter((r) => r.startsWith('estancado'))).toEqual([])
  })
})
