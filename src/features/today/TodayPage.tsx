import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { needsBackupReminder } from '../../data/backup'
import { getDB, SETTINGS_KEY } from '../../data/db'
import { activeSession, startSession } from '../../data/sessionRepo'
import { addDays, formatDDMM, toISODate, weekStart, weekdayOf, WEEKDAYS_ES } from '../../engine/dates'
import { deloadSuggestion, mesocycleEnd, mesocycleWeek, pausedWeeks, type DeloadReason } from '../../engine/periodization'
import { deloadThisWeek, dismissDeloadSuggestion, META_DELOAD_DISMISSED, toggleSkipped } from '../../data/planRepo'
import { sessionProgress } from '../../engine/session'
import type { Exercise, PlanDay, Readiness, Session } from '../../engine/types'
import { Button, Card } from '../../ui/Button'
import { Chip } from '../../ui/Stepper'
import { ImportFlow } from '../settings/ImportFlow'

export function TodayPage() {
  const db = getDB()
  const navigate = useNavigate()
  const today = toISODate(new Date())
  const wd = weekdayOf(today)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [readinessFor, setReadinessFor] = useState<PlanDay | null>(null)
  const [burnedOut, setBurnedOut] = useState(false)
  const [showAll, setShowAll] = useState(false)

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
        <h1 className="title text-3xl">Bienvenido</h1>
        <p className="text-slate-300">Para empezar, cargá tus datos iniciales (<code>seed.json</code>) o un backup.</p>
        <ImportFlow label="Importar datos iniciales" />
      </section>
    )
  }

  const scheduled = data.planDays.find((p) => p.weekday === wd)
  const plan = data.planDays.find((p) => p.id === pickedId) ?? scheduled
  const paused = data.meso ? pausedWeeks(data.meso, data.allSessions, today) : []
  const week = data.meso ? mesocycleWeek(data.meso, today, paused) : null
  const mesoEnded = !!data.meso && !week && today >= mesocycleEnd(data.meso, paused)
  const finished = data.allSessions.filter((s) => s.status === 'finished')
  const suggestion = week && !week.isDeload
    ? deloadSuggestion(data.planDays.flatMap((p) => p.items.map((i) => i.exerciseId)), data.exMap, finished, data.kgPerBrick, burnedOut)
    : null
  const showSuggestion = !!suggestion?.reasons.length && (burnedOut || !data.dismissedThisWeek)

  const nextPlan = (() => {
    for (let i = 1; i <= 7; i++) {
      const date = addDays(today, i)
      const p = data.planDays.find((x) => x.weekday === weekdayOf(date))
      if (p) return { date, name: p.name }
    }
    return null
  })()
  const doneThisWeek = data.thisWeek.filter((x) => x.status === 'finished').length
  const mesoProgress = week ? Math.min(1, (week.week - 1 + Math.min(1, doneThisWeek / Math.max(1, data.planDays.length))) / week.total) : 0

  async function begin(p: PlanDay, readiness?: Readiness, short = false) {
    const s = await startSession(db, p, today, week ? data!.meso!.id : null, readiness, Date.now(), !!week?.isDeload, short)
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
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow text-slate-400"><span>{WEEKDAYS_ES[wd]}</span> {formatDDMM(today)}</p>
          {week && <span className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold text-slate-300">Semana {week.week} de {week.total}</span>}
        </div>
        <h1 className="title mt-1.5 text-4xl">{plan?.name ?? 'Día libre'}</h1>
        {(week?.pausedWeeks || week?.isDeload) && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {week?.isDeload && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300">deload</span>}
            {week?.pausedWeeks ? <span>pausa de {week.pausedWeeks} {week.pausedWeeks === 1 ? 'semana' : 'semanas'}</span> : null}
          </p>
        )}
        {week && (
          <div className="mt-4" role="progressbar" aria-label="Avance del mesociclo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(mesoProgress * 100)}>
            <div className="h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent-solid" style={{ width: `${mesoProgress * 100}%` }} /></div>
            <p className="mt-1.5 flex justify-between text-xs text-slate-400">
              <span>Mesociclo</span>
              <span>{doneThisWeek} de {data.planDays.length} sesiones esta semana</span>
            </p>
          </div>
        )}
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
        <ActiveSessionCard
          session={data.active}
          plan={data.planDays.find((p) => p.id === data.active!.planDayId)}
          exMap={data.exMap}
          onContinue={(idx) => navigate(idx != null ? `/sesion/${data.active!.id}/${idx}` : `/sesion/${data.active!.id}`)}
        />
      ) : readinessFor ? (
        <ReadinessCheck onDone={(r, short) => void begin(readinessFor, r, short)} />
      ) : (
        <>
          {plan ? (
            <Card className="!py-2">
              <p className="eyebrow flex justify-between py-2 text-slate-400">
                <span>{plan.items.length} ejercicios · {plan.items.reduce((n, i) => n + i.sets, 0)} series</span>
              </p>
              <ol>
                {(showAll ? plan.items : plan.items.slice(0, 4)).map((it) => (
                  <li key={it.exerciseId} className="flex justify-between gap-3 border-t border-line py-2.5">
                    <span>
                      {data.exMap.get(it.exerciseId)?.name ?? it.exerciseId}
                      {it.optional && <span className="text-slate-400"> (opcional)</span>}
                    </span>
                    <span className="digits text-lg text-slate-400">{it.sets}×</span>
                  </li>
                ))}
              </ol>
              {plan.items.length > 4 && (
                <button className="flex min-h-11 w-full items-center justify-between border-t border-line text-sm text-slate-400" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                  <span>{showAll ? 'Ver menos' : `+ ${plan.items.length - 4} más`}</span>
                  <span aria-hidden="true">{showAll ? '▴' : '▾'}</span>
                </button>
              )}
            </Card>
          ) : (
            <Card className="space-y-1">
              <p className="eyebrow text-slate-400">Hoy descansás</p>
              {nextPlan ? (
                <p className="text-lg">
                  Próximo: <span className="font-semibold">{nextPlan.name}</span> · {formatDDMM(nextPlan.date)}
                </p>
              ) : (
                <p className="text-slate-400">No hay entrenamientos planificados.</p>
              )}
            </Card>
          )}
          {plan && (
            <Button variant="primary" className="title w-full !min-h-16 text-2xl tracking-wider" onClick={() => setReadinessFor(plan)}>
              Empezar
            </Button>
          )}
          {week && !week.isDeload && !showSuggestion && (
            <button className="w-full py-2 text-left text-sm text-slate-500" onClick={() => setBurnedOut(true)}>Me siento quemado</button>
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

function ActiveSessionCard({ session, plan, exMap, onContinue }: { session: Session; plan: PlanDay | undefined; exMap: Map<string, Exercise>; onContinue: (idx: number | null) => void }) {
  const prog = sessionProgress(session, plan)
  const next = prog.currentIndex != null ? exMap.get(session.items[prog.currentIndex]!.exerciseId)?.name : undefined
  return (
    <Card className="space-y-3 ring-2 ring-accent/60">
      <p className="eyebrow text-accent">Sesión en curso · {formatDDMM(session.date)}</p>
      <p className="title text-2xl">{plan?.name ?? 'Sesión'}</p>
      <p className="text-sm text-slate-300">
        <span className="tabular-nums">{prog.doneSets}/{prog.totalSets}</span> series{next && <> · sigue <span className="font-semibold">{next}</span></>}
      </p>
      <Button variant="primary" className="w-full" onClick={() => onContinue(prog.currentIndex)}>Continuar</Button>
    </Card>
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
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Semana">
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
              className={`flex h-16 w-full flex-col items-center justify-center rounded-2xl text-[11px] font-semibold ring-1 ${d === today ? 'ring-2 ring-accent' : 'ring-transparent'} ${done ? 'bg-accent-solid text-on-accent' : isSkipped ? 'bg-surface text-slate-500 line-through' : plan ? 'bg-surface text-slate-100' : 'text-slate-600'}`}
            >
              <span className="uppercase">{WEEKDAYS_ES[weekdayOf(d)]!.slice(0, 2)}</span>
              <span className="digits text-lg">{d.slice(8)}</span>
              <span className="h-3 text-[10px] leading-3">{done ? '✓' : inProgress ? '…' : plan && !isSkipped ? '•' : ''}</span>
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
            className={`digits h-14 rounded-2xl text-2xl ring-1 ${value === n ? 'bg-accent/15 text-accent ring-accent' : 'bg-raised ring-transparent'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function ReadinessCheck({ onDone }: { onDone: (r?: Readiness, short?: boolean) => void }) {
  const [sleep, setSleep] = useState<number | null>(null)
  const [short, setShort] = useState(false)
  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <Chip active={short} onClick={() => setShort(!short)}>Poco tiempo hoy</Chip>
        {short && <p className="text-xs text-slate-400">Sin ejercicios opcionales y con la sugerencia de una serie menos por ejercicio.</p>}
      </div>
      <ScaleRow label="¿Cómo dormiste?" value={sleep} set={setSleep} />
      <ScaleRow label="¿Energía?" value={null} set={(energy) => sleep != null && onDone({ sleep, energy }, short)} />
      <Button variant="ghost" className="w-full" onClick={() => onDone(undefined, short)}>Omitir y empezar</Button>
    </Card>
  )
}
