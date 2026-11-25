import { HashRouter, Route, Routes } from 'react-router'
import { Layout } from './ui/Layout'
import { useTheme } from './lib/theme'
import { TodayPage } from './features/today/TodayPage'
import { NotFound } from './features/NotFound'
import { SettingsPage } from './features/settings/SettingsPage'
import { SessionPage } from './features/session/SessionPage'
import { ExercisePage } from './features/session/ExercisePage'
import { SummaryPage } from './features/session/SummaryPage'
import { HistoryPage } from './features/history/HistoryPage'
import { ExerciseHistoryPage } from './features/history/ExerciseHistoryPage'
import { VolumePage } from './features/volume/VolumePage'
import { PlanPage } from './features/plan/PlanPage'
import { NextBlockPage } from './features/plan/NextBlockPage'
import { CalibrationPage } from './features/calibration/CalibrationPage'
import { PeriodSummaryPage } from './features/summary/PeriodSummaryPage'
import { ReviewPage } from './features/plan/ReviewPage'
import { ExercisesPage } from './features/exercises/ExercisesPage'
import { ExerciseEditPage } from './features/exercises/ExerciseEditPage'
import { DiagnosticPage } from './features/diagnostic/DiagnosticPage'
import { NewExercisePage } from './features/exercises/NewExercisePage'
import { BodyweightPage } from './features/body/BodyweightPage'

export function App() {
  useTheme()
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
          <Route path="volumen" element={<VolumePage />} />
          <Route path="resumen" element={<PeriodSummaryPage />} />
          <Route path="calibracion" element={<CalibrationPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="plan/revision" element={<ReviewPage />} />
          <Route path="plan/siguiente" element={<NextBlockPage />} />
          <Route path="ejercicios" element={<ExercisesPage />} />
          <Route path="ejercicios/:exId" element={<ExerciseEditPage />} />
          <Route path="ejercicio-nuevo" element={<NewExercisePage />} />
          <Route path="peso" element={<BodyweightPage />} />
          <Route path="diagnostico" element={<DiagnosticPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
