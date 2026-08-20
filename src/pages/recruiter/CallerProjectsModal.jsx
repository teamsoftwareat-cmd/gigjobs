import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/index'
import CallingProjects from '../candidate/CallingProjects'
import CallingRecipients from '../candidate/CallingRecipients'

export default function CallerProjectsModal({ isOpen, onClose, caller }) {
  const [stage, setStage] = useState('projects') // 'projects' | 'recipients'
  const [recipientsState, setRecipientsState] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setStage('projects')
      setRecipientsState(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setStage('projects')
      setRecipientsState(null)
    }
  }, [isOpen, caller])

  const handleClose = () => {
    setStage('projects')
    setRecipientsState(null)
    onClose()
  }

  // Prefer registration_id returned by getAssignedCallers when available
  const registrationIdOverride = caller ? (caller.registration_id || caller.calling_team_login_id || caller.id || undefined) : undefined

  const handleViewRecipients = (navState) => {
    setRecipientsState(navState)
    setStage('recipients')
  }

  const handleBack = () => {
    setStage('projects')
    setRecipientsState(null)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={stage === 'projects' ? `Projects for ${caller?.name || 'Caller'}` : `Recipients — ${recipientsState?.projectName || ''}`} maxWidth="90%">
      {stage === 'projects' && (
        <CallingProjects registrationIdOverride={registrationIdOverride} onViewRecipients={handleViewRecipients} useRecruiterApi={true} />
      )}

      {stage === 'recipients' && recipientsState && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={handleBack}>← Back</button>
            <button className="btn btn-outline btn-sm" onClick={handleClose}>Close</button>
          </div>
          <CallingRecipients initialState={recipientsState} useRecruiterApi={true} registrationIdOverride={registrationIdOverride} onBack={handleBack} />
        </div>
      )}
    </Modal>
  )
}
