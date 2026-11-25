import Dexie, { type EntityTable } from 'dexie'
import type { Bodyweight } from '../engine/bodyweight'
import type { DataQuality, Exercise, Mesocycle, PlanDay, Session, Settings, ZoneIssue } from '../engine/types'

export interface DayMark { id: string; date: string; kind: 'skipped'; planDayId: string }
export interface KV<T = unknown> { key: string; value: T }

export type GymDB = Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  planDays: EntityTable<PlanDay, 'id'>
  mesocycles: EntityTable<Mesocycle, 'id'>
  sessions: EntityTable<Session, 'id'>
  dayMarks: EntityTable<DayMark, 'id'>
  bodyweights: EntityTable<Bodyweight, 'id'>
  zoneIssues: EntityTable<ZoneIssue, 'id'>
  settings: EntityTable<KV<Settings>, 'key'>
  meta: EntityTable<KV, 'key'>
}

export const SETTINGS_KEY = 'app'
export const META_DATA_QUALITY = 'dataQuality'
export type MetaDataQuality = KV<DataQuality>

/** Última versión del esquema (la del último `db.version(n)` de abajo). Al agregar una migración, subir este número. */
export const SCHEMA_VERSION = 3

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
  // v2 (D-70): peso corporal opcional. Solo agrega una tabla: los datos de la v1 no se tocan.
  db.version(2).stores({ bodyweights: 'id, date' })
  // v3 (D-76): molestias por zona del cuerpo. Solo agrega una tabla: los datos anteriores no se tocan.
  db.version(3).stores({ zoneIssues: 'id, zone, startedOn' })
  return db
}

export const TABLES = ['exercises', 'planDays', 'mesocycles', 'sessions', 'dayMarks', 'bodyweights', 'zoneIssues', 'settings', 'meta'] as const

let instance: GymDB | null = null
export function getDB(): GymDB {
  instance ??= createDB()
  return instance
}
