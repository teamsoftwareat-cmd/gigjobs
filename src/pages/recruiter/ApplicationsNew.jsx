import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine, faChevronDown, faFloppyDisk, faPhone } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { Card, Modal, PageHeader } from '../../components/ui'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import { useAuth } from '../../context/AuthContext'
import ApplicationsStatsModal from './ApplicationsStatsModal'
import './ApplicationsNew.css'

const COLUMNS = [
  'Select',
  'ID',
  'Project',
  'Name',
  'Number',
  'Status',
  'Reason',
  'Email',
  'Aadhaar',
  'Area',
  'Friend Name',
  'Friend Number',
  'Created At',
  'Updated At',
  'Travel To',
  'Away Duration',
  'Education',
  'Language',
  'Joining Date',
  'Device Available',
]

const STATUSES = ['pending', 'interested', 'not_interrested', 'call_not_answered', 'waiting_for_confirmation']
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]
const STATUS_LABELS = {
  pending: 'Pending',
  interested: 'Interested',
  not_interrested: 'Not Interested',
  call_not_answered: 'Call Not Answered',
  waiting_for_confirmation: 'Waiting for confirmation',
}

const normalizeProjectId = (value) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''
  return normalized.match(/\d+$/)?.[0] || normalized
}

const getCandidateKey = (candidate) => `${candidate.job_id || 'project'}-${candidate.id ?? ''}`
const getCallerId = (caller) => String(caller.calling_team_login_id ?? caller.id ?? caller.callerId ?? '')
const getCallerName = (caller) => String(caller.name ?? caller.full_name ?? caller.email ?? getCallerId(caller))

const getProjectList = (payload) => {
  const candidates = [
    payload,
    payload?.data,
    payload?.items,
    payload?.projects,
    payload?.data?.items,
    payload?.data?.projects,
  ]
  return candidates.find(Array.isArray) || []
}

const normalizeProjects = (payload) => getProjectList(payload).flatMap((project) => {
  if (!project || typeof project !== 'object') return []

  const id = String(
    project.project_id ??
    project.projectId ??
    project.project_code ??
    project.projectCode ??
    project.code ??
    project.id ??
    '',
  ).trim()
  if (!id) return []

  const name = String(
    project.project_name ??
    project.projectName ??
    project.name ??
    project.title ??
    project.location ??
    '',
  ).trim()
  const label = name && name !== id ? `${id} - ${name}` : id

  return [{ id, name: label, projectName: name }]
})

const getCellValue = (value) => {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

const getStatus = (candidate) => {
  const status = String(candidate.status || 'pending')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  if (STATUSES.includes(status)) return status
  if (status === 'not_interested') return 'not_interrested'
  return 'pending'
}

const unwrapRecords = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The candidate response was not valid.')
  }
  if (payload.success === false) {
    throw new Error(payload.message || 'Failed to load candidates.')
  }

  const records = payload.data
  const rows = Array.isArray(records)
    ? records
    : Array.isArray(records?.items)
      ? records.items
      : Array.isArray(records?.candidates)
        ? records.candidates
        : null

  if (!rows) throw new Error('The candidate response did not contain a record list.')

  const totalValue = payload.total ?? records?.total ?? payload.totalCount ?? payload.meta?.total
  const total = Number(totalValue)
  return { rows, total: Number.isFinite(total) && total >= 0 ? total : rows.length }
}

