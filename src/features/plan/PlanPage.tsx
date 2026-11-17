import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap } from '../../data/hooks'
import { createVariant } from '../../data/exerciseRepo'
import { createFirstMesocycle, deloadThisWeek, saveMesocycle, setPlanAlt, setPlanItemSets } from '../../data/planRepo'
import { formatDDMM, toISODate, weekStart } from '../../engine/dates'
import { deloadStart, mesocycleEnd, mesocycleWeek, pausedWeeks } from '../../engine/periodization'
import { PHASE_HINT, PHASE_LABEL } from '../../engine/phase'
import { variantLabel } from '../../engine/variants'
import type { Exercise, Mesocycle, PlanItem, Unit } from '../../engine/types'
import { Button, Card, LINK_BUTTON } from '../../ui/Button'
import { Chip, Stepper } from '../../ui/Stepper'
import { PhasePicker } from './PhasePicker'

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
        <div className="flex items-center gap-1">
          <Link to="/peso" className="flex min-h-11 items-center px-2 text-sm text-slate-300">Peso →</Link>
          <Link to="/ejercicios" className="flex min-h-11 items-center pl-2 text-sm text-slate-300">Ejercicios →</Link>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="eyebrow text-slate-400">Mesociclo</h2>
        {!meso ? (
          <Button variant="primary" className="w-full" onClick={() => void createFirstMesocycle(db, today)}>Empezar un mesociclo esta semana</Button>
        ) : editing ? (
          <MesoForm meso={meso} onDone={() => setEditing(false)} />
        ) : (
          <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="digits text-3xl">{week ? `Semana ${week.week} de ${week.total}` : today < meso.startDate ? 'Todavía no empezó' : 'Terminado'}</p>
              <div className="flex items-center gap-1.5">
                {meso.phase && <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">{PHASE_LABEL[meso.phase]}</span>}
                {week?.isDeload && <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300">deload</span>}
              </div>
            </div>
            {meso.phase && <p className="text-xs text-slate-400">{PHASE_HINT[meso.phase]}</p>}
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
              <Link to="/plan/revision" className={LINK_BUTTON}>Revisión</Link>
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
          <h2 className="title text-2xl">{d.name}</h2>
          <ul className="space-y-2">
            {d.items.map((it) => <PlanItemRow key={it.exerciseId} dayId={d.id} item={it} exercises={exercises} />)}
          </ul>
        </div>
      ))}
    </section>
  )
}

const UNIT_CHIP: Partial<Record<Unit, string>> = { per_hand: 'Mancuerna · por mano', per_side: 'Barra · por lado', total: 'Polea · kg', bricks: 'Máquina · ladrillos' }

function PlanItemRow({ dayId, item, exercises }: { dayId: string; item: PlanItem; exercises: Map<string, Exercise> }) {
  const [open, setOpen] = useState(false)
  const ex = exercises.get(item.exerciseId)
  const range = item.rangeOverride ?? ex?.range
  const labels = [ex, ...item.alt.map((a) => exercises.get(a))].flatMap((e) => (e ? [variantLabel(e.name)] : []))
  return (
    <li className="rounded-2xl bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{ex?.name ?? item.exerciseId}{item.optional && <span className="text-slate-400"> (opcional)</span>}</div>
          <div className="text-xs text-slate-400">{range && `${range[0]}-${range[1]} ${ex?.cardio ? 'min' : 'reps'}`}</div>
          {ex && (
            <button aria-expanded={open} onClick={() => setOpen(!open)} className="-ml-1 flex min-h-11 max-w-full items-center truncate px-1 text-left text-xs text-accent">
              {item.alt.length ? `Variantes: ${labels.join(' · ')}` : '+ Variantes'}
            </button>
          )}
        </div>
        <div className="w-36 shrink-0">
          <Stepper compact label="Series" value={item.sets} step={1} min={1} decimal={false} onChange={(v) => v && v <= 8 && void setPlanItemSets(getDB(), dayId, item.exerciseId, v)} />
        </div>
      </div>
      {open && ex && <VariantsPanel item={item} base={ex} exercises={exercises} />}
    </li>
  )
}

