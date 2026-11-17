import type { PlanDay, PlanItem } from './types'

/** Copia independiente del plan de hoy, punto de partida de la plantilla del bloque siguiente (D-73). */
export function startDraft(planDays: PlanDay[]): PlanDay[] {
  return planDays.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i, alt: [...i.alt] })) }))
}

/** Pone `to` como variante titular del ejercicio del plan; la anterior pasa a ser la primera alternativa. */
export function promoteVariant(item: PlanItem, to: string): PlanItem {
  if (to === item.exerciseId) return item
  return { ...item, exerciseId: to, alt: [item.exerciseId, ...item.alt.filter((a) => a !== to)] }
}

/**
 * Plan con el que empieza el bloque siguiente: por cada día del plan de hoy, el de la plantilla si lo hay (los días que
 * la plantilla no tiene quedan como están, y los que ya no existen se ignoran). Se descartan los ejercicios que ya no
 * existen o están archivados (`usable`), y de las alternativas, las que no se pueden usar.
 */
export function resolveNextPlan(current: PlanDay[], draft: PlanDay[] | undefined, usable: (exerciseId: string) => boolean): PlanDay[] {
  if (!draft) return current
  const byId = new Map(draft.map((d) => [d.id, d]))
  return current.map((day) => {
    const d = byId.get(day.id)
    if (!d) return day
    const items = d.items.filter((i) => usable(i.exerciseId)).map((i) => ({ ...i, alt: i.alt.filter(usable) }))
    return { ...d, items }
  })
}

export type PlanChange =
  | { kind: 'sets'; planDayId: string; exerciseId: string; from: number; to: number }
  | { kind: 'variant'; planDayId: string; exerciseId: string; to: string }
  | { kind: 'removed'; planDayId: string; exerciseId: string }

/** Qué cambia la plantilla respecto del plan de hoy, por día e ítem (en el orden del plan). */
export function planChanges(current: PlanDay[], draft: PlanDay[] | undefined): PlanChange[] {
  if (!draft) return []
  const out: PlanChange[] = []
  const byId = new Map(draft.map((d) => [d.id, d]))
  for (const day of current) {
    const d = byId.get(day.id)
    if (!d) continue
    // Un ejercicio del plan se identifica por la variante titular de hoy, o por la que pasó a ser titular en la plantilla.
    const matched = new Set<number>()
    for (const cur of day.items) {
      const family = new Set([cur.exerciseId, ...cur.alt])
      const idx = d.items.findIndex((x, i) => !matched.has(i) && (x.exerciseId === cur.exerciseId || (family.has(x.exerciseId) && x.alt.includes(cur.exerciseId))))
      if (idx === -1) { out.push({ kind: 'removed', planDayId: day.id, exerciseId: cur.exerciseId }); continue }
      matched.add(idx)
      const next = d.items[idx]!
      if (next.exerciseId !== cur.exerciseId) out.push({ kind: 'variant', planDayId: day.id, exerciseId: cur.exerciseId, to: next.exerciseId })
      if (next.sets !== cur.sets) out.push({ kind: 'sets', planDayId: day.id, exerciseId: cur.exerciseId, from: cur.sets, to: next.sets })
    }
  }
  return out
}
