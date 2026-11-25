import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

// La última sesión del seed es del 05/11/2026: con la fecha fija, los días sin entrenar no dependen del día en que se corre.
async function importAt(page: Page, iso: string) {
  await page.clock.install({ time: new Date(`${iso}T10:00:00`) })
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
}

test('vuelta: tras 15 días sin entrenar se ofrece, baja la carga y las series, y queda en la sesión', async ({ page }) => {
  await importAt(page, '2026-11-20')
  const chip = page.getByRole('button', { name: 'Vuelta tras 15 días' })
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/~95 % de la carga de la última vez, menos series y 2 en reserva/)).toBeVisible()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Vuelta tras 15 días' })).toBeVisible()
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  const card = page.getByRole('status').filter({ hasText: 'Vuelta' }).first()
  await expect(card).toContainText('Vuelta')
  await expect(card).toContainText(/22,5/) // 25 kg de la última vez, −5 %: 23,75 → baja un paso
  await expect(card).toContainText('Hace 15 días que no entrenás')

  // Persiste: al recargar sigue siendo una sesión de vuelta, en el ejercicio y en la lista de la sesión.
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'Hace 15 días que no entrenás' })).toBeVisible()
  await page.getByRole('link', { name: '← Sesión' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Vuelta tras 15 días' })).toBeVisible()
})

test('vuelta: se puede desactivar y entonces se entrena como siempre', async ({ page }) => {
  await importAt(page, '2026-11-20')
  await page.getByRole('button', { name: 'Vuelta tras 15 días' }).click()
  await expect(page.getByText('Hoy entrenás como siempre, con las sugerencias normales.')).toBeVisible()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await expect(page.getByText(/Vuelta tras 15 días/)).toHaveCount(0)
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await expect(page.getByText('Hace 15 días que no entrenás')).toHaveCount(0)
  await expect(page.getByText('Vuelta', { exact: true })).toHaveCount(0)
})

test('vuelta: con 2 días sin entrenar no hay nada que ofrecer', async ({ page }) => {
  await importAt(page, '2026-11-07')
  await expect(page.getByRole('button', { name: 'Omitir y empezar' })).toBeVisible()
  await expect(page.getByText(/Vuelta tras/)).toHaveCount(0)
})

test('vuelta: tras 45 días la reducción es mayor (80 % y la mitad de las series)', async ({ page }) => {
  await importAt(page, '2026-12-20')
  await expect(page.getByText(/~80 % de la carga de la última vez, menos series y 3 en reserva/)).toBeVisible()
})
