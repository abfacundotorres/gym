import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getDB } from '../../data/db'
import { useSettings } from '../../data/hooks'
import { addSet, deleteSet, setItemNote, setItemPain, setSkipped, swapExercise, updateSet } from '../../data/sessionRepo'
import { familyReference, variantOptions } from '../../engine/variants'
import { formatDDMM } from '../../engine/dates'
import { formatLoad, UNIT_SHORT } from '../../engine/load'
import { formatRest } from '../../engine/format'
import { formatSet, lastExposure } from '../../engine/session'
import type { Recommendation } from '../../engine/progression'
import { findPRs } from '../../engine/prs'
import { validSets, workingWeight } from '../../engine/validity'
import { warmupSets } from '../../engine/warmup'
import { SetBadges } from '../../ui/SetBadges'
import { deloadSets } from '../../engine/periodization'
import { reducedSets } from '../../engine/readiness'
import { SET_FLAGS, type Exercise, type SetEntry, type SetFlag } from '../../engine/types'
import { startRest } from '../../lib/restTimer'
import { useWakeLock } from '../../lib/wakeLock'
import { BottomBar } from '../../ui/BottomBar'
import { Button } from '../../ui/Button'
import { Segments } from '../../ui/Segments'
import { Chip, Stepper } from '../../ui/Stepper'
import { todaysRecommendation } from './recommendation'
import { useSessionData } from './useSessionData'

const FLAG_LABEL: Record<SetFlag, string> = { rp: 'Rest-pause', drop: 'Drop', rebote: 'Rebote', asist: 'Asistida' }
type Draft = Omit<SetEntry, 'id'>

/** Cada ejercicio es una pantalla nueva (el key reinicia menú, aproximaciones y edición). */
export function ExercisePage() {
  const { idx } = useParams()
  return <ExerciseScreen key={idx} />
}

