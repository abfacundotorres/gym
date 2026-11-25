import { expect, test } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

test('revisión del bloque: variantes que hiciste y "rotar todas" con un toque', async ({ page }) => {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()

  // Los vuelos laterales todavía no tienen variantes en el plan: ni se proponen rotar ni figuran en "Variantes que hiciste"
  // (sí tienen la propuesta de series, que no es una rotación).
  await page.goto('./#/plan/revision')
  await expect(page.getByRole('checkbox', { name: /Vuelos laterales.*variante/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Variantes que hiciste' }).locator('..').getByRole('listitem').filter({ hasText: 'Vuelos laterales' })).toHaveCount(0)

  // Una variante de máquina para los vuelos laterales (están en el lunes y en el jueves).
  await page.goto('./#/plan')
  const jueves = page.getByRole('heading', { name: 'Jueves: Full body' }).locator('..')
  const lateral = jueves.getByRole('listitem').filter({ hasText: 'Vuelos laterales' })
  await lateral.getByRole('button', { name: '+ Variantes' }).click()
  await lateral.getByLabel('Nombre de la variante').fill('Vuelos laterales (máquina)')
  await lateral.getByRole('button', { name: 'Máquina · ladrillos' }).click()
  await lateral.getByRole('button', { name: 'Crear y agregar' }).click()
  await expect(lateral.getByRole('button', { name: 'Variantes: Mancuernas · Máquina' })).toBeVisible()

  // Una sesión del jueves con la de máquina, terminada.
  await page.goto('./#/')
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await page.getByRole('link', { name: /Vuelos laterales/ }).click()
  await page.getByRole('group', { name: 'Variante' }).getByRole('button', { name: 'Máquina' }).click()
  await page.getByRole('button', { name: 'Más Peso (ladr.)' }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1/ })).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: 'Terminar sesión' }).click()
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  // La app navega al Resumen al terminar: se espera ahí antes de ir a otro lado (si no, pisa la navegación).
  await expect(page).toHaveURL(/resumen$/)

  // La revisión muestra qué variante se hizo.
  await page.goto('./#/plan/revision')
  const hechas = page.getByRole('heading', { name: 'Variantes que hiciste' }).locator('..')
  const fila = hechas.getByRole('listitem').filter({ hasText: 'Vuelos laterales' })
  await expect(fila).toHaveCount(1) // una sola fila: el ejercicio del jueves, con lo que se hizo en el bloque
  await expect(fila).toContainText('Mancuernas ×1 · Máquina ×1') // una sesión del historial con mancuernas (la otra quedó sin series) y la de hoy en máquina

  // Las rotaciones opcionales (los vuelos están el lunes y el jueves) empiezan destildadas; un toque las tilda todas, otro vuelve atrás.
  const rotar = page.getByRole('checkbox', { name: /Vuelos laterales.*variante/ })
  await expect(rotar).toHaveCount(2)
  await expect(rotar.first()).not.toBeChecked()
  const todas = page.getByRole('checkbox', { name: /variante/ })
  const n = await todas.count()
  await page.getByRole('button', { name: new RegExp(`Rotar todas las variantes \\(${n}\\)`) }).click()
  for (let i = 0; i < n; i++) await expect(todas.nth(i)).toBeChecked()
  await page.getByRole('button', { name: 'Dejar solo lo sugerido' }).click()
  await expect(rotar.first()).not.toBeChecked()
  await expect(rotar.last()).not.toBeChecked()
})
