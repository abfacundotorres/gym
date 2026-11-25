import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { todaysRecommendation } from '../../features/session/recommendation'
import { COMEBACK_MIN_DAYS, comebackFor, comebackSets, daysOff, sessionLoadFactor, sessionSets } from '../comeback'
import { exposuresOf } from '../history'
import { deloadSets, deloadWeight } from '../periodization'
import { sessionProgress } from '../session'
import type { Exercise, Session, SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = new Map(data.exercises.map((e) => [e.id, e])) as Map<string, Exercise>
const K = 4.2

describe('días sin entrenar', () => {
  const s = (date: string, status: Session['status'] = 'finished') => ({ date, status })
  it('sin sesiones terminadas no hay dato', () => {
    expect(daysOff([], '2026-11-30')).toBeNull()
    expect(daysOff([s('2026-11-20', 'in_progress')], '2026-11-30')).toBeNull()
  })
  it('cuenta desde la última terminada, sin importar el orden, y una en curso no cuenta', () => {
    const list = [s('2026-11-05'), s('2026-11-20'), s('2026-11-12'), s('2026-11-25', 'in_progress')]
    expect(daysOff(list, '2026-11-30')).toBe(10)
    expect(daysOff([...list].reverse(), '2026-11-30')).toBe(10)
  })
  it('el mismo día es 0 y una fecha futura no da negativos', () => {
    expect(daysOff([s('2026-11-30')], '2026-11-30')).toBe(0)
    expect(daysOff([s('2026-12-05')], '2026-11-30')).toBe(0)
  })
})

describe('cómo volver (D-74)', () => {
  it('umbrales: menos de 10 días no es una pausa', () => {
    expect(COMEBACK_MIN_DAYS).toBe(10)
    expect([null, undefined, 0, 9].map((d) => comebackFor(d))).toEqual([null, null, null, null])
    expect(comebackFor(10)).toMatchObject({ tier: 'short', loadFactor: 0.95 })
    expect(comebackFor(20)!.tier).toBe('short')
    expect(comebackFor(21)).toMatchObject({ tier: 'medium', loadFactor: 0.9 })
    expect(comebackFor(41)!.tier).toBe('medium')
    expect(comebackFor(42)).toMatchObject({ tier: 'long', loadFactor: 0.8 })
    expect(comebackFor(200)!.tier).toBe('long')
  })

  it('series: una menos, dos tercios o la mitad; nunca menos de 2 ni más de lo planificado', () => {
    const t = (days: number) => [1, 2, 3, 4, 5, 6].map((p) => comebackSets(p, comebackFor(days)!))
    expect(t(12)).toEqual([1, 2, 2, 3, 4, 5])
    expect(t(30)).toEqual([1, 2, 2, 3, 4, 4])
    expect(t(60)).toEqual([1, 2, 2, 2, 3, 3])
  })

  it('sessionSets y sessionLoadFactor: ni deload ni vuelta no cambian nada; juntos gana la reducción más fuerte', () => {
    expect(sessionSets({}, 4)).toBe(4)
    expect(sessionLoadFactor({})).toBeNull()
    expect(sessionSets({ deload: true }, 5)).toBe(deloadSets(5)) // 3
    expect(sessionLoadFactor({ deload: true })).toBe(0.9)
    expect(sessionSets({ comebackDays: 30 }, 5)).toBe(4)
    expect(sessionLoadFactor({ comebackDays: 30 })).toBe(0.9)
    expect(sessionLoadFactor({ comebackDays: 12 })).toBe(0.95)
    // deload + vuelta corta: la carga del deload (0,9 < 0,95) y las series del deload (3 < 4)
    expect(sessionSets({ deload: true, comebackDays: 12 }, 5)).toBe(3)
    expect(sessionLoadFactor({ deload: true, comebackDays: 12 })).toBe(0.9)
    // deload + vuelta larga: gana la vuelta en carga (0,8) y en series (3 = mitad de 5)
    expect(sessionLoadFactor({ deload: true, comebackDays: 60 })).toBe(0.8)
    expect(sessionSets({ deload: true, comebackDays: 60 }, 4)).toBe(2)
    // una pausa corta (<10 días) guardada a mano no hace nada
    expect(sessionSets({ comebackDays: 5 }, 4)).toBe(4)
    expect(sessionLoadFactor({ comebackDays: 5 })).toBeNull()
  })

  it('deloadWeight con otro factor: −5 %, −20 %; si el redondeo no baja nada, baja un incremento', () => {
    const press = ex.get('incline_db_press')! // mancuernas, paso 2,5
    expect(deloadWeight(press, 25, K, 0.8)).toBe(20)
    expect(deloadWeight(press, 25, K, 0.95)).toBe(22.5) // 23,75 redondea a 25 = igual → baja un incremento
    expect(deloadWeight(press, 25, K)).toBe(22.5) // el −10 % de siempre
  })
})

describe('las sesiones de vuelta no son base de progresión', () => {
  const W = (weight: number, reps: number): SetEntry => ({ id: `s${weight}${reps}`, type: 'W', weight, reps })
  const sess = (date: string, weight: number, extra: Partial<Session> = {}): Session => ({
    id: `x-${date}`, date, planDayId: 'p', mesocycleId: null, note: '', startedAt: null, finishedAt: 1, status: 'finished', source: 'app',
    items: [{ exerciseId: 'incline_db_press', sets: [W(weight, 10), W(weight, 10), W(weight, 10)] }], exerciseIds: ['incline_db_press'], ...extra,
  })
  const list = [sess('2026-10-01', 25), sess('2026-10-20', 22.5, { comebackDays: 19 })]
  it('exposuresOf las deja afuera salvo que se pidan', () => {
    expect(exposuresOf(list, 'incline_db_press').map((e) => e.date)).toEqual(['2026-10-01'])
    expect(exposuresOf(list, 'incline_db_press', { includeDeload: true }).map((e) => e.date)).toEqual(['2026-10-01', '2026-10-20'])
  })
})

describe('la sugerencia de hoy en una sesión de vuelta', () => {
  const W = (weight: number, reps: number): SetEntry => ({ id: `s${weight}${reps}${Math.random()}`, type: 'W', weight, reps })
  const press = ex.get('incline_db_press')!
  const prev: Session = {
    id: 'prev', date: '2026-11-05', planDayId: 'p', mesocycleId: null, note: '', startedAt: null, finishedAt: 1, status: 'finished', source: 'app',
    items: [{ exerciseId: press.id, sets: [W(25, 10), W(25, 10), W(25, 10), W(25, 10)] }], exerciseIds: [press.id],
  }
  const item = { exerciseId: press.id, sets: 4, alt: [] }
  const today = (extra: Partial<Session>) => ({ id: 'hoy', date: '2026-12-01', ...extra })

  it('sin pausa: la progresión de siempre', () => {
    const r = todaysRecommendation(press, today({}), item, [prev], K)
    expect(r.comeback).toBeNull()
    expect(r.plannedSets).toBe(4)
    expect(r.rec.weight).toBe(27.5) // llegó al tope con 25 → sube un paso
  })

  it('con pausa media: carga −10 % sobre la última vez, series 2/3 y mensaje con los días', () => {
    const r = todaysRecommendation(press, today({ comebackDays: 26 }), item, [prev], K)
    expect(r.comeback).toMatchObject({ tier: 'medium', days: 26 })
    expect(r.plannedSets).toBe(3) // ceil(4 × 2/3)
    expect(r.rec).toMatchObject({ status: 'same', weight: 22.5, message: 'Vuelta tras 26 días' })
    expect(r.rec.targets).toEqual([10, 10, 10]) // las reps de la última vez, no las de una subida que no se hace
  })

  it('no sube al volver: sin la subida pendiente, 90 % del último peso (25 → 22,5 y no 27,5 × 0,9)', () => {
    expect(todaysRecommendation(press, today({}), item, [prev], K).rec.weight).toBe(27.5) // sin pausa sí sube
    expect(todaysRecommendation(press, today({ comebackDays: 26 }), item, [prev], K).rec.weight).toBe(22.5)
  })

  it('si la última vez hubo dolor (−10 %), no se vuelve con menos reducción: gana la más fuerte', () => {
    const at = (pain?: 'molestia' | 'dolor'): Session => ({ ...prev, items: [{ exerciseId: press.id, ...(pain ? { pain } : {}), sets: [W(40, 10), W(40, 10), W(40, 10), W(40, 10)] }] })
    const w = (h: Session) => todaysRecommendation(press, today({ comebackDays: 12 }), item, [h], K).rec.weight
    expect(w(at())).toBe(37.5) // 40 × 0,95 = 38 → 37,5
    expect(w(at('molestia'))).toBe(37.5) // molestia: mismo peso, la vuelta ya es menos
    expect(w(at('dolor'))).toBe(35) // 40 × 0,9 = 36 → 35
    expect(todaysRecommendation(press, today({ comebackDays: 12 }), item, [at('dolor')], K).rec.pain).toBe('dolor') // el aviso sigue
    expect(todaysRecommendation(press, today({ comebackDays: 60 }), item, [at('dolor')], K).rec.weight).toBe(32.5) // la vuelta larga (0,8) es más fuerte que el dolor
  })

  it('sin historial no inventa un peso: queda para elegir a mano', () => {
    const r = todaysRecommendation(press, today({ comebackDays: 26 }), item, [], K)
    expect(r.rec.weight).toBeNull()
    expect(r.plannedSets).toBe(3)
  })

  it('con pausa larga, −20 % y la mitad de las series', () => {
    const r = todaysRecommendation(press, today({ comebackDays: 60 }), item, [prev], K)
    expect(r.plannedSets).toBe(2)
    expect(r.rec.weight).toBe(20)
  })

  it('no se suma con el deload: gana la reducción más fuerte y el mensaje sigue diciendo Deload', () => {
    const r = todaysRecommendation(press, today({ comebackDays: 12, deload: true }), item, [prev], K)
    expect(r.plannedSets).toBe(2) // deload: la mitad de 4
    expect(r.rec.weight).toBe(22.5) // 0,9 y no 0,9 × 0,95
    expect(r.rec.message).toBe('Deload')
  })

  it('un día de sueño y energía bajos no pisa la vuelta ni pide una serie menos extra', () => {
    const r = todaysRecommendation(press, today({ comebackDays: 26, readiness: { sleep: 1, energy: 1 } }), item, [prev], K)
    expect(r.lowDay).toBe(false)
    expect(r.fewer).toBe(false)
    expect(r.rec.weight).toBe(22.5)
  })

  it('el avance de la sesión cuenta contra las series reducidas', () => {
    const plan = { id: 'p', name: 'P', weekday: 1, items: [item] }
    const base = { ...today({}), planDayId: 'p', mesocycleId: null, note: '', startedAt: 1, finishedAt: null, status: 'in_progress' as const, source: 'app' as const, exerciseIds: [press.id], items: [{ exerciseId: press.id, sets: [W(22.5, 10), W(22.5, 10), W(22.5, 10)] }] }
    const back = sessionProgress({ ...base, comebackDays: 26 }, plan)
    expect([back.doneSets, back.totalSets]).toEqual([3, 3]) // 4 planificadas → 3 con la vuelta
    expect(back.currentIndex).toBeNull() // completo
    const normal = sessionProgress(base, plan)
    expect([normal.doneSets, normal.totalSets]).toEqual([3, 4])
  })
})
