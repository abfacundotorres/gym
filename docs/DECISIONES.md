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

## H2

**D-17. Prellenado provisorio.** Hasta H3, el objetivo de cada serie es "repetir la última vez"
(serie efectiva i ↔ serie i, sin drops; en rest-pause, las reps antes de la pausa). H3 lo reemplaza
por la doble progresión. Sin historial: peso vacío, reps = mínimo del rango.

**D-18. Orden de la sesión.** Los ejercicios opcionales (escalador) van al final. Se puede empezar
cualquier día del plan desde "Hacer otro día"; la fecha de la sesión es la del dispositivo.

**D-19. Temporizador.** Arranca solo con series efectivas (no con aproximaciones ni cardio) y usa
`restSec` del ejercicio (override por ejercicio en Ajustes). El estado vive en `localStorage`
(conveniencia por dispositivo): sobrevive a bloqueo y recarga. Con la pantalla bloqueada el navegador
congela la página: la vibración/beep/notificación suenan al volver, no exactamente a tiempo. Una alarma
puntual con pantalla bloqueada necesitaría push desde un servidor (fuera de alcance).

**D-20. Rest-pause en el editor.** Al marcar rest-pause, "reps antes de la pausa" arranca igual a
las reps cargadas; se ajusta para abajo.

**D-21. Saltear** solo está disponible si el ejercicio no tiene series registradas.

## H3

**D-22. "La última vez" para progresión** es la exposición más reciente de la variante, sin buscar
hacia atrás otra "mejor" si esa no sirve. Si la última no tiene `targetSets` series válidas al peso de
trabajo → "Sin datos suficientes": se prellena el peso de trabajo (o el más alto registrado, como
referencia) y no se sugiere subir. Por eso el press plano hoy dice "sin datos suficientes" (2/11 = rebote/asistida).

**D-23. Objetivo con pocas series.** Si la última vez hubo menos series que las planificadas, las que
faltan toman el objetivo de la última serie disponible.

**D-24. Aviso de fatiga** (≥2 series válidas bajo el mínimo en dos exposiciones seguidas): se muestra
como texto, no cambia el peso sugerido. Bajar 5-10 % lo decidís vos.

**D-25. PRs.** Por variante, solo sobre series válidas, contra todas las exposiciones anteriores.
e1RM: mejor que cualquier serie previa. Reps: más reps que nunca a ese peso exacto. La primera
exposición nunca es PR.

**D-26. Estancamiento.** Hacen falta ≥4 exposiciones con datos válidos (una base + 3). Una exposición
"mejora" si supera el mejor e1RM previo o las reps al peso de trabajo superan la mejor previa a ese mismo
peso. Volver a un número ya hecho no cuenta como mejora. Regresión: e1RM bajó en cada una de las últimas 2.

**D-27. Aproximaciones.** heavy con barra: barra sola ×12, ~50 % ×8, ~70 % ×5, ~85 % ×3 (se muestra
"2-3"), porcentajes sobre la carga total y convertidos a "por lado". Sin barra: la primera es ~30 %
(mínimo un incremento). Se descartan duplicadas y las ≥ peso de trabajo. Si la última vez hubo
aproximaciones, se reusan escaladas por la relación de cargas totales; la barra sola sigue siendo barra
sola. Se registran con un toque.

**D-28. Gráficos.** Dos gráficos separados (e1RM y reps totales), sin eje doble. e1RM en kg comparables
(D-07). Color de serie validado contra la superficie oscura.
