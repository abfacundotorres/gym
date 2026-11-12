import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const seed = fileURLToPath(new URL('../src/data/__fixtures__/seed.fixture.json', import.meta.url))

// Pantallas chicas: sin desborde horizontal, todos los controles con nombre y objetivos táctiles razonables.
for (const [width, height] of [[375, 667], [320, 568]] as const) {
  test(`layout a ${width}px: sin desborde, con nombres y objetivos táctiles`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('./')
    await page.locator('input[type=file]').setInputFiles(seed)
    await page.getByRole('button', { name: 'Importar', exact: true }).click()
    await page.getByRole('button', { name: 'Empezar' }).click()
    await page.getByRole('button', { name: 'Omitir y empezar' }).click()
    await expect(page.getByRole('button', { name: 'Terminar sesión' })).toBeVisible()
    const session = await page.evaluate(() => location.hash)

    const routes = ['#/', session, `${session}/1`, '#/historial', '#/historial?ver=ejercicios', '#/historial/ej/incline_db_press', '#/volumen', '#/plan', '#/ejercicios', '#/ajustes']
    const problems: string[] = []
    for (const hash of routes) {
      await page.goto(`./${hash}`)
      await page.waitForTimeout(250)
      const r = await page.evaluate(() => {
        const visible = (el: Element) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
        const noName: string[] = []
        const small: string[] = []
        for (const el of document.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]):not([type=checkbox]), select, textarea, summary')) {
          if (!visible(el)) continue
          const b = el.getBoundingClientRect()
          const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim() || (el as HTMLInputElement).labels?.[0]?.textContent?.trim() || ''
          if (!label) noName.push(el.outerHTML.slice(0, 60))
          if (b.height < 44 || b.width < 24) small.push(`${label.slice(0, 24)} ${Math.round(b.width)}x${Math.round(b.height)}`)
        }
        return { noName, small, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
      })
      if (r.overflow > 0) problems.push(`${hash}: desborda ${r.overflow}px`)
      for (const n of r.noName) problems.push(`${hash}: sin nombre ${n}`)
      for (const s of r.small) problems.push(`${hash}: objetivo chico ${s}`)
    }
    expect(problems).toEqual([])
  })
}
