import { addDays, daysBetween, weekStart, type ISODate } from './dates'
import { comparableKg } from './load'
import { exposuresOf } from './history'
import { findPRs, type PR } from './prs'
import { trendOf, type Trend } from './stagnation'
import type { Exercise, Mesocycle, Muscle, PlanDay, Session, Settings } from './types'
import { volumeByMuscle } from './volume'

// ---------- Semanas ----------

export interface MesoWeek { week: number; total: number; isDeload: boolean; pausedWeeks?: number }

const weekIndex = (meso: Mesocycle, d: ISODate) => Math.floor(daysBetween(weekStart(meso.startDate), weekStart(d)) / 7) + 1
const pausedBefore = (paused: ISODate[], monday: ISODate) => paused.filter((p) => p < monday).length

/**
 * Semanas pasadas del mesociclo sin ninguna sesión terminada (D-50): no cuentan, el mesociclo se corre.
 * Solo mira semanas ya cerradas (la actual no) y deja de contar cuando el mesociclo ya habría terminado.
 */
export function pausedWeeks(meso: Mesocycle, sessions: Pick<Session, 'date' | 'status'>[], today: ISODate): ISODate[] {
  const withSession = new Set(sessions.filter((s) => s.status === 'finished').map((s) => weekStart(s.date)))
  const current = weekStart(today)
  const out: ISODate[] = []
  let active = 0
  let activeDeload = 0
  for (let w = weekStart(meso.startDate); w < current; w = addDays(w, 7)) {
    const inDeload = meso.deloadFrom ? w >= meso.deloadFrom : active >= meso.accumulationWeeks
    if (inDeload && activeDeload >= meso.deloadWeeks) break
    if (withSession.has(w)) {
      if (inDeload) activeDeload++
      else active++
    } else out.push(w)
  }
  return out
}

/** Semana N de M del mesociclo (sin contar las pausadas); null si la fecha cae fuera. */
export function mesocycleWeek(meso: Mesocycle, date: ISODate, paused: ISODate[] = []): MesoWeek | null {
  if (daysBetween(weekStart(meso.startDate), weekStart(date)) < 0) return null
  const before = pausedBefore(paused, weekStart(date))
  const week = weekIndex(meso, date) - before
  const deloadWeek = meso.deloadFrom
    ? weekIndex(meso, meso.deloadFrom) - pausedBefore(paused, weekStart(meso.deloadFrom))
    : meso.accumulationWeeks + 1
  const total = deloadWeek - 1 + meso.deloadWeeks
  if (week > Math.max(total, deloadWeek - 1)) return null
  return { week, total, isDeload: week >= deloadWeek, ...(before > 0 ? { pausedWeeks: before } : {}) }
}

/** Lunes en que empieza el deload (corrido por las semanas pausadas). */
export function deloadStart(meso: Mesocycle, paused: ISODate[] = []): ISODate {
  if (meso.deloadFrom) return meso.deloadFrom
  let d = addDays(weekStart(meso.startDate), meso.accumulationWeeks * 7)
  for (const p of [...paused].sort()) if (p <= d) d = addDays(d, 7)
  return d
}

/** Lunes siguiente al final del mesociclo. */
export function mesocycleEnd(meso: Mesocycle, paused: ISODate[] = []): ISODate {
  const ds = deloadStart(meso, paused)
  let end = addDays(ds, meso.deloadWeeks * 7)
  for (const p of [...paused].sort()) if (p >= ds && p < end) end = addDays(end, 7)
  return end
}

// ---------- Deload (§8) ----------

/** Series en deload: la mitad, mínimo 2 (sin superar lo planificado). */
export function deloadSets(planned: number): number {
  return Math.min(planned, Math.max(2, Math.ceil(planned / 2)))
}

/** Carga de deload: −10 % de la carga comparable, redondeado al incremento, en la unidad del ejercicio. */
export function deloadWeight(ex: Pick<Exercise, 'unit' | 'barKg' | 'sledKg' | 'increment'>, weight: number | null, kgPerBrick: number): number | null {
  if (weight == null) return null
  const kg = comparableKg(ex, weight, kgPerBrick)
  if (kg == null) return weight
  const target = kg * 0.9
  let w: number
  if (ex.unit === 'per_side') w = (target - (ex.barKg ?? ex.sledKg ?? 0)) / 2
  else if (ex.unit === 'bricks') w = target / kgPerBrick
  else w = target
  const rounded = Math.round(w / ex.increment) * ex.increment
  // Si el redondeo no baja nada, bajar un incremento.
  return Math.max(0, rounded >= weight ? weight - ex.increment : rounded)
}

