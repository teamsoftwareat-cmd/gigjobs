import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExcel, faArrowLeft, faCalculator, faSearch, faCalendarAlt, faMapMarkerAlt, faMoneyBillWave, faCheckDouble, faUsers, faClock, faProjectDiagram, faSave, faUpload, faFilter, faPlus, faTrash, faCheck, faPencilAlt, faStar } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { PageHeader, Card, DataTable, Modal, FormField, StatCard, LoadingOverlay } from '../../components/ui'
import { useAlert } from '../../context/AlertContext'
// Important: Change this import to xlsx-js-style to enable borders and centering
import { useAuth } from '../../context/AuthContext'
import * as XLSX from 'xlsx-js-style'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import './PaymentSheet.css' // Import the new CSS file
import './AttendanceData.css'
import './PaymentSheetMobile.css'

const LIMIT_OPTIONS = [10, 20, 50, 100, 250, 500, 1000, 2000]
const ALLOWANCE_TYPES = [
  'Travel Allowance',
  'Food Allowance',
  'Ground Visit',
  'Training',
  'Laundry',
  'Overtime'
]

// Helper to convert Date to YYYY-MM-DD in local time
const formatDateToISO = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to convert YYYY-MM-DD string to Date object in local time
const parseISOToDate = (isoString) => {
  if (!isoString) return undefined;
  const parts = String(isoString).split('T')[0].split('-');
  if (parts.length !== 3) return undefined;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
};

