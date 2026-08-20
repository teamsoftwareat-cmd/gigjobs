import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/* ===== BUTTON ===== */
export function Button({ children, variant = 'primary', size = '', className = '', onClick, type = 'button', disabled = false, ...props }) {
  const cls = `btn btn-${variant}${size ? ' btn-' + size : ''}${className ? ' ' + className : ''}`
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}

/* ===== CARD ===== */
export function Card({ children, className = '', style = {} }) {
  return <div className={`card ${className}`} style={style}>{children}</div>
}

export function CardHeader({ title, action }) {
  return (
    <div className="card-header">
      <div className="card-title">{title}</div>
      {action && <div>{action}</div>}
    </div>
  )
}

/* ===== TAG ===== */
export function Tag({ children, variant = 'gray', icon }) {
  return (
    <span className={`tag tag-${variant}`}>
      {icon && <FontAwesomeIcon icon={icon} style={{ fontSize: '10px' }} />}
      {children}
    </span>
  )
}

/* ===== STAT CARD ===== */
export function StatCard({ icon, iconStyle, value, label, change, changeType = 'up' }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={iconStyle}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {change && <div className={`stat-change stat-${changeType}`}>{change}</div>}
      </div>
    </div>
  )
}

/* ===== PROGRESS BAR ===== */
export function ProgressBar({ value, color = 'var(--teal)', height = 6 }) {
  return (
    <div className="progress-bar" style={{ height }}>
      <div className="progress-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  )
}

/* ===== AVATAR ===== */
export function Avatar({ initials, size = '', style = {} }) {
  return (
    <div className={`avatar${size ? ' av-' + size : ''}`} style={style}>
      {initials}
    </div>
  )
}

/* ===== MODAL ===== */
export { Modal } from './Modal'

/* ===== FORM FIELD ===== */
export function FormField({ label, error, children }) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

/* ===== DATA TABLE ===== */
export function DataTable({ columns = [], rows = [], emptyMessage = 'No data found.', getRowClassName = () => '' }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{emptyMessage}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} className={getRowClassName(row, i)}>{(row || []).map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}

export function Table({ columns = [], rows = [], emptyMessage = 'No data found.' }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((col, idx) => <th key={idx}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text2)', padding: '24px' }}>{emptyMessage}</td></tr>
            : rows.map((row, i) => (
              <tr key={i}>{(row || []).map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}

/* ===== KANBAN BOARD ===== */
export function KanbanBoard({ columns }) {
  return (
    <div className="kanban">
      {columns.map((col, i) => (
        <div className="kanban-col" key={i}>
          <div className="kanban-col-header">
            <div className="kanban-col-title">{col.title}</div>
            <div className="kanban-count">{col.count}</div>
          </div>
          {col.cards.map((card, j) => (
            <div className="kanban-card" key={j}>
              <div className="kanban-name">{card.name}</div>
              <div className="kanban-role">{card.role}</div>
              <div className="flex gap-8" style={{ marginTop: 10 }}>
                <Tag variant={card.tagVariant}>{card.tag}</Tag>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ===== TABS ===== */
export function Tabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/* ===== PAGE HEADER ===== */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

/* ===== LOADING OVERLAY ===== */
export function LoadingOverlay({ active = false, message = 'Processing...' }) {
  if (!active) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.7)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 12000,
      backdropFilter: 'blur(2px)'
    }}>
      <div className="loader"></div>
      {message && <p style={{ marginTop: '16px', fontWeight: 600, color: 'var(--text1)' }}>{message}</p>}
    </div>
  );
}

export { EmailMessenger } from './EmailMessenger'
export { WhatsAppMessenger } from './WhatsAppMessenger'
