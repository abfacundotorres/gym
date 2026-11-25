import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getDB } from '../../data/db'
import { diagnose, diagnosticText, type DiagnosticReport } from '../../data/diagnostic'
import type { Finding } from '../../engine/integrity'
import { copyText } from '../../lib/clipboard'
import { formatTimestamp } from '../../lib/format'
import { Button, Card } from '../../ui/Button'

const TABLE_LABEL: Record<string, string> = {
  exercises: 'Ejercicios', planDays: 'Días del plan', mesocycles: 'Mesociclos', sessions: 'Sesiones', dayMarks: 'Días salteados',
  bodyweights: 'Pesos', zoneIssues: 'Molestias', settings: 'Ajustes', meta: 'Meta',
}

/** Estado de la base y chequeo de integridad (D-84). Solo mira: no cambia ni arregla nada. */
export function DiagnosticPage() {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<boolean | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let on = true
    diagnose(getDB()).then((r) => on && setReport(r), (e: unknown) => on && setError(e instanceof Error ? e.message : String(e)))
    return () => { on = false }
  }, [tick])
  const rerun = () => { setReport(null); setError(null); setCopied(null); setTick((t) => t + 1) }

  const errors = report?.findings.filter((f) => f.severity === 'error') ?? []
  const warns = report?.findings.filter((f) => f.severity === 'aviso') ?? []
  const stale = report && report.schemaVersion !== report.expectedSchemaVersion

  return (
    <section className="space-y-5">
      <Link to="/ajustes" className="-ml-1 flex min-h-11 items-center pr-3 text-sm text-slate-400">← Ajustes</Link>
      <h1 className="title text-3xl">Diagnóstico</h1>
      <p className="text-sm text-slate-400">Revisa que tus datos estén completos y coherentes. Solo mira: no cambia nada.</p>

      {error && <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300">No se pudo revisar: {error}</p>}
      {!report && !error && <p role="status" className="text-sm text-slate-400">Revisando…</p>}

      {report && (
        <>
          <Card className={`space-y-1 ${errors.length ? 'bg-red-500/10 ring-red-500/30' : warns.length ? 'bg-amber-500/10 ring-amber-500/30' : ''}`}>
            <p className={`font-semibold ${errors.length ? 'text-red-300' : warns.length ? 'text-amber-300' : 'text-accent'}`}>
              {errors.length ? `${errors.length} ${errors.length === 1 ? 'problema' : 'problemas'}` : warns.length ? 'Sin problemas, con avisos' : '✓ Todo en orden'}
              {errors.length > 0 && warns.length > 0 && ` y ${warns.length} ${warns.length === 1 ? 'aviso' : 'avisos'}`}
            </p>
            {report.findings.length === 0 && <p className="text-sm text-slate-400">Las referencias y los valores cierran, y los datos se pueden exportar e importar.</p>}
          </Card>

          {[...errors, ...warns].map((f) => <FindingCard key={f.code} f={f} />)}

          <div className="space-y-2">
            <h2 className="eyebrow text-slate-400">Estado</h2>
            <Card className="space-y-1.5 text-sm">
              <Row k="Base" v={stale ? `esquema v${report.schemaVersion} (esta app espera v${report.expectedSchemaVersion})` : `esquema v${report.schemaVersion}`} warn={!!stale} />
              <Row k="Almacenamiento" v={report.storage.persisted === null ? 'no informa' : report.storage.persisted ? 'protegido' : 'sin proteger'} warn={report.storage.persisted === false} />
              <Row k="Último backup" v={report.lastBackupAt ? formatTimestamp(report.lastBackupAt) : 'ninguno'} />
              <Row k="Copias automáticas" v={String(report.autoCopies)} />
              {Object.entries(report.counts).map(([k, v]) => <Row key={k} k={TABLE_LABEL[k] ?? k} v={String(v)} />)}
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={rerun}>Revisar de nuevo</Button>
            <Button onClick={async () => setCopied(await copyText(diagnosticText(report, { commit: __COMMIT__, builtAt: formatTimestamp(__BUILD_TIME__) })))}>Copiar para avisar</Button>
          </div>
          {copied != null && <p role="status" className="text-sm text-slate-400">{copied ? 'Copiado. No incluye pesos, reps ni notas.' : 'No se pudo copiar.'}</p>}
        </>
      )}
    </section>
  )
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-400">{k}</span>
      <span className={`text-right tabular-nums ${warn ? 'text-amber-300' : ''}`}>{v}</span>
    </div>
  )
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${f.severity === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>
          {f.severity === 'error' ? 'problema' : 'aviso'}
        </span>
        <p className="text-sm">{f.message} <span className="text-slate-400">({f.count})</span></p>
      </div>
      <ul className="space-y-0.5 break-words text-xs text-slate-400">
        {f.detail.map((d, i) => <li key={i}>{d}</li>)}
        {f.count > f.detail.length && <li>… y {f.count - f.detail.length} más</li>}
      </ul>
    </Card>
  )
}
