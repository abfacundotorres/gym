import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

/** Seed importado, el jalón de agarre neutro corregido (no carga el cuello) y una molestia de cuello anotada. */
async function setup(page: Page, zone = 'Cuello') {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.goto('./#/ejercicios/pulldown_neutral')
  await page.getByRole('group', { name: 'Zonas que carga' }).getByRole('button', { name: 'Cuello' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardado ✓' })).toBeVisible()
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Anotar una molestia' }).click()
  await page.getByRole('group', { name: 'Zona', exact: true }).getByRole('button', { name: zone, exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
}

const jueves = (page: Page) => page.getByRole('heading', { name: 'Jueves: Full body' }).locator('..')
const lateral = (page: Page) => jueves(page).getByRole('listitem').filter({ hasText: 'Vuelos laterales' })
const swapJueves = 'Aplicar: Jalón supino cerrado (máquina vertical) → Jalón agarre neutro (Jueves: Full body)'

test('propuestas al plan: aplicar una, aplicar el resto y, cuando pasa, volver el plan a como estaba', async ({ page }) => {
  await setup(page)
  await page.getByRole('link', { name: 'Propuestas para el plan →' }).click()
  const sec = page.getByRole('region', { name: 'Molestia: Cuello' })
  await expect(sec).toContainText('Propuestas para el plan, mientras dure')
  await expect(sec.getByRole('button', { name: 'Aplicar todas (7)' })).toBeVisible()
  await expect(jueves(page)).toContainText('Jalón supino cerrado')

  // Aplicar una: la variante más liviana pasa a ser la del plan, y la propuesta desaparece.
  await sec.getByRole('button', { name: swapJueves }).click()
  await expect(sec.getByRole('button', { name: swapJueves })).toHaveCount(0)
  await expect(sec).toContainText('Ya aplicados (1)')
  await expect(jueves(page)).not.toContainText('Jalón supino cerrado')
  // El botón de variantes lista primero la titular: ahora es la de agarre neutro, y la de antes quedó como opción.
  await expect(jueves(page).getByRole('button', { name: 'Variantes: Jalón agarre neutro · Máquina vertical' })).toBeVisible()

  // Aplicar el resto: queda sin propuestas, y lo aplicado se lista.
  await sec.getByRole('button', { name: 'Aplicar todas (6)' }).click()
  await expect(sec).toContainText('No quedan propuestas.')
  await expect(sec).toContainText('Ya aplicados (7)')
  await expect(lateral(page).getByRole('button', { name: 'Series: 3, tocar para escribir' })).toBeVisible()

  // Cuando pasa, se ofrece volver el plan a como estaba.
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Ya pasó: Cuello' }).click()
  await page.goto('./#/plan')
  const pasó = page.getByRole('region', { name: 'Ya pasó: Cuello' })
  await expect(pasó).toContainText('El plan tiene 7 ajustes hechos por esa molestia')
  await pasó.getByRole('button', { name: 'Volver el plan a como estaba' }).click()
  await expect(pasó).toHaveCount(0)
  await expect(lateral(page).getByRole('button', { name: 'Series: 4, tocar para escribir' })).toBeVisible()
  await expect(jueves(page)).toContainText('Jalón supino cerrado')
  await expect(jueves(page).getByRole('button', { name: 'Variantes: Máquina vertical · Jalón agarre neutro' })).toBeVisible() // la titular vuelve a ser la de antes
  // Y no queda nada pendiente ni al recargar.
  await page.reload()
  await expect(page.getByRole('region', { name: 'Ya pasó: Cuello' })).toHaveCount(0)
})

test('propuestas al plan: "dejar así" conserva el plan y olvida los cambios; una zona sin ejercicios no propone nada', async ({ page }) => {
  await setup(page)
  await page.getByRole('link', { name: 'Propuestas para el plan →' }).click()
  const sec = page.getByRole('region', { name: 'Molestia: Cuello' })
  await sec.getByRole('button', { name: 'Aplicar: Vuelos laterales (mancuernas): 4 → 3 series (Jueves: Full body)' }).click()
  await expect(sec).toContainText('Ya aplicados (1)')
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Ya pasó: Cuello' }).click()
  await page.goto('./#/plan')
  await page.getByRole('region', { name: 'Ya pasó: Cuello' }).getByRole('button', { name: 'Dejar así' }).click()
  await expect(page.getByRole('region', { name: 'Ya pasó: Cuello' })).toHaveCount(0)
  await expect(lateral(page).getByRole('button', { name: 'Series: 3, tocar para escribir' })).toBeVisible() // se queda como quedó

  // La muñeca no se deduce de ningún ejercicio: sin propuestas.
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Anotar una molestia' }).click()
  await page.getByRole('group', { name: 'Zona', exact: true }).getByRole('button', { name: 'Muñeca', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.goto('./#/plan')
  await expect(page.getByRole('region', { name: 'Molestia: Muñeca' })).toContainText('Sin propuestas')
})

test('propuestas al plan: lo que cambiaste a mano después no se pisa al volver atrás', async ({ page }) => {
  await setup(page)
  await page.getByRole('link', { name: 'Propuestas para el plan →' }).click()
  const sec = page.getByRole('region', { name: 'Molestia: Cuello' })
  await sec.getByRole('button', { name: 'Aplicar: Vuelos laterales (mancuernas): 4 → 3 series (Jueves: Full body)' }).click()
  await expect(lateral(page).getByRole('button', { name: 'Series: 3, tocar para escribir' })).toBeVisible()
  await lateral(page).getByRole('button', { name: 'Más Series' }).click()
  await lateral(page).getByRole('button', { name: 'Más Series' }).click()
  await expect(lateral(page).getByRole('button', { name: 'Series: 5, tocar para escribir' })).toBeVisible()
  await page.goto('./#/')
  await page.getByRole('button', { name: 'Ya pasó: Cuello' }).click()
  await page.goto('./#/plan')
  await page.getByRole('region', { name: 'Ya pasó: Cuello' }).getByRole('button', { name: 'Volver el plan a como estaba' }).click()
  await expect(lateral(page).getByRole('button', { name: 'Series: 5, tocar para escribir' })).toBeVisible() // lo subiste vos: no se toca
})
