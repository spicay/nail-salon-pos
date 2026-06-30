import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStaff } from '../lib/StaffContext'

const links = [
  { to: '/', label: 'Dashboard', icon: '◆' },
  { to: '/cashier', label: 'Cashier', icon: '$' },
  { to: '/appointments', label: 'Appointments', icon: '◷' },
  { to: '/customers', label: 'Customers', icon: '◉' },
  { to: '/inventory', label: 'Inventory', icon: '▤' },
  { to: '/reports', label: 'Reports', icon: '▦' },
  { to: '/staff', label: 'Staff', icon: '✦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout() {
  const { staff, logout } = useStaff()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ padding: '8px 14px 24px' }}>
          <h2 style={{ color: 'white', fontSize: 19 }}>Salon POS</h2>
        </div>
        <nav style={{ flex: 1 }}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              <span>{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
          <div style={{ padding: '0 14px 10px', color: '#c9c2d1', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: 'white' }}>{staff?.full_name}</div>
            <div style={{ textTransform: 'capitalize', color: '#a89fb0' }}>{staff?.role}</div>
          </div>
          <button onClick={handleLogout} className="nav-link" style={{ width: '100%', textAlign: 'left' }}>
            ⏻ Switch user
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
