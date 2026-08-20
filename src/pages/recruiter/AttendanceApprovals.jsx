import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faSyncAlt, 
  faCheck, 
  faTimes, 
  faChevronDown, 
  faChevronRight, 
  faSearch, 
  faChevronUp,
  faMapMarkerAlt,
  faHistory
} from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { LoadingOverlay, PageHeader, DataTable, Tag, Tabs, Card, StatCard } from '../../components/ui'
import './Payments.css'
import './AttendanceApprovals.css'

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

const normalizeRequestStatus = (status) => {
  if (!status) return 'Pending'
  const formatted = String(status).trim().toLowerCase()
  if (formatted === 'approved' || formatted === 'approve') return 'Approved'
  if (formatted === 'rejected' || formatted === 'reject') return 'Rejected'
  return 'Pending'
}

const getStatusVariant = (status) => {
  const normalized = normalizeRequestStatus(status).toLowerCase()
  if (normalized === 'approved') return 'green'
  if (normalized === 'rejected') return 'red'
  return 'yellow'
}

const normalizeProjectId = (value) => {
  const id = String(value ?? '').trim()
  return id.startsWith('proj_') ? id.slice(5) : id
}

export default function RecruiterAttendanceApprovals() {
  const { alert } = useAlert()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState([])
  const [projectSearch, setProjectSearch] = useState('')
  const [locationSearch, setLocationSearch] = useState('')
  const [districtSearch, setDistrictSearch] = useState('')
  const [centreSearch, setCentreSearch] = useState('')
  const [activeTab, setActiveTab] = useState('regular')
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [selectedCentre, setSelectedCentre] = useState(null)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false)
  const [centreDropdownOpen, setCentreDropdownOpen] = useState(false)
  const dropdownContainerRef = useRef(null)
  const [projectLocations, setProjectLocations] = useState([])
  const [projectDistricts, setProjectDistricts] = useState([])
  const [projectCentres, setProjectCentres] = useState([])
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [kpis, setKpis] = useState({
    pending: 0,
    approved: 0,
    rejected: 0
  })
  const [kpisLoading, setKpisLoading] = useState(false)
  const [projectPendingCounts, setProjectPendingCounts] = useState({})
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkActioning, setBulkActioning] = useState(false)

  const fetchProjectSuggestions = useCallback(async (query = '') => {
    setProjectsLoading(true)
    try {
      const params = { search: query, limit: 100 }
      const response = await recruiterAPI.getProjects(params)
      let items = []
      const responseData = response?.data
      if (Array.isArray(responseData)) items = responseData
      else if (Array.isArray(responseData?.data)) items = responseData.data
      else if (Array.isArray(responseData?.data?.items)) items = responseData.data.items
      else if (Array.isArray(responseData?.items)) items = responseData.items
      else if (Array.isArray(responseData?.records)) items = responseData.records
      setProjects(items)
    } catch (error) {
      console.error('Failed to load projects:', error)
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    const debounceTimer = setTimeout(() => fetchProjectSuggestions(projectSearch), 250)
    return () => clearTimeout(debounceTimer)
  }, [projectSearch, activeTab, fetchProjectSuggestions])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target)) {
        setProjectDropdownOpen(false)
        setLocationDropdownOpen(false)
        setDistrictDropdownOpen(false)
        setCentreDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const normalizeProjectType = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'written' || normalized === 'writtenexam' || normalized === 'written_exam') return 'written'
    return 'regular'
  }

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase()
    if (!Array.isArray(projects)) return []
    return projects.filter(p => {
      const nameMatch = (p.projectName || p.name || p.title || '').toLowerCase().includes(query)
      const pType = normalizeProjectType(p.projectKind || p.kind || p.type || p.projectType || p.project_type)
      const tabMatch = pType === activeTab
      return nameMatch && tabMatch
    })
  }, [projects, projectSearch, activeTab])

  const fetchLocationOptions = useCallback(async (projectId) => {
    projectId = normalizeProjectId(projectId)
    if (!projectId) return []
    try {
      const response = await recruiterAPI.getProjectLocations(projectId)
      return response.data?.data || response.data || []
    } catch (error) {
      return []
    }
  }, [])

  const fetchProjectDistricts = useCallback(async (projectId) => {
    projectId = normalizeProjectId(projectId)
    if (!projectId) return []
    try {
      const response = await recruiterAPI.getProjectDistricts(projectId)
      return response.data?.data || response.data || []
    } catch (error) {
      return []
    }
  }, [])

  const fetchCentreOptions = useCallback(async (projectId, districtId) => {
    projectId = normalizeProjectId(projectId)
    if (!projectId || !districtId) return []
    try {
      const response = await recruiterAPI.getDistrictCentres(projectId, districtId)
      return response.data?.data || response.data || []
    } catch (error) {
      return []
    }
  }, [])

  const selectedProjectId = normalizeProjectId(selectedProject?.id || selectedProject?.project_id || selectedProject?.projectId)

  const handleProjectSelect = async (project) => {
    const pId = normalizeProjectId(project.id || project.project_id || project.projectId)
    setSelectedProject(project)
    setSelectedLocation(null)
    setSelectedDistrict(null)
    setSelectedCentre(null)
    setProjectLocations([])
    setProjectDistricts([])
    setProjectCentres([])
    setLocationSearch('')
    setDistrictSearch('')
    setCentreSearch('')
    setOffset(0)
    setLocationDropdownOpen(false)
    setDistrictDropdownOpen(false)
    setCentreDropdownOpen(false)

    if (activeTab === 'written') {
      const districts = await fetchProjectDistricts(pId)
      setProjectDistricts(Array.isArray(districts) ? districts : [])
    } else {
      const locations = await fetchLocationOptions(pId)
      setProjectLocations(Array.isArray(locations) ? locations : [])
    }
  }

  const filteredLocations = useMemo(() => {
    const query = locationSearch.trim().toLowerCase()
    if (!query) return projectLocations
    return projectLocations.filter(loc => String(loc.name || loc.location || '').toLowerCase().includes(query))
  }, [projectLocations, locationSearch])

  const filteredDistricts = useMemo(() => {
    const query = districtSearch.trim().toLowerCase()
    if (!query) return projectDistricts
    return projectDistricts.map(dist => {
      const districtName = String(dist.name || dist.district || '').toLowerCase()
      const centres = Array.isArray(dist.centres)
        ? dist.centres.filter(c => String(c.name || c.centre || '').toLowerCase().includes(query))
        : []
      if (districtName.includes(query) || centres.length > 0) {
        return { ...dist, centres }
      }
      return null
    }).filter(Boolean)
  }, [projectDistricts, districtSearch])

  const filteredCentres = useMemo(() => {
    const query = centreSearch.trim().toLowerCase()
    if (!query) return projectCentres
    return projectCentres.filter(c => String(c.name || c.centre || '').toLowerCase().includes(query))
  }, [projectCentres, centreSearch])

  const handleDistrictSelect = async (district) => {
    const dId = district.id || district.districtId
    setSelectedDistrict(district)
    setSelectedCentre(null)
    setProjectCentres([])
    setCentreSearch('')
    setOffset(0)
    const centres = await fetchCentreOptions(selectedProjectId, dId)
    setProjectCentres(Array.isArray(centres) ? centres : [])
  }

  const fetchDashboardStats = useCallback(async () => {
    setKpisLoading(true)
    try {
      const response = await recruiterAPI.getAttendanceStats()
      const stats = response.data?.data || {}
      
      setKpis({
        pending: Number(stats.totals?.pending ?? 0),
        approved: Number(stats.totals?.approved ?? 0),
        rejected: Number(stats.totals?.rejected ?? 0),
      })

      const countsMap = (stats.project_breakdown || []).reduce((acc, item) => {
        const id = normalizeProjectId(item.project_id || item.projectId || item.id)
        acc[id] = Number(item.pending_count ?? 0)
        return acc
      }, {})
      setProjectPendingCounts(countsMap)
    } catch (error) {
      console.error('Failed to fetch attendance stats:', error)
      setKpis({ pending: 0, approved: 0, rejected: 0 })
    } finally {
      setKpisLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  const handleLocationSelect = (loc) => {
    setSelectedLocation(loc)
    setOffset(0)
  }

  const handleCentreSelect = (cen) => {
    setSelectedCentre(cen)
    setOffset(0)
  }

  const effectiveProjectType = activeTab

  const loadRequests = useCallback(async () => {
    const isComplete = activeTab === 'written' 
      ? (selectedProject && selectedDistrict && selectedCentre)
      : (selectedProject && selectedLocation)

    if (!isComplete) {
      setRequests([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const params = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        offset,
        limit,
        projectId: normalizeProjectId((selectedProject?.id || selectedProject?.project_id) || undefined) || undefined,
        projectType: effectiveProjectType || undefined,
        locationId: (selectedLocation?.id || selectedLocation?.location_id) || undefined,
        districtId: (selectedDistrict?.id || selectedDistrict?.districtId) || undefined,
        centreId: (selectedCentre?.id || selectedCentre?.centreId) || undefined,
      }
      const response = await recruiterAPI.getAttendanceChangeRequests(params)
      const payload = response.data?.data || response.data || []
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.records)
        ? payload.records
        : []
      setRequests(items)
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Unable to load attendance requests:', error)
      alert('error', 'Unable to load attendance approval requests. Please try again.')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [alert, search, statusFilter, offset, limit, selectedProject, selectedLocation, selectedDistrict, selectedCentre, effectiveProjectType, fromDate, toDate])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const toggleRowSelection = (requestId) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(requestId)) {
      newSet.delete(requestId)
    } else {
      newSet.add(requestId)
    }
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set())
    } else {
      const allIds = new Set(
        requests.map(req => req.id || req.requestId || req._id || req.request_id)
      )
      setSelectedIds(allIds)
    }
  }

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) {
      alert('warning', 'Please select at least one request.')
      return
    }

    setBulkActioning(true)
    try {
      const requestItems = requests
        .filter(req => {
          const id = req.id || req.requestId || req._id || req.request_id
          return selectedIds.has(id) && normalizeRequestStatus(req.status || req.state) === 'Pending'
        })
        .map(req => {
          const id = req.id || req.requestId || req._id || req.request_id
          const date = req.date || req.requestedDate || req.requested_date || req.requested_at || undefined
          const current = req.currentStatus || req.current || req.fromStatus || req.from_status || undefined
          const requested = req.requestedStatus || req.requested || req.toStatus || req.to_status || undefined
          return {
            requestId: id,
            date,
            fromStatus: current,
            toStatus: requested,
            candidateId: req.candidateId || req.candidate_id || req.userId || req.user_id || undefined,
          }
        })

      if (requestItems.length === 0) {
        alert('warning', 'No pending requests available for bulk action.')
        setBulkActioning(false)
        return
      }

      const payload = {
        action,
        requestIds: requestItems.map(item => item.requestId),
        requests: requestItems,
        projectType: effectiveProjectType || undefined,
        projectId: normalizeProjectId((selectedProject?.id || selectedProject?.project_id) || undefined) || undefined,
        locationId: (selectedLocation?.id || selectedLocation?.location_id) || undefined,
        districtId: (selectedDistrict?.id || selectedDistrict?.districtId) || undefined,
        centreId: (selectedCentre?.id || selectedCentre?.centreId) || undefined,
      }

      await recruiterAPI.bulkUpdateAttendanceChangeRequests(payload)

      alert('success', `Successfully ${action}d ${requestItems.length} request${requestItems.length > 1 ? 's' : ''}.`)
      setSelectedIds(new Set())
      fetchDashboardStats()
      await loadRequests()
    } catch (error) {
      console.error('Bulk action failed:', error)
      alert('error', 'Bulk action failed. Please try again.')
    } finally {
      setBulkActioning(false)
    }
  }

  const columns = activeTab === 'written'
    ? ['', 'Candidate', 'Candidate ID', 'Mobile', 'Aadhaar', 'Project', 'District', 'Centre', 'Date', 'Current Status', 'Requested Status', 'Status']
    : ['', 'Candidate', 'Candidate ID', 'Mobile', 'Aadhaar', 'Project', 'Location', 'Date', 'Current Status', 'Requested Status', 'Status']

  const rows = Array.isArray(requests) ? requests.map((request, index) => {
    const id = request.id || request.requestId || request._id || request.request_id || `req-${index}`
    const candidateName = request.candidateName || request.candidate || request.name || '—'
    const candidateId = request.candidateId || request.candidate_id || '—'
    const candidateMobile = request.mobile || request.candidateMobile || (request.candidate && (request.candidate.mobile || request.candidate.phone)) || '—'
    const candidateAadhaar = request.aadhaar || request.candidateAadhaar || (request.candidate && (request.candidate.aadhaar || request.candidate.aadhar)) || '—'
    const projectName = request.projectName || request.project || request.project_title || '—'
    const projectId = request.projectId || request.project_id || '—'
    const date = request.date || request.requestedDate || request.requested_date || '—'
    const current = request.currentStatus || request.current || request.fromStatus || '—'
    const requested = request.requestedStatus || request.requested || request.toStatus || '—'
    const status = normalizeRequestStatus(request.status || request.state)

    const row = [
      <input
        key={`checkbox-${id}`}
        type="checkbox"
        checked={selectedIds.has(id)}
        onChange={() => toggleRowSelection(id)}
        disabled={status !== 'Pending' || bulkActioning}
        style={{ cursor: status === 'Pending' ? 'pointer' : 'not-allowed', opacity: status === 'Pending' ? 1 : 0.5 }}
      />,
      candidateName,
      <span key={`cid-${id}`} style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text3)' }}>{candidateId}</span>,
      candidateMobile,
      candidateAadhaar !== '—' ? `XXXX-XXXX-${String(candidateAadhaar).slice(-4)}` : '—',
      projectName,
    ]

    if (activeTab === 'written') {
      row.push(
        request.district || request.districtName || '—',
        request.centre || request.centreName || '—',
      );
    } else {
      row.push(
        request.location || request.locationName || '—',
      );
    }

    row.push(
      date,
      current,
      requested,
      <Tag key={`status-${id}`} variant={getStatusVariant(status)}>{status}</Tag>
    );

    return row
  }) : []

  return (
    <div className="attendance-approvals-page">
      <LoadingOverlay active={loading} message="Loading attendance requests..." />
      <PageHeader
        title="Approve attendance"
        subtitle="Review recruiter attendance change requests and approve or reject them."
        action={
          <button type="button" className="btn btn-outline btn-sm" onClick={loadRequests} disabled={loading}>
            <FontAwesomeIcon icon={faSyncAlt} /> Refresh
          </button>
        }
      />

      <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard 
          label="Pending Requests" 
          value={kpisLoading ? '…' : kpis.pending} 
          icon={<FontAwesomeIcon icon={faSyncAlt} />} 
          iconStyle={{ background: 'var(--yellow-light)', color: 'var(--saffron)' }}
          change={kpis.pending > 0 ? "Requires review" : ""}
          changeType="down"
        />
        <StatCard 
          label="Approved" 
          value={kpisLoading ? '…' : kpis.approved} 
          icon={<FontAwesomeIcon icon={faCheck} />} 
          iconStyle={{ background: 'var(--green-light)', color: 'var(--green)' }}
        />
        <StatCard 
          label="Rejected" 
          value={kpisLoading ? '…' : kpis.rejected} 
          icon={<FontAwesomeIcon icon={faTimes} />} 
          iconStyle={{ background: 'var(--red-light)', color: 'var(--red)' }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <Tabs
          tabs={[
            { id: 'regular', label: 'Regular Projects' },
            { id: 'written', label: 'Written Exam Projects' }
          ]}
            activeTab={activeTab}
          onTabChange={(id) => {
            setActiveTab(id)
            setSelectedProject(null)
            setSelectedLocation(null)
            setSelectedDistrict(null)
            setSelectedCentre(null)
            setProjectLocations([])
            setProjectDistricts([])
            setProjectCentres([])
            setLocationSearch('')
            setDistrictSearch('')
            setCentreSearch('')
            setProjectDropdownOpen(false)
            setLocationDropdownOpen(false)
            setDistrictDropdownOpen(false)
            setCentreDropdownOpen(false)
            setRequests([])
            setOffset(0)
            setFromDate('')
            setToDate('')
            setSelectedIds(new Set())
          }}
        />
      </div>

      <div className="payments-content">
        <Card className="selection-card">
          <div className="card-header"><h3>Select Project & Location</h3></div>
          <div className="selection-dropdowns" ref={dropdownContainerRef}>
            <div className="select-group project-dropdown">
              <label>Project</label>
            <button
              type="button"
              className="dropdown-select"
              onClick={() => setProjectDropdownOpen((open) => !open)}
            >
              <span>{selectedProject ? (selectedProject.projectName || selectedProject.name || selectedProject.title || 'Selected project') : 'Search and select project'}</span>
              <FontAwesomeIcon icon={projectDropdownOpen ? faChevronUp : faChevronDown} />
            </button>

            {projectDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-search">
                  <FontAwesomeIcon icon={faSearch} />
                  <input
                    type="text"
                    className="dropdown-search-input"
                    placeholder="Search project..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                  />
                </div>
                <div className="dropdown-panel">
                  {projectsLoading ? (
                    <div className="dropdown-empty">Loading projects...</div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="dropdown-empty">No projects available</div>
                  ) : (
                    filteredProjects.map((project) => {
                      const pId = normalizeProjectId(project.id || project.project_id || project.projectId)
                      const isSelected = selectedProjectId === pId
                      return (
                        <button
                          key={pId}
                          type="button"
                          className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            handleProjectSelect(project)
                            setProjectDropdownOpen(false)
                          }}
                        >
                          <span>{project.projectName || project.name || project.title || '—'}</span>
                          {projectPendingCounts[pId] > 0 && (
                            <span className="badge-small" title={`${projectPendingCounts[pId]} pending requests`}>
                              {projectPendingCounts[pId]}
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedProject && activeTab === 'regular' && (
            <div className="select-group dropdown-group">
              <label>Location</label>
              <button
                type="button"
                className="dropdown-select"
                onClick={() => setLocationDropdownOpen((open) => !open)}
              >
                <span>{selectedLocation ? (selectedLocation.name || selectedLocation.location || 'Selected location') : 'Search and select location'}</span>
                <FontAwesomeIcon icon={locationDropdownOpen ? faChevronUp : faChevronDown} />
              </button>
              {locationDropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-search">
                    <FontAwesomeIcon icon={faSearch} />
                    <input
                      type="text"
                      className="dropdown-search-input"
                      placeholder="Search location..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                    />
                  </div>
                  <div className="dropdown-panel">
                    {projectLocations.length === 0 ? (
                      <div className="dropdown-empty">No locations available for this project</div>
                    ) : filteredLocations.length === 0 ? (
                      <div className="dropdown-empty">No matching locations</div>
                    ) : (
                      filteredLocations.map((loc) => {
                        const lId = loc.id || loc.location_id
                        const isSelected = (selectedLocation?.id || selectedLocation?.location_id) === lId
                        return (
                          <button
                            key={lId}
                            type="button"
                            className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              handleLocationSelect(loc)
                              setLocationDropdownOpen(false)
                            }}
                          >
                            <span>{loc.name || loc.location || '—'}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedProject && activeTab === 'written' && (
            <>
              <div className="select-group dropdown-group">
                <label>District</label>
                <button
                  type="button"
                  className="dropdown-select"
                  onClick={() => setDistrictDropdownOpen((open) => !open)}
                >
                  <span>{selectedDistrict ? (selectedDistrict.name || selectedDistrict.district || 'Selected district') : 'Search and select district'}</span>
                  <FontAwesomeIcon icon={districtDropdownOpen ? faChevronUp : faChevronDown} />
                </button>
                {districtDropdownOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-search">
                      <FontAwesomeIcon icon={faSearch} />
                      <input
                        type="text"
                        className="dropdown-search-input"
                        placeholder="Search district..."
                        value={districtSearch}
                        onChange={(e) => setDistrictSearch(e.target.value)}
                      />
                    </div>
                    <div className="dropdown-panel">
                      {projectDistricts.length === 0 ? (
                        <div className="dropdown-empty">No districts available for this project</div>
                      ) : filteredDistricts.length === 0 ? (
                        <div className="dropdown-empty">No matching districts</div>
                      ) : (
                        filteredDistricts.map((dist) => {
                          const dId = dist.id || dist.districtId
                          const isSelected = (selectedDistrict?.id || selectedDistrict?.districtId) === dId
                          return (
                            <button
                              key={dId}
                              type="button"
                              className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                handleDistrictSelect(dist)
                                setDistrictDropdownOpen(false)
                              }}
                            >
                              <span>{dist.name || dist.district || '—'}</span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedDistrict && (
                <div className="select-group dropdown-group">
                  <label>Centre</label>
                  <button
                    type="button"
                    className="dropdown-select"
                    onClick={() => setCentreDropdownOpen((open) => !open)}
                  >
                    <span>{selectedCentre ? (selectedCentre.name || selectedCentre.centre || 'Selected centre') : 'Search and select centre'}</span>
                    <FontAwesomeIcon icon={centreDropdownOpen ? faChevronUp : faChevronDown} />
                  </button>
                  {centreDropdownOpen && (
                    <div className="dropdown-menu">
                      <div className="dropdown-search">
                        <FontAwesomeIcon icon={faSearch} />
                        <input
                          type="text"
                          className="dropdown-search-input"
                          placeholder="Search centre..."
                          value={centreSearch}
                          onChange={(e) => setCentreSearch(e.target.value)}
                        />
                      </div>
                      <div className="dropdown-panel">
                        {projectCentres.length === 0 ? (
                          <div className="dropdown-empty">No centres available for this district</div>
                        ) : filteredCentres.length === 0 ? (
                          <div className="dropdown-empty">No matching centres</div>
                        ) : (
                          filteredCentres.map((cen) => {
                            const cId = cen.id || cen.centreId
                            const isSelected = (selectedCentre?.id || selectedCentre?.centreId) === cId
                            return (
                              <button
                                key={cId}
                                type="button"
                                className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                  handleCentreSelect(cen)
                                  setCentreDropdownOpen(false)
                                }}
                              >
                                <span>{cen.name || cen.centre || '—'}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          </div>
        </Card>

        {(selectedProject && (activeTab === 'written' ? selectedCentre : selectedLocation)) ? (
          <Card className="payments-card">
            <div className="card-header">
              <h3>Approval Queue <span className="location-badge">@ {activeTab === 'written' ? `${selectedDistrict?.name} - ${selectedCentre?.name}` : (selectedLocation?.name || selectedLocation?.location)}</span></h3>
              <div className="filter-controls">
                <div className="search-box">
                  <FontAwesomeIcon icon={faSearch} />
                  <input type="text" className="form-control" placeholder="Search candidate..." value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0) }} />
                </div>
                <div className="role-filter">
                  <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }}>
                    {STATUS_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="date-filters" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div className="date-input-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', whiteSpace: 'nowrap', color: 'var(--text2)' }}>From:</label>
                    <input type="date" className="form-control form-control-sm" style={{ padding: '4px 6px', fontSize: '11px' }} value={fromDate} onChange={(e) => { setFromDate(e.target.value); setOffset(0) }} />
                  </div>
                  <div className="date-input-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <label style={{ fontSize: '11px', whiteSpace: 'nowrap', color: 'var(--text2)' }}>To:</label>
                    <input type="date" className="form-control form-control-sm" style={{ padding: '4px 6px', fontSize: '11px' }} value={toDate} onChange={(e) => { setToDate(e.target.value); setOffset(0) }} />
                  </div>
                </div>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: 'var(--blue-light)', 
                borderBottom: '1px solid var(--border)', 
                display: 'flex', 
                gap: '8px', 
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ color: 'var(--text1)', fontSize: '14px', fontWeight: 500 }}>
                  {selectedIds.size} request{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={bulkActioning}
                    onClick={() => handleBulkAction('approve')}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Bulk Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={bulkActioning}
                    onClick={() => handleBulkAction('reject')}
                  >
                    <FontAwesomeIcon icon={faTimes} /> Bulk Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={bulkActioning}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={requests.length > 0 && selectedIds.size === requests.length}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < requests.length}
                  onChange={toggleSelectAll}
                  disabled={bulkActioning || requests.length === 0}
                  title="Select all on this page"
                  style={{ cursor: requests.length > 0 ? 'pointer' : 'not-allowed' }}
                />
                <label style={{ fontSize: '12px', margin: 0, cursor: requests.length > 0 ? 'pointer' : 'not-allowed', color: 'var(--text2)' }}>
                  Select All
                </label>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                Show
                <select className="form-control" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0) }}>
                  {[10, 25, 50].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                entries
              </label>
            </div>

            <DataTable 
              columns={columns} 
              rows={rows} 
              emptyMessage={loading ? 'Loading requests...' : 'No attendance requests found for this location.'}
            />
            
            <div className="pagination-footer">
              <div className="pagination-right">
                <button className="btn btn-outline btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Prev</button>
                <button className="btn btn-outline btn-sm" disabled={requests.length < limit} onClick={() => setOffset(offset + limit)}>Next</button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="empty-selection-card">
            <div className="empty-state-large"><h3>Select Context</h3><p>Choose a project and specific {activeTab === 'written' ? 'centre' : 'location'} to manage attendance approvals.</p></div>
          </Card>
        )}
      </div>
    </div>
  )
}
