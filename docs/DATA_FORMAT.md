# Formato de datos

Todo vive en IndexedDB (base `gym`, Dexie). El backup es un JSON que contiene la base completa
y se puede volver a importar (modo **reemplazar** o **mezclar**). El esquema exacto (zod) está en
`src/data/schemas.ts`; este documento lo describe.

## Backup JSON (`gym-backup-AAAA-MM-DD.json`)

```jsonc
{
  "format": "gym-backup",
  "version": 1,               // sube con cambios incompatibles; el import valida
  "exportedAt": 1762600000000, // ms epoch
  "data": {
    "exercises":  [Exercise],
    "planDays":   [PlanDay],
    "mesocycles": [Mesocycle],
    "sessions":   [Session],
    "dayMarks":   [DayMark],
    "bodyweights": [Bodyweight],   // opcional (D-70): backups anteriores no lo traen
    "zoneIssues": [ZoneIssue],     // opcional (D-76): molestias por zona del cuerpo
    "settings":   Settings | null,
    "dataQuality": { "source": string, "notes": [string], "importedAt": number } | null
  }
}
```

Las colecciones vienen ordenadas por `id`. Fechas: `'YYYY-MM-DD'` (hora local). Timestamps: ms epoch.

### Exercise
| campo | tipo | notas |
|---|---|---|
| `id` | string | estable; las sesiones lo referencian |
| `name`, `family` | string | `family` agrupa variantes; cada variante tiene historial propio |
| `unit` | `per_side` \| `per_hand` \| `total` \| `bricks` \| `minutes` | ver abajo |
| `barKg?`, `sledKg?` | number | carga base (barra / carro) si se conoce |
| `repsPerLeg?`, `cardio?`, `archived?` | boolean | |
| `primary`, `secondary` | Muscle[] | `chest, lats, upper_back, delt_front, delt_side, delt_rear, biceps, triceps, quads, hamstrings, glutes, calves, lower_back` |
| `range` | [min, max] | reps |
| `increment` | number | en la unidad del ejercicio |
| `restSec` | number | |
| `warmup` | `heavy` \| `light` \| `none` | |
| `safetyNote?`, `note?` | string | |
| `zones?` | Zone[] | zonas que carga, corregidas a mano (D-76): `neck, shoulder, elbow, wrist, upper_back, lower_back, hip, knee, ankle`. Sin el campo se deducen de los músculos |

Unidades: `per_side` = kg de discos por lado, sin barra/carro · `per_hand` = kg por mancuerna ·
`total` = kg de la pila/polea · `bricks` = ladrillos (kg = ladrillos × `settings.kgPerBrick`) ·
`minutes` = cardio.

### PlanDay
`{ id, name, weekday (0=dom … 6=sáb), items: [{ exerciseId, sets, rangeOverride?, alt: [exerciseId], optional? }] }`

### Mesocycle
`{ id, startDate, accumulationWeeks (3-8), deloadWeeks (0-2), deloadFrom?: ISO date (lunes; deload adelantado), status: 'active'|'finished', notes, phase?: 'bulk'|'cut'|'maintain', nextPlan?: PlanDay[] }`
- `phase` (opcional, D-69): fase declarada del mesociclo. Sin el campo, el motor se comporta como siempre. Compatible hacia atrás: un backup
  anterior se lee igual y la versión del formato no cambia.
- `nextPlan` (opcional, D-73): plantilla del bloque siguiente, un `PlanDay[]` (mismo formato que `planDays`). Solo en el mesociclo activo; al empezar el siguiente se aplica y se borra. Un backup anterior no lo trae y se lee igual.

### Session
| campo | tipo | notas |
|---|---|---|
| `id` | string | `seed-AAAA-MM-DD` si vino del seed |
| `date` | ISO date | |
| `planDayId`, `mesocycleId` | string, string\|null | |
| `readiness?` | `{ sleep 1-5, energy 1-5 }` | |
| `deload?` | boolean | la sesión se hizo en semana de deload |
| `short?` | boolean | se empezó con "poco tiempo hoy" (sin ejercicios opcionales) |
| `comebackDays?` | entero ≥ 1 | sesión de vuelta tras una pausa (D-74): los días sin entrenar al empezar. Menos series y carga; no es base de progresión. Un backup anterior no lo trae y se lee igual |
| `note` | string | |
| `startedAt`, `finishedAt` | number\|null | null en datos importados |
| `status` | `in_progress` \| `finished` | |
| `source` | `seed` \| `app` | |
| `items` | SessionItem[] | |
| `exerciseIds` | string[] | derivado de `items` (índice) |

