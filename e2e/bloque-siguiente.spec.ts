import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

test('bloque siguiente: preparar la plantilla, verla en la revisión y que se aplique al empezarlo', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()

  // Sin plantilla: la tarjeta del Plan ofrece prepararla y la revisión no muestra nada de plantilla.
  await page.goto('./#/plan')
  await page.getByRole('link', { name: 'Preparar el bloque siguiente' }).click()
  await expect(page.getByRole('heading', { name: 'Bloque siguiente' })).toBeVisible()
  await page.getByRole('button', { name: 'Preparar desde el plan de hoy' }).click()
  await expect(page.getByText('Igual que el plan de hoy')).toBeVisible()

  // Tres cambios: variante titular, series y un ejercicio que se saca.
  await page.getByRole('group', { name: 'Variante de Remo esternal 45° (camilla)' }).getByRole('button', { name: 'Polea' }).click()
  await expect(page.getByRole('group', { name: 'Variante de Remo bajo (polea)' }).getByRole('button', { name: 'Polea' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('group', { name: 'Remo bajo (polea)', exact: true }).getByRole('button', { name: 'Más Series' }).click()
  await page.getByRole('button', { name: 'Sacar Gemelos (máquina/prensa)' }).click()
  await expect(page.getByText('3 cambios respecto del plan de hoy')).toBeVisible()
  await expect(page.getByText('Remo esternal 45° (camilla) → Remo bajo (polea)')).toBeVisible()
  await expect(page.getByText('Remo esternal 45° (camilla): 3 → 4 series')).toBeVisible()
  await expect(page.getByText('Gemelos (máquina/prensa): se saca')).toBeVisible()

  // Persiste al recargar y no toca el plan de hoy.
  await page.reload()
  await expect(page.getByText('3 cambios respecto del plan de hoy')).toBeVisible()
  await page.goto('./#/plan')
  await expect(page.getByRole('link', { name: 'Bloque siguiente · 3 cambios' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lunes: Torso' }).locator('..').getByText('Remo esternal 45° (camilla)')).toBeVisible()
  await expect(page.getByText('Gemelos (máquina/prensa)').first()).toBeVisible()

  // La revisión muestra la plantilla y propone encima: lo que ya rotaste no se vuelve a proponer.
  await page.goto('./#/plan/revision')
  await expect(page.getByText('Tu plantilla del bloque siguiente')).toBeVisible()
  await expect(page.getByText(/3 cambios sobre el plan de hoy/)).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /^Remo esternal 45° \(camilla\) → / })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: /^Remo bajo \(polea\) → / })).toHaveCount(1) // la opcional, ahora sobre la titular nueva

  // Empezar el bloque aplica la plantilla.
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: /^Empezar el siguiente/ }).click()
  await expect(page).toHaveURL(/\/plan$/)
  await expect(page.getByText('Todavía no empezó')).toBeVisible()
  await expect(page.getByText('Remo bajo (polea)').first()).toBeVisible()
  await expect(page.getByText('Remo esternal 45° (camilla)')).toHaveCount(0) // pasó a alternativa, ya no es la titular
  await expect(page.getByText('Gemelos (máquina/prensa)')).toHaveCount(0)
  await expect(page.getByText(/Plantilla: 3 cambios/)).toBeVisible()
  // La plantilla se consumió: la tarjeta vuelve a ofrecer preparar la siguiente.
  await expect(page.getByRole('link', { name: 'Preparar el bloque siguiente' })).toBeVisible()
})

test('bloque siguiente: descartar la plantilla no cambia el plan de hoy', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.goto('./#/plan/siguiente')
  await page.getByRole('button', { name: 'Preparar desde el plan de hoy' }).click()
  await page.getByRole('button', { name: 'Sacar Gemelos (máquina/prensa)' }).click()
  await expect(page.getByText('1 cambio respecto del plan de hoy')).toBeVisible()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Descartar la plantilla' }).click()
  await expect(page.getByRole('button', { name: 'Preparar desde el plan de hoy' })).toBeVisible()
  await page.goto('./#/plan')
  await expect(page.getByText('Gemelos (máquina/prensa)').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Preparar el bloque siguiente' })).toBeVisible()
})
