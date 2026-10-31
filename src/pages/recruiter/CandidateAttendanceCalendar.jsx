import { useEffect, useMemo, useState } from 'react'
import { candidateAPI, coreRecruiterAPI, recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import './CandidateAttendanceCalendar.css'

const STATIC_OPTIONS = ['Home', 'Travel'].map((name) => ({ id: name, name }))
const STATIC_OPTION_IDS = new Set(STATIC_OPTIONS.map((option) => option.id))
const getStaticOptionId = (value) => STATIC_OPTIONS.find((option) => option.name.toLowerCase() === String(value || '').trim().toLowerCase())?.id || ''

const field = (item, keys, fallback = '') => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item[key] !== '') return item[key]
  }
  return fallback
}

const getSubmittedRequestIds = (response) => {
  const requestIds = new Set()
  const visit = (value, allowRecordId = false) => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, true))
      return
    }
    if (!value || typeof value !== 'object') return

    const explicitId = field(value, ['request_id', 'requestId'])
    const recordId = allowRecordId || value.date || value.attendance_date || value.requested_date
      ? field(value, ['id', '_id'])
      : ''
    if (explicitId || recordId) requestIds.add(String(explicitId || recordId))

    for (const key of ['request_ids', 'requestIds']) {
      if (Array.isArray(value[key])) value[key].forEach((id) => id && requestIds.add(String(id)))
    }
    for (const key of ['data', 'requests', 'items', 'records', 'created_requests', 'createdRequests']) {
      if (value[key] !== undefined) visit(value[key], true)
    }
  }

  visit(response?.data?.data ?? response?.data ?? response)
  return [...requestIds]
}

const getPendingRequestIds = async (candidate, requests) => {
  const dates = requests.map((request) => request.date).sort()
  const response = await coreRecruiterAPI.getAttendanceRequests({
    status: 'pending',
    search: candidate.registrationId,
    from: dates[0],
    to: dates[dates.length - 1],
    offset: 0,
    limit: 500,
  })
  const payload = response?.data?.data ?? response?.data ?? []
  const wantedDates = new Set(dates)
  return listFrom(payload)
    .filter((request) => {
      const registrationId = field(request, ['registration_id', 'registrationId', 'candidate_id', 'candidateId'])
      const date = String(field(request, ['date', 'attendance_date', 'attendanceDate', 'requested_date']))
      return String(registrationId) === String(candidate.registrationId) && wantedDates.has(date)
    })
    .map((request) => String(field(request, ['request_id', 'requestId', 'id', '_id'])))
    .filter(Boolean)
}

const listFrom = (value) => {
  let payload = value
  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(payload)) return payload
    if (!payload || typeof payload !== 'object') return []
    for (const key of ['items', 'records', 'requests', 'projects']) {
      if (Array.isArray(payload[key])) return payload[key]
    }
    if (payload.data !== undefined) {
      payload = payload.data
      continue
    }
    return []
  }
  return []
}

const normalizeProjectApiId = (value) => String(value || '').replace(/^proj_/, '').replace(/^project_/, '').trim()
const normalizeProjectMatchToken = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const normalizeOptions = (items) => listFrom(items)
  .map((item) => {
    const id = typeof item === 'string' || typeof item === 'number'
      ? String(item)
      : field(item, ['id', 'project_id', 'projectId', 'locationId', 'districtId', 'value', '_id'])
    if (!id) return null
    return {
      ...((typeof item === 'object' && item) || {}),
      id: normalizeProjectApiId(id),
      name: String(typeof item === 'object' ? field(item, ['name', 'project_name', 'projectName', 'location', 'district', 'title', 'label'], id) : id),
      projectType: typeof item === 'object' ? field(item, ['projectType', 'project_type', 'projectKind', 'project_kind', 'type', 'is_written_exam']) : '',
    }
  })
  .filter(Boolean)

const isWrittenProject = (project) => {
  const value = project?.projectType ?? project?.project_type ?? project?.type ?? project?.name ?? ''
  const normalized = String(value).toLowerCase().replace(/[-\s]/g, '_')
  return normalized.includes('written') || normalized.includes('exam') || value === true || value === 1
}

