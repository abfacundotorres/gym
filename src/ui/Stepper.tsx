import { useCallback, useEffect, useRef, useState } from 'react'
import { num } from '../engine/format'

/** Un toque suma un paso; mantener apretado repite (para saltar varios pesos sin tocar diez veces). */
function useHold(step: () => void) {
  const timers = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({})
  const stepRef = useRef(step)
  useEffect(() => { stepRef.current = step })
  const stop = useCallback(() => {
    clearTimeout(timers.current.t)
    clearInterval(timers.current.i)
  }, [])
  useEffect(() => stop, [stop])
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      stepRef.current()
      timers.current.t = setTimeout(() => { timers.current.i = setInterval(() => stepRef.current(), 110) }, 450)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    // Teclado y lectores de pantalla disparan click sin puntero (detail 0).
    onClick: (e: React.MouseEvent) => { if (e.detail === 0) stepRef.current() },
  }
}

interface Props {
  label: string
  value: number | null
  step: number
  min?: number
  decimal?: boolean
  suffix?: string
  /** Versión en una fila ([−] valor [+]) para listas y formularios; la grande es para registrar series. */
  compact?: boolean
  onChange: (v: number | null) => void
}

/** Valor grande con [−] [+] debajo. Tocar el valor permite tipearlo (teclado decimal). */
export function Stepper({ label, value, step, min = 0, decimal = true, suffix, compact = false, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const round = (v: number) => Math.round(v * 1000) / 1000
  const bump = (d: number) => onChange(Math.max(min, round((value ?? 0) + d)))
  const minus = useHold(() => bump(-step))
  const plus = useHold(() => bump(step))
  const commit = (el: HTMLInputElement) => {
    const t = el.value.trim().replace(',', '.')
    const v = t === '' ? null : Number(t)
    if (v === null || (Number.isFinite(v) && v >= min)) onChange(v === null ? null : round(v))
    setEditing(false)
  }
  if (compact) {
    return (
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs text-slate-400">{label}</div>
        <div className="flex items-stretch overflow-hidden rounded-xl bg-raised">
          <button type="button" aria-label={`Menos ${label}`} className="w-11 shrink-0 touch-manipulation select-none text-2xl active:bg-line" {...minus}>−</button>
          {editing ? (
            <input
              autoFocus
              aria-label={label}
              inputMode={decimal ? 'decimal' : 'numeric'}
              defaultValue={value == null ? '' : String(value).replace('.', ',')}
              className="digits h-12 w-full min-w-0 bg-transparent text-center text-2xl outline-none"
              onBlur={(e) => commit(e.target)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <button type="button" aria-label={`${label}: ${value ?? 'sin dato'}, tocar para escribir`} className="digits h-12 w-full min-w-0 text-center text-2xl" onClick={() => setEditing(true)}>
              {value == null ? '—' : num(value)}
            </button>
          )}
          <button type="button" aria-label={`Más ${label}`} className="w-11 shrink-0 touch-manipulation select-none text-2xl active:bg-line" {...plus}>+</button>
        </div>
      </div>
    )
  }
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-raised px-2 pb-1.5 pt-2.5 text-center">
      <div className="eyebrow !text-[10px] text-slate-400">{label}</div>
      {editing ? (
        <input
          autoFocus
          aria-label={label}
          inputMode={decimal ? 'decimal' : 'numeric'}
          defaultValue={value == null ? '' : String(value).replace('.', ',')}
          className="digits h-14 w-full min-w-0 bg-transparent text-center text-5xl outline-none"
          onBlur={(e) => {
            const t = e.target.value.trim().replace(',', '.')
            const v = t === '' ? null : Number(t)
            if (v === null || (Number.isFinite(v) && v >= min)) onChange(v === null ? null : round(v))
            setEditing(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <button type="button" aria-label={`${label}: ${value ?? 'sin dato'}, tocar para escribir`} className="digits h-14 w-full min-w-0 text-center text-5xl" onClick={() => setEditing(true)}>
          {value == null ? '—' : num(value)}
          {suffix && <span className="ml-1 text-sm font-medium text-slate-400">{suffix}</span>}
        </button>
      )}
      <div className="mt-0.5 flex gap-1.5">
        <button type="button" aria-label={`Menos ${label}`} className="h-11 flex-1 touch-manipulation select-none rounded-xl bg-surface text-3xl font-medium active:bg-line" {...minus}>
          −
        </button>
        <button type="button" aria-label={`Más ${label}`} className="h-11 flex-1 touch-manipulation select-none rounded-xl bg-surface text-3xl font-medium active:bg-line" {...plus}>
          +
        </button>
      </div>
    </div>
  )
}

export function Chip({ active, onClick, children, label, compact = false }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`${compact ? 'min-h-10 px-2.5 text-[13px]' : 'min-h-10 px-3.5 text-sm'} rounded-full font-medium ring-1 ${active ? 'bg-accent/15 text-accent ring-accent' : 'bg-raised text-slate-300 ring-transparent'}`}
    >
      {children}
    </button>
  )
}
