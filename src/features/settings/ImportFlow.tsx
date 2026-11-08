import { useRef, useState } from 'react'
import { applyImport, parseImportText, previewImport, type ImportMode, type ImportPreview } from '../../data/backup'
import { getDB } from '../../data/db'
import type { BackupData } from '../../data/schemas'
import { Button, Card } from '../../ui/Button'

const LABELS: Record<Exclude<keyof ImportPreview, 'settings'>, string> = {
  exercises: 'Ejercicios',
  planDays: 'Días del plan',
  mesocycles: 'Mesociclos',
  sessions: 'Sesiones',
  dayMarks: 'Días salteados',
}

type State =
  | { step: 'idle' }
  | { step: 'error'; error: string }
  | { step: 'preview'; kind: 'backup' | 'seed'; data: BackupData; mode: ImportMode; preview: ImportPreview }
  | { step: 'done'; sessions: number }

/** Elegir archivo → validar → vista previa → reemplazar o mezclar. Acepta seed.json o un backup. */
export function ImportFlow({ label = 'Importar archivo', defaultMode = 'merge' }: { label?: string; defaultMode?: ImportMode }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ step: 'idle' })

  async function onFile(file: File) {
    const parsed = parseImportText(await file.text())
    if (!parsed.ok) return setState({ step: 'error', error: parsed.error })
    const preview = await previewImport(getDB(), parsed.data, defaultMode)
    setState({ step: 'preview', kind: parsed.kind, data: parsed.data, mode: defaultMode, preview })
  }

  async function setMode(mode: ImportMode) {
    if (state.step !== 'preview') return
    setState({ ...state, mode, preview: await previewImport(getDB(), state.data, mode) })
  }

  async function apply() {
    if (state.step !== 'preview') return
    await applyImport(getDB(), state.data, state.mode)
    setState({ step: 'done', sessions: state.data.sessions.length })
  }

  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onFile(f)
        }}
      />
      {state.step !== 'preview' && (
        <Button className="w-full" onClick={() => input.current?.click()}>
          {label}
        </Button>
      )}
      {state.step === 'error' && (
        <p role="alert" className="whitespace-pre-line rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
          No se pudo importar.{'\n'}
          {state.error}
        </p>
      )}
      {state.step === 'done' && <p className="text-sm text-accent">Listo: {state.sessions} sesiones en el archivo, importadas.</p>}
      {state.step === 'preview' && (
        <Card className="space-y-3">
          <p className="text-sm text-slate-400">{state.kind === 'seed' ? 'Datos iniciales (seed)' : 'Backup'} — qué cambia:</p>
          <div role="radiogroup" aria-label="Modo de importación" className="grid grid-cols-2 gap-2">
            {(['merge', 'replace'] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={state.mode === m}
                onClick={() => void setMode(m)}
                className={`min-h-11 rounded-lg text-sm ring-1 ${state.mode === m ? 'bg-accent/15 text-accent ring-accent' : 'ring-line'}`}
              >
                {m === 'merge' ? 'Mezclar' : 'Reemplazar todo'}
              </button>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr><th className="font-normal" /><th className="font-normal">Nuevos</th><th className="font-normal">Cambian</th><th className="font-normal">Se borran</th></tr>
            </thead>
            <tbody>
              {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
                <tr key={k}>
                  <td className="py-1">{LABELS[k]}</td>
                  <td>{state.preview[k].added}</td>
                  <td>{state.preview[k].updated}</td>
                  <td className={state.preview[k].removed ? 'text-red-300' : ''}>{state.preview[k].removed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.preview.settings === 'replace' && <p className="text-xs text-slate-400">Los ajustes se reemplazan por los del archivo.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setState({ step: 'idle' })}>Cancelar</Button>
            <Button variant={state.mode === 'replace' ? 'danger' : 'primary'} onClick={() => void apply()}>
              {state.mode === 'replace' ? 'Reemplazar' : 'Importar'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
