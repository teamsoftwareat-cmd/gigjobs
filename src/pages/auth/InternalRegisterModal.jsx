import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faLock,
  faMobileAlt,
  faEnvelope,
  faUserShield,
} from '@fortawesome/free-solid-svg-icons'
import { authAPI } from '../../api/axios'
import { createInternalUserSchema } from '../../schemas/validations'
import './InternalRegisterModal.css'

export default function InternalRegisterModal({ onClose }) {
  const firstInputRef = useRef(null)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    role: 'recruiter',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  const resetForm = () => {
    setForm({
      fullName: '',
      email: '',
      mobileNumber: '',
      role: 'recruiter',
      password: '',
      confirmPassword: '',
    })
    setFieldErrors({})
    setError(null)
    setSuccess(null)
  }

  const validateForm = (candidateForm) => {
    const result = createInternalUserSchema.safeParse(candidateForm)
    if (result.success) {
      setFieldErrors({})
      return true
    }

    const nextErrors = {}
    result.error.errors.forEach((issue) => {
      const path = issue.path[0] || 'form'
      nextErrors[path] = issue.message
    })
    setFieldErrors(nextErrors)
    return false
  }

  const updateField = (field, value) => {
    let nextValue = value
    if (field === 'mobileNumber') {
      nextValue = nextValue.replace(/\D/g, '').slice(0, 10)
    }

    const nextForm = { ...form, [field]: nextValue }
    setForm(nextForm)
    validateForm(nextForm)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleCreateUser = async (event) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const validated = createInternalUserSchema.parse(form)
      setLoading(true)

      const payload = {
        name: validated.fullName,
        email: validated.email,
        username: validated.mobileNumber,
        password: validated.password,
        role: validated.role,
      }

      const result = await authAPI.createInternalUser(payload)
      const message = result?.data?.message || 'Internal user created successfully.'
      setSuccess(message)
      resetForm()
    } catch (err) {
      if (err?.errors) {
        setError(err.errors.map((item) => item.message).join('. '))
      } else {
        const message = err?.response?.data?.message || err?.message || 'Unable to create internal user.'
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal modern register-modal" onClick={(e) => e.stopPropagation()}>
        <div className="register-header">
          <div>
            <div className="register-tag">Welcome aboard!</div>
            <h2 className="register-title">Create internal access</h2>
            <p className="register-description">
              Add a secured recruiter, admin, or accounts user with a phone-based login.
            </p>
          </div>

          <button className="modal-close" onClick={handleClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-body register-body">
          {error && <div className="alert-error">{error}</div>}
          {success && <div className="alert-success">{success}</div>}

          <form onSubmit={handleCreateUser} className="register-form">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full name</label>
                <div className="input-with-icon">
                  <span className="input-icon">👤</span>
                  <input
                    ref={firstInputRef}
                    className={`form-control ${fieldErrors.fullName ? 'input-error' : ''}`}
                    value={form.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    placeholder="Enter full name"
                  />
                </div>
                {fieldErrors.fullName && <div className="field-error">{fieldErrors.fullName}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Mobile number</label>
                <div className="input-with-icon">
                  <FontAwesomeIcon icon={faMobileAlt} className="input-icon" />
                  <input
                    className={`form-control ${fieldErrors.mobileNumber ? 'input-error' : ''}`}
                    value={form.mobileNumber}
                    onChange={(e) => updateField('mobileNumber', e.target.value)}
                    placeholder="Enter mobile number"
                  />
                </div>
                {fieldErrors.mobileNumber && <div className="field-error">{fieldErrors.mobileNumber}</div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="input-with-icon">
                <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                <input
                  type="email"
                  className={`form-control ${fieldErrors.email ? 'input-error' : ''}`}
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className={`form-control ${fieldErrors.role ? 'input-error' : ''}`}
                value={form.role}
                onChange={(e) => updateField('role', e.target.value)}
              >
                <option value="recruiter">Recruiter</option>
                <option value="admin">Admin</option>
                <option value="accounts">Accounts</option>
                <option value="client">Client</option>
              </select>
              {fieldErrors.role && <div className="field-error">{fieldErrors.role}</div>}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-with-icon">
                  <FontAwesomeIcon icon={faLock} className="input-icon" />
                  <input
                    type="password"
                    className={`form-control ${fieldErrors.password ? 'input-error' : ''}`}
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Type your password"
                  />
                </div>
                {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    className={`form-control ${fieldErrors.confirmPassword ? 'input-error' : ''}`}
                    value={form.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                {fieldErrors.confirmPassword && <div className="field-error">{fieldErrors.confirmPassword}</div>}
              </div>
            </div>

            <button className="btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? 'Creating user…' : 'Create account'}
            </button>
          </form>

          <div className="register-footnote">
            By adding an internal user, you allow secure access to the recruiter and operations dashboard.
          </div>
        </div>
      </div>
    </div>
  )
}
