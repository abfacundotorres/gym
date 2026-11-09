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

## H4

**D-29. Las sesiones de deload no son base de progresión.** Se excluyen de "la última vez" para el motor,
de PRs, tendencias y del promedio de volumen de la revisión. Sí cuentan para el volumen semanal.
Una sesión queda marcada `deload: true` si se empieza en semana de deload.

**D-30. Deload.** Series = la mitad redondeada para arriba, mínimo 2 (3→2, 4→2, 5→3). Carga −10 % de
la carga comparable, redondeada al incremento; si el redondeo no baja nada, baja un incremento. Objetivo
de reps: el que daría la progresión normal. Sin chips de rest-pause ni drop. Se eligió "−10 %" y no
"misma carga con RIR ≥3".

**D-31. Deload adelantado.** "Deload esta semana" fija `deloadFrom` = lunes de la semana actual; el
mesociclo termina al final del deload. Se puede deshacer desde Editar.

**D-32. Deload sugerido.** Se evalúa solo en semanas de acumulación, sobre los ejercicios del plan (sin
cardio) con tendencia evaluable. (a) ≥40 % estancados o en baja; (b) readiness promedio ≤2,5 en las
últimas 3 sesiones que lo registraron; (c) botón "Me siento quemado". "Ahora no" lo oculta hasta el lunes
siguiente (guardado en la base, viaja en el backup); (c) se puede volver a pedir igual.

**D-33. Revisión de fin de mesociclo.** Disponible siempre (vista previa mientras dura). Propone:
rotar a la primera alternativa de la misma familia los ejercicios estancados o en baja; ±1 serie por
músculo fuera del rango (promedio semanal en acumulación), sobre el ejercicio del plan con ese músculo
como primario y menos series (si falta) o más series (si sobra), entre 2 y 6. Cada propuesta se puede
destildar. "Empezar el siguiente" cierra el mesociclo, aplica el plan y abre uno nuevo el lunes posterior
al final (o el lunes de esta semana si ya pasó).

**D-34. Calendario.** Tira semanal en Hoy (lun-dom). Un día planificado, sin sesión y no futuro se marca
o desmarca como salteado con un toque. No corre el plan ni afecta cálculos.

**D-35. Rangos de volumen.** Editables por músculo en Ajustes. Con los rangos por defecto (10-20) y el
plan actual, casi todos los músculos quedan por debajo; ver nota en el resumen de H4.

## H5

**D-36. Ocupado → alternativa.** Opciones: primero las alternativas del plan, después el resto de la
familia (sin archivadas). Si el ejercicio no tiene series, se reemplaza; si ya tiene, la variante se
agrega a continuación. El registro queda bajo la variante nueva con `swappedFrom` (para el resumen y
para contar contra el plan).

**D-37. Variante sin historial.** No se prellena peso. Se muestra el último peso de trabajo de otra
variante de la familia como "referencia de familia, no equivalente".

**D-38. Rotación sugerida.** En la revisión de fin de mesociclo, además de rotar los estancados (tildado
por defecto), se ofrece rotar cualquier ejercicio con alternativa de la misma familia, destildado: un
toque para aceptar.

**D-39. Ejercicios.** Se puede editar nombre, familia, unidad, barra/carro, rango, incremento, descanso,
aproximaciones, músculos y nota de seguridad; crear una variante (copia sin historial, id derivado del
nombre) y archivar. Cambiar la unidad no convierte pesos ya registrados (se avisa). Los ejercicios no se
borran: se archivan, para no romper el historial.

**D-40. Tema.** Oscuro por defecto. El claro redefine los tokens y la escala de grises/estados por CSS
(mismas clases). La preferencia vive en Ajustes (viaja en el backup) y se copia a `localStorage` para
aplicarla antes del primer render.

**D-41. Notificaciones.** Se piden solo desde Ajustes, con un botón. Sin permiso: vibración y beep.

**D-42. E2E.** `e2e/offline.spec.ts` corre contra el build de producción servido en `/gym/`: instala el
SW, corta la red, importa el fixture, registra series, cambia de variante, recarga y verifica sesión,
resumen e historial, y que no hubo requests externas. Corre en CI (job `e2e`).

