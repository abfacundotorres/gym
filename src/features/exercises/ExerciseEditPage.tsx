import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getDB } from '../../data/db'
import { createVariant, saveExercise } from '../../data/exerciseRepo'
import { UNIT_SHORT } from '../../engine/load'
import { MUSCLES, MUSCLE_LABELS, UNITS, type Exercise, type Muscle } from '../../engine/types'
import { Button, Card } from '../../ui/Button'
import { Chip, Stepper } from '../../ui/Stepper'

const UNIT_LABEL: Record<Exercise['unit'], string> = {
  per_side: 'Por lado (discos)',
  per_hand: 'Por mano (mancuerna)',
  total: 'Total (polea/pila)',
  bricks: 'Ladrillos',
  minutes: 'Minutos (cardio)',
}

export function ExerciseEditPage() {
  const { exId } = useParams()
  const data = useLiveQuery(async () => {
    const db = getDB()
    const ex = await db.exercises.get(exId!)
    const used = await db.sessions.where('exerciseIds').equals(exId!).count()
    const families = [...new Set((await db.exercises.toArray()).map((e) => e.family))].sort()
    return { ex, used, families }
  }, [exId])
  if (!data) return null
  if (!data.ex) return <p className="text-slate-400">Ejercicio no encontrado.</p>
  return <Form key={data.ex.id} initial={data.ex} used={data.used} families={data.families} />
}

