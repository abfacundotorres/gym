// Genera los PNG de public/icons a partir de icon.svg usando el Chromium de Playwright.
// Uso: node scripts/gen-icons.mjs  (los PNG quedan commiteados; no corre en build)
//  - "any" (192/512): esquinas redondeadas y transparentes, tal como el SVG.
//  - maskable y apple-touch: fondo a sangre (sin esquinas); el sistema les aplica su propia máscara.
//    La figura está dentro de la zona segura central (80 %).
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
const fullBleed = svg.replaceAll('rx="112"', 'rx="0"')
const targets = [
  { file: 'icon-192.png', size: 192, art: svg },
  { file: 'icon-512.png', size: 512, art: svg },
  { file: 'icon-maskable-512.png', size: 512, art: fullBleed },
  { file: 'apple-touch-icon.png', size: 180, art: fullBleed },
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(
    `<body style="margin:0;background:transparent;width:${t.size}px;height:${t.size}px">${t.art.replace('<svg ', '<svg width="100%" height="100%" ')}</body>`,
  )
  await page.screenshot({ path: new URL(`../public/icons/${t.file}`, import.meta.url).pathname, omitBackground: true })
}
await browser.close()