**Nota sobre D-02 con poleas.** Con incremento de 5 kg, el jalón prono a 45 kg (+11 %) pasa a
progresión por reps extendida (hasta 13). Si la pila tiene placas de 2,5, bajá el incremento en Ejercicios.

## Auditoría (09/11)

**D-43. Aproximaciones en vivo.** Mientras no haya series efectivas, las aproximaciones se calculan con el
peso que tengas en el stepper de la serie efectiva (no solo con el sugerido por el motor). Ese peso
tipeado se conserva al registrar aproximaciones. Con la primera efectiva registrada, las aproximaciones
dejan de mostrarse.

**D-44. Descanso real.** Se guarda en cada serie (`restSec`) al registrarla: segundos desde la serie
anterior **del mismo ejercicio** (aproximaciones incluidas), sin contar el traslado entre ejercicios.
No se registra si pasaron menos de 10 s (carga seguida o series anotadas de memoria) ni más de 30 min
(pausa larga). Editar una serie no lo recalcula. Se muestra en cada serie, como promedio de las
efectivas en el resumen de texto y en el historial por ejercicio, y se exporta en el CSV (`descanso_s`).
Las series importadas del seed no tienen descanso.

**D-45. Seguridad.** Ver `docs/SEGURIDAD.md`. CI con permisos mínimos (`contents: read`).

## Versión visible

**D-46. Versión.** Ajustes → Acerca de muestra el commit corto (en CI, `GITHUB_SHA`; local, `git rev-parse`) y la
hora de compilación (hora local del dispositivo). El botón "Buscar actualización" pide al service worker que
revise el servidor y avisa si hay una versión nueva; la instalación sigue siendo con el aviso "Actualizar".
Cada build cambia la hora, así que cada deploy genera una versión nueva aunque el código no haya cambiado.

## Ícono

**D-47. Ícono.** Pesa negra sobre fondo amarillo (`public/icons/icon.svg`), inclinada y con sombra suave. Las
versiones maskable y apple-touch son a sangre y la pesa queda dentro de la zona segura central, para que la máscara
circular de Android no corte nada; las de uso normal (192/512) tienen esquinas redondeadas transparentes. Los PNG
se regeneran con `node scripts/gen-icons.mjs`. El fondo de la pantalla de arranque (manifest) sigue siendo el oscuro
de la app.

**D-48. Actualizar no toca los datos.** Los datos viven en IndexedDB del origen; el service worker solo reemplaza
archivos de la app (caché). Verificado en Chromium: con datos cargados y una sesión a medias, se publicó un build con
otro ícono, se actualizó desde el aviso y quedaron idénticas las 10 sesiones y los 22 ejercicios. No cambiar `start_url`
ni el origen: cambiarlos sí crearía otra instalación sin los datos. El ícono de la pantalla de inicio lo gestiona
Android/Chrome (WebAPK) y puede tardar en refrescarse.

## Autorregulación (PR 1)

**D-49. Sueño y energía del día.** Día "bajo" = promedio de sueño y energía ≤ 2 (por ejemplo 2 y 2, o 1 y 3). Solo
afecta a esa sesión y siempre como sugerencia: (a) no se sube carga ni se suma una rep, se mantiene el peso de trabajo y
se repite lo de la última vez; (b) se sugiere una serie menos por ejercicio, mínimo 2. No se impone nada: podés subir igual.
No aplica en semana de deload (ya baja la carga) ni si no respondiste las preguntas. Sin historial suficiente tampoco cambia
nada. Es independiente de la sugerencia de deload (promedio de las últimas 3 sesiones ≤ 2,5, D-32).

**D-50. El mesociclo se pausa.** Una semana (lunes a domingo) del mesociclo ya cerrada y sin ninguna sesión terminada no
cuenta: el número de semana y el deload se corren una semana por cada una. Marcar un día como salteado no cuenta como
sesión. La semana en curso nunca se considera pausada y se deja de contar cuando el mesociclo ya habría terminado. Con
deload adelantado (`deloadFrom`) la fecha del deload queda fija. Es un cálculo derivado de las sesiones, no se guarda: si
después cargás una sesión de esa semana, la pausa desaparece. No hay botón de pausa manual; para cambiar el calendario se
edita el inicio del mesociclo.
