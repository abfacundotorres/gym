import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function importSeed(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
}

const W = (weight: number, reps: number) => ({ id: `w${Math.random()}`, type: 'W', weight, reps })
type Hist = { date: string; exerciseId: string; weight: number; reps: number }

/** Agrega sesiones terminadas (historial) directo en IndexedDB, de a tres series por ejercicio. */
async function addHistory(page: Page, rows: Hist[]) {
  await page.evaluate(async (list) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('gym'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const tx = db.transaction('sessions', 'readwrite')
    list.forEach((r, i) => {
      const sets = [0, 1, 2].map(() => ({ id: `w${Math.random()}`, type: 'W', weight: r.weight, reps: r.reps }))
      tx.objectStore('sessions').put({
        id: `h-${r.date}-${r.exerciseId}-${i}`, date: r.date, planDayId: 'jueves_full_body', mesocycleId: 'meso-2026-10-19', note: '', startedAt: 1, finishedAt: 2,
        status: 'finished', source: 'app', items: [{ exerciseId: r.exerciseId, sets }], exerciseIds: [r.exerciseId],
      })
    })
    await new Promise<void>((res) => { tx.oncomplete = () => res() })
    db.close()
  }, rows)
}
void W

// Press inclinado: siempre al tope (3×10 con 25 kg) y siempre con el mismo peso: la app sugiere subir y no subís.
const pressSiempre25: Hist[] = ['01', '02', '03', '04', '05', '06', '07', '08'].map((d) => ({ date: `2026-12-${d}`, exerciseId: 'incline_db_press', weight: 25, reps: 10 }))
// Curl inclinado: lejos del tope (3×8 de 12) y subiendo el peso cada vez: trabajás con más peso del sugerido.
const curlSubiendo: Hist[] = [20, 22.5, 25, 27.5, 30, 32.5].map((w, i) => ({ date: `2026-12-${String(i + 1).padStart(2, '0')}`, exerciseId: 'curl_incline_db', weight: w, reps: 8 }))

const jueves = (page: Page) => page.getByRole('heading', { name: 'Jueves: Full body' }).locator('..')
const filaPress = (page: Page) => jueves(page).getByRole('listitem').filter({ hasText: 'Press inclinado' })
const filaCurl = (page: Page) => jueves(page).getByRole('listitem').filter({ hasText: 'Curl inclinado' })

test('calibración: sin historial suficiente lo dice, y se llega desde el Resumen', async ({ page }) => {
  await importSeed(page)
  await page.goto('./#/resumen')
  await page.getByRole('link', { name: /Calibración/ }).click()
  await expect(page.getByRole('heading', { name: 'Calibración' })).toBeVisible()
  await expect(page.getByText(/Todavía no hay ejercicios con 4 o más sugerencias para comparar/)).toBeVisible()
})

test('calibración: si no subís cuando te lo sugiere, propone ampliar el rango, hasta 2 de más, y se restablece', async ({ page }) => {
  await importSeed(page)
  await addHistory(page, pressSiempre25)
  await page.goto('./#/calibracion')
  await page.reload()
  const press = page.getByRole('region', { name: 'Press inclinado (mancuernas)' })
  await expect(press).toContainText('Seguiste la sugerencia 0 de 6 veces')
  await expect(press).toContainText('Usaste menos peso: 6 · más peso: 0')
  await expect(press).toContainText('De las 6 veces que sugirió subir, no subiste 6.')
  await expect(press).toContainText('Rango del plan: 7-10 reps')
  await expect(press).toContainText('Probá ampliar el rango a 7-11 reps')

  await press.getByRole('button', { name: 'Aplicar rango 7-11 a Press inclinado (mancuernas)' }).click()
  await expect(press).toContainText('Rango del plan: 7-11 reps (el del ejercicio es 7-10)')
  await expect(press).toContainText('Probá ampliar el rango a 7-12 reps') // un paso más, el último
  await press.getByRole('button', { name: 'Aplicar rango 7-12 a Press inclinado (mancuernas)' }).click()
  await expect(press).toContainText('Rango del plan: 7-12 reps (el del ejercicio es 7-10)')
  await expect(press).not.toContainText('Probá') // tope: 2 sobre el del ejercicio

  // El plan lo muestra, y restablecer vuelve al del ejercicio.
  await page.goto('./#/plan')
  await expect(filaPress(page)).toContainText('7-12 reps')
  await page.goto('./#/calibracion')
  await press.getByRole('button', { name: 'Restablecer el rango de Press inclinado (mancuernas)' }).click()
  await expect(press).toContainText('Rango del plan: 7-10 reps')
  await expect(press).not.toContainText('(el del ejercicio es')
  await expect(press).toContainText('Probá ampliar el rango a 7-11 reps')
  await page.goto('./#/plan')
  await expect(filaPress(page)).toContainText('7-10 reps')
})

test('calibración: si siempre trabajás con más peso del sugerido, propone acortar el rango', async ({ page }) => {
  await importSeed(page)
  await addHistory(page, curlSubiendo)
  await page.goto('./#/calibracion')
  await page.reload()
  const curl = page.getByRole('region', { name: 'Curl inclinado (mancuernas)' })
  // Seis sesiones, cinco comparaciones: la primera se compara con una del seed sin series suficientes, y no se compara.
  await expect(curl).toContainText('Seguiste la sugerencia 0 de 5 veces')
  await expect(curl).toContainText('Usaste menos peso: 0 · más peso: 5')
  await expect(curl).not.toContainText('sugirió subir') // nunca sugirió subir de peso
  await expect(curl).toContainText('Probá acortarlo a 8-11 reps')
  await curl.getByRole('button', { name: 'Aplicar rango 8-11 a Curl inclinado (mancuernas)' }).click()
  await expect(curl).toContainText('Rango del plan: 8-11 reps (el del ejercicio es 8-12)')
  await expect(curl).not.toContainText('Probá') // ya está 1 por debajo: no baja más
  await page.goto('./#/plan')
  await expect(filaCurl(page)).toContainText('8-11 reps')
})

test('calibración: aplicar el rango cambia la sugerencia de la próxima sesión', async ({ page }) => {
  await importSeed(page)
  await addHistory(page, pressSiempre25)
  await page.goto('./#/calibracion')
  await page.reload()
  const press = page.getByRole('region', { name: 'Press inclinado (mancuernas)' })
  // Con 3×10 y el tope en 10 se sugiere subir; con el tope en 12, la sugerencia es sumar reps al mismo peso.
  await press.getByRole('button', { name: 'Aplicar rango 7-11 a Press inclinado (mancuernas)' }).click()
  await press.getByRole('button', { name: 'Aplicar rango 7-12 a Press inclinado (mancuernas)' }).click()
  await page.goto('./#/')
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  const hoy = page.getByRole('status').filter({ hasText: 'Hoy' }).first()
  await expect(hoy).toContainText('25 por mano')
  await expect(hoy).not.toContainText('27,5')
})
