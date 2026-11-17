import { weekStart, type ISODate } from '../engine/dates'
import { startDeloadNow } from '../engine/periodization'
import type { Mesocycle, PlanDay } from '../engine/types'
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
export async function startNextMesocycle(db: GymDB, prev: Mesocycle, start: ISODate, plan: PlanDay[] | null, notes = ''): Promise<Mesocycle> {
  const next: Mesocycle = {
    id: `meso-${start}`,
    startDate: start,
    accumulationWeeks: prev.accumulationWeeks,
    deloadWeeks: prev.deloadWeeks,
    status: 'active',
    notes,
  }
  await db.transaction('rw', db.mesocycles, db.planDays, async () => {
    await db.mesocycles.put({ ...prev, status: 'finished' })
    await db.mesocycles.put(next)
    if (plan) await db.planDays.bulkPut(plan)
  })
  return next
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

