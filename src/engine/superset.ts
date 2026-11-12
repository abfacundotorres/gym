import { sessionProgress } from './session'
import type { PlanDay, Session, SessionItem } from './types'

/** Superserie (D-66): se agrupan 2 o 3 ejercicios que se hacen juntos, en rondas. */
export const SUPERSET_MIN = 2
export const SUPERSET_MAX = 3

/** Por qué no se puede agrupar esa selección, o null si se puede. */
export function groupError(items: SessionItem[], indexes: number[]): string | null {
  if (new Set(indexes).size !== indexes.length) return 'Hay ejercicios repetidos en la selección.'
  if (indexes.length < SUPERSET_MIN || indexes.length > SUPERSET_MAX) return `Elegí entre ${SUPERSET_MIN} y ${SUPERSET_MAX} ejercicios.`
  for (const i of indexes) {
    const it = items[i]
    if (!it) return 'Ese ejercicio no existe.'
    if (it.skipped) return 'Un ejercicio salteado no se puede agrupar.'
    if (it.group) return 'Ese ejercicio ya está en una superserie.'
  }
  return null
}

/**
 * Agrupa los ejercicios elegidos. Quedan contiguos, en su orden original, en el lugar del primero: así la
 * superserie ocupa un tramo de la lista y "anterior / siguiente" saltan el grupo entero.
 */
export function groupItems(items: SessionItem[], indexes: number[], groupId: string): SessionItem[] {
  const error = groupError(items, indexes)
  if (error) throw new Error(error)
  const picked = [...indexes].sort((a, b) => a - b)
  const members = picked.map((i) => ({ ...items[i]!, group: groupId }))
  const rest = items.filter((_, i) => !picked.includes(i))
  const at = picked[0]!
  return [...rest.slice(0, at), ...members, ...rest.slice(at)]
}

/** Deshace una superserie: los ejercicios quedan en su lugar, sueltos y con las series que ya tenían. */
export function ungroupItems(items: SessionItem[], groupId: string): SessionItem[] {
  return items.map((it) => {
    if (it.group !== groupId) return it
    const { group: _g, ...rest } = it
    return rest
  })
}

export interface GroupView {
  group: string
  /** Índices (contiguos) de los ejercicios del grupo. */
  indexes: number[]
  /** Los que todavía tienen series por hacer. */
  pending: number[]
  /** Ronda en curso (1-based) y total de rondas (la mayor cantidad de series del grupo). */
  round: number
  rounds: number
  complete: boolean
}

/** Estado de la superserie a la que pertenece el ejercicio `index`, o null si es un ejercicio suelto. */
export function groupView(session: Session, plan: PlanDay | undefined, index: number): GroupView | null {
  const group = session.items[index]?.group
  if (!group) return null
  const prog = sessionProgress(session, plan)
  const indexes = session.items.flatMap((it, i) => (it.group === group ? [i] : []))
  const pending = indexes.filter((i) => !prog.items[i]!.complete)
  const rounds = Math.max(1, ...indexes.map((i) => prog.items[i]!.target))
  const round = pending.length ? Math.min(...pending.map((i) => prog.items[i]!.done)) + 1 : rounds
  return { group, indexes, pending, round, rounds, complete: pending.length === 0 }
}
