import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun, faBars } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import NotificationDropdown from '../ui/NotificationDropdown'

export default function Header({ title, subtitle, onMenuClick }) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()

  return (
    <div className="header">
      <div className="header-menu-btn icon-btn" onClick={onMenuClick}>
        <FontAwesomeIcon icon={faBars} />
      </div>
      <div>
        <div className="header-title">{title || 'Dashboard'}</div>
        <div className="header-breadcrumb">{subtitle || 'Cynosurejobs.net'}</div>
      </div>

      <div className="header-actions">
        <NotificationDropdown />

        <div className="icon-btn" onClick={toggleTheme} title="Toggle dark mode">
          <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
        </div>

        {user && (
          <div
            className="sidebar-avatar av-sm"
            style={{ marginLeft: 4, cursor: 'pointer', background: user.color }}
          >
            {user.initials}
          </div>
        )}
      </div>
    </div>
  )
}


