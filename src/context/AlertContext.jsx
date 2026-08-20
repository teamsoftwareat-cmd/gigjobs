import React, { createContext, useContext, useState, useCallback } from 'react'
import { Modal } from '../components/ui/Modal'

const AlertContext = createContext(null)

export function AlertProvider({ children }) {
  const [state, setState] = useState({ open: false })

  const showAlert = useCallback((message, title = 'Alert', options = {}) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        type: 'alert',
        title: title,
        message: String(message ?? ''),
        okLabel: options.okLabel || 'OK',
        onClose: () => {
          setState({ open: false })
          resolve()
        }
      })
    })
  }, [])

  const showConfirm = useCallback((message, title = 'Confirm', options = {}) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        type: 'confirm',
        title: title,
        message: String(message ?? ''),
        okLabel: options.okLabel || 'Yes',
        cancelLabel: options.cancelLabel || 'Cancel',
        onConfirm: () => {
          setState({ open: false })
          resolve(true)
        },
        onCancel: () => {
          setState({ open: false })
          resolve(false)
        }
      })
    })
  }, [])

  const close = useCallback(() => setState({ open: false }), [])

  return (
    <AlertContext.Provider value={{ alert: showAlert, confirm: showConfirm }}>
      {children}

      {state.open && (
        <Modal isOpen={state.open} onClose={state.type === 'confirm' ? state.onCancel || close : state.onClose || close} title={state.title} maxWidth="520px">
          <div style={{ padding: '6px 2px 12px', color: 'var(--text2)' }}>{state.message}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {state.type === 'confirm' && (
              <button className="btn btn-outline" onClick={() => (state.onCancel ? state.onCancel() : close())}>{state.cancelLabel || 'Cancel'}</button>
            )}
            <button className="btn btn-primary" onClick={() => (state.type === 'confirm' ? (state.onConfirm ? state.onConfirm() : close()) : (state.onClose ? state.onClose() : close()))}>{state.okLabel || 'OK'}</button>
          </div>
        </Modal>
      )}
    </AlertContext.Provider>
  )
}

export const useAlert = () => useContext(AlertContext)
