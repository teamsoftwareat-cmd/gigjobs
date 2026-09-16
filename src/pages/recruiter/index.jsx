import { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faUserPlus, faUpload, faSearch, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { Card, CardHeader, PageHeader, Tabs, DataTable, Tag, Modal } from '../../components/ui/index'
import ProjectsTable from '../../components/ui/ProjectsTable'
import CreateProjectModal from './CreateProjectModal'
import InternalRegisterModal from '../auth/InternalRegisterModal'
import { recruiterAPI } from '../../api/axios'
import { addCandidateSchema } from '../../schemas/validations'
import ProjectStatsViz from '../../components/ProjectStatsViz'

const normalizeRowCount = (row, fields) => {
  for (const field of fields) {
    const value = row[field]
    if (value !== undefined && value !== null && value !== '') return Number(value)
  }
  return 0
}

function ProjectStatsPanel({ projectId, refreshTrigger }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [designation, setDesignation] = useState('')
  const [designationOptions, setDesignationOptions] = useState([])
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [viewMode, setViewMode] = useState('location')
  const [currentDistrict, setCurrentDistrict] = useState(null)

  const fetchStats = useCallback(async () => {
    if (!projectId || viewMode === 'centre') return
    setLoading(true)
    try {
      const params = {
        from: fromDate || undefined,
        to: toDate || undefined,
        designation: designation || undefined,
        search: search || undefined,
        limit,
        offset,
      }

      const response = await recruiterAPI.getProjectStats(projectId, params)
      const payload = response?.data ?? {}
      const dataList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
            ? payload
            : []

      setRows(dataList)
      const totalCount = payload?.total ?? payload?.count ?? payload?.meta?.total ?? dataList.length
      setTotal(Number(totalCount) || 0)
    } catch (error) {
      console.error('Failed to load project stats', error)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [projectId, fromDate, toDate, designation, search, limit, offset, viewMode])

  useEffect(() => {
    fetchStats()
  }, [fetchStats, refreshTrigger])

  useEffect(() => {
    if (!projectId) return

    const loadDesignations = async () => {
      try {
        const response = await recruiterAPI.getDesignations(projectId)
        const payload = response?.data ?? response ?? []
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : []

        setDesignationOptions(list.map((item) => (typeof item === 'string' ? item : item.name || item.designation || '')).filter(Boolean))
      } catch (err) {
        console.warn('Failed to load designations:', err)
        setDesignationOptions([])
      }
    }

    loadDesignations()
  }, [projectId, refreshTrigger])

  const fetchDistrictStats = useCallback(async () => {
    if (!projectId || !currentDistrict || viewMode !== 'centre') return
    setLoading(true)
    try {
      const districtId = currentDistrict.districtId || currentDistrict.id || currentDistrict.district
      const response = await recruiterAPI.getProjectDistrictStats(projectId, districtId, {
        from: fromDate || undefined,
        to: toDate || undefined,
        designation: designation || undefined,
        search: search || undefined,
        limit,
        offset,
      })
      const payload = response?.data ?? {}
      const centres = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : []

      setRows(centres)
      setTotal(centres.length)
    } catch (err) {
      console.error('Failed to load centres for district', err)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [projectId, currentDistrict, viewMode, fromDate, toDate, designation, search, limit, offset])

  useEffect(() => {
    fetchDistrictStats()
  }, [fetchDistrictStats, refreshTrigger])

  const handleDrill = (item) => {
    const districtId = item.districtId || item.id || item.district
    if (!districtId) return
    setCurrentDistrict(item)
    setViewMode('centre')
    setOffset(0)
  }

  const handleBack = () => {
    setCurrentDistrict(null)
    setViewMode('location')
    setOffset(0)
  }

  const renderDesignationBreakdown = (breakdown) => {
    const list = Array.isArray(breakdown)
      ? breakdown
      : typeof breakdown === 'object' && breakdown
        ? Object.entries(breakdown).map(([designation, values]) => ({ designation, ...values }))
        : []

    if (list.length === 0) {
      return <div style={{ color: 'var(--text3)', fontSize: 12 }}>—</div>
    }

    return (
      <div style={{ display: 'grid', gap: 6, fontSize: 11, lineHeight: 1.3 }}>
        {list.slice(0, 3).map((item, idx) => {
          const des = item.designation || item.name || item.label || 'Unknown'
          const req = normalizeRowCount(item, ['required', 'required_count', 'requiredCount', 'total_required'])
          const avail = normalizeRowCount(item, ['available', 'available_count', 'availableCount', 'present', 'filled'])
          return (
            <div key={idx} style={{ color: 'var(--text)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{des}</span>
              <span style={{ fontWeight: 600 }}>{avail}/{req}</span>
            </div>
          )
        })}
        {list.length > 3 && <div style={{ color: 'var(--text2)', fontSize: 10 }}>+{list.length - 3} more</div>}
      </div>
    )
  }

  const columns = viewMode === 'location'
    ? ['S.No', 'Location', 'Required', 'Available', 'Unfilled', 'Designations', 'Action']
    : ['S.No', 'Centre', 'Required', 'Available', 'Unfilled', 'Designations']

  const totals = rows.reduce(
    (acc, r) => {
      const required = normalizeRowCount(r, ['required', 'required_count', 'requiredCount', 'total_required'])
      const available = normalizeRowCount(r, ['available', 'available_count', 'availableCount', 'present', 'filled'])
      const unfilled = Math.max(0, required - available)
      return {
        required: acc.required + required,
        available: acc.available + available,
        unfilled: acc.unfilled + unfilled,
      }
    },
    { required: 0, available: 0, unfilled: 0 }
  )

  const tableRows = rows.map((r, idx) => {
    const name = viewMode === 'centre'
      ? r.centre_name || r.centre || r.district || r.district_name || r.location || r.location_name || r.name || r.label || 'Unknown'
      : r.district || r.district_name || r.location || r.location_name || r.centre || r.centre_name || r.name || r.label || 'Unknown'
    const required = normalizeRowCount(r, ['required', 'required_count', 'requiredCount', 'total_required'])
    const available = normalizeRowCount(r, ['available', 'available_count', 'availableCount', 'present', 'filled'])
    const unfilled = Math.max(0, required - available)
    const breakdown = r.designation_breakdown || r.designations || r.designation || r.breakdown || []
    const action = viewMode === 'location'
      ? <button className="btn btn-outline btn-sm" type="button" onClick={() => handleDrill(r)}>View centres</button>
      : null

    return [offset + idx + 1, name, required, available, unfilled, renderDesignationBreakdown(breakdown), action]
  })

  // Add totals row
  const totalsRow = [
    <strong style={{ color: 'var(--text)', minWidth: '100px', display: 'block' }}>Total</strong>,
    '',
    <strong style={{ color: 'var(--text)' }}>{totals.required}</strong>,
    <strong style={{ color: 'var(--text)' }}>{totals.available}</strong>,
    <strong style={{ color: 'var(--text)' }}>{totals.unfilled}</strong>,
    '',
  ]
  if (viewMode === 'location') {
    totalsRow.push('')
  }
  tableRows.push(totalsRow.slice(0, columns.length))

  const renderDonut = (percentage, label, value, total, color) => {
    const radius = 50
    const circumference = 2 * Math.PI * radius
    const filledLength = circumference * Math.min(percentage, 100) / 100

    return (
      <div style={{ display: 'grid', placeItems: 'center', gap: 10, padding: 16, backgroundColor: 'var(--card)', borderRadius: 16, boxShadow: '0 8px 20px var(--shadow)', border: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%' }}>
            <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--chart-track)" strokeWidth="16" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={`${filledLength} ${circumference - filledLength}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700, color: 'var(--text)' }}>
            <div style={{ fontSize: 22 }}>{percentage}%</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{value} of {total}</div>
        </div>
      </div>
    )
  }

  const renderMiniDonut = (percentage, color) => {
    const radius = 18
    const circumference = 2 * Math.PI * radius
    const filledLength = circumference * Math.min(percentage, 100) / 100

    return (
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(15, 23, 42, 0.1)" strokeWidth="12" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${circumference - filledLength}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
    )
  }

  const renderVisualization = () => {
    if (rows.length === 0) return null

    const fillPercentage = totals.required > 0 ? Math.round((totals.available / totals.required) * 100) : 0
    const statusColor = fillPercentage >= 80 ? 'rgba(75, 192, 75, 1)' : fillPercentage >= 50 ? 'rgba(255, 159, 64, 1)' : 'rgba(239, 68, 68, 1)'

    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 20, alignItems: 'center' }}>
            {renderDonut(fillPercentage, 'Project fill rate', totals.available, totals.required, statusColor)}
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ padding: 18, backgroundColor: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 8px 20px var(--shadow)' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Total Required</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'rgba(54, 162, 235, 1)' }}>{totals.required}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div style={{ padding: 16, backgroundColor: '#f0fdf4', borderRadius: 16, border: '1px solid rgba(75, 192, 75, 0.18)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Present</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(75, 192, 75, 1)' }}>{totals.available}</div>
                </div>
                <div style={{ padding: 16, backgroundColor: '#fef3f2', borderRadius: 16, border: '1px solid rgba(255, 159, 64, 0.18)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Absent</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255, 159, 64, 1)' }}>{totals.unfilled}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {viewMode === 'centre' ? `${currentDistrict?.district || 'District'} Centres` : 'Location Breakdown'}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((r, idx) => {
              const name = viewMode === 'centre'
                ? r.centre_name || r.centre || r.district || r.district_name || r.location || r.location_name || r.name || r.label || 'Unknown'
                : r.district || r.district_name || r.location || r.location_name || r.centre || r.centre_name || r.name || r.label || 'Unknown'
              const required = normalizeRowCount(r, ['required', 'required_count', 'requiredCount', 'total_required'])
              const available = normalizeRowCount(r, ['available', 'available_count', 'availableCount', 'present', 'filled'])
              const percentage = required > 0 ? Math.round((available / required) * 100) : 0
              const miniColor = percentage >= 80 ? 'rgba(75, 192, 75, 1)' : percentage >= 50 ? 'rgba(255, 159, 64, 1)' : 'rgba(239, 68, 68, 1)'

              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center', padding: 14, backgroundColor: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 6px 18px var(--shadow)' }}>
                  <div>{renderMiniDonut(percentage, miniColor)}</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{name}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: miniColor }}>{percentage}%</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>Filled</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{available}/{required}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {viewMode === 'centre' && (
          <button className="btn btn-outline btn-sm" type="button" onClick={handleBack}>
            <FontAwesomeIcon icon={faArrowLeft} /> Back
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 240 }}>
          <FontAwesomeIcon icon={faSearch} />
          <input
            className="form-control"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
          />
        </div>

        <div>
          <div className="filter-label">From</div>
          <input className="form-control" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setOffset(0) }} />
        </div>
        <div>
          <div className="filter-label">To</div>
          <input className="form-control" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setOffset(0) }} />
        </div>
        <div>
          <div className="filter-label">Designation</div>
          <select className="form-control" value={designation} onChange={(e) => { setDesignation(e.target.value); setOffset(0) }}>
            <option value="">All designations</option>
            {designationOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <select className="form-control" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0) }}>
            <option value={10}>10 entries</option>
            <option value={20}>20 entries</option>
            <option value={50}>50 entries</option>
          </select>
        </div>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => {
          setFromDate('')
          setToDate('')
          setDesignation('')
          setSearch('')
          setOffset(0)
        }}>
          Clear
        </button>
      </div>

      <ProjectStatsViz rows={rows} totals={totals} viewMode={viewMode} currentDistrict={currentDistrict} onDrill={handleDrill} />

      <DataTable
        columns={columns}
        rows={loading ? [] : tableRows}
        emptyMessage={loading ? 'Loading stats…' : 'No data available.'}
      />

      <div style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 12 }}>
        Showing {Math.min(total, offset + 1)}–{Math.min(total, offset + limit)} of {total} rows
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          Showing <strong>{Math.min(total, offset + 1)}</strong>-<strong>{Math.min(total, offset + limit)}</strong> of <strong>{total}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            disabled={offset === 0}
            style={{ width: 'fit-content !important' }}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: 'fit-content' }}>
            {Math.ceil(total / limit) <= 5 ? (
              Array.from({ length: Math.ceil(total / limit) }, (_, i) => i).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`btn btn-sm ${offset === pageNum * limit ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setOffset(pageNum * limit)}
                >
                  {pageNum + 1}
                </button>
              ))
            ) : (
              <>
                {offset > 0 && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setOffset(0)}>1</button>
                )}
                {offset > limit * 2 && <span style={{ color: 'var(--text2)' }}>…</span>}
                {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i)
                  .filter((i) => i * limit >= offset - limit && i * limit <= offset + limit * 2)
                  .map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`btn btn-sm ${offset === pageNum * limit ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setOffset(pageNum * limit)}
                    >
                      {pageNum + 1}
                    </button>
                  ))}
                {offset < (Math.ceil(total / limit) - 3) * limit && <span style={{ color: 'var(--text2)' }}>…</span>}
                {offset < (Math.ceil(total / limit) - 1) * limit && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setOffset((Math.ceil(total / limit) - 1) * limit)}
                  >
                    {Math.ceil(total / limit)}
                  </button>
                )}
              </>
            )}
          </div>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            style={{ width: 'fit-content !important' }}
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectSearchSelect({ options, value, onChange }) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const selectedProject = options.find((project) => project.id === value)
  const filteredOptions = options.filter((project) => project.label.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="form-control"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="project-stats-options"
        placeholder="Search projects..."
        value={isOpen ? search : selectedProject?.label || ''}
        onFocus={() => {
          setSearch('')
          setIsOpen(true)
        }}
        onChange={(e) => {
          setSearch(e.target.value)
          setIsOpen(true)
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
      />
      {isOpen && (
        <div
          id="project-stats-options"
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: 'auto',
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border-light, #DDE4EE)',
            borderRadius: 8,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
          }}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(''); setSearch(''); setIsOpen(false) }}
            style={{ display: 'block', width: '100%', padding: '10px 12px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--text2)' }}
          >
            Choose a project to view stats
          </button>
          {filteredOptions.length > 0 ? filteredOptions.map((project) => (
            <button
              key={project.id}
              type="button"
              role="option"
              aria-selected={project.id === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(project.id); setSearch(''); setIsOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '10px 12px', border: 0, background: project.id === value ? 'var(--bg, #f5f7fa)' : 'transparent', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}
            >
              {project.label}
            </button>
          )) : (
            <div style={{ padding: '10px 12px', color: 'var(--text2)', fontSize: 13 }}>No projects found.</div>
          )}
        </div>
      )}
    </div>
  )
}

