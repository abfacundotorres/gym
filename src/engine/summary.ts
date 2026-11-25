import { weeklySeries, type Bodyweight } from './bodyweight'
import { addDays, formatDDMM, weekStart, type ISODate } from './dates'
import { exposuresOf } from './history'
import { mesocycleEnd, pausedWeeks, volumeStatus, weekVolume, type VolumeStatus } from './periodization'
import { phaseAt, phaseVolumeTarget, PHASE_LABEL } from './phase'
import { findPRs, type PR } from './prs'
import { DEFAULT_RULES, type Rules } from './rules'
import { failureToday, volumeSpikes, type VolumeSpike } from './risk'
import { rirCoverage, type RirCoverage } from './session'
import type { Exercise, Mesocycle, Muscle, PainLevel, Phase, PlanDay, Session, Settings, Zone, ZoneIssue } from './types'
import { MUSCLE_LABELS, ZONE_LABELS } from './types'
import { effectiveSets } from './volume'
import { num } from './format'

/**
 * Resumen de una semana o de un bloque (D-80): lo que ya se calcula en otras pantallas, junto y copiable. Es descriptivo:
 * no propone nada ni compara con metas más allá de los rangos de series que ya tenés en Ajustes.
 */

export interface SummaryInput {
  sessions: Session[]
  exercises: Map<string, Exercise>
  planDays: PlanDay[]
  mesocycles: Mesocycle[]
  zoneIssues: ZoneIssue[]
  bodyweights: Pick<Bodyweight, 'date' | 'kg'>[]
  settings: Pick<Settings, 'kgPerBrick' | 'volumeTarget'>
  rules?: Rules
}

export interface SessionLine { id: string; date: ISODate; planName: string; sets: number; minutes: number | null; tag?: 'deload' | 'vuelta' }
export interface MuscleLine { muscle: Muscle; sets: number; target: [number, number]; status: VolumeStatus }
export interface ZoneLine { zone: Zone; severity: PainLevel; startedOn: ISODate; resolvedOn?: ISODate }

export interface PeriodSummary {
  kind: 'week' | 'block'
  from: ISODate
  to: ISODate
  phase?: Phase
  /** Semanas con al menos una sesión que no fue de deload (con las que se promedia el volumen del bloque). */
  weeks: number
  sessions: SessionLine[]
  /** Solo en la semana: cuántos días de entrenamiento tiene el plan. */
  plannedSessions: number | null
  doneSets: number
  /** Semana: series de la semana. Bloque: promedio semanal de las semanas con sesiones (sin deload). */
  volume: MuscleLine[]
  prs: (PR & { exerciseId: string; date: ISODate })[]
  rir: RirCoverage
  /** Sesiones con 2 o más compuestos al fallo (o el umbral de las reglas). */
  failureSessions: number
  /** Solo en la semana: saltos de volumen contra el promedio de las semanas anteriores. */
  spikes: VolumeSpike[]
  zones: ZoneLine[]
  weight: { kg: number; change: number | null } | null
}

const round1 = (v: number) => Math.round(v * 10) / 10

function minutesOf(s: Session): number | null {
  return s.startedAt != null && s.finishedAt != null && s.finishedAt > s.startedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : null
}

function build(input: SummaryInput, kind: 'week' | 'block', from: ISODate, to: ISODate, phase: Phase | undefined): PeriodSummary {
  const rules = input.rules ?? DEFAULT_RULES
  const finished = input.sessions.filter((s) => s.status === 'finished')
  const inRange = finished.filter((s) => s.date >= from && s.date <= to).sort((a, b) => (a.date === b.date ? (a.startedAt ?? 0) - (b.startedAt ?? 0) : a.date < b.date ? -1 : 1))
  const planName = (id: string) => input.planDays.find((d) => d.id === id)?.name ?? id
  const sessions: SessionLine[] = inRange.map((s) => ({
    id: s.id,
    date: s.date,
    planName: planName(s.planDayId),
    sets: s.items.reduce((a, it) => a + effectiveSets(it), 0),
    minutes: minutesOf(s),
    ...(s.deload ? { tag: 'deload' as const } : s.comebackDays != null ? { tag: 'vuelta' as const } : {}),
  }))

  // Volumen por músculo: la semana tal cual; el bloque, el promedio semanal de las semanas con sesiones (sin deload).
  const accum = inRange.filter((s) => !s.deload)
  const weeks = [...new Set(accum.map((s) => weekStart(s.date)))]
  const totals = new Map<Muscle, number>()
  for (const m of weeks) for (const [mu, v] of Object.entries(weekVolume(accum, m, input.exercises)) as [Muscle, { total: number }][]) totals.set(mu, (totals.get(mu) ?? 0) + v.total)
  const weekTotals = kind === 'week' ? new Map(Object.entries(weekVolume(inRange, from, input.exercises)).map(([mu, v]) => [mu as Muscle, v!.total])) : null
  const volume: MuscleLine[] = (Object.keys(input.settings.volumeTarget) as Muscle[]).map((muscle) => {
    const raw = kind === 'week' ? (weekTotals!.get(muscle) ?? 0) : weeks.length ? (totals.get(muscle) ?? 0) / weeks.length : 0
    const target = phaseVolumeTarget(input.settings.volumeTarget[muscle], phase)
    return { muscle, sets: round1(raw), target, status: volumeStatus(raw, target) }
  })

  // PRs del período, contra todo lo anterior (igual que la revisión del mesociclo).
  const prs: PeriodSummary['prs'] = []
  for (const id of [...new Set(inRange.flatMap((s) => s.exerciseIds))]) {
    const ex = input.exercises.get(id)
    if (!ex) continue
    const all = exposuresOf(finished, id)
    all.forEach((e, i) => {
      if (e.date < from || e.date > to) return
      for (const pr of findPRs(ex, e, all.slice(0, i), input.settings.kgPerBrick)) prs.push({ ...pr, exerciseId: id, date: e.date })
    })
  }

  // RIR y avisos.
  let withRir = 0
  let total = 0
  for (const s of inRange) {
    const c = rirCoverage(s, input.exercises)
    withRir += c.withRir
    total += c.total
  }
  const failureSessions = inRange.filter((s) => failureToday(s, input.exercises).length >= rules.failureSessionMin).length
  const last = inRange.at(-1)
  const spikes = kind === 'week' && last ? volumeSpikes(finished, last, input.exercises, rules) : []

  const zones: ZoneLine[] = input.zoneIssues
    .filter((z) => z.startedOn <= to && (!z.resolvedOn || z.resolvedOn >= from))
    .sort((a, b) => (a.startedOn < b.startedOn ? -1 : a.startedOn > b.startedOn ? 1 : 0))
    .map((z) => ({ zone: z.zone, severity: z.severity, startedOn: z.startedOn, ...(z.resolvedOn ? { resolvedOn: z.resolvedOn } : {}) }))

  // Peso: el de la semana (o la última del bloque) y cuánto cambió.
  const series = weeklySeries(input.bodyweights)
  let weight: PeriodSummary['weight'] = null
  if (kind === 'week') {
    const now = series.find((p) => p.monday === from)
    const before = series.filter((p) => p.monday < from).at(-1)
    if (now) weight = { kg: now.kg, change: before ? round1(now.kg - before.kg) : null }
  } else {
    const pts = series.filter((p) => p.monday >= weekStart(from) && p.monday <= to)
    if (pts.length) weight = { kg: pts.at(-1)!.kg, change: pts.length > 1 ? round1(pts.at(-1)!.kg - pts[0]!.kg) : null }
  }

  return {
    kind, from, to, ...(phase ? { phase } : {}), weeks: weeks.length, sessions,
    plannedSessions: kind === 'week' ? input.planDays.length : null,
    doneSets: round1(sessions.reduce((a, s) => a + s.sets, 0)),
    volume, prs, rir: { withRir, total }, failureSessions, spikes, zones, weight,
  }
}

