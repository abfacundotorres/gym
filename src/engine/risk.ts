import { addDays, weekStart, type ISODate } from './dates'
import type { ExerciseExposure } from './history'
import { weekVolume } from './periodization'
import type { Exercise, Muscle, Session, SessionItem } from './types'

/**
 * Avisos de patrón (D-75): reglas simples sobre lo que ya registrás, no un diagnóstico ni una predicción de lesiones.
 * Los umbrales son pautas generales mías; están acá para cambiarlos.
 */

/** Ejercicios compuestos al fallo en una misma sesión desde los que se avisa. */
export const FAILURE_SESSION_MIN = 2
/** Veces seguidas al fallo en el mismo ejercicio desde las que se avisa. */
export const FAILURE_STREAK_MIN = 3
/** Salto de volumen semanal: esta semana contra el promedio de las semanas anteriores. */
export const SPIKE_RATIO = 1.5
export const SPIKE_MIN_EXTRA = 4
export const SPIKE_MIN_BASELINE = 4
export const SPIKE_BASE_WEEKS = 4
export const SPIKE_MIN_WEEKS = 2

/** Compuesto = mueve más de un grupo muscular (tiene músculos secundarios). Aproximación a "ejercicio pesado": no hay un dato mejor en el catálogo. */
export function isCompound(ex: Pick<Exercise, 'secondary' | 'cardio'>): boolean {
  return !ex.cardio && ex.secondary.length > 0
}

/** Llegó al fallo: alguna serie de trabajo con RIR 0. Sin dato de RIR no se presume nada. */
export function atFailure(item: Pick<SessionItem, 'sets' | 'skipped'>): boolean {
  return !item.skipped && item.sets.some((s) => s.type === 'W' && s.rir === 0)
}

/** Ejercicios compuestos de la sesión que ya llegaron al fallo, sin repetir. */
export function failureToday(session: Pick<Session, 'items'>, exercises: Map<string, Exercise>): string[] {
  const out: string[] = []
  for (const it of session.items) {
    const ex = exercises.get(it.exerciseId)
    if (ex && isCompound(ex) && atFailure(it) && !out.includes(it.exerciseId)) out.push(it.exerciseId)
  }
  return out
}

/** Veces seguidas, contando desde la última, que se terminó el ejercicio al fallo (`exposures` de la más vieja a la más nueva). */
export function failureStreak(exposures: Pick<ExerciseExposure, 'item'>[]): number {
  let n = 0
  for (let i = exposures.length - 1; i >= 0 && atFailure(exposures[i]!.item); i--) n++
  return n
}

export interface VolumeSpike { muscle: Muscle; sets: number; baseline: number; pct: number }

/**
 * Músculos cuyo volumen de esta semana (con lo que va de la sesión en curso) ya supera en 50 % o más y en 4+ series el promedio de
 * las últimas semanas. El promedio usa hasta 4 semanas anteriores con sesiones y sin deload ni vuelta tras una pausa, y se exigen
 * al menos 2: así una pausa o un deload no vuelven "normal" un volumen bajo. En deload o vuelta no se avisa. Mayor salto primero.
 */
export function volumeSpikes(sessions: Session[], current: Session, exercises: Map<string, Exercise>): VolumeSpike[] {
  if (current.deload || current.comebackDays != null) return []
  const monday = weekStart(current.date)
  const others = sessions.filter((s) => s.id !== current.id && s.status === 'finished')
  const base: ISODate[] = []
  for (let k = 1; k <= SPIKE_BASE_WEEKS; k++) {
    const m = addDays(monday, -7 * k)
    const inWeek = others.filter((s) => weekStart(s.date) === m)
    if (inWeek.length > 0 && !inWeek.some((s) => s.deload || s.comebackDays != null)) base.push(m)
  }
  if (base.length < SPIKE_MIN_WEEKS) return []
  const now = weekVolume([...others, current], monday, exercises)
  const before = base.map((m) => weekVolume(others, m, exercises))
  const out: VolumeSpike[] = []
  for (const [muscle, v] of Object.entries(now) as [Muscle, { total: number }][]) {
    const baseline = before.reduce((acc, w) => acc + (w[muscle]?.total ?? 0), 0) / base.length
    if (baseline >= SPIKE_MIN_BASELINE && v.total >= baseline * SPIKE_RATIO && v.total - baseline >= SPIKE_MIN_EXTRA) {
      out.push({ muscle, sets: v.total, baseline: Math.round(baseline * 10) / 10, pct: Math.round((v.total / baseline - 1) * 100) })
    }
  }
  return out.sort((a, b) => b.pct - a.pct)
}
