import { useLiveQuery } from 'dexie-react-hooks'
import { defaultSettings, type Exercise, type Settings } from '../engine/types'
import { getDB, SETTINGS_KEY } from './db'

export function useSettings(): Settings {
  return useLiveQuery(() => getDB().settings.get(SETTINGS_KEY))?.value ?? defaultSettings()
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  return useLiveQuery(async () => new Map((await getDB().exercises.toArray()).map((e) => [e.id, e])))
}
