import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { candidateAPI } from '../../api/axios'
import { PageHeader, Card, DataTable, Tag } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import '../../styles/pagination.css'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusVariant = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'present' || normalized === 'completed' || normalized === 'complete') return 'green'
  if (normalized === 'late' || normalized === 'exception' || normalized === 'ongoing' || normalized === 'active') return 'yellow'
  if (normalized === 'absent') return 'red'
  return 'gray'
}

const detectProjectType = (records) => {
  if (!Array.isArray(records) || records.length === 0) return 'unknown'
  
  // Check if we have BOTH types in the dataset
  let hasAnyLocation = false
  let hasAnyDistrict = false
  
  for (const record of records) {
    if (record.location_id || record.locationId) hasAnyLocation = true
    if (record.district_id || record.districtId) hasAnyDistrict = true
    if (hasAnyLocation && hasAnyDistrict) break
  }
  
  if (hasAnyLocation && hasAnyDistrict) return 'mixed'
  if (hasAnyLocation) return 'location'
  if (hasAnyDistrict) return 'written'
  return 'unknown'
}

const PaginationComponent = ({ currentPage, totalPages, onPageChange, loading }) => {
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 7
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 4) pages.push('...')
      
      const start = Math.max(2, currentPage - 2)
      const end = Math.min(totalPages - 1, currentPage + 2)
      for (let i = start; i <= end; i++) pages.push(i)
      
      if (currentPage < totalPages - 3) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="pagination-wrapper" style={{ marginTop: '20px' }}>
      <button
        className="pagination-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || loading}
      >
        Previous
      </button>
      
      <div className="pagination-numbers">
        {getPageNumbers().map((page, idx) => (
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
          ) : (
            <button
              key={page}
              className={`pagination-number ${currentPage === page ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
              disabled={loading}
            >
              {page}
            </button>
          )
        ))}
      </div>
      
      <button
        className="pagination-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || loading}
      >
        Next
      </button>
    </div>
  )
}

export default function CandidateAttendanceSummary() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const registrationId = user?.registrationId

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10
  
  // Data state
  const [items, setItems] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Filter state
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedCentre, setSelectedCentre] = useState('')
  const [search, setSearch] = useState('')

  const detectedProjectType = useMemo(() => detectProjectType(items), [items])

  // Get the type of selected project
  const selectedProjectType = useMemo(() => {
    if (!selectedProject) return null
    const projectItem = items.find(item => (item.project_id || item.projectId) === selectedProject)
    if (projectItem) {
      return projectItem.project_type || projectItem.projectType
    }
    return null
  }, [items, selectedProject])

  // Extract unique values for dropdowns
  const uniqueProjects = useMemo(() => {
    const projects = new Map()
    items.forEach((item) => {
      const projectId = item.project_id || item.projectId
      const projectName = item.project_name || item.projectName
      if (projectId && projectName) {
        projects.set(projectId, projectName)
      }
    })
    return Array.from(projects.entries()).map(([id, name]) => ({ id, name }))
  }, [items])

  const uniqueLocations = useMemo(() => {
    if (!selectedProject) return []
    const locations = new Map()
    items.forEach((item) => {
      if ((item.project_id || item.projectId) !== selectedProject) {
        return
      }
      const locationId = item.location_id || item.locationId
      const locationName = item.location_name || item.locationName
      if (locationId && locationName) {
        locations.set(locationId, locationName)
      }
    })
    return Array.from(locations.entries()).map(([id, name]) => ({ id, name }))
  }, [items, selectedProject])

  const uniqueDistricts = useMemo(() => {
    if (!selectedProject) return []
    const districts = new Map()
    items.forEach((item) => {
      if ((item.project_id || item.projectId) !== selectedProject) {
        return
      }
      const districtId = item.district_id || item.districtId
      const districtName = item.district_name || item.districtName
      if (districtId && districtName) {
        districts.set(districtId, districtName)
      }
    })
    return Array.from(districts.entries()).map(([id, name]) => ({ id, name }))
  }, [items, selectedProject])

  const uniqueCentres = useMemo(() => {
    if (!selectedProject || !selectedDistrict) return []
    const centres = new Map()
    items.forEach((item) => {
      const projectId = item.project_id || item.projectId
      const districtId = item.district_id || item.districtId
      if (projectId !== selectedProject || districtId !== selectedDistrict) {
        return
      }
      const centreId = item.centre_id || item.centreId
      const centreName = item.centre_name || item.centreName
      if (centreId && centreName) {
        centres.set(centreId, centreName)
      }
    })
    return Array.from(centres.entries()).map(([id, name]) => ({ id, name }))
  }, [items, selectedProject, selectedDistrict])

  // Fetch attendance with pagination
  const fetchAttendance = useCallback(async () => {
    if (!registrationId) return
    setLoading(true)
    try {
      const offset = (currentPage - 1) * PAGE_SIZE
      const response = await candidateAPI.getAttendanceProjectLocations(registrationId, {
        offset,
        limit: PAGE_SIZE,
      })
      
      const payload = response?.data?.data || response?.data || {}
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.records)
          ? payload.records
          : Array.isArray(payload)
            ? payload
            : []
      
      setItems(Array.isArray(rows) ? rows : [])
      setTotalRecords(payload?.total || payload?.count || rows.length || 0)
      setError(null)
    } catch (err) {
      console.warn('Unable to load candidate attendance summary:', err)
      setItems([])
      setTotalRecords(0)
      setError('Failed to load attendance history')
    } finally {
      setLoading(false)
    }
  }, [registrationId, currentPage])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    let filtered = items
    
    // Project filter
    if (selectedProject) {
      filtered = filtered.filter(item => 
        (item.project_id || item.projectId) === selectedProject
      )
    }
    
    // Location filter
    if (selectedLocation) {
      filtered = filtered.filter(item => 
        (item.location_id || item.locationId) === selectedLocation
      )
    }
    
    // District filter
    if (selectedDistrict) {
      filtered = filtered.filter(item => 
        (item.district_id || item.districtId) === selectedDistrict
      )
    }
    
    // Centre filter
    if (selectedCentre) {
      filtered = filtered.filter(item => 
        (item.centre_id || item.centreId) === selectedCentre
      )
    }
    
    // Search filter
    if (search.trim()) {
      const keyword = search.trim().toLowerCase()
      filtered = filtered.filter(item =>
        (item.project_name || item.projectName || '').toLowerCase().includes(keyword) ||
        (item.location_name || item.locationName || '').toLowerCase().includes(keyword) ||
        (item.district_name || item.districtName || '').toLowerCase().includes(keyword) ||
        (item.centre_name || item.centreName || '').toLowerCase().includes(keyword)
      )
    }
    
    return filtered
  }, [items, selectedProject, selectedLocation, selectedDistrict, selectedCentre, search])

  // Build table rows based on project type
  const { columns, rows } = useMemo(() => {
    const showLocation = detectedProjectType === 'location' || detectedProjectType === 'mixed'
    const showDistrict = detectedProjectType === 'written' || detectedProjectType === 'mixed'

    let cols = ['S.No', 'Project']
    if (showLocation) cols.push('Location')
    if (showDistrict) {
      cols.push('District')
      cols.push('Centre')
    }
    cols.push('Start Date', 'End Date', 'Days', 'Status', 'Actions')

    const tableRows = filteredItems.map((item, idx) => {
      const projectId = item.project_id || item.projectId
      const projectName = item.project_name || item.projectName || 'Unknown'
      const locationId = item.location_id || item.locationId
      const locationName = item.location_name || item.locationName
      const districtId = item.district_id || item.districtId
      const districtName = item.district_name || item.districtName
      const centreId = item.centre_id || item.centreId
      const centreName = item.centre_name || item.centreName
      const startDate = item.start_date || item.startDate || ''
      const endDate = item.end_date || item.endDate || ''
      const daysWorked = item.days_worked || item.days || 0
      const status = item.project_status || item.status || 'ongoing'

      let row = [idx + 1, projectName]
      
      if (showLocation) {
        row.push(locationName || '—')
      }
      
      if (showDistrict) {
        row.push(districtName || '—')
        row.push(centreName || '—')
      }
      
      row.push(
        formatDate(startDate),
        formatDate(endDate),
        daysWorked,
        <Tag key={`${projectId}-${locationId || districtId}`} variant={statusVariant(status)}>
          {status}
        </Tag>,
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            const navState = {
              projectId,
              projectName,
              projectType: locationId ? 'regular' : districtId ? 'written' : 'unknown',
            }
            if (locationId) {
              navState.locationId = locationId
              navState.locationName = locationName
            }
            if (districtId) {
              navState.districtId = districtId
              navState.districtName = districtName
              navState.centreId = centreId
              navState.centreName = centreName
            }
            navigate('/app/candidate/attendance/details', { state: navState })
          }}
        >
          View
        </button>
      )
      
      return row
    })

    return { columns: cols, rows: tableRows }
  }, [filteredItems, detectedProjectType, navigate])

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Browse the projects and locations you have worked on."
      />

      {/* Filters */}
      <Card style={{ marginBottom: 20, padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Project Filter */}
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Project
            </label>
            <select
              className="form-control"
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value)
                setSelectedLocation('')
                setSelectedDistrict('')
                setSelectedCentre('')
                setCurrentPage(1)
              }}
            >
              <option value="">All Projects</option>
              {uniqueProjects.map(proj => (
                <option key={proj.id} value={proj.id}>{proj.name}</option>
              ))}
            </select>
          </div>

          {/* Location Filter - Show for regular projects */}
          {(!selectedProjectType || selectedProjectType === 'regular') && (
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', minWidth: '150px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>
                Location
              </label>
              <select
                className="form-control"
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="">All Locations</option>
                {uniqueLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* District Filter - Show for written projects */}
          {(!selectedProjectType || selectedProjectType === 'written') && (
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', minWidth: '150px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>
                District
              </label>
              <select
                className="form-control"
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value)
                  setSelectedCentre('')
                  setCurrentPage(1)
                }}
              >
                <option value="">All Districts</option>
                {uniqueDistricts.map(dist => (
                  <option key={dist.id} value={dist.id}>{dist.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Centre Filter - Show for written projects */}
          {(!selectedProjectType || selectedProjectType === 'written') && (
            <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', minWidth: '150px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>
                Centre
              </label>
              <select
                className="form-control"
                value={selectedCentre}
                onChange={(e) => {
                  setSelectedCentre(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="">All Centres</option>
                {uniqueCentres.map(centre => (
                  <option key={centre.id} value={centre.id}>{centre.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search */}
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Search
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card>
        <div className="projects-table-wrap">
          <DataTable
            columns={columns}
            rows={rows}
            emptyMessage={
              loading
                ? 'Loading attendance data...'
                : error
                  ? error
                  : `No attendance records found. Showing ${filteredItems.length} of ${totalRecords} records.`
            }
          />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <PaginationComponent
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            loading={loading}
          />
        )}
      </Card>
    </div>
  )
}
