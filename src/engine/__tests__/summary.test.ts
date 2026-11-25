import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { resolveRules } from '../rules'
import { blockSummary, summaryText, weekSummary, type SummaryInput } from '../summary'
import { defaultSettings, type Exercise, type Mesocycle, type PlanDay, type Session, type SessionItem, type SetEntry, type ZoneIssue } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const exercises = new Map(data.exercises.map((e) => [e.id, e])) as Map<string, Exercise>
const planDays: PlanDay[] = [
  { id: 'a', name: 'Lunes: Torso', weekday: 1, items: [] },
  { id: 'b', name: 'Jueves: Full body', weekday: 3, items: [] },
]
const meso: Mesocycle = { id: 'm', startDate: '2026-10-19', accumulationWeeks: 5, deloadWeeks: 1, status: 'active', notes: '' }

let n = 0
const W = (weight = 25, reps = 10, rir?: number): SetEntry => ({ id: `s${n++}`, type: 'W', weight, reps, ...(rir != null ? { rir } : {}) })
const item = (exerciseId: string, sets: SetEntry[]): SessionItem => ({ exerciseId, sets })
const many = (k: number) => Array.from({ length: k }, () => W())
const sess = (date: string, items: SessionItem[], extra: Partial<Session> = {}): Session => ({
  id: `x-${date}-${n++}`, date, planDayId: 'a', mesocycleId: 'm', note: '', startedAt: null, finishedAt: 1, status: 'finished', source: 'app',
  items, exerciseIds: items.map((i) => i.exerciseId), ...extra,
})
const base = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  sessions: [], exercises, planDays, mesocycles: [meso], zoneIssues: [], bodyweights: [], settings: { ...defaultSettings(), kgPerBrick: 4.2 }, ...over,
})
const LAT = 'lateral_raise_db'
const PRESS = 'incline_db_press'

