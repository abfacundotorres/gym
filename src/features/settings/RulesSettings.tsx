import { getDB } from '../../data/db'
import { useRules } from '../../data/hooks'
import { saveRules } from '../../data/settingsRepo'
import { DEFAULT_RULES, RULE_LIMITS, resolveRules, rulesOverrides, type DeloadMode, type Rules } from '../../engine/rules'
import { Button } from '../../ui/Button'
import { Chip, Stepper } from '../../ui/Stepper'

const DELOAD_TEXT: Record<DeloadMode, { label: string; hint: string }> = {
  standard: { label: 'Como ahora', hint: 'La mitad de las series y −10 % de carga.' },
  light: { label: 'Más liviano', hint: 'La mitad de las series y −20 % de carga.' },
  rest: { label: 'Semana sin pesas', hint: 'Descansás esa semana: no cuenta como una falta ni corre el mesociclo. Si entrenás igual, sale liviano (la mitad de las series, −20 %).' },
}

/**
 * Ajustes → Reglas (D-78): los umbrales del motor con su valor por defecto. Son pautas generales mías, no prescripciones; se
 * guardan solo los que cambiás.
 */
export function RulesSettings() {
  const rules = useRules()
  const set = (p: Partial<Rules>) => void saveRules(getDB(), resolveRules({ ...rules, ...p }))
  const changed = Object.keys(rulesOverrides(rules)).length > 0
  const num = (key: 'comebackMinDays' | 'failureSessionMin' | 'failureStreakMin' | 'spikePct' | 'spikeMinExtra', label: string, step = 1) => {
    const [lo, hi] = RULE_LIMITS[key]
    return (
      <Stepper
        compact
        label={`${label} (por defecto ${DEFAULT_RULES[key]})`}
        value={rules[key]}
        step={step}
        min={lo}
        decimal={false}
        onChange={(v) => v != null && v >= lo && v <= hi && set({ [key]: v })}
      />
    )
  }
  const tier = (i: 0 | 1 | 2, label: string) => (
    <Stepper
      compact
      label={`Carga de vuelta, ${label} (%) (por defecto ${DEFAULT_RULES.comebackLoadPct[i]})`}
      value={rules.comebackLoadPct[i]}
      step={5}
      min={RULE_LIMITS.comebackLoadPct[0]}
      decimal={false}
      onChange={(v) => {
        if (v == null || v < RULE_LIMITS.comebackLoadPct[0] || v > RULE_LIMITS.comebackLoadPct[1]) return
        const next = [...rules.comebackLoadPct] as [number, number, number]
        next[i] = v
        set({ comebackLoadPct: next })
      }}
    />
  )
  return (
    <details className="rounded-2xl bg-surface p-4 text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center">Reglas del motor: vuelta, avisos y deload</summary>
      <div className="space-y-5 pt-3">
        <p className="text-xs text-slate-400">Pautas generales mías, no prescripciones. Se guardan solo las que cambiás, y "Restablecer" vuelve a las de siempre.</p>

        <div className="space-y-3">
          <h3 className="eyebrow text-slate-400">Volver tras una pausa</h3>
          {num('comebackMinDays', 'Días sin entrenar para sugerir la vuelta')}
          {tier(0, 'pausa corta (hasta 20 días)')}
          {tier(1, 'pausa media (21 a 41 días)')}
          {tier(2, 'pausa larga (42 o más)')}
        </div>

        <div className="space-y-3">
          <h3 className="eyebrow text-slate-400">Avisos durante la sesión</h3>
          {num('failureSessionMin', 'Compuestos al fallo en una sesión para avisar')}
          {num('failureStreakMin', 'Veces seguidas al fallo en un ejercicio para avisar')}
          {num('spikePct', 'Salto de volumen semanal: % sobre tu promedio', 10)}
          {num('spikeMinExtra', 'Salto de volumen semanal: series de más')}
        </div>

        <div className="space-y-2">
          <h3 className="eyebrow text-slate-400">Deload</h3>
          <div role="group" aria-label="Tipo de deload" className="flex flex-wrap gap-1.5">
            {(Object.keys(DELOAD_TEXT) as DeloadMode[]).map((m) => (
              <Chip key={m} compact active={rules.deloadMode === m} onClick={() => set({ deloadMode: m })}>{DELOAD_TEXT[m].label}</Chip>
            ))}
          </div>
          <p className="text-xs text-slate-400">{DELOAD_TEXT[rules.deloadMode].hint}</p>
        </div>

        {changed && <Button variant="ghost" className="w-full" onClick={() => void saveRules(getDB(), DEFAULT_RULES)}>Restablecer las reglas</Button>}
      </div>
    </details>
  )
}
