import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap } from '../../data/hooks'
import { saveNextPlan } from '../../data/planRepo'
import { planChanges, promoteVariant, startDraft } from '../../engine/nextBlock'
import { variantLabel } from '../../engine/variants'
import type { PlanDay, PlanItem } from '../../engine/types'
import { Button, Card } from '../../ui/Button'
import { Chip, Stepper } from '../../ui/Stepper'

/**
 * Plantilla del bloque siguiente (D-73): una copia editable del plan de hoy que se aplica sola cuando se empieza el
 * bloque desde la Revisión. Cambia series, qué variante es la titular y qué ejercicios quedan.
 */
export function NextBlockPage() {
  const db = getDB()
  const exercises = useExerciseMap()
  const data = useLiveQuery(async () => ({
    meso: await db.mesocycles.where('status').equals('active').first(),
    planDays: await db.planDays.orderBy('weekday').toArray(),
  }))
  if (!data || !exercises) return null
  const { meso, planDays } = data
  const back = <Link to="/plan" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Plan</Link>
  if (!meso) return <section className="space-y-4">{back}<p className="text-slate-400">No hay un mesociclo activo.</p></section>

  const draft = meso.nextPlan
  const save = (plan: PlanDay[] | null) => saveNextPlan(db, meso.id, plan)
  const edit = (dayId: string, exerciseId: string, f: (i: PlanItem) => PlanItem) =>
    draft && save(draft.map((d) => (d.id !== dayId ? d : { ...d, items: d.items.map((i) => (i.exerciseId === exerciseId ? f(i) : i)) })))
  const remove = (dayId: string, exerciseId: string) =>
    draft && save(draft.map((d) => (d.id !== dayId ? d : { ...d, items: d.items.filter((i) => i.exerciseId !== exerciseId) })))
  const name = (id: string) => exercises.get(id)?.name ?? id
  const changes = planChanges(planDays, draft)

  return (
    <section className="space-y-5">
      {back}
      <header>
        <h1 className="title text-3xl">Bloque siguiente</h1>
        <p className="text-sm text-slate-400">
          Armalo de antemano: cuando empieces el bloque desde la Revisión se aplica solo, y la Revisión te sugiere ajustes encima de esto.
        </p>
      </header>

      {!draft ? (
        <Card className="space-y-3">
          <p className="text-sm text-slate-300">Todavía no preparaste nada. Arranca como una copia de tu plan de hoy y cambiás lo que quieras.</p>
          <Button variant="primary" className="w-full" onClick={() => void save(startDraft(planDays))}>Preparar desde el plan de hoy</Button>
        </Card>
      ) : (
        <>
          <Card className="space-y-1">
            <p className="font-medium">{changes.length ? `${changes.length} ${changes.length === 1 ? 'cambio' : 'cambios'} respecto del plan de hoy` : 'Igual que el plan de hoy'}</p>
            {changes.length > 0 && (
              <ul className="space-y-0.5 text-xs text-slate-400">
                {changes.map((c, i) => (
                  <li key={i}>
                    {c.kind === 'sets' && `${name(c.exerciseId)}: ${c.from} → ${c.to} series`}
                    {c.kind === 'variant' && `${name(c.exerciseId)} → ${name(c.to)}`}
                    {c.kind === 'removed' && `${name(c.exerciseId)}: se saca`}
                    {c.kind === 'added' && `${name(c.exerciseId)}: se agrega`}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {draft.map((d) => (
            <div key={d.id} className="space-y-2">
              <h2 className="title text-2xl">{d.name}</h2>
              <ul className="space-y-2">
                {d.items.map((it) => {
                  const options = [it.exerciseId, ...it.alt].flatMap((id) => { const e = exercises.get(id); return e ? [e] : [] }).sort((a, b) => a.name.localeCompare(b.name))
                  return (
                    <li key={it.exerciseId} className="rounded-2xl bg-surface p-3">
                      <div role="group" aria-label={name(it.exerciseId)} className="space-y-2">
                        <div className="font-medium">{name(it.exerciseId)}{it.optional && <span className="text-slate-400"> (opcional)</span>}</div>
                        <div className="flex items-end justify-between gap-3">
                          <div className="w-36 shrink-0">
                            <Stepper compact label="Series" value={it.sets} step={1} min={1} decimal={false} onChange={(v) => v && v <= 8 && void edit(d.id, it.exerciseId, (i) => ({ ...i, sets: v }))} />
                          </div>
                          <Button variant="ghost" aria-label={`Sacar ${name(it.exerciseId)}`} className="min-h-11 shrink-0 text-sm text-red-300" onClick={() => void remove(d.id, it.exerciseId)}>Sacar</Button>
                        </div>
                        {options.length > 1 && (
                          <div role="group" aria-label={`Variante de ${name(it.exerciseId)}`} className="flex flex-wrap gap-1.5">
                            {options.map((e) => (
                              <Chip key={e.id} compact active={e.id === it.exerciseId} onClick={() => void edit(d.id, it.exerciseId, (i) => promoteVariant(i, e.id))}>{variantLabel(e.name)}</Chip>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <Button variant="ghost" className="w-full text-red-300" onClick={() => confirm('¿Descartar la plantilla? El plan de hoy no cambia.') && void save(null)}>Descartar la plantilla</Button>
        </>
      )}
    </section>
  )
}
