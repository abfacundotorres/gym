# Seguridad y privacidad

Auditoría del 09/11/2026 (código y build; no incluye la página publicada).

## Lo que garantiza el diseño
- **Sin red en runtime.** No hay `fetch`, `XMLHttpRequest`, `WebSocket` ni similares en `src/`. La CSP del build
  (`connect-src 'self'`, `script-src 'self'`, `object-src 'none'`, `form-action 'none'`) lo refuerza, y el e2e
  verifica que no salga ninguna request externa.
- **Sin inyección.** Sin `innerHTML`, `eval` ni `dangerouslySetInnerHTML`. Todo archivo importado pasa por zod y
  React escapa el texto.
- **Dependencias en producción:** `npm audit --omit=dev` = 0. Los avisos restantes son de herramientas de
  desarrollo (ESLint, build) y no viajan al celular.
- **Datos personales fuera del repo:** `seed.json` está en `.gitignore` y no va en el bundle.

## Riesgos conocidos
1. **Pérdida de datos.** Todo vive en el navegador de cada dispositivo. Borrar los datos del sitio o desinstalar
   la app los elimina. Hacé un backup JSON (Ajustes) cada tanto; la app avisa pasados 7 días con sesiones nuevas.
2. **Origen compartido.** Todas las páginas de GitHub Pages de la cuenta viven en `abfacundotorres.github.io` y el
   almacenamiento (IndexedDB, localStorage) es por origen. Otro sitio publicado en esa cuenta podría leer estos
   datos. Si vas a publicar más sitios, usá otra cuenta/organización o un dominio propio para la app.
3. **Sin cifrado en reposo.** Los datos no están cifrados en el navegador; los protege el bloqueo del celular.
   Los backups JSON/CSV quedan como archivos comunes (Descargas).
4. **Fixture público.** `src/data/__fixtures__/seed.fixture.json` contiene 6 sesiones reales (pesos y reps) en un
   repo público. Aceptado por el dueño.
5. **Cadena de despliegue.** Las GitHub Actions están fijadas por tag (`@v4`), no por hash. Son acciones oficiales.
   CI corre con permisos mínimos; el deploy solo pide `pages: write` e `id-token: write`.
