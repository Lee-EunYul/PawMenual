import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import FoodGuidePage from './pages/FoodGuidePage'
import HealthPage from './pages/HealthPage'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import RecordsPage from './pages/RecordsPage'
import TrainingPage from './pages/TrainingPage'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/care/food" element={<FoodGuidePage />} />
        <Route path="/care/health" element={<HealthPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/records" element={<RecordsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
