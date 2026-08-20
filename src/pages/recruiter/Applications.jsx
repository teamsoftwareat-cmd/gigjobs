import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'
import { PageHeader, Tag, DataTable, Tabs, Card } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import './recruiter-mobile.css'

const normalizeText = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.trim()
  return String(value)
}

const getStatusLabel = (application) => {
  return normalizeText(
    application.application_status ||
    application.status ||
    application.state ||
    application.current_status ||
    application.review_status ||
    application.status_name ||
    application.statusLabel ||
    application.statusLabel ||
    ''
  )
}

const getStatusVariant = (status) => {
  const normalized = normalizeText(status).toLowerCase()
  if (!normalized) return 'gray'
  if (normalized.includes('offer') || normalized.includes('selected') || normalized.includes('hired') || normalized.includes('accepted')) return 'green'
  if (normalized.includes('interview') || normalized.includes('shortlist') || normalized.includes('review') || normalized.includes('screening') || normalized.includes('pending')) return 'blue'
  if (normalized.includes('rejected') || normalized.includes('declined') || normalized.includes('closed') || normalized.includes('withdrawn')) return 'red'
  return 'gray'
}

const APPLICATION_STATUS_PARAM = {
  all: undefined,
  pending: 'pending',
  selected: 'selected',
  rejected: 'rejected',
}

