import { expect, test, type Page } from './base'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function importSeed(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
}

/** Anota un peso en una fecha pasada (siempre ≤ hoy, así el test no depende del día). */
async function anotar(page: Page, fecha: string, kg: string) {
  await page.getByLabel('Día').fill(fecha)
  await page.getByLabel('Peso (kg)').fill(kg)
  await page.getByRole('button', { name: 'Guardar peso' }).click()
  await expect(page.getByRole('status')).toContainText('Guardado')
}

test('peso corporal: anotar, validar, ver la tendencia semanal y borrar', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/peso')
  await expect(page.getByText('Todavía no anotaste ningún peso')).toBeVisible()

  // Un valor que no es un peso no guarda nada.
  await page.getByLabel('Peso (kg)').fill('hola')
  await page.getByRole('button', { name: 'Guardar peso' }).click()
  await expect(page.getByRole('status')).toContainText('entre 20 y 400 kg')
  await expect(page.getByRole('list', { name: 'Mediciones' })).toHaveCount(0)

  // Cuatro semanas bajando medio kilo por semana (con coma, como se escribe en el celu).
  await anotar(page, '2026-10-19', '84')
  await anotar(page, '2026-10-26', '83,5')
  await anotar(page, '2026-11-02', '83')
  await expect(page.getByText(/Con 3 semanas de mediciones aparece|−0,5 kg por semana/)).toBeVisible()
  await anotar(page, '2026-11-09', '82,5')
  await expect(page.getByText(/−0,5 kg por semana/)).toBeVisible()
  await expect(page.getByRole('figure')).toContainText('Peso semanal (promedio)')
  await expect(page.getByRole('figure')).toContainText('4 semanas')
  await expect(page.getByRole('list', { name: 'Mediciones' }).getByRole('listitem')).toHaveCount(4)

  // Volver a guardar el mismo día lo reemplaza.
  await anotar(page, '2026-11-09', '82')
  await expect(page.getByRole('list', { name: 'Mediciones' }).getByRole('listitem')).toHaveCount(4)
  await expect(page.getByRole('listitem').filter({ hasText: '09/11' })).toContainText('82 kg')

  // Borrar.
  await page.getByRole('button', { name: 'Borrar el peso del 09/11' }).click()
  await expect(page.getByRole('list', { name: 'Mediciones' }).getByRole('listitem')).toHaveCount(3)
})

test('peso corporal: accesos desde Plan y Hoy, y el peso viaja en el backup', async ({ page, browser }, testInfo) => {
  await importSeed(page)
  // Sin pesos y sin fase de cut o bulk, Hoy no muestra nada de esto.
  await page.goto('./#/')
  await expect(page.getByRole('link', { name: /peso de esta semana/i })).toHaveCount(0)

  await page.goto('./#/plan')
  await page.getByRole('link', { name: 'Peso →' }).click()
  await expect(page.getByRole('heading', { name: 'Peso corporal' })).toBeVisible()
  await anotar(page, '2026-10-26', '83')
  await anotar(page, '2026-11-02', '82,5')

  // Ahora Hoy ofrece anotar el de esta semana (el último es viejo) y recuerda el último.
  await page.goto('./#/')
  await expect(page.getByRole('link', { name: /Anotar el peso de esta semana.*último 82,5 kg, 02\/11/ })).toBeVisible()

  // Backup: el archivo trae los pesos y se restauran en un navegador vacío.
  await page.goto('./#/ajustes')
  const download = page.waitForEvent('download', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Exportar JSON' }).click()
  const file = (await (await download).path())!
  const backup = JSON.parse(readFileSync(file, 'utf8'))
  expect(backup.data.bodyweights.map((b: { date: string; kg: number }) => [b.date, b.kg])).toEqual([['2026-10-26', 83], ['2026-11-02', 82.5]])

  const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 412, height: 915 } })
  const p2 = await other.newPage()
  await p2.goto('./')
  await expect(p2.getByRole('heading', { name: 'Bienvenido' })).toBeVisible({ timeout: 15_000 })
  await p2.locator('input[type=file]').setInputFiles(file)
  await p2.getByRole('button', { name: 'Importar', exact: true }).click()
  await p2.goto('./#/peso')
  await expect(p2.getByRole('list', { name: 'Mediciones' }).getByRole('listitem')).toHaveCount(2, { timeout: 15_000 })
  await other.close()
})
