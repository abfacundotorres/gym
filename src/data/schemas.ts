import { z } from 'zod'
import { DELOAD_MODES, RULE_LIMITS } from '../engine/rules'
import { MUSCLES, SET_FLAGS, UNITS, ZONES } from '../engine/types'

const muscle = z.enum(MUSCLES)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const range = z.tuple([z.number().int().positive(), z.number().int().positive()])
const confidence = z.enum(['alta', 'media', 'baja'])

// ---------- seed.json (formato de la conversación de seguimiento) ----------

const seedSet = z.tuple([
  z.enum(['A', 'W']),
  z.number(),
  z.number().int().nonnegative().nullable(),
  z.enum(SET_FLAGS).optional(),
  z.number().int().nonnegative().optional(),
])

export const seedSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.string(),
  // Las unidades del seed no incluyen 'minutes'; se acepta igual (D-10).
  exercises: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      family: z.string(),
      unit: z.enum(UNITS),
      barKg: z.number().optional(),
      sledKg: z.number().nullable().optional(),
      repsPerLeg: z.boolean().optional(),
      cardio: z.boolean().optional(),
      primary: z.array(muscle),
      secondary: z.array(muscle),
      range,
      increment: z.number().positive(),
      restSec: z.number().nonnegative(),
      warmup: z.enum(['heavy', 'light', 'none']),
      safetyNote: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  planTemplate: z.record(
    z.string(),
    z.array(
      z.object({
        ex: z.string(),
        sets: z.number().int().positive(),
        alt: z.array(z.string()).optional(),
        optional: z.boolean().optional(),
      }),
    ),
  ),
  sessions: z.array(
    z.object({
      date: isoDate,
      day: z.string(),
      note: z.string().optional(),
      items: z.array(
        z.object({
          ex: z.string(),
          sets: z.array(seedSet).optional(),
          minutes: z.number().positive().optional(),
          note: z.string().optional(),
          confidence: confidence.optional(),
        }),
      ),
    }),
  ),
  dataQualityNotes: z.array(z.string()).default([]),
})
export type Seed = z.infer<typeof seedSchema>

// ---------- Backup (formato propio, ver docs/DATA_FORMAT.md) ----------

export const BACKUP_FORMAT = 'gym-backup'
export const BACKUP_VERSION = 1

const exercise = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string(),
  unit: z.enum(UNITS),
  barKg: z.number().optional(),
  sledKg: z.number().nullable().optional(),
  repsPerLeg: z.boolean().optional(),
  cardio: z.boolean().optional(),
  primary: z.array(muscle),
  secondary: z.array(muscle),
  range,
  increment: z.number().positive(),
  restSec: z.number().nonnegative(),
  warmup: z.enum(['heavy', 'light', 'none']),
  safetyNote: z.string().optional(),
  note: z.string().optional(),
  archived: z.boolean().optional(),
  /** Opcional (D-76): zonas que carga, corregidas a mano. */
  zones: z.array(z.enum(ZONES)).optional(),
})

const planDay = z.object({
  id: z.string(),
  name: z.string(),
  weekday: z.number().int().min(0).max(6),
  items: z.array(
    z.object({
      exerciseId: z.string(),
      sets: z.number().int().positive(),
      rangeOverride: range.optional(),
      alt: z.array(z.string()),
      optional: z.boolean().optional(),
    }),
  ),
})

const mesocycle = z.object({
  id: z.string(),
  startDate: isoDate,
  accumulationWeeks: z.number().int().min(3).max(8),
  deloadWeeks: z.number().int().min(0).max(2),
  deloadFrom: isoDate.optional(),
  status: z.enum(['active', 'finished']),
  notes: z.string(),
  phase: z.enum(['bulk', 'cut', 'maintain']).optional(),
  /** Opcional (D-73): la plantilla del bloque siguiente. */
  nextPlan: z.array(planDay).optional(),
})

const setEntry = z.object({
  id: z.string(),
  type: z.enum(['A', 'W']),
  weight: z.number().nullable(),
  reps: z.number().int().nonnegative().nullable(),
  minutes: z.number().positive().optional(),
  flag: z.enum(SET_FLAGS).optional(),
  repsBeforePause: z.number().int().nonnegative().optional(),
  rir: z.number().int().min(0).max(3).optional(),
  note: z.string().optional(),
  doneAt: z.number().nullable().optional(),
  restSec: z.number().int().nonnegative().optional(),
})

