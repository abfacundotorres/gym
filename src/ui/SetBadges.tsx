import type { PRKind } from '../engine/prs'
import type { SessionItem, SetEntry } from '../engine/types'
import { EXCLUSION_LABEL, exclusionReason } from '../engine/validity'

/** Badges chicos: PR y "excluida de progresión" (con el motivo en el title/aria). */
export function SetBadges({ set, item, pr }: { set: SetEntry; item: Pick<SessionItem, 'confidence'>; pr?: PRKind }) {
  const reason = exclusionReason(set, item)
  return (
    <>
      {pr && (
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent" title={pr === 'e1rm' ? 'Mejor e1RM' : 'Más reps a este peso'}>
          PR
        </span>
      )}
      {reason && reason !== 'aprox' && reason !== 'cardio' && (
        <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[11px] text-slate-400" title={`Excluida de progresión: ${EXCLUSION_LABEL[reason]}`} aria-label={`Excluida de progresión: ${EXCLUSION_LABEL[reason]}`}>
          excl.
        </span>
      )}
    </>
  )
}
