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
const row = (page: Page, label: RegExp) => page.getByRole('group', { name: label })

test('aproximaciones: abiertas desde el principio, se ajustan antes de anotarlas', async ({ page }) => {
  await openPress(page)
  // Sin tocar nada: las cuatro sugeridas a la vista, cada una con su peso y reps.
  const panel = page.getByRole('region', { name: 'Entrada en calor' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('group', { name: /^Aproximación/ })).toHaveCount(4)

  // Ajustar la primera (7,5 × 12 → 10 × 11) y anotarla.
  const minima = row(page, /Aproximación carga mínima/)
  await minima.getByRole('button', { name: /Más Peso/ }).click()
  await minima.getByRole('button', { name: 'Menos Reps aprox.' }).click()
  await minima.getByRole('button', { name: 'Anotar aproximación' }).click()
  await expect(page.getByRole('button', { name: 'Editar serie 1: A 10×11' })).toBeVisible()
  // La fila ya anotada sale del panel aunque se haya anotado con otro peso.
  await expect(row(page, /Aproximación carga mínima/)).toHaveCount(0)
  await expect(panel.getByRole('group', { name: /^Aproximación/ })).toHaveCount(3)
  // Una aproximación no dispara el descanso.
  await expect(page.getByRole('timer')).toHaveCount(0)
})

test('aproximaciones: sumar una extra y que el panel se vaya al empezar las series de trabajo', async ({ page }) => {
  await openPress(page)
  const panel = page.getByRole('region', { name: 'Entrada en calor' })
  await panel.getByRole('button', { name: '+ Aproximación' }).click()
  const extra = row(page, /Aproximación extra/)
  await expect(extra).toBeVisible()
  // Copia la última fila a la vista (22,5 × 3); se ajusta y se anota.
  await extra.getByRole('button', { name: /Más Peso/ }).click()
  await extra.getByRole('button', { name: 'Anotar aproximación' }).click()
  await expect(page.getByRole('button', { name: 'Editar serie 1: A 25×3' })).toBeVisible()
  await expect(row(page, /Aproximación extra/)).toHaveCount(0)

  // Empezar las series de trabajo: el panel se pliega solo; las anotadas quedan en la lista.
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('region', { name: 'Entrada en calor' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Editar serie 1: A 25×3' })).toBeVisible()
})

test('aproximaciones: una anotada se modifica tocándola', async ({ page }) => {
  await openPress(page)
  await row(page, /Aproximación ~50 %/).getByRole('button', { name: 'Anotar aproximación' }).click()
  await page.getByRole('button', { name: /^Editar serie 1: A 12,5×8/ }).click()
  await page.getByRole('button', { name: 'Más Reps' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Editar serie 1: A 12,5×9' })).toBeVisible()
})