function ExerciseScreen() {
  const { id, idx: idxParam } = useParams()
  const idx = Number(idxParam)
  const navigate = useNavigate()
  const db = getDB()
  const data = useSessionData(id)
  const settings = useSettings()
  const exerciseId = data?.session.items[idx]?.exerciseId
  const ctx = useLiveQuery(async () => {
    if (!exerciseId) return null
    const ex = await db.exercises.get(exerciseId)
    const family = ex ? await db.exercises.where('family').equals(ex.family).toArray() : []
    const history = await db.sessions.where('exerciseIds').anyOf(family.map((f) => f.id).concat(exerciseId)).toArray()
    return { ex, history, family }
  }, [exerciseId])
  const [editing, setEditing] = useState<string | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [warmOpen, setWarmOpen] = useState(false)
  const [typed, setTyped] = useState<{ exId: string; weight: number | null } | null>(null)
  useWakeLock(data?.session.status === 'in_progress')

  // useLiveQuery devuelve el valor anterior hasta resolver el nuevo: no mezclar ejercicios.
  if (!data || !ctx?.ex || ctx.ex.id !== exerciseId) return null
  const { session, plan } = data
  const item = session.items[idx]!
  const ex = ctx.ex
  const planItem = plan?.items.find((p) => p.exerciseId === item.exerciseId || p.exerciseId === item.swappedFrom)
  const { deload, fewer, plannedSets, previous, rec } = todaysRecommendation(ex, session, planItem, ctx.history, settings.kgPerBrick)
  const last = lastExposure(ctx.history, ex.id, session.date, session.id)
  const lastW = last?.item.sets.filter((s) => s.type === 'W') ?? []
  const targets = rec.targets
  const done = item.sets
  const doneW = done.filter((s) => s.type === 'W')
  const lastDone = done.at(-1)
  const lastDoneW = doneW.at(-1)
  const prs = new Map(findPRs(ex, { item }, previous, settings.kgPerBrick).map((p) => [p.setId, p.kind]))
  const next = {
    weight: lastDoneW?.weight ?? rec.weight ?? lastDone?.weight ?? null,
    reps: targets[doneW.length] ?? lastDoneW?.reps ?? rec.repCap,
  }
  const lastItem = previous.at(-1)?.item
  // Mientras no haya efectivas, el peso de trabajo es el que tengas en el stepper (D-43).
  const workWeight = doneW.length === 0 && typed?.exId === ex.id ? typed.weight : next.weight
  const warmups = doneW.length === 0
    ? warmupSets(ex, workWeight, settings.kgPerBrick, lastItem ? { sets: lastItem.sets, workingWeight: workingWeight(validSets(lastItem)) } : undefined)
        .filter((w) => !done.some((d) => d.type === 'A' && d.weight === w.weight))
    : []
  const restSec = settings.restSecOverrides[ex.id] ?? ex.restSec
  const isCardio = ex.unit === 'minutes'
  const options = variantOptions(ex, planItem, ctx.family)
  const famRef = rec.status === 'no_history' ? familyReference(ex, ctx.family, ctx.history, session.date) : null
  const prevIdx = idx > 0 ? idx - 1 : null
  const nextIdx = idx < session.items.length - 1 ? idx + 1 : null

  async function log(d: Draft) {
    await addSet(db, session.id, idx, d)
    if (d.type === 'W' && restSec > 0 && !isCardio) startRest(restSec, ex.name)
  }

  const notDone = (it: (typeof session.items)[number]) => {
    const pi = plan?.items.find((p) => p.exerciseId === it.exerciseId || p.exerciseId === it.swappedFrom)
    const target = pi ? (session.deload ? deloadSets(pi.sets) : pi.sets) : 0
    return !it.skipped && !(target > 0 && it.sets.filter((x) => x.type === 'W').length >= target)
  }
  const doneA = done.filter((x) => x.type === 'A').length
  const warmTotal = doneA + warmups.length
  const inProgress = session.status === 'in_progress'

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link to={`/sesion/${session.id}`} className="-ml-1 py-2 pr-3 text-sm text-slate-400">← Sesión</Link>
        <ol className="flex flex-1 justify-center gap-1" aria-label={`Ejercicio ${idx + 1} de ${session.items.length}`}>
          {session.items.map((it, i) => (
            <li key={i} className={`h-1 w-5 max-w-full rounded-full ${i === idx ? 'bg-slate-100' : notDone(it) ? 'bg-raised' : 'bg-accent-solid'}`} />
          ))}
        </ol>
        {inProgress ? (
          <button
            aria-label="Más opciones"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative -mr-2 flex size-11 items-center justify-center rounded-full text-slate-300 active:bg-raised"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
            {(item.pain || item.note) && <span className="absolute right-2 top-2 size-2 rounded-full bg-accent-solid" />}
          </button>
        ) : <span className="size-11" />}
      </div>

      <header className="space-y-1.5">
        <h1 className="title text-[1.7rem]">{ex.name}</h1>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold text-slate-300">
          <span className="rounded-full bg-raised px-2.5 py-1">{plannedSets} series</span>
          <span className="rounded-full bg-raised px-2.5 py-1">{ex.range[0]}-{ex.range[1]} {isCardio ? 'min' : 'reps'}{ex.repsPerLeg && ' por pierna'}</span>
          {!isCardio && <span className="rounded-full bg-raised px-2.5 py-1">descanso {formatRest(restSec)}</span>}
        </div>
        {fewer && plannedSets > reducedSets(plannedSets) && <p className="text-xs text-slate-400">Hoy podés dejarlo en {reducedSets(plannedSets)} series.</p>}
        {item.swappedFrom && <p className="text-xs text-slate-400">En lugar de {ctx.family.find((f) => f.id === item.swappedFrom)?.name ?? item.swappedFrom}</p>}
      </header>

      {inProgress && menuOpen && (
        <div className="space-y-4 rounded-2xl bg-surface p-3 ring-1 ring-line" role="group" aria-label="Opciones del ejercicio">
          {options.length > 0 && (
            swapping ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">Cambiar por:</p>
                {options.map((o) => (
                  <Button
                    key={o.id}
                    className="w-full text-left"
                    onClick={async () => {
                      const to = await swapExercise(db, session.id, idx, o.id)
                      setSwapping(false)
                      setMenuOpen(false)
                      navigate(`/sesion/${session.id}/${to}`, { replace: true })
                    }}
                  >
                    {o.name}
                  </Button>
                ))}
                <Button variant="ghost" className="w-full" onClick={() => setSwapping(false)}>Cancelar</Button>
              </div>
            ) : (
              <Button className="w-full justify-start text-left" onClick={() => setSwapping(true)}>Ocupado → alternativa</Button>
            )
          )}
          {!isCardio && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Molestia o dolor">
              <span className="text-sm text-slate-400">¿Algo te molesta?</span>
              <Chip active={item.pain === 'molestia'} onClick={() => void setItemPain(db, session.id, idx, item.pain === 'molestia' ? null : 'molestia')}>Molestia</Chip>
              <Chip active={item.pain === 'dolor'} onClick={() => void setItemPain(db, session.id, idx, item.pain === 'dolor' ? null : 'dolor')}>Dolor</Chip>
            </div>
          )}
          <Button variant="ghost" className="w-full" disabled={done.length > 0 || item.skipped} onClick={() => { void setSkipped(db, session.id, idx, true); setMenuOpen(false) }}>
            Saltear ejercicio
          </Button>
          <ItemNote key={item.note ?? ''} initial={item.note ?? ''} onSave={(n) => void setItemNote(db, session.id, idx, n)} />
        </div>
      )}

      {ex.safetyNote && <SafetyNote sessionId={session.id} ex={ex} />}
      {ex.note && <p className="text-xs text-slate-400">{ex.note}</p>}

      {!isCardio && (
        <TodayCard rec={rec} ex={ex} deload={deload} kgPerBrick={settings.kgPerBrick} last={last} famRef={famRef} family={ctx.family} />
      )}
      {isCardio && last && (
        <div className="rounded-2xl bg-surface p-3 text-sm ring-1 ring-line">
          <span className="text-slate-400">La última vez ({formatDDMM(last.date)}): </span>
          {last.item.sets.map(formatSet).join(', ')}
        </div>
      )}

      {item.skipped ? (
        <div className="space-y-3 text-center">
          <p className="text-slate-400">Salteado.</p>
          <Button className="w-full" onClick={() => void setSkipped(db, session.id, idx, false)}>Deshacer salteo</Button>
        </div>
      ) : (
        <>
          {editing == null && warmTotal > 0 && (
            <div>
              <button
                aria-expanded={warmOpen}
                onClick={() => setWarmOpen(!warmOpen)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-line px-3.5 text-sm text-slate-400"
              >
                <span>Entrada en calor · {warmTotal} {warmTotal === 1 ? 'aproximación' : 'aproximaciones'}</span>
                <span className="flex items-center gap-2"><Segments done={doneA} total={warmTotal} /><span aria-hidden="true">{warmOpen ? '▴' : '▾'}</span></span>
              </button>
              {warmOpen && warmups.length > 0 && (
                <ol className="mt-2 space-y-1.5" aria-label="Aproximaciones sugeridas">
                  {warmups.map((w) => (
                    <li key={w.weight}>
                      <button
                        onClick={() => void log({ type: 'A', weight: w.weight, reps: w.reps })}
                        aria-label={`Registrar aproximación ${formatLoad(ex, w.weight, settings.kgPerBrick)} por ${w.reps}`}
                        className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface px-3.5 py-2 text-left text-slate-300"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="digits block text-xl">{formatLoad(ex, w.weight, settings.kgPerBrick)} × {w.reps}</span>
                          <span className="block text-[11px] text-slate-500">{w.label}</span>
                        </span>
                        <span className="text-lg text-slate-500">✓</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <ol className="space-y-2">
            {done.map((s, i) => {
              const wIndex = s.type === 'W' ? done.slice(0, i + 1).filter((x) => x.type === 'W').length - 1 : -1
              const prev = wIndex >= 0 ? lastW[wIndex] : undefined
              return editing === s.id ? (
                <li key={s.id}>
                  <SetEditor
                    ex={ex}
                    kgPerBrick={settings.kgPerBrick}
                    initial={s}
                    askRir={s.id === doneW.at(-1)?.id}
                    submitLabel="Guardar"
                    onSubmit={async (d) => {
                      await updateSet(db, session.id, idx, s.id, { flag: undefined, repsBeforePause: undefined, rir: undefined, ...d })
                      setEditing(null)
                    }}
                    onCancel={() => setEditing(null)}
                    onDelete={async () => {
                      await deleteSet(db, session.id, idx, s.id)
                      setEditing(null)
                    }}
                  />
                </li>
              ) : (
                <li key={s.id}>
                  <button
                    onClick={() => setEditing(s.id)}
                    aria-label={`Editar serie ${i + 1}: ${formatSet(s)}`}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left ${s.type === 'A' ? 'text-slate-400 ring-1 ring-line' : 'bg-surface'}`}
                  >
                    <span className={`digits w-5 text-xl ${s.type === 'A' ? 'text-slate-500' : 'text-accent'}`}>{s.type === 'A' ? 'A' : wIndex + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="digits block text-2xl">{formatSet(s).replace(/^A /, '')}</span>
                      {(prev || s.restSec != null) && (
                        <span className="block text-xs tabular-nums text-slate-500">
                          {s.restSec != null && `descanso ${formatRest(s.restSec)}`}
                          {s.restSec != null && prev && ' · '}
                          {prev && `antes ${formatSet(prev)}`}
                        </span>
                      )}
                    </span>
                    <SetBadges set={s} item={item} pr={prs.get(s.id)} />
                    <span className="text-accent">✓</span>
                  </button>
                </li>
              )
            })}
          </ol>

          {editing == null && (
            <SetEditor
              key={`${ex.id}-${done.length}`}
              ex={ex}
              deload={deload}
              askRir={doneW.length + 1 >= plannedSets}
              onWorkWeightChange={doneW.length === 0 ? (w) => setTyped({ exId: ex.id, weight: w }) : undefined}
              kgPerBrick={settings.kgPerBrick}
              initial={{ type: 'W', weight: workWeight, reps: isCardio ? null : next.reps, ...(isCardio ? { minutes: lastW.at(-1)?.minutes ?? ex.range[0] } : {}) }}
              title={`Serie ${doneW.length + 1}${doneW.length >= plannedSets ? ' (extra)' : ''}`}
              hint={lastW[doneW.length] ? `antes ${formatSet(lastW[doneW.length]!)}` : undefined}
              submitLabel="✓"
              onSubmit={log}
            />
          )}

          {editing == null && targets.length > doneW.length + 1 && (
            <ol className="space-y-1 text-sm text-slate-500">
              {targets.slice(doneW.length + 1).map((t, i) => (
                <li key={i} className="flex justify-between px-3.5">
                  <span>Serie {doneW.length + 2 + i} · objetivo</span>
                  <span className="digits text-lg">{next.weight == null ? '—' : formatLoad(ex, next.weight, settings.kgPerBrick)} × {t}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <BottomBar>
        <div className="flex gap-2">
          <Button aria-label="← Anterior" className="w-16 shrink-0 !px-0 text-2xl" disabled={prevIdx == null} onClick={() => prevIdx != null && navigate(`/sesion/${session.id}/${prevIdx}`, { replace: true })}>←</Button>
          <Button
            className="min-w-0 flex-1"
            disabled={!lastDone || !!item.skipped || editing != null}
            onClick={() => lastDone && void log({ type: lastDone.type, weight: lastDone.weight, reps: lastDone.reps, ...(lastDone.minutes != null ? { minutes: lastDone.minutes } : {}) })}
          >
            Repetir la anterior
          </Button>
          {nextIdx != null ? (
            <Button aria-label="Siguiente →" variant={doneW.length >= plannedSets ? 'primary' : 'secondary'} className="w-16 shrink-0 !px-0 text-2xl" onClick={() => navigate(`/sesion/${session.id}/${nextIdx}`, { replace: true })}>→</Button>
          ) : (
            <Button aria-label="Ver sesión" variant="primary" className="w-16 shrink-0 !px-0 text-2xl" onClick={() => navigate(`/sesion/${session.id}`)}>→</Button>
          )}
        </div>
      </BottomBar>
    </section>
  )
}

function SetEditor({
  ex, kgPerBrick, initial, title, hint, submitLabel, onSubmit, onCancel, onDelete, deload = false, onWorkWeightChange, askRir = false,
}: {
  ex: Exercise
  deload?: boolean
  /** Es la última serie efectiva del ejercicio: se pregunta el RIR (D-51). */
  askRir?: boolean
  /** Avisa el peso tipeado en una serie efectiva (para recalcular las aproximaciones). */
  onWorkWeightChange?: (w: number | null) => void
  kgPerBrick: number
  initial: Draft
  title?: string
  hint?: string
  submitLabel: string
  onSubmit: (d: Draft) => void | Promise<void>
  onCancel?: () => void
  onDelete?: () => void | Promise<void>
}) {
  const [d, setD] = useState<Draft>(initial)
  const [rirOpen, setRirOpen] = useState(false)
  const isCardio = ex.unit === 'minutes'
  const patch = (p: Partial<Draft>) => setD((cur) => ({ ...cur, ...p }))
  const toggleFlag = (f: SetFlag) =>
    setD((cur) => {
      const { flag: _f, repsBeforePause: _r, ...rest } = cur
      if (cur.flag === f) return rest
      return f === 'rp' && cur.reps != null ? { ...rest, flag: f, repsBeforePause: cur.reps } : { ...rest, flag: f }
    })

  return (
    <div className="space-y-2.5 rounded-2xl bg-surface p-3 ring-1 ring-accent/50">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-baseline gap-2">
          {title && <span className="title text-2xl">{title}</span>}
          {hint && <span className="truncate text-xs text-slate-500">{hint}</span>}
        </div>
        {!isCardio && (
          <div className="flex gap-1" role="group" aria-label="Tipo de serie">
            <Chip active={d.type === 'W'} onClick={() => { patch({ type: 'W' }); onWorkWeightChange?.(d.weight) }}>Efectiva</Chip>
            <Chip active={d.type === 'A'} onClick={() => setD((c) => ({ type: 'A', weight: c.weight, reps: c.reps }))}>Aprox.</Chip>
          </div>
        )}
      </div>
      {isCardio ? (
        <Stepper label="Minutos" value={d.minutes ?? null} step={ex.increment} onChange={(v) => patch({ minutes: v ?? undefined })} />
      ) : (
        <>
          <div className="flex gap-2">
            <Stepper label={`Peso (${UNIT_SHORT[ex.unit]})`} value={d.weight} step={ex.increment} onChange={(v) => { patch({ weight: v }); if (d.type === 'W') onWorkWeightChange?.(v) }} />
            <Stepper label={d.flag === 'rp' ? 'Reps totales' : 'Reps'} value={d.reps} step={1} decimal={false} onChange={(v) => patch({ reps: v })} />
          </div>
          {d.weight != null && ex.unit !== 'total' && ex.unit !== 'per_hand' && <p className="-mt-1 px-1 text-xs text-slate-400">{formatLoad(ex, d.weight, kgPerBrick)}</p>}
          {d.type === 'W' && (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Marca">
                {SET_FLAGS.filter((f) => !deload || (f !== 'rp' && f !== 'drop')).map((f) => (
                  <Chip key={f} compact active={d.flag === f} onClick={() => toggleFlag(f)}>{FLAG_LABEL[f]}</Chip>
                ))}
                {!(askRir || rirOpen || d.rir != null) && (
                  <button type="button" className="min-h-10 px-1.5 text-[13px] text-slate-400" onClick={() => setRirOpen(true)}>+ RIR</button>
                )}
              </div>
              {d.flag === 'rp' && (
                <Stepper compact label="Reps antes de la primera pausa" value={d.repsBeforePause ?? null} step={1} decimal={false} onChange={(v) => patch({ repsBeforePause: v ?? undefined })} />
              )}
              {askRir || rirOpen || d.rir != null ? (
                <div className="space-y-1" role="group" aria-label="RIR">
                  <span className="block text-xs text-slate-400">{askRir ? 'Última serie: ¿cuántas reps te quedaron? (RIR)' : 'RIR (reps en reserva)'}</span>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((r) => (
                      <Chip key={r} active={d.rir === r} onClick={() => patch({ rir: d.rir === r ? undefined : r })}>{r === 3 ? '3+' : r}</Chip>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
      <div className="flex gap-2">
        {onDelete && <Button variant="danger" onClick={() => void onDelete()}>Borrar</Button>}
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button
          variant="primary"
          className="flex-1 text-lg"
          disabled={isCardio ? d.minutes == null : d.weight == null && d.reps == null}
          onClick={() => void onSubmit(d.repsBeforePause != null && d.reps != null && d.repsBeforePause > d.reps ? { ...d, repsBeforePause: d.reps } : d)}
        >
          {submitLabel === '✓' ? '✓ Guardar serie' : submitLabel}
        </Button>
      </div>
    </div>
  )
}

function SafetyNote({ sessionId, ex }: { sessionId: string; ex: Exercise }) {
  const key = `gym.safety.${sessionId}.${ex.id}`
  const [open] = useState(() => {
    try { return localStorage.getItem(key) == null } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem(key, '1') } catch { /* sin storage */ }
  }, [key])
  return (
    <details open={open} className="rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-100 ring-1 ring-amber-500/30">
      <summary className="cursor-pointer font-medium">Nota de seguridad</summary>
      <p className="mt-1">{ex.safetyNote}</p>
    </details>
  )
}

function ItemNote({ initial, onSave }: { initial: string; onSave: (n: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <details className="text-sm" open={!!initial}>
      <summary className="cursor-pointer py-2 text-slate-400">Nota del ejercicio</summary>
      <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== initial && onSave(v)} rows={2} className="w-full rounded-xl bg-bg p-2 ring-1 ring-line" />
    </details>
  )
}

/** Recomendación de hoy en grande + última vez, en una sola tarjeta. */
function TodayCard({
  rec, ex, deload, kgPerBrick, last, famRef, family,
}: {
  rec: Recommendation
  ex: Exercise
  deload: boolean
  kgPerBrick: number
  last: ReturnType<typeof lastExposure>
  famRef: ReturnType<typeof familyReference>
  family: Exercise[]
}) {
  const painAdjusted = !!rec.pain && rec.status === 'same'
  const numeric = rec.weight != null && rec.targets.length > 0 && (deload || rec.status === 'increase' || rec.status === 'same')
  const label = deload
    ? 'Deload'
    : painAdjusted
      ? rec.pain === 'dolor' ? 'Hubo dolor · bajá' : 'Hubo molestia · mantené'
      : rec.held
        ? 'Hoy · mantené el peso'
        : rec.status === 'increase'
          ? 'Hoy · subí'
          : rec.status === 'same' ? 'Hoy · mismo peso' : 'Hoy'
  const big = numeric ? `${formatLoad(ex, rec.weight, kgPerBrick)} × ${rec.targets.join('·')}` : null
  const tone = deload
    ? 'bg-sky-500/10 ring-sky-500/30'
    : rec.status === 'increase' || rec.status === 'ready_big_jump'
      ? 'bg-gradient-to-br from-accent/15 to-surface ring-accent/40'
      : 'bg-surface ring-line'
  const note = 'mt-1.5 text-xs text-slate-400'
  return (
    <div className={`rounded-2xl p-3.5 ring-1 ${tone}`} role="status">
      <p className={`eyebrow ${deload ? 'text-sky-300' : 'text-accent'}`}>{label}</p>
      {big ? (
        <p className={`digits mt-1 ${big.length > 22 ? 'text-3xl' : 'text-4xl'} leading-[1.05]`}>{big}</p>
      ) : (
        <p className="mt-1.5 text-lg font-semibold leading-snug">{deload ? 'Elegí el peso' : rec.message}</p>
      )}
      {deload && <p className={note}>Sin rest-pause ni drops.</p>}
      {rec.pain && <p className={note}>{rec.pain === 'dolor' ? 'Si el dolor sigue, probá otra variante (Ocupado → alternativa) o consultá a un profesional.' : 'Si vuelve a molestar, probá otra variante (Ocupado → alternativa).'}</p>}
      {rec.note === 'rir_defer' && <p className={note}>Llegaste al tope con 0 reps en reserva: repetí y buscá terminar con 1 en reserva. Si lo repetís, la próxima subís.</p>}
      {rec.note === 'rir_fast' && <p className={note}>Te sobraron 3 o más en la última serie: probá sumar hasta 2 reps.</p>}
      {rec.held && <p className={note}>Sueño y energía bajos: hoy no se suben cargas. Si te sentís bien, podés subir igual.</p>}
      {rec.status === 'ready_big_jump' && (
        <p className={note}>El siguiente peso es {formatLoad(ex, (rec.weight ?? 0) + ex.increment, kgPerBrick)}. Si subís, el objetivo vuelve a {ex.range[0]} reps.</p>
      )}
      {rec.status === 'same' && rec.bigJumpPct != null && (
        <p className={note}>El incremento es de +{rec.bigJumpPct} %: progresá con reps hasta {rec.repCap}.</p>
      )}
      {rec.status === 'insufficient' && <p className={note}>No sugiero subir hasta tener {rec.targets.length} series válidas al mismo peso.</p>}
      {rec.fatigue && rec.status !== 'same' && <p className="mt-1.5 text-xs text-amber-300">Dos sesiones flojas seguidas: considerá bajar 5-10 % o revisar la fatiga.</p>}

      <div className="mt-2.5 border-t border-line pt-2 text-sm">
        {last ? (
          <>
            <span className="text-slate-400">La última vez ({formatDDMM(last.date)}): </span>
            {last.item.sets.map(formatSet).join(', ')}
            {last.item.confidence && last.item.confidence !== 'alta' && <span className="ml-1 rounded bg-amber-500/15 px-1 text-xs text-amber-300">conf. {last.item.confidence}</span>}
            {last.item.note && <p className="mt-1 text-xs text-slate-400">{last.item.note}</p>}
          </>
        ) : (
          <>
            <span className="text-slate-400">Sin historial para esta variante.</span>
            {famRef && (
              <p className="mt-1 text-xs text-slate-400">
                Referencia de familia, no equivalente: {family.find((f) => f.id === famRef.exerciseId)?.name} {formatLoad(family.find((f) => f.id === famRef.exerciseId)!, famRef.weight, kgPerBrick)} ({formatDDMM(famRef.date)}).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
