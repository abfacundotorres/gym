import { daysBetween, weekStart, type ISODate } from './dates'

/** Peso corporal (D-70): una medición por día, opcional. No se usa en ningún cálculo de carga ni de progresión. */
export interface Bodyweight { id: string; date: ISODate; kg: number }

export const bodyweightId = (date: ISODate) => `bw-${date}`

export const MIN_KG = 20
export const MAX_KG = 400

/** "82,4" o "82.4" → 82.4; fuera de rango o con basura → null. Un decimal. */
export function parseKg(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null
  const v = Math.round(Number(t) * 10) / 10
  return v >= MIN_KG && v <= MAX_KG ? v : null
}

export interface WeekPoint { monday: ISODate; kg: number; n: number }

/** Promedio por semana (lunes a domingo), de la más vieja a la más nueva: una semana con varias mediciones cuenta una vez. */
export function weeklySeries(entries: Pick<Bodyweight, 'date' | 'kg'>[]): WeekPoint[] {
  const byWeek = new Map<ISODate, number[]>()
  for (const e of entries) byWeek.set(weekStart(e.date), [...(byWeek.get(weekStart(e.date)) ?? []), e.kg])
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([monday, kgs]) => ({ monday, kg: Math.round((kgs.reduce((a, b) => a + b, 0) / kgs.length) * 100) / 100, n: kgs.length }))
}

/**
 * Cambio de peso por semana (kg/semana): pendiente por mínimos cuadrados de las últimas `maxWeeks` semanas con datos, contando
 * las semanas reales (una semana sin medir no se inventa). Hacen falta al menos 3 semanas; si no, null. Es una descripción, no una meta.
 */
export function weeklyRate(series: WeekPoint[], maxWeeks = 4): number | null {
  const pts = series.slice(-maxWeeks)
  if (pts.length < 3) return null
  const x = pts.map((p) => daysBetween(pts[0]!.monday, p.monday) / 7)
  const mx = x.reduce((a, b) => a + b, 0) / x.length
  const my = pts.reduce((a, p) => a + p.kg, 0) / pts.length
  const num = x.reduce((a, xi, i) => a + (xi - mx) * (pts[i]!.kg - my), 0)
  const den = x.reduce((a, xi) => a + (xi - mx) ** 2, 0)
  return den === 0 ? null : num / den
}
