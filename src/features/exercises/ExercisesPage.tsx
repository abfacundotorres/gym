import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { Chip } from '../../ui/Stepper'

export function ExercisesPage() {
  const [showArchived, setShowArchived] = useState(false)
  const exercises = useLiveQuery(() => getDB().exercises.toArray())
  if (!exercises) return null
  const families = new Map<string, typeof exercises>()
  for (const e of [...exercises].sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.archived && !showArchived) continue
    families.set(e.family, [...(families.get(e.family) ?? []), e])
  }
  return (
    <section className="space-y-4">
      <Link to="/plan" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Plan</Link>
      <h1 className="title text-3xl">Ejercicios</h1>
      <Chip active={showArchived} onClick={() => setShowArchived(!showArchived)}>Mostrar archivados</Chip>
      {[...families.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fam, exs]) => (
        <div key={fam}>
          <h2 className="mb-1 text-xs uppercase tracking-wide text-slate-500">{fam.replace(/_/g, ' ')}</h2>
          <ul className="space-y-1">
            {exs.map((e) => (
              <li key={e.id}>
                <Link to={`/ejercicios/${e.id}`} className={`flex items-center gap-3 rounded-2xl bg-surface p-3.5 ${e.archived ? 'opacity-60' : ''}`}>
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.archived && <span className="text-xs text-slate-400">archivado</span>}
                  <span className="text-xs tabular-nums text-slate-400">{e.range[0]}-{e.range[1]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
