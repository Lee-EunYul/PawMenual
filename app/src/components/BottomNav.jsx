import { NavLink } from 'react-router-dom'
import { House, HeartPulse, PawPrint, NotebookPen } from 'lucide-react'

const menus = [
  { to: '/', label: '홈', icon: House },
  { to: '/care/food', label: '케어', icon: HeartPulse },
  { to: '/training', label: '훈련', icon: PawPrint },
  { to: '/records', label: '기록', icon: NotebookPen },
]

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {menus.map((menu) => (
        <NavLink
          key={menu.to}
          to={menu.to}
          title={menu.label}
          className={({ isActive }) =>
            `nav-item${isActive ? ' nav-item-active' : ''}`
          }
        >
          <menu.icon size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>{menu.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
