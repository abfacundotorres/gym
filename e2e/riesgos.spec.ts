import { expect, test, type Page } from './base'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

async function startSession(page: Page) {
  await page.goto('./')
  await page.locator('input[type=file]').setInputFiles(seed)
  await page.getByRole('button', { name: 'Importar', exact: true }).click()
  await page.getByText('Hacer otro día').click()
  await page.getByRole('button', { name: 'Jueves: Full body' }).click()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByRole('button', { name: 'Omitir y empezar' }).click()
  await expect(page.getByRole('button', { name: 'Terminar sesión' })).toBeVisible()
}

type Row = Record<string, unknown>
const W = (weight: number, reps: number, rir?: number) => ({ id: `w${Math.random()}`, type: 'W', weight, reps, ...(rir != null ? { rir } : {}) })

/** Agrega sesiones terminadas (historial) directo en IndexedDB. */
async function addHistory(page: Page, rows: { date: string; items: Row[] }[]) {
  await page.evaluate(async (list) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('gym'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const tx = db.transaction('sessions', 'readwrite')
    for (const [i, r] of list.entries()) {
      tx.objectStore('sessions').put({
        id: `h-${r.date}-${i}`, date: r.date, planDayId: 'jueves_full_body', mesocycleId: 'meso-2026-10-19', note: '', startedAt: 1, finishedAt: 2,
        status: 'finished', source: 'app', items: r.items, exerciseIds: r.items.map((x) => (x as { exerciseId: string }).exerciseId),
      })
    }
    await new Promise<void>((res) => { tx.oncomplete = () => res() })
    db.close()
  }, rows)
}

/** Reemplaza los ejercicios de la sesión en curso. */
async function setActiveItems(page: Page, items: Row[]) {
  await page.evaluate(async (its) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('gym'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')
    const all = await new Promise<{ status: string }[]>((res) => { const r = store.getAll(); r.onsuccess = () => res(r.result) })
    for (const s of all) if (s.status === 'in_progress') store.put({ ...s, items: its, exerciseIds: its.map((x) => (x as { exerciseId: string }).exerciseId) })
    await new Promise<void>((res) => { tx.oncomplete = () => res() })
    db.close()
  }, items)
}

/** Guarda una serie de trabajo con RIR 0 en el ejercicio abierto. */
async function saveAtFailure(page: Page) {
  await page.getByRole('button', { name: '+ RIR' }).click()
  await page.getByRole('group', { name: 'RIR' }).getByRole('button', { name: '0', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1/ })).toBeVisible()
}