/** Opciones de un ejercicio del plan: se elige entre ellas en cada sesión; cada variante guarda su historial (D-67). */
function VariantsPanel({ item, base, exercises }: { item: PlanItem; base: Exercise; exercises: Map<string, Exercise> }) {
  const db = getDB()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>(base.unit)
  const included = new Set([item.exerciseId, ...item.alt])
  const candidates = [...exercises.values()].filter((e) => e.family === base.family && !included.has(e.id) && !e.archived)
  return (
    <div role="group" aria-label={`Variantes de ${base.name}`} className="mt-1 space-y-3 border-t border-line pt-3">
      <p className="text-xs text-slate-400">Se ofrecen para elegir cuando hacés el ejercicio en una sesión. Cada variante guarda su propio historial. Vale para todos los días donde está este ejercicio.</p>
      <ul className="space-y-1.5">
        <li className="flex min-h-11 items-center justify-between text-sm"><span>{variantLabel(base.name)}</span><span className="text-xs text-slate-400">la del plan</span></li>
        {item.alt.map((a) => {
          const e = exercises.get(a)
          return (
            <li key={a} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{e ? variantLabel(e.name) : a}</span>
              <Button variant="ghost" aria-label={`Quitar ${e?.name ?? a}`} className="shrink-0 text-red-300" onClick={() => void setPlanAlt(db, item.exerciseId, a, false)}>Quitar</Button>
            </li>
          )
        })}
      </ul>
      {candidates.length > 0 && (
        <div className="space-y-1.5">
          <p className="eyebrow text-slate-400">Agregar una que ya existe</p>
          {candidates.map((c) => (
            <Button key={c.id} className="w-full justify-start text-left" onClick={() => void setPlanAlt(db, item.exerciseId, c.id, true)}>+ {c.name}</Button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <p className="eyebrow text-slate-400">Nueva variante</p>
        <input
          aria-label="Nombre de la variante"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Ej.: ${base.name.replace(/\s*\(.*\)\s*$/, '')} (máquina)`}
          className="h-12 w-full rounded-xl bg-bg px-3 ring-1 ring-line"
        />
        <div role="group" aria-label="Unidad de la variante" className="flex flex-wrap gap-1.5">
          {(Object.keys(UNIT_CHIP) as Unit[]).map((u) => <Chip key={u} compact active={unit === u} onClick={() => setUnit(u)}>{UNIT_CHIP[u]}</Chip>)}
        </div>
        <Button
          variant="primary"
          className="w-full"
          disabled={!name.trim()}
          onClick={async () => {
            const v = await createVariant(db, base, name.trim(), unit)
            await setPlanAlt(db, item.exerciseId, v.id, true)
            setName('')
          }}
        >
          Crear y agregar
        </Button>
        <p className="text-xs text-slate-400">Copia la configuración de {base.name} (rango, descanso, músculos). El paso de carga se ajusta a la unidad y se puede cambiar en Ejercicios.</p>
      </div>
    </div>
  )
}

function MesoForm({ meso, onDone }: { meso: Mesocycle; onDone: () => void }) {
  const [m, setM] = useState(meso)
  return (
    <Card className="space-y-3">
      <label className="block text-sm">
        <span className="text-slate-400">Inicio (se toma el lunes de esa semana)</span>
        <input type="date" value={m.startDate} onChange={(e) => e.target.value && setM({ ...m, startDate: weekStart(e.target.value) })} className="mt-1 h-12 w-full rounded-xl bg-bg px-3 ring-1 ring-line" />
      </label>
      <div className="flex gap-2">
        <Stepper compact label="Semanas de acumulación" value={m.accumulationWeeks} step={1} min={3} decimal={false} onChange={(v) => v && v <= 8 && setM({ ...m, accumulationWeeks: v })} />
        <Stepper compact label="Deload" value={m.deloadWeeks} step={1} min={0} decimal={false} onChange={(v) => v != null && v <= 2 && setM({ ...m, deloadWeeks: v })} />
      </div>
      <PhasePicker
        value={m.phase}
        onChange={(phase) => { const { phase: _p, ...rest } = m; setM(phase ? { ...rest, phase } : rest) }}
        current={{ accumulationWeeks: m.accumulationWeeks, deloadWeeks: m.deloadWeeks }}
        onApply={(s) => setM({ ...m, ...s })}
      />
      {m.deloadFrom && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked onChange={() => { const { deloadFrom: _d, ...rest } = m; setM(rest) }} />
          Deload adelantado al {formatDDMM(m.deloadFrom)} (destildar para volver al calendario normal)
        </label>
      )}
      <label className="block text-sm">
        <span className="text-slate-400">Notas</span>
        <textarea value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-xl bg-bg p-2 ring-1 ring-line" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button variant="primary" onClick={async () => { await saveMesocycle(getDB(), m); onDone() }}>Guardar</Button>
      </div>
    </Card>
  )
}
