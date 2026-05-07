import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Week on Week Comparison', path: '/wow-dashboard' },
  { label: 'WoW Comparison', path: '/wow-comparison' },
  { label: 'OTD Risk Intelligence Dashboard', path: '/otd-risk-dashboard' },
  { label: 'Details', path: '/details' },
]

export default function SiteHeader({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="header">
      <div className="nav-menu" ref={menuRef}>
        <button
          className={`nav-menu-btn ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Navigation menu"
        >
          <span className="nav-menu-icon">&#9776;</span>
          <span>Menu</span>
          <span className="nav-menu-chevron">{menuOpen ? '▲' : '▼'}</span>
        </button>
        {menuOpen && (
          <div className="nav-menu-flyout">
            <button
              className="nav-menu-item"
              onClick={() => { navigate('/'); setMenuOpen(false) }}
            >
              Dashboard
            </button>
            {NAV_ITEMS.map(item => (
              <button
                key={item.path}
                className={`nav-menu-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => { navigate(item.path); setMenuOpen(false) }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </header>
  )
}
