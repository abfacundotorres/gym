import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap, useSettings } from '../../data/hooks'
import { addRound, deleteSet, ungroupSessionItems, updateSet } from '../../data/sessionRepo'
import { nextSetDefaults, wouldBeRecord } from '../../engine/entry'
import { formatLoad } from '../../engine/load'
import { formatSet, sessionProgress } from '../../engine/session'
import { groupView } from '../../engine/superset'
import { haptic } from '../../lib/haptics'
import { startRest } from '../../lib/restTimer'
import { useWakeLock } from '../../lib/wakeLock'
import { BottomBar } from '../../ui/BottomBar'
import { Button } from '../../ui/Button'
import { Segments } from '../../ui/Segments'
import { Stepper } from '../../ui/Stepper'
import { todaysRecommendation } from './recommendation'
import { SetEditor } from './SetEditor'
import { useSessionData } from './useSessionData'

interface Draft { weight: number | null; reps: number | null }

/**
 * Superserie (D-66): los ejercicios del grupo en una sola pantalla. Cada uno tiene su peso y reps; "Guardar ronda" guarda
 * una serie de cada uno que todavía tenga series por hacer. El descanso arranca al cerrar la ronda.
 */
export function SupersetPage() {
  const { id, idx: idxParam } = useParams()
  const idx = Number(idxParam)
  const navigate = useNavigate()
  const db = getDB()
  const data = useSessionData(id)
  const exercises = useExerciseMap()
  const settings = useSettings()
  const history = useLiveQuery(async () => (data?.session ? db.sessions.where('exerciseIds').anyOf(data.session.exerciseIds).toArray() : []), [data?.session.exerciseIds.join()])
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState<{ idx: number; setId: string } | null>(null)
  const [record, setRecord] = useState<string | null>(null)
  const [draftState, setDraftState] = useState<{ sig: string; values: Record<number, Draft> } | null>(null)
  useWakeLock(data?.session.status === 'in_progress')

  if (!data || !exercises || !history) return null
  const { session, plan } = data
  const view = groupView(session, plan, idx)
  if (!view) return null
  const prog = sessionProgress(session, plan)
  const K = settings.kgPerBrick

  const members = view.indexes.map((i) => {
    const item = session.items[i]!
    const ex = exercises.get(item.exerciseId)!
    const planItem = plan?.items.find((p) => p.exerciseId === item.exerciseId || p.exerciseId === item.swappedFrom)
    const { rec, previous } = todaysRecommendation(ex, session, planItem, history, K)
    const { done, target, complete } = prog.items[i]!
    return { idx: i, item, ex, rec, previous, done, target, complete, defaults: nextSetDefaults(item.sets, rec), restSec: settings.restSecOverrides[ex.id] ?? ex.restSec }
  })
  const pending = members.filter((m) => !m.complete)

  // Los borradores se reinician solos cuando cambia la cantidad de series guardadas en el grupo (sin efectos).
  const sig = `${session.id}:${members.reduce((n, m) => n + m.item.sets.length, 0)}`
  const drafts: Record<number, Draft> = draftState?.sig === sig ? draftState.values : Object.fromEntries(members.map((m) => [m.idx, m.defaults]))
  const setDraft = (i: number, patch: Partial<Draft>) => setDraftState({ sig, values: { ...drafts, [i]: { ...drafts[i]!, ...patch } } })
  const canSave = pending.length > 0 && pending.every((m) => drafts[m.idx]!.weight != null || drafts[m.idx]!.reps != null)

  const prevIdx = view.indexes[0]! > 0 ? view.indexes[0]! - 1 : null
  const afterIdx = view.indexes.at(-1)! + 1
  const nextIdx = afterIdx < session.items.length ? afterIdx : null
  const nextName = nextIdx != null ? exercises.get(session.items[nextIdx]!.exerciseId)?.name : undefined
  const goNext = () => navigate(nextIdx != null ? `/sesion/${session.id}/${nextIdx}` : `/sesion/${session.id}`)

  async function saveRound() {
    const entries = pending.map((m) => ({ index: m.idx, set: { type: 'W' as const, weight: drafts[m.idx]!.weight, reps: drafts[m.idx]!.reps } }))
    const records = pending.filter((m, n) => wouldBeRecord(m.ex, m.item, entries[n]!.set, m.previous, K))
    haptic(records.length ? 'record' : 'tap')
    if (records.length) {
      setRecord(records.map((m) => `${m.ex.name.replace(/ \(.*\)$/, '')} ${formatSet({ ...drafts[m.idx]!, type: 'W', id: '' })}`).join(' · '))
      setTimeout(() => setRecord(null), 3200)
    }
    await addRound(db, session.id, entries)
    // Un solo descanso, al cerrar la ronda: el más largo del grupo.
    const rest = Math.max(0, ...pending.filter((m) => m.ex.unit !== 'minutes').map((m) => m.restSec))
    if (rest > 0) startRest(rest, 'Superserie')
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/sesion/${session.id}`} aria-label="← Sesión" className="-ml-2 flex size-11 shrink-0 items-center justify-center text-2xl text-slate-300"><span aria-hidden="true">←</span></Link>
        <span className="eyebrow text-slate-400">{members.length} ejercicios juntos</span>
        {session.status === 'in_progress' ? (
          <button aria-label="Más opciones" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="-mr-2 flex size-11 items-center justify-center rounded-full text-slate-300 active:bg-raised">
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
        ) : <span className="size-11" />}
      </div>

      <header className="space-y-1.5">
        <h1 className="title text-4xl">Superserie</h1>
        <p className="eyebrow text-accent">{view.complete ? 'Completa' : `Ronda ${view.round} de ${view.rounds}`}</p>
      </header>

      {menuOpen && (
        <div className="space-y-2 rounded-2xl bg-surface p-3 ring-1 ring-line" role="group" aria-label="Opciones de la superserie">
          <p className="text-sm text-slate-400">Para cambiar por una alternativa, anotar molestia o saltear un ejercicio, deshacé la superserie: las series que cargaste quedan.</p>
          <Button variant="danger" className="w-full" onClick={async () => {
            await ungroupSessionItems(db, session.id, view.group)
            navigate(`/sesion/${session.id}/${view.indexes[0]}`, { replace: true })
          }}>Deshacer superserie</Button>
        </div>
      )}

      <div className="space-y-2.5">
        {members.map((m) => {
          const numeric = m.rec.weight != null && m.rec.targets.length > 0
          const isEditing = editing?.idx === m.idx
          return (
            <section key={m.idx} role="group" aria-label={m.ex.name} className={`space-y-2.5 rounded-2xl bg-surface p-3 ${m.complete ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold leading-tight">{m.ex.name}</h2>
                  {numeric && !m.complete && <p className="mt-0.5 text-xs text-accent">Hoy: {formatLoad(m.ex, m.rec.weight, K)} × {m.rec.targets.join('·')}</p>}
                </div>
                <Segments done={m.done} total={m.target} className="mt-1.5 shrink-0" />
              </div>

              {m.item.sets.length > 0 && (
                <ol className="flex flex-wrap gap-1.5" aria-label="Series hechas">
                  {m.item.sets.map((s, n) => (
                    <li key={s.id}>
                      <button
                        aria-label={`Editar serie ${n + 1}: ${formatSet(s)}`}
                        onClick={() => setEditing(isEditing && editing?.setId === s.id ? null : { idx: m.idx, setId: s.id })}
                        className={`digits min-h-11 rounded-xl px-3 text-lg ${isEditing && editing?.setId === s.id ? 'bg-accent/15 text-accent' : 'bg-raised'}`}
                      >
                        {formatSet(s)}
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {isEditing ? (
                <SetEditor
                  ex={m.ex}
                  kgPerBrick={K}
                  initial={m.item.sets.find((s) => s.id === editing!.setId)!}
                  submitLabel="Guardar"
                  onSubmit={async (d) => {
                    await updateSet(db, session.id, m.idx, editing!.setId, { flag: undefined, repsBeforePause: undefined, rir: undefined, ...d })
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={async () => {
                    await deleteSet(db, session.id, m.idx, editing!.setId)
                    setEditing(null)
                  }}
                />
              ) : m.complete ? (
                <p className="text-sm font-semibold text-accent">✓ Completo</p>
              ) : (
                <div className="flex gap-2">
                  <Stepper compact label={`Peso (${m.ex.unit === 'total' ? 'kg' : m.ex.unit === 'per_hand' ? 'por mano' : m.ex.unit === 'per_side' ? 'por lado' : 'ladr.'})`} value={drafts[m.idx]!.weight} step={m.ex.increment} onChange={(v) => setDraft(m.idx, { weight: v })} />
                  <Stepper compact label="Reps" value={drafts[m.idx]!.reps} step={1} decimal={false} onChange={(v) => setDraft(m.idx, { reps: v })} />
                </div>
              )}
            </section>
          )
        })}
      </div>

      {view.complete && (
        <div className="space-y-3 rounded-2xl bg-gradient-to-br from-accent/15 to-surface p-4 text-center ring-1 ring-accent/40">
          <p className="eyebrow text-accent">Superserie completa</p>
          <Button variant="primary" className="w-full" onClick={goNext}>
            <span className="block truncate">{nextName ? `Siguiente: ${nextName} →` : 'Ver la sesión →'}</span>
          </Button>
        </div>
      )}

      {record && (
        <p role="status" className="animate-toast fixed inset-x-4 top-3 z-20 mx-auto max-w-xl rounded-2xl bg-accent-solid px-4 py-3 text-center font-bold text-on-accent shadow-lg">
          ¡Récord! {record}
        </p>
      )}

      <BottomBar>
        <div className="flex gap-2">
          <Button aria-label="← Anterior" className="w-16 shrink-0 !px-0 text-2xl" disabled={prevIdx == null} onClick={() => prevIdx != null && navigate(`/sesion/${session.id}/${prevIdx}`, { replace: true })}>←</Button>
          <Button variant="primary" className="min-w-0 flex-1" disabled={!canSave || editing != null} onClick={() => void saveRound()}>
            {view.complete ? 'Superserie completa' : '✓ Guardar ronda'}
          </Button>
          <Button aria-label={nextIdx != null ? 'Siguiente →' : 'Ver sesión'} variant={view.complete ? 'primary' : 'secondary'} className="w-16 shrink-0 !px-0 text-2xl" onClick={goNext}>→</Button>
        </div>
      </BottomBar>
    </section>
  )
}
