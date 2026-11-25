import { useEffect, useState } from 'react'
import { deleteSnapshot, listSnapshots, type Snapshot } from '../../data/safety'
import { downloadText } from '../../lib/download'
import { fileStamp, formatTimestamp } from '../../lib/format'
import { Button, Card } from '../../ui/Button'

/** Copias que la app guardó sola antes de actualizar la base (D-82). Sin copias no ocupa lugar en pantalla. */
export function AutoCopies() {
  const [copies, setCopies] = useState<Snapshot[]>([])
  useEffect(() => {
    let on = true
    void listSnapshots().then((s) => on && setCopies(s)).catch(() => {})
    return () => { on = false }
  }, [])
  if (!copies.length) return null

  function download(c: Snapshot) {
    downloadText(`gym-copia-previa-v${c.fromVersion}-${fileStamp(c.takenAt)}.json`, JSON.stringify(c.backup, null, 1), 'application/json')
  }
  async function remove(c: Snapshot) {
    if (!window.confirm('¿Borrar esta copia automática?')) return
    await deleteSnapshot(c.id)
    setCopies((cs) => cs.filter((x) => x.id !== c.id))
  }
  return (
    <Card className="space-y-3">
      <div>
        <p className="font-semibold">Copias automáticas</p>
        <p className="text-sm text-slate-400">Antes de actualizar la base la app guarda una copia en este celu (las últimas 2). Se importan como cualquier backup.</p>
      </div>
      <ul className="space-y-2">
        {copies.map((c) => (
          <li key={c.id} className="space-y-2">
            <p className="text-sm">
              {formatTimestamp(c.takenAt)} · base v{c.fromVersion} → v{c.toVersion} · {c.sessions} sesiones
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => download(c)}>Descargar</Button>
              <Button onClick={() => void remove(c)}>Borrar</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
