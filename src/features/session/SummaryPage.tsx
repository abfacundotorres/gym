import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useExerciseMap } from '../../data/hooks'
import { formatDDMM } from '../../engine/dates'
import { num } from '../../engine/format'
import { sessionStats, summaryText } from '../../engine/session'
import { MUSCLE_LABELS, type Muscle } from '../../engine/types'
import { volumeByMuscle } from '../../engine/volume'
import { copyText } from '../../lib/clipboard'
import { Button, Card } from '../../ui/Button'
import { useSessionData } from './useSessionData'

export function SummaryPage() {
  const { id } = useParams()
  const data = useSessionData(id)
  const exercises = useExerciseMap()
  const [copied, setCopied] = useState<boolean | null>(null)
  if (!data || !exercises) return null
  const { session, plan } = data
  const stats = sessionStats(session, plan)
  const volume = Object.entries(volumeByMuscle(session.items, exercises)).sort((a, b) => b[1].total - a[1].total)
  const text = summaryText(session, plan, exercises)

  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm text-slate-400">{formatDDMM(session.date)}{stats.minutes != null && ` · ${stats.minutes} min`}</p>
        <h1 className="text-2xl font-bold">Resumen: {plan?.name ?? session.planDayId}</h1>
      </header>
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <div className="text-3xl font-semibold tabular-nums">{num(stats.doneSets)}<span className="text-base text-slate-400">/{stats.plannedSets}</span></div>
          <div className="text-xs text-slate-400">series efectivas vs plan</div>
        </Card>
        <Card>
          <div className="text-3xl font-semibold tabular-nums">{stats.exercisesDone}<span className="text-base text-slate-400">/{stats.exercisesPlanned}</span></div>
          <div className="text-xs text-slate-400">ejercicios del plan</div>
        </Card>
      </div>
      {volume.length > 0 && (
        <Card>
          <p className="mb-2 text-xs text-slate-400">Volumen del día (series por músculo)</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {volume.map(([m, v]) => (
              <li key={m} className="flex justify-between"><span>{MUSCLE_LABELS[m as Muscle]}</span><span className="tabular-nums">{num(v.total)}</span></li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-slate-400">Los PRs se muestran desde el hito H3.</p>
      <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface p-3 text-xs ring-1 ring-line">{text}</pre>
      <Button variant="primary" className="w-full" onClick={async () => setCopied(await copyText(text))}>
        {copied ? 'Copiado ✓' : 'Copiar resumen como texto'}
      </Button>
      {copied === false && <p className="text-sm text-red-300">No se pudo copiar. Seleccioná el texto de arriba.</p>}
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/sesion/${session.id}`} className="flex min-h-12 items-center justify-center rounded-xl ring-1 ring-line">Ver / editar</Link>
        <Link to="/" className="flex min-h-12 items-center justify-center rounded-xl ring-1 ring-line">Inicio</Link>
      </div>
    </section>
  )
}
