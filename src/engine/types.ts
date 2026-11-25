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

/** Zonas del cuerpo para anotar molestias (D-76). El catálogo de músculos no tiene cuello ni antebrazo: la relación con los ejercicios es aproximada y se corrige a mano. */
export const ZONES = ['neck', 'shoulder', 'elbow', 'wrist', 'upper_back', 'lower_back', 'hip', 'knee', 'ankle'] as const
export type Zone = (typeof ZONES)[number]

export const ZONE_LABELS: Record<Zone, string> = {
  neck: 'Cuello', shoulder: 'Hombro', elbow: 'Codo', wrist: 'Muñeca', upper_back: 'Espalda alta',
  lower_back: 'Lumbar', hip: 'Cadera', knee: 'Rodilla', ankle: 'Tobillo',
}

export type PainLevel = 'molestia' | 'dolor'

/** Molestia de una zona, anotada suelta o desde un ejercicio. Activa mientras no tenga `resolvedOn`. */
export interface ZoneIssue {
  id: string
  zone: Zone
  severity: PainLevel
  startedOn: ISODate
  resolvedOn?: ISODate
  note?: string
  /** Ejercicio y sesión desde donde se marcó, si vino de ahí. */
  exerciseId?: string
  sessionId?: string
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
  /** Zonas que carga, si se corrigieron a mano (D-76). Sin el campo se deducen de los músculos. */
  zones?: Zone[]
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

/** Fase del mesociclo (D-69), declarada por el usuario: la app no conoce el peso corporal ni las calorías. Sin campo = sin definir. */
export type Phase = 'bulk' | 'cut' | 'maintain'

export interface Mesocycle {
  id: string
  startDate: ISODate
  accumulationWeeks: number
  deloadWeeks: number
  /** Deload adelantado: lunes de la semana en que empieza (reemplaza el cálculo por accumulationWeeks). */
  deloadFrom?: ISODate
  status: 'active' | 'finished'
  notes: string
  phase?: Phase
  /** Plantilla del bloque siguiente, preparada de antemano (D-73): copia editable del plan que se aplica al empezarlo. */
  nextPlan?: PlanDay[]
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
  /** Molestia o dolor que hubo en este ejercicio (D-52). */
  pain?: 'molestia' | 'dolor'
  /** Superserie (D-66): los ejercicios con el mismo id se hacen juntos, en rondas. Sin campo = ejercicio suelto. */
  group?: string
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
  /** Sesión de vuelta tras una pausa (D-74): los días sin entrenar al empezar. Menos series y carga; no es base de progresión. */
  comebackDays?: number
  /** Se empezó con "poco tiempo hoy": sin ejercicios opcionales (D-53). */
  short?: boolean
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
  /** Descanso entre aproximaciones (s); 0 = sin temporizador. Sin campo = el de por defecto (D-71). */
  warmupRestSec?: number
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
