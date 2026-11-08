export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-slate-400">Llega en {milestone}.</p>
    </section>
  )
}
