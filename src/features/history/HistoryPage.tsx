import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { getDB } from '../../data/db'
import { useSettings } from '../../data/hooks'
import { formatDDMM } from '../../engine/dates'
import { exposuresOf } from '../../engine/history'
import { trendOf, type Trend } from '../../engine/stagnation'
import { effectiveSets } from '../../engine/volume'
import { Chip } from '../../ui/Stepper'

export const TREND_LABEL: Record<Trend, string | null> = {
  progressing: null,
  insufficient: null,
  stagnant: 'estancado',
  regressing: 'en baja',
}

export function HistoryPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('ver') === 'ejercicios' ? 'ejercicios' : 'fechas'
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Historial</h1>
      <div className="flex gap-2" role="tablist">
        <Chip active={tab === 'fechas'} onClick={() => setParams({}, { replace: true })}>Por fecha</Chip>
        <Chip active={tab === 'ejercicios'} onClick={() => setParams({ ver: 'ejercicios' }, { replace: true })}>Por ejercicio</Chip>
      </div>
      {tab === 'fechas' ? <ByDate /> : <ByExercise />}
    </section>
  )
}

function ByDate() {
  const data = useLiveQuery(async () => {
    const db = getDB()
    const [sessions, plans] = await Promise.all([db.sessions.orderBy('date').reverse().toArray(), db.planDays.toArray()])
    return { sessions, plans: new Map(plans.map((p) => [p.id, p.name])) }
  })
  if (!data) return null
  if (!data.sessions.length) return <p className="text-slate-400">Todavía no hay sesiones.</p>
  return (
    <ol className="space-y-2">
      {data.sessions.map((s) => {
        const sets = s.items.reduce((a, it) => a + effectiveSets(it), 0)
        const lowConf = s.items.some((i) => i.confidence === 'baja')
        return (
          <li key={s.id}>
            <Link to={s.status === 'finished' ? `/sesion/${s.id}/resumen` : `/sesion/${s.id}`} className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
              <span className="w-12 tabular-nums text-slate-400">{formatDDMM(s.date)}</span>
              <span className="min-w-0 flex-1 truncate">{data.plans.get(s.planDayId) ?? s.planDayId}</span>
              {s.status === 'in_progress' && <span className="text-xs text-accent">en curso</span>}
              {lowConf && <span className="rounded bg-amber-500/15 px-1.5 text-[11px] text-amber-300">datos parciales</span>}
              <span className="tabular-nums text-sm text-slate-400">{String(sets).replace('.', ',')} series</span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function ByExercise() {
  const settings = useSettings()
  const data = useLiveQuery(async () => {
    const db = getDB()
    const [exercises, sessions] = await Promise.all([db.exercises.toArray(), db.sessions.toArray()])
    return { exercises, sessions }
  })
  if (!data) return null
  // Familias ordenadas por uso más reciente; dentro, variantes también.
  const lastDate = new Map(data.exercises.map((e) => [e.id, exposuresOf(data.sessions, e.id).at(-1)?.date ?? '']))
  const byRecent = (a: { id: string }, b: { id: string }) => (lastDate.get(b.id)! > lastDate.get(a.id)! ? 1 : lastDate.get(b.id)! < lastDate.get(a.id)! ? -1 : 0)
  const families = new Map<string, typeof data.exercises>()
  for (const e of data.exercises.filter((e) => !e.archived).sort(byRecent)) families.set(e.family, [...(families.get(e.family) ?? []), e])
  return (
    <div className="space-y-4">
      {[...families.entries()].map(([fam, exs]) => (
        <div key={fam}>
          <h2 className="mb-1 text-xs uppercase tracking-wide text-slate-500">{fam.replace(/_/g, ' ')}</h2>
          <ul className="space-y-1">
            {exs.map((e) => {
              const h = exposuresOf(data.sessions, e.id)
              const trend = TREND_LABEL[trendOf(e, h, settings.kgPerBrick).trend]
              return (
                <li key={e.id}>
                  <Link to={`/historial/ej/${e.id}`} className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    {trend && <span className="rounded bg-amber-500/15 px-1.5 text-[11px] text-amber-300">{trend}</span>}
                    <span className="tabular-nums text-xs text-slate-400">{h.length ? formatDDMM(h.at(-1)!.date) : 'sin datos'}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
