import { useLiveQuery } from 'dexie-react-hooks'
import { exportBackup, markBackupDone, toCSV } from '../../data/backup'
import { getDB, META_DATA_QUALITY, SETTINGS_KEY } from '../../data/db'
import type { DataQuality } from '../../engine/types'
import { formatDDMM } from '../../engine/dates'
import { downloadText } from '../../lib/download'
import { fileStamp, formatTimestamp } from '../../lib/format'
import { Button, Card } from '../../ui/Button'
import { ImportFlow } from './ImportFlow'
import { VolumeTargets } from './VolumeTargets'

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
  async function exportCSV() {
    const backup = await exportBackup(db)
    downloadText(`gym-series-${fileStamp()}.csv`, toCSV(backup.data), 'text/csv')
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Ajustes</h1>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Backup</h2>
        <p className="text-sm text-slate-400">
          {lastBackup ? `Último backup: ${formatTimestamp(lastBackup)}` : 'Todavía no hiciste ningún backup.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => void exportJSON()}>Exportar JSON</Button>
          <Button onClick={() => void exportCSV()}>Exportar CSV</Button>
        </div>
        <ImportFlow />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Volumen</h2>
        <VolumeTargets />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Calidad de datos</h2>
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
      </div>
    </section>
  )
}