const normalizeDateRows = (payload) => listFrom(payload?.dates || payload?.attendance_dates || payload?.attendanceDates || payload?.records)
  .map((item) => {
    const date = typeof item === 'string' ? item : field(item, ['date', 'attendance_date', 'attendanceDate'])
    const project = typeof item === 'object' ? item.project : null
    const rawProjectId = typeof item === 'object'
      ? field(item, ['project_id', 'projectId'], field(project, ['id', 'project_id', 'projectId']))
      : ''
    const projectLabel = typeof item === 'object'
      ? String(field(item, ['project_name', 'projectName'], typeof project === 'string' ? project : field(project, ['name', 'project_name', 'projectName'])))
      : ''
    const locationLabel = typeof item === 'object'
      ? String(field(item, ['location_name', 'locationName', 'district_name', 'districtName', 'location', 'district']))
      : ''
    const zeroIdStaticProject = String(rawProjectId) === '0' ? getStaticOptionId(projectLabel) : ''
    const projectId = zeroIdStaticProject || normalizeProjectApiId(rawProjectId)
    const rawLocationId = typeof item === 'object' ? field(item, ['location_id', 'locationId', 'district_id', 'districtId']) : ''
    const locationId = zeroIdStaticProject
      ? getStaticOptionId(locationLabel) || zeroIdStaticProject
      : String(rawLocationId || '')
    return {
      date: String(date || ''),
      status: typeof item === 'string' ? '' : String(field(item, ['status', 'attendance_status', 'attendanceStatus'])),
      projectId,
      projectLabel,
      locationId,
      locationLabel,
      projectType: String(typeof item === 'object' ? field(item, ['project_type', 'projectType', 'project_kind', 'projectKind'], field(project, ['project_type', 'projectType', 'type'])) : ''),
    }
  })
  .filter((item) => item.date)

