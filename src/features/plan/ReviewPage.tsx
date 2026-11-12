import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap, useSettings } from '../../data/hooks'
import { startNextMesocycle } from '../../data/planRepo'
import { formatDDMM, toISODate } from '../../engine/dates'
import { num } from '../../engine/format'
import { applyProposals, mesocycleWeek, nextMesocycleStart, pausedWeeks, reviewMesocycle, type Proposal } from '../../engine/periodization'
import { formatSet } from '../../engine/session'
import { MUSCLE_LABELS } from '../../engine/types'
import { Button, Card } from '../../ui/Button'

export function ReviewPage() {
  const db = getDB()
  const navigate = useNavigate()
  const today = toISODate(new Date())
  const settings = useSettings()
  const exercises = useExerciseMap()
  const data = useLiveQuery(async () => ({
    meso: await db.mesocycles.where('status').equals('active').first(),
    sessions: await db.sessions.toArray(),
    planDays: await db.planDays.orderBy('weekday').toArray(),
  }))
  const [toggled, setToggled] = useState<Set<number>>(new Set())
  if (!data || !exercises) return null
  if (!data.meso) return <p className="text-slate-400">No hay un mesociclo activo.</p>
  const { meso } = data
  const paused = pausedWeeks(meso, data.sessions, today)
  const review = reviewMesocycle(meso, data.sessions, exercises, data.planDays, settings, paused)
  const name = (id: string) => exercises.get(id)?.name ?? id
  const week = mesocycleWeek(meso, today, paused)
  const isOn = (p: Proposal, i: number) => (p.kind === 'rotate' && p.optional ? toggled.has(i) : !toggled.has(i))
  const accepted = review.proposals.filter((p, i) => isOn(p, i))
  const start = nextMesocycleStart(meso, today, paused)

  async function begin() {
    await startNextMesocycle(db, meso, start, applyProposals(data!.planDays, accepted), accepted.length ? `Cambios: ${accepted.map((p) => describe(p, name)).join('; ')}` : '')
    navigate('/plan', { replace: true })
  }

  return (
    <section className="space-y-5">
      <Link to="/plan" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Plan</Link>
      <header>
        <h1 className="title text-3xl">Revisión del mesociclo</h1>
        <p className="text-sm text-slate-400">
          Desde el {formatDDMM(meso.startDate)}{week ? ` · vas por la semana ${week.week} de ${week.total} (vista previa)` : ''}
        </p>
      </header>

      <div className="space-y-2">
        <h2 className="font-semibold">PRs ({review.prs.length})</h2>
        {review.prs.length === 0 ? <p className="text-sm text-slate-400">Sin PRs en este mesociclo.</p> : (
          <Card>
            <ul className="space-y-1 text-sm">
              {review.prs.map((p) => (
                <li key={p.setId} className="flex justify-between gap-2">
                  <span className="truncate">{formatDDMM(p.date)} {name(p.exerciseId)}</span>
                  <span className="tabular-nums text-accent">{formatSet(p.set)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Series por semana (promedio en acumulación)</h2>
        <Card>
          <ul className="grid grid-cols-1 gap-1 text-sm">
            {review.volume.map((v) => (
              <li key={v.muscle} className="flex justify-between gap-2">
                <span>{MUSCLE_LABELS[v.muscle]}</span>
                <span className={`tabular-nums ${v.status === 'in' ? 'text-accent' : v.status === 'below' ? 'text-amber-300' : 'text-sky-300'}`}>
                  {num(v.avg)} <span className="text-slate-500">/ {v.target[0]}-{v.target[1]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Estancados o en baja</h2>
        <p className="text-sm text-slate-300">{review.stalled.length ? review.stalled.map(name).join(', ') : 'Ninguno.'}</p>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Propuesta para el siguiente</h2>
        {review.proposals.length === 0 ? <p className="text-sm text-slate-400">Sin cambios: mismo plan.</p> : (
          <ul className="space-y-2">
            {review.proposals.map((p, i) => (
              <li key={i}>
                <label className="flex items-start gap-3 rounded-2xl bg-surface p-3.5">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 accent-[--color-accent]"
                    checked={isOn(p, i)}
                    onChange={() => setToggled((r) => { const n = new Set(r); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                  />
                  <span className="text-sm">
                    {describe(p, name)}
                    <span className="block text-xs text-slate-400">{p.reason}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button variant="primary" className="w-full" onClick={() => confirm(`¿Cerrar este mesociclo y empezar el siguiente el ${formatDDMM(start)}?`) && void begin()}>
        Empezar el siguiente ({formatDDMM(start)})
      </Button>
    </section>
  )
}

function describe(p: Proposal, name: (id: string) => string): string {
  return p.kind === 'rotate' ? `${name(p.exerciseId)} → ${name(p.to)}` : `${name(p.exerciseId)}: ${p.from} → ${p.to} series`
}
