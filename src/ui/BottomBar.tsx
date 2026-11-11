import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

/** Hueco fijo al pie (sobre el descanso y la navegación) donde las pantallas montan sus acciones. */
export const BottomSlotContext = createContext<HTMLElement | null>(null)

export function BottomBar({ children }: { children: React.ReactNode }) {
  const slot = useContext(BottomSlotContext)
  return slot ? createPortal(<div className="mx-auto max-w-xl px-4 py-3">{children}</div>, slot) : null
}
