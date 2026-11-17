import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function openPress(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await page.getByRole('link', { name: /Press inclinado/ }).click()
}

test('aproximaciones: temporizador corto al anotar una, y se apaga con 0 en Ajustes', async ({ page }) => {
  await openPress(page)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await page.getByRole('group', { name: /Aproximación carga mínima/ }).getByRole('button', { name: 'Anotar aproximación' }).click()
  const timer = page.getByRole('timer')
  await expect(timer).toBeVisible()
  await expect(timer).toContainText('Press inclinado (mancuernas) (aprox.)')
  await expect(timer).toContainText(/0:4[45]/) // 45 s por defecto

  // Con 0 en Ajustes no hay temporizador para aproximaciones.
  await timer.getByRole('button', { name: 'Saltar' }).click()
  await page.goto('./#/ajustes')
  const campo = page.getByLabel('Descanso entre aproximaciones (s)')
  await expect(campo).toHaveValue('45')
  await campo.fill('0')
  await campo.blur()
  await page.goBack()
  await page.getByRole('group', { name: /Aproximación ~50 %/ }).getByRole('button', { name: 'Anotar aproximación' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 2: A/ })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveCount(0)
})

test('descanso real: "Saltar" marca cuándo empezaste la serie, no cuándo la guardás', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T10:00:00') })
  await openPress(page)
  await page.getByRole('button', { name: 'Guardar serie' }).click() // serie 1
  await page.clock.fastForward(60_000) // 1:00 de descanso...
  await page.getByRole('timer').getByRole('button', { name: 'Saltar' }).click() // ...empezás la serie 2
  await page.clock.fastForward(40_000) // la hacés (40 s) y recién ahí la guardás
  await page.getByRole('button', { name: 'Guardar serie' }).click() // serie 2
  const fila = page.getByRole('button', { name: /^Editar serie 2/ })
  await expect(fila).toContainText(/descanso 1:0\d/) // 1:00 y no 1:40
  await expect(fila).not.toContainText(/descanso 1:4\d/)
})

test('descanso real: sin "Saltar" es el tiempo entre guardados, como siempre', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T10:00:00') })
  await openPress(page)
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await page.clock.fastForward(100_000)
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 2/ })).toContainText(/descanso 1:4\d/)
})

test('descanso real: se corrige a mano en la tarjeta de la serie y se puede dejar sin dato', async ({ page }) => {
  await openPress(page)
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  const fila = () => page.getByRole('button', { name: /^Editar serie 1/ })
  await expect(fila()).not.toContainText('descanso')

  await fila().click()
  await page.getByRole('button', { name: 'Más Descanso (s)' }).click()
  await page.getByRole('button', { name: 'Más Descanso (s)' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(fila()).toContainText('descanso 0:30')

  await fila().click()
  await page.getByRole('button', { name: 'Sin dato' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(fila()).not.toContainText('descanso')
})
