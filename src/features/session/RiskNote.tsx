import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { getDB } from '../../data/db'
import { dismissRisk, riskKey } from '../../data/riskRepo'

/** Aviso de patrón (D-75): corto, neutro y descartable. `id` identifica el aviso para no repetirlo una vez descartado. */
export function RiskNote({ id, children }: { id: string; children: ReactNode }) {
  const db = getDB()
  const dismissed = useLiveQuery(async () => (await db.meta.get(riskKey(id))) != null, [id])
  if (dismissed !== false) return null // cargando o ya descartado
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-100 ring-1 ring-amber-500/30">
      <p className="min-w-0 flex-1">{children}</p>
      <button type="button" className="-my-1 -mr-1 min-h-11 shrink-0 rounded-xl px-2.5 text-[13px] font-medium text-amber-200" onClick={() => void dismissRisk(db, id)}>
        Entendido
      </button>
    </div>
  )
}
