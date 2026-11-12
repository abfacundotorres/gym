import { useEffect, useState } from 'react'
import { readStorageState, requestPersistence, type StorageState } from '../../lib/storage'
import { Button, Card } from '../../ui/Button'

/** ¿El navegador protege los datos contra el borrado automático? Es lo que decide si un backup es opcional o necesario. */
export function StorageStatus() {
  const [st, setSt] = useState<StorageState | null>(null)
  const [denied, setDenied] = useState(false)
  useEffect(() => {
    let on = true
    void readStorageState().then((s) => on && setSt(s))
    return () => { on = false }
  }, [])
  if (!st) return null

  async function ask() {
    const ok = await requestPersistence()
    setDenied(!ok)
    setSt(await readStorageState())
  }
  const mb = st.usageBytes != null ? `${(st.usageBytes / 1_048_576).toFixed(1).replace('.', ',')} MB` : null

  if (st.persisted) {
    return (
      <Card className="space-y-1">
        <p className="font-semibold text-accent">✓ Almacenamiento protegido</p>
        <p className="text-sm text-slate-400">El navegador no borra tus datos si al celu le falta espacio.{mb && ` Ocupan ${mb}.`}</p>
      </Card>
    )
  }
  if (st.persisted === false) {
    return (
      <Card className="space-y-2 bg-amber-500/10 ring-amber-500/30">
        <p className="font-semibold text-amber-300">Almacenamiento sin proteger</p>
        <p className="text-sm text-slate-300">
          Si al celu le falta espacio, el navegador podría borrar tus datos. Hacé backups seguido.{mb && ` Ocupan ${mb}.`}
        </p>
        <Button className="w-full" onClick={() => void ask()}>Pedir protección</Button>
        {denied && (
          <p role="status" className="text-xs text-slate-400">
            El navegador no la concedió todavía.{st.installed ? '' : ' Instalar la app (menú ⋮ → Instalar app) y usarla seguido ayuda a que la conceda.'}
          </p>
        )}
      </Card>
    )
  }
  return <p className="text-sm text-slate-400">Este navegador no informa si los datos están protegidos. Hacé backups seguido.</p>
}
