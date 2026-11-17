import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { deleteBodyweight, saveBodyweight } from '../../data/bodyweightRepo'
import { getDB } from '../../data/db'
import { MAX_KG, MIN_KG, weeklyRate, weeklySeries } from '../../engine/bodyweight'
import { formatDDMM, toISODate } from '../../engine/dates'
import { num } from '../../engine/format'
import { PHASE_LABEL } from '../../engine/phase'
import { Button, Card } from '../../ui/Button'
import { LineChart } from '../../ui/LineChart'

/** Peso corporal (D-70): opcional, una medición por día. Solo se registra y se muestra la tendencia; no cambia ningún cálculo. */
export function BodyweightPage() {
  const db = getDB()
  const today = toISODate(new Date())
  const data = useLiveQuery(async () => ({
    entries: await db.bodyweights.orderBy('date').toArray(),
    phase: (await db.mesocycles.where('status').equals('active').first())?.phase,
  }))
  const [date, setDate] = useState(today)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!data) return null

  const series = weeklySeries(data.entries)
  const rate = weeklyRate(series)
  const last = data.entries.at(-1)
  const recent = [...data.entries].reverse().slice(0, 30)

  async function save() {
    const ok = await saveBodyweight(db, date, text)
    setMsg(ok ? { ok, text: `Guardado: ${formatDDMM(date)}.` } : { ok, text: `Ingresá un peso entre ${MIN_KG} y ${MAX_KG} kg, por ejemplo 82,4.` })
    if (ok) setText('')
  }

  return (
    <section className="space-y-4">
      <Link to="/plan" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Plan</Link>
      <header className="space-y-1">
        <h1 className="title text-3xl">Peso corporal</h1>
        <p className="text-xs text-slate-400">Opcional. Solo para ver la tendencia junto con la fase: no cambia ninguna carga ni sugerencia.</p>
      </header>

      <Card className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-400">Peso (kg)</span>
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => { setText(e.target.value); setMsg(null) }}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            placeholder="82,4"
            className="mt-1 h-14 w-full rounded-xl bg-bg px-3 text-2xl ring-1 ring-line"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Día</span>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1 h-12 w-full rounded-xl bg-bg px-3 ring-1 ring-line" />
        </label>
        <Button variant="primary" className="w-full" disabled={!text.trim()} onClick={() => void save()}>Guardar peso</Button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-accent' : 'text-red-300'}`}>{msg.text}</p>}
      </Card>

      {last && (
        <Card className="space-y-1">
          <p className="eyebrow text-slate-400">Último{data.phase ? ` · ${PHASE_LABEL[data.phase]}` : ''}</p>
          <p className="digits text-4xl">{num(last.kg)}<span className="text-xl text-slate-400"> kg</span> <span className="text-base font-medium text-slate-400">({formatDDMM(last.date)})</span></p>
          <p className="text-sm text-slate-300">
            {rate == null
              ? 'Con 3 semanas de mediciones aparece el cambio por semana.'
              : Math.abs(rate) < 0.05
                ? 'Estable en las últimas semanas.'
                : `${rate > 0 ? '+' : '−'}${num(Math.round(Math.abs(rate) * 100) / 100)} kg por semana (promedio de las últimas 4 semanas con datos).`}
          </p>
        </Card>
      )}

      {series.length >= 2 && (
        <LineChart title="Peso semanal (promedio)" unit="kg" countLabel="semanas" points={series.map((p) => ({ x: formatDDMM(p.monday), y: p.kg, label: p.n > 1 ? `${p.n} mediciones` : '' }))} />
      )}

      {recent.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-slate-400">Todavía no anotaste ningún peso. Una vez por semana alcanza.</p>
      ) : (
        <ol className="space-y-1.5" aria-label="Mediciones">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3.5">
              <span className="digits w-14 text-lg text-slate-300">{formatDDMM(e.date)}</span>
              <span className="digits flex-1 text-2xl">{num(e.kg)} <span className="text-sm font-medium text-slate-400">kg</span></span>
              <Button variant="ghost" aria-label={`Borrar el peso del ${formatDDMM(e.date)}`} className="text-red-300" onClick={() => void deleteBodyweight(db, e.date)}>Borrar</Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
