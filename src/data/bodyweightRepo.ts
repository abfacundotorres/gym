import { bodyweightId, parseKg } from '../engine/bodyweight'
import type { ISODate } from '../engine/dates'
import type { GymDB } from './db'

/** Guarda el peso de un día (uno por día: volver a guardar ese día lo reemplaza). Devuelve false si el valor no es válido. */
export async function saveBodyweight(db: GymDB, date: ISODate, text: string): Promise<boolean> {
  const kg = parseKg(text)
  if (kg == null) return false
  await db.bodyweights.put({ id: bodyweightId(date), date, kg })
  return true
}

export async function deleteBodyweight(db: GymDB, date: ISODate): Promise<void> {
  await db.bodyweights.delete(bodyweightId(date))
}
