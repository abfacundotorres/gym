import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function seedAndDowngrade(page: Page): Promise<number> {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByText('Hacer otro día')).toBeVisible()

  return page.evaluate(async () => {
    const open = (v?: number, up?: (db: IDBDatabase) => void) => new Promise<IDBDatabase>((res, rej) => {
      const r = v ? indexedDB.open('gym', v) : indexedDB.open('gym')
      if (up) r.onupgradeneeded = () => up(r.result)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const old = await open()
    const names = ['exercises', 'planDays', 'mesocycles', 'sessions', 'dayMarks', 'settings', 'meta']
    const rows: Record<string, unknown[]> = {}
    const tx = old.transaction(names, 'readonly')
    await Promise.all(names.map((n) => new Promise<void>((res) => { const q = tx.objectStore(n).getAll(); q.onsuccess = () => { rows[n] = q.result; res() } })))
    old.close()
    await new Promise<void>((res, rej) => { const d = indexedDB.deleteDatabase('gym'); d.onsuccess = () => res(); d.onerror = () => rej(d.error) })
    const v1 = await open(10, (db) => {
      const s = (n: string, key: string, idx: [string, boolean?][]) => { const st = db.createObjectStore(n, { keyPath: key }); idx.forEach(([i, multi]) => st.createIndex(i, i, { multiEntry: !!multi })) }
      s('exercises', 'id', [['family'], ['archived']]); s('planDays', 'id', [['weekday']]); s('mesocycles', 'id', [['startDate'], ['status']])
      s('sessions', 'id', [['date'], ['planDayId'], ['mesocycleId'], ['status'], ['exerciseIds', true]]); s('dayMarks', 'id', [['date']]); s('settings', 'key', []); s('meta', 'key', [])
    })
    const w = v1.transaction(names, 'readwrite')
    for (const n of names) for (const r of rows[n]!) w.objectStore(n).put(r)
    await new Promise<void>((res) => { w.oncomplete = () => res() })
    v1.close()
    return rows.sessions!.length
  })
}

test('al migrar una base vieja la app guarda una copia antes, y los datos siguen ahí (D-82)', async ({ page }) => {
  const sessions = await seedAndDowngrade(page)
  expect(sessions).toBeGreaterThan(0)

  await page.goto('./#/ajustes')
  await page.reload()
  const card = page.getByText('Copias automáticas').locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
  await expect(card).toContainText(`base v1 → v3 · ${sessions} sesiones`)
  // La base migró y sigue teniendo las sesiones.
  await page.goto('./#/historial')
  await expect(page.getByRole('link').filter({ hasText: /\d\d\/\d\d/ }).first()).toBeVisible()
  const count = await page.evaluate(() => new Promise<number>((res) => { const r = indexedDB.open('gym'); r.onsuccess = () => { const q = r.result.transaction('sessions').objectStore('sessions').count(); q.onsuccess = () => { r.result.close(); res(q.result) } } }))
  expect(count).toBe(sessions)
})

test('si no se puede guardar la copia, la app avisa, deja bajarla y seguir (D-82)', async ({ page }) => {
  const sessions = await seedAndDowngrade(page)
  // Una base de seguridad inservible (otra clave primaria): la copia no se puede guardar.
  await page.evaluate(() => new Promise<void>((res, rej) => {
    const q = indexedDB.open('gym-safety', 10)
    q.onupgradeneeded = () => q.result.createObjectStore('snapshots', { keyPath: 'otra' })
    q.onsuccess = () => { q.result.close(); res() }
    q.onerror = () => rej(q.error)
  }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No pude guardar la copia previa' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar copia' }).click()
  const file = await (await download).path()
  const saved = JSON.parse((await import('node:fs')).readFileSync(file!, 'utf8')) as { format: string; data: { sessions: unknown[] } }
  expect(saved.format).toBe('gym-backup')
  expect(saved.data.sessions).toHaveLength(sessions)
  await page.getByRole('button', { name: 'Seguir igual' }).click()
  await expect(page.getByText('Hacer otro día')).toBeVisible()
})
