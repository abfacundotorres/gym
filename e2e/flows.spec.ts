import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function startThursday(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await expect(page.getByRole('button', { name: 'Terminar sesión' })).toBeVisible()
}
const openPress = (page: Page) => page.getByRole('link', { name: /Press inclinado/ }).click()

test('saltear un ejercicio y deshacerlo', async ({ page }) => {
  await startThursday(page)
  await openPress(page)
  await page.getByRole('button', { name: 'Más opciones' }).click()
  await page.getByRole('button', { name: 'Saltear ejercicio' }).click()
  await expect(page.getByText('Salteado.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar serie' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Deshacer salteo' }).click()
  await expect(page.getByRole('button', { name: 'Guardar serie' })).toBeVisible()
})

test('editar y borrar una serie guardada', async ({ page }) => {
  await startThursday(page)
  await openPress(page)
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await page.getByRole('button', { name: 'Editar serie 1: 25×8' }).click()
  await page.getByRole('button', { name: 'Más Reps' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar serie 1: 25×9' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar serie 1: 25×9' }).click()
  await page.getByRole('button', { name: 'Borrar' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Guardar serie' })).toBeVisible()
})

test('ejercicio completo: pasar al siguiente, serie extra y saltar entre ejercicios', async ({ page }) => {
  await startThursday(page)
  await openPress(page)
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await page.getByRole('button', { name: 'Repetir la anterior' }).click()
  await page.getByRole('button', { name: 'Repetir la anterior' }).click()
  await expect(page.getByText('Ejercicio completo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar serie' })).toHaveCount(0)

  await page.getByRole('button', { name: '+ Serie extra' }).click()
  await expect(page.getByText('Serie 4 (extra)')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie/ })).toHaveCount(4)
  // Al guardar la extra vuelve la tarjeta, con el botón al siguiente ejercicio.
  await expect(page.getByText('Ejercicio completo')).toBeVisible()
  await page.getByRole('button', { name: /Siguiente: Jalón/ }).click()
  await expect(page.getByRole('heading', { name: /Jalón supino cerrado/ })).toBeVisible()

  await page.getByRole('button', { name: /Ir a Zancadas/ }).click()
  await expect(page.getByRole('heading', { name: 'Zancadas (mancuernas)' })).toBeVisible()
})

test('backup: exportar y restaurar en un navegador vacío conserva las sesiones', async ({ page, browser }, testInfo) => {
  await startThursday(page)
  await openPress(page)
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await page.getByRole('link', { name: '← Sesión' }).click()
  await page.getByRole('button', { name: 'Terminar sesión' }).click()
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  // El título de la lista de la sesión también dice "Full body": se espera el Resumen, que es el destino real.
  await expect(page.getByRole('button', { name: 'Copiar resumen como texto' })).toBeVisible()

  // 6 sesiones del seed de prueba + la de hoy. Se espera el encabezado (si no, se cuenta la pantalla anterior).
  const SESSIONS = 7
  await page.goto('./#/historial')
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(SESSIONS)

  await page.goto('./#/ajustes')
  const download = page.waitForEvent('download', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Exportar JSON' }).click()
  const file = await (await download).path()
  expect(file, 'el navegador no guardó el archivo descargado').toBeTruthy()

  // Otro navegador, sin datos: se restaura solo con el archivo.
  const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 412, height: 915 } })
  const p2 = await other.newPage()
  await p2.goto('./')
  await expect(p2.getByRole('heading', { name: 'Bienvenido' })).toBeVisible({ timeout: 15_000 })
  await p2.locator('input[type=file]').setInputFiles(file)
  await p2.getByRole('button', { name: 'Importar', exact: true }).click()
  await p2.goto('./#/historial')
  await expect(p2.getByRole('heading', { name: 'Historial' })).toBeVisible()
  await expect(p2.getByRole('main').getByRole('listitem')).toHaveCount(SESSIONS, { timeout: 15_000 })
  await p2.goto('./#/plan')
  await expect(p2.getByRole('heading', { name: 'Jueves: Full body' })).toBeVisible()
  await other.close()
})
