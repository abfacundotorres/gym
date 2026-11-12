import { useState } from 'react'
import { getSettings } from '../../data/backup'
import { getDB, SETTINGS_KEY } from '../../data/db'
import { useSettings } from '../../data/hooks'
import type { Settings } from '../../engine/types'
import { Chip } from '../../ui/Stepper'

async function update(p: Partial<Settings>) {
  const db = getDB()
  await db.settings.put({ key: SETTINGS_KEY, value: { ...(await getSettings(db)), ...p } })
}

export function Preferences() {
  const settings = useSettings()
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  return (
    <div className="space-y-4 rounded-2xl bg-surface p-4 text-sm">
      <div className="flex items-center gap-2" role="group" aria-label="Tema">
        <span className="flex-1">Tema</span>
        <Chip active={settings.theme === 'dark'} onClick={() => void update({ theme: 'dark' })}>Oscuro</Chip>
        <Chip active={settings.theme === 'light'} onClick={() => void update({ theme: 'light' })}>Claro</Chip>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1">
          Aviso de fin de descanso
          <span className="block text-xs text-slate-400">Vibración y beep siempre; notificación si das permiso.</span>
        </span>
        {perm === 'granted' ? (
          <span className="text-xs text-accent">Notificaciones activas</span>
        ) : perm === 'denied' ? (
          <span className="text-xs text-slate-400">Bloqueadas en el navegador</span>
        ) : perm === 'unsupported' ? (
          <span className="text-xs text-slate-400">No disponibles</span>
        ) : (
          <Chip active={false} onClick={() => void Notification.requestPermission().then(setPerm)}>Activar</Chip>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1">
          Kg por ladrillo
          <span className="block text-xs text-slate-400">Estimado, no medido. Se usa para e1RM y referencias.</span>
        </span>
        <input
          key={settings.kgPerBrick}
          aria-label="Kg por ladrillo"
          inputMode="decimal"
          defaultValue={String(settings.kgPerBrick).replace('.', ',')}
          onBlur={(e) => {
            const v = Number(e.target.value.replace(',', '.'))
            if (Number.isFinite(v) && v > 0) void update({ kgPerBrick: v })
          }}
          className="h-11 w-16 rounded-xl bg-bg text-center tabular-nums ring-1 ring-line"
        />
      </div>
    </div>
  )
}
