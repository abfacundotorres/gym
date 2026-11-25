import { weekStart, type ISODate } from '../engine/dates'
import { startDeloadNow } from '../engine/periodization'
import { addPlanItem, moveItem, removePlanItem } from '../engine/planEdit'
import type { Mesocycle, Phase, PlanDay } from '../engine/types'
import type { GymDB } from './db'

export const META_DELOAD_DISMISSED = 'deloadDismissedWeek'

export async function activeMesocycle(db: GymDB): Promise<Mesocycle | undefined> {
  return db.mesocycles.where('status').equals('active').first()
}

export async function saveMesocycle(db: GymDB, meso: Mesocycle): Promise<void> {
  await db.mesocycles.put(meso)
}

export async function deloadThisWeek(db: GymDB, meso: Mesocycle, today: ISODate): Promise<void> {
  await db.mesocycles.put(startDeloadNow(meso, today))
}

/** Cierra el mesociclo actual, aplica el plan nuevo y abre el siguiente. */
export async function startNextMesocycle(db: GymDB, prev: Mesocycle, start: ISODate, plan: PlanDay[] | null, notes = '', phase: Phase | null = prev.phase ?? null): Promise<Mesocycle> {
  const next: Mesocycle = {
    id: `meso-${start}`,
    startDate: start,
    accumulationWeeks: prev.accumulationWeeks,
    deloadWeeks: prev.deloadWeeks,
    status: 'active',
    notes,
    ...(phase ? { phase } : {}),
  }
  await db.transaction('rw', db.mesocycles, db.planDays, async () => {
    // La plantilla del bloque que se cierra ya se aplicó (o se descartó): no queda en el historial.
    const { nextPlan: _applied, ...closed } = prev
    await db.mesocycles.put({ ...closed, status: 'finished' })
    await db.mesocycles.put(next)
    if (plan) await db.planDays.bulkPut(plan)
  })
  return next
}

/** Guarda (o, con null, descarta) la plantilla del bloque siguiente en el mesociclo activo (D-73). */
export async function saveNextPlan(db: GymDB, mesoId: string, plan: PlanDay[] | null): Promise<void> {
  await db.transaction('rw', db.mesocycles, async () => {
    const m = await db.mesocycles.get(mesoId)
    if (!m || m.status !== 'active') return
    const { nextPlan: _old, ...rest } = m
    await db.mesocycles.put(plan ? { ...rest, nextPlan: plan } : rest)
  })
}

export async function createFirstMesocycle(db: GymDB, today: ISODate): Promise<Mesocycle> {
  const m: Mesocycle = { id: `meso-${weekStart(today)}`, startDate: weekStart(today), accumulationWeeks: 5, deloadWeeks: 1, status: 'active', notes: '' }
  await db.mesocycles.put(m)
  return m
}

export async function setPlanItemSets(db: GymDB, planDayId: string, exerciseId: string, sets: number): Promise<void> {
  await db.transaction('rw', db.planDays, async () => {
    const d = await db.planDays.get(planDayId)
    if (!d) return
    await db.planDays.put({ ...d, items: d.items.map((i) => (i.exerciseId === exerciseId ? { ...i, sets } : i)) })
  })
}

/**
 * Agrega o quita una opción (variante) a un ejercicio del plan, en todos los días donde aparece: es el mismo ejercicio,
 * y las opciones son las que se ofrecen para elegir en cada sesión (D-67).
 */
export async function setPlanAlt(db: GymDB, exerciseId: string, altId: string, on: boolean): Promise<void> {
  if (altId === exerciseId) return
  await db.transaction('rw', db.planDays, async () => {
    for (const d of await db.planDays.toArray()) {
      if (!d.items.some((i) => i.exerciseId === exerciseId)) continue
      const items = d.items.map((i) => {
        if (i.exerciseId !== exerciseId) return i
        const alt = on ? (i.alt.includes(altId) ? i.alt : [...i.alt, altId]) : i.alt.filter((a) => a !== altId)
        return { ...i, alt }
      })
      await db.planDays.put({ ...d, items })
    }
  })
}

export async function toggleSkipped(db: GymDB, date: ISODate, planDayId: string): Promise<void> {
  const id = `skip-${date}`
  if (await db.dayMarks.get(id)) await db.dayMarks.delete(id)
  else await db.dayMarks.put({ id, date, kind: 'skipped', planDayId })
}

export async function dismissDeloadSuggestion(db: GymDB, today: ISODate): Promise<void> {
  await db.meta.put({ key: META_DELOAD_DISMISSED, value: weekStart(today) })
}


/**
 * Cambia (o, con null, quita) el rango de reps del plan para un ejercicio, en todos los días donde aparece (D-81). Sin rango del plan
 * rige el del ejercicio. Es la misma idea que las variantes: es el mismo ejercicio en todos los días.
 */
export async function setRangeOverride(db: GymDB, exerciseId: string, range: [number, number] | null): Promise<void> {
  await db.transaction('rw', db.planDays, async () => {
    for (const d of await db.planDays.toArray()) {
      if (!d.items.some((i) => i.exerciseId === exerciseId)) continue
      const items = d.items.map((i) => {
        if (i.exerciseId !== exerciseId) return i
        const { rangeOverride: _old, ...rest } = i
        return range ? { ...rest, rangeOverride: range } : rest
      })
      await db.planDays.put({ ...d, items })
    }
  })
}

/** Cambios al plan de hoy (D-83): sumar, sacar y reordenar ejercicios de un día. Usan las funciones puras de `engine/planEdit`. */
async function editDay(db: GymDB, dayId: string, f: (days: PlanDay[]) => PlanDay[]): Promise<void> {
  await db.transaction('rw', db.planDays, async () => {
    const before = await db.planDays.toArray()
    const after = f(before)
    const next = after.find((d) => d.id === dayId)
    if (next && JSON.stringify(next) !== JSON.stringify(before.find((d) => d.id === dayId))) await db.planDays.put(next)
  })
}

export const addExerciseToDay = (db: GymDB, dayId: string, exerciseId: string) => editDay(db, dayId, (days) => addPlanItem(days, dayId, exerciseId))
export const removeExerciseFromDay = (db: GymDB, dayId: string, exerciseId: string) => editDay(db, dayId, (days) => removePlanItem(days, dayId, exerciseId))
export const moveExerciseInDay = (db: GymDB, dayId: string, exerciseId: string, dir: -1 | 1) =>
  editDay(db, dayId, (days) => days.map((d) => (d.id === dayId ? { ...d, items: moveItem(d.items, exerciseId, dir) } : d)))
