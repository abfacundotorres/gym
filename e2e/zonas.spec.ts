import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function importSeed(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
}

async function startThursday(page: Page) {
  await page.goto('./#/')
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await expect(page.getByRole('button', { name: 'Terminar sesión' })).toBeVisible()
}

async function noteZone(page: Page, zone: string, severity?: 'Dolor') {
  await page.getByRole('button', { name: 'Anotar una molestia' }).click()
  const guardar = page.getByRole('button', { name: 'Guardar', exact: true })
  await expect(guardar).toBeDisabled() // sin zona no se guarda
  await page.getByRole('group', { name: 'Zona', exact: true }).getByRole('button', { name: zone, exact: true }).click()
  if (severity) await page.getByRole('group', { name: 'Intensidad' }).getByRole('button', { name: severity }).click()
  await guardar.click()
}

test('zonas: anotar una molestia suelta, ver qué ejercicios la cargan en la sesión y marcarla como pasada', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/')
  await expect(page.getByRole('region', { name: 'Molestias' }).getByRole('listitem')).toHaveCount(0)
  await noteZone(page, 'Cuello')
  const card = page.getByRole('region', { name: 'Molestias' })
  await expect(card).toContainText('Cuello · molestia · desde 09/11')

  await startThursday(page)
  const banner = page.getByRole('status').filter({ hasText: 'Cuello molesto desde el 09/11' })
  await expect(banner).toContainText('La cargan mucho: Vuelos laterales, Deltoide posterior')
  await expect(banner).toContainText('Algo: Jalón supino cerrado')
  // Las filas de esos ejercicios lo dicen, y las demás no.
  await expect(page.getByText('Carga cuello')).toHaveCount(3)

  await banner.getByRole('button', { name: 'Ya pasó: Cuello' }).click()
  await expect(banner).toHaveCount(0)
  await expect(page.getByText('Carga cuello')).toHaveCount(0)
  await page.getByRole('link', { name: '← Salir' }).click()
  await expect(page.getByRole('region', { name: 'Molestias' }).getByRole('listitem')).toHaveCount(0)
})

test('zonas: al marcar molestia en un ejercicio se elige la zona, y con dolor se recomienda consultar', async ({ page }) => {
  await importSeed(page)
  await startThursday(page)
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await page.getByRole('button', { name: 'Más opciones' }).click()
  await page.getByRole('group', { name: 'Molestia o dolor' }).getByRole('button', { name: 'Dolor' }).click()
  await page.getByRole('group', { name: 'Zona de la molestia' }).getByRole('button', { name: 'Hombro' }).click()
  await page.getByRole('link', { name: '← Sesión' }).click()
  const banner = page.getByRole('status').filter({ hasText: 'Hombro con dolor' })
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Press inclinado') // el que lo marcó la carga mucho
  // En el ejercicio, antes de la primera serie, lo recuerda y recomienda consultar.
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  const nota = page.getByRole('status').filter({ hasText: 'Hombro con dolor: este ejercicio la carga mucho' })
  await expect(nota).toBeVisible()
  await expect(nota).toContainText('consultá a un profesional')
  // Al empezar a trabajar el ejercicio, el recordatorio se va.
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1/ })).toBeVisible()
  await expect(nota).toHaveCount(0)
})

test('zonas: corregir las zonas de una variante hace que se sugiera cambiar a ella', async ({ page }) => {
  await importSeed(page)
  // Por músculos, los tres jalones cargan el cuello algo (espalda alta secundaria). Se corrige el de agarre neutro.
  await page.goto('./#/ejercicios/pulldown_neutral')
  const zonas = page.getByRole('group', { name: 'Zonas que carga' })
  await expect(zonas.getByRole('button', { name: 'Cuello' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Se deducen de los músculos que trabaja (aproximado).')).toBeVisible()
  await zonas.getByRole('button', { name: 'Cuello' }).click()
  await expect(zonas.getByRole('button', { name: 'Cuello' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Corregidas a mano: manda tu lista.')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardado ✓' })).toBeVisible()

  await page.goto('./#/')
  await noteZone(page, 'Cuello')
  await startThursday(page)
  await page.getByRole('link', { name: /Jalón supino/ }).click()
  const sugeridas = page.getByRole('group', { name: 'Variantes que cargan menos cuello' })
  await expect(sugeridas).toBeVisible()
  await expect(sugeridas.getByRole('button')).toHaveCount(1) // solo la corregida; la otra carga lo mismo
  await sugeridas.getByRole('button', { name: 'Cambiar a Jalón agarre neutro' }).click()
  await expect(page.getByRole('heading', { name: /Jalón agarre neutro/ })).toBeVisible()
  // En la variante corregida ya no carga el cuello: no hay aviso de zona.
  await expect(page.getByText(/Cuello molesto: este ejercicio/)).toHaveCount(0)
})

test('zonas: "Volver a deducirlas" deshace la corrección', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/ejercicios/pulldown_neutral')
  const zonas = page.getByRole('group', { name: 'Zonas que carga' })
  await zonas.getByRole('button', { name: 'Cuello' }).click()
  await expect(zonas.getByRole('button', { name: 'Cuello' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Volver a deducirlas' }).click()
  await expect(zonas.getByRole('button', { name: 'Cuello' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Se deducen de los músculos que trabaja (aproximado).')).toBeVisible()
})