export function RecruiterDashboard() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState({ projects: false })
  const [totalProjects, setTotalProjects] = useState(0)
  const [statusCounts, setStatusCounts] = useState({ pending: 0, completed: 0, hold: 0, cancelled: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [projectOptions, setProjectOptions] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [showCreateInternalUser, setShowCreateInternalUser] = useState(false)
  const [editingProject, setEditingProject] = useState(null)

  const projectTabs = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'completed', label: 'Completed' },
    { id: 'hold', label: 'Hold' },
    { id: 'cancelled', label: 'Cancelled' }
  ]

  const loadProjectOptions = async () => {
    try {
      const res = await recruiterAPI.getProjectSuggestions('', 500)
      const payload = res.data?.data || res.data || []
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
          ? payload.items
          : Array.isArray(payload.projects)
            ? payload.projects
            : []

      const options = list
        .map((item) => {
          const value = item.projectId || item.id || item.project_id || item.value || item.name || item.projectName
          const label = item.projectName || item.name || item.title || item.label || value
          return value ? { id: String(value), label } : null
        })
        .filter(Boolean)

      setProjectOptions(options)
    } catch (error) {
      console.warn('Failed to load project suggestions', error)
      setProjectOptions([])
    }
  }

  useEffect(() => {
    loadProjectOptions()
    fetchProjects()
  }, [])

  const fetchProjects = useCallback(async () => {
    setLoading((prev) => ({ ...prev, projects: true }))
    try {
      const params = {
        search: searchTerm || undefined,
        from: dateFilter.from || undefined,
        to: dateFilter.to || undefined,
        location: locationFilter !== 'All' ? locationFilter : undefined,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        offset: (page - 1) * pageSize,
        limit: pageSize
      }

      const res = await recruiterAPI.getProjects(params)
      const data = res.data?.data || {}
      const items = data.items || data.projects || []
      const total = data.total || data.totalCount || data.count || data.meta?.total || data.meta?.totalItems || items.length
      const counts = data.statusCounts || data.meta?.statusCounts || {}

      const parsedStatusCounts = {
        pending: counts.pending ?? 0,
        completed: counts.completed ?? 0,
        hold: counts.hold ?? 0,
        cancelled: counts.cancelled ?? 0
      }

      if (!counts.pending && !counts.completed && !counts.hold && !counts.cancelled) {
        parsedStatusCounts.pending = items.filter((project) => project.status?.toLowerCase() === 'pending').length
        parsedStatusCounts.completed = items.filter((project) => project.status?.toLowerCase() === 'completed').length
        parsedStatusCounts.hold = items.filter((project) => project.status?.toLowerCase() === 'hold').length
        parsedStatusCounts.cancelled = items.filter((project) => project.status?.toLowerCase() === 'cancelled').length
      }

      setProjects(items)
      setTotalProjects(total)
      setStatusCounts(parsedStatusCounts)
    } catch (error) {
      console.error('Failed to load projects', error)
      setProjects([])
      setTotalProjects(0)
      setStatusCounts({ pending: 0, completed: 0, hold: 0, cancelled: 0 })
    } finally {
      setLoading((prev) => ({ ...prev, projects: false }))
    }
  }, [selectedStatus, searchTerm, locationFilter, dateFilter, page, pageSize])

  useEffect(() => {
    fetchProjects()
  }, [page, pageSize, searchTerm, locationFilter, dateFilter, selectedStatus, fetchProjects])

  const handleRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    setPage(1)
    setStatsRefreshTrigger((prev) => prev + 1)

    try {
      await loadProjectOptions()
      await fetchProjects()
    } finally {
      setIsRefreshing(false)
    }
  }

  const filteredProjects = projects.filter((project) => {
    const statusMatch = selectedStatus === 'all' || project.status?.toLowerCase() === selectedStatus
    if (!statusMatch) return false

    const searchMatch =
      !searchTerm ||
      [project.projectId, project.projectName, project.name, project.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))

    if (!searchMatch) return false

    const locationMatch = locationFilter === 'All' || project.location === locationFilter
    if (!locationMatch) return false

    if (dateFilter.from || dateFilter.to) {
      const projectDate = new Date(project.startDate || project.createdAt)
      if (dateFilter.from) {
        const fromDate = new Date(dateFilter.from)
        if (projectDate < fromDate) return false
      }
      if (dateFilter.to) {
        const toDate = new Date(dateFilter.to)
        toDate.setHours(23, 59, 59, 999)
        if (projectDate > toDate) return false
      }
    }

    return true
  })

  const handleSearch = useCallback((value) => {
    setSearchTerm(value)
    setPage(1)
  }, [])

  const handleLocationFilter = useCallback((value) => {
    setLocationFilter(value)
    setPage(1)
  }, [])

  const handleDateFilter = useCallback((filter) => {
    setDateFilter(filter)
    setPage(1)
  }, [])

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size)
    setPage(1)
  }, [])

  const handleEditProject = useCallback((project) => {
    setEditingProject(project)
    setShowCreateProjectModal(true)
  }, [])

  return (
    <div>
      <PageHeader
        title="Recruiter Dashboard"
        subtitle="Project operations"
        action={
          <div
            style={{
              display: 'flex',
              gap: 8,
              width: 'fit-content',
              alignItems: 'center',
            }}
          >
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
              style={{
                width: 'fit-content',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.2)',
                borderRadius: 999,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: isRefreshing ? 0.9 : 1,
              }}
            >
              <FontAwesomeIcon icon={faSync} spin={isRefreshing} /> {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>

            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={() => setShowCreateInternalUser(true)}
              style={{
                width: 'fit-content',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                borderRadius: 999,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FontAwesomeIcon icon={faUserPlus} /> Create Internal User
            </button>
          </div>
        }
      />

      <Card style={{ marginTop: 12, marginBottom: 16, padding: 16 }}>
        <CardHeader title="Project Stats" />
        <div style={{ marginBottom: 16 }}>
          <div className="filter-label">Select Project</div>
          <ProjectSearchSelect options={projectOptions} value={selectedProjectId} onChange={setSelectedProjectId} />
        </div>
        {selectedProjectId && (
          <ProjectStatsPanel projectId={selectedProjectId} refreshTrigger={statsRefreshTrigger} />
        )}
      </Card>

      <Card>
        <CardHeader
          title={`${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Projects`}
          action={
            <Tabs
              tabs={projectTabs}
              activeTab={selectedStatus}
              onTabChange={(id) => {
                setSelectedStatus(id)
                setPage(1)
              }}
            />
          }
        />
        <ProjectsTable
          data={filteredProjects}
          loading={loading.projects}
          page={page}
          pageSize={pageSize}
          total={totalProjects}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onSearch={handleSearch}
          onLocationFilter={handleLocationFilter}
          onDateFilter={handleDateFilter}
          onStatusChange={() => fetchProjects()}
          onEditProject={handleEditProject}
          showFilters={true}
          emptyMessage={loading.projects ? 'Loading projects…' : `No ${selectedStatus} projects found.`}
        />
      </Card>

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => {
          setShowCreateProjectModal(false)
          setEditingProject(null)
          fetchProjects()
        }}
        project={editingProject}
      />

      {showCreateInternalUser && <InternalRegisterModal onClose={() => setShowCreateInternalUser(false)} />}
    </div>
  )
}

