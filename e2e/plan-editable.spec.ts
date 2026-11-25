import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function openPlan(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await expect(page.getByText('Hacer otro día')).toBeVisible()
  await page.goto('./#/plan')
  await page.getByRole('button', { name: 'Editar ejercicios' }).click()
}
/** Nombres de ejercicios del primer día del plan, en orden. */
const firstDay = (page: Page) => page.locator('section ul').first().locator('li > div:first-child .font-medium').allTextContents()

test('plan: sumar un ejercicio existente, subirlo, bajarlo y sacarlo (el historial se conserva)', async ({ page }) => {
  await openPlan(page)
  const before = await firstDay(page)
  expect(before).not.toContain('Curl polea baja')

  await page.getByRole('button', { name: '+ Agregar ejercicio' }).first().click()
  await page.getByRole('textbox', { name: 'Buscar ejercicio' }).fill('polea baja')
  await page.getByRole('button', { name: '+ Curl polea baja' }).click()
  await expect.poll(() => firstDay(page)).toEqual([...before, 'Curl polea baja'])

  await page.getByRole('button', { name: 'Subir Curl polea baja' }).click()
  await expect.poll(async () => (await firstDay(page)).slice(-2)).toEqual(['Curl polea baja', before.at(-1)])
  await page.getByRole('button', { name: 'Bajar Curl polea baja' }).click()
  await expect.poll(() => firstDay(page)).toEqual([...before, 'Curl polea baja'])
  await expect(page.getByRole('button', { name: 'Bajar Curl polea baja' })).toBeDisabled()

  // Persiste al recargar.
  await page.reload()
  await page.getByRole('button', { name: 'Editar ejercicios' }).click()
  await expect.poll(() => firstDay(page)).toEqual([...before, 'Curl polea baja'])

  // Sacar uno con historial (Press banca plano): se confirma y el historial sigue.
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: /^Sacar Press banca plano/ }).click()
  await expect.poll(() => firstDay(page)).not.toContain('Press banca plano (barra)')
  await page.goto('./#/historial/ej/bench_flat_barbell')
  await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible()
})

test('plan: crear un ejercicio nuevo desde el día y que quede en el plan y en Ejercicios', async ({ page }) => {
  await openPlan(page)
  await page.getByRole('button', { name: '+ Agregar ejercicio' }).first().click()
  await page.getByRole('link', { name: 'Crear un ejercicio nuevo' }).click()

  const create = page.getByRole('button', { name: /^Crear y agregar a/ })
  await expect(create).toBeDisabled()
  await page.getByRole('textbox', { name: 'Nombre' }).fill('Remo unilateral (mancuerna)')
  await expect(create).toBeDisabled() // falta un músculo primario
  await page.getByRole('group', { name: 'Músculos primarios' }).getByRole('button', { name: 'Dorsales' }).click()
  await page.getByRole('group', { name: 'Unidad' }).getByRole('button', { name: 'Por mano (mancuerna)' }).click()
  await expect(create).toBeEnabled()
  await create.click()

  await expect(page).toHaveURL(/#\/plan$/)
  await page.getByRole('button', { name: 'Editar ejercicios' }).click()
  await expect.poll(async () => (await firstDay(page)).at(-1)).toBe('Remo unilateral (mancuerna)')

  await page.goto('./#/ejercicios/remo_unilateral_mancuerna')
  await expect(page.getByRole('heading', { name: 'Remo unilateral (mancuerna)' })).toBeVisible()
  await expect(page.getByText('Usado en 0 sesiones')).toBeVisible()
})
