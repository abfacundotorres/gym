import { formatDDMM, toISODate } from '../engine/dates'

export function formatTimestamp(ms: number): string {
  const d = new Date(ms)
  return `${formatDDMM(toISODate(d))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fileStamp(ms = Date.now()): string {
  return toISODate(new Date(ms))
}
