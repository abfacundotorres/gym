// Fechas como strings ISO locales 'YYYY-MM-DD' (sin zona horaria) para evitar corrimientos.

export type ISODate = string

export const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const

export function parseISODate(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y!, m! - 1, day!)
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 0 = domingo … 6 = sábado (igual que Date#getDay). */
export function weekdayOf(d: ISODate): number {
  return parseISODate(d).getDay()
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = parseISODate(d)
  date.setDate(date.getDate() + n)
  return toISODate(date)
}

/** Lunes de la semana (semana lunes a domingo). */
export function weekStart(d: ISODate): ISODate {
  const wd = weekdayOf(d)
  return addDays(d, wd === 0 ? -6 : 1 - wd)
}

/** dd/mm */
export function formatDDMM(d: ISODate): string {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

/** Días enteros entre a y b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}
