import type { GymDB } from './db'

/** Los avisos de patrón (D-75) se pueden descartar: queda guardado con una clave por aviso. */
export const riskKey = (id: string) => `risk:${id}`

export async function dismissRisk(db: GymDB, id: string): Promise<void> {
  await db.meta.put({ key: riskKey(id), value: true })
}
