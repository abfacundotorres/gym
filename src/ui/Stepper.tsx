import { useState } from 'react'
import { num } from '../engine/format'

interface Props {
  label: string
  value: number | null
  step: number
  min?: number
  decimal?: boolean
  suffix?: string
  onChange: (v: number | null) => void
}

/** [−] valor [+], botones grandes. Tocar el valor permite tipearlo (teclado decimal). */
export function Stepper({ label, value, step, min = 0, decimal = true, suffix, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const round = (v: number) => Math.round(v * 1000) / 1000
  const bump = (d: number) => onChange(Math.max(min, round((value ?? 0) + d)))
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-xs text-slate-400">{label}</div>
      <div className="flex items-stretch overflow-hidden rounded-xl ring-1 ring-line">
        <button type="button" aria-label={`Menos ${label}`} className="w-12 shrink-0 bg-surface text-2xl active:bg-line" onClick={() => bump(-step)}>
          −
        </button>
        {editing ? (
          <input
            autoFocus
            aria-label={label}
            inputMode={decimal ? 'decimal' : 'numeric'}
            defaultValue={value == null ? '' : String(value).replace('.', ',')}
            className="h-14 w-full min-w-0 bg-bg text-center text-xl tabular-nums outline-none"
            onBlur={(e) => {
              const t = e.target.value.trim().replace(',', '.')
              const v = t === '' ? null : Number(t)
              if (v === null || (Number.isFinite(v) && v >= min)) onChange(v === null ? null : round(v))
              setEditing(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button type="button" aria-label={`${label}: ${value ?? 'sin dato'}, tocar para escribir`} className="h-14 w-full min-w-0 text-center text-xl tabular-nums" onClick={() => setEditing(true)}>
            {value == null ? '—' : num(value)}
            {suffix && <span className="ml-1 text-xs text-slate-400">{suffix}</span>}
          </button>
        )}
        <button type="button" aria-label={`Más ${label}`} className="w-12 shrink-0 bg-surface text-2xl active:bg-line" onClick={() => bump(step)}>
          +
        </button>
      </div>
    </div>
  )
}

export function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`min-h-10 rounded-full px-3 text-sm ring-1 ${active ? 'bg-accent/15 text-accent ring-accent' : 'text-slate-300 ring-line'}`}
    >
      {children}
    </button>
  )
}
