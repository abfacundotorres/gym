import { ZONES, ZONE_LABELS, type Zone } from '../../engine/types'
import { Chip } from '../../ui/Stepper'

/** Zonas del cuerpo para elegir (D-76). `label` nombra el grupo para lectores de pantalla. */
export function ZoneChips({ label, selected, onToggle }: { label: string; selected: Zone[]; onToggle: (z: Zone) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {ZONES.map((z) => (
        <Chip key={z} compact active={selected.includes(z)} onClick={() => onToggle(z)}>{ZONE_LABELS[z]}</Chip>
      ))}
    </div>
  )
}