export default function ApplicationsNew() {
  const { user } = useAuth()
  const [filters, setFilters] = useState({ job_id: '', name: '', number: '', area: '', status: '' })
  const [appliedFilters, setAppliedFilters] = useState({})
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectError, setProjectError] = useState('')
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(PAGE_SIZE_OPTIONS[0])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [statusReasons, setStatusReasons] = useState({})
  const [reasonModalCandidate, setReasonModalCandidate] = useState(null)
  const [notice, setNotice] = useState(null)
  const [statsOpen, setStatsOpen] = useState(false)
  const [selectedCandidates, setSelectedCandidates] = useState({})
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [callers, setCallers] = useState([])
  const [callersLoading, setCallersLoading] = useState(false)
  const [callersError, setCallersError] = useState('')
  const [selectedCallerIds, setSelectedCallerIds] = useState([])
  const [sharing, setSharing] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(() => (
    typeof window === 'undefined' || window.matchMedia('(min-width: 801px)').matches
  ))

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 801px)')
    const syncFiltersVisibility = () => setFiltersExpanded(desktopViewport.matches)

    desktopViewport.addEventListener('change', syncFiltersVisibility)
    return () => desktopViewport.removeEventListener('change', syncFiltersVisibility)
  }, [])

  useEffect(() => {
    let current = true
    setProjectsLoading(true)

    recruiterAPI.getProjectSuggestions('', 1000)
      .then((response) => {
        if (current) setProjects(normalizeProjects(response.data))
      })
      .catch((error) => {
        console.error('Failed to load projects for applications:', error)
        if (current) {
          setProjects([])
          setProjectError('Projects could not be loaded. Please try again later.')
        }
      })
      .finally(() => {
        if (current) setProjectsLoading(false)
      })

    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadError('')

    recruiterAPI.getShortTermHiringCandidates({
      ...appliedFilters,
      offset: (page - 1) * limit,
      limit,
    })
      .then((response) => {
        const result = unwrapRecords(response.data)
        if (current) {
          setCandidates(result.rows)
          setTotal(result.total)
        }
      })
      .catch((error) => {
        console.error('Failed to load short-term hiring candidates:', error)
        if (current) {
          setCandidates([])
          setTotal(0)
          setLoadError(error.message || 'Failed to load candidates.')
        }
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
    }
  }, [appliedFilters, page, limit])

  const handleFilterChange = (event) => {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setAppliedFilters(Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value.trim() !== ''),
    ))
  }

  const handleReset = () => {
    const emptyFilters = { job_id: '', name: '', number: '', area: '', status: '' }
    setFilters(emptyFilters)
    setPage(1)
    setAppliedFilters({})
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const pageStart = Math.max(1, Math.min(page - 2, totalPages - 4))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const visiblePages = Array.from({ length: pageEnd - pageStart + 1 }, (_, index) => pageStart + index)
  const firstRecord = total === 0 ? 0 : (page - 1) * limit + 1
  const lastRecord = Math.min(total, page * limit)
  const selectedCandidateRows = Object.values(selectedCandidates)
  const pageCandidateKeys = candidates.map(getCandidateKey)
  const allPageCandidatesSelected = pageCandidateKeys.length > 0 && pageCandidateKeys.every((key) => selectedCandidates[key])
  const projectNameById = Object.fromEntries(projects.map((project) => [normalizeProjectId(project.id), project.projectName || project.name]))

  const toggleCandidateSelection = (candidate) => {
    const key = getCandidateKey(candidate)
    setSelectedCandidates((current) => {
      const next = { ...current }
      if (next[key]) delete next[key]
      else next[key] = {
        id: candidate.id,
        job_id: candidate.job_id,
        project_id: candidate.job_id ?? candidate.project_id ?? candidate.projectId,
      }
      return next
    })
  }

  const togglePageCandidateSelection = () => {
    setSelectedCandidates((current) => {
      const next = { ...current }
      if (allPageCandidatesSelected) pageCandidateKeys.forEach((key) => delete next[key])
      else candidates.forEach((candidate) => {
        next[getCandidateKey(candidate)] = {
          id: candidate.id,
          job_id: candidate.job_id,
          project_id: candidate.job_id ?? candidate.project_id ?? candidate.projectId,
        }
      })
      return next
    })
  }

  const openShareModal = async () => {
    setShareModalOpen(true)
    setSelectedCallerIds([])
    setCallersError('')
    setCallersLoading(true)
    try {
      const [assignedResponse, unassignedResponse] = await Promise.all([
        recruiterAPI.getAssignedCallers({ offset: 0, limit: 1000 }),
        recruiterAPI.getUnassignedCallers({ offset: 0, limit: 1000 }),
      ])
      const unwrapCallers = (response) => {
        const data = response.data?.data || response.data || {}
        return Array.isArray(data) ? data : data.items || data.callers || []
      }
      const uniqueCallers = new Map()
      ;[...unwrapCallers(assignedResponse), ...unwrapCallers(unassignedResponse)].forEach((caller) => {
        const id = getCallerId(caller)
        if (id) uniqueCallers.set(id, caller)
      })
      setCallers([...uniqueCallers.values()])
    } catch (error) {
      console.error('Failed to load calling team members:', error)
      setCallers([])
      setCallersError(error.message || 'Calling team members could not be loaded.')
    } finally {
      setCallersLoading(false)
    }
  }

  const handleShareCandidates = async () => {
    if (!selectedCandidateRows.length || !selectedCallerIds.length) return
    setSharing(true)
    setNotice(null)
    try {
      const candidatesForShare = selectedCandidateRows.map((candidate) => {
        const projectId = normalizeProjectId(candidate.project_id ?? candidate.job_id ?? candidate.projectId ?? candidate.id)
        const jobId = normalizeProjectId(candidate.job_id ?? candidate.project_id ?? candidate.projectId ?? candidate.id)

        return {
          ...candidate,
          project_id: projectId,
          job_id: jobId,
        }
      })

      const response = await recruiterAPI.shareShortTermHiringCandidates({
        candidates: candidatesForShare,
        caller_ids: selectedCallerIds,
      })
      if (response.data?.success === false) throw new Error(response.data.message || 'Candidates could not be shared.')
      setSelectedCandidates({})
      setShareModalOpen(false)
      setNotice({ error: false, message: 'Candidates shared with calling team members.' })
    } catch (error) {
      console.error('Failed to share candidates with calling team:', error)
      setCallersError(error.message || 'Candidates could not be shared. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  const persistStatusUpdate = async (candidate, status, reason, syncReasonDraft = false) => {
    if (!candidate.id || !candidate.job_id) {
      setNotice({ error: true, message: 'Candidate ID or job ID is missing; the update was not saved.' })
      return false
    }

    setUpdatingId(candidate.id)
    setNotice(null)
    const formData = new FormData()
    formData.append('action', 'update_status')
    formData.append('id', String(candidate.id ?? ''))
    formData.append('job_id', String(candidate.job_id))
    formData.append('status', status)
    formData.append('reason', reason.trim())
    if (user?.userId !== undefined && user?.userId !== null) {
      formData.append('user_id', String(user.userId))
    }

    try {
      const response = await recruiterAPI.updateShortTermHiringStatus(formData)
      const updatedAt = response.data?.updated_at || response.data?.data?.updated_at
      setCandidates((current) => current.map((item) => (
        item.id === candidate.id
          ? { ...item, status, reason, ...(updatedAt ? { updated_at: updatedAt } : {}) }
          : item
      )))
      if (syncReasonDraft) {
        setStatusReasons((current) => ({ ...current, [getCandidateKey(candidate)]: reason }))
      }
      return true
    } catch (error) {
      console.error('Failed to save short-term hiring update:', error)
      setNotice({ error: true, message: error.message || 'Failed to save update.' })
      return false
    } finally {
      setUpdatingId(null)
    }
  }

  const handleStatusChange = async (candidate, event) => {
    const nextStatus = event.target.value
    const previousStatus = getStatus(candidate)
    if (nextStatus === previousStatus) return

    const confirmed = window.confirm(
      `Are you sure you want to change status from "${STATUS_LABELS[previousStatus]}" to "${STATUS_LABELS[nextStatus]}"?`,
    )
    if (!confirmed) return

    const saved = await persistStatusUpdate(candidate, nextStatus, String(candidate.reason || ''))
    if (saved) setNotice({ error: false, message: 'Status updated successfully.' })
  }

  const handleReasonSave = async (candidate) => {
    const candidateKey = getCandidateKey(candidate)
    const reason = statusReasons[candidateKey] ?? String(candidate.reason || '')
    if (reason === String(candidate.reason || '')) return false

    const saved = await persistStatusUpdate(candidate, getStatus(candidate), reason, true)
    if (saved) setNotice({ error: false, message: 'Reason saved successfully.' })
    return saved
  }

  const openReasonModal = (candidate) => {
    const candidateKey = getCandidateKey(candidate)
    setStatusReasons((current) => (
      Object.prototype.hasOwnProperty.call(current, candidateKey)
        ? current
        : { ...current, [candidateKey]: String(candidate.reason || '') }
    ))
    setReasonModalCandidate(candidate)
  }

  const saveReasonFromModal = async () => {
    if (!reasonModalCandidate) return
    const saved = await handleReasonSave(reasonModalCandidate)
    if (saved) setReasonModalCandidate(null)
  }

  const handleCallClick = (candidate) => {
    if (!candidate.id || !candidate.job_id) {
      setNotice({ error: true, message: 'Candidate ID or job ID is missing; the call could not be tracked.' })
      return
    }

    const formData = new FormData()
    formData.append('action', 'track_call')
    formData.append('id', String(candidate.id))
    formData.append('job_id', String(candidate.job_id))
    formData.append('number', String(candidate.number || ''))
    if (user?.userId !== undefined && user?.userId !== null) {
      formData.append('user_id', String(user.userId))
    }

    recruiterAPI.trackShortTermHiringCall(formData).catch((error) => {
      console.error('Failed to track short-term hiring call:', error)
      setNotice({ error: true, message: error.message || 'The call could not be tracked.' })
    })
  }

  const renderCandidate = (candidate) => {
    const status = getStatus(candidate)
    const phone = String(candidate.number || '').trim()
    const candidateKey = getCandidateKey(candidate)

    return (
      <tr key={candidateKey}>
        <td>
          <input
            type="checkbox"
            aria-label={`Select ${candidate.name || candidate.id || 'candidate'}`}
            checked={Boolean(selectedCandidates[candidateKey])}
            onChange={() => toggleCandidateSelection(candidate)}
          />
        </td>
        <td>{getCellValue(candidate.id)}</td>
        <td>{projectNameById[normalizeProjectId(candidate.job_id)] || getCellValue(candidate.job_id)}</td>
        <td>{getCellValue(candidate.name)}</td>
        <td>
          {getCellValue(candidate.number)}
          {phone && (
            <a
              className="applications-new-call"
              href={`tel:${encodeURIComponent(phone)}`}
              aria-label={`Call ${phone}`}
              title={`Call ${phone}`}
              onClick={() => handleCallClick(candidate)}
            >
              <FontAwesomeIcon icon={faPhone} />
            </a>
          )}
        </td>
        <td>
          <div className="applications-new-status-controls">
            <select
              aria-label={`Status for ${candidate.name || candidate.id || 'candidate'}`}
              className={`applications-new-status applications-new-status-${status}`}
              value={status}
              disabled={updatingId === candidate.id}
              onChange={(event) => handleStatusChange(candidate, event)}
            >
              {STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}
            </select>
          </div>
        </td>
        <td>
          <div className="applications-new-reason-controls">
            <input
              className="form-control applications-new-status-reason"
              type="text"
              aria-label={`Remarks for ${candidate.name || candidate.id || 'candidate'}`}
              placeholder="Add remarks"
              value={statusReasons[candidateKey] ?? String(candidate.reason || '')}
              disabled={updatingId === candidate.id}
              onChange={(event) => setStatusReasons((current) => ({ ...current, [candidateKey]: event.target.value }))}
            />
            <button
              className="applications-new-save-reason"
              type="button"
              title="Save remarks"
              aria-label={`Save remarks for ${candidate.name || candidate.id || 'candidate'}`}
              disabled={updatingId === candidate.id || (
                (statusReasons[candidateKey] ?? String(candidate.reason || '')) === String(candidate.reason || '')
              )}
              onClick={() => handleReasonSave(candidate)}
            >
              <FontAwesomeIcon icon={faFloppyDisk} />
            </button>
          </div>
        </td>
        <td>{getCellValue(candidate.email_id)}</td>
        <td>{getCellValue(candidate.aadhar)}</td>
        <td>{getCellValue(candidate.area)}</td>
        <td>{getCellValue(candidate.friend_name)}</td>
        <td>{getCellValue(candidate.friend_number)}</td>
        <td>{getCellValue(candidate.created_at)}</td>
        <td className="applications-new-updated-at">{getCellValue(candidate.updated_at)}</td>
        <td>{getCellValue(candidate.travel_to)}</td>
        <td>{getCellValue(candidate.away_duration)}</td>
        <td>{getCellValue(candidate.education)}</td>
        <td>{getCellValue(candidate.language)}</td>
        <td>{getCellValue(candidate.joining_date)}</td>
        <td>{getCellValue(candidate.device_available)}</td>
      </tr>
    )
  }

  const renderMobileCandidate = (candidate) => {
    const status = getStatus(candidate)
    const phone = String(candidate.number || '').trim()
    const candidateKey = getCandidateKey(candidate)

    return (
      <article className="applications-new-candidate-card" key={candidateKey}>
        <div className="applications-new-candidate-heading">
          <input
            type="checkbox"
            aria-label={`Select ${candidate.name || candidate.id || 'candidate'}`}
            checked={Boolean(selectedCandidates[candidateKey])}
            onChange={() => toggleCandidateSelection(candidate)}
          />
          <div className="applications-new-candidate-identity">
            <h3>{getCellValue(candidate.name)}</h3>
            <span>ID {getCellValue(candidate.id)} <span aria-hidden="true">·</span> {projectNameById[normalizeProjectId(candidate.job_id)] || getCellValue(candidate.job_id)}</span>
          </div>
          <span className={`applications-new-status-badge applications-new-status-badge-${status}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        <div className="applications-new-candidate-primary">
          <div className="applications-new-candidate-phone">
            <span>Phone number</span>
            <strong>{getCellValue(candidate.number)}</strong>
          </div>
          {phone ? (
            <a
              className="applications-new-mobile-call"
              href={`tel:${encodeURIComponent(phone)}`}
              onClick={() => handleCallClick(candidate)}
            >
              <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
              <span>Call candidate</span>
            </a>
          ) : (
            <button className="applications-new-mobile-call" type="button" disabled>
              <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
              <span>No phone number</span>
            </button>
          )}
        </div>

        <div className="applications-new-mobile-status">
          <label>
            <span>Update status</span>
            <select
              aria-label={`Status for ${candidate.name || candidate.id || 'candidate'}`}
              className={`applications-new-status applications-new-status-${status}`}
              value={status}
              disabled={updatingId === candidate.id}
              onChange={(event) => handleStatusChange(candidate, event)}
            >
              {STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-outline applications-new-mobile-add-reason"
            onClick={() => openReasonModal(candidate)}
            disabled={updatingId === candidate.id}
          >
            <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
            <span>{candidate.reason ? 'Edit remarks' : 'Add remarks'}</span>
          </button>
        </div>

        <div className="applications-new-candidate-details">
          <div><span>Area</span><strong>{getCellValue(candidate.area)}</strong></div>
          <div><span>Email</span><strong>{getCellValue(candidate.email_id)}</strong></div>
        </div>

        <details className="applications-new-more-details">
          <summary>More candidate details</summary>
          <div className="applications-new-candidate-details">
            <div><span>Aadhaar</span><strong>{getCellValue(candidate.aadhar)}</strong></div>
            <div><span>Friend name</span><strong>{getCellValue(candidate.friend_name)}</strong></div>
            <div><span>Friend number</span><strong>{getCellValue(candidate.friend_number)}</strong></div>
            <div><span>Created at</span><strong>{getCellValue(candidate.created_at)}</strong></div>
            <div><span>Updated at</span><strong>{getCellValue(candidate.updated_at)}</strong></div>
            <div><span>Remarks</span><strong>{getCellValue(candidate.reason)}</strong></div>
            <div><span>Travel to</span><strong>{getCellValue(candidate.travel_to)}</strong></div>
            <div><span>Away duration</span><strong>{getCellValue(candidate.away_duration)}</strong></div>
            <div><span>Education</span><strong>{getCellValue(candidate.education)}</strong></div>
            <div><span>Language</span><strong>{getCellValue(candidate.language)}</strong></div>
            <div><span>Joining date</span><strong>{getCellValue(candidate.joining_date)}</strong></div>
            <div><span>Device available</span><strong>{getCellValue(candidate.device_available)}</strong></div>
          </div>
        </details>
      </article>
    )
  }

  return (
    <div className="applications-new">
      <PageHeader
        title="Applicants"
        subtitle="Search and manage short-term hiring candidates"
        action={(
          <button type="button" className="btn btn-outline" onClick={() => setStatsOpen(true)}>
            <FontAwesomeIcon icon={faChartLine} aria-hidden="true" />
            <span>Show stats</span>
          </button>
        )}
      />

      <Card className="applications-new-filter-card">
        <details
          className="applications-new-filter-accordion"
          open={filtersExpanded}
          onToggle={(event) => setFiltersExpanded(event.currentTarget.open)}
        >
          <summary>
            <span className="applications-new-filter-summary">
              <strong>Search &amp; filters</strong>
              <span>{Object.keys(appliedFilters).length ? `${Object.keys(appliedFilters).length} active` : 'Filter candidates'}</span>
            </span>
            <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
          </summary>
          <div className="applications-new-filter-content">
            <form onSubmit={handleSearch}>
              <div className="applications-new-filter-grid">
                <label className="applications-new-filter">
                  <span>Project ID</span>
                  <SearchableProjectSelect
                    options={projects}
                    value={filters.job_id}
                    onChange={(jobId) => setFilters((current) => ({ ...current, job_id: jobId }))}
                    placeholder={projectsLoading ? 'Loading projects…' : 'All Projects'}
                    disabled={projectsLoading || Boolean(projectError)}
                  />
                </label>
                <label className="applications-new-filter">
                  <span>Name</span>
                  <input className="form-control" name="name" value={filters.name} onChange={handleFilterChange} placeholder="Search name" />
                </label>
                <label className="applications-new-filter">
                  <span>Number</span>
                  <input className="form-control" name="number" value={filters.number} onChange={handleFilterChange} placeholder="Search number" />
                </label>
                <label className="applications-new-filter">
                  <span>Area</span>
                  <input className="form-control" name="area" value={filters.area} onChange={handleFilterChange} placeholder="Search area" />
                </label>
                <label className="applications-new-filter">
                  <span>Status</span>
                  <select className="form-control" name="status" value={filters.status} onChange={handleFilterChange}>
                    <option value="">All Status</option>
                    {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                </label>
              </div>
              {projectError && <div className="applications-new-error" role="alert">{projectError}</div>}
              <div className="applications-new-filter-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>Search</button>
                <button type="button" className="btn btn-outline" onClick={handleReset}>Reset</button>
              </div>
            </form>
          </div>
        </details>
      </Card>

      {notice && (
        <div className={`applications-new-notice${notice.error ? ' is-error' : ''}`} role="status" aria-live="polite">
          {notice.message}
        </div>
      )}

      <Card className="applications-new-table-card">
        <div className="applications-new-table-header">
          <h2>Candidates</h2>
          <div className="applications-new-table-header-actions">
            {selectedCandidateRows.length > 0 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={openShareModal}>
                Share with calling team members ({selectedCandidateRows.length})
              </button>
            )}
            <span className="applications-new-count">{total} Records</span>
          </div>
        </div>
        <div className="applications-new-pagination-top">
          <div className="applications-new-pagination-summary">
            Showing {firstRecord} to {lastRecord} of {total} records
          </div>
          <label className="applications-new-page-size">
            <span>Rows per page</span>
            <select
              className="form-control"
              value={limit}
              disabled={loading}
              onChange={(event) => {
                setLimit(Number(event.target.value))
                setPage(1)
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
        {loadError && <div className="applications-new-error" role="alert">{loadError}</div>}
        <div className="table-wrap applications-new-table-wrap">
          <table>
            <thead>
              <tr>{COLUMNS.map((column) => (
                <th key={column}>
                  {column === 'Select' ? (
                    <input
                      type="checkbox"
                      aria-label="Select all candidates on this page"
                      checked={allPageCandidatesSelected}
                      disabled={loading || candidates.length === 0}
                      onChange={togglePageCandidateSelection}
                    />
                  ) : column}
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={COLUMNS.length} className="applications-new-empty">Loading candidates…</td></tr>
                : loadError
                  ? <tr><td colSpan={COLUMNS.length} className="applications-new-empty">Candidates could not be loaded.</td></tr>
                  : candidates.length === 0
                    ? <tr><td colSpan={COLUMNS.length} className="applications-new-empty">No records found</td></tr>
                    : candidates.map(renderCandidate)}
            </tbody>
          </table>
        </div>
        <div className="applications-new-mobile-list">
          {loading
            ? <div className="applications-new-mobile-state">Loading candidates…</div>
            : loadError
              ? <div className="applications-new-mobile-state is-error">Candidates could not be loaded.</div>
              : candidates.length === 0
                ? <div className="applications-new-mobile-state">No records found</div>
                : candidates.map(renderMobileCandidate)}
        </div>
        <div className="applications-new-pagination">
          <div className="applications-new-page-buttons" aria-label="Candidate pages">
            <button
              type="button"
              className="btn btn-outline btn-sm applications-new-page-previous"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            {visiblePages.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={`btn btn-sm applications-new-page-number${pageNumber === page ? ' btn-primary' : ' btn-outline'}`}
                aria-current={pageNumber === page ? 'page' : undefined}
                disabled={loading}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <span className="applications-new-page-indicator" aria-live="polite">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm applications-new-page-next"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </Card>
      <Modal
        isOpen={shareModalOpen}
        onClose={() => !sharing && setShareModalOpen(false)}
        title="Share with calling team members"
        maxWidth="560px"
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={() => setShareModalOpen(false)} disabled={sharing}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleShareCandidates} disabled={sharing || callersLoading || selectedCallerIds.length === 0}>
              {sharing ? 'Sharing…' : `Share ${selectedCandidateRows.length} candidates`}
            </button>
          </>
        )}
      >
        <div className="applications-new-share-modal">
          <p>Select the calling team members who should receive the {selectedCandidateRows.length} selected candidates.</p>
          {callersLoading ? (
            <div className="applications-new-share-state">Loading calling team members…</div>
          ) : callersError ? (
            <div className="applications-new-error" role="alert">{callersError}</div>
          ) : callers.length === 0 ? (
            <div className="applications-new-share-state">No calling team members found.</div>
          ) : (
            <div className="applications-new-share-callers">
              {callers.map((caller) => {
                const callerId = getCallerId(caller)
                return (
                  <label className="applications-new-share-caller" key={callerId}>
                    <input
                      type="checkbox"
                      checked={selectedCallerIds.includes(callerId)}
                      onChange={(event) => setSelectedCallerIds((current) => (
                        event.target.checked ? [...current, callerId] : current.filter((id) => id !== callerId)
                      ))}
                    />
                    <span>{getCallerName(caller)}</span>
                    <small>{caller.phone || caller.mobile || caller.email || callerId}</small>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(reasonModalCandidate)}
        onClose={() => setReasonModalCandidate(null)}
        title={reasonModalCandidate?.reason ? 'Edit remarks' : 'Add remarks'}
        maxWidth="480px"
        footer={reasonModalCandidate && (
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setReasonModalCandidate(null)}
              disabled={updatingId === reasonModalCandidate.id}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveReasonFromModal}
              disabled={updatingId === reasonModalCandidate.id || (
                (statusReasons[getCandidateKey(reasonModalCandidate)] ?? String(reasonModalCandidate.reason || '')) ===
                String(reasonModalCandidate.reason || '')
              )}
            >
              <FontAwesomeIcon icon={faFloppyDisk} aria-hidden="true" />
              <span>{updatingId === reasonModalCandidate.id ? 'Saving…' : 'Save remarks'}</span>
            </button>
          </>
        )}
      >
        {reasonModalCandidate && (
          <div className="applications-new-reason-modal">
            <div className="applications-new-reason-modal-candidate">
              {reasonModalCandidate.name || `Candidate ${reasonModalCandidate.id}`}
            </div>
            <label htmlFor="applications-new-reason-input">Remarks</label>
            <textarea
              id="applications-new-reason-input"
              className="form-control"
              rows={4}
              autoFocus
              placeholder="Enter remarks for this candidate"
              value={statusReasons[getCandidateKey(reasonModalCandidate)] ?? String(reasonModalCandidate.reason || '')}
              disabled={updatingId === reasonModalCandidate.id}
              onChange={(event) => setStatusReasons((current) => ({
                ...current,
                [getCandidateKey(reasonModalCandidate)]: event.target.value,
              }))}
            />
          </div>
        )}
      </Modal>
      <ApplicationsStatsModal
        isOpen={statsOpen}
        onClose={() => setStatsOpen(false)}
        jobId={appliedFilters.job_id || ''}
        projectCatalog={projects}
      />
    </div>
  )
}