const session = z.object({
  id: z.string(),
  date: isoDate,
  planDayId: z.string(),
  mesocycleId: z.string().nullable(),
  readiness: z.object({ sleep: z.number().int().min(1).max(5), energy: z.number().int().min(1).max(5) }).optional(),
  deload: z.boolean().optional(),
  /** Opcional (D-74): sesión de vuelta tras una pausa, con los días sin entrenar al empezar. */
  comebackDays: z.number().int().min(1).optional(),
  short: z.boolean().optional(),
  note: z.string(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  status: z.enum(['in_progress', 'finished']),
  source: z.enum(['seed', 'app']),
  items: z.array(
    z.object({
      exerciseId: z.string(),
      note: z.string().optional(),
      sets: z.array(setEntry),
      skipped: z.boolean().optional(),
      swappedFrom: z.string().optional(),
      confidence: confidence.optional(),
      pain: z.enum(['molestia', 'dolor']).optional(),
      group: z.string().optional(),
    }),
  ),
  exerciseIds: z.array(z.string()),
})

const planAdjustment = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('swap'), planDayId: z.string(), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('sets'), planDayId: z.string(), exerciseId: z.string(), from: z.number().int().positive(), to: z.number().int().positive() }),
])

const zoneIssue = z.object({
  id: z.string(),
  zone: z.enum(ZONES),
  severity: z.enum(['molestia', 'dolor']),
  startedOn: isoDate,
  resolvedOn: isoDate.optional(),
  note: z.string().optional(),
  exerciseId: z.string().optional(),
  sessionId: z.string().optional(),
  /** Opcional (D-77): cambios al plan hechos por esta molestia, para poder deshacerlos. */
  planChanges: z.array(planAdjustment).optional(),
})

const bodyweight = z.object({ id: z.string(), date: isoDate, kg: z.number().min(20).max(400) })

const dayMark = z.object({ id: z.string(), date: isoDate, kind: z.literal('skipped'), planDayId: z.string() })

const pct = z.number().int().min(RULE_LIMITS.comebackLoadPct[0]).max(RULE_LIMITS.comebackLoadPct[1])

const settings = z.object({
  kgPerBrick: z.number().positive(),
  restSecOverrides: z.record(z.string(), z.number().nonnegative()),
  volumeTarget: z.record(muscle, z.tuple([z.number().nonnegative(), z.number().nonnegative()])),
  theme: z.enum(['dark', 'light']),
  lastBackupAt: z.number().nullable(),
  warmupRestSec: z.number().int().min(0).max(600).optional(),
  /** Opcional (D-78): reglas del motor que se cambiaron. */
  rules: z
    .object({
      comebackMinDays: z.number().int().min(RULE_LIMITS.comebackMinDays[0]).max(RULE_LIMITS.comebackMinDays[1]).optional(),
      comebackLoadPct: z.tuple([pct, pct, pct]).optional(),
      failureSessionMin: z.number().int().min(RULE_LIMITS.failureSessionMin[0]).max(RULE_LIMITS.failureSessionMin[1]).optional(),
      failureStreakMin: z.number().int().min(RULE_LIMITS.failureStreakMin[0]).max(RULE_LIMITS.failureStreakMin[1]).optional(),
      spikePct: z.number().int().min(RULE_LIMITS.spikePct[0]).max(RULE_LIMITS.spikePct[1]).optional(),
      spikeMinExtra: z.number().int().min(RULE_LIMITS.spikeMinExtra[0]).max(RULE_LIMITS.spikeMinExtra[1]).optional(),
      deloadMode: z.enum(DELOAD_MODES as [string, ...string[]]).optional(),
    })
    .optional(),
})

const dataQuality = z.object({ source: z.string(), notes: z.array(z.string()), importedAt: z.number() })

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number(),
  data: z.object({
    exercises: z.array(exercise),
    planDays: z.array(planDay),
    mesocycles: z.array(mesocycle),
    sessions: z.array(session),
    dayMarks: z.array(dayMark),
    /** Opcional (D-70): backups anteriores no lo traen. */
    bodyweights: z.array(bodyweight).optional(),
    /** Opcional (D-76): molestias por zona. */
    zoneIssues: z.array(zoneIssue).optional(),
    settings: settings.nullable(),
    dataQuality: dataQuality.nullable(),
  }),
})
export type Backup = z.infer<typeof backupSchema>
export type BackupData = Backup['data']
