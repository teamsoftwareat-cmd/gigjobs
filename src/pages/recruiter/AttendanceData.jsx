import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faMapMarkerAlt, faDownload, faFileExcel, faFilePdf, faFileArchive, faChevronDown, faChevronUp, faCalculator, faUsers, faTimesCircle, faTimes, faFileCsv, faShieldAlt } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { PageHeader, Card, DataTable, Tag, StatCard, Modal, EmailMessenger, WhatsAppMessenger } from '../../components/ui'
import { AttendanceBarChart, CentresAttendanceChart } from '../../components/ui/Charts'
import { MapModal } from '../../components/ui/MapModal'
import { ImageModal } from '../../components/ui/ImageModal'
import { useAlert } from '../../context/AlertContext'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useAuth } from '../../context/AuthContext'
import './AttendanceData.css'
import './AttendanceDataMobile.css'

const LIMIT_OPTIONS = [10, 25, 50, 100, 250, 500]
const NO_IMAGE_PLACEHOLDER = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
const REJECTION_TEMPLATES = [
  'Inappropriate photo',
  'Bad lighting',
  'Location mismatch',
  'Identity mismatch',
  'Clock-in/out mismatch',
  'Work incomplete'
]

const statusVariant = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'present') return 'green'
  if (normalized === 'late' || normalized === 'exception') return 'yellow'
  if (normalized === 'absent') return 'red'
  return 'gray'
}


