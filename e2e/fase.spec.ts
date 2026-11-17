import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function importSeed(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
}

test('fase: elegir Cut en el Plan, aplicar el bloque sugerido y ver el efecto en Volumen y en la revisión', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/plan')
  await page.getByRole('button', { name: 'Editar', exact: true }).click()

  // Sin fase, el motor se comporta como siempre; al elegir Cut aparece la sugerencia de bloque.
  const fase = page.getByRole('group', { name: 'Fase' })
  await expect(fase.getByRole('button', { name: 'Sin definir' })).toHaveAttribute('aria-pressed', 'true')
  await fase.getByRole('button', { name: 'Cut', exact: true }).click()
  await expect(page.getByText(/Sugerido para Cut: 4 semanas de acumulación \+ 1 de deload/)).toBeVisible()
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Semanas de acumulación: 4,/ })).toBeVisible()
  await expect(page.getByText(/Sugerido para Cut/)).toHaveCount(0) // ya aplicada
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  // La tarjeta del mesociclo muestra la fase y cómo se interpreta.
  await expect(page.getByText('Cut', { exact: true })).toBeVisible()
  await expect(page.getByText(/estancarte o bajar un poco el e1RM no dispara alarmas/)).toBeVisible()

  // Volumen: el objetivo baja a 80 %.
  await page.goto('./#/volumen')
  await expect(page.getByText('Objetivo ajustado a Cut: 80 % de los rangos de Ajustes.')).toBeVisible()

  // Ajustes explica la relación con los rangos base.
  await page.goto('./#/ajustes')
  await page.getByText('Rango objetivo de series por músculo y semana').click()
  await expect(page.getByText(/En un mesociclo en Cut se usa el 80 %/)).toBeVisible()

  // La revisión del bloque propone seguir en la misma fase para el siguiente.
  await page.goto('./#/plan/revision')
  await expect(page.getByRole('group', { name: 'Fase' }).getByRole('button', { name: 'Cut', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('group', { name: 'Fase' }).getByRole('button', { name: 'Bulk', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Fase' }).getByRole('button', { name: 'Bulk', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Persiste al recargar.
  await page.goto('./#/plan')
  await page.reload()
  await expect(page.getByText('Cut', { exact: true })).toBeVisible()
})

test('fase: sin fase todo sigue igual y se puede volver a "Sin definir"', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/volumen')
  await expect(page.getByText(/Objetivo ajustado a/)).toHaveCount(0)
  await page.goto('./#/plan')
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await page.getByRole('group', { name: 'Fase' }).getByRole('button', { name: 'Bulk', exact: true }).click()
  await page.getByRole('group', { name: 'Fase' }).getByRole('button', { name: 'Sin definir' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Bulk', { exact: true })).toHaveCount(0)
})