/* ===== RECRUITER CANDIDATES ===== */
export function RecruiterCandidates() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')

  const ROWS = [
    [<CandCell initials="RK" bg="linear-gradient(135deg,#0E7C86,#6C3FC5)" name="Ravi Kumar" phone="+91 99001 23456" />, <div className="chips"><div className="chip">MS Office</div><div className="chip">Tally</div></div>, 'Tambaram', <Tag variant="teal">Part-Time</Tag>, '⭐ 4.5', <Tag variant="green">Verified</Tag>, 'Today', <Actions />],
    [<CandCell initials="MP" bg="linear-gradient(135deg,#F4A130,#E53935)" name="Meena Prabhu" phone="+91 88004 56789" />, <div className="chips"><div className="chip">Data Entry</div><div className="chip">Excel</div></div>, 'Velachery', <Tag variant="green">Internship</Tag>, '⭐ 4.8', <Tag variant="green">Verified</Tag>, 'Yesterday', <Actions />],
    [<CandCell initials="DV" bg="linear-gradient(135deg,#1B9E5C,#0E7C86)" name="Deepa Venkat" phone="+91 77008 23411" />, <div className="chips"><div className="chip">Tele-calling</div><div className="chip">Tamil</div></div>, 'Guindy', <Tag variant="teal">Part-Time</Tag>, '⭐ 4.6', <Tag variant="yellow">Pending</Tag>, '2 days ago', <Actions />],
    [<CandCell initials="SA" bg="linear-gradient(135deg,#6C3FC5,#0E7C86)" name="Sundar Anand" phone="+91 99887 34512" />, <div className="chips"><div className="chip">Admin</div><div className="chip">Reception</div></div>, 'Anna Nagar', <Tag variant="yellow">Temp</Tag>, '⭐ 3.9', <Tag variant="green">Verified</Tag>, '1 week ago', <Actions />],
  ]

  return (
    <div>
      <PageHeader
        title="Candidate Database"
        subtitle="4,82,310 profiles in the talent pool"
        action={
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm"><FontAwesomeIcon icon={faUpload} /> Bulk Import</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}><FontAwesomeIcon icon={faUserPlus} /> Add Candidate</button>
          </div>
        }
      />
      <Card style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="form-control"
            style={{ flex: 2, minWidth: 200 }}
            placeholder="Search by name, skill, mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {[
            ['All Job Types', 'Internship', 'Part-Time', 'Temporary'],
            ['All Locations', 'Guindy', 'OMR', 'Tambaram'],
            ['KYC Status', 'Verified', 'Pending', 'Rejected']
          ].map((opts, i) => (
            <select key={i} className="form-control" style={{ flex: 1, minWidth: 130 }}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          <button className="btn btn-primary btn-sm"><FontAwesomeIcon icon={faSearch} /> Search</button>
        </div>
      </Card>
      <Card>
        <DataTable columns={['Candidate', 'Skills', 'Location', 'Preference', 'Rating', 'KYC', 'Last Active', 'Actions']} rows={ROWS} />
      </Card>
      <AddCandidateModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  )
}

