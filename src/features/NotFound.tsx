import { Link } from 'react-router'
import { LINK_BUTTON } from '../ui/Button'

export function NotFound() {
  return (
    <section className="space-y-4 py-6">
      <h1 className="title text-3xl">No encontrado</h1>
      <p className="text-slate-400">Esa pantalla no existe.</p>
      <Link to="/" className={LINK_BUTTON}>Ir a Hoy</Link>
    </section>
  )
}
