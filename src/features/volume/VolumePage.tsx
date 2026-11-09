import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getDB } from '../../data/db'
import { useExerciseMap, useSettings } from '../../data/hooks'
import { addDays, formatDDMM, toISODate, weekStart } from '../../engine/dates'
import { num } from '../../engine/format'
import { volumeStatus, weekVolume, type VolumeStatus } from '../../engine/periodization'
import { MUSCLES, MUSCLE_LABELS, type Muscle } from '../../engine/types'
import { Button } from '../../ui/Button'

const STATUS: Record<VolumeStatus, { label: string; bar: string; text: string }> = {
  below: { label: 'por debajo', bar: 'bg-amber-400', text: 'text-amber-300' },
  in: { label: 'en rango', bar: 'bg-accent', text: 'text-accent' },
  above: { label: 'por encima', bar: 'bg-sky-400', text: 'text-sky-300' },
}

export function VolumePage() {
  const thisMonday = weekStart(toISODate(new Date()))
  const [monday, setMonday] = useState(thisMonday)
  const [open, setOpen] = useState<Muscle | null>(null)
  const settings = useSettings()
  const exercises = useExerciseMap()
  const sessions = useLiveQuery(() => getDB().sessions.where('date').between(addDays(monday, -7), addDays(monday, 6), true, true).toArray(), [monday])
  if (!sessions || !exercises) return null

  const cur = weekVolume(sessions, monday, exercises)
  const prev = weekVolume(sessions, addDays(monday, -7), exercises)
  const scaleMax = Math.max(25, ...MUSCLES.map((m) => Math.max(cur[m]?.total ?? 0, settings.volumeTarget[m][1] * 1.2)))
  const pct = (v: number) => `${(v / scaleMax) * 100}%`

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Volumen</h1>
      <div className="flex items-center gap-2">
        <Button aria-label="Semana anterior" onClick={() => setMonday(addDays(monday, -7))}>←</Button>
        <p className="flex-1 text-center text-sm">
          {monday === thisMonday ? 'Esta semana' : 'Semana'} {formatDDMM(monday)}–{formatDDMM(addDays(monday, 6))}
        </p>
        <Button aria-label="Semana siguiente" disabled={monday >= thisMonday} onClick={() => setMonday(addDays(monday, 7))}>→</Button>
      </div>
      <p className="text-xs text-slate-400">
        Series efectivas por músculo: 1 por primario, ½ por secundario, drop = ½. La franja gris es el rango objetivo; la línea fina y el número chico, la semana anterior.
      </p>
      <ul className="space-y-1">
        {MUSCLES.map((m) => {
          const v = cur[m]?.total ?? 0
          const p = prev[m]?.total ?? 0
          const target = settings.volumeTarget[m]
          const st = volumeStatus(v, target)
          const diff = v - p
          return (
            <li key={m}>
              <button
                className="w-full rounded-lg px-1 py-2 text-left active:bg-surface"
                aria-expanded={open === m}
                onClick={() => setOpen(open === m ? null : m)}
              >
                <div className="mb-1 flex items-baseline gap-2 text-sm">
                  <span className="flex-1">{MUSCLE_LABELS[m]}</span>
                  <span className={`text-xs ${STATUS[st].text}`}>{STATUS[st].label}</span>
                  <span className="w-10 text-right font-semibold tabular-nums">{num(v)}</span>
                  <span className="w-12 text-right text-xs tabular-nums text-slate-500">{diff === 0 ? '=' : `${diff > 0 ? '+' : ''}${num(diff)}`}</span>
                </div>
                <div className="relative h-2.5 rounded-full bg-surface" aria-hidden>
                  <div className="absolute inset-y-0 rounded-sm bg-slate-500/30" style={{ left: pct(target[0]), width: pct(target[1] - target[0]) }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full ${STATUS[st].bar}`} style={{ width: pct(v) }} />
                  {p > 0 && <div className="absolute -inset-y-0.5 w-0.5 bg-white" style={{ left: pct(p) }} title={`Semana anterior: ${num(p)}`} />}
                </div>
              </button>
              {open === m && (
                <ul className="mb-2 space-y-1 rounded-lg bg-surface p-2 text-sm">
                  {(cur[m]?.from ?? []).length === 0 ? (
                    <li className="text-slate-400">Sin series esta semana. Objetivo {target[0]}-{target[1]}.</li>
                  ) : (
                    cur[m]!.from.map((f) => (
                      <li key={`${f.exerciseId}-${f.role}`} className="flex justify-between gap-2">
                        <span className="truncate">{exercises.get(f.exerciseId)?.name ?? f.exerciseId}</span>
                        <span className="tabular-nums text-slate-400">{num(f.sets)}{f.role === 'secondary' && ' (sec.)'}</span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
