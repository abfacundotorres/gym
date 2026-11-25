import type { ISODate } from '../engine/dates'
import type { PainLevel, Zone, ZoneIssue } from '../engine/types'
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
