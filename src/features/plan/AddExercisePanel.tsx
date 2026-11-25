import { useState } from 'react'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { addExerciseToDay } from '../../data/planRepo'
import { addableExercises } from '../../engine/planEdit'
import type { Exercise, PlanDay } from '../../engine/types'
import { Button } from '../../ui/Button'

const SHOWN = 8

/** Sumar un ejercicio al final del día (D-83): uno que ya existe (con buscador) o uno nuevo. */
export function AddExercisePanel({ day, exercises }: { day: PlanDay; exercises: Map<string, Exercise> }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  if (!open) return <Button className="w-full" onClick={() => setOpen(true)}>+ Agregar ejercicio</Button>
  const all = addableExercises(day, exercises.values())
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const found = q.trim() ? all.filter((e) => norm(e.name).includes(norm(q.trim()))) : all
  return (
    <div role="group" aria-label={`Agregar a ${day.name}`} className="space-y-2 rounded-2xl bg-surface p-3">
      <input aria-label="Buscar ejercicio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar entre tus ejercicios" className="h-12 w-full rounded-xl bg-bg px-3 ring-1 ring-line" />
      <ul className="space-y-1.5">
        {found.slice(0, SHOWN).map((e) => (
          <li key={e.id}>
            <Button className="w-full justify-start text-left" onClick={async () => { await addExerciseToDay(getDB(), day.id, e.id); setOpen(false); setQ('') }}>+ {e.name}</Button>
          </li>
        ))}
      </ul>
      {found.length > SHOWN && <p className="text-xs text-slate-400">Hay {found.length - SHOWN} más: escribí para buscar.</p>}
      {found.length === 0 && <p className="text-xs text-slate-400">{q.trim() ? 'No hay ninguno con ese nombre.' : 'Ya están todos tus ejercicios en este día.'}</p>}
      <Link to={`/ejercicio-nuevo?dia=${encodeURIComponent(day.id)}`} className="flex min-h-13 items-center justify-center rounded-2xl bg-accent-solid px-4 font-bold text-on-accent">Crear un ejercicio nuevo</Link>
      <Button variant="ghost" className="w-full" onClick={() => { setOpen(false); setQ('') }}>Cancelar</Button>
    </div>
  )
}
