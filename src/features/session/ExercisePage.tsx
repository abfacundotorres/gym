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
import { exposuresOf } from '../../engine/history'
import { recommend, type Recommendation } from '../../engine/progression'
import { findPRs } from '../../engine/prs'
import { validSets, workingWeight } from '../../engine/validity'
import { warmupSets } from '../../engine/warmup'
import { SetBadges } from '../../ui/SetBadges'
import { deloadSets, deloadWeight } from '../../engine/periodization'
import { readinessLevel, reducedSets, suggestFewerSets } from '../../engine/readiness'
import { SET_FLAGS, type Exercise, type SetEntry, type SetFlag } from '../../engine/types'
import { startRest } from '../../lib/restTimer'
import { useWakeLock } from '../../lib/wakeLock'
import { Button } from '../../ui/Button'
import { Chip, Stepper } from '../../ui/Stepper'
import { useSessionData } from './useSessionData'

const FLAG_LABEL: Record<SetFlag, string> = { rp: 'Rest-pause', drop: 'Drop', rebote: 'Rebote', asist: 'Asistida' }
type Draft = Omit<SetEntry, 'id'>

export function ExercisePage() {
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
  const [typed, setTyped] = useState<{ exId: string; weight: number | null } | null>(null)
  useWakeLock(data?.session.status === 'in_progress')

  // useLiveQuery devuelve el valor anterior hasta resolver el nuevo: no mezclar ejercicios.
  if (!data || !ctx?.ex || ctx.ex.id !== exerciseId) return null
  const { session, plan } = data
  const item = session.items[idx]!
  const ex = ctx.ex
  const planItem = plan?.items.find((p) => p.exerciseId === item.exerciseId || p.exerciseId === item.swappedFrom)
  const deload = !!session.deload
  const lowDay = !deload && readinessLevel(session.readiness) === 'low'
  const fewer = !deload && suggestFewerSets(session.readiness, session.short)
  const plannedSets = deload ? deloadSets(planItem?.sets ?? 3) : (planItem?.sets ?? 3)
  const last = lastExposure(ctx.history, ex.id, session.date, session.id)
  const lastW = last?.item.sets.filter((s) => s.type === 'W') ?? []
  const previous = exposuresOf(ctx.history, ex.id, { before: session.date, excludeSessionId: session.id })
  const baseRec = recommend(ex, deload ? (planItem?.sets ?? 3) : plannedSets, previous, { kgPerBrick: settings.kgPerBrick, range: planItem?.rangeOverride, hold: lowDay })
  const rec: Recommendation = deload
    ? { ...baseRec, status: 'same', weight: deloadWeight(ex, baseRec.weight, settings.kgPerBrick), targets: baseRec.targets.slice(0, plannedSets), fatigue: false, message: 'Deload' }
    : baseRec
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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <Link to={`/sesion/${session.id}`} className="py-2 text-slate-400">← Sesión</Link>
        <span className="text-slate-400 tabular-nums">{idx + 1}/{session.items.length}</span>
      </div>
      <header>
        <h1 className="text-2xl font-bold leading-tight">{ex.name}</h1>
        <p className="text-sm text-slate-400">
          {plannedSets} series{fewer && plannedSets > reducedSets(plannedSets) ? ` (hoy podés dejarlo en ${reducedSets(plannedSets)})` : ''} · {ex.range[0]}-{ex.range[1]} {isCardio ? 'min' : 'reps'}{ex.repsPerLeg && ' por pierna'}
          {!isCardio && ` · descanso ${Math.round(restSec / 60 * 10) / 10} min`}
        </p>
      </header>

      {item.swappedFrom && <p className="text-xs text-slate-400">En lugar de {ctx.family.find((f) => f.id === item.swappedFrom)?.name ?? item.swappedFrom}</p>}
      {options.length > 0 && session.status === 'in_progress' && (
        swapping ? (
          <div className="space-y-2 rounded-xl bg-surface p-3 ring-1 ring-line">
            <p className="text-sm text-slate-400">Cambiar por:</p>
            {options.map((o) => (
              <Button
                key={o.id}
                className="w-full text-left"
                onClick={async () => {
                  const to = await swapExercise(db, session.id, idx, o.id)
                  setSwapping(false)
                  navigate(`/sesion/${session.id}/${to}`, { replace: true })
                }}
              >
                {o.name}
              </Button>
            ))}
            <Button variant="ghost" className="w-full" onClick={() => setSwapping(false)}>Cancelar</Button>
          </div>
        ) : (
          <button className="min-h-11 text-sm text-slate-300 underline-offset-4 hover:underline" onClick={() => setSwapping(true)}>
            Ocupado → alternativa
          </button>
        )
      )}

      {session.status === 'in_progress' && !isCardio && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Molestia o dolor">
          <span className="text-sm text-slate-400">¿Algo te molesta?</span>
          <Chip active={item.pain === 'molestia'} onClick={() => void setItemPain(db, session.id, idx, item.pain === 'molestia' ? null : 'molestia')}>Molestia</Chip>
          <Chip active={item.pain === 'dolor'} onClick={() => void setItemPain(db, session.id, idx, item.pain === 'dolor' ? null : 'dolor')}>Dolor</Chip>
        </div>
      )}

      {ex.safetyNote && <SafetyNote sessionId={session.id} ex={ex} />}
      {ex.note && <p className="text-xs text-slate-400">{ex.note}</p>}

      <div className="rounded-xl bg-surface p-3 text-sm ring-1 ring-line">
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
                Referencia de familia, no equivalente: {ctx.family.find((f) => f.id === famRef.exerciseId)?.name} {formatLoad(ctx.family.find((f) => f.id === famRef.exerciseId)!, famRef.weight, settings.kgPerBrick)} ({formatDDMM(famRef.date)}).
              </p>
            )}
          </>
        )}
      </div>

      {!isCardio && (deload ? (
        <p role="status" className="rounded-xl bg-sky-500/10 p-3 text-sm text-sky-200 ring-1 ring-sky-500/30">
          Deload: {rec.weight != null ? formatLoad(ex, rec.weight, settings.kgPerBrick) : 'elegí el peso'} × {rec.targets.join('/')}, sin rest-pause ni drops.
        </p>
      ) : <RecBanner rec={rec} ex={ex} kgPerBrick={settings.kgPerBrick} />)}

      {item.skipped ? (
        <div className="space-y-3 text-center">
          <p className="text-slate-400">Salteado.</p>
          <Button className="w-full" onClick={() => void setSkipped(db, session.id, idx, false)}>Deshacer salteo</Button>
        </div>
      ) : (
        <>
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
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ring-1 ${s.type === 'A' ? 'ring-line/60 text-slate-400' : 'bg-accent/5 ring-accent/30'}`}
                  >
                    <span className="w-6 text-xs text-slate-400">{s.type === 'A' ? 'A' : wIndex + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg tabular-nums">{formatSet(s).replace(/^A /, '')}</span>
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

          {editing == null && warmups.length > 0 && (
            <ol className="space-y-1" aria-label="Aproximaciones sugeridas">
              {warmups.map((w) => (
                <li key={w.weight}>
                  <button
                    onClick={() => void log({ type: 'A', weight: w.weight, reps: w.reps })}
                    aria-label={`Registrar aproximación ${formatLoad(ex, w.weight, settings.kgPerBrick)} por ${w.reps}`}
                    className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2 text-left text-slate-400"
                  >
                    <span className="w-6 text-xs">A</span>
                    <span className="min-w-0 flex-1">
                      <span className="block tabular-nums">{formatLoad(ex, w.weight, settings.kgPerBrick)} × {w.reps}</span>
                      <span className="block text-[11px] text-slate-500">{w.label}</span>
                    </span>
                    <span className="text-lg">✓</span>
                  </button>
                </li>
              ))}
            </ol>
          )}

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
                <li key={i} className="flex justify-between px-3">
                  <span>Serie {doneW.length + 2 + i}</span>
                  <span className="tabular-nums">{next.weight == null ? '—' : formatLoad(ex, next.weight, settings.kgPerBrick)} × {t}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button disabled={!lastDone} onClick={() => lastDone && void log({ type: lastDone.type, weight: lastDone.weight, reps: lastDone.reps, ...(lastDone.minutes != null ? { minutes: lastDone.minutes } : {}) })}>
              Repetir la anterior
            </Button>
            <Button variant="ghost" onClick={() => void setSkipped(db, session.id, idx, true)} disabled={done.length > 0}>
              Saltear
            </Button>
          </div>
          <ItemNote key={item.note ?? ''} initial={item.note ?? ''} onSave={(n) => void setItemNote(db, session.id, idx, n)} />
        </>
      )}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <Button disabled={prevIdx == null} onClick={() => prevIdx != null && navigate(`/sesion/${session.id}/${prevIdx}`, { replace: true })}>← Anterior</Button>
        {nextIdx != null ? (
          <Button variant={doneW.length >= plannedSets ? 'primary' : 'secondary'} onClick={() => navigate(`/sesion/${session.id}/${nextIdx}`, { replace: true })}>Siguiente →</Button>
        ) : (
          <Button variant="primary" onClick={() => navigate(`/sesion/${session.id}`)}>Ver sesión</Button>
        )}
      </div>
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
    <div className="space-y-3 rounded-xl bg-surface p-3 ring-1 ring-accent/40">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {title && <span className="font-semibold">{title}</span>}
          {hint && <span className="text-xs leading-6 text-slate-500">{hint}</span>}
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
          {d.weight != null && ex.unit !== 'total' && <p className="-mt-1 text-xs text-slate-400">{formatLoad(ex, d.weight, kgPerBrick)}</p>}
          {d.type === 'W' && (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Marca">
                {SET_FLAGS.filter((f) => !deload || (f !== 'rp' && f !== 'drop')).map((f) => (
                  <Chip key={f} active={d.flag === f} onClick={() => toggleFlag(f)}>{FLAG_LABEL[f]}</Chip>
                ))}
              </div>
              {d.flag === 'rp' && (
                <Stepper label="Reps antes de la primera pausa" value={d.repsBeforePause ?? null} step={1} decimal={false} onChange={(v) => patch({ repsBeforePause: v ?? undefined })} />
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
              ) : (
                <button type="button" className="min-h-10 text-xs text-slate-400 underline-offset-4 hover:underline" onClick={() => setRirOpen(true)}>+ RIR</button>
              )}
            </>
          )}
        </>
      )}
      <div className="flex gap-2">
        {onDelete && <Button variant="danger" onClick={() => void onDelete()}>Borrar</Button>}
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button
          variant="primary"
          aria-label={submitLabel === '✓' ? 'Guardar serie' : undefined}
          className="flex-1 text-xl"
          disabled={isCardio ? d.minutes == null : d.weight == null && d.reps == null}
          onClick={() => void onSubmit(d.repsBeforePause != null && d.reps != null && d.repsBeforePause > d.reps ? { ...d, repsBeforePause: d.reps } : d)}
        >
          {submitLabel}
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
    <details open={open} className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100 ring-1 ring-amber-500/30">
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
      <textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== initial && onSave(v)} rows={2} className="w-full rounded-lg bg-bg p-2 ring-1 ring-line" />
    </details>
  )
}

function RecBanner({ rec, ex, kgPerBrick }: { rec: Recommendation; ex: Exercise; kgPerBrick: number }) {
  const tone =
    rec.status === 'increase' || rec.status === 'ready_big_jump'
      ? 'bg-accent/10 text-accent ring-accent/40'
      : rec.status === 'insufficient' || rec.status === 'no_history'
        ? 'bg-surface text-slate-300 ring-line'
        : 'bg-surface text-slate-200 ring-line'
  const painAdjusted = !!rec.pain && rec.status === 'same'
  const text =
    painAdjusted
      ? rec.pain === 'dolor'
        ? `Hubo dolor la última vez: bajá a ${formatLoad(ex, rec.weight, kgPerBrick)}, repetí ${rec.targets.join('/')}`
        : `Hubo molestia la última vez: mantené el peso${rec.weight != null ? ` (${formatLoad(ex, rec.weight, kgPerBrick)})` : ''}, repetí ${rec.targets.join('/')}`
      : rec.held
      ? `Hoy mantené el peso${rec.weight != null ? ` (${formatLoad(ex, rec.weight, kgPerBrick)})` : ''}, repetí ${rec.targets.join('/')}`
      : rec.status === 'increase'
      ? `Subí a ${formatLoad(ex, rec.weight, kgPerBrick)}, objetivo ${rec.targets.join('/')}`
      : rec.status === 'same'
        ? `Mismo peso${rec.weight != null ? ` (${formatLoad(ex, rec.weight, kgPerBrick)})` : ''}, objetivo ${rec.targets.join('/')}`
        : rec.message
  return (
    <div className={`rounded-xl p-3 text-sm ring-1 ${tone}`} role="status">
      <p>{text}</p>
      {rec.pain && <p className="mt-1 text-xs text-slate-400">{rec.pain === 'dolor' ? 'Si el dolor sigue, probá otra variante (Ocupado → alternativa) o consultá a un profesional.' : 'Si vuelve a molestar, probá otra variante (Ocupado → alternativa).'}</p>}
      {rec.note === 'rir_defer' && <p className="mt-1 text-xs text-slate-400">Llegaste al tope con 0 reps en reserva: repetí y buscá terminar con 1 en reserva. Si lo repetís, la próxima subís.</p>}
      {rec.note === 'rir_fast' && <p className="mt-1 text-xs text-slate-400">Te sobraron 3 o más en la última serie: probá sumar hasta 2 reps.</p>}
      {rec.held && <p className="mt-1 text-xs text-slate-400">Sueño y energía bajos: hoy no se suben cargas. Si te sentís bien, podés subir igual.</p>}
      {rec.status === 'ready_big_jump' && (
        <p className="mt-1 text-xs text-slate-400">El siguiente peso es {formatLoad(ex, (rec.weight ?? 0) + ex.increment, kgPerBrick)}. Si subís, el objetivo vuelve a {ex.range[0]} reps.</p>
      )}
      {rec.status === 'same' && rec.bigJumpPct != null && (
        <p className="mt-1 text-xs text-slate-400">El incremento es de +{rec.bigJumpPct} %: progresá con reps hasta {rec.repCap}.</p>
      )}
      {rec.status === 'insufficient' && <p className="mt-1 text-xs text-slate-400">No sugiero subir hasta tener {rec.targets.length} series válidas al mismo peso.</p>}
      {rec.fatigue && rec.status !== 'same' && <p className="mt-1 text-xs text-amber-300">Dos sesiones flojas seguidas: considerá bajar 5-10 % o revisar la fatiga.</p>}
    </div>
  )
}
