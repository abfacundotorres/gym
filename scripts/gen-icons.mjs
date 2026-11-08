// Genera los PNG de public/icons a partir de icon.svg usando el Chromium de Playwright.
// Uso: node scripts/gen-icons.mjs  (los PNG quedan commiteados; no corre en build)
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const t of targets) {
  const inner = Math.round(t.size * (1 - 2 * t.pad))
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(
    `<body style="margin:0;background:#0b0f14;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`,
  )
  await page.screenshot({ path: new URL(`../public/icons/${t.file}`, import.meta.url).pathname })
}
await browser.close()