export default function RecruiterPaymentSheet() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { alert } = useAlert()
  const { user } = useAuth()

  const projectId = searchParams.get('id') || searchParams.get('project')
  const locationId = searchParams.get('locationId') || searchParams.get('location') || ''
  const districtId = searchParams.get('districtId') || searchParams.get('district') || ''
  const centreId = searchParams.get('centreId') || searchParams.get('centre') || ''

  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [limit, setLimit] = useState(10)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ totalResources: 0, totalMandays: 0 })
  const [projectDates, setProjectDates] = useState({ start: location.state?.startDate || '', end: location.state?.endDate || '' })
  const [fromDate, setFromDate] = useState(location.state?.startDate || '')
  const [toDate, setToDate] = useState(location.state?.endDate || '')
  const [projectTitle, setProjectTitle] = useState((location.state?.projectTitle && location.state.projectTitle !== '...') ? location.state.projectTitle : (projectId ? '...' : 'Project'))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [centreOptions, setCentreOptions] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedDistrictId, setSelectedDistrictId] = useState('')
  const [selectedCentreId, setSelectedCentreId] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const projectType = searchParams.get('projectType') || searchParams.get('project_type') || location.state?.projectType || ''
  const isWrittenExam = projectType === 'writtenExam' || projectType === 'written_exam'
  
  const [isRateModalOpen, setIsRateModalOpen] = useState(false)
  const [rates, setRates] = useState({})
  const [savingRates, setSavingRates] = useState(false)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [manualUploadOpen, setManualUploadOpen] = useState(false)
  const [manualCandidateSearch, setManualCandidateSearch] = useState('')
  const [manualSelectedCandidates, setManualSelectedCandidates] = useState(new Set())
  const [manualSelectedDates, setManualSelectedDates] = useState(new Set())
  const [manualSelectedStatus, setManualSelectedStatus] = useState('present')
  const [manualLocationId, setManualLocationId] = useState('')
  const [manualDistrictId, setManualDistrictId] = useState('')
  const [manualCentreId, setManualCentreId] = useState('')
  const [manualCentreOptions, setManualCentreOptions] = useState([])
  const [projectMembers, setProjectMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  // React-day-picker will be used inline for date selection
  const [paymentApplyScope, setPaymentApplyScope] = useState('all')
  const [paymentDateScope, setPaymentDateScope] = useState('all')
  const [addonFromDate, setAddonFromDate] = useState(fromDate || projectDates.start || '')
  const [addonToDate, setAddonToDate] = useState(toDate || projectDates.end || '')
  const [allowances, setAllowances] = useState([]) // Changed to array for dynamic add-ons
  const [allowanceCandidates, setAllowanceCandidates] = useState({}) // Track which candidates get which allowances
  const [allowanceDates, setAllowanceDates] = useState({}) // Track date ranges for allowances
  const [currentAllowanceType, setCurrentAllowanceType] = useState('')
  const [currentAllowanceAmount, setCurrentAllowanceAmount] = useState('')
  const [currentAllowanceScope, setCurrentAllowanceScope] = useState('all') // all, selected
  const [currentAllowanceDateScope, setCurrentAllowanceDateScope] = useState('all') // all, range, specific
  const [currentAllowanceFromDate, setCurrentAllowanceFromDate] = useState('')
  const [currentAllowanceToDate, setCurrentAllowanceToDate] = useState('')
  const [currentAllowanceSpecificDates, setCurrentAllowanceSpecificDates] = useState([])
  const [selectedAllowanceCandidates, setSelectedAllowanceCandidates] = useState(new Set())
  const [candidateSelectionModalOpen, setCandidateSelectionModalOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamGroups, setTeamGroups] = useState([])
  const [teamScope, setTeamScope] = useState('selected')
  const [teamEditModalOpen, setTeamEditModalOpen] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [editingTeamMembers, setEditingTeamMembers] = useState(new Set())
  const [attendanceRequests, setAttendanceRequests] = useState({})
  const [activeRequestCell, setActiveRequestCell] = useState('')
  const [attendanceRequestDraft, setAttendanceRequestDraft] = useState({
    requestKey: '',
    requestedStatus: '',
    projectId: projectId || '',
    locationId: '',
    districtId: '',
    centreId: ''
  })
  const [regularProjectOptions, setRegularProjectOptions] = useState([])
  const [requestLocationOptions, setRequestLocationOptions] = useState([])
  const [requestCentreOptions, setRequestCentreOptions] = useState([])
  const [generatingExcel, setGeneratingExcel] = useState(false) // New state for Excel generation loading
  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidateRoleFilter, setCandidateRoleFilter] = useState('')
  const [defaultStartTime, setDefaultStartTime] = useState('09:00')
  const [defaultEndTime, setDefaultEndTime] = useState('17:00')
  const [standardWorkingHours, setStandardWorkingHours] = useState(9)
  
  // Manual candidate entry states
  const [manualCandidateMode, setManualCandidateMode] = useState('registered') // 'registered' or 'manual'
  const [manuallyAddedCandidates, setManuallyAddedCandidates] = useState([])
  const [manualDesignation, setManualDesignation] = useState('')
  const [manualRole, setManualRole] = useState('Consultant')
  const [manualCandidateForm, setManualCandidateForm] = useState({
    name: '',
    mobile: '',
    aadhaar: ''
  })


  const fetchLocationOptions = useCallback(async () => {
    if (!projectId) return
    try {
      const response = isWrittenExam
        ? await recruiterAPI.getProjectDistricts(projectId)
        : await recruiterAPI.getProjectLocations(projectId)
      const payload = response?.data ?? {}
      const rawList = isWrittenExam
        ? Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.districts) ? payload.districts : []
        : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.locations) ? payload.locations : []
      const list = rawList.map(item => {
        if (item && typeof item === 'object') {
          return { id: String(item.id || item.districtId || item.locationId || ''), name: String(item.name || item.district || item.location || '') }
        }
        return { id: String(item), name: String(item) }
      }).filter(l => l.id)
      
      if (isWrittenExam) {
        setDistrictOptions(list)
      } else {
        setLocationOptions(list)
      }
    } catch (e) {
      if (isWrittenExam) {
        setDistrictOptions([])
      } else {
        setLocationOptions([])
      }
    }
  }, [projectId, isWrittenExam])

  const fetchCentreOptions = useCallback(async () => {
    if (!projectId) return
    const filterId = isWrittenExam ? selectedDistrictId : selectedLocationId
    if (!filterId) return
    try {
      const response = isWrittenExam
        ? await recruiterAPI.getDistrictCentres(projectId, filterId)
        : await recruiterAPI.getLocationCentres(projectId, filterId)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.centres) ? payload.centres : []
      const list = rawList.map(item => {
        if (item && typeof item === 'object') {
          return { id: String(item.id || item.centreId || ''), name: String(item.name || item.centre || '') }
        }
        return { id: String(item), name: String(item) }
      }).filter(c => c.id)
      setCentreOptions(list)
    } catch (e) {
      setCentreOptions([])
    }
  }, [projectId, selectedLocationId, selectedDistrictId, isWrittenExam])

  const normalizeOptionListForSelect = (rawList) => {
    if (!Array.isArray(rawList)) return []
    return rawList
      .map((item) => {
        if (!item) return null
        if (typeof item === 'object') {
          const id = String(item.id ?? item.project_id ?? item.value ?? item.key ?? item._id ?? item.projectId ?? item.locationId ?? item.centreId ?? '')
          const name = String(item.name ?? item.project_name ?? item.title ?? item.label ?? item.value ?? item.centre ?? item.location ?? id)
          return id ? { id, name } : null
        }
        const value = String(item || '')
        return value ? { id: value, name: value } : null
      })
      .filter(Boolean)
  }

  const fetchManualCentreOptions = useCallback(async (areaId) => {
    if (!projectId || !areaId) {
      setManualCentreOptions([])
      return
    }
    try {
      const response = isWrittenExam
        ? await recruiterAPI.getDistrictCentres(projectId, areaId)
        : await recruiterAPI.getLocationCentres(projectId, areaId)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.centres) ? payload.centres : []
      const list = normalizeOptionListForSelect(rawList).map((item) => ({ id: item.id, name: item.name }))
      setManualCentreOptions(list)
    } catch (e) {
      setManualCentreOptions([])
    }
  }, [projectId, isWrittenExam])

  const fetchRegularProjectOptions = useCallback(async () => {
    if (isWrittenExam) {
      setRegularProjectOptions([])
      return
    }
    try {
      const response = await recruiterAPI.getProjectSuggestions('', 200, 'regular')
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
      setRegularProjectOptions(normalizeOptionListForSelect(rawList))
    } catch (e) {
      setRegularProjectOptions([])
    }
  }, [isWrittenExam])

  const fetchRequestLocationOptions = useCallback(async (projectKey) => {
    if (!projectKey) {
      setRequestLocationOptions([])
      return
    }
    try {
      const response = await recruiterAPI.getProjectLocations(projectKey)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.locations)
          ? payload.locations
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload)
              ? payload
              : []
      setRequestLocationOptions(normalizeOptionListForSelect(rawList))
    } catch (e) {
      setRequestLocationOptions([])
    }
  }, [])

  const fetchRequestCentreOptions = useCallback(async (areaId) => {
    if (!projectId || !areaId) {
      setRequestCentreOptions([])
      return
    }
    try {
      const response = isWrittenExam
        ? await recruiterAPI.getDistrictCentres(projectId, areaId)
        : await recruiterAPI.getLocationCentres(projectId, areaId)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.centres) ? payload.centres : []
      const list = rawList.map(item => {
        if (item && typeof item === 'object') {
          return { id: String(item.id || item.centreId || ''), name: String(item.name || item.centre || '') }
        }
        return { id: String(item), name: String(item) }
      }).filter(c => c.id)
      setRequestCentreOptions(list)
    } catch (e) {
      setRequestCentreOptions([])
    }
  }, [projectId, isWrittenExam])

  const isLocationRequiredForStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase()
    return ['present', 'half'].includes(normalized)
  }

  const openAttendanceRequestPopover = useCallback((candidate, date) => {
    const requestKey = attendanceRequestKey(candidate, date)
    if (activeRequestCell === requestKey) {
      setActiveRequestCell('')
      setAttendanceRequestDraft({
        requestKey: '',
        requestedStatus: '',
        projectId: projectId || '',
        locationId: '',
        districtId: '',
        centreId: ''
      })
      setRequestCentreOptions([])
      setRequestLocationOptions([])
      return
    }

    const defaultLocationId = selectedLocationId || locationId || candidate.locationId || ''
    const defaultDistrictId = selectedDistrictId || districtId || candidate.districtId || candidate.locationId || ''
    const defaultCentreId = selectedCentreId || centreId || candidate.centreId || ''
    const defaultProjectId = projectId || ''

    setActiveRequestCell(requestKey)
    setAttendanceRequestDraft({
      requestKey,
      requestedStatus: '',
      projectId: defaultProjectId,
      locationId: defaultLocationId,
      districtId: defaultDistrictId,
      centreId: defaultCentreId
    })

    if (isWrittenExam && defaultDistrictId) {
      fetchRequestCentreOptions(defaultDistrictId)
    }
    if (!isWrittenExam && defaultProjectId) {
      fetchRequestLocationOptions(defaultProjectId)
    }
  }, [activeRequestCell, centreId, districtId, fetchRequestCentreOptions, fetchRequestLocationOptions, isWrittenExam, locationId, projectId, selectedCentreId, selectedDistrictId, selectedLocationId])

  const fetchSummary = useCallback(async () => {
    if (!projectId) return
    setStatsLoading(true)
    try {
      const response = await (isWrittenExam
        ? recruiterAPI.getWrittenExamPaymentSummary({
            projectId,
            districtId: selectedDistrictId || undefined,
            centreId: selectedCentreId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            search: debouncedSearch || undefined,
            role: roleFilter || undefined
          })
        : recruiterAPI.getPaymentSummary({
            projectId,
            locationId: selectedLocationId || undefined,
            centreId: selectedCentreId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            search: debouncedSearch || undefined,
            role: roleFilter || undefined
          })
      )
      const data = response?.data?.data || response?.data || { totalResources: 0, totalMandays: 0 }
      setStats(data)
    } catch (e) {
      setStats({ totalResources: 0, totalMandays: 0 })
    } finally {
      setStatsLoading(false)
    }
  }, [projectId, selectedLocationId, selectedDistrictId, selectedCentreId, fromDate, toDate, isWrittenExam, debouncedSearch, roleFilter])

  const fetchRates = useCallback(async () => {
    if (!projectId) return
    try {
      const response = await recruiterAPI.getProjectRates(projectId)
      const data = response?.data?.data || response?.data || {}
      setRates(data)
    } catch (e) {
      console.warn('Failed to load rates')
    }
  }, [projectId])

  const addManualCandidate = () => {
    const nameValue = String(manualCandidateForm.name || '').trim()
    const mobileValue = String(manualCandidateForm.mobile || '').trim()
    const aadhaarValue = String(manualCandidateForm.aadhaar || '').trim()

    if (!nameValue || !mobileValue) {
      alert('Please fill in name and mobile number')
      return
    }
    if (!/^[0-9]{10}$/.test(mobileValue)) {
      alert('Please enter a valid 10-digit mobile number.')
      return
    }
    if (!/^[0-9]{12}$/.test(aadhaarValue)) {
      alert('Please enter a valid 12-digit Aadhaar number.')
      return
    }
    if (!manualDesignation.trim()) {
      alert('Please select a designation for the attendance entry.')
      return
    }
    if (!manualRole.trim()) {
      alert('Please select a role for the attendance entry.')
      return
    }

    const newCandidate = {
      id: `manual-${Date.now()}-${Math.random()}`,
      name: nameValue,
      mobile: mobileValue,
      aadhaar: aadhaarValue,
      designation: manualDesignation,
      role: manualRole,
      isManual: true
    }

    setManuallyAddedCandidates(prev => [...prev, newCandidate])
    setManualCandidateForm({
      name: '',
      mobile: '',
      aadhaar: ''
    })
  }

  const removeManualCandidate = (candidateId) => {
    setManuallyAddedCandidates(prev => prev.filter(c => c.id !== candidateId))
  }

  const resetManualCandidateForm = () => {
    setManualCandidateForm({
      name: '',
      mobile: '',
      aadhaar: ''
    })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setOffset(0)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const response = await (isWrittenExam
        ? recruiterAPI.getWrittenExamPaymentReports({
            projectId: projectId || undefined,
            districtId: selectedDistrictId || undefined,
            centreId: selectedCentreId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            limit: limit,
            offset: offset,
            search: debouncedSearch || undefined,
            role: roleFilter || undefined
          })
        : recruiterAPI.getPaymentReports({
            projectId: projectId || undefined,
            locationId: selectedLocationId || undefined,
            centreId: selectedCentreId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            limit: limit,
            offset: offset,
            search: debouncedSearch || undefined,
            role: roleFilter || undefined
          })
      )
      const payload = response?.data ?? {}
      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.records) ? payload.records : []
      // Preserve explicit absent records so candidates still render even if only absent days are returned.
      const filteredRows = rows
      setAttendance(filteredRows)
      setAttendanceRequests(extractAttendanceRequestsFromRows(filteredRows))
      setTotal(payload?.total || payload?.count || payload?.total_count || rows.length)

      // Populate project dates from response to ensure timeline bounds are respected (e.g. on page refresh)
      const startDateFromResp = payload?.startDate || payload?.start_date || ''
      const endDateFromResp = payload?.endDate || payload?.end_date || ''
      if (startDateFromResp && endDateFromResp) {
        setProjectDates({ 
          start: startDateFromResp.split('T')[0], 
          end: endDateFromResp.split('T')[0] 
        })
      }
    } catch (error) {
      setAttendance([])
      setAttendanceRequests({})
    } finally {
      setLoading(false)
    }
  }, [projectId, selectedLocationId, selectedDistrictId, selectedCentreId, fromDate, toDate, limit, offset, isWrittenExam, debouncedSearch, roleFilter])

  const extractAttendanceRequestsFromRows = (rows) => {
    const parsed = {}

    const normalizeRequestStatus = (value) => {
      const status = String(value || '').trim().toLowerCase()
      if (['present', 'p', 'pr', '1'].includes(status)) return 'present'
      if (['half', 'h'].includes(status)) return 'half'
      if (['absent', 'a', 'ab'].includes(status)) return 'absent'
      return ''
    }

    const getDateValue = (value) => {
      if (!value && value !== 0) return ''
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
        const parsed = new Date(trimmed)
        return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString().split('T')[0]
      }
      if (value instanceof Date) return value.toISOString().split('T')[0]
      return ''
    }

    const addRequest = (candidate, date, status) => {
      if (!candidate || !date || !status) return
      const requestDate = getDateValue(date)
      const requestStatus = normalizeRequestStatus(status)
      if (!requestDate || !requestStatus) return
      parsed[`${candidateKeyFor(candidate)}::${requestDate}`] = requestStatus
    }

    rows.forEach((row) => {
      const candidate = row.candidate || row
      if (!candidate || typeof candidate !== 'object') return

      if (candidate.attendance && typeof candidate.attendance === 'object') {
        Object.entries(candidate.attendance).forEach(([date, value]) => {
          if (value && typeof value === 'object') {
            addRequest(candidate, date, value.requestedStatus || value.requested_status || value.requested || value.toStatus || value.to_status)
          }
        })
      }

      const requestLists = [
        candidate.attendanceRequests,
        candidate.attendance_change_requests,
        candidate.attendanceChangeRequests,
        candidate.changeRequests,
        candidate.requestHistory,
        candidate.requests
      ]

      requestLists.forEach((list) => {
        if (!Array.isArray(list)) return
        list.forEach((req) => {
          if (!req || typeof req !== 'object') return
          addRequest(candidate, req.date || req.requestedDate || req.requested_date || req.requested_at || req.requestedAt, req.requestedStatus || req.requested_status || req.requested || req.toStatus || req.to_status || req.status)
        })
      })

      if (candidate.requestedStatus || candidate.requested_status || candidate.requested || candidate.toStatus || candidate.to_status) {
        addRequest(candidate, candidate.date || candidate.attendanceDate || candidate.requestedDate || candidate.requested_date, candidate.requestedStatus || candidate.requested_status || candidate.requested || candidate.toStatus || candidate.to_status)
      }
    })

    return parsed
  }

  useEffect(() => {
    const handleClickOutsideRequestCell = (event) => {
      if (!event.target.closest('.attendance-request-cell')) {
        setActiveRequestCell('')
      }
    }

    document.addEventListener('click', handleClickOutsideRequestCell)
    return () => document.removeEventListener('click', handleClickOutsideRequestCell)
  }, [])

  useEffect(() => {
    fetchLocationOptions()
    fetchRates()
    fetchRegularProjectOptions()
  }, [projectId, fetchLocationOptions, fetchRates, fetchRegularProjectOptions])

  useEffect(() => {
    if (isWrittenExam && selectedDistrictId) {
      fetchCentreOptions()
    } else if (!isWrittenExam && selectedLocationId) {
      fetchCentreOptions()
    } else {
      setCentreOptions([])
    }
  }, [selectedLocationId, selectedDistrictId, fetchCentreOptions, isWrittenExam])

  useEffect(() => {
    if (isWrittenExam) {
      setSelectedDistrictId(districtId || locationId)
      setSelectedLocationId('')
    } else {
      setSelectedLocationId(locationId)
      setSelectedDistrictId('')
    }
    setSelectedCentreId(centreId)
  }, [locationId, districtId, centreId, isWrittenExam])

  useEffect(() => {
    fetchAttendance()
    fetchSummary()
  }, [fetchAttendance, fetchSummary, selectedLocationId])

  // Auto-calculate standard working hours based on start and end times
  useEffect(() => {
    if (defaultStartTime && defaultEndTime) {
      const start = new Date(`2000-01-01T${defaultStartTime}:00`)
      const end = new Date(`2000-01-01T${defaultEndTime}:00`)
      const diffMs = end - start
      const diffHours = diffMs / (1000 * 60 * 60)
      const calculatedHours = Math.max(0, diffHours)
      setStandardWorkingHours(calculatedHours)
    }
  }, [defaultStartTime, defaultEndTime])

  // Clear overtime allowance type if standard hours becomes less than 9
  useEffect(() => {
    if (standardWorkingHours <= 9) {
      // Clear current allowance form if it's overtime
      if (currentAllowanceType === 'Overtime') {
        setCurrentAllowanceType('')
        setCurrentAllowanceAmount('')
        setCurrentAllowanceScope('all')
        setCurrentAllowanceDateScope('all')
        setCurrentAllowanceFromDate('')
        setCurrentAllowanceToDate('')
        setCurrentAllowanceSpecificDates([]) // This line is correct
        setSelectedAllowanceCandidates(new Set()) // Corrected line
      }
      
      // Remove any existing overtime allowances
      setAllowances(prev => prev.filter(allowance => allowance.type !== 'Overtime'))
    }
  }, [standardWorkingHours, currentAllowanceType])

  const handleSaveRates = async () => {
    if (!projectId) return
    setSavingRates(true)
    try {
      await recruiterAPI.saveProjectRates(projectId, rates)
      alert('Daily rates saved successfully.')
    } catch (e) {
      alert('Failed to save rates.')
    } finally {
      setSavingRates(false)
    }
  }

  const normalizeStatus = (value) => {
    const status = String(value || '').trim().toLowerCase()
    if (['present', 'p', 'pr', '1'].includes(status)) return 'present'
    if (['late', 'l'].includes(status)) return 'late'
    if (['half', 'h'].includes(status)) return 'half'
    if (['absent', 'a', 'ab'].includes(status)) return 'absent'
    return 'present'
  }

  const normalizeRequestStatus = (value) => {
    const status = String(value || '').trim().toLowerCase()
    if (['present', 'p', 'pr', '1', 'late', 'l'].includes(status)) return 'present'
    if (['half', 'h'].includes(status)) return 'half'
    if (['absent', 'a', 'ab'].includes(status)) return 'absent'
    return ''
  }

  const normalizeRole = (value) => {
    const raw = String(value || '').trim().toLowerCase()
    if (raw.includes('core')) return 'Core Team'
    return 'Consultant'
  }

  const normalizeDate = (value) => {
    if (!value && value !== 0) return ''
    if (value instanceof Date) return value.toISOString().split('T')[0]
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value)
      if (date) {
        return new Date(Date.UTC(date.y, date.m - 1, date.d)).toISOString().split('T')[0]
      }
    }
    const parsed = new Date(String(value).trim())
    return Number.isNaN(parsed.getTime()) ? String(value).trim() : parsed.toISOString().split('T')[0]
  }

  const normalizeCandidateId = (candidate) => String(candidate?.id || candidate?.candidate_id || candidate?.registration_id || candidate?.candidateId || candidate?.user_id || candidate?.worker_id || '')

  const normalizeCandidateRecord = (candidate) => ({
    id: normalizeCandidateId(candidate),
    name: candidate?.name || candidate?.fullName || candidate?.candidate_name || '',
    email: candidate?.email || candidate?.candidate_email || '',
    mobile: candidate?.whatsapp || candidate?.mobile || candidate?.phone || candidate?.contact || candidate?.phone_number || candidate?.mobile_number || '',
    aadhaar: candidate?.aadhaar || candidate?.aadhar || candidate?.aadhaarNumber || candidate?.aadhar_number || '',
    designation: candidate?.designation || candidate?.job_role || candidate?.role || 'Resource',
    role: candidate?.role || candidate?.designation || 'Consultant',
    locationId: String(candidate?.location_id || candidate?.locationId || candidate?.location || ''),
    locationName: candidate?.location_name || candidate?.locationName || candidate?.location || '',
    districtId: String(candidate?.district_id || candidate?.districtId || candidate?.district || ''),
    districtName: candidate?.district_name || candidate?.districtName || candidate?.district || '',
    centreId: String(candidate?.centre_id || candidate?.centreId || candidate?.centre || candidate?.center_id || candidate?.centerId || candidate?.center || ''),
    centreName: candidate?.centre_name || candidate?.centreName || candidate?.centre || candidate?.center_name || candidate?.centerName || candidate?.center || ''
  })

  const resolveOptionLabel = (id, options) => options.find(o => String(o.id) === String(id))?.name || ''

  const fetchProjectMembers = useCallback(async () => {
    if (!projectId || !manualUploadOpen) return
    setMembersLoading(true)
    try {
      const params = {
        project: projectId,
        limit: 500,
        search: manualCandidateSearch || undefined
      }
      const response = await recruiterAPI.getCandidates(params)
      const payload = response?.data?.data || response?.data || {}
      const list = payload.items || payload.candidates || payload.results || payload.data || []
      setProjectMembers(list)
    } catch (err) {
      setProjectMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [projectId, manualCandidateSearch, manualUploadOpen])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (manualUploadOpen) fetchProjectMembers()
    }, 500)
    return () => clearTimeout(timer)
  }, [manualCandidateSearch, manualUploadOpen, fetchProjectMembers])

  // manual date selection is handled inline via react-day-picker

  // sync handled by DayPicker onSelect

  // allowance-specific date selection is handled inline via react-day-picker

  // DayPicker keeps `currentAllowanceSpecificDates` in sync via its onSelect handler

  const availableProjectDates = useMemo(() => {
    if (!projectDates.start || !projectDates.end) return []
    const dates = []
    let curr = new Date(projectDates.start)
    const last = new Date(projectDates.end)
    if (Number.isNaN(curr.getTime()) || Number.isNaN(last.getTime())) return []
    
    let safety = 0
    while (curr <= last && safety < 365) {
      dates.push(curr.toISOString().split('T')[0])
      curr.setDate(curr.getDate() + 1)
      safety++
    }
    return dates
  }, [projectDates.start, projectDates.end])

  const saveManualAttendance = async () => {
    if (manualSelectedCandidates.size === 0 && manuallyAddedCandidates.length === 0) {
      alert('Please select at least one candidate.')
      return
    }
    if (manualSelectedDates.size === 0) {
      alert('Please select at least one date.')
      return
    }
    if (!manualDesignation.trim()) {
      alert('Please select a designation for manual attendance.')
      return
    }
    if (!manualRole.trim()) {
      alert('Please select a role for manual attendance.')
      return
    }

    const records = []
    const chosenDesignation = manualDesignation.trim()
    const chosenRole = manualRole.trim()
    const candidateLocationName = isWrittenExam ? '' : resolveOptionLabel(manualLocationId, locationOptions)
    const candidateDistrictName = isWrittenExam ? resolveOptionLabel(manualDistrictId, districtOptions) : ''
    const candidateCentreName = isWrittenExam ? resolveOptionLabel(manualCentreId, manualCentreOptions) : ''
    
    // Handle registered candidates
    if (manualSelectedCandidates.size > 0) {
      const selectedMembersList = projectMembers.filter((m) => {
        const id = normalizeCandidateId(m)
        return id && manualSelectedCandidates.has(id)
      })

      selectedMembersList.forEach((member) => {
        const candidate = normalizeCandidateRecord(member)
        records.push({
          projectId,
          candidate_id: candidate.id,
          portal: 'registered',
          candidate_name: candidate.name,
          aadhaar: candidate.aadhaar,
          mobile: candidate.mobile,
          whatsapp: candidate.mobile,
          designation: chosenDesignation,
          role: chosenRole,
          dates: Array.from(manualSelectedDates).sort(),
          status: manualSelectedStatus,
          location_id: isWrittenExam ? '' : (manualLocationId || ''),
          location_name: candidateLocationName || '',
          district_id: isWrittenExam ? (manualDistrictId || '') : '',
          district_name: candidateDistrictName || '',
          centre_id: isWrittenExam ? (manualCentreId || '') : '',
          centre_name: candidateCentreName || ''
        })
      })
    }
    
    // Handle manually added candidates
    if (manuallyAddedCandidates.length > 0) {
      manuallyAddedCandidates.forEach((candidate) => {
        records.push({
          projectId,
          candidate_id: null,
          portal: 'manual',
          candidate_name: candidate.name,
          aadhaar: candidate.aadhaar || '',
          mobile: candidate.mobile,
          whatsapp: candidate.mobile,
          designation: chosenDesignation,
          role: chosenRole,
          dates: Array.from(manualSelectedDates).sort(),
          status: manualSelectedStatus,
          location_id: isWrittenExam ? '' : (manualLocationId || ''),
          location_name: candidateLocationName || '',
          district_id: isWrittenExam ? (manualDistrictId || '') : '',
          district_name: candidateDistrictName || '',
          centre_id: isWrittenExam ? (manualCentreId || '') : '',
          centre_name: candidateCentreName || ''
        })
      })
    }

    if (records.length === 0) {
      alert('No valid candidates were selected for upload.')
      return
    }

    setLoading(true)
    try {
      await recruiterAPI.uploadManualAttendance({ projectId, records })
      fetchAttendance()
      fetchSummary()
      setManualUploadOpen(false)
      const totalCandidates = manualSelectedCandidates.size + manuallyAddedCandidates.length
      alert(`Manual attendance applied for ${totalCandidates} candidates across ${manualSelectedDates.size} dates.`)
    } catch (e) {
      alert('Failed to save manual attendance.')
    } finally {
      setLoading(false)
    }
  }

  const openManualUploadModal = () => {
    setManualSelectedCandidates(new Set())
    setManualSelectedDates(new Set())
    setManualLocationId(selectedLocationId)
    setManualDistrictId(selectedDistrictId)
    setManualCentreId(selectedCentreId)
    setManualCentreOptions(centreOptions)
    setManualCandidateMode('registered')
    setManuallyAddedCandidates([])
    resetManualCandidateForm()
    setManualUploadOpen(true)
  }

  const handleRoleAssignment = async (candidate, newRole) => {
    const candidateId = candidate.id
    const key = `${candidate.id}-${candidate.designation}-${candidate.locationId}-${candidate.centreId || ''}`
    try {
      await recruiterAPI.updateCandidateRole({
        candidateId,
        projectId,
        role: newRole,
        name: candidate.name,
        mobile: candidate.mobile,
        aadhaar: candidate.aadhaar,
        user_id: user.userId // Include user_id from auth context
      })
      setAttendance(prev => prev.map(record => {
        const id = record.candidate_id || record.id || record.worker_id
        const designation = record.designation || 'Resource'
        const locId = record.location_id || record.location || 'Default'
        const centreKey = record.centre_id || record.centreId || record.centre || record.center_id || record.centerId || record.center || ''
        const recordKey = `${id}-${designation}-${locId}-${centreKey}`
        if (recordKey === key) {
          return { ...record, role: newRole }
        }
        return record
      }))
    } catch (e) {
      alert('Failed to update role assignment.')
    }
  }

  useEffect(() => {
    if (paymentDateScope === 'all') {
      setAddonFromDate(fromDate || projectDates.start || '')
      setAddonToDate(toDate || projectDates.end || '')
    }
  }, [paymentDateScope, fromDate, projectDates])

  const matrix = useMemo(() => {
    const candidatesMap = {}
    const datesSet = new Set()

    attendance.forEach(record => {
      const id = record.candidate_id || record.id || record.worker_id || record.aadhaar || record.mobile || record.candidate_name || record.worker || ''
      const designation = record.designation || 'Resource'
      const locId = record.location_id || record.location || 'Default'
      const locName = record.location_name || record.location || 'Site'
      const districtKey = record.district_id || record.districtId || record.district || ''
      const districtName = record.district_name || record.districtName || record.district || ''
      const role = record.role ? String(record.role).trim() : 'Consultant'
      const centreKey = record.centre_id || record.centreId || record.centre || record.center_id || record.centerId || record.center || ''
      const centreName = record.centre_name || record.centreName || record.centre || record.center_name || record.centerName || record.center || ''
      
      if (!id) return

      // Group by unique combination of Candidate ID, Position, Location, and Centre
      const key = `${id}-${designation}-${locId}-${centreKey}`

      if (!candidatesMap[key]) {
        candidatesMap[key] = {
          id,
          name: record.candidate_name || record.worker_name || record.worker || 'Unknown',
          email: record.email || record.candidate_email || record.candidateEmail || '',
          aadhaar: record.aadhaar || record.aadhar || record.aadhar_number || '',
          mobile: record.mobile || record.phone || record.whatsapp || '',
          designation: designation,
          role,
          locationId: locId,
          locationName: locName,
          districtId: districtKey,
          districtName,
          centreId: centreKey,
          centreName,
          clockIn: {}, // per-date
          clockOut: {}, // per-date
          attendance: {}
        }
      }

      candidatesMap[key].role = role

      const d = record.date
      if (d) {
        datesSet.add(d)
        const status = normalizeStatus(record.status)
        const existing = candidatesMap[key].attendance[d]
        // Priority logic: Present > Late > Absent
        if (!existing || status === 'present' || (status === 'late' && existing !== 'present')) {
          candidatesMap[key].attendance[d] = status
        }
        // Always store per-date clockIn/clockOut
        candidatesMap[key].clockIn[d] = record.clock_in || record.clockIn || record.check_in_time || ''
        candidatesMap[key].clockOut[d] = record.clock_out || record.clockOut || record.check_out_time || ''
      }
    })

    const parseIsoDate = (value) => {
      if (!value) return null
      if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate())
      }
      const trimmed = String(value).trim()
      const parts = trimmed.split('-')
      if (parts.length === 3) {
        const [year, month, day] = parts.map(Number)
        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
          return new Date(year, month - 1, day)
        }
      }
      const parsed = new Date(trimmed)
      if (Number.isNaN(parsed.getTime())) return null
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    }

    const startDate = parseIsoDate(fromDate || projectDates.start)
    const endDate = parseIsoDate(toDate || projectDates.end)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lastPastDate = new Date(today)
    lastPastDate.setDate(lastPastDate.getDate() - 1)

    const formatLocalDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    if (startDate && endDate && startDate <= endDate) {
      const finalEnd = endDate <= lastPastDate ? endDate : lastPastDate
      let cursor = new Date(startDate)
      while (cursor <= finalEnd) {
        datesSet.add(formatLocalDate(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    const sortedDates = Array.from(datesSet).sort()
    const filteredCandidates = Object.values(candidatesMap).filter(c => 
      (!search || c.name.toLowerCase().includes(search.toLowerCase()) || String(c.id).includes(search))
    )
    
    return { candidates: filteredCandidates, dates: sortedDates }
  }, [attendance, search, fromDate, toDate, projectDates.start, projectDates.end])

  const designations = useMemo(() => {
    return [...new Set(matrix.candidates.map(c => c.designation))]
  }, [matrix])

  useEffect(() => {
    if (!manualDesignation && designations.length > 0) {
      setManualDesignation(designations[0])
    }
  }, [designations, manualDesignation])

  const handleRateChange = (designation, value) => {
    setRates(prev => ({ ...prev, [designation]: value }))
  }

  const handleSelectAll = (checked) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedRows(new Set(matrix.candidates.map(c => `${c.id}-${c.designation}-${c.locationId}-${c.centreId || ''}`)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleRowSelect = (key, checked) => {
    const newSelected = new Set(selectedRows)
    if (checked) {
      newSelected.add(key)
    } else {
      newSelected.delete(key)
    }
    setSelectedRows(newSelected)
    setSelectAll(newSelected.size === matrix.candidates.length && matrix.candidates.length > 0)
  }

  // Helper to compute candidate key consistently
  const candidateKeyFor = (c) => {
    const id = c.id || c.candidate_id || c.worker_id || c.aadhaar || c.mobile || c.candidate_name || c.worker || ''
    const designation = c.designation || c.job_role || c.role || 'Resource'
    const locationId = c.locationId || c.location_id || c.location || 'Default'
    const centreId = c.centreId || c.centre_id || c.centre || c.centerId || c.center_id || c.center || ''
    return `${id}-${designation}-${locationId}-${centreId}`
  }

  const attendanceRequestKey = (candidate, date) => `${candidateKeyFor(candidate)}::${date}`

  const getRequestStatus = (candidate, date) => {
    const requestKey = attendanceRequestKey(candidate, date)
    if (attendanceRequests[requestKey]) return attendanceRequests[requestKey]
    if (!candidate || !date) return ''

    const normalizedDate = normalizeDate(date)
    const resolveStatusFromObject = (obj) => {
      if (!obj || typeof obj !== 'object') return ''
      return normalizeRequestStatus(
        obj.requestedStatus || obj.requested_status || obj.requested || obj.toStatus || obj.to_status
      )
    }

    if (candidate.attendance && typeof candidate.attendance === 'object') {
      const attendanceEntry = candidate.attendance[date]
      const status = resolveStatusFromObject(attendanceEntry)
      if (status) return status
    }

    const requestLists = [
      candidate.attendanceRequests,
      candidate.attendance_change_requests,
      candidate.attendanceChangeRequests,
      candidate.changeRequests,
      candidate.requestHistory,
      candidate.requests
    ]

    for (const list of requestLists) {
      if (!Array.isArray(list)) continue
      for (const req of list) {
        if (!req || typeof req !== 'object') continue
        const reqDate = normalizeDate(req.date || req.requestedDate || req.requested_date || req.requested_at || req.requestedAt)
        if (reqDate !== normalizedDate) continue
        const status = normalizeRequestStatus(
          req.requestedStatus || req.requested_status || req.requested || req.toStatus || req.to_status || req.status
        )
        if (status) return status
      }
    }

    const directDate = normalizeDate(candidate.date || candidate.attendanceDate || candidate.requestedDate || candidate.requested_date || candidate.requested_at || candidate.requestedAt)
    if (directDate === normalizedDate) {
      return normalizeRequestStatus(
        candidate.requestedStatus || candidate.requested_status || candidate.requested || candidate.toStatus || candidate.to_status
      )
    }

    return ''
  }

  const submitAttendanceChangeRequest = async (candidate, date, requestedStatusOverride = '') => {
    if (!projectId) {
      alert('Unable to submit attendance request: missing project.')
      return
    }

    const requestKey = attendanceRequestKey(candidate, date)
    const currentStatus = candidate.attendance && candidate.attendance[date] ? candidate.attendance[date] : 'absent'
    const isCurrentDraft = attendanceRequestDraft.requestKey === requestKey
    const requestedStatus = requestedStatusOverride || (isCurrentDraft ? attendanceRequestDraft.requestedStatus : '')

    if (!requestedStatus) {
      alert('Please select a status to request.')
      return
    }

    if (requestedStatus === currentStatus || (currentStatus === 'late' && requestedStatus === 'present')) {
      alert('Requested status matches the current attendance status.')
      return
    }

    const normalizeProjectType = (type) => {
      const value = String(type || '').trim().toLowerCase()
      if (value === 'written' || value === 'writtenexam' || value === 'written_exam') return 'written'
      return 'regular'
    }

    const requestProjectType = projectType ? normalizeProjectType(projectType) : (isWrittenExam ? 'written' : 'regular')
    const requestCandidateId = candidate.id || candidate.candidateId || candidate.userId
    const requestMobile = candidate.mobile || candidate.phone || ''
    const requestAadhaar = candidate.aadhaar || candidate.aadhar || candidate.aadhar_number || ''
    const requestProjectId = projectId
    const payload = {
      projectId: requestProjectId,
      candidateId: requestCandidateId,
      mobile: requestMobile,
      aadhaar: requestAadhaar,
      date,
      requestedStatus,
      currentStatus,
      projectType: requestProjectType,
      user_id: user.userId
    }

    if (isLocationRequiredForStatus(requestedStatus)) {
      if (requestProjectType === 'written') {
        const districtIdValue = isCurrentDraft ? attendanceRequestDraft.districtId : selectedDistrictId || districtId || candidate.districtId || candidate.locationId || ''
        const centreIdValue = isCurrentDraft ? attendanceRequestDraft.centreId : selectedCentreId || centreId || candidate.centreId || ''

        if (!districtIdValue) {
          alert('Please select a district before submitting the request.')
          return
        }
        if (!centreIdValue) {
          alert('Please select a centre before submitting the request.')
          return
        }

        payload.districtId = districtIdValue
        payload.district = resolveOptionLabel(districtIdValue, districtOptions) || candidate.districtName || candidate.locationName || candidate.district || ''
        payload.centreId = centreIdValue
        payload.centre = resolveOptionLabel(centreIdValue, requestCentreOptions) || candidate.centreName || candidate.centre || ''
      } else {
        const draftProjectId = isCurrentDraft ? attendanceRequestDraft.projectId : projectId
        const locationIdValue = isCurrentDraft ? attendanceRequestDraft.locationId : selectedLocationId || locationId || candidate.locationId || ''
        if (!draftProjectId) {
          alert('Please select a project before submitting the request.')
          return
        }
        if (!locationIdValue) {
          alert('Please select a location before submitting the request.')
          return
        }
        payload.projectId = draftProjectId
        payload.project = resolveOptionLabel(draftProjectId, regularProjectOptions) || projectTitle || ''
        payload.locationId = locationIdValue
        payload.location = resolveOptionLabel(locationIdValue, effectiveRequestLocationOptions) || candidate.locationName || candidate.location || ''
      }
    } else {
      if (requestProjectType === 'written') {
        payload.district = candidate.districtName || candidate.locationName || candidate.district || ''
        payload.districtId = selectedDistrictId || districtId || candidate.districtId || candidate.locationId || ''
        payload.centre = candidate.centreName || candidate.centre || ''
        payload.centreId = selectedCentreId || centreId || candidate.centreId || ''
      } else {
        const draftProjectId = isCurrentDraft ? attendanceRequestDraft.projectId : projectId
        payload.projectId = draftProjectId
        payload.project = resolveOptionLabel(draftProjectId, regularProjectOptions) || projectTitle || ''
        payload.location = candidate.locationName || candidate.location || ''
        payload.locationId = selectedLocationId || locationId || candidate.locationId || ''
      }
    }

    try {
      const response = await recruiterAPI.requestAttendanceChange(payload)
      if (response?.status === 200 || response?.status === 201) {
        setAttendanceRequests((prev) => ({
          ...prev,
          [attendanceRequestKey(candidate, date)]: normalizeRequestStatus(requestedStatus)
        }))
        setActiveRequestCell('')
        setAttendanceRequestDraft({
          requestKey: '',
          requestedStatus: '',
          locationId: '',
          districtId: '',
          centreId: ''
        })
        setRequestCentreOptions([])
        alert('Attendance change request submitted for manager approval.')
      } else {
        throw new Error('Unexpected response')
      }
    } catch (error) {
      console.error('Attendance change request failed', error)
      alert('Failed to submit attendance change request. Please try again.')
    }
  }

  const getEffectiveStatus = (candidate, date) => {
    if (!candidate || !date) return ''
    const status = candidate.attendance && candidate.attendance[date]
    return status === 'late' ? 'present' : status
  }

  // Weight for a date: present/late = 1, half = 0.5, absent/other = 0
  const getWorkedWeight = (candidate, date) => {
    const status = getEffectiveStatus(candidate, date)
    if (status === 'present' || status === 'late') return 1
    if (status === 'half') return 0.5
    return 0
  }

  const generatePaymentSheet = async () => {
    // Validate that standard working hours matches start/end time difference
    const start = new Date(`2000-01-01T${defaultStartTime}:00`)
    const end = new Date(`2000-01-01T${defaultEndTime}:00`)
    const diffMs = end - start
    const calculatedHours = Math.max(0, diffMs / (1000 * 60 * 60))

    if (Math.abs(standardWorkingHours - calculatedHours) > 0.01) {
      alert(`Standard working hours (${standardWorkingHours}) does not match the time difference between start (${defaultStartTime}) and end (${defaultEndTime}) time (${calculatedHours.toFixed(2)} hours). Please adjust the times or standard hours to match.`)
      return
    }

    const { candidates, dates } = matrix
    
    const rowSelectionKey = (c) => `${c.id}-${c.designation}-${c.locationId}-${c.centreId || ''}`
    const candidateSelection = paymentApplyScope === 'selected'
      ? candidates.filter(c => selectedRows.has(rowSelectionKey(c)))
      : candidates

    if (!candidateSelection.length) {
      alert(paymentApplyScope === 'selected' ? 'Please select at least one candidate to apply payments.' : 'No candidates available to export.')
      return
    }

    setGeneratingExcel(true) // Start loading

    const paymentConfig = {
      rates,
      allowances,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      scope: paymentApplyScope,
      dateScope: paymentDateScope,
      fromDate: addonFromDate,
      toDate: addonToDate,
      selectedCandidateIds: Array.from(selectedRows)
    }

    const activeDates = paymentDateScope === 'range'
      ? dates.filter(date => (!addonFromDate || date >= addonFromDate) && (!addonToDate || date <= addonToDate))
      : dates

    const exportDates = activeDates
    const overtimeAllowance = allowances.find(a => a.type === 'Overtime')
    const otherAllowances = allowances.filter(a => a.type !== 'Overtime')

    const summaryHeader = ['Project Name', 'Location', 'Project Start', 'Project End', 'Resources', 'Mandays', 'Applied Candidates', 'Date Scope'];
    const summaryRow = [
      projectTitle,
      selectedLocationId ? (locationOptions.find(l => l.id === selectedLocationId)?.name || selectedLocationId) : 'All Locations',
      projectDates.start || 'N/A',
      projectDates.end || 'N/A',
      stats.totalResources,
      stats.totalMandays,
      paymentApplyScope === 'selected' ? candidateSelection.length : 'All',
      paymentDateScope === 'range' ? `${addonFromDate || 'N/A'} to ${addonToDate || 'N/A'}` : 'All Dates'
    ];

    const parseAllowance = (allowance, candidate, eligibleDates) => {
      if (allowance.scope === 'selected') {
        const candidateKey = `${candidate.id}-${candidate.designation}-${candidate.locationId}`
        if (!allowance.candidates.includes(candidateKey)) {
          return 0
        }
      }

      let applicableDates = eligibleDates
      if (allowance.dateScope === 'range') {
        applicableDates = eligibleDates.filter(date =>
          (!allowance.fromDate || date >= allowance.fromDate) &&
          (!allowance.toDate || date <= allowance.toDate)
        )
      } else if (allowance.dateScope === 'specific') {
        applicableDates = eligibleDates.filter(date => allowance.specificDates.includes(date))
      }

      return allowance.amount * applicableDates.length
    }

    const parseOvertimeForDate = (candidate, date) => {
      const status = getEffectiveStatus(candidate, date)
      if (status !== 'present' && status !== 'late') return { hours: 0, amount: 0 }

      const otAllowance = allowances.find(a => a.type === 'Overtime')
      if (!otAllowance) return { hours: 0, amount: 0 }

      // Check if candidate is eligible for overtime allowance
      const isEligible = otAllowance.scope === 'all' ||
        otAllowance.candidates.includes(`${candidate.id}-${candidate.designation}-${candidate.locationId}`)
      if (!isEligible) return { hours: 0, amount: 0 }

      // Check date scope
      if (otAllowance.dateScope === 'range') {
        const inRange = (!otAllowance.fromDate || date >= otAllowance.fromDate) &&
          (!otAllowance.toDate || date <= otAllowance.toDate)
        if (!inRange) return { hours: 0, amount: 0 }
      } else if (otAllowance.dateScope === 'specific') {
        if (!otAllowance.specificDates.includes(date)) return { hours: 0, amount: 0 }
      }
      // For 'all' dateScope, no additional check needed

      // Always use per-day clockIn/clockOut
      const clockIn = candidate.clockIn && candidate.clockIn[date] ? candidate.clockIn[date] : ''
      const clockOut = candidate.clockOut && candidate.clockOut[date] ? candidate.clockOut[date] : ''

      // If no valid clockIn/clockOut for this date, do not count overtime
      if (!clockIn || !clockOut || !/^\d{2}:\d{2}$/.test(clockIn) || !/^\d{2}:\d{2}$/.test(clockOut)) {
        return { hours: 0, amount: 0 }
      }

      const [inHour, inMin] = clockIn.split(':').map(Number)
      const [outHour, outMin] = clockOut.split(':').map(Number)
      const actualHours = (outHour + outMin / 60) - (inHour + inMin / 60)
      const overtimeHours = Math.max(0, Math.floor(actualHours - Number(standardWorkingHours)))
      if (overtimeHours <= 0) return { hours: 0, amount: 0 }
      return { hours: overtimeHours, amount: overtimeHours * otAllowance.amount }
    }

    const createCell = (val, isBold = false, horizontal = 'left', isTitle = false, hasBorder = true) => ({
      v: val,
      t: typeof val === 'number' ? 'n' : 's',
      s: {
        font: { 
          bold: isBold, 
          sz: isTitle ? 11 : 10, 
          name: 'Arial' 
        },
        alignment: { horizontal: horizontal, vertical: 'center', wrapText: true },
        border: hasBorder ? {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        } : {}
      }
    });

    const sortCandidatesForExport = (list) => {
      return list.slice().sort((a, b) => {
        if (isWrittenExam) {
          const districtA = String(a.districtName || a.districtId || '').toLowerCase()
          const districtB = String(b.districtName || b.districtId || '').toLowerCase()
          if (districtA !== districtB) return districtA.localeCompare(districtB)

          const centreA = String(a.centreName || a.centreId || '').toLowerCase()
          const centreB = String(b.centreName || b.centreId || '').toLowerCase()
          if (centreA !== centreB) return centreA.localeCompare(centreB)
        } else {
          const locationA = String(a.locationName || a.locationId || '').toLowerCase()
          const locationB = String(b.locationName || b.locationId || '').toLowerCase()
          if (locationA !== locationB) return locationA.localeCompare(locationB)
        }

        return String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase())
      })
    }

    const buildAllowanceInfoRows = () => {
      return allowances.map(allowance => ([
        allowance.type,
        allowance.type === 'Overtime' ? `₹${allowance.amount}/hr` : `₹${allowance.amount}/day`
      ]))
    }

    const buildLocationSheet = (sheetCandidates, locationName) => {
      // Build header columns structure
      const dateColumns = exportDates.map(d => ({ date: d, label: d }))
      const allowanceColumns = otherAllowances.flatMap(a => [
        { name: `${a.type}/Day`, type: 'allowanceRate', allowanceType: a.type },
        { name: `Total ${a.type}`, type: 'allowanceTotal', allowanceType: a.type }
      ])

      const sortedCandidates = sortCandidatesForExport(sheetCandidates)
      const exportData = sortedCandidates.map((c, idx) => {
        const workedDays = exportDates.reduce((sum, date) => sum + getWorkedWeight(c, date), 0)

        const rate = Number(rates[c.designation] || 0)
        const totalAmount = workedDays * rate

        // Calculate all allowances based on worked days
        const allowanceValues = {}
        otherAllowances.forEach(allowance => {
          const isEligible = allowance.scope === 'all' || 
            allowance.candidates.includes(`${c.id}-${c.designation}-${c.locationId}`)
          
          if (!isEligible) {
            allowanceValues[allowance.type] = { perDay: 0, total: 0 }
            return
          }

          let applicableDateCount = workedDays
          if (allowance.dateScope === 'range') {
            applicableDateCount = exportDates.reduce((sum, date) => {
              const status = getEffectiveStatus(c, date)
              const isWorked = status === 'present' || status === 'late' || status === 'half'
              const inRange = (!allowance.fromDate || date >= allowance.fromDate) && (!allowance.toDate || date <= allowance.toDate)
              return sum + (isWorked && inRange ? getWorkedWeight(c, date) : 0)
            }, 0)
          } else if (allowance.dateScope === 'specific') {
            applicableDateCount = exportDates.reduce((sum, date) => {
              const status = getEffectiveStatus(c, date)
              const isWorked = status === 'present' || status === 'late' || status === 'half'
              return sum + (isWorked && allowance.specificDates.includes(date) ? getWorkedWeight(c, date) : 0)
            }, 0)
          }

          allowanceValues[allowance.type] = {
            perDay: allowance.amount,
            total: allowance.amount * applicableDateCount
          }
        })

        let totalOvertime = 0
        let totalOvertimeHours = 0
        if (overtimeAllowance) {
          exportDates.forEach(date => {
            const ot = parseOvertimeForDate(c, date)
            totalOvertime += ot.amount
            totalOvertimeHours += ot.hours
          })
        }

        const totalAllowances = Object.values(allowanceValues).reduce((sum, val) => sum + val.total, 0)
        const amountToPay = totalAmount + totalAllowances + totalOvertime

        const row = {
          'S.No': idx + 1,
          'Candidate Name': c.name,
          'Candidate ID': c.id,
          'Email': c.email,
          'Aadhaar': c.aadhaar,
          'Mobile': c.mobile,
          'Designation': c.designation,
          'Role': c.role,
          ...(isWrittenExam ? {
            'District': c.districtName || c.districtId || 'Unknown',
            'Centre': c.centreName || c.centreId || 'Unknown'
          } : {
            'Location': c.locationName
          }),
          dates: exportDates.map(date => {
            const ot = overtimeAllowance ? parseOvertimeForDate(c, date) : { hours: 0, amount: 0 }
            return {
              date,
              status: (() => {
                const s = getEffectiveStatus(c, date)
                return s === 'present' || s === 'late' ? 'P' : (s === 'half' ? 'H' : (s === 'absent' ? 'A' : '-'))
              })(),
              otHours: ot.hours,
              otAmount: ot.amount
            }
          }),
          'Worked Days': workedDays,
          'Daily Rate': rate,
          'Total Amount': totalAmount,
          allowances: allowanceValues,
          'Total OT Hours': totalOvertimeHours,
          'Overtime Total': totalOvertime,
          'Allowance Total': totalAllowances,
          'Amount to be Paid': amountToPay
        }
        return row
      })

      // Build the AOA with proper headers
      const headerRow1 = ['S.No', 'Candidate Name', 'Candidate ID', 'Email', 'Aadhaar', 'Mobile', 'Designation', 'Role']
      const headerRow2 = ['', '', '', '', '', '', '', '']
      
      if (isWrittenExam) {
        headerRow1.push('District', 'Centre')
        headerRow2.push('', '')
      } else {
        headerRow1.push('Location')
        headerRow2.push('')
      }
      
      exportDates.forEach(date => {
        headerRow1.push(date)
        if (overtimeAllowance) headerRow1.push('OT Hrs')
        headerRow2.push('')
        if (overtimeAllowance) headerRow2.push('')
      })

      headerRow1.push('Worked Days', 'Daily Rate', 'Total Amount')
      headerRow2.push('', '', '')

      otherAllowances.forEach(allowance => {
        headerRow1.push(`${allowance.type}/Day`, `Total ${allowance.type}`)
        headerRow2.push('', '')
      })

      if (overtimeAllowance) {
        headerRow1.push('Overtime/Hour', 'Total OT Hours', 'Overtime Total')
        headerRow2.push('', '', '')
      }

      headerRow1.push('Allowance Total', 'Amount to be Paid')
      headerRow2.push('', '')

      const aoa = [
        [createCell(`${locationName} Payment Details`, true, 'center', true)],
        headerRow1.map(h => createCell(h, true, 'center')),
        ...exportData.map(d => {
          const row = [
            createCell(d['S.No'], false, 'center'),
            createCell(d['Candidate Name']),
            createCell(d['Candidate ID']),
            createCell(d['Email']),
            createCell(d['Aadhaar']),
            createCell(d['Mobile']),
            createCell(d['Designation']),
            createCell(d['Role'])
          ]

          if (isWrittenExam) {
            row.push(createCell(d['District']), createCell(d['Centre']))
          } else {
            row.push(createCell(d['Location']))
          }

          d.dates.forEach(dateObj => {
            row.push(createCell(dateObj.status, false, 'center'))
            if (overtimeAllowance) {
              row.push(createCell(dateObj.otHours > 0 ? dateObj.otHours : '', false, 'center'))
            }
          })

          row.push(
            createCell(d['Worked Days'], false, 'center'),
            createCell(d['Daily Rate'], false, 'right'),
            createCell(d['Total Amount'], true, 'right')
          )

          otherAllowances.forEach(allowance => {
            row.push(
              createCell(d.allowances[allowance.type]?.perDay || 0, false, 'right'),
              createCell(d.allowances[allowance.type]?.total || 0, false, 'right')
            )
          })

          if (overtimeAllowance) {
            row.push(createCell(overtimeAllowance.amount, false, 'right'))
            row.push(createCell(d['Total OT Hours'], false, 'center'))
            row.push(createCell(d['Overtime Total'], false, 'right'))
          }

          row.push(
            createCell(d['Allowance Total'], true, 'right'),
            createCell(d['Amount to be Paid'], true, 'right')
          )

          return row
        }),
        // Add totals row
        [
          createCell('TOTAL', true, 'center'),
          createCell('', true, 'center'),
          createCell('', true, 'center'),
          createCell('', true, 'center'),
          createCell('', true, 'center'),
          createCell('', true, 'center'),
          createCell('', true, 'center'),
          createCell('', true, 'center'),
          ...(isWrittenExam ? [createCell('', true, 'center'), createCell('', true, 'center')] : [createCell('', true, 'center')]),
          ...exportDates.flatMap(() => overtimeAllowance ? [createCell('', true, 'center'), createCell('', true, 'center')] : [createCell('', true, 'center')]),
          createCell(exportData.reduce((sum, d) => sum + d['Worked Days'], 0), true, 'center'),
          createCell('', true, 'right'),
          createCell(exportData.reduce((sum, d) => sum + d['Total Amount'], 0), true, 'right'),
          ...otherAllowances.flatMap((allowance, index) => [
            createCell('', true, 'right'),
            createCell(exportData.reduce((sum, d) => sum + (d.allowances[allowance.type]?.total || 0), 0), true, 'right')
          ]),
          ...(overtimeAllowance ? [
            createCell('', true, 'right'),
            createCell(exportData.reduce((sum, d) => sum + d['Total OT Hours'], 0), true, 'center'),
            createCell(exportData.reduce((sum, d) => sum + d['Overtime Total'], 0), true, 'right')
          ] : []),
          createCell(exportData.reduce((sum, d) => sum + d['Allowance Total'], 0), true, 'right'),
          createCell(exportData.reduce((sum, d) => sum + d['Amount to be Paid'], 0), true, 'right')
        ]
      ]

      const plainAoa = [
        [`${locationName} Payment Details`],
        headerRow1,
        ...exportData.map(d => {
          const row = [
            d['S.No'],
            d['Candidate Name'],
            d['Candidate ID'],
            d['Email'],
            d['Aadhaar'],
            d['Mobile'],
            d['Designation'],
            d['Role']
          ]

          if (isWrittenExam) {
            row.push(d['District'], d['Centre'])
          } else {
            row.push(d['Location'])
          }

          d.dates.forEach(dateObj => {
            row.push(dateObj.status)
            if (overtimeAllowance) {
              row.push(dateObj.otHours > 0 ? dateObj.otHours : '')
            }
          })

          row.push(
            d['Worked Days'],
            d['Daily Rate'],
            d['Total Amount']
          )

          otherAllowances.forEach(allowance => {
            row.push(
              d.allowances[allowance.type]?.perDay || 0,
              d.allowances[allowance.type]?.total || 0
            )
          })

          if (overtimeAllowance) {
            row.push(overtimeAllowance.amount)
            row.push(d['Total OT Hours'])
            row.push(d['Overtime Total'])
          }

          row.push(
            d['Allowance Total'],
            d['Amount to be Paid']
          )

          return row
        }),
        // Add totals row
        [
          'TOTAL',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          ...(isWrittenExam ? ['', ''] : ['']),
          ...exportDates.flatMap(() => overtimeAllowance ? ['', ''] : ['']),
          exportData.reduce((sum, d) => sum + d['Worked Days'], 0),
          '',
          exportData.reduce((sum, d) => sum + d['Total Amount'], 0),
          ...otherAllowances.flatMap((allowance, index) => [
            '',
            exportData.reduce((sum, d) => sum + (d.allowances[allowance.type]?.total || 0), 0)
          ]),
          ...(overtimeAllowance ? [
            '',
            exportData.reduce((sum, d) => sum + d['Total OT Hours'], 0),
            exportData.reduce((sum, d) => sum + d['Overtime Total'], 0)
          ] : []),
          exportData.reduce((sum, d) => sum + d['Allowance Total'], 0),
          exportData.reduce((sum, d) => sum + d['Amount to be Paid'], 0)
        ]
      ]

      const ws = XLSX.utils.aoa_to_sheet(aoa)
      
      // Merge title cell
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headerRow1.length - 1 } }]

      // Set optimal column widths based on actual content
      const maxCandidateName = Math.max(
        ...exportData.map(d => String(d['Candidate Name'] || '').length),
        'Candidate Name'.length,
        25
      )
      const maxAadhaar = Math.max(
        ...exportData.map(d => String(d['Aadhaar'] || '').length),
        'Aadhaar'.length,
        14
      )
      const maxMobile = Math.max(
        ...exportData.map(d => String(d['Mobile'] || '').length),
        'Mobile'.length,
        13
      )
      const maxDesignation = Math.max(
        ...exportData.map(d => String(d['Designation'] || '').length),
        'Designation'.length,
        15
      )
      const maxRole = Math.max(
        ...exportData.map(d => String(d['Role'] || '').length),
        'Role'.length,
        12
      )
      const maxLocation = Math.max(
        ...exportData.map(d => String(d['Location'] || '').length),
        'Location'.length,
        18
      )

      const colWidths = [
        { wch: Math.max(5, String(exportData.length).length, 'S.No'.length) + 2 },
        { wch: maxCandidateName + 2 },
        { wch: Math.max(15, 'Candidate ID'.length) + 2 },
        { wch: Math.max(25, 'Email'.length) + 2 },
        { wch: maxAadhaar + 2 },
        { wch: maxMobile + 2 },
        { wch: maxDesignation + 2 },
        { wch: maxRole + 2 }
      ]

      if (isWrittenExam) {
        colWidths.push({ wch: Math.max(18, 'District'.length) + 2 }, { wch: Math.max(18, 'Centre'.length) + 2 })
      } else {
        colWidths.push({ wch: maxLocation + 2 })
      }
      
      exportDates.forEach(() => {
        colWidths.push({ wch: 6 })  // Date
        if (overtimeAllowance) colWidths.push({ wch: 8 })  // OT Hrs
      })

      colWidths.push(
        { wch: 12 },  // Worked Days
        { wch: 12 },  // Daily Rate
        { wch: 14 }   // Total Amount
      )

      otherAllowances.forEach(() => {
        colWidths.push({ wch: 14 }, { wch: 14 })  // Allowance/Day, Total
      })

      if (overtimeAllowance) {
        colWidths.push({ wch: 12 }, { wch: 12 }, { wch: 14 })  // Overtime/Hour, Total OT Hours, Overtime Total
      }

      colWidths.push(
        { wch: 14 },  // Allowance Total
        { wch: 14 }   // Amount to be Paid
      )

      ws['!cols'] = colWidths
      return { ws, data: plainAoa }
    }

    const buildSummarySheet = () => {
      const allowanceInfoHeader = ['Allowance Type', 'Rate Per Day / Hour']
      const allowanceInfoRows = buildAllowanceInfoRows()

      const locationSummary = Object.values(candidateSelection.reduce((acc, candidate) => {
        const locationKey = isWrittenExam
          ? `${candidate.districtName || candidate.districtId || 'Unknown'}||${candidate.centreName || candidate.centreId || 'Unknown'}`
          : candidate.locationName || 'Unknown'
        const districtLabel = candidate.districtName || candidate.districtId || 'Unknown'
        const centreLabel = candidate.centreName || candidate.centreId || 'Unknown'

        if (!acc[locationKey]) {
          acc[locationKey] = {
            location: locationKey,
            district: districtLabel,
            centre: centreLabel,
            resources: 0,
            mandays: 0,
            feePayable: 0
          }
        }

        const workedDays = exportDates.reduce((sum, date) => sum + getWorkedWeight(candidate, date), 0)

        const rate = Number(rates[candidate.designation] || 0)
        const totalAmount = workedDays * rate

        const allowanceValues = otherAllowances.reduce((sum, allowance) => {
          const isEligible = allowance.scope === 'all' || 
            allowance.candidates.includes(`${candidate.id}-${candidate.designation}-${candidate.locationId}`)

          if (!isEligible) return sum

          let applicableDateCount = workedDays
          if (allowance.dateScope === 'range') {
            applicableDateCount = exportDates.reduce((sum, date) => {
              const status = getEffectiveStatus(candidate, date)
              const isWorked = status === 'present' || status === 'late' || status === 'half'
              return sum + (isWorked && (!allowance.fromDate || date >= allowance.fromDate) && (!allowance.toDate || date <= allowance.toDate) ? getWorkedWeight(candidate, date) : 0)
            }, 0)
          } else if (allowance.dateScope === 'specific') {
            applicableDateCount = exportDates.reduce((sum, date) => {
              const status = getEffectiveStatus(candidate, date)
              const isWorked = status === 'present' || status === 'late' || status === 'half'
              return sum + (isWorked && allowance.specificDates.includes(date) ? getWorkedWeight(candidate, date) : 0)
            }, 0)
          }

          return sum + (allowance.amount * applicableDateCount)
        }, 0)

        const overtimeTotal = overtimeAllowance ? exportDates.reduce((sum, date) => sum + parseOvertimeForDate(candidate, date).amount, 0) : 0
        const amountToPay = totalAmount + allowanceValues + overtimeTotal

        acc[locationKey].resources += 1
        acc[locationKey].mandays += workedDays
        acc[locationKey].feePayable += amountToPay
        return acc
      }, {}))

      const totalResources = locationSummary.reduce((sum, row) => sum + row.resources, 0)
      const totalMandays = locationSummary.reduce((sum, row) => sum + row.mandays, 0)
      const totalFeePayable = locationSummary.reduce((sum, row) => sum + row.feePayable, 0)

      const summaryAoa = [
        [createCell('PROJECT MANDAYS SUMMARY', true, 'center', true)],
        (isWrittenExam
          ? ['S.No', 'Project', 'District', 'Centre', 'Mandays', 'Resources', 'Fee Payable']
          : ['S.No', 'Project', 'Location', 'Mandays', 'Resources', 'Fee Payable']
        ).map(h => createCell(h, true, 'center')),
        ...locationSummary.map((row, index) => [
          createCell(index + 1, false, 'center'),
          createCell(projectTitle || 'Project', false, 'center'),
          ...(isWrittenExam ? [
            createCell(row.district, false, 'center'),
            createCell(row.centre, false, 'center')
          ] : [createCell(row.location, false, 'center')]),
          createCell(row.mandays, false, 'center'),
          createCell(row.resources, false, 'center'),
          createCell(row.feePayable, false, 'right')
        ]),
        [
          createCell('TOTAL', true, 'center'),
          createCell('', true, 'center'),
          ...(isWrittenExam ? [
            createCell('', true, 'center'),
            createCell('', true, 'center')
          ] : [createCell('', true, 'center')]),
          createCell(totalMandays, true, 'center'),
          createCell(totalResources, true, 'center'),
          createCell(totalFeePayable, true, 'right')
        ]
      ]

      // Only add allowance configuration if there are allowances
      if (allowances.length > 0) {
        summaryAoa.push(
          [createCell('', false, 'left', false, false)],
          [createCell('Allowance Configuration', true, 'center', true)],
          allowanceInfoHeader.map(h => createCell(h, true, 'center')),
          ...allowanceInfoRows.map(row => row.map(value => createCell(value, false, 'center')))
        )
      }

      const plainSummaryAoa = [
        ['PROJECT MANDAYS SUMMARY'],
        (isWrittenExam
          ? ['S.No', 'Project', 'District', 'Centre', 'Mandays', 'Resources', 'Fee Payable']
          : ['S.No', 'Project', 'Location', 'Mandays', 'Resources', 'Fee Payable']
        ),
        ...locationSummary.map((row, index) => [
          index + 1,
          projectTitle || 'Project',
          ...(isWrittenExam ? [
            row.district,
            row.centre
          ] : [row.location]),
          row.mandays,
          row.resources,
          row.feePayable
        ]),
        [
          'TOTAL',
          '',
          ...(isWrittenExam ? ['', ''] : ['']),
          totalMandays,
          totalResources,
          totalFeePayable
        ]
      ]

      // Only add allowance configuration if there are allowances
      if (allowances.length > 0) {
        plainSummaryAoa.push(
          [''],
          ['Allowance Configuration'],
          allowanceInfoHeader,
          ...allowanceInfoRows
        )
      }

      const ws = XLSX.utils.aoa_to_sheet(summaryAoa)
      const headerColumnCount = isWrittenExam ? 7 : 6
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headerColumnCount - 1 } }
      ]

      if (allowances.length > 0) {
        merges.push({ s: { r: locationSummary.length + 4, c: 0 }, e: { r: locationSummary.length + 4, c: 4 } })
      }

      ws['!merges'] = merges

      const maxLocationWidth = Math.max(
        ...locationSummary.map(row => String(row.location || '').length),
        'Location'.length,
        20
      )
      const maxDistrictWidth = Math.max(
        ...locationSummary.map(row => String(row.district || '').length),
        'District'.length,
        18
      )
      const maxCentreWidth = Math.max(
        ...locationSummary.map(row => String(row.centre || '').length),
        'Centre'.length,
        18
      )
      const maxMandaysWidth = Math.max(
        ...locationSummary.map(row => String(row.mandays || '').length),
        'Mandays'.length,
        10
      )
      const maxResourcesWidth = Math.max(
        ...locationSummary.map(row => String(row.resources || '').length),
        'Resources'.length,
        10
      )
      const maxFeePayableWidth = Math.max(
        ...locationSummary.map(row => String(row.feePayable || '').length),
        'Fee Payable'.length,
        14
      )

      const allowanceCol1Width = allowances.length > 0 ? Math.max(
        'Allowance Type'.length,
        ...allowanceInfoRows.map(row => String(row[0] || '').length),
        10
      ) + 2 : 0
      const allowanceCol2Width = allowances.length > 0 ? Math.max(
        'Rate Per Day / Hour'.length,
        ...allowanceInfoRows.map(row => String(row[1] || '').length),
        20
      ) + 2 : 0

      ws['!cols'] = [
        { wch: Math.max(5, String(locationSummary.length).length, 'S.No'.length, allowanceCol1Width) + 2 },
        { wch: Math.max(String(projectTitle || 'Project').length, 'Project'.length, allowanceCol2Width) + 2 },
        ...(isWrittenExam ? [
          { wch: maxDistrictWidth + 2 },
          { wch: maxCentreWidth + 2 }
        ] : [
          { wch: maxLocationWidth + 2 }
        ]),
        { wch: maxMandaysWidth + 2 },
        { wch: maxResourcesWidth + 2 },
        { wch: maxFeePayableWidth + 2 }
      ]
      return { ws, data: plainSummaryAoa }
    }

    const groupedCandidates = candidateSelection.reduce((acc, candidate) => {
      const groupKey = isWrittenExam
        ? `${candidate.districtName || candidate.districtId || 'Unknown'}||${candidate.centreName || candidate.centreId || 'Unknown'}`
        : candidate.locationName || 'Unknown'
      if (!acc[groupKey]) acc[groupKey] = []
      acc[groupKey].push(candidate)
      return acc
    }, {})

    const wb = XLSX.utils.book_new()
    const summarySheet = buildSummarySheet()
    XLSX.utils.book_append_sheet(wb, summarySheet.ws, 'Project Summary')

    // Excel sheet names must be <=31 chars and unique
    const usedSheetNames = new Set()
    const locationSheets = {}

    // Add a combined sheet with all selected data grouped together
    const combinedBaseName = isWrittenExam ? 'All_Districts_Centres' : 'All_Locations'
    let combinedSheetName = combinedBaseName.replace(/[^A-Za-z0-9_\-]/g, '_')
    if (combinedSheetName.length > 31) {
      combinedSheetName = combinedSheetName.slice(0, 31)
    }
    let combinedSuffix = 1
    while (usedSheetNames.has(combinedSheetName)) {
      const sfx = `_${String(combinedSuffix).padStart(2, '0')}`
      combinedSheetName = combinedSheetName.slice(0, 31 - sfx.length) + sfx
      combinedSuffix++
    }
    usedSheetNames.add(combinedSheetName)
    const combinedTitle = isWrittenExam ? 'All Districts and Centres' : 'All Locations'
    const combinedSheet = buildLocationSheet(candidateSelection, combinedTitle)
    XLSX.utils.book_append_sheet(wb, combinedSheet.ws, combinedSheetName)

    const roleGroups = [...new Set(candidateSelection.map(c => c.role).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
    const roleSheets = roleGroups.map((role) => {
      const roleCandidates = candidateSelection.filter(c => c.role === role)
      if (roleCandidates.length === 0) return null
      const roleBaseName = `Team_${role}`.replace(/[^A-Za-z0-9_\-]/g, '_')
      let roleSheetName = roleBaseName.slice(0, 31)
      let roleSuffix = 1
      while (usedSheetNames.has(roleSheetName)) {
        const sfx = `_${String(roleSuffix).padStart(2, '0')}`
        roleSheetName = roleBaseName.slice(0, 31 - sfx.length) + sfx
        roleSuffix++
      }
      usedSheetNames.add(roleSheetName)
      const roleTitle = `Team: ${role}`
      const roleSheet = buildLocationSheet(roleCandidates, roleTitle)
      XLSX.utils.book_append_sheet(wb, roleSheet.ws, roleSheetName)
      return { name: role, data: roleSheet.data }
    }).filter(Boolean)

    const customTeamSheets = [...teamGroups].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((team) => {
      const teamCandidates = candidateSelection.filter(c => team.memberKeys.includes(`${c.id}-${c.designation}-${c.locationId}-${c.centreId || ''}`))
      if (teamCandidates.length === 0) return null
      const teamBaseName = `Team_${team.name}`.replace(/[^A-Za-z0-9_\-]/g, '_')
      let teamSheetName = teamBaseName.slice(0, 31)
      let teamSuffix = 1
      while (usedSheetNames.has(teamSheetName)) {
        const sfx = `_${String(teamSuffix).padStart(2, '0')}`
        teamSheetName = teamBaseName.slice(0, 31 - sfx.length) + sfx
        teamSuffix++
      }
      usedSheetNames.add(teamSheetName)
      const teamTitle = `Team: ${team.name}`
      const teamSheet = buildLocationSheet(teamCandidates, teamTitle)
      XLSX.utils.book_append_sheet(wb, teamSheet.ws, teamSheetName)
      return { name: team.name, data: teamSheet.data }
    }).filter(Boolean)

    Object.entries(groupedCandidates).sort(([aKey], [bKey]) => {
      if (isWrittenExam) {
        const [aDistrict = '', aCentre = ''] = aKey.split('||')
        const [bDistrict = '', bCentre = ''] = bKey.split('||')
        const districtComparison = String(aDistrict).toLowerCase().localeCompare(String(bDistrict).toLowerCase())
        if (districtComparison !== 0) return districtComparison
        return String(aCentre).toLowerCase().localeCompare(String(bCentre).toLowerCase())
      }
      return String(aKey).toLowerCase().localeCompare(String(bKey).toLowerCase())
    }).forEach(([groupKey, sheetCandidates], index) => {
      const [districtLabel, centreLabel] = groupKey.split('||')
      let baseName = isWrittenExam
        ? `${districtLabel || ''}_${centreLabel || ''}`
        : `Payments_${groupKey}`
      // Remove spaces and special chars for Excel safety
      baseName = baseName.replace(/[^A-Za-z0-9_\-]/g, '_')
      let sheetName = baseName
      if (sheetName.length > 31) {
        sheetName = sheetName.slice(0, 28)
      }
      let suffix = 1
      let uniqueName = sheetName
      while (usedSheetNames.has(uniqueName)) {
        const sfx = `_${String(suffix).padStart(2, '0')}`
        uniqueName = sheetName.slice(0, 28 - sfx.length) + sfx
        suffix++
      }
      usedSheetNames.add(uniqueName)
      const sheetTitle = isWrittenExam
        ? `${districtLabel} - ${centreLabel}`
        : groupKey
      const { ws, data } = buildLocationSheet(sheetCandidates, sheetTitle)
      XLSX.utils.book_append_sheet(wb, ws, uniqueName)
      locationSheets[uniqueName] = data
    })

    const cleanRecords = candidateSelection.map(c => {
      const workedDays = exportDates.reduce((sum, date) => sum + getWorkedWeight(c, date), 0)

      const rate = Number(rates[c.designation] || 0)
      const basePay = workedDays * rate

      const allowanceBreakdown = {}
      let totalAllowances = 0
      otherAllowances.forEach(allowance => {
        const isEligible = allowance.scope === 'all' || 
          allowance.candidates.includes(`${c.id}-${c.designation}-${c.locationId}`)
        
        let applicableDateCount = 0
        if (isEligible) {
          if (allowance.dateScope === 'range') {
            applicableDateCount = exportDates.reduce((sum, date) => {
              const status = getEffectiveStatus(c, date)
              const isWorked = status === 'present' || status === 'late' || status === 'half'
              return sum + (isWorked && (!allowance.fromDate || date >= allowance.fromDate) && (!allowance.toDate || date <= allowance.toDate) ? getWorkedWeight(c, date) : 0)
            }, 0)
          } else if (allowance.dateScope === 'specific') {
            applicableDateCount = exportDates.reduce((sum, date) => {
              const status = getEffectiveStatus(c, date)
              const isWorked = status === 'present' || status === 'late' || status === 'half'
              return sum + (isWorked && allowance.specificDates.includes(date) ? getWorkedWeight(c, date) : 0)
            }, 0)
          } else {
            applicableDateCount = workedDays
          }
        }

        const amount = allowance.amount * applicableDateCount
        const key = `${allowance.type.toLowerCase().replace(/\s+/g, '_')}_total`
        allowanceBreakdown[key] = amount
        totalAllowances += amount
      })

      let totalOvertime = 0
      if (overtimeAllowance) {
        exportDates.forEach(date => {
          totalOvertime += parseOvertimeForDate(c, date).amount
        })
      }

      const amountToPay = basePay + totalAllowances + totalOvertime

      const record = {
        candidate_name: c.name,
        candidate_id: c.id,
        designation: c.designation,
        role: c.role,
        aadhaar: c.aadhaar,
        mobile: c.mobile,
        allowances_total: totalAllowances,
        ...allowanceBreakdown,
        overtime_total: totalOvertime,
        amount_to_be_paid: amountToPay
      }

      if (isWrittenExam) {
        record.district = c.districtName || c.districtId || 'Unknown'
        record.districtid = c.districtId || ''
        record.centre = c.centreName || c.centreId || 'Unknown'
        record.centreid = c.centreId || ''
      } else {
        record.location = c.locationName
        record.locationid = c.locationId
      }

      return record
    })

    const excelData = { summary: summarySheet.data, locations: locationSheets, records: cleanRecords }

    try {
      const exportFilename = `payment_sheet_${projectTitle}_${new Date().toISOString().split('T')[0]}.xlsx`
      const workbookData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const workbookBlob = new Blob([workbookData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const formData = new FormData()
      formData.append('projectId', projectId)
      // formData.append('config', JSON.stringify(paymentConfig))
      formData.append('data', JSON.stringify(excelData))
      formData.append('file', workbookBlob, exportFilename)
      await recruiterAPI.savePaymentConfiguration(projectId, formData)
    } catch (e) {
      console.warn('Failed to archive payment configuration and payment sheet file on server.')
    }

    XLSX.writeFile(wb, `payment_sheet_${projectTitle}_${new Date().toISOString().split('T')[0]}.xlsx`)
    setIsRateModalOpen(false)
    setGeneratingExcel(false) // End loading
  }

  const effectiveRequestLocationOptions = attendanceRequestDraft.projectId === projectId ? locationOptions : requestLocationOptions

  const tableColumns = [
    <input
      type="checkbox"
      checked={selectAll}
      onChange={(e) => handleSelectAll(e.target.checked)}
      key="select-all"
    />,
    'S.No', 'Candidate', 'Aadhaar', isWrittenExam ? 'District' : 'Location', ...(isWrittenExam ? ['Centre'] : []), 'Designation', 'Role', ...matrix.dates, 'Days'
  ]

  const tableRows = matrix.candidates.map((c, i) => [
    <input
      key={`check-${c.id}-${c.designation}-${c.locationId}-${c.centreId || ''}`}
      type="checkbox"
      checked={selectedRows.has(`${c.id}-${c.designation}-${c.locationId}-${c.centreId || ''}`)}
      onChange={(e) => handleRowSelect(`${c.id}-${c.designation}-${c.locationId}-${c.centreId || ''}`, e.target.checked)}
    />,
    i + 1,
    c.name,
    c.aadhaar ? `XXXX-XXXX-${String(c.aadhaar).slice(-4)}` : '—',
    isWrittenExam ? (c.districtName || c.locationName) : c.locationName,
    ...(isWrittenExam ? [c.centreName || '—'] : []),
    c.designation,
    <select
      value={c.role}
      onChange={(e) => handleRoleAssignment(c, e.target.value)}
      style={{ width: '100%', borderRadius: '6px', padding: '6px 8px' }}
    >
      <option value="Consultant">Consultant</option>
      <option value="Core Team">Core Team</option>
    </select>,
    // <span style={{ fontSize: '12px', fontWeight: '500' }}>{c.clockIn || '09:00'}</span>,
    // <span style={{ fontSize: '12px', fontWeight: '500' }}>{c.clockOut || '17:00'}</span>,
    ...matrix.dates.map(d => {
      const status = getEffectiveStatus(c, d)
      const requestedStatus = getRequestStatus(c, d)
      const requestKey = attendanceRequestKey(c, d)
      const isEditing = activeRequestCell === requestKey
      const isBottomRow = matrix.candidates.length <= 2 ? i === matrix.candidates.length - 1 : i >= matrix.candidates.length - 2
      const label = status === 'present' || status === 'late' ? 'P' : (status === 'half' ? 'H' : (status === 'absent' ? 'A' : '—'))
      return (
        <div key={d} className={`attendance-request-cell${isEditing ? ' active' : ''}`}>
          <button
            type="button"
            className={`attendance-status-pill ${status === 'present' ? 'present' : status === 'half' ? 'half' : status === 'absent' ? 'absent' : ''}${requestedStatus ? ' requested' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              openAttendanceRequestPopover(c, d)
            }}
            title="Request attendance change"
          >
            {label}
            {requestedStatus && (
              <span className={`attendance-request-superscript requested-${requestedStatus}`}>
                {requestedStatus === 'present' || requestedStatus === 'late' ? 'P' : (requestedStatus === 'half' ? 'H' : (requestedStatus === 'absent' ? 'A' : '—'))}
              </span>
            )}
            <FontAwesomeIcon icon={faPencilAlt} className="attendance-pencil-icon" />
          </button>
          {isEditing && (
            <div 
              className="attendance-request-actions attendance-request-popover"
              style={isBottomRow ? { bottom: '100%', top: 'auto', marginBottom: '10px' } : {}}
            >
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%' }}>
                <button
                  type="button"
                  className={`request-action present${attendanceRequestDraft.requestedStatus === 'present' ? ' active' : ''}`}
                  onClick={() => setAttendanceRequestDraft(prev => ({ ...prev, requestedStatus: 'present' }))}
                >
                  P
                </button>
                <button
                  type="button"
                  className={`request-action half${attendanceRequestDraft.requestedStatus === 'half' ? ' active' : ''}`}
                  onClick={() => setAttendanceRequestDraft(prev => ({ ...prev, requestedStatus: 'half' }))}
                >
                  H
                </button>
                <button
                  type="button"
                  className={`request-action absent${attendanceRequestDraft.requestedStatus === 'absent' ? ' active' : ''}`}
                  onClick={() => setAttendanceRequestDraft(prev => ({ ...prev, requestedStatus: 'absent' }))}
                >
                  A
                </button>
              </div>

              {attendanceRequestDraft.requestedStatus && isLocationRequiredForStatus(attendanceRequestDraft.requestedStatus) && (
                <div style={{ display: 'grid', gap: '8px', minWidth: '220px', width: '100%', marginTop: '8px' }}>
                  {isWrittenExam ? (
                    <>
                      <select
                        className="attendance-request-select"
                        value={attendanceRequestDraft.districtId}
                        onChange={(e) => {
                          const newDistrictId = e.target.value
                          setAttendanceRequestDraft(prev => ({ ...prev, districtId: newDistrictId, centreId: '' }))
                          fetchRequestCentreOptions(newDistrictId)
                        }}
                      >
                        <option value="">Select District</option>
                        {districtOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select
                        className="attendance-request-select"
                        value={attendanceRequestDraft.centreId}
                        onChange={(e) => setAttendanceRequestDraft(prev => ({ ...prev, centreId: e.target.value }))}
                        disabled={!attendanceRequestDraft.districtId}
                      >
                        <option value="">Select Centre</option>
                        {requestCentreOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <select
                        className="attendance-request-select"
                        value={attendanceRequestDraft.projectId}
                        onChange={(e) => {
                          const selectedProject = e.target.value
                          setAttendanceRequestDraft(prev => ({ ...prev, projectId: selectedProject, locationId: '' }))
                          if (selectedProject && selectedProject !== projectId) {
                            fetchRequestLocationOptions(selectedProject)
                          }
                        }}
                      >
                        <option value="">Select Project</option>
                        {regularProjectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select
                        className="attendance-request-select"
                        value={attendanceRequestDraft.locationId}
                        onChange={(e) => setAttendanceRequestDraft(prev => ({ ...prev, locationId: e.target.value }))}
                        disabled={!attendanceRequestDraft.projectId}
                      >
                        <option value="">Select Location</option>
                        {effectiveRequestLocationOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', width: '100%', marginTop: '10px' }}>
                <button
                  type="button"
                  className="request-action confirm"
                  disabled={
                    !attendanceRequestDraft.requestedStatus ||
                    (isLocationRequiredForStatus(attendanceRequestDraft.requestedStatus) && (
                      (isWrittenExam && (!attendanceRequestDraft.districtId || !attendanceRequestDraft.centreId)) ||
                      (!isWrittenExam && !attendanceRequestDraft.locationId)
                    ))
                  }
                  onClick={() => submitAttendanceChangeRequest(c, d)}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="request-action cancel"
                  onClick={() => {
                    setActiveRequestCell('')
                    setAttendanceRequestDraft({
                      requestKey: '',
                      requestedStatus: '',
                      projectId: projectId || '',
                      locationId: '',
                      districtId: '',
                      centreId: ''
                    })
                    setRequestCentreOptions([])
                    setRequestLocationOptions([])
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }),
    matrix.dates.reduce((sum, d) => sum + getWorkedWeight(c, d), 0)
  ])

  const selectedCandidates = matrix.candidates.filter(c => selectedRows.has(`${c.id}-${c.designation}-${c.locationId}-${c.centreId || ''}`))

  const filteredCandidates = selectedCandidates.filter(c =>
    (!candidateSearch ||
      c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      String(c.mobile).includes(candidateSearch) ||
      String(c.aadhaar).includes(candidateSearch)) &&
    (!candidateRoleFilter || c.role === candidateRoleFilter)
  )

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1
  const pageStart = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  return (
    <div className="recruiter-attendance-page payment-sheet-page">
      <LoadingOverlay active={generatingExcel} message="Generating Excel, please wait..." />

            <button className="btn btn-outline btn-sm" style={{width: 'fit-content'}} onClick={() => navigate(-1)}>
              <FontAwesomeIcon icon={faArrowLeft} /> Back to Details
            </button>
      <PageHeader
        title={isWrittenExam ? 'Written Exam Payment Sheet' : 'Overall Attendance & Payments'}
        subtitle={isWrittenExam ? `Centre-based payment sheet for ${projectTitle}` : `Project: ${projectTitle}`}
        action={
          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            <button className="btn btn-outline btn-sm" onClick={openManualUploadModal}>
              <FontAwesomeIcon icon={faUpload} /> Upload Manual Attendance
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setIsRateModalOpen(true)}>
              <FontAwesomeIcon icon={faCalculator} /> Configure & Generate Sheet
            </button>
          </div>
        }
      />

      <Card className="attendancedata-card">
        <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text)', margin: 0 }}>Project Mandays Summary</h3>
          <div style={{ height: '2px', width: '40px', background: 'var(--primary)', margin: '8px auto 0', borderRadius: '2px' }}></div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <StatCard
            icon={<FontAwesomeIcon icon={faProjectDiagram} />}
            iconStyle={{ background: 'var(--teal-light)', color: 'var(--teal)' }}
            label="Project"
            value={projectTitle}
          />
          <StatCard
            icon={<FontAwesomeIcon icon={faMapMarkerAlt} />}
            iconStyle={{ background: 'var(--blue-light)', color: 'var(--blue)' }}
            label="Location"
            value={selectedLocationId ? (locationOptions.find(l => l.id === selectedLocationId)?.name || 'Filtered Site') : 'All Sites'}
          />
          <StatCard
            icon={<FontAwesomeIcon icon={faCalendarAlt} />}
            iconStyle={{ background: 'var(--purple-light)', color: 'var(--purple)' }}
            label="Project Timeline"
            value={projectDates.start ? `${new Date(projectDates.start).toLocaleDateString('en-IN')} - ${new Date(projectDates.end).toLocaleDateString('en-IN')}` : 'N/A'}
          />
          <StatCard
            icon={<FontAwesomeIcon icon={faUsers} />}
            iconStyle={{ background: 'var(--green-light)', color: 'var(--green)' }}
            label="Available Resources"
            value={statsLoading ? '…' : stats.totalResources}
          />
          <StatCard
            icon={<FontAwesomeIcon icon={faClock} />}
            iconStyle={{ background: 'var(--yellow-light)', color: 'var(--saffron)' }}
            label="Total Mandays Worked"
            value={statsLoading ? '…' : stats.totalMandays}
          />
        </div>

        <div style={{ padding: '0 24px 20px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text)', margin: 0 }}>Individual Attendance & Payment Details</h3>
          <div style={{ height: '2px', width: '40px', background: 'var(--primary)', margin: '8px auto 0', borderRadius: '2px' }}></div>
        </div>

        <div className="projects-table-filters" style={{ marginBottom: 20, flexWrap: 'wrap', gap: '16px' }}>
          <div className="projects-table-filter-group search-group">
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Search candidate..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          {isWrittenExam ? (
            <div className="projects-table-filter-group location-group">
              <div className="filter-label">District Filter</div>
              <select 
                className="form-control" 
                value={selectedDistrictId} 
                onChange={(e) => {
                  setSelectedDistrictId(e.target.value)
                  setSelectedCentreId('')
                  setOffset(0)
                }}
              >
                <option value="">All Districts</option>
                {districtOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="projects-table-filter-group location-group" style={{ flex: '1 1 200px' }}>
              <div className="filter-label">Location Filter</div>
              <select 
                className="form-control" 
                value={selectedLocationId} 
                onChange={(e) => {
                  setSelectedLocationId(e.target.value)
                  setSelectedCentreId('')
                  setOffset(0)
                }}
              >
                <option value="">All Locations</option>
                {locationOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {isWrittenExam && (
            <div className="projects-table-filter-group centre-group">
              <div className="filter-label">Centre Filter</div>
              <select 
                className="form-control" 
                value={selectedCentreId} 
                onChange={(e) => {
                  setSelectedCentreId(e.target.value)
                  setOffset(0)
                }}
                disabled={!selectedDistrictId}
              >
                <option value="">All Centres</option>
                {centreOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="projects-table-filter-group role-group">
            <div className="filter-label">Role Filter</div>
            <select
              className="form-control"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setOffset(0)
              }}
            >
              <option value="">All Roles</option>
              <option value="Consultant">Consultant</option>
              <option value="Core Team">Core Team</option>
            </select>
          </div>
          
          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Filter range</div>
            <input className="form-control" type="date" value={fromDate} onChange={(e) => {
              setFromDate(e.target.value)
              setOffset(0)
            }} min={projectDates.start} max={projectDates.end} />
            <span className="date-separator">to</span>
            <input className="form-control" type="date" value={toDate} onChange={(e) => {
              setToDate(e.target.value)
              setOffset(0)
            }} min={projectDates.start} max={projectDates.end} />
          </div>
          
          <button className="btn btn-outline btn-sm" onClick={() => { setFromDate(''); setToDate(''); setSearch(''); setSelectedLocationId(''); setSelectedDistrictId(''); setSelectedCentreId(''); setRoleFilter('') }}>Reset Filters</button>

          <div className="projects-table-filter-group rows-per-page-group">
            <div className="filter-label">Rows per page</div>
            <select
              className="form-control form-control-sm"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setOffset(0)
              }}
              style={{ width: '100px' }}
            >
              {LIMIT_OPTIONS.map((value) => (
                <option key={value} value={value}>{value} entries</option>
              ))}
            </select>
          </div>
        </div>

        <div className="projects-table-wrap" style={{ position: 'relative', overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', paddingBottom: matrix.candidates.length > 0 && matrix.candidates.length <= 3 ? '150px' : '20px' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="loader" />
                <div style={{ marginTop: '12px', fontWeight: 600, color: 'var(--text1)' }}>Loading records...</div>
              </div>
            </div>
          )}
          <DataTable
            columns={tableColumns}
            rows={tableRows}
            emptyMessage={loading ? 'Loading records...' : 'No records found for the selected range.'}
          />
        </div>

        <div className="projects-table-pagination" style={{ marginTop: '20px' }}>
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
        isOpen={manualUploadOpen}
        onClose={() => setManualUploadOpen(false)}
        title="Add Manual Attendance"
        maxWidth="1000px"
        footer={
          <div style={{flexWrap: 'nowrap', display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
            <button className="btn btn-outline btn-sm" onClick={() => setManualUploadOpen(false)}>Close</button>
            <button 
              className="btn btn-primary btn-sm" 
              type="button" 
              onClick={saveManualAttendance}
              disabled={loading || (manualSelectedCandidates.size === 0 && manuallyAddedCandidates.length === 0) || manualSelectedDates.size === 0}
            >
              <FontAwesomeIcon icon={faSave} /> Save Manual Attendance
            </button>
          </div>
        }
      >
        <div className="manual-attendance-ui">
          <div className="manual-attendance-section" style={{ marginBottom: '24px' }}>
            <div className="section-header" style={{ fontWeight: 700, marginBottom: '12px', fontSize: '14px' }}>1. Select Attendance Status</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['present', 'half', 'absent'].map(status => (
                <label key={status} className={`btn btn-sm ${manualSelectedStatus === status ? 'btn-primary' : 'btn-outline'}`} style={{ textTransform: 'capitalize', minWidth: '100px' }}>
                  <input 
                    type="radio" 
                    name="manualStatus" 
                    value={status} 
                    checked={manualSelectedStatus === status} 
                    onChange={e => setManualSelectedStatus(e.target.value)} 
                    style={{ display: 'none' }}
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>

          <div className="manual-attendance-section" style={{ marginBottom: '24px' }}>
            <div className="section-header" style={{ fontWeight: 700, marginBottom: '12px', fontSize: '14px' }}>2. Select Location Context</div>
            <div style={{ display: 'grid', gridTemplateColumns: isWrittenExam ? '1fr 1fr' : '1fr', gap: '12px' }}>
              {isWrittenExam ? (
                <>
                  <FormField label="District" style={{ marginBottom: 0 }}>
                    <select 
                      className="form-control" 
                      value={manualDistrictId} 
                      onChange={(e) => {
                        const val = e.target.value
                        setManualDistrictId(val)
                        setManualCentreId('')
                        fetchManualCentreOptions(val)
                      }}
                    >
                      <option value="">All Districts</option>
                      {districtOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Centre" style={{ marginBottom: 0 }}>
                    <select 
                      className="form-control" 
                      value={manualCentreId} 
                      onChange={(e) => setManualCentreId(e.target.value)}
                      disabled={!manualDistrictId}
                    >
                      <option value="">All Centres</option>
                      {manualCentreOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FormField>
                </>
              ) : (
                <FormField label="Location" style={{ marginBottom: 0 }}>
                  <select 
                    className="form-control" 
                    value={manualLocationId} 
                    onChange={(e) => {
                      const val = e.target.value
                      setManualLocationId(val)
                      setManualCentreId('')
                      fetchManualCentreOptions(val)
                    }}
                  >
                    <option value="">All Locations</option>
                    {locationOptions.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </FormField>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <FormField label="Designation *" style={{ marginBottom: 0 }}>
              <select
                className="form-control form-control-sm"
                value={manualDesignation}
                onChange={(e) => setManualDesignation(e.target.value)}
              >
                <option value="">Select Designation</option>
                {designations.length > 0 ? designations.map(des => (
                  <option key={des} value={des}>{des}</option>
                )) : (
                  <option value="Resource">Resource</option>
                )}
              </select>
            </FormField>
            <FormField label="Role *" style={{ marginBottom: 0 }}>
              <select
                className="form-control form-control-sm"
                value={manualRole}
                onChange={(e) => setManualRole(e.target.value)}
              >
                <option value="">Select Role</option>
                <option value="Consultant">Consultant</option>
                <option value="Core Team">Core Team</option>
              </select>
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="manual-attendance-column">
              <div className="section-header" style={{ fontWeight: 700, marginBottom: '12px', fontSize: '14px' }}>3. Select Candidates ({manualSelectedCandidates.size + manuallyAddedCandidates.length})</div>
              
              {/* Tabs for registered vs manual candidates */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '2px solid var(--border-light)' }}>
                <button
                  type="button"
                  onClick={() => setManualCandidateMode('registered')}
                  style={{
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderBottom: manualCandidateMode === 'registered' ? '2px solid var(--primary)' : 'none',
                    color: manualCandidateMode === 'registered' ? 'var(--primary)' : 'var(--text3)',
                    cursor: 'pointer',
                    fontWeight: manualCandidateMode === 'registered' ? 600 : 400,
                    fontSize: '13px'
                  }}
                >
                  Registered Candidates
                </button>
                <button
                  type="button"
                  onClick={() => setManualCandidateMode('manual')}
                  style={{
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    borderBottom: manualCandidateMode === 'manual' ? '2px solid var(--primary)' : 'none',
                    color: manualCandidateMode === 'manual' ? 'var(--primary)' : 'var(--text3)',
                    cursor: 'pointer',
                    fontWeight: manualCandidateMode === 'manual' ? 600 : 400,
                    fontSize: '13px'
                  }}
                >
                  Manual Entry ({manuallyAddedCandidates.length})
                </button>
              </div>

              {/* Registered Candidates Tab */}
              {manualCandidateMode === 'registered' && (
                <>
                  <div className="filter-search-box">
                    <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Search by name, ID or mobile..." 
                      value={manualCandidateSearch}
                      onChange={e => setManualCandidateSearch(e.target.value)}
                    />
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px' }}>
                    {membersLoading ? <div style={{ padding: '20px', textAlign: 'center' }}>Loading members...</div> : 
                     projectMembers.length === 0 ? <div style={{ padding: '20px', textAlign: 'center' }}>No members found.</div> : 
                     projectMembers.map(m => {
                       const id = String(m.id || m.candidate_id || m.registration_id || '')
                       return (
                        <label key={id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--bg-light)', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={manualSelectedCandidates.has(id)} 
                            onChange={e => {
                              const next = new Set(manualSelectedCandidates)
                              if (e.target.checked) next.add(id)
                              else next.delete(id)
                              setManualSelectedCandidates(next)
                            }} 
                          />
                          <div style={{ fontSize: '13px' }}>
                            <div style={{ fontWeight: 600 }}>{m.name || m.fullName || '—'}</div>
                            <div style={{ color: 'var(--text3)', fontSize: '11px' }}>{m.mobile || m.phone || m.whatsapp || '—'} | {id}</div>
                          </div>
                        </label>
                       )
                     })}
                  </div>
                </>
              )}

              {/* Manual Entry Tab */}
              {manualCandidateMode === 'manual' && (
                <>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(55, 125, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(55, 125, 255, 0.15)' }}>
                    <div className="text-xs font-bold mb-3">Add New Candidate</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <FormField label="Candidate Name *" style={{ marginBottom: 0 }}>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Full name"
                          value={manualCandidateForm.name}
                          onChange={(e) => setManualCandidateForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </FormField>
                      <FormField label="Mobile *" style={{ marginBottom: 0 }}>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10}
                          className="form-control form-control-sm"
                          placeholder="10-digit mobile"
                          value={manualCandidateForm.mobile}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                            setManualCandidateForm(prev => ({ ...prev, mobile: digits }))
                          }}
                        />
                      </FormField>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                      <FormField label="Aadhaar *" style={{ marginBottom: 0 }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={12}
                          className="form-control form-control-sm"
                          placeholder="12-digit Aadhaar"
                          value={manualCandidateForm.aadhaar}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
                            setManualCandidateForm(prev => ({ ...prev, aadhaar: digits }))
                          }}
                        />
                      </FormField>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={addManualCandidate}
                          style={{ flex: 1 }}
                        >
                          <FontAwesomeIcon icon={faPlus} /> Add Candidate
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Added Candidates List */}
                  {manuallyAddedCandidates.length > 0 && (
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px' }}>
                      <div className="text-xs font-bold mb-2" style={{ padding: '8px', fontWeight: 700 }}>Added Candidates:</div>
                      {manuallyAddedCandidates.map((candidate, idx) => (
                        <div
                          key={candidate.id}
                          style={{
                            padding: '8px',
                            borderBottom: '1px solid var(--bg-light)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ fontSize: '13px', flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{candidate.name}</div>
                            <div style={{ color: 'var(--text3)', fontSize: '11px' }}>
                              {candidate.mobile} | {manualDesignation || '—'} • {manualRole}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => removeManualCandidate(candidate.id)}
                            style={{ padding: '4px 8px', color: 'var(--danger)' }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {manuallyAddedCandidates.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                      No candidates added yet. Fill in the details above and click "Add Candidate".
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="manual-attendance-column">
              <div className="section-header" style={{ fontWeight: 700, marginBottom: '12px', fontSize: '14px' }}>4. Select Dates ({manualSelectedDates.size})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
                  <DayPicker
                    mode="multiple"
                    selected={Array.from(manualSelectedDates).map(d => parseISOToDate(d))}
                    onSelect={(sel) => {
                      if (!sel) { setManualSelectedDates(new Set()); return }
                      const arr = Array.isArray(sel) ? sel : [sel]
                      const next = new Set(arr.map(dt => formatDateToISO(dt)))
                      setManualSelectedDates(next)
                    }}
                    fromDate={parseISOToDate(projectDates.start)}
                    toDate={parseISOToDate(projectDates.end)}
                    disabled={[
                      projectDates.start ? { before: parseISOToDate(projectDates.start) } : null,
                      projectDates.end ? { after: parseISOToDate(projectDates.end) } : null
                    ].filter(Boolean)}
                    styles={{
                      caption: { fontSize: '0.85rem' },
                      head_cell: { width: '32px' },
                      cell: { width: '32px', height: '32px' },
                      day: { width: '30px', height: '30px', fontSize: '0.75rem' }
                    }}
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  Select dates within the project range: {projectDates.start || 'N/A'} to {projectDates.end || 'N/A'}.
                </div>
                <div style={{ maxHeight: '330px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', background: 'var(--bg-light)' }}>
                  {manualSelectedDates.size === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center' }}>No dates selected yet.</div>
                  ) : (
                    Array.from(manualSelectedDates).sort().map((date) => (
                      <div key={date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <span>{new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}</span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => {
                            const next = new Set(manualSelectedDates)
                            next.delete(date)
                            setManualSelectedDates(next)
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Team Edit Modal */}
      <Modal
        isOpen={teamEditModalOpen}
        onClose={() => setTeamEditModalOpen(false)}
        title={teamGroups.find(t => t.id === editingTeamId)?.name ? `Edit Team: ${teamGroups.find(t => t.id === editingTeamId)?.name}` : 'Edit Team'}
        maxWidth="900px"
        zIndex={13000}
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setTeamEditModalOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!editingTeamId) { setTeamEditModalOpen(false); return }
                setTeamGroups(prev => prev.map(t => t.id === editingTeamId ? { ...t, memberKeys: Array.from(editingTeamMembers) } : t))
                setTeamEditModalOpen(false)
              }}
            >
              <FontAwesomeIcon icon={faSave} /> Save Members
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="filter-search-box" style={{ marginBottom: 0 }}>
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control search-input"
                  placeholder="Search by name, mobile, or aadhaar..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <select
                className="form-control"
                value={candidateRoleFilter}
                onChange={(e) => setCandidateRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="Consultant">Consultant</option>
                <option value="Core Team">Core Team</option>
              </select>
            </div>
            <div>
              <button className="btn btn-outline btn-sm" onClick={() => { setEditingTeamMembers(new Set(matrix.candidates.map(c => candidateKeyFor(c)))) }}>
                Select All
              </button>
            </div>
          </div>

          <div className="projects-table-wrap" style={{ maxHeight: '420px', minHeight: '220px', overflowY: 'auto' }}>
            <table className="table" style={{ margin: 0, fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-light)', zIndex: 1 }}>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Aadhaar</th>
                  <th>Role</th>
                  <th>Designation</th>
                  {isWrittenExam ? <><th>District</th><th>Centre</th></> : <th>Location</th>}
                </tr>
              </thead>
              <tbody>
                {matrix.candidates.filter(c => (
                  (!candidateSearch || c.name.toLowerCase().includes(candidateSearch.toLowerCase()) || String(c.mobile).includes(candidateSearch) || String(c.aadhaar).includes(candidateSearch)) &&
                  (!candidateRoleFilter || c.role === candidateRoleFilter)
                )).map(c => {
                  const key = candidateKeyFor(c)
                  return (
                    <tr key={key}>
                      <td>
                        <input
                          type="checkbox"
                          checked={editingTeamMembers.has(key)}
                          onChange={(e) => {
                            const newSet = new Set(editingTeamMembers)
                            if (e.target.checked) newSet.add(key)
                            else newSet.delete(key)
                            setEditingTeamMembers(newSet)
                          }}
                        />
                      </td>
                      <td>{c.name}</td>
                      <td>{c.mobile || '—'}</td>
                      <td>{c.aadhaar ? `XXXX-XXXX-${String(c.aadhaar).slice(-4)}` : '—'}</td>
                      <td>{c.role}</td>
                      <td>{c.designation}</td>
                      {isWrittenExam ? (
                        <>
                          <td>{c.districtName || c.districtId || '—'}</td>
                          <td>{c.centreName || c.centreId || '—'}</td>
                        </>
                      ) : (
                        <td>{c.locationName}</td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        title="Configure Payment Sheet"
        maxWidth="600px"
        footer={
          <div style={{flexWrap: 'nowrap', display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
            <button className="btn btn-outline btn-sm" onClick={() => setIsRateModalOpen(false)}>Close</button>
            <button className="btn btn-secondary btn-sm" onClick={handleSaveRates} disabled={savingRates}>
              <FontAwesomeIcon icon={faSave} /> {savingRates ? 'Saving...' : 'Save Rates'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={generatePaymentSheet} disabled={savingRates}>
              <FontAwesomeIcon icon={faFileExcel} /> Generate Excel
            </button>
          </div>
        }
      >
        <div className="payment-config-modal-body">

          <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(55, 125, 255, 0.05)', borderRadius: '10px', border: '1px solid rgba(55, 125, 255, 0.15)' }}>
            <div className="text-xs font-bold mb-3">Project Default Working Hours</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Standard Hours (Auto-calculated)</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  className="form-control form-control-sm"
                  value={standardWorkingHours}
                  disabled
                  title="Auto-calculated from start and end time"
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Start Time</label>
                <input
                  type="time"
                  className="form-control form-control-sm"
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>End Time</label>
                <input
                  type="time"
                  className="form-control form-control-sm"
                  value={defaultEndTime}
                  onChange={(e) => setDefaultEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '8px' }}>
              Only hours worked beyond the standard daily hours will be counted as overtime.
            </div>
          </div>

          <div className="designation-rates-section" style={{ background: '#fcfcfd', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {designations.length === 0 ? (
                <div className="col-span-2 text-center py-4 text-muted">No designations found</div>
              ) : (
                designations.map(des => (
                  <div key={des} className="rate-input-item" style={{gap: '12px', display: 'flex', flexDirection: 'column'}}>
                    <label className="text-xs mb-1 block truncate" title={des}>{des}</label>
                    <div className="input-group input-group-sm" style={{display: 'flex', flexDirection: 'row'}}>
                      <span className="input-group-text" style={{ padding:'8px 8px'}}>₹</span>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Daily rate"
                    value={rates[des] || ''}
                    onChange={(e) => handleRateChange(des, e.target.value)}
                  />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 p-3" style={{ background: 'rgba(55, 125, 255, 0.05)', borderRadius: '10px', border: '1px solid rgba(55, 125, 255, 0.15)', padding: '16px' }}>
            <div className="text-xs font-bold mb-3">Additional Allowance Columns</div>

            {/* Add New Allowance Section */}
            <div style={{ marginBottom: '16px', padding: '12px', background: 'white', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Allowance Type</label>
                  <select
                    className="form-control form-control-sm"
                    value={currentAllowanceType}
                    onChange={(e) => setCurrentAllowanceType(e.target.value)}
                  >
                    <option value="">Select Allowance Type</option>
                    {ALLOWANCE_TYPES.map(type => (
                      <option 
                        key={type} 
                        value={type}
                        disabled={type === 'Overtime' && standardWorkingHours <= 9}
                      >
                        {type}
                        {type === 'Overtime' && standardWorkingHours <= 9 ? ' (Requires 9+ standard hours)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Amount (₹)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder={currentAllowanceType === 'Overtime' ? "Rate per hour" : "0"}
                    value={currentAllowanceAmount}
                    onChange={(e) => setCurrentAllowanceAmount(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (!currentAllowanceType.trim() || !currentAllowanceAmount) {
                        alert('Please enter allowance type and amount.')
                        return
                      }
                      const newAllowance = {
                        id: Date.now(),
                        type: currentAllowanceType.trim(),
                        amount: parseFloat(currentAllowanceAmount),
                        scope: currentAllowanceScope,
                        dateScope: currentAllowanceDateScope,
                        fromDate: currentAllowanceType === 'Overtime' ? currentAllowanceFromDate : currentAllowanceFromDate,
                        toDate: currentAllowanceType === 'Overtime' ? currentAllowanceToDate : currentAllowanceToDate,
                        specificDates: currentAllowanceSpecificDates,
                        candidates: Array.from(selectedAllowanceCandidates),
                        otStartTime: currentAllowanceType === 'Overtime' ? currentAllowanceFromDate : null,
                        otEndTime: currentAllowanceType === 'Overtime' ? currentAllowanceToDate : null
                      }
                      setAllowances(prev => [...prev, newAllowance])
                      setCurrentAllowanceType('')
                      setCurrentAllowanceAmount('')
                      setCurrentAllowanceScope('all')
                      setCurrentAllowanceDateScope('all')
                      setCurrentAllowanceFromDate('')
                      setCurrentAllowanceToDate('')
                      setCurrentAllowanceSpecificDates([])
                      setSelectedAllowanceCandidates(new Set())
                    }}
                    style={{ width: '100%' }}
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add
                  </button>
                </div>
              </div>



              {/* Allowance Scope Selection */}
              <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div className="text-xs font-bold mb-1">Apply to candidates</div>
                  <label className="form-control-radio" style={{ fontSize: '11px' }}>
                    <input type="radio" name="currentAllowanceScope" value="all" checked={currentAllowanceScope === 'all'} onChange={(e) => setCurrentAllowanceScope(e.target.value)} />
                    <span>All candidates</span>
                  </label>
                  <label className="form-control-radio" style={{ fontSize: '11px' }}>
                    <input type="radio" name="currentAllowanceScope" value="selected" checked={currentAllowanceScope === 'selected'} onChange={(e) => setCurrentAllowanceScope(e.target.value)} />
                    <span>Selected candidates</span>
                  </label>
                  {currentAllowanceScope === 'selected' && (
                    <div style={{ marginTop: '8px' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setSelectedAllowanceCandidates(new Set())
                          setCandidateSelectionModalOpen(true)
                        }}
                        style={{ width: '100%', fontSize: '11px' }}
                      >
                        <FontAwesomeIcon icon={faUsers} /> Select Candidates ({selectedAllowanceCandidates.size} selected)
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold mb-1">Apply to dates</div>
                  <label className="form-control-radio" style={{ fontSize: '11px' }}>
                    <input type="radio" name="currentAllowanceDateScope" value="all" checked={currentAllowanceDateScope === 'all'} onChange={(e) => setCurrentAllowanceDateScope(e.target.value)} />
                    <span>All dates</span>
                  </label>
                  <label className="form-control-radio" style={{ fontSize: '11px' }}>
                    <input type="radio" name="currentAllowanceDateScope" value="range" checked={currentAllowanceDateScope === 'range'} onChange={(e) => setCurrentAllowanceDateScope(e.target.value)} />
                    <span>Date range</span>
                  </label>
                  <label className="form-control-radio" style={{ fontSize: '11px' }}>
                    <input type="radio" name="currentAllowanceDateScope" value="specific" checked={currentAllowanceDateScope === 'specific'} onChange={(e) => setCurrentAllowanceDateScope(e.target.value)} />
                    <span>Specific dates</span>
                  </label>
                  {currentAllowanceDateScope === 'range' && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                      <input className="form-control form-control-sm" type="date" value={currentAllowanceFromDate} onChange={(e) => setCurrentAllowanceFromDate(e.target.value)} min={projectDates.start} max={projectDates.end} />
                      <input className="form-control form-control-sm" type="date" value={currentAllowanceToDate} onChange={(e) => setCurrentAllowanceToDate(e.target.value)} min={projectDates.start} max={projectDates.end} />
                    </div>
                  )}
                  {currentAllowanceDateScope === 'specific' && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 6, background: '#fff' }}>
                        <DayPicker
                          mode="multiple"
                          selected={currentAllowanceSpecificDates.map(d => parseISOToDate(d))}
                          onSelect={(sel) => {
                            if (!sel) { setCurrentAllowanceSpecificDates([]); return }
                            const arr = Array.isArray(sel) ? sel : [sel]
                            setCurrentAllowanceSpecificDates(arr.map(dt => formatDateToISO(dt)))
                          }}
                          fromDate={parseISOToDate(projectDates.start)}
                          toDate={parseISOToDate(projectDates.end)}
                          disabled={[
                            projectDates.start ? { before: parseISOToDate(projectDates.start) } : null,
                            projectDates.end ? { after: parseISOToDate(projectDates.end) } : null
                          ].filter(Boolean)}
                          styles={{
                            caption: { fontSize: '0.85rem' },
                            head_cell: { width: '32px' },
                            cell: { width: '32px', height: '32px' },
                            day: { width: '30px', height: '30px', fontSize: '0.75rem' }
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                        Click to pick one or more dates within {projectDates.start || 'N/A'} to {projectDates.end || 'N/A'}.
                      </div>
                      {currentAllowanceSpecificDates.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {currentAllowanceSpecificDates.map((date, idx) => (
                            <span key={idx} className="badge badge-secondary" style={{ fontSize: '10px', padding: '4px 8px' }}>
                              {date}
                              <button
                                className="btn btn-link btn-sm"
                                onClick={() => setCurrentAllowanceSpecificDates(prev => prev.filter((_, i) => i !== idx))}
                                style={{ padding: '0 4px', marginLeft: '4px', color: 'var(--danger)' }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

                {allowances.length > 0 && (
                  <div style={{ marginTop: '12px', maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', background: 'var(--bg-light)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>Current Allowances</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {allowances.map((allowance, index) => (
                        <div key={allowance.id} style={{ padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div className="text-xs font-bold">{allowance.type}</div>
                            <div className="text-xs text-muted">
                              ₹{allowance.amount}{allowance.type === 'Overtime' ? '/hour' : ''} • {allowance.scope === 'all' ? 'All candidates' : `${allowance.candidates.length} selected`} • 
                              {allowance.dateScope === 'all' ? 'All dates' : allowance.dateScope === 'range' ? `${allowance.fromDate} to ${allowance.toDate}` : `${allowance.specificDates.length} specific dates`}
                            </div>
                          </div>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setAllowances(prev => prev.filter((_, i) => i !== index))}
                            style={{ padding: '4px 8px' }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

            <div className="mt-4 p-3" style={{ background: 'rgba(246, 248, 252, 0.9)', borderRadius: '10px', border: '1px solid var(--border-light)', padding: '16px' }}>
              <div className="text-xs font-bold mb-3">Team Assignment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Team Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Calling Team, Bikers, Consultant"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={() => {
                    const trimmedName = teamName.trim()
                    if (!trimmedName) {
                      alert('Please enter a team name before saving.')
                      return
                    }
                    let memberKeys = []
                    if (teamScope === 'selected') {
                      if (selectedRows.size === 0) {
                        alert('Select candidates from the main table first to assign them to a team.')
                        return
                      }
                      memberKeys = Array.from(new Set([...selectedRows]))
                    } else {
                      // apply to all visible candidates in the matrix
                      memberKeys = matrix.candidates.map(c => candidateKeyFor(c))
                    }
                    setTeamGroups(prev => {
                      const existingIndex = prev.findIndex(t => t.name.toLowerCase() === trimmedName.toLowerCase())
                      if (existingIndex >= 0) {
                        return prev.map((team, index) => index === existingIndex ? { ...team, memberKeys } : team)
                      }
                      return [...prev, { id: Date.now(), name: trimmedName, memberKeys }]
                    })
                    setTeamName('')
                  }}
                  style={{ width: '100%' }}
                >
                  <FontAwesomeIcon icon={faPlus} /> Save Team
                </button>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>Apply to candidates:</div>
                <label className="form-control-radio" style={{ fontSize: '11px' }}>
                  <input type="radio" name="teamScope" value="selected" checked={teamScope === 'selected'} onChange={(e) => setTeamScope(e.target.value)} />
                  <span>Selected</span>
                </label>
                <label className="form-control-radio" style={{ fontSize: '11px' }}>
                  <input type="radio" name="teamScope" value="all" checked={teamScope === 'all'} onChange={(e) => setTeamScope(e.target.value)} />
                  <span>All</span>
                </label>
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text3)' }}>
                Select candidates in the main sheet and assign them to one or more team sheets. Team sheets will appear next to the combined sheet in the workbook.
              </div>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teamGroups.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text3)' }}>No teams assigned yet.</div>
                ) : (
                  teamGroups.map(team => (
                    <div key={team.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{team.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{team.memberKeys.length} candidate{team.memberKeys.length === 1 ? '' : 's'} assigned</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => {
                            setEditingTeamId(team.id)
                            setEditingTeamMembers(new Set())
                            setTeamEditModalOpen(true)
                          }}
                        >
                          <FontAwesomeIcon icon={faPencilAlt} /> Edit
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => setTeamGroups(prev => prev.filter(t => t.id !== team.id))}
                        >
                          <FontAwesomeIcon icon={faTrash} /> Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>


          </div>

          <div className="mt-4 p-3" style={{ background: 'var(--bg-light)', borderRadius: '8px', borderLeft: '4px solid var(--primary)', padding: '16px' }}>
            <div className="text-xs font-bold mb-1"><FontAwesomeIcon icon={faCheckDouble} /> Selected for Export:</div>
            <div className="flex justify-between items-center">
              <span className="text-sm">{selectedRows.size} entries selected</span>
              <span className="text-xs text-muted">
                {selectedLocationId ? `Location: ${locationOptions.find(l => l.id === selectedLocationId)?.name}` : 'All Locations'}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Candidate Selection Modal */}
      <Modal
        isOpen={candidateSelectionModalOpen}
        onClose={() => setCandidateSelectionModalOpen(false)}
        title="Select Candidates for Allowance"
        maxWidth="800px"
        zIndex={11200}
        footer={
          <div style={{flexWrap: 'nowrap', display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center'}}>
            <div className="text-sm text-muted">
              {selectedAllowanceCandidates.size} candidates selected
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setCandidateSelectionModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => setCandidateSelectionModalOpen(false)}>
                <FontAwesomeIcon icon={faCheck} /> Apply Selection
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search and Filter */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div className="filter-search-box" style={{ marginBottom: 0 }}>
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control search-input"
                  placeholder="Search by name, mobile, or aadhaar..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <select
                className="form-control"
                value={candidateRoleFilter}
                onChange={(e) => setCandidateRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="Consultant">Consultant</option>
                <option value="Core Team">Core Team</option>
              </select>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                if (selectedAllowanceCandidates.size === filteredCandidates.length) {
                  setSelectedAllowanceCandidates(new Set())
                } else {
                  setSelectedAllowanceCandidates(new Set(filteredCandidates.map(c => `${c.id}-${c.designation}-${c.locationId}`)))
                }
              }}
            >
              {selectedAllowanceCandidates.size === filteredCandidates.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Candidates Table */}
            <div className="projects-table-wrap" style={{ maxHeight: '420px', minHeight: '220px', overflowY: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-light)', zIndex: 1 }}>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={filteredCandidates.length > 0 && selectedAllowanceCandidates.size === filteredCandidates.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAllowanceCandidates(new Set(filteredCandidates.map(c => `${c.id}-${c.designation}-${c.locationId}`)))
                        } else {
                          setSelectedAllowanceCandidates(new Set())
                        }
                      }}
                    />
                  </th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Aadhaar</th>
                  <th>Role</th>
                  <th>Designation</th>
                  {isWrittenExam ? <><th>District</th><th>Centre</th></> : <th>Location</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No candidates found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map(c => {
                    const candidateKey = `${c.id}-${c.designation}-${c.locationId}`
                    return (
                      <tr key={candidateKey}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedAllowanceCandidates.has(candidateKey)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedAllowanceCandidates)
                              if (e.target.checked) {
                                newSelected.add(candidateKey)
                              } else {
                                newSelected.delete(candidateKey)
                              }
                              setSelectedAllowanceCandidates(newSelected)
                            }}
                          />
                        </td>
                        <td>{c.name}</td>
                        <td>{c.mobile || '—'}</td>
                        <td>{c.aadhaar ? `XXXX-XXXX-${String(c.aadhaar).slice(-4)}` : '—'}</td>
                        <td>{c.role}</td>
                        <td>{c.designation}</td>
                        {isWrittenExam ? (
                          <>
                            <td>{c.districtName || c.districtId || '—'}</td>
                            <td>{c.centreName || c.centreId || '—'}</td>
                          </>
                        ) : (
                          <td>{c.locationName}</td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

    </div>
  )
}