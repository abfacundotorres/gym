import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Registra el service worker y expone si hay una versión nueva esperando. */
export function usePwa() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    // Pedir almacenamiento persistente al primer uso (best effort, sin red).
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  return {
    needRefresh,
    update: () => updateServiceWorker(true),
    dismiss: () => setNeedRefresh(false),
  }
}
