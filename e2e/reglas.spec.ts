import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function importSeed(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
}

async function chooseDeload(page: Page, label: string) {
  await page.goto('./#/ajustes')
  await page.getByText('Reglas del motor: vuelta, avisos y deload').click()
  await page.getByRole('group', { name: 'Tipo de deload' }).getByRole('button', { name: label }).click()
  await expect(page.getByRole('group', { name: 'Tipo de deload' }).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
}

async function deloadThisWeek(page: Page) {
  await page.goto('./#/plan')
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Hacer deload esta semana' }).click()
}

async function pressCard(page: Page) {
  await page.goto('./#/')
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  return page.getByRole('status').filter({ hasText: 'Deload' }).first()
}

test('reglas: el deload de siempre baja la carga un 10 %', async ({ page }) => {
  await importSeed(page)
  await deloadThisWeek(page)
  await page.goto('./#/')
  await expect(page.getByText('Semana de deload: la mitad de las series, −10 % de carga')).toBeVisible()
  const card = await pressCard(page)
  await expect(card).toContainText('22,5 por mano') // 25 kg de la última vez
})

test('reglas: el deload más liviano baja un 20 %, se recuerda al recargar y se ve en Hoy', async ({ page }) => {
  await importSeed(page)
  await chooseDeload(page, 'Más liviano')
  await expect(page.getByText('La mitad de las series y −20 % de carga.')).toBeVisible()
  await page.reload()
  await page.getByText('Reglas del motor: vuelta, avisos y deload').click()
  await expect(page.getByRole('group', { name: 'Tipo de deload' }).getByRole('button', { name: 'Más liviano' })).toHaveAttribute('aria-pressed', 'true')

  await deloadThisWeek(page)
  await page.goto('./#/')
  await expect(page.getByText('Semana de deload: la mitad de las series, −20 % de carga')).toBeVisible()
  const card = await pressCard(page)
  await expect(card).toContainText('20 por mano') // 25 kg × 0,8
})

test('reglas: la semana sin pesas dice que se descansa, y entrenando igual sale liviano', async ({ page }) => {
  await importSeed(page)
  await chooseDeload(page, 'Semana sin pesas')
  await deloadThisWeek(page)
  await page.goto('./#/')
  await expect(page.getByText('Semana sin pesas: descansá.')).toBeVisible()
  const card = await pressCard(page)
  await expect(card).toContainText('20 por mano')
})

test('reglas: un umbral de avisos propio cambia cuándo se avisa', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/ajustes')
  await page.getByText('Reglas del motor: vuelta, avisos y deload').click()
  await page.getByRole('button', { name: 'Más Compuestos al fallo en una sesión para avisar (por defecto 2)' }).click()
  await expect(page.getByRole('button', { name: /^Compuestos al fallo en una sesión para avisar \(por defecto 2\): 3, tocar/ })).toBeVisible()
  await page.getByRole('button', { name: 'Menos Compuestos al fallo en una sesión para avisar (por defecto 2)' }).click()
  await page.getByRole('button', { name: 'Menos Compuestos al fallo en una sesión para avisar (por defecto 2)' }).click() // 2 es el mínimo: no baja
  await expect(page.getByRole('button', { name: /^Compuestos al fallo en una sesión para avisar \(por defecto 2\): 2, tocar/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restablecer las reglas' })).toHaveCount(0) // volvió al valor por defecto: no queda nada guardado
})
