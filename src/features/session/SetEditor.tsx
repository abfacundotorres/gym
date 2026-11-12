import { useEffect, useRef, useState } from 'react'
import type { SetDraft } from '../../engine/entry'
import { formatLoad, UNIT_SHORT } from '../../engine/load'
import { SET_FLAGS, type Exercise, type SetFlag } from '../../engine/types'
import { Button } from '../../ui/Button'
import { Chip, Stepper } from '../../ui/Stepper'

const FLAG_LABEL: Record<SetFlag, string> = { rp: 'Rest-pause', drop: 'Drop', rebote: 'Rebote', asist: 'Asistida' }
type Draft = SetDraft

/** Tarjeta para cargar o editar una serie: peso, reps, tipo, marcas y RIR. */
export function SetEditor({
  ex, kgPerBrick, initial, title, hint, submitLabel, onSubmit, onCancel, onDelete, deload = false, onWorkWeightChange, askRir = false, keepInView = false,
}: {
  /** Al aparecer, se asegura de que la tarjeta (con "Guardar serie") quede a la vista sobre las barras fijas. */
  keepInView?: boolean
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
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!keepInView) return
    // Un instante después, cuando ya apareció la barra del descanso y se ajustó el alto del contenido.
    const t = setTimeout(() => root.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200)
    return () => clearTimeout(t)
  }, [keepInView])
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
    <div ref={root} style={{ scrollMarginBottom: 'calc(var(--bar-h, 160px) + 16px)' }} className="space-y-2.5 rounded-2xl bg-surface p-3 ring-1 ring-accent/50">
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
                  <button type="button" className="min-h-11 px-1.5 text-[13px] text-slate-400" onClick={() => setRirOpen(true)}>+ RIR</button>
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
