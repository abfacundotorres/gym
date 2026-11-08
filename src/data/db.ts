import Dexie, { type EntityTable } from 'dexie'
import type { DataQuality, Exercise, Mesocycle, PlanDay, Session, Settings } from '../engine/types'

export interface DayMark { id: string; date: string; kind: 'skipped'; planDayId: string }
export interface KV<T = unknown> { key: string; value: T }

export type GymDB = Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  planDays: EntityTable<PlanDay, 'id'>
  mesocycles: EntityTable<Mesocycle, 'id'>
  sessions: EntityTable<Session, 'id'>
  dayMarks: EntityTable<DayMark, 'id'>
  settings: EntityTable<KV<Settings>, 'key'>
  meta: EntityTable<KV, 'key'>
}

export const SETTINGS_KEY = 'app'
export const META_DATA_QUALITY = 'dataQuality'
export type MetaDataQuality = KV<DataQuality>

export function createDB(name = 'gym'): GymDB {
  const db = new Dexie(name) as GymDB
  // Migraciones: agregar db.version(n) nuevas, nunca editar las existentes.
  db.version(1).stores({
    exercises: 'id, family, archived',
    planDays: 'id, weekday',
    mesocycles: 'id, startDate, status',
    sessions: 'id, date, planDayId, mesocycleId, status, *exerciseIds',
    dayMarks: 'id, date',
    settings: 'key',
    meta: 'key',
  })
  return db
}

export const TABLES = ['exercises', 'planDays', 'mesocycles', 'sessions', 'dayMarks', 'settings', 'meta'] as const

let instance: GymDB | null = null
export function getDB(): GymDB {
  instance ??= createDB()
  return instance
}