export default function RecruiterApplications() {
  const [activeTab, setActiveTab] = useState('all')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedProjectKind, setSelectedProjectKind] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [projectOptions, setProjectOptions] = useState([])
  const [locationOptions, setLocationOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [projectLoading, setProjectLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [districtLoading, setDistrictLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [actionLoading, setActionLoading] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const normalizeProjectKind = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'written' || normalized === 'writtenexam' || normalized === 'written_exam') return 'written'
    return 'regular'
  }

  const normalizeProjectId = (projectId) => {
    const raw = String(projectId || '').trim()
    return raw.startsWith('proj_') ? raw.replace(/^proj_/, '') : raw
  }

  const normalizeProjectOptions = (payload) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data?.items)
            ? payload.data.items
            : []

    return list.map((item) => {
      if (item === null || item === undefined) return null
      const id = String(item.id ?? item.project_id ?? item.value ?? item.key ?? item._id ?? item.projectId ?? item.projectId ?? item.name ?? item.title ?? '')
      const name = String(item.projectName ?? item.name ?? item.title ?? item.label ?? item.location ?? item.district ?? item.value ?? item.key ?? item.project ?? item.id ?? '')
      const kind = normalizeProjectKind(item.projectKind || item.kind || item.type || item.projectType || item.project_type)
      return id ? { id, name, kind } : null
    }).filter(Boolean)
  }

  const normalizeOptions = (payload) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data?.items)
            ? payload.data.items
            : []

    return list.map((item) => {
      if (item === null || item === undefined) return null
      if (typeof item === 'string' || typeof item === 'number') {
        return { id: String(item), name: String(item) }
      }
      const id = String(item.id ?? item.project_id ?? item.location_id ?? item.district_id ?? item.value ?? item.key ?? item._id ?? item.projectId ?? item.name ?? item.title ?? '')
      const name = String(item.name ?? item.project_name ?? item.title ?? item.label ?? item.location ?? item.district ?? item.value ?? item.key ?? item.project ?? item.id ?? '')
      return id ? { id, name } : null
    }).filter(Boolean)
  }

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true)
      try {
        const response = await recruiterAPI.getApplications({
          offset: (pagination.page - 1) * pagination.limit,
          limit: pagination.limit,
          status: APPLICATION_STATUS_PARAM[activeTab],
          search: searchTerm || undefined,
          project: selectedProject || undefined,
          location: selectedLocation || undefined,
          district: selectedDistrict || undefined,
        })

        const data = response.data?.data || response.data || {}
        const items = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.applications)
            ? data.applications
            : Array.isArray(data)
              ? data
              : []

        const total = typeof data.total === 'number' ? data.total : items.length
        const totalPages = Math.max(1, Math.ceil(total / pagination.limit))

        setApplications(items)
        setPagination((prev) => ({ ...prev, total, totalPages }))
      } catch (error) {
        console.error('Failed to load applications:', error)
        setApplications([])
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }))
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [activeTab, pagination.page, pagination.limit, searchTerm, selectedProject, selectedLocation, selectedDistrict, refreshKey])

  useEffect(() => {
    const fetchProjects = async () => {
      setProjectLoading(true)
      try {
        const response = await recruiterAPI.getProjects({ limit: 1000 })
        const projectList = response.data?.data || response.data || []
        setProjectOptions(normalizeProjectOptions(projectList))
      } catch (error) {
        console.error('Failed to load project options:', error)
        setProjectOptions([])
      } finally {
        setProjectLoading(false)
      }
    }

    fetchProjects()
  }, [])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const handleApplicationAction = async (application, status) => {
    const applicationId = application.id || application.application_id || application.jobseeker_id || application.candidate_id
    if (!applicationId) return

    const confirmation = window.confirm(`Are you sure you want to mark this application as ${status}?`)
    if (!confirmation) return

    setActionLoading(applicationId)
    try {
      await recruiterAPI.updateApplicationStatus(applicationId, { status })
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      console.error(`Failed to update application status to ${status}:`, error)
    } finally {
      setActionLoading(null)
    }
  }

  const TABS = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'selected', label: 'Selected' },
    { id: 'rejected', label: 'Rejected' },
  ]

  const rows = applications.map((application, index) => {
    const candidateName = normalizeText(
      application.candidate_name ||
      application.name ||
      application.full_name ||
      application.jobseeker_name ||
      ''
    )

    const jobTitle = normalizeText(
      application.job_title ||
      application.designation ||
      application.role ||
      application.title ||
      application.posting ||
      ''
    )

    const mobile = normalizeText(
      application.mobile ||
      application.phone ||
      application.contact_number ||
      application.mobile_number ||
      ''
    )

    const email = normalizeText(
      application.email ||
      application.email_id ||
      application.candidate_email ||
      ''
    )

    const statusLabel = getStatusLabel(application)
    const statusVariant = getStatusVariant(statusLabel)
    const isSelected = statusLabel.toLowerCase().includes('selected') || statusLabel.toLowerCase().includes('accepted')
    const isRejected = statusLabel.toLowerCase().includes('rejected') || statusLabel.toLowerCase().includes('declined')
    const applicationId = application.id || application.application_id || application.jobseeker_id || application.candidate_id || index

    const actionButtons = (
      <div className="flex gap-8" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={actionLoading === applicationId || isSelected}
          onClick={() => handleApplicationAction(application, 'selected')}
        >
          <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} /> Select
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={actionLoading === applicationId || isRejected}
          onClick={() => handleApplicationAction(application, 'rejected')}
        >
          <FontAwesomeIcon icon={faTimes} style={{ marginRight: 6 }} /> Reject
        </button>
      </div>
    )

    return [
      candidateName || '—',
      jobTitle || '—',
      mobile || '—',
      email || '—',
      <Tag key={`status-${index}`} variant={statusVariant}>{statusLabel || 'Unknown'}</Tag>,
      actionButtons,
    ]
  })

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Review candidate applications and update status"
      />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <div style={{ margin: '20px 0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search applications by candidate, job, mobile or email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
          style={{ maxWidth: 360, flex: 1, minWidth: 220 }}
        />
        <select
          className="form-control"
          value={selectedProject}
          onChange={async (e) => {
            const projectId = e.target.value
            const project = projectOptions.find((item) => item.id === projectId)
            const projectKind = project?.kind || ''
            setSelectedProject(projectId)
            setSelectedProjectKind(projectKind)
            setSelectedLocation('')
            setSelectedDistrict('')
            setLocationOptions([])
            setDistrictOptions([])
            setPagination((prev) => ({ ...prev, page: 1 }))

            if (!projectId) return
            if (projectKind === 'written') {
              setDistrictLoading(true)
              try {
                const districtRes = await recruiterAPI.getProjectDistricts(normalizeProjectId(projectId)).catch(() => ({ data: [] }))
                setDistrictOptions(normalizeOptions(districtRes.data?.data || districtRes.data || []))
              } finally {
                setDistrictLoading(false)
              }
            } else {
              setLocationLoading(true)
              try {
                const locationRes = await recruiterAPI.getProjectLocations(normalizeProjectId(projectId)).catch(() => ({ data: [] }))
                setLocationOptions(normalizeOptions(locationRes.data?.data || locationRes.data || []))
              } finally {
                setLocationLoading(false)
              }
            }
          }}
          style={{ maxWidth: 280, minWidth: 220 }}
        >
          <option value="">All projects</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        {selectedProjectKind === 'regular' && (
          <select
            className="form-control"
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            disabled={!selectedProject || locationOptions.length === 0}
            style={{ maxWidth: 240, minWidth: 220 }}
          >
            <option value="">All locations</option>
            {locationOptions.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        )}
        {selectedProjectKind === 'written' && (
          <select
            className="form-control"
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value)
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            disabled={!selectedProject || districtOptions.length === 0}
            style={{ maxWidth: 240, minWidth: 220 }}
          >
            <option value="">All districts</option>
            {districtOptions.map((district) => (
              <option key={district.id} value={district.id}>{district.name}</option>
            ))}
          </select>
        )}
      </div>

      <Card>
        <DataTable
          columns={['Candidate', 'Job title', 'Mobile', 'Email', 'Status', 'Actions']}
          rows={loading ? [] : rows}
          emptyMessage={loading ? 'Loading applications…' : 'No applications found.'}
        />

        <div className="table-footer" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>
            Showing {applications.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.total, pagination.page * pagination.limit)} of {pagination.total} applications
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ marginRight: 8 }}>Rows per page:</label>
              <select value={pagination.limit} onChange={(e) => handleLimitChange(Number(e.target.value))} className="form-control form-control-sm" style={{ width: 80, display: 'inline-block' }}>
                {[5, 10, 20, 50].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <button className="btn btn-outline btn-sm" type="button" disabled={pagination.page <= 1 || loading} onClick={() => handlePageChange(pagination.page - 1)}>
                Previous
              </button>
              <button className="btn btn-outline btn-sm" type="button" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => handlePageChange(pagination.page + 1)} style={{ marginLeft: 8 }}>
                Next
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
