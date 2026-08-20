import React, { useState, useEffect, useRef } from 'react'
import Toast from './Toast'

const GlobalToastProvider = ({ children }) => {
  const [toast, setToast] = useState({ show: false, icon: '', message: '' })
  const timeoutRef = useRef(null)

  const showToast = (icon, message, duration = 3000) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToast({ show: true, icon, message })
    if (typeof duration === 'number' && duration > 0) {
      timeoutRef.current = setTimeout(() => setToast({ show: false, icon: '', message: '' }), duration)
    } else {
      timeoutRef.current = null
    }
  }

  useEffect(() => {
    const handler = (e) => {
      const detail = e?.detail || {}
      const type = detail.type || 'success'
      const message = detail.message || ''
      if (!message) return
      const icon = detail.icon || (type === 'success' ? '✅' : '❌')
      const duration = typeof detail.duration === 'number' ? detail.duration : undefined
      showToast(icon, message, duration)
    }

    window.addEventListener('apiMessage', handler)
    return () => window.removeEventListener('apiMessage', handler)
  }, [])

  return (
    <>
      {children}
      <Toast show={toast.show} icon={toast.icon} message={toast.message} />
    </>
  )
}

export default GlobalToastProvider
