import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { comparableKg, formatLoad } from '../load'
import { formatSet, lastExposure, mesocycleWeek, sessionStats, summaryText } from '../session'
import type { Exercise } from '../types'
import { volumeByMuscle } from '../volume'
import { weekStart } from '../dates'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = new Map(data.exercises.map((e) => [e.id, e]))
const E = (id: string) => ex.get(id)!

describe('carga', () => {
  it('per_side con barra muestra el total', () => {
    expect(formatLoad(E('bench_flat_barbell'), 25, 4.2)).toBe('25 por lado → 70 kg')
    expect(formatLoad(E('leg_press_45'), 50, 4.2)).toBe('50 por lado')
    expect(formatLoad(E('lateral_raise_db'), 12.5, 4.2)).toBe('12,5 por mano')
    expect(formatLoad(E('leg_curl_seated'), 15, 4.2)).toBe('15 ladr. (≈63 kg)')
    expect(comparableKg(E('rdl_barbell'), 0, 4.2)).toBe(20) // barra sola
  })
})

describe('sesión', () => {
  it('última exposición: la más reciente antes de la fecha', () => {
    const last = lastExposure(data.sessions, 'incline_db_press', '2026-11-04')
    expect(last?.date).toBe('2026-10-29')
    expect(lastExposure(data.sessions, 'incline_db_press', '2026-11-09')?.date).toBe('2026-11-05')
    expect(lastExposure(data.sessions, 'ohp_barbell', '2026-11-09')).toBeNull()
  })

  it('formatea series', () => {
    expect(formatSet({ id: 'x', type: 'W', weight: 30, reps: 10, flag: 'rp', repsBeforePause: 8 })).toBe('30×10 rp(8)')
    expect(formatSet({ id: 'x', type: 'W', weight: 22.5, reps: 4, flag: 'drop' })).toBe('22,5×4 drop')
    expect(formatSet({ id: 'x', type: 'A', weight: 10, reps: null })).toBe('A 10×—')
  })

  it('semana del mesociclo', () => {
    const meso = data.mesocycles[0]!
    expect(mesocycleWeek(meso, '2026-10-19')).toEqual({ week: 1, total: 6, isDeload: false })
    expect(mesocycleWeek(meso, '2026-11-09')).toEqual({ week: 4, total: 6, isDeload: false })
    expect(mesocycleWeek(meso, '2026-11-23')).toEqual({ week: 6, total: 6, isDeload: true })
    expect(mesocycleWeek(meso, '2026-11-30')).toBeNull()
  })

  it('resumen de texto y estadísticas', () => {
    const s = data.sessions.find((x) => x.date === '2026-10-22')!
    const plan = data.planDays.find((p) => p.id === s.planDayId)
    const text = summaryText(s, plan, ex)
    expect(text.split('\n')[0]).toBe('Jueves: Full body — 22/10')
    expect(text).toContain('Peso muerto rumano (barra) (por lado): 30×10, 30×10, 30×10 rp(8)')
    expect(text).not.toContain('Vuelos laterales') // sin series registradas
    expect(sessionStats(s, plan)).toMatchObject({ plannedSets: 25, exercisesPlanned: 8 })
  })
})

describe('volumen (§7)', () => {
  it('semana del 2/11: pecho = 6.5 series', () => {
    const week = data.sessions.filter((s) => weekStart(s.date) === '2026-11-02')
    const exMap = new Map<string, Exercise>(ex)
    const items = week.flatMap((s) => s.items)
    const v = volumeByMuscle(items, exMap)
    expect(v.chest?.total).toBe(6.5)
    expect(v.chest?.from).toEqual([
      { exerciseId: 'bench_flat_barbell', sets: 3, role: 'primary' },
      { exerciseId: 'incline_db_press', sets: 3.5, role: 'primary' },
    ])
  })
})