describe('resumen de la semana (D-80)', () => {
  const sessions = [
    sess('2026-11-02', [item(LAT, many(9))]), // semana anterior
    sess('2026-11-09', [item(PRESS, many(3)), item(LAT, many(4))], { startedAt: 1_000_000, finishedAt: 1_000_000 + 55 * 60_000 }),
    sess('2026-11-12', [item(LAT, many(6))], { planDayId: 'b' }),
    sess('2026-11-15', [item(LAT, many(2))], { status: 'in_progress' }), // en curso: no cuenta
    sess('2026-11-16', [item(LAT, many(7))]), // semana siguiente
  ]
  const w = weekSummary(base({ sessions }), '2026-11-09')

  it('solo las sesiones terminadas de lunes a domingo, en orden, con su día del plan', () => {
    expect(w.kind).toBe('week')
    expect([w.from, w.to]).toEqual(['2026-11-09', '2026-11-15'])
    expect(w.sessions.map((s) => [s.date, s.planName, s.sets])).toEqual([['2026-11-09', 'Lunes: Torso', 7], ['2026-11-12', 'Jueves: Full body', 6]])
    expect(w.doneSets).toBe(13)
    expect(w.plannedSessions).toBe(2)
  })
  it('el orden no depende de cómo vengan: por fecha y, el mismo día, por hora de inicio', () => {
    const tarde = sess('2026-11-10', [item(LAT, many(1))], { startedAt: 2_000_000, planDayId: 'b' })
    const temprano = sess('2026-11-10', [item(LAT, many(2))], { startedAt: 1_000_000 })
    const antes = sess('2026-11-09', [item(LAT, many(3))])
    const r = weekSummary(base({ sessions: [tarde, antes, temprano] }), '2026-11-09')
    expect(r.sessions.map((x) => [x.date, x.sets])).toEqual([['2026-11-09', 3], ['2026-11-10', 2], ['2026-11-10', 1]])
  })
  it('duración solo si hay inicio y fin válidos', () => {
    expect(w.sessions.map((s) => s.minutes)).toEqual([55, null])
    const raro = weekSummary(base({ sessions: [sess('2026-11-09', [item(LAT, many(1))], { startedAt: 5, finishedAt: 5 })] }), '2026-11-09')
    expect(raro.sessions[0]!.minutes).toBeNull()
  })
  it('las series por músculo de la semana contra su rango, con el estado', () => {
    const lat = w.volume.find((v) => v.muscle === 'delt_side')!
    expect(lat).toEqual({ muscle: 'delt_side', sets: 10, target: [10, 20], status: 'in' }) // 4 + 6
    expect(w.volume.find((v) => v.muscle === 'chest')).toMatchObject({ sets: 3, status: 'below' })
    expect(w.volume.find((v) => v.muscle === 'delt_front')).toMatchObject({ sets: 1.5 }) // secundario: media serie
    expect(w.volume.find((v) => v.muscle === 'calves')).toMatchObject({ sets: 0, status: 'below' })
    expect(weekSummary(base({ sessions: [sess('2026-11-09', [item(LAT, many(25))])] }), '2026-11-09').volume.find((v) => v.muscle === 'delt_side')!.status).toBe('above')
  })
  it('en cut el rango baja al 80 % (D-69)', () => {
    const cut = weekSummary(base({ sessions, mesocycles: [{ ...meso, phase: 'cut' }] }), '2026-11-09')
    expect(cut.phase).toBe('cut')
    expect(cut.volume.find((v) => v.muscle === 'delt_side')).toMatchObject({ target: [8, 16], status: 'in' })
  })
  it('una semana sin sesiones: todo en cero, sin inventar nada', () => {
    const vacia = weekSummary(base({ sessions }), '2026-11-23')
    expect(vacia).toMatchObject({ sessions: [], doneSets: 0, prs: [], zones: [], weight: null, spikes: [], failureSessions: 0, rir: { withRir: 0, total: 0 } })
    expect(vacia.volume.every((v) => v.sets === 0)).toBe(true)
  })
  it('marca las sesiones de deload y de vuelta', () => {
    const r = weekSummary(base({ sessions: [sess('2026-11-09', [item(LAT, many(2))], { deload: true }), sess('2026-11-11', [item(LAT, many(2))], { comebackDays: 14 })] }), '2026-11-09')
    expect(r.sessions.map((s) => s.tag)).toEqual(['deload', 'vuelta'])
  })
})

describe('PRs, RIR y avisos del período', () => {
  const press = (weight: number, reps = 10, rir?: number) => item(PRESS, [W(weight, reps, rir), W(weight, reps, rir)])
  const sessions = [sess('2026-10-26', [press(25)]), sess('2026-11-02', [press(25)]), sess('2026-11-09', [press(30)]), sess('2026-11-16', [press(27.5)])]
  it('solo los PRs de ese período, contra todo lo anterior', () => {
    const w = weekSummary(base({ sessions }), '2026-11-09')
    expect(w.prs.map((p) => [p.exerciseId, p.date])).toContainEqual([PRESS, '2026-11-09'])
    expect(w.prs.every((p) => p.date >= '2026-11-09' && p.date <= '2026-11-15')).toBe(true)
    expect(weekSummary(base({ sessions }), '2026-11-16').prs).toEqual([]) // 27,5 no supera el 30 de la semana anterior
  })
  it('RIR cargado y sesiones con compuestos al fallo (con el umbral de las reglas)', () => {
    const rdl = (rir?: number) => item('rdl_barbell', [W(60, 8, rir)])
    const ss = [
      sess('2026-11-09', [press(25, 8, 0), rdl(0)]), // 2 compuestos al fallo
      sess('2026-11-12', [press(25, 8, 0), rdl()]), // 1 al fallo, el rumano sin RIR
    ]
    const w = weekSummary(base({ sessions: ss }), '2026-11-09')
    expect(w.rir).toEqual({ withRir: 3, total: 4 })
    expect(w.failureSessions).toBe(1)
    expect(weekSummary(base({ sessions: ss, rules: resolveRules({ failureSessionMin: 3 }) }), '2026-11-09').failureSessions).toBe(0)
  })
  it('saltos de volumen solo en la semana, con las reglas', () => {
    const lat = (k: number) => item(LAT, many(k))
    const hist = ['2026-11-04', '2026-10-28', '2026-10-21'].map((d) => sess(d, [lat(6)]))
    const ss = [...hist, sess('2026-11-12', [lat(10)])] // +67 % y +4 sobre un promedio de 6
    const w = weekSummary(base({ sessions: ss }), '2026-11-09')
    expect(w.spikes.map((s) => [s.muscle, s.sets, s.pct])).toEqual([['delt_side', 10, 67]])
    expect(weekSummary(base({ sessions: ss, rules: resolveRules({ spikePct: 100 }) }), '2026-11-09').spikes).toEqual([])
    expect(blockSummary(base({ sessions: ss }), meso, '2026-11-30').spikes).toEqual([]) // el bloque no mira saltos
  })
})

