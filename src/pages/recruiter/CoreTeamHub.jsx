import { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faCalendarAlt, faEye, faFileInvoiceDollar, faFolderOpen, faRotate } from '@fortawesome/free-solid-svg-icons'
import { coreRecruiterAPI, recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import { useAuth } from '../../context/AuthContext'
import CoreTeamPaymentSheet, { loadCoreTeamPaymentPeriod } from './CoreTeamPaymentSheet'
import CoreTeamSavedAttendanceSheet from './CoreTeamSavedAttendanceSheet'
import './CoreTeamHub.css'

const PAGE_SIZE = 10

const getList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload?.data && !Array.isArray(payload.data)) {
    const nested = getList(payload.data)
    if (nested.length) return nested
  }
  for (const key of ['draft_payment_sheets', 'draftPaymentSheets', 'payment_sheets', 'paymentSheets', 'sheets', 'items', 'records', 'results']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

const getSheetId = (sheet) => sheet?.id || sheet?.sheet_id || sheet?.sheetId || sheet?.payment_sheet_id || sheet?.paymentSheetId
const getSheetName = (sheet, index) => sheet?.sheet_name || sheet?.sheetName || sheet?.name || sheet?.title || `Draft ${index + 1}`
const getSheetRows = (sheet) => {
  let rows = sheet?.payment_sheet ?? sheet?.paymentSheet ?? sheet?.sheet_data ?? sheet?.sheetData ?? sheet?.rows ?? sheet?.data
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows) } catch { return [] }
  }
  if (Array.isArray(rows)) return rows
  return Array.isArray(rows?.rows) ? rows.rows : []
}
const getColumns = (rows) => rows.some(Array.isArray)
  ? Array.from({ length: Math.max(...rows.map((row) => Array.isArray(row) ? row.length : 0)) }, (_, index) => `Column ${index + 1}`)
  : [...new Set(rows.flatMap((row) => row && typeof row === 'object' ? Object.keys(row) : []))]
const getValue = (row, column, index) => Array.isArray(row) ? row[index] : row?.[column]

function normalizeProjects(payload) {
  return getList(payload).map((project) => {
    const id = String(project?.id ?? project?.project_id ?? project?.projectId ?? project?.value ?? project?._id ?? '')
    if (!id) return null
    return {
      id,
      name: String(project?.name ?? project?.project_name ?? project?.projectName ?? project?.title ?? project?.label ?? id),
      projectType: String(project?.projectType ?? project?.project_type ?? project?.projectKind ?? project?.project_kind ?? project?.type ?? ''),
    }
  }).filter(Boolean)
}

