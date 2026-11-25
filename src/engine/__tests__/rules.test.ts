import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { comebackFor, comebackSets, sessionLoadFactor, sessionSets } from '../comeback'
import { pausedWeeks } from '../periodization'
import { DEFAULT_RULES, RULE_LIMITS, deloadFactor, resolveRules, rulesOverrides, type Rules } from '../rules'
import { volumeSpikes } from '../risk'
import type { Exercise, Mesocycle, Session } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = new Map(data.exercises.map((e) => [e.id, e])) as Map<string, Exercise>
const rules = (p: Partial<Rules>): Rules => resolveRules(p)

describe('reglas del motor (D-78)', () => {
  it('sin nada guardado, los valores de siempre', () => {
    expect(resolveRules()).toEqual(DEFAULT_RULES)
    expect(resolveRules(null)).toEqual(DEFAULT_RULES)
    expect(resolveRules({})).toEqual(DEFAULT_RULES)
    expect(DEFAULT_RULES).toEqual({ comebackMinDays: 10, comebackLoadPct: [95, 90, 80], failureSessionMin: 2, failureStreakMin: 3, spikePct: 50, spikeMinExtra: 4, deloadMode: 'standard' })
  })

  it('completa lo que falta y respeta lo guardado, sin mutar los valores por defecto', () => {
    const r = resolveRules({ comebackMinDays: 14, deloadMode: 'light' })
    expect(r).toMatchObject({ comebackMinDays: 14, deloadMode: 'light', spikePct: 50, failureStreakMin: 3 })
    r.comebackLoadPct[0] = 1
    expect(DEFAULT_RULES.comebackLoadPct).toEqual([95, 90, 80])
  })

  it('cada valor inválido o fuera de rango vuelve a su valor por defecto, sin tirar el resto', () => {
    const r = resolveRules({
      comebackMinDays: 3, // debajo del mínimo
      failureSessionMin: 1,
      failureStreakMin: 9,
      spikePct: 12.5, // no entero
      spikeMinExtra: '4' as unknown as number,
      deloadMode: 'raro' as never,
      comebackLoadPct: [95, 10, 80], // el del medio, fuera de rango
    })
    expect(r).toEqual({ ...DEFAULT_RULES, comebackLoadPct: [95, 90, 80] })
    expect(resolveRules({ comebackLoadPct: [90, 85] as never }).comebackLoadPct).toEqual([95, 90, 80]) // tupla incompleta
    expect(resolveRules({ spikePct: 55.5, comebackMinDays: 10.5 })).toMatchObject({ spikePct: 50, comebackMinDays: 10 }) // dentro del rango, pero no entero
    expect(resolveRules({ comebackMinDays: 14, spikePct: 'x' as never })).toMatchObject({ comebackMinDays: 14, spikePct: 50 })
  })

  it('los bordes de cada rango valen', () => {
    for (const [k, [lo, hi]] of Object.entries(RULE_LIMITS)) {
      if (k === 'comebackLoadPct') continue
      expect(resolveRules({ [k]: lo })[k as keyof Rules]).toBe(lo)
      expect(resolveRules({ [k]: hi })[k as keyof Rules]).toBe(hi)
      expect(resolveRules({ [k]: lo - 1 })[k as keyof Rules]).toBe(DEFAULT_RULES[k as keyof Rules])
      expect(resolveRules({ [k]: hi + 1 })[k as keyof Rules]).toBe(DEFAULT_RULES[k as keyof Rules])
    }
    expect(resolveRules({ comebackLoadPct: [50, 100, 75] }).comebackLoadPct).toEqual([50, 100, 75])
  })

  it('rulesOverrides: solo lo que difiere; vacío si todo está por defecto', () => {
    expect(rulesOverrides(DEFAULT_RULES)).toEqual({})
    expect(rulesOverrides(rules({ comebackMinDays: 14, comebackLoadPct: [95, 85, 80], deloadMode: 'rest' }))).toEqual({ comebackMinDays: 14, comebackLoadPct: [95, 85, 80], deloadMode: 'rest' })
    expect(rulesOverrides(rules({ spikePct: 50 }))).toEqual({}) // igual al valor por defecto: no se guarda
  })

  it('factor de carga del deload según el modo', () => {
    expect([deloadFactor('standard'), deloadFactor('light'), deloadFactor('rest')]).toEqual([0.9, 0.8, 0.8])
  })
})

