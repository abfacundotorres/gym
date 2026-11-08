import type { Exercise, Muscle, SessionItem, SetEntry } from './types'

/**
 * Aporte de una serie al volumen (§7): A = 0; W = 1 (rp incluida);
 * drop = 0.5. Las series excluidas de progresión (rebote, asist, reps null) sí cuentan (D-04).
 */
export function setVolume(set: SetEntry): number {
  if (set.type !== 'W') return 0
  if (set.minutes != null) return 0
  return set.flag === 'drop' ? 0.5 : 1
}

export interface VolumeContribution { exerciseId: string; sets: number; role: 'primary' | 'secondary' }
export type VolumeByMuscle = Partial<Record<Muscle, { total: number; from: VolumeContribution[] }>>

/** Series por músculo: 1.0 a cada primario y 0.5 a cada secundario, por serie. */
export function volumeByMuscle(items: SessionItem[], exercises: Map<string, Exercise>): VolumeByMuscle {
  const out: VolumeByMuscle = {}
  const add = (m: Muscle, v: number, exerciseId: string, role: 'primary' | 'secondary') => {
    if (!v) return
    const entry = (out[m] ??= { total: 0, from: [] })
    entry.total += v
    const prev = entry.from.find((f) => f.exerciseId === exerciseId && f.role === role)
    if (prev) prev.sets += v
    else entry.from.push({ exerciseId, sets: v, role })
  }
  for (const it of items) {
    const ex = exercises.get(it.exerciseId)
    if (!ex || it.skipped) continue
    const sets = it.sets.reduce((acc, s) => acc + setVolume(s), 0)
    for (const m of ex.primary) add(m, sets, ex.id, 'primary')
    for (const m of ex.secondary) add(m, sets * 0.5, ex.id, 'secondary')
  }
  return out
}

/** Series efectivas (ponderadas: drop = 0.5) de un item. */
export function effectiveSets(item: SessionItem): number {
  return item.sets.reduce((acc, s) => acc + setVolume(s), 0)
}
