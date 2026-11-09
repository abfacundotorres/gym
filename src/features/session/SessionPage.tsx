import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap } from '../../data/hooks'
import { discardSession, finishSession } from '../../data/sessionRepo'
import { formatDDMM } from '../../engine/dates'
import { formatSet, lastExposure } from '../../engine/session'
import { useWakeLock } from '../../lib/wakeLock'
import { readinessLevel } from '../../engine/readiness'
import { Button } from '../../ui/Button'
import { useSessionData } from './useSessionData'

export function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useSessionData(id)
  const exercises = useExerciseMap()
  const [finishing, setFinishing] = useState(false)
  const [note, setNote] = useState('')
  const history = useLiveQuery(async () => (data?.session ? getDB().sessions.where('exerciseIds').anyOf(data.session.exerciseIds).toArray() : []), [data?.session.exerciseIds.join()])
  useWakeLock(data?.session.status === 'in_progress')

  if (data === null) return <p className="text-slate-400">Sesión no encontrada.</p>
  if (!data || !exercises) return null
  const { session, plan } = data
  const planned = new Map(plan?.items.map((i) => [i.exerciseId, i]) ?? [])

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm text-slate-400">{formatDDMM(session.date)}{session.status === 'finished' && ' · terminada'}</p>
        <h1 className="text-2xl font-bold">{plan?.name ?? session.planDayId}</h1>
      </header>
      {session.status === 'in_progress' && !session.deload && readinessLevel(session.readiness) === 'low' && (
        <p role="status" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100 ring-1 ring-amber-500/30">
          Sueño y energía bajos hoy: mantené los pesos y, si querés, dejá cada ejercicio con una serie menos. Es una sugerencia, vos decidís.
        </p>
      )}
      <ol className="space-y-2">
        {session.items.map((it, idx) => {
          const ex = exercises.get(it.exerciseId)
          const p = planned.get(it.exerciseId) ?? (it.swappedFrom ? planned.get(it.swappedFrom) : undefined)
          const w = it.sets.filter((s) => s.type === 'W').length
          const target = p?.sets ?? 0
          const last = history && lastExposure(history, it.exerciseId, session.date, session.id)
          const complete = target > 0 && w >= target
          return (
            <li key={`${it.exerciseId}-${idx}`}>
              <Link
                to={`/sesion/${session.id}/${idx}`}
                className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${complete ? 'bg-accent/5 ring-accent/40' : 'bg-surface ring-line'} ${it.skipped ? 'opacity-50' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{ex?.name ?? it.exerciseId}{p?.optional && <span className="text-slate-400"> (opcional)</span>}</div>
                  <div className="truncate text-xs text-slate-400">
                    {it.skipped
                      ? 'Salteado'
                      : it.sets.length
                        ? it.sets.filter((s) => s.type === 'W').map(formatSet).join(', ')
                        : last
                          ? `Última (${formatDDMM(last.date)}): ${last.item.sets.filter((s) => s.type === 'W').map(formatSet).join(', ') || 'sin series'}`
                          : 'Sin historial'}
                  </div>
                </div>
                <span className={`tabular-nums text-sm ${complete ? 'text-accent' : 'text-slate-400'}`}>
                  {complete ? '✓' : `${w}/${target}`}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      {session.status === 'in_progress' &&
        (finishing ? (
          <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-line">
            <label className="block text-sm text-slate-300">
              Nota de la sesión (opcional)
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg bg-bg p-2 ring-1 ring-line" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setFinishing(false)}>Volver</Button>
              <Button variant="primary" onClick={async () => { await finishSession(getDB(), session.id, note); navigate(`/sesion/${session.id}/resumen`, { replace: true }) }}>
                Terminar
              </Button>
            </div>
            <button
              className="w-full py-2 text-sm text-red-300"
              onClick={async () => {
                if (confirm('¿Descartar la sesión? Se borran todas las series registradas.')) {
                  await discardSession(getDB(), session.id)
                  navigate('/', { replace: true })
                }
              }}
            >
              Descartar sesión
            </button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setFinishing(true)}>Terminar sesión</Button>
        ))}
      {session.status === 'finished' && (
        <Button className="w-full" onClick={() => navigate(`/sesion/${session.id}/resumen`)}>Ver resumen</Button>
      )}
    </section>
  )
}