describe('molestias y peso del período', () => {
  const z = (zone: ZoneIssue['zone'], startedOn: string, resolvedOn?: string, severity: ZoneIssue['severity'] = 'molestia'): ZoneIssue => ({ id: `${zone}${startedOn}`, zone, severity, startedOn, ...(resolvedOn ? { resolvedOn } : {}) })
  it('las que se superponen con el período, por fecha de inicio', () => {
    const zoneIssues = [
      z('knee', '2026-11-01', '2026-11-08'), // terminó antes
      z('neck', '2026-11-05'), // empezó antes y sigue
      z('hip', '2026-11-10', '2026-11-12'), // dentro
      z('elbow', '2026-11-16'), // empieza después
      z('wrist', '2026-11-15', undefined, 'dolor'), // el último día
    ]
    const w = weekSummary(base({ zoneIssues }), '2026-11-09')
    expect(w.zones.map((x) => x.zone)).toEqual(['neck', 'hip', 'wrist'])
    expect(w.zones[1]).toEqual({ zone: 'hip', severity: 'molestia', startedOn: '2026-11-10', resolvedOn: '2026-11-12' })
    expect(w.zones[2]!.severity).toBe('dolor')
  })
  it('peso: el de la semana y el cambio contra la anterior; sin mediciones, nada', () => {
    const bw = [{ date: '2026-11-02', kg: 83 }, { date: '2026-11-03', kg: 82 }, { date: '2026-11-10', kg: 82.1 }]
    expect(weekSummary(base({ bodyweights: bw }), '2026-11-09').weight).toEqual({ kg: 82.1, change: -0.4 }) // 82,5 de la semana anterior
    expect(weekSummary(base({ bodyweights: bw }), '2026-11-02').weight).toEqual({ kg: 82.5, change: null }) // sin semana anterior
    expect(weekSummary(base({ bodyweights: bw }), '2026-11-16').weight).toBeNull()
    expect(weekSummary(base(), '2026-11-09').weight).toBeNull()
  })
})

