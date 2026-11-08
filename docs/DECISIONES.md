# Decisiones y supuestos

Acordadas con Facu el 08/11/2026 antes de arrancar. Las nuevas se agregan al final.

## Motor

**D-01. Peso de trabajo.** Es el mayor peso con series W válidas en la exposición.
Las series W a pesos menores (pirámide/rampa) cuentan para volumen, no para progresión.
`targetSets` se cuenta solo al peso de trabajo; si no llega → "sin datos suficientes".
El objetivo siguiente es completar `targetSets` al peso de trabajo.

**D-02. Incremento mayor al 10 %.** Si subir un `increment` implica más del 10 % de la carga
(p. ej. vuelos 12.5→15), se pasa a progresión por reps extendida: el objetivo sigue sumando
reps por encima de `max` hasta `max + 3`. Al llegar, se muestra "listo para subir (+X %),
confirmá vos" sin prellenar el peso. El motor nunca prellena un salto > 10 %.

**D-03. Confianza.** `baja` → excluida de progresión (badge). `media` → cuenta, con badge
"dato inferido". Sin campo → alta.

**D-04. Series W con `reps: null`.** Cuentan para volumen; nunca para progresión, e1RM ni PRs.

**D-05. Deload anticipado (a).** Se dispara si ≥40 % de los ejercicios del mesociclo están
estancados (3 exposiciones sin mejora, §6.4) **o** con regresión de e1RM en las últimas 2.

**D-07. e1RM sobre carga comparable.** Barras: total = `barKg + 2 × por lado`. Máquinas `per_side`
sin peso de carro conocido: `2 × por lado` (escala relativa, solo se compara dentro de la variante).
`bricks`: ladrillos × `kgPerBrick`. Motivo: Epley no conserva el orden entre series si se omite un offset fijo.

## Datos

**D-06. Privacidad.** `seed.json` no se commitea ni va en el bundle (GitHub Pages es público).
El onboarding lo importa con un selector de archivo.

**D-08. Mesociclo inicial.** El seed no trae mesociclos. Se crea uno que arranca el lunes
19/10/2026 (5 + 1 semanas), editable.

**D-09. Correcciones al catálogo del seed** (aplicadas en código al importar, el archivo queda tal cual):
- `ohp_machine`: confirmado peso **por lado**; sin peso base conocido.
- `rear_delt_machine`: es con **mancuernas, peso por mano** → `unit: per_hand`,
  nombre "Deltoide posterior (mancuernas)". Se mantiene el id para no romper referencias.
- `leg_extension`: no existen medios ladrillos (incremento 1). La aproximación de 6.5 del 03/11
  se importa como está, marcada como dato dudoso (no afecta nada: las aproximaciones no cuentan).

**D-10. Cardio.** `unit: minutes` (falta en `units` del seed). Se guarda como una serie con
`minutes`; no suma volumen.

**D-11. Rest-pause sin `repsBeforePause`** (remo y jalón 02/11, rumano 29/10): excluidas de
progresión, cuentan como 1 serie de volumen. El `rp` del femoral 27/10 (5 min de pausa) se
importa igual, excluido por la misma regla.

## Infra

**D-12. Base y router.** `BASE` por variable de entorno (Pages usa `/<repo>/`). HashRouter, así
el hosting estático no necesita reescrituras.

**D-13. CSP.** Meta tag inyectada solo en build (en dev, Vite usa scripts inline y websocket).
El SW se registra desde código (`injectRegister: null`) para no necesitar scripts inline.

## H1

**D-14. Fixture de tests.** Como `seed.json` no se commitea, los tests usan
`src/data/__fixtures__/seed.fixture.json`: catálogo y plan completos + las 6 sesiones que necesitan
los tests de H1/H3/H4. Si `seed.json` está en la raíz, un test extra valida el archivo real (solo local).

**D-15. Import unificado.** Un solo botón acepta tanto `seed.json` como un backup; siempre valida con zod
y muestra la vista previa (nuevos / cambian / se borran) antes de aplicar. Mezclar = upsert por id,
gana el archivo, no borra nada. Reemplazar = borra todo y carga el archivo.

**D-16. Último backup.** Se registra al exportar JSON (el CSV no cuenta como backup porque no se puede reimportar).
El aviso aparece en Hoy si pasaron más de 7 días y hay sesiones registradas en la app después del último backup.
Las sesiones del seed no disparan el aviso.
