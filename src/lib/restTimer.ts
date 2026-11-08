import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Temporizador de descanso basado en timestamps: el tiempo restante se calcula
 * siempre como endsAt − ahora, así sobrevive al bloqueo de pantalla y a recargas.
 */
export interface RestState { endsAt: number; durationMs: number; label: string; alarmed: boolean }

const KEY = 'gym.restTimer'
let state: RestState | null = read()
const subs = new Set<() => void>()

function read(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RestState) : null
  } catch {
    return null
  }
}
function write(next: RestState | null) {
  state = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch { /* almacenamiento no disponible: el timer sigue en memoria */ }
  subs.forEach((f) => f())
}

let audio: AudioContext | null = null
/** Se llama desde un toque del usuario, para que el navegador permita el beep después. */
function unlockAudio() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch { /* sin audio */ }
}

export function startRest(seconds: number, label: string, now = Date.now()) {
  unlockAudio()
  write({ endsAt: now + seconds * 1000, durationMs: seconds * 1000, label, alarmed: false })
}
export function addRest(seconds: number) {
  if (!state) return
  write({ ...state, endsAt: state.endsAt + seconds * 1000, durationMs: state.durationMs + seconds * 1000, alarmed: false })
}
export function stopRest() {
  write(null)
}

function beep() {
  if (!audio) return
  const t = audio.currentTime
  for (const [i, f] of [880, 880, 1320].entries()) {
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t + i * 0.25)
    g.gain.exponentialRampToValueAtTime(0.4, t + i * 0.25 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.2)
    o.connect(g).connect(audio.destination)
    o.start(t + i * 0.25)
    o.stop(t + i * 0.25 + 0.22)
  }
}

async function alarm(label: string) {
  navigator.vibrate?.([300, 120, 300])
  beep()
  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    const reg = await navigator.serviceWorker?.getRegistration()
    const body = `Fin del descanso: ${label}`
    if (reg) await reg.showNotification('Gym', { body, tag: 'rest', silent: false })
    else new Notification('Gym', { body, tag: 'rest' })
  }
}

export function useRestTimer() {
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  )
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!s) return
    const id = setInterval(() => setNow(Date.now()), 250)
    const onVis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [s])
  const remainingMs = s ? s.endsAt - now : 0
  useEffect(() => {
    if (s && !s.alarmed && remainingMs <= 0) {
      write({ ...s, alarmed: true })
      void alarm(s.label)
    }
  }, [s, remainingMs])
  return { state: s, remainingMs }
}

export function formatClock(ms: number): string {
  const neg = ms < 0
  const total = Math.ceil(Math.abs(ms) / 1000)
  const m = Math.floor(total / 60)
  const sec = String(total % 60).padStart(2, '0')
  return `${neg ? '+' : ''}${m}:${sec}`
}
