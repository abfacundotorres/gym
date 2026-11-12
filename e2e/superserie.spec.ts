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

/** Lateral (4 series) + posterior (3) + curl (3): el caso real, con distinta cantidad de series. */
async function makeSuperset(page: Page) {
  await page.getByRole('button', { name: 'Hacer superserie' }).click()
  await expect(page.getByRole('button', { name: /^Agrupar/ })).toBeDisabled()
  for (const n of [/Vuelos laterales/, /Deltoide posterior/, /Curl inclinado/]) await page.getByRole('checkbox', { name: n }).click()
  await page.getByRole('button', { name: 'Agrupar (3)' }).click()
  await expect(page.getByRole('heading', { name: 'Superserie' })).toBeVisible()
}
const card = (page: Page, name: RegExp) => page.getByRole('group', { name })

test('superserie: tres ejercicios en rondas, cada uno completa las suyas', async ({ page }) => {
  await startThursday(page)
  await makeSuperset(page)
  await expect(page.getByText('Ronda 1 de 4')).toBeVisible()

  for (let r = 1; r <= 3; r++) {
    await page.getByRole('button', { name: /Guardar ronda/ }).click()
    await expect(page.getByText(`Ronda ${r + 1} de 4`)).toBeVisible()
  }
  // Un solo descanso, al cerrar la ronda.
  await expect(page.getByRole('timer')).toContainText('Superserie')
  // Posterior y curl (3 series) ya terminaron; el lateral (4) sigue.
  await expect(card(page, /Deltoide posterior/).getByText('✓ Completo')).toBeVisible()
  await expect(card(page, /Curl inclinado/).getByText('✓ Completo')).toBeVisible()
  await expect(card(page, /Vuelos laterales/).getByRole('button', { name: 'Más Reps' })).toBeVisible()
  await expect(card(page, /Deltoide posterior/).getByRole('button', { name: 'Más Reps' })).toHaveCount(0)

  await page.getByRole('button', { name: /Guardar ronda/ }).click()
  await expect(page.getByText('Superserie completa').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Siguiente: Tríceps/ })).toBeVisible()
  await expect(card(page, /Vuelos laterales/).getByRole('button', { name: /^Editar serie/ })).toHaveCount(4)
})

test('superserie: se conserva al recargar, se edita una serie y se puede deshacer', async ({ page }) => {
  await startThursday(page)
  await makeSuperset(page)
  await page.getByRole('button', { name: /Guardar ronda/ }).click()
  await expect(page.getByText('Ronda 2 de 4')).toBeVisible() // ya se guardó
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Superserie' })).toBeVisible()
  await expect(page.getByText('Ronda 2 de 4')).toBeVisible()

  // Editar una serie del grupo sin salir de la pantalla.
  const lateral = card(page, /Vuelos laterales/)
  await lateral.getByRole('button', { name: /^Editar serie 1/ }).click()
  await lateral.getByRole('button', { name: 'Más Reps' }).click()
  await lateral.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(lateral.getByRole('button', { name: 'Editar serie 1: 12,5×11' })).toBeVisible()

  // La lista de la sesión muestra el grupo.
  await page.getByRole('link', { name: '← Sesión' }).click()
  await expect(page.getByText('Superserie', { exact: true })).toBeVisible()

  // Deshacer: los ejercicios quedan sueltos y con sus series.
  await page.getByRole('link', { name: /Vuelos laterales/ }).click()
  await page.getByRole('button', { name: 'Más opciones' }).click()
  await page.getByRole('button', { name: 'Deshacer superserie' }).click()
  await expect(page.getByRole('heading', { name: /Vuelos laterales/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Editar serie/ })).toHaveCount(1)
})

test('superserie: el botón no aparece con menos de dos ejercicios disponibles y se puede cancelar', async ({ page }) => {
  await startThursday(page)
  await page.getByRole('button', { name: 'Hacer superserie' }).click()
  await page.getByRole('checkbox', { name: /Vuelos laterales/ }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('button', { name: 'Hacer superserie' })).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
})
