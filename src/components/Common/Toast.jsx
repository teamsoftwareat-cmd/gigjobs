import React from 'react'
import './Toast.css'

const Toast = ({ show, icon, message }) => {
  return (
    <div className={`toast-notify ${show ? 'show' : ''}`} style={{ zIndex: 999999 }}>
      <span className="toast-icon">{icon || '✅'}</span>
      <span className="toast-message">{message || 'Done!'}</span>
    </div>
  )
}

export default Toast
