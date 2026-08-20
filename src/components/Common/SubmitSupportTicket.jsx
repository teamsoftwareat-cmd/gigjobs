import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPaperclip,
  faTimesCircle,
  faTimes,
} from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { supportTicketSchema } from '../../schemas/validations'
import { ZodError } from 'zod'
import './SubmitSupportTicket.css'

const CATEGORIES = [
  'Payment/Payout Issue',
  'Attendance Correction',
  'Profile/Document Issue',
  'Application Status',
  'Technical Issue',
  'Other',
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const FILE_SIZE_LIMIT = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 5

export function SubmitSupportTicket({ candidateData = {} }) {
  const { showAlert } = useAlert()
  const [formData, setFormData] = useState({
    name: candidateData.name || '',
    mobile: candidateData.mobile || '',
    email: candidateData.email || '',
    category: '',
    priority: 'normal',
    subject: '',
    description: '',
  })

  const [attachments, setAttachments] = useState([])
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])

    // Check file count
    if (attachments.length + files.length > MAX_FILES) {
      showAlert('error', `Maximum ${MAX_FILES} files allowed`)
      return
    }

    // Validate file sizes
    const invalidFiles = files.filter((file) => file.size > FILE_SIZE_LIMIT)
    if (invalidFiles.length > 0) {
      showAlert('error', 'Some files exceed 5MB limit')
      return
    }

    setAttachments((prev) => [...prev, ...files])
  }

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})

    try {
      // Validate form data
      const validated = supportTicketSchema.parse({
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        category: formData.category,
        priority: formData.priority,
        subject: formData.subject,
        description: formData.description,
        attachments: attachments,
      })

      setSubmitting(true)

      // Create FormData for file upload
      const formDataObj = new FormData()
      formDataObj.append('name', validated.name)
      formDataObj.append('mobile', validated.mobile)
      formDataObj.append('email', validated.email)
      formDataObj.append('category', validated.category)
      formDataObj.append('priority', validated.priority)
      formDataObj.append('subject', validated.subject)
      formDataObj.append('description', validated.description)

      attachments.forEach((file, index) => {
        formDataObj.append(`attachments[${index}]`, file)
      })

      // Submit ticket
      await recruiterAPI.submitTicket(formDataObj)

      setSubmitted(true)

      // Reset form after 2 seconds
      setTimeout(() => {
        setFormData({
          name: candidateData.name || '',
          mobile: candidateData.mobile || '',
          email: candidateData.email || '',
          category: '',
          priority: 'normal',
          subject: '',
          description: '',
        })
        setAttachments([])
        setSubmitted(false)
      }, 2000)
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = {}
        error.errors.forEach((err) => {
          const path = err.path[0]
          fieldErrors[path] = err.message
        })
        setErrors(fieldErrors)
      } else {
        showAlert('error', error.message || 'Failed to submit ticket')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="support-success-state">
        <div className="success-icon">✓</div>
        <h2>Ticket Submitted Successfully</h2>
        <p>Our support team will review your issue and get back to you within 24 hours.</p>
        <p className="ticket-ref">You'll receive updates via email and SMS.</p>
      </div>
    )
  }

  return (
    <div className="support-ticket-container">
      <div className="ticket-header">
        <h1>Submit Support Ticket</h1>
        <p>Describe your issue in detail for faster resolution</p>
      </div>

      <form onSubmit={handleSubmit} className="ticket-form">
        {/* Row 1: Name and Mobile */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">YOUR NAME</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Your full name"
              disabled={!!candidateData.name}
              className={errors.name ? 'input-error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="mobile">MOBILE / EMAIL</label>
            <input
              id="mobile"
              type="text"
              name="mobile"
              value={formData.mobile}
              onChange={handleInputChange}
              placeholder="+91 98765 43210"
              disabled={!!candidateData.mobile}
              className={errors.mobile ? 'input-error' : ''}
            />
            {errors.mobile && <span className="error-text">{errors.mobile}</span>}
          </div>
        </div>

        {/* Row 2: Category and Priority */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">ISSUE CATEGORY</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={errors.category ? 'input-error' : ''}
            >
              <option value="">-- Select Category --</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <span className="error-text">{errors.category}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="priority">PRIORITY</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject */}
        <div className="form-group">
          <label htmlFor="subject">SUBJECT / TITLE</label>
          <input
            id="subject"
            type="text"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            placeholder="Brief summary of your issue"
            className={errors.subject ? 'input-error' : ''}
          />
          {errors.subject && <span className="error-text">{errors.subject}</span>}
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">DESCRIBE YOUR ISSUE</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Please provide details: dates, amounts, assignment name, error messages etc. The more detail, the faster we can resolve it."
            rows="6"
            className={errors.description ? 'input-error' : ''}
          />
          {errors.description && <span className="error-text">{errors.description}</span>}
        </div>

        {/* File Upload */}
        <div className="form-group">
          <label>ATTACH SUPPORTING DOCUMENTS (OPTIONAL)</label>
          <div className="file-upload-zone">
            <input
              type="file"
              id="file-input"
              multiple
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="file-upload-label">
              <div className="upload-icon">
                <FontAwesomeIcon icon={faPaperclip} />
              </div>
              <div className="upload-text">
                <strong>Drag & drop files here or click to browse</strong>
                <p>Screenshots, payment proofs, Aadhaar/PAN copies — Max 5MB each</p>
              </div>
            </label>
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="attachments-list">
              {attachments.map((file, index) => (
                <div key={index} className="attachment-item">
                  <FontAwesomeIcon icon={faPaperclip} className="file-icon" />
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="btn-remove"
                    title="Remove file"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="file-info">
            {attachments.length}/{MAX_FILES} files attached
          </p>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-submit"
          >
            {submitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
          <button
            type="button"
            className="btn btn-clear"
            onClick={() => {
              setFormData({
                name: candidateData.name || '',
                mobile: candidateData.mobile || '',
                email: candidateData.email || '',
                category: '',
                priority: 'normal',
                subject: '',
                description: '',
              })
              setAttachments([])
              setErrors({})
            }}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  )
}
