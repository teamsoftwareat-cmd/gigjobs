import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faSpinner, faCheckCircle, faSearch } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { PageHeader, Card } from '../../components/ui/index'
import * as XLSX from 'xlsx'

export default function Campaigns() {
  const [projects, setProjects] = useState([])
  const [projLoading, setProjLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')
  const [portal, setPortal] = useState('sms')
  const [messageType, setMessageType] = useState('registration')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [history, setHistory] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [historySearch, setHistorySearch] = useState('')
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [historyProjectFilter, setHistoryProjectFilter] = useState('')
  const [historyPortalFilter, setHistoryPortalFilter] = useState('')
  const [historyMessageTypeFilter, setHistoryMessageTypeFilter] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setProjLoading(true)
      try {
        const resp = await recruiterAPI.getProjects({ limit: 200 })
        const data = resp.data?.data || resp.data || []
        if (!mounted) return
        setProjects(Array.isArray(data) ? data : (data.items || []))
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setProjLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const normalizeCampaignRow = (row) => ({
    id: row.id || row._id || row.campaign_id || String(Math.random()),
    project: row.project_name || row.project || row.projectTitle || row.projectName || row.name || '',
    portal: row.portal || row.channel || '',
    messageType: row.message_type || row.messageType || row.type || '',
    status: row.status || row.state || 'Sent',
    candidateName: row.candidate_name || '',
    candidateMobileNumber: row.candidate_mobile_number || row.mobile_number || '',
    datetime: row.datetime || row.sent_at || row.created_at || row.updated_at || new Date().toISOString(),
  })

  const parseCampaignHistory = (payload) => {
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : []
    return rows.map(normalizeCampaignRow)
  }

  const getHistoryPayload = (response) => {
    const payload = response?.data ?? response
    if (!payload) return { items: [], total: 0 }

    if (Array.isArray(payload)) {
      return { items: payload, total: payload.length }
    }

    if (Array.isArray(payload.items)) {
      return { items: payload.items, total: typeof payload.total === 'number' ? payload.total : payload.items.length }
    }

    if (Array.isArray(payload.data)) {
      return { items: payload.data, total: typeof payload.total === 'number' ? payload.total : payload.data.length }
    }

    if (payload?.data && Array.isArray(payload.data.items)) {
      return { items: payload.data.items, total: typeof payload.data.total === 'number' ? payload.data.total : payload.data.items.length }
    }

    return { items: [], total: 0 }
  }

  const fetchCampaignHistory = async () => {
    setHistoryLoading(true)
    try {
      const resp = await recruiterAPI.getCampaignHistory({
        offset: (historyPage - 1) * historyPageSize,
        limit: historyPageSize,
        search: historySearchQuery || undefined,
        project_id: historyProjectFilter || undefined,
        portal: historyPortalFilter || undefined,
        message_type: historyMessageTypeFilter || undefined,
      })
      const { items, total } = getHistoryPayload(resp.data?.data || resp.data || resp)
      setHistory(parseCampaignHistory(items))
      setHistoryTotal(total)
    } catch (err) {
      console.warn('Failed to load campaign history', err)
      setHistory([])
      setHistoryTotal(0)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaignHistory()
  }, [historyPage, historyPageSize, historySearchQuery, historyProjectFilter, historyPortalFilter, historyMessageTypeFilter])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    setFile(f)
    parseFileForPreview(f)
  }

  const downloadSampleFile = () => {
    try {
      const sampleData = [
        { 'S.no': 1, candidate_name: 'John Doe', candidate_mobile_number: '9876543210' },
        { 'S.no': 2, candidate_name: 'Jane Smith', candidate_mobile_number: '9876543211' },
        { 'S.no': 3, candidate_name: 'Robert Johnson', candidate_mobile_number: '9876543212' },
      ]
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(sampleData))
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'campaign_candidates_template.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to generate sample file', err)
      setError('Failed to generate sample file')
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setHistorySearchQuery(historySearch.trim()), 350)
    return () => clearTimeout(timer)
  }, [historySearch])

  const handleHistorySearch = (value) => {
    setHistorySearch(value)
    setHistoryPage(1)
  }

  const handleHistoryFilterChange = (setter) => (value) => {
    setter(value)
    setHistoryPage(1)
  }

  const historyPageCount = Math.max(1, Math.ceil(historyTotal / historyPageSize))
  const historyPageNumbers = []
  const historyPageStart = Math.max(1, Math.min(historyPage - 2, Math.max(1, historyPageCount - 4)))
  const historyPageEnd = Math.min(historyPageCount, historyPageStart + 4)
  for (let i = historyPageStart; i <= historyPageEnd; i += 1) {
    historyPageNumbers.push(i)
  }

  const parseFileForPreview = async (f) => {
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      const rows = json.map((r, idx) => ({
        s_no: r['S.no'] || r.s_no || idx + 1,
        candidate_name: r.candidate_name || r.name || '',
        candidate_mobile_number: r.candidate_mobile_number || r.mobile || '',
      }))
      setPreview(rows.slice(0, 200))
    } catch (err) {
      setError('Failed to parse file. Upload a valid Excel/CSV file.')
      setPreview([])
    }
  }

  const formatToIST = (value) => {
    const d = value instanceof Date ? value : new Date(value)
    // convert input to IST (+05:30) and return plain date-time (no timezone suffix)
    const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000)
    const istMs = utcMs + (5.5 * 60 * 60000)
    const ist = new Date(istMs)
    const pad = (n) => String(n).padStart(2, '0')
    return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}T${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())}`
  }

  const validateScheduledAt = (value) => {
    if (!value) return { valid: true }

    const selectedDate = new Date(value)
    if (Number.isNaN(selectedDate.getTime())) {
      return { valid: false, message: 'Choose a valid date and time.' }
    }

    const hours = selectedDate.getHours()
    const minutes = selectedDate.getMinutes()
    const selectedMinutes = (hours * 60) + minutes
    const minMinutes = (9 * 60) + 30
    const maxMinutes = 22 * 60

    if (selectedMinutes < minMinutes || selectedMinutes > maxMinutes) {
      return { valid: false, message: 'Schedule time must be between 9:30 AM and 10:00 PM.' }
    }

    return { valid: true }
  }

  const handleSend = async () => {
    if (!selectedProject) return setError('Select a project')
    if (!file) return setError('Upload the exported Excel')

    const scheduleValidation = validateScheduledAt(scheduledAt)
    if (!scheduleValidation.valid) return setError(scheduleValidation.message)

    setLoading(true)
    setError('')
    const projectId = String(selectedProject).replace(/^proj_/, '')
    const form = new FormData()
    form.append('file', file)
    form.append('scheduled_at', scheduledAt ? formatToIST(scheduledAt) : formatToIST(new Date()))

    try {
      await recruiterAPI.notifyCampaign(form, { project_id: projectId, portal, message_type: messageType })
      setLoading(false)
      setFile(null)
      setPreview([])
      if (scheduledAt) setScheduledAt('')
      await fetchCampaignHistory()
      alert(scheduledAt ? 'Campaign scheduled' : 'Campaign sent')
    } catch (err) {
      setLoading(false)
      setError(err.response?.data?.message || 'Failed to send campaign')
    }
  }

  return (
    <div className="campaigns-page">
      <PageHeader title="Campaigns" subtitle="Run bulk notifications (SMS)" />

      <Card>
        <div className="card-header">
          <div>
            <div className="card-title">Campaign details</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Choose a project, portal, and upload the candidate list.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" type="button" disabled>
              {projLoading ? 'Loading projects…' : `${projects.length} projects loaded`}
            </button>
          </div>
        </div>

        <div className="grid-3" style={{ gap: 16, alignItems: 'flex-end' }}>
          <div className="form-group">
            <label className="form-label">Project</label>
            <select className="form-control" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="">{projLoading ? 'Loading…' : 'Select project'}</option>
              {projects.map((p) => (
                <option key={p.id || p.projectId || p.project_id || p.name} value={p.id || p.projectId || p.project_id || p.name}>
                  {p.name || p.title || p.projectName || String(p.id || p.projectId || p.project_id)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Portal</label>
            <select className="form-control" value={portal} onChange={(e) => setPortal(e.target.value)}>
              <option value="sms">SMS</option>
              {/* <option value="whatsapp">WhatsApp</option> */}
              {/* <option value="email">Email</option> */}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Message type</label>
            <select className="form-control" value={messageType} onChange={(e) => setMessageType(e.target.value)}>
              <option value="registration">Registration</option>
              <option value="attendance">Attendance</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Upload candidate list</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
            <button className="btn btn-outline btn-sm" type="button" onClick={() => fileRef.current && fileRef.current.click()}>
              <FontAwesomeIcon icon={faUpload} />
              <span>{file ? file.name : 'Upload Excel'}</span>
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={downloadSampleFile}>
              <FontAwesomeIcon icon={faUpload} style={{ transform: 'rotate(180deg)' }} />
              <span>Download sample</span>
            </button>
            {file && <span style={{ color: 'var(--text3)', fontSize: 13 }}>{Math.round(file.size / 1024)} KB selected</span>}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>
            Upload the exported not-registered file with columns: <strong>S.no</strong>, <strong>candidate_name</strong>, <strong>candidate_mobile_number</strong>.
          </div>
        </div>

        <div className="grid-2" style={{ gap: 16, alignItems: 'flex-end', marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label">Schedule date & time (optional)</label>
            <input
              type="datetime-local"
              className="form-control"
              value={scheduledAt}
              onChange={(e) => {
                const nextValue = e.target.value
                setScheduledAt(nextValue)
                const validation = validateScheduledAt(nextValue)
                if (!validation.valid) {
                  setError(validation.message)
                } else {
                  setError('')
                }
              }}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Leave blank to send immediately. If you choose a time, it must be between 9:30 AM and 10:00 PM.
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'var(--red)', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary btn-sm" type="button" onClick={handleSend} disabled={loading || !file || !selectedProject}>
            {loading
              ? <><FontAwesomeIcon icon={faSpinner} spin /> Sending...</>
              : <><FontAwesomeIcon icon={faCheckCircle} /> Send campaign</>
            }
          </button>
        </div>
      </Card>

      <Card style={{ marginTop: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Campaign history</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>View past and ongoing campaigns with date, time, project, portal, message type, and status.</div>
          </div>
        </div>

        <div className="projects-table-filters" style={{ marginTop: 0, marginBottom: 0 }}>
          <div className="projects-table-filter-group search-group">
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control search-input"
                placeholder="Search campaign or project"
                value={historySearch}
                onChange={(e) => handleHistorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setHistorySearchQuery(historySearch.trim())}
              />
            </div>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Project</div>
            <select className="form-control" value={historyProjectFilter} onChange={(e) => handleHistoryFilterChange(setHistoryProjectFilter)(e.target.value)}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id || project.projectId || project.project_id || project.name} value={project.id || project.projectId || project.project_id || project.name}>
                  {project.name || project.title || project.projectName || String(project.id || project.projectId || project.project_id)}
                </option>
              ))}
            </select>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Portal</div>
            <select className="form-control" value={historyPortalFilter} onChange={(e) => handleHistoryFilterChange(setHistoryPortalFilter)(e.target.value)}>
              <option value="">All portals</option>
              <option value="sms">SMS</option>
              {/* <option value="whatsapp">WhatsApp</option> */}
              {/* <option value="email">Email</option> */}
            </select>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Message type</div>
            <select className="form-control" value={historyMessageTypeFilter} onChange={(e) => handleHistoryFilterChange(setHistoryMessageTypeFilter)(e.target.value)}>
              <option value="">All types</option>
              <option value="registration">Registration</option>
              <option value="attendance">Attendance</option>
            </select>
          </div>

          <div className="projects-table-filter-group date-group" style={{ alignItems: 'flex-end' }}>
            <div className="filter-label">Show</div>
            <select className="form-control" value={historyPageSize} onChange={(e) => { setHistoryPageSize(Number(e.target.value)); setHistoryPage(1); }}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
          </div>
        </div>

        <div className="excel-preview">
          {historyLoading ? (
            <div style={{ color: 'var(--text3)', padding: 20 }}>Loading campaign history…</div>
          ) : history.length === 0 ? (
            <div style={{ color: 'var(--text3)', padding: 20 }}>No campaigns found for the selected filters.</div>
          ) : (
            <div className="excel-table-wrap">
              <table className="excel-preview-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Candidate Name</th>
                    <th>Mobile Number</th>
                    <th>Project</th>
                    <th>Portal</th>
                    <th>Message type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((campaign) => {
                    const datetime = new Date(campaign.datetime)
                    return (
                      <tr key={campaign.id}>
                        <td>{datetime.toLocaleDateString()}</td>
                        <td>{datetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{campaign.candidateName || '-'}</td>
                        <td>{campaign.candidateMobileNumber || '-'}</td>
                        <td>{campaign.project || '-'}</td>
                        <td>{campaign.portal}</td>
                        <td>{campaign.messageType}</td>
                        <td>{campaign.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!historyLoading && historyTotal > historyPageSize && (
            <div className="projects-table-pagination" style={{ marginTop: 16 }}>
              <div className="pagination-summary">Showing <strong>{(historyPage - 1) * historyPageSize + 1}</strong> - <strong>{Math.min(historyPage * historyPageSize, historyTotal)}</strong> of <strong>{historyTotal}</strong></div>
              <div className="pagination-actions">
                <button className="btn btn-outline btn-sm" type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}>Previous</button>
                <div className="pagination-pages">
                  {historyPageStart > 1 && (<button className="pagination-page-btn" type="button" onClick={() => setHistoryPage(1)}>1</button>)}
                  {historyPageStart > 2 && <span className="pagination-ellipsis">…</span>}
                  {historyPageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={`pagination-page-btn${pageNumber === historyPage ? ' active' : ''}`}
                      type="button"
                      onClick={() => setHistoryPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  {historyPageEnd < historyPageCount - 1 && <span className="pagination-ellipsis">…</span>}
                  {historyPageEnd < historyPageCount && (<button className="pagination-page-btn" type="button" onClick={() => setHistoryPage(historyPageCount)}>{historyPageCount}</button>)}
                </div>
                <button className="btn btn-outline btn-sm" type="button" disabled={historyPage >= historyPageCount} onClick={() => setHistoryPage((prev) => Math.min(historyPageCount, prev + 1))}>Next</button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
