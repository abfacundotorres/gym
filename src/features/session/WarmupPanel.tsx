import { useState } from 'react'
import { extraWarmupDefaults, type SetDraft } from '../../engine/entry'
import { UNIT_SHORT } from '../../engine/load'
import type { Exercise, SetEntry } from '../../engine/types'
import type { WarmupSet } from '../../engine/warmup'
import { Segments } from '../../ui/Segments'
import { Stepper } from '../../ui/Stepper'

interface Row { key: string; label: string; weight: number | null; reps: number | null; extra: boolean }
const keyOf = (s: WarmupSet) => `${s.weight}×${s.reps}`

/**
 * Entrada en calor (D-68): antes de la primera serie efectiva, las aproximaciones sugeridas a la vista, cada una con su peso
 * y reps para ajustar antes de anotarla, y "+ Aproximación" para sumar otra. Al empezar las series de trabajo el panel desaparece.
 */
export function WarmupPanel({
  ex, suggestions, loggedCount, lastLogged, onLog,
}: {
  ex: Exercise
  /** Las que sugiere el motor y todavía no se anotaron. */
  suggestions: WarmupSet[]
  loggedCount: number
  lastLogged: SetEntry | undefined
  onLog: (d: SetDraft) => void | Promise<void>
}) {
  // Solo se guardan los cambios del usuario: sin tocar nada, la fila es la sugerencia tal cual.
  const [edits, setEdits] = useState<Record<string, { weight: number | null; reps: number | null }>>({})
  const [dismissed, setDismissed] = useState<string[]>([])
  const [extras, setExtras] = useState<{ id: number; weight: number | null; reps: number | null }[]>([])

  const rows: Row[] = [
    ...suggestions.filter((s) => !dismissed.includes(keyOf(s))).map((s): Row => {
      const e = edits[keyOf(s)]
      return { key: keyOf(s), label: s.label, weight: e ? e.weight : s.weight, reps: e ? e.reps : s.reps, extra: false }
    }),
    ...extras.map((x): Row => ({ key: `x${x.id}`, label: 'extra', weight: x.weight, reps: x.reps, extra: true })),
  ]
  const change = (r: Row, patch: Partial<{ weight: number | null; reps: number | null }>) => {
    if (r.extra) setExtras(extras.map((x) => (`x${x.id}` === r.key ? { ...x, ...patch } : x)))
    else setEdits({ ...edits, [r.key]: { weight: r.weight, reps: r.reps, ...patch } })
  }
  async function log(r: Row) {
    await onLog({ type: 'A', weight: r.weight, reps: r.reps })
    if (r.extra) setExtras((cur) => cur.filter((x) => `x${x.id}` !== r.key))
    else setDismissed((cur) => [...cur, r.key])
  }
  const add = () => setExtras([...extras, { id: extras.reduce((m, x) => Math.max(m, x.id), 0) + 1, ...extraWarmupDefaults(rows, lastLogged) }])

  if (rows.length === 0) {
    return (
      <button onClick={add} className="min-h-11 w-full rounded-2xl border border-dashed border-line text-sm text-slate-400">
        + Aproximación
      </button>
    )
  }
  return (
    <section aria-label="Entrada en calor" className="space-y-2.5 rounded-2xl border border-dashed border-line p-3">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow text-slate-400">Entrada en calor</h2>
        <Segments done={loggedCount} total={loggedCount + rows.length} />
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} role="group" aria-label={`Aproximación ${r.label}`} className="space-y-0.5">
            <p className="text-[11px] text-slate-500">{r.label}</p>
            <div className="flex items-center gap-2">
              <Stepper inline label={`Peso aprox. (${UNIT_SHORT[ex.unit]})`} value={r.weight} step={ex.increment} onChange={(v) => change(r, { weight: v })} />
              <Stepper inline label="Reps aprox." value={r.reps} step={1} decimal={false} onChange={(v) => change(r, { reps: v })} />
              <button
                aria-label="Anotar aproximación"
                disabled={r.weight == null && r.reps == null}
                onClick={() => void log(r)}
                className="size-11 shrink-0 rounded-xl bg-accent-solid text-lg font-bold text-on-accent active:scale-95 disabled:opacity-40"
              >
                ✓
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={add} className="min-h-11 w-full rounded-xl text-sm text-slate-300 ring-1 ring-line">+ Aproximación</button>
    </section>
  )
}