const getCalendarDays = (monthKey) => {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  if (!year || !month) return []
  const firstDay = new Date(year, month - 1, 1).getDay()
  const dayCount = new Date(year, month, 0).getDate()
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`),
  ]
}

const monthLabel = (monthKey) => {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  return year && month ? new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''
}

const formatDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : value
}

const getStatusKind = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (['present', 'approved', 'complete', 'completed', 'late'].includes(normalized)) return 'present'
  if (['absent', 'rejected', 'missing', 'not marked', 'not_marked'].includes(normalized)) return 'absent'
  return 'pending'
}

function matchProjectToOption(row, projects) {
  if (STATIC_OPTION_IDS.has(row.projectId)) return row.projectId
  const targetId = normalizeProjectApiId(row.projectId)
  const targetLabel = normalizeProjectMatchToken(row.projectLabel)
  return projects.find((project) => {
    const projectId = normalizeProjectApiId(project.id)
    const projectLabel = normalizeProjectMatchToken(project.name)
    return (targetId && projectId === targetId) || (targetLabel && (projectLabel === targetLabel || projectLabel.includes(targetLabel) || targetLabel.includes(projectLabel)))
  })?.id || row.projectId || ''
}

export default function CandidateAttendanceCalendar({ isOpen, onClose, candidate, onAttendanceUpdated }) {
  const [rows, setRows] = useState([])
  const [projects, setProjects] = useState([])
  const [areaOptions, setAreaOptions] = useState({})
  const [selections, setSelections] = useState({})
  const [initialSelections, setInitialSelections] = useState({})
  const [calendarMonth, setCalendarMonth] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [viewMode, setViewMode] = useState('calendar')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pendingRequests, setPendingRequests] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  const projectOptions = useMemo(() => [...STATIC_OPTIONS, ...projects], [projects])
  const dateMap = useMemo(() => Object.fromEntries(rows.map((row) => [row.date, row])), [rows])
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth])
  const changedDates = useMemo(() => new Set(rows
    .filter((row) => {
      const initial = initialSelections[row.date] || {}
      const current = selections[row.date] || {}
      return initial.projectId !== current.projectId || initial.locationId !== current.locationId
    })
    .map((row) => row.date)), [initialSelections, rows, selections])

  useEffect(() => {
    if (!isOpen || !candidate?.registrationId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setMessage('')
    setRows([])
    setAreaOptions({})

    Promise.all([
      candidateAPI.getAttendanceRequestForm(candidate.registrationId),
      recruiterAPI.getProjects({ limit: 1000 }),
    ])
      .then(([attendanceResponse, projectResponse]) => {
        if (cancelled) return
        const payload = attendanceResponse?.data?.data ?? attendanceResponse?.data ?? {}
        const dateRows = normalizeDateRows(payload)
        const nextProjects = normalizeOptions(projectResponse?.data ?? projectResponse)
        const initial = Object.fromEntries(dateRows.map((row) => {
          const projectId = matchProjectToOption(row, nextProjects)
          return [row.date, {
            projectId,
            locationId: STATIC_OPTION_IDS.has(projectId) ? projectId : row.locationId,
          }]
        }))
        setRows(dateRows)
        setProjects(nextProjects)
        setSelections(initial)
        setInitialSelections(initial)
        setCalendarMonth(dateRows[0]?.date.slice(0, 7) || '')
        setSelectedDate(dateRows[0]?.date || '')
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error('Unable to load candidate attendance calendar:', loadError)
        setError('Unable to load attendance dates for this team member.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [candidate?.registrationId, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const projectIds = [...new Set(rows.map((row) => selections[row.date]?.projectId).filter((id) => id && !STATIC_OPTION_IDS.has(id)))]
    projectIds.forEach((projectId) => {
      if (Object.prototype.hasOwnProperty.call(areaOptions, projectId)) return
      const project = projects.find((item) => item.id === projectId)
      const dateRow = rows.find((row) => selections[row.date]?.projectId === projectId)
      const written = isWrittenProject(project) || String(dateRow?.projectType || '').toLowerCase() === 'written'
      const loadAreas = written ? recruiterAPI.getProjectDistricts(projectId) : recruiterAPI.getProjectLocations(projectId)
      loadAreas
        .then((response) => setAreaOptions((current) => ({ ...current, [projectId]: normalizeOptions(response?.data ?? response) })))
        .catch(() => setAreaOptions((current) => ({ ...current, [projectId]: [] })))
    })
  }, [areaOptions, isOpen, projects, rows, selections])

  const getAreas = (projectId, row) => {
    const options = [...STATIC_OPTIONS, ...(areaOptions[projectId] || [])]
    if (row?.locationId && !options.some((option) => option.id === row.locationId)) {
      options.push({ id: row.locationId, name: row.locationLabel || row.locationId })
    }
    return options
  }

  const updateSelection = (date, key, value) => {
    setSelections((current) => ({
      ...current,
      [date]: {
        ...current[date],
        [key]: value,
        ...(key === 'projectId' ? { locationId: STATIC_OPTION_IDS.has(value) ? value : '' } : {}),
      },
    }))
  }

  const renderDateEditor = (row) => {
    const selection = selections[row.date] || {}
    const fixedLocation = STATIC_OPTION_IDS.has(selection.projectId)
    const options = fixedLocation ? STATIC_OPTIONS.filter((option) => option.id === selection.projectId) : getAreas(selection.projectId, row)
    const hasProject = projectOptions.some((project) => project.id === selection.projectId)
    const hasLocation = options.some((option) => option.id === selection.locationId)
    const project = projects.find((item) => item.id === selection.projectId)
    const written = isWrittenProject(project) || String(row.projectType || '').toLowerCase() === 'written'

    return (
      <div className="candidate-attendance-editor">
        <div><div className="candidate-attendance-label">{viewMode === 'calendar' ? 'Selected date' : 'Attendance date'}</div><strong>{formatDate(row.date)}</strong><div className="candidate-attendance-status">Current status: {row.status || 'Not marked'}</div></div>
        <label><span className="candidate-attendance-label">Project</span>{row.projectLabel && !hasProject && <small>Recorded project: {row.projectLabel}</small>}<SearchableProjectSelect options={projectOptions} value={selection.projectId || ''} onChange={(value) => updateSelection(row.date, 'projectId', value)} placeholder="Search project" /></label>
        <label><span className="candidate-attendance-label">{written ? 'Location / District' : 'Location'}</span>{row.locationLabel && !hasLocation && <small>Recorded location: {row.locationLabel}</small>}<SearchableProjectSelect options={options} value={selection.locationId || ''} onChange={(value) => updateSelection(row.date, 'locationId', value)} placeholder={fixedLocation ? selection.projectId : selection.projectId ? `Choose ${written ? 'a district' : 'a location'}` : 'Choose project first'} disabled={!selection.projectId || fixedLocation} /></label>
      </div>
    )
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const requests = rows
      .filter((row) => changedDates.has(row.date) && selections[row.date]?.projectId && selections[row.date]?.locationId)
      .map((row) => {
        const selection = selections[row.date]
        const project = projectOptions.find((item) => item.id === selection.projectId)
        const location = getAreas(selection.projectId, row).find((item) => item.id === selection.locationId)
        const written = isWrittenProject(project) || String(row.projectType || '').toLowerCase() === 'written' || Boolean(location?.district_id || location?.districtId)
        return {
          date: row.date,
          project_id: normalizeProjectApiId(selection.projectId),
          project: String(project?.name || selection.projectId),
          project_type: written ? 'written' : 'regular',
          ...(written
            ? { district_id: selection.locationId, district: String(location?.name || selection.locationId) }
            : { location_id: selection.locationId, location: String(location?.name || selection.locationId) }),
        }
      })

    if (!requests.length) {
      setError(changedDates.size ? 'Choose a project and location for each changed date.' : 'Change at least one date before submitting an attendance request.')
      return
    }
    setError('')
    setPendingRequests(requests)
    setConfirmOpen(true)
  }

  const confirmSubmission = async () => {
    const profile = candidate?.profile || candidate?.candidate || candidate?.user || candidate || {}
    const fullName = String(field(profile, ['name', 'candidate_name', 'full_name', 'fullName'], candidate?.name || '')).trim()
    const nameParts = fullName.split(/\s+/).filter(Boolean)
    setSubmitting(true)
    setConfirmOpen(false)
    setError('')
    setMessage('')
    try {
      let existingPendingRequestIds = null
      try {
        existingPendingRequestIds = new Set(await getPendingRequestIds(candidate, pendingRequests))
      } catch (snapshotError) {
        console.warn('Unable to snapshot pending attendance requests before submission:', snapshotError)
      }

      const response = await candidateAPI.submitAttendanceRequest({
        registration_id: candidate.registrationId,
        first_name: field(profile, ['first_name', 'firstName'], nameParts[0] || ''),
        last_name: field(profile, ['last_name', 'lastName'], nameParts.slice(1).join(' ')),
        mobile: field(profile, ['mobile', 'mobile_number', 'phone'], candidate.mobile || ''),
        current_salary: field(profile, ['current_salary', 'currentSalary', 'salary'], ''),
        requests: pendingRequests,
      })
      setInitialSelections(selections)

      let requestIds = getSubmittedRequestIds(response)
      if (!requestIds.length && existingPendingRequestIds) {
        try {
          const currentPendingRequestIds = await getPendingRequestIds(candidate, pendingRequests)
          requestIds = currentPendingRequestIds.filter((requestId) => !existingPendingRequestIds.has(requestId))
        } catch (lookupError) {
          console.warn('Unable to identify newly submitted attendance requests:', lookupError)
        }
      }
      if (!requestIds.length) {
        setError('Attendance request submitted, but the server returned no request IDs for automatic approval. Approve it from the Core Team attendance requests.')
        return
      }

      try {
        await coreRecruiterAPI.updateAttendanceRequests(requestIds.map((requestId) => ({
          request_id: requestId,
          action: 'approve',
          status: 'approve',
        })))
        const refreshed = await onAttendanceUpdated?.()
        setMessage(refreshed === false
          ? 'Attendance request submitted and approved, but the payment table could not be refreshed.'
          : 'Attendance request submitted, approved, and payment table updated.')
      } catch (approvalError) {
        console.error('Unable to auto-approve candidate attendance request:', approvalError)
        setError('Attendance request submitted, but automatic approval failed. It remains pending in Core Team attendance requests.')
      }
    } catch (submitError) {
      console.error('Unable to submit candidate attendance request:', submitError)
      setError('Unable to submit the attendance request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const shiftMonth = (offset) => {
    const [year, month] = calendarMonth.split('-').map(Number)
    const next = new Date(year, month - 1 + offset, 1)
    setCalendarMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  const selectedDateRow = dateMap[selectedDate]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Attendance request · ${candidate?.name || 'Team member'}`} maxWidth="980px">
      <div className="candidate-attendance-calendar">
        {loading && <div className="candidate-attendance-notice">Loading attendance dates...</div>}
        {error && <div className="attendance-message error" role="alert">{error}</div>}
        {message && <div className="candidate-attendance-success" role="status">{message}</div>}
        {!loading && rows.length === 0 && !error && <div className="candidate-attendance-notice">No attendance dates are available for this team member.</div>}
        {!loading && rows.length > 0 && <>
          <div className="candidate-attendance-toolbar">
            <div><strong>{candidate?.name}</strong><span>{candidate?.mobile || candidate?.registrationId}</span></div>
            <div className="candidate-attendance-toolbar-actions"><span>{changedDates.size} changed</span><button type="button" className="btn btn-outline btn-sm" onClick={() => setViewMode((current) => current === 'calendar' ? 'list' : 'calendar')}>{viewMode === 'calendar' ? 'Edit all dates' : 'Calendar view'}</button></div>
          </div>
          {viewMode === 'calendar' ? <>
            <div className="candidate-attendance-month"><button type="button" className="btn btn-outline btn-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button><strong>{monthLabel(calendarMonth)}</strong><button type="button" className="btn btn-outline btn-sm" onClick={() => shiftMonth(1)} aria-label="Next month">›</button></div>
            <div className="candidate-attendance-calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="weekday" key={day}>{day}</div>)}
              {calendarDays.map((date, index) => {
                const row = date ? dateMap[date] : null
                const changed = date && changedDates.has(date)
                return <button key={date || `empty-${index}`} type="button" className={`day ${row ? getStatusKind(row.status) : 'empty'}${date === selectedDate ? ' selected' : ''}`} onClick={() => date && row && setSelectedDate(date)} disabled={!row}>
                  {date && <><strong>{Number(date.slice(-2))}{changed && <span className="changed-dot" title="Edited" />}</strong><span>{row?.status || (row ? 'Not marked' : '')}</span></>}
                </button>
              })}
            </div>
            {selectedDateRow && renderDateEditor(selectedDateRow)}
          </> : <div className="candidate-attendance-all-dates">{rows.map((row) => <div key={row.date}>{renderDateEditor(row)}</div>)}</div>}
        </>}
        {confirmOpen && <div className="candidate-attendance-confirm-backdrop" role="presentation">
          <div className="candidate-attendance-confirm" role="dialog" aria-modal="true" aria-labelledby="candidate-attendance-confirm-title">
            <h3 id="candidate-attendance-confirm-title">Submit attendance request?</h3>
            <p>This will submit {pendingRequests.length} changed date{pendingRequests.length === 1 ? '' : 's'} for approval.</p>
            <div><button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" onClick={confirmSubmission} disabled={submitting}>{submitting ? 'Submitting...' : 'Confirm and submit'}</button></div>
          </div>
        </div>}
        {!loading && rows.length > 0 && <div className="candidate-attendance-footer"><button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting || changedDates.size === 0}>{submitting ? 'Submitting...' : 'Submit attendance request'}</button></div>}
      </div>
    </Modal>
  )
}