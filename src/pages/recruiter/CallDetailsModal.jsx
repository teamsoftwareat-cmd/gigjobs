import { useState, useEffect, useCallback } from 'react'
import { Modal, DataTable } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'

function exportCsv(calls = [], columns = [], filename = 'calls.csv') {
  // Ensure the header for CSV matches the display columns
  const csvHeader = ['S.No', 'Project Id', 'Project Name', 'Location', 'District', 'Centre', 'Name', 'Phone', 'Status', 'Comment', 'Date', 'Time'].join(',');
  const lines = calls.map((call, idx) => [
    idx + 1,
    call.projectId || call.project?.id || '-',
    call.projectName || call.project?.name || '-',
    call.location || call.location_name || call.project?.location || '-',
    call.district || call.district_name || call.project?.district || '-',
    call.centre || call.centre_name || call.center || call.center_name || call.project?.centre || '-',
    call.name || call.recipient || '-',
    call.phone || call.mobile || '-',
    call.status || '-',
    call.comment || call.note || '-',
    call.date || call.createdAt || '-',
    call.time || (call.createdAt ? new Date(call.createdAt).toLocaleTimeString() : '-')
  ].map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
  const csv = [csvHeader, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function CallDetailsModal({ isOpen, onClose, callerId }) {
  const [calls, setCalls] = useState([]) // Store raw call data
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
        const [page, setPage] = useState(1) 
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [projectType, setProjectType] = useState('regular')
  const [projectFilter, setProjectFilter] = useState('')
  const [projectOptions, setProjectOptions] = useState({ regular: [], written: [] })
  const [locationFilter, setLocationFilter] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [districtFilter, setDistrictFilter] = useState('')
  const [districtOptions, setDistrictOptions] = useState([])
  const [centreFilter, setCentreFilter] = useState('')
  const [centreOptions, setCentreOptions] = useState([])

  // Predefined status options
  const statusOptions = [
    'pending',
    'Call unanswered',
    'Call busy',
    'Call not reachable',
    'Not interested',
    'Interested',
    'Call back later',
    'Wrong number',
    'Others'
  ]

  const normalizeProjects = useCallback((resp) => {
    const payload = resp?.data ?? {}
    const rawList = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.projects)
        ? payload.projects
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(resp)
            ? resp
            : []

    return rawList.map((item) => {
      if (!item) return null
      if (typeof item === 'object') {
        const value = String(item.id ?? item.project_id ?? item.value ?? item.key ?? item._id ?? item.projectId ?? '')
        const label = String(item.name ?? item.project_name ?? item.title ?? item.label ?? item.value ?? value)
        return value ? { value, label } : null
      }
      const text = String(item || '')
      return text ? { value: text, label: text } : null
    }).filter(Boolean)
  }, [])

  const normalizeAreaOptions = useCallback((resp) => {
    const payload = resp?.data ?? {}
    const rawList = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.locations)
        ? payload.locations
        : Array.isArray(payload?.location_options)
          ? payload.location_options
          : Array.isArray(payload?.locationOptions)
            ? payload.locationOptions
            : Array.isArray(payload?.districts)
              ? payload.districts
              : Array.isArray(payload?.district_options)
                ? payload.district_options
                : Array.isArray(payload?.districtOptions)
                  ? payload.districtOptions
                  : Array.isArray(payload?.centres)
                    ? payload.centres
                    : Array.isArray(payload?.centre_options)
                      ? payload.centre_options
                      : Array.isArray(payload?.centreOptions)
                        ? payload.centreOptions
                        : Array.isArray(resp)
                          ? resp
                          : []

    return Array.isArray(rawList) ? rawList.map((item) => {
      if (!item) return null
      if (typeof item === 'object') {
        const id = String(item.id ?? item.locationId ?? item.districtId ?? item.centreId ?? item.value ?? item.key ?? item._id ?? '')
        const name = String(item.name ?? item.location ?? item.district ?? item.centre ?? item.label ?? item.value ?? id)
        return id ? { id, name } : null
      }
      const text = String(item || '')
      return text ? { id: text, name: text } : null
    }).filter(Boolean) : []
  }, [])

  const fetchProjectOptions = useCallback(async () => {
    try {
      const [regularResp, writtenResp] = await Promise.all([
        recruiterAPI.getProjectSuggestions('', 200, 'regular'),
        recruiterAPI.getProjectSuggestions('', 200, 'written')
      ])
      setProjectOptions({
        regular: normalizeProjects(regularResp),
        written: normalizeProjects(writtenResp)
      })
    } catch {
      setProjectOptions({ regular: [], written: [] })
    }
  }, [normalizeProjects])

  const fetchLocationOptions = useCallback(async (projectId) => {
    if (!projectId) {
      setLocationOptions([])
      return
    }
    try {
      const response = await recruiterAPI.getProjectLocations(projectId)
      setLocationOptions(normalizeAreaOptions(response))
    } catch {
      setLocationOptions([])
    }
  }, [normalizeAreaOptions])

  const fetchDistrictOptions = useCallback(async (projectId) => {
    if (!projectId) {
      setDistrictOptions([])
      return
    }
    try {
      const response = await recruiterAPI.getProjectDistricts(projectId)
      setDistrictOptions(normalizeAreaOptions(response))
    } catch {
      setDistrictOptions([])
    }
  }, [normalizeAreaOptions])

  const fetchCentreOptions = useCallback(async (projectId, districtId) => {
    if (!projectId || !districtId) {
      setCentreOptions([])
      return
    }
    try {
      const response = await recruiterAPI.getDistrictCentres(projectId, districtId)
      setCentreOptions(normalizeAreaOptions(response))
    } catch {
      setCentreOptions([])
    }
  }, [normalizeAreaOptions])

  useEffect(() => {
    fetchProjectOptions()
  }, [fetchProjectOptions])

  useEffect(() => {
    if (isOpen && callerId) {
      setPage(1)
      fetchCalls()
    } else {
      setCalls([])
      setTotal(0)
      setStatusFilter('')
      setProjectType('regular')
      setProjectFilter('')
      setLocationFilter('')
      setLocationOptions([])
      setDistrictFilter('')
      setDistrictOptions([])
      setCentreFilter('')
      setCentreOptions([])
      setSearch('')
      setFrom('')
      setTo('')
    }
  }, [isOpen, callerId])

  useEffect(() => {
    if (projectFilter) {
      setLocationFilter('')
      setDistrictFilter('')
      setCentreFilter('')
      setDistrictOptions([])
      setCentreOptions([])

      if (projectType === 'regular') {
        fetchLocationOptions(projectFilter)
      } else {
        fetchDistrictOptions(projectFilter)
      }
    } else {
      setLocationOptions([])
      setDistrictOptions([])
      setCentreOptions([])
      setLocationFilter('')
      setDistrictFilter('')
      setCentreFilter('')
    }
  }, [projectFilter, projectType, fetchLocationOptions, fetchDistrictOptions])

  useEffect(() => {
    if (projectType !== 'regular') {
      if (projectFilter && districtFilter) {
        fetchCentreOptions(projectFilter, districtFilter)
      } else {
        setCentreOptions([])
        setCentreFilter('')
      }
    }
  }, [projectType, projectFilter, districtFilter, fetchCentreOptions])

  useEffect(() => {
    if (isOpen && callerId) fetchCalls()
  }, [page, pageSize, search, from, to, statusFilter, projectType, projectFilter, locationFilter, districtFilter, centreFilter])

  const fetchCalls = async () => {
    setLoading(true)
    try {
      const offset = (Math.max(1, page) - 1) * pageSize
      const params = {
        search: search || undefined,
        status: statusFilter || undefined,
        projectType: projectType || undefined,
        project: projectFilter || undefined,
        location: locationFilter || undefined,
        district: districtFilter || undefined,
        centre: centreFilter || undefined,
        from: from || undefined,
        to: to || undefined,
        offset,
        limit: pageSize
      }
      const res = await recruiterAPI.getCallerCalls(callerId, params)
      const data = res.data?.data || {}
      const items = data.items || data.calls || []
      const totalCount = data.total || data.meta?.total || (Array.isArray(items) ? items.length : 0)
      
      setCalls(items)
      setTotal(Number(totalCount || 0))
    } catch (err) {
      setCalls([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const rows = calls.map((it, idx) => {
    const callId = it.id || it.callId || `call-${idx}`
    const startIndex = (Math.max(1, page) - 1) * pageSize
    return [
      startIndex + idx + 1,
      it.projectId || it.project?.id || '-',
      it.projectName || it.project?.name || '-',
      it.location || it.location_name || it.project?.location || '-',
      it.district || it.district_name || it.project?.district || '-',
      it.centre || it.centre_name || it.center || it.center_name || it.project?.centre || '-',
      it.name || it.recipient || '-',
      it.phone || it.mobile || '-',
      it.status || '-',
      it.comment || it.note || '-',
      it.date || it.createdAt || '-',
      it.time || (it.createdAt ? new Date(it.createdAt).toLocaleTimeString() : '-')
    ]
  })

   const columns = ['S.No', 'Project Id', 'Project Name', 'Location', 'District', 'Centre', 'Name', 'Phone', 'Status', 'Comment', 'Date', 'Time']

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Call Details" fullScreen>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-control" placeholder="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ minWidth: 220 }} />
          <select 
            className="form-control"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <input type="date" className="form-control" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          <input type="date" className="form-control" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          <button className="btn btn-outline" onClick={() => { setPage(1); fetchCalls() }} disabled={loading}>Filter</button>
          <button className="btn btn-primary" onClick={() => exportCsv(calls, columns)}>Export</button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-control"
            value={projectType}
            onChange={(e) => { setProjectType(e.target.value); setPage(1) }}
            style={{ minWidth: 180 }}
          >
            <option value="regular">Regular project</option>
            <option value="written">Written project</option>
          </select>

          <select
            className="form-control"
            value={projectFilter}
            onChange={(e) => { setProjectFilter(e.target.value); setPage(1) }}
            style={{ minWidth: 240 }}
          >
            <option value="">All Projects</option>
            {(projectOptions[projectType] || []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {projectType === 'regular' ? (
            <select
              className="form-control"
              value={locationFilter}
              disabled={!projectFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setPage(1) }}
              style={{ minWidth: 220 }}
            >
              <option value="">All Locations</option>
              {locationOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          ) : (
            <>
              <select
                className="form-control"
                value={districtFilter}
                disabled={!projectFilter}
                onChange={(e) => { setDistrictFilter(e.target.value); setPage(1) }}
                style={{ minWidth: 200 }}
              >
                <option value="">All Districts</option>
                {districtOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>

              <select
                className="form-control"
                value={centreFilter}
                disabled={!districtFilter}
                onChange={(e) => { setCentreFilter(e.target.value); setPage(1) }}
                style={{ minWidth: 200 }}
              >
                <option value="">All Centres</option>
                {centreOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="entries-selector">
          <label>Rows</label>
          <select className="form-control" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <DataTable columns={columns} rows={rows} emptyMessage={loading ? 'Loading calls…' : 'No calls found.'} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
          <div style={{ color: 'var(--text3)' }}>
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} of {total}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="pagination-page-btn" type="button" disabled={page === 1} onClick={() => setPage(1)}>First</button>
            <button className="pagination-page-btn" type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>

            <div className="pagination-pages">
              {pageStart > 1 && (
                <>
                  <button className="pagination-page-btn" type="button" onClick={() => setPage(1)}>1</button>
                  {pageStart > 2 && <span className="pagination-ellipsis">…</span>}
                </>
              )}

              {pageNumbers.map((pnum) => (
                <button key={pnum} className={`pagination-page-btn${pnum === page ? ' active' : ''}`} type="button" onClick={() => setPage(pnum)}>{pnum}</button>
              ))}

              {pageEnd < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
              {pageEnd < totalPages && (
                <button className="pagination-page-btn" type="button" onClick={() => setPage(totalPages)}>{totalPages}</button>
              )}
            </div>

            <button className="pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            <button className="pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
