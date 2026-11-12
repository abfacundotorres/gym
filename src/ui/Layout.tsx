import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { UpdateBanner } from './UpdateBanner'
import { RestTimerBar } from './RestTimerBar'
import { BottomSlotContext } from './BottomBar'
import { ErrorBoundary } from './ErrorBoundary'

const ICONS = {
  hoy: <path d="M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12" />,
  historial: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  volumen: <path d="M5 20V10M12 20V4M19 20v-7" />,
  plan: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  ajustes: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
}

const TABS = [
  { to: '/', label: 'Hoy', end: true, icon: ICONS.hoy },
  { to: '/historial', label: 'Historial', icon: ICONS.historial },
  { to: '/volumen', label: 'Volumen', icon: ICONS.volumen },
  { to: '/plan', label: 'Plan', icon: ICONS.plan },
  { to: '/ajustes', label: 'Ajustes', icon: ICONS.ajustes },
]

/** Modo foco: durante la sesión (lista y ejercicios) no se muestran las pestañas; el resumen sí las muestra. */
const FOCUS = /^\/sesion\/[^/]+(\/\d+)?$/

export function Layout() {
  const { pathname } = useLocation()
  const focus = FOCUS.test(pathname)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [barH, setBarH] = useState(120)

  // El contenido deja lugar para lo que haya fijo abajo (acciones, descanso, pestañas).
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const apply = () => {
      setBarH(el.offsetHeight)
      // Para que otras pantallas (scroll automático) sepan cuánto tapan las barras fijas.
      document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`)
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    apply()
    return () => ro.disconnect()
  }, [])

  return (
    <BottomSlotContext.Provider value={slot}>
      <div className="mx-auto flex min-h-full max-w-xl flex-col">
        <UpdateBanner />
        <main className="flex-1 px-4 pt-5" style={{ paddingBottom: barH + 24 }}>
          <div key={pathname} className="animate-page-in">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
        <div ref={barRef} className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <RestTimerBar />
          <div ref={setSlot} />
          {!focus && (
            <nav aria-label="Secciones">
              <ul className="mx-auto grid max-w-xl grid-cols-5">
                {TABS.map((t) => (
                  <li key={t.to}>
                    <NavLink
                      to={t.to}
                      end={t.end}
                      className={({ isActive }) =>
                        `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive ? 'text-accent' : 'text-slate-500'}`
                      }
                    >
                      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {t.icon}
                      </svg>
                      {t.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </BottomSlotContext.Provider>
  )
}
