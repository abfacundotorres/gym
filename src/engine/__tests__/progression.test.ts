import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { epley, exposureMetrics } from '../e1rm'
import { exposuresOf, type ExerciseExposure } from '../history'
import { findPRs } from '../prs'
import { recommend } from '../progression'
import { trendOf } from '../stagnation'
import type { Exercise, SetEntry } from '../types'
import { exclusionReason, validSets } from '../validity'
import { warmupSets } from '../warmup'

const data = seedToData(seedSchema.parse(fixture), 0)
const E = (id: string) => data.exercises.find((e) => e.id === id)!
const K = 4.2
const hist = (id: string, before?: string) => exposuresOf(data.sessions, id, { before })

let n = 0
const W = (weight: number | null, reps: number | null, extra: Partial<SetEntry> = {}): SetEntry => ({ id: `t${n++}`, type: 'W', weight, reps, ...extra })
const expo = (date: string, sets: SetEntry[]): ExerciseExposure => ({ date, sessionId: date, item: { exerciseId: 'x', sets } })

describe('H3: fixtures del seed', () => {
  it('press inclinado 29/10 (10, 8, 8) en [7,10] × 3 → mismo peso, objetivos 10, 9, 9', () => {
    const r = recommend(E('incline_db_press'), 3, hist('incline_db_press', '2026-10-29'), { kgPerBrick: K })
    expect(r).toMatchObject({ status: 'same', weight: 25, targets: [10, 9, 9], fatigue: false, basedOn: '2026-10-29' })
  })

  it('press plano 2/11 (rebote, rebote, asistida) → sin datos suficientes, no sube', () => {
    const h = hist('bench_flat_barbell', '2026-11-02')
    expect(validSets(h.at(-1)!.item)).toHaveLength(0)
    const r = recommend(E('bench_flat_barbell'), 3, h, { kgPerBrick: K })
    expect(r.status).toBe('insufficient')
    expect(r.message).toBe('Sin datos suficientes')
    expect(r.weight).toBe(25) // referencia, no sube
  })

  it('rumano 22/10: la serie con rest-pause cuenta con 8 reps', () => {
    const h = hist('rdl_barbell', '2026-10-22')
    expect(validSets(h.at(-1)!.item).map((v) => v.reps)).toEqual([10, 10, 8])
    const r = recommend(E('rdl_barbell'), 3, h, { kgPerBrick: K })
    expect(r).toMatchObject({ status: 'same', weight: 30, targets: [11, 11, 9] })
  })

  it('una serie sin reps nunca entra en un cálculo', () => {
    const lat = hist('lateral_raise_db', '2026-11-05').at(-1)!
    expect(lat.item.sets.every((s) => s.reps === null)).toBe(true)
    expect(validSets(lat.item)).toEqual([])
    const m = exposureMetrics(E('lateral_raise_db'), lat.item, lat.date, lat.sessionId, K)
    expect(m).toMatchObject({ e1rm: null, workingWeight: null, validCount: 0, totalReps: 0 })
    expect(recommend(E('lateral_raise_db'), 4, [lat], { kgPerBrick: K }).status).toBe('insufficient')
    expect(findPRs(E('lateral_raise_db'), lat, hist('lateral_raise_db', '2026-11-04'), K)).toEqual([])
    expect(exclusionReason(W(25, null))).toBe('sin_reps')
  })

  it('hoy (después del 5/11) el inclinado sugiere 25 con 8, 8, 7', () => {
    const r = recommend(E('incline_db_press'), 3, hist('incline_db_press'), { kgPerBrick: K })
    expect(r).toMatchObject({ status: 'same', weight: 25, targets: [8, 8, 7] })
  })

  it('confianza baja excluye; media cuenta', () => {
    const row = hist('row_chest_supported_45', '2026-11-02').at(-1)!
    expect(validSets(row.item).map((v) => v.reps)).toEqual([8, 7]) // rp sin dato excluida
    const curl = hist('curl_incline_db', '2026-11-02').at(-1)!
    expect(curl.item.confidence).toBe('baja')
    expect(validSets({ ...curl.item, sets: [W(15, 10)] })).toEqual([])
  })
})

