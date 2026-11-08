import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { needsBackupReminder } from '../../data/backup'
import { getDB, SETTINGS_KEY } from '../../data/db'
import { activeSession, startSession } from '../../data/sessionRepo'
import { formatDDMM, toISODate, weekdayOf, WEEKDAYS_ES } from '../../engine/dates'
import { mesocycleWeek } from '../../engine/session'
import type { PlanDay, Readiness } from '../../engine/types'
import { Button, Card } from '../../ui/Button'
import { ImportFlow } from '../settings/ImportFlow'

export function TodayPage() {
  const db = getDB()
  const navigate = useNavigate()
  const today = toISODate(new Date())
  const wd = weekdayOf(today)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [readinessFor, setReadinessFor] = useState<PlanDay | null>(null)

  const data = useLiveQuery(async () => {
    const [exerciseCount, planDays, settings, appSessions, active, meso] = await Promise.all([
      db.exercises.count(),
      db.planDays.orderBy('weekday').toArray(),
      db.settings.get(SETTINGS_KEY),
      db.sessions.filter((s) => s.source === 'app' && s.finishedAt != null).toArray(),
      activeSession(db),
      db.mesocycles.where('status').equals('active').first(),
    ])
    const names = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]))
    return { exerciseCount, planDays, names, active, meso, lastBackupAt: settings?.value.lastBackupAt ?? null, sessionTimes: appSessions.map((s) => s.finishedAt!) }
  })

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

  const scheduled = data.planDays.find((p) => p.weekday === wd)
  const plan = data.planDays.find((p) => p.id === pickedId) ?? scheduled
  const week = data.meso ? mesocycleWeek(data.meso, today) : null

  async function begin(p: PlanDay, readiness?: Readiness) {
    const s = await startSession(db, p, today, week ? data!.meso!.id : null, readiness)
    navigate(`/sesion/${s.id}`)
  }

  return (
    <section className="space-y-4">
      {needsBackupReminder(data.lastBackupAt, data.sessionTimes) && (
        <Link to="/ajustes" className="block rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-amber-500/30">
          Hace más de 7 días que no hacés backup. Tocá para exportar.
        </Link>
      )}
      <header>
        <p className="text-sm text-slate-400">
          <span className="capitalize">{WEEKDAYS_ES[wd]}</span> {formatDDMM(today)}
          {week && ` · Semana ${week.week} de ${week.total}`}
          {week?.isDeload && <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-300">deload</span>}
        </p>
        <h1 className="text-2xl font-bold">{plan?.name ?? 'Día libre'}</h1>
      </header>

      {data.active ? (
        <Card className="space-y-3">
          <p>Tenés una sesión a medias del {formatDDMM(data.active.date)}.</p>
          <Button variant="primary" className="w-full" onClick={() => navigate(`/sesion/${data.active!.id}`)}>
            Continuar
          </Button>
        </Card>
      ) : readinessFor ? (
        <ReadinessCheck onDone={(r) => void begin(readinessFor, r)} />
      ) : (
        <>
          {plan ? (
            <Card>
              <ol className="space-y-2">
                {plan.items.map((it) => (
                  <li key={it.exerciseId} className="flex justify-between gap-3">
                    <span>
                      {data.names.get(it.exerciseId) ?? it.exerciseId}
                      {it.optional && <span className="text-slate-400"> (opcional)</span>}
                    </span>
                    <span className="tabular-nums text-slate-400">{it.sets}×</span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : (
            <p className="text-slate-400">Hoy no hay entrenamiento planificado.</p>
          )}
          {plan && (
            <Button variant="primary" className="w-full text-lg" onClick={() => setReadinessFor(plan)}>
              Empezar
            </Button>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer py-2 text-slate-400">Hacer otro día</summary>
            <div className="mt-2 grid gap-2">
              {data.planDays.map((p) => (
                <Button key={p.id} variant={p.id === plan?.id ? 'primary' : 'secondary'} onClick={() => setPickedId(p.id)}>
                  {p.name}
                </Button>
              ))}
            </div>
          </details>
        </>
      )}
    </section>
  )
}

function ScaleRow({ label, value, set }: { label: string; value: number | null; set: (n: number) => void }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-sm text-slate-300">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-pressed={value === n}
            onClick={() => set(n)}
            className={`h-12 rounded-xl text-lg ring-1 ${value === n ? 'bg-accent/15 text-accent ring-accent' : 'ring-line'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function ReadinessCheck({ onDone }: { onDone: (r?: Readiness) => void }) {
  const [sleep, setSleep] = useState<number | null>(null)
  return (
    <Card className="space-y-4">
      <ScaleRow label="¿Cómo dormiste?" value={sleep} set={setSleep} />
      <ScaleRow label="¿Energía?" value={null} set={(energy) => sleep != null && onDone({ sleep, energy })} />
      <Button variant="ghost" className="w-full" onClick={() => onDone()}>Omitir y empezar</Button>
    </Card>
  )
}
