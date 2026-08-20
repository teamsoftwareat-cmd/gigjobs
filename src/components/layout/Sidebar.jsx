import { NavLink, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useState } from 'react'

library.add(fas)

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [openSections, setOpenSections] = useState(() => ({ 0: true }))

  if (!user) return null
  const roleConfig = ROLES[user.role]
  const navSections = user.navigation || roleConfig.nav

  const handleLogout = () => {
    logout()
    const isInternal = user.role !== 'candidate'
    navigate(isInternal ? '/internal' : '/')
  }

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">CY</div>
        <div>
          <div className="sidebar-logo-text">Cynosurejobs<span className="sidebar-logo-sub">.net</span></div>
          <span className="sidebar-logo-sub">Cynosure Corporate Solutions</span>
        </div>
      </div>

      {/* Role badge */}
      <div className="sidebar-role">
        <div className="sidebar-role-label">Logged in as</div>
        <div className="sidebar-role-name">
          <div className="sidebar-role-dot" />
          <span>{roleConfig.label}</span>
        </div>
      </div>

      {/* Navigation (accordion sections) */}
      <nav className="sidebar-nav">
        {navSections.map((section, si) => {
          const isOpen = !!openSections[si]
          return (
            <div className="nav-section" key={si}>
              <div
                className={`nav-section-title ${isOpen ? 'open' : ''}`}
                onClick={() => setOpenSections((p) => {
                  // Accordion behavior: only one section open at a time
                  if (p[si]) return {}
                  return { [si]: true }
                })}
              >
                <span>{section.section}</span>
                <FontAwesomeIcon
                  icon={['fas', 'chevron-down']}
                  className={`nav-section-caret ${isOpen ? 'rotated' : ''}`}
                />
              </div>

              <div className={`nav-section-items ${isOpen ? 'expanded' : 'collapsed'}`}>
                {section.items.map((item, ii) => (
                  <NavLink
                    key={ii}
                    to={item.page}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FontAwesomeIcon icon={['fas', item.icon]} style={{ width: 18 }} />
                    <span>{item.label}</span>
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={handleLogout}>
          <div className="sidebar-avatar" style={{ background: user.color }}>{user.initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.roleTitle}</div>
          </div>
          <FontAwesomeIcon icon={faSignOutAlt} style={{ color: 'var(--text3)', fontSize: 14 }} />
        </div>
      </div>
    </div>
  )
}
