import { useId, useState } from 'react'

export interface Point { x: string; y: number; label: string }

/**
 * Gráfico de línea de una sola serie, SVG propio. Sin eje doble: cada medida va en su propio gráfico.
 * Toque/hover: punto más cercano con tooltip. Responsive por viewBox.
 */
export function LineChart({ title, points, unit, height = 160 }: { title: string; points: Point[]; unit: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null)
  const id = useId()
  if (points.length === 0) return null
  const W = 340
  const H = height
  const pad = { l: 36, r: 12, t: 12, b: 24 }
  const ys = points.map((p) => p.y)
  const { lo, hi, ticks } = niceScale(Math.min(...ys), Math.max(...ys))
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1))
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')
  const a = active != null ? points[active] : null
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',')

  function pick(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    setActive(best)
  }

  return (
    <figure className="space-y-1">
      <figcaption id={id} className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{title}</span>
        <span className="tabular-nums text-xs text-slate-400" aria-live="polite">
          {a ? `${a.x}: ${fmt(a.y)} ${unit}${a.label ? ` · ${a.label}` : ''}` : `${points.length} sesiones`}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-labelledby={id}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">{fmt(t)}</text>
          </g>
        ))}
        {[0, points.length - 1].filter((v, i, arr) => arr.indexOf(v) === i).map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'} className="fill-slate-400 text-[10px]">{points[i]!.x}</text>
        ))}
        {a && <line x1={x(active!)} x2={x(active!)} y1={pad.t} y2={H - pad.b} className="stroke-slate-500" strokeWidth={1} strokeDasharray="3 3" />}
        <path d={path} fill="none" className="stroke-chart" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.y)} r={active === i ? 5 : 4} className="fill-chart stroke-surface" strokeWidth={2} />
        ))}
      </svg>
    </figure>
  )
}

/** Escala con ticks redondos (1, 2, 5 × 10^k), ~3-4 marcas. */
export function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  if (min === max) { min -= 1; max += 1 }
  const raw = (max - min) / 3
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const lo = Math.max(0, Math.floor(min / step) * step)
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1000) / 1000)
  return { lo, hi, ticks }
}
