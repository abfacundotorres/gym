import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function importSeed(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
}

test('resumen: sin sesiones terminadas, lo dice', async ({ page }) => {
  await page.goto('./#/resumen')
  await expect(page.getByText('Todavía no hay sesiones terminadas.')).toBeVisible()
})

test('resumen: se llega desde el Historial y desde el Plan', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/historial')
  await page.getByRole('link', { name: 'Resumen →' }).click()
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
  await page.goto('./#/plan')
  await page.getByRole('link', { name: 'Resumen →' }).click()
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
})

test('resumen de la semana: navegar entre semanas, con sus sesiones, volumen y récords', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/resumen')
  // Esta semana (la del 09/11) todavía no tiene sesiones; no se puede ir al futuro.
  await expect(page.getByText('09/11 al 15/11', { exact: true })).toBeVisible()
  await expect(page.getByText('esta semana')).toBeVisible()
  await expect(page.locator('p').filter({ hasText: '0 de 3 sesiones' })).toBeVisible()
  await expect(page.getByText('Sin sesiones en este período.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled()

  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await expect(page.getByText('02/11 al 08/11', { exact: true })).toBeVisible()
  await expect(page.getByText('esta semana')).toHaveCount(0)
  await expect(page.locator('p').filter({ hasText: '3 de 3 sesiones' })).toBeVisible()
  await expect(page.locator('p').filter({ hasText: '46,5 series efectivas' })).toBeVisible()
  await expect(page.getByRole('link', { name: /02\/11 · Lunes: Torso/ })).toContainText('13 series')
  await expect(page.getByRole('link', { name: /05\/11 · Jueves: Full body/ })).toContainText('22,5 series')
  await expect(page.getByText('Series por músculo', { exact: true })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Pecho' })).toContainText('6,5')
  await expect(page.getByText('Récords (6)')).toBeVisible()
  await expect(page.locator('p').filter({ hasText: 'RIR cargado en 0 de 18 ejercicios' })).toBeVisible()

  // Hacia atrás hasta la primera semana con sesiones; ahí ya no hay "anterior".
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await expect(page.getByText('19/10 al 25/10', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Semana anterior' })).toBeDisabled()
  await page.getByRole('button', { name: 'Semana siguiente' }).click()
  await expect(page.getByText('26/10 al 01/11', { exact: true })).toBeVisible()
})

test('resumen del bloque: del primer lunes hasta hoy, con el promedio semanal', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/resumen')
  await page.getByRole('button', { name: 'Bloque', exact: true }).click()
  await expect(page.getByText(/Del 19\/10 al 09\/11/)).toBeVisible()
  await expect(page.getByText(/3 semanas con sesiones sin contar el deload/)).toBeVisible()
  await expect(page.locator('p').filter({ hasText: '6 sesiones' })).toBeVisible()
  await expect(page.locator('p').filter({ hasText: '89,5 series efectivas' })).toBeVisible()
  await expect(page.getByText('Series por semana (promedio)')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Pecho' })).toContainText('4,2')
  await expect(page.getByRole('combobox', { name: 'Bloque' })).toHaveCount(0) // un solo bloque: no hay nada que elegir
})

test('resumen: el texto copiable trae lo mismo que la pantalla, y una molestia aparece en su semana', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Anotar una molestia' }).click()
  await page.getByRole('group', { name: 'Zona', exact: true }).getByRole('button', { name: 'Cuello', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  await page.goto('./#/resumen')
  await expect(page.getByText('Cuello · molestia · desde 09/11 (sigue)')).toBeVisible()
  await page.getByText('Ver el texto').click()
  const pre = page.locator('pre')
  await expect(pre).toContainText('Semana del 09/11 al 15/11')
  await expect(pre).toContainText('Molestia: Cuello (molestia) desde 09/11')

  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await expect(pre).toContainText('Semana del 02/11 al 08/11')
  await expect(pre).toContainText('Sesiones: 3 de 3 · 46,5 series efectivas')
  await expect(pre).toContainText('- 05/11 Jueves: Full body: 22,5 series')
  await expect(page.getByText(/^Cuello · molestia/)).toHaveCount(0) // la molestia empezó después de esa semana
  await page.getByRole('button', { name: 'Bloque', exact: true }).click()
  await expect(pre).toContainText('Bloque del 19/10 al 09/11')
})

test('resumen: cada sesión lleva a su resumen', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/resumen')
  await page.getByRole('button', { name: 'Semana anterior' }).click()
  await page.getByRole('link', { name: /02\/11 · Lunes: Torso/ }).click()
  await expect(page).toHaveURL(/\/sesion\/.+\/resumen$/)
  await expect(page.getByText(/Resumen · 02\/11/)).toBeVisible()
})
