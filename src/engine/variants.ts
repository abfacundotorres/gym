import { exposuresOf } from './history'
import type { Exercise, PlanItem, Session } from './types'
import { validSets, workingWeight } from './validity'

/**
 * Variantes para "ocupado → alternativa": primero las alternativas del plan, después el resto de la
 * familia. Sin archivadas ni la actual.
 */
export function variantOptions(current: Exercise, planItem: Pick<PlanItem, 'alt'> | undefined, exercises: Exercise[]): Exercise[] {
  const fam = exercises.filter((e) => e.family === current.family && e.id !== current.id && !e.archived)
  const alt = planItem?.alt ?? []
  return [...fam].sort((a, b) => {
    const ia = alt.indexOf(a.id)
    const ib = alt.indexOf(b.id)
    if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.name.localeCompare(b.name)
  })
}

export interface FamilyReference { exerciseId: string; date: string; weight: number }

/**
 * Variante sin historial (§6.5): no se inventa un peso. Se devuelve el último peso de trabajo de otra
 * variante de la familia, solo como referencia ("no equivalente").
 */
export function familyReference(ex: Exercise, exercises: Exercise[], sessions: Session[], before?: string): FamilyReference | null {
  let best: FamilyReference | null = null
  for (const other of exercises) {
    if (other.family !== ex.family || other.id === ex.id) continue
    const last = exposuresOf(sessions, other.id, { before }).at(-1)
    if (!last) continue
    const w = workingWeight(validSets(last.item)) ?? maxW(last.item.sets.filter((s) => s.type === 'W').map((s) => s.weight))
    if (w == null) continue
    if (!best || last.date > best.date) best = { exerciseId: other.id, date: last.date, weight: w }
  }
  return best
}

function maxW(ws: (number | null)[]): number | null {
  const xs = ws.filter((w): w is number => w != null)
  return xs.length ? Math.max(...xs) : null
}
