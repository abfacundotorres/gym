import { expect, test } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

test('variantes: crear la de máquina en el plan, elegirla en la sesión y volver a la de mancuernas', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()

  // 1) En el Plan: nueva variante de los vuelos laterales, en ladrillos.
  await page.goto('./#/plan')
  const jueves = page.getByRole('heading', { name: 'Jueves: Full body' }).locator('..')
  const lateral = jueves.getByRole('listitem').filter({ hasText: 'Vuelos laterales' })
  await lateral.getByRole('button', { name: '+ Variantes' }).click()
  await lateral.getByLabel('Nombre de la variante').fill('Vuelos laterales (máquina)')
  await lateral.getByRole('button', { name: 'Máquina · ladrillos' }).click()
  await lateral.getByRole('button', { name: 'Crear y agregar' }).click()
  await expect(lateral.getByRole('button', { name: 'Variantes: Mancuernas · Máquina' })).toBeVisible()
  // Es el mismo ejercicio en todos los días: también aparece en el lunes.
  const lunes = page.getByRole('heading', { name: 'Lunes: Torso' }).locator('..')
  await expect(lunes.getByRole('button', { name: 'Variantes: Mancuernas · Máquina' })).toBeVisible()

  // 2) En la sesión: se elige con un toque, sin pasar por el menú.
  await page.goto('./#/')
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await page.getByRole('link', { name: /Vuelos laterales/ }).click()
  const variante = page.getByRole('group', { name: 'Variante' })
  await expect(variante.getByRole('button', { name: 'Mancuernas' })).toHaveAttribute('aria-pressed', 'true')
  await variante.getByRole('button', { name: 'Máquina' }).click()
  await expect(page.getByRole('heading', { name: 'Vuelos laterales (máquina)' })).toBeVisible()
  // Variante nueva: sin historial propio, con la referencia de la de mancuernas y en su unidad.
  await expect(page.getByText('Sin historial para esta variante')).toBeVisible()
  await expect(page.getByText(/Referencia de familia, no equivalente/)).toBeVisible()
  await expect(page.getByText('Peso (ladr.)')).toBeVisible()

  // 3) Una serie en la máquina; volver a mancuernas agrega el ejercicio a continuación.
  await page.getByRole('button', { name: 'Más Peso (ladr.)' }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1/ })).toBeVisible()
  await expect(page.getByText(/Ya hiciste series con esta variante/)).toBeVisible()
  await page.getByRole('group', { name: 'Variante' }).getByRole('button', { name: 'Mancuernas' }).click()
  await expect(page.getByRole('heading', { name: 'Vuelos laterales (mancuernas)' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Editar serie/ })).toHaveCount(0)
})

test('variantes: sin opciones en el plan no hay selector, y el menú sigue ofreciendo la familia', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await page.getByRole('link', { name: /Peso muerto rumano/ }).click()
  await expect(page.getByRole('group', { name: 'Variante' })).toHaveCount(0)
})