export default function RecruiterAttendance() {
  const { user } = useAuth()
  const [attendance, setAttendance] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedDistrictId, setSelectedDistrictId] = useState('')
  const [selectedCentreId, setSelectedCentreId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [centreOptions, setCentreOptions] = useState([])
  const [limit, setLimit] = useState(10)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [projectTitle, setProjectTitle] = useState(location.state?.projectTitle || 'All projects')
  const [projectDates, setProjectDates] = useState({ 
    start: location.state?.startDate ? location.state.startDate.split('T')[0] : '', 
    end: location.state?.endDate ? location.state.endDate.split('T')[0] : '' 
  })

  
  const [kpis, setKpis] = useState({ totalLocations: 0 })
  const [chartData, setChartData] = useState({ totalRequired: 0, totalAvailable: 0, present: 0, absent: 0 })
  const [centreChartData, setCentreChartData] = useState([])
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [mapLocation, setMapLocation] = useState({ markers: [], label: '' })
  const [imagePreview, setImagePreview] = useState({ isOpen: false, src: '', alt: '', title: '' })
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  // Project Members modal + messenger states
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false)
  const [projectMembers, setProjectMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [recordToReject, setRecordToReject] = useState(null)
  const [rejectionComment, setRejectionComment] = useState('')
  const [isRejectedMembersModalOpen, setIsRejectedMembersModalOpen] = useState(false)
  const [isFraudModalOpen, setIsFraudModalOpen] = useState(false)
  const [fraudRecords, setFraudRecords] = useState([])
  const [fraudTotal, setFraudTotal] = useState(0)
  const [fraudSearch, setFraudSearch] = useState('')
  const [fraudFromDate, setFraudFromDate] = useState('')
  const [fraudToDate, setFraudToDate] = useState('')
  const [fraudLimit, setFraudLimit] = useState(10)
  const [fraudOffset, setFraudOffset] = useState(0)
  const [fraudLoading, setFraudLoading] = useState(false)
  const [acceptingFraudAttendanceId, setAcceptingFraudAttendanceId] = useState(null)
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false)
  const [compareRecord, setCompareRecord] = useState(null)
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [recordToAccept, setRecordToAccept] = useState(null)
  const [isRejectingFraudAttendance, setIsRejectingFraudAttendance] = useState(false)
  const [isAdvtNoModalOpen, setIsAdvtNoModalOpen] = useState(false)
  const [exportAdvtNo, setExportAdvtNo] = useState('')
  const [exportAdvtNoError, setExportAdvtNoError] = useState('')
  const [pendingPdfExportTarget, setPendingPdfExportTarget] = useState('main')
  const [isModifiedPdfModalOpen, setIsModifiedPdfModalOpen] = useState(false)
  const [modifiedPdfAdvtNo, setModifiedPdfAdvtNo] = useState('')
  const [modifiedPdfError, setModifiedPdfError] = useState('')
  const [modifiedPdfClockInFallback, setModifiedPdfClockInFallback] = useState('')
  const [modifiedPdfClockOutFallback, setModifiedPdfClockOutFallback] = useState('')
  const [modifiedPdfOptions, setModifiedPdfOptions] = useState({
    columns: { date: true, candidate: true, aadhaar: true, mobile: true, designation: true, area: true, centre: false, clockIn: true, clockOut: false, status: true, checkInImage: true },
    header: { dateMode: 'range', advtNo: true, centreCode: true },
  })
  const [isSearchAttendanceModalOpen, setIsSearchAttendanceModalOpen] = useState(false)
  const [searchAttendanceFile, setSearchAttendanceFile] = useState(null)
  const [searchAttendanceFileName, setSearchAttendanceFileName] = useState('')
  const [searchAttendanceDate, setSearchAttendanceDate] = useState('')
  const [searchAttendanceLoading, setSearchAttendanceLoading] = useState(false)
  const [searchAttendanceError, setSearchAttendanceError] = useState('')
  const [searchAttendanceResults, setSearchAttendanceResults] = useState([])
  const [searchAttendanceProjectName, setSearchAttendanceProjectName] = useState('')
  const [searchAttendanceTotal, setSearchAttendanceTotal] = useState(0)
  const [searchAttendanceSearch, setSearchAttendanceSearch] = useState('')
  const [searchAttendanceLocationId, setSearchAttendanceLocationId] = useState('')
  const [searchAttendanceDistrictId, setSearchAttendanceDistrictId] = useState('')
  const [searchAttendanceCentreId, setSearchAttendanceCentreId] = useState('')
  const [searchAttendanceFromDate, setSearchAttendanceFromDate] = useState('')
  const [searchAttendanceToDate, setSearchAttendanceToDate] = useState('')
  const [searchAttendanceLimit, setSearchAttendanceLimit] = useState(10)
  const [searchAttendanceOffset, setSearchAttendanceOffset] = useState(0)
  const [isSearchAttendanceResultsModalOpen, setIsSearchAttendanceResultsModalOpen] = useState(false)
  const [rejectedMembers, setRejectedMembers] = useState([])
  const [rejectedMembersLoading, setRejectedMembersLoading] = useState(false)
  const [acceptingAttendanceId, setAcceptingAttendanceId] = useState(null)
  const [rejectedMembersSearch, setRejectedMembersSearch] = useState('')
  const [debouncedRejectedMembersSearch, setDebouncedRejectedMembersSearch] = useState('')
  const [rejectedMembersLocationId, setRejectedMembersLocationId] = useState('')
  const [rejectedMembersDistrictId, setRejectedMembersDistrictId] = useState('')
  const [rejectedMembersCentreId, setRejectedMembersCentreId] = useState('')
  const [rejectedMembersLimit, setRejectedMembersLimit] = useState(LIMIT_OPTIONS[0])
  const [rejectedMembersOffset, setRejectedMembersOffset] = useState(0)
  const [rejectedMembersTotal, setRejectedMembersTotal] = useState(0)
  const [rejectedMembersLocationOptions, setRejectedMembersLocationOptions] = useState([])
  const [rejectedMembersDistrictOptions, setRejectedMembersDistrictOptions] = useState([])
  const [rejectedMembersCentreOptions, setRejectedMembersCentreOptions] = useState([])
  const [selectedMembers, setSelectedMembers] = useState(new Set())
  const [membersSelectAll, setMembersSelectAll] = useState(false)
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false)
  const [isEmailOpen, setIsEmailOpen] = useState(false)
  // Members list pagination & filters
  const [membersOffset, setMembersOffset] = useState(0)
  const [membersLimit, setMembersLimit] = useState(10)
  const [membersTotal, setMembersTotal] = useState(0)
  const [membersSearch, setMembersSearch] = useState('')
  const [debouncedMembersSearch, setDebouncedMembersSearch] = useState('')
  const [membersDistrict, setMembersDistrict] = useState('')
  const [membersCentre, setMembersCentre] = useState('')
  // Members pagination calculations (for modal)
  const membersTotalPages = Math.max(1, Math.ceil(membersTotal / membersLimit))
  const membersCurrentPage = Math.floor(membersOffset / membersLimit) + 1
  const membersPageStart = Math.max(1, Math.min(membersCurrentPage - 2, Math.max(1, membersTotalPages - 4)))
  const membersPageEnd = Math.min(membersTotalPages, membersPageStart + 4)
  const membersPageNumbers = []
  for (let i = membersPageStart; i <= membersPageEnd; i += 1) membersPageNumbers.push(i)

      // Rejected Members pagination calculations
  const rejectedMembersTotalPages = Math.max(1, Math.ceil(rejectedMembersTotal / rejectedMembersLimit))
  const rejectedMembersCurrentPage = Math.floor(rejectedMembersOffset / rejectedMembersLimit) + 1
  const rejectedMembersPageStart = Math.max(1, Math.min(rejectedMembersCurrentPage - 2, Math.max(1, rejectedMembersTotalPages - 4)))
  const rejectedMembersPageEnd = Math.min(rejectedMembersTotalPages, rejectedMembersPageStart + 4)
  const rejectedMembersPageNumbers = []
  for (let i = rejectedMembersPageStart; i <= rejectedMembersPageEnd; i += 1) rejectedMembersPageNumbers.push(i)

  const projectType = searchParams.get('projectType') || searchParams.get('project_type') || location.state?.projectType || ''
  const isWrittenExam = useMemo(() => Boolean(
    projectType === 'writtenExam' || projectType === 'written_exam' ||
    searchParams.get('centreId') || searchParams.get('centre') || selectedCentreId || centreOptions.length > 0 ||
    attendance.some(record => record.centre || record.centre_name || record.centreName || record.center || record.center_name || record.centerName)
  ), [projectType, searchParams, selectedCentreId, centreOptions.length, attendance])
  const { alert } = useAlert()

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const response = await (isWrittenExam
        ? recruiterAPI.getWrittenExamAttendanceRecords({
            offset,
            limit,
            search: search || undefined,
            projectId: selectedProject || undefined,
            districtId: selectedDistrictId || undefined,
            centreId: selectedCentreId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
          })
        : recruiterAPI.getAttendanceRecords({
            offset,
            limit,
            search: search || undefined,
            projectId: selectedProject || undefined,
            locationId: selectedLocationId || undefined,
            centreId: selectedCentreId || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
          })
      )

      let payload = response?.data ?? {}
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          payload = {}
        }
      }

      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.records)
          ? payload.records
          : []

      const count = payload?.total ?? payload?.count ?? payload?.total_count ?? payload?.meta?.total ?? payload?.meta?.count ?? 0
      const projectNameFromResponse = payload?.project_name || payload?.project || payload?.projectName || selectedProject || 'All projects'
      const startDateFromResponse = payload?.startDate || payload?.start_date || ''
      const endDateFromResponse = payload?.endDate || payload?.end_date || ''
      const projectLocations = Number(
        payload?.total_locations ??
        payload?.totalLocations ??
        payload?.totalLocationCount ??
        payload?.locations_count ??
        0
      )

      let presentCount = 0
      let absentCount = 0
      let lateCount = 0
      rows.forEach(record => {
        const status = String(record.status || '').toLowerCase()
        if (status === 'present') presentCount++
        else if (status === 'absent') absentCount++
        else if (status === 'late') lateCount++
      })

      const totalRequired = Number((payload?.total_required ?? payload?.totalRequired ?? payload?.required ?? rows.length) || 0)
      const totalAvailable = Number((payload?.total_available ?? payload?.totalAvailable ?? payload?.available ?? presentCount + lateCount) || 0)
      const present = Number((payload?.present ?? payload?.present_count ?? payload?.presentCount ?? presentCount) || 0)
      const absent = Number((payload?.absent ?? payload?.absent_count ?? payload?.absentCount ?? absentCount) || 0)

      setAttendance(Array.isArray(rows) ? rows : [])
      setTotal(typeof count === 'number' ? count : Number(count) || 0)
      if (startDateFromResponse) {
        setProjectDates({ 
          start: startDateFromResponse.split('T')[0], 
          end: endDateFromResponse.split('T')[0] 
        })
      }
      // Only override if the current title is a placeholder or generic
      if (projectTitle === 'All projects' || projectTitle === '...') {
        setProjectTitle(projectNameFromResponse)
      }
      setKpis({ totalLocations: projectLocations })
      setChartData({ totalRequired, totalAvailable, present, absent })
      setCentreChartData(isWrittenExam ? (payload?.centre_stats || payload?.centreStats || []) : [])
      
      // Clear selections when data changes
      setSelectedRows(new Set())
      setSelectAll(false)
    } catch (error) {
      console.warn('Unable to load attendance records:', error)
      setAttendance([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [offset, limit, search, selectedProject, selectedLocationId, selectedDistrictId, selectedCentreId, fromDate, toDate, isWrittenExam])

  const handleConfirmReject = async () => {
    if (!recordToReject || !rejectionComment.trim()) return
    setIsRejectingFraudAttendance(true)
    try {
      const attendanceId = recordToReject.attendance_id || recordToReject.id
      const candidateName = recordToReject.candidate_name || recordToReject.worker_name || recordToReject.worker || ''
      const aadhar = recordToReject.aadhar || recordToReject.aadhaar || ''
      const mobile = recordToReject.mobile || recordToReject.phone || recordToReject.contact || ''
      const centreId = recordToReject.centre_id || recordToReject.centreId || recordToReject.center_id || recordToReject.centerId || ''
      const centre = recordToReject.centre_name || recordToReject.centre || recordToReject.centreName || recordToReject.center || recordToReject.center_name || recordToReject.centerName || ''
      const district = recordToReject.district_name || recordToReject.district || recordToReject.districtName || ''
      const locationId = recordToReject.location_id || recordToReject.locationId || recordToReject.location || recordToReject.location_name || recordToReject.locationName || selectedLocationId || ''
      const projectName = recordToReject.project_name || recordToReject.project || recordToReject.projectName || recordToReject.project_title || recordToReject.projectTitle || projectTitle || ''
      const projectId = recordToReject.project_id || recordToReject.projectId || recordToReject.project_od || selectedProject || ''

      const payload = {
        reason: rejectionComment,
        user_id: user?.userId,
        attendance_id: attendanceId,
        date: recordToReject.date || '',
        candidate_name: candidateName,
        aadhar,
        mobile,
        project_name: projectName,
        projectId,
        projectType: isWrittenExam ? 'writtenExam' : 'regular'
      }

      if (isWrittenExam) {
        payload.centreId = centreId
        payload.centre = centre
        payload.district = district
      } else {
        payload.locationId = locationId
      }

      await recruiterAPI.rejectAttendance(attendanceId, payload)

      setIsRejectModalOpen(false)
      setRecordToReject(null)
      setRejectionComment('')
      fetchAttendance()
      if (isFraudModalOpen) fetchFraudAttendanceRecords()
    } catch (err) {
      console.error('Failed to reject fraud attendance:', err)
      alert('Error', 'Failed to reject attendance. Please try again.')
    } finally {
      setIsRejectingFraudAttendance(false)
    }
  }

  const fetchRejectedMembers = useCallback(async () => {
    if (!selectedProject) return
    setRejectedMembersLoading(true)
    try {
      const params = {
        projectId: selectedProject,
        limit: rejectedMembersLimit,
        offset: rejectedMembersOffset,
        search: debouncedRejectedMembersSearch || undefined,
        attendance_factor: 'rejected',
      }

      if (isWrittenExam) {
        if (rejectedMembersDistrictId) params.districtId = rejectedMembersDistrictId
        if (rejectedMembersCentreId) params.centreId = rejectedMembersCentreId
      } else {
        if (rejectedMembersLocationId) params.locationId = rejectedMembersLocationId
      }

      const response = await (isWrittenExam
        ? recruiterAPI.getWrittenExamAttendanceRecords(params)
        : recruiterAPI.getAttendanceRecords(params)
      )
      const payload = response?.data ?? {}
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.records) ? payload.records : []
      setRejectedMembers(list)
      setRejectedMembersTotal(payload?.total ?? payload?.count ?? payload?.meta?.total ?? list.length)
    } catch (err) {
      console.warn('Failed to load rejected members', err)
      setRejectedMembers([])
      setRejectedMembersTotal(0)
    } finally {
      setRejectedMembersLoading(false)
    }
  }, [selectedProject, rejectedMembersLimit, rejectedMembersOffset, debouncedRejectedMembersSearch, rejectedMembersLocationId, rejectedMembersDistrictId, rejectedMembersCentreId, isWrittenExam])

  const handleAcceptRejectedAttendance = async (record) => {
    const attendanceId = record?.attendance_id || record?.id
    if (!attendanceId) return

    const candidateName = record?.candidate_name || record?.worker_name || record?.worker || ''
    const aadhar = record?.aadhar || record?.aadhaar || ''
    const mobile = record?.mobile || record?.phone || record?.contact || ''
    const centreId = record?.centre_id || record?.centreId || record?.center_id || record?.centerId || ''
    const centre = record?.centre_name || record?.centre || record?.centreName || record?.center || record?.center_name || record?.centerName || ''
    const district = record?.district_name || record?.district || record?.districtName || ''
    const locationId = record?.location_id || record?.locationId || record?.location || record?.location_name || record?.locationName || selectedLocationId || ''
    const projectName = record?.project_name || record?.project || record?.projectName || record?.project_title || record?.projectTitle || projectTitle || ''
    const projectId = record?.project_id || record?.projectId || record?.project_od || selectedProject || ''

    const payload = {
      user_id: user?.userId,
      attendance_id: attendanceId,
      date: record?.date || '',
      candidate_name: candidateName,
      aadhar,
      mobile,
      project_name: projectName,
      projectId,
      projectType: isWrittenExam ? 'writtenExam' : 'regular',
    }

    if (isWrittenExam) {
      payload.centreId = centreId
      payload.centre = centre
      payload.district = district
    } else {
      payload.locationId = locationId
    }

    setAcceptingAttendanceId(attendanceId)
    try {
      await recruiterAPI.acceptAttendance(attendanceId, payload)
      fetchRejectedMembers()
      fetchAttendance()
    } catch (err) {
      console.error('Failed to accept rejected attendance:', err)
      alert('Error', 'Failed to accept rejected attendance. Please try again.')
    } finally {
      setAcceptingAttendanceId(null)
    }
  }

  const fetchFraudAttendanceRecords = useCallback(async () => {
    setFraudLoading(true)
    try {
      const normalizedDistrictId = districtOptions.find((option) => String(option.id) === String(selectedDistrictId) || String(option.name) === String(selectedDistrictId))?.id || selectedDistrictId
      const normalizedLocationId = locationOptions.find((option) => String(option.id) === String(selectedLocationId) || String(option.name) === String(selectedLocationId))?.id || selectedLocationId

      const params = {
        projectId: selectedProject || undefined,
        limit: fraudLimit,
        offset: fraudOffset,
        search: fraudSearch || undefined,
        from: fraudFromDate || undefined,
        to: fraudToDate || undefined,
      }
      if (isWrittenExam) {
        if (normalizedDistrictId) params.districtId = normalizedDistrictId
        if (selectedCentreId) params.centreId = selectedCentreId
      } else {
        if (normalizedLocationId) params.locationId = normalizedLocationId
        if (selectedCentreId) params.centreId = selectedCentreId
      }

      const response = await recruiterAPI.getFraudAttendanceRecords(params)
      const payload = response?.data ?? {}
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.records) ? payload.records : []
      setFraudRecords(list)
      setFraudTotal(payload?.total ?? payload?.count ?? payload?.meta?.total ?? list.length)
    } catch (err) {
      console.warn('Failed to load fraud attendance records', err)
      setFraudRecords([])
      setFraudTotal(0)
    } finally {
      setFraudLoading(false)
    }
  }, [selectedProject, fraudLimit, fraudOffset, fraudSearch, fraudFromDate, fraudToDate, selectedLocationId, selectedDistrictId, selectedCentreId, isWrittenExam])

  const handleAcceptFraudAttendance = async (record) => {
    const attendanceId = record?.attendance_id || record?.id
    if (!attendanceId) return

    const candidateName = record?.candidate_name || record?.worker_name || record?.worker || ''
    const aadhar = record?.aadhar || record?.aadhaar || ''
    const mobile = record?.mobile || record?.phone || record?.contact || ''
    const centreId = record?.centre_id || record?.centreId || record?.center_id || record?.centerId || ''
    const centre = record?.centre_name || record?.centre || record?.centreName || record?.center || record?.center_name || record?.centerName || ''
    const district = record?.district_name || record?.district || record?.districtName || ''
    const locationId = record?.location_id || record?.locationId || record?.location || record?.location_name || record?.locationName || selectedLocationId || ''
    const projectName = record?.project_name || record?.project || record?.projectName || record?.project_title || record?.projectTitle || projectTitle || ''
    const projectId = record?.project_id || record?.projectId || record?.project_od || selectedProject || ''

    const payload = {
      user_id: user?.userId,
      attendance_id: attendanceId,
      date: record?.date || '',
      candidate_name: candidateName,
      aadhar,
      mobile,
      project_name: projectName,
      projectId,
      projectType: isWrittenExam ? 'writtenExam' : 'regular',
      fraud: true,
    }

    if (isWrittenExam) {
      payload.centreId = centreId
      payload.centre = centre
      payload.district = district
    } else {
      payload.locationId = locationId
    }

    setAcceptingFraudAttendanceId(attendanceId)
    try {
      await recruiterAPI.acceptFraudAttendance(attendanceId, payload)
      fetchFraudAttendanceRecords()
      fetchAttendance()
    } catch (err) {
      console.error('Failed to accept fraud attendance:', err)
      alert('Error', 'Failed to accept fraud attendance. Please try again.')
    } finally {
      setAcceptingFraudAttendanceId(null)
    }
  }

  const handleConfirmAccept = async () => {
    if (!recordToAccept) return
    setIsAcceptModalOpen(false)
    const acceptRecord = recordToAccept
    setRecordToAccept(null)
    await handleAcceptFraudAttendance(acceptRecord)
  }

  useEffect(() => {
    if (isRejectedMembersModalOpen) fetchRejectedMembers()
  }, [isRejectedMembersModalOpen, fetchRejectedMembers])

  useEffect(() => {
    if (isFraudModalOpen) fetchFraudAttendanceRecords()
  }, [isFraudModalOpen, fetchFraudAttendanceRecords])

  useEffect(() => {
    const debounce = setTimeout(fetchAttendance, 300)
    return () => clearTimeout(debounce)
  }, [fetchAttendance])

  useEffect(() => {
    const lockedProject = searchParams.get('project') || ''
    const lockedId = searchParams.get('id') || ''
    const lockedLocationId = searchParams.get('locationId') || searchParams.get('location') || ''
    const lockedDistrictId = searchParams.get('districtId') || searchParams.get('district') || ''
    const lockedCentreId = searchParams.get('centreId') || searchParams.get('centre') || ''
    setSelectedProject(lockedProject || lockedId)
    if (isWrittenExam) {
      setSelectedDistrictId(lockedDistrictId || lockedLocationId)
      setSelectedLocationId('')
    } else {
      setSelectedLocationId(lockedLocationId)
      setSelectedDistrictId('')
    }
    setSelectedCentreId(lockedCentreId)
  }, [searchParams, isWrittenExam])

  const locationsFetchingRef = useRef(false)

  const fetchLocationOptions = useCallback(async () => {
    if (!selectedProject) {
      if (isWrittenExam) {
        setDistrictOptions([])
      } else {
        setLocationOptions([])
      }
      return
    }

    if (locationsFetchingRef.current) return
    locationsFetchingRef.current = true
    try {
      const response = isWrittenExam 
        ? await recruiterAPI.getProjectDistricts(selectedProject)
        : await recruiterAPI.getProjectLocations(selectedProject)
      const payload = response?.data ?? {}
      const rawList = isWrittenExam
        ? Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.districts)
            ? payload.districts
            : Array.isArray(payload?.district_options)
              ? payload.district_options
              : Array.isArray(payload?.districtOptions)
                ? payload.districtOptions
                : []
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.locations)
            ? payload.locations
            : Array.isArray(payload?.location_options)
              ? payload.location_options
              : Array.isArray(payload?.locationOptions)
                ? payload.locationOptions
                : []

      const list = Array.isArray(rawList)
        ? rawList.map((item) => {
            if (item && typeof item === 'object') {
              const id = String(item.id ?? item.districtId ?? item.locationId ?? item.value ?? item.key ?? item._id ?? '')
              const name = String(item.name ?? item.district ?? item.location ?? item.label ?? item.value ?? item.name ?? id)
              return id ? { id, name } : null
            }
            const value = String(item || '')
            return value ? { id: value, name: value } : null
          }).filter(Boolean)
        : []

      if (isWrittenExam) {
        setDistrictOptions(list)
      } else {
        setLocationOptions(list)
      }
    } catch {
      if (isWrittenExam) {
        setDistrictOptions([])
      } else {
        setLocationOptions([])
      }
    } finally {
      locationsFetchingRef.current = false
    }
  }, [selectedProject, isWrittenExam])

  const centresFetchingRef = useRef(false)

  const fetchCentreOptions = useCallback(async (projectArg = selectedProject, areaId = isWrittenExam ? selectedDistrictId : selectedLocationId) => {
    if (!projectArg || !areaId) {
      setCentreOptions([])
      return
    }

    if (centresFetchingRef.current) return
    centresFetchingRef.current = true
    try {
      const response = isWrittenExam
        ? await recruiterAPI.getDistrictCentres(projectArg, areaId)
        : await recruiterAPI.getLocationCentres(projectArg, areaId)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.centres)
          ? payload.centres
          : Array.isArray(payload?.centre_options)
            ? payload.centre_options
            : Array.isArray(payload?.centreOptions)
              ? payload.centreOptions
              : []

      const list = Array.isArray(rawList)
        ? rawList.map((item) => {
            if (item && typeof item === 'object') {
              const id = String(item.id ?? item.centreId ?? item.centre_id ?? item.centre ?? item.value ?? item.key ?? item._id ?? '')
              const name = String(item.name ?? item.centre ?? item.label ?? item.value ?? item.id ?? item.center ?? id)
              const centreCode = String(item.centre_code ?? item.centreCode ?? item.code ?? item.centerId ?? item.center_id ?? item.centreId ?? item.id ?? '')
              return id ? { id, name, centre_id: centreCode, centreId: centreCode, centre_code: centreCode, centreCode, code: centreCode } : null
            }
            const value = String(item || '')
            return value ? { id: value, name: value } : null
          }).filter(Boolean)
        : []

      setCentreOptions(list)
    } catch {
      setCentreOptions([])
    } finally {
      centresFetchingRef.current = false
    }
  }, [selectedProject, selectedLocationId, selectedDistrictId, isWrittenExam])

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
    if (!isFraudModalOpen || !selectedProject) return

    fetchLocationOptions()

    if (isWrittenExam && selectedDistrictId) {
      fetchCentreOptions(selectedProject, selectedDistrictId)
    } else if (!isWrittenExam && selectedLocationId) {
      fetchCentreOptions(selectedProject, selectedLocationId)
    } else {
      setCentreOptions([])
    }
  }, [isFraudModalOpen, selectedProject, isWrittenExam, selectedDistrictId, selectedLocationId, fetchLocationOptions, fetchCentreOptions])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.custom-dropdown')) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  const clearAllFilters = () => {
    setSearch('')
    setSelectedLocationId('')
    setSelectedDistrictId('')
    setSelectedCentreId('')
    setFromDate('')
    setToDate('')
    setOffset(0)
    setSelectedRows(new Set())
    setSelectAll(false)
  }

  // Compute centre-based attendance stats for written exams
  // const computeCentreChartData = useMemo(() => {
  //   if (!isWrittenExam || !selectedDistrictId || attendance.length === 0) {
  //     return []
  //   }

  //   const centreMap = {}
  //   attendance.forEach(record => {
  //     const centre = record.centre_name || record.centre || 'Unknown'
  //     if (!centreMap[centre]) {
  //       centreMap[centre] = { centre, present: 0, absent: 0, late: 0, total_required: 0, total_available: 0, supervisors: 0, videographers: 0, operators: 0 }
  //     }

  //     const status = String(record.status || '').toLowerCase()
  //     if (status === 'present') centreMap[centre].present++
  //     else if (status === 'absent') centreMap[centre].absent++
  //     else if (status === 'late') centreMap[centre].late++

  //     // Count roles
  //     const designation = String(record.designation || record.role || '').toLowerCase()
  //     if (designation.includes('supervisor')) centreMap[centre].supervisors++
  //     else if (designation.includes('videographer')) centreMap[centre].videographers++
  //     else if (designation.includes('operator')) centreMap[centre].operators++
  //   })

  //   // Calculate totals per centre
  //   Object.values(centreMap).forEach(centreData => {
  //     centreData.total_required = centreData.present + centreData.absent
  //     centreData.total_available = centreData.present + centreData.absent + centreData.late
  //   })

  //   return Object.values(centreMap)
  // }, [isWrittenExam, selectedDistrictId, attendance])

  // useEffect(() => {
  //   setCentreChartData(computeCentreChartData)
  // }, [computeCentreChartData])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1
  const searchAttendanceTotalPages = Math.max(1, Math.ceil(searchAttendanceTotal / searchAttendanceLimit))
  const searchAttendanceCurrentPage = Math.floor(searchAttendanceOffset / searchAttendanceLimit) + 1
  const searchAttendancePageStart = Math.max(1, Math.min(searchAttendanceCurrentPage - 2, Math.max(1, searchAttendanceTotalPages - 4)))
  const searchAttendancePageEnd = Math.min(searchAttendanceTotalPages, searchAttendancePageStart + 4)
  const searchAttendancePageNumbers = []
  for (let i = searchAttendancePageStart; i <= searchAttendancePageEnd; i += 1) searchAttendancePageNumbers.push(i)

  const fraudTotalPages = Math.max(1, Math.ceil(fraudTotal / fraudLimit))
  const fraudCurrentPage = Math.floor(fraudOffset / fraudLimit) + 1
  const fraudPageStart = Math.max(1, Math.min(fraudCurrentPage - 2, Math.max(1, fraudTotalPages - 4)))
  const fraudPageEnd = Math.min(fraudTotalPages, fraudPageStart + 4)
  const fraudPageNumbers = []
  for (let i = fraudPageStart; i <= fraudPageEnd; i += 1) fraudPageNumbers.push(i)

  const openMapModal = (markers, label) => {
    setMapLocation({ markers, label })
    setIsMapOpen(true)
  }

  const closeMapModal = () => {
    setIsMapOpen(false)
    setMapLocation({ markers: [], label: '' })
  }

  const openImageModal = (src, title, alt) => {
    setImagePreview({ isOpen: true, src, title, alt })
  }

  const closeImageModal = () => {
    setImagePreview({ isOpen: false, src: '', alt: '', title: '' })
  }

  const handleSelectAll = (checked) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedRows(new Set(attendance.map(record => record.attendance_id || record.id)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleRowSelect = (recordId, checked) => {
    const newSelected = new Set(selectedRows)
    if (checked) {
      newSelected.add(recordId)
    } else {
      newSelected.delete(recordId)
    }
    setSelectedRows(newSelected)
    setSelectAll(newSelected.size === attendance.length)
  }

  // Project members helpers
  const getMemberId = (m) => String(m.id ?? m.candidateId ?? m.registration_id ?? m._id ?? m.attendance_id ?? '')

  const fetchProjectMembers = useCallback(async () => {
    if (!selectedProject) {
      setProjectMembers([])
      return
    }
    setMembersLoading(true)
    try {
      const params = {
        project: selectedProject,
        offset: membersOffset,
        limit: membersLimit,
        search: debouncedMembersSearch || undefined,
      }

      // For written-exam projects use district/centre filters; for regular projects use location
      if (isWrittenExam) {
        if (membersDistrict) params.district = membersDistrict
        if (membersCentre) params.centre = membersCentre
      } else {
        if (membersDistrict) params.location = membersDistrict
      }
      const response = await recruiterAPI.getProjectCandidates(params)
      const payload = response?.data ?? {}
      const data = payload?.data || payload || {}
      const list = data.items || data.candidates || data.results || data.data || []
      const total = data.total ?? data.count ?? data.totalCount ?? data.meta?.total ?? (Array.isArray(list) ? list.length : 0)
      setProjectMembers(Array.isArray(list) ? list : [])
      setMembersTotal(typeof total === 'number' ? total : Number(total) || 0)
      // Clear selection on new fetch
      setSelectedMembers(new Set())
      setMembersSelectAll(false)
    } catch (err) {
      console.warn('Failed to load project members', err)
      setProjectMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [selectedProject, membersOffset, membersLimit, debouncedMembersSearch, membersDistrict, membersCentre])

  const rejectedMembersCentresFetchingRef = useRef(false)

  const fetchRejectedMembersCentreOptions = useCallback(async (projectArg = selectedProject, areaId = isWrittenExam ? rejectedMembersDistrictId : rejectedMembersLocationId) => {
    if (rejectedMembersCentresFetchingRef.current) return
    rejectedMembersCentresFetchingRef.current = true
    try {
      const response = isWrittenExam
        ? await recruiterAPI.getDistrictCentres(projectArg, areaId)
        : await recruiterAPI.getLocationCentres(projectArg, areaId)
      const payload = response?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.centres)
          ? payload.centres
          : Array.isArray(payload?.centre_options)
            ? payload.centre_options
            : Array.isArray(payload?.centreOptions)
              ? payload.centreOptions
              : []

      const list = Array.isArray(rawList)
        ? rawList.map((item) => {
            if (item && typeof item === 'object') {
              const id = String(item.id ?? item.centreId ?? item.value ?? item.key ?? item._id ?? '')
              const name = String(item.name ?? item.centre ?? item.label ?? item.value ?? item.name ?? id)
              return id ? { id, name } : null
            }
            const value = String(item || '')
            return value ? { id: value, name: value } : null
          }).filter(Boolean)
        : []

      setRejectedMembersCentreOptions(list)
    } catch {
      setRejectedMembersCentreOptions([])
    } finally {
      rejectedMembersCentresFetchingRef.current = false
    }
  }, [selectedProject, rejectedMembersLocationId, rejectedMembersDistrictId, isWrittenExam])

  const rejectedMembersLocationsFetchingRef = useRef(false)

  const fetchRejectedMembersLocationOptions = useCallback(async () => {
    if (rejectedMembersLocationsFetchingRef.current) return
    rejectedMembersLocationsFetchingRef.current = true
    try {
      const response = isWrittenExam
        ? await recruiterAPI.getProjectDistricts(selectedProject)
        : await recruiterAPI.getProjectLocations(selectedProject)
      const payload = response?.data ?? {}
      const rawList = isWrittenExam
        ? Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.districts)
            ? payload.districts
            : Array.isArray(payload?.district_options)
              ? payload.district_options
              : Array.isArray(payload?.districtOptions)
                ? payload.districtOptions
                : []
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.locations)
            ? payload.locations
            : Array.isArray(payload?.location_options)
              ? payload.location_options
              : Array.isArray(payload?.locationOptions)
                ? payload.locationOptions
                : []

      const list = Array.isArray(rawList)
        ? rawList.map((item) => {
            if (item && typeof item === 'object') {
              const id = String(item.id ?? item.districtId ?? item.locationId ?? item.value ?? item.key ?? item._id ?? '')
              const name = String(item.name ?? item.district ?? item.location ?? item.label ?? item.value ?? item.name ?? id)
              return id ? { id, name } : null
            }
            const value = String(item || '')
            return value ? { id: value, name: value } : null
          }).filter(Boolean)
        : []

      if (isWrittenExam) {
        setRejectedMembersDistrictOptions(list)
      } else {
        setRejectedMembersLocationOptions(list)
      }
    } catch {
      if (isWrittenExam) {
        setRejectedMembersDistrictOptions([])
      } else {
        setRejectedMembersLocationOptions([])
      }
    } finally {
      rejectedMembersLocationsFetchingRef.current = false
    }
  }, [selectedProject, isWrittenExam])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRejectedMembersSearch(rejectedMembersSearch)
      setRejectedMembersOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [rejectedMembersSearch])

  useEffect(() => {
    if (isRejectedMembersModalOpen && (isWrittenExam ? rejectedMembersDistrictId : rejectedMembersLocationId)) {
      fetchRejectedMembersCentreOptions()
    }
  }, [isRejectedMembersModalOpen, rejectedMembersDistrictId, rejectedMembersLocationId, isWrittenExam, fetchRejectedMembersCentreOptions])

  // Debounce members search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMembersSearch(membersSearch), 300)
    return () => clearTimeout(t)
  }, [membersSearch])

  // Debounce rejected members search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedRejectedMembersSearch(rejectedMembersSearch)
      setRejectedMembersOffset(0)
    }, 300)
    return () => clearTimeout(t)
  }, [rejectedMembersSearch])

  // Refetch when modal open or filters/pagination change
  useEffect(() => {
    if (isMembersModalOpen) fetchProjectMembers()
  }, [isMembersModalOpen, fetchProjectMembers])

  useEffect(() => {
    if (isRejectedMembersModalOpen && selectedProject) {
      fetchRejectedMembersLocationOptions()
    }
  }, [isRejectedMembersModalOpen, selectedProject, fetchRejectedMembersLocationOptions])

  useEffect(() => {
    if (isRejectedMembersModalOpen && (isWrittenExam ? rejectedMembersDistrictId : rejectedMembersLocationId)) {
      fetchRejectedMembersCentreOptions()
    }
  }, [isRejectedMembersModalOpen, rejectedMembersDistrictId, rejectedMembersLocationId, isWrittenExam, fetchRejectedMembersCentreOptions])

  const openMembersModal = async () => {
    if (!selectedProject) {
      alert('Please select a project first.')
      return
    }
    setIsMembersModalOpen(true)
    await fetchProjectMembers()
  }

  const handleMembersSelectAll = (checked) => {
    setMembersSelectAll(checked)
    if (checked) {
      setSelectedMembers(new Set(projectMembers.map(m => getMemberId(m))))
    } else {
      setSelectedMembers(new Set())
    }
  }

  const handleMemberRowSelect = (memberId, checked) => {
    const newSel = new Set(selectedMembers)
    if (checked) newSel.add(memberId)
    else newSel.delete(memberId)
    setSelectedMembers(newSel)
    setMembersSelectAll(newSel.size === projectMembers.length)
  }

  const extractPhone = (m) => String(m.whatsapp || m.phone || m.mobile || m.contact || '')
  const extractEmail = (m) => String(m.email || m.email_address || m.primary_email || '')

  const handleSendWhatsApp = async (payload = {}) => {
    const selected = projectMembers.filter(m => selectedMembers.has(getMemberId(m)))
    const recipientIds = selected.map(getMemberId).filter(Boolean)
    if (recipientIds.length === 0) {
      await alert('No valid recipients selected.')
      return
    }
    try {
      await recruiterAPI.sendWhatsAppMessage({ to: recipientIds, templateId: payload.templateId, variables: payload.variables })
      await alert('WhatsApp messages sent (requests queued).')
      setIsWhatsAppOpen(false)
      setIsMembersModalOpen(false)
      setSelectedMembers(new Set())
      setMembersSelectAll(false)
    } catch (err) {
      console.error('WhatsApp send failed', err)
      await alert('Failed to send WhatsApp messages. Please try again.')
    }
  }

  const handleSendEmail = async (payload = {}) => {
    const selected = projectMembers.filter(m => selectedMembers.has(getMemberId(m)))
    const emails = selected.map(extractEmail).filter(Boolean)
    if (emails.length === 0) {
      await alert('No valid email addresses selected.')
      return
    }
    try {
      for (const email of emails) {
        await recruiterAPI.sendEmailMessage({ to: email, cc: payload.cc || '', subject: payload.subject || '', body: payload.body || '' })
      }
      await alert('Emails sent.')
      setIsEmailOpen(false)
      setIsMembersModalOpen(false)
      setSelectedMembers(new Set())
      setMembersSelectAll(false)
    } catch (err) {
      console.error('Email send failed', err)
      await alert('Failed to send emails. Please try again.')
    }
  }
  const pageStart = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  const getSearchAttendanceLocationValue = (record) => String(record?.location || record?.location_name || record?.locationName || record?.project_location_name || record?.projectLocationName || record?.projectLocation || '')
  const getSearchAttendanceDistrictValue = (record) => String(record?.district || record?.district_name || record?.districtName || '')
  const getSearchAttendanceCentreValue = (record) => String(record?.centre || record?.centre_name || record?.centreName || record?.center || record?.center_name || record?.centerName || '')

  const filteredSearchAttendanceRecords = useMemo(() => {
    const term = searchAttendanceSearch.trim().toLowerCase()
    return searchAttendanceResults.filter((record) => {
      const haystack = [
        record?.candidate_name,
        record?.aadhar,
        record?.mobile,
        record?.attendance_id,
        record?.status,
        record?.district,
        record?.centre,
        record?.date,
        record?.project_name,
      ].join(' ').toLowerCase()

      const matchesSearch = !term || haystack.includes(term)
      const matchesLocation = !searchAttendanceLocationId || getSearchAttendanceLocationValue(record) === String(searchAttendanceLocationId)
      const matchesDistrict = !searchAttendanceDistrictId || getSearchAttendanceDistrictValue(record) === String(searchAttendanceDistrictId)
      const matchesCentre = !searchAttendanceCentreId || getSearchAttendanceCentreValue(record) === String(searchAttendanceCentreId)
      const recordDate = String(record?.date || '').split('T')[0]
      const matchesFrom = !searchAttendanceFromDate || recordDate >= searchAttendanceFromDate
      const matchesTo = !searchAttendanceToDate || recordDate <= searchAttendanceToDate

      return matchesSearch && matchesLocation && matchesDistrict && matchesCentre && matchesFrom && matchesTo
    })
  }, [searchAttendanceResults, searchAttendanceSearch, searchAttendanceLocationId, searchAttendanceDistrictId, searchAttendanceCentreId, searchAttendanceFromDate, searchAttendanceToDate])

  const pagedSearchAttendanceRecords = useMemo(() => {
    const start = searchAttendanceOffset
    return filteredSearchAttendanceRecords.slice(start, start + searchAttendanceLimit)
  }, [filteredSearchAttendanceRecords, searchAttendanceOffset, searchAttendanceLimit])

  const openSearchAttendanceModal = () => {
    setSearchAttendanceFile(null)
    setSearchAttendanceFileName('')
    setSearchAttendanceDate('')
    setSearchAttendanceError('')
    setIsSearchAttendanceModalOpen(true)
  }

  const handleSearchAttendanceFileChange = (event) => {
    const file = event.target.files?.[0]
    setSearchAttendanceFile(file || null)
    setSearchAttendanceFileName(file?.name || '')
    if (file) setSearchAttendanceError('')
  }

  const handleSearchAttendanceUpload = async () => {
    if (!searchAttendanceFile) {
      setSearchAttendanceError('Please choose a CSV file to search attendance.')
      return
    }

    const formData = new FormData()
    formData.append('file', searchAttendanceFile)
    formData.append('project_id', selectedProject || '')
    formData.append('projectType', isWrittenExam ? 'writtenExam' : 'regular')
    formData.append('date', searchAttendanceDate)

    setSearchAttendanceLoading(true)
    setSearchAttendanceError('')

    try {
      const response = await recruiterAPI.searchAttendanceByCsv(formData, {
        projectId: selectedProject || '',
        projectType: isWrittenExam ? 'writtenExam' : 'regular',
      })
      const payload = response?.data ?? {}
      const normalizedPayload = typeof payload === 'string' ? (() => { try { return JSON.parse(payload) } catch { return {} } })() : payload
      const rows = Array.isArray(normalizedPayload?.data)
        ? normalizedPayload.data
        : Array.isArray(normalizedPayload?.records)
          ? normalizedPayload.records
          : []
      const nextTotal = normalizedPayload?.total ?? normalizedPayload?.count ?? rows.length ?? 0

      setSearchAttendanceResults(rows)
      setSearchAttendanceProjectName(normalizedPayload?.project_name || normalizedPayload?.projectName || projectTitle || 'Uploaded attendance')
      setSearchAttendanceTotal(nextTotal)
      setSearchAttendanceOffset(0)
      setSearchAttendanceSearch('')
      setSearchAttendanceLocationId('')
      setSearchAttendanceDistrictId('')
      setSearchAttendanceCentreId('')
      setSearchAttendanceFromDate('')
      setSearchAttendanceToDate('')
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

  useEffect(() => {
    if (!isSearchAttendanceResultsModalOpen) return
    fetchLocationOptions()
    if (isWrittenExam && searchAttendanceDistrictId) {
      fetchCentreOptions(selectedProject, searchAttendanceDistrictId)
    }
    if (!isWrittenExam && searchAttendanceLocationId) {
      fetchCentreOptions(selectedProject, searchAttendanceLocationId)
    }
  }, [isSearchAttendanceResultsModalOpen, fetchLocationOptions, fetchCentreOptions, isWrittenExam, searchAttendanceDistrictId, searchAttendanceLocationId, selectedProject])

  const downloadSearchAttendanceSample = () => {
    const headers = ['S.NO.', 'DISTRICT', 'CENTRE', 'DESIGNATION', 'NAME', 'CONTACTNO', 'AADHARNO']
    const rows = [
      ['1', 'PURNIA', '3601', 'Supervisor', 'Saurav Kr Jha', '7491010267', '398050438157'],
      ['2', 'PURNIA', '3601', 'Supervisor', 'Niranjan Kumar Thakur', '9608138005', '401333097386'],
      ['3', 'PURNIA', '3601', 'Operator', 'Niraj Kumar Paswan', '9572171590', '510825068732'],
      ['4', 'PURNIA', '3601', 'Operator', 'Abhishek Kumar Yadav', '7050172960', '783541090453'],
      ['5', 'PURNIA', '3601', 'Supervisor', 'Sachin Kumar Mishra', '9878451381', '289093347690'],
    ]

    const csvContent = [headers.join(','), ...rows.map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, 'attendance_search_sample.csv')
  }

  const exportSearchAttendanceResults = async (type = 'excel', customAdvtNo = '') => {
    const rowsToExport = filteredSearchAttendanceRecords.length ? filteredSearchAttendanceRecords : searchAttendanceResults
    if (!rowsToExport.length) {
      alert('error', 'No rows available to export for the current search.')
      return
    }

    const normalizedRows = rowsToExport.map((record, index) => ({
      'S.No': index + 1,
      'Date': record?.date || '',
      'Candidate': record?.candidate_name || '',
      'Aadhaar': record?.aadhar || '',
      'Mobile': record?.mobile || '',
      'District': record?.district || '',
      'Centre': record?.centre || '',
      'Clock In': record?.clock_in || '',
      'Clock Out': record?.clock_out || '',
      'Status': record?.status || '',
      'Project': record?.project_name || searchAttendanceProjectName || '',
    }))

    if (type === 'excel') {
      const ws = XLSX.utils.json_to_sheet(normalizedRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Search Attendance')
      XLSX.writeFile(wb, `search_attendance_${new Date().toISOString().split('T')[0]}.xlsx`)
      return
    }

    if (type === 'pdf') {
      // Extract unique date and centre from results
      const uniqueDates = [...new Set(rowsToExport.map(r => r?.date).filter(Boolean))]
      const uniqueCentres = [...new Set(rowsToExport.map(r => r?.centre).filter(Boolean))]
      const firstDate = uniqueDates[0] || ''
      const lastDate = uniqueDates[uniqueDates.length - 1] || ''
      // Always extract centre code from first matching row with centre
      const centreCode = rowsToExport.find(r => r?.centre)?.centreId || rowsToExport.find(r => r?.centre)?.centre_id || ''
      const centreName = uniqueCentres.length === 1 ? uniqueCentres[0] : (uniqueCentres.length > 1 ? 'Multiple' : '')
      
      await exportToPDF(customAdvtNo, rowsToExport, {
        fromDateOverride: firstDate,
        toDateOverride: lastDate,
        locationNameOverride: 'CSV Search',
        districtNameOverride: 'CSV Search',
        centreNameOverride: centreName,
        ...(centreCode ? { centreCodeOverride: centreCode } : {})
      })
      return
    }

    if (type === 'zip') {
      const zip = new JSZip()
      const imageRecords = rowsToExport
        .map((record, index) => ({ record, imageUrl: record?.check_in_image || record?.check_in_photo || record?.checkInImage || '', index }))
        .filter((item) => item.imageUrl)

      if (!imageRecords.length) {
        alert('error', 'No check-in images were returned for the current search result set.')
        return
      }

      const filenameCount = {}
      const filesToAdd = []
      for (let index = 0; index < imageRecords.length; index += 1) {
        const { record, imageUrl } = imageRecords[index]
        try {
          const blob = await fetchImageBlob(imageUrl)
          if (!blob) continue

          const applicantId = sanitizeFilename(getRecordAadhaar(record) || `record-${index + 1}`)
          const districtFolderName = sanitizeFilename(record?.district_name || record?.district || record?.districtName || 'Unknown district')
          const centreFolderName = sanitizeFilename(record?.centre_name || record?.centre || record?.centreName || record?.center || record?.center_name || record?.centerName || 'Unknown centre')
          const extension = getImageExtension(blob, imageUrl)
          const baseName = applicantId || `image-${index + 1}`
          const duplicateCount = filenameCount[`${districtFolderName}/${centreFolderName}/${baseName}`] || 0
          filenameCount[`${districtFolderName}/${centreFolderName}/${baseName}`] = duplicateCount + 1
          const fileName = sanitizeFilename(duplicateCount === 0 ? baseName : `${baseName}-${duplicateCount + 1}`) + `.${extension}`
          filesToAdd.push({ districtPath: districtFolderName, centrePath: centreFolderName, fileName, blob })
        } catch {
          // ignore individual image download failures
        }
      }

      const folderMap = {}
      for (let i = 0; i < filesToAdd.length; i += 1) {
        const { districtPath, centrePath } = filesToAdd[i]
        const key = `${districtPath}/${centrePath}`
        if (!folderMap[key]) {
          folderMap[key] = zip.folder(districtPath).folder(centrePath)
        }
      }

      for (let i = 0; i < filesToAdd.length; i += 1) {
        const { districtPath, centrePath, fileName, blob } = filesToAdd[i]
        const key = `${districtPath}/${centrePath}`
        folderMap[key].file(fileName, blob)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      saveAs(blob, `search_attendance_images_${new Date().toISOString().split('T')[0]}.zip`)
    }
  }

  const getCoords = (record, keyBase) => {
    const value = record[keyBase]
    if (value && typeof value === 'object') {
      const lat = Number(value.lat ?? value.latitude ?? value.latitute ?? value.latLng ?? value.latitude)
      const lng = Number(value.lng ?? value.longitude ?? value.lon ?? value.long ?? value.lng)
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng }
    }

    const lat = Number(record[`${keyBase}_lat`] ?? record[`${keyBase}_latitude`] ?? record[`${keyBase}_latitute`])
    const lng = Number(record[`${keyBase}_lng`] ?? record[`${keyBase}_longitude`] ?? record[`${keyBase}_lon`] ?? record[`${keyBase}_long`])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng }
    return null
  }

  const formatAadhaar = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
    return digits.replace(/(\d{4})(?=\d)/g, '$1-')
  }

  const exportFraudAttendanceToExcel = () => {
    if (!fraudRecords.length) {
      alert('No fraud attendance records available for export.')
      return
    }

    const data = fraudRecords.map((record, index) => ({
      'S.no': index + 1,
      'Date': record.date || record.day || record.attendance_date || '',
      'Candidate': getRecordCandidateName(record),
      'Aadhaar': formatAadhaar(getRecordAadhaar(record)),
      'Mobile': getRecordMobile(record),
      ...(isWrittenExam
        ? {
            'District': getRecordDistrictName(record),
            'Centre Code': getRecordCentreCode(record),
            'Centre Name': getRecordCentreName(record),
          }
        : {
            'Location': record.location_name || record.location || 'Unknown location',
          }),
      'Clock In': record.check_in_time || record.clock_in || record.checkin_time || record.check_in || '',
      'Clock Out': record.check_out_time || record.clock_out || record.checkout_time || record.check_out || '',
      'Status': String(record.status || 'Unknown'),
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Fraud Attendance')
    XLSX.writeFile(wb, `fraud_attendance_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportFraudAttendanceToPDF = async () => {
    if (!fraudRecords.length) {
      alert('No fraud attendance records available for export.')
      return
    }

    const exportDate = new Date().toISOString().split('T')[0]
    const sanitizeFilename = (value) => String(value || '').replace(/[\\/:*?"<>|]+/g, '_').trim()
    const getRecordDistrictKey = (record) => {
      const districtName = record.district_name || record.district || record.districtName || 'Unknown district'
      const districtId = record.district_id || record.districtId || record.district || districtName
      return `${districtId}||${districtName}`
    }
    const getRecordCentreKey = (record) => {
      const centreName = record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || 'Unknown centre'
      const centreId = record.centre_id || record.centreId || record.centre || centreName
      return `${centreId}||${centreName}`
    }
    const getRecordLocationKey = (record) => {
      const locationName = record.location_name || record.location || record.project_location || record.project || 'Unknown location'
      const locationId = record.location_id || record.locationId || record.location || locationName
      return `${locationId}||${locationName}`
    }

    const buildRow = async (record, index) => {
      const profileImage = getProfileImageUrl(record)
      let profileImageData = null
      if (profileImage) {
        try {
          profileImageData = await loadImageAsDataUrl(profileImage, 80, 80)
        } catch (err) {
          console.warn('Failed to load profile image for PDF export', profileImage, err)
        }
      }

      const checkInImage = getCheckInImageUrl(record)
      let checkInImageData = null
      if (checkInImage) {
        try {
          checkInImageData = await loadImageAsDataUrl(checkInImage, 120, 80)
        } catch (err) {
          console.warn('Failed to load check-in image for PDF export', checkInImage, err)
        }
      }

      return [
        index + 1,
        record.date || record.day || record.attendance_date || '—',
        getRecordCandidateName(record),
        formatAadhaar(getRecordAadhaar(record)) || '—',
        getRecordMobile(record),
        ...(isWrittenExam ? [getRecordDistrictName(record)] : [(record.location_name || record.location || 'Unknown location')]),
        getRecordCentreCode(record),
        getRecordCentreName(record),
        record.check_in_time || record.clock_in || record.checkin_time || record.check_in || '—',
        record.check_out_time || record.clock_out || record.checkout_time || record.check_out || '—',
        String(record.status || 'Unknown'),
        profileImageData || '—',
        checkInImageData || '—',
      ]
    }

    const buildRowsWithConcurrency = async (records, batchSize = 20, onProgress = () => {}) => {
      const rows = []
      for (let start = 0; start < records.length; start += batchSize) {
        const batch = records.slice(start, start + batchSize)
        const batchRows = await Promise.all(batch.map((record, idx) => buildRow(record, start + idx)))
        rows.push(...batchRows)
        onProgress(rows.length, records.length)
      }
      return rows
    }

    const createPdfBlob = async (records, titleLabels = {}, onProgress = () => {}) => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 36
      const dateRangeText = `${fraudFromDate || 'Any'} – ${fraudToDate || 'Any'}`
      const headerTitleY = 42
      const metaY = 18
      const pageStartY = 52

      const drawPageHeader = (pageNumber) => {
        doc.setFillColor(18, 97, 128)
        doc.rect(0, 0, pageWidth, 42, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(pageNumber === 1 ? 18 : 12)
        doc.text('Fraud Attendance Report', margin, headerTitleY)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin - 240, metaY)
        doc.text(`Records: ${records.length}`, pageWidth - margin - 240, metaY + 10)
        doc.text(`Date Range: ${dateRangeText}`, pageWidth - margin - 240, metaY + 20)
      }

      const columns = [
        'S.No',
        'Date',
        'Candidate',
        'Aadhaar',
        'Mobile',
        ...(isWrittenExam ? ['District'] : ['Location']),
        'Centre Code',
        'Centre Name',
        'Clock In',
        'Clock Out',
        'Status',
        'Profile',
        'In Image',
      ]

      const rowData = await buildRowsWithConcurrency(records, 20, onProgress)
      const tableWidth = pageWidth - margin * 2
      const centeredMarginLeft = margin

      drawPageHeader(1)

      autoTable(doc, {
        head: [columns],
        body: rowData,
        startY: pageStartY,
        margin: { left: centeredMarginLeft, right: centeredMarginLeft },
        tableWidth,
        styles: {
          fontSize: 8,
          cellPadding: 5,
          overflow: 'linebreak',
          valign: 'middle',
          cellWidth: 'wrap',
          minCellHeight: 36,
        },
        headStyles: {
          fillColor: [18, 97, 128],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [247, 249, 251] },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 50 },
          2: { cellWidth: 110 },
          3: { cellWidth: 55 },
          4: { cellWidth: 55 },
          5: { cellWidth: isWrittenExam ? 80 : 90 },
          6: { cellWidth: 80 },
          7: { cellWidth: 80 },
          8: { cellWidth: 50 },
          9: { cellWidth: 50 },
          10: { cellWidth: 50 },
          11: { cellWidth: 50, minCellHeight: 40 },
          12: { cellWidth: 50, minCellHeight: 40 },
        },
        theme: 'grid',
        showHead: 'everyPage',
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            drawPageHeader(data.pageNumber)
          }
        },
        didParseCell: (data) => {
          if ([11, 12].includes(data.column.index) && data.cell.raw && String(data.cell.raw).startsWith('data:image')) {
            data.cell.text = ['']
          }
        },
        didDrawCell: (data) => {
          if ([11, 12].includes(data.column.index) && data.cell.raw && String(data.cell.raw).startsWith('data:image')) {
            try {
              const width = 42
              const height = 30
              doc.addImage(String(data.cell.raw), 'PNG', data.cell.x + 4, data.cell.y + 6, width, height)
            } catch (e) {
              doc.setFontSize(7)
              doc.text('Image', data.cell.x + 6, data.cell.y + 22)
            }
          }
        },
      })

      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 80, pageHeight - 18)
      }

      return doc.output('blob')
    }

    if (isWrittenExam) {
      if (!selectedDistrictId) {
        const districtGroups = fraudRecords.reduce((acc, record) => {
          const key = getRecordDistrictKey(record)
          if (!acc[key]) {
            acc[key] = { districtName: key.split('||')[1], records: [] }
          }
          acc[key].records.push(record)
          return acc
        }, {})

        const zip = new JSZip()
        for (const [key, group] of Object.entries(districtGroups)) {
          const centreGroups = group.records.reduce((acc, record) => {
            const centreKey = getRecordCentreKey(record)
            if (!acc[centreKey]) {
              acc[centreKey] = { centreName: centreKey.split('||')[1], records: [] }
            }
            acc[centreKey].records.push(record)
            return acc
          }, {})

          const districtFolder = zip.folder(sanitizeFilename(group.districtName)) || zip
          for (const [centreKey, centreGroup] of Object.entries(centreGroups)) {
            const centreName = centreGroup.centreName
            const centreCode = getRecordCentreCode(centreGroup.records[0])
            const pdfBlob = await createPdfBlob(centreGroup.records, { districtName: group.districtName, centreName })
            const fileName = `${sanitizeFilename(centreCode || centreName)}_${sanitizeFilename(centreName)}_${exportDate}.pdf`
            districtFolder.file(fileName, pdfBlob)
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        saveAs(zipBlob, `fraud_attendance_all_districts_${exportDate}.zip`)
        return
      }

      if (!selectedCentreId) {
        const centreGroups = fraudRecords.reduce((acc, record) => {
          const centreKey = getRecordCentreKey(record)
          if (!acc[centreKey]) {
            acc[centreKey] = { centreName: centreKey.split('||')[1], records: [] }
          }
          acc[centreKey].records.push(record)
          return acc
        }, {})

        const zip = new JSZip()
        const districtFolder = zip.folder(sanitizeFilename(getRecordDistrictName(fraudRecords[0]) || 'district')) || zip
        for (const [centreKey, centreGroup] of Object.entries(centreGroups)) {
          const centreName = centreGroup.centreName
          const centreCode = getRecordCentreCode(centreGroup.records[0])
          const pdfBlob = await createPdfBlob(centreGroup.records, { districtName: getRecordDistrictName(fraudRecords[0]), centreName })
          const fileName = `${sanitizeFilename(centreCode || centreName)}_${sanitizeFilename(centreName)}_${exportDate}.pdf`
          districtFolder.file(fileName, pdfBlob)
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        saveAs(zipBlob, `fraud_attendance_${sanitizeFilename(getRecordDistrictName(fraudRecords[0]) || 'district')}_${exportDate}.zip`)
        return
      }

      const centreCode = getRecordCentreCode(fraudRecords[0])
      const pdfBlob = await createPdfBlob(fraudRecords, { districtName: getRecordDistrictName(fraudRecords[0]), centreName: getRecordCentreName(fraudRecords[0]) })
      const fileName = `fraud_attendance_${sanitizeFilename(centreCode || getRecordCentreName(fraudRecords[0]))}_${exportDate}.pdf`
      saveAs(pdfBlob, fileName)
      return
    }

    if (!selectedLocationId) {
      const locationGroups = fraudRecords.reduce((acc, record) => {
        const key = getRecordLocationKey(record)
        if (!acc[key]) {
          acc[key] = { locationName: key.split('||')[1], records: [] }
        }
        acc[key].records.push(record)
        return acc
      }, {})

      const zip = new JSZip()
      for (const [key, group] of Object.entries(locationGroups)) {
        const pdfBlob = await createPdfBlob(group.records, { locationName: group.locationName })
        const fileName = `${sanitizeFilename(group.locationName)}_${exportDate}.pdf`
        zip.file(fileName, pdfBlob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveAs(zipBlob, `fraud_attendance_all_locations_${exportDate}.zip`)
      return
    }

    const pdfBlob = await createPdfBlob(fraudRecords, { locationName: fraudRecords[0]?.location_name || fraudRecords[0]?.location || 'Location' })
    const fileName = `fraud_attendance_${sanitizeFilename(fraudRecords[0]?.location_name || fraudRecords[0]?.location || 'location')}_${exportDate}.pdf`
    saveAs(pdfBlob, fileName)
  }

  const exportToExcel = () => {
    const selectedData = selectedRows.size > 0
      ? attendance.filter(record => selectedRows.has(record.attendance_id || record.id))
      : attendance

    if (selectedData.length === 0) {
      alert('No attendance records available for export.')
      return
    }

    const data = selectedData.map((record, index) => {
      const baseData = {
        'S.no': index + 1,
        'Date': record.date || '',
        'Candidate': record.candidate_name || record.worker_name || record.worker || '',
        'Aadhaar': formatAadhaar(record.aadhar || record.aadhaar || ''),
        'Mobile': record.mobile || '',
      }

      if (isWrittenExam) {
        return {
          ...baseData,
          'District': record.district_name || record.district || '',
          'Centre': record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || '',
          'Clock In': record.clock_in || '',
          'Clock Out': record.clock_out || '',
          'Status': record.status || ''
        }
      } else {
        return {
          ...baseData,
          'Location': record.location_name || record.location || '',
          'Clock In': record.clock_in || '',
          'Clock Out': record.clock_out || '',
          'Status': record.status || ''
        }
      }
    })

    // Sort by date (asc), then district (asc), then centre (asc)
    data.sort((a, b) => {
      // Sort by date
      const dateA = new Date(a['Date'] || '').getTime()
      const dateB = new Date(b['Date'] || '').getTime()
      if (dateA !== dateB) return dateA - dateB

      // Sort by district (for written exams) or location (for regular)
      const districtA = isWrittenExam ? (a['District'] || '') : (a['Location'] || '')
      const districtB = isWrittenExam ? (b['District'] || '') : (b['Location'] || '')
      const districtCompare = String(districtA).localeCompare(String(districtB))
      if (districtCompare !== 0) return districtCompare

      // Sort by centre (for written exams only)
      if (isWrittenExam) {
        const centreA = a['Centre'] || ''
        const centreB = b['Centre'] || ''
        return String(centreA).localeCompare(String(centreB))
      }

      return 0
    })

    // Re-number S.no after sorting
    data.forEach((row, idx) => {
      row['S.no'] = idx + 1
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Data')
    XLSX.writeFile(wb, `attendance_data_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Helper: load image and return data URL (tries direct load, then fetch+blob fallback)
  const loadImageAsDataUrl = async (url, maxWidth = 300, maxHeight = 200) => {
    if (!url) return null
    // Try direct Image load first (keeps cookies for same-origin)
    try {
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = url
      })

      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = maxHeight
      const ctx = canvas.getContext('2d')

      const aspectRatio = img.width / img.height
      let drawWidth = canvas.width
      let drawHeight = canvas.height
      if (aspectRatio > drawWidth / drawHeight) {
        drawHeight = drawWidth / aspectRatio
      } else {
        drawWidth = drawHeight * aspectRatio
      }
      const x = (canvas.width - drawWidth) / 2
      const y = (canvas.height - drawHeight) / 2
      ctx.drawImage(img, x, y, drawWidth, drawHeight)
      return canvas.toDataURL('image/png')
    } catch (err) {
      // Fallback 1: try fetching as blob (include credentials) and draw from blob URL
      try {
        const resp = await fetch(url, { credentials: 'include' })
        if (!resp.ok) throw new Error('Fetch failed')
        const blob = await resp.blob()
        const blobUrl = URL.createObjectURL(blob)
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = blobUrl
        })
        const canvas = document.createElement('canvas')
        canvas.width = maxWidth
        canvas.height = maxHeight
        const ctx = canvas.getContext('2d')
        const aspectRatio = img.width / img.height
        let drawWidth = canvas.width
        let drawHeight = canvas.height
        if (aspectRatio > drawWidth / drawHeight) {
          drawHeight = drawWidth / aspectRatio
        } else {
          drawWidth = drawHeight * aspectRatio
        }
        const x = (canvas.width - drawWidth) / 2
        const y = (canvas.height - drawHeight) / 2
        ctx.drawImage(img, x, y, drawWidth, drawHeight)
        URL.revokeObjectURL(blobUrl)
        return canvas.toDataURL('image/png')
      } catch (err2) {
        // Fallback 1b: try dev proxy (same-origin) which fetches server-side to avoid CORS
        try {
          const proxyUrl = `/__image_proxy?url=${encodeURIComponent(url)}`
          const pResp = await fetch(proxyUrl)
          if (pResp && pResp.ok) {
            const blob = await pResp.blob()
            const blobUrl = URL.createObjectURL(blob)
            const img = new Image()
            await new Promise((resolve, reject) => {
              img.onload = resolve
              img.onerror = reject
              img.src = blobUrl
            })
            const canvas = document.createElement('canvas')
            canvas.width = maxWidth
            canvas.height = maxHeight
            const ctx = canvas.getContext('2d')
            const aspectRatio = img.width / img.height
            let drawWidth = canvas.width
            let drawHeight = canvas.height
            if (aspectRatio > drawWidth / drawHeight) {
              drawHeight = drawWidth / aspectRatio
            } else {
              drawWidth = drawHeight * aspectRatio
            }
            const x = (canvas.width - drawWidth) / 2
            const y = (canvas.height - drawHeight) / 2
            ctx.drawImage(img, x, y, drawWidth, drawHeight)
            URL.revokeObjectURL(blobUrl)
            return canvas.toDataURL('image/png')
          }
        } catch (proxyErr) {
          // ignore and try axios fallback
        }

        // Fallback 2: try axios (recruiterAPI) to include auth headers/interceptors
        try {
          const axiosResp = await recruiterAPI.get(url, { responseType: 'blob' })
          const blob = axiosResp?.data
          if (!blob) throw new Error('No blob from axios')
          const blobUrl = URL.createObjectURL(blob)
          const img = new Image()
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = blobUrl
          })
          const canvas = document.createElement('canvas')
          canvas.width = maxWidth
          canvas.height = maxHeight
          const ctx = canvas.getContext('2d')
          const aspectRatio = img.width / img.height
          let drawWidth = canvas.width
          let drawHeight = canvas.height
          if (aspectRatio > drawWidth / drawHeight) {
            drawHeight = drawWidth / aspectRatio
          } else {
            drawWidth = drawHeight * aspectRatio
          }
          const x = (canvas.width - drawWidth) / 2
          const y = (canvas.height - drawHeight) / 2
          ctx.drawImage(img, x, y, drawWidth, drawHeight)
          URL.revokeObjectURL(blobUrl)
          return canvas.toDataURL('image/jpeg', 0.8)
        } catch (err3) {
          console.warn('Failed to load image via direct, proxy, or axios methods', url, err3)
          return null
        }
      }
    }
  }

  const sanitizeFilename = (value) => String(value || '').replace(/[\\/:*?"<>|]+/g, '_').trim()

  const getProfileImageUrl = (record) => record.profile_image || record.profileImage || record.photo || record.avatar || record.candidate_image || record.candidate_photo || ''
  const getCheckInImageUrl = (record) => record.check_in_image || record.checkin_image || record.checkInImage || record.check_in_photo || record.check_in_img || ''
  const getCheckOutImageUrl = (record) => record.check_out_image || record.checkout_image || record.checkOutImage || record.check_out_photo || record.check_out_img || ''
  const getRecordAadhaar = (record) => {
    const raw = String(record.aadhar || record.aadhaar || record.aadhaar_number || record.aadhaarNo || record.worker_aadhaar || record.candidate_aadhaar || record.aadhaar_no || '')
    const digits = raw.replace(/\D/g, '').slice(0, 12)
    return digits || String(record.attendance_id || record.id || record.worker_id || record.candidate_id || '')
  }
  const getRecordCandidateName = (record) => String(record.candidate_name || record.worker_name || record.worker || record.name || 'Unknown').trim()
  const getRecordMobile = (record) => String(record.mobile || record.phone || record.contact || 'Unknown').trim()
  const getRecordDistrictName = (record) => record.district_name || record.district || record.districtName || 'Unknown district'
  const getRecordCentreName = (record) => record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || 'Unknown centre'
  const getRecordCentreCode = (record) => {
    const value = record.centre_id || record.centreId || record.center_id || record.centerId || record.centre_code || record.centreCode || record.code || record.centerCode || ''
    return String(value || '').trim()
  }
  const getRecordFileName = (record, extension) => {
    const name = sanitizeFilename(getRecordCandidateName(record) || 'name')
    const mobile = sanitizeFilename(getRecordMobile(record) || 'mobile')
    const aadhaar = sanitizeFilename(getRecordAadhaar(record) || 'aadhaar')
    return `${name}_${mobile}_${aadhaar}.${extension}`
  }

  const getImageExtension = (blob, url) => {
    const mime = blob?.type || ''
    let ext = ''
    if (mime) {
      ext = mime.split('/')[1] || ''
      if (ext === 'jpeg') ext = 'jpg'
    }
    if (!ext) {
      const match = String(url).match(/\.(jpe?g|png|gif|webp|bmp|svg)(?=$|\?)/i)
      ext = match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg'
    }
    return ext || 'jpg'
  }

  const fetchImageBlob = async (url) => {
    if (!url) return null
    try {
      const response = await fetch(url, { credentials: 'include' })
      if (response.ok) {
        const blob = await response.blob()
        if (blob && blob.size > 0) return blob
      }
    } catch (err) {
      // ignore fetch errors and try axios fallback
    }

    try {
      const axiosResp = await recruiterAPI.get(url, { responseType: 'blob' })
      const blob = axiosResp?.data
      if (blob && blob.size > 0) return blob
    } catch (err) {
      // ignore axios errors
    }

    return null
  }

  const exportCheckInImagesZip = async () => {
    const filters = {
      search: search || undefined,
      projectId: selectedProject || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }
    if (isWrittenExam) {
      filters.districtId = selectedDistrictId || undefined
      if (selectedCentreId) filters.centreId = selectedCentreId
    } else {
      filters.locationId = selectedLocationId || undefined
      if (selectedCentreId) filters.centreId = selectedCentreId
    }

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
      const exportDate = new Date().toISOString().split('T')[0]
      const selectedDistrict = districtOptions.find((d) => String(d.id) === String(selectedDistrictId))
      const selectedLocation = locationOptions.find((l) => String(l.id) === String(selectedLocationId))
      const selectedDistrictName = selectedDistrict?.name || selectedDistrictId || ''
      const selectedLocationName = selectedLocation?.name || selectedLocationId || ''

      const selectedData = selectedRows.size > 0
        ? attendance.filter(record => selectedRows.has(record.attendance_id || record.id))
        : null

      updateLoadingToast(selectedData ? 'Preparing selected attendance records...' : 'Fetching attendance records...')
      const allRecords = selectedData || await fetchAllExportRecords(filters)
      if (!allRecords || allRecords.length === 0) {
        await alert('No attendance records found for the selected filters.')
        return
      }

      const imageRecords = allRecords.map((record, index) => ({ record, imageUrl: getCheckInImageUrl(record), index })).filter((item) => item.imageUrl)
      if (imageRecords.length === 0) {
        await alert('No check-in images were found for the selected attendance records.')
        return
      }

      const zip = new JSZip()
      const filenameCount = {}
      const totalImages = imageRecords.length
      const concurrency = Math.min(8, totalImages)
      const batchSize = concurrency
      const filesToAdd = []
      const manifestRows = []

      const chunks = []
      for (let start = 0; start < totalImages; start += batchSize) {
        chunks.push(imageRecords.slice(start, start + batchSize))
      }

      let processedCount = 0
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const batch = chunks[chunkIndex]
        updateLoadingToast({
          title: 'Downloading images',
          detail: `Batch ${chunkIndex + 1}/${chunks.length}`,
          loaded: processedCount,
          total: totalImages,
          progress: (processedCount / totalImages) * 90,
        })

        const results = await Promise.all(batch.map(async ({ record, imageUrl, index }) => {
          const blob = await fetchImageBlob(imageUrl)
          return { record, imageUrl, index, blob }
        }))

        for (let j = 0; j < results.length; j += 1) {
          const { record, imageUrl, index, blob } = results[j]
          processedCount += 1
          const applicantId = sanitizeFilename(getRecordAadhaar(record) || `record-${index + 1}`)
          const districtFolderName = sanitizeFilename(getRecordDistrictName(record))
          const centreCode = getRecordCentreCode(record) || getRecordCentreName(record)
          const centreFolderName = sanitizeFilename(centreCode)

          updateLoadingToast({
            title: 'Downloading images',
            detail: `${applicantId || 'image'} (${processedCount}/${totalImages})`,
            loaded: processedCount,
            total: totalImages,
            progress: (processedCount / totalImages) * 90,
          })

          if (!blob) continue

          const extension = getImageExtension(blob, imageUrl)
          const duplicateCount = filenameCount[`${districtFolderName}/${centreFolderName}/${applicantId}`] || 0
          filenameCount[`${districtFolderName}/${centreFolderName}/${applicantId}`] = duplicateCount + 1
          const fileName = getRecordFileName(record, extension)
          const finalFileName = duplicateCount === 0 ? fileName : `${fileName.replace(/\.[^.]+$/, '')}-${duplicateCount + 1}${fileName.slice(fileName.lastIndexOf('.'))}`
          filesToAdd.push({
            districtPath: districtFolderName,
            centrePath: centreFolderName,
            fileName: finalFileName,
            blob,
            manifestRow: {
              Name: getRecordCandidateName(record),
              Mobile: getRecordMobile(record),
              Aadhaar: getRecordAadhaar(record),
              District: getRecordDistrictName(record),
              Centre: getRecordCentreName(record),
              'Centre code': getRecordCentreCode(record),
              'File name': finalFileName,
            }
          })
        }
      }

      updateLoadingToast({ title: 'Organizing files', detail: 'Building folder structure...', progress: 92 })
      const folderMap = {}
      for (let i = 0; i < filesToAdd.length; i += 1) {
        const { districtPath, centrePath } = filesToAdd[i]
        const key = `${districtPath}/${centrePath}`
        if (!folderMap[key]) {
          folderMap[key] = zip.folder(districtPath).folder(centrePath)
        }
      }

      for (let i = 0; i < filesToAdd.length; i += 1) {
        const { districtPath, centrePath, fileName, blob } = filesToAdd[i]
        const key = `${districtPath}/${centrePath}`
        folderMap[key].file(fileName, blob)
        manifestRows.push(filesToAdd[i].manifestRow)
      }

      const entries = Object.keys(zip.files).length
      if (entries === 0) {
        await alert('Unable to download any check-in images. Please verify the image URLs or try again later.')
        return
      }

      updateLoadingToast({ title: 'Compressing ZIP', detail: 'Compressing images...', progress: 95 })
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        updateLoadingToast({
          title: 'Compressing ZIP',
          detail: `Compression ${Math.round(metadata.percent)}%`,
          loaded: metadata.percent,
          total: 100,
          progress: metadata.percent,
        })
      })

      const zipName = sanitizeFilename((selectedDistrictName || selectedLocationName || 'attendance') + `_${exportDate}`)
      saveAs(zipBlob, `${zipName}.zip`)

      const sortedManifestRows = [...manifestRows].sort((a, b) => {
        const districtCompare = String(a.District || '').localeCompare(String(b.District || ''), undefined, { sensitivity: 'base' })
        if (districtCompare !== 0) return districtCompare
        const codeA = Number(String(a['Centre code'] || '').replace(/\D/g, '')) || 0
        const codeB = Number(String(b['Centre code'] || '').replace(/\D/g, '')) || 0
        return codeA - codeB
      })

      const manifestSheet = XLSX.utils.json_to_sheet(sortedManifestRows)
      const manifestWorkbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(manifestWorkbook, manifestSheet, 'Check-in Images')
      const manifestBuffer = XLSX.write(manifestWorkbook, { bookType: 'xlsx', type: 'array' })
      const manifestBlob = new Blob([manifestBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(manifestBlob, `${zipName}_manifest.xlsx`)
    } finally {
      if (document.body.contains(loadingToast)) document.body.removeChild(loadingToast)
    }
  }

  const fetchAllExportRecords = async (params = {}) => {
    const pageLimit = 200
    let allRows = []
    let offsetExport = 0
    let totalCount = null

    while (true) {
      const response = await (isWrittenExam
        ? recruiterAPI.getWrittenExamAttendanceRecords({ ...params, offset: offsetExport, limit: pageLimit })
        : recruiterAPI.getAttendanceRecords({ ...params, offset: offsetExport, limit: pageLimit })
      )
      let payload = response?.data ?? {}
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload) } catch { payload = {} }
      }

      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.records)
          ? payload.records
          : []
      const count = payload?.total ?? payload?.count ?? payload?.total_count ?? payload?.meta?.total ?? payload?.meta?.count
      if (totalCount === null && typeof count === 'number') {
        totalCount = count
      }

      allRows = allRows.concat(rows)
      if (!rows.length) break
      offsetExport += rows.length
      if (totalCount !== null && allRows.length >= totalCount) break
      if (rows.length < pageLimit) break
    }

    return allRows
  }

  const exportToPDF = async (customAdvtNo = '', recordsOverride = null, pdfOverrides = {}) => {
    const {
      projectTitleOverride = projectTitle || 'All projects',
      fromDateOverride = fromDate || '',
      toDateOverride = toDate || '',
      locationNameOverride = '',
      districtNameOverride = '',
      centreNameOverride = '',
      centreCodeOverride = '',
      modifiedPdfOptions = null,
      clockInFallback = '',
      clockOutFallback = '',
    } = pdfOverrides || {}
    const pdfCustomization = modifiedPdfOptions || {
      columns: { date: true, candidate: true, aadhaar: true, mobile: true, designation: true, area: true, centre: false, clockIn: true, clockOut: false, status: true, checkInImage: true },
      header: { dateMode: 'range', advtNo: true, centreCode: true },
    }
    const selectedLocation = locationOptions.find((l) => String(l.id) === String(selectedLocationId))
    const selectedDistrict = districtOptions.find((d) => String(d.id) === String(selectedDistrictId))
    const selectedCentre = centreOptions.find((c) => String(c.id) === String(selectedCentreId))
    const selectedLocationName = locationNameOverride || selectedLocation?.name || selectedLocationId
    const selectedDistrictName = districtNameOverride || selectedDistrict?.name || selectedDistrictId
    const selectedCentreName = centreNameOverride || selectedCentre?.name || selectedCentreId
    const selectedCentreCode = centreCodeOverride || selectedCentre?.centre_code || selectedCentre?.centreCode || selectedCentre?.centreId || selectedCentre?.centre_id || selectedCentre?.code || selectedCentre?.id || selectedCentreId || ''
    const advtNo = customAdvtNo || `${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`

    const exportDate = new Date().toISOString().split('T')[0]
    const sanitizeFilename = (value) => String(value || '').replace(/[\\/:*?"<>|]+/g, '_').trim()
    const getRecordCentreCode = (record = {}) => {
      const value = record?.centreCode || record?.centre_code || record?.centreId || record?.centre_id || record?.code || record?.id || ''
      return String(value || '').trim()
    }
    const getRecordCentreCodeFromRecords = (recordsArg = []) => {
      for (const record of recordsArg || []) {
        const code = getRecordCentreCode(record)
        if (code) return code
      }
      return ''
    }
    const getRecordDistrictKey = (record) => {
      const districtName = record.district_name || record.district || record.districtName || 'Unknown district'
      const districtId = record.district_id || record.districtId || record.district || districtName
      return `${districtId}||${districtName}`
    }
    const getRecordCentreKey = (record) => {
      const centreName = record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || 'Unknown centre'
      const centreId = record.centre_id || record.centreId || record.centre || centreName
      return `${centreId}||${centreName}`
    }
    const getRecordLocationKey = (record) => {
      const locationName = record.location_name || record.location || record.project_location || record.project || 'Unknown location'
      const locationId = record.location_id || record.locationId || record.location || locationName
      return `${locationId}||${locationName}`
    }

    const columnDefinitions = [
      { key: 'date', label: 'Date', width: 52 },
      { key: 'candidate', label: 'Candidate', width: 130 },
      { key: 'aadhaar', label: 'Aadhaar', width: 70 },
      { key: 'mobile', label: 'Mobile', width: 70 },
      { key: 'designation', label: 'Designation', width: 80 },
      { key: 'area', label: isWrittenExam ? 'District' : 'Location', width: isWrittenExam ? 90 : 120 },
      { key: 'centre', label: 'Centre', width: 80 },
      { key: 'clockIn', label: 'Clock In', width: isWrittenExam ? 60 : 55 },
      { key: 'clockOut', label: 'Clock Out', width: 55 },
      { key: 'status', label: 'Status', width: 50 },
      { key: 'checkInImage', label: 'In Image', width: 80 },
    ]
    const activeColumns = columnDefinitions.filter((column) => pdfCustomization.columns[column.key])

    const buildRow = async (record, index) => {
      const checkInImage = record.check_in_image || record.checkin_image || record.checkInImage || record.check_in_photo || record.check_in_img || ''
      let checkInImgData = null
      if (checkInImage) {
        try {
          checkInImgData = await loadImageAsDataUrl(checkInImage, 220, 120)
        } catch (err) {
          console.warn('Failed to convert check-in image to data URL', checkInImage, err)
        }
      }

      const values = {
        date: record.date || '—',
        candidate: record.candidate_name || record.worker_name || record.worker || '—',
        aadhaar: formatAadhaar(record.aadhar || record.aadhaar || '') || '—',
        mobile: record.mobile || '—',
        designation: record.designation || record.role || record.designationName || record.position || '—',
        area: isWrittenExam ? (record.district_name || record.district || record.districtName || '—') : (record.location_name || record.location || record.project_location || record.project || '—'),
        centre: record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || '—',
        clockIn: record.clock_in || record.check_in_time || record.checkin_time || record.check_in || clockInFallback || '—',
        clockOut: record.clock_out || record.check_out_time || record.checkout_time || record.check_out || clockOutFallback || '—',
        status: String(record.status || '—').toLowerCase() === 'incomplete' && clockOutFallback ? 'Present' : (record.status || '—'),
        checkInImage: checkInImgData || '—',
      }
      return [index + 1, ...activeColumns.map((column) => values[column.key])]
    }

    const buildRowsWithConcurrency = async (records, batchSize = 20, onProgress = () => {}) => {
      const rows = []
      for (let start = 0; start < records.length; start += batchSize) {
        const batch = records.slice(start, start + batchSize)
        const batchRows = await Promise.all(batch.map((record, idx) => buildRow(record, start + idx)))
        rows.push(...batchRows)
        onProgress(rows.length, records.length)
      }
      return rows
    }

    const createPdfBlob = async (records, titleLabels = {}, onProgress = () => {}, headerOverrides = {}) => {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 36
      const projectTypeLabel = isWrittenExam ? 'Written Exam' : 'Regular'
      const projectLocationLabel = isWrittenExam ? titleLabels.districtName || headerOverrides.districtNameOverride || selectedDistrictName || 'District' : titleLabels.locationName || headerOverrides.locationNameOverride || selectedLocationName || 'Location'
      const projectCentreLabel = headerOverrides.centreNameOverride || titleLabels.centreName || selectedCentreName || (isWrittenExam ? 'All centres' : '')
      const resolvedCentreCode = headerOverrides.centreCodeOverride || titleLabels.centreCodeOverride || titleLabels.centreCode || getRecordCentreCodeFromRecords(records) || selectedCentreCode
      const centreCodeLine = pdfCustomization.header.centreCode && resolvedCentreCode ? `Centre Code: ${resolvedCentreCode}` : ''
      const dateRangeText = `${fromDateOverride || fromDate || 'Any'} – ${toDateOverride || toDate || 'Any'}`
      const headerTitleY = 42
      const metaY = 18
      const labelTopY = 60
      const firstValueY = 74
      const lineHeight = 12
      // narrower field width to reduce wrapping and allow tighter column spacing
      const fieldWidth = 160
      const firstColX = margin
      // tightened horizontal spacing between header columns
      const secondColX = margin + 180
      const thirdColX = margin + 360
      const fourthColX = margin + 540

      const clampTextLines = (lines, maxLines = 3) => {
        if (!Array.isArray(lines) || lines.length <= maxLines) return lines
        const trimmedLines = lines.slice(0, maxLines)
        const lastLine = String(trimmedLines[maxLines - 1] || '')
        const ellipsis = lastLine.endsWith('...') ? lastLine : `${lastLine.replace(/\s+$/, '').slice(0, Math.max(0, lastLine.length - 3))}...`
        trimmedLines[maxLines - 1] = ellipsis
        return trimmedLines
      }

      doc.setFontSize(10)
      const projectTitleLines = doc.splitTextToSize(projectTitleOverride || 'All projects', fieldWidth)
      // remove 'Type' column from header and compact Venue into up to 3 lines
      const headerDateText = pdfCustomization.header.dateMode === 'from'
        ? `From: ${fromDateOverride || fromDate || 'Any'}`
        : pdfCustomization.header.dateMode === 'to'
          ? `To: ${toDateOverride || toDate || 'Any'}`
          : pdfCustomization.header.dateMode === 'range'
            ? dateRangeText
            : ''
      const headerDetails = [
        headerDateText,
        pdfCustomization.header.advtNo ? `Advt. No: ${advtNo || '—'}` : '',
        centreCodeLine,
      ].filter(Boolean).join('\n')
      const dateDetailsLines = doc.splitTextToSize(headerDetails || ' ', fieldWidth)
      const projectVenueLines = doc.splitTextToSize(
        [projectLocationLabel, ...(projectCentreLabel ? [projectCentreLabel] : [])].join('\n'),
        fieldWidth
      )
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
          // place Records slightly below Generated (reduced vertical gap)
          doc.text(`Records: ${records.length}`, pageWidth - margin - 240, metaY + 10)
          doc.setFontSize(9)
          doc.setTextColor(235, 235, 235)
          doc.text('Project', firstColX, labelTopY)
          doc.text('Report details', secondColX, labelTopY)
          doc.text('Venue', thirdColX, labelTopY)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(255, 255, 255)
          drawTextLines(projectTitleLines, firstColX, firstValueY)
          drawTextLines(dateDetailsLines, secondColX, firstValueY)
          drawTextLines(projectVenueLines, thirdColX, firstValueY)
        }
      }

      const columns = ['S.No', ...activeColumns.map((column) => column.label)]

      const rowData = await buildRowsWithConcurrency(records, 25, (current, total) => {
        onProgress(current, total)
      })

      const designationOrder = { supervisor: 1, operator: 2 }
      rowData.sort((a, b) => {
        const designationIndex = activeColumns.findIndex((column) => column.key === 'designation') + 1
        const candidateIndex = activeColumns.findIndex((column) => column.key === 'candidate') + 1
        const da = String(designationIndex > 0 ? a[designationIndex] : '').trim().toLowerCase()
        const db = String(designationIndex > 0 ? b[designationIndex] : '').trim().toLowerCase()
        const oa = designationOrder[da] || 3
        const ob = designationOrder[db] || 3
        if (oa !== ob) return oa - ob
        return String(candidateIndex > 0 ? a[candidateIndex] : '').localeCompare(String(candidateIndex > 0 ? b[candidateIndex] : ''))
      })
      rowData.forEach((row, index) => {
        row[0] = index + 1
      })

      const tableWidth = Math.min(
        pageWidth - margin * 2,
        30 + activeColumns.reduce((sum, column) => sum + column.width, 0)
      )
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
          tableWidth: tableWidth,
          styles: {
            fontSize: 8,
            cellPadding: 5,
            overflow: 'linebreak',
            valign: 'middle',
            cellWidth: 'wrap',
            minCellHeight: 44,
            halign: 'left'
          },
          headStyles: {
            fillColor: [18, 97, 128],
            textColor: 255,
            fontStyle: 'bold'
          },
          alternateRowStyles: { fillColor: [247, 249, 251] },
          columnStyles: Object.fromEntries([
            [0, { cellWidth: 30 }],
            ...activeColumns.map((column, index) => [index + 1, { cellWidth: column.width, ...(column.key === 'checkInImage' ? { minCellHeight: 50 } : {}) }]),
          ]),
          theme: 'grid',
          showHead: 'everyPage',
          pageBreak: 'auto',
          rowPageBreak: 'avoid',
          didParseCell: (data) => {
            if (activeColumns[data.column.index - 1]?.key === 'checkInImage' && data.cell.raw && String(data.cell.raw).startsWith('data:image')) {
              data.cell.text = ['']
            }
          },
          didDrawCell: (data) => {
            if (activeColumns[data.column.index - 1]?.key === 'checkInImage' && data.cell.raw && String(data.cell.raw).startsWith('data:image')) {
              try {
                doc.addImage(String(data.cell.raw), 'PNG', data.cell.x + 2, data.cell.y + 4, 66, 44)
              } catch (e) {
                doc.setFontSize(7)
                doc.text('Image', data.cell.x + 10, data.cell.y + 24)
              }
            }
          }
        })
      }

      drawPageHeader(1)
      // increase first-page capacity by one row
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

    const recordsForExport = Array.isArray(recordsOverride) ? recordsOverride : null

    const filters = {
      search: search || undefined,
      projectId: selectedProject || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }
    if (isWrittenExam) {
      filters.districtId = selectedDistrictId || undefined
      if (selectedCentreId) filters.centreId = selectedCentreId
    } else {
      filters.locationId = selectedLocationId || undefined
      if (selectedCentreId) filters.centreId = selectedCentreId
    }

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
      updateLoadingToast(recordsForExport ? 'Preparing exported records...' : 'Fetching attendance records...')
      const allRecords = recordsForExport || await fetchAllExportRecords(filters)
      if (!allRecords || allRecords.length === 0) {
        await alert('No attendance records found for the selected filters.')
        return
      }
      updateLoadingToast({
        title: 'Records loaded',
        detail: `${allRecords.length} attendance records ${recordsForExport ? 'prepared' : 'fetched'}`,
        loaded: 0,
        total: 100,
        progress: 5
      })

      if (isWrittenExam) {
        if (!selectedDistrictId || recordsForExport) {
          const districtGroups = allRecords.reduce((acc, record) => {
            const key = getRecordDistrictKey(record)
            if (!acc[key]) {
              const districtName = key.split('||')[1]
              acc[key] = { districtName, records: [] }
            }
            acc[key].records.push(record)
            return acc
          }, {})

          const districtList = Object.values(districtGroups)
          if (districtList.length === 0) {
            await alert('No attendance records were found for export.')
            return
          }

          const centreGroups = districtList.reduce((acc, group) => {
            const groups = group.records.reduce((centres, record) => {
              const key = getRecordCentreKey(record)
              if (!centres[key]) {
                const centreName = key.split('||')[1]
                centres[key] = { centreName, centreCode: getRecordCentreCode(record), records: [] }
              }
              centres[key].records.push(record)
              return centres
            }, {})
            const centreList = Object.values(groups)
            centreList.forEach((centre) => {
              acc.push({
                districtName: group.districtName,
                centreName: centre.centreName,
                centreCode: centre.centreCode,
                records: centre.records
              })
            })
            return acc
          }, [])

          const totalGroups = centreGroups.length
          const zip = new JSZip()

          for (let i = 0; i < totalGroups; i += 1) {
            const group = centreGroups[i]
            const centreLabel = group.centreName || `centre-${i + 1}`
            const groupLabel = `${group.districtName} / ${centreLabel}`
            updateLoadingToast({
              title: 'Generating centre PDF',
              detail: `${groupLabel} (${i + 1}/${totalGroups})`,
              loaded: i,
              total: totalGroups,
            })
            const pdfBlob = await createPdfBlob(group.records, {
              districtName: group.districtName,
              centreName: centreLabel
            }, (current, total) => updateLoadingToast({
              title: 'Building rows',
              detail: `${groupLabel} — ${current}/${total} rows`,
              loaded: current,
              total,
              progress: (i + current / Math.max(1, total)) / totalGroups * 100
            }), {
              centreCodeOverride: group.centreCode || ''
            })
            const districtFolderName = sanitizeFilename(group.districtName || `district-${i + 1}`)
            const districtFolder = zip.folder(districtFolderName) || zip
            const codePrefix = group.centreCode ? `${sanitizeFilename(group.centreCode)}_` : ''
            const fileName = `${codePrefix}${sanitizeFilename(centreLabel)}_${exportDate}.pdf`
            districtFolder.file(fileName, pdfBlob)
          }

          updateLoadingToast({ title: 'Compressing ZIP', detail: 'Compressing all district PDFs...' })
          const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            updateLoadingToast({
              title: 'Compressing ZIP',
              detail: `Compression ${Math.round(metadata.percent)}%`,
              loaded: metadata.percent,
              total: 100,
              progress: metadata.percent
            })
          })
          saveAs(zipBlob, `attendance_all_districts_${exportDate}.zip`)
          return
        }

        if (!selectedCentreId || recordsForExport) {
          const grouped = allRecords.reduce((acc, record) => {
              const key = getRecordCentreKey(record)
              if (!acc[key]) {
                const centreName = key.split('||')[1]
                acc[key] = { centreName, centreCode: getRecordCentreCode(record), records: [] }
              }
              acc[key].records.push(record)
              return acc
            }, {})
          const centreGroups = Object.values(grouped)
          if (centreGroups.length === 0) {
            await alert('No centre attendance records were found for the selected district.')
            return
          }

          const totalGroups = centreGroups.length
          const zip = new JSZip()
          const districtFolderName = sanitizeFilename(selectedDistrictName || 'district')
          const districtFolder = zip.folder(districtFolderName) || zip

          for (let i = 0; i < totalGroups; i += 1) {
            const group = centreGroups[i]
            const centreLabel = group.centreName || 'centre'
            const groupLabel = `${selectedDistrictName || 'District'} / ${centreLabel}`
            updateLoadingToast({
              title: 'Generating centre PDF',
              detail: `${groupLabel} (${i + 1}/${totalGroups})`,
              loaded: i,
              total: totalGroups,
            })
            const pdfBlob = await createPdfBlob(group.records, {
              districtName: selectedDistrictName,
              centreName: centreLabel
            }, (current, total) => updateLoadingToast({
              title: 'Building rows',
              detail: `${groupLabel} — ${current}/${total} rows`,
              loaded: current,
              total,
              progress: (i + current / Math.max(1, total)) / totalGroups * 100
            }), {
              centreCodeOverride: group.centreCode || ''
            })
            const codePrefix = group.centreCode ? `${sanitizeFilename(group.centreCode)}_` : ''
            const fileName = `${codePrefix}${sanitizeFilename(centreLabel)}_${exportDate}.pdf`
            districtFolder.file(fileName, pdfBlob)
          }

          updateLoadingToast({ title: 'Compressing ZIP', detail: 'Compressing all centre PDFs...' })
          const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            updateLoadingToast({
              title: 'Compressing ZIP',
              detail: `Compression ${Math.round(metadata.percent)}%`,
              loaded: metadata.percent,
              total: 100,
              progress: metadata.percent
            })
          })
          saveAs(zipBlob, `attendance_${sanitizeFilename(selectedDistrictName || 'district')}_${exportDate}.zip`)
          return
        }

        const exportLabel = selectedCentreName || selectedDistrictName
        const pdfBlob = await createPdfBlob(allRecords, {
          districtName: selectedDistrictName,
          centreName: exportLabel
        }, (current, total) => updateLoadingToast({
          title: 'Building rows',
          detail: `${exportLabel} — ${current}/${total} rows`,
          loaded: current,
          total,
          progress: Math.min(100, Math.round((current / total) * 100))
        }))
        const pdfName = `attendance_${selectedCentreCode ? `${sanitizeFilename(selectedCentreCode)}_${sanitizeFilename(exportLabel || 'export')}` : sanitizeFilename(exportLabel || 'export')}_${exportDate}.pdf`
        saveAs(pdfBlob, pdfName)
        return
      }

      if (!selectedLocationId || recordsForExport) {
        const locationGroups = allRecords.reduce((acc, record) => {
          const key = getRecordLocationKey(record)
          if (!acc[key]) {
            const locationName = key.split('||')[1]
            acc[key] = { locationName, records: [] }
          }
          acc[key].records.push(record)
          return acc
        }, {})

        const locationList = Object.values(locationGroups)
        if (locationList.length === 0) {
          await alert('No attendance records were found for export.')
          return
        }

        const totalGroups = locationList.length
        const zip = new JSZip()
        for (let i = 0; i < totalGroups; i += 1) {
          const locationGroup = locationList[i]
          const locationFolderName = sanitizeFilename(locationGroup.locationName || `location-${i + 1}`)
          const locationFolder = zip.folder(locationFolderName) || zip
          const locationLabel = locationGroup.locationName || `location-${i + 1}`
          updateLoadingToast({
            title: 'Generating location PDF',
            detail: `${locationLabel} (${i + 1}/${totalGroups})`,
            loaded: i,
            total: totalGroups,
          })
          const pdfBlob = await createPdfBlob(locationGroup.records, {
            locationName: locationGroup.locationName
          }, (current, total) => updateLoadingToast({
            title: 'Building rows',
            detail: `${locationLabel} — ${current}/${total} rows`,
            loaded: current,
            total,
            progress: (i + current / Math.max(1, total)) / totalGroups * 100
          }))
          const fileName = `${sanitizeFilename(locationLabel)}_${exportDate}.pdf`
          locationFolder.file(fileName, pdfBlob)
        }

        updateLoadingToast({ title: 'Compressing ZIP', detail: 'Compressing all location PDFs...' })
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
          updateLoadingToast({
            title: 'Compressing ZIP',
            detail: `Compression ${Math.round(metadata.percent)}%`,
            loaded: metadata.percent,
            total: 100,
            progress: metadata.percent
          })
        })
        saveAs(zipBlob, `attendance_all_locations_${exportDate}.zip`)
        return
      }

      const exportLabel = selectedLocationName
      const pdfBlob = await createPdfBlob(allRecords, {
        locationName: exportLabel
      }, (current, total) => updateLoadingToast({
        title: 'Building rows',
        detail: `${exportLabel} — ${current}/${total} rows`,
        loaded: current,
        total,
        progress: Math.min(100, Math.round((current / total) * 100))
      }))
      const pdfName = `attendance_${sanitizeFilename(exportLabel || 'export')}${selectedCentreCode ? `_${sanitizeFilename(selectedCentreCode)}` : ''}_${exportDate}.pdf`
      saveAs(pdfBlob, pdfName)
    } finally {
      if (document.body.contains(loadingToast)) document.body.removeChild(loadingToast)
    }
  }

  const openModifiedPdfModal = () => {
    setModifiedPdfAdvtNo('')
    setModifiedPdfError('')
    setModifiedPdfClockInFallback('')
    setModifiedPdfClockOutFallback('')
    setIsModifiedPdfModalOpen(true)
    setIsDropdownOpen(false)
  }

  const handleModifiedPdfExport = async () => {
    const selectedData = selectedRows.size > 0
      ? attendance.filter((record) => selectedRows.has(record.attendance_id || record.id))
      : null
    const hasSelectedColumn = Object.values(modifiedPdfOptions.columns).some(Boolean)
    if (!hasSelectedColumn) {
      setModifiedPdfError('Select at least one table column.')
      return
    }

    setModifiedPdfError('')
    setIsModifiedPdfModalOpen(false)
    await exportToPDF(String(modifiedPdfAdvtNo || '').trim(), selectedData, {
      modifiedPdfOptions,
      clockInFallback: modifiedPdfClockInFallback.trim(),
      clockOutFallback: modifiedPdfClockOutFallback.trim(),
    })
  }

  const projectLocationName = isWrittenExam
    ? (districtOptions.find((d) => String(d.id) === String(selectedDistrictId)) || {}).name || (selectedDistrictId || 'All districts')
    : (locationOptions.find((l) => String(l.id) === String(selectedLocationId)) || {}).name || (selectedLocationId || 'All locations')
  const projectCentreName = (centreOptions.find((c) => String(c.id) === String(selectedCentreId)) || {}).name || (selectedCentreId || 'All centres')

  const rows = attendance.map((record) => {
    const checkInImage = record.check_in_image || record.checkin_image || record.checkInImage || record.check_in_photo || record.check_in_img || ''
    const checkOutImage = record.check_out_image || record.checkout_image || record.checkOutImage || record.check_out_photo || record.check_out_img || ''
    const projectLocationRaw = record.project_location || record.projectLocation || record.project
    const checkInLocationRaw = record.checkin_location || record.check_in || record.checkin
    const checkOutLocationRaw = record.checkout_location || record.check_out || record.checkout

    const projectLocation = getCoords({ project_location: projectLocationRaw }, 'project_location') || getCoords(record, 'project')
    const checkInLocation = getCoords({ checkin_location: checkInLocationRaw }, 'checkin_location') || getCoords(record, 'checkin')
    const checkOutLocation = getCoords({ checkout_location: checkOutLocationRaw }, 'checkout_location') || getCoords(record, 'checkout')

    const markers = []
    if (projectLocation) {
      markers.push({ ...projectLocation, label: 'Project location', type: 'project' })
    }
    if (checkInLocation) {
      markers.push({
        ...checkInLocation,
        label: 'Check-in location',
        type: 'checkin',
        distance_km: Number(checkInLocationRaw?.distance_km ?? checkInLocationRaw?.distance)
      })
    }
    if (checkOutLocation) {
      markers.push({
        ...checkOutLocation,
        label: 'Check-out location',
        type: 'checkout',
        distance_km: Number(checkOutLocationRaw?.distance_km ?? checkOutLocationRaw?.distance)
      })
    }
    const hasMapMarkers = markers.length > 0

    return [
      <input
        key={`checkbox-${record.id || record.attendance_id}`}
        type="checkbox"
        checked={selectedRows.has(record.attendance_id || record.id)}
        onChange={(e) => handleRowSelect(record.attendance_id || record.id, e.target.checked)}
      />,
      record.attendance_id || record.id || '—',
      record.date || '—',
      record.candidate_name || record.worker_name || record.worker || '—',
      formatAadhaar(record.aadhar || record.aadhaar || '' ) || '—',
      record.mobile || '—',
      isWrittenExam ? (record.district_name || record.district || '—') : (record.location_name || record.location || '—'),
      ...(isWrittenExam ? [record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || '—'] : []),
      record.clock_in || '—',
      record.clock_out || '—',
      <button
        key={`${record.id || record.attendance_id}-inimg-btn`}
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
        key={`${record.id || record.attendance_id}-outimg-btn`}
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
          key={`${record.id || record.attendance_id}-map-btn`}
          type="button"
          className="map-pin-btn"
          onClick={() => openMapModal(markers, record.location_name || record.location || record.project_name || 'Location')}
        >
          <FontAwesomeIcon icon={faMapMarkerAlt} />
        </button>
      ) : '—',
      <Tag key={`${record.id || record.attendance_id}-status`} variant={statusVariant(record.status)}>{record.status || 'Unknown'}</Tag>,
      <button
        key={`${record.id || record.attendance_id}-reject`}
        className="btn btn-danger btn-sm"
        style={{ padding: '4px 8px', fontSize: '11px' }}
        disabled={String(record.status).toLowerCase() === 'absent'}
        onClick={(e) => {
          e.stopPropagation()
          setRecordToReject(record)
          setRejectionComment('')
          setIsRejectModalOpen(true)
        }}
        title="Reject Attendance"
      >
        Reject
      </button>
    ]
  })

  return (
    <div className="recruiter-attendance-page">
      <PageHeader
          title={isWrittenExam ? 'Written Exam Attendance' : 'Recruiter Attendance'}
          subtitle={
            isWrittenExam
              ? `Centre-based attendance for written exam projects${projectTitle && projectTitle !== 'All projects' ? ` - ${projectTitle}` : ''}.`
              : projectTitle && projectTitle !== 'All projects'
                ? `Showing attendance for ${projectTitle}${selectedLocationId ? ` - ${projectLocationName}` : ''}${selectedCentreId ? ` - ${projectCentreName}` : ''}.`
                : 'Search and filter candidate attendance.'
          }
          action={
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() => openMembersModal()}
              >
                <FontAwesomeIcon icon={faUsers} /> View project members
              </button>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => setIsFraudModalOpen(true)}
              >
                <FontAwesomeIcon icon={faShieldAlt} /> Fraud Attendance
              </button>
              <button 
                className="btn btn-primary btn-sm" 
                type="button"
                onClick={() => setIsRejectedMembersModalOpen(true)}
              >
                <FontAwesomeIcon icon={faTimesCircle} /> View rejected members
              </button>
              <button 
                className="btn btn-primary btn-sm" 
                type="button" 
                onClick={() => navigate(`/app/recruiter/attendance/payment?id=${selectedProject}${selectedLocationId ? `&locationId=${selectedLocationId}` : ''}${selectedCentreId ? `&centreId=${selectedCentreId}` : ''}${projectType ? `&projectType=${projectType}` : ''}`, { 
                  state: { 
                    projectTitle: projectTitle === 'All projects' ? '...' : projectTitle,
                    startDate: projectDates.start,
                    endDate: projectDates.end,
                    projectType,
                  } 
                })}
              >
                <FontAwesomeIcon icon={faCalculator} /> Attendance Sheet
              </button>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate('/app/recruiter/attendance')}>
                Back to summary
              </button>
            </div>
          }
        />
      <Card className="attendancedata-card">
        <div className="projects-table-project-title">
          Project: <strong>{projectTitle || 'All projects'}</strong>
        </div>
        <div className="attendance-kpis-chart">
          <div className="attendance-kpis">
            <StatCard
              icon={<FontAwesomeIcon icon={faMapMarkerAlt} />}
              value={kpis.totalLocations}
              label={isWrittenExam ? "Total Districts" : "Total Locations"}
            />
          </div>
          <div className="attendance-chart">
            {isWrittenExam && selectedDistrictId && centreChartData.length > 0 ? (
              <CentresAttendanceChart data={centreChartData} />
            ) : (
              <AttendanceBarChart data={chartData} />
            )}
          </div>
        </div>
        <div className="projects-table-filters" style={{ alignItems: 'flex-start' }}>
          <div className="projects-table-filter-group search-group">
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Search by candidate, ID or project…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setOffset(0)
                }}
              />
            </div>
          </div>

          {isWrittenExam ? (
            <div className="projects-table-filter-group location-group">
              <div className="filter-label">District</div>
              <select
                className="form-control"
                value={selectedDistrictId}
                onFocus={() => fetchLocationOptions()}
                onMouseDown={() => fetchLocationOptions()}
                onChange={(e) => {
                  setSelectedDistrictId(e.target.value)
                  setSelectedCentreId('')
                  setOffset(0)
                }}
              >
                <option value="">All districts</option>
                {districtOptions.map((district) => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="projects-table-filter-group location-group">
              <div className="filter-label">Location</div>
              <select
                className="form-control"
                value={selectedLocationId}
                onFocus={() => fetchLocationOptions()}
                onMouseDown={() => fetchLocationOptions()}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value)
                  setSelectedCentreId('')
                  setOffset(0)
                }}
              >
                <option value="">All locations</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </div>
          )}

          {isWrittenExam && (
            <div className="projects-table-filter-group centre-group">
              <div className="filter-label">Centre</div>
              <select
                className="form-control"
                value={selectedCentreId}
                onFocus={() => fetchCentreOptions()}
                onMouseDown={() => fetchCentreOptions()}
                onChange={(e) => {
                  setSelectedCentreId(e.target.value)
                  setOffset(0)
                }}
                disabled={!selectedDistrictId}
              >
                <option value="">All centres</option>
                {centreOptions.map((centre) => (
                  <option key={centre.id} value={centre.id}>{centre.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">From</div>
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

            <div className="export-buttons">
              <div className="custom-dropdown">
                <button 
                  className="btn btn-primary btn-sm dropdown-toggle" 
                  type="button" 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <FontAwesomeIcon icon={faDownload} /> Export
                  <FontAwesomeIcon icon={isDropdownOpen ? faChevronUp : faChevronDown} style={{ marginLeft: '4px' }} />
                </button>
                {isDropdownOpen && (
                  <ul className="dropdown-menu show">
                    <li>
                      <button className="dropdown-item" type="button" onClick={() => { exportToExcel(); setIsDropdownOpen(false); }}>
                        <FontAwesomeIcon icon={faFileExcel} /> Export as Excel
                      </button>
                    </li>
                    <li>
                      <button className="dropdown-item" type="button" onClick={() => { setPendingPdfExportTarget('main'); setExportAdvtNo(''); setExportAdvtNoError(''); setIsAdvtNoModalOpen(true); setIsDropdownOpen(false); }}>
                        <FontAwesomeIcon icon={faFilePdf} /> Export as PDF
                      </button>
                    </li>
                    <li>
                      <button className="dropdown-item" type="button" onClick={openModifiedPdfModal}>
                        <FontAwesomeIcon icon={faFilePdf} /> Export modified PDF
                      </button>
                    </li>
                    <li>
                      <button className="dropdown-item" type="button" onClick={() => { exportCheckInImagesZip(); setIsDropdownOpen(false); }}>
                        <FontAwesomeIcon icon={faFileArchive} /> Export check-in images as ZIP
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <button className="btn btn-outline btn-sm" type="button" onClick={clearAllFilters}>Clear filters</button>
          </div>
        </div>

        <div className="projects-table-wrap attendance-main-table" style={{ position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(255,255,255,0.82)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              borderRadius: 8
            }}>
              <div style={{ textAlign: 'center', color: '#111827', fontSize: 14, fontWeight: 600 }}>
                Loading attendance...
              </div>
            </div>
          )}
          <DataTable
            columns={[
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
                key="select-all"
              />,
              'ID', 'Date', 'Candidate', 'Aadhaar', 'Mobile', isWrittenExam ? 'District' : 'Location', ...(isWrittenExam ? ['Centre'] : []), 'Clock In', 'Clock Out', 'Check In Image', 'Check Out Image', 'Map', 'Status', 'Action'
            ]}
            rows={rows}
            emptyMessage={loading ? 'Loading attendance...' : 'No attendance records found.'}
          />
        </div>

        <div className="attendance-mobile-list">
          {loading ? (
            <div className="attendance-mobile-state">Loading attendance...</div>
          ) : attendance.length === 0 ? (
            <div className="attendance-mobile-state">No attendance records found.</div>
          ) : (
            <>
              <div className="attendance-mobile-selection-bar">
                <label className="attendance-mobile-select-all">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(event) => handleSelectAll(event.target.checked)}
                  />
                  Select all on this page
                </label>
                <span>{selectedRows.size} selected</span>
              </div>
              {attendance.map((record, index) => {
              const recordId = record.attendance_id || record.id || index
              const candidateName = record.candidate_name || record.worker_name || record.worker || 'Unknown candidate'
              const checkInImage = record.check_in_image || record.checkin_image || record.checkInImage || record.check_in_photo || record.check_in_img || ''
              const checkOutImage = record.check_out_image || record.checkout_image || record.checkOutImage || record.check_out_photo || record.check_out_img || ''
              const area = isWrittenExam
                ? (record.district_name || record.district || '—')
                : (record.location_name || record.location || '—')
              const centre = record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || ''
              const projectLocationRaw = record.project_location || record.projectLocation || record.project
              const checkInLocationRaw = record.checkin_location || record.check_in || record.checkin
              const checkOutLocationRaw = record.checkout_location || record.check_out || record.checkout
              const markers = []
              const projectLocation = getCoords({ project_location: projectLocationRaw }, 'project_location') || getCoords(record, 'project')
              const checkInLocation = getCoords({ checkin_location: checkInLocationRaw }, 'checkin_location') || getCoords(record, 'checkin')
              const checkOutLocation = getCoords({ checkout_location: checkOutLocationRaw }, 'checkout_location') || getCoords(record, 'checkout')
              if (projectLocation) markers.push({ ...projectLocation, label: 'Project location', type: 'project' })
              if (checkInLocation) markers.push({ ...checkInLocation, label: 'Check-in location', type: 'checkin' })
              if (checkOutLocation) markers.push({ ...checkOutLocation, label: 'Check-out location', type: 'checkout' })

              return (
                <article className="attendance-mobile-card" key={recordId}>
                  <div className="attendance-mobile-card-heading">
                    <div>
                      <strong>{candidateName}</strong>
                      <span>{record.mobile || record.phone || record.contact || 'No mobile number'}</span>
                    </div>
                    <label className="attendance-mobile-row-select">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(recordId)}
                        onChange={(event) => handleRowSelect(recordId, event.target.checked)}
                      />
                      <span>#{offset + index + 1}</span>
                    </label>
                  </div>
                  <div className="attendance-mobile-grid">
                    <div><span>ID</span><strong>{recordId}</strong></div>
                    <div><span>Date</span><strong>{record.date || '—'}</strong></div>
                    <div><span>{isWrittenExam ? 'District' : 'Location'}</span><strong>{area}</strong></div>
                    {isWrittenExam && <div><span>Centre</span><strong>{centre || '—'}</strong></div>}
                    <div><span>Clock in</span><strong>{record.clock_in || '—'}</strong></div>
                    <div><span>Clock out</span><strong>{record.clock_out || '—'}</strong></div>
                    <div><span>Aadhaar</span><strong>{formatAadhaar(record.aadhar || record.aadhaar || '')}</strong></div>
                  </div>
                  <div className="attendance-mobile-card-footer">
                    <Tag variant={statusVariant(record.status)}>{record.status || 'Unknown'}</Tag>
                    <div className="attendance-mobile-actions">
                      <button type="button" className="attendance-image-button attendance-mobile-image-button" onClick={() => openImageModal(checkInImage || NO_IMAGE_PLACEHOLDER, 'Check-in image', 'Check in')}>
                        <img src={checkInImage || NO_IMAGE_PLACEHOLDER} alt="Check in" className="attendance-image-thumb" style={{ opacity: checkInImage ? 1 : 0.5 }} />
                        <span>In</span>
                      </button>
                      <button type="button" className="attendance-image-button attendance-mobile-image-button" onClick={() => openImageModal(checkOutImage || NO_IMAGE_PLACEHOLDER, 'Check-out image', 'Check out')}>
                        <img src={checkOutImage || NO_IMAGE_PLACEHOLDER} alt="Check out" className="attendance-image-thumb" style={{ opacity: checkOutImage ? 1 : 0.5 }} />
                        <span>Out</span>
                      </button>
                      {markers.length > 0 && (
                        <button type="button" className="map-pin-btn" onClick={() => openMapModal(markers, area || candidateName)} title="View locations">
                          <FontAwesomeIcon icon={faMapMarkerAlt} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={String(record.status).toLowerCase() === 'absent'}
                        onClick={() => {
                          setRecordToReject(record)
                          setRejectionComment('')
                          setIsRejectModalOpen(true)
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </article>
              )
              })}
            </>
          )}
        </div>

        {/* Rejection Comment Modal */}
        <Modal
          isOpen={isAcceptModalOpen}
          onClose={() => {
            setIsAcceptModalOpen(false)
            setRecordToAccept(null)
          }}
          title="Confirm Accept Fraud Attendance"
          maxWidth="500px"
          zIndex={13000}
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ marginBottom: '16px', fontSize: '14px' }}>
              Approve fraud attendance for <strong>{recordToAccept ? getRecordCandidateName(recordToAccept) : ''}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" className="btn btn-outline" onClick={() => {
                setIsAcceptModalOpen(false)
                setRecordToAccept(null)
              }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleConfirmAccept}
                disabled={acceptingFraudAttendanceId === (recordToAccept?.attendance_id || recordToAccept?.id)}
              >
                {acceptingFraudAttendanceId === (recordToAccept?.attendance_id || recordToAccept?.id) ? 'Accepting…' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => {
            setIsRejectModalOpen(false)
            setRecordToReject(null)
            setRejectionComment('')
          }}
          title="Reject Attendance"
          maxWidth="500px"
          zIndex={13000}
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ marginBottom: '16px', fontSize: '14px' }}>
              Reason for rejecting attendance for <strong>{recordToReject?.candidate_name}</strong>:
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', display: 'block', marginBottom: '8px' }}>
                Quick Templates
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {REJECTION_TEMPLATES.map(template => (
                  <button
                    key={template}
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => setRejectionComment(template)}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="form-control"
              rows="4"
              placeholder="Enter rejection details or feedback..."
              value={rejectionComment}
              onChange={(e) => setRejectionComment(e.target.value)}
              style={{ fontSize: '14px' }}
            />
            
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" className="btn btn-outline" onClick={() => {
                setIsRejectModalOpen(false)
                setRecordToReject(null)
                setRejectionComment('')
              }}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleConfirmReject} 
                disabled={!rejectionComment.trim() || isRejectingFraudAttendance}
              >
                {isRejectingFraudAttendance ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Rejected Members Modal */}
        <Modal
          isOpen={isRejectedMembersModalOpen}
          onClose={() => setIsRejectedMembersModalOpen(false)}
          title={`Rejected Members${projectTitle ? ` — ${projectTitle}` : ''}`}
          maxWidth="1200px"
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div><strong>{rejectedMembersTotal}</strong> rejected records</div>
              {rejectedMembersLoading && <div style={{ color: 'var(--text3)' }}>Loading rejected list…</div>}
            </div>

            <div className="projects-table-filters" style={{ gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div className="projects-table-filter-group search-group" style={{ flex: '1 1 320px' }}>
                <div className="filter-search-box">
                  <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search by name, ID, phone…"
                    value={rejectedMembersSearch}
                    onChange={(e) => { setRejectedMembersSearch(e.target.value); setRejectedMembersOffset(0) }}
                  />
                </div>
              </div>

              {isWrittenExam ? (
                <div className="projects-table-filter-group location-group">
                  <div className="filter-label">District</div>
                  <select
                    className="form-control"
                    value={rejectedMembersDistrictId}
                    onChange={(e) => { setRejectedMembersDistrictId(e.target.value); setRejectedMembersCentreId(''); setRejectedMembersOffset(0) }}
                  >
                    <option value="">All districts</option>
                    {rejectedMembersDistrictOptions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="projects-table-filter-group location-group">
                  <div className="filter-label">Location</div>
                  <select
                    className="form-control"
                    value={rejectedMembersLocationId}
                    onChange={(e) => { setRejectedMembersLocationId(e.target.value); setRejectedMembersOffset(0) }}
                  >
                    <option value="">All locations</option>
                    {rejectedMembersLocationOptions.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {isWrittenExam && (
                <div className="projects-table-filter-group centre-group">
                  <div className="filter-label">Centre</div>
                  <select
                    className="form-control"
                    value={rejectedMembersCentreId}
                    onChange={(e) => { setRejectedMembersCentreId(e.target.value); setRejectedMembersOffset(0) }}
                    disabled={!rejectedMembersDistrictId}
                  >
                    <option value="">All centres</option>
                    {rejectedMembersCentreOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="projects-table-meta">
                <div className="entries-selector">
                  <label>Rows</label>
                  <select
                    className="form-control"
                    value={rejectedMembersLimit}
                    onChange={(e) => { setRejectedMembersLimit(Number(e.target.value)); setRejectedMembersOffset(0) }}
                  >
                    {LIMIT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s} entries</option>
                    ))}
                  </select>
                </div>
              </div>
              <button 
                className="btn btn-outline btn-sm" 
                type="button" 
                onClick={() => {
                  setRejectedMembersSearch('')
                  setRejectedMembersLocationId('')
                  setRejectedMembersDistrictId('')
                  setRejectedMembersCentreId('')
                  setRejectedMembersOffset(0)
                }}
              >
                Clear
              </button>
            </div>

          <div className="projects-table-wrap modal-desktop-table">
            <DataTable
              columns={[
                'ID',
                'Date',
                'Candidate',
                'Aadhaar',
                'Mobile',
                isWrittenExam ? 'District' : 'Location',
                ...(isWrittenExam ? ['Centre'] : []),
                'Clock In',
                'Clock Out',
                'Check In Image',
                'Check Out Image',
                'Map',
                'Reason',
                'Action',
              ]}
              rows={rejectedMembers.map((record) => {
                const checkInImage = record.check_in_image || record.checkin_image || record.checkInImage || record.check_in_photo || record.check_in_img || ''
                const checkOutImage = record.check_out_image || record.checkout_image || record.checkOutImage || record.check_out_photo || record.check_out_img || ''
                const projectLocationRaw = record.project_location || record.projectLocation || record.project
                const checkInLocationRaw = record.checkin_location || record.check_in || record.checkin
                const checkOutLocationRaw = record.checkout_location || record.check_out || record.checkout

                const projectLocation = getCoords({ project_location: projectLocationRaw }, 'project_location') || getCoords(record, 'project')
                const checkInLocation = getCoords({ checkin_location: checkInLocationRaw }, 'checkin_location') || getCoords(record, 'checkin')
                const checkOutLocation = getCoords({ checkout_location: checkOutLocationRaw }, 'checkout_location') || getCoords(record, 'checkout')

                const markers = []
                if (projectLocation) {
                  markers.push({ ...projectLocation, label: 'Project location', type: 'project' })
                }
                if (checkInLocation) {
                  markers.push({
                    ...checkInLocation,
                    label: 'Check-in location',
                    type: 'checkin',
                    distance_km: Number(checkInLocationRaw?.distance_km ?? checkInLocationRaw?.distance)
                  })
                }
                if (checkOutLocation) {
                  markers.push({
                    ...checkOutLocation,
                    label: 'Check-out location',
                    type: 'checkout',
                    distance_km: Number(checkOutLocationRaw?.distance_km ?? checkOutLocationRaw?.distance)
                  })
                }
                const hasMapMarkers = markers.length > 0

                return [
                  record.attendance_id || record.id || '—',
                  record.date || '—',
                  record.candidate_name || record.worker_name || record.worker || '—',
                  formatAadhaar(record.aadhar || record.aadhaar || '' ) || '—',
                  record.mobile || '—',
                  isWrittenExam ? (record.district_name || record.district || '—') : (record.location_name || record.location || '—'),
                  ...(isWrittenExam ? [record.centre_name || record.centre || record.centreName || record.center || record.center_name || record.centerName || '—'] : []),
                  record.clock_in || '—',
                  record.clock_out || '—',
                  <button key={`${record.id || record.attendance_id}-inimg-btn`} type="button" className="attendance-image-button" onClick={() => openImageModal(checkInImage || NO_IMAGE_PLACEHOLDER, 'Check-in image', 'Check in')}><img src={checkInImage || NO_IMAGE_PLACEHOLDER} alt="Check in" className="attendance-image-thumb attendance-image-clickable" style={{ opacity: checkInImage ? 1 : 0.5 }} /></button>,
                  <button key={`${record.id || record.attendance_id}-outimg-btn`} type="button" className="attendance-image-button" onClick={() => openImageModal(checkOutImage || NO_IMAGE_PLACEHOLDER, 'Check-out image', 'Check out')}><img src={checkOutImage || NO_IMAGE_PLACEHOLDER} alt="Check out" className="attendance-image-thumb attendance-image-clickable" style={{ opacity: checkOutImage ? 1 : 0.5 }} /></button>,
                  hasMapMarkers ? (<button key={`${record.id || record.attendance_id}-map-btn`} type="button" className="map-pin-btn" onClick={() => openMapModal(markers, record.location_name || record.location || record.project_name || 'Location')}><FontAwesomeIcon icon={faMapMarkerAlt} /></button>) : '—',
                  <span key={`reason-${record.id || record.attendance_id}`} style={{ color: 'var(--red)', fontSize: '12px' }}>{record.rejection_reason || record.reason || 'Not specified'}</span>,
                  <button
                    key={`accept-${record.id || record.attendance_id}`}
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={acceptingAttendanceId === (record.attendance_id || record.id)}
                    onClick={() => handleAcceptRejectedAttendance(record)}
                  >
                    {acceptingAttendanceId === (record.attendance_id || record.id) ? 'Accepting…' : 'Accept'}
                  </button>
              ]})}
              emptyMessage={rejectedMembersLoading ? 'Loading rejected members...' : 'No rejected members found for this project.'}
            />
          </div>

          <div className="attendance-modal-mobile-list">
            {rejectedMembersLoading ? <div className="attendance-mobile-state">Loading rejected members...</div> : rejectedMembers.length === 0 ? <div className="attendance-mobile-state">No rejected members found for this project.</div> : rejectedMembers.map((record) => {
              const recordId = record.attendance_id || record.id
              const checkInImage = record.check_in_image || record.checkin_image || record.checkInImage || record.check_in_photo || record.check_in_img || ''
              const checkOutImage = record.check_out_image || record.checkout_image || record.checkOutImage || record.check_out_photo || record.check_out_img || ''
              return (
                <article className="attendance-modal-card" key={recordId}>
                  <div className="attendance-modal-card-heading"><div><strong>{record.candidate_name || record.worker_name || record.worker || 'Unknown candidate'}</strong><span>{record.mobile || record.phone || 'No mobile number'}</span></div><span>#{recordId || '—'}</span></div>
                  <div className="attendance-modal-card-grid">
                    <div><span>Date</span><strong>{record.date || '—'}</strong></div>
                    <div><span>{isWrittenExam ? 'District' : 'Location'}</span><strong>{isWrittenExam ? (record.district_name || record.district || '—') : (record.location_name || record.location || '—')}</strong></div>
                    {isWrittenExam && <div><span>Centre</span><strong>{record.centre_name || record.centre || record.centreName || '—'}</strong></div>}
                    <div><span>Clock in</span><strong>{record.clock_in || '—'}</strong></div>
                    <div><span>Clock out</span><strong>{record.clock_out || '—'}</strong></div>
                    <div><span>Reason</span><strong className="attendance-modal-danger-text">{record.rejection_reason || record.reason || 'Not specified'}</strong></div>
                  </div>
                  <div className="attendance-modal-card-media">
                    {checkInImage && <button type="button" className="attendance-image-button" onClick={() => openImageModal(checkInImage, 'Check-in image', 'Check in')}><img src={checkInImage} alt="Check in" className="attendance-image-thumb" /><span>Check in</span></button>}
                    {checkOutImage && <button type="button" className="attendance-image-button" onClick={() => openImageModal(checkOutImage, 'Check-out image', 'Check out')}><img src={checkOutImage} alt="Check out" className="attendance-image-thumb" /><span>Check out</span></button>}
                  </div>
                  <div className="attendance-modal-card-actions"><button type="button" className="btn btn-success btn-sm" disabled={acceptingAttendanceId === recordId} onClick={() => handleAcceptRejectedAttendance(record)}>{acceptingAttendanceId === recordId ? 'Accepting...' : 'Accept'}</button></div>
                </article>
              )
            })}
          </div>

            <div className="projects-table-pagination" style={{ marginTop: 12 }}>
              <div className="pagination-summary">
                Showing {rejectedMembersTotal === 0 ? 0 : rejectedMembersOffset + 1}–{Math.min(rejectedMembersTotal, rejectedMembersOffset + rejectedMembersLimit)} of {rejectedMembersTotal} records
              </div>
              <div className="pagination-actions">
                <button
                  className="pagination-page-btn"
                  type="button"
                  disabled={rejectedMembersCurrentPage === 1}
                  onClick={() => setRejectedMembersOffset(Math.max(0, rejectedMembersOffset - rejectedMembersLimit))}
                >
                  Prev
                </button>
                <div className="pagination-pages">
                  {rejectedMembersPageStart > 1 && (
                    <>
                      <button className="pagination-page-btn" type="button" onClick={() => setRejectedMembersOffset(0)}>1</button>
                      {rejectedMembersPageStart > 2 && <span className="pagination-ellipsis">…</span>}
                    </>
                  )}
                  {rejectedMembersPageNumbers.map((page) => (
                    <button
                      key={page}
                      className={`pagination-page-btn${page === rejectedMembersCurrentPage ? ' active' : ''}`}
                      type="button"
                      onClick={() => setRejectedMembersOffset((page - 1) * rejectedMembersLimit)}
                    >
                      {page}
                    </button>
                  ))}
                  {rejectedMembersPageEnd < rejectedMembersTotalPages - 1 && <span className="pagination-ellipsis">…</span>}
                  {rejectedMembersPageEnd < rejectedMembersTotalPages && (
                    <button
                      className="pagination-page-btn"
                      type="button"
                      onClick={() => setRejectedMembersOffset((rejectedMembersTotalPages - 1) * rejectedMembersLimit)}
                    >
                      {rejectedMembersTotalPages}
                    </button>
                  )}
                </div>
                <button
                  className="pagination-page-btn"
                  type="button"
                  disabled={rejectedMembersCurrentPage === rejectedMembersTotalPages}
                  onClick={() => setRejectedMembersOffset(Math.min((rejectedMembersTotalPages - 1) * rejectedMembersLimit, rejectedMembersOffset + rejectedMembersLimit))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
            <button className="btn btn-outline" type="button" onClick={() => setIsRejectedMembersModalOpen(false)}>Close</button>
          </div>
        </Modal>

        <Modal
          isOpen={isFraudModalOpen}
          onClose={() => setIsFraudModalOpen(false)}
          title="Fraud Attendance"
          fullScreen
        >
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div><strong>{fraudTotal}</strong> fraud attendance records</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" type="button" onClick={exportFraudAttendanceToExcel}>
                  <FontAwesomeIcon icon={faFileExcel} /> Export Excel
                </button>
                <button className="btn btn-outline btn-sm" type="button" onClick={exportFraudAttendanceToPDF}>
                  <FontAwesomeIcon icon={faFilePdf} /> Export PDF
                </button>
                {fraudLoading && <div style={{ color: 'var(--text3)' }}>Loading fraud attendance…</div>}
              </div>
            </div>

            <div className="projects-table-filters" style={{ gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="projects-table-filter-group search-group" style={{ flex: '1 1 320px', minWidth: 280 }}>
                <div className="filter-search-box">
                  <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search fraudulent attendance by candidate, ID, phone…"
                    value={fraudSearch}
                    onChange={(e) => setFraudSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="projects-table-filter-group" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', flex: '1 1 420px', minWidth: 280 }}>
                {isWrittenExam ? (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 170 }}>
                    <label className="filter-label">District</label>
                    <select
                      className="form-control"
                      value={selectedDistrictId}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        setSelectedDistrictId(nextValue)
                        setSelectedCentreId('')
                        setFraudOffset(0)
                      }}
                    >
                      <option value="">All districts</option>
                      {districtOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 170 }}>
                    <label className="filter-label">Location</label>
                    <select
                      className="form-control"
                      value={selectedLocationId}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        setSelectedLocationId(nextValue)
                        setSelectedCentreId('')
                        setFraudOffset(0)
                      }}
                    >
                      <option value="">All locations</option>
                      {locationOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 170 }}>
                  <label className="filter-label">Centre</label>
                  <select
                    className="form-control"
                    value={selectedCentreId}
                    onChange={(e) => {
                      setSelectedCentreId(e.target.value)
                      setFraudOffset(0)
                    }}
                  >
                    <option value="">All centres</option>
                    {centreOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
                  <label className="filter-label">From</label>
                  <input
                    className="form-control"
                    type="date"
                    value={fraudFromDate}
                    onChange={(e) => setFraudFromDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 140 }}>
                  <label className="filter-label">To</label>
                  <input
                    className="form-control"
                    type="date"
                    value={fraudToDate}
                    onChange={(e) => setFraudToDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      setFraudOffset(0)
                      fetchFraudAttendanceRecords()
                    }}
                  >
                    Apply
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => {
                      setFraudFromDate('')
                      setFraudToDate('')
                      setFraudSearch('')
                      setSelectedLocationId('')
                      setSelectedDistrictId('')
                      setSelectedCentreId('')
                      setFraudOffset(0)
                      fetchFraudAttendanceRecords()
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="projects-table-meta">
                <div className="entries-selector">
                  <label>Rows</label>
                  <select
                    className="form-control"
                    value={fraudLimit}
                    onChange={(e) => { setFraudLimit(Number(e.target.value)); setFraudOffset(0); }}
                  >
                    {LIMIT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s} entries</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="projects-table-wrap modal-desktop-table" style={{ flex: '1 1 auto', minHeight: 0 }}>
              <DataTable
                columns={[
                  'ID',
                  'Date',
                  isWrittenExam ? 'District' : 'Location',
                  'Centre Code',
                  'Centre Name',
                  'Clock In',
                  'Clock Out',
                  'Candidate',
                  'Aadhaar',
                  'Mobile',
                  'Profile',
                  'Check In Image',
                  'Check Out Image',
                  'Map',
                  'Status',
                  'Action',
                ]}
                rows={fraudRecords.map((record) => {
                  const recordId = record.attendance_id || record.id
                  const projectLocation = getCoords({ project_location: record.project_location || record.projectLocation }, 'project_location') || getCoords(record, 'project')
                  const checkInLocation = getCoords({ checkin_location: record.checkin_location || record.checkInLocation }, 'checkin_location') || getCoords(record, 'checkin')
                  const checkOutLocation = getCoords({ checkout_location: record.checkout_location || record.checkOutLocation }, 'checkout_location') || getCoords(record, 'checkout')
                  const markers = []
                  if (projectLocation) markers.push({ ...projectLocation, label: 'Project location', type: 'project' })
                  if (checkInLocation) markers.push({ ...checkInLocation, label: 'Check-in location', type: 'checkin' })
                  if (checkOutLocation) markers.push({ ...checkOutLocation, label: 'Check-out location', type: 'checkout' })
                  const hasMapMarkers = markers.length > 0

                  return [
                    recordId,
                    record.date || record.day || record.attendance_date || '—',
                    isWrittenExam ? getRecordDistrictName(record) : (record.location_name || record.location || 'Unknown location'),
                    getRecordCentreCode(record),
                    getRecordCentreName(record),
                    record.check_in_time || record.clock_in || record.checkin_time || record.check_in || '—',
                    record.check_out_time || record.clock_out || record.checkout_time || record.check_out || '—',
                    getRecordCandidateName(record),
                    formatAadhaar(getRecordAadhaar(record)),
                    getRecordMobile(record),
                    getProfileImageUrl(record)
                      ? (
                        <button type="button" className="attendance-image-button" onClick={() => openImageModal(getProfileImageUrl(record), 'Profile Image', getRecordCandidateName(record))}>
                          <img
                            src={getProfileImageUrl(record)}
                            alt="Profile"
                            className="attendance-image-thumb attendance-image-clickable"
                            style={{ opacity: 1 }}
                          />
                        </button>
                      )
                      : '—',
                    getCheckInImageUrl(record)
                      ? (
                        <button type="button" className="attendance-image-button" onClick={() => openImageModal(getCheckInImageUrl(record), 'Check In Image', getRecordCandidateName(record))}>
                          <img
                            src={getCheckInImageUrl(record)}
                            alt="Check in"
                            className="attendance-image-thumb attendance-image-clickable"
                            style={{ opacity: 1 }}
                          />
                        </button>
                      )
                      : '—',
                    getCheckOutImageUrl(record)
                      ? (
                        <button type="button" className="attendance-image-button" onClick={() => openImageModal(getCheckOutImageUrl(record), 'Check Out Image', getRecordCandidateName(record))}>
                          <img
                            src={getCheckOutImageUrl(record)}
                            alt="Check out"
                            className="attendance-image-thumb attendance-image-clickable"
                            style={{ opacity: 1 }}
                          />
                        </button>
                      )
                      : '—',
                    hasMapMarkers
                      ? (<button type="button" className="map-pin-btn" onClick={() => openMapModal(markers, record.location_name || record.location || record.project_name || 'Location')}><FontAwesomeIcon icon={faMapMarkerAlt} /></button>)
                      : '—',
                    String(record.status || 'Unknown'),
                    (<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        disabled={acceptingFraudAttendanceId === recordId}
                        onClick={() => {
                          if (window.confirm('Approve this fraud attendance record?')) {
                            setRecordToAccept(record)
                            setIsAcceptModalOpen(true)
                          }
                        }}
                      >
                        {acceptingFraudAttendanceId === recordId ? 'Accepting…' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={isRejectingFraudAttendance === true}
                        onClick={() => {
                          setRecordToReject(record)
                          setRejectionComment('')
                          setIsRejectModalOpen(true)
                        }}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setCompareRecord(record)
                          setIsCompareModalOpen(true)
                        }}
                      >
                        Compare Images
                      </button>
                    </div>),
                  ]
                })}
                emptyMessage={fraudLoading ? 'Loading fraud attendance...' : 'No fraud attendance found.'}
              />
            </div>

            <div className="attendance-modal-mobile-list">
              {fraudLoading ? <div className="attendance-mobile-state">Loading fraud attendance...</div> : fraudRecords.length === 0 ? <div className="attendance-mobile-state">No fraud attendance found.</div> : fraudRecords.map((record) => {
                const recordId = record.attendance_id || record.id
                const profileImage = getProfileImageUrl(record)
                const checkInImage = getCheckInImageUrl(record)
                const checkOutImage = getCheckOutImageUrl(record)
                const markers = []
                const projectLocation = getCoords({ project_location: record.project_location || record.projectLocation }, 'project_location') || getCoords(record, 'project')
                const checkInLocation = getCoords({ checkin_location: record.checkin_location || record.checkInLocation }, 'checkin_location') || getCoords(record, 'checkin')
                const checkOutLocation = getCoords({ checkout_location: record.checkout_location || record.checkOutLocation }, 'checkout_location') || getCoords(record, 'checkout')
                if (projectLocation) markers.push({ ...projectLocation, label: 'Project location', type: 'project' })
                if (checkInLocation) markers.push({ ...checkInLocation, label: 'Check-in location', type: 'checkin' })
                if (checkOutLocation) markers.push({ ...checkOutLocation, label: 'Check-out location', type: 'checkout' })
                return (
                  <article className="attendance-modal-card" key={recordId}>
                    <div className="attendance-modal-card-heading"><div><strong>{getRecordCandidateName(record)}</strong><span>{getRecordMobile(record)}</span></div><span>#{recordId || '—'}</span></div>
                    <div className="attendance-modal-card-grid">
                      <div><span>Date</span><strong>{record.date || record.day || record.attendance_date || '—'}</strong></div>
                      <div><span>Status</span><strong>{record.status || 'Unknown'}</strong></div>
                      <div><span>{isWrittenExam ? 'District' : 'Location'}</span><strong>{isWrittenExam ? getRecordDistrictName(record) : (record.location_name || record.location || 'Unknown location')}</strong></div>
                      <div><span>Centre</span><strong>{getRecordCentreName(record)}</strong></div>
                      <div><span>Clock in</span><strong>{record.check_in_time || record.clock_in || record.checkin_time || record.check_in || '—'}</strong></div>
                      <div><span>Clock out</span><strong>{record.check_out_time || record.clock_out || record.checkout_time || record.check_out || '—'}</strong></div>
                    </div>
                    <div className="attendance-modal-card-media">
                      {profileImage && <button type="button" className="attendance-image-button" onClick={() => openImageModal(profileImage, 'Profile Image', getRecordCandidateName(record))}><img src={profileImage} alt="Profile" className="attendance-image-thumb" /><span>Profile</span></button>}
                      {checkInImage && <button type="button" className="attendance-image-button" onClick={() => openImageModal(checkInImage, 'Check In Image', getRecordCandidateName(record))}><img src={checkInImage} alt="Check in" className="attendance-image-thumb" /><span>Check in</span></button>}
                      {checkOutImage && <button type="button" className="attendance-image-button" onClick={() => openImageModal(checkOutImage, 'Check Out Image', getRecordCandidateName(record))}><img src={checkOutImage} alt="Check out" className="attendance-image-thumb" /><span>Check out</span></button>}
                      {markers.length > 0 && <button type="button" className="map-pin-btn" onClick={() => openMapModal(markers, getRecordCandidateName(record))} title="View locations"><FontAwesomeIcon icon={faMapMarkerAlt} /></button>}
                    </div>
                    <div className="attendance-modal-card-actions">
                      <button type="button" className="btn btn-success btn-sm" disabled={acceptingFraudAttendanceId === recordId} onClick={() => { setRecordToAccept(record); setIsAcceptModalOpen(true) }}>{acceptingFraudAttendanceId === recordId ? 'Accepting...' : 'Accept'}</button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={isRejectingFraudAttendance === true} onClick={() => { setRecordToReject(record); setRejectionComment(''); setIsRejectModalOpen(true) }}>Reject</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => { setCompareRecord(record); setIsCompareModalOpen(true) }}>Compare images</button>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="projects-table-pagination" style={{ marginTop: 12 }}>
              <div className="pagination-summary">
                Showing {fraudTotal === 0 ? 0 : fraudOffset + 1}–{Math.min(fraudTotal, fraudOffset + fraudLimit)} of {fraudTotal} records
              </div>
              <div className="pagination-actions">
                <button
                  className="pagination-page-btn"
                  type="button"
                  disabled={fraudCurrentPage === 1}
                  onClick={() => setFraudOffset(Math.max(0, fraudOffset - fraudLimit))}
                >
                  Prev
                </button>
                <div className="pagination-pages">
                  {fraudPageStart > 1 && (
                    <>
                      <button className="pagination-page-btn" type="button" onClick={() => setFraudOffset(0)}>1</button>
                      {fraudPageStart > 2 && <span className="pagination-ellipsis">…</span>}
                    </>
                  )}
                  {fraudPageNumbers.map((page) => (
                    <button
                      key={page}
                      className={`pagination-page-btn${page === fraudCurrentPage ? ' active' : ''}`}
                      type="button"
                      onClick={() => setFraudOffset((page - 1) * fraudLimit)}
                    >
                      {page}
                    </button>
                  ))}
                  {fraudPageEnd < fraudTotalPages - 1 && <span className="pagination-ellipsis">…</span>}
                  {fraudPageEnd < fraudTotalPages && (
                    <button
                      className="pagination-page-btn"
                      type="button"
                      onClick={() => setFraudOffset((fraudTotalPages - 1) * fraudLimit)}
                    >
                      {fraudTotalPages}
                    </button>
                  )}
                </div>
                <button
                  className="pagination-page-btn"
                  type="button"
                  disabled={fraudCurrentPage === fraudTotalPages}
                  onClick={() => setFraudOffset(Math.min((fraudTotalPages - 1) * fraudLimit, fraudOffset + fraudLimit))}
                >
                  Next
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
              <button className="btn btn-outline" type="button" onClick={() => setIsFraudModalOpen(false)}>
                Close
              </button>
            </div>
          </div>

          <Modal
            isOpen={isCompareModalOpen}
            onClose={() => {
              setIsCompareModalOpen(false)
              setCompareRecord(null)
            }}
            title="Compare Images"
            maxWidth="900px"
            zIndex={13000}
          >
            {compareRecord ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 320px', minWidth: 280 }}>
                    <div style={{ marginBottom: 8, fontWeight: 700 }}>Profile Image</div>
                    {getProfileImageUrl(compareRecord) ? (
                      <img
                        src={getProfileImageUrl(compareRecord)}
                        alt="Profile"
                        style={{ width: '100%', height: 'auto', borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-light)' }}
                      />
                    ) : (
                      <div style={{ width: '100%', minHeight: 220, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                        No profile image
                      </div>
                    )}
                  </div>
                  <div style={{ flex: '1 1 320px', minWidth: 280 }}>
                    <div style={{ marginBottom: 8, fontWeight: 700 }}>Check-in Image</div>
                    {getCheckInImageUrl(compareRecord) ? (
                      <img
                        src={getCheckInImageUrl(compareRecord)}
                        alt="Check in"
                        style={{ width: '100%', height: 'auto', borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border-light)' }}
                      />
                    ) : (
                      <div style={{ width: '100%', minHeight: 220, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                        No check-in image
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Candidate</div>
                    <div>{getRecordCandidateName(compareRecord)}</div>
                    <div style={{ marginTop: 6, color: 'var(--text3)' }}>Date: {compareRecord.date || compareRecord.day || compareRecord.attendance_date || 'N/A'}</div>
                    <div style={{ color: 'var(--text3)' }}>Centre: {getRecordCentreName(compareRecord)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={acceptingFraudAttendanceId === (compareRecord.attendance_id || compareRecord.id)}
                      onClick={() => {
                        setRecordToAccept(compareRecord)
                        setIsAcceptModalOpen(true)
                      }}
                    >
                      {acceptingFraudAttendanceId === (compareRecord.attendance_id || compareRecord.id) ? 'Accepting…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={isRejectingFraudAttendance === true}
                      onClick={() => {
                        setRecordToReject(compareRecord)
                        setRejectionComment('')
                        setIsRejectModalOpen(true)
                        setIsCompareModalOpen(false)
                      }}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setIsCompareModalOpen(false)
                        setCompareRecord(null)
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>No record selected for comparison.</div>
            )}
          </Modal>

        </Modal>

        <Modal
          isOpen={isSearchAttendanceModalOpen}
          onClose={() => setIsSearchAttendanceModalOpen(false)}
          title="Search Attendance"
          maxWidth="560px"
        >
          <div style={{ padding: '6px 0 4px' }}>
            <p style={{ marginBottom: 14, color: 'var(--text2)' }}>
              Upload a CSV file to search attendance and preview the matched records in a table with the same filter and export experience.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
              <div style={{ flex: '1 1 220px' }}>
                <label htmlFor="search-attendance-date" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
                  Date
                </label>
                <input
                  id="search-attendance-date"
                  className="form-control"
                  type="date"
                  value={searchAttendanceDate}
                  onChange={(event) => setSearchAttendanceDate(event.target.value)}
                />
              </div>
              <div style={{ flex: '1 1 320px' }}>
                <label htmlFor="search-attendance-file" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
                  CSV File
                </label>
                <input
                  id="search-attendance-file"
                  className="form-control"
                  type="file"
                  accept=".csv"
                  onChange={handleSearchAttendanceFileChange}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={downloadSearchAttendanceSample}
                >
                  Download sample CSV
                </button>
              </div>
            </div>
            {searchAttendanceFileName && (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)' }}>
                Selected file: <strong>{searchAttendanceFileName}</strong>
              </div>
            )}
            {searchAttendanceError && (
              <div style={{ marginTop: 12, color: '#d63333', fontSize: 13 }}>{searchAttendanceError}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" type="button" onClick={() => setIsSearchAttendanceModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={handleSearchAttendanceUpload} disabled={searchAttendanceLoading}>
                {searchAttendanceLoading ? 'Uploading...' : 'Upload & Search'}
              </button>
            </div>
          </div>
        </Modal>

        <MapModal
          isOpen={isMapOpen}
          onClose={closeMapModal}
          markers={mapLocation.markers}
          title={mapLocation.label}
        />
        <ImageModal
          isOpen={imagePreview.isOpen}
          onClose={closeImageModal}
          imageUrl={imagePreview.src}
          title={imagePreview.title}
          alt={imagePreview.alt}
        />

        <Modal
          isOpen={isModifiedPdfModalOpen}
          onClose={() => setIsModifiedPdfModalOpen(false)}
          title="Export modified PDF"
          maxWidth="620px"
          zIndex={12000}
        >
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 18, color: 'var(--text2)', fontSize: 14 }}>
              Choose the columns and header details for this PDF. The existing report layout and grouping will be preserved.
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="filter-label" style={{ marginBottom: 10 }}>Table columns</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                {[
                  ['date', 'Date'],
                  ['candidate', 'Candidate'],
                  ['aadhaar', 'Aadhaar'],
                  ['mobile', 'Mobile'],
                  ['designation', 'Designation'],
                  ['area', isWrittenExam ? 'District' : 'Location'],
                  ['centre', 'Centre'],
                  ['clockIn', 'Clock in'],
                  ['clockOut', 'Clock out'],
                  ['status', 'Status'],
                  ['checkInImage', 'Check-in image'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(modifiedPdfOptions.columns[key])}
                      onChange={(event) => setModifiedPdfOptions((current) => ({
                        ...current,
                        columns: { ...current.columns, [key]: event.target.checked },
                      }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="filter-label" style={{ marginBottom: 10 }}>Header details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                <div>
                  <label htmlFor="modified-pdf-header-date" style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text3)' }}>
                    Date in header
                  </label>
                  <select
                    id="modified-pdf-header-date"
                    className="form-control"
                    value={modifiedPdfOptions.header.dateMode || 'range'}
                    onChange={(event) => setModifiedPdfOptions((current) => ({
                      ...current,
                      header: { ...current.header, dateMode: event.target.value },
                    }))}
                  >
                    <option value="range">From and to date</option>
                    <option value="from">Only from date</option>
                    <option value="to">Only to date</option>
                    <option value="none">Hide date</option>
                  </select>
                </div>
                {[
                  ['advtNo', 'Advertisement number'],
                  ['centreCode', 'Centre code'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(modifiedPdfOptions.header[key])}
                      onChange={(event) => setModifiedPdfOptions((current) => ({
                        ...current,
                        header: { ...current.header, [key]: event.target.checked },
                      }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="filter-label" style={{ marginBottom: 10 }}>Missing time fallbacks</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
                <div>
                  <label htmlFor="modified-pdf-clock-in-fallback" style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text3)' }}>
                    Clock-in fallback
                  </label>
                  <input
                    id="modified-pdf-clock-in-fallback"
                    className="form-control"
                    value={modifiedPdfClockInFallback}
                    onChange={(event) => setModifiedPdfClockInFallback(event.target.value)}
                    placeholder="Optional, e.g. Not available"
                  />
                </div>
                <div>
                  <label htmlFor="modified-pdf-clock-out-fallback" style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text3)' }}>
                    Clock-out fallback
                  </label>
                  <input
                    id="modified-pdf-clock-out-fallback"
                    className="form-control"
                    value={modifiedPdfClockOutFallback}
                    onChange={(event) => setModifiedPdfClockOutFallback(event.target.value)}
                    placeholder="Optional, e.g. Completed"
                  />
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                An incomplete record is exported as Present when a clock-out fallback is provided.
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label htmlFor="modified-pdf-advt-no" className="filter-label" style={{ display: 'block', marginBottom: 6 }}>
                Advertisement number
              </label>
              <input
                id="modified-pdf-advt-no"
                className="form-control"
                value={modifiedPdfAdvtNo}
                onChange={(event) => setModifiedPdfAdvtNo(event.target.value)}
                placeholder="Optional"
              />
              {modifiedPdfError && <div style={{ marginTop: 8, color: '#d63333', fontSize: 12 }}>{modifiedPdfError}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button className="btn btn-outline" type="button" onClick={() => setIsModifiedPdfModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={handleModifiedPdfExport}>Export PDF</button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isAdvtNoModalOpen}
          onClose={() => setIsAdvtNoModalOpen(false)}
          title="Enter Advt. No."
          maxWidth="480px"
          zIndex={12000}
        >
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 14, fontSize: 14, color: 'var(--text2)' }}>
              Enter the advertisement number to include in the PDF export header.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="advt-no-input" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
                Advt. No.
              </label>
              <input
                id="advt-no-input"
                className="form-control"
                type="text"
                value={exportAdvtNo}
                onChange={(e) => {
                  setExportAdvtNo(e.target.value)
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
                  if (pendingPdfExportTarget === 'search') {
                    await exportSearchAttendanceResults('pdf', trimmed)
                  } else {
                    const selectedData = selectedRows.size > 0
                      ? attendance.filter(record => selectedRows.has(record.attendance_id || record.id))
                      : null
                    await exportToPDF(trimmed, selectedData)
                  }
                  setPendingPdfExportTarget('main')
                }}
              >
                Export PDF
              </button>
            </div>
          </div>
        </Modal>

        {/* Project Members Modal */}
        <Modal
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
          title={`Project Members${projectTitle ? ` — ${projectTitle}` : ''}`}
          maxWidth="1200px"
          footer={(
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" type="button" onClick={() => setIsMembersModalOpen(false)}>Close</button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setIsWhatsAppOpen(true)}
                disabled={selectedMembers.size === 0}
                style={{display: 'none'}}
              >
                Send WhatsApp
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setIsEmailOpen(true)}
                disabled={selectedMembers.size === 0}
                style={{display: 'none'}}
              >
                Send Email
              </button>
            </div>
          )}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div><strong>{membersTotal}</strong> members</div>
              {membersLoading && <div style={{ color: 'var(--text3)' }}>Loading members…</div>}
            </div>

              <div className="projects-table-filters" style={{ gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div className="projects-table-filter-group search-group" style={{ flex: '1 1 320px' }}>
                <div className="filter-search-box">
                  <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search members by name, ID, phone, email…"
                    value={membersSearch}
                    onChange={(e) => { setMembersSearch(e.target.value); setMembersOffset(0) }}
                  />
                </div>
              </div>

              {isWrittenExam ? (
                <div className="projects-table-filter-group location-group">
                  <div className="filter-label">District</div>
                  <select
                    className="form-control"
                    value={membersDistrict}
                    onFocus={() => fetchLocationOptions()}
                    onMouseDown={() => fetchLocationOptions()}
                    onChange={(e) => { setMembersDistrict(e.target.value); setMembersCentre(''); setMembersOffset(0) }}
                  >
                    <option value="">All districts</option>
                    {districtOptions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="projects-table-filter-group location-group">
                  <div className="filter-label">Location</div>
                  <select
                    className="form-control"
                    value={membersDistrict}
                    onFocus={() => fetchLocationOptions()}
                    onMouseDown={() => fetchLocationOptions()}
                    onChange={(e) => { setMembersDistrict(e.target.value); setMembersCentre(''); setMembersOffset(0) }}
                  >
                    <option value="">All locations</option>
                    {locationOptions.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {isWrittenExam && (
                <div className="projects-table-filter-group centre-group">
                  <div className="filter-label">Centre</div>
                  <select
                    className="form-control"
                    value={membersCentre}
                    onFocus={() => fetchCentreOptions(selectedProject, membersDistrict)}
                    onMouseDown={() => fetchCentreOptions(selectedProject, membersDistrict)}
                    onChange={(e) => { setMembersCentre(e.target.value); setMembersOffset(0) }}
                    disabled={!membersDistrict}
                  >
                    <option value="">All centres</option>
                    {centreOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="projects-table-meta">
                <div className="entries-selector">
                  <label>Rows</label>
                  <select
                    className="form-control"
                    value={membersLimit}
                    onChange={(e) => { setMembersLimit(Number(e.target.value)); setMembersOffset(0) }}
                  >
                    {[10, 20, 50, 100].map((s) => (
                      <option key={s} value={s}>{s} entries</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-desktop-table">
            <DataTable
              columns={[
                <input type="checkbox" checked={membersSelectAll} onChange={(e) => handleMembersSelectAll(e.target.checked)} key="members-select-all" />,
                'ID', 'Name', 'Aadhaar', 'WhatsApp', 'Email', ...(isWrittenExam ? ['District', 'Centre', 'Action'] : ['Location'])
              ]}
              rows={projectMembers.map((m, idx) => {
                const id = getMemberId(m) || `m-${idx}`
                const name = m.name || m.fullName || m.candidate_name || m.worker || '—'
                const rawAadhaar = m.aadhar || m.aadhaar || m.aadhaarNumber || m.aadhaar_no || m.aadharNumber || ''
                const aadhaar = rawAadhaar ? formatAadhaar(rawAadhaar) : '—'
                const phone = extractPhone(m) || '—'
                const email = extractEmail(m) || '—'
                const district = m.district || m.district_name || m.districtName || m.location_district || '—'
                const centre = m.centre || m.centre_name || m.centreName || m.center || m.center_name || '—'
                const locationName = m.location || m.city || m.current_location || '—'

                const attendanceCopyButton = (
                  <button
                    key={`copy-link-${id}`}
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={async () => {
                      const projectId = selectedProject || ''
                      const candidateId = id || ''
                      const baseLink = `${window.location.origin}${window.location.pathname.replace(/\/?$/, '')}/#/attendance?id=${encodeURIComponent(projectId)}`
                      const attendanceLink = isWrittenExam
                        ? `${baseLink}&candidate_id=${encodeURIComponent(candidateId)}`
                        : baseLink
                      try {
                        await navigator.clipboard.writeText(attendanceLink)
                        await alert('Attendance link copied to clipboard')
                      } catch (err) {
                        window.prompt('Copy this attendance link:', attendanceLink)
                      }
                    }}
                  >
                    Copy link
                  </button>
                )

                return [
                  <input
                    key={`member-chk-${id}`}
                    type="checkbox"
                    checked={selectedMembers.has(id)}
                    onChange={(e) => handleMemberRowSelect(id, e.target.checked)}
                  />,
                  id,
                  name,
                  aadhaar,
                  phone,
                  email,
                  ...(isWrittenExam ? [district, centre, attendanceCopyButton] : [locationName])
                ]
              })}
              emptyMessage={membersLoading ? 'Loading members…' : 'No members found.'}
            />
            </div>

            <div className="attendance-modal-mobile-list">
              {membersLoading ? <div className="attendance-mobile-state">Loading members...</div> : projectMembers.length === 0 ? <div className="attendance-mobile-state">No members found.</div> : projectMembers.map((member, idx) => {
                const id = getMemberId(member) || `m-${idx}`
                const name = member.name || member.fullName || member.candidate_name || member.worker || '—'
                const rawAadhaar = member.aadhar || member.aadhaar || member.aadhaarNumber || member.aadhaar_no || member.aadharNumber || ''
                const area = isWrittenExam ? (member.district || member.district_name || member.districtName || '—') : (member.location || member.city || member.current_location || '—')
                const centre = member.centre || member.centre_name || member.centreName || member.center || member.center_name || '—'
                return (
                  <article className="attendance-modal-card" key={id}>
                    <div className="attendance-modal-card-heading"><label className="attendance-modal-member-select"><input type="checkbox" checked={selectedMembers.has(id)} onChange={(event) => handleMemberRowSelect(id, event.target.checked)} /><strong>{name}</strong></label><span>#{idx + 1}</span></div>
                    <div className="attendance-modal-card-grid">
                      <div><span>ID</span><strong>{id}</strong></div>
                      <div><span>Aadhaar</span><strong>{rawAadhaar ? formatAadhaar(rawAadhaar) : '—'}</strong></div>
                      <div><span>WhatsApp</span><strong>{extractPhone(member) || '—'}</strong></div>
                      <div><span>Email</span><strong>{extractEmail(member) || '—'}</strong></div>
                      <div><span>{isWrittenExam ? 'District' : 'Location'}</span><strong>{area}</strong></div>
                      {isWrittenExam && <div><span>Centre</span><strong>{centre}</strong></div>}
                    </div>
                    {isWrittenExam && <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
                      const baseLink = `${window.location.origin}${window.location.pathname.replace(/\/?$/, '')}/#/attendance?id=${encodeURIComponent(selectedProject || '')}`
                      const attendanceLink = `${baseLink}&candidate_id=${encodeURIComponent(id)}`
                      try { await navigator.clipboard.writeText(attendanceLink); await alert('Attendance link copied to clipboard') } catch { window.prompt('Copy this attendance link:', attendanceLink) }
                    }}>Copy link</button>}
                  </article>
                )
              })}
            </div>

            <div className="projects-table-pagination" style={{ marginTop: 12 }}>
              <div className="pagination-summary">
                Showing {membersTotal === 0 ? 0 : membersOffset + 1}–{Math.min(membersTotal, membersOffset + membersLimit)} of {membersTotal} records
              </div>
              <div className="pagination-actions">
                <button
                  className="pagination-page-btn"
                  type="button"
                  disabled={membersCurrentPage === 1}
                  onClick={() => setMembersOffset(Math.max(0, membersOffset - membersLimit))}
                >
                  Prev
                </button>
                <div className="pagination-pages">
                  {membersPageStart > 1 && (
                    <>
                      <button className="pagination-page-btn" type="button" onClick={() => setMembersOffset(0)}>1</button>
                      {membersPageStart > 2 && <span className="pagination-ellipsis">…</span>}
                    </>
                  )}
                  {membersPageNumbers.map((page) => (
                    <button
                      key={page}
                      className={`pagination-page-btn${page === membersCurrentPage ? ' active' : ''}`}
                      type="button"
                      onClick={() => setMembersOffset((page - 1) * membersLimit)}
                    >
                      {page}
                    </button>
                  ))}
                  {membersPageEnd < membersTotalPages - 1 && <span className="pagination-ellipsis">…</span>}
                  {membersPageEnd < membersTotalPages && (
                    <button
                      className="pagination-page-btn"
                      type="button"
                      onClick={() => setMembersOffset((membersTotalPages - 1) * membersLimit)}
                    >
                      {membersTotalPages}
                    </button>
                  )}
                </div>
                <button
                  className="pagination-page-btn"
                  type="button"
                  disabled={membersCurrentPage === membersTotalPages}
                  onClick={() => setMembersOffset(Math.min((membersTotalPages - 1) * membersLimit, membersOffset + membersLimit))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </Modal>

        {/* Offcanvas messengers */}
        <WhatsAppMessenger
          isOpen={isWhatsAppOpen}
          recipients={projectMembers.filter(m => selectedMembers.has(getMemberId(m))).map(m => ({ phone: extractPhone(m), name: m.name || m.candidate_name }))}
          recipientPhone={(projectMembers.find(m => selectedMembers.has(getMemberId(m))) && extractPhone(projectMembers.find(m => selectedMembers.has(getMemberId(m))))) || ''}
          recipientId={(projectMembers.find(m => selectedMembers.has(getMemberId(m))) && getMemberId(projectMembers.find(m => selectedMembers.has(getMemberId(m))))) || ''}
          onClose={() => setIsWhatsAppOpen(false)}
          onSend={handleSendWhatsApp}
        />

        <EmailMessenger
          isOpen={isEmailOpen}
          recipients={projectMembers.filter(m => selectedMembers.has(getMemberId(m))).map(m => ({ email: extractEmail(m), name: m.name || m.candidate_name }))}
          recipientEmail={(projectMembers.find(m => selectedMembers.has(getMemberId(m))) && extractEmail(projectMembers.find(m => selectedMembers.has(getMemberId(m))))) || ''}
          onClose={() => setIsEmailOpen(false)}
          onSend={handleSendEmail}
        />

        <Modal
          isOpen={isSearchAttendanceResultsModalOpen}
          onClose={() => setIsSearchAttendanceResultsModalOpen(false)}
          title={`CSV Search Results${searchAttendanceProjectName ? ` — ${searchAttendanceProjectName}` : ''}`}
          maxWidth="1200px"
        >
          <div style={{ paddingTop: 4 }}>
            <div style={{ marginBottom: 12, color: 'var(--text2)' }}>
              Showing matched attendance records from the uploaded CSV.
            </div>
            <div className="projects-table-filters" style={{ alignItems: 'flex-start' }}>
              <div className="projects-table-filter-group search-group">
                <div className="filter-search-box">
                  <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search uploaded attendance…"
                    value={searchAttendanceSearch}
                    onChange={(e) => {
                      setSearchAttendanceSearch(e.target.value)
                      setSearchAttendanceOffset(0)
                    }}
                  />
                </div>
              </div>

              <div className="projects-table-meta">
                <div className="entries-selector">
                  <label>Rows</label>
                  <select
                    className="form-control"
                    value={searchAttendanceLimit}
                    onChange={(e) => {
                      setSearchAttendanceLimit(Number(e.target.value))
                      setSearchAttendanceOffset(0)
                    }}
                  >
                    {LIMIT_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value} entries</option>
                    ))}
                  </select>
                </div>
                <div className="export-buttons">
                  <div className="custom-dropdown">
                    <button className="btn btn-primary btn-sm dropdown-toggle" type="button" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                      <FontAwesomeIcon icon={faDownload} /> Export
                      <FontAwesomeIcon icon={isDropdownOpen ? faChevronUp : faChevronDown} style={{ marginLeft: '4px' }} />
                    </button>
                    {isDropdownOpen && (
                      <ul className="dropdown-menu show">
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => exportSearchAttendanceResults('excel')}>
                            <FontAwesomeIcon icon={faFileExcel} /> Export as Excel
                          </button>
                        </li>
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => { setPendingPdfExportTarget('search'); setExportAdvtNo(''); setExportAdvtNoError(''); setIsAdvtNoModalOpen(true); setIsDropdownOpen(false); }}>
                            <FontAwesomeIcon icon={faFilePdf} /> Export as PDF
                          </button>
                        </li>
                        <li>
                          <button className="dropdown-item" type="button" onClick={() => exportSearchAttendanceResults('zip')}>
                            <FontAwesomeIcon icon={faFileArchive} /> Export images as ZIP
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="projects-table-wrap">
              <DataTable
                columns={[
                  <input type="checkbox" checked={false} disabled key="search-results-select-all" />,
                  'ID',
                  'Date',
                  'Candidate',
                  'Aadhaar',
                  'Mobile',
                  isWrittenExam ? 'District' : 'Location',
                  ...(isWrittenExam ? ['Centre'] : []),
                  'Clock In',
                  'Clock Out',
                  'Check In Image',
                  'Check Out Image',
                  'Map',
                  'Status',
                  'Action'
                ]}
                rows={pagedSearchAttendanceRecords.map((record) => {
                  const checkInImage = record.check_in_image || record.checkin_image || record.checkInImage || record.check_in_photo || record.check_in_img || ''
                  const checkOutImage = record.check_out_image || record.checkout_image || record.checkOutImage || record.check_out_photo || record.check_out_img || ''
                  const hasMapMarkers = Boolean(getCoords(record, 'project') || getCoords(record, 'checkin') || getCoords(record, 'checkout'))

                  return [
                    <input type="checkbox" checked={false} disabled key={`search-result-checkbox-${record?.attendance_id || record?.id || Math.random()}`} />,
                    record?.attendance_id || record?.id || '—',
                    record?.date || '—',
                    record?.candidate_name || '—',
                    formatAadhaar(record?.aadhar || record?.aadhaar || '') || '—',
                    record?.mobile || '—',
                    isWrittenExam ? getSearchAttendanceDistrictValue(record) : getSearchAttendanceLocationValue(record),
                    ...(isWrittenExam ? [getSearchAttendanceCentreValue(record)] : []),
                    record?.clock_in || '—',
                    record?.clock_out || '—',
                    <button
                      key={`search-check-in-${record?.attendance_id || record?.id || Math.random()}`}
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
                      key={`search-check-out-${record?.attendance_id || record?.id || Math.random()}`}
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
                        key={`search-map-${record?.attendance_id || record?.id || Math.random()}`}
                        type="button"
                        className="map-pin-btn"
                        onClick={() => openMapModal([], record?.candidate_name || 'Location')}
                      >
                        <FontAwesomeIcon icon={faMapMarkerAlt} />
                      </button>
                    ) : '—',
                    <Tag key={`search-status-${record?.attendance_id || record?.id || Math.random()}`} variant={statusVariant(record?.status)}>{record?.status || 'Unknown'}</Tag>,
                    <button
                      key={`search-action-${record?.attendance_id || record?.id || Math.random()}`}
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={() => openImageModal(checkInImage || NO_IMAGE_PLACEHOLDER, 'Search record', 'Search record')}
                    >
                      View
                    </button>
                  ]
                })}
                emptyMessage={searchAttendanceLoading ? 'Loading uploaded attendance...' : 'No uploaded attendance records found.'}
              />
            </div>

            <div className="projects-table-pagination" style={{ marginTop: 12 }}>
              <div className="pagination-summary">
                Showing {filteredSearchAttendanceRecords.length === 0 ? 0 : searchAttendanceOffset + 1}–{Math.min(filteredSearchAttendanceRecords.length, searchAttendanceOffset + searchAttendanceLimit)} of {filteredSearchAttendanceRecords.length} records
              </div>
              <div className="pagination-actions">
                <button className="pagination-page-btn" type="button" disabled={searchAttendanceCurrentPage === 1} onClick={() => setSearchAttendanceOffset(Math.max(0, searchAttendanceOffset - searchAttendanceLimit))}>Prev</button>
                <div className="pagination-pages">
                  {searchAttendancePageStart > 1 && (
                    <>
                      <button className="pagination-page-btn" type="button" onClick={() => setSearchAttendanceOffset(0)}>1</button>
                      {searchAttendancePageStart > 2 && <span className="pagination-ellipsis">…</span>}
                    </>
                  )}
                  {searchAttendancePageNumbers.map((page) => (
                    <button key={page} className={`pagination-page-btn${page === searchAttendanceCurrentPage ? ' active' : ''}`} type="button" onClick={() => setSearchAttendanceOffset((page - 1) * searchAttendanceLimit)}>{page}</button>
                  ))}
                  {searchAttendancePageEnd < searchAttendanceTotalPages - 1 && <span className="pagination-ellipsis">…</span>}
                  {searchAttendancePageEnd < searchAttendanceTotalPages && (
                    <button className="pagination-page-btn" type="button" onClick={() => setSearchAttendanceOffset((searchAttendanceTotalPages - 1) * searchAttendanceLimit)}>{searchAttendanceTotalPages}</button>
                  )}
                </div>
                <button className="pagination-page-btn" type="button" disabled={searchAttendanceCurrentPage === searchAttendanceTotalPages} onClick={() => setSearchAttendanceOffset(Math.min((searchAttendanceTotalPages - 1) * searchAttendanceLimit, searchAttendanceOffset + searchAttendanceLimit))}>Next</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
              <button className="btn btn-outline" type="button" onClick={() => setIsSearchAttendanceResultsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>

        <div className="projects-table-pagination">
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
                <button
                  className="pagination-page-btn"
                  type="button"
                  onClick={() => setOffset((totalPages - 1) * limit)}
                >
                  {totalPages}
                </button>
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
    </div>
  )
}
