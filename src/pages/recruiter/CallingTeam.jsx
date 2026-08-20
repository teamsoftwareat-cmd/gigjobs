import { useState, useEffect, useCallback } from 'react'
import { PageHeader, Card, CardHeader, DataTable, Tag, StatCard, Modal } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import * as XLSX from 'xlsx'
import AddEditCallerModal from './AddEditCallerModal'
import CallDetailsModal from './CallDetailsModal'
import CallerProjectsModal from './CallerProjectsModal'
import { useAlert } from '../../context/AlertContext'

export default function CallingTeam() {
  const [callers, setCallers] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [kpis, setKpis] = useState({ totalCallers: 0, active: 0, inactive: 0, callsToday: 0 })

  const [showAddModal, setShowAddModal] = useState(false)
  const [editCaller, setEditCaller] = useState(null)
  const [showCallsFor, setShowCallsFor] = useState(null)
  const [showProjectsModal, setShowProjectsModal] = useState(false)
  const [selectedCallerForProjects, setSelectedCallerForProjects] = useState(null)
  const [showRecipientsModal, setShowRecipientsModal] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientAadhaar, setRecipientAadhaar] = useState('')
  const [recipientMobile, setRecipientMobile] = useState('')
  const [recipientProjectId, setRecipientProjectId] = useState('')
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [recipientPage, setRecipientPage] = useState(1)
  const [recipientPageSize, setRecipientPageSize] = useState(10)
  const [recipientTotal, setRecipientTotal] = useState(0)
  const [recipients, setRecipients] = useState([])
  const [recipientFile, setRecipientFile] = useState(null)
  const [recipientSearchMode, setRecipientSearchMode] = useState('manual')
  const [fileUploadError, setFileUploadError] = useState('')
  const [projectOptions, setProjectOptions] = useState({ regular: [], written: [] })
  const [locationOptions, setLocationOptions] = useState({})
  const [districtOptions, setDistrictOptions] = useState({})
  const [centreOptions, setCentreOptions] = useState({})
  const [assignmentDrafts, setAssignmentDrafts] = useState({})
  const [reassignStatus, setReassignStatus] = useState({})
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [selectedRecipientForReassign, setSelectedRecipientForReassign] = useState(null)
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [callerView, setCallerView] = useState('assigned') // 'assigned' or 'unassigned'
  const { confirm } = useAlert()

  const fetchKpis = useCallback(async () => {
    try {
      const res = await recruiterAPI.getCallerKpis()
      const data = res.data?.data || {}
      setKpis({
        totalCallers: data.total || 0,
        active: data.active || 0,
        inactive: data.inactive || 0,
        callsToday: data.callsToday || 0
      })
    } catch (err) {
      setKpis({ totalCallers: 0, active: 0, inactive: 0, callsToday: 0 })
    }
  }, [])

  const fetchCallers = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      // Try to fetch from assigned/unassigned endpoints first
      // If they don't exist, fall back to general endpoint
      let res
      try {
        if (callerView === 'assigned') {
          res = await recruiterAPI.getAssignedCallers({ search: search || undefined, from: from || undefined, to: to || undefined, offset, limit: pageSize })
        } else {
          res = await recruiterAPI.getUnassignedCallers({ search: search || undefined, from: from || undefined, to: to || undefined, offset, limit: pageSize })
        }
      } catch (e) {
        console.error('Error fetching callers:', e)
        setCallers([])
        setTotal(0)
        setLoading(false)
        return
      }
      
      const data = res.data?.data || {}
      const items = data.items || data.callers || []
      setCallers(items)
      setTotal(data.total || data.meta?.total || items.length)
    } catch (err) {
      setCallers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, from, to, callerView, page, pageSize])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  useEffect(() => {
    fetchCallers()
  }, [fetchCallers])

  const normalizeHeader = (value) => String(value || '').trim().toLowerCase()

  const getRecipientId = (recipient) => String(recipient.id || recipient.recipient_id || recipient.candidate_id || recipient.registration_id || recipient.recipientId || recipient.candidateId || recipient.cid || recipient.recipientId || '')

  const getRecipientProjectLabel = (recipient) => recipient.project_name || recipient.project || recipient.projectName || recipient.project_name || '-'
  const getRecipientAssignmentLabel = (recipient) => {
    if (recipient.location) return recipient.location
    if (recipient.district && recipient.centre) return `${recipient.district} / ${recipient.centre}`
    if (recipient.location_name) return recipient.location_name
    return '-'
  }

  const getRegisteredText = (recipient) => {
    const registered = recipient.is_registered || recipient.registered || recipient.portal_registered || recipient.registration_status === 'registered' || recipient.portal_status === 'active' || false
    return registered ? 'Yes' : 'No'
  }

  const exportRecipientResults = () => {
    if (!recipients.length) return
    const exportData = recipients.map((recipient, index) => ({
      'S.No': index + 1,
      'Name': recipient.name || recipient.full_name || recipient.fullName || '-',
      'Phone': recipient.phone || recipient.mobile || recipient.mobile_number || '-',
      'Aadhaar': recipient.aadhaar || recipient.aadhaarNumber || recipient.aadhaar_number || '-',
      'Project': getRecipientProjectLabel(recipient),
      'Location': recipient.location || recipient.location_name || recipient.project_location || '-',
      'District': recipient.district || recipient.district_name || '-',
      'Centre': recipient.centre || recipient.centre_name || recipient.district_centre || '-',
      'Registered': getRegisteredText(recipient),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recipients')
    XLSX.writeFile(workbook, `recipient_check_results_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`)
  }

  const getOptionValue = (item) => {
    if (item == null) return ''
    if (typeof item === 'object') {
      return String(item.id || item.value || item.location_id || item.project_id || item.district_id || item.centre_id || item.name || item.label || '')
    }
    return String(item)
  }

  const getOptionLabel = (item) => {
    if (item == null) return ''
    if (typeof item === 'object') {
      return String(item.name || item.label || item.location || item.district || item.centre || item.project || item.project_name || item.projectName || item.location_name || item.district_name || item.centre_name || item.value || item.id || '')
    }
    return String(item)
  }

  const getRecipientProjectId = (recipient) => recipient.projectId || recipient.project_id || recipient.project || recipient.projectName || recipient.project_name || ''
  const getRecipientLocationId = (recipient) => recipient.locationId || recipient.location_id || recipient.location || ''
  const getRecipientDistrictId = (recipient) => recipient.districtId || recipient.district_id || recipient.district || ''
  const getRecipientCentreId = (recipient) => recipient.centreId || recipient.centre_id || recipient.centre || ''
  const getRecipientProjectType = (recipient) => {
    if (recipient.projectType) return recipient.projectType
    if (recipient.project_type) return recipient.project_type
    if (recipient.type) return recipient.type
    if (getRecipientDistrictId(recipient) || getRecipientCentreId(recipient)) return 'written'
    return 'regular'
  }

  const resetRecipientsModal = () => {
    setRecipientSearchMode('manual')
    setRecipientName('')
    setRecipientAadhaar('')
    setRecipientMobile('')
    setRecipientProjectId('')
    setRecipientPage(1)
    setRecipientPageSize(10)
    setRecipientTotal(0)
    setRecipients([])
    setRecipientFile(null)
    setFileUploadError('')
    setAssignmentDrafts({})
    setReassignStatus({})
  }

  const closeRecipientsModal = () => {
    setShowRecipientsModal(false)
    resetRecipientsModal()
  }

  const openReassignModal = (recipient) => {
    setSelectedRecipientForReassign(recipient)
    // try to preselect the caller if `assigned_to` matches a caller name or id
    const assigned = recipient?.assigned_to
    let preselect = ''
    if (assigned) {
      const match = callers.find(c => String(c.name) === String(assigned) || String(c.id) === String(assigned) || String(c.calling_team_login_id) === String(assigned))
      if (match) preselect = String(match.id || match.calling_team_login_id || match.callerId)
    }
    setSelectedAssignee(preselect)
    setShowReassignModal(true)
  }

  const closeReassignModal = () => {
    setShowReassignModal(false)
    setSelectedRecipientForReassign(null)
    setSelectedAssignee('')
  }

  const fetchProjectOptions = useCallback(async () => {
    try {
      const [regularRes, writtenRes] = await Promise.all([
        recruiterAPI.getProjectSuggestions('', 200, 'regular'),
        recruiterAPI.getProjectSuggestions('', 200, 'written'),
      ])
      const regularData = regularRes.data?.data || regularRes.data || []
      const writtenData = writtenRes.data?.data || writtenRes.data || []
      setProjectOptions({
        regular: Array.isArray(regularData) ? regularData : [],
        written: Array.isArray(writtenData) ? writtenData : [],
      })
    } catch (err) {
      setProjectOptions({ regular: [], written: [] })
    }
  }, [])

  const loadProjectLocations = async (projectId) => {
    try {
      const res = await recruiterAPI.getProjectLocations(projectId)
      const data = res.data?.data || res.data || []
      const options = Array.isArray(data) ? data : []
      setLocationOptions((prev) => ({ ...prev, [projectId]: options }))
      return options
    } catch (err) {
      setLocationOptions((prev) => ({ ...prev, [projectId]: [] }))
      return []
    }
  }

  const loadProjectDistricts = async (projectId) => {
    try {
      const res = await recruiterAPI.getProjectDistricts(projectId)
      const data = res.data?.data || res.data || []
      const options = Array.isArray(data) ? data : []
      setDistrictOptions((prev) => ({ ...prev, [projectId]: options }))
      return options
    } catch (err) {
      setDistrictOptions((prev) => ({ ...prev, [projectId]: [] }))
      return []
    }
  }

  const loadDistrictCentres = async (projectId, district) => {
    if (!district) {
      setCentreOptions((prev) => ({ ...prev, [`${projectId}:${district}`]: [] }))
      return []
    }
    try {
      const res = await recruiterAPI.getDistrictCentres(projectId, district)
      const data = res.data?.data || res.data || []
      const options = Array.isArray(data) ? data : []
      setCentreOptions((prev) => ({ ...prev, [`${projectId}:${district}`]: options }))
      return options
    } catch (err) {
      setCentreOptions((prev) => ({ ...prev, [`${projectId}:${district}`]: [] }))
      return []
    }
  }

  const fetchRecipients = useCallback(async () => {
    const hasQuery = recipientName.trim() || recipientAadhaar.trim() || recipientMobile.trim()
    // Require project selection before searching
    if (!recipientProjectId) {
      setRecipients([])
      setRecipientTotal(0)
      return
    }

    if (!hasQuery) {
      setRecipients([])
      setRecipientTotal(0)
      return
    }

    setRecipientLoading(true)
    try {
      const params = {
        name: recipientName || undefined,
        aadhaar: recipientAadhaar || undefined,
        mobile: recipientMobile || undefined,
        projectid: recipientProjectId || undefined,
        offset: (recipientPage - 1) * recipientPageSize,
        limit: recipientPageSize,
      }
      const res = await recruiterAPI.searchRecipients(params)
      const data = res.data?.data || {}
      setRecipients(Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []))
      setRecipientTotal(data.total || data.meta?.total || (Array.isArray(data.items) ? data.items.length : 0))
    } catch (err) {
      setRecipients([])
      setRecipientTotal(0)
    } finally {
      setRecipientLoading(false)
    }
  }, [recipientName, recipientAadhaar, recipientMobile, recipientPage, recipientPageSize, recipientProjectId])

  useEffect(() => {
    if (showRecipientsModal) {
      fetchProjectOptions()
    }
  }, [showRecipientsModal, fetchProjectOptions])

  useEffect(() => {
    if (!showRecipientsModal || recipients.length === 0) return

    const loadAssignmentOptions = async () => {
      const handledProjects = new Set()
      for (const recipient of recipients) {
        const projectId = getRecipientProjectId(recipient)
        if (!projectId || handledProjects.has(projectId)) continue
        handledProjects.add(projectId)

        const projectType = getRecipientProjectType(recipient)
        if (projectType === 'written') {
          await loadProjectDistricts(projectId)
          const districtId = getRecipientDistrictId(recipient)
          if (districtId) {
            await loadDistrictCentres(projectId, districtId)
          }
        } else {
          await loadProjectLocations(projectId)
        }
      }
    }

    loadAssignmentOptions()
  }, [showRecipientsModal, recipients])



  const handleRecipientFileChange = async (event) => {
    const file = event.target.files?.[0]
    setRecipientSearchMode('file')
    setRecipientName('')
    setRecipientAadhaar('')
    setRecipientMobile('')
    setRecipients([])
    setRecipientTotal(0)
    setFileUploadError('')
    if (!file) return

    // Require a project to be selected before processing the uploaded file
    if (!recipientProjectId) {
      setFileUploadError('Please select a project before uploading a file.')
      return
    }

    setRecipientFile(file)
    setRecipientLoading(true)
    const allowedExtensions = ['xlsx', 'xls', 'csv']
    const extension = String(file.name).split('.').pop().toLowerCase()
    if (!allowedExtensions.includes(extension)) {
      setFileUploadError('Please upload a CSV or Excel file (.csv, .xlsx, .xls).')
      setRecipientLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectid', recipientProjectId)

    try {
      const res = await recruiterAPI.searchRecipientsByFile(formData)
      const data = res.data?.data || {}
      setRecipients(Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []))
      setRecipientTotal(data.total || data.meta?.total || (Array.isArray(data.items) ? data.items.length : 0))
    } catch (err) {
      console.error('File recipient search failed', err)
      setFileUploadError('Unable to search recipients from the uploaded file. Please try again.')
      setRecipients([])
      setRecipientTotal(0)
    } finally {
      setRecipientLoading(false)
    }
  }

  const getDraftForRecipient = (recipient) => {
    const id = getRecipientId(recipient)
    return assignmentDrafts[id] || {
      projectId: getRecipientProjectId(recipient),
      projectType: getRecipientProjectType(recipient),
      location: getRecipientLocationId(recipient),
      district: getRecipientDistrictId(recipient),
      centre: getRecipientCentreId(recipient),
    }
  }

  const updateDraft = (recipient, patch) => {
    const id = getRecipientId(recipient)
    setAssignmentDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || getDraftForRecipient(recipient)),
        ...patch,
      },
    }))
  }

  const handleProjectTypeChange = async (recipient, projectType) => {
    updateDraft(recipient, {
      projectType,
      projectId: '',
      location: '',
      district: '',
      centre: '',
    })
  }

  const handleProjectChange = async (recipient, projectId) => {
    const draft = getDraftForRecipient(recipient)
    const selectedProject = ((projectOptions[draft.projectType] || []) || projectOptions.regular || []).find((project) => String(project.id || project.project_id || project.value) === String(projectId))
    const projectType = draft.projectType || selectedProject?.projectType || selectedProject?.type || selectedProject?.project_type || 'regular'

    updateDraft(recipient, { projectId, projectType, location: '', district: '', centre: '' })

    if (projectType === 'written') {
      await loadProjectDistricts(projectId)
    } else {
      await loadProjectLocations(projectId)
    }
  }

  const handleLocationChange = (recipient, locationId) => {
    updateDraft(recipient, { location: locationId })
  }

  const handleDistrictChange = async (recipient, district) => {
    updateDraft(recipient, { district, centre: '' })
    const projectId = getDraftForRecipient(recipient).projectId
    if (projectId) {
      await loadDistrictCentres(projectId, district)
    }
  }

  const handleCentreChange = (recipient, centre) => {
    updateDraft(recipient, { centre })
  }

  const handleDownloadTemplate = () => {
    const headers = ['name', 'aadhaar', 'mobile', 'email']
    const sampleRows = [
      ['Ravi Kumar', '123412341234', '9876543210', 'ravi.kumar@example.com'],
      ['Sita Sharma', '234523452345', '9123456780', 'sita.sharma@example.com'],
    ]
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'recipient-search-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleReassign = async (recipient) => {
    const id = getRecipientId(recipient)
    const draft = assignmentDrafts[id] || getDraftForRecipient(recipient)
    const { projectId, projectType, location, district, centre } = draft

    if (!projectId) {
      setReassignStatus((prev) => ({ ...prev, [id]: { error: 'Please choose a project before saving.', saving: false } }))
      return
    }

    const payload = {
      candidate_id: recipient.candidate_id || id,
      id: recipient.id || recipient.recipient_id || undefined,
      project_id: projectId,
    }
    // Include basic recipient identifiers so backend can verify or create records
    payload.name = recipient.name || recipient.full_name || recipient.fullName || undefined
    payload.mobile = recipient.phone || recipient.mobile || recipient.mobile_number || undefined
    payload.aadhaar = recipient.aadhaar || recipient.aadhaarNumber || recipient.aadhaar_number || undefined

    if (projectType === 'written') {
      if (!district || !centre) {
        setReassignStatus((prev) => ({ ...prev, [id]: { error: 'Please choose district and centre for this project.', saving: false } }))
        return
      }
      payload.district_id = district
      payload.centre_id = centre
    } else {
      if (!location) {
        setReassignStatus((prev) => ({ ...prev, [id]: { error: 'Please choose a location before saving.', saving: false } }))
        return
      }
      payload.location_id = location
    }

    // If a caller was selected to assign to, include their id and name in the payload
    if (selectedAssignee) {
      const caller = callers.find(c => String(c.id || c.calling_team_login_id || c.callerId) === String(selectedAssignee))
      if (caller) {
        payload.callingTeamId = caller.calling_team_login_id || caller.id || caller.callerId
        // Override name in payload with the selected caller's name
        payload.name = caller.name || payload.name
      }
    }

    setReassignStatus((prev) => ({ ...prev, [id]: { saving: true, error: '' } }))
    try {
      await recruiterAPI.reassignRecipient(payload)
      setReassignStatus((prev) => ({ ...prev, [id]: { saving: false, saved: true, error: '' } }))
    } catch (err) {
      console.error('Reassign failed', err)
      setReassignStatus((prev) => ({ ...prev, [id]: { saving: false, saved: false, error: 'Unable to save assignment. Please try again.' } }))
    }
  }

  const manualSearchActive = recipientSearchMode === 'manual'
  const fileSearchActive = recipientSearchMode === 'file'

  const recipientRows = recipients

  const columns = ['ID', 'Name', 'Phone', 'Email', 'Projects', 'Assignments', 'Status', 'Actions']

  // Filter callers based on view (fallback in case server doesn't filter properly)
  // const filteredCallers = callers.filter(caller => {
  //   const hasProjectLocations = Array.isArray(caller.project_locations) && caller.project_locations.length > 0 && caller.project_locations.some(pl => pl.project && pl.location)
  //   const hasLegacyProjects = Array.isArray(caller.projects) ? caller.projects.length > 0 : (caller.projects ? String(caller.projects).split(',').filter(p => p.trim()).length > 0 : false)
  //   const hasLegacyLocations = Array.isArray(caller.location) ? caller.location.length > 0 : (caller.location ? String(caller.location).split(',').filter(l => l.trim()).length > 0 : false)
  
  //   const isAssigned = hasProjectLocations || (hasLegacyProjects && hasLegacyLocations)
  
  //   return callerView === 'assigned' ? isAssigned : !isAssigned
  // })

  const rows = callers.map((c) => {
    // Support new project_count/location_count fields or fall back to legacy array calculation
    const projectsArr = Array.isArray(c.project_locations) 
      ? c.project_locations.map(pl => pl.project).filter(Boolean) 
      : (Array.isArray(c.projects) ? c.projects.map(String) : [])
    const pCount = c.project_count ?? projectsArr.length

    const assignmentArr = Array.isArray(c.project_locations)
      ? c.project_locations
          .filter(pl => pl.project && ((pl.projectType === 'written' && pl.district && pl.centre) || (pl.projectType !== 'written' && pl.location)))
          .map(pl => pl.projectType === 'written'
            ? `${pl.project} / ${pl.district} - ${pl.centre}`
            : `${pl.project} / ${pl.location}`
          )
      : (Array.isArray(c.location) ? c.location.map(String).filter(Boolean) : (c.location ? [String(c.location)] : []))
    const assignmentCount = c.location_count ?? assignmentArr.length

    return [
      c.calling_team_login_id || c.id || c.callerId || '-',
      c.name || '-',
      c.phone || '-',
      c.email || '-',
      <span title={projectsArr.join(', ')}>{pCount > 0 ? `${pCount} project${pCount !== 1 ? 's' : ''}` : '-'}</span>,
      <span title={assignmentArr.join(', ')}>{assignmentCount > 0 ? `${assignmentCount} assignment${assignmentCount !== 1 ? 's' : ''}` : '-'}</span>,
      <Tag key={`s-${c.id}`} variant={c.status === 'active' ? 'green' : 'yellow'}>{c.status || 'inactive'}</Tag>,
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm" title="View calls" onClick={() => setShowCallsFor(c.registration_id || c.calling_team_login_id || c.id)} style={{padding: '4px 8px', fontSize: '11px'}}>Calls ({c.callCount ?? 0})</button>
        <button className="btn btn-outline btn-sm" title="Projects" onClick={() => { setSelectedCallerForProjects(c); setShowProjectsModal(true) }} style={{padding: '4px 8px', fontSize: '11px'}}>Projects</button>
        <button className="btn btn-outline btn-sm" title="Edit" onClick={() => { setEditCaller(c); setShowAddModal(true) }} style={{padding: '4px 8px', fontSize: '11px'}}>Edit</button>
      </div>
    ]
  })

  const lastPage = Math.max(1, Math.ceil((total || 0) / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(page * pageSize, total)

  const totalPages = lastPage
  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  useEffect(() => {
    // If total changes and current page is out of range, clamp it to the last page
    const lp = Math.max(1, Math.ceil((total || 0) / pageSize))
    if (page > lp) setPage(lp)
  }, [total, pageSize, page])

  return (
    <div>
      <PageHeader title="Calling Team" subtitle="Manage callers and call logs" action={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRecipientsModal(true)}>Check Recipients</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditCaller(null); setShowAddModal(true) }}>Add Caller</button>
        </div>
      } />

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card-wrapper">
          <StatCard icon="📞" value={kpis.totalCallers} label="Total Callers" />
        </div>
        <div className="stat-card-wrapper">
          <StatCard icon="🟢" value={kpis.active} label="Active" />
        </div>
        <div className="stat-card-wrapper">
          <StatCard icon="🔴" value={kpis.inactive} label="Inactive" />
        </div>
        <div className="stat-card-wrapper">
          <StatCard icon="📈" value={kpis.callsToday} label="Total Calls Today" />
        </div>
      </div>

      <Card>
        <CardHeader title="Callers" action={(
          <div className="callers-filters">
            <div className="callers-toggle">
              <button 
                className={`btn ${callerView === 'assigned' ? 'btn-primary' : 'btn-outline'} btn-sm assign-callers-btn`} 
                onClick={() => { setCallerView('assigned'); setPage(1) }}
              >
                Assigned Callers
              </button>
              <button 
                className={`btn ${callerView === 'unassigned' ? 'btn-primary' : 'btn-outline'} btn-sm`} 
                onClick={() => { setCallerView('unassigned'); setPage(1) }}
              >
                Unassigned Callers
              </button>
            </div>
            <div className="callers-search-group">
              <input className="form-control" placeholder="Search by name or phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
              <input type="date" className="form-control" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
              <input type="date" className="form-control" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
              <select className="form-control" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )} />

        <DataTable 
    columns={columns} 
    rows={rows} 
    emptyMessage={
        loading 
            ? `Loading ${callerView} callers…` 
            : `No ${callerView} callers found.`
    } 
