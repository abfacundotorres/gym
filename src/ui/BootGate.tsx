import { useState } from 'react'
import type { BootResult } from '../data/boot'
import { downloadText } from '../lib/download'
import { fileStamp } from '../lib/format'

type Failed = Extract<BootResult, { ok: false }>

/**
 * Pantalla previa a la app cuando la base no se pudo preparar (D-82). Con la base sin abrir no hay pantallas que mostrar,
 * así que lo único útil es bajar una copia, recargar o, si la base sí abrió, seguir igual.
 */
export function BootGate({ boot, onContinue }: { boot: Failed; onContinue: () => void }) {
  const [msg, setMsg] = useState<string | null>(null)
  function download() {
    if (!boot.backup) return
    downloadText(`gym-copia-${fileStamp()}.json`, JSON.stringify(boot.backup, null, 1), 'application/json')
    setMsg('Copia descargada. Se importa desde Ajustes → Importar.')
  }
  const btn = 'flex min-h-13 w-full items-center justify-center rounded-2xl bg-raised px-4 font-medium ring-1 ring-line'
  return (
    <main role="alert" className="mx-auto max-w-lg space-y-4 p-4 py-8">
      {boot.reason === 'open' ? (
        <>
          <h1 className="title text-3xl">No se pudo abrir la base</h1>
          <p className="text-slate-300">
            Tus datos no se tocaron: si una actualización de la base falla, queda como estaba.
            {boot.backup ? ' Descargá una copia por las dudas y avisame.' : ' No pude leer una copia desde acá.'}
          </p>
        </>
      ) : (
        <>
          <h1 className="title text-3xl">No pude guardar la copia previa</h1>
          <p className="text-slate-300">
            Antes de actualizar la base la app guarda una copia de tus datos y esta vez no pudo (¿poco espacio?). La base abrió bien.
            Descargá una copia y seguí.
          </p>
        </>
      )}
      <div className="space-y-2">
        {boot.backup && <button className={`${btn} !bg-accent-solid font-bold text-on-accent`} onClick={download}>Descargar copia</button>}
        {boot.reason === 'snapshot' && <button className={btn} onClick={onContinue}>Seguir igual</button>}
        <button className={btn} onClick={() => location.reload()}>Reintentar</button>
      </div>
      {msg && <p role="status" className="text-sm text-slate-400">{msg}</p>}
      <details className="text-xs text-slate-400">
        <summary className="flex min-h-11 cursor-pointer items-center">Detalle del error (para avisar)</summary>
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface p-3">{boot.error}</pre>
      </details>
    </main>
  )
}
