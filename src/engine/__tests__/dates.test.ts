import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDDMM, weekStart, weekdayOf } from '../dates'

describe('dates', () => {
  it('las fechas del seed caen en los días del plan', () => {
    expect(weekdayOf('2026-10-19')).toBe(1) // lunes
    expect(weekdayOf('2026-10-20')).toBe(2) // martes
    expect(weekdayOf('2026-10-22')).toBe(4) // jueves
    expect(weekdayOf('2026-11-05')).toBe(4)
  })

  it('la semana va de lunes a domingo', () => {
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
    expect(weekStart('2026-11-05')).toBe('2026-11-02')
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // domingo
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
  })

  it('formatea dd/mm y suma días cruzando de mes', () => {
    expect(formatDDMM('2026-11-05')).toBe('05/11')
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(daysBetween('2026-10-19', '2026-11-08')).toBe(20)
  })
})
