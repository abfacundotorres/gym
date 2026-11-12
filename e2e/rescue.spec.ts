import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function startSession(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await expect(page.getByRole('button', { name: 'Terminar sesión' })).toBeVisible()
}

/** Cambia a mano la sesión en curso en IndexedDB (para simular un día viejo o datos rotos). */
async function editActiveSession(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(async (p) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('gym'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')
    const all = await new Promise<{ status: string }[]>((res) => { const r = store.getAll(); r.onsuccess = () => res(r.result) })
    for (const s of all) if (s.status === 'in_progress') store.put({ ...s, ...p })
    await new Promise<void>((res) => { tx.oncomplete = () => res() })
    db.close()
  }, patch)
}

test('una sesión vieja sin terminar se puede descartar desde Hoy', async ({ page }) => {
  await startSession(page)
  await editActiveSession(page, { date: '2026-01-05' })
  await page.goto('./#/')
  await page.reload()
  await expect(page.getByText(/Quedó sin terminar · 05\/01/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Descartar' }).click()
  await expect(page.getByText(/Quedó sin terminar/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible()
})

test('si una pantalla falla, aparece el rescate y se puede exportar el backup', async ({ page }) => {
  await startSession(page)
  await editActiveSession(page, { items: null }) // dato roto: la tarjeta de Hoy no puede dibujarse
  await page.goto('./#/')
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Algo falló')
  await expect(page.getByRole('alert')).toContainText('Tus datos están a salvo')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar backup' }).click()
  expect((await download).suggestedFilename()).toMatch(/^gym-backup-.*\.json$/)
  // La navegación sigue disponible y otra pantalla que no usa el dato roto funciona.
  await page.getByRole('link', { name: 'Plan' }).click()
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
})
