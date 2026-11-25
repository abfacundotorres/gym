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

**D-51. RIR en la progresión.** Solo se pregunta en la última serie efectiva de cada ejercicio (en las demás hay un
"+ RIR" opcional). El motor usa el RIR de la última serie efectiva al peso de trabajo de la última vez; sin dato, nada
cambia. Reglas: (a) todas las series al tope de reps y la última con RIR 0 **la primera vez** → mismo peso, repetí para
llegar con 1 en reserva; si ya lo repetiste al tope, se sube (nunca bloquea más de una vez); (b) RIR 3+ sin llegar al tope →
hasta +2 reps en vez de +1, sin pasar el tope; (c) con día bajo (D-49) manda el día bajo. Las series excluidas no cuentan.
Además, las sesiones del mismo día se ordenan por hora de inicio y no por id.

**D-52. Molestia o dolor.** Se marca por ejercicio durante la sesión (`pain`: molestia o dolor). Efecto en la próxima
vez que hagas ese ejercicio, por encima del día bajo y del RIR: molestia → mismo peso y repetir lo de la última vez
(sin sumar rep); dolor → −10 % de la carga, mismas reps. Es una sugerencia editable. La sugerencia nombra la causa y
recuerda que podés cambiar de variante (o consultar a un profesional si es dolor). En la revisión del mesociclo, si hubo
molestia o dolor en 2 de las últimas 3 veces y hay una alternativa de la misma familia, se propone rotar la variante
(tildada por defecto). Se ve en el historial por ejercicio y en el resumen de texto (`[molestia]`) y se exporta en el CSV.
La marca no excluye las series de la progresión ni del volumen.

**D-53. Poco tiempo hoy.** Opción al empezar la sesión: no se agregan los ejercicios opcionales (el escalador) y se
sugiere una serie menos por ejercicio ("podés dejarlo en N"), igual que un día bajo pero sin mantener los pesos. Es solo
una sugerencia: el plan no cambia y no afecta la progresión (no se marca "sin datos suficientes" por hacer menos series).

**D-54. Identidad visual "deportiva oscura".** Fondo casi negro, un solo acento lima (`--color-accent-solid` para fondos
de botones con `--color-on-accent` encima; `--color-accent` para texto y bordes, más oscuro en el tema claro para que
tenga contraste). Tipografía: Archivo variable (ejes peso y ancho), un único archivo `woff2` de 90 KB empaquetado en
`src/assets/fonts/` con su licencia OFL, sin requests externos y precacheado por el service worker (`font-src 'self'`).
Títulos y números grandes en Archivo condensada y mayúsculas (utilidades `title` y `digits`). Sin dependencias nuevas. El
color de los gráficos no cambió. Cambian `theme_color` y `background_color` del manifest (no `start_url` ni `scope`).

**D-55. Modo foco en la sesión.** En la lista de la sesión y en cada ejercicio se ocultan las pestañas y las acciones
van fijas abajo (`BottomBar`, sobre la barra de descanso, que sigue visible). El resumen sí muestra las pestañas. Desde la
lista se sale con "← Salir" (la sesión queda a medias y Hoy ofrece "Continuar"). El botón principal es "Seguir: <primer
ejercicio sin completar>" y, cuando no queda ninguno, "Terminar". Cada ejercicio es una pantalla nueva (se reinician el
menú, las aproximaciones y la edición al cambiar).

**D-56. Pantalla de ejercicio.** La recomendación de hoy va en grande (`25 por mano × 8·8·7`) junto con la última vez en
una sola tarjeta; las aproximaciones sugeridas se pliegan en una línea con su avance; peso y reps son números grandes con
−/+ debajo y "Guardar serie" dentro de la tarjeta. Pie fijo: ← / Repetir la anterior / →. El menú ⋯ reúne "Ocupado →
alternativa", molestia/dolor, saltear y la nota del ejercicio; un punto en el ⋯ avisa si hay molestia/dolor o nota. La
nota de seguridad sigue visible. Los textos de la recomendación no cambian de lógica: el cálculo vive en
`features/session/recommendation.ts` y lo comparten la pantalla del ejercicio y la lista de la sesión.

