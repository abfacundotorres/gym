import { afterEach, describe, expect, it, vi } from 'vitest'
import { canShareFiles, shareTextFile } from './download'

afterEach(() => vi.unstubAllGlobals())

function nav(canShare: (d: { files: File[] }) => boolean, share = vi.fn(async () => {})) {
  vi.stubGlobal('navigator', { canShare, share })
  return share
}

describe('compartir backup', () => {
  it('no ofrece compartir si el navegador no puede con archivos', () => {
    vi.stubGlobal('navigator', {})
    expect(canShareFiles()).toBe(false)
    nav(() => false)
    expect(canShareFiles()).toBe(false)
    nav(() => true)
    expect(canShareFiles()).toBe(true)
  })

  it('comparte el JSON como application/json si el navegador lo acepta', async () => {
    const share = nav(() => true)
    expect(await shareTextFile('b.json', '{}', 'application/json')).toBe('shared')
    const file = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]!
    expect(file.name).toBe('b.json')
    expect(file.type).toBe('application/json')
  })

  it('si no acepta application/json, lo manda como texto plano con la misma extensión', async () => {
    const share = nav((d) => d.files[0]!.type === 'text/plain')
    expect(await shareTextFile('b.json', '{}', 'application/json')).toBe('shared')
    const file = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]!
    expect(file.name).toBe('b.json')
    expect(file.type).toBe('text/plain')
  })

  it('distingue cancelar de fallar', async () => {
    nav(() => true, vi.fn(async () => { throw new DOMException('cancelado', 'AbortError') }))
    expect(await shareTextFile('b.json', '{}', 'application/json')).toBe('cancelled')
    nav(() => true, vi.fn(async () => { throw new Error('no') }))
    expect(await shareTextFile('b.json', '{}', 'application/json')).toBe('failed')
    nav(() => false)
    expect(await shareTextFile('b.json', '{}', 'application/json')).toBe('failed')
  })
})
