import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap, useRules, useSettings } from '../../data/hooks'
import { addDays, formatDDMM, toISODate, weekStart } from '../../engine/dates'
import { num } from '../../engine/format'
import { PHASE_LABEL } from '../../engine/phase'
import { blockSummary, summaryText, weekSummary, type PeriodSummary, type SummaryInput } from '../../engine/summary'
import { MUSCLE_LABELS, ZONE_LABELS, type Mesocycle } from '../../engine/types'
import { copyText } from '../../lib/clipboard'
import { Button, Card } from '../../ui/Button'
import { Chip } from '../../ui/Stepper'

type Mode = 'week' | 'block'

/**
 * Resumen por semana o por bloque (D-80): sesiones, series por músculo contra tu rango, PRs, RIR y avisos, molestias y peso,
 * todo junto y copiable como texto. Es descriptivo: no propone nada.
 */
export function PeriodSummaryPage() {
  const today = toISODate(new Date())
  const settings = useSettings()
  const rules = useRules()
  const exercises = useExerciseMap()
  const [mode, setMode] = useState<Mode>('week')
  const [back, setBack] = useState(0) // semanas hacia atrás
  const [mesoId, setMesoId] = useState<string | null>(null)
  const [copied, setCopied] = useState<boolean | null>(null)
  const data = useLiveQuery(async () => {
    const db = getDB()
    const [sessions, planDays, mesocycles, zoneIssues, bodyweights] = await Promise.all([
      db.sessions.toArray(), db.planDays.orderBy('weekday').toArray(), db.mesocycles.orderBy('startDate').toArray(), db.zoneIssues.toArray(), db.bodyweights.toArray(),
    ])
    return { sessions, planDays, mesocycles, zoneIssues, bodyweights }
  })
  if (!data || !exercises) return null

  const finished = data.sessions.filter((s) => s.status === 'finished')
  if (finished.length === 0) {
    return (
      <section className="space-y-4">
        <Back />
        <h1 className="title text-3xl">Resumen</h1>
        <p className="rounded-2xl bg-surface p-4 text-sm text-slate-400">Todavía no hay sesiones terminadas. Cuando termines la primera, el resumen aparece acá.</p>
      </section>
    )
  }

  const input: SummaryInput = { ...data, exercises, settings, rules }
  const monday = addDays(weekStart(today), -7 * back)
  const oldest = weekStart(finished.reduce((a, s) => (s.date < a ? s.date : a), finished[0]!.date))
  const mesos = [...data.mesocycles].reverse()
  const meso: Mesocycle | undefined = mesos.find((m) => m.id === mesoId) ?? mesos.find((m) => m.status === 'active') ?? mesos[0]
  const summary: PeriodSummary | null = mode === 'week' ? weekSummary(input, monday) : meso ? blockSummary(input, meso, today) : null
  const text = summary ? summaryText(summary, exercises) : ''
  const name = (id: string) => exercises.get(id)?.name ?? id

  const pick = (m: Mode) => { setMode(m); setCopied(null) }
  return (
    <section className="space-y-4">
      <Back />
      <h1 className="title text-3xl">Resumen</h1>
      <div role="group" aria-label="Período" className="flex gap-2">
        <Chip active={mode === 'week'} onClick={() => pick('week')}>Semana</Chip>
        <Chip active={mode === 'block'} onClick={() => pick('block')}>Bloque</Chip>
      </div>

      {mode === 'week' ? (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" aria-label="Semana anterior" disabled={monday <= oldest} className="!min-h-11 px-4" onClick={() => { setBack(back + 1); setCopied(null) }}>←</Button>
          <p className="text-center text-sm">
            <span className="font-semibold">{formatDDMM(monday)} al {formatDDMM(addDays(monday, 6))}</span>
            {back === 0 && <span className="block text-xs text-slate-400">esta semana</span>}
          </p>
          <Button variant="ghost" aria-label="Semana siguiente" disabled={back === 0} className="!min-h-11 px-4" onClick={() => { setBack(back - 1); setCopied(null) }}>→</Button>
        </div>
      ) : (
        mesos.length > 1 && (
          <select aria-label="Bloque" value={meso?.id} onChange={(e) => { setMesoId(e.target.value); setCopied(null) }} className="h-12 w-full rounded-xl bg-surface px-3 ring-1 ring-line">
            {mesos.map((m) => <option key={m.id} value={m.id}>{formatDDMM(m.startDate)}{m.phase ? ` · ${PHASE_LABEL[m.phase]}` : ''}{m.status === 'active' ? ' (actual)' : ''}</option>)}
          </select>
        )
      )}

      {!summary ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-slate-400">No hay ningún bloque.</p>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            {summary.kind === 'block' && <>Del {formatDDMM(summary.from)} al {formatDDMM(summary.to)}{summary.phase ? ` · ${PHASE_LABEL[summary.phase]}` : ''}. </>}
            {summary.kind === 'block' ? `${summary.weeks} ${summary.weeks === 1 ? 'semana' : 'semanas'} con sesiones sin contar el deload.` : null}
          </p>

          <Card className="space-y-2">
            <p className="font-semibold">
              {summary.sessions.length}{summary.plannedSessions != null ? ` de ${summary.plannedSessions}` : ''} {summary.sessions.length === 1 ? 'sesión' : 'sesiones'}
              <span className="font-normal text-slate-400"> · {num(summary.doneSets)} series efectivas</span>
            </p>
            {summary.sessions.length === 0 ? (
              <p className="text-sm text-slate-400">Sin sesiones en este período.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {summary.sessions.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sesion/${s.id}/resumen`} className="flex min-h-11 items-center justify-between gap-2 border-t border-line">
                      <span className="min-w-0 truncate">{formatDDMM(s.date)} · {s.planName}{s.tag && <span className="ml-1.5 rounded bg-sky-500/15 px-1.5 py-0.5 text-xs text-sky-300">{s.tag}</span>}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{num(s.sets)} series{s.minutes != null ? ` · ${s.minutes} min` : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {summary.sessions.length > 0 && (
            <Card className="space-y-2">
              <p className="eyebrow text-slate-400">{summary.kind === 'week' ? 'Series por músculo' : 'Series por semana (promedio)'}</p>
              <ul className="grid grid-cols-1 gap-1 text-sm">
                {summary.volume.map((v) => (
                  <li key={v.muscle} className="flex justify-between gap-2">
                    <span>{MUSCLE_LABELS[v.muscle]}</span>
                    <span className={`tabular-nums ${v.status === 'in' ? 'text-accent' : v.status === 'below' ? 'text-amber-300' : 'text-sky-300'}`}>
                      {num(v.sets)} <span className="text-slate-500">/ {num(v.target[0])}-{num(v.target[1])}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {summary.sessions.some((s) => s.tag === 'deload') && summary.kind === 'week' && <p className="text-xs text-slate-400">Semana de deload: el rango de series no aplica.</p>}
            </Card>
          )}

          {summary.prs.length > 0 && (
            <Card className="space-y-1">
              <p className="eyebrow text-accent">Récords ({summary.prs.length})</p>
              <ul className="space-y-1 text-sm">
                {summary.prs.map((p) => <li key={p.setId} className="flex justify-between gap-2"><span className="truncate">{formatDDMM(p.date)} {name(p.exerciseId)}</span><span className="tabular-nums text-accent">{p.kind === 'e1rm' ? 'e1RM' : 'reps'}</span></li>)}
              </ul>
            </Card>
          )}

          {summary.sessions.length > 0 && (
            <Card className="space-y-1 text-sm">
              <p className="eyebrow text-slate-400">RIR y avisos</p>
              <p>RIR cargado en {summary.rir.withRir} de {summary.rir.total} ejercicios</p>
              <p>{summary.failureSessions === 0 ? 'Ninguna sesión con compuestos al fallo.' : `Sesiones con compuestos al fallo: ${summary.failureSessions}.`}</p>
              {summary.spikes.map((s) => <p key={s.muscle}>Salto de volumen: {MUSCLE_LABELS[s.muscle]} {num(s.sets)} series, {s.pct} % sobre tu promedio ({num(s.baseline)}).</p>)}
            </Card>
          )}

          {summary.zones.length > 0 && (
            <Card className="space-y-1 text-sm">
              <p className="eyebrow text-slate-400">Molestias</p>
              <ul className="space-y-0.5">
                {summary.zones.map((z) => <li key={`${z.zone}-${z.startedOn}`}>{ZONE_LABELS[z.zone]} · {z.severity} · desde {formatDDMM(z.startedOn)}{z.resolvedOn ? `, pasó el ${formatDDMM(z.resolvedOn)}` : ' (sigue)'}</li>)}
              </ul>
            </Card>
          )}

          {summary.weight && (
            <Card className="text-sm">
              <p className="eyebrow mb-1 text-slate-400">Peso</p>
              <p>{num(summary.weight.kg)} kg{summary.weight.change != null && <span className="text-slate-400"> ({summary.weight.change > 0 ? '+' : ''}{num(summary.weight.change)} {summary.kind === 'week' ? 'contra la semana anterior' : 'en el bloque'})</span>}</p>
            </Card>
          )}

          <Button className="w-full" onClick={async () => setCopied(await copyText(text))}>Copiar resumen como texto</Button>
          {copied != null && <p role="status" className="text-sm text-slate-400">{copied ? 'Copiado.' : 'No se pudo copiar. Mantené apretado el texto para seleccionarlo.'}</p>}
          <details className="text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center text-slate-400">Ver el texto</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-xs text-slate-300">{text}</pre>
          </details>
        </>
      )}
    </section>
  )
}

function Back() {
  return <Link to="/historial" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Historial</Link>
}
