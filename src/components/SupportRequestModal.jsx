import React, { useState, useEffect } from 'react'
import { Modal, FormField, Button } from './ui/index'
import FileUpload from './ui/FileUpload'
import { publicAPI, recruiterAPI } from '../api/axios'
import { useAlert } from '../context/AlertContext'

const ISSUE_CATEGORIES = [
  'Payment / Payout Issue',
  'Attendance Correction',
  'KYC / Document Issue',
  'Job Application Problem',
  'Offer / Joining Issue',
  'Contract / Agreement',
  'Harassment / Misconduct',
  'Registration Issue (Portal)',
  'Other'
]

const AADHAAR_REQUIRED_CATEGORIES = [
  'Payment / Payout Issue',
  'Attendance Correction',
  'KYC / Document Issue'
]

const createInitialFormState = () => ({
  name: '',
  mobile: '',
  email: '',
  project: '',
  projectType: 'regular',
  aadhaar: '',
  location: '',
  district: '',
  centre: '',
  category: '',
  subject: '',
  description: '',
})

export default function SupportRequestModal({ isOpen, onClose, variant = 'modal' }) {
  const [form, setForm] = useState(createInitialFormState())
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [projectOptions, setProjectOptions] = useState([])
  const [locationOptions, setLocationOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [centreOptions, setCentreOptions] = useState([])
  const [projectLoading, setProjectLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [districtLoading, setDistrictLoading] = useState(false)
  const [centreLoading, setCentreLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { alert } = useAlert()

  const isAadhaarRequired = AADHAAR_REQUIRED_CATEGORIES.includes(form.category)

  const normalizeOptionList = (rawList) =>
    (Array.isArray(rawList) ? rawList : [])
      .map((item) => {
        if (!item) return null
        if (typeof item === 'string' || typeof item === 'number') {
          const value = String(item)
          return { id: value, name: value }
        }

        const id = String(
          item.id ??
          item.project_id ??
          item.value ??
          item.key ??
          item._id ??
          item.projectId ??
          item.locationId ??
          item.name ??
          item.label ??
          ''
        )
        const name = String(
          item.name ??
          item.project_name ??
          item.title ??
          item.label ??
          item.value ??
          id
        )
        return id ? { id, name } : null
      })
      .filter(Boolean)

  const extractOptionArray = (response) => {
    const payload = response?.data ?? {}
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.projects)) return payload.projects
    if (Array.isArray(payload?.results)) return payload.results
    if (Array.isArray(payload?.locations)) return payload.locations
    if (Array.isArray(payload?.location_options)) return payload.location_options
    if (Array.isArray(payload?.locationOptions)) return payload.locationOptions
    if (Array.isArray(payload?.districts)) return payload.districts
    if (Array.isArray(payload?.centres)) return payload.centres
    if (Array.isArray(payload)) return payload
    return []
  }

  const normalizeProjectOption = (item) => {
    if (!item) return null
    if (typeof item === 'string' || typeof item === 'number') {
      const value = String(item)
      return { id: value, name: value, projectType: 'regular' }
    }

    const id = String(
      item.id ??
      item.project_id ??
      item.value ??
      item.key ??
      item._id ??
      item.projectId ??
      item.project_id ??
      item.project ??
      ''
    )
    const name = String(
      item.projectName ??
      item.name ??
      item.project_name ??
      item.title ??
      item.label ??
      item.value ??
      id
    )
    const rawProjectType = String(
      item.projectKind ??
      item.project_type ??
      item.projectType ??
      item.kind ??
      item.type ??
      ''
    ).toLowerCase()
    const projectType = rawProjectType === 'written' || rawProjectType === 'writtenexam' || rawProjectType === 'written_exam' ? 'written' : 'regular'

    return id ? { id, name, projectType } : null
  }

  const normalizeProjectIdForApi = (value) => {
    const rawValue = value == null ? '' : String(value)
    return rawValue.replace(/^proj_/i, '')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validateEmail = (value) => {
    const v = String(value || '').trim()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  }

  const validateMobile = (value) => {
    const v = String(value || '').replace(/[^0-9]/g, '')
    return /^\d{10}$/.test(v)
  }

  const validateAadhaar = (value) => {
    const v = String(value || '').replace(/[^0-9]/g, '')
    return /^\d{12}$/.test(v)
  }

  useEffect(() => {
    if (variant === 'modal' && !isOpen) return

    const loadProjectOptions = async () => {
      setProjectLoading(true)
      try {
        const response = await recruiterAPI.getProjectsSupport({ limit: 1000 })
        const payload = response?.data ?? {}
        const rawList = Array.isArray(payload?.data?.items)
          ? payload.data.items
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data)
              ? payload.data
              : []

        const combined = rawList.map(normalizeProjectOption).filter(Boolean)
        setProjectOptions(combined)
      } catch (error) {
        setProjectOptions([])
      } finally {
        setProjectLoading(false)
      }
    }

    setForm(createInitialFormState())
    setFiles([])
    setLocationOptions([])
    setDistrictOptions([])
    setCentreOptions([])
    loadProjectOptions()
  }, [isOpen, variant])

  const handleProjectChange = async (e) => {
    const project = e.target.value
    const selectedProject = projectOptions.find((option) => option.id === project)
    const projectType = selectedProject?.projectType || 'regular'

    setForm((prev) => ({
      ...prev,
      project,
      projectType,
      location: '',
      district: '',
      centre: '',
    }))
    setLocationOptions([])
    setDistrictOptions([])
    setCentreOptions([])

    if (!project) {
      return
    }

    const normalizedProjectId = normalizeProjectIdForApi(project)

    if (projectType === 'written') {
      setDistrictLoading(true)
      try {
        const response = await recruiterAPI.getProjectDistricts(normalizedProjectId)
        const rawList = extractOptionArray(response)
        setDistrictOptions(normalizeOptionList(rawList))
      } catch (error) {
        setDistrictOptions([])
      } finally {
        setDistrictLoading(false)
      }
      return
    }

    setLocationLoading(true)
    try {
      const response = await recruiterAPI.getProjectLocations(normalizedProjectId)
      const rawList = extractOptionArray(response)
      setLocationOptions(normalizeOptionList(rawList))
    } catch (error) {
      setLocationOptions([])
    } finally {
      setLocationLoading(false)
    }
  }

  const handleDistrictChange = async (e) => {
    const district = e.target.value
    setForm((prev) => ({ ...prev, district, centre: '' }))
    setCentreOptions([])

    if (!district || !form.project) {
      return
    }

    setCentreLoading(true)
    try {
      const response = await recruiterAPI.getDistrictCentres(normalizeProjectIdForApi(form.project), district)
      const rawList = extractOptionArray(response)
      setCentreOptions(normalizeOptionList(rawList))
    } catch (error) {
      setCentreOptions([])
    } finally {
      setCentreLoading(false)
    }
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }

    if (typeof window !== 'undefined' && window.history?.length > 1) {
      window.history.back()
    } else {
      window.location.assign('#/')
    }
  }

  const handleOpenInNewPage = () => {
    const targetUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#/support-request`
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateEmail(form.email)) {
      await alert('Please enter a valid email address.')
      return
    }

    if (!validateMobile(form.mobile)) {
      await alert('Please enter a valid 10-digit mobile number.')
      return
    }

    if (isAadhaarRequired && !validateAadhaar(form.aadhaar)) {
      await alert('Aadhaar number is required and should be a 12-digit number.')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value)
        }
      })
      files.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file)
      })

      await publicAPI.submitTicket(formData)

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setForm(createInitialFormState())
        setFiles([])
        setLocationOptions([])
        setDistrictOptions([])
        setCentreOptions([])
        handleClose()
      }, 2000)
    } catch (error) {
      console.error('Submission failed', error)
      await alert(error.response?.data?.message || 'Failed to submit support request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderForm = () => (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormField label="Issue Category">
            <select name="category" className="form-control" value={form.category} onChange={handleChange} required>
              <option value="">Select a category</option>
              {ISSUE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Full Name">
              <input name="name" className="form-control" value={form.name} onChange={handleChange} required placeholder="Your name" />
            </FormField>
            <FormField label="Mobile Number">
              <input name="mobile" type="tel" className="form-control" value={form.mobile} onChange={handleChange} required placeholder="10-digit number" pattern="\d{10}" maxLength={10} />
            </FormField>
          </div>

          <FormField label="Email Address">
            <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange} required placeholder="email@example.com" />
          </FormField>

          <FormField label="Aadhaar Number">
            <input name="aadhaar" type="text" className="form-control" value={form.aadhaar} onChange={handleChange} placeholder="12-digit Aadhaar number" required={isAadhaarRequired} maxLength={12} pattern="\d{12}" />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Project">
              <select
                name="project"
                className="form-control"
                value={form.project}
                onChange={handleProjectChange}
                required
              >
                <option value="">Select a project</option>
                {projectLoading ? (
                  <option value="">Loading projects...</option>
                ) : (
                  projectOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))
                )}
              </select>
            </FormField>

            {form.projectType === 'written' ? (
              <FormField label="District">
                <select
                  name="district"
                  className="form-control"
                  value={form.district}
                  onChange={handleDistrictChange}
                  required
                  disabled={!form.project || districtLoading}
                >
                  <option value="">
                    {districtLoading ? 'Loading districts...' : 'Select district'}
                  </option>
                  {districtOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </FormField>
            ) : (
              <FormField label="Location">
                <select
                  name="location"
                  className="form-control"
                  value={form.location}
                  onChange={handleChange}
                  required
                  disabled={!form.project || locationLoading}
                >
                  <option value="">
                    {locationLoading ? 'Loading locations...' : 'Select location'}
                  </option>
                  {locationOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </FormField>
            )}
          </div>

          {form.projectType === 'written' && (
            <FormField label="Centre">
              <select
                name="centre"
                className="form-control"
                value={form.centre}
                onChange={handleChange}
                required
                disabled={!form.district || centreLoading}
              >
                <option value="">
                  {centreLoading ? 'Loading centres...' : 'Select centre'}
                </option>
                {centreOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {/* Issue Category moved above */}

          <FormField label="Subject">
            <input name="subject" className="form-control" value={form.subject} onChange={handleChange} required placeholder="Brief summary of the issue" />
          </FormField>

          <FormField label="Description">
            <textarea name="description" className="form-control" rows={4} value={form.description} onChange={handleChange} required placeholder="Describe your issue in detail..." />
          </FormField>

          <FormField label="Supporting Documents (Optional)">
            <FileUpload multiple onFilesChange={setFiles} helperText="Upload screenshots or relevant PDF/Images (Max 5MB each)" />
          </FormField>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Request'}</Button>
          </div>
        </form>
  )

  if (variant === 'page') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)', padding: '24px 28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#0f172a' }}>Contact Support</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b' }}>Submit your issue here and our team will follow up shortly.</p>
          </div>

          {success ? (
            <div className="alert-success" style={{ padding: '20px', textAlign: 'center' }}>
              ✓ Support request submitted successfully! Our team will get back to you shortly.
            </div>
          ) : (
            renderForm()
          )}
        </div>
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Contact Support" maxWidth="600px" style={{ color: '#0f172a' }}>
      {success ? (
        <div className="alert-success" style={{ padding: '20px', textAlign: 'center' }}>
          ✓ Support request submitted successfully! Our team will get back to you shortly.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <Button type="button" variant="outline" onClick={handleOpenInNewPage}>Open in new page</Button>
          </div>
          {renderForm()}
        </>
      )}
    </Modal>
  )
}