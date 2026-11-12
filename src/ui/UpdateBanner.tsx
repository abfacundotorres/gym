import { usePwa } from '../lib/pwa'

export function UpdateBanner() {
  const { needRefresh, update, dismiss } = usePwa()
  if (!needRefresh) return null
  return (
    <div role="status" className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-surface p-3 text-sm ring-1 ring-line">
      <span className="flex-1">Hay una versión nueva.</span>
      <button className="rounded-xl px-3 py-2 text-slate-400" onClick={dismiss}>Después</button>
      <button className="rounded-xl bg-accent-solid px-3 py-2 font-semibold text-on-accent" onClick={update}>Actualizar</button>
    </div>
  )
}
