import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { addCandidateSchema } from '../../schemas/validations'

const LOCATION_OPTIONS = ['Tambaram', 'Velachery', 'Guindy', 'OMR', 'Anna Nagar']

function AddCandidateModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    whatsapp: '',
    aadhaarNumber: '',
    fatherName: '',
    location: LOCATION_OPTIONS[0],
    presentAddress: '',
    permanentAddress: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    let finalValue = value;

    if (name === 'mobile' || name === 'whatsapp') {
      finalValue = value.replace(/\D/g, '').slice(0, 10);
    } else if (name === 'aadhaarNumber') {
      finalValue = value.replace(/\D/g, '').slice(0, 12);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }))

    // Clear validation error for this field when user starts typing
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setValidationErrors({})
    setLoading(true)

    try {
      // Validate form data with Zod
      const validatedData = addCandidateSchema.parse(formData)

      await recruiterAPI.addCandidate(validatedData)

      setFormData({
        name: '',
        email: '',
        mobile: '',
        whatsapp: '',
        aadhaarNumber: '',
        fatherName: '',
        location: LOCATION_OPTIONS[0],
        presentAddress: '',
        permanentAddress: '',
        dateOfJoining: new Date().toISOString().split('T')[0],
      })

      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err) {
      if (err.name === 'ZodError') {
        // Handle Zod validation errors
        const fieldErrors = {}
        err.errors.forEach((error) => {
          fieldErrors[error.path[0]] = error.message
        })
        setValidationErrors(fieldErrors)
        setError('Please fix the validation errors below')
      } else {
        setError(err.message || 'Failed to add candidate. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          width: '90%',
          maxWidth: 600,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add New Candidate</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                color: 'var(--red)',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}


          {/* Basic Information */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Basic Information</h4>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Full Name *
              </label>
              <input
                type="text"
                name="name"
                className={`form-control ${validationErrors.name ? 'is-invalid' : ''}`}
                placeholder="Enter candidate name"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
              />
              {validationErrors.name && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.name}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Email *
              </label>
              <input
                type="email"
                name="email"
                className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                placeholder="Enter email address"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
              {validationErrors.email && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.email}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  name="mobile"
                  className={`form-control ${validationErrors.mobile ? 'is-invalid' : ''}`}
                  placeholder="10 digit mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  disabled={loading}
                />
                {validationErrors.mobile && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                    {validationErrors.mobile}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  name="whatsapp"
                  className={`form-control ${validationErrors.whatsapp ? 'is-invalid' : ''}`}
                  placeholder="WhatsApp number"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  disabled={loading}
                />
                {validationErrors.whatsapp && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                    {validationErrors.whatsapp}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Father's Name
              </label>
              <input
                type="text"
                name="fatherName"
                className={`form-control ${validationErrors.fatherName ? 'is-invalid' : ''}`}
                placeholder="Enter father's name"
                value={formData.fatherName}
                onChange={handleChange}
                disabled={loading}
              />
              {validationErrors.fatherName && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.fatherName}
                </div>
              )}
            </div>
          </div>

          {/* Address Information */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Address Information</h4>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Location
              </label>
              <select
                name="location"
                className={`form-control ${validationErrors.location ? 'is-invalid' : ''}`}
                value={formData.location}
                onChange={handleChange}
                disabled={loading}
              >
                {LOCATION_OPTIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {validationErrors.location && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.location}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Present Address
              </label>
              <textarea
                name="presentAddress"
                className={`form-control ${validationErrors.presentAddress ? 'is-invalid' : ''}`}
                placeholder="Enter present address"
                value={formData.presentAddress}
                onChange={handleChange}
                disabled={loading}
                rows={3}
              />
              {validationErrors.presentAddress && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.presentAddress}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Permanent Address
              </label>
              <textarea
                name="permanentAddress"
                className={`form-control ${validationErrors.permanentAddress ? 'is-invalid' : ''}`}
                placeholder="Enter permanent address"
                value={formData.permanentAddress}
                onChange={handleChange}
                disabled={loading}
                rows={3}
              />
              {validationErrors.permanentAddress && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.permanentAddress}
                </div>
              )}
            </div>
          </div>

          {/* Identity Information */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600 }}>Identity Information</h4>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Aadhaar Number
              </label>
              <input
                type="text"
                name="aadhaarNumber"
                className={`form-control ${validationErrors.aadhaarNumber ? 'is-invalid' : ''}`}
                placeholder="12-digit Aadhaar number"
                value={formData.aadhaarNumber}
                onChange={handleChange}
                disabled={loading}
                maxLength="12"
              />
              {validationErrors.aadhaarNumber && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.aadhaarNumber}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
                Date of Joining
              </label>
              <input
                type="date"
                name="dateOfJoining"
                className={`form-control ${validationErrors.dateOfJoining ? 'is-invalid' : ''}`}
                value={formData.dateOfJoining}
                onChange={handleChange}
                disabled={loading}
              />
              {validationErrors.dateOfJoining && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                  {validationErrors.dateOfJoining}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {loading && <FontAwesomeIcon icon={faSpinner} spin />}
              {loading ? 'Adding...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddCandidateModal
