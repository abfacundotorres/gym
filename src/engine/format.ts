/** Número en formato es-AR sin ceros de más: 12.5 → "12,5", 70 → "70". */
export function num(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}
