import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { Card, PageHeader, Tag, DataTable, Tabs } from '../../components/ui/index'
import { candidateAPI } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const normalizeText = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.trim()
  return String(value)
}

const getStatusLabel = (application) => {
  return normalizeText(
    application.application_status ||
    application.status ||
    application.applied_status ||
    application.state ||
    application.current_status ||
    application.stage ||
    application.status_label ||
    application.review_status ||
    application.statusName ||
    application.status_name ||
    ''
  )
}

const getStatusVariant = (status) => {
  const normalized = normalizeText(status).toLowerCase()
  if (!normalized) return 'gray'
  if (normalized.includes('offer') || normalized.includes('selected') || normalized.includes('hired') || normalized.includes('accepted')) return 'green'
  if (normalized.includes('interview') || normalized.includes('shortlist') || normalized.includes('review') || normalized.includes('screening')) return 'blue'
  if (normalized.includes('rejected') || normalized.includes('closed') || normalized.includes('withdrawn') || normalized.includes('declined')) return 'red'
  if (normalized.includes('pending') || normalized.includes('applied') || normalized.includes('under review') || normalized.includes('waiting')) return 'yellow'
  return 'gray'
}

const APPLICATION_STATUS_PARAM = {
  all: undefined,
  applied: 'applied',
  selected: 'selected',
  rejected: 'rejected',
}

export function CandidateApplications() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const registrationId = user?.registrationId || user?.registration_id || localStorage.getItem('registration_id')

  const [activeTab, setActiveTab] = useState('all')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })

  useEffect(() => {
    const fetchApplications = async () => {
      if (!registrationId) {
        setApplications([])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const response = await candidateAPI.getApplications(registrationId, {
          offset: (pagination.page - 1) * pagination.limit,
          limit: pagination.limit,
          status: APPLICATION_STATUS_PARAM[activeTab],
          search: searchTerm || undefined,
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
        setPagination((prev) => ({
          ...prev,
          total,
          totalPages,
        }))
      } catch (error) {
        console.error('Failed to load applications:', error)
        setApplications([])
        setPagination((prev) => ({ ...prev, total: 0, totalPages: 1 }))
      } finally {
        setLoading(false)
      }
    }

    fetchApplications()
  }, [registrationId, activeTab, pagination.page, pagination.limit, searchTerm])

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

  const TABS = [
    { id: 'all', label: 'All' },
    { id: 'applied', label: 'Applied' },
    { id: 'selected', label: 'Selected' },
    { id: 'rejected', label: 'Rejected' },
  ]

  const rows = applications.map((application, index) => {
    const title = normalizeText(
      application.job_title ||
      application.title ||
      application.designation ||
      application.role ||
      application.posting ||
      ''
    )
    const location = normalizeText(
      application.location ||
      application.city ||
      application.centre ||
      application.center ||
      application.region ||
      application.branch ||
      ''
    )
    const startFrom = normalizeText(
      application.start_date ||
      application.startDate ||
      application.from_date ||
      application.fromDate ||
      application.start ||
      application.start_at ||
      application.startAt ||
      ''
    )
    const statusLabel = getStatusLabel(application)

    return [
      <span key={`title-${index}`}>{title || '—'}</span>,
      location || '—',
      startFrom || '—',
      <Tag key={`status-${index}`} variant={getStatusVariant(statusLabel)}>{statusLabel || 'Unknown'}</Tag>,
    ]
  })

  return (
    <div>
      <PageHeader
        title="My Applications"
        action={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/app/candidate/jobs')}>
            <FontAwesomeIcon icon={faPlus} /> Apply New Job
          </button>
        }
      />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
      <div style={{ margin: '20px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search applications by job, location, status..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPagination((prev) => ({ ...prev, page: 1 }))
          }}
          style={{ maxWidth: 320 }}
        />
      </div>
      <Card>
        <DataTable
          columns={['Job title', 'Location', 'Start from', 'Status']}
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

export default CandidateApplications
