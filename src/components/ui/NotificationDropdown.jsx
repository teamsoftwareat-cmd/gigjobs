import { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell, faCheckCircle, faMoneyBillWave, faBriefcase,
  faFileSignature, faExclamationCircle,
} from '@fortawesome/free-solid-svg-icons'
// import { notificationsAPI } from '../../api/axios'

const INITIAL_NOTIFICATIONS = [
  { id: 1, icon: faCheckCircle, iconBg: 'var(--green-light)', iconColor: 'var(--green)', text: <>Interview confirmed at <strong>Hexaware Tech</strong> — Mar 25, 11AM</>, time: '10 mins ago', unread: true },
  { id: 2, icon: faMoneyBillWave, iconBg: 'var(--saffron-light)', iconColor: 'var(--saffron)', text: <>Payout of <strong>₹4,800</strong> credited to your bank account</>, time: '2 hrs ago', unread: true },
  { id: 3, icon: faBriefcase, iconBg: 'var(--teal-light)', iconColor: 'var(--teal)', text: <>New matching job: <strong>Data Entry at Zoho</strong> — Siruseri</>, time: 'Yesterday', unread: true },
  { id: 4, icon: faFileSignature, iconBg: 'var(--purple-light)', iconColor: 'var(--purple)', text: <>KYC verification <strong>approved</strong> — profile is 100% complete</>, time: '2 days ago', unread: true },
  { id: 5, icon: faExclamationCircle, iconBg: '#FEE2E2', iconColor: 'var(--red)', text: <>Application to <strong>TVS Group</strong> was not shortlisted</>, time: '3 days ago', unread: false },
]

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const ref = useRef(null)

  const unreadCount = notifications.filter((n) => n.unread).length

  /* ===== Close on outside click ===== */
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ===== Mark single read — PATCH /notifications/:id/read ===== */
  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, unread: false } : n))
    try { await notificationsAPI.markRead(id) } catch {}
  }

  /* ===== Mark all read — PATCH /notifications/read-all ===== */
  const markAllRead = async (e) => {
    e.stopPropagation()
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    try { await notificationsAPI.markAllRead() } catch {}
  }

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div className="icon-btn" onClick={() => setOpen((o) => !o)}>
        <FontAwesomeIcon icon={faBell} />
        {unreadCount > 0 && <div className="notif-dot" />}
      </div>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">
              Notifications{' '}
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </span>
            <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
          </div>

          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item${n.unread ? ' unread' : ''}`}
              onClick={() => markRead(n.id)}
            >
              <div className="notif-icon" style={{ background: n.iconBg, color: n.iconColor }}>
                <FontAwesomeIcon icon={n.icon} />
              </div>
              <div>
                <div className="notif-text">{n.text}</div>
                <div className="notif-time">{n.time}</div>
              </div>
            </div>
          ))}

          <div style={{ padding: '10px 16px', textAlign: 'center' }}>
            <a href="#" style={{ color: 'var(--teal)', fontSize: '12.5px', fontWeight: 600, textDecoration: 'none' }}
              onClick={(e) => e.preventDefault()}>
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