function CoreTeamDrafts({ active }) {
  const { user } = useAuth()
  const [sheets, setSheets] = useState([])
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadDrafts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await coreRecruiterAPI.getCoreTeamDraftPaymentSheets({
        user_id: user?.userId || 1,
        offset,
        limit: PAGE_SIZE,
      })
      const body = response?.data ?? {}
      const payload = body?.data ?? body
      const rows = getList(payload)
      const pagination = body?.pagination || payload?.pagination || {}
      const count = Number(pagination.total ?? pagination.total_records ?? pagination.total_count ?? payload?.total ?? body?.total)
      setSheets(rows)
      setTotal(Number.isFinite(count) ? count : null)
    } catch (loadError) {
      console.error('Failed to load core-team payment drafts:', loadError)
      setError('Draft payment sheets could not be loaded.')
      setSheets([])
    } finally {
      setLoading(false)
    }
  }, [offset, user?.userId])

  useEffect(() => {
    if (active) loadDrafts()
  }, [active, loadDrafts])

  const openDraft = async (sheet) => {
    setSelectedSheet(sheet)
    setDetailsLoading(true)
    setMessage('')
    const id = getSheetId(sheet)
    if (!id) {
      setDetailsLoading(false)
      return
    }
    try {
      const response = await coreRecruiterAPI.getCoreTeamDraftPaymentSheetDetails(id, { user_id: user?.userId || 1 })
      const body = response?.data ?? {}
      const payload = body?.data ?? body
      const detail = payload?.sheet || payload?.draft_payment_sheet || payload?.draftPaymentSheet || payload
      setSelectedSheet(Array.isArray(detail) ? { ...sheet, payment_sheet: detail } : { ...sheet, ...detail })
    } catch (loadError) {
      console.error('Failed to load core-team draft details:', loadError)
      setMessage('Draft details could not be loaded. Showing the saved preview if available.')
    } finally {
      setDetailsLoading(false)
    }
  }

  const moveDraft = async () => {
    const id = getSheetId(selectedSheet)
    if (!id || actionLoading) return
    setActionLoading(true)
    setMessage('')
    try {
      await coreRecruiterAPI.moveCoreTeamDraftPaymentSheetToMain({
        draft_payment_sheet_id: id,
        user_id: user?.userId || 1,
      })
      setSelectedSheet(null)
      await loadDrafts()
      setMessage('Draft moved to the main payment sheet.')
    } catch (actionError) {
      console.error('Failed to move core-team draft:', actionError)
      setMessage(actionError?.response?.data?.message || 'Draft could not be moved to the main payment sheet.')
    } finally {
      setActionLoading(false)
    }
  }

  const rows = selectedSheet ? getSheetRows(selectedSheet) : []
  const columns = getColumns(rows)
  const pageHasMore = total === null ? sheets.length >= PAGE_SIZE : offset + sheets.length < total

  return <section className="core-hub-panel" aria-label="Core team payment drafts">
    <header className="core-hub-section-heading">
      <div><span className="core-hub-eyebrow">PAYMENT WORKFLOW</span><h2>Draft payment sheets</h2><p>Review saved drafts or move a completed draft to the main payment sheet.</p></div>
      <button type="button" className="btn btn-outline btn-sm" onClick={loadDrafts} disabled={loading}><FontAwesomeIcon icon={faRotate} /> Refresh</button>
    </header>
    {error && <div className="attendance-message error" role="alert">{error}</div>}
    {message && !selectedSheet && <div className="attendance-message success" role="status">{message}</div>}
    {loading ? <div className="core-hub-empty" role="status">Loading drafts...</div> : sheets.length ? <>
      <div className="core-hub-draft-list">
        {sheets.map((sheet, index) => {
          const sheetId = getSheetId(sheet)
          const amount = sheet?.amount ?? sheet?.total_amount ?? sheet?.totalAmount
          const created = sheet?.created_at || sheet?.createdAt || sheet?.updated_at || sheet?.updatedAt
          return <article className="core-hub-draft-row" key={sheetId || `${getSheetName(sheet, index)}-${index}`}>
            <div className="core-hub-draft-icon" aria-hidden="true"><FontAwesomeIcon icon={faFileInvoiceDollar} /></div>
            <div className="core-hub-draft-copy"><strong>{getSheetName(sheet, offset + index)}</strong><span>Sheet ID: {sheetId || 'Unavailable'}{created ? ` · ${new Date(created).toLocaleDateString('en-IN')}` : ''}</span></div>
            <div className="core-hub-draft-amount">{amount !== undefined && amount !== null && amount !== '' && Number.isFinite(Number(amount)) ? `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Amount unavailable'}</div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openDraft(sheet)}><FontAwesomeIcon icon={faEye} /> View</button>
          </article>
        })}
      </div>
      <footer className="core-hub-pagination"><span>{total === null ? `Showing ${offset + 1}-${offset + sheets.length}` : `Showing ${sheets.length ? offset + 1 : 0}-${offset + sheets.length} of ${total}`}</span><div><button type="button" className="btn btn-outline btn-sm" onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))} disabled={offset === 0 || loading}>Previous</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setOffset((current) => current + PAGE_SIZE)} disabled={!pageHasMore || loading}>Next</button></div></footer>
    </> : <div className="core-hub-empty"><FontAwesomeIcon icon={faFolderOpen} /><span>No core-team payment drafts found.</span></div>}

    <Modal
      isOpen={Boolean(selectedSheet)}
      onClose={() => setSelectedSheet(null)}
      title={selectedSheet ? (selectedSheet.sheet_name || selectedSheet.sheetName || selectedSheet.name || 'Draft payment sheet') : 'Draft payment sheet'}
      fullScreen
      footer={selectedSheet && <div className="core-hub-modal-footer"><button type="button" className="btn btn-outline" onClick={() => setSelectedSheet(null)}>Close</button><button type="button" className="btn btn-primary" onClick={moveDraft} disabled={detailsLoading || actionLoading || !getSheetId(selectedSheet) || !rows.length}><FontAwesomeIcon icon={faArrowRight} /> {actionLoading ? 'Moving...' : 'Move to main sheet'}</button></div>}
    >
      {selectedSheet && <div className="core-hub-draft-preview">
        <div className="core-hub-draft-preview-meta"><strong>{rows.length} rows</strong><span>Sheet ID: {getSheetId(selectedSheet) || 'Unavailable'}</span></div>
        {message && <div className="attendance-message error" role="status">{message}</div>}
        {detailsLoading ? <div className="core-hub-empty" role="status">Loading draft details...</div> : rows.length && columns.length ? <div className="core-hub-table-wrap"><table className="core-hub-table"><thead><tr><th>#</th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}><td>{rowIndex + 1}</td>{columns.map((column, columnIndex) => {
          const value = getValue(row, column, columnIndex)
          return <td key={`${rowIndex}-${columnIndex}`}>{value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
        })}</tr>)}</tbody></table></div> : <div className="core-hub-empty">This draft does not contain tabular sheet rows.</div>}
      </div>}
    </Modal>
  </section>
}

export default function CoreTeamHub() {
  const [activeTab, setActiveTab] = useState('attendance')
  const [projectOptions, setProjectOptions] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [attendanceProjectId, setAttendanceProjectId] = useState('')
  const [attendanceFromDate, setAttendanceFromDate] = useState('')
  const [attendanceToDate, setAttendanceToDate] = useState('')
  const [savedProjectId, setSavedProjectId] = useState('')
  const [savedFromDate, setSavedFromDate] = useState('')
  const [savedToDate, setSavedToDate] = useState('')
  const [savedSheetFooter, setSavedSheetFooter] = useState(null)
  const [periodData, setPeriodData] = useState(null)
  const [loadingPeriod, setLoadingPeriod] = useState(false)
  const [periodError, setPeriodError] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState(new Set())
  const [paymentSheetData, setPaymentSheetData] = useState(null)

  useEffect(() => {
    let cancelled = false
    setProjectsLoading(true)
    recruiterAPI.getProjectSuggestions('', 1000)
      .then((response) => {
        const payload = response?.data?.data ?? response?.data ?? response
        if (!cancelled) setProjectOptions(normalizeProjects(payload))
      })
      .catch((loadError) => {
        console.error('Failed to load projects for core-team hub:', loadError)
        if (!cancelled) setProjectOptions([])
      })
      .finally(() => { if (!cancelled) setProjectsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const selectedAttendanceProject = projectOptions.find((project) => project.id === attendanceProjectId)
  const attendanceProjectType = /written|exam/i.test(selectedAttendanceProject?.projectType || selectedAttendanceProject?.name || '') ? 'written_exam' : 'regular'
  const selectedSavedProject = projectOptions.find((project) => project.id === savedProjectId)
  const handleSavedSheetFooterChange = useCallback((footer) => setSavedSheetFooter(footer), [])
  const filteredCandidates = useMemo(() => (periodData?.candidates || []).filter((candidate) => (
    `${candidate.name} ${candidate.id} ${candidate.mobile}`.toLowerCase().includes(candidateSearch.trim().toLowerCase())
  )), [candidateSearch, periodData])

  const resetPeriod = () => {
    setPeriodData(null)
    setSelectedCandidateKeys(new Set())
    setCandidateSearch('')
    setPeriodError('')
  }

  const loadCandidatesForPeriod = async () => {
    if (!attendanceProjectId || !attendanceFromDate || !attendanceToDate || attendanceFromDate > attendanceToDate) return
    setLoadingPeriod(true)
    setPeriodError('')
    try {
      const result = await loadCoreTeamPaymentPeriod(
        attendanceProjectId,
        attendanceFromDate,
        attendanceToDate,
        attendanceProjectType,
        selectedAttendanceProject?.name || attendanceProjectId,
      )
      setPeriodData(result)
      setSelectedCandidateKeys(new Set(result.candidates.map((candidate) => candidate.key)))
    } catch (loadError) {
      console.error('Failed to load candidates for core-team hub:', loadError)
      setPeriodData(null)
      setPeriodError('Unable to load attendance for this project and date range.')
    } finally {
      setLoadingPeriod(false)
    }
  }

  const configureSelectedCandidates = () => {
    const candidates = (periodData?.candidates || []).filter((candidate) => selectedCandidateKeys.has(candidate.key))
    if (!candidates.length) {
      setPeriodError('Select at least one candidate to continue.')
      return
    }
    setPaymentSheetData({ ...periodData, candidates })
    setPeriodError('')
  }

  return <div className="core-team-hub">
    <header className="core-hub-hero">
      <div><span className="core-hub-eyebrow">RECRUITER OPERATIONS</span><h1>Core Team Hub</h1><p>Build attendance earnings, review saved sheets, and move payment drafts forward.</p></div>
      <div className="core-hub-hero-mark" aria-hidden="true"><FontAwesomeIcon icon={faFileInvoiceDollar} /></div>
    </header>

    <nav className="core-hub-tabs" role="tablist" aria-label="Core team workflows">
      <button type="button" role="tab" aria-selected={activeTab === 'attendance'} className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setActiveTab('attendance')}><FontAwesomeIcon icon={faCalendarAlt} /><span>Attendance & earnings</span></button>
      <button type="button" role="tab" aria-selected={activeTab === 'saved'} className={activeTab === 'saved' ? 'active' : ''} onClick={() => setActiveTab('saved')}><FontAwesomeIcon icon={faEye} /><span>Saved sheets</span></button>
      <button type="button" role="tab" aria-selected={activeTab === 'drafts'} className={activeTab === 'drafts' ? 'active' : ''} onClick={() => setActiveTab('drafts')}><FontAwesomeIcon icon={faFolderOpen} /><span>Payment drafts</span></button>
    </nav>

    {activeTab === 'attendance' && <section className="core-hub-panel" role="tabpanel">
      <div className="core-hub-section-heading"><div><span className="core-hub-eyebrow">01 / ATTENDANCE</span><h2>Configure an attendance sheet</h2><p>Choose the project and period, configure earnings, then save the attendance data or export the sheet.</p></div></div>
      <div className="core-hub-form-grid">
        <label><span>Project</span><SearchableProjectSelect options={projectOptions} value={attendanceProjectId} onChange={(value) => { setAttendanceProjectId(value); resetPeriod() }} placeholder={projectsLoading ? 'Loading projects...' : 'Search projects'} disabled={projectsLoading || loadingPeriod} /></label>
        <label><span>From date</span><input className="form-control" type="date" value={attendanceFromDate} onChange={(event) => { setAttendanceFromDate(event.target.value); resetPeriod() }} disabled={loadingPeriod} /></label>
        <label><span>To date</span><input className="form-control" type="date" value={attendanceToDate} onChange={(event) => { setAttendanceToDate(event.target.value); resetPeriod() }} disabled={loadingPeriod} /></label>
      </div>
      {!periodData && <div className="core-hub-action-row"><span>{selectedAttendanceProject ? `${selectedAttendanceProject.name}${attendanceFromDate && attendanceToDate ? ` · ${attendanceFromDate} to ${attendanceToDate}` : ''}` : 'Select a project and date range to continue.'}</span><button type="button" className="btn btn-primary" onClick={loadCandidatesForPeriod} disabled={loadingPeriod || !attendanceProjectId || !attendanceFromDate || !attendanceToDate || attendanceFromDate > attendanceToDate}><FontAwesomeIcon icon={faRotate} /> {loadingPeriod ? 'Loading candidates...' : 'Load candidates'}</button></div>}
      {periodError && <div className="attendance-message error" role="alert">{periodError}</div>}
      {periodData && <fieldset className="core-hub-candidate-picker">
        <legend>Candidates · {selectedCandidateKeys.size} of {periodData.candidates.length} selected</legend>
        <div className="core-hub-candidate-toolbar"><input className="form-control" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search name, ID, or mobile" aria-label="Search candidates" /><button type="button" onClick={() => setSelectedCandidateKeys(new Set(periodData.candidates.map((candidate) => candidate.key)))}>Select all</button><button type="button" onClick={() => setSelectedCandidateKeys(new Set())}>Clear</button></div>
        <div className="core-hub-candidate-list">{filteredCandidates.map((candidate) => <label key={candidate.key}><input type="checkbox" checked={selectedCandidateKeys.has(candidate.key)} onChange={(event) => setSelectedCandidateKeys((current) => {
          const next = new Set(current)
          if (event.target.checked) next.add(candidate.key)
          else next.delete(candidate.key)
          return next
        })} /><span><strong>{candidate.name}</strong><small>{[candidate.id, candidate.mobile].filter(Boolean).join(' · ')}</small></span></label>)}{filteredCandidates.length === 0 && <p>{periodData.candidates.length ? 'No candidates match that search.' : 'No candidates found for this project and date range.'}</p>}</div>
      </fieldset>}
      <div className="core-hub-workflow-note"><strong>Next</strong><span>Set base pay, allowances, and overtime. Save attendance earnings to make them available under Saved sheets, where payment sheets can be generated, reviewed, and saved as drafts or confirmed for payment.</span></div>
      {periodData && <div className="core-hub-action-row core-hub-configure-action"><span>{selectedCandidateKeys.size} candidate{selectedCandidateKeys.size === 1 ? '' : 's'} selected</span><button type="button" className="btn btn-primary" onClick={configureSelectedCandidates} disabled={!selectedCandidateKeys.size}><FontAwesomeIcon icon={faArrowRight} /> Configure {selectedCandidateKeys.size} selected</button></div>}
    </section>}

    {activeTab === 'saved' && <section className="core-hub-panel" role="tabpanel">
      <div className="core-hub-section-heading"><div><span className="core-hub-eyebrow">02 / PAYMENT SHEETS</span><h2>Saved attendance earnings</h2><p>Filter saved attendance earnings, create a payment sheet, and save it as a draft or confirm it for payment.</p></div></div>
      <div className="core-hub-form-grid core-hub-saved-filters">
        <label><span>Project</span><SearchableProjectSelect options={projectOptions} value={savedProjectId} onChange={setSavedProjectId} placeholder={projectsLoading ? 'Loading projects...' : 'Search projects'} disabled={projectsLoading} /></label>
        <label><span>From date</span><input className="form-control" type="date" value={savedFromDate} onChange={(event) => setSavedFromDate(event.target.value)} /></label>
        <label><span>To date</span><input className="form-control" type="date" value={savedToDate} onChange={(event) => setSavedToDate(event.target.value)} /></label>
      </div>
      {savedProjectId && <>
        <CoreTeamSavedAttendanceSheet
          key={`${savedProjectId}-${savedFromDate}-${savedToDate}`}
          isOpen
          project={selectedSavedProject || { id: savedProjectId, name: savedProjectId }}
          embedded
          initialFromDate={savedFromDate}
          initialToDate={savedToDate}
          onFooterChange={handleSavedSheetFooterChange}
        />
        {savedSheetFooter && <div className="core-hub-saved-footer">{savedSheetFooter}</div>}
      </>}
      {!savedProjectId && <div className="core-hub-empty">Choose a project to view its saved attendance earnings.</div>}
    </section>}

    {activeTab === 'drafts' && <CoreTeamDrafts active />}

    {paymentSheetData && <CoreTeamPaymentSheet key={`${paymentSheetData.projectId}-${paymentSheetData.fromDate}-${paymentSheetData.toDate}`} isOpen projectId={paymentSheetData.projectId} projectTitle={paymentSheetData.projectTitle} projectType={paymentSheetData.projectType} initialPeriodData={paymentSheetData} onClose={() => setPaymentSheetData(null)} />}
  </div>
}