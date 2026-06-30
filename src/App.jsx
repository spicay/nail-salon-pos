import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStaff } from './lib/StaffContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cashier from './pages/Cashier'
import Appointments from './pages/Appointments'
import Customers from './pages/Customers'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import StaffPage from './pages/Staff'
import Settings from './pages/Settings'

function RequireAuth({ children }) {
  const { staff, ready } = useStaff()
  if (!ready) return null
  if (!staff) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="cashier" element={<Cashier />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="customers" element={<Customers />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="reports" element={<Reports />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
