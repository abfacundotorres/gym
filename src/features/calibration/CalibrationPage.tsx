import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap, useSettings } from '../../data/hooks'
import { setRangeOverride } from '../../data/planRepo'
import { CAL_MIN_EVALUATED, calibrate, evaluateSuggestions, rangeProposal, type Calibration, type RangeProposal } from '../../engine/calibration'
import { exposuresOf } from '../../engine/history'
import { readinessLevel } from '../../engine/readiness'
import type { Exercise, PlanItem } from '../../engine/types'
import { Button, Card } from '../../ui/Button'

interface Row {
  ex: Exercise
  cal: Calibration
  planItem: PlanItem | undefined
  proposal: RangeProposal | null
}

/**
 * Calibración (D-81): cuántas veces seguiste lo que la app te habría sugerido, por ejercicio, y, si hay evidencia suficiente, un ajuste
 * chico del rango de reps del plan que se aplica con un toque y se puede restablecer. Es una aproximación, no un veredicto.
 */
export function CalibrationPage() {
  const settings = useSettings()
  const exercises = useExerciseMap()
  const data = useLiveQuery(async () => {
    const db = getDB()
    return { sessions: await db.sessions.toArray(), planDays: await db.planDays.orderBy('weekday').toArray() }
  })
  if (!data || !exercises) return null

  const finished = data.sessions.filter((s) => s.status === 'finished')
  const byId = new Map(finished.map((s) => [s.id, s]))
  const planItems = data.planDays.flatMap((d) => d.items)
  const rows: Row[] = []
  for (const id of new Set(finished.flatMap((s) => s.exerciseIds))) {
    const ex = exercises.get(id)
    if (!ex || ex.cardio || ex.unit === 'minutes') continue
    const planItem = planItems.find((i) => i.exerciseId === id)
    const evals = evaluateSuggestions(ex, exposuresOf(finished, id), { sets: planItem?.sets ?? 3, kgPerBrick: settings.kgPerBrick, readiness: (sid) => byId.get(sid)?.readiness })
    const cal = calibrate(evals)
    if (cal.evaluated < CAL_MIN_EVALUATED) continue
    const proposal = planItem ? rangeProposal(ex.range, planItem.rangeOverride ?? ex.range, cal) : null
    rows.push({ ex, cal, planItem, proposal })
  }
  rows.sort((a, b) => Number(!!b.proposal) - Number(!!a.proposal) || b.cal.evaluated - a.cal.evaluated || a.ex.name.localeCompare(b.ex.name))
  const lowDays = finished.filter((s) => readinessLevel(s.readiness) === 'low').length

  return (
    <section className="space-y-4">
      <Link to="/resumen" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Resumen</Link>
      <header>
        <h1 className="title text-3xl">Calibración</h1>
        <p className="mt-1 text-sm text-slate-400">
          La app recalcula qué te habría sugerido antes de cada sesión y lo compara con el peso con el que trabajaste. Es una aproximación: usa las series
          planificadas de hoy y el rango base del ejercicio, y no sabe por qué elegiste otro peso (técnica, cansancio, discos disponibles).
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-slate-400">
          Todavía no hay ejercicios con {CAL_MIN_EVALUATED} o más sugerencias para comparar. Aparecen a medida que sumes sesiones.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ ex, cal, planItem, proposal }) => {
            const base = ex.range
            const cur = planItem?.rangeOverride
            return (
              <li key={ex.id}>
                <section aria-label={ex.name}>
                  <Card className="space-y-2">
                    <p className="font-semibold">{ex.name}</p>
                    <p className="text-sm">
                      Seguiste la sugerencia <span className="font-semibold">{cal.followed} de {cal.evaluated}</span> veces.
                      <span className="block text-xs text-slate-400">Usaste menos peso: {cal.lower} · más peso: {cal.higher}</span>
                    </p>
                    {cal.increases > 0 && <p className="text-sm text-slate-300">De las {cal.increases} {cal.increases === 1 ? 'vez' : 'veces'} que sugirió subir, no subiste {cal.declined}.</p>}
                    {planItem && (
                      <p className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>Rango del plan: {(cur ?? base)[0]}-{(cur ?? base)[1]} reps{cur ? ` (el del ejercicio es ${base[0]}-${base[1]})` : ''}</span>
                        {cur && <Button variant="ghost" aria-label={`Restablecer el rango de ${ex.name}`} className="!min-h-11 shrink-0 px-3 text-sm" onClick={() => void setRangeOverride(getDB(), ex.id, null)}>Restablecer rango</Button>}
                      </p>
                    )}
                    {proposal && (
                      <div className="space-y-2 rounded-xl bg-bg p-3">
                        <p className="text-sm">
                          {proposal.reason === 'aggressive'
                            ? `Probá ampliar el rango a ${proposal.to[0]}-${proposal.to[1]} reps: sumás reps antes de que te pida subir de peso.`
                            : `Probá acortarlo a ${proposal.to[0]}-${proposal.to[1]} reps: te pide subir de peso antes.`}
                        </p>
                        <Button className="w-full" aria-label={`Aplicar rango ${proposal.to[0]}-${proposal.to[1]} a ${ex.name}`} onClick={() => void setRangeOverride(getDB(), ex.id, proposal.to)}>
                          Aplicar rango {proposal.to[0]}-{proposal.to[1]}
                        </Button>
                      </div>
                    )}
                  </Card>
                </section>
              </li>
            )
          })}
        </ul>
      )}
      {lowDays > 0 && <p className="text-xs text-slate-500">Los días de sueño y energía bajos se evalúan con la sugerencia de "mantené el peso".</p>}
    </section>
  )
}