/** Lunes de la semana en curso como inicio de un deload adelantado. */
export function startDeloadNow(meso: Mesocycle, today: ISODate): Mesocycle {
  return { ...meso, deloadFrom: weekStart(today) }
}

// ---------- Deload sugerido ----------

export type DeloadReason = 'stagnation' | 'readiness' | 'burned_out'
export interface DeloadSuggestion { reasons: DeloadReason[]; stagnantShare: number; readinessAvg: number | null; stalled: string[] }

/** Promedio de (sueño + energía) / 2 de las últimas `n` sesiones con readiness; null si hay menos. */
export function readinessAverage(sessions: Session[], n = 3): number | null {
  const withR = sessions.filter((s) => s.readiness).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n)
  if (withR.length < n) return null
  return withR.reduce((a, s) => a + (s.readiness!.sleep + s.readiness!.energy) / 2, 0) / n
}

/**
 * (a) ≥40 % de los ejercicios del plan estancados o en baja (D-05);
 * (b) readiness promedio ≤ 2,5 en las últimas 3 sesiones; (c) "me siento quemado".
 * Solo cuenta ejercicios con tendencia evaluable (≥ suficientes datos).
 */
export function deloadSuggestion(
  planExerciseIds: string[],
  exercises: Map<string, Exercise>,
  sessions: Session[],
  kgPerBrick: number,
  burnedOut = false,
): DeloadSuggestion {
  const ids = [...new Set(planExerciseIds)].filter((id) => exercises.get(id) && !exercises.get(id)!.cardio)
  const trends: [string, Trend][] = ids.map((id) => [id, trendOf(exercises.get(id)!, exposuresOf(sessions, id), kgPerBrick).trend])
  const stalled = trends.filter(([, t]) => t === 'stagnant' || t === 'regressing').map(([id]) => id)
  const stagnantShare = ids.length ? stalled.length / ids.length : 0
  const readinessAvg = readinessAverage(sessions)
  const reasons: DeloadReason[] = []
  if (ids.length && stagnantShare >= 0.4) reasons.push('stagnation')
  if (readinessAvg != null && readinessAvg <= 2.5) reasons.push('readiness')
  if (burnedOut) reasons.push('burned_out')
  return { reasons, stagnantShare, readinessAvg, stalled }
}

// ---------- Volumen semanal (§7) ----------

export type VolumeStatus = 'below' | 'in' | 'above'
export function volumeStatus(v: number, [lo, hi]: [number, number]): VolumeStatus {
  return v < lo ? 'below' : v > hi ? 'above' : 'in'
}

export function weekVolume(sessions: Session[], monday: ISODate, exercises: Map<string, Exercise>) {
  const items = sessions.filter((s) => weekStart(s.date) === monday).flatMap((s) => s.items)
  return volumeByMuscle(items, exercises)
}

// ---------- Revisión de fin de mesociclo ----------

export type Proposal =
  | { kind: 'rotate'; planDayId: string; exerciseId: string; to: string; reason: string; optional?: boolean }
  | { kind: 'sets'; planDayId: string; exerciseId: string; from: number; to: number; muscle: Muscle; reason: string }

export interface MesoReview {
  prs: (PR & { exerciseId: string; date: ISODate })[]
  volume: { muscle: Muscle; avg: number; target: [number, number]; status: VolumeStatus }[]
  stalled: string[]
  proposals: Proposal[]
}

