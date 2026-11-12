import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router'
import { getDB } from '../../data/db'
import { useSettings } from '../../data/hooks'
import { formatDDMM } from '../../engine/dates'
import { exposureMetrics } from '../../engine/e1rm'
import { formatRest, num } from '../../engine/format'
import { averageRest } from '../../engine/rest'
import { exposuresOf } from '../../engine/history'
import { formatLoad } from '../../engine/load'
import { recommend } from '../../engine/progression'
import { findPRs } from '../../engine/prs'
import { formatSet } from '../../engine/session'
import { trendOf } from '../../engine/stagnation'
import { LineChart } from '../../ui/LineChart'
import { SetBadges } from '../../ui/SetBadges'
import { TREND_LABEL } from './HistoryPage'

export function ExerciseHistoryPage() {
  const { exId } = useParams()
  const settings = useSettings()
  const data = useLiveQuery(async () => {
    const db = getDB()
    const [ex, sessions, plans] = await Promise.all([db.exercises.get(exId!), db.sessions.where('exerciseIds').equals(exId!).toArray(), db.planDays.toArray()])
    const plannedSets = plans.flatMap((p) => p.items).find((i) => i.exerciseId === exId)?.sets ?? 3
    return { ex, sessions, plannedSets }
  }, [exId])
  if (!data || (data.ex && data.ex.id !== exId)) return null
  if (!data.ex) return <p className="text-slate-400">Ejercicio no encontrado.</p>
  const { ex } = data
  const K = settings.kgPerBrick
  const history = exposuresOf(data.sessions, ex.id).filter((h) => data.sessions.find((s) => s.id === h.sessionId)?.status === 'finished')
  const metrics = history.map((h) => exposureMetrics(ex, h.item, h.date, h.sessionId, K))
  const trend = trendOf(ex, history, K).trend
  const rec = recommend(ex, data.plannedSets, history, { kgPerBrick: K })
  const e1Points = metrics.filter((m) => m.e1rm != null).map((m) => ({ x: formatDDMM(m.date), y: m.e1rm!, label: m.workingWeight != null ? formatLoad(ex, m.workingWeight, K) : '' }))
  const repPoints = metrics.filter((m) => m.totalReps > 0).map((m) => ({ x: formatDDMM(m.date), y: m.totalReps, label: '' }))
  const unitNote = ex.unit === 'per_side' && ex.barKg == null ? ' (2 × por lado, sin carro)' : ex.unit === 'bricks' ? ` (${num(K)} kg/ladrillo)` : ''

  return (
    <section className="space-y-4">
      <Link to="/historial?ver=ejercicios" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Ejercicios</Link>
      <header>
        <h1 className="title text-3xl">{ex.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-300">
          <span className="rounded-full bg-raised px-2.5 py-1">{ex.range[0]}-{ex.range[1]} reps</span>
          <span className="rounded-full bg-raised px-2.5 py-1">+{num(ex.increment)}</span>
          {TREND_LABEL[trend] && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300">{TREND_LABEL[trend]}</span>}
        </div>
      </header>
      {history.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-accent/15 to-surface p-3.5 ring-1 ring-accent/40">
          <p className="eyebrow text-accent">Próxima vez</p>
          <p className={rec.status === 'insufficient' ? 'mt-1 text-sm' : 'digits mt-1 text-3xl leading-[1.05]'}>
            {rec.status === 'insufficient' ? rec.message : `${rec.weight != null ? formatLoad(ex, rec.weight, K) : '—'} × ${rec.targets.join('·')}`}
          </p>
        </div>
      )}
      {e1Points.length > 0 && <LineChart title={`e1RM${unitNote}`} unit="kg" points={e1Points} />}
      {repPoints.length > 0 && <LineChart title="Reps totales (series efectivas)" unit="reps" points={repPoints} />}
      {history.length === 0 ? (
        <p className="text-slate-400">Sin registros para esta variante.</p>
      ) : (
        <ol className="space-y-2" aria-label="Sesiones">
          {[...history].reverse().map((h) => {
            const i = history.indexOf(h)
            const prs = new Map(findPRs(ex, h, history.slice(0, i), K).map((p) => [p.setId, p.kind]))
            const m = metrics[i]!
            return (
              <li key={`${h.sessionId}-${i}`} className="rounded-2xl bg-surface p-3.5">
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <Link to={`/sesion/${h.sessionId}/resumen`} className="digits inline-flex min-h-11 items-center text-xl text-slate-100">{formatDDMM(h.date)}</Link>
                  <span className="text-xs text-slate-400">
                    {m.e1rm != null ? `e1RM ${num(Math.round(m.e1rm * 10) / 10)} kg` : 'sin e1RM'}
                    {averageRest(h.item.sets) != null && ` · desc. ~${formatRest(averageRest(h.item.sets)!)}`}
                    {h.item.pain && <span className="ml-2 rounded bg-red-500/15 px-1 text-red-300">{h.item.pain}</span>}
                    {h.item.confidence && h.item.confidence !== 'alta' && <span className="ml-2 rounded bg-amber-500/15 px-1 text-amber-300">conf. {h.item.confidence}</span>}
                  </span>
                </div>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {h.item.sets.map((s) => (
                    <li key={s.id} className={`flex items-center gap-1 text-lg tabular-nums ${s.type === 'A' ? 'text-slate-500' : 'font-semibold'}`}>
                      {formatSet(s)}
                      <SetBadges set={s} item={h.item} pr={prs.get(s.id)} />
                    </li>
                  ))}
                </ul>
                {h.item.note && <p className="mt-1 text-xs text-slate-400">{h.item.note}</p>}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
