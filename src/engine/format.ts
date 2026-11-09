/** Número en formato es-AR sin ceros de más: 12.5 → "12,5", 70 → "70". */
export function num(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** Segundos como m:ss (150 → "2:30"). */
export function formatRest(sec: number): string {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
