import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalculator, faCheck, faMapMarkerAlt, faSearch, faUsers } from '@fortawesome/free-solid-svg-icons'
import { coreRecruiterAPI, recruiterAPI } from '../../api/axios'
import { Card, DataTable, Modal } from '../../components/ui'
import { ImageModal } from '../../components/ui/ImageModal'
import { MapModal } from '../../components/ui/MapModal'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import AttendanceData from './AttendanceData'
import CoreTeamPaymentSheet from './CoreTeamPaymentSheet'
import './CoreTeamAttendance.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50]
const FIXED_PROJECT_OPTIONS = [
  { id: 'Home', name: 'Home', projectType: 'Regular', fixedLocation: 'Home' },
  { id: 'Travel', name: 'Travel', projectType: 'Regular', fixedLocation: 'Travel' },
]

const getValue = (record, keys, fallback = '') => {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key]
  }
  return fallback
}

const getList = (payload, keys = []) => {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return Array.isArray(payload) ? payload : []
}

const normalizeOptions = (items) => items.map((item) => {
  if (typeof item === 'string' || typeof item === 'number') {
    return { id: String(item), name: String(item) }
  }
  const id = item?.id ?? item?.project_id ?? item?.locationId ?? item?.districtId ?? item?.value ?? item?._id
  const name = item?.name ?? item?.project_name ?? item?.projectName ?? item?.location ?? item?.district ?? item?.title ?? item?.label ?? id
  const projectType = item?.projectType ?? item?.project_type ?? item?.projectKind ?? item?.project_kind ?? item?.kind ?? item?.type ?? item?.is_written_exam
  return id === undefined || id === null ? null : { id: String(id), name: String(name), ...(projectType !== undefined ? { projectType } : {}) }
}).filter(Boolean)

const isWrittenProject = (project) => {
  const value = project?.projectType ?? project?.project_type ?? project?.type ?? project?.name ?? ''
  return String(value).toLowerCase().replace(/[-\s]/g, '_').includes('written') || String(value).toLowerCase().includes('exam') || value === true || value === 1
}