**D-57. Sin duración estimada.** El motor no calcula cuánto dura una sesión y no se inventa: Hoy no muestra tiempo
estimado. La lista de la sesión muestra solo el tiempo transcurrido desde que empezó (dato real, `startedAt`) y las series
hechas sobre las planificadas (con el recorte del deload aplicado).

**D-58. Pantallas secundarias con el mismo sistema.** Historial (fecha en bloque, insignias bajo el nombre), Volumen
(resumen "N de 13 músculos en rango", barras más gruesas, la explicación plegada), Resumen de sesión (cifras grandes,
récords destacados, el texto copiable plegado), Plan, Ajustes ("Calidad de datos" plegada con su conteo) y el historial
por ejercicio ("Próxima vez" destacada). El `Stepper` tiene dos versiones: la grande, para registrar series, y
`compact` (una fila), para listas y formularios. No cambia ninguna regla ni dato.

**D-59. Sensación al usar.** Al guardar una serie: vibración corta (`navigator.vibrate`, no hace nada donde no hay soporte)
y la fila nueva entra con una animación breve. Si la serie es récord según el motor (`findPRs`, calculado antes de guardar
solo para el aviso), la vibración es distinta, la fila brilla y aparece "¡Récord!" unos 3 segundos; el registro no cambia.
Después de guardar, la tarjeta de la serie siguiente se desplaza hasta quedar a la vista sobre las barras fijas (se mide
su altura real con `--bar-h`). Las pantallas entran con un fundido corto y el fin del descanso resalta la barra del
temporizador. Con "reducir movimiento" del sistema se anulan todas las animaciones (regla global ya existente). Un día
sin entrenamiento muestra el próximo del plan.

**D-60. Velocidad en el gimnasio.** (a) Mantener apretado − o + repite el paso (a los 450 ms, cada 110 ms); un toque suma
uno y el teclado sigue funcionando. (b) Al completar las series del plan, el editor se reemplaza por "Ejercicio completo"
con un botón "Siguiente: <ejercicio>" y "+ Serie extra" (Repetir la anterior sigue agregando series). (c) Las rayitas de
arriba en la pantalla del ejercicio son botones: saltan a cualquier ejercicio sin volver a la lista. (d) Hoy muestra la
sesión en curso con sus series y el ejercicio que sigue, y "Continuar" abre ese ejercicio. El avance de la sesión (series
hechas contra planificadas por ejercicio, deload incluido, y cuál sigue) es `sessionProgress` en `engine/session.ts`, con
tests; lo usan Hoy y la lista de la sesión.

**D-61. Accesibilidad y pantallas chicas.** Contraste medido (WCAG): el texto secundario (`slate-500`) y el apagado
(`slate-600`) se redefinieron en los dos temas para llegar a 4,5:1 y 3:1 sobre fondo, tarjeta y fichas; el acento lima
y el texto sobre el botón de acento superan 4,5:1. `src/ui/contrast.test.ts` lee los colores de `src/index.css` y falla
si un par baja del mínimo. Objetivos táctiles de 44 px de alto como mínimo (fichas, enlaces de volver, resúmenes
desplegables, rangos de volumen); la flecha de volver en el ejercicio es un botón de 44×44 con el nombre "← Sesión", y
las rayitas de salto se angostan (hasta 24 px) si hay muchos ejercicios en vez de desbordar. `e2e/layout.spec.ts` recorre
las pantallas a 375 y 320 px y verifica que no haya desborde horizontal, que todo control tenga nombre accesible y que
ningún objetivo sea menor a 24 px de ancho o 44 de alto.