/** Resumen de la semana que empieza el lunes `monday`. */
export function weekSummary(input: SummaryInput, monday: ISODate): PeriodSummary {
  return build(input, 'week', monday, addDays(monday, 6), phaseAt(input.mesocycles, monday))
}

/** Resumen de un bloque: desde su primera semana hasta su final (o hasta hoy, si todavía no terminó). */
export function blockSummary(input: SummaryInput, meso: Mesocycle, today: ISODate): PeriodSummary {
  const paused = pausedWeeks(meso, input.sessions, today, input.rules ?? DEFAULT_RULES)
  const end = addDays(mesocycleEnd(meso, paused), -1)
  return build(input, 'block', weekStart(meso.startDate), end < today ? end : today, meso.phase)
}

const STATUS_TEXT: Record<VolumeStatus, string> = { below: 'por debajo', in: 'en rango', above: 'por encima' }

/** El resumen como texto para pegar en un chat o una nota. */
export function summaryText(p: PeriodSummary, exercises: Map<string, Exercise>): string {
  const L: string[] = []
  const phase = p.phase ? ` · ${PHASE_LABEL[p.phase]}` : ''
  L.push(`${p.kind === 'week' ? 'Semana' : 'Bloque'} del ${formatDDMM(p.from)} al ${formatDDMM(p.to)}${phase}`)
  L.push(`Sesiones: ${p.sessions.length}${p.plannedSessions != null ? ` de ${p.plannedSessions}` : ''} · ${num(p.doneSets)} series efectivas`)
  for (const s of p.sessions) L.push(`- ${formatDDMM(s.date)} ${s.planName}: ${num(s.sets)} series${s.minutes != null ? ` · ${s.minutes} min` : ''}${s.tag ? ` (${s.tag})` : ''}`)
  const vol = p.volume.filter((v) => v.sets > 0 || p.kind === 'week')
  if (vol.length) {
    L.push(p.kind === 'week' ? 'Series por músculo (objetivo):' : 'Series por semana, promedio (objetivo):')
    for (const v of vol) L.push(`- ${MUSCLE_LABELS[v.muscle]}: ${num(v.sets)} (${num(v.target[0])}-${num(v.target[1])}) ${STATUS_TEXT[v.status]}`)
  }
  if (p.prs.length) L.push(`PRs: ${p.prs.map((r) => `${formatDDMM(r.date)} ${exercises.get(r.exerciseId)?.name ?? r.exerciseId}`).join('; ')}`)
  if (p.rir.total) L.push(`RIR cargado en ${p.rir.withRir} de ${p.rir.total} ejercicios`)
  if (p.failureSessions) L.push(`Sesiones con compuestos al fallo: ${p.failureSessions}`)
  for (const s of p.spikes) L.push(`Salto de volumen: ${MUSCLE_LABELS[s.muscle]} ${num(s.sets)} series (+${s.pct} % sobre ${num(s.baseline)})`)
  for (const z of p.zones) L.push(`Molestia: ${ZONE_LABELS[z.zone]} (${z.severity}) desde ${formatDDMM(z.startedOn)}${z.resolvedOn ? `, pasó el ${formatDDMM(z.resolvedOn)}` : ''}`)
  if (p.weight) L.push(`Peso: ${num(p.weight.kg)} kg${p.weight.change != null ? ` (${p.weight.change > 0 ? '+' : ''}${num(p.weight.change)})` : ''}`)
  return L.join('\n')
}
