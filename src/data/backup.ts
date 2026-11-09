import { z } from 'zod'
import { defaultSettings, type Settings } from '../engine/types'
import { META_DATA_QUALITY, SETTINGS_KEY, type GymDB } from './db'
import { BACKUP_FORMAT, BACKUP_VERSION, backupSchema, seedSchema, type Backup, type BackupData } from './schemas'
import { seedToData } from './seedImport'

// ---------- Export ----------

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export async function readAll(db: GymDB): Promise<BackupData> {
  const [exercises, planDays, mesocycles, sessions, dayMarks, settings, dq] = await Promise.all([
    db.exercises.toArray(),
    db.planDays.toArray(),
    db.mesocycles.toArray(),
    db.sessions.toArray(),
    db.dayMarks.toArray(),
    db.settings.get(SETTINGS_KEY),
    db.meta.get(META_DATA_QUALITY),
  ])
  return {
    exercises: exercises.sort(byId),
    planDays: planDays.sort(byId),
    mesocycles: mesocycles.sort(byId),
    sessions: sessions.sort(byId),
    dayMarks: dayMarks.sort(byId),
    settings: settings?.value ?? null,
    dataQuality: (dq?.value as BackupData['dataQuality']) ?? null,
  }
}

export async function exportBackup(db: GymDB, now = Date.now()): Promise<Backup> {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, data: await readAll(db) }
}

// ---------- Parse ----------

export type ParsedImport =
  | { ok: true; kind: 'backup' | 'seed'; data: BackupData }
  | { ok: false; error: string }

function issues(err: z.ZodError): string {
  return err.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
    .join('\n')
}

export function parseImportText(text: string, now = Date.now()): ParsedImport {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' }
  }
  if (raw && typeof raw === 'object' && 'format' in raw) {
    const r = backupSchema.safeParse(raw)
    return r.success ? { ok: true, kind: 'backup', data: r.data.data } : { ok: false, error: issues(r.error) }
  }
  const r = seedSchema.safeParse(raw)
  if (!r.success) return { ok: false, error: issues(r.error) }
  try {
    return { ok: true, kind: 'seed', data: seedToData(r.data, now) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// ---------- Preview + apply ----------

export type ImportMode = 'replace' | 'merge'
export interface CollectionDiff { added: number; updated: number; unchanged: number; removed: number }
export type ImportPreview = Record<'exercises' | 'planDays' | 'mesocycles' | 'sessions' | 'dayMarks', CollectionDiff> & {
  settings: 'keep' | 'replace' | 'none'
}

/** JSON con claves ordenadas: para comparar registros sin depender del orden de propiedades. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

function diff<T extends { id: string }>(current: T[], incoming: T[], mode: ImportMode): CollectionDiff {
  const cur = new Map(current.map((x) => [x.id, stableStringify(x)]))
  const inc = new Set(incoming.map((x) => x.id))
  const d: CollectionDiff = { added: 0, updated: 0, unchanged: 0, removed: 0 }
  for (const x of incoming) {
    const c = cur.get(x.id)
    if (c === undefined) d.added++
    else if (c === stableStringify(x)) d.unchanged++
    else d.updated++
  }
  if (mode === 'replace') for (const id of cur.keys()) if (!inc.has(id)) d.removed++
  return d
}

export async function previewImport(db: GymDB, data: BackupData, mode: ImportMode): Promise<ImportPreview> {
  const cur = await readAll(db)
  return {
    exercises: diff(cur.exercises, data.exercises, mode),
    planDays: diff(cur.planDays, data.planDays, mode),
    mesocycles: diff(cur.mesocycles, data.mesocycles, mode),
    sessions: diff(cur.sessions, data.sessions, mode),
    dayMarks: diff(cur.dayMarks, data.dayMarks, mode),
    settings: data.settings ? 'replace' : cur.settings ? 'keep' : 'none',
  }
}

/** replace: borra todo y carga lo importado. merge: upsert por id (gana lo importado), no borra nada. */
export async function applyImport(db: GymDB, data: BackupData, mode: ImportMode): Promise<void> {
  await db.transaction('rw', [db.exercises, db.planDays, db.mesocycles, db.sessions, db.dayMarks, db.settings, db.meta], async () => {
    if (mode === 'replace') {
      await Promise.all([db.exercises.clear(), db.planDays.clear(), db.mesocycles.clear(), db.sessions.clear(), db.dayMarks.clear(), db.settings.clear(), db.meta.clear()])
    }
    await db.exercises.bulkPut(data.exercises)
    await db.planDays.bulkPut(data.planDays)
    await db.mesocycles.bulkPut(data.mesocycles)
    await db.sessions.bulkPut(data.sessions)
    await db.dayMarks.bulkPut(data.dayMarks)
    if (data.settings) await db.settings.put({ key: SETTINGS_KEY, value: data.settings as Settings })
    if (data.dataQuality) await db.meta.put({ key: META_DATA_QUALITY, value: data.dataQuality })
  })
}

// ---------- Settings helpers ----------

export async function getSettings(db: GymDB): Promise<Settings> {
  return (await db.settings.get(SETTINGS_KEY))?.value ?? defaultSettings()
}

export async function markBackupDone(db: GymDB, now = Date.now()): Promise<void> {
  const s = await getSettings(db)
  await db.settings.put({ key: SETTINGS_KEY, value: { ...s, lastBackupAt: now } })
}

/** Aviso: pasaron más de 7 días desde el último backup y hay sesiones nuevas desde entonces. */
export function needsBackupReminder(lastBackupAt: number | null, sessionTimes: number[], now = Date.now()): boolean {
  const WEEK = 7 * 86_400_000
  if (lastBackupAt == null) return sessionTimes.length > 0
  return now - lastBackupAt > WEEK && sessionTimes.some((t) => t > lastBackupAt)
}

// ---------- CSV ----------

const CSV_COLUMNS = [
  'fecha', 'dia', 'sesion_id', 'ejercicio_id', 'ejercicio', 'unidad', 'serie', 'tipo', 'peso', 'reps',
  'minutos', 'marca', 'reps_antes_pausa', 'rir', 'descanso_s', 'confianza', 'molestia', 'nota',
] as const

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(data: BackupData): string {
  const ex = new Map(data.exercises.map((e) => [e.id, e]))
  const rows: string[] = [CSV_COLUMNS.join(',')]
  const sessions = [...data.sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : byId(a, b)))
  for (const s of sessions) {
    for (const it of s.items) {
      const e = ex.get(it.exerciseId)
      it.sets.forEach((set, i) => {
        rows.push(
          [
            s.date, s.planDayId, s.id, it.exerciseId, e?.name, e?.unit, i + 1, set.type, set.weight, set.reps,
            set.minutes, set.flag, set.repsBeforePause, set.rir, set.restSec, it.confidence ?? 'alta', it.pain, set.note ?? it.note,
          ].map(csvCell).join(','),
        )
      })
    }
  }
  return rows.join('\n') + '\n'
}
