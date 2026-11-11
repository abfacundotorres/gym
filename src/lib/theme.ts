import { useEffect } from 'react'
import { useSettings } from '../data/hooks'

const KEY = 'gym.theme'

/** Aplica el tema antes del primer render (evita el destello), con lo último guardado en este dispositivo. */
export function applyStoredTheme() {
  let theme = 'dark'
  try { theme = localStorage.getItem(KEY) ?? 'dark' } catch { /* sin storage */ }
  setTheme(theme === 'light' ? 'light' : 'dark')
}

function setTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07090c' : '#f4f6f8')
  try { localStorage.setItem(KEY, theme) } catch { /* sin storage */ }
}

/** Sincroniza el tema con Ajustes (que viaja en el backup). */
export function useTheme() {
  const { theme } = useSettings()
  useEffect(() => setTheme(theme), [theme])
}
