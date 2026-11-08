import { HashRouter, Route, Routes } from 'react-router'
import { Layout } from './ui/Layout'
import { TodayPage } from './features/today/TodayPage'
import { Placeholder } from './features/Placeholder'
import { SettingsPage } from './features/settings/SettingsPage'
import { SessionPage } from './features/session/SessionPage'
import { ExercisePage } from './features/session/ExercisePage'
import { SummaryPage } from './features/session/SummaryPage'
import { HistoryPage } from './features/history/HistoryPage'
import { ExerciseHistoryPage } from './features/history/ExerciseHistoryPage'

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="sesion/:id" element={<SessionPage />} />
          <Route path="sesion/:id/resumen" element={<SummaryPage />} />
          <Route path="sesion/:id/:idx" element={<ExercisePage />} />
          <Route path="historial" element={<HistoryPage />} />
          <Route path="historial/ej/:exId" element={<ExerciseHistoryPage />} />
          <Route path="volumen" element={<Placeholder title="Volumen" milestone="H4" />} />
          <Route path="plan" element={<Placeholder title="Plan" milestone="H4" />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Placeholder title="No encontrado" milestone="—" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
