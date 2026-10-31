import { useEffect, useMemo, useState } from 'react'
import { candidateAPI, recruiterAPI } from '../../api/axios'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import { decryptRegistrationId } from '../../utils/faceEnrollLinkCrypto'

const unwrap = (value) => value?.data ?? value ?? {}
const listFrom = (value) => {
  let payload = value
  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(payload)) return payload
    if (!payload || typeof payload !== 'object') return []
    if (Array.isArray(payload.items)) return payload.items
    if (Array.isArray(payload.records)) return payload.records
    if (payload.data !== undefined) {
      payload = payload.data
      continue
    }
    return []
  }
  return []
}
const field = (item, keys, fallback = '') => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== '') return item[key]
  }
  return fallback
}
const idOf = (item) => String(field(item, ['id', 'project_id', 'projectId', 'location_id', 'locationId', 'district_id', 'districtId', 'value']))
const labelOf = (item) => String(field(item, ['name', 'project_name', 'projectName', 'location_name', 'locationName', 'district_name', 'districtName', 'label', 'title'], idOf(item)))
const STATIC_OPTIONS = ['Home', 'Travel'].map((label) => ({ id: label, label }))
const STATIC_OPTION_IDS = new Set(STATIC_OPTIONS.map((option) => option.id))

const normalizeOptions = (items) => listFrom(items)
  .map((item) => ({ ...item, id: normalizeProjectApiId(idOf(item)), label: labelOf(item) }))
  .filter((item) => item.id)
const normalizeProjectApiId = (value) => String(value || '').replace(/^proj_/, '').replace(/^project_/, '').trim()
const normalizeProjectMatchToken = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
const formatAttendanceDate = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return value || '—'
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
const getMonthKey = (value) => String(value || '').slice(0, 7)
const formatMonthLabel = (monthKey) => {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  if (!year || !month) return ''
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
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
const getStatusKind = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (['present', 'approved', 'complete', 'completed', 'late'].includes(normalized)) return 'present'
  if (['absent', 'rejected', 'missing', 'not marked', 'not_marked'].includes(normalized)) return 'absent'
  return 'pending'
}

const normalizeDateRows = (payload) => {
  const dates = listFrom(payload?.dates || payload?.attendance_dates || payload?.attendanceDates || payload?.records)
  return dates.map((item) => {
    const date = typeof item === 'string' ? item : field(item, ['date', 'attendance_date', 'attendanceDate'])
    const status = typeof item === 'string' ? '' : field(item, ['status', 'attendance_status', 'attendanceStatus'])
    const project = typeof item === 'object' ? item.project : null
    const projectId = typeof item === 'object'
      ? normalizeProjectApiId(field(item, ['project_id', 'projectId'], field(project, ['id', 'project_id', 'projectId'])))
      : ''
    const projectLabel = typeof item === 'object'
      ? field(item, ['project_name', 'projectName'], typeof project === 'string' ? project : field(project, ['name', 'project_name', 'projectName']))
      : ''
    const locationId = typeof item === 'object'
      ? String(field(item, ['location_id', 'locationId', 'district_id', 'districtId']) || '').trim()
      : ''
    const locationLabel = typeof item === 'object'
      ? field(item, ['location_name', 'locationName', 'district_name', 'districtName', 'location', 'district'])
      : ''
    const projectType = typeof item === 'object'
      ? field(item, ['project_type', 'projectType', 'project_kind', 'projectKind'], field(project, ['project_type', 'projectType', 'type']))
      : ''
    const normalizedStatus = String(status || '').trim().toLowerCase()
    return {
      date: String(date || ''),
      status: String(status || ''),
      existing: Boolean(normalizedStatus && !['absent', 'missing', 'not marked', 'not_marked'].includes(normalizedStatus)),
      projectId: projectId ? String(projectId) : '',
      projectLabel: String(projectLabel || ''),
      locationId: locationId ? String(locationId) : '',
      locationLabel: String(locationLabel || ''),
      projectType: String(projectType || ''),
    }
  }).filter((item) => item.date)
}

