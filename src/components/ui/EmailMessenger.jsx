import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEnvelope, faBold, faItalic, faUnderline } from '@fortawesome/free-solid-svg-icons'
import { useAlert } from '../../context/AlertContext'
import FileUpload from './FileUpload'
import './MessageComposer.css'

const extractVariables = (text = '') => {
  const vars = new Set()
  const regex = /{{\s*([^{}\s]+)\s*}}/g
  let match
  while ((match = regex.exec(text))) {
    vars.add(match[1])
  }
  return [...vars]
}

const interpolateTemplate = (text, values) => {
  return String(text || '').replace(/{{\s*([^{}\s]+)\s*}}/g, (_, key) => {
    const replacement = values[key]
    return replacement != null && replacement !== '' ? replacement : `{{${key}}}`
  })
}

export function EmailMessenger({
  isOpen = false,
  templates = [],
  recipientEmail = '',
  recipientName = '',
  recipients = [],
  initialCc = '',
  onClose,
  onSend,
  onSaveTemplate,
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates.length ? templates[0].id : 'custom')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [cc, setCc] = useState(initialCc)
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  )

  useEffect(() => {
    if (!selectedTemplate) {
      return
    }

    setSubject(selectedTemplate.subject || '')
    setBody(selectedTemplate.body || '')
  }, [selectedTemplate])

  const { alert } = useAlert()

  // Direct values for sending, no interpolation needed for simplified email
  const currentSubject = selectedTemplate?.subject || subject
  const currentBody = selectedTemplate?.body || body

  // If the API expects templateId and variables even for non-templated emails,
  // we can pass null for templateId and an empty object for variables.
  // For this simplified version, we are not passing templateId or variables.
  // The `onSend` function in SupportTickets.jsx will handle adding templateId and variables if needed.

  const handleSend = async () => {
    if (!recipientEmail?.trim()) {
      return alert('Recipient email is required.')
    }
    if (!currentSubject.trim() || !currentBody.trim()) {
      return alert('Subject and message cannot be empty.')
    }

    if (typeof onSend === 'function') {
      setSending(true)
      try {
        const payload = {
          to: recipientEmail, // Assuming single recipient for simplicity, or handle multiple in onSend
          cc: cc.trim(),
          subject: currentSubject.trim(),
          body: currentBody.trim(),
        }

        // Transform attachments array into indexed keys for backend compatibility
        attachments.forEach((file, index) => {
          payload[`attachments[${index}]`] = file
        })

        await onSend(payload)
      } catch (error) {
        console.error(error)
        await alert('Failed to send email. Please try again.')
      } finally {
        setSending(false)
      }
    }
  }

  const handleSaveTemplate = async () => {
    if (!onSaveTemplate) return
    if (!currentSubject.trim() || !currentBody.trim()) {
      return alert('Subject and body are required to save a template.')
    }

    try {
      setSavingTemplate(true)
      await onSaveTemplate({
        id: `template_${Date.now()}`, // Generate a unique ID for custom templates
        name: `Custom template ${templates.length + 1}`,
        subject: subject.trim(),
        body: body.trim(),
        variables: extractVariables(`${subject}\n${body}`),
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="offcanvas-backdrop" />

      {/* Offcanvas */}
      <div className="offcanvas offcanvas-end offcanvas-email">
        {/* Header */}
        <div className="offcanvas-header">
          <div>
            <h5 className="offcanvas-title">
              <FontAwesomeIcon icon={faEnvelope} /> Send Email Messages
            </h5>
            {recipients?.length > 0 && (
              <p className="recipients-count">{recipients.length} candidates selected</p>
            )}
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>

        {/* Body */}
        <div className="offcanvas-body">
          {/* Recipients Summary */}
          {recipients?.length > 0 && (
            <div className="recipients-badge-group">
              <div className="recipients-badge">
                <span className="badge-icon">👥</span>
                <span>Selected Candidates</span>
                <span className="badge-count">{recipients.length}</span>
              </div>
            </div>
          )}

          {/* To Field */}
          <div className="email-field">
            <label>To</label>
            <input
              type="text"
              className="email-input"
              value={recipientEmail || `${recipients?.length || 0} selected candidates`}
              disabled
            />
            <small className="field-help">Emails will be sent individually to each selected candidate</small>
          </div>

          {/* CC Field */}
          <div className="email-field">
            <label>CC</label>
            <input
              type="text"
              className="email-input"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com (comma separated for multiple)"
            />
          </div>

          {/* Template Selection */}
          {templates.length > 0 && (
            <div className="email-field">
              <label>Select Template</label>
              <select
                className="email-select"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="custom">Compose new message</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject Field */}
          <div className="email-field">
            <label>Subject</label>
            <input
              type="text"
              className="email-input"
              value={selectedTemplate?.subject || subject}
              onChange={(e) => {
                if (!selectedTemplate) setSubject(e.target.value)
                else {
                  setSelectedTemplateId('custom')
                  setSubject(e.target.value)
                }
              }}
              placeholder="Enter email subject"
            />
          </div>

          {/* Message Body with Formatting */}
          <div className="email-field">
            <label>Message Body</label>
            <div className="text-toolbar">
              <button type="button" className="toolbar-btn" title="Bold">
                <FontAwesomeIcon icon={faBold} />
              </button>
              <button type="button" className="toolbar-btn" title="Italic">
                <FontAwesomeIcon icon={faItalic} />
              </button>
              <button type="button" className="toolbar-btn" title="Underline">
                <FontAwesomeIcon icon={faUnderline} />
              </button>
            </div>
            <textarea
              className="email-textarea"
              value={selectedTemplate?.body || body}
              onChange={(e) => {
                if (!selectedTemplate) setBody(e.target.value)
                else {
                  setSelectedTemplateId('custom')
                  setBody(e.target.value)
                }
              }}
              placeholder="Write your email message here..."
            />
          </div>

          {/* Attachments */}
          <div className="email-field">
            <label>Attachments</label>
            <FileUpload
              multiple={true}
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
              onFilesChange={setAttachments}
              placeholder="Click to upload or drag and drop"
              helperText="PDF, DOC, DOCX, TXT, XLS, XLSX (Max 10MB each)"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="offcanvas-footer" style={{flexDirection: "row", flexWrap: "nowrap"}}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          {onSaveTemplate && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
            >
              {savingTemplate ? 'Saving...' : 'Save Template'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || !recipientEmail}
          >
            <span className="btn-icon">✉️</span>
            {sending ? 'Sending...' : `Send via Email to ${recipients?.length || 0}`}
          </button>
        </div>
      </div>
    </>
  )
}