test('avisos: dos compuestos al fallo en la misma sesión, y se puede descartar', async ({ page }) => {
  await startSession(page)
  await expect(page.getByText(/compuestos al fallo/)).toHaveCount(0) // sin datos de RIR no se presume nada

  await page.getByRole('link', { name: /rumano/i }).click()
  await saveAtFailure(page)
  await page.getByRole('link', { name: '← Sesión' }).click()
  await expect(page.getByText(/compuestos al fallo/)).toHaveCount(0) // uno solo no avisa

  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await saveAtFailure(page)
  await page.getByRole('link', { name: '← Sesión' }).click()
  const aviso = page.getByRole('status').filter({ hasText: 'Ya llevás 2 ejercicios compuestos al fallo hoy' })
  await expect(aviso).toBeVisible()
  await expect(aviso).toContainText('(Peso muerto rumano y Press inclinado)')

  // Un tercer compuesto, todavía sin empezar, lo recuerda donde se decide cuánto dejar en reserva.
  await page.getByRole('link', { name: /Jalón supino/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Hoy ya llevás 2 compuestos al fallo' })).toBeVisible()
  // Uno que ya llegó al fallo no se avisa a sí mismo.
  await page.getByRole('link', { name: '← Sesión' }).click()
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await expect(page.getByText('Hoy ya llevás 2 compuestos al fallo')).toHaveCount(0)
  await page.getByRole('link', { name: '← Sesión' }).click()

  // Descartar: queda descartado también al recargar.
  await aviso.getByRole('button', { name: 'Entendido' }).click()
  await expect(aviso).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Terminar sesión' })).toBeVisible()
  await expect(page.getByText(/compuestos al fallo hoy/)).toHaveCount(0)
})

test('avisos: tres veces seguidas al fallo en el mismo ejercicio, no con dos', async ({ page }) => {
  await startSession(page)
  const press = (rir: number) => ({ exerciseId: 'incline_db_press', sets: [W(25, 8, rir)] })
  // Después de la última del seed (05/11) y antes de hoy (09/11).
  await addHistory(page, [{ date: '2026-11-06', items: [press(0)] }, { date: '2026-11-07', items: [press(0)] }])
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await expect(page.getByText(/veces terminaste este ejercicio al fallo/)).toHaveCount(0) // dos no alcanzan

  await page.getByRole('link', { name: '← Sesión' }).click()
  await addHistory(page, [{ date: '2026-11-08', items: [press(0)] }])
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  const aviso = page.getByRole('status').filter({ hasText: 'Las últimas 3 veces terminaste este ejercicio al fallo (RIR 0)' })
  await expect(aviso).toBeVisible()
  await aviso.getByRole('button', { name: 'Entendido' }).click()
  await expect(aviso).toHaveCount(0)
})

test('avisos: el aviso de racha sirve antes de la primera serie de trabajo y se va al empezar', async ({ page }) => {
  await startSession(page)
  const press = { exerciseId: 'incline_db_press', sets: [W(25, 8, 0)] }
  await addHistory(page, [{ date: '2026-11-06', items: [press] }, { date: '2026-11-07', items: [press] }, { date: '2026-11-08', items: [press] }])
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  const aviso = page.getByRole('status').filter({ hasText: 'Las últimas 3 veces terminaste este ejercicio al fallo' })
  await expect(aviso).toBeVisible()
  await page.getByRole('button', { name: 'Guardar serie' }).click()
  await expect(page.getByRole('button', { name: /^Editar serie 1/ })).toBeVisible()
  await expect(aviso).toHaveCount(0)
})

test('avisos: una racha cortada por un RIR 1 no avisa', async ({ page }) => {
  await startSession(page)
  const press = (rir: number) => ({ exerciseId: 'incline_db_press', sets: [W(25, 8, rir)] })
  await addHistory(page, [{ date: '2026-11-06', items: [press(0)] }, { date: '2026-11-07', items: [press(1)] }, { date: '2026-11-08', items: [press(0)] }])
  await page.getByRole('link', { name: /Press inclinado/ }).click()
  await expect(page.getByRole('button', { name: 'Guardar serie' })).toBeVisible()
  await expect(page.getByText(/veces terminaste este ejercicio al fallo/)).toHaveCount(0)
})

test('avisos: salto grande de volumen semanal contra el promedio de las semanas anteriores', async ({ page }) => {
  await startSession(page)
  await expect(page.getByText(/Salto grande de volumen/)).toHaveCount(0)
  // Tres semanas previas con 5 series de vuelos laterales (más lo poco que trae el seed) y hoy 12.
  const lat = (k: number) => ({ exerciseId: 'lateral_raise_db', sets: Array.from({ length: k }, () => W(10, 12)) })
  await addHistory(page, [{ date: '2026-11-04', items: [lat(5)] }, { date: '2026-10-28', items: [lat(5)] }, { date: '2026-10-21', items: [lat(5)] }])
  await setActiveItems(page, [lat(12)])
  await page.reload() // lo escrito directo en IndexedDB, por fuera de Dexie, se ve al recargar
  const aviso = page.getByRole('status').filter({ hasText: 'Salto grande de volumen' })
  await expect(aviso).toContainText('Deltoide lateral lleva 12 series esta semana')
  await expect(aviso).toContainText('más que tu promedio')
  await aviso.getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByText(/Salto grande de volumen/)).toHaveCount(0)
})
