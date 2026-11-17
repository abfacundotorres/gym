import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap, useSettings } from '../../data/hooks'
import { startNextMesocycle } from '../../data/planRepo'
import { formatDDMM, toISODate } from '../../engine/dates'
import { num } from '../../engine/format'
import { planChanges, resolveNextPlan } from '../../engine/nextBlock'
import { applyProposals, mesocycleWeek, nextMesocycleStart, pausedWeeks, reviewMesocycle, withAllRotations, type Proposal } from '../../engine/periodization'
import { formatSet } from '../../engine/session'
import { MUSCLE_LABELS, type Phase } from '../../engine/types'
import { variantLabel } from '../../engine/variants'
import { Button, Card } from '../../ui/Button'
import { PhasePicker } from './PhasePicker'

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
  /** Fase del próximo bloque: sin tocar, hereda la del actual. */
  const [phaseChoice, setPhaseChoice] = useState<Phase | null | undefined>(undefined)
  if (!data || !exercises) return null
  if (!data.meso) return <p className="text-slate-400">No hay un mesociclo activo.</p>
  const { meso } = data
  const paused = pausedWeeks(meso, data.sessions, today)
  // La plantilla del bloque siguiente (D-73), si se preparó: la revisión propone ajustes encima de ella, no del plan de hoy.
  const nextPlan = resolveNextPlan(data.planDays, meso.nextPlan, (id) => exercises.get(id) != null && !exercises.get(id)!.archived)
  const templateChanges = planChanges(data.planDays, meso.nextPlan)
  const review = reviewMesocycle(meso, data.sessions, exercises, data.planDays, settings, paused, nextPlan)
  const name = (id: string) => exercises.get(id)?.name ?? id
  const week = mesocycleWeek(meso, today, paused)
  const isOn = (p: Proposal, i: number) => (p.kind === 'rotate' && p.optional ? toggled.has(i) : !toggled.has(i))
  const accepted = review.proposals.filter((p, i) => isOn(p, i))
  const start = nextMesocycleStart(meso, today, paused)
  const rotations = review.proposals.filter((p) => p.kind === 'rotate')
  const allRotating = rotations.length > 0 && rotations.every((p) => accepted.includes(p))

  const nextPhase = phaseChoice !== undefined ? phaseChoice : (meso.phase ?? null)

  async function begin() {
    const notes = [
      templateChanges.length ? `Plantilla: ${templateChanges.length} ${templateChanges.length === 1 ? 'cambio' : 'cambios'}` : '',
      accepted.length ? `Cambios: ${accepted.map((p) => describe(p, name)).join('; ')}` : '',
    ].filter(Boolean).join('. ')
    await startNextMesocycle(db, meso, start, applyProposals(nextPlan, accepted), notes, nextPhase)
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

      {review.variantsUsed.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Variantes que hiciste</h2>
          <Card>
            <ul className="space-y-2.5 text-sm">
              {review.variantsUsed.map((v) => (
                <li key={`${v.planDayId}-${v.exerciseId}`}>
                  <span className="block">{name(v.exerciseId)}</span>
                  <span className="block text-slate-400">
                    {v.used.map((u) => `${variantLabel(name(u.exerciseId))} ×${u.sessions}`).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {meso.nextPlan && (
        <Card className="space-y-1">
          <p className="font-medium">Tu plantilla del bloque siguiente</p>
          <p className="text-xs text-slate-400">
            {templateChanges.length
              ? `${templateChanges.length} ${templateChanges.length === 1 ? 'cambio' : 'cambios'} sobre el plan de hoy; se aplican al empezar. Lo que sigue se propone encima de tu plantilla.`
              : 'Igual que el plan de hoy. Lo que sigue se propone encima.'}
          </p>
          <Link to="/plan/siguiente" className="flex min-h-11 items-center text-sm text-accent">Ver o editar →</Link>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="font-semibold">Propuesta para el siguiente</h2>
        {rotations.length > 1 && (
          <Button variant="secondary" className="w-full" onClick={() => setToggled((t) => withAllRotations(review.proposals, t, !allRotating))}>
            {allRotating ? 'Dejar solo lo sugerido' : `Rotar todas las variantes (${rotations.length})`}
          </Button>
        )}
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

      <Card>
        <PhasePicker value={nextPhase ?? undefined} onChange={(p) => setPhaseChoice(p ?? null)} />
        <p className="mt-2 text-xs text-slate-400">Es la fase del bloque que empieza. Podés cambiarla después en Plan → Editar.</p>
      </Card>

      <Button variant="primary" className="w-full" onClick={() => confirm(`¿Cerrar este mesociclo y empezar el siguiente el ${formatDDMM(start)}?`) && void begin()}>
        Empezar el siguiente ({formatDDMM(start)})
      </Button>
    </section>
  )
}

function describe(p: Proposal, name: (id: string) => string): string {
  return p.kind === 'rotate' ? `${name(p.exerciseId)} → ${name(p.to)}` : `${name(p.exerciseId)}: ${p.from} → ${p.to} series`
}
