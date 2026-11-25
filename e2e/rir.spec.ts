import { expect, test, type Page } from './base'
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

const rir = (page: Page) => page.getByRole('group', { name: 'RIR' })

async function finish(page: Page) {
  await page.getByRole('button', { name: 'Terminar sesión' }).click()
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await expect(page).toHaveURL(/resumen$/)
}

test('RIR: está a la vista en cada serie efectiva, a un toque, y se puede quitar', async ({ page }) => {
  await startThursday(page)
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  // Sin tocar nada más: los cuatro valores ya están, y no hay un "+ RIR" que abrir.
  await expect(page.getByRole('button', { name: '+ RIR' })).toHaveCount(0)
  await expect(rir(page)).toBeVisible()
  for (const v of ['0', '1', '2', '3+']) await expect(rir(page).getByRole('button', { name: v, exact: true })).toBeVisible()
  await expect(rir(page)).toContainText('(opcional)')

  // Elegir y quitar: tocar de nuevo el mismo valor lo borra.
  await rir(page).getByRole('button', { name: '2', exact: true }).click()
  await expect(rir(page).getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await rir(page).getByRole('button', { name: '2', exact: true }).click()
  await expect(rir(page).getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-pressed', 'false')

  // Una aproximación no tiene RIR.
  await page.getByRole('group', { name: 'Tipo de serie' }).getByRole('button', { name: 'Aprox.' }).click()
  await expect(rir(page)).toHaveCount(0)
  await page.getByRole('group', { name: 'Tipo de serie' }).getByRole('button', { name: 'Efectiva' }).click()
  await expect(rir(page)).toBeVisible()

  // Guardar con RIR: queda en la serie y se ve en la lista.
  await rir(page).getByRole('button', { name: '1', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1: .*@1/ })).toBeVisible()
})

test('RIR: se agrega o se cambia desde la lista de series sin pasos de más', async ({ page }) => {
  await startThursday(page)
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click() // sin RIR
  const fila = page.getByRole('button', { name: /^Editar serie 1/ })
  await expect(fila).not.toContainText('@')
  await fila.click()
  await expect(page.getByRole('button', { name: '+ RIR' })).toHaveCount(0)
  await rir(page).getByRole('button', { name: '0', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1/ })).toContainText('@0')
})

test('RIR: el resumen avisa cuántos ejercicios quedaron sin RIR, y no dice nada si están todos', async ({ page }) => {
  await startThursday(page)
  await page.getByRole('link', { name: /rumano/i }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click() // sin RIR
  await page.getByRole('link', { name: '← Sesión' }).click()
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await rir(page).getByRole('button', { name: '2', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1: .*@2/ })).toBeVisible()
  await page.getByRole('link', { name: '← Sesión' }).click()
  await finish(page)
  await expect(page.getByRole('status').filter({ hasText: 'RIR cargado en 1 de 2 ejercicios' })).toBeVisible()
})

test('RIR: con todos los ejercicios cargados el resumen no dice nada', async ({ page }) => {
  await startThursday(page)
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await rir(page).getByRole('button', { name: '1', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1: .*@1/ })).toBeVisible()
  await page.getByRole('link', { name: '← Sesión' }).click()
  await finish(page)
  await expect(page.getByText(/RIR cargado en/)).toHaveCount(0)
})
