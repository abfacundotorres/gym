import { checkIntegrity, MAX_DETAIL, type Finding } from '../engine/integrity'
import { readStorageState, type StorageState } from '../lib/storage'
import { exportBackup, readAll } from './backup'
import { SCHEMA_VERSION, SETTINGS_KEY, TABLES, type GymDB } from './db'
import { backupSchema } from './schemas'
import { listSnapshots } from './safety'

export interface DiagnosticReport {
  /** Versión del esquema que tiene la base abierta, y la que espera esta versión de la app. */
  schemaVersion: number
  expectedSchemaVersion: number
  counts: Record<(typeof TABLES)[number], number>
  findings: Finding[]
  storage: StorageState
  autoCopies: number
  lastBackupAt: number | null
}

/** Lee la base y la revisa (D-84). Solo lectura. */
export async function diagnose(db: GymDB): Promise<DiagnosticReport> {
  const data = await readAll(db)
  const findings = checkIntegrity({ exercises: data.exercises, planDays: data.planDays, mesocycles: data.mesocycles, sessions: data.sessions })

  // Lo mismo que se exporta tiene que poder volver a importarse: si el formato no cierra, el backup de hoy no sirve mañana.
  const parsed = backupSchema.safeParse(await exportBackup(db))
  if (!parsed.success) {
    const cases = parsed.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
    findings.unshift({ code: 'formato', severity: 'error', message: 'Los datos no cumplen el formato del backup (exportar o importar puede fallar)', detail: cases.slice(0, MAX_DETAIL), count: cases.length })
  }

  const counts = {} as DiagnosticReport['counts']
  for (const t of TABLES) counts[t] = await db.table(t).count()
  return {
    schemaVersion: db.verno,
    expectedSchemaVersion: SCHEMA_VERSION,
    counts,
    findings,
    storage: await readStorageState().catch((): StorageState => ({ persisted: null, usageBytes: null, installed: false })),
    autoCopies: (await listSnapshots().catch(() => [])).length,
    lastBackupAt: (await db.settings.get(SETTINGS_KEY))?.value.lastBackupAt ?? null,
  }
}

/** Texto para pegar al avisar de un problema: versiones, cantidades y hallazgos. Sin pesos, reps ni notas. */
export function diagnosticText(r: DiagnosticReport, app: { commit: string; builtAt: string }): string {
  const lines = [
    `App ${app.commit} (${app.builtAt})`,
    `Base: esquema v${r.schemaVersion} (esperado v${r.expectedSchemaVersion})`,
    `Registros: ${Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `Almacenamiento: ${r.storage.persisted === null ? 'no informa' : r.storage.persisted ? 'protegido' : 'sin proteger'}${r.storage.installed ? ', instalada' : ', en el navegador'}`,
    `Copias automáticas: ${r.autoCopies}`,
  ]
  if (!r.findings.length) lines.push('Chequeo: todo en orden')
  for (const f of r.findings) {
    lines.push(`${f.severity === 'error' ? 'ERROR' : 'Aviso'} ${f.code} (${f.count}): ${f.message}`)
    for (const d of f.detail) lines.push(`  - ${d}`)
    if (f.count > f.detail.length) lines.push(`  … y ${f.count - f.detail.length} más`)
  }
  return lines.join('\n')
}
