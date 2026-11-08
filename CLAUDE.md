# Gym — PWA offline de seguimiento de entrenamiento

App personal (un usuario, Facu) para registrar series de hipertrofia y recibir
recomendaciones de carga con reglas determinísticas. 100% offline, sin backend.
Spec original: el prompt inicial. Decisiones tomadas: `docs/DECISIONES.md`.

## Stack
Vite 8 + React 19 + TypeScript (strict) + Tailwind 4 + vite-plugin-pwa (Workbox)
+ react-router (HashRouter) + Vitest + Dexie + dexie-react-hooks + zod (fake-indexeddb en tests).
E2E offline con Playwright en H5. Deploy estático en GitHub Pages por Actions.

## Comandos
- `npm run dev` — servidor de desarrollo (sin CSP, sin SW)
- `npm test` — Vitest (tests del motor y de datos)
- `npm run lint` — ESLint (incluye la regla de motor sin dependencias)
- `npm run build` — typecheck + build + service worker
- `BASE=/gym/ npm run build && npx vite preview --base /gym/` — probar como en Pages
- `node scripts/gen-icons.mjs` — regenerar PNG de íconos desde `public/icons/icon.svg`

## Estructura
- `src/engine/` — lógica de negocio, **funciones puras de TS sin dependencias**
  (ESLint prohíbe imports que no sean relativos). Tests en `src/engine/__tests__/`.
- `src/data/` — Dexie (`db.ts`, migraciones: agregar `db.version(n)`, nunca editar las viejas),
  zod (`schemas.ts`), conversión del seed (`seedImport.ts`), backup/CSV (`backup.ts`).
  Fixture de tests: `src/data/__fixtures__/seed.fixture.json`.
- Tipos de dominio: `src/engine/types.ts`.
- `src/features/<pantalla>/` — pantallas.
- `src/ui/` — componentes reutilizables (Stepper, Chip, gráficos SVG propios).
- `src/lib/` — integración con el navegador (PWA, timer, wake lock, clipboard).
- `docs/DATA_FORMAT.md` — formato de export. `docs/DECISIONES.md` — supuestos y decisiones.

## Convenciones
- Español rioplatense en UI (es-AR), kg, fechas `dd/mm`. Fechas internas: `'YYYY-MM-DD'` local.
- Tono: mensajes cortos, neutros/positivos. Exclusiones = badge chico, sin sermones.
- Mobile first, una mano: botones grandes, `inputmode="decimal"`, sin scroll horizontal.
- Cero requests en runtime: nada de CDN/fuentes/analytics. CSP `connect-src 'self'` (inyectada en build).
- Pocas dependencias: sin librería de UI, de gráficos ni state manager.
- Un commit por hito, tests en verde. Supuestos nuevos → `docs/DECISIONES.md`.
- `seed.json` tiene datos personales: está en `.gitignore`, nunca se empaqueta.

## Hitos
- [x] H0 Esqueleto PWA (build, offline, CI, deploy)
- [x] H1 Datos (Dexie, seed, export/import JSON+CSV)
- [x] H2 Registro de sesión
- [ ] H3 Motor + Historial
- [ ] H4 Volumen y periodización
- [ ] H5 Variantes, pulido, e2e offline
