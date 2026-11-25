import type { Exercise, PlanDay, PlanItem, Unit, Warmup } from './types'

/** Series con las que entra un ejercicio al plan. */
export const DEFAULT_PLAN_SETS = 3

/** Sube (-1) o baja (+1) un ejercicio dentro del día. Sin efecto en los extremos o si no está. */
export function moveItem(items: PlanItem[], exerciseId: string, dir: -1 | 1): PlanItem[] {
  const i = items.findIndex((x) => x.exerciseId === exerciseId)
  const j = i + dir
  if (i === -1 || j < 0 || j >= items.length) return items
  const out = [...items]
  ;[out[i], out[j]] = [out[j]!, out[i]!]
  return out
}

/** ¿Ya está en el día, como titular o como opción de otro ejercicio del día? Dos veces el mismo ejercicio en una sesión no tiene sentido. */
export function inDay(day: Pick<PlanDay, 'items'>, exerciseId: string): boolean {
  return day.items.some((i) => i.exerciseId === exerciseId || i.alt.includes(exerciseId))
}

/** Ejercicios que se pueden sumar a un día: los que no están archivados y no están ya en él, por nombre. */
export function addableExercises(day: Pick<PlanDay, 'items'>, exercises: Iterable<Exercise>): Exercise[] {
  return [...exercises].filter((e) => !e.archived && !inDay(day, e.id)).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Suma un ejercicio al final del día. Si ya está en otro día del plan, trae sus opciones y su rango: es el mismo
 * ejercicio en todos los días (D-67, D-81). Si ya está en el día, no hace nada.
 */
export function addPlanItem(planDays: PlanDay[], dayId: string, exerciseId: string, sets = DEFAULT_PLAN_SETS): PlanDay[] {
  const day = planDays.find((d) => d.id === dayId)
  if (!day || inDay(day, exerciseId)) return planDays
  const same = planDays.flatMap((d) => d.items).find((i) => i.exerciseId === exerciseId)
  const item: PlanItem = { exerciseId, sets, alt: same ? [...same.alt] : [], ...(same?.rangeOverride ? { rangeOverride: same.rangeOverride } : {}) }
  return planDays.map((d) => (d.id === dayId ? { ...d, items: [...d.items, item] } : d))
}

/** Saca un ejercicio del día. Un día se queda al menos con uno. */
export function removePlanItem(planDays: PlanDay[], dayId: string, exerciseId: string): PlanDay[] {
  return planDays.map((d) => (d.id === dayId && d.items.length > 1 ? { ...d, items: d.items.filter((i) => i.exerciseId !== exerciseId) } : d))
}

// ---------- Ejercicio nuevo ----------

export interface NewExerciseInput {
  id: string
  name: string
  /** Vacío = familia propia (solo este ejercicio). */
  family: string
  unit: Unit
  range: [number, number]
  increment: number
  restSec: number
  warmup: Warmup
  primary: Exercise['primary']
}

/** Valores de arranque por unidad (pautas mías, no validadas). Todo se puede cambiar en Ejercicios. */
export const UNIT_DEFAULTS: Record<Unit, { range: [number, number]; increment: number; restSec: number; warmup: Warmup }> = {
  per_side: { range: [6, 10], increment: 2.5, restSec: 150, warmup: 'heavy' },
  per_hand: { range: [8, 12], increment: 2.5, restSec: 120, warmup: 'light' },
  total: { range: [10, 15], increment: 2.5, restSec: 90, warmup: 'light' },
  bricks: { range: [10, 15], increment: 1, restSec: 90, warmup: 'light' },
  minutes: { range: [10, 30], increment: 5, restSec: 0, warmup: 'none' },
}

/** Nombre, rango e incremento válidos y, salvo en cardio, al menos un músculo primario (si no, no suma a ningún volumen). */
export function validNewExercise(i: Pick<NewExerciseInput, 'name' | 'range' | 'increment' | 'unit' | 'primary'>): boolean {
  return !!i.name.trim() && i.range[0] >= 1 && i.range[0] <= i.range[1] && i.increment > 0 && (i.unit === 'minutes' || i.primary.length > 0)
}

export function buildExercise(i: NewExerciseInput): Exercise {
  const cardio = i.unit === 'minutes'
  return {
    id: i.id,
    name: i.name.trim(),
    family: i.family.trim() || i.id,
    unit: i.unit,
    ...(cardio ? { cardio: true } : {}),
    primary: cardio ? [] : i.primary,
    secondary: [],
    range: i.range,
    increment: i.increment,
    restSec: i.restSec,
    warmup: cardio ? 'none' : i.warmup,
  }
}
