import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { FAILURE_SESSION_MIN, FAILURE_STREAK_MIN, atFailure, failureStreak, failureToday, isCompound, volumeSpikes } from '../risk'
import type { Exercise, Session, SessionItem, SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = new Map(data.exercises.map((e) => [e.id, e])) as Map<string, Exercise>

let n = 0
const W = (rir?: number, extra: Partial<SetEntry> = {}): SetEntry => ({ id: `s${n++}`, type: 'W', weight: 20, reps: 10, ...(rir != null ? { rir } : {}), ...extra })
const item = (exerciseId: string, sets: SetEntry[], extra: Partial<SessionItem> = {}): SessionItem => ({ exerciseId, sets, ...extra })
const many = (k: number) => Array.from({ length: k }, () => W())
const sess = (date: string, items: SessionItem[], extra: Partial<Session> = {}): Session => ({
  id: `x-${date}-${n++}`, date, planDayId: 'p', mesocycleId: null, note: '', startedAt: null, finishedAt: 1, status: 'finished', source: 'app',
  items, exerciseIds: items.map((i) => i.exerciseId), ...extra,
})

describe('qué es compuesto y qué es "al fallo"', () => {
  it('compuesto = tiene músculos secundarios; el aislamiento y el cardio no', () => {
    expect(['incline_db_press', 'rdl_barbell', 'bench_flat_barbell', 'row_low_cable', 'hack_squat'].map((id) => isCompound(ex.get(id)!))).toEqual([true, true, true, true, true])
    expect(['lateral_raise_db', 'curl_incline_db', 'leg_extension', 'stair_climber'].map((id) => isCompound(ex.get(id)!))).toEqual([false, false, false, false])
    expect(isCompound({ secondary: ['triceps'], cardio: true })).toBe(false)
  })

  it('al fallo: una serie de trabajo con RIR 0; las aproximaciones, el RIR 1+ y sin dato no cuentan', () => {
    expect(atFailure({ sets: [W(2), W(0)] })).toBe(true)
    expect(atFailure({ sets: [W(1), W(3)] })).toBe(false)
    expect(atFailure({ sets: [W(), W()] })).toBe(false)
    expect(atFailure({ sets: [W(0, { type: 'A' })] })).toBe(false)
    expect(atFailure({ sets: [W(0)], skipped: true })).toBe(false)
    expect(atFailure({ sets: [] })).toBe(false)
  })
})

describe('compuestos al fallo en la misma sesión (D-75)', () => {
  it('lista solo los compuestos con RIR 0, sin repetir', () => {
    const s = sess('2026-11-12', [
      item('rdl_barbell', [W(1), W(0)]),
      item('incline_db_press', [W(0)]),
      item('lateral_raise_db', [W(0)]), // aislamiento: no cuenta
      item('bench_flat_barbell', [W(1)]), // compuesto sin fallo
      item('rdl_barbell', [W(0)]), // repetido
    ])
    expect(failureToday(s, ex)).toEqual(['rdl_barbell', 'incline_db_press'])
    expect(FAILURE_SESSION_MIN).toBe(2)
  })
  it('un ejercicio desconocido o sin RIR no suma', () => {
    expect(failureToday(sess('2026-11-12', [item('no_existe', [W(0)]), item('incline_db_press', [W()])]), ex)).toEqual([])
  })
})

describe('racha de veces al fallo en el mismo ejercicio', () => {
  const e = (...rirs: (number | undefined)[]) => rirs.map((r) => ({ item: item('incline_db_press', [W(1), W(r)]) }))
  it('cuenta las últimas seguidas', () => {
    expect(failureStreak(e(0, 0, 0))).toBe(3)
    expect(failureStreak(e(1, 0, 0))).toBe(2)
    expect(failureStreak(e(0, 0, 0, 0, 0))).toBe(5)
  })
  it('se corta con un RIR 1+ o con una vez sin dato de RIR (no se presume fallo)', () => {
    expect(failureStreak(e(0, 1, 0))).toBe(1)
    expect(failureStreak(e(0, 0, 2))).toBe(0)
    expect(failureStreak(e(0, 0, undefined))).toBe(0)
    expect(failureStreak(e(0, undefined, 0, 0))).toBe(2)
    expect(failureStreak([])).toBe(0)
    expect(FAILURE_STREAK_MIN).toBe(3)
  })
})

describe('salto de volumen semanal', () => {
  // Hoy es jueves 12/11 (semana del 09/11); las semanas anteriores arrancan el 02/11, 26/10, 19/10 y 12/10.
  const LAT = 'lateral_raise_db' // 1 serie = 1 de deltoide lateral
  const week = (monday: string, sets: number, extra: Partial<Session> = {}) => sess(monday.slice(0, 8) + String(Number(monday.slice(8)) + 2).padStart(2, '0'), [item(LAT, many(sets))], extra)
  const base = (...sets: number[]) => ['2026-11-02', '2026-10-26', '2026-10-19', '2026-10-12'].slice(0, sets.length).map((m, i) => week(m, sets[i]!))
  const now = (sets: number, extra: Partial<Session> = {}) => sess('2026-11-12', [item(LAT, many(sets))], { status: 'in_progress', ...extra })
  const spikes = (history: Session[], cur: Session) => volumeSpikes([...history, cur], cur, ex)

  it('avisa cuando esta semana supera en 50 % y en 4+ series el promedio', () => {
    expect(spikes(base(5, 5, 5), now(9))).toEqual([{ muscle: 'delt_side', sets: 9, baseline: 5, pct: 80 }])
  })
  it('en el borde: 50 % pero menos de 4 series de más, o 4 más pero menos de 50 %, no avisa', () => {
    expect(spikes(base(5, 5, 5), now(8))).toEqual([]) // ×1,6 pero +3
    expect(spikes(base(10, 10, 10), now(14))).toEqual([]) // +4 pero ×1,4
    expect(spikes(base(10, 10, 10), now(15))).toHaveLength(1) // ×1,5 y +5: justo
    expect(spikes(base(8, 8, 8), now(12))).toHaveLength(1) // ×1,5 y +4: justo
    expect(spikes(base(5, 5, 5), now(7))).toEqual([])
  })
  it('con un promedio de menos de 4 series no avisa: un músculo que casi no se entrena no cuenta', () => {
    expect(spikes(base(3, 3, 3), now(10))).toEqual([])
  })
  it('hacen falta al menos 2 semanas anteriores; las más viejas que 4 semanas no cuentan', () => {
    expect(spikes(base(5), now(12))).toEqual([])
    const viejo = week('2026-10-05', 40) // 5 semanas atrás
    expect(spikes([...base(5, 5), viejo], now(9))).toEqual([{ muscle: 'delt_side', sets: 9, baseline: 5, pct: 80 }])
  })
  it('una semana de deload o de vuelta no entra al promedio (no vuelve "normal" un volumen bajo)', () => {
    const history = [week('2026-11-02', 2, { deload: true }), week('2026-10-26', 6), week('2026-10-19', 6)]
    expect(spikes(history, now(10))).toEqual([{ muscle: 'delt_side', sets: 10, baseline: 6, pct: 67 }])
    const back = [week('2026-11-02', 2, { comebackDays: 14 }), week('2026-10-26', 6), week('2026-10-19', 6)]
    expect(spikes(back, now(10))[0]!.baseline).toBe(6)
  })
  it('una semana sin sesiones (pausa) no cuenta como cero', () => {
    const history = [week('2026-11-02', 6), week('2026-10-19', 6)]
    expect(spikes(history, now(10))).toEqual([{ muscle: 'delt_side', sets: 10, baseline: 6, pct: 67 }])
  })
  it('en una sesión de deload o de vuelta no se avisa', () => {
    expect(spikes(base(5, 5, 5), now(20, { deload: true }))).toEqual([])
    expect(spikes(base(5, 5, 5), now(20, { comebackDays: 30 }))).toEqual([])
  })
  it('suma lo que ya se hizo esta semana más la sesión en curso, y no las sesiones en curso de otras semanas', () => {
    const otraEnCurso = week('2026-11-02', 30, { status: 'in_progress' })
    const hechaHoy = sess('2026-11-09', [item(LAT, many(4))])
    expect(spikes([...base(5, 5, 5), otraEnCurso, hechaHoy], now(5))).toEqual([{ muscle: 'delt_side', sets: 9, baseline: 5, pct: 80 }])
  })
  it('varios músculos: el salto mayor primero', () => {
    const CURL = 'curl_incline_db'
    const h = ['2026-11-02', '2026-10-26', '2026-10-19'].map((m) => sess(m.slice(0, 8) + String(Number(m.slice(8)) + 2).padStart(2, '0'), [item(LAT, many(5)), item(CURL, many(5))]))
    const cur = sess('2026-11-12', [item(LAT, many(9)), item(CURL, many(12))], { status: 'in_progress' })
    expect(spikes(h, cur).map((s) => [s.muscle, s.pct])).toEqual([['biceps', 140], ['delt_side', 80]])
  })
})
