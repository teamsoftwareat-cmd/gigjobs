import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faUpload, faUserPlus, faEye, faImages, faCheckCircle, faCopy, faMagnifyingGlass, faCheck, faCalendarCheck, faMapMarkerAlt, faMoneyBillWave, faCommentDots } from '@fortawesome/free-solid-svg-icons'
import { Card, PageHeader, Tag, Modal, WhatsAppMessenger } from '../../components/ui/index'
import { ImageModal } from '../../components/ui/ImageModal'
import { MapModal } from '../../components/ui/MapModal'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import { recruiterAPI } from '../../api/axios'
import AddCandidateModal from './AddCandidateModal'
import BulkImportModal from './BulkImportModal'
import CheckRegisterModal from './CheckRegisterModal'
import NotifyNotRegisteredModal from './NotifyNotRegisteredModal'
import './CandidateDatabase.css'

const LOCATION_OPTIONS = ['All', 'Tambaram', 'Velachery', 'Guindy', 'OMR', 'Anna Nagar']
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatAadhaarInput = (value) => {
  const digits = String(value).replace(/\D/g, '').slice(0, 12)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function CandidateDatabase() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [totalCandidates, setTotalCandidates] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [mobileSearch, setMobileSearch] = useState('')
  const [whatsappSearch, setWhatsappSearch] = useState('')
  const [emailSearch, setEmailSearch] = useState('')
  const [aadhaarSearch, setAadhaarSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState({ name: '', mobile: '', whatsapp: '', email: '', aadhaar: '' })
  const [locationFilter, setLocationFilter] = useState('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [showCheckRegisterModal, setShowCheckRegisterModal] = useState(false)
  const [showNotifyNotRegisteredModal, setShowNotifyNotRegisteredModal] = useState(false)
  const [selectedWhatsAppCandidateIds, setSelectedWhatsAppCandidateIds] = useState(new Set())
  const [isWhatsAppMessengerOpen, setIsWhatsAppMessengerOpen] = useState(false)
  const [isAadhaarModalOpen, setIsAadhaarModalOpen] = useState(false)
  const [selectedAadhaarCandidate, setSelectedAadhaarCandidate] = useState(null)
  const [selectedAadhaarDetails, setSelectedAadhaarDetails] = useState(null)
  const [selectedAadhaarIndex, setSelectedAadhaarIndex] = useState(-1)
  const [aadhaarModalLoading, setAadhaarModalLoading] = useState(false)
  const [aadhaarModalError, setAadhaarModalError] = useState('')
  const [sendAadhaarIdLoading, setSendAadhaarIdLoading] = useState(false)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)
  const [selectedAttendanceCandidate, setSelectedAttendanceCandidate] = useState(null)
  const [candidateAttendance, setCandidateAttendance] = useState([])
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState(new Set())
  const [attendanceTotal, setAttendanceTotal] = useState(0)
  const [attendancePage, setAttendancePage] = useState(1)
  const [attendancePageSize, setAttendancePageSize] = useState(10)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceError, setAttendanceError] = useState('')
  const [attendanceFilterError, setAttendanceFilterError] = useState('')
  const [attendanceProjectOptions, setAttendanceProjectOptions] = useState([])
  const [attendanceLocationOptions, setAttendanceLocationOptions] = useState([])
  const [attendanceDistrictOptions, setAttendanceDistrictOptions] = useState([])
  const [attendanceCentreOptions, setAttendanceCentreOptions] = useState([])
  const [attendanceFilters, setAttendanceFilters] = useState({
    projectKey: '',
    locationId: '',
    districtId: '',
    centreId: '',
    date: '',
  })
  const [attendanceSuggestionsLoading, setAttendanceSuggestionsLoading] = useState(false)
  const [isReassignAttendanceModalOpen, setIsReassignAttendanceModalOpen] = useState(false)
  const [reassignAttendanceProjectKey, setReassignAttendanceProjectKey] = useState('')
  const [reassignAttendanceLocationOptions, setReassignAttendanceLocationOptions] = useState([])
  const [reassignAttendanceDistrictOptions, setReassignAttendanceDistrictOptions] = useState([])
  const [reassignAttendanceCentreOptions, setReassignAttendanceCentreOptions] = useState([])
  const [reassignAttendanceAreaId, setReassignAttendanceAreaId] = useState('')
  const [reassignAttendanceCentreId, setReassignAttendanceCentreId] = useState('')
  const [reassignAttendanceOptionsLoading, setReassignAttendanceOptionsLoading] = useState(false)
  const [reassignAttendanceSaving, setReassignAttendanceSaving] = useState(false)
  const [reassignAttendanceError, setReassignAttendanceError] = useState('')
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0)
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false)
  const [selectedPaymentsCandidate, setSelectedPaymentsCandidate] = useState(null)
  const [candidatePayments, setCandidatePayments] = useState([])
  const [paymentsTotal, setPaymentsTotal] = useState(0)
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [paymentsPageSize, setPaymentsPageSize] = useState(10)
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentsError, setPaymentsError] = useState('')
  const [attendanceImagePreview, setAttendanceImagePreview] = useState({ isOpen: false, src: '', title: '', alt: '' })
  const [attendanceMapPreview, setAttendanceMapPreview] = useState({ isOpen: false, markers: [], label: '' })
  const attendanceRequestRef = useRef(0)
  const attendanceAreaRequestRef = useRef(0)
  const attendanceCentreRequestRef = useRef(0)
  const reassignAreaRequestRef = useRef(0)
  const reassignCentreRequestRef = useRef(0)
  const [copiedKey, setCopiedKey] = useState('')
  const [zoomLens, setZoomLens] = useState({
    imageKey: null,
    left: 0,
    top: 0,
    x: 0.5,
    y: 0.5,
    visible: false
  })
  const zoomLensRef = useRef(zoomLens)
  const zoomAnimationFrameRef = useRef(null)
  const copyResetTimeoutRef = useRef(null)

  const handleCopyText = useCallback(async (key, text) => {
    if (!text || text === '—') return

    try {
      await navigator.clipboard.writeText(String(text))
      setCopiedKey(key)
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current)
      }
      copyResetTimeoutRef.current = setTimeout(() => setCopiedKey(''), 1400)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }, [])

  const getCandidateUrl = (candidateId) => {
    const basePath = window.location.pathname.includes('/gigjobs') ? '/gigjobs' : ''
    return `${window.location.origin}${basePath}/#/app/recruiter/candidate/${candidateId}`
  }

  const getCandidateId = (candidate) => candidate?.id || candidate?.candidateId || candidate?.candidate_id || candidate?._id || candidate?.new_id || candidate?.newId || ''

  const getAttendanceRows = (response) => {
    const payload = response?.data?.data ?? response?.data ?? {}
    const rows = Array.isArray(payload)
      ? payload
      : payload?.items || payload?.records || payload?.attendance || payload?.results || []
    return Array.isArray(rows) ? rows : []
  }

  const getAttendanceTotal = (response, rows) => {
    const payload = response?.data?.data ?? response?.data ?? {}
    const value = Number(payload?.total ?? payload?.totalCount ?? payload?.total_count ?? payload?.count)
    return Number.isFinite(value) && value >= 0 ? value : rows.length
  }

  const getAttendanceProjectType = (record) => {
    const declaredType = String(record.project_type ?? record.projectType ?? record.project_kind ?? record.projectKind ?? '').trim().toLowerCase()
    if (declaredType) return declaredType.includes('written') || declaredType.includes('exam') ? 'written' : 'regular'
    return record.district_id || record.districtId || record.district_name || record.district ? 'written' : 'regular'
  }

  const getApiList = (response, keys) => {
    const payload = response?.data?.data ?? response?.data ?? response
    if (Array.isArray(payload)) return payload
    for (const key of ['data', ...keys]) {
      if (Array.isArray(payload?.[key])) return payload[key]
    }
    return []
  }

  const normalizeAttendanceOptions = (items, type) => items.map((item) => {
    if (!item) return null
    if (typeof item !== 'object') {
      const id = String(item)
      return { id, name: id, ...(type ? { type } : {}) }
    }
    const id = String(item.id ?? item.project_id ?? item.projectId ?? item.location_id ?? item.locationId
      ?? item.district_id ?? item.districtId ?? item.centre_id ?? item.centreId ?? item.center_id
      ?? item.centerId ?? item.value ?? item.key ?? item._id ?? '')
    if (!id) return null
    const name = String(item.name ?? item.project_name ?? item.projectName ?? item.title
      ?? item.location_name ?? item.locationName ?? item.location
      ?? item.district_name ?? item.districtName ?? item.district
      ?? item.centre_name ?? item.centreName ?? item.centre ?? item.center
      ?? item.label ?? item.value ?? id)
    return { id, name, ...(type ? { type } : {}) }
  }).filter(Boolean)

  const selectedAttendanceProject = attendanceProjectOptions.find((project) => project.key === attendanceFilters.projectKey)
  const isAttendanceWrittenProject = selectedAttendanceProject?.type === 'written'
  const reassignAttendanceProject = attendanceProjectOptions.find((project) => project.key === reassignAttendanceProjectKey)
  const isReassignAttendanceWrittenProject = reassignAttendanceProject?.type === 'written'
  const selectedAttendanceRecords = candidateAttendance.filter((record) => selectedAttendanceIds.has(String(record.attendance_id ?? record.id ?? '')))
  const selectedAttendanceProjectTypes = new Set(selectedAttendanceRecords.map(getAttendanceProjectType))
  const hasMixedAttendanceProjectTypes = selectedAttendanceProjectTypes.size > 1
  const reassignableProjectOptions = selectedAttendanceProjectTypes.size === 1
    ? attendanceProjectOptions
      .filter((project) => selectedAttendanceProjectTypes.has(project.type))
      .map((project) => ({ ...project, id: project.key }))
    : []
  const attendanceRecordIds = candidateAttendance.map((record) => String(record.attendance_id ?? record.id ?? '')).filter(Boolean)
  const allAttendanceRowsSelected = attendanceRecordIds.length > 0 && attendanceRecordIds.every((id) => selectedAttendanceIds.has(id))
  const hasRegularAttendanceSelection = selectedAttendanceProjectTypes.has('regular')

  const openAttendanceModal = (candidate) => {
    setSelectedAttendanceCandidate(candidate)
    setCandidateAttendance([])
    setSelectedAttendanceIds(new Set())
    setAttendanceTotal(0)
    setAttendancePage(1)
    setAttendanceError('')
    setAttendanceFilterError('')
    setAttendanceProjectOptions([])
    setAttendanceLocationOptions([])
    setAttendanceDistrictOptions([])
    setAttendanceCentreOptions([])
    setAttendanceFilters({ projectKey: '', locationId: '', districtId: '', centreId: '', date: '' })
    setIsAttendanceModalOpen(true)
  }

  const openPaymentsModal = (candidate) => {
    setSelectedPaymentsCandidate(candidate)
    setCandidatePayments([])
    setPaymentsTotal(0)
    setPaymentsPage(1)
    setPaymentsError('')
    setIsPaymentsModalOpen(true)
  }

  const closePaymentsModal = () => {
    setIsPaymentsModalOpen(false)
    setSelectedPaymentsCandidate(null)
    setCandidatePayments([])
    setPaymentsTotal(0)
    setPaymentsPage(1)
    setPaymentsError('')
  }

  useEffect(() => {
    if (!isAttendanceModalOpen) return undefined
    let active = true
    setAttendanceSuggestionsLoading(true)

    const loadProjects = async () => {
      try {
        const [regularResponse, writtenResponse] = await Promise.all([
          recruiterAPI.getProjectSuggestions('', 1000, 'regular'),
          recruiterAPI.getProjectSuggestions('', 1000, 'written'),
        ])
        if (!active) return
        const regular = normalizeAttendanceOptions(getApiList(regularResponse, ['projects', 'results']), 'regular')
        const written = normalizeAttendanceOptions(getApiList(writtenResponse, ['projects', 'results']), 'written')
        setAttendanceProjectOptions([
          ...regular.map((project) => ({ ...project, key: `regular:${project.id}` })),
          ...written.map((project) => ({ ...project, key: `written:${project.id}` })),
        ])
        setAttendanceFilterError('')
      } catch (err) {
        console.error('Failed to load attendance project filters', err)
        if (active) setAttendanceFilterError('Unable to load project filter options.')
      } finally {
        if (active) setAttendanceSuggestionsLoading(false)
      }
    }

    loadProjects()
    return () => { active = false }
  }, [isAttendanceModalOpen])

  useEffect(() => {
    if (!isAttendanceModalOpen || !selectedAttendanceProject) {
      setAttendanceLocationOptions([])
      setAttendanceDistrictOptions([])
      return undefined
    }

    let active = true
    const requestId = attendanceAreaRequestRef.current + 1
    attendanceAreaRequestRef.current = requestId
    setAttendanceSuggestionsLoading(true)
    setAttendanceLocationOptions([])
    setAttendanceDistrictOptions([])
    setAttendanceCentreOptions([])

    const loadProjectAreas = async () => {
      try {
        if (isAttendanceWrittenProject) {
          const response = await recruiterAPI.getProjectDistricts(selectedAttendanceProject.id)
          const options = normalizeAttendanceOptions(getApiList(response, ['districts', 'district_options', 'districtOptions']))
          if (active && attendanceAreaRequestRef.current === requestId) setAttendanceDistrictOptions(options)
        } else {
          const response = await recruiterAPI.getProjectLocations(selectedAttendanceProject.id)
          const options = normalizeAttendanceOptions(getApiList(response, ['locations', 'location_options', 'locationOptions']))
          if (active && attendanceAreaRequestRef.current === requestId) setAttendanceLocationOptions(options)
        }
        if (active && attendanceAreaRequestRef.current === requestId) setAttendanceFilterError('')
      } catch (err) {
        console.error('Failed to load attendance location filters', err)
        if (active && attendanceAreaRequestRef.current === requestId) {
          setAttendanceFilterError(isAttendanceWrittenProject
            ? 'Unable to load district filter options.'
            : 'Unable to load location filter options.')
        }
      } finally {
        if (active && attendanceAreaRequestRef.current === requestId) setAttendanceSuggestionsLoading(false)
      }
    }

    loadProjectAreas()
    return () => { active = false }
  }, [isAttendanceModalOpen, selectedAttendanceProject?.id, isAttendanceWrittenProject])

  useEffect(() => {
    if (!isAttendanceModalOpen || !selectedAttendanceProject) {
      setAttendanceCentreOptions([])
      return undefined
    }
    const areaId = isAttendanceWrittenProject ? attendanceFilters.districtId : attendanceFilters.locationId
    if (!areaId) {
      setAttendanceCentreOptions([])
      return undefined
    }

    let active = true
    const requestId = attendanceCentreRequestRef.current + 1
    attendanceCentreRequestRef.current = requestId
    setAttendanceSuggestionsLoading(true)

    const loadCentres = async () => {
      try {
        const response = isAttendanceWrittenProject
          ? await recruiterAPI.getDistrictCentres(selectedAttendanceProject.id, areaId)
          : await recruiterAPI.getLocationCentres(selectedAttendanceProject.id, areaId)
        const options = normalizeAttendanceOptions(getApiList(response, ['centres', 'centre_options', 'centreOptions']))
        if (active && attendanceCentreRequestRef.current === requestId) {
          setAttendanceCentreOptions(options)
          setAttendanceFilterError('')
        }
      } catch (err) {
        console.error('Failed to load attendance centre filters', err)
        if (active && attendanceCentreRequestRef.current === requestId) {
          setAttendanceFilterError('Unable to load centre filter options.')
        }
      } finally {
        if (active && attendanceCentreRequestRef.current === requestId) setAttendanceSuggestionsLoading(false)
      }
    }

    loadCentres()
    return () => { active = false }
  }, [isAttendanceModalOpen, selectedAttendanceProject?.id, isAttendanceWrittenProject, attendanceFilters.locationId, attendanceFilters.districtId])

  useEffect(() => {
    if (!isReassignAttendanceModalOpen || !reassignAttendanceProject) {
      setReassignAttendanceLocationOptions([])
      setReassignAttendanceDistrictOptions([])
      setReassignAttendanceCentreOptions([])
      return undefined
    }

    let active = true
    const requestId = reassignAreaRequestRef.current + 1
    reassignAreaRequestRef.current = requestId
    setReassignAttendanceOptionsLoading(true)
    setReassignAttendanceLocationOptions([])
    setReassignAttendanceDistrictOptions([])
    setReassignAttendanceCentreOptions([])
    setReassignAttendanceAreaId('')
    setReassignAttendanceCentreId('')

    const loadReassignmentAreas = async () => {
      try {
        const response = isReassignAttendanceWrittenProject
          ? await recruiterAPI.getProjectDistricts(reassignAttendanceProject.id)
          : await recruiterAPI.getProjectLocations(reassignAttendanceProject.id)
        const options = isReassignAttendanceWrittenProject
          ? normalizeAttendanceOptions(getApiList(response, ['districts', 'district_options', 'districtOptions']))
          : normalizeAttendanceOptions(getApiList(response, ['locations', 'location_options', 'locationOptions']))
        if (active && reassignAreaRequestRef.current === requestId) {
          if (isReassignAttendanceWrittenProject) setReassignAttendanceDistrictOptions(options)
          else setReassignAttendanceLocationOptions(options)
          setReassignAttendanceError('')
        }
      } catch (err) {
        console.error('Failed to load attendance reassignment areas', err)
        if (active && reassignAreaRequestRef.current === requestId) {
          setReassignAttendanceError(isReassignAttendanceWrittenProject
            ? 'Unable to load destination districts.'
            : 'Unable to load destination locations.')
        }
      } finally {
        if (active && reassignAreaRequestRef.current === requestId) setReassignAttendanceOptionsLoading(false)
      }
    }

    loadReassignmentAreas()
    return () => { active = false }
  }, [isReassignAttendanceModalOpen, reassignAttendanceProject?.id, isReassignAttendanceWrittenProject])

  useEffect(() => {
    if (!isReassignAttendanceModalOpen || !reassignAttendanceProject || !isReassignAttendanceWrittenProject || !reassignAttendanceAreaId) {
      setReassignAttendanceCentreOptions([])
      return undefined
    }

    let active = true
    const requestId = reassignCentreRequestRef.current + 1
    reassignCentreRequestRef.current = requestId
    setReassignAttendanceOptionsLoading(true)

    const loadReassignmentCentres = async () => {
      try {
        const response = await recruiterAPI.getDistrictCentres(reassignAttendanceProject.id, reassignAttendanceAreaId)
        const options = normalizeAttendanceOptions(getApiList(response, ['centres', 'centre_options', 'centreOptions']))
        if (active && reassignCentreRequestRef.current === requestId) {
          setReassignAttendanceCentreOptions(options)
          setReassignAttendanceError('')
        }
      } catch (err) {
        console.error('Failed to load attendance reassignment centres', err)
        if (active && reassignCentreRequestRef.current === requestId) {
          setReassignAttendanceError('Unable to load destination centres.')
        }
      } finally {
        if (active && reassignCentreRequestRef.current === requestId) setReassignAttendanceOptionsLoading(false)
      }
    }

    loadReassignmentCentres()
    return () => { active = false }
  }, [isReassignAttendanceModalOpen, reassignAttendanceProject?.id, isReassignAttendanceWrittenProject, reassignAttendanceAreaId])

  useEffect(() => {
    if (!isAttendanceModalOpen || !selectedAttendanceCandidate) return undefined
    const candidateId = getCandidateId(selectedAttendanceCandidate)
    if (!candidateId) {
      setAttendanceError('Candidate ID not found.')
      return undefined
    }

    let active = true
    const requestId = attendanceRequestRef.current + 1
    attendanceRequestRef.current = requestId
    setSelectedAttendanceIds(new Set())
    setAttendanceLoading(true)
    setAttendanceError('')
    const params = {
      project_id: selectedAttendanceProject?.id || undefined,
      location_id: !isAttendanceWrittenProject ? attendanceFilters.locationId || undefined : undefined,
      district_id: isAttendanceWrittenProject ? attendanceFilters.districtId || undefined : undefined,
      centre_id: attendanceFilters.centreId || undefined,
      date: attendanceFilters.date || undefined,
      offset: (attendancePage - 1) * attendancePageSize,
      limit: attendancePageSize,
    }

    const loadAttendance = async () => {
      try {
        const response = await recruiterAPI.getCandidateAttendance(candidateId, params)
        if (active && attendanceRequestRef.current === requestId) {
          const rows = getAttendanceRows(response)
          setCandidateAttendance(rows)
          setSelectedAttendanceIds(new Set())
          setAttendanceTotal(getAttendanceTotal(response, rows))
        }
      } catch (err) {
        console.error('Failed to load candidate attendance', err)
        if (active && attendanceRequestRef.current === requestId) {
          setAttendanceError('Unable to load attendance. Please try again.')
        }
      } finally {
        if (active && attendanceRequestRef.current === requestId) setAttendanceLoading(false)
      }
    }

    loadAttendance()
    return () => {
      active = false
      if (attendanceRequestRef.current === requestId) attendanceRequestRef.current += 1
    }
  }, [isAttendanceModalOpen, selectedAttendanceCandidate, selectedAttendanceProject?.id, isAttendanceWrittenProject, attendanceFilters.locationId, attendanceFilters.districtId, attendanceFilters.centreId, attendanceFilters.date, attendancePage, attendancePageSize, attendanceRefreshKey])

  useEffect(() => {
    if (!isPaymentsModalOpen || !selectedPaymentsCandidate) return undefined
    const candidateId = selectedPaymentsCandidate.new_id
      || selectedPaymentsCandidate.newId
      || getCandidateId(selectedPaymentsCandidate)
    if (!candidateId) {
      setPaymentsError('Candidate ID not found.')
      return undefined
    }

    let active = true
    setPaymentsLoading(true)
    setPaymentsError('')
    recruiterAPI.getCandidatePayments(candidateId, {
      offset: (paymentsPage - 1) * paymentsPageSize,
      limit: paymentsPageSize,
    }).then((response) => {
      if (!active) return
      const payload = response?.data?.data ?? response?.data ?? {}
      const rows = Array.isArray(payload)
        ? payload
        : payload?.items || payload?.payments || payload?.records || payload?.results || []
      setCandidatePayments(Array.isArray(rows) ? rows : [])
      const total = Number(payload?.total ?? payload?.totalCount ?? payload?.total_count ?? payload?.count)
      setPaymentsTotal(Number.isFinite(total) && total >= 0 ? total : rows.length)
    }).catch((loadError) => {
      console.error('Failed to load candidate payments:', loadError)
      if (active) {
        setCandidatePayments([])
        setPaymentsTotal(0)
        setPaymentsError('Unable to load this candidate\'s payments. Please try again.')
      }
    }).finally(() => {
      if (active) setPaymentsLoading(false)
    })

    return () => { active = false }
  }, [isPaymentsModalOpen, selectedPaymentsCandidate, paymentsPage, paymentsPageSize])

  const closeAttendanceModal = () => {
    attendanceRequestRef.current += 1
    attendanceAreaRequestRef.current += 1
    attendanceCentreRequestRef.current += 1
    setIsAttendanceModalOpen(false)
    setSelectedAttendanceCandidate(null)
    setCandidateAttendance([])
    setAttendanceTotal(0)
    setAttendancePage(1)
    setAttendanceError('')
    setAttendanceFilterError('')
    setAttendanceLoading(false)
    setAttendanceSuggestionsLoading(false)
    setAttendanceFilters({ projectKey: '', locationId: '', districtId: '', centreId: '', date: '' })
  }

  const getAttendanceValue = (record, keys, fallback = '—') => {
    for (const key of keys) {
      if (record?.[key] !== undefined && record?.[key] !== null && record[key] !== '') return record[key]
    }
    return fallback
  }

  const getAttendanceCoordinates = (record, key) => {
    const value = record?.[key]
    if (value && typeof value === 'object') {
      const latitude = Number(value.lat ?? value.latitude ?? value.latitute)
      const longitude = Number(value.lng ?? value.longitude ?? value.lon ?? value.long)
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude }
    }

    const latitude = Number(record?.[`${key}_lat`] ?? record?.[`${key}_latitude`] ?? record?.[`${key}_latitute`])
    const longitude = Number(record?.[`${key}_lng`] ?? record?.[`${key}_longitude`] ?? record?.[`${key}_lon`] ?? record?.[`${key}_long`])
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null
  }

  const openAttendanceImage = (url, title, alt) => {
    if (url) setAttendanceImagePreview({ isOpen: true, src: url, title, alt })
  }

  const getAttendanceMapMarkers = (record) => {
    const projectLocation = record.project_location || record.projectLocation || record.project
    const checkInLocation = record.checkin_location || record.checkInLocation || record.check_in || record.checkin
    const checkOutLocation = record.checkout_location || record.checkOutLocation || record.check_out || record.checkout
    const project = getAttendanceCoordinates({ project_location: projectLocation }, 'project_location')
      || getAttendanceCoordinates(record, 'project')
    const checkIn = getAttendanceCoordinates({ checkin_location: checkInLocation }, 'checkin_location')
      || getAttendanceCoordinates(record, 'checkin')
    const checkOut = getAttendanceCoordinates({ checkout_location: checkOutLocation }, 'checkout_location')
      || getAttendanceCoordinates(record, 'checkout')
    const markers = []

    if (project) markers.push({ ...project, label: 'Project location', type: 'project' })
    if (checkIn) {
      markers.push({
        ...checkIn,
        label: 'Check-in location',
        type: 'checkin',
        distance_km: Number(checkInLocation?.distance_km ?? checkInLocation?.distance),
      })
    }
    if (checkOut) {
      markers.push({
        ...checkOut,
        label: 'Check-out location',
        type: 'checkout',
        distance_km: Number(checkOutLocation?.distance_km ?? checkOutLocation?.distance),
      })
    }
    return markers
  }

  const openAttendanceMap = (record, locationLabel) => {
    const markers = getAttendanceMapMarkers(record)
    if (markers.length) setAttendanceMapPreview({ isOpen: true, markers, label: locationLabel || 'Attendance locations' })
  }

  const updateAttendanceFilters = (updates) => {
    setAttendanceFilters((current) => ({ ...current, ...updates }))
    setAttendancePage(1)
  }

  const toggleAttendanceSelection = (attendanceId, checked) => {
    const id = String(attendanceId ?? '')
    if (!id) return
    setSelectedAttendanceIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAllAttendanceRows = (checked) => {
    setSelectedAttendanceIds((current) => {
      const next = new Set(current)
      attendanceRecordIds.forEach((id) => {
        if (checked) next.add(id)
        else next.delete(id)
      })
      return next
    })
  }

  const openReassignAttendanceModal = () => {
    if (selectedAttendanceRecords.length === 0 || hasMixedAttendanceProjectTypes) return
    setReassignAttendanceProjectKey('')
    setReassignAttendanceAreaId('')
    setReassignAttendanceCentreId('')
    setReassignAttendanceError('')
    setIsReassignAttendanceModalOpen(true)
  }

  const closeReassignAttendanceModal = () => {
    reassignAreaRequestRef.current += 1
    reassignCentreRequestRef.current += 1
    setIsReassignAttendanceModalOpen(false)
    setReassignAttendanceProjectKey('')
    setReassignAttendanceAreaId('')
    setReassignAttendanceCentreId('')
    setReassignAttendanceLocationOptions([])
    setReassignAttendanceDistrictOptions([])
    setReassignAttendanceCentreOptions([])
    setReassignAttendanceOptionsLoading(false)
    setReassignAttendanceError('')
  }

  const submitAttendanceReassignment = async () => {
    const candidateId = getCandidateId(selectedAttendanceCandidate)
    const projectType = reassignAttendanceProject?.type
    const selectedIds = selectedAttendanceRecords
      .map((record) => String(record.attendance_id ?? record.id ?? ''))
      .filter(Boolean)
    if (!candidateId || selectedIds.length === 0 || !reassignAttendanceProject) {
      setReassignAttendanceError('Select attendance records and a destination project.')
      return
    }
    if (isReassignAttendanceWrittenProject && !reassignAttendanceAreaId) {
      setReassignAttendanceError('Select a destination district.')
      return
    }
    if (!isReassignAttendanceWrittenProject && !reassignAttendanceAreaId) {
      setReassignAttendanceError('Select a destination location.')
      return
    }
    if (isReassignAttendanceWrittenProject && !reassignAttendanceCentreId) {
      setReassignAttendanceError('Select a destination centre.')
      return
    }

    const sourceProjectTypes = [...new Set(selectedAttendanceRecords.map(getAttendanceProjectType))]
    const sourceProjectIds = [...new Set(selectedAttendanceRecords
      .map((record) => String(record.project_id ?? record.projectId ?? record.project_od ?? ''))
      .filter(Boolean))]
    if (
      (sourceProjectTypes.includes('regular') && projectType === 'written')
      || (sourceProjectTypes.includes('written') && projectType !== 'written')
    ) {
      setReassignAttendanceError('Attendance can only be reassigned to a project of the same type.')
      return
    }

    setReassignAttendanceSaving(true)
    setReassignAttendanceError('')
    const payload = {
      current: {
        attendance_ids: selectedIds,
        project_types: sourceProjectTypes,
        project_ids: sourceProjectIds,
      },
      destination: {
        project_type: projectType,
        project_id: reassignAttendanceProject.id,
        ...(isReassignAttendanceWrittenProject
          ? { district_id: reassignAttendanceAreaId, centre_id: reassignAttendanceCentreId }
          : { location_id: reassignAttendanceAreaId }),
      },
    }

    try {
      await recruiterAPI.reassignCandidateAttendance(candidateId, payload)
      closeReassignAttendanceModal()
      setSelectedAttendanceIds(new Set())
      setAttendancePage(1)
      setAttendanceRefreshKey((current) => current + 1)
    } catch (err) {
      console.error('Failed to reassign candidate attendance', err)
      setReassignAttendanceError(err?.message || 'Unable to reassign attendance. Please try again.')
    } finally {
      setReassignAttendanceSaving(false)
    }
  }

  const attendanceTotalPages = Math.max(1, Math.ceil(attendanceTotal / attendancePageSize))
  const attendanceFirstRow = attendanceTotal > 0 ? (attendancePage - 1) * attendancePageSize + 1 : 0
  const attendanceLastRow = Math.min((attendancePage - 1) * attendancePageSize + candidateAttendance.length, attendanceTotal)

  const renderAttendanceTable = () => (
    <div className="candidate-attendance-content">
      <div className="candidate-attendance-filters">
        <label className="candidate-attendance-filter">
          <span>Project</span>
          <SearchableProjectSelect
            options={attendanceProjectOptions.map((project) => ({
              id: project.key,
              name: `${project.name} (${project.type === 'written' ? 'Written' : 'Regular'})`,
            }))}
            value={attendanceFilters.projectKey}
            placeholder="All projects"
            disabled={attendanceSuggestionsLoading && attendanceProjectOptions.length === 0}
            onChange={(projectKey) => updateAttendanceFilters({
              projectKey,
              locationId: '',
              districtId: '',
              centreId: '',
            })}
          />
        </label>
        <label className="candidate-attendance-filter">
          <span>Location</span>
          <SearchableProjectSelect
            options={attendanceLocationOptions}
            value={attendanceFilters.locationId}
            placeholder={isAttendanceWrittenProject ? 'Not used for written' : 'All locations'}
            disabled={!selectedAttendanceProject || isAttendanceWrittenProject}
            onChange={(locationId) => updateAttendanceFilters({
              locationId,
              centreId: '',
            })}
          />
        </label>
        <label className="candidate-attendance-filter">
          <span>District</span>
          <SearchableProjectSelect
            options={attendanceDistrictOptions}
            value={attendanceFilters.districtId}
            placeholder={isAttendanceWrittenProject ? 'All districts' : 'Not used for regular'}
            disabled={!selectedAttendanceProject || !isAttendanceWrittenProject}
            onChange={(districtId) => updateAttendanceFilters({
              districtId,
              centreId: '',
            })}
          />
        </label>
        <label className="candidate-attendance-filter">
          <span>Centre</span>
          <SearchableProjectSelect
            options={attendanceCentreOptions}
            value={attendanceFilters.centreId}
            placeholder="All centres"
            disabled={!selectedAttendanceProject || !(isAttendanceWrittenProject ? attendanceFilters.districtId : attendanceFilters.locationId)}
            onChange={(centreId) => updateAttendanceFilters({ centreId })}
          />
        </label>
        <label className="candidate-attendance-filter">
          <span>Date</span>
          <input
            className="form-control"
            type="date"
            value={attendanceFilters.date}
            onChange={(event) => updateAttendanceFilters({ date: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="btn btn-outline btn-sm candidate-attendance-clear"
          onClick={() => {
            updateAttendanceFilters({ projectKey: '', locationId: '', districtId: '', centreId: '', date: '' })
          }}
        >
          Clear filters
        </button>
      </div>

      {attendanceFilterError && <div className="candidate-attendance-filter-error">{attendanceFilterError}</div>}

      <div className="candidate-attendance-summary">
        <strong>{attendanceTotal}</strong> attendance record{attendanceTotal === 1 ? '' : 's'}
        {attendanceLoading && <span>Updating results...</span>}
      </div>
      {candidateAttendance.length > 0 && (
        <div className="candidate-attendance-selection-bar">
          <label>
            <input
              type="checkbox"
              checked={allAttendanceRowsSelected}
              disabled={attendanceLoading}
              onChange={(event) => toggleAllAttendanceRows(event.target.checked)}
              aria-label="Select all attendance records on this page"
            />
            Select all on this page
          </label>
          <span>{selectedAttendanceIds.size} selected</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={attendanceLoading || selectedAttendanceIds.size === 0 || hasMixedAttendanceProjectTypes}
            onClick={openReassignAttendanceModal}
          >
            Reassign selected
          </button>
          {hasMixedAttendanceProjectTypes && (
            <span className="candidate-attendance-selection-warning">
              Select attendance from either regular or written projects, not both.
            </span>
          )}
        </div>
      )}

      {attendanceLoading && candidateAttendance.length === 0 ? (
        <div className="candidate-attendance-state">Loading attendance records...</div>
      ) : attendanceError ? (
        <div className="candidate-attendance-state candidate-attendance-state-error">{attendanceError}</div>
      ) : candidateAttendance.length === 0 ? (
        <div className="candidate-attendance-state">No attendance records match these filters.</div>
      ) : (
        <div className="candidate-attendance-records">
          {candidateAttendance.map((record, index) => {
            const district = getAttendanceValue(record, ['district_name', 'districtName', 'district'])
            const location = getAttendanceValue(record, ['location_name', 'locationName', 'location'])
            const centre = getAttendanceValue(record, ['centre_name', 'centreName', 'center_name', 'centerName', 'centre', 'center'])
            const projectType = getAttendanceValue(record, ['project_type', 'projectType'], district !== '—' ? 'written' : 'regular')
            const profileImage = getAttendanceValue(record, ['profile_image', 'profileImage', 'photo', 'avatar', 'candidate_image', 'candidate_photo'], '')
            const checkInImage = getAttendanceValue(record, ['check_in_image', 'checkin_image', 'checkInImage', 'check_in_photo', 'check_in_img'], '')
            const checkOutImage = getAttendanceValue(record, ['check_out_image', 'checkout_image', 'checkOutImage', 'check_out_photo', 'check_out_img'], '')
            const locationLabel = district !== '—' ? district : location
            const mapMarkers = getAttendanceMapMarkers(record)
            const status = getAttendanceValue(record, ['attendance_status', 'attendanceStatus', 'status'])
            const images = [
              { url: profileImage, title: 'Candidate image', alt: 'Candidate profile' },
              { url: checkInImage, title: 'Check-in image', alt: 'Check in' },
              { url: checkOutImage, title: 'Check-out image', alt: 'Check out' },
            ].filter((image) => image.url)

            return (
              <article className="candidate-attendance-record" key={record.attendance_id || record.id || index}>
                <header className="candidate-attendance-record-header">
                  <div className="candidate-attendance-record-title">
                    <input
                      type="checkbox"
                      className="candidate-attendance-record-checkbox"
                      checked={selectedAttendanceIds.has(String(record.attendance_id ?? record.id ?? ''))}
                      disabled={attendanceLoading || (!record.attendance_id && !record.id)}
                      onChange={(event) => toggleAttendanceSelection(record.attendance_id ?? record.id, event.target.checked)}
                      aria-label={`Select attendance record ${record.attendance_id || record.id || index + 1}`}
                    />
                    <span className="candidate-attendance-record-index">#{(attendancePage - 1) * attendancePageSize + index + 1}</span>
                    <div>
                      <h3>{getAttendanceValue(record, ['project_name', 'projectName', 'project', 'title'], 'Unknown project')}</h3>
                      <div className="candidate-attendance-record-subtitle">
                        {formatDate(getAttendanceValue(record, ['attendance_date', 'attendanceDate', 'work_date', 'date', 'created_at'], ''))}
                        <span>{String(projectType).toLowerCase().includes('written') ? 'Written project' : 'Regular project'}</span>
                      </div>
                    </div>
                  </div>
                  <Tag variant={String(status).toLowerCase().includes('present') ? 'green' : 'gray'}>{status}</Tag>
                </header>

                <div className="candidate-attendance-record-details">
                  <div><span>Attendance ID</span><strong>{getAttendanceValue(record, ['attendance_id', 'id'])}</strong></div>
                  <div><span>Project ID</span><strong>{getAttendanceValue(record, ['project_id', 'projectId', 'project_od'])}</strong></div>
                  {district !== '—' ? (
                    <div><span>District</span><strong>{district}<small>ID: {getAttendanceValue(record, ['district_id', 'districtId'])}</small></strong></div>
                  ) : (
                    <div><span>Location</span><strong>{location}<small>ID: {getAttendanceValue(record, ['location_id', 'locationId'])}</small></strong></div>
                  )}
                  <div><span>Centre</span><strong>{centre}<small>ID: {getAttendanceValue(record, ['centre_id', 'centreId', 'center_id', 'centerId', 'centre_code', 'centreCode'])}</small></strong></div>
                  <div><span>Clock in</span><strong>{getAttendanceValue(record, ['clock_in', 'clockIn', 'check_in_time', 'checkin_time'])}</strong></div>
                  <div><span>Clock out</span><strong>{getAttendanceValue(record, ['clock_out', 'clockOut', 'check_out_time', 'checkout_time'])}</strong></div>
                </div>

                {(images.length > 0 || mapMarkers.length > 0) && (
                  <footer className="candidate-attendance-record-media">
                    <div className="candidate-attendance-thumbnails">
                      {images.map((image) => (
                        <button
                          key={image.title}
                          type="button"
                          className="candidate-attendance-thumbnail-button"
                          onClick={() => openAttendanceImage(image.url, image.title, image.alt)}
                          aria-label={`View ${image.title}`}
                          title={image.title}
                        >
                          <img src={image.url} alt={image.alt} />
                          <span>{image.title.replace(' image', '')}</span>
                        </button>
                      ))}
                    </div>
                    {mapMarkers.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openAttendanceMap(record, locationLabel)}
                      >
                        <FontAwesomeIcon icon={faMapMarkerAlt} /> View map
                      </button>
                    )}
                  </footer>
                )}
              </article>
            )
          })}
        </div>
      )}
      {attendanceTotal > 0 && (
        <div className="candidate-attendance-pagination">
          <div>
            Showing <strong>{attendanceFirstRow}</strong>–<strong>{attendanceLastRow}</strong> of <strong>{attendanceTotal}</strong>
          </div>
          <div className="candidate-attendance-pagination-controls">
            <label>
              Rows per page
              <select
                className="form-control"
                value={attendancePageSize}
                onChange={(event) => {
                  setAttendancePageSize(Number(event.target.value))
                  setAttendancePage(1)
                }}
              >
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={attendanceLoading || attendancePage <= 1}
              onClick={() => setAttendancePage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>Page {attendancePage} of {attendanceTotalPages}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={attendanceLoading || attendancePage >= attendanceTotalPages}
              onClick={() => setAttendancePage((current) => Math.min(attendanceTotalPages, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const getAadhaarUploadUrl = (candidate) => {
    const basePath = window.location.pathname.includes('/gigjobs') ? '/gigjobs' : ''
    const candidateId = candidate.id || candidate.candidateId || candidate.candidate_id || candidate._id || ''
    const params = new URLSearchParams()
    if (candidateId) params.set('candidate_id', candidateId)
    return `${window.location.origin}${basePath}/#/attendance/aadhaar-upload?${params.toString()}`
  }

  const getAadhaarFrontUrl = (candidate) => {
    const details = selectedAadhaarDetails || candidate
    return details?.aadhaarFront || details?.aadhaar_front || details?.aadhaar_front_image || details?.aadhaar_front_url || ''
  }

  const getAadhaarBackUrl = (candidate) => {
    const details = selectedAadhaarDetails || candidate
    return details?.aadhaarBack || details?.aadhaar_back || details?.aadhaar_back_image || details?.aadhaar_back_url || ''
  }

  const fetchAadhaarCandidateDetails = async (candidateId) => {
    setAadhaarModalLoading(true)
    setAadhaarModalError('')
    setSelectedAadhaarDetails(null)

    try {
      const response = await recruiterAPI.getCandidateById(candidateId, { silent: true })
      const payload = response.data?.data || response.data
      setSelectedAadhaarDetails(payload || null)
    } catch (err) {
      console.error('Failed to load candidate details for Aadhaar modal', err)
      setAadhaarModalError('Unable to load candidate Aadhaar images. Please try again.')
    } finally {
      setAadhaarModalLoading(false)
    }
  }

  const loadAadhaarCandidateByIndex = (index) => {
    const candidate = candidates[index]
    if (!candidate) return

    const candidateId = candidate?.id || candidate?.candidateId || candidate?.candidate_id || candidate?._id || ''
    if (!candidateId) {
      setAadhaarModalError('Candidate ID not found.')
      return
    }

    const initialLens = {
      imageKey: null,
      left: 0,
      top: 0,
      x: 0.5,
      y: 0.5,
      visible: false
    }

    setSelectedAadhaarIndex(index)
    setSelectedAadhaarCandidate(candidate)
    setSelectedAadhaarDetails(null)
    setAadhaarModalError('')
    setZoomLens(initialLens)
    zoomLensRef.current = initialLens
    fetchAadhaarCandidateDetails(candidateId)
  }

  const flushZoomLensUpdate = () => {
    if (zoomAnimationFrameRef.current) {
      cancelAnimationFrame(zoomAnimationFrameRef.current)
      zoomAnimationFrameRef.current = null
    }
    setZoomLens(zoomLensRef.current)
  }

  const scheduleZoomLensUpdate = () => {
    if (zoomAnimationFrameRef.current) return
    zoomAnimationFrameRef.current = requestAnimationFrame(() => {
      zoomAnimationFrameRef.current = null
      setZoomLens(zoomLensRef.current)
    })
  }

  const handleAadhaarImageMouseMove = (imageKey, event) => {
    const container = event.currentTarget.getBoundingClientRect()
    const imageElement = event.currentTarget.querySelector('img')
    const imageBounds = imageElement?.getBoundingClientRect() || container
    const x = Math.min(Math.max((event.clientX - imageBounds.left) / imageBounds.width, 0), 1)
    const y = Math.min(Math.max((event.clientY - imageBounds.top) / imageBounds.height, 0), 1)
    const lensWidth = 220
    const lensHeight = 140
    const left = Math.min(Math.max(event.clientX - container.left - lensWidth / 2, 0), container.width - lensWidth)
    const top = Math.min(Math.max(event.clientY - container.top - lensHeight / 2, 0), container.height - lensHeight)

    zoomLensRef.current = {
      imageKey,
      left,
      top,
      x,
      y,
      visible: true
    }
    scheduleZoomLensUpdate()
  }

  const handleAadhaarImageMouseLeave = () => {
    if (zoomAnimationFrameRef.current) {
      cancelAnimationFrame(zoomAnimationFrameRef.current)
      zoomAnimationFrameRef.current = null
    }
    zoomLensRef.current = {
      ...zoomLensRef.current,
      visible: false,
      imageKey: null
    }
    setZoomLens(zoomLensRef.current)
  }

  const openAadhaarModal = (candidate, index) => {
    setIsAadhaarModalOpen(true)
    loadAadhaarCandidateByIndex(index)
  }

  const closeAadhaarModal = () => {
    setIsAadhaarModalOpen(false)
    setSelectedAadhaarCandidate(null)
    setSelectedAadhaarDetails(null)
    setSelectedAadhaarIndex(-1)
    setAadhaarModalError('')
    const resetLens = {
      imageKey: null,
      left: 0,
      top: 0,
      x: 0.5,
      y: 0.5,
      visible: false
    }
    setZoomLens(resetLens)
    zoomLensRef.current = resetLens
  }

  const showPreviousAadhaarCandidate = () => {
    if (selectedAadhaarIndex > 0) {
      loadAadhaarCandidateByIndex(selectedAadhaarIndex - 1)
      const resetLens = {
        imageKey: null,
        left: 0,
        top: 0,
        x: 0.5,
        y: 0.5,
        visible: false
      }
      setZoomLens(resetLens)
      zoomLensRef.current = resetLens
    }
  }

  const showNextAadhaarCandidate = () => {
    if (selectedAadhaarIndex < candidates.length - 1) {
      loadAadhaarCandidateByIndex(selectedAadhaarIndex + 1)
      const resetLens = {
        imageKey: null,
        left: 0,
        top: 0,
        x: 0.5,
        y: 0.5,
        visible: false
      }
      setZoomLens(resetLens)
      zoomLensRef.current = resetLens
    }
  }

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isAadhaarModalOpen) return undefined

    const handleAadhaarModalKeyDown = (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        showNextAadhaarCandidate()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPreviousAadhaarCandidate()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (selectedAadhaarCandidate && !sendAadhaarIdLoading) {
          handleSendCandidateId(selectedAadhaarCandidate)
        }
      }
    }

    window.addEventListener('keydown', handleAadhaarModalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleAadhaarModalKeyDown)
    }
  }, [isAadhaarModalOpen, showNextAadhaarCandidate, showPreviousAadhaarCandidate])

  const handleSendCandidateId = async (candidate) => {
    const candidateId = candidate?.id || candidate?.candidateId || candidate?.candidate_id || candidate?._id || ''
    if (!candidateId) return
    setSendAadhaarIdLoading(true)
    try {
      await recruiterAPI.postCandidateId(candidateId)
    } catch (err) {
      console.error('Send candidate id failed', err)
    } finally {
      setSendAadhaarIdLoading(false)
    }
  }

  const handleSearch = () => {
    setAppliedSearch({
      name: nameSearch.trim(),
      mobile: mobileSearch.trim(),
      whatsapp: whatsappSearch.trim(),
      email: emailSearch.trim(),
      aadhaar: formatAadhaarInput(aadhaarSearch),
    })
    setPage(1)
  }

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    setError('')

    const combinedSearch = [appliedSearch.name, appliedSearch.mobile, appliedSearch.whatsapp, appliedSearch.email, appliedSearch.aadhaar]
      .filter(Boolean)
      .join(' ')

    const params = {
      search: combinedSearch || undefined,
      name: appliedSearch.name || undefined,
      mobile: appliedSearch.mobile || undefined,
      whatsapp: appliedSearch.whatsapp || undefined,
      email: appliedSearch.email || undefined,
      aadhaar: appliedSearch.aadhaar || undefined,
      location: locationFilter !== 'All' ? locationFilter : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }

    try {
      const response = await recruiterAPI.getCandidates(params)
      const data = response.data?.data || {}
      const items = data.items || data.candidates || data.results || []
      const total = data.total || data.totalCount || data.count || data.meta?.total || items.length

      setCandidates(Array.isArray(items) ? items : [])
      setTotalCandidates(typeof total === 'number' ? total : Number(total) || 0)
    } catch (err) {
      setError('Unable to load candidate database. Please try again.')
      setCandidates([])
      setTotalCandidates(0)
    } finally {
      setLoading(false)
    }
  }, [appliedSearch.name, appliedSearch.mobile, appliedSearch.whatsapp, appliedSearch.email, appliedSearch.aadhaar, locationFilter, fromDate, toDate, page, pageSize])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  useEffect(() => {
    setSelectedWhatsAppCandidateIds(new Set())
  }, [candidates])

  const offset = Math.max(0, (page - 1) * pageSize)
  const totalPages = Math.max(1, Math.ceil(totalCandidates / pageSize))
  const firstRow = totalCandidates === 0 ? 0 : offset + 1
  const lastRow = Math.min(offset + pageSize, totalCandidates)

  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  const activeFilters = []
  if (appliedSearch.name) activeFilters.push(`Name: ${appliedSearch.name}`)
  if (appliedSearch.mobile) activeFilters.push(`Mobile: ${appliedSearch.mobile}`)
  if (appliedSearch.whatsapp) activeFilters.push(`WhatsApp: ${appliedSearch.whatsapp}`)
  if (appliedSearch.email) activeFilters.push(`Email: ${appliedSearch.email}`)
  if (appliedSearch.aadhaar) activeFilters.push(`Aadhaar: ${appliedSearch.aadhaar}`)
  if (locationFilter !== 'All') activeFilters.push(`Location: ${locationFilter}`)
  if (fromDate || toDate) activeFilters.push(`Joined: ${fromDate || 'Any'} → ${toDate || 'Any'}`)

  const getCandidateWhatsAppId = (candidate) => String(candidate.id ?? candidate.candidateId ?? candidate.candidate_id ?? candidate._id ?? candidate.new_id ?? candidate.newId ?? '')
  const getCandidateWhatsAppPhone = (candidate) => String(candidate.whatsapp || candidate.phone || candidate.mobile || candidate.mobile_number || '').trim()
  const whatsappCandidates = candidates.filter((candidate) => getCandidateWhatsAppPhone(candidate))
  const selectedWhatsAppCandidates = candidates.filter((candidate) => selectedWhatsAppCandidateIds.has(getCandidateWhatsAppId(candidate)))
  const allWhatsAppCandidatesSelected = whatsappCandidates.length > 0 && whatsappCandidates.every((candidate) => selectedWhatsAppCandidateIds.has(getCandidateWhatsAppId(candidate)))

  const toggleWhatsAppCandidate = (candidate, checked) => {
    const candidateId = getCandidateWhatsAppId(candidate)
    if (!candidateId) return
    setSelectedWhatsAppCandidateIds((current) => {
      const next = new Set(current)
      if (checked) next.add(candidateId)
      else next.delete(candidateId)
      return next
    })
  }

  const handleSendCandidateWhatsApp = async ({ templateId, variables }) => {
    const recipientIds = selectedWhatsAppCandidates.map(getCandidateWhatsAppId).filter(Boolean)
    if (!recipientIds.length) return
    await recruiterAPI.sendWhatsAppMessage({ to: recipientIds, templateId, variables, origin: 'candidate_database_id' })
    setIsWhatsAppMessengerOpen(false)
    setSelectedWhatsAppCandidateIds(new Set())
  }

  const tableRows = candidates.map((candidate, index) => {
    const name = candidate.name || candidate.fullName || 'Unknown'
    const newId = candidate.new_id ?? candidate.newId ?? candidate.id ?? candidate.candidateId ?? '—'
    const id = candidate.id
    const displayId = newId === '—' ? '—' : `CYN${new Date().getFullYear()}TEMP${newId}`
    const email = candidate.email || '—'
    const whatsapp = candidate.whatsapp || candidate.phone || candidate.mobile || '—'
    const mobile = candidate.mobile
    const aadhaarNumber = candidate.aadhaarNumber || '—'
    const aadhaarStatus = candidate.aadhaarVerificationStatus || candidate.kyc || 'Unknown'
    const location = candidate.location || candidate.city || '—'
    const joinDate = candidate.dateOfJoining || candidate.createdAt || candidate.joined || ''
    const joinTime = joinDate ? new Date(joinDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
    // const username = candidate.username || email.split('@')[0] || '—'



    return (
      <tr key={id || index} style={{ cursor: 'default', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-light)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
        <td>
          <input
            type="checkbox"
            aria-label={`Select ${name} for WhatsApp`}
            checked={selectedWhatsAppCandidateIds.has(getCandidateWhatsAppId(candidate))}
            disabled={!getCandidateWhatsAppId(candidate) || !getCandidateWhatsAppPhone(candidate)}
            onChange={(event) => toggleWhatsAppCandidate(candidate, event.target.checked)}
          />
        </td>
        <td>{offset + index + 1}</td>
        <td>{new Date(joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>{joinTime}</td>
        <td>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="project-name-cell">{name}</div>
            <div className="project-subtext" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {email}
              {email !== '—' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyText(`email-${id || index}`, email)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: copiedKey === `email-${id || index}` ? 'var(--success)' : 'var(--text-secondary)',
                    fontSize: 12
                  }}
                  title={copiedKey === `email-${id || index}` ? 'Copied email' : 'Copy email'}
                >
                  <FontAwesomeIcon icon={copiedKey === `email-${id || index}` ? faCheck : faCopy} />
                </button>
              )}
            </div>
          </div>
        </td>
        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {displayId}
            {newId !== '—' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopyText(`id-${id || index}`, String(displayId))
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: copiedKey === `id-${id || index}` ? 'var(--success)' : 'var(--text-secondary)',
                  fontSize: 12
                }}
                title={copiedKey === `id-${id || index}` ? 'Copied New ID' : 'Copy New ID'}
              >
                <FontAwesomeIcon icon={copiedKey === `id-${id || index}` ? faCheck : faCopy} />
              </button>
            )}
          </div>
        </td>
        <td>{mobile}</td>
        <td>{whatsapp}</td>
        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {aadhaarNumber}
            {aadhaarNumber !== '—' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopyText(`aadhaar-${id || index}`, aadhaarNumber)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: copiedKey === `aadhaar-${id || index}` ? 'var(--success)' : 'var(--text-secondary)',
                  fontSize: 12
                }}
                title={copiedKey === `aadhaar-${id || index}` ? 'Copied Aadhaar' : 'Copy Aadhaar'}
              >
                <FontAwesomeIcon icon={copiedKey === `aadhaar-${id || index}` ? faCheck : faCopy} />
              </button>
            )}
          </div>
        </td>
        <td>{location}</td>
        <td>
          <Tag
            variant={
              aadhaarStatus === 'Valid' || aadhaarStatus === 'Verified'
                ? 'green'
                : aadhaarStatus === 'Invalid' || aadhaarStatus === 'Rejected'
                ? 'red'
                : aadhaarStatus === 'Pending'
                ? 'yellow'
                : 'gray'
            }
          >
            {aadhaarStatus}
          </Tag>
        </td>
        <td>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              window.open(getCandidateUrl(id), '_blank')
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FontAwesomeIcon icon={faEye} /> View
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              openAadhaarModal(candidate, index)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title="View Aadhaar images"
          >
            <FontAwesomeIcon icon={faImages} /> Aadhaar Images
          </button>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openAttendanceModal(candidate)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FontAwesomeIcon icon={faCalendarCheck} /> Show Attendance
          </button>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openPaymentsModal(candidate)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FontAwesomeIcon icon={faMoneyBillWave} /> Show Payments
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              const url = getAadhaarUploadUrl(candidate)
              handleCopyText(`upload-${id || index}`, url)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            title={copiedKey === `upload-${id || index}` ? 'Copied upload link' : 'Copy Aadhaar upload link'}
          >
            <FontAwesomeIcon icon={copiedKey === `upload-${id || index}` ? faCheck : faUpload} /> {copiedKey === `upload-${id || index}` ? 'Copied' : 'Copy Upload Link'}
          </button>
        </div>
        </td>
      </tr>
    )
  })

  return (
    <div className="candidate-database-page">
      <PageHeader
        title="Candidate Database"
        subtitle="Search, filter and manage your talent pool"
        action={
          <div className="flex gap-3 candidate-page-actions" style={{ gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setIsWhatsAppMessengerOpen(true)}
              disabled={selectedWhatsAppCandidateIds.size === 0}
            >
              <FontAwesomeIcon icon={faCommentDots} /> WhatsApp ({selectedWhatsAppCandidateIds.size})
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCheckRegisterModal(true)}
            >
              <FontAwesomeIcon icon={faCheckCircle} /> Check Register
            </button>
              <button
                className="btn btn-warning btn-sm"
                onClick={() => setShowNotifyNotRegisteredModal(true)}
              >
                <FontAwesomeIcon icon={faUpload} /> Notify Not-Registered
              </button>
          </div>
        }
      />

      <Card style={{ marginBottom: 18, padding: 16 }}>
        <form
          className="projects-table-filters"
          style={{ gap: 16, alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault()
            handleSearch()
          }}
        >
          <div className="projects-table-filter-group search-group" style={{ flex: '1 1 100%', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px' }}>
              <div className="filter-label">Name</div>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control search-input"
                  placeholder="Search by name"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 220px' }}>
              <div className="filter-label">Mobile</div>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control search-input"
                  placeholder="Search by mobile"
                  value={mobileSearch}
                  onChange={(e) => setMobileSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 220px' }}>
              <div className="filter-label">WhatsApp</div>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control search-input"
                  placeholder="Search by WhatsApp"
                  value={whatsappSearch}
                  onChange={(e) => setWhatsappSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 220px' }}>
              <div className="filter-label">Email</div>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control search-input"
                  placeholder="Search by email"
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 220px' }}>
              <div className="filter-label">Aadhaar</div>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  className="form-control search-input"
                  placeholder="Search by aadhaar"
                  value={aadhaarSearch}
                  onChange={(e) => setAadhaarSearch(String(e.target.value).replace(/\D/g, '').slice(0, 12))}
                />
              </div>
            </div>

            <button className="btn btn-primary btn-sm" type="submit">
              <FontAwesomeIcon icon={faSearch} /> Search
            </button>
          </div>

          <div className="projects-table-filter-group location-group">
            <div className="filter-label">Location</div>
            <select
              className="form-control"
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value)
                setPage(1)
              }}
            >
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">From</div>
            <input
              className="form-control"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setPage(1)
              }}
            />
            <div className="filter-label">To</div>
            <input
              className="form-control"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <div className="projects-table-meta" style={{ minWidth: 230, gap: 12 }}>
            <div className="entries-selector">
              <label>Show</label>
              <select
                className="form-control"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} entries
                  </option>
                ))}
              </select>
            </div>

            <div style={{ whiteSpace: 'nowrap' }}>
              <strong>{totalCandidates}</strong> profiles
            </div>

            {activeFilters.length > 0 && (
              <div className="filter-badge-list" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {activeFilters.map((filter, idx) => (
                  <span key={idx} className="filter-badge">
                    {filter}
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="projects-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all candidates with WhatsApp on this page"
                    checked={allWhatsAppCandidatesSelected}
                    onChange={(event) => setSelectedWhatsAppCandidateIds(event.target.checked ? new Set(whatsappCandidates.map(getCandidateWhatsAppId).filter(Boolean)) : new Set())}
                    disabled={whatsappCandidates.length === 0}
                  />
                </th>
                {['#', 'Date', 'Time', 'Name', 'Temp ID', 'Mobile', 'Whatsapp', 'Aadhaar', 'Location', 'Aadhaar Status', 'Actions'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 32 }}>
                    Loading candidates…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 32, color: 'var(--red)' }}>
                    {error}
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: 32 }}>
                    No candidates found for the selected filters.
                  </td>
                </tr>
              ) : (
                tableRows
              )}
            </tbody>
          </table>
        </div>

        <div className="candidate-mobile-list">
          {loading ? (
            <div className="candidate-mobile-state">Loading candidates...</div>
          ) : error ? (
            <div className="candidate-mobile-state candidate-mobile-state-error">{error}</div>
          ) : candidates.length === 0 ? (
            <div className="candidate-mobile-state">No candidates found for the selected filters.</div>
          ) : (
            candidates.map((candidate, index) => {
              const name = candidate.name || candidate.fullName || 'Unknown'
              const newId = candidate.new_id ?? candidate.newId ?? candidate.id ?? candidate.candidateId ?? '—'
              const id = candidate.id
              const displayId = newId === '—' ? '—' : `CYN${new Date().getFullYear()}TEMP${newId}`
              const email = candidate.email || '—'
              const mobile = candidate.mobile || candidate.phone || '—'
              const whatsapp = candidate.whatsapp || candidate.phone || candidate.mobile || '—'
              const aadhaarNumber = candidate.aadhaarNumber || '—'
              const aadhaarStatus = candidate.aadhaarVerificationStatus || candidate.kyc || 'Unknown'
              const location = candidate.location || candidate.city || '—'
              const joinDate = candidate.dateOfJoining || candidate.createdAt || candidate.joined || ''

              return (
                <article className="candidate-mobile-card" key={id || index}>
                  <div className="candidate-mobile-card-header">
                    <div>
                      <div className="project-name-cell">{name}</div>
                      <div className="project-subtext">{email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${name} for WhatsApp`}
                        checked={selectedWhatsAppCandidateIds.has(getCandidateWhatsAppId(candidate))}
                        disabled={!getCandidateWhatsAppId(candidate) || !getCandidateWhatsAppPhone(candidate)}
                        onChange={(event) => toggleWhatsAppCandidate(candidate, event.target.checked)}
                      />
                      <span className="candidate-mobile-index">#{offset + index + 1}</span>
                    </div>
                  </div>
                  <div className="candidate-mobile-details">
                    <div><span>Joined</span><strong>{formatDate(joinDate)}</strong></div>
                    <div><span>Mobile</span><strong>{mobile}</strong></div>
                    <div><span>WhatsApp</span><strong>{whatsapp}</strong></div>
                    <div><span>Location</span><strong>{location}</strong></div>
                    <div><span>Temp ID</span><strong>{displayId}</strong></div>
                    <div><span>Aadhaar</span><strong>{aadhaarNumber}</strong></div>
                  </div>
                  <div className="candidate-mobile-card-footer">
                    <Tag
                      variant={
                        aadhaarStatus === 'Valid' || aadhaarStatus === 'Verified'
                          ? 'green'
                          : aadhaarStatus === 'Invalid' || aadhaarStatus === 'Rejected'
                          ? 'red'
                          : aadhaarStatus === 'Pending'
                          ? 'yellow'
                          : 'gray'
                      }
                    >
                      {aadhaarStatus}
                    </Tag>
                    <div className="candidate-mobile-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => window.open(getCandidateUrl(id), '_blank')}
                      >
                        <FontAwesomeIcon icon={faEye} /> View
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => openAadhaarModal(candidate, index)}
                      >
                        <FontAwesomeIcon icon={faImages} /> Aadhaar
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={() => openAttendanceModal(candidate)}
                      >
                        <FontAwesomeIcon icon={faCalendarCheck} /> Show Attendance
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={() => openPaymentsModal(candidate)}
                      >
                        <FontAwesomeIcon icon={faMoneyBillWave} /> Show Payments
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopyText(`mobile-upload-${id || index}`, getAadhaarUploadUrl(candidate))}
                      >
                        <FontAwesomeIcon icon={copiedKey === `mobile-upload-${id || index}` ? faCheck : faUpload} /> {copiedKey === `mobile-upload-${id || index}` ? 'Copied' : 'Upload link'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="projects-table-pagination">
          <div className="pagination-summary">
            Showing <strong>{firstRow}</strong> - <strong>{lastRow}</strong> of <strong>{totalCandidates}</strong> | <strong>offset:</strong> {offset} | <strong>limit:</strong> {pageSize}
          </div>

          <div className="pagination-actions">
            <button className="btn btn-outline btn-sm" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <div className="pagination-pages">
              {pageStart > 1 && (
                <button className="pagination-page-btn" type="button" onClick={() => setPage(1)}>
                  1
                </button>
              )}
              {pageStart > 2 && <span className="pagination-ellipsis">…</span>}
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`pagination-page-btn${pageNumber === page ? ' active' : ''}`}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              {pageEnd < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
              {pageEnd < totalPages && (
                <button className="pagination-page-btn" type="button" onClick={() => setPage(totalPages)}>
                  {totalPages}
                </button>
              )}
            </div>
            <button className="btn btn-outline btn-sm" type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* Add Candidate Modal */}
      <AddCandidateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setPage(1)
          fetchCandidates()
        }}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={() => {
          setPage(1)
          fetchCandidates()
        }}
      />

      {/* Check Register Modal */}
      <CheckRegisterModal
        isOpen={showCheckRegisterModal}
        onClose={() => setShowCheckRegisterModal(false)}
      />

      <Modal
        isOpen={isAttendanceModalOpen}
        onClose={closeAttendanceModal}
        title={
          <div style={{ display: 'grid', gap: 6 }}>
            <div>Candidate Attendance</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {selectedAttendanceCandidate?.name || selectedAttendanceCandidate?.fullName || 'Unknown Candidate'}
              {selectedAttendanceCandidate ? ` • ${selectedAttendanceCandidate?.mobile || selectedAttendanceCandidate?.whatsapp || selectedAttendanceCandidate?.phone || 'No phone'}` : ''}
            </div>
          </div>
        }
        maxWidth="min(96vw, 1480px)"
      >
        {renderAttendanceTable()}
      </Modal>

      <Modal
        isOpen={isPaymentsModalOpen}
        onClose={closePaymentsModal}
        title={`Payments for ${selectedPaymentsCandidate?.name || selectedPaymentsCandidate?.fullName || 'Candidate'}`}
        maxWidth="1000px"
        footer={(
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%' }}>
            <span style={{ color: 'var(--text2)', fontSize: 13 }}>{paymentsTotal} payment{paymentsTotal === 1 ? '' : 's'}</span>
            <button type="button" className="btn btn-outline" onClick={closePaymentsModal}>Close</button>
          </div>
        )}
      >
        {paymentsError && <div className="candidate-attendance-filter-error" role="alert">{paymentsError}</div>}
        {paymentsLoading ? (
          <div className="candidate-attendance-state">Loading payments...</div>
        ) : candidatePayments.length === 0 ? (
          <div className="candidate-attendance-state">No payments found for this candidate.</div>
        ) : (
          <div className="projects-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Paid Date</th>
                  <th>Payment Type</th>
                  <th>Amount</th>
                  <th>Project</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {candidatePayments.map((payment, index) => (
                  <tr key={payment.id || payment.payment_id || payment.paymentId || index}>
                    <td>{formatDate(payment.payment_date || payment.paymentDate || payment.date || payment.created_at || payment.createdAt)}</td>
                    <td>{payment.payment_type || '—'}</td>
                    <td>{payment.amount ?? payment.payout_link_amount ?? payment.payoutLinkAmount ?? payment.amount_to_be_paid ?? payment.total_amount ?? '—'}</td>
                    <td>{payment.project_name || payment.projectName || payment.project || '—'}</td>
                    <td>{payment.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paymentsTotal > paymentsPageSize && (
          <div className="projects-table-pagination" style={{ marginTop: 16 }}>
            <div className="pagination-summary">
              Showing {(paymentsPage - 1) * paymentsPageSize + 1}–{Math.min(paymentsPage * paymentsPageSize, paymentsTotal)} of {paymentsTotal}
            </div>
            <div className="pagination-actions">
              <button className="btn btn-outline btn-sm" type="button" disabled={paymentsPage <= 1 || paymentsLoading} onClick={() => setPaymentsPage((page) => page - 1)}>Previous</button>
              <span>Page {paymentsPage} of {Math.max(1, Math.ceil(paymentsTotal / paymentsPageSize))}</span>
              <button className="btn btn-outline btn-sm" type="button" disabled={paymentsPage >= Math.ceil(paymentsTotal / paymentsPageSize) || paymentsLoading} onClick={() => setPaymentsPage((page) => page + 1)}>Next</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isReassignAttendanceModalOpen}
        onClose={closeReassignAttendanceModal}
        title="Reassign attendance"
        maxWidth="620px"
        zIndex={11200}
        closeOnBackdropClick={!reassignAttendanceSaving}
        footer={
          <div className="candidate-attendance-reassign-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeReassignAttendanceModal}
              disabled={reassignAttendanceSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitAttendanceReassignment}
              disabled={
                reassignAttendanceSaving
                || reassignAttendanceOptionsLoading
                || !reassignAttendanceProject
                || !reassignAttendanceAreaId
                || (isReassignAttendanceWrittenProject && !reassignAttendanceCentreId)
                || (hasRegularAttendanceSelection && isReassignAttendanceWrittenProject)
              }
            >
              {reassignAttendanceSaving ? 'Reassigning...' : `Reassign ${selectedAttendanceRecords.length} record${selectedAttendanceRecords.length === 1 ? '' : 's'}`}
            </button>
          </div>
        }
      >
        <div className="candidate-attendance-reassign-form">
          <div className="candidate-attendance-reassign-selection">
            Reassigning <strong>{selectedAttendanceRecords.length}</strong> selected attendance record{selectedAttendanceRecords.length === 1 ? '' : 's'} for{' '}
            <strong>{selectedAttendanceCandidate?.name || selectedAttendanceCandidate?.fullName || 'this candidate'}</strong>.
          </div>
          <label className="candidate-attendance-filter">
            <span>Destination project</span>
            <SearchableProjectSelect
              options={reassignableProjectOptions.map((project) => ({
                id: project.key,
                name: `${project.name} (${project.type === 'written' ? 'Written' : 'Regular'})`,
              }))}
              value={reassignAttendanceProjectKey}
              placeholder="Select project"
              disabled={attendanceSuggestionsLoading || attendanceProjectOptions.length === 0}
              onChange={(projectKey) => {
                setReassignAttendanceProjectKey(projectKey)
                setReassignAttendanceAreaId('')
                setReassignAttendanceCentreId('')
                setReassignAttendanceError('')
              }}
            />
          </label>
          <label className="candidate-attendance-filter">
            <span>{isReassignAttendanceWrittenProject ? 'Destination district' : 'Destination location'}</span>
            <SearchableProjectSelect
              options={isReassignAttendanceWrittenProject ? reassignAttendanceDistrictOptions : reassignAttendanceLocationOptions}
              value={reassignAttendanceAreaId}
              placeholder={reassignAttendanceProject
                ? `Select ${isReassignAttendanceWrittenProject ? 'district' : 'location'}`
                : 'Select a project first'}
              disabled={!reassignAttendanceProject || reassignAttendanceOptionsLoading}
              onChange={(areaId) => {
                setReassignAttendanceAreaId(areaId)
                setReassignAttendanceCentreId('')
                setReassignAttendanceError('')
              }}
            />
          </label>
          {isReassignAttendanceWrittenProject && (
            <label className="candidate-attendance-filter">
              <span>Destination centre</span>
              <SearchableProjectSelect
                options={reassignAttendanceCentreOptions}
                value={reassignAttendanceCentreId}
                placeholder={reassignAttendanceAreaId ? 'Select centre' : 'Select a district first'}
                disabled={!reassignAttendanceAreaId || reassignAttendanceOptionsLoading}
                onChange={(centreId) => {
                  setReassignAttendanceCentreId(centreId)
                  setReassignAttendanceError('')
                }}
              />
            </label>
          )}
          {reassignAttendanceOptionsLoading && <div className="candidate-attendance-reassign-note">Loading destination options...</div>}
          {selectedAttendanceProjectTypes.has('regular')
            && <div className="candidate-attendance-reassign-note">Selected regular-project attendance can only be moved to a regular project.</div>}
          {selectedAttendanceProjectTypes.has('written')
            && <div className="candidate-attendance-reassign-note">Selected written-project attendance can only be moved to a written project.</div>}
          {reassignAttendanceError && <div className="candidate-attendance-filter-error">{reassignAttendanceError}</div>}
        </div>
      </Modal>

      <ImageModal
        isOpen={attendanceImagePreview.isOpen}
        onClose={() => setAttendanceImagePreview({ isOpen: false, src: '', title: '', alt: '' })}
        imageUrl={attendanceImagePreview.src}
        title={attendanceImagePreview.title}
        alt={attendanceImagePreview.alt}
      />
      <MapModal
        isOpen={attendanceMapPreview.isOpen}
        onClose={() => setAttendanceMapPreview({ isOpen: false, markers: [], label: '' })}
        markers={attendanceMapPreview.markers}
        title={attendanceMapPreview.label}
      />

      <Modal
        isOpen={isAadhaarModalOpen}
        onClose={closeAadhaarModal}
        title={
          <div style={{ display: 'grid', gap: 6 }}>
            <div>Aadhaar Images</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {selectedAadhaarCandidate?.name || selectedAadhaarCandidate?.fullName || 'Unknown Candidate'}
              {selectedAadhaarCandidate ? ` • ${selectedAadhaarCandidate?.mobile || selectedAadhaarCandidate?.whatsapp || selectedAadhaarCandidate?.phone || 'No phone'}` : ''}
            </div>
          </div>
        }
        maxWidth="900px"
      >
        {aadhaarModalLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
            Loading Aadhaar images...
          </div>
        ) : aadhaarModalError ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)' }}>
            {aadhaarModalError}
          </div>
        ) : (
          <div className="candidate-aadhaar-images" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Aadhaar Front</div>
              {getAadhaarFrontUrl(selectedAadhaarCandidate) ? (
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 12,
                    border: '1px solid var(--border-light)',
                    minHeight: 220,
                    background: 'var(--bg)',
                    cursor: 'none'
                  }}
                  onMouseMove={(e) => handleAadhaarImageMouseMove('front', e)}
                  onMouseLeave={handleAadhaarImageMouseLeave}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: zoomLens.left,
                      top: zoomLens.top,
                      width: 220,
                      height: 220,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.95)',
                      backgroundImage: `url(${getAadhaarFrontUrl(selectedAadhaarCandidate)})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '380%',
                      backgroundPosition: `${zoomLens.x * 100}% ${zoomLens.y * 100}%`,
                      boxShadow: '0 18px 52px rgba(0,0,0,0.32)',
                      opacity: zoomLens.visible && zoomLens.imageKey === 'front' ? 1 : 0,
                      transition: 'opacity 0.06s ease-in-out',
                      pointerEvents: 'none',
                      zIndex: 20
                    }}
                  />
                  <img
                    src={getAadhaarFrontUrl(selectedAadhaarCandidate)}
                    alt="Aadhaar Front"
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      transition: 'transform 0.2s ease-in-out',
                      transform: 'scale(1.03)',
                      transformOrigin: 'center center'
                    }}
                  />
                </div>
              ) : (
                <div style={{ minHeight: 220, borderRadius: 12, border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                  No Aadhaar front image available
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Aadhaar Back</div>
              {getAadhaarBackUrl(selectedAadhaarCandidate) ? (
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 12,
                    border: '1px solid var(--border-light)',
                    minHeight: 220,
                    background: 'var(--bg)',
                    cursor: 'none'
                  }}
                  onMouseMove={(e) => handleAadhaarImageMouseMove('back', e)}
                  onMouseLeave={handleAadhaarImageMouseLeave}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: zoomLens.left,
                      top: zoomLens.top,
                      width: 220,
                      height: 220,
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.95)',
                      backgroundImage: `url(${getAadhaarBackUrl(selectedAadhaarCandidate)})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '380%',
                      backgroundPosition: `${zoomLens.x * 100}% ${zoomLens.y * 100}%`,
                      boxShadow: '0 18px 52px rgba(0,0,0,0.32)',
                      opacity: zoomLens.visible && zoomLens.imageKey === 'back' ? 1 : 0,
                      transition: 'opacity 0.06s ease-in-out',
                      pointerEvents: 'none',
                      zIndex: 20
                    }}
                  />
                  <img
                    src={getAadhaarBackUrl(selectedAadhaarCandidate)}
                    alt="Aadhaar Back"
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                      transition: 'transform 0.2s ease-in-out',
                      transform: 'scale(1.03)',
                      transformOrigin: 'center center'
                    }}
                  />
                </div>
              ) : (
                <div style={{ minHeight: 220, borderRadius: 12, border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                  No Aadhaar back image available
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={showPreviousAadhaarCandidate}
              disabled={selectedAadhaarIndex <= 0}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={showNextAadhaarCandidate}
              disabled={selectedAadhaarIndex >= candidates.length - 1}
            >
              Next
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeAadhaarModal}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleSendCandidateId(selectedAadhaarCandidate)}
              disabled={sendAadhaarIdLoading || !selectedAadhaarCandidate}
            >
              {sendAadhaarIdLoading ? 'Sending…' : 'Send Candidate ID'}
            </button>
          </div>
        </div>
      </Modal>
      {/* Notify Not-Registered Modal */}
      <NotifyNotRegisteredModal
        isOpen={showNotifyNotRegisteredModal}
        onClose={() => setShowNotifyNotRegisteredModal(false)}
      />
      <WhatsAppMessenger
        isOpen={isWhatsAppMessengerOpen}
        recipients={selectedWhatsAppCandidates.map((candidate) => ({
          id: getCandidateWhatsAppId(candidate),
          name: candidate.name || candidate.fullName || 'Candidate',
          phone: getCandidateWhatsAppPhone(candidate),
        }))}
        onClose={() => setIsWhatsAppMessengerOpen(false)}
        onSend={handleSendCandidateWhatsApp}
      />
    </div>
  )
}

export default CandidateDatabase
