import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap } from '../../data/hooks'
import { createFirstMesocycle, deloadThisWeek, saveMesocycle, setPlanItemSets } from '../../data/planRepo'
import { formatDDMM, toISODate, weekStart } from '../../engine/dates'
import { deloadStart, mesocycleEnd, mesocycleWeek, pausedWeeks } from '../../engine/periodization'
import type { Mesocycle } from '../../engine/types'
import { Button, Card } from '../../ui/Button'
import { Stepper } from '../../ui/Stepper'

export function PlanPage() {
  const db = getDB()
  const today = toISODate(new Date())
  const exercises = useExerciseMap()
  const data = useLiveQuery(async () => ({
    planDays: await db.planDays.orderBy('weekday').toArray(),
    meso: await db.mesocycles.where('status').equals('active').first(),
    sessions: await db.sessions.toArray(),
  }))
  const [editing, setEditing] = useState(false)
  if (!data || !exercises) return null
  const { meso } = data
  const paused = meso ? pausedWeeks(meso, data.sessions, today) : []
  const week = meso ? mesocycleWeek(meso, today, paused) : null

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="title text-3xl">Plan</h1>
        <Link to="/ejercicios" className="py-2 text-sm text-slate-300">Ejercicios →</Link>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Mesociclo</h2>
        {!meso ? (
          <Button variant="primary" className="w-full" onClick={() => void createFirstMesocycle(db, today)}>Empezar un mesociclo esta semana</Button>
        ) : editing ? (
          <MesoForm meso={meso} onDone={() => setEditing(false)} />
        ) : (
          <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-semibold">{week ? `Semana ${week.week} de ${week.total}` : today < meso.startDate ? 'Todavía no empezó' : 'Terminado'}</p>
              {week?.isDeload && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-300">deload</span>}
            </div>
            <p className="text-sm text-slate-400">
              Desde el {formatDDMM(meso.startDate)} · {meso.deloadFrom ? 'deload adelantado' : `${meso.accumulationWeeks} de acumulación + ${meso.deloadWeeks} de deload`}
              <br />
              {week && !week.isDeload ? `Próximo deload: semana del ${formatDDMM(deloadStart(meso, paused))}` : `Termina el ${formatDDMM(mesocycleEnd(meso, paused))}`}
            </p>
            {paused.length > 0 && (
              <p className="text-xs text-slate-400">
                {paused.length === 1 ? 'Pasó 1 semana' : `Pasaron ${paused.length} semanas`} sin entrenar: el mesociclo se corrió ({paused.map((p) => formatDDMM(p)).join(', ')}).
              </p>
            )}
            {meso.notes && <p className="text-xs text-slate-400">{meso.notes}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setEditing(true)}>Editar</Button>
              <Link to="/plan/revision" className="flex min-h-12 items-center justify-center rounded-xl ring-1 ring-line">Revisión</Link>
            </div>
            {week && !week.isDeload && (
              <Button variant="ghost" className="w-full text-sm" onClick={() => confirm('¿Pasar esta semana a deload? El mesociclo termina al final del deload.') && void deloadThisWeek(db, meso, today)}>
                Hacer deload esta semana
              </Button>
            )}
          </Card>
        )}
      </div>

      {data.planDays.map((d) => (
        <div key={d.id} className="space-y-2">
          <h2 className="text-lg font-semibold">{d.name}</h2>
          <ul className="space-y-2">
            {d.items.map((it) => {
              const ex = exercises.get(it.exerciseId)
              const range = it.rangeOverride ?? ex?.range
              return (
                <li key={it.exerciseId} className="flex items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{ex?.name ?? it.exerciseId}{it.optional && <span className="text-slate-400"> (opcional)</span>}</div>
                    <div className="text-xs text-slate-400">
                      {range && `${range[0]}-${range[1]} ${ex?.cardio ? 'min' : 'reps'}`}
                      {it.alt.length > 0 && ` · alt: ${it.alt.map((a) => exercises.get(a)?.name ?? a).join(', ')}`}
                    </div>
                  </div>
                  <div className="w-36 shrink-0">
                    <Stepper label="Series" value={it.sets} step={1} min={1} decimal={false} onChange={(v) => v && v <= 8 && void setPlanItemSets(getDB(), d.id, it.exerciseId, v)} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

function MesoForm({ meso, onDone }: { meso: Mesocycle; onDone: () => void }) {
  const [m, setM] = useState(meso)
  return (
    <Card className="space-y-3">
      <label className="block text-sm">
        <span className="text-slate-400">Inicio (se toma el lunes de esa semana)</span>
        <input type="date" value={m.startDate} onChange={(e) => e.target.value && setM({ ...m, startDate: weekStart(e.target.value) })} className="mt-1 h-12 w-full rounded-lg bg-bg px-3 ring-1 ring-line" />
      </label>
      <div className="flex gap-2">
        <Stepper label="Semanas de acumulación" value={m.accumulationWeeks} step={1} min={3} decimal={false} onChange={(v) => v && v <= 8 && setM({ ...m, accumulationWeeks: v })} />
        <Stepper label="Deload" value={m.deloadWeeks} step={1} min={0} decimal={false} onChange={(v) => v != null && v <= 2 && setM({ ...m, deloadWeeks: v })} />
      </div>
      {m.deloadFrom && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked onChange={() => { const { deloadFrom: _d, ...rest } = m; setM(rest) }} />
          Deload adelantado al {formatDDMM(m.deloadFrom)} (destildar para volver al calendario normal)
        </label>
      )}
      <label className="block text-sm">
        <span className="text-slate-400">Notas</span>
        <textarea value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-lg bg-bg p-2 ring-1 ring-line" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button variant="primary" onClick={async () => { await saveMesocycle(getDB(), m); onDone() }}>Guardar</Button>
      </div>
    </Card>
  )
}
