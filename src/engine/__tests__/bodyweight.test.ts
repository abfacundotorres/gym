import { describe, expect, it } from 'vitest'
import { bodyweightId, parseKg, weeklyRate, weeklySeries } from '../bodyweight'

describe('parseKg', () => {
  it('acepta coma o punto y redondea a un decimal', () => {
    expect(parseKg('82,4')).toBe(82.4)
    expect(parseKg('82.4')).toBe(82.4)
    expect(parseKg(' 82 ')).toBe(82)
    expect(parseKg('82,46')).toBe(82.5)
  })
  it('rechaza lo que no es un peso razonable', () => {
    for (const bad of ['', 'abc', '82,4kg', '-80', '0', '19,9', '401', '1000', '8 2', '82,', ',5', '82.456']) expect(parseKg(bad), bad).toBeNull()
    expect(parseKg('20')).toBe(20)
    expect(parseKg('400')).toBe(400)
  })
  it('el id es por día', () => {
    expect(bodyweightId('2026-11-17')).toBe('bw-2026-11-17')
  })
})

describe('weeklySeries', () => {
  it('agrupa por semana (lunes a domingo) y promedia', () => {
    const s = weeklySeries([
      { date: '2026-11-09', kg: 83 }, // lunes
      { date: '2026-11-15', kg: 82 }, // domingo de la misma semana
      { date: '2026-11-16', kg: 81.5 }, // lunes siguiente
    ])
    expect(s).toEqual([
      { monday: '2026-11-09', kg: 82.5, n: 2 },
      { monday: '2026-11-16', kg: 81.5, n: 1 },
    ])
  })
  it('sale ordenada de la más vieja a la más nueva, vengan como vengan', () => {
    const s = weeklySeries([{ date: '2026-11-23', kg: 80 }, { date: '2026-11-02', kg: 82 }, { date: '2026-11-09', kg: 81 }])
    expect(s.map((p) => p.monday)).toEqual(['2026-11-02', '2026-11-09', '2026-11-23'])
  })
  it('sin mediciones, vacía', () => {
    expect(weeklySeries([])).toEqual([])
  })
})

describe('weeklyRate', () => {
  const wk = (monday: string, kg: number) => ({ monday, kg, n: 1 })
  it('una baja pareja de medio kilo por semana', () => {
    const s = [wk('2026-10-19', 84), wk('2026-10-26', 83.5), wk('2026-11-02', 83), wk('2026-11-09', 82.5)]
    expect(weeklyRate(s)).toBeCloseTo(-0.5, 10)
  })
  it('una suba', () => {
    expect(weeklyRate([wk('2026-10-19', 80), wk('2026-10-26', 80.3), wk('2026-11-02', 80.6)])).toBeCloseTo(0.3, 10)
  })
  it('sin cambios es 0', () => {
    expect(weeklyRate([wk('2026-10-19', 80), wk('2026-10-26', 80), wk('2026-11-02', 80)])).toBeCloseTo(0, 10)
  })
  it('cuenta las semanas reales: una semana sin medir no se inventa', () => {
    // semanas 0, 1 y 3 con -0,5/semana exacto
    const s = [wk('2026-10-19', 84), wk('2026-10-26', 83.5), wk('2026-11-09', 82.5)]
    expect(weeklyRate(s)).toBeCloseTo(-0.5, 10)
  })
  it('con menos de 3 semanas no dice nada', () => {
    expect(weeklyRate([])).toBeNull()
    expect(weeklyRate([wk('2026-10-19', 84), wk('2026-10-26', 83.5)])).toBeNull()
  })
  it('usa solo las últimas semanas pedidas', () => {
    const s = [wk('2026-09-28', 90), wk('2026-10-05', 90), wk('2026-10-12', 84), wk('2026-10-19', 83), wk('2026-10-26', 82)]
    expect(weeklyRate(s, 3)).toBeCloseTo(-1, 10)
  })
  it('usa todos los puntos (mínimos cuadrados), no solo el primero y el último', () => {
    const s = [wk('2026-10-19', 84), wk('2026-10-26', 83.2), wk('2026-11-02', 83.2), wk('2026-11-09', 82.4)]
    expect(weeklyRate(s)).toBeCloseTo(-0.48, 10) // de punta a punta daría -0,533
  })
})