**SessionItem**: `{ exerciseId, note?, sets: SetEntry[], skipped?, swappedFrom?, confidence?: 'alta'|'media'|'baja', pain?: 'molestia'|'dolor', group?: string }`
(sin `confidence` = alta).
- `group` (opcional, D-66): superserie. Los items de una sesión con el mismo `group` se hicieron juntos, en rondas; son 2 o 3 y están
  contiguos en `items`. Sin el campo, el ejercicio es suelto. Es compatible hacia atrás: un backup anterior sin `group` se lee igual,
  y la versión del formato no cambia. El CSV no lo incluye.

**SetEntry**: `{ id, type: 'A'|'W', weight: number|null, reps: number|null, minutes?, flag?: 'rp'|'drop'|'rebote'|'asist', repsBeforePause?, rir? (0-3), note?, doneAt?: number|null, restSec?: number }`
- `restSec`: descanso real en segundos desde la serie anterior del mismo ejercicio (D-44). Solo en series cargadas con la app.
- `A` = aproximación, `W` = efectiva. `weight` en la unidad del ejercicio.
- Con `flag: 'rp'`, `reps` son las totales y `repsBeforePause` las previas a la primera pausa.
- `reps: null` = no se registró (nunca se usa en cálculos de progresión).

### DayMark
`{ id, date, kind: 'skipped', planDayId }`

### Bodyweight
`{ id: 'bw-AAAA-MM-DD', date: ISO date, kg: number (20-400) }`: una medición por día, opcional (D-70). Se importa en un backup sin el campo
sin problema; con "Mezclar" no toca los pesos que ya tenés y con "Reemplazar todo" los borra (como al resto de lo que no está en el archivo).

### Settings
`{ kgPerBrick, restSecOverrides: {exerciseId: seg}, volumeTarget: {Muscle: [min, max]}, theme: 'dark'|'light', lastBackupAt: number|null, warmupRestSec?: number }`
- `warmupRestSec`: descanso del temporizador tras una aproximación, 0 a 600 s; si falta, 45 (D-71).
- `rules` (opcional, D-78): las reglas del motor que se cambiaron, solo esas: `{ comebackMinDays?: 7-21, comebackLoadPct?: [corta, media, larga] (50-100), failureSessionMin?: 2-5, failureStreakMin?: 2-6, spikePct?: 20-200, spikeMinExtra?: 1-10, deloadMode?: 'standard'|'light'|'rest' }`. Los que faltan valen lo de siempre; un valor fuera de rango se rechaza al importar.

## CSV de series (`gym-series-AAAA-MM-DD.csv`)

Solo exportación (para planillas). Una fila por serie, UTF-8, separador `,`, comillas dobles si hace falta.

`fecha, dia, sesion_id, ejercicio_id, ejercicio, unidad, serie, tipo, peso, reps, minutos, marca, reps_antes_pausa, rir, descanso_s, confianza, molestia, nota`

## seed.json

El import también acepta el `seed.json` original (formato de tuplas `[tipo, peso, reps, marca?, repsAntesDePausa?]`).
Se convierte con `src/data/seedImport.ts`, aplicando las correcciones de `docs/DECISIONES.md` (D-09, D-10).

### ZoneIssue (D-76)
`{ id, zone: Zone, severity: 'molestia'|'dolor', startedOn: ISO date, resolvedOn?: ISO date, note?: string, exerciseId?: string, sessionId?: string }`
- Activa mientras no tenga `resolvedOn` ("Ya pasó" la cierra; el registro queda). `exerciseId` y `sessionId` solo si se marcó desde un ejercicio.
- `planChanges?` (D-77): los cambios al plan hechos por esta molestia, para poder deshacerlos: `{ kind: 'swap', planDayId, from, to }` (la variante `to` pasó a ser la titular) o `{ kind: 'sets', planDayId, exerciseId, from, to }`. Se borra al deshacerlos o al elegir "Dejar así".
- Una zona tiene a lo sumo una molestia activa. Un backup anterior no trae la colección y se lee igual; al importar, "Reemplazar todo" con un archivo sin ella las borra y "Mezclar" no las toca.


## Copias automáticas (D-82)

Aparte del backup que exportás, la app guarda sola una copia antes de migrar la base a una versión nueva del esquema. Vive en **otra base de IndexedDB, `gym-safety`**
(tabla `snapshots`, clave `id`), no en `gym`: `{ id, takenAt, fromVersion, toVersion, sessions, backup }`, donde `backup` es **exactamente el formato de arriba**
(`format: "gym-backup"`, `version: 1`), así que lo que se descarga desde Ajustes se importa como cualquier backup. No es parte del export, no cambia el formato y se conservan las últimas 2.
