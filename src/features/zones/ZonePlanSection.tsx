import { useLiveQuery } from 'dexie-react-hooks'
import { getDB } from '../../data/db'
import { applyZoneAdjustments, keepZoneChanges, revertZoneChanges } from '../../data/zoneRepo'
import { formatDDMM } from '../../engine/dates'
import { ZONE_LABELS, type Exercise, type PlanAdjustment, type PlanDay } from '../../engine/types'
import { activeZones, isActive, zoneProposals, type ZoneProposal } from '../../engine/zones'
import { Button, Card } from '../../ui/Button'

/**
 * Propuestas para el plan con una molestia activa (D-77): variante que carga menos la zona o una serie menos, que se aplican con un toque,
 * y cuando la molestia pasa, "volver el plan a como estaba". Solo aparece si hay una molestia activa o cambios pendientes de deshacer.
 */
export function ZonePlanSection({ planDays, exercises }: { planDays: PlanDay[]; exercises: Map<string, Exercise> }) {
  const db = getDB()
  const issues = useLiveQuery(() => db.zoneIssues.toArray()) ?? []
  const active = activeZones(issues)
  const applied = issues.filter(isActive).flatMap((i) => i.planChanges ?? [])
  const proposals = zoneProposals(planDays, exercises, active, applied)
  const pending = issues.filter((i) => i.resolvedOn && i.planChanges?.length)
  if (active.length === 0 && pending.length === 0) return null

  const name = (id: string) => exercises.get(id)?.name ?? id
  const dayName = (id: string) => planDays.find((d) => d.id === id)?.name ?? id
  const text = (a: PlanAdjustment) => (a.kind === 'swap' ? `${name(a.from)} → ${name(a.to)}` : `${name(a.exerciseId)}: ${a.from} → ${a.to} series`)

  return (
    <div className="space-y-2">
      <h2 className="eyebrow text-slate-400">Molestias</h2>
      {active.map((z) => {
        const mine = proposals.filter((p: ZoneProposal) => p.zone === z.zone)
        const done = issues.find((i) => i.zone === z.zone && isActive(i))?.planChanges ?? []
        return (
          <section key={z.zone} aria-label={`Molestia: ${ZONE_LABELS[z.zone]}`}>
          <Card className="space-y-3">
            <p className="font-medium">
              {ZONE_LABELS[z.zone]} <span className="font-normal text-slate-400">· {z.severity} · desde {formatDDMM(z.since)}</span>
            </p>
            {mine.length > 0 ? (
              <>
                <p className="text-sm text-slate-300">Propuestas para el plan, mientras dure:</p>
                <ul className="space-y-2">
                  {mine.map((p) => (
                    <li key={`${p.adjustment.planDayId}-${p.exerciseId}`} className="flex items-center justify-between gap-3 rounded-xl bg-bg p-2.5 pl-3">
                      <span className="min-w-0 text-sm">
                        {text(p.adjustment)}
                        <span className="block text-xs text-slate-400">{dayName(p.adjustment.planDayId)} · {p.adjustment.kind === 'swap' ? 'carga menos la zona' : 'una serie menos'}</span>
                      </span>
                      <Button aria-label={`Aplicar: ${text(p.adjustment)} (${dayName(p.adjustment.planDayId)})`} className="!min-h-11 shrink-0 px-4 text-sm" onClick={() => void applyZoneAdjustments(db, z.zone, [p.adjustment])}>
                        Aplicar
                      </Button>
                    </li>
                  ))}
                </ul>
                {mine.length > 1 && (
                  <Button variant="primary" className="w-full" onClick={() => void applyZoneAdjustments(db, z.zone, mine.map((p) => p.adjustment))}>
                    Aplicar todas ({mine.length})
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">{done.length > 0 ? 'No quedan propuestas.' : 'Sin propuestas: ningún ejercicio del plan la carga mucho, o no hay variantes que la carguen menos.'}</p>
            )}
            {done.length > 0 && (
              <div className="space-y-1 border-t border-line pt-2 text-xs text-slate-400">
                <p>Ya aplicados ({done.length}):</p>
                <ul className="list-disc pl-4">{done.map((a, i) => <li key={i}>{text(a)} ({dayName(a.planDayId)})</li>)}</ul>
                <p>Cuando pase, te ofrezco volver el plan a como estaba.</p>
              </div>
            )}
          </Card>
          </section>
        )
      })}
      {pending.map((i) => (
        <section key={i.id} aria-label={`Ya pasó: ${ZONE_LABELS[i.zone]}`}>
        <Card className="space-y-3">
          <p className="font-medium">
            {ZONE_LABELS[i.zone]} <span className="font-normal text-slate-400">· ya pasó</span>
          </p>
          <p className="text-sm text-slate-300">El plan tiene {i.planChanges!.length} {i.planChanges!.length === 1 ? 'ajuste hecho' : 'ajustes hechos'} por esa molestia:</p>
          <ul className="list-disc pl-5 text-sm text-slate-400">{i.planChanges!.map((a, k) => <li key={k}>{text(a)} ({dayName(a.planDayId)})</li>)}</ul>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => void keepZoneChanges(db, i.id)}>Dejar así</Button>
            <Button variant="primary" onClick={() => void revertZoneChanges(db, i.id)}>Volver el plan a como estaba</Button>
          </div>
        </Card>
        </section>
      ))}
    </div>
  )
}
