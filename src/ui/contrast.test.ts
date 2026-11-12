import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Contraste WCAG de los pares de color que usa la UI, leyendo los tokens de src/index.css.
 * Si se cambia un color y un par baja del mínimo, este test falla.
 */
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]))
}
const dark = tokens(css.slice(css.indexOf('@theme {'), css.indexOf('html:not(.dark)')))
const light = { ...dark, ...tokens(css.slice(css.indexOf('html:not(.dark)'), css.indexOf('html.dark {'))) }

// Valores por defecto de Tailwind 4 (oklch convertidos a sRGB) para lo que el tema oscuro no redefine.
const TW = { 'slate-100': '#f1f5f9', 'slate-300': '#cad5e2', 'slate-400': '#90a1b9', 'amber-300': '#ffd230', 'sky-300': '#74d4ff', 'red-300': '#ffa2a2' }
const pick = (theme: Record<string, string>, name: string) => theme[name] ?? TW[name as keyof typeof TW]!

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05) }
const mix = (fg: string, bg: string, a: number) => '#' + rgb(fg).map((v, i) => Math.round(v * a + rgb(bg)[i]! * (1 - a)).toString(16).padStart(2, '0')).join('')

const TEXT = ['slate-100', 'slate-300', 'slate-400', 'slate-500', 'amber-300', 'sky-300', 'red-300']
const SURFACES = ['bg', 'surface', 'raised']

describe.each([['oscuro', dark], ['claro', light]] as const)('contraste, tema %s', (_name, theme) => {
  it('los tokens existen', () => {
    for (const k of [...SURFACES, 'accent', 'accent-solid', 'on-accent', 'slate-500', 'slate-600']) expect(pick(theme, k), k).toBeTruthy()
  })
  it.each(TEXT)('texto %s ≥ 4,5:1 sobre fondo, tarjeta y fichas', (t) => {
    for (const s of SURFACES) expect(ratio(pick(theme, t), pick(theme, s)), `${t} sobre ${s}`).toBeGreaterThanOrEqual(4.5)
  })
  it('texto apagado (slate-600) ≥ 3:1', () => {
    for (const s of SURFACES) expect(ratio(pick(theme, 'slate-600'), pick(theme, s)), `slate-600 sobre ${s}`).toBeGreaterThanOrEqual(3)
  })
  it('acento como texto ≥ 4,5:1, también sobre su tinte', () => {
    for (const s of SURFACES) expect(ratio(theme['accent']!, pick(theme, s)), `acento sobre ${s}`).toBeGreaterThanOrEqual(4.5)
    expect(ratio(theme['accent']!, mix(theme['accent']!, theme['surface']!, 0.15))).toBeGreaterThanOrEqual(4.5)
  })
  it('texto sobre el botón de acento ≥ 4,5:1', () => {
    expect(ratio(theme['on-accent']!, theme['accent-solid']!)).toBeGreaterThanOrEqual(4.5)
  })
})
