// src/components/ui/ProjectsTable.jsx
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faCalendarAlt, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons'
import { Table, Card } from '../ui/index'
import { recruiterAPI } from '../../api/axios'

const STATUS_OPTIONS = ['pending', 'completed', 'hold', 'cancelled']

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getStatusColor = (status) => {
  const lower = status?.toLowerCase() || ''
  if (lower === 'pending') return 'tag-yellow'
  if (lower === 'completed') return 'tag-green'
  if (lower === 'hold') return 'tag-orange'
  if (lower === 'cancelled') return 'tag-red'
  return 'tag-gray'
}

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return isMobile
}

export default function ProjectsTable({
  data = [],
  loading = false,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  onSearch,
  onLocationFilter,
  onDateFilter,
  onStatusChange,
  onEditProject,
  showFilters = true,
  emptyMessage = 'No projects found.'
}) {
  const [searchText, setSearchText] = useState('')
  const [locationFilter, setLocationFilter] = useState('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(null)
  const [locationOptions, setLocationOptions] = useState(['All'])
  const didMountRef = useRef(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    const fetchMainLocations = async () => {
      try {
        const response = await recruiterAPI.getProjectMainLocation()
        const locations = response?.data?.data || response?.data || []
        if (Array.isArray(locations)) {
          setLocationOptions(['All', ...locations])
        }
      } catch (error) {
        console.error('Failed to fetch main locations:', error)
      }
    }
    fetchMainLocations()
  }, [])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    const timer = setTimeout(() => onSearch?.(searchText.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchText, onSearch])

  const handleSearch = () => onSearch?.(searchText.trim())

  const handleLocationChange = (e) => {
    const value = e.target.value
    onLocationFilter?.(value)
  }

  const handleFromDateChange = (e) => {
    const value = e.target.value
    setFromDate(value)
    onDateFilter?.({ from: value, to: toDate })
  }

  const handleToDateChange = (e) => {
    const value = e.target.value
    setToDate(value)
    onDateFilter?.({ from: fromDate, to: value })
  }

  const handleStatusChange = async (projectId, newStatus) => {
    setUpdatingStatus(projectId)
    try {
      await recruiterAPI.updateProjectStatus(projectId, newStatus)
      onStatusChange?.(projectId, newStatus)
    } catch (error) {
      console.error('Failed to update project status:', error)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const columns = ['#', 'Project ID', 'Project', 'Duration', 'Location', 'Status', 'Actions']

  const rows = data.map((project, index) => {
    const kindRaw = project.projectKind || project.kind || project.type || project.projectType || ''
    const kindClass = `type-${String(kindRaw || '').toLowerCase().replace(/\s+/g, '-')}`

    return [
      index + 1,
      project.projectId || project.id || '-',
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
        <span className={`type-bar ${kindClass}`} />
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="project-name-cell">{project.projectName || project.name || project.title || '-'}</span>
          <span className="project-subtext">{project.clientName ? `${project.clientName} · ${project.location || 'No location'}` : project.location || '-'}</span>
        </div>
      </div>,
      `${formatDate(project.startDate)} → ${formatDate(project.endDate)}`,
      project.location || '-',
      <select
        value={project.status?.toLowerCase() || 'pending'}
        onChange={(e) => handleStatusChange(project.id || project.projectId, e.target.value)}
        disabled={updatingStatus === (project.id || project.projectId)}
        className="status-dropdown"
        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd' }}
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
        ))}
      </select>,
      <button className="btn btn-outline btn-sm" onClick={() => onEditProject?.(project)} style={{ padding: '4px 8px' }}>Edit</button>
    ]
  })

  const activeFilters = []
  if (searchText) activeFilters.push(`Search: ${searchText}`)
  if (locationFilter !== 'All') activeFilters.push(locationFilter)
  if (fromDate || toDate) activeFilters.push(`${fromDate || 'Any'} → ${toDate || 'Any'}`)

  const totalCount = total || data.length
  const firstRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(firstRow + data.length - 1, totalCount)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasPagination = typeof onPageChange === 'function' && totalCount > pageSize

  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  return (
    <div>
      {showFilters && (
        <>
          <div className="projects-table-filters">
            <div className="projects-table-filter-group search-group">
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input className="form-control search-input" placeholder="Search project ID or name" value={searchText} onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
              </div>
            </div>

            <div className="projects-table-filter-group date-group">
              <div className="filter-label" style={{ width: 'fit-content !important' }}>From</div>
              <input className="form-control" type="date" value={fromDate} onChange={handleFromDateChange} />
              <div className="filter-label" style={{ width: 'fit-content !important' }}>To</div>
              <input className="form-control" type="date" value={toDate} onChange={handleToDateChange} />
            </div>

            <div className="projects-table-filter-group location-group">
              <div className="filter-label">Location</div>
              <select className="form-control" value={locationFilter} onChange={handleLocationChange}>
                {locationOptions.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div className="projects-table-meta">
              <div className="entries-selector">
                <label>Show</label>
                <select className="form-control" value={pageSize} onChange={(e) => onPageSizeChange?.(Number(e.target.value))}>
                  {[10, 25, 50, 100].map((size) => (<option key={size} value={size}>{size} entries</option>))}
                </select>
              </div>

              <div><strong>{totalCount}</strong> projects found</div>

              {activeFilters.length > 0 && (
                <div className="filter-badge-list">
                  {activeFilters.map((filter, index) => (<span key={index} className="filter-badge">{filter}</span>))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="projects-table-wrap">
        {isMobile ? (
          <div className="projects-mobile-cards">
            {data.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>{loading ? 'Loading projects…' : emptyMessage}</div>
            ) : (
              data.map((project, index) => {
                const kindRaw = project.projectKind || project.kind || project.type || project.projectType || ''
                const kindClass = `type-${String(kindRaw || '').toLowerCase().replace(/\s+/g, '-')}`
                return (
                  <Card key={project.id || project.projectId || index} className="project-mobile-card">
                    <div className="project-mobile-header">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                        <span className={`type-bar ${kindClass}`} />
                        <div className="project-mobile-title">{project.projectName || project.name || project.title || '-'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select value={project.status?.toLowerCase() || 'pending'} onChange={(e) => handleStatusChange(project.id || project.projectId, e.target.value)} disabled={updatingStatus === (project.id || project.projectId)} className="status-dropdown-mobile">
                          {STATUS_OPTIONS.map((status) => (<option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>))}
                        </select>
                        <button className="btn btn-outline btn-sm" onClick={() => onEditProject?.(project)} style={{ padding: '4px 8px' }}>Edit</button>
                      </div>
                    </div>
                    <div className="project-mobile-details">
                      <div className="project-mobile-row"><FontAwesomeIcon icon={faCalendarAlt} /><span>{formatDate(project.startDate)} → {formatDate(project.endDate)}</span></div>
                      <div className="project-mobile-row"><FontAwesomeIcon icon={faMapMarkerAlt} /><span>{project.location || '-'}</span></div>
                      {project.clientName && (<div className="project-mobile-row"><span>Client: {project.clientName}</span></div>)}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        ) : (
          <Table columns={columns} rows={rows} emptyMessage={loading ? 'Loading projects…' : emptyMessage} />
        )}
      </div>

      {hasPagination && (
        <div className="projects-table-pagination">
          <div className="pagination-summary">Showing <strong>{firstRow}</strong> - <strong>{lastRow}</strong> of <strong>{totalCount}</strong></div>
          <div className="pagination-actions">
            <button className="btn btn-outline btn-sm" type="button" style={{ width: 'fit-content !important' }} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
            <div className="pagination-pages" style= {{width: 'fit-content !important'}}>
              {pageStart > 1 && (<button className="pagination-page-btn" type="button" onClick={() => onPageChange(1)}>1</button>)}
              {pageStart > 2 && <span className="pagination-ellipsis">…</span>}
              {pageNumbers.map((pageNumber) => (<button key={pageNumber} type="button" className={`pagination-page-btn${pageNumber === page ? ' active' : ''}`} onClick={() => onPageChange(pageNumber)}>{pageNumber}</button>))}
              {pageEnd < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
              {pageEnd < totalPages && (<button className="pagination-page-btn" type="button" onClick={() => onPageChange(totalPages)}>{totalPages}</button>)}
            </div>
            <button className="btn btn-outline btn-sm" type="button" style={{ width: 'fit-content !important' }} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