export default function RequestAttendance() {
  const [registrationId, setRegistrationId] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [dates, setDates] = useState([])
  const [projects, setProjects] = useState([])
  const [areaOptions, setAreaOptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selections, setSelections] = useState({})
  const [initialSelections, setInitialSelections] = useState({})
  const [pendingRequestRows, setPendingRequestRows] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', mobile: '', currentSalary: '' })
  const [calendarMonth, setCalendarMonth] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [viewMode, setViewMode] = useState('calendar')
  const [projectSearchTerms, setProjectSearchTerms] = useState({})

  useEffect(() => {
    const hashQuery = window.location.hash.includes('?')
      ? window.location.hash.slice(window.location.hash.indexOf('?') + 1)
      : ''
    const token = new URLSearchParams(window.location.search || hashQuery).get('registration_id')
    if (!token) {
      setError('This attendance request link is missing its registration ID.')
      setLoading(false)
      return
    }

    decryptRegistrationId(token)
      .then((id) => {
        setRegistrationId(id)
        return candidateAPI.getAttendanceRequestForm(id)
      })
      .then((response) => {
        const payload = unwrap(response?.data)
        const normalizedDates = normalizeDateRows(payload)
        const candidateName = String(field(payload.candidate || payload.user || payload.profile, ['name', 'candidate_name', 'full_name'], '')).trim()
        const nameParts = candidateName.split(/\s+/).filter(Boolean)
        setCandidate(payload.candidate || payload.user || payload.profile || payload)
        setContactForm({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' '),
          mobile: field(payload.candidate || payload.user || payload.profile, ['mobile', 'mobile_number'], ''),
          currentSalary: field(payload.candidate || payload.user || payload.profile, ['current_salary', 'currentSalary', 'salary'], ''),
        })
        setDates(normalizedDates)
        setCalendarMonth(getMonthKey(normalizedDates[0]?.date))
        setSelectedDate(normalizedDates[0]?.date || '')
        const initialDateSelections = Object.fromEntries(normalizedDates.map((row) => [row.date, {
          projectId: row.projectId,
          locationId: row.locationId,
        }] ))
        setSelections(initialDateSelections)
        setInitialSelections(initialDateSelections)
        return recruiterAPI.getProjects({ limit: 1000 }).then((projectResponse) => {
          const nextProjects = normalizeOptions(projectResponse?.data ?? projectResponse)
          setProjects(nextProjects)
          setSelections((current) => {
            const merged = { ...current }
            normalizedDates.forEach((row) => {
              const mappedProjectId = matchProjectToOption(row, nextProjects)
              const existing = merged[row.date] || {}
              const projectId = mappedProjectId || existing.projectId || row.projectId || ''
              merged[row.date] = {
                ...existing,
                projectId,
                locationId: STATIC_OPTION_IDS.has(projectId) ? projectId : existing.locationId || row.locationId || '',
              }
            })
            return merged
          })
          setInitialSelections((current) => {
            const merged = { ...current }
            normalizedDates.forEach((row) => {
              const mappedProjectId = matchProjectToOption(row, nextProjects)
              const projectId = mappedProjectId || row.projectId || ''
              merged[row.date] = {
                projectId,
                locationId: STATIC_OPTION_IDS.has(projectId) ? projectId : row.locationId || '',
              }
            })
            return merged
          })
        })
      })
      .catch((requestError) => {
        console.error('Unable to load attendance request form:', requestError)
        setError('This attendance request link is invalid or has expired.')
      })
      .finally(() => setLoading(false))
  }, [])

  const matchProjectToOption = (row, availableProjects = projects) => {
    const rawProjectId = row?.projectId || ''
    const rawProjectLabel = row?.projectLabel || ''
    if (!availableProjects.length) return ''
    const normalizedTargetId = normalizeProjectApiId(rawProjectId)
    const labelTarget = normalizeProjectMatchToken(rawProjectLabel)
    const matched = availableProjects.find((item) => {
      const optionId = normalizeProjectApiId(item.id)
      const optionName = String(item.label || item.name || '').trim()
      const optionLabel = normalizeProjectMatchToken(optionName)
      return (
        (normalizedTargetId && optionId === normalizedTargetId) ||
        (labelTarget && (optionLabel === labelTarget || optionLabel.includes(labelTarget) || labelTarget.includes(optionLabel))) ||
        (rawProjectId && optionId === String(rawProjectId)) ||
        (rawProjectId && optionId === String(rawProjectId).replace(/^proj_/, '').replace(/^project_/, '')) ||
        (rawProjectLabel && optionName.toLowerCase() === String(rawProjectLabel).trim().toLowerCase())
      )
    })
    return matched?.id || rawProjectId || ''
  }

  const selectedProject = (date) => selections[date]?.projectId || ''
  const projectOptions = useMemo(() => [...STATIC_OPTIONS, ...projects], [projects])
  const dateMap = useMemo(() => Object.fromEntries(dates.map((row) => [row.date, row])), [dates])
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth])
  const selectedDateRow = dateMap[selectedDate]
  const changedDates = useMemo(() => new Set(dates
    .filter((row) => {
      const initial = initialSelections[row.date] || {}
      const current = selections[row.date] || {}
      return initial.projectId !== current.projectId || initial.locationId !== current.locationId
    })
    .map((row) => row.date)), [dates, initialSelections, selections])

  const isWrittenProject = (project) => ['written', 'writtenexam', 'written_exam'].includes(
    String(field(project, ['project_type', 'projectType', 'project_kind', 'projectKind', 'type'])).toLowerCase(),
  )

  useEffect(() => {
    const projectIds = [...new Set(dates.map((row) => selections[row.date]?.projectId).filter(Boolean))]
    projectIds.forEach((projectId) => {
      if (STATIC_OPTION_IDS.has(projectId) || Object.prototype.hasOwnProperty.call(areaOptions, projectId)) return
      const project = projects.find((item) => item.id === projectId)
      const dateRow = dates.find((row) => row.projectId === projectId)
      const written = isWrittenProject(project) || String(dateRow?.projectType || '').toLowerCase() === 'written'
      const apiProjectId = normalizeProjectApiId(projectId)
      const loadAreas = written ? recruiterAPI.getProjectDistricts(apiProjectId) : recruiterAPI.getProjectLocations(apiProjectId)
      loadAreas
        .then((response) => setAreaOptions((current) => ({ ...current, [projectId]: normalizeOptions(response?.data ?? response) })))
        .catch(() => setAreaOptions((current) => ({ ...current, [projectId]: [] })))
    })
  }, [areaOptions, dates, projects, selections])

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

  const updateContactField = (key) => (event) => {
    setContactForm((current) => ({ ...current, [key]: event.target.value }))
  }

  const getLocationsForProject = (projectId, dateRow) => {
    const options = [...STATIC_OPTIONS, ...(areaOptions[projectId] || [])]
    if (dateRow?.locationId && !options.some((item) => item.id === dateRow.locationId)) {
      options.push({ id: dateRow.locationId, label: dateRow.locationLabel || dateRow.locationId })
    }
    return options
  }

  const renderDateEditor = (dateRow) => {
    const selection = selections[dateRow.date] || {}
    const isFixedLocation = STATIC_OPTION_IDS.has(selection.projectId)
    const options = isFixedLocation
      ? STATIC_OPTIONS.filter((option) => option.id === selection.projectId)
      : getLocationsForProject(selectedProject(dateRow.date), dateRow)
    const hasMatchingProject = projectOptions.some((project) => String(project.id) === String(selection.projectId))
    const hasMatchingLocation = options.some((location) => String(location.id) === String(selection.locationId))
    return (
      <div className="request-date-row" style={{ display: 'grid', gap: 14, alignItems: 'end', padding: '16px 12px', border: '1px solid #d7e8dc', borderRadius: 8, background: '#f8fcf9' }}>
        <div><div className="filter-label">{viewMode === 'calendar' ? 'Selected date' : 'Attendance date'}</div><strong style={{ color: '#2f302d' }}>{formatAttendanceDate(dateRow.date)}</strong><div style={{ color: '#667085', fontSize: 12, marginTop: 5 }}>Current status: {dateRow.status || 'Not marked'}</div></div>
        <div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="filter-label">Project <span style={{ color: 'var(--red)' }}>*</span></span>
            {dateRow.projectLabel && !hasMatchingProject && <span style={{ color: '#667085', fontSize: 12 }}>Recorded project: <strong style={{ color: '#2f302d' }}>{dateRow.projectLabel}</strong></span>}
            <SearchableProjectSelect
              options={projectOptions.map((item) => ({ ...item, name: item.label || item.name || '' }))}
              value={selection.projectId || ''}
              onChange={(nextValue) => {
                setProjectSearchTerms((current) => ({ ...current, [dateRow.date]: '' }))
                updateSelection(dateRow.date, 'projectId', nextValue)
              }}
              placeholder="Search project"
            />
          </label>
        </div>
        <label style={{ display: 'grid', gap: 6 }}><span className="filter-label">Location / District <span style={{ color: 'var(--red)' }}>*</span></span>{dateRow.locationLabel && !hasMatchingLocation && <span style={{ color: '#667085', fontSize: 12 }}>Recorded location/district: <strong style={{ color: '#2f302d' }}>{dateRow.locationLabel}</strong></span>}<SearchableProjectSelect options={options.map((item) => ({ ...item, name: item.label || item.name || '' }))} value={selection.locationId || ''} onChange={(nextValue) => updateSelection(dateRow.date, 'locationId', nextValue)} placeholder={isFixedLocation ? selection.projectId : selection.projectId ? 'Choose an area' : 'Choose project first'} disabled={!selection.projectId || isFixedLocation} /></label>
      </div>
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const changedDateKeys = new Set(
      dates
        .filter((row) => {
          const initial = initialSelections[row.date] || {}
          const current = selections[row.date] || {}
          return initial.projectId !== current.projectId || initial.locationId !== current.locationId
        })
        .map((row) => row.date),
    )

    const requestedRows = dates
      .filter((row) => changedDateKeys.has(row.date))
      .filter((row) => selections[row.date]?.projectId && selections[row.date]?.locationId)
      .map((row) => {
        const selection = selections[row.date]
        const project = projectOptions.find((item) => item.id === selection.projectId)
        const location = getLocationsForProject(selection.projectId, row).find((item) => item.id === selection.locationId)
        const isDistrict = isWrittenProject(project) || String(row.projectType || '').toLowerCase() === 'written' || Boolean(location?.district_id || location?.districtId)
        return {
          date: row.date,
          project_id: normalizeProjectApiId(selection.projectId),
          project: labelOf(project),
          project_type: isDistrict ? 'written' : 'regular',
          ...(isDistrict
            ? { district_id: selection.locationId, district: labelOf(location) }
            : { location_id: selection.locationId, location: labelOf(location) }),
        }
      })

    if (requestedRows.length === 0) {
      setError('Change at least one date before submitting an attendance request.')
      return
    }

    setPendingRequestRows(requestedRows)
    setConfirmOpen(true)
  }

  const confirmSubmission = async () => {
    setSubmitting(true)
    setConfirmOpen(false)
    setError('')
    setMessage('')
    try {
      await candidateAPI.submitAttendanceRequest({
        registration_id: registrationId,
        first_name: contactForm.firstName.trim(),
        last_name: contactForm.lastName.trim(),
        mobile: contactForm.mobile.trim(),
        current_salary: contactForm.currentSalary,
        requests: pendingRequestRows,
      })
      setMessage('Attendance request submitted successfully.')
      setInitialSelections(selections)
    } catch (submitError) {
      console.error('Unable to submit attendance request:', submitError)
      setError('Unable to submit the attendance request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <main style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>Loading attendance request form...</main>

  return (
    <main className="request-attendance-page" style={{ minHeight: '100vh', background: '#f4f7fb', padding: '28px 16px 48px' }}>
      <style>{`
        .request-attendance-page *, .request-attendance-page *::before, .request-attendance-page *::after { box-sizing: border-box; }
        .request-attendance-page .request-date-row { grid-template-columns: minmax(150px, .7fr) repeat(2, minmax(0, 1fr)); }
        .request-attendance-page .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
        .request-attendance-page .calendar-day { min-height: 82px; border: 1px solid #e2ddd5; border-radius: 8px; padding: 8px; background: #fffdf9; color: #2f302d; text-align: left; }
        .request-attendance-page .calendar-day:hover { border-color: var(--green); }
        .request-attendance-page .calendar-day.selected { outline: 2px solid var(--green); outline-offset: 1px; }
        .request-attendance-page .calendar-change-dot { display: inline-block; width: 7px; height: 7px; margin-left: 5px; border-radius: 50%; background: var(--teal); vertical-align: middle; }
        .request-attendance-page .edit-all-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; margin-bottom: 10px; border: 1px solid #dfe8e2; border-radius: 8px; background: #f8fcf9; }
        .request-attendance-page .edit-all-row { padding: 4px; border-bottom: 1px solid #edf1ee; }
        .request-attendance-page .calendar-day.present { background: #e7f4e9; border-color: #a8d6b0; }
        .request-attendance-page .calendar-day.absent { background: #fff0ed; border-color: #e6aaa0; }
        .request-attendance-page .calendar-day.pending { background: #fffdf9; }
        .request-attendance-page .calendar-day.empty { visibility: hidden; }
        .request-attendance-page .calendar-status { display: block; margin-top: 8px; font-size: 11px; font-weight: 700; }
        .request-attendance-page .request-input { width: 100%; min-width: 0; }
        @media (max-width: 700px) {
          .request-attendance-page { padding: 12px 8px 28px !important; }
          .request-attendance-page .request-header { padding: 18px !important; }
          .request-attendance-page .request-header h1 { font-size: 22px !important; }
          .request-attendance-page .request-date-row { grid-template-columns: 1fr; gap: 10px !important; padding: 14px 4px !important; }
          .request-attendance-page .calendar-day { min-height: 58px; padding: 6px; }
          .request-attendance-page .calendar-status { margin-top: 4px; font-size: 9px; }
          .request-attendance-page .request-form-body { padding: 8px !important; }
          .request-attendance-page .request-form-footer { padding: 14px !important; }
          .request-attendance-page .request-form-footer button { width: 100%; }
        }
        @media (max-width: 560px) {
          .request-attendance-page .consultant-details-grid { grid-template-columns: 1fr !important; }
          .request-attendance-page .request-header { padding: 16px 14px !important; }
          .request-attendance-page .request-header h1 { font-size: 20px !important; }
          .request-attendance-page .request-header p { font-size: 12px !important; }
          .request-attendance-page .calendar-grid { gap: 4px; }
          .request-attendance-page .calendar-day { min-height: 54px; padding: 5px; }
          .request-attendance-page .calendar-day strong { font-size: 12px; }
          .request-attendance-page .calendar-status { font-size: 8px; margin-top: 3px; line-height: 1.2; }
          .request-attendance-page .edit-all-toolbar { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <header className="request-header" style={{ background: 'var(--teal)', color: '#fffdf9', borderRadius: 10, padding: '24px 26px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .75 }}>Attendance correction form</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26 }}>Request Attendance</h1>
          <p style={{ margin: '8px 0 0', opacity: .9, fontSize: 14 }}>Review the calendar, then choose the project and area for a date.</p>
        </header>

        {candidate && <section style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: 10, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#667085', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Consultant details</div>
          <div className="consultant-details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <div className="filter-label" style={{ marginBottom: 4 }}>Candidate name</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2f302d' }}>{[contactForm.firstName, contactForm.lastName].filter(Boolean).join(' ') || '—'}</div>
            </div>
            <div>
              <div className="filter-label" style={{ marginBottom: 4 }}>Mobile number</div>
              <div style={{ fontSize: 15, color: '#2f302d' }}>{contactForm.mobile || '—'}</div>
            </div>
          </div>
          <div style={{ color: '#667085', fontSize: 12, marginTop: 12 }}>Registration ID: {field(candidate, ['registration_id', 'registrationId', 'candidate_id'], '—')}</div>
        </section>}

      {error && <div role="alert" style={{ color: 'var(--red)', marginBottom: 16 }}>{error}</div>}
      {message && <div role="status" style={{ color: 'var(--green)', marginBottom: 16 }}>{message}</div>}

      <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #dbe3ef', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><h2 style={{ margin: 0, fontSize: 18, color: '#2f302d' }}>{formatMonthLabel(calendarMonth)} Attendance</h2><div style={{ marginTop: 4, color: '#667085', fontSize: 13 }}>Green is present, red is absent. Select any date to review or change it.</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#667085', fontSize: 12 }}>{dates.length} dates</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewMode((current) => current === 'calendar' ? 'list' : 'calendar')}>
              {viewMode === 'calendar' ? 'Edit all dates' : 'Calendar view'}
            </button>
          </div>
        </div>
        {dates.length === 0 ? <div style={{ padding: 20 }}>No attendance dates are available for this candidate.</div> : <div className="request-form-body" style={{ padding: 12 }}>
          {viewMode === 'calendar' ? <>
            <div className="calendar-grid" style={{ marginBottom: 18 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} style={{ color: '#667085', fontSize: 11, fontWeight: 700, padding: '4px 8px' }}>{day}</div>)}
              {calendarDays.map((date, index) => {
                const row = date ? dateMap[date] : null
                const kind = row ? getStatusKind(row.status) : 'empty'
                const changed = date && changedDates.has(date)
                return <button key={date || `empty-${index}`} type="button" className={`calendar-day ${kind} ${date === selectedDate ? 'selected' : ''} ${changed ? 'changed' : ''}`} onClick={() => date && setSelectedDate(date)} disabled={!date}>
                  {date && <><strong>{Number(date.slice(-2))}{changed && <span className="calendar-change-dot" title="Edited" />}</strong><span className="calendar-status">{row ? (row.status || 'Not marked') : ''}</span></>}
                </button>
              })}
            </div>
            {selectedDateRow && renderDateEditor(selectedDateRow)}
          </> : <>
            <div className="edit-all-toolbar">
              <div><strong style={{ color: '#2f302d' }}>Edit all attendance dates</strong><div style={{ color: '#667085', fontSize: 12, marginTop: 3 }}>Update each date below, then submit them together.</div></div>
              <span style={{ color: changedDates.size ? 'var(--teal)' : '#667085', fontSize: 12, fontWeight: 700 }}>{changedDates.size} changed</span>
            </div>
            <div style={{ display: 'grid', gap: 2 }}>{dates.map((row) => <div className="edit-all-row" key={row.date}>{renderDateEditor(row)}</div>)}</div>
          </>}
        </div>}
        {dates.length > 0 && <div className="request-form-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #dbe3ef' }}><button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Attendance Request'}</button></div>}
      </form>
      {confirmOpen && <div role="dialog" aria-modal="true" aria-labelledby="attendance-confirm-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(25, 35, 30, .48)' }}>
        <div style={{ width: 'min(440px, 100%)', background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
          <h2 id="attendance-confirm-title" style={{ margin: 0, color: '#2f302d', fontSize: 20 }}>Submit attendance request?</h2>
          <p style={{ margin: '10px 0 18px', color: '#667085', lineHeight: 1.5 }}>This will submit {pendingRequestRows.length} date{pendingRequestRows.length === 1 ? '' : 's'} together for approval. Changed dates are marked in the calendar.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={confirmSubmission} disabled={submitting}>{submitting ? 'Submitting...' : 'Confirm and submit'}</button>
          </div>
        </div>
      </div>}
      </div>
    </main>
  )
}