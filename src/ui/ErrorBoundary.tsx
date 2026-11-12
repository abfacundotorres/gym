import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { exportBackup, markBackupDone } from '../data/backup'
import { getDB } from '../data/db'
import { downloadText } from '../lib/download'
import { fileStamp } from '../lib/format'

/**
 * Si una pantalla falla al dibujarse, en vez de quedar en blanco se muestra esto: los datos están en la base
 * (no en la pantalla), así que siempre se puede exportar un backup, volver a Hoy o recargar.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de pantalla:', error, info.componentStack)
  }
  render() {
    return this.state.error ? <Rescue error={this.state.error} /> : this.props.children
  }
}

function Rescue({ error }: { error: Error }) {
  const [msg, setMsg] = useState<string | null>(null)
  async function exportJSON() {
    try {
      const backup = await exportBackup(getDB())
      downloadText(`gym-backup-${fileStamp()}.json`, JSON.stringify(backup, null, 1), 'application/json')
      await markBackupDone(getDB())
      setMsg('Backup descargado.')
    } catch (e) {
      setMsg(`No se pudo exportar: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const btn = 'flex min-h-13 w-full items-center justify-center rounded-2xl bg-raised px-4 font-medium ring-1 ring-line'
  return (
    <section role="alert" className="space-y-4 py-6">
      <h1 className="title text-3xl">Algo falló</h1>
      <p className="text-slate-300">Esta pantalla no se pudo mostrar. Tus datos están a salvo en este dispositivo.</p>
      <div className="space-y-2">
        <button className={`${btn} !bg-accent-solid font-bold text-on-accent`} onClick={() => void exportJSON()}>Exportar backup</button>
        <button className={btn} onClick={() => { location.hash = '#/'; location.reload() }}>Volver a Hoy</button>
        <button className={btn} onClick={() => location.reload()}>Recargar</button>
      </div>
      {msg && <p role="status" className="text-sm text-slate-400">{msg}</p>}
      <details className="text-xs text-slate-400">
        <summary className="flex min-h-11 cursor-pointer items-center">Detalle del error (para avisar)</summary>
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface p-3">{error.name}: {error.message}</pre>
      </details>
    </section>
  )
}
