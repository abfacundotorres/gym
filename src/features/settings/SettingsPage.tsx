import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { exportBackup, markBackupDone, toCSV } from '../../data/backup'
import { getDB, META_DATA_QUALITY, SETTINGS_KEY } from '../../data/db'
import type { DataQuality } from '../../engine/types'
import { formatDDMM } from '../../engine/dates'
import { canShareFiles, downloadText, shareTextFile } from '../../lib/download'
import { fileStamp, formatTimestamp } from '../../lib/format'
import { Button, Card } from '../../ui/Button'
import { ImportFlow } from './ImportFlow'
import { VolumeTargets } from './VolumeTargets'
import { About } from './About'
import { StorageStatus } from './StorageStatus'
import { Preferences } from './Preferences'
import { Link } from 'react-router'

export function SettingsPage() {
  const db = getDB()
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_KEY))
  const dq = useLiveQuery(() => db.meta.get(META_DATA_QUALITY))
  const flagged = useLiveQuery(async () => {
    const [sessions, exercises] = await Promise.all([db.sessions.orderBy('date').toArray(), db.exercises.toArray()])
    const names = new Map(exercises.map((e) => [e.id, e.name]))
    return sessions.flatMap((s) =>
      s.items
        .filter((i) => i.confidence === 'baja' || i.confidence === 'media')
        .map((i) => ({ key: `${s.id}-${i.exerciseId}`, date: s.date, name: names.get(i.exerciseId) ?? i.exerciseId, confidence: i.confidence!, note: i.note })),
    )
  })
  const lastBackup = settings?.value.lastBackupAt ?? null
  const quality = dq?.value as DataQuality | undefined

  async function exportJSON() {
    const backup = await exportBackup(db)
    downloadText(`gym-backup-${fileStamp()}.json`, JSON.stringify(backup, null, 1), 'application/json')
    await markBackupDone(db)
  }
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  async function shareJSON() {
    const backup = await exportBackup(db)
    const r = await shareTextFile(`gym-backup-${fileStamp()}.json`, JSON.stringify(backup, null, 1), 'application/json')
    if (r === 'shared') {
      await markBackupDone(db)
      setShareMsg('Backup enviado. Guardalo en un lugar fuera del celu (Drive, correo).')
    } else if (r === 'failed') setShareMsg('No se pudo compartir. Usá "Exportar JSON".')
    else setShareMsg(null)
  }
  async function exportCSV() {
    const backup = await exportBackup(db)
    downloadText(`gym-series-${fileStamp()}.csv`, toCSV(backup.data), 'text/csv')
  }

  return (
    <section className="space-y-6">
      <h1 className="title text-3xl">Ajustes</h1>

      <div className="space-y-2">
        <h2 className="eyebrow text-slate-400">Preferencias</h2>
        <Preferences />
        <Link to="/ejercicios" className="flex min-h-12 items-center justify-between rounded-2xl bg-surface px-4 text-sm"><span>Ejercicios: unidades, rangos, incrementos y descansos</span><span aria-hidden="true" className="text-slate-500">›</span></Link>
      </div>

      <div className="space-y-3">
        <h2 className="eyebrow text-slate-400">Backup</h2>
        <StorageStatus />
        <p className="text-sm text-slate-400">
          {lastBackup ? `Último backup: ${formatTimestamp(lastBackup)}` : 'Todavía no hiciste ningún backup.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => void exportJSON()}>Exportar JSON</Button>
          <Button onClick={() => void exportCSV()}>Exportar CSV</Button>
        </div>
        {canShareFiles() && <Button className="w-full" onClick={() => void shareJSON()}>Compartir backup (Drive, correo…)</Button>}
        {shareMsg && <p role="status" className="text-sm text-slate-400">{shareMsg}</p>}
        <ImportFlow />
      </div>

      <div className="space-y-2">
        <h2 className="eyebrow text-slate-400">Volumen</h2>
        <VolumeTargets />
      </div>

      <details className="space-y-3">
        <summary className="eyebrow cursor-pointer py-2 text-slate-400">Calidad de datos{flagged?.length ? ` · ${flagged.length} registros marcados` : ''}</summary>
        {!quality && !flagged?.length ? (
          <p className="text-sm text-slate-400">Sin notas.</p>
        ) : (
          <>
            {quality && (
              <Card>
                <p className="mb-2 text-xs text-slate-400">{quality.source}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {quality.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </Card>
            )}
            {!!flagged?.length && (
              <Card>
                <p className="mb-2 text-xs text-slate-400">Registros con confianza baja (no cuentan para progresión) o media (dato inferido):</p>
                <ul className="space-y-2 text-sm">
                  {flagged.map((f) => (
                    <li key={f.key}>
                      <span className="tabular-nums text-slate-400">{formatDDMM(f.date)}</span> {f.name}{' '}
                      <span className={`rounded px-1.5 py-0.5 text-xs ${f.confidence === 'baja' ? 'bg-amber-500/15 text-amber-300' : 'bg-sky-500/15 text-sky-300'}`}>
                        {f.confidence}
                      </span>
                      {f.note && <p className="text-xs text-slate-400">{f.note}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </details>

      <div className="space-y-2">
        <h2 className="eyebrow text-slate-400">Acerca de</h2>
        <About />
      </div>
    </section>
  )
}
