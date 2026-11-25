import Dexie, { type EntityTable } from 'dexie'
import { META_DATA_QUALITY, SCHEMA_VERSION, SETTINGS_KEY } from './db'
import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from './schemas'

/**
 * Red de seguridad (D-82): antes de que Dexie migre la base `gym` a una versión nueva se guarda una copia de lo que hay,
 * en otra base (`gym-safety`), para no tocar la clave ni el origen de los datos. La copia se lee **sin migrar**
 * (IndexedDB crudo), así que no depende de que el esquema nuevo ande.
 */
export const SAFETY_DB_NAME = 'gym-safety'
export const MAX_SNAPSHOTS = 2

export interface Snapshot {
  id: string
  takenAt: number
  /** Versión de esquema de la base cuando se copió, y a la que iba a pasar. */
  fromVersion: number
  toVersion: number
  sessions: number
  /** Mismo formato que "Exportar JSON": se puede importar tal cual. */
  backup: Backup
}

type SafetyDB = Dexie & { snapshots: EntityTable<Snapshot, 'id'> }
function openSafety(name: string): SafetyDB {
  const db = new Dexie(name) as SafetyDB
  db.version(1).stores({ snapshots: 'id, takenAt' })
  return db
}

/** Abre la base sin migrarla. Devuelve null si no existe (instalación nueva): no la crea. */
function openExisting(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    let absent = false
    req.onupgradeneeded = (e) => {
      if (e.oldVersion === 0) {
        absent = true
        req.transaction?.abort() // no dejar una base vacía creada por mirar
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => {
      if (absent) {
        e.preventDefault()
        resolve(null)
      } else reject(req.error)
    }
  })
}

function dumpStores(idb: IDBDatabase): Promise<Record<string, unknown[]>> {
  return new Promise((resolve, reject) => {
    const names = Array.from(idb.objectStoreNames)
    const out: Record<string, unknown[]> = {}
    if (!names.length) return resolve(out)
    const tx = idb.transaction(names, 'readonly')
    for (const n of names) {
      const r = tx.objectStore(n).getAll()
      r.onsuccess = () => { out[n] = r.result }
    }
    tx.oncomplete = () => resolve(out)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/** Las tablas crudas, en el formato del backup. Las tablas que la versión vieja no tenía quedan vacías. */
export function storesToBackup(stores: Record<string, unknown[]>, now: number): Backup {
  const rows = (n: string) => ((stores[n] ?? []) as { id: string }[]).slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const kv = (n: string, key: string) => ((stores[n] ?? []) as { key: string; value: unknown }[]).find((r) => r.key === key)?.value ?? null
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    data: {
      exercises: rows('exercises') as Backup['data']['exercises'],
      planDays: rows('planDays') as Backup['data']['planDays'],
      mesocycles: rows('mesocycles') as Backup['data']['mesocycles'],
      sessions: rows('sessions') as Backup['data']['sessions'],
      dayMarks: rows('dayMarks') as Backup['data']['dayMarks'],
      bodyweights: rows('bodyweights') as Backup['data']['bodyweights'],
      zoneIssues: rows('zoneIssues') as Backup['data']['zoneIssues'],
      settings: kv('settings', SETTINGS_KEY) as Backup['data']['settings'],
      dataQuality: kv('meta', META_DATA_QUALITY) as Backup['data']['dataQuality'],
    },
  }
}

/** Versión de esquema de Dexie de una conexión cruda (Dexie guarda la versión × 10). */
const schemaVersionOf = (idb: IDBDatabase) => Math.floor(idb.version / 10)

/** Copia cruda de la base tal como está (sin migrar), o null si no existe. Para el rescate cuando la base no abre. */
export async function readRawBackup(name = 'gym', now = Date.now()): Promise<Backup | null> {
  const idb = await openExisting(name)
  if (!idb) return null
  try {
    return storesToBackup(await dumpStores(idb), now)
  } finally {
    idb.close()
  }
}

export type SnapshotResult =
  | { status: 'none' } // nada que migrar: instalación nueva o base ya en la última versión
  | { status: 'saved'; snapshot: Snapshot }
  | { status: 'failed'; error: string; backup: Backup | null }

/** Si la base `gym` está en un esquema anterior al actual, guarda una copia antes de que se migre. Llamar antes del primer uso de la base. */
export async function snapshotBeforeMigration(now = Date.now(), name = 'gym', safetyName = SAFETY_DB_NAME): Promise<SnapshotResult> {
  let backup: Backup | null = null
  try {
    const idb = await openExisting(name)
    if (!idb) return { status: 'none' }
    const from = schemaVersionOf(idb)
    try {
      if (from >= SCHEMA_VERSION) return { status: 'none' }
      backup = storesToBackup(await dumpStores(idb), now)
    } finally {
      idb.close() // si queda abierta, la migración espera a que se cierre
    }
    const snapshot: Snapshot = { id: `v${from}-${now}`, takenAt: now, fromVersion: from, toVersion: SCHEMA_VERSION, sessions: backup.data.sessions.length, backup }
    const safety = openSafety(safetyName)
    try {
      await safety.snapshots.put(snapshot)
      const all = await safety.snapshots.orderBy('takenAt').reverse().primaryKeys()
      await safety.snapshots.bulkDelete(all.slice(MAX_SNAPSHOTS))
    } finally {
      safety.close()
    }
    return { status: 'saved', snapshot }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e), backup }
  }
}

export async function listSnapshots(safetyName = SAFETY_DB_NAME): Promise<Snapshot[]> {
  if (!(await Dexie.exists(safetyName))) return []
  const safety = openSafety(safetyName)
  try {
    return await safety.snapshots.orderBy('takenAt').reverse().toArray()
  } finally {
    safety.close()
  }
}

export async function deleteSnapshot(id: string, safetyName = SAFETY_DB_NAME): Promise<void> {
  const safety = openSafety(safetyName)
  try {
    await safety.snapshots.delete(id)
  } finally {
    safety.close()
  }
}
