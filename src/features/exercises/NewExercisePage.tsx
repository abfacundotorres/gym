import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { getDB } from '../../data/db'
import { createExercise } from '../../data/exerciseRepo'
import { addExerciseToDay } from '../../data/planRepo'
import { UNIT_SHORT } from '../../engine/load'
import { UNIT_DEFAULTS, validNewExercise } from '../../engine/planEdit'
import { MUSCLES, MUSCLE_LABELS, UNITS, type Muscle, type Unit } from '../../engine/types'
import { Button, Card } from '../../ui/Button'
import { Chip, Stepper } from '../../ui/Stepper'
import { UNIT_LABEL } from './unitLabels'

/** Ejercicio nuevo desde cero (D-83): lo mínimo para que la app lo trate bien; el resto se afina después en Ejercicios. */
export function NewExercisePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const dayId = params.get('dia')
  const data = useLiveQuery(async () => {
    const db = getDB()
    return { day: dayId ? await db.planDays.get(dayId) : undefined, families: [...new Set((await db.exercises.toArray()).map((e) => e.family))].sort() }
  }, [dayId])
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const [unit, setUnit] = useState<Unit>('per_hand')
  const [d, setD] = useState(UNIT_DEFAULTS.per_hand)
  const [primary, setPrimary] = useState<Muscle[]>([])
  const [busy, setBusy] = useState(false)
  if (!data) return null
  const back = dayId ? '/plan' : '/ejercicios'
  const cardio = unit === 'minutes'
  const input = { name, family, unit, range: d.range, increment: d.increment, restSec: d.restSec, warmup: d.warmup, primary }
  const valid = validNewExercise(input)
  const toDay = data.day

  function pickUnit(u: Unit) {
    setUnit(u)
    setD(UNIT_DEFAULTS[u]) // rango, paso y descanso de arranque de esa unidad
  }
  async function create() {
    setBusy(true)
    const db = getDB()
    const ex = await createExercise(db, input)
    if (toDay) await addExerciseToDay(db, toDay.id, ex.id)
    navigate(toDay ? '/plan' : `/ejercicios/${ex.id}`)
  }

  return (
    <section className="space-y-4">
      <Link to={back} className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← {dayId ? 'Plan' : 'Ejercicios'}</Link>
      <h1 className="title text-3xl">Ejercicio nuevo</h1>
      <Card className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-400">Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Remo en máquina (agarre neutro)" className="mt-1 h-12 w-full rounded-xl bg-bg px-3 ring-1 ring-line" />
        </label>
        <div className="text-sm">
          <span className="text-slate-400">Unidad</span>
          <div role="group" aria-label="Unidad" className="mt-1 flex flex-wrap gap-1.5">
            {UNITS.map((u) => <Chip key={u} compact active={unit === u} onClick={() => pickUnit(u)}>{UNIT_LABEL[u]}</Chip>)}
          </div>
        </div>
        <div className="flex gap-2">
          <Stepper compact label={cardio ? 'Mín. (min)' : 'Reps mín.'} value={d.range[0]} step={1} min={1} decimal={false} onChange={(v) => v && setD({ ...d, range: [v, Math.max(v, d.range[1])] })} />
          <Stepper compact label={cardio ? 'Máx. (min)' : 'Reps máx.'} value={d.range[1]} step={1} min={1} decimal={false} onChange={(v) => v && setD({ ...d, range: [Math.min(v, d.range[0]), v] })} />
        </div>
        <div className="flex gap-2">
          <Stepper compact label={`Incremento (${UNIT_SHORT[unit]})`} value={d.increment} step={unit === 'bricks' ? 1 : 0.5} min={0.5} onChange={(v) => v && setD({ ...d, increment: v })} />
          {!cardio && <Stepper compact label="Descanso (s)" value={d.restSec} step={15} min={0} decimal={false} onChange={(v) => v != null && setD({ ...d, restSec: v })} />}
        </div>
        {!cardio && (
          <div className="text-sm">
            <span className="text-slate-400">Músculos primarios (1 serie cada uno)</span>
            <div role="group" aria-label="Músculos primarios" className="mt-1 flex flex-wrap gap-1">
              {MUSCLES.map((m) => <Chip key={m} active={primary.includes(m)} onClick={() => setPrimary((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}>{MUSCLE_LABELS[m]}</Chip>)}
            </div>
          </div>
        )}
        <label className="block text-sm">
          <span className="text-slate-400">Familia (opcional: si es otra forma de hacer un ejercicio que ya tenés, elegí su familia)</span>
          <input list="families" value={family} onChange={(e) => setFamily(e.target.value)} className="mt-1 h-12 w-full rounded-xl bg-bg px-3 ring-1 ring-line" />
          <datalist id="families">{data.families.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
        <Button variant="primary" className="w-full" disabled={!valid || busy} onClick={() => void create()}>
          {toDay ? `Crear y agregar a ${toDay.name}` : 'Crear'}
        </Button>
        <p className="text-xs text-slate-400">
          Empieza sin historial y sin sugerencia de peso. Rango, paso y descanso son valores de arranque; los músculos secundarios, las zonas de molestia, la barra y las notas se completan después en Ejercicios.
        </p>
      </Card>
    </section>
  )
}