export function reviewMesocycle(
  meso: Mesocycle,
  allSessions: Session[],
  exercises: Map<string, Exercise>,
  planDays: PlanDay[],
  settings: Pick<Settings, 'kgPerBrick' | 'volumeTarget'>,
  paused: ISODate[] = [],
): MesoReview {
  const K = settings.kgPerBrick
  const start = weekStart(meso.startDate)
  const dStart = deloadStart(meso, paused)
  const inMeso = allSessions.filter((s) => s.status === 'finished' && s.date >= start && s.date < mesocycleEnd(meso, paused))
  const accum = inMeso.filter((s) => s.date < dStart && !s.deload)

  // PRs dentro del mesociclo (contra todo lo anterior)
  const prs: MesoReview['prs'] = []
  const exIds = [...new Set(inMeso.flatMap((s) => s.exerciseIds))]
  for (const id of exIds) {
    const ex = exercises.get(id)
    if (!ex) continue
    const all = exposuresOf(allSessions.filter((s) => s.status === 'finished'), id)
    all.forEach((e, i) => {
      if (e.date < start || e.date >= mesocycleEnd(meso, paused)) return
      for (const pr of findPRs(ex, e, all.slice(0, i), K)) prs.push({ ...pr, exerciseId: id, date: e.date })
    })
  }

  // Volumen semanal promedio en acumulación (semanas con al menos una sesión)
  const weeks = [...new Set(accum.map((s) => weekStart(s.date)))]
  const totals = new Map<Muscle, number>()
  for (const w of weeks) {
    const v = weekVolume(accum, w, exercises)
    for (const [m, x] of Object.entries(v) as [Muscle, { total: number }][]) totals.set(m, (totals.get(m) ?? 0) + x.total)
  }
  const muscles = Object.keys(settings.volumeTarget) as Muscle[]
  const volume = muscles.map((m) => {
    const avg = weeks.length ? (totals.get(m) ?? 0) / weeks.length : 0
    const target = settings.volumeTarget[m]
    return { muscle: m, avg: Math.round(avg * 10) / 10, target, status: volumeStatus(avg, target) }
  })

  // Estancados al cierre
  const planIds = [...new Set(planDays.flatMap((d) => d.items.map((i) => i.exerciseId)))]
  const stalled = planIds.filter((id) => {
    const ex = exercises.get(id)
    if (!ex || ex.cardio) return false
    const t = trendOf(ex, exposuresOf(allSessions.filter((s) => s.status === 'finished' && s.date < mesocycleEnd(meso, paused)), id), K).trend
    return t === 'stagnant' || t === 'regressing'
  })

  // Propuestas
  const proposals: Proposal[] = []
  for (const day of planDays) {
    for (const it of day.items) {
      if (!stalled.includes(it.exerciseId) || !it.alt.length) continue
      const ex = exercises.get(it.exerciseId)!
      const to = it.alt.find((a) => exercises.get(a)?.family === ex.family && !exercises.get(a)?.archived)
      if (to) proposals.push({ kind: 'rotate', planDayId: day.id, exerciseId: it.exerciseId, to, reason: 'estancado: rotar variante' })
    }
  }
  // Rotación opcional (§6.5): el resto de los ejercicios con alternativa de la misma familia. Destildada por defecto.
  for (const day of planDays) {
    for (const it of day.items) {
      if (stalled.includes(it.exerciseId) || it.optional) continue
      const ex = exercises.get(it.exerciseId)
      const to = ex && it.alt.find((a) => exercises.get(a)?.family === ex.family && !exercises.get(a)?.archived)
      if (to) proposals.push({ kind: 'rotate', planDayId: day.id, exerciseId: it.exerciseId, to, reason: 'rotación opcional de variante', optional: true })
    }
  }
  if (weeks.length) {
    for (const v of volume) {
      if (v.status === 'in') continue
      // ejercicio del plan con este músculo como primario
      const cands = planDays.flatMap((d) => d.items.filter((i) => !i.optional && exercises.get(i.exerciseId)?.primary.includes(v.muscle)).map((i) => ({ d, i })))
      if (!cands.length) continue
      if (v.status === 'below') {
        const c = cands.reduce((a, b) => (b.i.sets < a.i.sets ? b : a))
        if (c.i.sets < 6) proposals.push({ kind: 'sets', planDayId: c.d.id, exerciseId: c.i.exerciseId, from: c.i.sets, to: c.i.sets + 1, muscle: v.muscle, reason: `${v.avg} series/semana, por debajo de ${v.target[0]}` })
      } else {
        const c = cands.reduce((a, b) => (b.i.sets > a.i.sets ? b : a))
        if (c.i.sets > 2) proposals.push({ kind: 'sets', planDayId: c.d.id, exerciseId: c.i.exerciseId, from: c.i.sets, to: c.i.sets - 1, muscle: v.muscle, reason: `${v.avg} series/semana, por encima de ${v.target[1]}` })
      }
    }
  }
  return { prs, volume, stalled, proposals }
}

/** Aplica propuestas aceptadas al plan (puro). En una rotación, la variante vieja pasa a alternativa. */
export function applyProposals(planDays: PlanDay[], accepted: Proposal[]): PlanDay[] {
  return planDays.map((d) => ({
    ...d,
    items: d.items.map((it) => {
      let out = it
      for (const p of accepted) {
        if (p.planDayId !== d.id || p.exerciseId !== it.exerciseId) continue
        if (p.kind === 'sets') out = { ...out, sets: p.to }
        else out = { ...out, exerciseId: p.to, alt: [it.exerciseId, ...out.alt.filter((a) => a !== p.to)] }
      }
      return out
    }),
  }))
}

/** Inicio del próximo mesociclo: el lunes siguiente al final, o el lunes de esta semana si ya pasó. */
export function nextMesocycleStart(meso: Mesocycle, today: ISODate, paused: ISODate[] = []): ISODate {
  const end = mesocycleEnd(meso, paused)
  return today < end ? end : weekStart(today)
}