describe('la vuelta y el deload con reglas propias', () => {
  it('días mínimos y cargas por tramo', () => {
    const r = rules({ comebackMinDays: 14, comebackLoadPct: [90, 85, 70] })
    expect(comebackFor(12, r)).toBeNull() // con las de siempre sí sería vuelta
    expect(comebackFor(12)).not.toBeNull()
    expect(comebackFor(14, r)).toMatchObject({ tier: 'short', loadFactor: 0.9 })
    expect(comebackFor(30, r)).toMatchObject({ tier: 'medium', loadFactor: 0.85 })
    expect(comebackFor(60, r)).toMatchObject({ tier: 'long', loadFactor: 0.7 })
    expect(comebackSets(5, comebackFor(30, r)!)).toBe(4) // las series por tramo no cambian
  })

  it('sessionLoadFactor y sessionSets según el modo de deload, y juntos con la vuelta gana la reducción más fuerte', () => {
    const light = rules({ deloadMode: 'light' })
    expect(sessionLoadFactor({ deload: true })).toBe(0.9)
    expect(sessionLoadFactor({ deload: true }, light)).toBe(0.8)
    expect(sessionLoadFactor({ deload: true }, rules({ deloadMode: 'rest' }))).toBe(0.8)
    expect(sessionLoadFactor({}, light)).toBeNull() // sin deload ni vuelta, nada
    expect(sessionSets({ deload: true }, 5, light)).toBe(3) // las series no dependen del modo
    // deload liviano (0,8) y vuelta corta (0,95): gana el deload; con vuelta larga personalizada de 70 %, gana la vuelta
    expect(sessionLoadFactor({ deload: true, comebackDays: 12 }, light)).toBe(0.8)
    expect(sessionLoadFactor({ deload: true, comebackDays: 60 }, rules({ deloadMode: 'light', comebackLoadPct: [95, 90, 70] }))).toBe(0.7)
    // las reglas de la vuelta también llegan a sessionSets
    expect(sessionSets({ comebackDays: 12 }, 4, rules({ comebackMinDays: 14 }))).toBe(4)
  })
})

describe('semana sin pesas: el deload sin sesiones no es una falta', () => {
  const meso: Mesocycle = { id: 'm', startDate: '2026-10-19', accumulationWeeks: 5, deloadWeeks: 1, status: 'active', notes: '' }
  const session = (date: string): Pick<Session, 'date' | 'status'> => ({ date, status: 'finished' })
  // cinco semanas de acumulación con sesión (19/10 a 16/11) y la de deload (23/11) sin ninguna
  const accum = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map(session)
  it('con el deload de siempre, la semana sin sesiones cuenta como pausa y corre el mesociclo', () => {
    expect(pausedWeeks(meso, accum, '2026-11-30')).toEqual(['2026-11-23'])
    expect(pausedWeeks(meso, accum, '2026-11-30', rules({ deloadMode: 'light' }))).toEqual(['2026-11-23'])
  })
  it('con semana sin pesas, es el descanso planificado: no se corre nada', () => {
    expect(pausedWeeks(meso, accum, '2026-11-30', rules({ deloadMode: 'rest' }))).toEqual([])
  })
  it('una semana de acumulación sin sesiones sigue siendo pausa, también en ese modo', () => {
    const conHueco = ['2026-10-19', '2026-10-26', '2026-11-09', '2026-11-16', '2026-11-23'].map(session) // falta la del 02/11
    expect(pausedWeeks(meso, conHueco, '2026-12-07', rules({ deloadMode: 'rest' }))).toEqual(['2026-11-02'])
  })
  it('si en la semana de deload sí entrenaste, cuenta como siempre', () => {
    expect(pausedWeeks(meso, [...accum, session('2026-11-24')], '2026-11-30', rules({ deloadMode: 'rest' }))).toEqual([])
  })
})

describe('el salto de volumen con umbrales propios', () => {
  let n = 0
  const W = () => ({ id: `s${n++}`, type: 'W' as const, weight: 10, reps: 12 })
  const sess = (date: string, k: number, extra: Partial<Session> = {}): Session => ({
    id: `x-${date}-${n++}`, date, planDayId: 'p', mesocycleId: null, note: '', startedAt: null, finishedAt: 1, status: 'finished', source: 'app',
    items: [{ exerciseId: 'lateral_raise_db', sets: Array.from({ length: k }, W) }], exerciseIds: ['lateral_raise_db'], ...extra,
  })
  const base = ['2026-11-04', '2026-10-28', '2026-10-21'].map((d) => sess(d, 6))
  it('un % más bajo avisa antes y uno más alto después', () => {
    const cur = sess('2026-11-12', 9, { status: 'in_progress' }) // 9 sobre un promedio de 6: +50 % y +3
    expect(volumeSpikes([...base, cur], cur, ex)).toEqual([]) // por defecto: +3 no alcanza las 4 series de más
    expect(volumeSpikes([...base, cur], cur, ex, rules({ spikeMinExtra: 3 }))).toHaveLength(1)
    expect(volumeSpikes([...base, cur], cur, ex, rules({ spikeMinExtra: 3, spikePct: 60 }))).toEqual([]) // 50 % no alcanza el 60 %
    const mas = sess('2026-11-12', 10, { status: 'in_progress' }) // +67 % y +4
    expect(volumeSpikes([...base, mas], mas, ex)).toHaveLength(1)
    expect(volumeSpikes([...base, mas], mas, ex, rules({ spikePct: 70 }))).toEqual([])
  })
})
