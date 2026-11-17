import type { Exercise } from '../engine/types'
import { variantOverrides } from '../engine/variants'
import type { GymDB } from './db'

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'ejercicio'
}

export async function saveExercise(db: GymDB, ex: Exercise): Promise<void> {
  await db.exercises.put(ex)
}

/**
 * Nueva variante: copia de `base` con id nuevo (único) y nombre dado. Sin historial (D-67). Con otra unidad
 * (p. ej. de mancuernas a máquina) cambia el paso de carga y se descarta el peso de la barra o del carro.
 */
export async function createVariant(db: GymDB, base: Exercise, name: string, unit: Exercise['unit'] = base.unit): Promise<Exercise> {
  let id = slugify(name)
  for (let i = 2; await db.exercises.get(id); i++) id = `${slugify(name)}_${i}`
  const { archived: _a, ...rest } = base
  const ex: Exercise = { ...rest, id, name, ...variantOverrides(base, unit) }
  if (ex.unit !== 'per_side') {
    delete ex.barKg
    delete ex.sledKg
  }
  await db.exercises.add(ex)
  return ex
}