**D-62. Almacenamiento protegido, visible.** La app ya pedía almacenamiento persistente al abrir (`usePwa`), pero no se
veía el resultado. Ajustes → Backup muestra si el navegador lo concedió: protegido (✓), sin proteger (con aviso, "Pedir
protección" y, si no está instalada, la sugerencia de instalarla) o sin información. Es una señal de cuánto importa el
backup: el navegador decide solo y puede decir que no. Además, "Compartir backup" usa el menú del sistema (Drive, correo,
WhatsApp) cuando el navegador lo permite: manda el JSON como `application/json` y, si no lo acepta, como texto plano con la
misma extensión. Compartir con éxito cuenta como backup hecho (reinicia el recordatorio de 7 días); cancelar no. Sin
probar en un celular real.

**D-63. Pantalla de rescate.** Un `ErrorBoundary` rodea cada pantalla (se reinicia al navegar, así las pestañas y el
descanso siguen funcionando) y otro toda la app. Si algo falla al dibujar, se muestra "Algo falló. Tus datos están a
salvo" con Exportar backup (lee la base directamente, sin pasar por la pantalla rota), Volver a Hoy, Recargar y el detalle
del error. No cubre errores dentro de las consultas a la base: ahí la sección puede quedar vacía en vez de mostrar el
rescate. "No encontrado" es una pantalla real (con enlace a Hoy) y desaparece el `Placeholder` de los hitos.

**D-64. Sesión que quedó abierta.** Si la sesión en curso es de un día anterior, la tarjeta de Hoy dice "Quedó sin
terminar" y ofrece, además de Continuar, Terminar así (solo si tiene series) y Descartar (con confirmación). Terminar así
cierra en la hora de la última serie registrada y no "ahora", para que la duración del resumen no se infle con los días
que pasaron (`finishStaleSession`).

**D-65. Lógica del registro en el motor y más pruebas.** Tres decisiones que estaban enterradas en `ExercisePage` pasan a
`engine/entry.ts` (funciones puras, con tests): con qué se prellena la próxima serie (`nextSetDefaults`), qué
aproximaciones faltan (`pendingWarmups`) y si una serie sería récord (`wouldBeRecord`). Sin cambio de comportamiento. Un
cambio de UX: tras guardar una serie extra vuelve la tarjeta "Ejercicio completo" (antes quedaba el editor abierto).
`e2e/flows.spec.ts` cubre saltear y deshacer, editar y borrar una serie, ejercicio completo con serie extra y saltar
entre ejercicios, y el ciclo de backup: exportar el JSON y restaurarlo en un navegador vacío (otro contexto) con las mismas
sesiones y el plan. Al escribirlos aparecieron dos trampas de las pruebas, no de la app: la barra de pestañas también es
una lista (contar `listitem` sin acotar a `main` suma 5) y el título de la lista de la sesión repite el del Resumen
(esperarlo por texto deja pasar antes de que la app termine de navegar). Se acotan a `main` y se espera el botón del Resumen.

**D-66. Superseries.** Se arman al momento, desde la lista de la sesión ("Hacer superserie"): 2 o 3 ejercicios que no estén
salteados, completos, ya agrupados ni sean cardio. El plan no cambia. Los del grupo quedan contiguos en la lista, en el lugar
del primero (`SessionItem.group`, opcional: backups anteriores se leen igual, el formato no cambia). Una sola pantalla: cada
ejercicio con su objetivo de hoy y su peso y reps (prellenados como en el registro normal, editables); "Guardar ronda" guarda
una serie de cada uno que todavía tenga series por hacer, en una sola escritura y con la misma hora. El descanso arranca al
cerrar la ronda, no entre ejercicios, y es el más largo de los descansos del grupo. Con distinta cantidad de series (lateral
4, posterior 3, curl 3), cada uno completa las suyas: la última ronda solo muestra los que faltan. La ronda en curso es la
menor cantidad de series hechas entre los pendientes más uno (`groupView`). El `restSec` de cada serie es lo que tardó la
ronda. Las series se editan y se borran en la misma pantalla. Para el motor son series efectivas comunes: no se ajusta
nada por hacerlas en superserie. Límites de esta versión: en la pantalla del grupo no hay aproximaciones, marcas (rest-pause,
drop), RIR, alternativa, molestia/dolor, nota ni saltear; para eso se usa "Deshacer superserie" (los ejercicios quedan sueltos
y con sus series). Sin probar con el celular en el gimnasio.

**D-67. Variantes que se alternan.** Una variante es un ejercicio de la misma familia, con su propio historial y su propia
progresión (no se mezclan mancuernas con máquina). Las opciones de cada ejercicio del plan (`PlanItem.alt`, ya existente) se
arman en Plan → "Variantes": agregar una que ya existe de la familia, o crear una nueva ahí mismo con su unidad (mancuerna
por mano, barra por lado, polea en kg o máquina en ladrillos). Crear copia la configuración (rango, descanso, músculos,
aproximaciones); con otra unidad el paso de carga pasa a uno razonable (ladrillos 1, resto 2,5; se cambia en Ejercicios) y se
descarta el peso de la barra o del carro. Las opciones valen en todos los días donde aparece el ejercicio (es el mismo
ejercicio). En la sesión, cuando el plan tiene opciones, la pantalla del ejercicio muestra un selector con el nombre corto
(lo que va entre paréntesis: "Mancuernas", "Máquina") y se cambia con un toque. Cambiar sin series hechas reemplaza el
ejercicio; con series hechas, la otra variante se agrega como un ejercicio nuevo a continuación (el avisa un texto). La
variante sin historial no recibe un peso inventado: el motor muestra la de la familia solo como referencia. El menú ⋯ conserva
"Ocupado → alternativa" con toda la familia. Sin selector dentro de una superserie.

**D-68. Aproximaciones editables, a la vista.** Antes de la primera serie efectiva, la entrada en calor está abierta (ya no
plegada): las aproximaciones que sugiere el motor, cada una con su peso y reps (−/+ y tocar el valor para escribir) para
ajustarlas antes de anotarlas con el ✓, y "+ Aproximación" para sumar otra, que copia la última fila a la vista (o la última
anotada; sin nada, peso vacío y 8 reps). Una fila anotada sale del panel aunque se haya anotado con otro peso. El motor sigue
sin sugerir un peso ya anotado como aproximación (no repite). Al guardar la primera serie de trabajo el panel desaparece y las
aproximaciones anotadas quedan en la lista, donde se modifican o borran tocándolas. Una aproximación no dispara el descanso.
Cuando ya no quedan sugeridas, queda solo el botón "+ Aproximación". El esquema por ejercicio (Pesadas 4, Liviana 1,
Ninguna) no cambia. En la superserie no hay aproximaciones.

**D-69. Fase del mesociclo (bulk, cut, mantenimiento).** Se declara por mesociclo (`Mesocycle.phase`, opcional: sin el campo, el motor
se comporta como siempre; compatible con backups anteriores). La app no conoce el peso corporal ni las calorías: la fase es una decisión
tuya, y solo cambia cómo se **interpreta** el progreso y qué se sugiere; no toca cargas ni series. Bulk y mantenimiento: sin cambios en el
motor. **Cut:** (a) un ejercicio que no mejora no es "estancado" sino "manteniendo" (insignia neutra), porque mantener el rendimiento en
déficit ya es un buen resultado; (b) una baja de e1RM en las últimas tres exposiciones cuenta como regresión solo si supera el 5 %
(`CUT_REGRESSION_TOLERANCE`); lo menor es ruido normal del déficit; (c) por eso el deload sugerido por estancamiento (D-32) y la
rotación propuesta por estancamiento (D-33) no se disparan por "manteniendo" (sí por sueño y energía bajos, "me siento quemado" y
molestias o dolor); (d) el volumen objetivo semanal por músculo pasa al 80 % de los rangos de Ajustes, redondeado a medias series
(`CUT_VOLUME_FACTOR`), en Volumen y en la revisión, según la fase del mesociclo de esa semana (`phaseAt`). **Largo de bloque:** al elegir
la fase se sugiere un bloque (cut 4+1; bulk y mantenimiento 5+1) y se aplica solo si lo aceptás ("Aplicar"); es una pauta general, no una
regla. El 5 %, el 80 % y el 4+1 son heurísticas mías, no una prescripción: están en `engine/phase.ts` para cambiarlas. El siguiente
mesociclo hereda la fase, y en la revisión de fin de bloque se puede elegir otra. Se ve en Hoy, en el Plan, en Volumen y en el Historial
("manteniendo").

**D-70. Peso corporal opcional.** Una medición por día (`bodyweights`: `{ id: 'bw-AAAA-MM-DD', date, kg }`, 20 a 400 kg; guardar de nuevo el mismo día
la reemplaza). Se anota en Plan → "Peso →" (pantalla `/peso`, con el día editable para cargar uno olvidado) y se ve la tendencia: último peso, cambio por
semana y un gráfico semanal. Es **solo descriptivo**: no entra en ningún cálculo de carga, progresión ni sugerencia, y no se compara con ninguna meta.
La semana se promedia (lunes a domingo); el cambio por semana es la pendiente por mínimos cuadrados de las últimas 4 semanas con datos (cuenta las
semanas reales, no inventa las que faltan) y exige al menos 3. Hoy muestra una fila discreta ("Anotar el peso de esta semana") solo si ya
anotaste alguno o el mesociclo está en Cut o Bulk. **Base de datos:** primera migración, `db.version(2)` agrega la tabla `bodyweights` y no toca
la v1 (un test abre una base creada con el esquema anterior, con datos, y verifica que se conserva todo y que la tabla nueva anda). **Backup:** campo
`bodyweights` opcional (el formato no cambia de versión). Un backup anterior se lee igual; "Mezclar" no toca los pesos existentes y "Reemplazar todo"
con un archivo sin pesos los borra, y la vista previa lo muestra en "Pesos corporales".

**D-71. Descansos: aproximaciones y descanso real corregible.** (a) **Aproximaciones:** al anotar una serie A arranca un temporizador corto (45 s por defecto,
`DEFAULT_WARMUP_REST_SEC`), rotulado "(aprox.)"; se cambia en Ajustes → "Descanso entre aproximaciones (s)" (`settings.warmupRestSec`, entero 0 a 600; 0 = sin
temporizador). Las aproximaciones siguen sin entrar en el descanso medido ni en el promedio (D-19, D-44). (b) **"Saltar"/"Cerrar" marca el inicio de la serie
siguiente:** el temporizador sigue contando mientras ya estás entrenando, y el descanso real es hasta que empezaste, no hasta que guardás. Al tocar "Saltar" se
guarda la hora en `localStorage` (`gym.restSkip`, con la clave del ejercicio o de la superserie) y la próxima serie guardada de ese ejercicio la consume una sola vez:
`restSec` = marca − fin de la serie previa (`restFromSkip`). La marca solo vale si es posterior a la serie previa, no es del futuro y tiene menos de 15 min
(`MAX_SKIP_AGE_SEC`); si no, se usa el descanso entre guardados de D-44. No es un dato de la base: si se pierde, el descanso queda como antes. (c) **Corregir a mano:**
al editar una serie, "Descanso (s)" (pasos de 15 s) y "Sin dato". Sin cambios de esquema de Dexie; `warmupRestSec` es opcional en el backup.

**D-72. Revisión de fin de bloque: variantes hechas y "rotar todas".** (a) **Qué variante se hizo:** la revisión suma "Variantes que hiciste": para cada ejercicio del plan con
alternativas, cuántas sesiones del bloque (en ese día del plan, sin contar el deload anterior al cierre ni las sesiones en curso) tuvieron cada variante, la más usada primero y,
a igual cantidad, en el orden del plan (`variantsUsedIn`). Cuenta una variante solo si tuvo series cargadas y no se salteó; si no hubo ninguna, no hay fila (no se inventa nada).
(b) **Rotar todas con un toque:** si hay más de una rotación propuesta, un botón las tilda todas ("Rotar todas las variantes (N)") y vuelve a lo sugerido ("Dejar solo lo sugerido");
no toca las propuestas de series (`withAllRotations`). Cada rotación sigue pudiéndose destildar a mano. Rotar es lo de siempre (D-33): la variante nueva pasa a ser la titular y la vieja queda
como alternativa. Sin cambios de datos ni de backup.

**D-73. Plantilla del bloque siguiente, preparada de antemano.** En Plan → "Preparar el bloque siguiente" (pantalla `/plan/siguiente`) se arma una **copia editable del plan de hoy**
para el bloque que viene: series, qué variante es la titular (la anterior pasa a alternativa, igual que al rotar en la revisión) y ejercicios que se sacan. Agregar ejercicios nuevos
no está, ni acá ni en el Plan: **hoy la app no permite agregar, sacar ni reordenar los ejercicios de un día, ni crear ejercicios nuevos** (solo series y variantes); eso exige re-importar
un archivo. (Una versión anterior de esta nota decía que se hacía en el Plan: era un error.) **Dónde se guarda:** campo opcional `nextPlan` del mesociclo activo (no hay tabla ni migración de Dexie; viaja en el backup).
**Cómo se aplica:** al "Empezar el siguiente" desde la Revisión, el plan del bloque nuevo es la plantilla ya resuelta (`resolveNextPlan`) más lo que se acepte en la revisión; la plantilla
no queda ni en el bloque cerrado ni en el nuevo. **Qué prevalece:** la plantilla es tuya y no se pisa sin que lo aceptes: la revisión propone encima de ella (series por volumen
sobre las series de la plantilla; no vuelve a proponer rotar lo que ya rotaste), pero lo que muestra del bloque que termina (PRs, volumen, estancados, variantes que hiciste) sigue saliendo
del plan de hoy. **Casos borde:** los días de la plantilla se emparejan por id con los del plan de hoy (un día que la plantilla no trae queda como está; uno que ya no existe se ignora);
se descartan los ejercicios que ya no existen o están archivados y, de las alternativas, las inutilizables. Si cambiás el plan de hoy después de preparar la plantilla, al aplicarla
gana la plantilla (es lo que planificaste). Las notas del bloque nuevo dicen cuántos cambios traía la plantilla.

**D-74. Volver tras una pausa.** Al empezar una sesión, si pasaron **10 días o más** desde la última sesión terminada (`COMEBACK_MIN_DAYS`; con tres sesiones por semana es haber faltado a una semana), el chequeo previo
suma el chip "Vuelta tras N días", **activado por defecto y desactivable** (entonces se entrena como siempre). Según los días: **10-20** carga ×0,95 y una serie menos; **21-41** ×0,9 y dos tercios de las series;
**42 o más** ×0,8 y la mitad; nunca menos de 2 series ni más de las planificadas (`comebackFor`, `comebackSets`). Con 2 o 3 repeticiones en reserva según el tramo. Los umbrales y factores son pautas generales mías, no una
prescripción: con pausas cortas se pierde poco y lo que más pesa es volver de golpe con todo el volumen. **Cómo se calcula:** parte del **último peso de trabajo**, sin la subida que habría tocado (no se progresa al volver; si no, ×0,9 sobre
un peso ya subido sería el 100 % de la última vez), con las **mismas reps** de la última vez; sin una última vez válida no se inventa un peso (queda para elegir a mano). **No se suma, gana la más fuerte:** con deload en la
misma semana se usa la reducción más fuerte de las dos (carga y series); si la última vez hubo dolor (D-52, −10 %), también; en una sesión de vuelta no se aplica el "día bajo" ni la serie menos de D-49 (ya se redujo). **Guardado:**
`Session.comebackDays` (los días al empezar), opcional en el backup. **No es base de progresión**, PR ni tendencia (igual que el deload, D-29); sí cuenta para el volumen semanal. **Límites a propósito:** solo la primera sesión de vuelta:
la segunda parte de la última sesión normal antes de la pausa (con pausas de 42 días o más conviene bajar a mano); y la app solo ve fechas, no sabe si la pausa fue por lesión o por vacaciones (para una lesión sigue
estando la marca de molestia o dolor por ejercicio, D-52).

**D-75. Avisos de patrón durante la sesión.** Tres avisos cortos, neutros y descartables ("Entendido", se guarda en `meta` con la clave `risk:<aviso>`), solo mientras se entrena. **Son reglas simples sobre lo que
ya registrás, no un diagnóstico ni una predicción de lesiones**: la evidencia para predecir lesiones a partir de un registro de entrenamiento es floja, y los umbrales son pautas mías (están en `engine/risk.ts`).
(1) **Compuestos al fallo en la misma sesión:** con 2 o más ejercicios compuestos con alguna serie de trabajo a RIR 0 (`FAILURE_SESSION_MIN`), la lista de la sesión lo dice, y en cada compuesto que todavía no empezaste
recuerda que podés dejar 1 o 2 en reserva. "Compuesto" = tiene músculos secundarios (`isCompound`); es una aproximación a "pesado", no hay un dato mejor en el catálogo. (2) **Racha en el mismo ejercicio:** 3 o más
veces seguidas terminado al fallo (`FAILURE_STREAK_MIN`), mirando las sesiones anteriores de esa misma variante sin deload ni vuelta; una vez sin dato de RIR corta la racha (no se presume fallo); se muestra antes de la
primera serie de trabajo. (3) **Salto de volumen:** esta semana (con lo que va de la sesión en curso) supera en 50 % o más y en 4 o más series el promedio semanal de las últimas 4 semanas, por músculo (mismo cálculo de la
pantalla Volumen: primarios 1, secundarios 0,5); el promedio usa solo semanas con sesiones, sin deload ni vuelta tras una pausa y exige al menos 2, y un promedio menor a 4 series no cuenta (un músculo que casi no se
entrena); no se avisa en una sesión de deload ni de vuelta. Se muestran los dos mayores saltos. **Depende de que cargues el RIR:** sin RIR, los avisos 1 y 2 no se disparan. **Fuera de alcance:** el resumen final, y
los avisos por zona del cuerpo (siguiente paso).

**D-76. Molestias por zona del cuerpo.** Se anotan por zona (cuello, hombro, codo, muñeca, espalda alta, lumbar, cadera, rodilla, tobillo) con intensidad (molestia o dolor) y "desde cuándo", de dos maneras: **suelta**
(Hoy → "Anotar una molestia", como una contractura fuera de la sesión) y **desde un ejercicio** (al marcar molestia o dolor, D-52, se puede elegir la zona). Se cierran con "Ya pasó" y el registro queda. **Base de datos:**
`db.version(3)` agrega la tabla `zoneIssues` y no toca lo anterior (un test abre una base v2 con datos y verifica que se conserva todo); **backup:** `zoneIssues` y `Exercise.zones` opcionales (el formato no cambia de versión).
Una zona tiene a lo sumo una molestia activa: volver a anotarla conserva la fecha más vieja y el dolor no baja solo. **Qué ejercicios cargan cada zona** (`engine/zones.ts`): se deduce por músculos: **mucho** si la zona tiene un músculo
primario suyo, **algo** si es secundario. Es una aproximación mía: el catálogo no tiene cuello, trapecio ni antebrazo, así que el cuello se asocia a espalda alta y deltoides y la muñeca no se deduce de nada. Por eso **se corrige a mano**:
en Ejercicios → editar, "Zonas que carga"; si se corrigen, manda esa lista (cuenta como mucho) y "Volver a deducirlas" la quita. **Qué hace con una zona activa:** (a) en la lista de la sesión, un aviso por zona con los
ejercicios de hoy que la cargan (mucho y algo) y "Ya pasó", y "Carga <zona>" en cada fila; (b) en cada ejercicio que la carga, antes de la primera serie de trabajo: el aviso, dejar 1 o 2 en reserva o una serie menos, y las
**variantes de la misma familia que la cargan menos** (las del plan primero) para cambiar con un toque; con dolor, recomienda consultar a un profesional. **Lo que NO hace:** no cambia las sugerencias de carga ni la progresión (para eso
sigue estando la marca por ejercicio, D-52), no diagnostica ni predice, y no propone cambios al plan (eso queda para el siguiente paso). Una variante que se sugiere solo aparece si sus zonas difieren de las del ejercicio actual,
es decir, casi siempre después de corregirlas a mano.

**D-77. Propuestas al plan por una molestia, y volver atrás.** Con una zona activa, Plan → "Molestias" propone cambios al plan que se aplican con un toque (uno por uno o "Aplicar todas"); también se llega desde el enlace "Propuestas para el plan"
de Hoy. Por cada ejercicio del plan que carga la zona (D-76) y por día del plan (`zoneProposals`): (a) si hay una **variante de su familia que la carga menos**, pasar a esa (cualquiera de la familia, las opciones del plan primero; la anterior queda como
alternativa, igual que al rotar en la revisión, D-33); (b) si no hay y la carga **mucho**, **una serie menos** (nunca menos de 2, y no se repite donde ya se aplicó); (c) si la carga solo algo y no hay variante, no se propone nada (alcanza con el aviso).
Un ejercicio tiene a lo sumo una propuesta por día: la de la zona más urgente (dolor primero). **Una molestia es temporal, así que los cambios se anotan en ella** (`ZoneIssue.planChanges`): cuando pasa ("Ya pasó"), el Plan ofrece **"Volver el plan a como estaba"** o
**"Dejar así"** (se conserva el plan y se olvida el registro). Deshacer respeta lo que se cambió después: unas series que editaste a mano o una variante que ya no es la titular **no se tocan**, y los cambios encadenados se deshacen del último al primero.
Solo se aplican y se anotan los cambios que todavía modifican el plan (una propuesta desactualizada no hace nada). **Limitaciones a propósito:** no cambia la sesión en curso ni las sugerencias de carga, no toca el plan del bloque siguiente (D-73) y la elección de
qué proponer es una regla simple mía (variante o una serie menos), no un programa de rehabilitación. Con muchos ejercicios que cargan la zona salen varias propuestas; "Aplicar todas" las aplica juntas.

**D-78. Reglas ajustables y deload con opciones.** Los umbrales que puse yo (no son prescripciones) se ven y se cambian en **Ajustes → "Reglas del motor"**, cada uno con su valor por defecto: **vuelta tras una pausa** (días mínimos, 7 a 21; carga de vuelta por tramo,
corta, media y larga, 50 a 100 %), **avisos** (compuestos al fallo por sesión, 2 a 5; veces seguidas al fallo, 2 a 6; salto de volumen, 20 a 200 % sobre el promedio y 1 a 10 series de más) y **deload** (tipo). Se guardan **solo los que cambiás**
(`Settings.rules`, opcional, sin migración de la base); un valor inválido o fuera de rango vuelve a su valor por defecto sin tirar el resto (`resolveRules`), y "Restablecer las reglas" borra el campo. El motor recibe las reglas por parámetro
(con los valores de siempre por defecto) y las pantallas las leen con `useRules()`. **Deload con tipo:** "Como ahora" (la mitad de las series y −10 % de carga), "Más liviano" (la mitad de las series y −20 %) y **"Semana sin pesas"**: es el descanso
planificado, así que la semana de deload sin sesiones **no cuenta como pausa ni corre el mesociclo** (`pausedWeeks`); Hoy lo dice ("Semana sin pesas: descansá") y, si entrenás igual, la sesión sale liviana (−20 %). Con la vuelta tras una pausa o un dolor
marcado (D-74, D-52) sigue ganando la reducción más fuerte. **No se pueden cambiar** (a propósito, para no llenar la pantalla): los límites de los tramos de pausa (21 y 42 días), las series de la vuelta por tramo, ni qué cuenta como "compuesto".

**D-79. RIR a la vista.** Dos de los tres avisos de patrón (D-75) y parte de la progresión (D-51) dependen del RIR, y antes estaba escondido detrás de "+ RIR" (salvo en la última serie efectiva, que lo pregunta). Ahora, **en toda serie efectiva el
RIR está siempre a la vista** (0, 1, 2 y 3+, opcional, tocar de nuevo lo quita), tanto al anotar como al editar una serie ya guardada; las aproximaciones y el cardio no lo tienen. No se rellena solo ni se hereda de la serie anterior (no se inventan datos).
En el **resumen de la sesión**, si quedaron ejercicios trabajados sin RIR en ninguna serie efectiva, una línea lo dice ("RIR cargado en 1 de 2 ejercicios", `rirCoverage`); con todos cargados o sin ejercicios trabajados, no dice nada. El RIR ya se
veía en el historial por ejercicio y en las series de la sesión (`@2`). **Sin cambios de datos.**

**D-80. Resumen por semana o por bloque.** Pantalla `/resumen` (desde Historial → "Resumen →" y Plan → "Resumen →") que junta lo que ya se calcula en otras pantallas, con las mismas reglas: **sesiones** (hechas, y de cuántas del plan en la semana; cada una lleva a su resumen),
**series por músculo contra tu rango** de Ajustes (con el 80 % en cut, D-69), **PRs** (contra todo lo anterior, como en la revisión del mesociclo), **RIR cargado** y **avisos** (sesiones con compuestos al fallo y, solo en la semana, saltos de volumen, con las reglas de D-78),
**molestias** que se superponen con el período (D-76) y **peso** (el de la semana y el cambio contra la anterior; en el bloque, el último y el cambio desde el primero, D-70). **Semana:** de lunes a domingo, con "←" y "→" hasta la primera semana con sesiones; las series son las de esa semana.
**Bloque:** del lunes en que empezó hasta su final (corrido por las semanas pausadas, D-50, y por el modo de deload, D-78) o hasta hoy si no terminó; si hay más de uno se elige; las series por músculo son **el promedio semanal de las semanas con sesiones sin contar el deload**
(el deload sí suma en el total de series hechas y se marca en la lista). "Copiar resumen como texto" (`summaryText`) trae lo mismo que la pantalla. Es **descriptivo**: no propone nada ni compara con metas más allá de los rangos de series; una semana de deload lo aclara. Solo cuenta sesiones terminadas.
**Sin cambios de datos.**

