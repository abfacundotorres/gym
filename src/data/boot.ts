import type { Backup } from './schemas'
import { getDB } from './db'
import { readRawBackup, snapshotBeforeMigration, type SnapshotResult } from './safety'

export type BootResult =
  | { ok: true }
  | {
      ok: false
      /** 'snapshot': no se pudo guardar la copia previa (la base abrió bien). 'open': la base no abrió. */
      reason: 'snapshot' | 'open'
      error: string
      /** Copia de lo que hay, para descargar. null si no se pudo leer. */
      backup: Backup | null
    }

/**
 * Arranque de la base (D-82): copia previa a la migración, y abrirla ya para saber si migró bien antes de dibujar pantallas.
 * Si algo falla, devuelve el motivo en vez de dejar la app andando sobre una base que no abre. No tira nunca.
 */
export async function bootDatabase(now = Date.now()): Promise<BootResult> {
  const snap: SnapshotResult = await snapshotBeforeMigration(now)
  try {
    await getDB().open()
  } catch (e) {
    const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    const backup = snap.status === 'saved' ? snap.snapshot.backup : snap.status === 'failed' && snap.backup ? snap.backup : await readRawBackup().catch(() => null)
    return { ok: false, reason: 'open', error, backup }
  }
  if (snap.status === 'failed') return { ok: false, reason: 'snapshot', error: snap.error, backup: snap.backup }
  return { ok: true }
}
