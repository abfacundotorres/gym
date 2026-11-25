import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { resolveRules, type Rules } from '../engine/rules'
import { activeZones, type ActiveZone } from '../engine/zones'
import { defaultSettings, type Exercise, type Settings } from '../engine/types'
import { getDB, SETTINGS_KEY } from './db'

export function useSettings(): Settings {
  return useLiveQuery(() => getDB().settings.get(SETTINGS_KEY))?.value ?? defaultSettings()
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  return useLiveQuery(async () => new Map((await getDB().exercises.toArray()).map((e) => [e.id, e])))
}

/** Zonas con una molestia activa (D-76): la intensidad mayor y desde cuándo. */
export function useActiveZones(): ActiveZone[] {
  return useLiveQuery(async () => activeZones(await getDB().zoneIssues.toArray())) ?? []
}

/** Reglas del motor con lo que cambiaste en Ajustes → Reglas (D-78) y el resto por defecto. */
export function useRules(): Rules {
  const saved = useSettings().rules
  return useMemo(() => resolveRules(saved), [saved])
}
