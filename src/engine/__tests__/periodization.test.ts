import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import {
  applyProposals, deloadSets, deloadStart, deloadSuggestion, deloadWeight, mesocycleEnd, mesocycleWeek,
  nextMesocycleStart, readinessAverage, reviewMesocycle, startDeloadNow, variantsUsedIn, volumeStatus, weekVolume, withAllRotations,
} from '../periodization'
import { defaultSettings, type Exercise, type Mesocycle, type Session, type SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = new Map(data.exercises.map((e) => [e.id, e]))
const meso: Mesocycle = data.mesocycles[0]!
const K = 4.2

let n = 0
const W = (weight: number, reps: number): SetEntry => ({ id: `s${n++}`, type: 'W', weight, reps })
const sess = (date: string, items: Session['items'], extra: Partial<Session> = {}): Session => ({
  id: `x-${date}-${n++}`, date, planDayId: 'p', mesocycleId: meso.id, note: '', startedAt: null, finishedAt: 1,
  status: 'finished', source: 'app', items, exerciseIds: items.map((i) => i.exerciseId), ...extra,
})

describe('semanas y deload', () => {
  it('semana N de M, deload al final', () => {
    expect(mesocycleWeek(meso, '2026-11-09')).toEqual({ week: 4, total: 6, isDeload: false })
    expect(mesocycleWeek(meso, '2026-11-26')).toEqual({ week: 6, total: 6, isDeload: true })
    expect(deloadStart(meso)).toBe('2026-11-23')
    expect(mesocycleEnd(meso)).toBe('2026-11-30')
  })

  it('deload adelantado: arranca esta semana y acorta el mesociclo', () => {
    const m = startDeloadNow(meso, '2026-11-11')
    expect(m.deloadFrom).toBe('2026-11-09')
    expect(mesocycleWeek(m, '2026-11-09')).toEqual({ week: 4, total: 4, isDeload: true })
    expect(mesocycleWeek(m, '2026-11-16')).toBeNull()
    expect(mesocycleEnd(m)).toBe('2026-11-16')
  })

  it('series al 50 % (mínimo 2) y carga −10 %', () => {
    expect([1, 2, 3, 4, 5].map(deloadSets)).toEqual([1, 2, 2, 2, 3])
    expect(deloadWeight(ex.get('bench_flat_barbell')!, 25, K)).toBe(22.5) // 70 kg → 63 → 21,5 por lado → 22,5 (65 kg)
    expect(deloadWeight(ex.get('incline_db_press')!, 25, K)).toBe(22.5)
    expect(deloadWeight(ex.get('lateral_raise_db')!, 12.5, K)).toBe(10) // 11,25 → redondea a 12,5 = mismo → baja un incremento
    expect(deloadWeight(ex.get('leg_curl_seated')!, 15, K)).toBe(14) // ladrillos
  })

  it('próximo mesociclo', () => {
    expect(nextMesocycleStart(meso, '2026-11-26')).toBe('2026-11-30')
    expect(nextMesocycleStart(meso, '2026-12-03')).toBe('2026-11-30')
  })
})

describe('volumen semanal', () => {
  it('semana del 2/11: pecho 6,5 (test de H4)', () => {
    const v = weekVolume(data.sessions, '2026-11-02', ex)
    expect(v.chest?.total).toBe(6.5)
  })
  it('estado contra el rango', () => {
    expect([volumeStatus(6.5, [10, 20]), volumeStatus(10, [10, 20]), volumeStatus(21, [10, 20])]).toEqual(['below', 'in', 'above'])
  })
})

describe('deload sugerido', () => {
  it('readiness promedio ≤ 2,5 en 3 sesiones', () => {
    const s = [
      sess('2026-11-02', [], { readiness: { sleep: 2, energy: 3 } }),
      sess('2026-11-03', [], { readiness: { sleep: 2, energy: 2 } }),
      sess('2026-11-05', [], { readiness: { sleep: 3, energy: 3 } }),
    ]
    expect(readinessAverage(s)).toBeCloseTo(2.5)
    expect(readinessAverage(s.slice(1))).toBeNull()
    expect(deloadSuggestion([], ex, s, K).reasons).toEqual(['readiness'])
  })

  it('≥40 % de ejercicios estancados, y "me siento quemado"', () => {
    const flat = (d: string) => sess(d, [{ exerciseId: 'row_low_cable', sets: [W(50, 10), W(50, 10), W(50, 10)] }])
    const s = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map(flat)
    const r = deloadSuggestion(['row_low_cable', 'curl_cable_low', 'stair_climber'], ex, s, K)
    expect(r.stalled).toEqual(['row_low_cable'])
    expect(r.stagnantShare).toBe(0.5) // escalador (cardio) no cuenta
    expect(r.reasons).toEqual(['stagnation'])
    expect(deloadSuggestion([], ex, [], K, true).reasons).toEqual(['burned_out'])
  })
})

describe('revisión de fin de mesociclo', () => {
  const plan = [{ id: 'p', name: 'P', weekday: 1, items: [
    { exerciseId: 'row_low_cable', sets: 3, alt: ['row_chest_supported_45'] },
    { exerciseId: 'curl_cable_low', sets: 3, alt: [] },
  ] }]
  const sessions = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'].map((d, i) =>
    sess(d, [
      { exerciseId: 'row_low_cable', sets: [W(50, 10), W(50, 10), W(50, 10)] },
      { exerciseId: 'curl_cable_low', sets: [W(40, 8 + i), W(40, 8 + i), W(40, 8 + i)] },
    ]),
  )
  const settings = { ...defaultSettings(), kgPerBrick: K }
  const review = reviewMesocycle(meso, sessions, ex as Map<string, Exercise>, plan, settings)

  it('detecta estancados, PRs y volumen promedio', () => {
    expect(review.stalled).toEqual(['row_low_cable'])
    expect(review.prs.filter((p) => p.exerciseId === 'curl_cable_low').map((p) => p.date)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09'])
    expect(review.volume.find((v) => v.muscle === 'biceps')).toMatchObject({ avg: 4.5, status: 'below' })
  })

  it('propone rotar el estancado y sumar series donde falta volumen', () => {
    expect(review.proposals).toContainEqual(expect.objectContaining({ kind: 'rotate', exerciseId: 'row_low_cable', to: 'row_chest_supported_45' }))
    expect(review.proposals).toContainEqual(expect.objectContaining({ kind: 'sets', exerciseId: 'curl_cable_low', from: 3, to: 4, muscle: 'biceps' }))
    const next = applyProposals(plan, review.proposals)
    // remo: rota de variante y además suma una serie (espalda alta por debajo del rango)
    expect(next[0]!.items[0]).toEqual({ exerciseId: 'row_chest_supported_45', sets: 4, alt: ['row_low_cable'] })
  })
})

describe('variantes del bloque y "rotar todas" (D-72)', () => {
  const plan = [{ id: 'p', name: 'P', weekday: 1, items: [
    { exerciseId: 'row_low_cable', sets: 3, alt: ['row_chest_supported_45'] },
    { exerciseId: 'curl_cable_low', sets: 3, alt: [] },
  ] }]
  const item = (id: string, sets = [W(50, 10)]) => ({ exerciseId: id, sets })

  it('cuenta las sesiones con cada variante, la más usada primero, solo en el bloque y el día del plan', () => {
    const sessions = [
      sess('2026-10-19', [item('row_low_cable')]),
      sess('2026-10-26', [item('row_chest_supported_45')]),
      sess('2026-11-02', [item('row_chest_supported_45')]),
      sess('2026-11-09', [item('row_chest_supported_45'), item('curl_cable_low')]),
      sess('2026-09-01', [item('row_chest_supported_45')]), // antes del bloque
      sess('2026-11-03', [item('row_chest_supported_45')], { planDayId: 'otro' }), // otro día
      sess('2026-11-04', [item('row_chest_supported_45')], { status: 'in_progress' }),
    ]
    expect(variantsUsedIn(meso, sessions, plan)).toEqual([
      { planDayId: 'p', exerciseId: 'row_low_cable', used: [{ exerciseId: 'row_chest_supported_45', sessions: 3 }, { exerciseId: 'row_low_cable', sessions: 1 }] },
    ])
  })

  it('con igual cantidad se ordena como el plan, sin depender del orden de las sesiones', () => {
    const a = sess('2026-11-02', [item('row_chest_supported_45')])
    const b = sess('2026-11-09', [item('row_low_cable')])
    const expected = [{ planDayId: 'p', exerciseId: 'row_low_cable', used: [{ exerciseId: 'row_low_cable', sessions: 1 }, { exerciseId: 'row_chest_supported_45', sessions: 1 }] }]
    expect(variantsUsedIn(meso, [a, b], plan)).toEqual(expected)
    expect(variantsUsedIn(meso, [b, a], plan)).toEqual(expected)
  })

  it('sin alternativas o sin sesiones no hay fila, y un ejercicio salteado o sin series no cuenta', () => {
    const sessions = [
      sess('2026-11-02', [{ ...item('row_low_cable'), skipped: true }]),
      sess('2026-11-09', [{ exerciseId: 'row_chest_supported_45', sets: [] }, item('curl_cable_low')]),
    ]
    expect(variantsUsedIn(meso, sessions, plan)).toEqual([])
    expect(variantsUsedIn(meso, [], plan)).toEqual([])
  })

  it('la revisión lo trae', () => {
    const sessions = [sess('2026-11-02', [item('row_chest_supported_45')])]
    const r = reviewMesocycle(meso, sessions, ex as Map<string, Exercise>, plan, { ...defaultSettings(), kgPerBrick: K })
    expect(r.variantsUsed).toEqual([{ planDayId: 'p', exerciseId: 'row_low_cable', used: [{ exerciseId: 'row_chest_supported_45', sessions: 1 }] }])
  })

  const props = [
    { kind: 'rotate', planDayId: 'p', exerciseId: 'a', to: 'a2', reason: 'x' },
    { kind: 'rotate', planDayId: 'p', exerciseId: 'b', to: 'b2', reason: 'x', optional: true },
    { kind: 'sets', planDayId: 'p', exerciseId: 'c', from: 3, to: 4, muscle: 'biceps', reason: 'x' },
    { kind: 'rotate', planDayId: 'p', exerciseId: 'd', to: 'd2', reason: 'x', optional: true },
  ] as const
  const isOn = (i: number, t: Set<number>) => (props[i]!.kind === 'rotate' && 'optional' in props[i]! && props[i]!.optional ? t.has(i) : !t.has(i))

  it('"rotar todas" tilda todas las rotaciones y no toca las series; volver deja lo sugerido', () => {
    const all = withAllRotations([...props], new Set(), true)
    expect([0, 1, 2, 3].map((i) => isOn(i, all))).toEqual([true, true, true, true])
    const back = withAllRotations([...props], all, false)
    expect([0, 1, 2, 3].map((i) => isOn(i, back))).toEqual([false, false, true, false])
  })

  it('respeta lo que ya se había destildado en las series', () => {
    const t = withAllRotations([...props], new Set([2]), true)
    expect(isOn(2, t)).toBe(false)
    expect(isOn(0, t) && isOn(1, t) && isOn(3, t)).toBe(true)
  })
})