describe('doble progresión', () => {
  const bench = { unit: 'per_side', barKg: 20, increment: 2.5, range: [8, 10] } as Exercise
  it('todas al máximo → sube un incremento, objetivo = mínimo', () => {
    const r = recommend(bench, 3, [expo('d1', [W(25, 10), W(25, 10), W(25, 10)])], { kgPerBrick: K })
    expect(r).toMatchObject({ status: 'increase', weight: 27.5, targets: [8, 8, 8] })
  })

  it('peso de trabajo = el mayor; las de rampa no cuentan (D-01)', () => {
    const r = recommend(bench, 3, [expo('d1', [W(20, 10), W(25, 10), W(25, 10)])], { kgPerBrick: K })
    expect(r).toMatchObject({ status: 'insufficient', weight: 25, targets: [10, 10, 10] })
  })

  it('aviso de fatiga con ≥2 series bajo el mínimo en dos exposiciones seguidas', () => {
    const h = [expo('d1', [W(25, 7), W(25, 6), W(25, 8)]), expo('d2', [W(25, 7), W(25, 7), W(25, 8)])]
    const r = recommend(bench, 3, h, { kgPerBrick: K })
    expect(r.fatigue).toBe(true)
    expect(r.status).toBe('same')
    expect(recommend(bench, 3, h.slice(1), { kgPerBrick: K }).fatigue).toBe(false)
  })

  it('incremento > 10 % → reps extendidas hasta max+3 y "confirmá vos" (D-02)', () => {
    const lat = E('lateral_raise_db') // 12.5 por mano, +2.5 = 20 %
    const mid = recommend(lat, 4, [expo('d1', [W(12.5, 15), W(12.5, 15), W(12.5, 15), W(12.5, 14)])], { kgPerBrick: K })
    expect(mid).toMatchObject({ status: 'same', weight: 12.5, targets: [16, 16, 16, 15], repCap: 18, bigJumpPct: 20 })
    const ready = recommend(lat, 4, [expo('d1', [W(12.5, 18), W(12.5, 18), W(12.5, 18), W(12.5, 18)])], { kgPerBrick: K })
    expect(ready).toMatchObject({ status: 'ready_big_jump', weight: 12.5, bigJumpPct: 20 })
  })

  it('el press plano usa carga total para el 10 % (70 → 75 kg = 7 %)', () => {
    const r = recommend(E('bench_flat_barbell'), 3, [expo('d1', [W(25, 10), W(25, 10), W(25, 10)])], { kgPerBrick: K })
    expect(r.status).toBe('increase')
  })

  it('sin historial: no inventa peso', () => {
    expect(recommend(E('ohp_barbell'), 3, [], { kgPerBrick: K })).toMatchObject({ status: 'no_history', weight: null, targets: [8, 8, 8] })
  })
})

describe('aproximaciones', () => {
  it('heavy con barra: barra sola, 50, 70, 85 % redondeado', () => {
    expect(warmupSets(E('bench_flat_barbell'), 25, K).map((s) => [s.weight, s.reps])).toEqual([[0, 12], [7.5, 8], [15, 5], [20, 3]])
  })
  it('light: una al ~60 %', () => {
    expect(warmupSets(E('leg_press_45'), 50, K).map((s) => [s.weight, s.reps])).toEqual([[30, 10]])
  })
  it('none: ninguna', () => {
    expect(warmupSets(E('leg_curl_seated'), 15, K)).toEqual([])
  })
  it('reusa las de la última sesión, escaladas si cambió el peso', () => {
    const last = hist('rdl_barbell', '2026-11-05').at(-1)!
    const same = warmupSets(E('rdl_barbell'), 30, K, { sets: last.item.sets, workingWeight: 30 })
    expect(same.map((s) => [s.weight, s.reps])).toEqual([[0, 10], [10, 10], [20, 10]])
    // 30→35 por lado: 80 → 90 kg (×1.125). La barra sola sigue sola; 10 por lado = 40 kg → 45 → 12,5;
    // 20 por lado = 60 kg → 67,5 → 23,75 → redondeo a 25
    const up = warmupSets(E('rdl_barbell'), 35, K, { sets: last.item.sets, workingWeight: 30 })
    expect(up.map((s) => s.weight)).toEqual([0, 12.5, 25])
  })
})

describe('e1RM, PRs y estancamiento', () => {
  it('Epley solo hasta 12 reps', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 2)
    expect(epley(100, 13)).toBeNull()
  })

  it('PR del inclinado el 29/10 (25×10 supera al 22/10)', () => {
    const h = hist('incline_db_press', '2026-10-29')
    const prs = findPRs(E('incline_db_press'), h.at(-1)!, h.slice(0, -1), K)
    expect(prs.map((p) => [p.kind, p.set.reps])).toEqual([['e1rm', 10]])
  })

  it('primera exposición: sin PR', () => {
    const h = hist('incline_db_press', '2026-10-22')
    expect(findPRs(E('incline_db_press'), h[0]!, [], K)).toEqual([])
  })

  const ex = { unit: 'total' } as Exercise
  it('3 exposiciones seguidas sin mejora → estancado', () => {
    const h = [
      expo('d1', [W(50, 10), W(50, 10)]),
      expo('d2', [W(50, 9), W(50, 10)]),
      expo('d3', [W(50, 10), W(50, 10)]),
      expo('d4', [W(50, 10), W(50, 9)]),
    ]
    expect(trendOf(ex, h, K).trend).toBe('stagnant')
    expect(trendOf(ex, [...h.slice(0, 3), expo('d4', [W(50, 11), W(50, 10)])], K).trend).toBe('progressing')
    expect(trendOf(ex, h.slice(0, 3), K).trend).toBe('insufficient')
  })

  it('e1RM en baja dos veces seguidas → regresión', () => {
    const h = [expo('d1', [W(50, 10)]), expo('d2', [W(50, 9)]), expo('d3', [W(50, 8)])]
    expect(trendOf(ex, h, K).trend).toBe('regressing')
  })
})
