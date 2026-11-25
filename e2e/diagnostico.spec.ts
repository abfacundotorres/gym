import { expect, test } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

test('diagnóstico: con datos sanos dice que todo está en orden; con una referencia rota la marca y se puede copiar', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByText('Hacer otro día')).toBeVisible()

  await page.goto('./#/ajustes')
  await page.getByRole('link', { name: /^Diagnóstico/ }).click()
  await expect(page.getByText('✓ Todo en orden')).toBeVisible()
  await expect(page.getByText('esquema v3', { exact: true })).toBeVisible()
  await expect(page.getByText('Sesiones', { exact: true }).locator('xpath=following-sibling::span')).toHaveText('6')

  // Se rompe una referencia a mano: un ejercicio del plan que no existe.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('gym'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const tx = db.transaction('planDays', 'readwrite')
    const store = tx.objectStore('planDays')
    const all = await new Promise<{ items: unknown[] }[]>((res) => { const r = store.getAll(); r.onsuccess = () => res(r.result) })
    store.put({ ...all[0]!, items: [{ exerciseId: 'fantasma', sets: 3, alt: [] }, ...all[0]!.items] })
    await new Promise<void>((res) => { tx.oncomplete = () => res() })
    db.close()
  })
  await page.getByRole('button', { name: 'Revisar de nuevo' }).click()
  await expect(page.getByText('1 problema', { exact: true })).toBeVisible()
  await expect(page.getByText('El plan tiene ejercicios que ya no existen')).toBeVisible()
  await expect(page.getByText(/fantasma/)).toBeVisible()

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copiar para avisar' }).click()
  await expect(page.getByText(/Copiado\./)).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('ERROR plan-ejercicio (1)')
  expect(text).toContain('esquema v3')
})
