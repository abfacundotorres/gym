import { useLiveQuery } from 'dexie-react-hooks'
import { needsBackupReminder } from '../../data/backup'
import { getDB, SETTINGS_KEY } from '../../data/db'
import { formatDDMM, toISODate, weekdayOf, WEEKDAYS_ES } from '../../engine/dates'
import { Card } from '../../ui/Button'
import { ImportFlow } from '../settings/ImportFlow'
import { Link } from 'react-router'

export function TodayPage() {
  const db = getDB()
  const today = toISODate(new Date())
  const wd = weekdayOf(today)
  const data = useLiveQuery(async () => {
    const [exerciseCount, planDay, settings, appSessions] = await Promise.all([
      db.exercises.count(),
      db.planDays.where('weekday').equals(wd).first(),
      db.settings.get(SETTINGS_KEY),
      db.sessions.filter((s) => s.source === 'app' && s.finishedAt != null).toArray(),
    ])
    const exercises = planDay ? await db.exercises.bulkGet(planDay.items.map((i) => i.exerciseId)) : []
    return { exerciseCount, planDay, exercises, lastBackupAt: settings?.value.lastBackupAt ?? null, sessionTimes: appSessions.map((s) => s.finishedAt!) }
  }, [wd])

  if (!data) return null

  if (data.exerciseCount === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Bienvenido</h1>
        <p className="text-slate-300">Para empezar, cargá tus datos iniciales (<code>seed.json</code>) o un backup.</p>
        <ImportFlow label="Importar datos iniciales" />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {needsBackupReminder(data.lastBackupAt, data.sessionTimes) && (
        <Link to="/ajustes" className="block rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
          Hace más de 7 días que no hacés backup. Tocá para exportar.
        </Link>
      )}
      <header>
        <p className="text-sm capitalize text-slate-400">
          {WEEKDAYS_ES[wd]} {formatDDMM(today)}
        </p>
        <h1 className="text-2xl font-bold">{data.planDay?.name ?? 'Día libre'}</h1>
      </header>
      {data.planDay ? (
        <Card>
          <ol className="space-y-2">
            {data.planDay.items.map((it, i) => (
              <li key={it.exerciseId} className="flex justify-between gap-3">
                <span>{data.exercises[i]?.name ?? it.exerciseId}{it.optional && <span className="text-slate-400"> (opcional)</span>}</span>
                <span className="tabular-nums text-slate-400">{it.sets}×</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-400">El registro de sesión llega en H2.</p>
        </Card>
      ) : (
        <p className="text-slate-400">Hoy no hay entrenamiento planificado.</p>
      )}
    </section>
  )
}
