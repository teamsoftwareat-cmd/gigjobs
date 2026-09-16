import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faCalendarAlt, faUsers, faProjectDiagram, faClock, faMapMarkerAlt, faFileCsv } from '@fortawesome/free-solid-svg-icons'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { PageHeader, Card, DataTable, StatCard, Modal, Tag, Tabs } from '../../components/ui'
import { MapModal } from '../../components/ui/MapModal'
import { ImageModal } from '../../components/ui/ImageModal'
import './AttendanceData.css'
import './AttendanceSummaryModal.css'
import './AttendanceSummary.css'

const LIMIT_OPTIONS = [10, 20, 50]
const NO_IMAGE_PLACEHOLDER = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'

const attendanceTabs = [
  { id: 'regular', label: 'Regular Projects' },
  { id: 'written', label: 'Written Exam Projects' }
]

const searchModalTabs = [
  { id: 'attendance', label: 'Search attendance' },
  { id: 'aadhaar', label: 'Search candidate aadhaar' }
]

export default function RecruiterAttendanceSummary() {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState(10)
  const [offset, setOffset] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [kpis, setKpis] = useState({ totalProjects: 0, totalResources: 0, totalMandays: 0, totalLocations: 0 })
  const [activeTab, setActiveTab] = useState('regular')
  const [isOutsideModalOpen, setIsOutsideModalOpen] = useState(false)
  const [outsideCandidates, setOutsideCandidates] = useState([])
  const [outsideSearch, setOutsideSearch] = useState('')
  const [debouncedOutsideSearch, setDebouncedOutsideSearch] = useState('')
  const [outsideFromDate, setOutsideFromDate] = useState('')
  const [outsideToDate, setOutsideToDate] = useState('')
  const [outsideLimit, setOutsideLimit] = useState(10)
  const [outsideOffset, setOutsideOffset] = useState(0)
  const [outsideTotal, setOutsideTotal] = useState(0)
  const [projectOptions, setProjectOptions] = useState([])
  const [isSearchAttendanceModalOpen, setIsSearchAttendanceModalOpen] = useState(false)
  const [searchAttendanceFile, setSearchAttendanceFile] = useState(null)
  const [searchAttendanceFileName, setSearchAttendanceFileName] = useState('')
  const [searchAttendanceDate, setSearchAttendanceDate] = useState('')
  const [searchAttendanceLoading, setSearchAttendanceLoading] = useState(false)
  const [searchAttendanceError, setSearchAttendanceError] = useState('')
  const [searchAttendanceResults, setSearchAttendanceResults] = useState([])
  const [searchAttendanceProjectId, setSearchAttendanceProjectId] = useState('')
  const [searchAttendanceProjectName, setSearchAttendanceProjectName] = useState('')
  const [searchAttendanceSearch, setSearchAttendanceSearch] = useState('')
  const [searchAttendanceExporting, setSearchAttendanceExporting] = useState(false)
  const [isAdvtNoModalOpen, setIsAdvtNoModalOpen] = useState(false)
  const [exportAdvtNo, setExportAdvtNo] = useState('')
  const [exportAdvtNoError, setExportAdvtNoError] = useState('')
  const [isSearchAttendanceResultsModalOpen, setIsSearchAttendanceResultsModalOpen] = useState(false)
  const [searchAttendanceTab, setSearchAttendanceTab] = useState('attendance')
  const [searchAadhaarFile, setSearchAadhaarFile] = useState(null)
  const [searchAadhaarFileName, setSearchAadhaarFileName] = useState('')
  const [searchAadhaarLoading, setSearchAadhaarLoading] = useState(false)
  const [searchAadhaarError, setSearchAadhaarError] = useState('')
  const { alert } = useAlert()
  const [locationOptionsByProject, setLocationOptionsByProject] = useState({})
  const [centreOptionsByLocation, setCentreOptionsByLocation] = useState({})
  const [assignments, setAssignments] = useState({})
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState('')
  const [projectStatusLoading, setProjectStatusLoading] = useState({})
  const [imagePreview, setImagePreview] = useState({ isOpen: false, src: '', alt: '', title: '' })
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [mapMarkers, setMapMarkers] = useState([])
  const [mapTitle, setMapTitle] = useState('')
  const navigate = useNavigate()

  const deriveActiveStatus = (value) => {
    if (value === undefined || value === null) return true
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1 || value === 2
    const normalized = String(value).trim().toLowerCase()
    if (['active', 'open', 'true', '1', 'enabled', 'ongoing', 'started', 'running'].includes(normalized)) return true
    if (['inactive', 'closed', 'false', '0', 'disabled', 'ended', 'completed', 'finished'].includes(normalized)) return false
    return true
  }

  const getProjectStatusValue = (row) => row.status ?? row.project_status ?? row.statusName ?? row.projectStatus ?? row.active ?? row.isActive

  const handleToggleProjectStatus = async (group) => {
    const projectKey = group.id ?? group.projectId ?? group.project_id ?? group.project
    if (!projectKey) return

    const currentlyActive = deriveActiveStatus(group.status)
    const nextStatus = currentlyActive ? 'inactive' : 'active'
    setProjectStatusLoading((prev) => ({ ...prev, [projectKey]: true }))

    try {
      await recruiterAPI.setProjectAttendanceStatus(projectKey, nextStatus)
      alert(`Project has been ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`)
      setAttendance((prev) => prev.map((row) => {
        const rowKey = row.id ?? row.projectId ?? row.project_id ?? row.project
        if (!rowKey || String(rowKey) !== String(projectKey)) return row
        return {
          ...row,
          status: nextStatus,
          project_status: nextStatus,
          active: nextStatus === 'active',
          isActive: nextStatus === 'active',
        }
      }))
    } catch (error) {
      console.error('Project status update failed:', error)
      alert(`Failed to ${nextStatus === 'active' ? 'activate' : 'deactivate'} project.`)
    } finally {
      setProjectStatusLoading((prev) => ({ ...prev, [projectKey]: false }))
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOutsideSearch(outsideSearch)
      setOutsideOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [outsideSearch])

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    try {
      // Request attendance records using the current entry limit and offset
      const params = {
        search: search || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit,
        offset,
      }
      const response = activeTab === 'written' 
        ? await recruiterAPI.getWrittenExamMandateRecords(params)
        : await recruiterAPI.getMandateRecords(params)
      const payload = response?.data || {}
      const dataValue = payload?.data
      const rows = Array.isArray(dataValue)
        ? dataValue
        : Array.isArray(payload?.records)
          ? payload.records
          : Array.isArray(dataValue?.records)
            ? dataValue.records
            : []
      setAttendance(Array.isArray(rows) ? rows : [])

      const count = payload?.total ?? payload?.count ?? payload?.total_count ?? payload?.meta?.total ?? payload?.meta?.count ?? 0
      setTotalRows(typeof count === 'number' ? count : Number(count) || 0)

      const statsSource = dataValue && !Array.isArray(dataValue) ? dataValue : payload?.meta || payload
      setKpis({
        totalProjects: Number(statsSource.totalProjects ?? statsSource.activeProjects ?? statsSource.projects ?? statsSource.total_projects ?? 0),
        totalResources: Number(statsSource.totalResources ?? statsSource.resources ?? statsSource.totalResourcesCount ?? statsSource.total_resources ?? 0),
        totalMandays: Number(statsSource.totalMandays ?? statsSource.mandays ?? statsSource.totalMandaysWorked ?? statsSource.total_mandays ?? 0),
        totalLocations: Number(statsSource.totalLocations ?? statsSource.locations ?? statsSource.totalLocationsCount ?? statsSource.total_locations ?? 0),
      })
    } catch (error) {
      console.warn('Unable to load attendance records:', error)
      setAttendance([])
      setTotalRows(0)
      setKpis({ totalProjects: 0, totalResources: 0, totalMandays: 0, totalLocations: 0 })
    } finally {
      setLoading(false)
    }
  }, [search, fromDate, toDate, offset, limit, activeTab])

  useEffect(() => {
    const debounce = setTimeout(fetchAttendance, 300)
    return () => clearTimeout(debounce)
  }, [fetchAttendance])

  const summaryGroups = useMemo(() => {
    if (!attendance.length) return []

    const sample = attendance[0]
    const hasProject = ('project' in sample || 'project_name' in sample)
    const hasLocationOrDistrict = activeTab === 'written'
      ? ('district' in sample || 'district_name' in sample || 'location' in sample || 'location_name' in sample)
      : ('location' in sample || 'location_name' in sample)
    const isSummaryRow = Boolean(
      ('mandaysWorked' in sample || 'resources' in sample) &&
      hasProject &&
      hasLocationOrDistrict
    )

    if (isSummaryRow) {
      return attendance.map((row) => ({
        id: row.id,
        projectId: row.id ?? row.projectId ?? row.project_id ?? row.project,
        project: row.project || row.project_name || 'Unknown',
        status: getProjectStatusValue(row),
        projectKind: row.projectKind || row.project_kind || row.kind || row.type || row.projectType,
        clientName: row.clientName || row.client_name || row.client,
        district: activeTab === 'written' ? (row.district || row.district_name || row.location || row.location_name || 'Unknown') : undefined,
        location: activeTab !== 'written' ? (row.location || row.location_name || 'Unknown') : undefined,
        centre: activeTab === 'written' ? (row.centre || row.centre_name || 'Unknown') : undefined,
        locations: Number(row.locations ?? row.locationCount ?? row.location_count ?? 0),
        startDate: row.startDate || row.start_date || row.date || '',
        endDate: row.endDate || row.end_date || row.date || '',
        resources: Number(row.resources ?? row.resourceCount ?? row.resource_count ?? 0),
        mandaysWorked: Number(row.mandaysworked ?? row.mandays ?? row.hours ?? row.duration ?? 0),
      }))
    }

    const groupsMap = attendance.reduce((groups, record) => {
      const project = record.project_name || record.project || 'Unknown'
      const district = activeTab === 'written'
        ? (record.district_name || record.district || record.location_name || record.location || 'Unknown')
        : undefined
      const location = activeTab === 'written'
        ? undefined
        : (record.location_name || record.location || 'Unknown')
      const centre = activeTab === 'written' ? (record.centre_name || record.centre || 'Unknown') : undefined
      const date = record.date || ''
      const candidate = record.candidate_name || record.worker_name || record.worker
      const mandays = Number(record.hours ?? record.duration ?? 0) || 0
      const key = activeTab === 'written' ? `${project}||${district}||${centre}` : `${project}||${location}`

      if (!groups[key]) {
        groups[key] = {
          projectId: record.id ?? record.projectId ?? record.project_id ?? record.project,
          project,
          status: getProjectStatusValue(record),
          projectKind: record.projectKind || record.project_kind || record.kind || record.type || record.projectType,
          clientName: record.clientName || record.client_name || record.client,
          district,
          location,
          centre: activeTab === 'written' ? centre : undefined,
          locations: new Set(location ? [location] : []),
          startDate: date,
          endDate: date,
          resources: new Set(),
          mandaysWorked: 0,
        }
      }

      const group = groups[key]
      if (date) {
        if (!group.startDate || date < group.startDate) group.startDate = date
        if (!group.endDate || date > group.endDate) group.endDate = date
      }
      if (candidate) group.resources.add(candidate)
      if (location) group.locations.add(location)
      group.mandaysWorked += mandays

      return groups
    }, {})

    return Object.values(groupsMap)
  }, [attendance])

  // Pagination logic for summary rows
  const total = totalRows
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1
  const paginatedGroups = summaryGroups

  const pageNumbers = []
  const pageStart = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  const clearAllFilters = () => {
    setSearch('')
    setFromDate('')
    setToDate('')
    setOffset(0)
  }

  const normalizeOptionList = (rawList) => {
    if (!Array.isArray(rawList)) return []
    return rawList
      .map((item) => {
        if (!item) return null
        if (typeof item === 'object') {
          const id = String(item.id ?? item.project_id ?? item.value ?? item.key ?? item._id ?? item.projectId ?? item.locationId ?? '')
          const name = String(item.name ?? item.project_name ?? item.title ?? item.label ?? item.value ?? id)
          return id ? { id, name } : null
        }
        const value = String(item || '')
        return value ? { id: value, name: value } : null
      })
      .filter(Boolean)
  }

  const loadProjectOptions = async () => {
    try {
      const response = await recruiterAPI.getProjectSuggestions('', 200)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.projects)
          ? payload.projects
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload)
              ? payload
              : []
      setProjectOptions(normalizeOptionList(rawList))
    } catch (error) {
      setProjectOptions([])
    }
  }

  // Simple project dropdown select
  function ProjectDropdown({ value, onSelect, placeholder = 'Select project' }) {
    return (
      <select
        className="form-control"
        value={value || ''}
        onChange={e => onSelect(e.target.value)}
        style={{ zIndex: 1002, position: 'relative', background: 'var(--card)' }}
      >
        <option value="">{placeholder}</option>
        {projectOptions.map(opt => (
          <option key={opt.id} value={opt.id} style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {opt.name}
          </option>
        ))}
      </select>
    )
  }

  const loadProjectLocations = async (projectKey) => {
    if (!projectKey) return []
    if (locationOptionsByProject[projectKey]) return locationOptionsByProject[projectKey]

    try {
      const response = await recruiterAPI.getProjectLocations(projectKey)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.locations)
          ? payload.locations
          : Array.isArray(payload?.location_options)
            ? payload.location_options
            : Array.isArray(payload?.locationOptions)
              ? payload.locationOptions
              : Array.isArray(payload)
                ? payload
                : []
      const locations = normalizeOptionList(rawList)
      setLocationOptionsByProject((current) => ({ ...current, [projectKey]: locations }))
      return locations
    } catch (error) {
      setCentreOptionsByLocation((current) => ({ ...current, [cacheKey]: [] }))
      return []
    }
  }

  const loadLocationCentres = async (projectKey, locationKey) => {
    if (!projectKey || !locationKey) return []
    const cacheKey = `${projectKey}:${locationKey}`
    if (centreOptionsByLocation[cacheKey]) return centreOptionsByLocation[cacheKey]

    try {
      const response = await recruiterAPI.getLocationCentres(projectKey, locationKey)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.centres)
          ? payload.centres
          : Array.isArray(payload?.centre_options)
            ? payload.centre_options
            : Array.isArray(payload?.centreOptions)
              ? payload.centreOptions
              : Array.isArray(payload)
                ? payload
                : []
      const centres = normalizeOptionList(rawList)
      setCentreOptionsByLocation((current) => ({ ...current, [locationKey]: centres }))
      return centres
    } catch (error) {
      setCentreOptionsByLocation((current) => ({ ...current, [locationKey]: [] }))
      return []
    }
  }

  const openSearchAttendanceModal = () => {
    setSearchAttendanceTab('attendance')
    setSearchAttendanceFile(null)
    setSearchAttendanceFileName('')
    setSearchAttendanceDate('')
    setSearchAttendanceError('')
    setSearchAadhaarFile(null)
    setSearchAadhaarFileName('')
    setSearchAadhaarError('')
    setSearchAttendanceProjectId('')
    setSearchAttendanceProjectName('')
    setSearchAttendanceSearch('')
    setIsSearchAttendanceModalOpen(true)
  }

  const handleSearchAttendanceFileChange = (event) => {
    const file = event.target.files?.[0]
    setSearchAttendanceFile(file || null)
    setSearchAttendanceFileName(file?.name || '')
    if (file) setSearchAttendanceError('')
  }

  const handleSearchAadhaarFileChange = (event) => {
    const file = event.target.files?.[0]
    setSearchAadhaarFile(file || null)
    setSearchAadhaarFileName(file?.name || '')
    if (file) setSearchAadhaarError('')
  }

  const exportAadhaarSearchResultsToExcel = (rows, fileName) => {
    const normalizedRows = (Array.isArray(rows) ? rows : []).map((record) => {
      if (!record || typeof record !== 'object') {
        return { value: record }
      }
      return Object.entries(record).reduce((acc, [key, value]) => {
        acc[key] = value == null ? '' : value
        return acc
      }, {})
    })

    const worksheet = XLSX.utils.json_to_sheet(normalizedRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Aadhaar Search Results')
    XLSX.writeFile(workbook, fileName)
  }

  const handleSearchCandidateAadhaarUpload = async () => {
    if (!searchAadhaarFile) {
      setSearchAadhaarError('Please choose a CSV file to search candidate Aadhaar.')
      return
    }

    const formData = new FormData()
    formData.append('file', searchAadhaarFile)

    setSearchAadhaarLoading(true)
    setSearchAadhaarError('')

    try {
      const response = await recruiterAPI.searchCandidateAadhaarByCsv(formData, {
        projectId: searchAttendanceProjectId,
      })
      const payload = response?.data ?? {}
      const normalizedPayload = typeof payload === 'string'
        ? (() => { try { return JSON.parse(payload) } catch { return {} } })()
        : payload
      const rows = Array.isArray(normalizedPayload)
        ? normalizedPayload
        : Array.isArray(normalizedPayload?.data)
          ? normalizedPayload.data
          : Array.isArray(normalizedPayload?.records)
            ? normalizedPayload.records
            : Array.isArray(normalizedPayload?.results)
              ? normalizedPayload.results
              : []

      if (!rows.length) {
        alert('warning', 'No candidate Aadhaar results were returned from the upload.')
        return
      }

      exportAadhaarSearchResultsToExcel(rows, `candidate_aadhaar_search_${new Date().toISOString().split('T')[0]}.xlsx`)
      setIsSearchAttendanceModalOpen(false)
      alert('success', 'Candidate Aadhaar search completed and Excel file downloaded.')
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to search candidate Aadhaar from the uploaded CSV.'
      setSearchAadhaarError(message)
    } finally {
      setSearchAadhaarLoading(false)
    }
  }

  const handleSearchAttendanceUpload = async () => {
    if (!searchAttendanceFile) {
      setSearchAttendanceError('Please choose a CSV file to search attendance.')
      return
    }
    if (!searchAttendanceProjectId) {
      setSearchAttendanceError('Please select a project to search attendance.')
      return
    }

    const formData = new FormData()
    formData.append('file', searchAttendanceFile)
    formData.append('project_id', searchAttendanceProjectId)
    formData.append('projectType', activeTab === 'written' ? 'writtenExam' : 'regular')
    formData.append('date', searchAttendanceDate)

    setSearchAttendanceLoading(true)
    setSearchAttendanceError('')

    try {
      const response = await recruiterAPI.searchAttendanceByCsv(formData, {
        projectId: searchAttendanceProjectId,
        projectType: activeTab === 'written' ? 'writtenExam' : 'regular',
      })
      const payload = response?.data ?? {}
      const normalizedPayload = typeof payload === 'string' ? (() => { try { return JSON.parse(payload) } catch { return {} } })() : payload
      const rows = Array.isArray(normalizedPayload?.data)
        ? normalizedPayload.data
        : Array.isArray(normalizedPayload?.records)
          ? normalizedPayload.records
          : []
      const selectedProjectOption = projectOptions.find((option) => String(option.id) === String(searchAttendanceProjectId))

      setSearchAttendanceResults(rows)
      setSearchAttendanceProjectName(normalizedPayload?.project_name || normalizedPayload?.projectName || selectedProjectOption?.name || 'Uploaded attendance')
      setSearchAttendanceSearch('')
      setSearchAttendanceDate('')
      setIsSearchAttendanceModalOpen(false)
      setIsSearchAttendanceResultsModalOpen(true)
      alert('success', 'Attendance search results loaded successfully.')
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to search attendance from the uploaded CSV.'
      setSearchAttendanceError(message)
    } finally {
      setSearchAttendanceLoading(false)
    }
  }

  const downloadSearchAttendanceSample = () => {
    const headers = ['S.NO.', 'DISTRICT', 'CENTRE', 'DESIGNATION', 'NAME', 'CONTACTNO', 'AADHARNO']
    const rows = [
      ['1', 'PURNIA', '3601', 'Supervisor', 'Saurav Kr Jha', '7491010267', '398050438157'],
      ['2', 'PURNIA', '3601', 'Supervisor', 'Niranjan Kumar Thakur', '9608138005', '401333097386'],
      ['3', 'PURNIA', '3601', 'Operator', 'Niraj Kumar Paswan', '9572171590', '510825068732'],
      ['4', 'PURNIA', '3601', 'Operator', 'Abhishek Kumar Yadav', '7050172960', '783541090453'],
      ['5', 'PURNIA', '3601', 'Supervisor', 'Sachin Kumar Mishra', '9878451381', '289093347690'],
    ]
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, 'attendance_search_sample.csv')
  }

  const downloadSearchCandidateAadhaarSample = () => {
    const headers = ['name', 'number', 'tag']
    const rows = [
      ['shikha kri', '6206020031', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['amit kr', '7520185476', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['saddan hussain', '8540029236', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['md meraz alam', '9534779217', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['mujeet kr', '9234930676', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['aakash kr', '9523734490', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['sonu kr', '6207415692', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['Rekha Kumari', '9570143740', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
      ['Lalsa Kumari', '7673855850', '20-BPSSC-MAY-2026-PATNA-JUN-2026'],
    ]
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, 'candidate_aadhaar_search_sample.csv')
  }

  const loadImageAsDataUrl = async (url, maxWidth = 300, maxHeight = 200) => {
    if (!url) return null
    try {
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = url
      })

      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height)
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/png')
    } catch (error) {
      console.warn('Unable to load image for PDF export:', error)
      return null
    }
  }

  const exportSearchAttendanceResults = async (type = 'excel', customAdvtNo = '') => {
    const rowsToExport = searchAttendanceFilteredRecords.length ? searchAttendanceFilteredRecords : searchAttendanceResults
    if (!rowsToExport.length) {
      alert('error', 'No rows available to export for the current search.')
      return
    }

    setSearchAttendanceExporting(true)

    const loadingToast = document.createElement('div')
    loadingToast.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 8px;">Preparing export...</div>
      <div class="export-toast-message" style="font-size: 12px; line-height: 1.4;">Starting export...</div>
      <div class="export-progress-bar" style="margin-top: 12px; width: 100%; height: 8px; background: rgba(255,255,255,0.22); border-radius: 5px; overflow: hidden;">
        <div class="export-progress-fill" style="width: 0%; height: 100%; background: rgba(255,255,255,0.95);"></div>
      </div>
    `
    loadingToast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #0d6efd;
      color: white;
      padding: 14px 16px;
      border-radius: 10px;
      z-index: 9999;
      max-width: 360px;
      font-size: 13px;
      line-height: 1.4;
      box-shadow: 0 12px 32px rgba(0,0,0,0.14);
    `
    document.body.appendChild(loadingToast)

    const updateLoadingToast = (payload) => {
      if (!loadingToast || !document.body.contains(loadingToast)) return
      const messageNode = loadingToast.querySelector('.export-toast-message')
      const fillNode = loadingToast.querySelector('.export-progress-fill')
      if (!messageNode || !fillNode) return

      if (typeof payload === 'string') {
        messageNode.innerText = payload
        fillNode.style.width = '0%'
        return
      }

      const {
        title = 'Preparing export...',
        detail = '',
        loaded,
        total,
        progress = null,
      } = payload || {}

      messageNode.innerText = detail ? `${title} — ${detail}` : title
      const percent = typeof progress === 'number'
        ? Math.min(100, Math.max(0, Math.round(progress)))
        : (typeof loaded === 'number' && typeof total === 'number' ? Math.min(100, Math.max(0, Math.round((loaded / total) * 100))) : 0)
      fillNode.style.width = `${percent}%`
      if (percent >= 100) fillNode.style.width = '100%'
    }

    try {
      const sanitizeFilename = (value) => String(value || '').replace(/[\\/:*?"<>|]+/g, '_').trim()
      const exportDate = new Date().toISOString().split('T')[0]
      const advtNo = String(customAdvtNo || '').trim() || `${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`
      const uniqueDates = [...new Set(rowsToExport.map((record) => record?.date).filter(Boolean))]
      const firstDate = uniqueDates[0] || ''
      const lastDate = uniqueDates[uniqueDates.length - 1] || ''
      const dateRangeText = `${firstDate || 'Any'} – ${lastDate || 'Any'}`
      const projectTitle = searchAttendanceProjectName || 'Search attendance results'
      const projectLocationLabel = 'CSV Search'
      const projectCentreLabel = activeTab === 'written' ? 'CSV Search' : ''
      const getRecordCentreCode = (record = {}) => String(record?.centreCode || record?.centre_code || record?.centreId || record?.centre_id || record?.code || record?.id || '').trim()
      const getRecordDistrictKey = (record) => {
        const districtName = record?.district_name || record?.district || record?.districtName || 'Unknown district'
        const districtId = record?.district_id || record?.districtId || record?.district || districtName
        return `${districtId}||${districtName}`
      }
      const getRecordCentreKey = (record) => {
        const centreName = record?.centre_name || record?.centre || record?.centreName || record?.center || record?.center_name || record?.centerName || 'Unknown centre'
        const centreId = record?.centre_id || record?.centreId || record?.centre || centreName
        return `${centreId}||${centreName}`
      }
      const getRecordLocationKey = (record) => {
        const locationName = record?.location_name || record?.location || record?.locationName || 'Unknown location'
        const locationId = record?.location_id || record?.locationId || record?.location || locationName
        return `${locationId}||${locationName}`
      }
      const resolvedCentreCode = [...rowsToExport.map(getRecordCentreCode)].find(Boolean) || ''
      const buildExportFileName = (extension, label = 'results') => {
        const parts = ['search_attendance']
        if (resolvedCentreCode) parts.push(sanitizeFilename(resolvedCentreCode))
        parts.push(sanitizeFilename(searchAttendanceProjectName || label))
        return `${parts.join('_')}_${exportDate}.${extension}`
      }

      if (type === 'excel') {
        updateLoadingToast({ title: 'Preparing Excel export', detail: 'Building workbook...', progress: 15 })
        const normalizedRows = rowsToExport.map((record, index) => ({
          'S.No': index + 1,
          'Date': record?.date || '',
          'Candidate': record?.candidate_name || record?.name || record?.candidateName || '',
          'Aadhaar': formatAadhaar(record?.aadhar || record?.aadhaar || record?.aadhaarNo || ''),
          'Mobile': record?.mobile || record?.phone || record?.contact || '',
          ...(activeTab === 'written'
            ? {
                'District': record?.district || record?.district_name || record?.districtName || '',
                'Centre': record?.centre || record?.centre_name || record?.centreName || record?.center || record?.center_name || record?.centerName || '',
              }
            : {
                'Location': record?.location || record?.location_name || record?.locationName || '',
              }),
          'Clock In': record?.clock_in || record?.check_in || '',
          'Clock Out': record?.clock_out || record?.check_out || '',
          'Status': record?.status || '',
          'Project': record?.project_name || record?.projectName || searchAttendanceProjectName || '',
        }))

        const worksheet = XLSX.utils.json_to_sheet(normalizedRows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Attendance')
        updateLoadingToast({ title: 'Downloading Excel export', detail: 'Writing workbook...', progress: 85 })
        XLSX.writeFile(workbook, buildExportFileName('xlsx'))
        updateLoadingToast({ title: 'Export complete', detail: 'Excel export downloaded successfully.', progress: 100 })
        alert('success', 'Excel export downloaded successfully.')
        return
      }

      if (type === 'pdf') {
        const createPdfBlob = async (records, titleLabels = {}, headerOverrides = {}) => {
          const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
          const pageWidth = doc.internal.pageSize.getWidth()
          const pageHeight = doc.internal.pageSize.getHeight()
          const margin = 36
          const lineHeight = 12
          const fieldWidth = 160
          const firstColX = margin
          const secondColX = margin + 180
          const thirdColX = margin + 360
          const headerTitleY = 42
          const metaY = 18
          const labelTopY = 60
          const firstValueY = 74
          const resolvedProjectLocationLabel = headerOverrides.locationNameOverride || titleLabels.locationName || projectLocationLabel
          const resolvedProjectCentreLabel = headerOverrides.centreNameOverride || titleLabels.centreName || projectCentreLabel
          const resolvedPdfCentreCode = headerOverrides.centreCodeOverride || titleLabels.centreCodeOverride || titleLabels.centreCode || getRecordCentreCode(records[0] || {}) || resolvedCentreCode
          const centreCodeLine = resolvedPdfCentreCode ? `Centre Code: ${resolvedPdfCentreCode}` : ''
          const projectTitleLines = doc.splitTextToSize(projectTitle, fieldWidth)
          const dateDetailsLines = doc.splitTextToSize(`${dateRangeText}\nAdvt. No: ${advtNo}${centreCodeLine ? `\n${centreCodeLine}` : ''}`, fieldWidth)
          const projectVenueLines = doc.splitTextToSize([resolvedProjectLocationLabel, ...(resolvedProjectCentreLabel ? [resolvedProjectCentreLabel] : [])].join('\n'), fieldWidth)
          const firstRowValueHeight = Math.max(projectTitleLines.length, dateDetailsLines.length, projectVenueLines.length) * lineHeight
          const headerHeight = firstValueY + firstRowValueHeight + 10
          const firstPageStartY = headerHeight + 12
          const subsequentPageStartY = 46

          const drawTextLines = (lines, x, y) => {
            lines.forEach((line, index) => {
              doc.text(String(line || ''), x, y + index * lineHeight)
            })
          }

          const drawPageHeader = (pageNumber) => {
            doc.setFillColor(18, 97, 128)
            doc.rect(0, 0, pageWidth, pageNumber === 1 ? headerHeight : 42, 'F')
            doc.setTextColor(255, 255, 255)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(pageNumber === 1 ? 20 : 12)
            doc.text('Attendance Data Report', margin, pageNumber === 1 ? headerTitleY : 26)
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            if (pageNumber === 1) {
              doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin - 240, metaY)
              doc.text(`Records: ${records.length}`, pageWidth - margin - 240, metaY + 10)
              doc.setFontSize(9)
              doc.setTextColor(235, 235, 235)
              doc.text('Project', firstColX, labelTopY)
              doc.text('Date / Advt. / Centre Code', secondColX, labelTopY)
              doc.text('Venue', thirdColX, labelTopY)
              doc.setFont('helvetica', 'bold')
              doc.setTextColor(255, 255, 255)
              drawTextLines(projectTitleLines, firstColX, firstValueY)
              drawTextLines(dateDetailsLines, secondColX, firstValueY)
              drawTextLines(projectVenueLines, thirdColX, firstValueY)
            }
          }

          const buildRow = async (record, index) => {
            const checkInImage = record?.check_in_image || record?.checkin_image || record?.checkInImage || record?.check_in_photo || record?.check_in_img || ''
            let checkInImgData = null
            if (checkInImage) {
              try {
                checkInImgData = await loadImageAsDataUrl(checkInImage, 220, 120)
              } catch (error) {
                console.warn('Unable to build PDF row image:', error)
              }
            }

            return [
              index + 1,
              record?.date || '—',
              record?.candidate_name || record?.name || record?.candidateName || '—',
              formatAadhaar(record?.aadhar || record?.aadhaar || record?.aadhaarNo || '') || '—',
              record?.mobile || record?.phone || record?.contact || '—',
              record?.designation || record?.role || record?.designationName || record?.position || '—',
              ...(activeTab === 'written'
                ? [record?.district || record?.district_name || record?.districtName || '—']
                : [record?.location || record?.location_name || record?.locationName || '—']),
              record?.clock_in || record?.check_in || '—',
              record?.status || '—',
              checkInImgData || '—',
            ]
          }

          const buildRowsWithConcurrency = async (recordList, batchSize = 25) => {
            const rows = []
            for (let start = 0; start < recordList.length; start += batchSize) {
              const batch = recordList.slice(start, start + batchSize)
              const batchRows = await Promise.all(batch.map((item, idx) => buildRow(item, start + idx)))
              rows.push(...batchRows)
            }
            return rows
          }

          const columns = [
            'S.No',
            'Date',
            'Candidate',
            'Aadhaar',
            'Mobile',
            'Designation',
            ...(activeTab === 'written' ? ['District'] : ['Location']),
            'Clock In',
            'Status',
            'In Image',
          ]

          const rowData = await buildRowsWithConcurrency(records, 25)
          const designationOrder = { supervisor: 1, operator: 2 }
          rowData.sort((a, b) => {
            const da = String(a[5] || '').trim().toLowerCase()
            const db = String(b[5] || '').trim().toLowerCase()
            const oa = designationOrder[da] || 3
            const ob = designationOrder[db] || 3
            if (oa !== ob) return oa - ob
            return String(a[2] || '').localeCompare(String(b[2] || ''))
          })
          rowData.forEach((row, index) => {
            row[0] = index + 1
          })

          const tableWidth = Math.min(pageWidth - margin * 2, 30 + 52 + 130 + 70 + 70 + 80 + (activeTab === 'written' ? 90 : 120) + 60 + 50 + 80)
          const centeredMarginLeft = Math.max(margin, Math.round((pageWidth - tableWidth) / 2))

          const drawTable = (rowsToDraw, pageNumber) => {
            if (pageNumber > 1) {
              doc.addPage()
              drawPageHeader(pageNumber)
            }

            autoTable(doc, {
              head: [columns],
              body: rowsToDraw,
              startY: pageNumber === 1 ? firstPageStartY : subsequentPageStartY,
              margin: { top: pageNumber === 1 ? firstPageStartY : subsequentPageStartY, left: centeredMarginLeft, right: centeredMarginLeft },
              tableWidth,
              styles: {
                fontSize: 8,
                cellPadding: 5,
                overflow: 'linebreak',
                valign: 'middle',
                cellWidth: 'wrap',
                minCellHeight: 44,
                halign: 'left',
              },
              headStyles: {
                fillColor: [18, 97, 128],
                textColor: 255,
                fontStyle: 'bold',
              },
              alternateRowStyles: { fillColor: [247, 249, 251] },
              columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 52 },
                2: { cellWidth: 130 },
                3: { cellWidth: 70 },
                4: { cellWidth: 70 },
                5: { cellWidth: 80 },
                6: { cellWidth: activeTab === 'written' ? 90 : 120 },
                ...(activeTab === 'written'
                  ? {
                      7: { cellWidth: 60 },
                      8: { cellWidth: 50 },
                      9: { cellWidth: 80, minCellHeight: 50 },
                    }
                  : {
                      7: { cellWidth: 55 },
                      8: { cellWidth: 50 },
                      9: { cellWidth: 80, minCellHeight: 50 },
                    }),
              },
              theme: 'grid',
              showHead: 'everyPage',
              pageBreak: 'auto',
              rowPageBreak: 'avoid',
              didParseCell: (data) => {
                if (data.column.index === columns.length - 1 && data.cell.raw && String(data.cell.raw).startsWith('data:image')) {
                  data.cell.text = ['']
                }
              },
              didDrawCell: (data) => {
                if (data.column.index === columns.length - 1 && data.cell.raw && String(data.cell.raw).startsWith('data:image')) {
                  try {
                    doc.addImage(String(data.cell.raw), 'PNG', data.cell.x + 2, data.cell.y + 4, 66, 44)
                  } catch (error) {
                    doc.setFontSize(7)
                    doc.text('Image', data.cell.x + 10, data.cell.y + 24)
                  }
                }
              },
            })
          }

          drawPageHeader(1)
          const firstPageRows = rowData.slice(0, 7)
          const remainingRows = rowData.slice(7)
          if (firstPageRows.length) drawTable(firstPageRows, 1)

          let pageNumber = 2
          for (let i = 0; i < remainingRows.length; i += 8) {
            const chunk = remainingRows.slice(i, i + 8)
            if (chunk.length) drawTable(chunk, pageNumber)
            pageNumber += 1
          }

          const totalPages = doc.internal.getNumberOfPages()
          for (let i = 1; i <= totalPages; i += 1) {
            doc.setPage(i)
            doc.setFontSize(8)
            doc.setTextColor(100)
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 80, pageHeight - 18)
          }

          return doc.output('blob')
        }

        if (activeTab === 'written') {
          const districtGroups = rowsToExport.reduce((acc, record) => {
            const key = getRecordDistrictKey(record)
            if (!acc[key]) {
              const districtName = key.split('||')[1]
              acc[key] = { districtName, records: [] }
            }
            acc[key].records.push(record)
            return acc
          }, {})

          const centreGroups = Object.values(districtGroups).reduce((acc, districtGroup) => {
            const groups = districtGroup.records.reduce((centres, record) => {
              const key = getRecordCentreKey(record)
              if (!centres[key]) {
                const centreName = key.split('||')[1]
                const centreCode = getRecordCentreCode(record)
                centres[key] = { centreName, centreCode, records: [] }
              }
              centres[key].records.push(record)
              return centres
            }, {})
            Object.values(groups).forEach((centreGroup) => {
              acc.push({ districtName: districtGroup.districtName, centreName: centreGroup.centreName, centreCode: centreGroup.centreCode, records: centreGroup.records })
            })
            return acc
          }, [])

          if (centreGroups.length > 1) {
            updateLoadingToast({ title: 'Generating PDFs', detail: 'Preparing district archive...', progress: 25 })
            const zip = new JSZip()
            for (let i = 0; i < centreGroups.length; i += 1) {
              const group = centreGroups[i]
              const districtFolderName = sanitizeFilename(group.districtName || `district-${i + 1}`)
              const districtFolder = zip.folder(districtFolderName) || zip
              const centreLabel = group.centreName || `centre-${i + 1}`
              const codePrefix = group.centreCode ? `${sanitizeFilename(group.centreCode)}_` : ''
              const pdfBlob = await createPdfBlob(group.records, { districtName: group.districtName, centreName: centreLabel, centreCode: group.centreCode })
              const fileName = `${codePrefix}${sanitizeFilename(centreLabel)}_${exportDate}.pdf`
              districtFolder.file(fileName, pdfBlob)
            }
            updateLoadingToast({ title: 'Compressing ZIP', detail: 'Compressing PDF archive...', progress: 90 })
            const zipBlob = await zip.generateAsync({ type: 'blob' })
            saveAs(zipBlob, `${buildExportFileName('zip', 'results')}`)
            updateLoadingToast({ title: 'Export complete', detail: 'PDF archive downloaded successfully.', progress: 100 })
            alert('success', 'PDF export downloaded successfully.')
            return
          }

          const pdfBlob = await createPdfBlob(rowsToExport, {
            districtName: centreGroups[0]?.districtName || 'CSV Search',
            centreName: centreGroups[0]?.centreName || 'CSV Search',
            centreCode: centreGroups[0]?.centreCode || resolvedCentreCode,
          })
          const pdfFileName = buildExportFileName('pdf')
          saveAs(pdfBlob, pdfFileName)
          updateLoadingToast({ title: 'Export complete', detail: 'PDF export downloaded successfully.', progress: 100 })
          alert('success', 'PDF export downloaded successfully.')
          return
        }

        const locationGroups = rowsToExport.reduce((acc, record) => {
          const key = getRecordLocationKey(record)
          if (!acc[key]) {
            const locationName = key.split('||')[1]
            acc[key] = { locationName, records: [] }
          }
          acc[key].records.push(record)
          return acc
        }, {})

        const locationList = Object.values(locationGroups)
        if (locationList.length > 1) {
          updateLoadingToast({ title: 'Generating PDFs', detail: 'Preparing location archive...', progress: 25 })
          const zip = new JSZip()
          for (let i = 0; i < locationList.length; i += 1) {
            const group = locationList[i]
            const folderName = sanitizeFilename(group.locationName || `location-${i + 1}`)
            const folder = zip.folder(folderName) || zip
            const pdfBlob = await createPdfBlob(group.records, { locationName: group.locationName })
            const fileName = `${sanitizeFilename(group.locationName || `location-${i + 1}`)}_${exportDate}.pdf`
            folder.file(fileName, pdfBlob)
          }
          updateLoadingToast({ title: 'Compressing ZIP', detail: 'Compressing PDF archive...', progress: 90 })
          const zipBlob = await zip.generateAsync({ type: 'blob' })
          saveAs(zipBlob, `${buildExportFileName('zip', 'results')}`)
          updateLoadingToast({ title: 'Export complete', detail: 'PDF archive downloaded successfully.', progress: 100 })
          alert('success', 'PDF export downloaded successfully.')
          return
        }

        const pdfBlob = await createPdfBlob(rowsToExport, { locationName: locationList[0]?.locationName || 'CSV Search' })
        saveAs(pdfBlob, buildExportFileName('pdf'))
        updateLoadingToast({ title: 'Export complete', detail: 'PDF export downloaded successfully.', progress: 100 })
        alert('success', 'PDF export downloaded successfully.')
      }
    } catch (error) {
      console.error('Unable to export search attendance results:', error)
      alert('error', 'Unable to export the selected attendance data. Please try again.')
    } finally {
      setSearchAttendanceExporting(false)
      if (document.body.contains(loadingToast)) document.body.removeChild(loadingToast)
    }
  }

  const searchAttendanceFilteredRecords = useMemo(() => {
    const term = searchAttendanceSearch.trim().toLowerCase()
    return searchAttendanceResults.filter((record) => {
      if (!term) return true
      const haystack = [
        record?.candidate_name,
        record?.name,
        record?.candidateName,
        record?.mobile,
        record?.phone,
        record?.contact,
        record?.aadhar,
        record?.aadhaar,
        record?.district,
        record?.district_name,
        record?.centre,
        record?.centre_name,
        record?.status,
      ].join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [searchAttendanceResults, searchAttendanceSearch])

  const loadOutsideCandidates = useCallback(async () => {
    setIsModalLoading(true)
    setModalError('')

    try {
      const response = await recruiterAPI.getOutsideCandidates({
        search: debouncedOutsideSearch || undefined,
        from: outsideFromDate || undefined,
        to: outsideToDate || undefined,
        limit: outsideLimit,
        offset: outsideOffset,
      })
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.candidates)
          ? payload.candidates
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.results)
              ? payload.results
              : []
      const total = payload?.total ?? payload?.count ?? payload?.totalCount ?? payload?.meta?.total ?? payload?.meta?.count ?? rawList.length
      setOutsideCandidates(Array.isArray(rawList) ? rawList : [])
      setOutsideTotal(Number(total) || 0)
    } catch (error) {
      setOutsideCandidates([])
      setOutsideTotal(0)
      setModalError('Unable to load candidate list. Please try again.')
    } finally {
      setIsModalLoading(false)
    }
  }, [debouncedOutsideSearch, outsideFromDate, outsideToDate, outsideLimit, outsideOffset])

  useEffect(() => {
    if (!isOutsideModalOpen) return
    loadProjectOptions()
    const timer = setTimeout(loadOutsideCandidates, 300)
    return () => clearTimeout(timer)
  }, [activeTab, isOutsideModalOpen, loadOutsideCandidates])

  useEffect(() => {
    if (!isSearchAttendanceModalOpen) return
    loadProjectOptions()
  }, [activeTab, isSearchAttendanceModalOpen])

  const openImageModal = (src, title, alt) => {
    setImagePreview({ isOpen: true, src, title, alt })
  }
  const closeImageModal = () => setImagePreview({ isOpen: false, src: '', title: '', alt: '' })

  const openMapModal = (markers, title) => {
    setMapMarkers(markers || [])
    setMapTitle(title || '')
    setIsMapOpen(true)
  }
  const closeMapModal = () => {
    setMapMarkers([])
    setMapTitle('')
    setIsMapOpen(false)
  }

  const formatAadhaar = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
    return digits ? digits.replace(/(\d{4})(?=\d)/g, '$1-') : '—'
  }

  const statusVariant = (status) => {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'present') return 'green'
    if (normalized === 'late' || normalized === 'exception') return 'yellow'
    if (normalized === 'absent') return 'red'
    return 'gray'
  }

  const parseCoords = (val) => {
    if (!val) return null
    if (typeof val === 'object') {
      const lat = Number(val.lat ?? val.latitude ?? val.latitute ?? val.latLng?.lat ?? val.geo?.lat ?? val.location?.lat)
      const lng = Number(val.lng ?? val.longitude ?? val.long ?? val.lon ?? val.latLng?.lng ?? val.geo?.lng ?? val.location?.lng)
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng }
      if (Array.isArray(val.coordinates) && val.coordinates.length >= 2) {
        const maybeLng = Number(val.coordinates[0])
        const maybeLat = Number(val.coordinates[1])
        if (Number.isFinite(maybeLat) && Number.isFinite(maybeLng)) return { latitude: maybeLat, longitude: maybeLng }
      }
    }
    if (typeof val === 'string') {
      const parts = val.split(/[,\s]+/).map((p) => Number(p)).filter(Number.isFinite)
      if (parts.length >= 2) return { latitude: parts[0], longitude: parts[1] }
    }
    return null
  }

  const handleOpenOutsideModal = () => {
    setIsOutsideModalOpen(true)
    setAssignmentMessage('')
  }

  const handleCloseOutsideModal = () => {
    setIsOutsideModalOpen(false)
  }

  const handleProjectSelect = async (candidateKey, projectKey) => {
    const current = assignments[candidateKey] || {}
    const locations = await loadProjectLocations(projectKey)
    setAssignments((prev) => ({
      ...prev,
      [candidateKey]: {
        ...current,
        project: projectKey,
        location: '',
        centre: activeTab === 'written' ? '' : undefined,
        saved: false,
        locationOptions: locations,
        centreOptions: activeTab === 'written' ? [] : undefined,
      },
    }))
  }

  const handleLocationSelect = async (candidateKey, locationKey) => {
    const current = assignments[candidateKey] || {}
    const centres = activeTab === 'written' ? await loadLocationCentres(current.project, locationKey) : undefined
    setAssignments((prev) => ({
      ...prev,
      [candidateKey]: {
        ...current,
        location: locationKey,
        centre: activeTab === 'written' ? '' : undefined,
        saved: false,
        centreOptions: centres,
      },
    }))
  }

  const handleCentreSelect = (candidateKey, centreKey) => {
    const current = assignments[candidateKey] || {}
    setAssignments((prev) => ({
      ...prev,
      [candidateKey]: {
        ...current,
        centre: centreKey,
        saved: false,
      },
    }))
  }

  const handleSaveAssignment = async (candidateKey) => {
    const current = assignments[candidateKey] || {}
    const requiredFields = activeTab === 'written' ? ['project', 'location', 'centre'] : ['project', 'location']
    if (requiredFields.some(field => !current[field])) return

    setAssignments((prev) => ({
      ...prev,
      [candidateKey]: {
        ...prev[candidateKey],
        saving: true,
        error: '',
      },
    }))
    setModalError('')

    try {
      await recruiterAPI.assignCandidate({
        candidate_id: candidateKey,
        project_id: current.project,
        location_id: current.location,
        ...(activeTab === 'written' && { centre_id: current.centre }),
      })

      setAssignments((prev) => ({
        ...prev,
        [candidateKey]: {
          ...prev[candidateKey],
          saved: true,
          saving: false,
          error: '',
        },
      }))
    } catch (error) {
      setAssignments((prev) => ({
        ...prev,
        [candidateKey]: {
          ...prev[candidateKey],
          saving: false,
        },
      }))
      setModalError('Unable to save assignment. Please try again.')
      console.error('Failed to save candidate assignment:', error)
    }
  }

  const handleDone = async () => {
    const pendingKeys = Object.keys(assignments).filter(key => {
      const item = assignments[key];
      const requiredFields = activeTab === 'written' ? ['project', 'location', 'centre'] : ['project', 'location'];
      return requiredFields.every(f => item[f]) && !item.saved;
    });

    if (pendingKeys.length === 0) {
      handleCloseOutsideModal();
      return;
    }

    try {
      // Trigger save for all pending assignments
      await Promise.all(pendingKeys.map(key => handleSaveAssignment(key)));
      handleCloseOutsideModal();
      fetchAttendance(); // Refresh main list
    } catch (error) {
      setModalError('Failed to save some assignments. Please check individual rows.');
    }
  };


  const assignedCount = Object.values(assignments).filter((item) => {
    const requiredFields = activeTab === 'written' ? ['project', 'location', 'centre'] : ['project', 'location']
    return requiredFields.every(field => item?.[field] && item?.saved)
  }).length
  const unsavedCount = Object.values(assignments).filter((item) => {
    const requiredFields = activeTab === 'written' ? ['project', 'location', 'centre'] : ['project', 'location']
    return requiredFields.every(field => item?.[field]) && !item?.saved
  }).length

  const outsideTotalPages = Math.max(1, Math.ceil(outsideTotal / outsideLimit))
  const outsideCurrentPage = Math.floor(outsideOffset / outsideLimit) + 1
  const outsidePageStart = Math.max(1, Math.min(outsideCurrentPage - 2, Math.max(1, outsideTotalPages - 4)))
  const outsidePageEnd = Math.min(outsideTotalPages, outsidePageStart + 4)
  const outsidePageNumbers = []
  for (let i = outsidePageStart; i <= outsidePageEnd; i += 1) outsidePageNumbers.push(i)

  const outsideCandidateRows = outsideCandidates.map((candidate, index) => {
    const candidateId = String(candidate.attendance_id ?? candidate.id ?? candidate.candidateId ?? candidate._id ?? index)
    const name = candidate.candidate_name || candidate.name || candidate.fullName || candidate.worker_name || 'Unknown'
    const mobile = candidate.mobile || candidate.phone || candidate.whatsapp || candidate.contact || '—'
    const assignment = assignments[candidateId] || {}
    const projectValue = assignment.project || ''
    const locationValue = assignment.location || ''
    const centreValue = activeTab === 'written' ? (assignment.centre || '') : undefined
    const locationOptions = locationOptionsByProject[projectValue] || []
    const centreOptions = activeTab === 'written' ? (centreOptionsByLocation[locationValue] || []) : []

    const candidateDate = candidate.date || candidate.created_at || candidate.createdAt || candidate.added || ''
    const checkInImage = candidate.check_in_image || candidate.checkInImage || candidate.checkin_image || candidate.photo || candidate.profile_image || NO_IMAGE_PLACEHOLDER
    const checkOutImage = candidate.check_out_image || candidate.checkOutImage || candidate.checkout_image || candidate.checkout_photo || NO_IMAGE_PLACEHOLDER
    const clockIn = candidate.clock_in || candidate.clockIn || candidate.check_in_time || candidate.checkin_time || candidate.check_in || candidate.checkin || '—'
    const clockOut = candidate.clock_out || candidate.clockOut || candidate.check_out_time || candidate.checkout_time || candidate.check_out || candidate.checkout || '—'
    const hours = candidate.hours || candidate.duration || candidate.total_hours || candidate.hours_worked || '—'

    const checkinLoc = parseCoords(candidate.checkin_location ?? candidate.checkInLocation ?? candidate.checkin ?? candidate.checkin_location_raw)
    const checkoutLoc = parseCoords(candidate.checkout_location ?? candidate.checkOutLocation ?? candidate.checkout ?? candidate.checkout_location_raw)

    const markers = []
    if (checkinLoc) markers.push({ ...checkinLoc, label: 'Check-in location', type: 'checkin', distance_km: Number(candidate.checkin_location?.distance_km ?? candidate.checkin_location?.distance ?? candidate.checkin_distance) })
    if (checkoutLoc) markers.push({ ...checkoutLoc, label: 'Check-out location', type: 'checkout', distance_km: Number(candidate.checkout_location?.distance_km ?? candidate.checkout_location?.distance ?? candidate.checkout_distance) })

    const hasMapMarkers = markers.length > 0

    return [
      candidateId,
      candidateDate ? new Date(candidateDate).toLocaleDateString('en-IN') : '—',
      name,
      formatAadhaar(candidate.aadhaar || candidate.aadhaar_number || candidate.aadhar || candidate.aadhaarNo || ''),
      mobile,
      <ProjectDropdown
        value={projectValue}
        onSelect={(projId) => handleProjectSelect(candidateId, projId)}
        placeholder="Select project"
      />,
      <select
        className="form-control"
        value={locationValue}
        onChange={(e) => handleLocationSelect(candidateId, e.target.value)}
        disabled={!projectValue || locationOptions.length === 0}
      >
        <option value="">Select location</option>
        {locationOptions.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>,
      ...(activeTab === 'written' ? [
        <select
          className="form-control"
          value={centreValue}
          onChange={(e) => handleCentreSelect(candidateId, e.target.value)}
          disabled={!locationValue || centreOptions.length === 0}
        >
          <option value="">Select centre</option>
          {centreOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
      ] : []),
      clockIn || '—',
      clockOut || '—',
      <button
        key={`${candidateId}-inimg-btn`}
        type="button"
        className="attendance-image-button"
        onClick={() => openImageModal(checkInImage || NO_IMAGE_PLACEHOLDER, 'Check-in image', 'Check in')}
      >
        <img
          src={checkInImage || NO_IMAGE_PLACEHOLDER}
          alt="Check in"
          className="attendance-image-thumb attendance-image-clickable"
          style={{ opacity: checkInImage ? 1 : 0.5 }}
        />
      </button>,
      <button
        key={`${candidateId}-outimg-btn`}
        type="button"
        className="attendance-image-button"
        onClick={() => openImageModal(checkOutImage || NO_IMAGE_PLACEHOLDER, 'Check-out image', 'Check out')}
      >
        <img
          src={checkOutImage || NO_IMAGE_PLACEHOLDER}
          alt="Check out"
          className="attendance-image-thumb attendance-image-clickable"
          style={{ opacity: checkOutImage ? 1 : 0.5 }}
        />
      </button>,
      hasMapMarkers ? (
        <button
          type="button"
          className="map-pin-btn"
          onClick={() => openMapModal(markers, candidate.location_name || candidate.location || candidate.project_name || name)}
        >
          <FontAwesomeIcon icon={faMapMarkerAlt} />
        </button>
      ) : '—',
      <Tag key={`status-${candidateId}`} variant={statusVariant(candidate.status)}>{candidate.status || (assignment.saved ? 'Assigned' : 'Unassigned')}</Tag>,
      assignment.saved ? (
        <span className="tag tag-green">Assigned</span>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!projectValue || !locationValue || assignment.saving}
          onClick={() => handleSaveAssignment(candidateId)}
        >
          {assignment.saving ? 'Saving…' : 'Save'}
        </button>
      ),
    ]
  })

  const outsideCandidateMobileCards = outsideCandidates.map((candidate, index) => {
    const candidateId = String(candidate.attendance_id ?? candidate.id ?? candidate.candidateId ?? candidate._id ?? index)
    const name = candidate.candidate_name || candidate.name || candidate.fullName || candidate.worker_name || 'Unknown'
    const mobile = candidate.mobile || candidate.phone || candidate.whatsapp || candidate.contact || '—'
    const assignment = assignments[candidateId] || {}
    const projectValue = assignment.project || ''
    const locationValue = assignment.location || ''
    const centreValue = activeTab === 'written' ? (assignment.centre || '') : undefined
    const locationOptions = locationOptionsByProject[projectValue] || []
    const centreOptions = activeTab === 'written' ? (centreOptionsByLocation[locationValue] || []) : []
    const candidateDate = candidate.date || candidate.created_at || candidate.createdAt || candidate.added || ''
    const clockIn = candidate.clock_in || candidate.clockIn || candidate.check_in_time || candidate.checkin_time || candidate.check_in || candidate.checkin || '—'
    const clockOut = candidate.clock_out || candidate.clockOut || candidate.check_out_time || candidate.checkout_time || candidate.check_out || candidate.checkout || '—'
    const checkInImage = candidate.check_in_image || candidate.checkInImage || candidate.checkin_image || candidate.photo || candidate.profile_image || NO_IMAGE_PLACEHOLDER
    const checkOutImage = candidate.check_out_image || candidate.checkOutImage || candidate.checkout_image || candidate.checkout_photo || NO_IMAGE_PLACEHOLDER
    const checkinLoc = parseCoords(candidate.checkin_location ?? candidate.checkInLocation ?? candidate.checkin ?? candidate.checkin_location_raw)
    const checkoutLoc = parseCoords(candidate.checkout_location ?? candidate.checkOutLocation ?? candidate.checkout ?? candidate.checkout_location_raw)
    const markers = []
    if (checkinLoc) markers.push({ ...checkinLoc, label: 'Check-in location', type: 'checkin' })
    if (checkoutLoc) markers.push({ ...checkoutLoc, label: 'Check-out location', type: 'checkout' })

    return (
      <article className="outside-candidate-mobile-card" key={candidateId}>
        <div className="outside-candidate-mobile-heading">
          <div>
            <strong>{name}</strong>
            <span>{mobile}</span>
          </div>
          <span>#{outsideOffset + index + 1}</span>
        </div>
        <div className="outside-candidate-mobile-meta">
          <div><span>Date</span><strong>{candidateDate ? new Date(candidateDate).toLocaleDateString('en-IN') : '—'}</strong></div>
          <div><span>Clock in</span><strong>{clockIn}</strong></div>
          <div><span>Clock out</span><strong>{clockOut}</strong></div>
          <div><span>Status</span><strong>{candidate.status || (assignment.saved ? 'Assigned' : 'Unassigned')}</strong></div>
        </div>
        <div className="outside-candidate-mobile-fields">
          <label>
            <span>Project</span>
            <ProjectDropdown value={projectValue} onSelect={(projectId) => handleProjectSelect(candidateId, projectId)} placeholder="Select project" />
          </label>
          <label>
            <span>{activeTab === 'written' ? 'District / location' : 'Location'}</span>
            <select className="form-control" value={locationValue} onChange={(event) => handleLocationSelect(candidateId, event.target.value)} disabled={!projectValue || locationOptions.length === 0}>
              <option value="">Select location</option>
              {locationOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          {activeTab === 'written' && (
            <label>
              <span>Centre</span>
              <select className="form-control" value={centreValue} onChange={(event) => handleCentreSelect(candidateId, event.target.value)} disabled={!locationValue || centreOptions.length === 0}>
                <option value="">Select centre</option>
                {centreOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="outside-candidate-mobile-actions">
          <button type="button" className="attendance-image-button" onClick={() => openImageModal(checkInImage, 'Check-in image', 'Check in')}>
            <img src={checkInImage} alt="Check in" className="attendance-image-thumb" />
            <span>Check in</span>
          </button>
          <button type="button" className="attendance-image-button" onClick={() => openImageModal(checkOutImage, 'Check-out image', 'Check out')}>
            <img src={checkOutImage} alt="Check out" className="attendance-image-thumb" />
            <span>Check out</span>
          </button>
          {markers.length > 0 && <button type="button" className="map-pin-btn" onClick={() => openMapModal(markers, name)} title="View locations"><FontAwesomeIcon icon={faMapMarkerAlt} /></button>}
          {assignment.saved ? (
            <span className="tag tag-green outside-candidate-assigned">Assigned</span>
          ) : (
            <button type="button" className="btn btn-primary btn-sm outside-candidate-save" disabled={!projectValue || !locationValue || (activeTab === 'written' && !centreValue) || assignment.saving} onClick={() => handleSaveAssignment(candidateId)}>
              {assignment.saving ? 'Saving...' : 'Save assignment'}
            </button>
          )}
        </div>
      </article>
    )
  })

  const summaryRows = paginatedGroups.map((group, index) => [
    offset + index + 1,
    (() => {
      const kindRaw = group.projectKind || group.kind || group.type || group.projectType || ''
      const kindClass = `type-${String(kindRaw || '').toLowerCase().replace(/\s+/g, '-')}`
      const projectTitle = group.project || group.projectName || group.name || '-'
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`type-bar ${kindClass}`} />
          <div style={{ display: 'grid' }}>
            <div style={{ fontWeight: 700 }}>{projectTitle}</div>
            {group.clientName && <div style={{ color: 'var(--text3)', fontSize: 12 }}>{group.clientName}</div>}
          </div>
        </div>
      )
    })(),
    activeTab === 'written' ? (group.district || group.location) : `${group.locations?.size || group.locations || 0} locations`,
    ...(activeTab === 'written' ? [group.centre] : []),
    group.startDate ? new Date(group.startDate).toLocaleDateString('en-IN') : '—',
    group.endDate ? new Date(group.endDate).toLocaleDateString('en-IN') : '—',
    group.resources?.size || group.resources || 0,
    Math.round(group.mandaysWorked),
    <div key={`action-${group.id ?? index}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      <button
        className="btn btn-outline btn-sm"
        type="button"
        onClick={() => {
          if (group.id != null) {
            navigate(`/app/recruiter/attendance/details?id=${group.id}&projectType=${activeTab === 'written' ? 'writtenExam' : 'regular'}`, { 
              state: { 
                projectTitle: group.project, 
                startDate: group.startDate, 
                endDate: group.endDate,
                projectType: activeTab === 'written' ? 'writtenExam' : 'regular'
              } 
            })
          } else {
            const params = activeTab === 'written'
              ? `id=${group.projectId || group.project}&districtId=${group.districtId || group.district || group.location || ''}&centreId=${group.centreId || group.centre}&projectType=writtenExam`
              : `id=${group.projectId || group.project}&locationId=${group.locationId || group.location}&projectType=regular`
            navigate(`/app/recruiter/attendance/details?${params}`, { 
              state: { 
                projectTitle: group.project, 
                startDate: group.startDate, 
                endDate: group.endDate,
                projectType: activeTab === 'written' ? 'writtenExam' : 'regular'
              } 
            })
          }
        }}
      >
        View details
      </button>
      <button
        className="btn btn-outline btn-sm"
        type="button"
        onClick={() => {
          const pid = group.id || group.projectId || group.project || ''
          const projectTypeParam = activeTab === 'written' ? 'written' : 'regular'
          navigate(`/app/recruiter/project-stats?projectId=${encodeURIComponent(pid)}&projectType=${projectTypeParam}`)
        }}
      >
        Stats
      </button>
      {activeTab === 'written' ? (
        <button
          className="btn btn-outline btn-sm"
          type="button"
          onClick={async () => {
            const projectId = group.id || group.projectId || ''
            const attendanceLink = `${window.location.origin}${window.location.pathname.replace(/\/?$/, '')}/#/attendance?id=${encodeURIComponent(projectId)}`
            try {
              await navigator.clipboard.writeText(attendanceLink)
              alert('Attendance link copied to clipboard')
            } catch (err) {
              window.prompt('Copy this attendance link:', attendanceLink)
            }
          }}
        >
          Copy link
        </button>
      ) : (
        <button
          className="btn btn-outline btn-sm"
          type="button"
          onClick={async () => {
            const attendanceLink = 'https://cynosurejobs.net/gigjobs/#/attendance'
            try {
              await navigator.clipboard.writeText(attendanceLink)
              alert('Attendance link copied to clipboard')
            } catch (err) {
              window.prompt('Copy this attendance link:', attendanceLink)
            }
          }}
        >
          Copy link
        </button>
      )}
      {activeTab === 'written' && (
        <button
          className="btn btn-outline btn-sm"
          type="button"
          disabled={projectStatusLoading[group.projectId || group.id || group.project] || !(group.projectId || group.id)}
          onClick={() => handleToggleProjectStatus(group)}
        >
          {projectStatusLoading[group.projectId || group.id || group.project]
            ? 'Saving…'
            : deriveActiveStatus(group.status)
              ? 'Deactivate'
              : 'Activate'}
        </button>
      )}
    </div>,
  ])

  return (
    <div className="recruiter-attendance-page attendance-summary-page">
      <PageHeader
        title="Recruiter Attendance"
        subtitle="Review mandays worked by project before drilling into candidate-level attendance."
        action={(
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={openSearchAttendanceModal}>
              <FontAwesomeIcon icon={faFileCsv} /> Search attendance
            </button>
            {activeTab === 'regular' && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleOpenOutsideModal}>
                <FontAwesomeIcon icon={faMapMarkerAlt} /> Outside location
              </button>
            )}
          </div>
        )}
      />

      <div style={{ marginBottom: 24 }}>
        <Tabs
          tabs={attendanceTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon={<FontAwesomeIcon icon={faProjectDiagram} />}
          iconStyle={{ background: 'var(--teal-light)', color: 'var(--teal)' }}
          label="Active Projects"
          value={loading ? '…' : kpis.totalProjects}
        />
        <StatCard
          icon={<FontAwesomeIcon icon={faUsers} />}
          iconStyle={{ background: 'var(--green-light)', color: 'var(--green)' }}
          label="Total Resources"
          value={loading ? '…' : kpis.totalResources}
        />
        <StatCard
          icon={<FontAwesomeIcon icon={faMapMarkerAlt} />}
          iconStyle={{ background: 'var(--blue-light)', color: 'var(--blue)' }}
          label="Total Locations"
          value={loading ? '…' : kpis.totalLocations}
        />
        <StatCard
          icon={<FontAwesomeIcon icon={faClock} />}
          iconStyle={{ background: 'var(--yellow-light)', color: 'var(--saffron)' }}
          label="Total Mandays"
          value={loading ? '…' : kpis.totalMandays}
        />
      </div>

      <Card className="attendancedata-card">
        <div className="projects-table-filters" style={{ alignItems: 'center', marginBottom: 24 }}>
          <div className="projects-table-filter-group search-group">
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control search-attendance-project"
                placeholder="Search projects or candidates…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setOffset(0)
                }}
              />
            </div>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Start Date range</div>
            <input
              className="form-control"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setOffset(0)
              }}
            />
            <span className="date-separator">to</span>
            <input
              className="form-control"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setOffset(0)
              }}
            />
          </div>

          <div className="projects-table-meta">
            <div className="entries-selector">
              <label>Rows</label>
              <select
                className="form-control"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setOffset(0)
                }}
              >
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value} entries</option>
                ))}
              </select>
            </div>
            <button className="btn btn-outline btn-sm" type="button" onClick={clearAllFilters}>Clear</button>
          </div>
        </div>

        <div className="summary-table-section">
          <div className="projects-table-wrap">
              <DataTable
              columns={activeTab === 'written' ? ['S.No', 'Project', 'District', 'Centre', 'Start Date', 'End Date', 'Resources', 'Mandays Worked', 'Action'] : ['S.No', 'Project', 'Locations', 'Start Date', 'End Date', 'Resources', 'Mandays Worked', 'Action']}
              rows={summaryRows}
              emptyMessage={loading ? 'Loading summary...' : 'No project summary available.'}
            />
          </div>
          <div className="attendance-summary-mobile-list">
            {loading ? (
              <div className="attendance-mobile-state">Loading summary...</div>
            ) : paginatedGroups.length === 0 ? (
              <div className="attendance-mobile-state">No project summary available.</div>
            ) : (
              paginatedGroups.map((group, index) => {
                const projectTitle = group.project || group.projectName || group.name || '-'
                const area = activeTab === 'written' ? (group.district || group.location || '—') : `${group.locations?.size || group.locations || 0} locations`
                const projectKey = group.id || group.projectId || group.project || ''
                const projectTypeParam = activeTab === 'written' ? 'written' : 'regular'
                const navigateToDetails = () => {
                  const params = group.id != null
                    ? `id=${group.id}&projectType=${activeTab === 'written' ? 'writtenExam' : 'regular'}`
                    : activeTab === 'written'
                      ? `id=${group.projectId || group.project}&districtId=${group.districtId || group.district || group.location || ''}&centreId=${group.centreId || group.centre}&projectType=writtenExam`
                      : `id=${group.projectId || group.project}&locationId=${group.locationId || group.location}&projectType=regular`
                  navigate(`/app/recruiter/attendance/details?${params}`, {
                    state: { projectTitle: group.project, startDate: group.startDate, endDate: group.endDate, projectType: activeTab === 'written' ? 'writtenExam' : 'regular' }
                  })
                }

                return (
                  <article className="attendance-summary-mobile-card" key={group.id || `${projectTitle}-${index}`}>
                    <div className="attendance-summary-mobile-heading">
                      <div>
                        <strong>{projectTitle}</strong>
                        {group.clientName && <span>{group.clientName}</span>}
                      </div>
                      <span>#{offset + index + 1}</span>
                    </div>
                    <div className="attendance-summary-mobile-grid">
                      <div><span>{activeTab === 'written' ? 'District' : 'Locations'}</span><strong>{area}</strong></div>
                      {activeTab === 'written' && <div><span>Centre</span><strong>{group.centre || '—'}</strong></div>}
                      <div><span>Start</span><strong>{group.startDate ? new Date(group.startDate).toLocaleDateString('en-IN') : '—'}</strong></div>
                      <div><span>End</span><strong>{group.endDate ? new Date(group.endDate).toLocaleDateString('en-IN') : '—'}</strong></div>
                      <div><span>Resources</span><strong>{group.resources?.size || group.resources || 0}</strong></div>
                      <div><span>Mandays</span><strong>{Math.round(group.mandaysWorked)}</strong></div>
                    </div>
                    <div className="attendance-summary-mobile-actions">
                      <button className="btn btn-outline btn-sm" type="button" onClick={navigateToDetails}>View details</button>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate(`/app/recruiter/project-stats?projectId=${encodeURIComponent(projectKey)}&projectType=${projectTypeParam}`)}>Stats</button>
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={async () => {
                          const attendanceLink = activeTab === 'written'
                            ? `${window.location.origin}${window.location.pathname.replace(/\/?$/, '')}/#/attendance?id=${encodeURIComponent(group.id || group.projectId || '')}`
                            : 'https://cynosurejobs.net/gigjobs/#/attendance'
                          try { await navigator.clipboard.writeText(attendanceLink); alert('Attendance link copied to clipboard') } catch { window.prompt('Copy this attendance link:', attendanceLink) }
                        }}
                      >
                        Copy link
                      </button>
                      {activeTab === 'written' && (
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          disabled={projectStatusLoading[projectKey] || !projectKey}
                          onClick={() => handleToggleProjectStatus(group)}
                        >
                          {projectStatusLoading[projectKey] ? 'Saving...' : deriveActiveStatus(group.status) ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>

        <div className="projects-table-pagination attendance-summary-pagination">
          <div className="pagination-summary">
            Showing {Math.min(total, offset + 1)}–{Math.min(total, offset + limit)} of {total} records
          </div>
          <div className="pagination-actions">
            <button
              className="pagination-page-btn"
              type="button"
              disabled={currentPage === 1}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Prev
            </button>
            <span className="pagination-current-label">Page {currentPage} of {totalPages}</span>
            <div className="pagination-pages">
              {pageStart > 1 && (
                <>
                  <button className="pagination-page-btn" type="button" onClick={() => setOffset(0)}>1</button>
                  {pageStart > 2 && <span className="pagination-ellipsis">…</span>}
                </>
              )}
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  className={`pagination-page-btn${page === currentPage ? ' active' : ''}`}
                  type="button"
                  onClick={() => setOffset((page - 1) * limit)}
                >
                  {page}
                </button>
              ))}
              {pageEnd < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
              {pageEnd < totalPages && (
                <button className="pagination-page-btn" type="button" onClick={() => setOffset((totalPages - 1) * limit)}>{totalPages}</button>
              )}
            </div>
            <button
              className="pagination-page-btn"
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setOffset(Math.min((totalPages - 1) * limit, offset + limit))}
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isSearchAttendanceModalOpen}
        onClose={() => setIsSearchAttendanceModalOpen(false)}
        title={searchAttendanceTab === 'aadhaar' ? 'Search Candidate Aadhaar' : 'Search Attendance'}
        maxWidth="720px"
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <Tabs
            tabs={searchModalTabs}
            activeTab={searchAttendanceTab}
            onTabChange={setSearchAttendanceTab}
          />
          <div style={{ color: 'var(--text2)', fontSize: '0.95rem' }}>
            {searchAttendanceTab === 'aadhaar'
              ? 'Upload a CSV file containing Aadhaar numbers to search candidate records and download the response as an Excel file.'
              : 'Upload a CSV file to search attendance and preview matched records for the selected project.'}
          </div>
          {searchAttendanceTab === 'attendance' ? (
            <>
              <div className="form-group">
                <label className="form-label">Project</label>
                <select
                  className="form-control"
                  value={searchAttendanceProjectId}
                  onChange={(event) => setSearchAttendanceProjectId(event.target.value)}
                >
                  <option value="">Select project</option>
                  {projectOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Attendance date</label>
                <input
                  className="form-control"
                  type="date"
                  value={searchAttendanceDate}
                  onChange={(event) => setSearchAttendanceDate(event.target.value)}
                />
              </div>
            </>
          ) : null}
          <div className="form-group">
            <label className="form-label">CSV file</label>
            <input
              className="form-control"
              type="file"
              accept=".csv"
              onChange={searchAttendanceTab === 'aadhaar' ? handleSearchAadhaarFileChange : handleSearchAttendanceFileChange}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={searchAttendanceTab === 'aadhaar' ? downloadSearchCandidateAadhaarSample : downloadSearchAttendanceSample}
            >
              Download sample CSV
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setIsSearchAttendanceModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={searchAttendanceTab === 'aadhaar' ? handleSearchCandidateAadhaarUpload : handleSearchAttendanceUpload}
                disabled={searchAttendanceLoading || searchAadhaarLoading}
              >
                {(searchAttendanceTab === 'aadhaar' ? searchAadhaarLoading : searchAttendanceLoading)
                  ? 'Uploading...'
                  : (searchAttendanceTab === 'aadhaar' ? 'Upload & Export' : 'Upload & Search')}
              </button>
            </div>
          </div>
          {(searchAttendanceTab === 'aadhaar' ? searchAadhaarFileName : searchAttendanceFileName) && (
            <div style={{ color: 'var(--text2)', fontSize: '0.95rem' }}>
              Selected file: <strong>{searchAttendanceTab === 'aadhaar' ? searchAadhaarFileName : searchAttendanceFileName}</strong>
            </div>
          )}
          {(searchAttendanceTab === 'aadhaar' ? searchAadhaarError : searchAttendanceError) && (
            <div className="attendance-message error">
              {searchAttendanceTab === 'aadhaar' ? searchAadhaarError : searchAttendanceError}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isSearchAttendanceResultsModalOpen}
        onClose={() => setIsSearchAttendanceResultsModalOpen(false)}
        title={`CSV Search Results${searchAttendanceProjectName ? ` — ${searchAttendanceProjectName}` : ''}`}
        maxWidth="1200px"
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="projects-table-filters" style={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div className="projects-table-filter-group search-group" style={{ minWidth: 0, flex: '1 1 260px' }}>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control"
                  placeholder="Search records…"
                  value={searchAttendanceSearch}
                  onChange={(event) => setSearchAttendanceSearch(event.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => exportSearchAttendanceResults('excel')} disabled={searchAttendanceExporting || !searchAttendanceResults.length}>
                {searchAttendanceExporting ? 'Exporting…' : 'Export Excel'}
              </button>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => {
                setExportAdvtNo('')
                setExportAdvtNoError('')
                setIsAdvtNoModalOpen(true)
              }} disabled={searchAttendanceExporting || !searchAttendanceResults.length}>
                {searchAttendanceExporting ? 'Exporting…' : 'Export PDF'}
              </button>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setIsSearchAttendanceResultsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
          <div className="projects-table-wrap">
            <DataTable
              columns={activeTab === 'written' ? ['S.No', 'Candidate', 'Mobile', 'Aadhaar', 'District', 'Centre', 'Date', 'Status'] : ['S.No', 'Candidate', 'Mobile', 'Aadhaar', 'Location', 'Date', 'Status']}
              rows={searchAttendanceFilteredRecords.map((record, index) => [
                index + 1,
                record?.candidate_name || record?.name || record?.candidateName || '—',
                record?.mobile || record?.phone || record?.contact || '—',
                record?.aadhar || record?.aadhaar || record?.aadhaarNo || '—',
                activeTab === 'written'
                  ? (record?.district || record?.district_name || record?.districtName || '—')
                  : (record?.location || record?.location_name || record?.locationName || '—'),
                ...(activeTab === 'written' ? [(record?.centre || record?.centre_name || record?.centreName || '—')] : []),
                record?.date ? new Date(record.date).toLocaleDateString('en-IN') : '—',
                record?.status || '—',
              ])}
              emptyMessage={searchAttendanceLoading ? 'Loading uploaded attendance...' : 'No uploaded attendance records found.'}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAdvtNoModalOpen}
        onClose={() => setIsAdvtNoModalOpen(false)}
        title="Enter Advt. No."
        maxWidth="480px"
      >
        <div style={{ paddingTop: 8 }}>
          <div style={{ marginBottom: 14, fontSize: 14, color: 'var(--text2)' }}>
            Enter the advertisement number to include in the PDF export header.
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="summary-advt-no-input" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
              Advt. No.
            </label>
            <input
              id="summary-advt-no-input"
              className="form-control"
              type="text"
              value={exportAdvtNo}
              onChange={(event) => {
                setExportAdvtNo(event.target.value)
                if (exportAdvtNoError) setExportAdvtNoError('')
              }}
              placeholder="Enter Advt. No."
            />
            {exportAdvtNoError && (
              <div style={{ marginTop: 8, color: '#d63333', fontSize: 12 }}>
                {exportAdvtNoError}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-outline" type="button" onClick={() => setIsAdvtNoModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={async () => {
                const trimmed = String(exportAdvtNo || '').trim()
                if (!trimmed) {
                  setExportAdvtNoError('Advt. No. is required.')
                  return
                }
                setExportAdvtNoError('')
                setIsAdvtNoModalOpen(false)
                await exportSearchAttendanceResults('pdf', trimmed)
              }}
            >
              Export PDF
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isOutsideModalOpen}
        onClose={handleCloseOutsideModal}
        title="Assign outside candidates"
        maxWidth="1200px"
        footer={(
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={handleCloseOutsideModal}>Close</button>
            <button
              className="btn btn-primary btn-sm btn-full"
              type="button"
              disabled={isModalLoading || !Object.keys(assignments).length}
              onClick={handleDone}
            >
              Done
            </button>
          </div>
        )}
      >
        <div className="outside-location-modal-content" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Current assignments</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.95rem' }}>
              {assignedCount} assigned, {unsavedCount} pending save.
            </div>
          </div>
          {assignmentMessage && (
            <div style={{ color: 'var(--green)', fontSize: '0.95rem', minWidth: 0, flex: '1 1 100%' }}>
              {assignmentMessage}
            </div>
          )}
        </div>

        <div className="projects-table-filters" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div className="projects-table-filter-group search-group" style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Search candidates…"
                value={outsideSearch}
                onChange={(e) => setOutsideSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="projects-table-filter-group date-group" style={{ display: 'flex', alignItems: 'center', gap: 8}}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <div className="filter-label">From</div>
              <input
                className="form-control"
                type="date"
                value={outsideFromDate}
                onChange={(e) => {
                  setOutsideFromDate(e.target.value)
                  setOutsideOffset(0)
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <div className="filter-label">To</div>
              <input
                className="form-control"
                type="date"
                value={outsideToDate}
                onChange={(e) => {
                  setOutsideToDate(e.target.value)
                  setOutsideOffset(0)
                }}
              />
            </div>
          </div>

          <div className="projects-table-meta" style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 0 }}>
            <div className="entries-selector">
              <label>Rows</label>
              <select
                className="form-control"
                value={outsideLimit}
                onChange={(e) => {
                  setOutsideLimit(Number(e.target.value))
                  setOutsideOffset(0)
                }}
              >
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value} entries</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {modalError && <div className="attendance-message error" style={{ marginBottom: 16 }}>{modalError}</div>}

        <div className="projects-table-wrap outside-candidate-table">
          <DataTable
            columns={activeTab === 'written' ? ['ID', 'Date', 'Candidate', 'Aadhaar', 'Mobile', 'Project', 'Location', 'Centre', 'Clock In', 'Clock Out', 'Check In Image', 'Check Out Image', 'Map', 'Status', 'Action'] : ['ID', 'Date', 'Candidate', 'Aadhaar', 'Mobile', 'Project', 'Location', 'Clock In', 'Clock Out', 'Check In Image', 'Check Out Image', 'Map', 'Status', 'Action']}
            rows={isModalLoading ? [] : outsideCandidateRows}
            emptyMessage={isModalLoading ? 'Loading candidates...' : 'No candidates available.'}
          />
        </div>
        <div className="outside-candidate-mobile-list">
          {isModalLoading ? <div className="attendance-mobile-state">Loading candidates...</div> : outsideCandidates.length === 0 ? <div className="attendance-mobile-state">No candidates available.</div> : outsideCandidateMobileCards}
        </div>

        <MapModal isOpen={isMapOpen} onClose={closeMapModal} markers={mapMarkers} title={mapTitle} />
        <ImageModal isOpen={imagePreview.isOpen} onClose={closeImageModal} imageUrl={imagePreview.src} title={imagePreview.title} alt={imagePreview.alt} />

        <div className="projects-table-pagination outside-location-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          <div className="pagination-summary" style={{ minWidth: 0 }}>
            Showing {outsideTotal === 0 ? 0 : outsideOffset + 1}–{Math.min(outsideTotal, outsideOffset + outsideLimit)} of {outsideTotal} candidates
          </div>
          <div className="pagination-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="pagination-page-btn"
              type="button"
              disabled={outsideCurrentPage === 1}
              onClick={() => setOutsideOffset(Math.max(0, outsideOffset - outsideLimit))}
            >
              Prev
            </button>
            <span className="pagination-current-label">Page {outsideCurrentPage} of {outsideTotalPages}</span>
            {outsidePageStart > 1 && (
              <>
                <button className="pagination-page-btn" type="button" onClick={() => setOutsideOffset(0)}>1</button>
                {outsidePageStart > 2 && <span className="pagination-ellipsis">…</span>}
              </>
            )}
            {outsidePageNumbers.map((page) => (
              <button
                key={page}
                className={`pagination-page-btn${page === outsideCurrentPage ? ' active' : ''}`}
                type="button"
                onClick={() => setOutsideOffset((page - 1) * outsideLimit)}
              >
                {page}
              </button>
            ))}
            {outsidePageEnd < outsideTotalPages - 1 && <span className="pagination-ellipsis">…</span>}
            {outsidePageEnd < outsideTotalPages && (
              <button className="pagination-page-btn" type="button" onClick={() => setOutsideOffset((outsideTotalPages - 1) * outsideLimit)}>{outsideTotalPages}</button>
            )}
            <button
              className="pagination-page-btn"
              type="button"
              disabled={outsideCurrentPage === outsideTotalPages}
              onClick={() => setOutsideOffset(Math.min((outsideTotalPages - 1) * outsideLimit, outsideOffset + outsideLimit))}
            >
              Next
            </button>
          </div>
        </div>

      </Modal>
    </div>
  )
}
