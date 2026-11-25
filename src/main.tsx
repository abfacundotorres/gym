import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { bootDatabase } from './data/boot'
import { BootGate } from './ui/BootGate'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './index.css'
import { applyStoredTheme } from './lib/theme'

applyStoredTheme()

const root = createRoot(document.getElementById('root')!)
const app = (
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// La base se prepara antes de dibujar (D-82): copia previa a migrar y apertura. Si falla, una pantalla propia en vez de la app.
void bootDatabase().then((boot) => {
  root.render(boot.ok ? app : <StrictMode><BootGate boot={boot} onContinue={() => root.render(app)} /></StrictMode>)
})
