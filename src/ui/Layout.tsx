import { NavLink, Outlet } from 'react-router'
import { UpdateBanner } from './UpdateBanner'

const TABS = [
  { to: '/', label: 'Hoy', end: true },
  { to: '/historial', label: 'Historial' },
  { to: '/volumen', label: 'Volumen' },
  { to: '/plan', label: 'Plan' },
  { to: '/ajustes', label: 'Ajustes' },
]

export function Layout() {
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <UpdateBanner />
      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex h-14 items-center justify-center text-xs font-medium ${isActive ? 'text-accent' : 'text-slate-400'}`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