describe('resumen del bloque', () => {
  const lat = (k: number) => item(LAT, many(k))
  // Un bloque 5+1 completo (19/10 a 29/11): cinco semanas de acumulación con sesión y la de deload; el 01/12 ya es otro bloque.
  const sessions = [
    sess('2026-10-20', [lat(8)]), sess('2026-10-27', [lat(8)]), sess('2026-11-03', [lat(12)]), sess('2026-11-10', [lat(10)]), sess('2026-11-17', [lat(6)]),
    sess('2026-11-24', [lat(3)], { deload: true }), sess('2026-12-01', [lat(20)]),
  ]
  const b = blockSummary(base({ sessions }), meso, '2026-12-20')
  it('del primer lunes al final del bloque, con todas las sesiones y el promedio semanal sin el deload', () => {
    expect(b.kind).toBe('block')
    expect([b.from, b.to]).toEqual(['2026-10-19', '2026-11-29'])
    expect(b.sessions.map((s) => s.date)).toEqual(['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'])
    expect(b.sessions.at(-1)!.tag).toBe('deload')
    expect(b.weeks).toBe(5)
    expect(b.volume.find((v) => v.muscle === 'delt_side')).toMatchObject({ sets: 8.8, status: 'below' }) // (8 + 8 + 12 + 10 + 6) / 5; el deload no entra
    expect(b.doneSets).toBe(47) // el deload sí cuenta en el total de series hechas
    expect(b.plannedSessions).toBeNull()
  })
  it('si el bloque no terminó, hasta hoy', () => {
    const parcial = blockSummary(base({ sessions }), meso, '2026-11-05')
    expect(parcial.to).toBe('2026-11-05')
    expect(parcial.sessions).toHaveLength(3)
  })
  it('un bloque con una pausa se corre: el final cuenta la semana sin sesiones', () => {
    // falta la semana del 26/10: el deload pasa al 30/11 y el bloque termina el 06/12
    const conPausa = [sess('2026-10-20', [lat(8)]), sess('2026-11-03', [lat(8)]), sess('2026-11-10', [lat(8)]), sess('2026-11-17', [lat(8)]), sess('2026-11-24', [lat(8)]), sess('2026-12-01', [lat(3)], { deload: true })]
    expect(blockSummary(base({ sessions: conPausa }), meso, '2026-12-20').to).toBe('2026-12-06')
  })
  it('peso del bloque: el último y el cambio desde el primero, sin pesos de otros bloques', () => {
    const bw = [{ date: '2026-10-20', kg: 84 }, { date: '2026-11-03', kg: 83.2 }, { date: '2026-11-24', kg: 82.4 }, { date: '2026-12-02', kg: 80 }]
    expect(blockSummary(base({ sessions, bodyweights: bw }), meso, '2026-12-20').weight).toEqual({ kg: 82.4, change: -1.6 })
    expect(blockSummary(base({ sessions, bodyweights: [{ date: '2026-11-03', kg: 83.2 }] }), meso, '2026-12-20').weight).toEqual({ kg: 83.2, change: null })
  })
})

describe('el resumen como texto', () => {
  it('trae el título, las sesiones, el volumen y lo que haya', () => {
    const ss = [sess('2026-11-09', [item(PRESS, [W(25, 10, 0), W(25, 10, 0)]), item('rdl_barbell', [W(60, 8, 0)])]), sess('2026-11-11', [item(LAT, many(4))])]
    const zoneIssues: ZoneIssue[] = [{ id: 'z', zone: 'neck', severity: 'molestia', startedOn: '2026-11-10' }]
    const t = summaryText(weekSummary(base({ sessions: ss, zoneIssues, bodyweights: [{ date: '2026-11-10', kg: 82.4 }] }), '2026-11-09'), exercises)
    expect(t.split('\n')[0]).toBe('Semana del 09/11 al 15/11')
    expect(t).toContain('Sesiones: 2 de 2 · 7 series efectivas')
    expect(t).toContain('- 09/11 Lunes: Torso: 3 series')
    expect(t).toContain('Series por músculo (objetivo):')
    expect(t).toContain('- Deltoide lateral: 4 (10-20) por debajo')
    expect(t).toContain('RIR cargado en 2 de 3 ejercicios')
    expect(t).toContain('Sesiones con compuestos al fallo: 1')
    expect(t).toContain('Molestia: Cuello (molestia) desde 10/11')
    expect(t).toContain('Peso: 82,4 kg')
    expect(t).not.toContain('PRs:') // sin PRs, la línea no está
  })
  it('el bloque dice "Bloque", la fase y promedia; sin pesos ni molestias no agrega esas líneas', () => {
    const t = summaryText(blockSummary(base({ sessions: [sess('2026-10-20', [item(LAT, many(8))])], mesocycles: [{ ...meso, phase: 'cut' }] }), { ...meso, phase: 'cut' }, '2026-11-05'), exercises)
    expect(t.split('\n')[0]).toBe('Bloque del 19/10 al 05/11 · Cut')
    expect(t).toContain('Series por semana, promedio (objetivo):')
    expect(t).not.toContain('Peso:')
    expect(t).not.toContain('Molestia:')
  })
})
