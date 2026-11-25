import { type Rules, resolveRules, rulesOverrides } from '../engine/rules'
import { getSettings } from './backup'
import { SETTINGS_KEY, type GymDB } from './db'

/** Guarda las reglas del motor (D-78): solo lo que difiere de los valores por defecto; si todo está por defecto, no queda nada. */
export async function saveRules(db: GymDB, rules: Rules): Promise<void> {
  const current = await getSettings(db)
  const { rules: _old, ...rest } = current
  const overrides = rulesOverrides(resolveRules(rules))
  await db.settings.put({ key: SETTINGS_KEY, value: Object.keys(overrides).length ? { ...rest, rules: overrides } : rest })
}
