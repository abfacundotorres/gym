import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'
export type { Page } from '@playwright/test'

/**
 * Los e2e no dependen del día en que se corren: el reloj arranca el lunes 09/11/2026, cuatro días después de la última sesión del seed
 * (día de entrenamiento y sin que se ofrezca la vuelta tras una pausa, D-74, salvo que el test quiera probarla y fije su propia fecha).
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.clock.install({ time: new Date('2026-11-09T10:00:00') })
    await provide(page)
  },
})
