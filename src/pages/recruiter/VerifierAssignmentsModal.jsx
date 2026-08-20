import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/index'
import VerifierProjects from '../candidate/VerifierProjects'
import VerifierProjectDetails from '../candidate/VerifierProjectDetails'
import VerifierRecipients from '../candidate/VerifierRecipients'

export default function VerifierAssignmentsModal({ isOpen, onClose, verifier }) {
  const [stage, setStage] = useState('projects') // 'projects' | 'details' | 'recipients'
  const [projectDetailsState, setProjectDetailsState] = useState(null)
  const [recipientsState, setRecipientsState] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setStage('projects')
      setProjectDetailsState(null)
      setRecipientsState(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setStage('projects')
      setProjectDetailsState(null)
      setRecipientsState(null)
    }
  }, [isOpen, verifier])

  const handleClose = () => {
    setStage('projects')
    setProjectDetailsState(null)
    setRecipientsState(null)
    onClose()
  }

  // Use registration_id from verifier object
  const registrationIdOverride = verifier ? (verifier.registration_id || verifier.registrationId || verifier.id || undefined) : undefined

  const handleViewDetails = (titleGroup) => {
    const titleName = titleGroup.title || 'Verifier Title'
    const titleId = titleGroup.title_id || titleGroup.id || titleName
    const day = titleGroup.day || 'preday'

    setProjectDetailsState({
      title: titleName,
      titleId,
      day,
    })
    setStage('details')
  }

  const handleViewRecipients = (venue) => {
    const venueName = venue.venue || venue.name || 'Venue'
    const venueId = venue.id || venueName
    const day = venue.day || venue.projectDay || projectDetailsState?.day || 'preday'

    setRecipientsState({
      title: projectDetailsState?.title,
      title_id: projectDetailsState?.titleId,
      venue: venueName,
      day,
      recipientCount: venue.recipient_count || venue.recipientCount || 0,
      calledCount: venue.called_count || venue.calledCount || 0,
      pendingCount: venue.pending_count || venue.pendingCount || 0,
    })
    setStage('recipients')
  }

  const handleBackToProjects = () => {
    setStage('projects')
    setProjectDetailsState(null)
    setRecipientsState(null)
  }

  const handleBackToDetails = () => {
    setStage('details')
    setRecipientsState(null)
  }

  const getModalTitle = () => {
    if (stage === 'projects') return `Verifier Assignments for ${verifier?.name || 'Verifier'}`
    if (stage === 'details') return `Venues — ${projectDetailsState?.title || ''}`
    if (stage === 'recipients') return `Recipients — ${recipientsState?.venue || ''}`
    return 'Verifier Assignments'
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getModalTitle()} maxWidth="90%">
      {stage === 'projects' && (
        <VerifierProjects registrationIdOverride={registrationIdOverride} onViewDetails={handleViewDetails} useRecruiterApi={true} />
      )}

      {stage === 'details' && projectDetailsState && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={handleBackToProjects}>← Back to Projects</button>
            <button className="btn btn-outline btn-sm" onClick={handleClose}>Close</button>
          </div>
          <VerifierProjectDetails initialState={projectDetailsState} registrationIdOverride={registrationIdOverride} onViewRecipients={handleViewRecipients} useRecruiterApi={true} />
        </div>
      )}

      {stage === 'recipients' && recipientsState && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={handleBackToDetails}>← Back to Venues</button>
            <button className="btn btn-outline btn-sm" onClick={handleBackToProjects}>Back to Projects</button>
            <button className="btn btn-outline btn-sm" onClick={handleClose}>Close</button>
          </div>
          <VerifierRecipients initialState={recipientsState} registrationIdOverride={registrationIdOverride} useRecruiterApi={true} />
        </div>
      )}
    </Modal>
  )
}
