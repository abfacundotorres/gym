import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getDB } from '../../data/db'
import { useExerciseMap, useSettings } from '../../data/hooks'
import { discardSession, finishSession, groupSessionItems } from '../../data/sessionRepo'
import { formatDDMM } from '../../engine/dates'
import { formatLoad } from '../../engine/load'
import { formatSet, lastExposure, sessionProgress } from '../../engine/session'
import { useWakeLock } from '../../lib/wakeLock'
import { readinessLevel } from '../../engine/readiness'
import { BottomBar } from '../../ui/BottomBar'
import { Button } from '../../ui/Button'
import { groupError, SUPERSET_MAX, SUPERSET_MIN } from '../../engine/superset'
import { Segments } from '../../ui/Segments'
import { Chip } from '../../ui/Stepper'
import { todaysRecommendation } from './recommendation'
import { useSessionData } from './useSessionData'

export function SessionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useSessionData(id)
  const exercises = useExerciseMap()
  const settings = useSettings()
  const [finishing, setFinishing] = useState(false)
  const [note, setNote] = useState('')
  /** Armando una superserie: se eligen los ejercicios que van juntos (D-66). */
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<number[]>([])
  const [now, setNow] = useState(() => Date.now())
  const history = useLiveQuery(async () => (data?.session ? getDB().sessions.where('exerciseIds').anyOf(data.session.exerciseIds).toArray() : []), [data?.session.exerciseIds.join()])
  useWakeLock(data?.session.status === 'in_progress')
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (data === null) return <p className="text-slate-400">Sesión no encontrada.</p>
  if (!data || !exercises) return null
  const { session, plan } = data
  const planned = new Map(plan?.items.map((i) => [i.exerciseId, i]) ?? [])
  const inProgress = session.status === 'in_progress'

  const prog = sessionProgress(session, plan)
  const rows = session.items.map((it, idx) => {
    const p = planned.get(it.exerciseId) ?? (it.swappedFrom ? planned.get(it.swappedFrom) : undefined)
    const { done: w, target, complete } = prog.items[idx]!
    return { it, idx, p, w, target, complete }
  })
  const { totalSets, doneSets } = prog
  const eligible = (r: (typeof rows)[number]) => !r.it.skipped && !r.complete && !r.it.group && exercises.get(r.it.exerciseId)?.unit !== 'minutes'
  const pickError = groupError(session.items, picked)
  const current = prog.currentIndex != null ? rows[prog.currentIndex] : undefined
  const minutes = session.startedAt ? Math.max(0, Math.floor((now - session.startedAt) / 60000)) : null

  const currentEx = current ? exercises.get(current.it.exerciseId) : undefined
  const currentRec = current && currentEx && history && currentEx.unit !== 'minutes'
    ? todaysRecommendation(currentEx, session, current.p, history, settings.kgPerBrick).rec
    : null

  return (
    <section className="space-y-4">
      <header>
        <div className="flex items-center justify-between">
          <Link to={inProgress ? '/' : '/historial'} className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← {inProgress ? 'Salir' : 'Historial'}</Link>
          {totalSets > 0 && <span className="eyebrow text-accent tabular-nums">{doneSets}/{totalSets} series</span>}
        </div>
        <h1 className="title text-4xl">{plan?.name ?? session.planDayId}</h1>
        <p className="eyebrow mt-1.5 text-slate-400">
          {inProgress ? `En curso${minutes != null ? ` · ${minutes} min` : ''}` : 'Terminada'} · {formatDDMM(session.date)}
        </p>
        {totalSets > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label="Series hechas" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}>
            <div className="h-full rounded-full bg-accent-solid" style={{ width: `${Math.min(100, (doneSets / totalSets) * 100)}%` }} />
          </div>
        )}
      </header>
      {inProgress && !session.deload && readinessLevel(session.readiness) === 'low' && (
        <p role="status" className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-100 ring-1 ring-amber-500/30">
          Sueño y energía bajos hoy: mantené los pesos y, si querés, dejá cada ejercicio con una serie menos. Es una sugerencia, vos decidís.
        </p>
      )}
      {inProgress && !session.deload && session.short && (
        <p role="status" className="rounded-2xl bg-sky-500/10 p-3 text-sm text-sky-200 ring-1 ring-sky-500/30">
          Poco tiempo: sin ejercicios opcionales. Si querés, dejá cada ejercicio con una serie menos.
        </p>
      )}
      {inProgress && !finishing && !picking && rows.filter(eligible).length >= SUPERSET_MIN && (
        <Chip active={false} onClick={() => { setPicking(true); setPicked([]) }}>Hacer superserie</Chip>
      )}
      {picking && (
        <p role="status" className="rounded-2xl bg-accent/10 p-3 text-sm ring-1 ring-accent/40">
          Elegí {SUPERSET_MIN} o {SUPERSET_MAX} ejercicios que hacés juntos. <span className="tabular-nums text-slate-300">({picked.length} elegidos)</span>
        </p>
      )}
      <ol className="space-y-2">
        {rows.map(({ it, idx, p, w, target, complete }) => {
          const ex = exercises.get(it.exerciseId)
          const last = history && lastExposure(history, it.exerciseId, session.date, session.id)
          const isCurrent = current?.idx === idx
          const todayText = isCurrent && currentRec && currentEx && currentRec.weight != null && currentRec.targets.length
            ? `Hoy: ${formatLoad(currentEx, currentRec.weight, settings.kgPerBrick)} × ${currentRec.targets.join('·')}`
            : null
          const row = rows[idx]!
          const isPicked = picked.includes(idx)
          const canPick = eligible(row) && (isPicked || picked.length < SUPERSET_MAX)
          const groupStart = !!it.group && session.items[idx - 1]?.group !== it.group
          const rowClass = `flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ${isCurrent ? 'bg-surface ring-2 ring-accent' : it.group ? 'bg-surface ring-accent/50' : 'bg-surface ring-transparent'} ${it.skipped ? 'opacity-50' : ''}`
          const content = (
            <>
                <span className={`digits flex size-8 shrink-0 items-center justify-center rounded-[10px] text-base ${picking ? (isPicked ? 'bg-accent-solid text-on-accent' : 'bg-raised text-slate-400') : complete ? 'bg-accent-solid text-on-accent' : 'bg-raised text-slate-400'}`}>
                  {picking ? (isPicked ? '✓' : '') : complete ? '✓' : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{ex?.name ?? it.exerciseId}{p?.optional && <span className="font-normal text-slate-400"> (opcional)</span>}</div>
                  <div className="truncate text-xs text-slate-400">
                    {it.skipped ? (
                      'Salteado'
                    ) : todayText && !it.sets.length ? (
                      <span className="text-accent">{todayText}</span>
                    ) : it.sets.length ? (
                      it.sets.filter((s) => s.type === 'W').map(formatSet).join(' · ')
                    ) : last ? (
                      `Última (${formatDDMM(last.date)}): ${last.item.sets.filter((s) => s.type === 'W').map(formatSet).join(' · ') || 'sin series'}`
                    ) : (
                      'Sin historial'
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Segments done={w} total={target} />
                  <span className="sr-only">{complete ? 'Completo' : `${w} de ${target} series`}</span>
                </div>
            </>
          )
          return (
            <li key={`${it.exerciseId}-${idx}`}>
              {groupStart && <p className="eyebrow mb-1 mt-2 px-1 text-accent">Superserie</p>}
              {picking ? (
                <button role="checkbox" aria-checked={isPicked} disabled={!canPick} aria-label={`Elegir ${ex?.name ?? it.exerciseId}`} onClick={() => setPicked(isPicked ? picked.filter((i) => i !== idx) : [...picked, idx])} className={`${rowClass} ${isPicked ? '!ring-2 !ring-accent' : ''} ${!canPick && !isPicked ? 'opacity-40' : ''}`}>
                  {content}
                </button>
              ) : (
                <Link to={`/sesion/${session.id}/${idx}`} className={rowClass}>
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      {inProgress && finishing && (
        <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <label className="block text-sm text-slate-300">
            Nota de la sesión (opcional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-xl bg-bg p-2 ring-1 ring-line" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setFinishing(false)}>Volver</Button>
            <Button variant="primary" onClick={async () => { await finishSession(getDB(), session.id, note); navigate(`/sesion/${session.id}/resumen`, { replace: true }) }}>
              Terminar
            </Button>
          </div>
          <button
            className="w-full py-2 text-sm text-red-300"
            onClick={async () => {
              if (confirm('¿Descartar la sesión? Se borran todas las series registradas.')) {
                await discardSession(getDB(), session.id)
                navigate('/', { replace: true })
              }
            }}
          >
            Descartar sesión
          </button>
        </div>
      )}
      {inProgress && !finishing && picking && (
        <BottomBar>
          <div className="flex gap-2">
            <Button className="basis-2/5" onClick={() => { setPicking(false); setPicked([]) }}>Cancelar</Button>
            <Button
              variant="primary"
              className="min-w-0 flex-1"
              disabled={pickError != null}
              onClick={async () => {
                const start = await groupSessionItems(getDB(), session.id, picked)
                setPicking(false)
                setPicked([])
                navigate(`/sesion/${session.id}/${start}`)
              }}
            >
              Agrupar{picked.length ? ` (${picked.length})` : ''}
            </Button>
          </div>
        </BottomBar>
      )}
      {inProgress && !finishing && !picking && (
        <BottomBar>
          <div className="flex gap-2">
            <Button variant={current ? 'secondary' : 'primary'} aria-label="Terminar sesión" className={current ? 'basis-2/5' : 'flex-1'} onClick={() => setFinishing(true)}>
              Terminar
            </Button>
            {current && (
              <Button variant="primary" className="min-w-0 flex-1 truncate" onClick={() => navigate(`/sesion/${session.id}/${current.idx}`)}>
                <span className="block truncate">Seguir: {current.it.group ? 'Superserie' : (currentEx?.name ?? 'ejercicio')} →</span>
              </Button>
            )}
          </div>
        </BottomBar>
      )}
      {session.status === 'finished' && (
        <Button className="w-full" onClick={() => navigate(`/sesion/${session.id}/resumen`)}>Ver resumen</Button>
      )}
    </section>
  )
}
