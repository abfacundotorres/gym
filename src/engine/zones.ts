import type { ISODate } from './dates'
import { promoteVariant } from './nextBlock'
import type { Exercise, Muscle, PainLevel, PlanAdjustment, PlanDay, Zone, ZoneIssue } from './types'
import { ZONES } from './types'

/**
 * Qué músculos cargan cada zona (D-76). Es una aproximación mía: el catálogo no tiene cuello, trapecio ni antebrazo, así que
 * el cuello se asocia a espalda alta y deltoides, y la muñeca no se deduce de nada (se asigna a mano en cada ejercicio).
 */
export const ZONE_MUSCLES: Record<Zone, Muscle[]> = {
  neck: ['upper_back', 'delt_side', 'delt_rear'],
  shoulder: ['chest', 'delt_front', 'delt_side', 'delt_rear', 'lats'],
  elbow: ['biceps', 'triceps'],
  wrist: [],
  upper_back: ['upper_back', 'delt_rear'],
  lower_back: ['lower_back'],
  hip: ['glutes'],
  knee: ['quads'],
  ankle: ['calves'],
}

export type ZoneLoad = 'high' | 'medium'
const rank = (l: ZoneLoad | null): number => (l === 'high' ? 2 : l === 'medium' ? 1 : 0)

/**
 * Cuánto carga un ejercicio una zona: mucho si la zona tiene un músculo primario suyo, algo si es secundario. Si las zonas del
 * ejercicio se corrigieron a mano (`zones`), manda esa lista y cuenta como mucho. El cardio no se deduce.
 */
export function zoneLoad(ex: Pick<Exercise, 'primary' | 'secondary' | 'zones' | 'cardio'>, zone: Zone): ZoneLoad | null {
  if (ex.zones) return ex.zones.includes(zone) ? 'high' : null
  if (ex.cardio) return null
  const muscles = ZONE_MUSCLES[zone]
  if (ex.primary.some((m) => muscles.includes(m))) return 'high'
  if (ex.secondary.some((m) => muscles.includes(m))) return 'medium'
  return null
}

/** Zonas que carga un ejercicio (las corregidas a mano o las deducidas), en el orden de ZONES. */
export function exerciseZones(ex: Pick<Exercise, 'primary' | 'secondary' | 'zones' | 'cardio'>): Zone[] {
  return ZONES.filter((z) => zoneLoad(ex, z) != null)
}

export const isActive = (i: Pick<ZoneIssue, 'resolvedOn'>): boolean => !i.resolvedOn

export interface ActiveZone { zone: Zone; severity: PainLevel; since: ISODate }

/** Zonas con alguna molestia activa: la intensidad mayor y la fecha más vieja de cada una. Dolor primero, después las más viejas. */
export function activeZones(issues: Pick<ZoneIssue, 'zone' | 'severity' | 'startedOn' | 'resolvedOn'>[]): ActiveZone[] {
  const by = new Map<Zone, ActiveZone>()
  for (const i of issues) {
    if (!isActive(i)) continue
    const cur = by.get(i.zone)
    if (!cur) by.set(i.zone, { zone: i.zone, severity: i.severity, since: i.startedOn })
    else {
      if (i.severity === 'dolor') cur.severity = 'dolor'
      if (i.startedOn < cur.since) cur.since = i.startedOn
    }
  }
  return [...by.values()].sort((a, b) => (a.severity === b.severity ? (a.since < b.since ? -1 : a.since > b.since ? 1 : 0) : a.severity === 'dolor' ? -1 : 1))
}

/** De los ejercicios de la sesión, los que cargan la zona (sin salteados ni desconocidos): primero los que la cargan mucho, y después en el orden de la sesión. */
export function loadingItems<T extends { exerciseId: string; skipped?: boolean }>(items: T[], exercises: Map<string, Exercise>, zone: Zone): { item: T; load: ZoneLoad }[] {
  const out: { item: T; load: ZoneLoad }[] = []
  for (const item of items) {
    const ex = exercises.get(item.exerciseId)
    const load = ex && !item.skipped ? zoneLoad(ex, zone) : null
    if (load) out.push({ item, load })
  }
  return out.sort((a, b) => rank(b.load) - rank(a.load))
}

/**
 * Variantes de la misma familia que cargan menos una zona que `ex`. Primero las que están entre las opciones del plan (`planOrder`),
 * después las que la cargan menos, y por nombre. Sin archivadas ni la actual.
 */
export function lighterVariants(
  ex: Pick<Exercise, 'id' | 'family' | 'primary' | 'secondary' | 'zones' | 'cardio'>,
  zone: Zone,
  family: Exercise[],
  planOrder: string[] = [],
): { exercise: Exercise; load: ZoneLoad | null }[] {
  const current = rank(zoneLoad(ex, zone))
  const order = (id: string) => { const i = planOrder.indexOf(id); return i === -1 ? 99 : i }
  return family
    .filter((c) => c.id !== ex.id && c.family === ex.family && !c.archived && rank(zoneLoad(c, zone)) < current)
    .map((c) => ({ exercise: c, load: zoneLoad(c, zone) }))
    .sort((a, b) => order(a.exercise.id) - order(b.exercise.id) || rank(a.load) - rank(b.load) || a.exercise.name.localeCompare(b.exercise.name))
}

