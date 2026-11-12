import { addRest, formatClock, stopRest, useRestTimer } from '../lib/restTimer'

export function RestTimerBar() {
  const { state, remainingMs } = useRestTimer()
  if (!state) return null
  const done = remainingMs <= 0
  const pct = Math.min(100, Math.max(0, 100 - (remainingMs / state.durationMs) * 100))
  return (
    <div role="timer" aria-live="off" className={`relative overflow-hidden ${done ? 'animate-alarm bg-accent/15' : 'bg-surface'}`}>
      <div className="absolute inset-y-0 left-0 bg-accent/10" style={{ width: `${pct}%` }} />
      <div className="relative mx-auto flex max-w-xl items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className={`digits text-4xl ${done ? 'text-accent' : ''}`}>{formatClock(remainingMs)}</div>
          <div className="truncate text-xs text-slate-400">{done ? '¡A la próxima serie!' : `Descanso · ${state.label}`}</div>
        </div>
        <button className="min-h-11 rounded-xl bg-raised px-3.5 text-sm font-medium" onClick={() => addRest(30)}>+30 s</button>
        <button className="min-h-11 rounded-xl bg-raised px-3.5 text-sm font-medium" onClick={stopRest}>{done ? 'Cerrar' : 'Saltar'}</button>
      </div>
    </div>
  )
}
