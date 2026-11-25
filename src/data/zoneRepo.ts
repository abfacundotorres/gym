import type { ISODate } from '../engine/dates'
import type { PainLevel, PlanAdjustment, PlanDay, Zone, ZoneIssue } from '../engine/types'
import { applyAdjustments, effectiveAdjustments, revertAdjustments } from '../engine/zones'
import type { GymDB } from './db'

const newId = () => `zi-${crypto.randomUUID().slice(0, 8)}`

export interface ZoneInput {
  zone: Zone
  severity: PainLevel
  startedOn: ISODate
  note?: string
  exerciseId?: string
  sessionId?: string
}

/**
 * Anota una molestia de zona (D-76). Si esa zona ya tiene una activa no se duplica: se conserva la más vieja y la intensidad pasa a
 * dolor si alguna lo fue (nunca baja sola). Devuelve la molestia activa de la zona.
 */
export async function markZone(db: GymDB, input: ZoneInput): Promise<ZoneIssue> {
  return db.transaction('rw', db.zoneIssues, async () => {
    const active = (await db.zoneIssues.where('zone').equals(input.zone).toArray()).filter((i) => !i.resolvedOn)
    if (active.length > 0) {
      const base = active.reduce((a, b) => (b.startedOn < a.startedOn ? b : a))
      const next: ZoneIssue = { ...base, severity: base.severity === 'dolor' || input.severity === 'dolor' ? 'dolor' : 'molestia', startedOn: base.startedOn < input.startedOn ? base.startedOn : input.startedOn }
      await db.zoneIssues.put(next)
      return next
    }
    const issue: ZoneIssue = {
      id: newId(), zone: input.zone, severity: input.severity, startedOn: input.startedOn,
      ...(input.note ? { note: input.note } : {}),
      ...(input.exerciseId ? { exerciseId: input.exerciseId } : {}),
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    }
    await db.zoneIssues.add(issue)
    return issue
  })
}

/** "Ya pasó": cierra las molestias activas de la zona con esa fecha. El registro queda. */
export async function resolveZone(db: GymDB, zone: Zone, on: ISODate): Promise<void> {
  await db.transaction('rw', db.zoneIssues, async () => {
    for (const i of await db.zoneIssues.where('zone').equals(zone).toArray()) {
      if (!i.resolvedOn) await db.zoneIssues.put({ ...i, resolvedOn: on < i.startedOn ? i.startedOn : on })
    }
  })
}

const changedDays = (before: PlanDay[], after: PlanDay[]): PlanDay[] => after.filter((d, i) => JSON.stringify(d) !== JSON.stringify(before[i]))

/**
 * Aplica al plan los cambios propuestos por una zona (D-77) y los anota en su molestia activa, para poder deshacerlos cuando pase.
 * Solo se aplican y se anotan los que todavía modifican el plan. Sin molestia activa en esa zona no hace nada (devuelve false).
 */
export async function applyZoneAdjustments(db: GymDB, zone: Zone, adjustments: PlanAdjustment[]): Promise<boolean> {
  return db.transaction('rw', db.zoneIssues, db.planDays, async () => {
    const issue = (await db.zoneIssues.where('zone').equals(zone).toArray()).find((i) => !i.resolvedOn)
    if (!issue) return false
    const days = await db.planDays.orderBy('weekday').toArray()
    const effective = effectiveAdjustments(days, adjustments)
    if (effective.length === 0) return false
    await db.planDays.bulkPut(changedDays(days, applyAdjustments(days, effective)))
    await db.zoneIssues.put({ ...issue, planChanges: [...(issue.planChanges ?? []), ...effective] })
    return true
  })
}

/** "Volver el plan a como estaba": deshace los cambios de la molestia (solo lo que sigue como lo dejaron) y los borra del registro. */
export async function revertZoneChanges(db: GymDB, issueId: string): Promise<void> {
  await db.transaction('rw', db.zoneIssues, db.planDays, async () => {
    const issue = await db.zoneIssues.get(issueId)
    if (!issue?.planChanges?.length) return
    const days = await db.planDays.orderBy('weekday').toArray()
    await db.planDays.bulkPut(changedDays(days, revertAdjustments(days, issue.planChanges)))
    const { planChanges: _done, ...rest } = issue
    await db.zoneIssues.put(rest)
  })
}

/** "Dejar así": se conserva el plan como quedó y se olvidan los cambios (ya no se ofrece deshacerlos). */
export async function keepZoneChanges(db: GymDB, issueId: string): Promise<void> {
  await db.transaction('rw', db.zoneIssues, async () => {
    const issue = await db.zoneIssues.get(issueId)
    if (!issue?.planChanges) return
    const { planChanges: _kept, ...rest } = issue
    await db.zoneIssues.put(rest)
  })
}