// ---------- Propuestas al plan (D-77) ----------

export interface ZoneProposal {
  zone: Zone
  adjustment: PlanAdjustment
  /** Ejercicio del plan sobre el que se propone (el titular de hoy). */
  exerciseId: string
  load: ZoneLoad
}

/**
 * Cambios al plan para cuidar las zonas con molestia activa. Por cada ejercicio del plan que carga la zona: si hay una variante de
 * su familia que la carga menos, pasar a esa (la de las opciones del plan primero); si no y la carga mucho, una serie menos (nunca
 * por debajo de 2). Si la carga solo algo y no hay variante, no se propone nada (alcanza con el aviso). Un ejercicio tiene a lo sumo
 * una propuesta por día del plan (la de la zona más urgente: dolor primero) y no se vuelve a proponer una serie menos donde ya se aplicó una.
 */
export function zoneProposals(planDays: PlanDay[], exercises: Map<string, Exercise>, active: ActiveZone[], applied: PlanAdjustment[] = []): ZoneProposal[] {
  const family = [...exercises.values()]
  const out: ZoneProposal[] = []
  for (const day of planDays) {
    for (const item of day.items) {
      const ex = exercises.get(item.exerciseId)
      if (!ex) continue
      for (const z of active) {
        const load = zoneLoad(ex, z.zone)
        if (!load) continue
        const lighter = lighterVariants(ex, z.zone, family, [item.exerciseId, ...item.alt])[0]
        if (lighter) {
          out.push({ zone: z.zone, exerciseId: item.exerciseId, load, adjustment: { kind: 'swap', planDayId: day.id, from: item.exerciseId, to: lighter.exercise.id } })
        } else if (load === 'high' && item.sets > 2 && !applied.some((a) => a.kind === 'sets' && a.planDayId === day.id && a.exerciseId === item.exerciseId)) {
          out.push({ zone: z.zone, exerciseId: item.exerciseId, load, adjustment: { kind: 'sets', planDayId: day.id, exerciseId: item.exerciseId, from: item.sets, to: item.sets - 1 } })
        } else continue
        break // una propuesta por ejercicio y día: la de la zona más urgente
      }
    }
  }
  return out
}

const mapDays = (planDays: PlanDay[], dayId: string, f: (items: PlanDay['items']) => PlanDay['items']): PlanDay[] =>
  planDays.map((d) => (d.id === dayId ? { ...d, items: f(d.items) } : d))

/** Aplica los cambios al plan (puro). Un cambio cuyo ejercicio ya no está como se esperaba no hace nada. */
export function applyAdjustments(planDays: PlanDay[], adjustments: PlanAdjustment[]): PlanDay[] {
  let out = planDays
  for (const a of adjustments) {
    out = mapDays(out, a.planDayId, (items) =>
      items.map((it) => {
        if (a.kind === 'swap') return it.exerciseId === a.from ? promoteVariant(it, a.to) : it
        return it.exerciseId === a.exerciseId && it.sets === a.from ? { ...it, sets: a.to } : it
      }),
    )
  }
  return out
}

/**
 * Deshace los cambios, del último al primero. Solo si el plan sigue como lo dejó el cambio: una variante que ya no es la titular,
 * o unas series que cambiaste después, no se tocan (lo que editaste vos manda).
 */
export function revertAdjustments(planDays: PlanDay[], adjustments: PlanAdjustment[]): PlanDay[] {
  let out = planDays
  for (const a of [...adjustments].reverse()) {
    out = mapDays(out, a.planDayId, (items) =>
      items.map((it) => {
        if (a.kind === 'swap') return it.exerciseId === a.to && it.alt.includes(a.from) ? promoteVariant(it, a.from) : it
        return it.exerciseId === a.exerciseId && it.sets === a.to ? { ...it, sets: a.from } : it
      }),
    )
  }
  return out
}

/** De los cambios, los que de verdad modifican el plan (aplicados en orden): un cambio viejo sobre algo que ya cambió no cuenta ni se anota. */
export function effectiveAdjustments(planDays: PlanDay[], adjustments: PlanAdjustment[]): PlanAdjustment[] {
  const out: PlanAdjustment[] = []
  let cur = planDays
  for (const a of adjustments) {
    const next = applyAdjustments(cur, [a])
    if (JSON.stringify(next.find((d) => d.id === a.planDayId)) !== JSON.stringify(cur.find((d) => d.id === a.planDayId))) out.push(a)
    cur = next
  }
  return out
}
