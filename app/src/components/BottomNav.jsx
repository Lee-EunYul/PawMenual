import { NavLink } from 'react-router-dom'

const menus = [
  { to: '/', label: '홈' },
  { to: '/care/food', label: '케어' },
  { to: '/training', label: '훈련' },
  { to: '/records', label: '기록' },
]

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {menus.map((menu) => (
        <NavLink
          key={menu.to}
          to={menu.to}
          className={({ isActive }) =>
            `nav-item${isActive ? ' nav-item-active' : ''}`
          }
        >
          {menu.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
