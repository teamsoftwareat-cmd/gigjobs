import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAlert } from '../../context/AlertContext'
import { PageHeader, FormField, Button, Modal } from '../../components/ui'
import FileUpload from '../../components/ui/FileUpload'
import { candidateAPI, publicAPI, recruiterAPI } from '../../api/axios'

const ISSUE_CATEGORIES = [
  'Payment / Payout Issue',
  'Attendance Correction',
  'KYC / Document Issue',
  'Job Application Problem',
  'Offer / Joining Issue',
  'Contract / Agreement',
  'Harassment / Misconduct',
  'Registration Issue (Portal)',
  'Invoice / Billing (Client)',
  'Worker Performance (Client)',
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
  description: ''
})

export default function CandidateSupportPage() {
  const { user } = useAuth()
  const { alert } = useAlert()
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
  const [formOpen, setFormOpen] = useState(true)
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketDetailLoading, setTicketDetailLoading] = useState(false)

  const registrationId = user?.registrationId || user?.registration_id || user?.id || user?.candidateId

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
    if (Array.isArray(response)) return response
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

  useEffect(() => {
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

    loadProjectOptions()
  }, [])

  useEffect(() => {
    if (!registrationId) return

    const loadCandidateTickets = async () => {
      setTicketsLoading(true)
      try {
        const res = await candidateAPI.getSupportTickets(registrationId, { limit: 100, offset: 0 })
        const payload = res?.data ?? {}
        const list = Array.isArray(payload?.data?.tickets)
          ? payload.data.tickets
          : Array.isArray(payload?.tickets)
            ? payload.tickets
            : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload)
                ? payload
                : []
        setTickets(list)
      } catch (error) {
        setTickets([])
      } finally {
        setTicketsLoading(false)
      }
    }

    loadCandidateTickets()
  }, [registrationId])

  useEffect(() => {
    if (!user) return
    setForm((prev) => ({
      ...prev,
      name: user.name || prev.name || '',
      email: user.email || prev.email || '',
      mobile: user.mobile || prev.mobile || ''
    }))
  }, [user])

  const isAadhaarRequired = AADHAAR_REQUIRED_CATEGORIES.includes(form.category)

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
      centre: ''
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

  const formatDate = (value) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const getTicketStatusLabel = (status) => {
    const key = String(status || '').toLowerCase()
    if (key === 'inreview' || key === 'in_review') return 'In Review'
    if (key === 'resolved') return 'Resolved'
    if (key === 'open') return 'Open'
    return String(status || 'Unknown')
  }

  const getTicketAadhaar = (ticket) => {
    return ticket?.aadhaar || ticket?.aadhaarNumber || ticket?.aadhaar_no || ticket?.aadhar || ticket?.aadhaarNo || ticket?.identification || '-'
  }

  const getTicketValue = (ticket, keys, fallback = '-') => {
    for (const key of keys) {
      if (ticket?.[key]) return ticket[key]
    }
    return fallback
  }

  const handleViewTicketDetails = async (ticket) => {
    if (!ticket?.id) return
    setTicketDetailLoading(true)
    try {
      const res = await candidateAPI.getSupportTicketDetails(ticket.id, registrationId)
      const payload = res?.data ?? {}
      const details = payload?.data || payload || ticket
      setSelectedTicket(details)
    } catch (error) {
      setSelectedTicket(ticket)
    } finally {
      setTicketDetailLoading(false)
    }
  }

  const closeTicketModal = () => {
    setSelectedTicket(null)
  }

  const tableHeaderStyle = {
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: 600,
    color: '#111827',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  }

  const tableCellStyle = {
    padding: '14px 16px',
    fontSize: '14px',
    color: '#374151',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
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
      if (user?.registrationId) {
        formData.append('registration_id', user.registrationId)
      }
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
      }, 2000)
      if (registrationId) {
        try {
          const res = await candidateAPI.getSupportTickets(registrationId, { limit: 100, offset: 0 })
          const payload = res?.data ?? {}
          const list = Array.isArray(payload?.data?.tickets)
            ? payload.data.tickets
            : Array.isArray(payload?.tickets)
              ? payload.tickets
              : Array.isArray(payload?.data)
                ? payload.data
                : Array.isArray(payload)
                  ? payload
                  : []
          setTickets(list)
        } catch (err) {
          // ignore ticket refresh errors
        }
      }
    } catch (error) {
      console.error('Submission failed', error)
      await alert(error.response?.data?.message || 'Failed to submit support request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle="Submit issues and review your previous support tickets."
      />

      <div style={{ padding: '20px' }}>
        {success && (
          <div className="alert-success" style={{ padding: '20px', textAlign: 'center', marginBottom: 20 }}>
            ✓ Support request submitted successfully! Our team will get back to you shortly.
          </div>
        )}

        <div style={{ border: '1px solid #d1d5db', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '16px 20px',
              background: '#f8fafc',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Submit a Support Request</span>
            <span>{formOpen ? '−' : '+'}</span>
          </button>
          {formOpen && (
            <div style={{ padding: '20px', background: '#ffffff' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <FormField label="Issue Category">
                  <select
                    name="category"
                    className="form-control"
                    value={form.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a category</option>
                    {ISSUE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label="Full Name">
                    <input
                      name="name"
                      className="form-control"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder="Your name"
                    />
                  </FormField>
                  <FormField label="Mobile Number">
                    <input
                      name="mobile"
                      type="tel"
                      className="form-control"
                      value={form.mobile}
                      onChange={handleChange}
                      required
                      placeholder="10-digit number"
                      pattern="\d{10}"
                      maxLength={10}
                    />
                  </FormField>
                </div>

                <FormField label="Email Address">
                  <input
                    name="email"
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="email@example.com"
                  />
                </FormField>

                <FormField label="Aadhaar Number">
                  <input
                    name="aadhaar"
                    type="text"
                    className="form-control"
                    value={form.aadhaar}
                    onChange={handleChange}
                    placeholder="12-digit Aadhaar number"
                    required={isAadhaarRequired}
                    maxLength={12}
                    pattern="\d{12}"
                  />
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

                <FormField label="Subject">
                  <input
                    name="subject"
                    className="form-control"
                    value={form.subject}
                    onChange={handleChange}
                    required
                    placeholder="Brief summary of the issue"
                  />
                </FormField>

                <FormField label="Description">
                  <textarea
                    name="description"
                    className="form-control"
                    rows={4}
                    value={form.description}
                    onChange={handleChange}
                    required
                    placeholder="Describe your issue in detail..."
                  />
                </FormField>

                <FormField label="Supporting Documents (Optional)">
                  <FileUpload multiple onFilesChange={setFiles} helperText="Upload screenshots or relevant PDF/Images (Max 5MB each)" />
                </FormField>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Request'}</Button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Previous Support Tickets</h2>
          <span style={{ color: '#6b7280' }}>{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</span>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={tableHeaderStyle}>Ticket ID</th>
                <th style={tableHeaderStyle}>Candidate</th>
                <th style={tableHeaderStyle}>Aadhaar</th>
                <th style={tableHeaderStyle}>Project</th>
                <th style={tableHeaderStyle}>Location</th>
                <th style={tableHeaderStyle}>District</th>
                <th style={tableHeaderStyle}>Centre</th>
                <th style={tableHeaderStyle}>Category</th>
                <th style={tableHeaderStyle}>Subject</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Submitted on</th>
                <th style={tableHeaderStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                <tr><td colSpan={12} style={tableCellStyle}>Loading tickets...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={12} style={tableCellStyle}>No support tickets found.</td></tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={tableCellStyle}>#{ticket.id}</td>
                    <td style={tableCellStyle}>{ticket.candidateName || ticket.name || ticket.fullName || '—'}</td>
                    <td style={tableCellStyle}>{getTicketAadhaar(ticket)}</td>
                    <td style={tableCellStyle}>{getTicketValue(ticket, ['projectName', 'project', 'project_name'], '—')}</td>
                    <td style={tableCellStyle}>{getTicketValue(ticket, ['location', 'locationName', 'location_name'], '—')}</td>
                    <td style={tableCellStyle}>{getTicketValue(ticket, ['district', 'districtName', 'district_name'], '—')}</td>
                    <td style={tableCellStyle}>{getTicketValue(ticket, ['centre', 'centreName', 'centre_name'], '—')}</td>
                    <td style={tableCellStyle}>{ticket.category || '—'}</td>
                    <td style={tableCellStyle}>{ticket.subject || '—'}</td>
                    <td style={tableCellStyle}>{getTicketStatusLabel(ticket.status)}</td>
                    <td style={tableCellStyle}>{formatDate(ticket.createdAt || ticket.created_at || ticket.submittedAt || ticket.submitted_at)}</td>
                    <td style={tableCellStyle}>
                      <Button type="button" variant="outline" onClick={() => handleViewTicketDetails(ticket)}>View</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Modal isOpen={Boolean(selectedTicket)} onClose={closeTicketModal} title={`Ticket #${selectedTicket?.id || ''}`} maxWidth="760px">
          {ticketDetailLoading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Loading ticket details...</div>
          ) : selectedTicket ? (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><strong>Candidate</strong><div>{selectedTicket.candidateName || selectedTicket.name || '—'}</div></div>
                <div><strong>Aadhaar</strong><div>{getTicketAadhaar(selectedTicket)}</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><strong>Project</strong><div>{getTicketValue(selectedTicket, ['projectName', 'project', 'project_name'], '—')}</div></div>
                <div><strong>Location</strong><div>{getTicketValue(selectedTicket, ['location', 'locationName', 'location_name'], '—')}</div></div>
                <div><strong>District</strong><div>{getTicketValue(selectedTicket, ['district', 'districtName', 'district_name'], '—')}</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><strong>Centre</strong><div>{getTicketValue(selectedTicket, ['centre', 'centreName', 'centre_name'], '—')}</div></div>
                <div><strong>Status</strong><div>{getTicketStatusLabel(selectedTicket.status)}</div></div>
              </div>

              <div>
                <strong>Subject</strong>
                <div>{selectedTicket.subject || '—'}</div>
              </div>

              <div>
                <strong>Description</strong>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedTicket.description || '—'}</div>
              </div>

              <div>
                <strong>Admin Response</strong>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedTicket.adminResponse || selectedTicket.reply || selectedTicket.response || selectedTicket.admin_message || 'No response yet.'}</div>
              </div>

              {(selectedTicket.attachments || selectedTicket.files || selectedTicket.documents || []).length > 0 ? (
                <div>
                  <strong>Attachments</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {(selectedTicket.attachments || selectedTicket.files || selectedTicket.documents || []).map((attachment, index) => {
                      const fileUrl = attachment?.url || attachment?.fileUrl || attachment?.file || attachment
                      const fileName = attachment?.name || attachment?.filename || `Attachment ${index + 1}`
                      return fileUrl ? (
                        <a key={index} href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ padding: '8px 12px', display: 'inline-block', borderRadius: 6 }}>
                          {fileName}
                        </a>
                      ) : null
                    })}
                  </div>
                </div>
              ) : (
                <div><strong>Attachments</strong><div>No attachments uploaded.</div></div>
              )}
            </div>
          ) : null}
        </Modal>
      </div>
    </div>
  )
}
