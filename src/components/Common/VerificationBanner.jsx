import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faIdCard } from '@fortawesome/free-solid-svg-icons'

export default function VerificationBanner({
  message,
  buttonText = 'Verify now',
  onAction,
  icon = faIdCard,
}) {
  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <FontAwesomeIcon icon={icon} style={styles.icon} />
        <span style={styles.message}>{message}</span>
      </div>
      {onAction && (
        <button type="button" style={styles.button} onClick={onAction}>
          {buttonText}
        </button>
      )}
    </div>
  )
}

const styles = {
  banner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fefce8',
    border: '1px solid #fcd34d',
    borderRadius: 12,
    padding: '14px 18px',
    marginBottom: 16,
    gap: 16,
    flexWrap: 'wrap',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  icon: {
    color: '#b45309',
    fontSize: 20,
    flexShrink: 0,
  },
  message: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 1.4,
    minWidth: 0,
  },
  button: {
    border: 'none',
    borderRadius: 8,
    background: '#b45309',
    color: '#fff',
    padding: '10px 16px',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
}
