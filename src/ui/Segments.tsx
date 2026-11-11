/** Una rayita por serie: llena las hechas. Decorativo (el texto accesible lo da quien lo usa). */
export function Segments({ done, total, className = '' }: { done: number; total: number; className?: string }) {
  const n = Math.min(Math.max(total, done), 10)
  return (
    <span className={`flex gap-1 ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={`h-1.5 w-3.5 rounded-full ${i < done ? 'bg-accent-solid' : 'bg-raised'}`} />
      ))}
    </span>
  )
}
