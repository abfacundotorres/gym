// Tipos de dominio compartidos por el motor, la capa de datos y la UI.
import type { ISODate } from './dates'

export const MUSCLES = [
  'chest', 'lats', 'upper_back', 'delt_front', 'delt_side', 'delt_rear', 'biceps',
  'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'lower_back',
] as const
export type Muscle = (typeof MUSCLES)[number]

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Pecho', lats: 'Dorsales', upper_back: 'Espalda alta', delt_front: 'Deltoide anterior',
  delt_side: 'Deltoide lateral', delt_rear: 'Deltoide posterior', biceps: 'Bíceps', triceps: 'Tríceps',
  quads: 'Cuádriceps', hamstrings: 'Isquios', glutes: 'Glúteos', calves: 'Gemelos', lower_back: 'Lumbar',
}

export const UNITS = ['per_side', 'per_hand', 'total', 'bricks', 'minutes'] as const
export type Unit = (typeof UNITS)[number]

export const SET_FLAGS = ['rp', 'drop', 'rebote', 'asist'] as const
export type SetFlag = (typeof SET_FLAGS)[number]

export type Confidence = 'alta' | 'media' | 'baja'
export type Warmup = 'heavy' | 'light' | 'none'

export interface Exercise {
  id: string
  name: string
  family: string
  unit: Unit
  barKg?: number
  sledKg?: number | null
  repsPerLeg?: boolean
  cardio?: boolean
  primary: Muscle[]
  secondary: Muscle[]
  range: [number, number]
  increment: number
  restSec: number
  warmup: Warmup
  safetyNote?: string
  note?: string
  archived?: boolean
}

export interface PlanItem {
  exerciseId: string
  sets: number
  rangeOverride?: [number, number]
  alt: string[]
  optional?: boolean
}

export interface PlanDay {
  id: string
  name: string
  /** 0 = domingo … 6 = sábado */
  weekday: number
  items: PlanItem[]
}

export interface Mesocycle {
  id: string
  startDate: ISODate
  accumulationWeeks: number
  deloadWeeks: number
  /** Deload adelantado: lunes de la semana en que empieza (reemplaza el cálculo por accumulationWeeks). */
  deloadFrom?: ISODate
  status: 'active' | 'finished'
  notes: string
}

export interface SetEntry {
  id: string
  type: 'A' | 'W'
  weight: number | null
  reps: number | null
  /** Solo cardio (unit = minutes). */
  minutes?: number
  flag?: SetFlag
  /** Con flag 'rp': reps antes de la primera pausa. */
  repsBeforePause?: number
  rir?: number
  note?: string
  /** ms epoch; null en datos importados. */
  doneAt?: number | null
  /** Descanso real (s) desde la serie anterior del mismo ejercicio (D-44). */
  restSec?: number
}

export interface SessionItem {
  exerciseId: string
  note?: string
  sets: SetEntry[]
  skipped?: boolean
  swappedFrom?: string
  /** Sin campo = alta. */
  confidence?: Confidence
}

export interface Readiness { sleep: number; energy: number }

export interface Session {
  id: string
  date: ISODate
  planDayId: string
  mesocycleId: string | null
  readiness?: Readiness
  /** La sesión se hizo en semana de deload (se fija al empezar). */
  deload?: boolean
  note: string
  startedAt: number | null
  finishedAt: number | null
  status: 'in_progress' | 'finished'
  source: 'seed' | 'app'
  items: SessionItem[]
  /** Derivado de items (índice multiEntry). */
  exerciseIds: string[]
}

export interface Settings {
  kgPerBrick: number
  /** Overrides por ejercicio; si falta, se usa el del ejercicio. */
  restSecOverrides: Record<string, number>
  volumeTarget: Record<Muscle, [number, number]>
  theme: 'dark' | 'light'
  lastBackupAt: number | null
}

export function defaultSettings(): Settings {
  const volumeTarget = {} as Record<Muscle, [number, number]>
  for (const m of MUSCLES) volumeTarget[m] = [10, 20]
  return { kgPerBrick: 4.2, restSecOverrides: {}, volumeTarget, theme: 'dark', lastBackupAt: null }
}

export interface DataQuality {
  source: string
  notes: string[]
  importedAt: number
}