function AttendanceRequestModal({ isOpen, onClose, projectType = 'regular' }) {
  const [requests, setRequests] = useState([])
  const [projects, setProjects] = useState([])
  const [areas, setAreas] = useState([])
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [attendanceType, setAttendanceType] = useState('')
  const [projectId, setProjectId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [areaType, setAreaType] = useState('location')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState('')
  const [selectedRequestIds, setSelectedRequestIds] = useState(() => new Set())
  const [error, setError] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    setSelectedRequestIds(new Set())
    try {
      const response = await coreRecruiterAPI.getAttendanceRequests({
        status: 'pending',
        search: search.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        attendance_type: attendanceType || undefined,
        project_id: projectId || undefined,
        ...(areaType === 'district' ? { district_id: areaId || undefined } : { location_id: areaId || undefined }),
        offset,
        limit,
      })
      const payload = response?.data?.data ?? response?.data ?? []
      const rows = getList(payload, ['requests', 'items', 'records', 'data'])
      setRequests(rows)
      setTotal(Number(payload?.total ?? payload?.count ?? payload?.totalCount ?? rows.length) || 0)
    } catch (loadError) {
      console.error('Failed to load core attendance requests:', loadError)
      setRequests([])
      setError('Unable to load attendance requests right now.')
    } finally {
      setLoading(false)
    }
  }, [areaId, areaType, attendanceType, fromDate, limit, offset, projectId, search, toDate])

  const loadProjects = useCallback(async () => {
    try {
      const response = await recruiterAPI.getProjectSuggestions('', 1000, projectType)
      const payload = response?.data?.data ?? response?.data ?? response
      setProjects(normalizeOptions(getList(payload, ['items', 'projects', 'results', 'data'])))
    } catch (loadError) {
      console.error('Failed to load projects for attendance requests:', loadError)
      setProjects([])
    }
  }, [projectType])

  useEffect(() => {
    if (isOpen) loadProjects()
  }, [isOpen, loadProjects])

  useEffect(() => {
    if (isOpen) loadRequests()
  }, [isOpen, loadRequests])

  useEffect(() => {
    if (!projectId) {
      setAreas([])
      setAreaId('')
      return
    }
    const project = projects.find((item) => item.id === projectId)
    const written = isWrittenProject(project)
    setAreaType(written ? 'district' : 'location')
    setAreaId('')
    const request = written ? recruiterAPI.getProjectDistricts(projectId) : recruiterAPI.getProjectLocations(projectId)
    request
      .then((response) => setAreas(normalizeOptions(response?.data ?? response)))
      .catch(() => setAreas([]))
  }, [projectId, projects])

  const updateFilter = (setter) => (event) => {
    setter(event.target.value)
    setOffset(0)
  }

  const toggleRequestSelection = (requestId, checked) => {
    setSelectedRequestIds((current) => {
      const next = new Set(current)
      if (checked) next.add(String(requestId))
      else next.delete(String(requestId))
      return next
    })
  }

  const toggleRequestRow = (request, event) => {
    if (event.target.closest('input, button, select, a, label') || actionId) return
    const requestId = getValue(request, ['id', 'request_id', 'requestId', '_id'])
    if (requestId) toggleRequestSelection(requestId, !selectedRequestIds.has(String(requestId)))
  }

  const togglePageSelection = (checked) => {
    setSelectedRequestIds((current) => {
      const next = new Set(current)
      requests.forEach((request) => {
        const requestId = getValue(request, ['id', 'request_id', 'requestId', '_id'])
        if (!requestId) return
        if (checked) next.add(String(requestId))
        else next.delete(String(requestId))
      })
      return next
    })
  }

  const bulkUpdateRequests = async (action) => {
    const selectedRequests = requests.filter((request) => {
      const requestId = getValue(request, ['id', 'request_id', 'requestId', '_id'])
      return requestId && selectedRequestIds.has(String(requestId))
    })
    if (!selectedRequests.length) return

    setActionId(`bulk-${action}`)
    setError('')
    const requestIds = selectedRequests.map((request) => String(getValue(request, ['id', 'request_id', 'requestId', '_id'])))
    const payload = requestIds.map((requestId) => ({ request_id: requestId, action, status: action }))
    try {
      await coreRecruiterAPI.updateAttendanceRequests(payload)
      await loadRequests()
    } catch (actionError) {
      console.error(`Failed to ${action} core attendance requests:`, actionError)
      setError(`Unable to ${action} the selected attendance requests. They remain selected.`)
    } finally {
      setActionId('')
    }
  }

  const rows = requests.map((request, index) => {
    const requestId = getValue(request, ['id', 'request_id', 'requestId', '_id'], index)
    const selectableRequestId = getValue(request, ['id', 'request_id', 'requestId', '_id'])
    const project = getValue(request, ['project_name', 'projectName', 'project', 'project_title'], '—')
    const area = getValue(request, ['location_name', 'locationName', 'location', 'district_name', 'districtName', 'district'], '—')
    const requestAttendanceType = getValue(request, ['attendance_type', 'attendanceType'])
    return [
      <input type="checkbox" aria-label={`Select attendance request ${requestId}`} checked={Boolean(selectableRequestId && selectedRequestIds.has(String(selectableRequestId)))} disabled={!selectableRequestId || Boolean(actionId)} onClick={(event) => event.stopPropagation()} onChange={(event) => toggleRequestSelection(selectableRequestId, event.target.checked)} />,
      index + 1,
      getValue(request, ['candidate_name', 'candidateName', 'candidate', 'name'], '—'),
      getValue(request, ['registration_id', 'registrationId', 'candidate_id', 'candidateId'], '—'),
      getValue(request, ['mobile', 'phone', 'contact'], '—'),
      requestAttendanceType ? <span className="tag tag-teal">{requestAttendanceType}</span> : '—',
      project,
      area,
      getValue(request, ['date', 'attendance_date', 'requested_date'], '—'),
    ]
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Approve attendance requests" maxWidth="1100px" footer={<button type="button" className="btn btn-outline" onClick={onClose}>Close</button>}>
      {error && <div className="attendance-message error" style={{ marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
        <input className="form-control" placeholder="Search candidate" value={search} onChange={updateFilter(setSearch)} />
        <input className="form-control" type="date" value={fromDate} onChange={updateFilter(setFromDate)} aria-label="From date" />
        <input className="form-control" type="date" value={toDate} onChange={updateFilter(setToDate)} aria-label="To date" />
        <select className="form-control" value={attendanceType} onChange={updateFilter(setAttendanceType)} aria-label="Filter by attendance type"><option value="">All attendance types</option><option value="excell_attendance">Excel attendance</option><option value="requested_attendance">Requested attendance</option></select>
        <select className="form-control" value={projectId} onChange={updateFilter(setProjectId)}><option value="">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select className="form-control" value={areaId} onChange={updateFilter(setAreaId)} disabled={!projectId}><option value="">All {areaType === 'district' ? 'districts' : 'locations'}</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
        <select className="form-control" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setOffset(0) }}><option value={10}>10 rows</option><option value={25}>25 rows</option><option value={50}>50 rows</option><option value={500}>500 rows</option></select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ color: 'var(--text2)', fontSize: 13 }}>{total} pending request{total === 1 ? '' : 's'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text2)', fontSize: 12 }}>{selectedRequestIds.size} selected</span>
          <button type="button" className="btn btn-success btn-sm" onClick={() => bulkUpdateRequests('approve')} disabled={!selectedRequestIds.size || loading || Boolean(actionId)}>{actionId === 'bulk-approve' ? 'Approving...' : 'Approve selected'}</button>
          <button type="button" className="btn btn-red btn-sm" onClick={() => bulkUpdateRequests('reject')} disabled={!selectedRequestIds.size || loading || Boolean(actionId)}>{actionId === 'bulk-reject' ? 'Rejecting...' : 'Reject selected'}</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadRequests} disabled={loading || Boolean(actionId)}>Refresh</button>
        </div>
      </div>
      <div className="core-attendance-requests-table">
        <DataTable columns={[<input type="checkbox" aria-label="Select all requests on this page" checked={requests.length > 0 && requests.every((request) => { const requestId = getValue(request, ['id', 'request_id', 'requestId', '_id']); return requestId && selectedRequestIds.has(String(requestId)) })} onChange={(event) => togglePageSelection(event.target.checked)} disabled={loading || Boolean(actionId) || requests.length === 0} />, '#', 'Candidate', 'Registration ID', 'Mobile', 'Attendance Type', 'Project', 'Location / District', 'Date']} rows={loading ? [] : rows} emptyMessage={loading ? 'Loading attendance requests...' : 'No pending attendance requests.'} onRowClick={(_, index, event) => toggleRequestRow(requests[index], event)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="btn btn-outline btn-sm" disabled={offset === 0 || loading} onClick={() => setOffset((current) => Math.max(0, current - limit))}>Previous</button>
        {(() => {
          const currentPage = Math.floor(offset / limit) + 1
          const totalPages = Math.max(1, Math.ceil(total / limit))
          const pageNumbers = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
            .filter((page) => page >= 1 && page <= totalPages)
            .sort((first, second) => first - second)
          const pageItems = pageNumbers.flatMap((page, index) => [
            ...(index > 0 && page - pageNumbers[index - 1] > 1 ? [`ellipsis-${page}`] : []),
            page,
          ])

          return pageItems.map((page) => typeof page === 'string' ? (
            <span key={page} aria-hidden="true" style={{ padding: '0 2px', color: 'var(--text2)' }}>...</span>
          ) : (
            <button
              key={page}
              type="button"
              className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-outline'}`}
              aria-label={`Go to page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              disabled={loading || page === currentPage}
              onClick={() => setOffset((page - 1) * limit)}
            >
              {page}
            </button>
          ))
        })()}
        <button type="button" className="btn btn-outline btn-sm" disabled={offset + requests.length >= total || loading} onClick={() => setOffset((current) => current + limit)}>Next</button>
      </div>
    </Modal>
  )
}

const parseCoords = (value) => {
  if (!value) return null
  if (typeof value === 'object') {
    const latitude = Number(value.lat ?? value.latitude ?? value.latLng?.lat)
    const longitude = Number(value.lng ?? value.longitude ?? value.lon ?? value.latLng?.lng)
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null
  }
  const parts = String(value).split(/[\s,]+/).map(Number).filter(Number.isFinite)
  return parts.length >= 2 ? { latitude: parts[0], longitude: parts[1] } : null
}

function AssignmentModal({ isOpen, onClose, onSaved, projectType = 'regular' }) {
  const [candidates, setCandidates] = useState([])
  const [projects, setProjects] = useState([])
  const [assignments, setAssignments] = useState({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [imagePreview, setImagePreview] = useState({ isOpen: false, src: '', title: '', alt: '' })
  const [mapPreview, setMapPreview] = useState({ isOpen: false, markers: [], title: '' })

  const loadProjects = useCallback(async () => {
    try {
      const response = await recruiterAPI.getProjectSuggestions('', 200, projectType)
      const payload = response?.data ?? {}
      const projectOptions = normalizeOptions(getList(payload, ['data', 'projects', 'results']))
      setProjects([
        ...FIXED_PROJECT_OPTIONS,
        ...projectOptions.filter((project) => !FIXED_PROJECT_OPTIONS.some((fixedProject) => project.name.toLowerCase() === fixedProject.name.toLowerCase())),
      ])
    } catch {
      setProjects([])
    }
  }, [projectType])

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await coreRecruiterAPI.getOutsideCoreCandidates({
        search: search.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        offset: (page - 1) * limit,
        limit,
      })
      const payload = response?.data ?? {}
      const rows = getList(payload, ['data', 'candidates', 'items', 'results'])
      setCandidates(rows)
      setTotal(Number(payload?.total ?? payload?.count ?? payload?.totalCount ?? rows.length) || 0)
    } catch (loadError) {
      console.error('Failed to load core members for assignment:', loadError)
      setCandidates([])
      setTotal(0)
      setError('Unable to load core team members right now.')
    } finally {
      setLoading(false)
    }
  }, [fromDate, limit, page, search, toDate])

  useEffect(() => {
    if (!isOpen) return
    loadProjects()
    loadCandidates()
  }, [isOpen, loadCandidates, loadProjects])

  const updateAssignment = async (candidateId, projectId) => {
    const project = projects.find((item) => String(item.id) === String(projectId))
    if (project?.fixedLocation) {
      setAssignments((current) => ({
        ...current,
        [candidateId]: { projectId, project, locationId: project.fixedLocation, locations: [] },
      }))
      return
    }

    setAssignments((current) => ({
      ...current,
      [candidateId]: { projectId, project, locationId: '', locations: [] },
    }))
    if (!projectId) return

    try {
      const response = isWrittenProject(project)
        ? await recruiterAPI.getProjectDistricts(projectId)
        : await recruiterAPI.getProjectLocations(projectId)
      const payload = response?.data ?? {}
      const options = normalizeOptions(getList(payload, isWrittenProject(project)
        ? ['data', 'districts', 'district_options', 'districtOptions']
        : ['data', 'locations', 'location_options', 'locationOptions']))
      setAssignments((current) => ({
        ...current,
        [candidateId]: { ...current[candidateId], locations: options },
      }))
    } catch {
      setAssignments((current) => ({
        ...current,
        [candidateId]: { ...current[candidateId], locations: [] },
      }))
    }
  }

  const saveAssignment = async (candidate) => {
    const candidateId = String(getValue(candidate, ['candidate_id', 'candidateId', 'id', '_id', 'attendance_id']))
    const assignment = assignments[candidateId]
    if (!assignment?.projectId || !assignment.locationId) return

    setSavingId(candidateId)
    setError('')
    try {
      await coreRecruiterAPI.assignCoreCandidates({
        candidate_id: candidateId,
        project_id: assignment.project?.fixedLocation ? '' : assignment.projectId,
        ...(assignment.project?.fixedLocation ? {
          project_name: assignment.project.name,
          project_type: assignment.project.projectType,
        } : {}),
        ...(isWrittenProject(assignment.project) ? { district_id: assignment.locationId } : { location_id: assignment.locationId }),
      })
      setAssignments((current) => ({ ...current, [candidateId]: { ...current[candidateId], saved: true } }))
      onSaved?.()
    } catch (saveError) {
      console.error('Failed to assign core member:', saveError)
      setError('Unable to save this assignment. Please try again.')
    } finally {
      setSavingId('')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const rows = candidates.map((candidate, index) => {
    const candidateId = String(getValue(candidate, ['candidate_id', 'candidateId', 'id', '_id', 'attendance_id'], index))
    const assignment = assignments[candidateId] || {}
    const name = getValue(candidate, ['candidate_name', 'name', 'fullName', 'worker_name'], 'Unknown')
    const mobile = getValue(candidate, ['mobile', 'phone', 'contact'], '—')
    const identifier = getValue(candidate, ['aadhaar', 'aadhaar_number', 'aadhar'], '—')
    const candidateDate = getValue(candidate, ['date', 'created_at', 'createdAt', 'added'], '')
    const typedProject = getValue(candidate, ['typed_in_project', 'typedProject', 'typed_project', 'entered_project', 'enteredProject', 'project_name', 'projectName', 'project'], '—')
    const typedLocation = getValue(candidate, ['typed_in_location', 'typedLocation', 'typed_location', 'entered_location', 'enteredLocation', 'location_name', 'locationName', 'location', 'district_name', 'district'], '—')
    const checkInImage = getValue(candidate, ['check_in_image', 'checkInImage', 'checkin_image', 'photo', 'profile_image'], '')
    const checkOutImage = getValue(candidate, ['check_out_image', 'checkOutImage', 'checkout_image', 'checkout_photo'], '')
    const markers = [
      ['Check-in location', candidate.checkin_location ?? candidate.checkInLocation ?? candidate.checkin],
      ['Check-out location', candidate.checkout_location ?? candidate.checkOutLocation ?? candidate.checkout],
    ].map(([label, value]) => {
      const coords = parseCoords(value)
      return coords ? { ...coords, label } : null
    }).filter(Boolean)
    return [
      (page - 1) * limit + index + 1,
      candidateDate ? new Date(candidateDate).toLocaleDateString('en-IN') : '—',
      name,
      identifier,
      mobile,
      typedProject,
      typedLocation,
      <SearchableProjectSelect options={projects} value={assignment.projectId || ''} onChange={(projectId) => updateAssignment(candidateId, projectId)} />,
      <select className="form-control" value={assignment.locationId || ''} onChange={(event) => setAssignments((current) => ({ ...current, [candidateId]: { ...current[candidateId], locationId: event.target.value, saved: false } }))} disabled={!assignment.projectId || (!assignment.project?.fixedLocation && !(assignment.locations?.length > 0))}>
        <option value="">{isWrittenProject(assignment.project) ? 'Select district' : 'Select location'}</option>
        {assignment.project?.fixedLocation && <option value={assignment.project.fixedLocation}>{assignment.project.fixedLocation}</option>}
        {(assignment.locations || []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>,
      getValue(candidate, ['clock_in', 'clockIn', 'check_in_time', 'checkin_time', 'check_in', 'checkin'], '—'),
      getValue(candidate, ['clock_out', 'clockOut', 'check_out_time', 'checkout_time', 'check_out', 'checkout'], '—'),
      checkInImage ? <button type="button" className="attendance-image-button" onClick={() => setImagePreview({ isOpen: true, src: checkInImage, title: 'Check-in image', alt: 'Check in' })}><img src={checkInImage} alt="Check in" className="attendance-image-thumb" /></button> : '—',
      checkOutImage ? <button type="button" className="attendance-image-button" onClick={() => setImagePreview({ isOpen: true, src: checkOutImage, title: 'Check-out image', alt: 'Check out' })}><img src={checkOutImage} alt="Check out" className="attendance-image-thumb" /></button> : '—',
      markers.length > 0 ? <button type="button" className="map-pin-btn" onClick={() => setMapPreview({ isOpen: true, markers, title: name })}><FontAwesomeIcon icon={faMapMarkerAlt} /></button> : '—',
      getValue(candidate, ['status'], assignment.saved ? 'Assigned' : 'Unassigned'),
      assignment.saved ? <span className="tag tag-green">Assigned</span> : <button className="btn btn-primary btn-sm" type="button" disabled={!assignment.projectId || !assignment.locationId || savingId === candidateId} onClick={() => saveAssignment(candidate)}>{savingId === candidateId ? 'Saving...' : 'Assign'}</button>,
    ]
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign core members to projects" maxWidth="1200px" footer={<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%' }}><button type="button" className="btn btn-outline" onClick={onClose}>Close</button><button type="button" className="btn btn-primary" onClick={onClose}>Done</button></div>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="outside-location-modal-content" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Current assignments</div>
            <div style={{ color: 'var(--text2)', fontSize: 13 }}>{Object.values(assignments).filter((assignment) => assignment.saved).length} assigned, {Object.values(assignments).filter((assignment) => assignment.projectId && assignment.locationId && !assignment.saved).length} pending save.</div>
          </div>
        </div>
        <div className="projects-table-filters" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="projects-table-filter-group search-group" style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input className="form-control" value={search} placeholder="Search candidates…" onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
            </div>
          </div>
          <div className="projects-table-filter-group date-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="filter-label">From</span>
            <input className="form-control" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1) }} />
            <span className="filter-label">To</span>
            <input className="form-control" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1) }} />
          </div>
          <label className="entries-selector">
            <span>Rows</span>
            <select className="form-control" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }}>{PAGE_SIZE_OPTIONS.map((value) => <option key={value} value={value}>{value} entries</option>)}</select>
          </label>
        </div>
        {error && <div className="attendance-message error">{error}</div>}
        <div className="projects-table-wrap core-attendance-assignment-table">
          <DataTable columns={['ID', 'Date', 'Candidate', 'Aadhaar', 'Mobile', 'Typed in project', 'Typed in location', 'Project', 'District / Location', 'Clock In', 'Clock Out', 'Check In Image', 'Check Out Image', 'Map', 'Status', 'Action']} rows={loading ? [] : rows} emptyMessage={loading ? 'Loading core members...' : 'No core members available for assignment.'} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>Showing {total === 0 ? 0 : (page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="form-control" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }}>{PAGE_SIZE_OPTIONS.map((value) => <option key={value} value={value}>{value} rows</option>)}</select>
            <button className="btn btn-outline btn-sm" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-outline btn-sm" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </div>
        <ImageModal isOpen={imagePreview.isOpen} onClose={() => setImagePreview({ isOpen: false, src: '', title: '', alt: '' })} imageUrl={imagePreview.src} title={imagePreview.title} alt={imagePreview.alt} />
        <MapModal isOpen={mapPreview.isOpen} onClose={() => setMapPreview({ isOpen: false, markers: [], title: '' })} markers={mapPreview.markers} title={mapPreview.title} />
      </div>
    </Modal>
  )
}

export default function CoreTeamAttendance() {
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false)
  const [isRequestApprovalOpen, setIsRequestApprovalOpen] = useState(false)
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false)
  const [attendanceVariant, setAttendanceVariant] = useState('regular')
  const [unassignedCoreCount, setUnassignedCoreCount] = useState(0)
  const [unassignedCoreCountLoading, setUnassignedCoreCountLoading] = useState(false)
  const [presentCounts, setPresentCounts] = useState([])
  const [presentCountsLoading, setPresentCountsLoading] = useState(false)
  const [presentCountsError, setPresentCountsError] = useState('')
  const [attendanceFilters, setAttendanceFilters] = useState({})
  const [presentCountsSearch, setPresentCountsSearch] = useState('')
  const [presentCountsFromDate, setPresentCountsFromDate] = useState('')
  const [presentCountsToDate, setPresentCountsToDate] = useState('')

  const loadUnassignedCoreCount = useCallback(async () => {
    setUnassignedCoreCountLoading(true)
    try {
      const response = await coreRecruiterAPI.getOutsideCoreCandidates({
        limit: 1,
        offset: 0,
      })
      const payload = response?.data ?? {}
      const rows = getList(payload, ['data', 'candidates', 'items', 'results'])
      const count = payload?.total ?? payload?.count ?? payload?.totalCount ?? rows.length
      setUnassignedCoreCount(Number(count) || 0)
    } catch (loadError) {
      console.error('Failed to load unassigned core member count:', loadError)
      setUnassignedCoreCount(0)
    } finally {
      setUnassignedCoreCountLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUnassignedCoreCount()
  }, [loadUnassignedCoreCount, attendanceVariant])

  useEffect(() => {
    let cancelled = false
    const loadPresentCounts = async () => {
      setPresentCountsLoading(true)
      setPresentCountsError('')
      try {
        const response = await coreRecruiterAPI.getPresentCounts({
          projectType: attendanceVariant,
          project_id: attendanceFilters.project_id,
          from: presentCountsFromDate || undefined,
          to: presentCountsToDate || undefined,
        })
        const payload = response?.data ?? {}
        const rawRows = getList(payload, ['data', 'projects', 'items', 'results'])
        const rows = rawRows.map((row) => ({
          project: getValue(row, ['project_name', 'projectName', 'project', 'name', 'title'], '—'),
          present: Number(getValue(row, ['present', 'present_count', 'presentCount', 'available'], 0)) || 0,
        }))
        if (!cancelled) setPresentCounts(rows)
      } catch (loadError) {
        console.error('Failed to load core team present counts:', loadError)
        if (!cancelled) {
          setPresentCounts([])
          setPresentCountsError('Unable to load project present counts right now.')
        }
      } finally {
        if (!cancelled) setPresentCountsLoading(false)
      }
    }

    loadPresentCounts()
    return () => { cancelled = true }
  }, [attendanceFilters.project_id, attendanceVariant, presentCountsFromDate, presentCountsToDate])

  const headerActions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <div className="attendance-mode-switch" role="group" aria-label="Core attendance project type">
        <button type="button" className={attendanceVariant === 'regular' ? 'active' : ''} aria-pressed={attendanceVariant === 'regular'} onClick={() => setAttendanceVariant('regular')}>
          Regular
        </button>
        <button type="button" className={attendanceVariant === 'written' ? 'active' : ''} aria-pressed={attendanceVariant === 'written'} onClick={() => setAttendanceVariant('written')}>
          Written
        </button>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsAssignmentOpen(true)}>
        <FontAwesomeIcon icon={faUsers} /> Assign core members to projects
        {!unassignedCoreCountLoading && unassignedCoreCount > 0 && (
          <span style={{ minWidth: 20, height: 20, padding: '0 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--saffron)', color: 'var(--navy)', fontSize: 11, fontWeight: 800 }}>
            {unassignedCoreCount > 99 ? '99+' : unassignedCoreCount}
          </span>
        )}
      </button>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsRequestApprovalOpen(true)}>
        <FontAwesomeIcon icon={faCheck} /> Approve attendance
      </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setIsPaymentSheetOpen(true)}
        >
          <FontAwesomeIcon icon={faCalculator} /> Configure &amp; Generate Sheet
        </button>
    </div>
  )

  const presentCountsCard = (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Present counts by project</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text3)', fontSize: 13 }}>
            {attendanceVariant === 'written' ? 'Written projects' : 'Regular projects'}
          </p>
        </div>
      </div>
      <div className="projects-table-filters" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="projects-table-filter-group search-group" style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div className="filter-label">Search project</div>
          <div className="filter-search-box">
            <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
            <input className="form-control" value={presentCountsSearch} placeholder="Search projects" onChange={(event) => setPresentCountsSearch(event.target.value)} />
          </div>
        </div>
        <label className="projects-table-filter-group date-group">
          <span className="filter-label">From</span>
          <input className="form-control" type="date" value={presentCountsFromDate} onChange={(event) => setPresentCountsFromDate(event.target.value)} />
        </label>
        <label className="projects-table-filter-group date-group">
          <span className="filter-label">To</span>
          <input className="form-control" type="date" value={presentCountsToDate} onChange={(event) => setPresentCountsToDate(event.target.value)} />
        </label>
      </div>
      {presentCountsError && <div className="attendance-message error">{presentCountsError}</div>}
      {presentCountsLoading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Loading present counts...</div>
      ) : (() => {
        const filteredCounts = presentCounts
          .filter((row) => row.project.toLowerCase().includes(presentCountsSearch.trim().toLowerCase()))
          .sort((first, second) => second.present - first.present)
        const highestPresent = Math.max(...filteredCounts.map((row) => row.present), 1)

        if (filteredCounts.length === 0) {
          return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>No project present counts available.</div>
        }

        return (
          <div style={{ background: 'var(--bg-light)', border: '1px solid var(--border-light)', borderRadius: 12, padding: '8px 18px', maxHeight: 390, overflowY: 'auto' }}>
            {filteredCounts.map((row, index) => (
              <div key={`${row.project}-${index}`} style={{ display: 'grid', gridTemplateColumns: '30px minmax(130px, 0.75fr) minmax(120px, 1.8fr) 58px', alignItems: 'center', gap: 14, minHeight: 58, borderBottom: index === filteredCounts.length - 1 ? 0 : '1px solid var(--border)' }}>
                <span style={{ color: index === 0 ? 'var(--saffron)' : 'var(--text3)', fontSize: 12, fontWeight: 800 }}>#{String(index + 1).padStart(2, '0')}</span>
                <strong style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{row.project}</strong>
                <div style={{ height: 10, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max((row.present / highestPresent) * 100, row.present > 0 ? 3 : 0)}%`, height: '100%', background: index === 0 ? 'var(--saffron2)' : 'var(--teal2)', borderRadius: 999 }} />
                </div>
                <strong style={{ color: 'var(--teal)', fontSize: 22, textAlign: 'right', lineHeight: 1 }}>{row.present}</strong>
              </div>
            ))}
          </div>
        )
      })()}
    </Card>
  )

  return (
    <>
      <AttendanceData forcedAttendanceMode="core" attendanceVariant={attendanceVariant} pageTitle="Core Team Attendance" headerActions={headerActions} hideSummary topContent={presentCountsCard} onAttendanceFiltersChange={setAttendanceFilters} hideBackToSummary />
      <AssignmentModal isOpen={isAssignmentOpen} onClose={() => setIsAssignmentOpen(false)} onSaved={loadUnassignedCoreCount} projectType={attendanceVariant} />
      <AttendanceRequestModal isOpen={isRequestApprovalOpen} onClose={() => setIsRequestApprovalOpen(false)} projectType={attendanceVariant} />
      {isPaymentSheetOpen && (
        <CoreTeamPaymentSheet
          isOpen
          projectId={attendanceFilters.project_id}
          projectTitle={attendanceFilters.projectTitle}
          projectType={attendanceVariant === 'written' ? 'written_exam' : 'regular'}
          onClose={() => setIsPaymentSheetOpen(false)}
        />
      )}
    </>
  )
}
