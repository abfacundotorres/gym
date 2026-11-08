import type { SessionItem, SetEntry } from './types'

export type Exclusion = 'aprox' | 'cardio' | 'sin_reps' | 'rebote' | 'asist' | 'drop' | 'rp_sin_dato' | 'confianza_baja'

export const EXCLUSION_LABEL: Record<Exclusion, string> = {
  aprox: 'aproximación',
  cardio: 'cardio',
  sin_reps: 'sin reps',
  rebote: 'rebote',
  asist: 'asistida',
  drop: 'drop',
  rp_sin_dato: 'rest-pause sin dato',
  confianza_baja: 'dato de confianza baja',
}

/**
 * Por qué una serie no cuenta para progresión (§6.1, D-03), o null si cuenta.
 * Las excluidas sí cuentan para volumen (ver volume.ts).
 */
export function exclusionReason(set: SetEntry, item?: Pick<SessionItem, 'confidence'>): Exclusion | null {
  if (set.type !== 'W') return 'aprox'
  if (set.minutes != null) return 'cardio'
  if (set.reps == null || set.weight == null) return 'sin_reps'
  if (set.flag === 'rebote') return 'rebote'
  if (set.flag === 'asist') return 'asist'
  if (set.flag === 'drop') return 'drop'
  if (set.flag === 'rp' && set.repsBeforePause == null) return 'rp_sin_dato'
  if (item?.confidence === 'baja') return 'confianza_baja'
  return null
}

/** Reps que cuentan para progresión: en rest-pause, las de antes de la primera pausa. */
export function progressionReps(set: SetEntry): number | null {
  return set.flag === 'rp' ? (set.repsBeforePause ?? null) : set.reps
}

export interface ValidSet { weight: number; reps: number; set: SetEntry }

export function validSets(item: Pick<SessionItem, 'sets' | 'confidence'>): ValidSet[] {
  const out: ValidSet[] = []
  for (const s of item.sets) {
    if (exclusionReason(s, item)) continue
    const reps = progressionReps(s)
    if (reps == null || s.weight == null) continue
    out.push({ weight: s.weight, reps, set: s })
  }
  return out
}

/** Peso de trabajo (D-01): el mayor peso con series válidas. */
export function workingWeight(valid: ValidSet[]): number | null {
  return valid.length ? Math.max(...valid.map((v) => v.weight)) : null
}
