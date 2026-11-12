import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

test('offline: importar, registrar una sesión, recargar y que todo persista', async ({ page, context }) => {
  const external: string[] = []
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4174')) external.push(r.url()) })

  // Primera visita con red: se instala el service worker y se precachea todo.
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  // Sin red desde acá.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bienvenido' })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()

  // Empezar el jueves (full body), sin readiness.
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await page.getByRole('link', { name: /Press inclinado/ }).click()

  // El motor prellena 25 por mano (objetivo 8/8/7 después del 5/11).
  await expect(page.getByRole('status').first()).toContainText('mismo peso')
  await expect(page.getByRole('status').first()).toContainText('25 por mano × 8·8·7')
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('button', { name: 'Saltar' }).click()
  await page.getByRole('button', { name: 'Repetir la anterior' }).click()
  await page.getByRole('button', { name: 'Más Reps' }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie/ })).toHaveCount(3)
  await expect(page.getByText('Ejercicio completo')).toBeVisible()

  // Ocupado → alternativa en el jalón.
  await page.getByRole('button', { name: 'Siguiente →' }).click()
  await page.getByRole('button', { name: 'Más opciones' }).click()
  await page.getByRole('button', { name: 'Ocupado → alternativa' }).click()
  await page.getByRole('button', { name: 'Jalón agarre neutro' }).click()
  await expect(page.getByRole('heading', { name: 'Jalón agarre neutro' })).toBeVisible()
  await expect(page.getByText(/En lugar de Jalón supino/)).toBeVisible()

  // Recargar sin red: la sesión en curso sigue ahí.
  await page.reload()
  await page.getByRole('link', { name: '← Sesión' }).click()
  await expect(page.getByText('25×8 · 25×8 · 25×8')).toBeVisible()
  await page.getByRole('button', { name: 'Terminar sesión' }).click()
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await expect(page.locator('pre')).toContainText('Press inclinado (mancuernas) (por mano): 25×8, 25×8, 25×8')

  // Otra recarga: aparece en el historial.
  await page.reload()
  await page.goto('./#/historial/ej/incline_db_press')
  await expect(page.getByRole('list', { name: 'Sesiones' }).getByRole('listitem').first()).toContainText('25×8')
  expect(external).toEqual([])
})
