import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** localStorage mínimo para el entorno de pruebas (node). */
function fakeStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), raw: m }
}

let ls: ReturnType<typeof fakeStorage>
async function load() {
  vi.resetModules() // el estado del temporizador se lee de localStorage al importar el módulo
  return import('./restTimer')
}
beforeEach(() => {
  ls = fakeStorage()
  vi.stubGlobal('localStorage', ls)
  vi.stubGlobal('AudioContext', class { resume() {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('"Saltar" y el descanso real (D-71)', () => {
  it('Saltar corta el temporizador y recuerda cuándo, para el ejercicio de ese temporizador', async () => {
    const t = await load()
    t.startRest(90, 'Press inclinado', 1_000, 'press')
    expect(ls.getItem('gym.restTimer')).not.toBeNull()
    t.skipRest(61_000)
    expect(ls.getItem('gym.restTimer')).toBeNull() // el temporizador se cortó
    expect(t.takeRestSkip('press')).toBe(61_000)
  })
  it('la marca se usa una sola vez', async () => {
    const t = await load()
    t.startRest(90, 'x', 1_000, 'press')
    t.skipRest(61_000)
    expect(t.takeRestSkip('press')).toBe(61_000)
    expect(t.takeRestSkip('press')).toBeUndefined()
  })
  it('la marca de un ejercicio no la consume otro', async () => {
    const t = await load()
    t.startRest(90, 'x', 1_000, 'press')
    t.skipRest(61_000)
    expect(t.takeRestSkip('curl')).toBeUndefined()
    expect(t.takeRestSkip('press')).toBe(61_000) // sigue ahí para el suyo
  })
  it('una superserie tiene su propia clave', async () => {
    const t = await load()
    t.startRest(90, 'Superserie', 1_000, 'group:g-1')
    t.skipRest(50_000)
    expect(t.takeRestSkip('press')).toBeUndefined()
    expect(t.takeRestSkip('group:g-1')).toBe(50_000)
  })
  it('sin temporizador, o sin clave, "Saltar" no deja marca', async () => {
    const t = await load()
    t.skipRest(5_000)
    expect(t.takeRestSkip('press')).toBeUndefined()
    t.startRest(90, 'sin clave', 1_000)
    t.skipRest(61_000)
    expect(ls.raw.has('gym.restSkip')).toBe(false)
  })
  it('una marca rota en el almacenamiento no rompe nada', async () => {
    const t = await load()
    ls.setItem('gym.restSkip', '{no es json')
    expect(t.takeRestSkip('press')).toBeUndefined()
    ls.setItem('gym.restSkip', JSON.stringify({ key: 'press', at: 'ayer' }))
    expect(t.takeRestSkip('press')).toBeUndefined()
  })
  it('un nuevo temporizador reemplaza al anterior y guarda la clave', async () => {
    const t = await load()
    t.startRest(45, 'Press (aprox.)', 1_000, 'press')
    t.startRest(150, 'Press', 20_000, 'press')
    expect(JSON.parse(ls.getItem('gym.restTimer')!)).toMatchObject({ endsAt: 170_000, key: 'press', label: 'Press' })
  })
})
