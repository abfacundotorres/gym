import { HashRouter, Route, Routes } from 'react-router'
import { Layout } from './ui/Layout'
import { TodayPage } from './features/today/TodayPage'
import { Placeholder } from './features/Placeholder'

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="historial" element={<Placeholder title="Historial" milestone="H3" />} />
          <Route path="volumen" element={<Placeholder title="Volumen" milestone="H4" />} />
          <Route path="plan" element={<Placeholder title="Plan" milestone="H4" />} />
          <Route path="ajustes" element={<Placeholder title="Ajustes" milestone="H1" />} />
          <Route path="*" element={<Placeholder title="No encontrado" milestone="—" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
