import { getDB, SETTINGS_KEY } from '../../data/db'
import { getSettings } from '../../data/backup'
import { useSettings } from '../../data/hooks'
import { MUSCLES, MUSCLE_LABELS, type Muscle } from '../../engine/types'

export function VolumeTargets() {
  const settings = useSettings()
  async function set(m: Muscle, i: 0 | 1, raw: string) {
    const v = Number(raw)
    if (!Number.isFinite(v) || v < 0) return
    const db = getDB()
    const s = await getSettings(db)
    const t: [number, number] = [...s.volumeTarget[m]]
    t[i] = v
    if (t[0] > t[1]) return
    await db.settings.put({ key: SETTINGS_KEY, value: { ...s, volumeTarget: { ...s.volumeTarget, [m]: t } } })
  }
  return (
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-slate-300">Rango objetivo de series por músculo y semana</summary>
      <ul className="mt-2 space-y-1 text-sm">
        {MUSCLES.map((m) => (
          <li key={m} className="flex items-center gap-2">
            <span className="flex-1">{MUSCLE_LABELS[m]}</span>
            {([0, 1] as const).map((i) => (
              <input
                key={`${m}-${i}-${settings.volumeTarget[m][i]}`}
                aria-label={`${MUSCLE_LABELS[m]} ${i === 0 ? 'mínimo' : 'máximo'}`}
                inputMode="decimal"
                defaultValue={settings.volumeTarget[m][i]}
                onBlur={(e) => void set(m, i, e.target.value.replace(',', '.'))}
                className="h-11 w-14 rounded-xl bg-bg text-center tabular-nums ring-1 ring-line"
              />
            ))}
          </li>
        ))}
      </ul>
    </details>
  )
}
