import { describe, expect, it } from 'vitest'
import { formatRest } from '../format'
import { averageRest, MAX_REST_SEC, MIN_REST_SEC, restBetween } from '../rest'
import { summaryText } from '../session'
import type { Exercise, PlanDay, Session, SetEntry } from '../types'

const S = (restSec?: number, type: 'A' | 'W' = 'W'): SetEntry => ({ id: 'x', type, weight: 25, reps: 8, ...(restSec != null ? { restSec } : {}) })

describe('descanso real (D-44)', () => {
  it('segundos entre series; sin dato si no hay hora previa o fue una pausa larga', () => {
    expect(restBetween(1_000_000, 1_150_000)).toBe(150)
    expect(restBetween(null, 1_150_000)).toBeUndefined()
    expect(restBetween(undefined, 1_150_000)).toBeUndefined()
    expect(restBetween(0, MAX_REST_SEC * 1000)).toBe(MAX_REST_SEC)
    expect(restBetween(0, (MAX_REST_SEC + 1) * 1000)).toBeUndefined()
    expect(restBetween(2_000, 1_000)).toBeUndefined() // reloj hacia atrás
    expect(restBetween(0, (MIN_REST_SEC - 1) * 1000)).toBeUndefined() // carga seguida
    expect(restBetween(0, MIN_REST_SEC * 1000)).toBe(MIN_REST_SEC)
  })

  it('promedio solo de efectivas con dato', () => {
    expect(averageRest([S(), S(120), S(180), S(999, 'A')])).toBe(150)
    expect(averageRest([S(), S()])).toBeNull()
  })

  it('formato m:ss', () => {
    expect([0, 59, 60, 150, 605].map(formatRest)).toEqual(['0:00', '0:59', '1:00', '2:30', '10:05'])
  })

  it('el resumen incluye el descanso promedio solo si hay datos', () => {
    const ex = new Map<string, Exercise>([['b', { id: 'b', name: 'Banca', unit: 'total' } as Exercise]])
    const plan = { id: 'p', name: 'P', weekday: 1, items: [] } as PlanDay
    const base = { id: 's', date: '2026-11-09', planDayId: 'p', note: '', status: 'finished', exerciseIds: ['b'] } as Session
    const withRest = { ...base, items: [{ exerciseId: 'b', sets: [S(), S(120), S(180)] }] } as Session
    const without = { ...base, items: [{ exerciseId: 'b', sets: [S(), S()] }] } as Session
    expect(summaryText(withRest, plan, ex)).toContain('Banca: 25×8, 25×8, 25×8 · desc. ~2:30')
    expect(summaryText(without, plan, ex)).not.toContain('desc.')
  })
})
