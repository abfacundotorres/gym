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

Unidades: `per_side` = kg de discos por lado, sin barra/carro · `per_hand` = kg por mancuerna ·
`total` = kg de la pila/polea · `bricks` = ladrillos (kg = ladrillos × `settings.kgPerBrick`) ·
`minutes` = cardio.

### PlanDay
`{ id, name, weekday (0=dom … 6=sáb), items: [{ exerciseId, sets, rangeOverride?, alt: [exerciseId], optional? }] }`

### Mesocycle
`{ id, startDate, accumulationWeeks (3-8), deloadWeeks (0-2), deloadFrom?: ISO date (lunes; deload adelantado), status: 'active'|'finished', notes }`

### Session
| campo | tipo | notas |
|---|---|---|
| `id` | string | `seed-AAAA-MM-DD` si vino del seed |
| `date` | ISO date | |
| `planDayId`, `mesocycleId` | string, string\|null | |
| `readiness?` | `{ sleep 1-5, energy 1-5 }` | |
| `deload?` | boolean | la sesión se hizo en semana de deload |
| `short?` | boolean | se empezó con "poco tiempo hoy" (sin ejercicios opcionales) |
| `note` | string | |
| `startedAt`, `finishedAt` | number\|null | null en datos importados |
| `status` | `in_progress` \| `finished` | |
| `source` | `seed` \| `app` | |
| `items` | SessionItem[] | |
| `exerciseIds` | string[] | derivado de `items` (índice) |

**SessionItem**: `{ exerciseId, note?, sets: SetEntry[], skipped?, swappedFrom?, confidence?: 'alta'|'media'|'baja', pain?: 'molestia'|'dolor' }`
(sin `confidence` = alta).

**SetEntry**: `{ id, type: 'A'|'W', weight: number|null, reps: number|null, minutes?, flag?: 'rp'|'drop'|'rebote'|'asist', repsBeforePause?, rir? (0-3), note?, doneAt?: number|null, restSec?: number }`
- `restSec`: descanso real en segundos desde la serie anterior del mismo ejercicio (D-44). Solo en series cargadas con la app.
- `A` = aproximación, `W` = efectiva. `weight` en la unidad del ejercicio.
- Con `flag: 'rp'`, `reps` son las totales y `repsBeforePause` las previas a la primera pausa.
- `reps: null` = no se registró (nunca se usa en cálculos de progresión).

### DayMark
`{ id, date, kind: 'skipped', planDayId }`

### Settings
`{ kgPerBrick, restSecOverrides: {exerciseId: seg}, volumeTarget: {Muscle: [min, max]}, theme: 'dark'|'light', lastBackupAt: number|null }`

## CSV de series (`gym-series-AAAA-MM-DD.csv`)

Solo exportación (para planillas). Una fila por serie, UTF-8, separador `,`, comillas dobles si hace falta.

`fecha, dia, sesion_id, ejercicio_id, ejercicio, unidad, serie, tipo, peso, reps, minutos, marca, reps_antes_pausa, rir, descanso_s, confianza, molestia, nota`

## seed.json

El import también acepta el `seed.json` original (formato de tuplas `[tipo, peso, reps, marca?, repsAntesDePausa?]`).
Se convierte con `src/data/seedImport.ts`, aplicando las correcciones de `docs/DECISIONES.md` (D-09, D-10).
