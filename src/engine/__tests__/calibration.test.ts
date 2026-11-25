import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { CAL_MAX_WIDEN, CAL_MIN_EVALUATED, CAL_MIN_INCREASES, CAL_SHARE, CAL_WINDOW, calibrate, evaluateSuggestions, rangeProposal, type Calibration, type Evaluation } from '../calibration'
import type { ExerciseExposure } from '../history'
import type { Exercise, SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const E = (id: string) => data.exercises.find((e) => e.id === id)! as Exercise
const PRESS = E('incline_db_press') // mancuernas, paso 2,5, rango 7-10
const K = 4.2
let n = 0
const W = (weight: number, reps: number): SetEntry => ({ id: `c${n++}`, type: 'W', weight, reps })
const expo = (date: string, weight: number, reps: number, sets = 3, sessionId = date): ExerciseExposure => ({ date, sessionId, item: { exerciseId: 'x', sets: Array.from({ length: sets }, () => W(weight, reps)) } })
const ev = (h: ExerciseExposure[], opts: Partial<Parameters<typeof evaluateSuggestions>[2]> = {}) => evaluateSuggestions(PRESS, h, { sets: 3, kgPerBrick: K, ...opts })

describe('qué habría sugerido la app contra lo que hiciste (D-81)', () => {
  it('si llegaste al tope y subiste lo sugerido, seguiste la sugerencia', () => {
    expect(ev([expo('2026-11-01', 25, 10), expo('2026-11-08', 27.5, 8)])).toEqual([
      { date: '2026-11-08', suggested: 27.5, actual: 27.5, kind: 'followed', wasIncrease: true },
    ])
  })
  it('si la app sugería subir y no subiste, bajaste respecto de lo sugerido', () => {
    const [e] = ev([expo('2026-11-01', 25, 10), expo('2026-11-08', 25, 10)])
    expect(e).toMatchObject({ suggested: 27.5, actual: 25, kind: 'lower', wasIncrease: true })
  })
  it('si trabajaste con más peso del sugerido, subiste más', () => {
    const [e] = ev([expo('2026-11-01', 25, 8), expo('2026-11-08', 27.5, 8)]) // sugería el mismo peso (no llegó al tope)
    expect(e).toMatchObject({ suggested: 25, actual: 27.5, kind: 'higher', wasIncrease: false })
  })
  it('mismo peso cuando no había que subir: se siguió la sugerencia', () => {
    const [e] = ev([expo('2026-11-01', 25, 8), expo('2026-11-08', 25, 9)])
    expect(e).toMatchObject({ kind: 'followed', wasIncrease: false })
  })
  it('la primera exposición no se compara (no había sugerencia), y sin historial no hay nada', () => {
    expect(ev([])).toEqual([])
    expect(ev([expo('2026-11-01', 25, 10)])).toEqual([])
    expect(ev([expo('2026-11-01', 25, 10), expo('2026-11-08', 25, 10), expo('2026-11-15', 25, 10)])).toHaveLength(2)
  })
  it('cada comparación usa solo el historial de ese momento', () => {
    // 1.ª al tope, 2.ª no sube, 3.ª: la sugerencia sale de la 2.ª (mismo peso, al tope otra vez → subir) y no de la 1.ª
    const r = ev([expo('2026-11-01', 25, 10), expo('2026-11-08', 25, 10), expo('2026-11-15', 27.5, 10)])
    expect(r.map((x) => [x.suggested, x.actual, x.kind])).toEqual([[27.5, 25, 'lower'], [27.5, 27.5, 'followed']])
  })
  it('sin sugerencia numérica (datos insuficientes) no se compara', () => {
    // la primera tiene solo 2 series válidas con 3 planificadas: "sin datos suficientes"
    expect(ev([expo('2026-11-01', 25, 10, 2), expo('2026-11-08', 25, 10)])).toEqual([])
    // sin series válidas en la sesión evaluada, tampoco
    expect(ev([expo('2026-11-01', 25, 10), { date: '2026-11-08', sessionId: 's', item: { exerciseId: 'x', sets: [{ id: 'z', type: 'W', weight: null, reps: null }] } }])).toEqual([])
  })
  it('un día de sueño y energía bajos mantenía el peso: seguir en el mismo no es "bajar"', () => {
    const h = [expo('2026-11-01', 25, 10), expo('2026-11-08', 25, 10, 3, 'dia-bajo')]
    expect(ev(h)[0]!.kind).toBe('lower')
    const bajo = ev(h, { readiness: (id) => (id === 'dia-bajo' ? { sleep: 1, energy: 1 } : undefined) })
    expect(bajo[0]).toMatchObject({ suggested: 25, kind: 'followed', wasIncrease: false })
  })
  it('"listo para subir" con un salto grande no cuenta como una sugerencia de subir', () => {
    // 10 kg → 12,5 es +25 %: la app no sube sola, dice "listo para subir, confirmá vos" con el mismo peso
    const [e] = ev([expo('2026-11-01', 10, 13), expo('2026-11-08', 10, 13)])
    expect(e).toMatchObject({ suggested: 10, actual: 10, kind: 'followed', wasIncrease: false })
  })
})

describe('resumen de las comparaciones', () => {
  const e = (kind: Evaluation['kind'], wasIncrease = false): Evaluation => ({ date: '2026-11-01', suggested: 25, actual: 25, kind, wasIncrease })
  it('cuenta lo seguido, lo bajado y lo subido, y entre las de subir cuántas no se subieron', () => {
    const c = calibrate([e('followed', true), e('lower', true), e('lower', true), e('higher'), e('followed'), e('higher', true)])
    // subir más de lo sugerido no es "no subir": entra en las de subir pero no en las rechazadas
    expect(c).toEqual({ evaluated: 6, followed: 2, lower: 2, higher: 2, increases: 4, declined: 2 })
    expect(calibrate([])).toEqual({ evaluated: 0, followed: 0, lower: 0, higher: 0, increases: 0, declined: 0 })
  })
  it('solo las últimas de la ventana', () => {
    const viejas = Array.from({ length: 10 }, () => e('lower', true))
    const nuevas = Array.from({ length: CAL_WINDOW }, () => e('followed'))
    expect(calibrate([...viejas, ...nuevas])).toMatchObject({ evaluated: CAL_WINDOW, followed: CAL_WINDOW, lower: 0, increases: 0 })
    expect(calibrate([...viejas, ...nuevas], 3).evaluated).toBe(3)
  })
})

describe('propuesta de ajuste del rango', () => {
  const cal = (p: Partial<Calibration>): Calibration => ({ evaluated: 0, followed: 0, lower: 0, higher: 0, increases: 0, declined: 0, ...p })
  const base: [number, number] = [7, 10]
  it('constantes: 4 comparaciones, 3 de subir, 60 %, hasta 2 de más', () => {
    expect([CAL_MIN_EVALUATED, CAL_MIN_INCREASES, CAL_SHARE, CAL_MAX_WIDEN, CAL_WINDOW]).toEqual([4, 3, 0.6, 2, 6])
  })
  it('si casi nunca subís cuando te lo sugiere, amplía el tope en 1', () => {
    expect(rangeProposal(base, base, cal({ evaluated: 6, increases: 6, declined: 5 }))).toEqual({ reason: 'aggressive', from: [7, 10], to: [7, 11] })
    expect(rangeProposal(base, base, cal({ increases: 5, declined: 3 }))).toMatchObject({ reason: 'aggressive' }) // 60 % justo
    expect(rangeProposal(base, base, cal({ increases: 5, declined: 2 }))).toBeNull() // 40 %
    expect(rangeProposal(base, base, cal({ increases: 2, declined: 2 }))).toBeNull() // pocas comparaciones
  })
  it('amplía hasta 2 sobre el tope del ejercicio y no más', () => {
    const c = cal({ increases: 4, declined: 4 })
    expect(rangeProposal(base, [7, 11], c)!.to).toEqual([7, 12])
    expect(rangeProposal(base, [7, 12], c)).toBeNull()
  })
  it('si casi siempre trabajás con más peso del sugerido, baja el tope en 1', () => {
    const b: [number, number] = [8, 12]
    expect(rangeProposal(b, b, cal({ evaluated: 5, higher: 3 }))).toEqual({ reason: 'conservative', from: [8, 12], to: [8, 11] })
    expect(rangeProposal(b, b, cal({ evaluated: 5, higher: 2 }))).toBeNull() // 40 %
    expect(rangeProposal(b, b, cal({ evaluated: 3, higher: 3 }))).toBeNull() // pocas comparaciones
  })
  it('no baja a menos de 1 por debajo del tope del ejercicio, ni a un rango de menos de 3 reps', () => {
    const c = cal({ evaluated: 6, higher: 6 })
    expect(rangeProposal([8, 12], [8, 11], c)).toBeNull() // ya está 1 por debajo
    expect(rangeProposal([8, 10], [8, 10], c)).toBeNull() // 8-9 sería de ancho 2
    expect(rangeProposal([8, 11], [8, 11], c)!.to).toEqual([8, 10]) // 8-10: ancho 3, vale
  })
  it('si coinciden las dos, gana ampliar (más conservador); sin datos, nada', () => {
    expect(rangeProposal(base, base, cal({ evaluated: 6, higher: 4, increases: 4, declined: 4 }))!.reason).toBe('aggressive')
    expect(rangeProposal(base, base, cal({}))).toBeNull()
  })
})
