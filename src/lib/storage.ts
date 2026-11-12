/** Estado del almacenamiento del navegador: si los datos están protegidos contra borrado automático. */
export interface StorageState {
  /** true = protegido; false = el navegador puede borrarlo si falta espacio; null = no informa. */
  persisted: boolean | null
  usageBytes: number | null
  installed: boolean
}

export async function readStorageState(): Promise<StorageState> {
  let persisted: boolean | null = null
  let usageBytes: number | null = null
  try { persisted = (await navigator.storage?.persisted?.()) ?? null } catch { /* sin soporte */ }
  try { usageBytes = (await navigator.storage?.estimate?.())?.usage ?? null } catch { /* sin soporte */ }
  const installed = matchMedia('(display-mode: standalone)').matches
  return { persisted, usageBytes, installed }
}

/** Pide la protección. El navegador decide solo (en Android, según uso e instalación): puede responder que no. */
export async function requestPersistence(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false } catch { return false }
}
