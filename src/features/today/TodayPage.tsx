import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { needsBackupReminder } from '../../data/backup'
import { getDB, SETTINGS_KEY } from '../../data/db'
import { activeSession, startSession } from '../../data/sessionRepo'
import { addDays, formatDDMM, toISODate, weekStart, weekdayOf, WEEKDAYS_ES } from '../../engine/dates'
import { deloadSuggestion, mesocycleEnd, mesocycleWeek, type DeloadReason } from '../../engine/periodization'
import { deloadThisWeek, dismissDeloadSuggestion, META_DELOAD_DISMISSED, toggleSkipped } from '../../data/planRepo'
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
  const [burnedOut, setBurnedOut] = useState(false)

  const data = useLiveQuery(async () => {
    const monday = weekStart(today)
    const [exerciseCount, planDays, settings, allSessions, active, meso, exercises, marks, dismissed] = await Promise.all([
      db.exercises.count(),
      db.planDays.orderBy('weekday').toArray(),
      db.settings.get(SETTINGS_KEY),
      db.sessions.toArray(),
      activeSession(db),
      db.mesocycles.where('status').equals('active').first(),
      db.exercises.toArray(),
      db.dayMarks.where('date').between(monday, addDays(monday, 6), true, true).toArray(),
      db.meta.get(META_DELOAD_DISMISSED),
    ])
    const exMap = new Map(exercises.map((e) => [e.id, e]))
    const appSessions = allSessions.filter((s) => s.source === 'app' && s.finishedAt != null)
    const thisWeek = allSessions.filter((s) => weekStart(s.date) === monday)
    return {
      exerciseCount, planDays, exMap, active, meso, marks, thisWeek, allSessions,
      kgPerBrick: settings?.value.kgPerBrick ?? 4.2,
      dismissedThisWeek: dismissed?.value === monday,
      lastBackupAt: settings?.value.lastBackupAt ?? null,
      sessionTimes: appSessions.map((s) => s.finishedAt!),
    }
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
  const mesoEnded = !!data.meso && !week && today >= mesocycleEnd(data.meso)
  const finished = data.allSessions.filter((s) => s.status === 'finished')
  const suggestion = week && !week.isDeload
    ? deloadSuggestion(data.planDays.flatMap((p) => p.items.map((i) => i.exerciseId)), data.exMap, finished, data.kgPerBrick, burnedOut)
    : null
  const showSuggestion = !!suggestion?.reasons.length && (burnedOut || !data.dismissedThisWeek)

  async function begin(p: PlanDay, readiness?: Readiness) {
    const s = await startSession(db, p, today, week ? data!.meso!.id : null, readiness, Date.now(), !!week?.isDeload)
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

      <WeekStrip today={today} planDays={data.planDays} sessions={data.thisWeek} skipped={data.marks.map((m) => m.date)} />

      {mesoEnded && (
        <Link to="/plan/revision" className="block rounded-xl bg-accent/10 p-3 text-sm text-accent ring-1 ring-accent/40">
          Terminó el mesociclo. Tocá para ver la revisión y planificar el siguiente.
        </Link>
      )}
      {week?.isDeload && (
        <p className="rounded-xl bg-sky-500/10 p-3 text-sm text-sky-200 ring-1 ring-sky-500/30">
          Semana de deload: la mitad de las series, −10 % de carga, sin rest-pause ni drops.
        </p>
      )}
      {showSuggestion && suggestion && (
        <Card className="space-y-3">
          <p className="font-medium">Sugerencia: adelantar el deload</p>
          <ul className="list-disc pl-5 text-sm text-slate-300">
            {suggestion.reasons.map((r) => <li key={r}>{reasonText(r, suggestion)}</li>)}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => { setBurnedOut(false); void dismissDeloadSuggestion(db, today) }}>Ahora no</Button>
            <Button variant="primary" onClick={() => { setBurnedOut(false); void deloadThisWeek(db, data.meso!, today) }}>Deload esta semana</Button>
          </div>
        </Card>
      )}

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
                      {data.exMap.get(it.exerciseId)?.name ?? it.exerciseId}
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
          {week && !week.isDeload && !showSuggestion && (
            <button className="w-full py-2 text-sm text-slate-400" onClick={() => setBurnedOut(true)}>Me siento quemado</button>
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

function reasonText(r: DeloadReason, s: { stagnantShare: number; readinessAvg: number | null }): string {
  if (r === 'stagnation') return `${Math.round(s.stagnantShare * 100)} % de los ejercicios estancados o en baja.`
  if (r === 'readiness') return `Sueño y energía promedio ${String(s.readinessAvg?.toFixed(1)).replace('.', ',')} en las últimas 3 sesiones.`
  return 'Te sentís quemado.'
}

function WeekStrip({ today, planDays, sessions, skipped }: { today: string; planDays: PlanDay[]; sessions: { date: string; status: string; planDayId: string }[]; skipped: string[] }) {
  const db = getDB()
  const monday = weekStart(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Semana">
      {days.map((d) => {
        const plan = planDays.find((p) => p.weekday === weekdayOf(d))
        const done = sessions.find((s) => s.date === d && s.status === 'finished')
        const inProgress = sessions.some((s) => s.date === d && s.status === 'in_progress')
        const isSkipped = skipped.includes(d)
        const canSkip = !!plan && !done && d <= today
        const state = done ? 'hecho' : inProgress ? 'en curso' : isSkipped ? 'salteado' : plan ? (d < today ? 'pendiente' : 'planificado') : 'descanso'
        return (
          <li key={d}>
            <button
              disabled={!canSkip}
              onClick={() => plan && void toggleSkipped(db, d, plan.id)}
              aria-label={`${WEEKDAYS_ES[weekdayOf(d)]} ${formatDDMM(d)}: ${state}${canSkip ? (isSkipped ? '. Tocá para desmarcar' : '. Tocá para marcar salteado') : ''}`}
              className={`flex h-14 w-full flex-col items-center justify-center rounded-lg text-xs ring-1 ${d === today ? 'ring-accent' : 'ring-line'} ${done ? 'bg-accent/15 text-accent' : isSkipped ? 'text-slate-500 line-through' : plan ? 'bg-surface' : 'text-slate-600'}`}
            >
              <span className="uppercase">{WEEKDAYS_ES[weekdayOf(d)]!.slice(0, 2)}</span>
              <span className="tabular-nums">{d.slice(8)}</span>
              <span className="h-3 leading-3">{done ? '✓' : inProgress ? '…' : plan && !isSkipped ? '•' : ''}</span>
            </button>
          </li>
        )
      })}
    </ol>
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
