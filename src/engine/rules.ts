/**
 * Reglas del motor que se pueden ajustar (D-78). Todas son pautas generales mías, no prescripciones: se muestran en Ajustes → Reglas
 * con su valor por defecto. Lo que se guarda son solo los valores que cambiaste (`Settings.rules`), y `resolveRules` completa el resto.
 */
export type DeloadMode = 'standard' | 'light' | 'rest'

export interface Rules {
  /** Días sin entrenar desde los que se sugiere una sesión de vuelta (D-74). */
  comebackMinDays: number
  /** Carga de vuelta, en %, para pausa corta, media (21 a 41 días) y larga (42 o más). */
  comebackLoadPct: [number, number, number]
  /** Compuestos al fallo en una sesión desde los que se avisa (D-75). */
  failureSessionMin: number
  /** Veces seguidas al fallo en un ejercicio desde las que se avisa (D-75). */
  failureStreakMin: number
  /** Salto de volumen semanal: % sobre el promedio de las semanas anteriores (D-75). */
  spikePct: number
  /** Salto de volumen semanal: series de más sobre el promedio (D-75). */
  spikeMinExtra: number
  /** Deload: como siempre (−10 % de carga), más liviano (−20 %) o semana sin pesas (D-78). */
  deloadMode: DeloadMode
}

export const DEFAULT_RULES: Rules = {
  comebackMinDays: 10,
  comebackLoadPct: [95, 90, 80],
  failureSessionMin: 2,
  failureStreakMin: 3,
  spikePct: 50,
  spikeMinExtra: 4,
  deloadMode: 'standard',
}

export const RULE_LIMITS = {
  comebackMinDays: [7, 21],
  comebackLoadPct: [50, 100],
  failureSessionMin: [2, 5],
  failureStreakMin: [2, 6],
  spikePct: [20, 200],
  spikeMinExtra: [1, 10],
} as const

export const DELOAD_MODES: DeloadMode[] = ['standard', 'light', 'rest']

const int = (v: unknown, [lo, hi]: readonly [number, number], fallback: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback

/** Reglas completas a partir de lo guardado: cada valor inválido o fuera de rango vuelve a su valor por defecto, sin tirar el resto. */
export function resolveRules(saved?: Partial<Rules> | null): Rules {
  const s = (saved ?? {}) as Record<string, unknown>
  const d = DEFAULT_RULES
  const pct = Array.isArray(s.comebackLoadPct) && s.comebackLoadPct.length === 3 ? s.comebackLoadPct : []
  return {
    comebackMinDays: int(s.comebackMinDays, RULE_LIMITS.comebackMinDays, d.comebackMinDays),
    comebackLoadPct: [0, 1, 2].map((i) => int(pct[i], RULE_LIMITS.comebackLoadPct, d.comebackLoadPct[i]!)) as [number, number, number],
    failureSessionMin: int(s.failureSessionMin, RULE_LIMITS.failureSessionMin, d.failureSessionMin),
    failureStreakMin: int(s.failureStreakMin, RULE_LIMITS.failureStreakMin, d.failureStreakMin),
    spikePct: int(s.spikePct, RULE_LIMITS.spikePct, d.spikePct),
    spikeMinExtra: int(s.spikeMinExtra, RULE_LIMITS.spikeMinExtra, d.spikeMinExtra),
    deloadMode: DELOAD_MODES.includes(s.deloadMode as DeloadMode) ? (s.deloadMode as DeloadMode) : d.deloadMode,
  }
}

/** Solo lo que difiere de los valores por defecto (lo que se guarda); vacío si todo está por defecto. */
export function rulesOverrides(rules: Rules): Partial<Rules> {
  const out: Partial<Rules> = {}
  const d = DEFAULT_RULES
  if (rules.comebackMinDays !== d.comebackMinDays) out.comebackMinDays = rules.comebackMinDays
  if (rules.comebackLoadPct.some((v, i) => v !== d.comebackLoadPct[i])) out.comebackLoadPct = [...rules.comebackLoadPct]
  if (rules.failureSessionMin !== d.failureSessionMin) out.failureSessionMin = rules.failureSessionMin
  if (rules.failureStreakMin !== d.failureStreakMin) out.failureStreakMin = rules.failureStreakMin
  if (rules.spikePct !== d.spikePct) out.spikePct = rules.spikePct
  if (rules.spikeMinExtra !== d.spikeMinExtra) out.spikeMinExtra = rules.spikeMinExtra
  if (rules.deloadMode !== d.deloadMode) out.deloadMode = rules.deloadMode
  return out
}

/** Factor de carga del deload según el modo: −10 % como siempre, o −20 % (más liviano y semana sin pesas, si se entrena igual). */
export function deloadFactor(mode: DeloadMode): number {
  return mode === 'standard' ? 0.9 : 0.8
}