/* ===== ADD CANDIDATE MODAL with Zod ===== */
function AddCandidateModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', location: 'Tambaram', jobType: 'Part-Time', source: 'Walk-in' })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)

  /* ===== POST /recruiter/candidates ===== */
  const handleSubmit = async () => {
    const result = addCandidateSchema.safeParse(form)
    if (!result.success) {
      const errs = {}
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message })
      setErrors(errs)
      return
    }
    setErrors({})
    try { 
      await recruiterAPI.addCandidate(form)
      setTimeout(() => { onClose(); setSuccess(false); setForm({ name: '', mobile: '', email: '', location: 'Tambaram', jobType: 'Part-Time', source: 'Walk-in' }) }, 1400)
    } catch {}
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Candidate"
      footer={!success && <>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit}>Add Candidate</button>
      </>}
    >
      {success ? null : (
        <div className="form-row">
          {[
            { label: 'Full Name', key: 'name', placeholder: 'Candidate\'s full name' },
            { label: 'Mobile', key: 'mobile', placeholder: '9876543210' },
            { label: 'Email', key: 'email', placeholder: 'candidate@email.com', type: 'email' }
          ].map(({ label, key, placeholder, type = 'text' }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input
                className={`form-control${errors[key] ? ' invalid' : ''}`}
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={set(key)}
              />
              {errors[key] && <div className="field-error">{errors[key]}</div>}
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">Location</label>
            <select className="form-control" value={form.location} onChange={set('location')}>
              <option>Tambaram</option>
              <option>Guindy</option>
              <option>OMR</option>
              <option>Anna Nagar</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Job Type</label>
            <select className="form-control" value={form.jobType} onChange={set('jobType')}>
              <option>Part-Time</option>
              <option>Internship</option>
              <option>Temporary</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select className="form-control" value={form.source} onChange={set('source')}>
              <option>Walk-in</option>
              <option>Naukri Import</option>
              <option>Referral</option>
              <option>Social Media</option>
              <option>College Drive</option>
            </select>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* helpers */
function CandCell({ initials, bg, name, phone }) {
  return (
    <div className="flex items-center gap-8">
      <div className="avatar av-sm" style={{ background: bg }}>{initials}</div>
      <div>
        <strong>{name}</strong>
        <div className="text-sm text-muted">{phone}</div>
      </div>
    </div>
  )
}

function Actions() {
  return <div className="flex gap-8"><button className="btn btn-outline btn-sm">Profile</button><button className="btn btn-primary btn-sm">Shortlist</button></div>
}