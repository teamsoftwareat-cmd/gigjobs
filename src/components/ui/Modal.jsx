import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = '540px', closeOnBackdropClick = false, fullScreen = false, zIndex = 11000 }) {
  if (!isOpen) return null
  const overlayStyle = fullScreen ? { padding: 0, alignItems: 'flex-start', zIndex } : { zIndex }
  const modalStyle = fullScreen ? { width: '100%', maxWidth: '100%', height: '100%', maxHeight: '100vh', borderRadius: 0 } : { maxWidth }
  return (
    <div className="modal-overlay" style={overlayStyle} onClick={(e) => closeOnBackdropClick && e.target === e.currentTarget && onClose()}>
      <div className="modal" style={modalStyle}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}