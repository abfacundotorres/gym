import { useState } from 'react'
import { formatTimestamp } from '../../lib/format'
import { Button } from '../../ui/Button'

/** Versión instalada y búsqueda manual de actualizaciones (el aviso "Actualizar" aparece arriba cuando hay una lista). */
export function About() {
  const [msg, setMsg] = useState<string | null>(null)

  async function check() {
    setMsg('Buscando…')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (!reg) return setMsg('Todavía no hay service worker (modo desarrollo o primera visita). Recargá la página.')
      await reg.update()
      setMsg(
        reg.waiting || reg.installing
          ? 'Hay una versión nueva. Cuando termine de bajar aparece el aviso "Actualizar" arriba de la pantalla.'
          : 'Estás al día.',
      )
    } catch {
      setMsg('No se pudo buscar. ¿Estás sin conexión?')
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        Versión <span className="font-mono">{__COMMIT__}</span>
        <span className="text-slate-400"> · compilada {formatTimestamp(__BUILD_TIME__)}</span>
      </p>
      <Button className="w-full" onClick={() => void check()}>Buscar actualización</Button>
      {msg && <p role="status" className="text-slate-400">{msg}</p>}
    </div>
  )
}
