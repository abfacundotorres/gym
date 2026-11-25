import { useState } from 'react'
import { getDB } from '../../data/db'
import { useActiveZones } from '../../data/hooks'
import { markZone, resolveZone } from '../../data/zoneRepo'
import { formatDDMM, type ISODate } from '../../engine/dates'
import { ZONE_LABELS, type PainLevel, type Zone } from '../../engine/types'
import { Button, Card } from '../../ui/Button'
import { Chip } from '../../ui/Stepper'
import { ZoneChips } from './ZoneChips'

/**
 * Molestias de zona en Hoy (D-76): las activas, con "Ya pasó", y un formulario para anotar una suelta (sin ejercicio),
 * como una contractura que apareció fuera de la sesión.
 */
export function ZonesCard({ today }: { today: ISODate }) {
  const db = getDB()
  const zones = useActiveZones()
  const [open, setOpen] = useState(false)
  return (
    <section aria-label="Molestias" className="space-y-2">
      {zones.length > 0 && (
        <Card className="space-y-1 !py-2">
          <p className="eyebrow py-2 text-slate-400">Molestias</p>
          <ul>
            {zones.map((z) => (
              <li key={z.zone} className="flex items-center justify-between gap-3 border-t border-line py-1">
                <span className="min-w-0 text-sm">
                  <span className="font-semibold">{ZONE_LABELS[z.zone]}</span>
                  <span className="text-slate-400"> · {z.severity} · desde {formatDDMM(z.since)}</span>
                </span>
                <Button variant="ghost" aria-label={`Ya pasó: ${ZONE_LABELS[z.zone]}`} className="!min-h-11 shrink-0 px-3 text-sm" onClick={() => void resolveZone(db, z.zone, today)}>Ya pasó</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {open ? (
        <ZoneForm today={today} onDone={() => setOpen(false)} />
      ) : (
        <button className="flex min-h-11 w-full items-center text-left text-sm text-slate-500" onClick={() => setOpen(true)}>Anotar una molestia</button>
      )}
    </section>
  )
}

function ZoneForm({ today, onDone }: { today: ISODate; onDone: () => void }) {
  const db = getDB()
  const [zone, setZone] = useState<Zone | null>(null)
  const [severity, setSeverity] = useState<PainLevel>('molestia')
  const [since, setSince] = useState<ISODate>(today)
  return (
    <Card className="space-y-3">
      <p className="font-medium">¿Dónde te molesta?</p>
      <ZoneChips label="Zona" selected={zone ? [zone] : []} onToggle={(z) => setZone(zone === z ? null : z)} />
      <div role="group" aria-label="Intensidad" className="flex gap-1.5">
        <Chip active={severity === 'molestia'} onClick={() => setSeverity('molestia')}>Molestia</Chip>
        <Chip active={severity === 'dolor'} onClick={() => setSeverity('dolor')}>Dolor</Chip>
      </div>
      {severity === 'dolor' && <p className="text-xs text-slate-400">Si el dolor sigue o es fuerte, consultá a un profesional.</p>}
      <label className="block text-sm">
        <span className="text-slate-400">Desde</span>
        <input type="date" value={since} max={today} onChange={(e) => e.target.value && setSince(e.target.value)} className="mt-1 h-12 w-full rounded-xl bg-bg px-3 ring-1 ring-line" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button variant="primary" disabled={!zone} onClick={async () => { await markZone(db, { zone: zone!, severity, startedOn: since }); onDone() }}>Guardar</Button>
      </div>
    </Card>
  )
}
