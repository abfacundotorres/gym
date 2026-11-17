import { PHASES, PHASE_HINT, PHASE_LABEL, phaseBlockSuggestion } from '../../engine/phase'
import type { Phase } from '../../engine/types'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Stepper'

/** Fase del mesociclo (D-69): se declara; solo cambia cómo se interpreta el progreso y qué se sugiere. */
export function PhasePicker({
  value, onChange, current, onApply,
}: {
  value: Phase | undefined
  onChange: (p: Phase | undefined) => void
  /** Con esto se ofrece aplicar el largo de bloque sugerido para la fase. */
  current?: { accumulationWeeks: number; deloadWeeks: number }
  onApply?: (s: { accumulationWeeks: number; deloadWeeks: number }) => void
}) {
  const suggestion = value && current && onApply ? phaseBlockSuggestion(value) : null
  const differs = suggestion && (suggestion.accumulationWeeks !== current!.accumulationWeeks || suggestion.deloadWeeks !== current!.deloadWeeks)
  return (
    <div className="space-y-2 text-sm">
      <span className="text-slate-400">Fase</span>
      <div role="group" aria-label="Fase" className="flex flex-wrap gap-1.5">
        <Chip active={value === undefined} onClick={() => onChange(undefined)}>Sin definir</Chip>
        {PHASES.map((p) => <Chip key={p} active={value === p} onClick={() => onChange(p)}>{PHASE_LABEL[p]}</Chip>)}
      </div>
      <p className="text-xs text-slate-400">{value ? PHASE_HINT[value] : 'Sin definir: el motor se comporta como siempre. La fase la declarás vos: la app no sabe si estás en déficit.'}</p>
      {differs && suggestion && (
        <div className="flex items-center gap-2 rounded-xl bg-raised p-2.5">
          <p className="min-w-0 flex-1 text-xs text-slate-300">
            Sugerido para {PHASE_LABEL[value!]}: {suggestion.accumulationWeeks} semanas de acumulación + {suggestion.deloadWeeks} de deload. Es una pauta general, no una regla.
          </p>
          <Button className="shrink-0" onClick={() => onApply!(suggestion)}>Aplicar</Button>
        </div>
      )}
    </div>
  )
}
