import { formatDDMM, toISODate, weekdayOf, WEEKDAYS_ES } from '../../engine/dates'

// H0: placeholder. El plan real sale de Dexie a partir de H1/H2.
const FIXED_DAYS: Record<number, string> = { 1: 'Lunes: Torso', 2: 'Martes: Pierna A', 4: 'Jueves: Full body' }

export function TodayPage() {
  const today = toISODate(new Date())
  const wd = weekdayOf(today)
  const planName = FIXED_DAYS[wd]
  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm capitalize text-slate-400">
          {WEEKDAYS_ES[wd]} {formatDDMM(today)}
        </p>
        <h1 className="text-2xl font-bold">{planName ?? 'Día libre'}</h1>
      </header>
      <p className="rounded-xl bg-surface p-4 text-sm text-slate-300 ring-1 ring-line">
        {planName ? 'El registro de sesión llega en el hito H2.' : 'Hoy no hay entrenamiento planificado.'}
      </p>
    </section>
  )
}