function Form({ initial, used, families }: { initial: Exercise; used: number; families: string[] }) {
  const navigate = useNavigate()
  const [ex, setEx] = useState(initial)
  const [variantName, setVariantName] = useState('')
  const [saved, setSaved] = useState(false)
  const patch = (p: Partial<Exercise>) => { setEx((e) => ({ ...e, ...p })); setSaved(false) }
  const valid = ex.name.trim() && ex.family.trim() && ex.range[0] >= 1 && ex.range[0] <= ex.range[1] && ex.increment > 0
  const toggleMuscle = (m: Muscle, role: 'primary' | 'secondary') => {
    const other = role === 'primary' ? 'secondary' : 'primary'
    const has = ex[role].includes(m)
    patch({ [role]: has ? ex[role].filter((x) => x !== m) : [...ex[role], m], [other]: ex[other].filter((x) => x !== m) } as Partial<Exercise>)
  }

  return (
    <section className="space-y-4">
      <Link to="/ejercicios" className="block py-1 text-sm text-slate-400">← Ejercicios</Link>
      <h1 className="title text-3xl">{initial.name}</h1>
      <p className="text-xs text-slate-400">Usado en {used} {used === 1 ? 'sesión' : 'sesiones'}. Cada variante tiene su propio historial.</p>

      <Card className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-400">Nombre</span>
          <input value={ex.name} onChange={(e) => patch({ name: e.target.value })} className="mt-1 h-12 w-full rounded-lg bg-bg px-3 ring-1 ring-line" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Familia (agrupa variantes del mismo patrón)</span>
          <input list="families" value={ex.family} onChange={(e) => patch({ family: e.target.value })} className="mt-1 h-12 w-full rounded-lg bg-bg px-3 ring-1 ring-line" />
          <datalist id="families">{families.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Unidad</span>
          <select value={ex.unit} onChange={(e) => patch({ unit: e.target.value as Exercise['unit'] })} className="mt-1 h-12 w-full rounded-lg bg-bg px-3 ring-1 ring-line">
            {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
          </select>
          {used > 0 && ex.unit !== initial.unit && <span className="mt-1 block text-xs text-amber-300">Cambiar la unidad no convierte los pesos ya registrados.</span>}
        </label>
        {ex.unit === 'per_side' && (
          <Stepper label="Peso de la barra / carro (kg, vacío si no se sabe)" value={ex.barKg ?? null} step={2.5} onChange={(v) => { const { barKg: _b, ...rest } = ex; setEx(v == null ? rest : { ...rest, barKg: v }); setSaved(false) }} />
        )}
        <div className="flex gap-2">
          <Stepper label={ex.cardio ? 'Mín. (min)' : 'Reps mín.'} value={ex.range[0]} step={1} min={1} decimal={false} onChange={(v) => v && patch({ range: [v, Math.max(v, ex.range[1])] })} />
          <Stepper label={ex.cardio ? 'Máx. (min)' : 'Reps máx.'} value={ex.range[1]} step={1} min={1} decimal={false} onChange={(v) => v && patch({ range: [Math.min(v, ex.range[0]), v] })} />
        </div>
        <div className="flex gap-2">
          <Stepper label={`Incremento (${UNIT_SHORT[ex.unit]})`} value={ex.increment} step={ex.unit === 'bricks' ? 1 : 0.5} min={0.5} onChange={(v) => v && patch({ increment: v })} />
          <Stepper label="Descanso (s)" value={ex.restSec} step={15} min={0} decimal={false} onChange={(v) => v != null && patch({ restSec: v })} />
        </div>
        <div className="text-sm">
          <span className="text-slate-400">Aproximaciones</span>
          <div className="mt-1 flex gap-2">
            {(['heavy', 'light', 'none'] as const).map((w) => (
              <Chip key={w} active={ex.warmup === w} onClick={() => patch({ warmup: w })}>{w === 'heavy' ? 'Pesadas (4)' : w === 'light' ? 'Liviana (1)' : 'Ninguna'}</Chip>
            ))}
          </div>
        </div>
        {!ex.cardio && (['primary', 'secondary'] as const).map((role) => (
          <div key={role} className="text-sm">
            <span className="text-slate-400">{role === 'primary' ? 'Músculos primarios (1 serie)' : 'Secundarios (½ serie)'}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {MUSCLES.map((m) => <Chip key={m} active={ex[role].includes(m)} onClick={() => toggleMuscle(m, role)}>{MUSCLE_LABELS[m]}</Chip>)}
            </div>
          </div>
        ))}
        <label className="block text-sm">
          <span className="text-slate-400">Nota de seguridad (se muestra una vez por sesión)</span>
          <textarea value={ex.safetyNote ?? ''} onChange={(e) => { const { safetyNote: _s, ...rest } = ex; setEx(e.target.value ? { ...rest, safetyNote: e.target.value } : rest); setSaved(false) }} rows={2} className="mt-1 w-full rounded-lg bg-bg p-2 ring-1 ring-line" />
        </label>
        <Button variant="primary" className="w-full" disabled={!valid} onClick={async () => { await saveExercise(getDB(), { ...ex, name: ex.name.trim(), family: ex.family.trim() }); setSaved(true) }}>
          {saved ? 'Guardado ✓' : 'Guardar'}
        </Button>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-medium">Nueva variante de la familia</p>
        <p className="text-xs text-slate-400">Copia esta configuración con otro nombre. Empieza sin historial.</p>
        <input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="Ej.: Jalón con agarre en V" className="h-12 w-full rounded-lg bg-bg px-3 ring-1 ring-line" />
        <Button className="w-full" disabled={!variantName.trim()} onClick={async () => { const v = await createVariant(getDB(), ex, variantName.trim()); navigate(`/ejercicios/${v.id}`) }}>
          Crear variante
        </Button>
      </Card>

      <Button variant={initial.archived ? 'secondary' : 'danger'} className="w-full" onClick={async () => { await saveExercise(getDB(), initial.archived ? (({ archived: _a, ...r }) => r)(initial) : { ...initial, archived: true }); navigate('/ejercicios') }}>
        {initial.archived ? 'Desarchivar' : 'Archivar'}
      </Button>
      <p className="text-xs text-slate-400">Archivar lo oculta del catálogo y de las alternativas; el historial se conserva.</p>
    </section>
  )
}