/>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px' }}>
          <div style={{fontSize: '12px'}}>{total === 0 ? `Showing 0 of 0` : `Showing ${start} - ${end} of ${total}`}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="firstprev pagination-page-btn" type="button" disabled={page === 1} onClick={() => setPage(1)}>First</button>
            <button className="firstprev pagination-page-btn" type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>

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

            <button className="lastprev pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            <button className="lastprev pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last</button>
          </div>
        </div>
      </Card>

      <Modal isOpen={showRecipientsModal} onClose={closeRecipientsModal} title="Check Recipients" maxWidth="1200px">
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
              <button
                type="button"
                className={`btn btn-sm ${recipientSearchMode === 'manual' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setRecipientSearchMode('manual')
                  setRecipientFile(null)
                  setRecipientTotal(0)
                  setRecipients([])
                  setFileUploadError('')
                  setRecipientPage(1)
                }}
              >
                Manual search
              </button>
              <button
                type="button"
                className={`btn btn-sm ${recipientSearchMode === 'file' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setRecipientSearchMode('file')
                  setRecipientName('')
                  setRecipientAadhaar('')
                  setRecipientMobile('')
                  setRecipientTotal(0)
                  setRecipients([])
                  setFileUploadError('')
                  setRecipientPage(1)
                }}
              >
                File search
              </button>
            </div>

            {recipientSearchMode === 'manual' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#4b5563' }}>Select a project, then use name, Aadhaar or mobile to find one recipient.</div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Project</label>
                  <select
                    className="form-control"
                    value={recipientProjectId}
                    onChange={(e) => { setRecipientProjectId(e.target.value); setRecipientPage(1); setFileUploadError('') }}
                    style={{ height: 36 }}
                  >
                    <option value="">Select project</option>
                    {[...(projectOptions.regular || []), ...(projectOptions.written || [])].map((project) => {
                      const value = getOptionValue(project)
                      return <option key={value} value={value}>{getOptionLabel(project)}</option>
                    })}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>By Name</label>
                  <input
                    className="form-control"
                    placeholder="Enter name"
                    value={recipientName}
                    onChange={(e) => {
                      setRecipientSearchMode('manual')
                      setRecipientName(e.target.value)
                      setRecipientPage(1)
                      setRecipientFile(null)
                      setFileUploadError('')
                    }}
                    style={{ height: 36 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>By Aadhaar</label>
                  <input
                    className="form-control"
                    placeholder="Enter Aadhaar number"
                    value={recipientAadhaar}
                    onChange={(e) => {
                      setRecipientSearchMode('manual')
                      setRecipientAadhaar(e.target.value)
                      setRecipientPage(1)
                      setRecipientFile(null)
                      setFileUploadError('')
                    }}
                    style={{ height: 36 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>By Mobile</label>
                  <input
                    className="form-control"
                    placeholder="Enter mobile number"
                    value={recipientMobile}
                    onChange={(e) => {
                      setRecipientSearchMode('manual')
                      setRecipientMobile(e.target.value)
                      setRecipientPage(1)
                      setRecipientFile(null)
                      setFileUploadError('')
                    }}
                    style={{ height: 36 }}
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => { setRecipientPage(1); fetchRecipients() }}
                  disabled={(!recipientName.trim() && !recipientAadhaar.trim() && !recipientMobile.trim()) || !recipientProjectId}
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                >
                  Search
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#4b5563' }}>Select a project, then upload an Excel or CSV file with recipients.</div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Project</label>
                  <select
                    className="form-control"
                    value={recipientProjectId}
                    onChange={(e) => { setRecipientProjectId(e.target.value); setRecipientPage(1); setFileUploadError('') }}
                    style={{ height: 36 }}
                  >
                    <option value="">Select project</option>
                    {[...(projectOptions.regular || []), ...(projectOptions.written || [])].map((project) => {
                      const value = getOptionValue(project)
                      return <option key={value} value={value}>{getOptionLabel(project)}</option>
                    })}
                  </select>
                </div>
                <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 500 }}>Excel / CSV File</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleRecipientFileChange}
                    style={{ height: 36 }}
                    disabled={!recipientProjectId}
                  />
                  <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
                    {recipientFile ? (
                      <span style={{ color: '#059669', fontWeight: 500 }}>✓ {recipientFile.name}</span>
                    ) : (
                      <span>.csv, .xlsx, .xls formats supported</span>
                    )}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="btn btn-secondary btn-sm"
                    >
                      Download template
                    </button>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Headers should match the sample template.</span>
                  </div>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={resetRecipientsModal}
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div style={{ padding: 12, backgroundColor: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 12, lineHeight: 1.6, color: '#1e40af' }}>
            <strong>How to use:</strong> Use only one search method at a time. Search manually by name, Aadhaar, or mobile, or upload an Excel/CSV file to search recipients from a list. Then reassign them to different projects or locations.
          </div>

          {/* Error Message */}
          {fileUploadError && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: '#fee2e2', borderRadius: 6, border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12 }}>
              ⚠ {fileUploadError}
            </div>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          {recipientRows.length > 0 && !recipientLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-secondary btn-sm" type="button" onClick={exportRecipientResults}>
                Export Results
              </button>
            </div>
          )}

          {recipientLoading ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#555' }}>Loading recipients…</div>
          ) : recipientRows.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#666' }}>
              No recipients found. Enter a search term or upload a file to begin.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px', width: 40 }}>#</th>
                  <th style={{ padding: '10px 12px' }}>Name</th>
                  <th style={{ padding: '10px 12px' }}>Phone</th>
                  <th style={{ padding: '10px 12px' }}>Aadhaar</th>
                  <th style={{ padding: '10px 12px' }}>Project</th>
                  <th style={{ padding: '10px 12px' }}>Location</th>
                  <th style={{ padding: '10px 12px' }}>District</th>
                  <th style={{ padding: '10px 12px' }}>Centre</th>
                  <th style={{ padding: '10px 12px' }}>Registered</th>
                  <th style={{ padding: '10px 12px' }}>Assigned To</th>
                  <th style={{ padding: '10px 12px', width: 360 }}>Reassign</th>
                </tr>
              </thead>
              <tbody>
                {recipientRows.map((recipient, index) => {
                  const id = getRecipientId(recipient) || `preview-${index}`
                  const draft = getDraftForRecipient(recipient)
                  const projectId = draft.projectId
                  const projectType = draft.projectType || 'regular'
                  const locations = locationOptions[projectId] || []
                  const districts = districtOptions[projectId] || []
                  const centres = centreOptions[`${projectId}:${draft.district}`] || []
                  const rowSaved = reassignStatus[id]?.saved
                  return (
                    <tr key={id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{index + 1}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{recipient.name || recipient.full_name || '-'}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{recipient.phone || recipient.mobile || '-'}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top', fontFamily: 'monospace' }}>{recipient.aadhaar || recipient.aadhaarNumber || '-'}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{getRecipientProjectLabel(recipient)}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{recipient.location || recipient.location_name || recipient.project_location || '-'}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{recipient.district || recipient.district_name || '-'}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{recipient.centre || recipient.centre_name || recipient.district_centre || '-'}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{getRegisteredText(recipient)}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{recipient.assigned_to || '-'}</td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            onClick={() => openReassignModal(recipient)}
                          >
                            View
                          </button>
                          {rowSaved && <span style={{ fontSize: 12, color: '#16a34a' }}>Saved</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {recipientRows.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 13, color: '#555' }}>
              Showing {recipientRows.length} of {recipientTotal} recipients
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                disabled={recipientPage === 1}
                onClick={() => setRecipientPage(1)}
              >
                First
              </button>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                disabled={recipientPage === 1}
                onClick={() => setRecipientPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span style={{ alignSelf: 'center', color: '#555' }}>{recipientPage}</span>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                disabled={recipientPage * recipientPageSize >= recipientTotal}
                onClick={() => setRecipientPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn btn-outline btn-sm" onClick={closeRecipientsModal}>Close</button>
        </div>
      </Modal>

      <Modal
        isOpen={showReassignModal}
        onClose={closeReassignModal}
        title="Reassign recipient"
        maxWidth="700px"
      >
        {selectedRecipientForReassign ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#4b5563' }}>Recipient</div>
              <div style={{ fontWeight: 600 }}>{selectedRecipientForReassign.name || selectedRecipientForReassign.full_name || '-'}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedRecipientForReassign.phone || selectedRecipientForReassign.mobile || ''}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedRecipientForReassign.aadhaar || selectedRecipientForReassign.aadhaarNumber || ''}</div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Project type</label>
                <select
                  className="form-control"
                  value={assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectType || getRecipientProjectType(selectedRecipientForReassign)}
                  onChange={async (e) => {
                    await handleProjectTypeChange(selectedRecipientForReassign, e.target.value)
                  }}
                >
                  <option value="regular">Regular project</option>
                  <option value="written">Written exam project</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Assign to</label>
                <select
                  className="form-control"
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {callers.map((caller) => {
                    const value = getOptionValue(caller)
                    return <option key={value} value={value}>{getOptionLabel(caller)}</option>
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Project</label>
                <select
                  className="form-control"
                  value={assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectId || getRecipientProjectId(selectedRecipientForReassign)}
                  onChange={(e) => handleProjectChange(selectedRecipientForReassign, e.target.value)}
                >
                  <option value="">Select project</option>
                  {(projectOptions[assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectType || getRecipientProjectType(selectedRecipientForReassign)] || []).map((project) => {
                    const value = getOptionValue(project)
                    return (
                      <option key={value} value={value}>
                        {getOptionLabel(project)}
                      </option>
                    )
                  })}
                </select>
              </div>

              {(assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectId || getRecipientProjectId(selectedRecipientForReassign)) &&
                (assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectType || getRecipientProjectType(selectedRecipientForReassign)) !== 'written' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Location</label>
                  <select
                    className="form-control"
                    value={assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.location || getRecipientLocationId(selectedRecipientForReassign)}
                    onChange={(e) => handleLocationChange(selectedRecipientForReassign, e.target.value)}
                  >
                    <option value="">Select location</option>
                    {(locationOptions[assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectId || getRecipientProjectId(selectedRecipientForReassign)] || []).map((location) => {
                      const value = getOptionValue(location)
                      return <option key={value} value={value}>{getOptionLabel(location)}</option>
                    })}
                  </select>
                </div>
              )}

              {(assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectId || getRecipientProjectId(selectedRecipientForReassign)) &&
                (assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectType || getRecipientProjectType(selectedRecipientForReassign)) === 'written' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>District</label>
                    <select
                      className="form-control"
                      value={assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.district || getRecipientDistrictId(selectedRecipientForReassign)}
                      onChange={(e) => handleDistrictChange(selectedRecipientForReassign, e.target.value)}
                    >
                      <option value="">Select district</option>
                      {(districtOptions[assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectId || getRecipientProjectId(selectedRecipientForReassign)] || []).map((district) => {
                        const value = getOptionValue(district)
                        return <option key={value} value={value}>{getOptionLabel(district)}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Centre</label>
                    <select
                      className="form-control"
                      value={assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.centre || getRecipientCentreId(selectedRecipientForReassign)}
                      onChange={(e) => handleCentreChange(selectedRecipientForReassign, e.target.value)}
                      disabled={!assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.district && !getRecipientDistrictId(selectedRecipientForReassign)}
                    >
                      <option value="">Select centre</option>
                      {(centreOptions[`${assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.projectId || getRecipientProjectId(selectedRecipientForReassign)}:${assignmentDrafts[getRecipientId(selectedRecipientForReassign)]?.district || getRecipientDistrictId(selectedRecipientForReassign)}`] || []).map((centre) => {
                        const value = getOptionValue(centre)
                        return <option key={value} value={value}>{getOptionLabel(centre)}</option>
                      })}
                    </select>
                  </div>
                </>
              )}

              {reassignStatus[getRecipientId(selectedRecipientForReassign)]?.error && (
                <div style={{ color: '#b00020', fontSize: 12 }}>
                  {reassignStatus[getRecipientId(selectedRecipientForReassign)].error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button className="btn btn-outline btn-sm" type="button" onClick={closeReassignModal}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={reassignStatus[getRecipientId(selectedRecipientForReassign)]?.saving}
                  onClick={() => handleReassign(selectedRecipientForReassign)}
                >
                  {reassignStatus[getRecipientId(selectedRecipientForReassign)]?.saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <AddEditCallerModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} initialData={editCaller} onSaved={() => { fetchCallers(); fetchKpis() }} />
      <CallDetailsModal isOpen={!!showCallsFor} onClose={() => setShowCallsFor(null)} callerId={showCallsFor} />
      <CallerProjectsModal isOpen={showProjectsModal} onClose={() => setShowProjectsModal(false)} caller={selectedCallerForProjects} />
    </div>
  )
}
