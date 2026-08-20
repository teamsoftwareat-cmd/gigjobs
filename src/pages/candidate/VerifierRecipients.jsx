import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { PageHeader, Card, CardHeader, DataTable, Tag, Modal, Avatar } from '../../components/ui/index'
import './VerifierRecipients.css'
import { candidateAPI, recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { useAuth } from '../../context/AuthContext'

const predayChecklistTemplate = [
  { id: 'preday-1', label: "Confirm all operators are ready for tomorrow's exam" },
  { id: 'preday-2', label: 'Check for any dropouts / absentee staff (mention remarks)', hasRemarks: true },
  { id: 'preday-3', label: 'Have you visited centre and met principal and explained biometric process' },
  { id: 'preday-4', label: 'All tablets are fully charged' },
  { id: 'preday-5', label: 'Tables & chairs arranged at venue' },
  { id: 'preday-6', label: 'Wi-Fi & CCTV camera installation completed' },
  { id: 'preday-7', label: 'Candidate data downloaded (Morning & Evening shifts)' },
  { id: 'preday-8', label: 'Operator kits ready (Tablet + Biometric device + Accessories)' },
  { id: 'preday-9', label: 'ID Cards & Jackets available for all staff' },
  { id: 'preday-10', label: 'Recee certificate filled and signature of principle done' },
  { id: 'preday-11', label: 'Check if extra inventory required (mention remarks)', hasRemarks: true },
  { id: 'preday-12', label: 'Have you informed all staff to reported by 6:00 AM Sharp' },
]

const examChecklistTemplate = [
  { id: 'exam-1', label: 'All operators reached the venue' },
  { id: 'exam-2', label: 'Attendance marked for all staff' },
  { id: 'exam-3', label: 'Tablets fully charged' },
  { id: 'exam-4', label: 'Chargers / power banks carried' },
  { id: 'exam-5', label: 'Devices functioning properly' },
  { id: 'exam-6', label: 'Staff wearing ID cards' },
  { id: 'exam-7', label: 'Staff wearing jackets/uniform' },
  { id: 'exam-8', label: 'Tables & chairs arranged properly' },
  { id: 'exam-9', label: 'Biometric devices connected and working' },
  { id: 'exam-10', label: 'WiFi cameras installed and turned ON' },
  { id: 'exam-11', label: 'System ready for candidate verification' },
  { id: 'exam-12', label: 'MORNING SHIFT BIOMETRIC का पूरा DATA SYNC (12PM PM TAK)' },
  { id: 'exam-13', label: 'MORNING SHIFT BIOMETRIC ATTENDANCE COUNT (SCHOOL COUNT)' },
  { id: 'exam-14', label: 'MORNING SHIFT परीक्षा के बाद COMPLETION CERTIFICATE पर PRINCIPAL से COUNT लिखवा कर SIGN जरूर कराना है।' },
  { id: 'exam-15', label: 'AFTERNOON SHIFT BIOMETRIC का पूरा DATA SYNC (12PM PM TAK)' },
  { id: 'exam-16', label: 'AFTERNOON SHIFT BIOMETRIC ATTENDANCE COUNT (SCHOOL COUNT)' },
  { id: 'exam-17', label: 'AFTERNOON SHIFT परीक्षा के बाद COMPLETION CERTIFICATE पर PRINCIPAL से COUNT लिखवा कर SIGN जरूर कराना है।' },
  { id: 'exam-18', label: 'सेंटर छोड़ने से सभी किट (All tabs and Inventory) अपने लोकेशन हेड को कंट्रोल रूम में जमा करा दें या नहीं।' },
]

export default function VerifierRecipients({ initialState, registrationIdOverride, useRecruiterApi = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  // Use override if provided, otherwise use route params/state, otherwise use user context
  const registrationId = registrationIdOverride || user?.registrationId
  const state = initialState || location.state || {}
  const title = state.title || 'Verifier Assignment'
  const title_id = state.title_id || state.titleId
  const venue = state.venue || 'Venue'
  const projectId = state.projectId || title_id
  const api = useRecruiterApi ? recruiterAPI : candidateAPI
  const handleBackToVenues = () => {
    if (!initialState && projectId) {
      // Only navigate if not in modal mode
      navigate(`/app/candidate/verifier/projects/${projectId}`, {
        state: {
          title,
          titleId: projectId,
          title_id: projectId,
          day: projectDay,
        },
      })
      return
    }
    if (!initialState) {
      navigate('/app/candidate/verifier')
    }
  }
  const normalizeDay = (raw) => {
    const value = String(raw || '').trim().toLowerCase()
    if (value.includes('exam')) return 'exam'
    if (value.includes('pre') || value.includes('preday')) return 'preday'
    if (value.includes('other') || value.includes('others')) return 'other'
    return 'preday'
  }
  const initialDay = normalizeDay(state.day || state.projectDay || 'preday')
  const [projectDay, setProjectDay] = useState(initialDay)
  const isExamDay = projectDay === 'exam'
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [callInProgress, setCallInProgress] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(projectDay === 'preday' ? 1 : 10)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [centresList, setCentresList] = useState([])
  const [selectedCentre, setSelectedCentre] = useState('')
  const [pageInput, setPageInput] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [statusSelection, setStatusSelection] = useState('')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [statusNotes, setStatusNotes] = useState('')
  const [modalRecipient, setModalRecipient] = useState(null)
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [replaceRecipient, setReplaceRecipient] = useState(null)
  const [replaceForm, setReplaceForm] = useState({ name: '', mobile: '', aadhaar: '' })
  const [replaceInProgress, setReplaceInProgress] = useState(false)
  const [showChecklistModal, setShowChecklistModal] = useState(false)
  const [checklistRecipient, setChecklistRecipient] = useState(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [checklistInProgress, setChecklistInProgress] = useState(false)
  const [checklistItems, setChecklistItems] = useState([])
  const [showSchoolAttendanceModal, setShowSchoolAttendanceModal] = useState(false)
  const [schoolAttendanceRows, setSchoolAttendanceRows] = useState([])
  const [schoolAttendanceLoading, setSchoolAttendanceLoading] = useState(false)
  const [schoolAttendanceSaving, setSchoolAttendanceSaving] = useState(false)
  const [showIssueStatusModal, setShowIssueStatusModal] = useState(false)
  const [issueStatusSelection, setIssueStatusSelection] = useState('')
  const [issueStatusNotes, setIssueStatusNotes] = useState('')
  const [issueStatusInProgress, setIssueStatusInProgress] = useState(false)
  const [designationFilter, setDesignationFilter] = useState('')
  const [designationOptions, setDesignationOptions] = useState([])
  const getIsCompactView = () => {
    if (typeof window === 'undefined') return false
    const isPortrait = window.matchMedia('(orientation: portrait)').matches
    return window.innerWidth <= 680 || (window.innerWidth <= 1024 && isPortrait)
  }
  const [isMobileView, setIsMobileView] = useState(getIsCompactView)
  const prevCountRef = useRef(0)
  const pendingIndexRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const loadMoreSentinelRef = useRef(null)

  const { alert } = useAlert()

  // Recipients are loaded from the API via fetchRecipients

  const isDataAadharVerificationTitle = useMemo(() => {
    const rawTitle = String(title || '').trim().toLowerCase()
    return rawTitle.includes('data aadhar verification') || rawTitle.includes('data aadhaar verification')
  }, [title])

  const checklistTemplate = projectDay === 'exam' ? examChecklistTemplate : predayChecklistTemplate

  const inferRecipientDay = (recipient) => normalizeDay(recipient?.day || recipient?.projectDay || 'preday')

  const getEffectiveDay = (recipient) => {
    const normalizedProjectDay = normalizeDay(projectDay)
    if (normalizedProjectDay === 'exam') return 'exam'
    if (normalizedProjectDay === 'other') return 'other'
    const recipientDay = inferRecipientDay(recipient)
    return recipientDay
  }

  const canShowChecklistButton = (recipient) => {
    if (!recipient) return false
    const designation = String(getDesignation(recipient) || '').toLowerCase()
    const isSupervisor = designation.includes('supervisor')
    const day = getEffectiveDay(recipient)
    if (day === 'other') return false
    return day === 'exam' || (day === 'preday' && isSupervisor)
  }

  const canShowReachedButton = (recipient) => {
    if (!recipient) return false
    return getEffectiveDay(recipient) !== 'other'
  }

  const normalizeChecklistBoolean = (value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return ['1', 'true', 'yes', 'y', 'checked', 'on'].includes(normalized)
    }
    return false
  }

  const extractChecklistItems = (payload) => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.items)) return payload.items
    if (Array.isArray(payload?.checklist)) return payload.checklist
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.data?.items)) return payload.data.items
    if (Array.isArray(payload?.data?.checklist)) return payload.data.checklist
    if (payload?.data && typeof payload.data === 'object') {
      return extractChecklistItems(payload.data)
    }
    return []
  }

  const mergeChecklistItems = (serverItems, template) => {
    const normalized = Array.isArray(serverItems) ? serverItems : []
    return (template || checklistTemplate).map((t) => {
      const serverMatch = normalized.find((item) => String(item.id || item.key || item.label).toLowerCase() === String(t.id || t.key || t.label).toLowerCase())
      return {
        ...t,
        checked: normalizeChecklistBoolean(serverMatch?.checked ?? serverMatch?.isChecked ?? serverMatch?.is_checked ?? serverMatch?.value),
        note: serverMatch?.note || serverMatch?.remarks || serverMatch?.remark || '',
      }
    })
  }

  const resolveDay = (recipient) => {
    if (!recipient) return projectDay
    return getEffectiveDay(recipient)
  }

  const getTemplateForDay = (day) => {
    const normalizedDay = normalizeDay(day)
    return normalizedDay === 'exam' ? examChecklistTemplate : predayChecklistTemplate
  }

  const getCentreKey = (recipient) => {
    const fromRecipient = recipient?.centreCode || recipient?.centre_code || recipient?.centerCode || recipient?.code || recipient?.centre || recipient?.centreName || recipient?.location || recipient?.locationName || ''
    return String(fromRecipient || selectedCentre || '').trim()
  }

  const openChecklistModal = async (recipient) => {
    if (!recipient) return
    setChecklistRecipient(recipient)
    setChecklistLoading(true)
    setShowChecklistModal(true)
    const day = getEffectiveDay(recipient)
    const template = getTemplateForDay(day)
    setChecklistItems(template.map((item) => ({ ...item, checked: false, note: '' })))

    const centreKey = getCentreKey(recipient)
    if (!centreKey) {
      alert('Unable to load checklist: centre info missing.')
      setChecklistLoading(false)
      return
    }

    try {
      const response = await api.getVerifierChecklist(title_id, venue, centreKey)
      const serverData = response?.data
      const serverItems = extractChecklistItems(serverData)
      setChecklistItems(mergeChecklistItems(serverItems, template))
    } catch (err) {
      console.error('Failed to load checklist', err)
      alert('Could not load previous checklist values. Showing defaults.')
      setChecklistItems(template.map((item) => ({ ...item, checked: false, note: '' })))
    } finally {
      setChecklistLoading(false)
    }
  }

  const fetchDesignations = useCallback(() => {
    // Static designations
    setDesignationOptions(['Supervisor', 'Operator'])
  }, [])

  const fetchCentres = useCallback(async () => {
    if (!registrationId || !title_id || !venue) return
    try {
      const resp = await api.getVerifierCenters(title_id, venue)
      const rawData = resp?.data || {}
      const items = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData.items)
          ? rawData.items
          : Array.isArray(rawData.data)
            ? rawData.data
            : []
      const normalizedCentres = items.map((centre) => ({
        id: centre.id || centre.centreCode || centre.code || centre.name,
        centre: centre.centre || centre.name || centre.centreName || centre.location || '',
        centreCode: centre.centreCode || centre.code || centre.id || '',
        name: centre.name || centre.centre || centre.centreName || centre.location || '',
      }))
      setCentresList(normalizedCentres)
    } catch (err) {
      console.error('Failed to fetch centres', err)
      alert('Could not load centres list.')
    }
  }, [registrationId, title_id, venue])

  const updateChecklistItem = (itemId, updates) => {
    setChecklistItems((prev) => prev.map((item) => item.id === itemId ? { ...item, ...updates } : item))
  }

  const normalizeAttendanceValue = (value) => {
    if (value === undefined || value === null || value === '') return ''
    const digits = String(value).replace(/[^0-9]/g, '')
    return digits
  }

  const mergeAttendanceRows = (centres = [], savedRows = []) => {
    const normalizedSavedRows = Array.isArray(savedRows) ? savedRows : []
    return (centres || []).map((centre, index) => {
      const centreCode = String(centre.centreCode || centre.code || centre.id || '').trim()
      const centreName = String(centre.centre || centre.name || centre.centreName || centre.location || '').trim()
      const savedMatch = normalizedSavedRows.find((row) => {
        const rowCode = String(row.centre_code || row.centreCode || row.centre_id || row.centreId || row.code || '').trim()
        const rowName = String(row.centre_name || row.centreName || row.name || row.centre || row.location || '').trim()
        return (centreCode && rowCode && centreCode === rowCode) || (centreName && rowName && centreName === rowName)
      })

      return {
        id: centre.id || centreCode || centreName || String(index),
        centreCode,
        centreName,
        allocated: normalizeAttendanceValue(savedMatch?.allocated ?? savedMatch?.allocated_count ?? savedMatch?.allocatedCount ?? ''),
        shift1Count: normalizeAttendanceValue(savedMatch?.shift1Count ?? savedMatch?.shift1_count ?? savedMatch?.shift_1_count ?? ''),
        shift2Count: normalizeAttendanceValue(savedMatch?.shift2Count ?? savedMatch?.shift2_count ?? savedMatch?.shift_2_count ?? ''),
      }
    })
  }

  const openSchoolAttendanceModal = async () => {
    setShowSchoolAttendanceModal(true)
    setSchoolAttendanceLoading(true)
    const defaultRows = mergeAttendanceRows(centresList, [])
    setSchoolAttendanceRows(defaultRows)

    if (!title_id || !venue) {
      alert('Unable to load school attendance: missing title or venue.')
      setSchoolAttendanceLoading(false)
      return
    }

    try {
      const response = await api.getVerifierSchoolAttendance(title_id, venue)
      const rawData = response?.data
      let savedRows = []
      if (Array.isArray(rawData)) {
        savedRows = rawData
      } else if (Array.isArray(rawData.items)) {
        savedRows = rawData.items
      } else if (Array.isArray(rawData.data)) {
        savedRows = rawData.data
      }
      setSchoolAttendanceRows(mergeAttendanceRows(centresList, savedRows))
    } catch (err) {
      console.error('Failed to load school attendance', err)
      alert('Could not load saved school attendance. Showing default rows.')
      setSchoolAttendanceRows(defaultRows)
    } finally {
      setSchoolAttendanceLoading(false)
    }
  }

  const updateSchoolAttendanceRow = (rowId, field, value) => {
    setSchoolAttendanceRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: normalizeAttendanceValue(value) } : row)))
  }

  const submitSchoolAttendance = async () => {
    setSchoolAttendanceSaving(true)
    try {
      const payload = {
        registration_id: registrationId,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        school_attendance: schoolAttendanceRows.map((row) => ({
          centre_code: row.centreCode,
          centre_name: row.centreName,
          allocated: row.allocated === '' ? null : Number(row.allocated),
          shift_1_count: row.shift1Count === '' ? null : Number(row.shift1Count),
          shift_2_count: row.shift2Count === '' ? null : Number(row.shift2Count),
        })),
      }
      await api.saveVerifierSchoolAttendance(title_id, venue, payload)
      alert('School attendance saved successfully.')
      setShowSchoolAttendanceModal(false)
    } catch (err) {
      console.error('Failed to save school attendance', err)
      alert('Failed to save school attendance. Please try again.')
    } finally {
      setSchoolAttendanceSaving(false)
    }
  }

  const submitChecklistModal = async () => {
    if (!checklistRecipient) return
    const centreKey = getCentreKey(checklistRecipient)
    if (!centreKey) {
      alert('Unable to save checklist: centre info missing.')
      return
    }
    setChecklistInProgress(true)
    try {
      const payload = {
        registration_id: registrationId,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
        designation: getDesignation(checklistRecipient),
        checklist: checklistItems.map(({ id, label, checked, note }) => ({ id, label, checked, note })),
      }
      await api.saveVerifierChecklist(title_id, venue, centreKey, payload)
      alert('Checklist saved successfully.')
      setShowChecklistModal(false)
      setChecklistRecipient(null)
    } catch (err) {
      console.error('Failed to save checklist', err)
      alert('Failed to save checklist. Please try again.')
    } finally {
      setChecklistInProgress(false)
    }
  }

  const getIssueStatusOptions = () => [
    { value: 'gate_not_opened', label: 'Gate Not Opened' },
    { value: 'no_one_reported', label: 'No one Reported' },
    { value: 'principal_not_allowing', label: 'Principal not allowing' },
    { value: 'videographer_not_reported', label: 'Videographer not reported' },
    { value: 'kit_not_received', label: 'Kit not received' },
    { value: 'tab_not_working', label: 'Tab Not Working' },
    { value: 'camera_not_working', label: 'Camera not working' },
  ]

  const openIssueStatusModal = (recipient) => {
    if (!recipient) return
    setModalRecipient(recipient)
    setIssueStatusSelection('')
    setIssueStatusNotes('')
    setShowIssueStatusModal(true)
  }

  const submitIssueStatusModal = async () => {
    if (!modalRecipient) return
    if (!issueStatusSelection) {
      alert('Please select an issue status')
      return
    }
    const recipientId = getRecipientId(modalRecipient)
    if (!recipientId) {
      alert('Recipient id missing')
      return
    }
    setIssueStatusInProgress(true)
    try {
      const centreKey = getCentreKey(modalRecipient)
      const payload = {
        registration_id: registrationId,
        recipient_id: recipientId,
        issue_status: issueStatusSelection,
        notes: issueStatusNotes || undefined,
        day: projectDay,
        project_day: projectDay,
        ...(centreKey ? { centre_id: centreKey, centre_code: centreKey } : {}),
      }
      await api.postVerifierIssueStatus(title_id, venue, payload)
      alert('Issue status updated successfully.')
      setShowIssueStatusModal(false)
      setIssueStatusSelection('')
      setIssueStatusNotes('')
      fetchRecipients()
    } catch (err) {
      console.error('Failed to save issue status', err)
      alert('Failed to save issue status. Please try again.')
    } finally {
      setIssueStatusInProgress(false)
    }
  }

  const fetchRecipients = useCallback(async () => {
    if (!registrationId) return

    const isExamDay = projectDay === 'exam'
    const isNextPage = page > 1 && isExamDay

    if (page === 1) {
      setRecipients([])
      setHasMore(true)
      setLoading(true)
    } else if (isNextPage) {
      setLoadingMore(true)
    }

    try {
      const offset = (page - 1) * pageSize
      const params = {
        offset,
        limit: pageSize,
        search: (search || '').trim(),
      }
      if (selectedCentre) params.centre = selectedCentre
      if (designationFilter) params.designation = designationFilter

      // Expecting an API that returns items + total (or similar shapes)
      const resp = await api.getVerifierRecipients(registrationId, title_id, venue, params)
      const data = resp?.data || {}

      // Support common response shapes
      let items = []
      let totalCount = 0

      if (Array.isArray(data)) {
        items = data
        totalCount = data.length
      } else if (Array.isArray(data.items)) {
        items = data.items
        totalCount = Number(data.total || data.count || items.length)
      } else if (Array.isArray(data.recipients)) {
        items = data.recipients
        totalCount = Number(data.total || data.count || items.length)
      } else if (Array.isArray(data.data)) {
        items = data.data
        totalCount = Number(data.total || data.count || items.length)
      }

      // Normalize mapping to the fields we consume in the UI
      const normalized = items.map((r) => ({
        id: r.id || r.recipientId || r.recipient_id,
        recipientId: r.id || r.recipientId || r.recipient_id,
        kyc_id: r.kyc_id || r.kycId || r.kyc_id || '',
        kycId: r.kyc_id || r.kycId || r.kyc_id || '',
        name: r.name || r.fullName || r.full_name || r.candidateName,
        fullName: r.name || r.fullName || r.full_name || r.candidateName,
        mobile: r.mobile || r.phone || r.phoneNumber || r.mobileNumber,
        aadhaar: r.aadhaar || r.aadhaarNumber || r.aadhaar_no,
        designation: r.designation || r.role || r.designationName || r.jobRole,
        status: r.status || r.call_status || r.verification_status,
        notes: r.notes || r.note || r.remarks || r.remark || r.comment || r.comments || r.notesText || '',
        note: r.notes || r.note || r.remarks || r.remark || r.comment || r.comments || r.notesText || '',
        centre: r.centre || r.centreName || r.location || r.locationName,
        centreCode: r.centreCode || r.centre_code || r.centerCode || r.code,
        day: r.day || r.projectDay,
        replaced: Boolean(
          r.replaced === true ||
          r.replaced === 1 ||
          r.replaced === 'true' ||
          r.replaced === '1' ||
          r.replaced === 'yes' ||
          r.isReplaced === true ||
          r.is_replaced === true ||
          r.replacedFlag === true ||
          r.replaced_flag === true
        ),
        raw: r,
      }))

      const parsedTotal = Number(totalCount || normalized.length)
      const hasMoreItems = parsedTotal > page * pageSize || normalized.length === pageSize

      setRecipients((prev) => {
        if (page === 1 || !isExamDay) return normalized
        return [...prev, ...normalized]
      })
      setTotal(parsedTotal)
      setHasMore(Boolean(hasMoreItems))

      if (!isExamDay) {
        const prevCount = prevCountRef.current || 0
        if (pendingIndexRef.current !== null) {
          const targetIndex = pendingIndexRef.current === 'LAST'
            ? Math.max(0, normalized.length - 1)
            : pendingIndexRef.current
          setCurrentIndex(targetIndex)
          pendingIndexRef.current = null
        } else {
          setCurrentIndex((cur) => {
            if (!normalized || normalized.length === 0) return 0
            if (prevCount === 0 && normalized.length > 0) return 0
            if (cur >= normalized.length) return Math.max(0, normalized.length - 1)
            return cur
          })
        }
        prevCountRef.current = normalized.length
      } else {
        setCurrentIndex(0)
      }
    } catch (err) {
      console.error('Failed to load recipients from API:', err)
      if (page === 1) {
        setRecipients([])
      }
      setTotal(0)
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [registrationId, designationFilter, page, pageSize, search, selectedCentre, title_id, venue, projectDay])

  useEffect(() => {
    fetchRecipients()
  }, [fetchRecipients])

  useEffect(() => {
    if (projectDay !== 'exam') return undefined

    const sentinel = loadMoreSentinelRef.current
    if (!sentinel || loading || loadingMore || !hasMore) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          setPage((prev) => prev + 1)
        }
      },
      { root: null, rootMargin: '220px 0px', threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [projectDay, loading, loadingMore, hasMore])

  useEffect(() => {
    setCurrentIndex(0)
  }, [designationFilter])

  useEffect(() => {
    fetchDesignations()
  }, [fetchDesignations])

  useEffect(() => {
    fetchCentres()
  }, [fetchCentres])

  const handleMakeCall = async (recipient) => {
    const recipientId = recipient.id || recipient.recipientId || recipient.recipient_id
    const recipientName = recipient.name || recipient.fullName || recipient.full_name || recipient.candidateName || 'Recipient'
    const mobile = recipient.phone || recipient.mobile || recipient.phoneNumber || recipient.mobileNumber || ''

    if (!recipientId) {
      alert('Unable to start call: recipient ID not found.')
      return
    }
    if (!mobile) {
      alert('Unable to start call: recipient mobile number not found.')
      return
    }

    setCallInProgress(recipientId)
    try {
      const callPayload = {
        recipientId,
        name: recipientName,
        mobile,
        title_id,
        venue,
        timestamp: new Date().toISOString(),
        status: 'initiated'
      }

      await api.makeVerifierCall(registrationId, recipientId, callPayload)
      alert('Call initiated successfully.')
      fetchRecipients()

      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile) {
        setTimeout(() => { window.location.href = `tel:${mobile}` }, 200)
      }
    } catch (err) {
      console.error('Failed to make call:', err)
      alert('Failed to initiate call. Please try again.')
    } finally {
      setCallInProgress(null)
    }
  }

  const maskAadhaar = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    if (digits.length < 4) return value || '-'
    if (digits.length === 12) {
      return `**** **** ${digits.slice(8)}`
    }
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
  }

  const maskMobile = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    if (digits.length < 4) return value || '-'
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}*****${digits.slice(8)}`
    }
    return `${digits.slice(0, 2)}${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`
  }

  const getDesignation = (recipient) => {
    if (!recipient) return '-'
    return recipient.designation || recipient.role || recipient.designationName || recipient.jobRole || recipient?.raw?.designation || recipient?.raw?.role || recipient?.raw?.designationName || recipient?.raw?.jobRole || '-'
  }

  const getRecipientKycId = (recipient) => {
    if (!recipient) return ''
    return recipient?.kyc_id ?? recipient?.kycId ?? recipient?.raw?.kyc_id ?? recipient?.raw?.kycId ?? ''
  }

  const getRecipientKycLink = (recipient) => {
    const kycId = getRecipientKycId(recipient)
    if (kycId === '' || kycId === null || kycId === undefined) return ''
    return `https://cynosurejobs.net/gigjobs/#/attendance/kycverify?candidateid=${kycId}`
  }

  const copyRecipientKycLink = async (recipient) => {
    const link = getRecipientKycLink(recipient)
    if (!link) {
      alert('KYC ID is not available for this recipient.')
      return
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
        alert('Verification link copied to clipboard.')
        return
      }

      const textArea = document.createElement('textarea')
      textArea.value = link
      textArea.setAttribute('readonly', '')
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Verification link copied to clipboard.')
    } catch (err) {
      console.error('Failed to copy KYC verification link', err)
      alert('Unable to copy verification link. Please try again.')
    }
  }

  const filteredRecipients = useMemo(() => recipients, [recipients])

  const getRecipientId = (recipient) => recipient?.id || recipient?.recipientId || recipient?.recipient_id || ''

  const exportChecklistToExcel = (recipient, items) => {
    if (!recipient || !Array.isArray(items)) return
    const day = getEffectiveDay(recipient)
    const fileName = `Checklist-${day}-${recipient.name || recipient.fullName || 'recipient'}.xlsx`.replace(/\s+/g, '_')
    const rows = [
      ['S.No', 'Checklist Item', 'Checked', 'Remarks'],
      ...items.map((item, index) => [
        index + 1,
        item.label || '',
        item.checked ? 'Yes' : 'No',
        item.note || '',
      ]),
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Checklist')
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const exportChecklistToPdf = (recipient, items) => {
    if (!recipient || !Array.isArray(items)) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
    const day = getEffectiveDay(recipient)
    const title = day === 'exam' ? 'Exam Day Checklist' : 'Control Room Checklist Pre Exam'
    const subTitle = recipient.name || recipient.fullName || 'Recipient'
    const headerY = 40
    doc.setFontSize(16)
    doc.text(title, 40, headerY)
    doc.setFontSize(11)
    doc.text(`Recipient: ${subTitle}`, 40, headerY + 20)
    doc.text(`Designation: ${getDesignation(recipient)}`, 40, headerY + 36)

    const tableRows = items.map((item, index) => [
      index + 1,
      item.label || '',
      item.checked ? 'Yes' : 'No',
      item.note || '',
    ])

    autoTable(doc, {
      startY: headerY + 52,
      head: [['S.No', 'Checklist Item', 'Checked', 'Remarks']],
      body: tableRows,
      styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
      headStyles: { fillColor: [240, 240, 240], textColor: 20, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 250 },
        2: { cellWidth: 50, halign: 'center' },
        3: { cellWidth: 180 },
      },
      theme: 'grid',
      didDrawPage: (data) => {
        doc.setFontSize(9)
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, doc.internal.pageSize.getHeight() - 20)
      }
    })

    const fileName = `Checklist-${day}-${recipient.name || recipient.fullName || 'recipient'}.pdf`.replace(/\s+/g, '_')
    doc.save(fileName)
  }

  const getStatusVariant = (status) => {
    const normalized = String(status || '').toLowerCase()
    if (['interested', 'reached', 'recce completed', 'recce_completed', 'recce completed'].includes(normalized)) return 'green'
    if (['replaced', 'drop out', 'drop_out', 'dropped', 'not reachable', 'not_reachable', 'centre entry not allowed', 'videographer list not received'].includes(normalized)) return 'red'
    return 'yellow'
  }

  const getStatusOptions = (recipient) => {
    if (projectDay === 'exam') {
      return [
        { value: 'reached', label: 'Reached' },
        { value: 'dropped', label: 'Dropped' },
        { value: 'on_the_way', label: 'On the Way' },
        { value: 'not_reachable', label: 'Not Reachable' },
        { value: 'replaced', label: 'Replaced' },
      ]
    }

    const designation = String(getDesignation(recipient) || '').toLowerCase()
    const isSupervisor = designation.includes('supervisor')
    if (isSupervisor) {
      return [
        { value: 'interested', label: 'Interested' },
        { value: 'drop_out', label: 'Drop Out' },
        { value: 'replaced', label: 'Replaced' },
        { value: 'recce_completed', label: 'Recce Completed' },
        { value: 'centre_entry_not_allowed', label: 'Centre Entry Not Allowed' },
        { value: 'videographer_list_not_received', label: 'Videographer list not received' },
      ]
    }

    return [
      { value: 'interested', label: 'Interested' },
      { value: 'drop_out', label: 'Drop Out' },
      { value: 'replaced', label: 'Replaced' },
    ]
  }

  const goPrev = () => {
    if (!filteredRecipients || filteredRecipients.length === 0) return
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      return
    }

    if (page > 1) {
      pendingIndexRef.current = 'LAST'
      setPage((prevPage) => Math.max(1, prevPage - 1))
    }
  }

  const changePage = useCallback((targetPage, nextIndex = 0) => {
    if (targetPage === page) return
    pendingIndexRef.current = nextIndex
    setPage(targetPage)
  }, [page])

  const goNext = () => {
    if (!filteredRecipients || filteredRecipients.length === 0) return
    const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
    if (currentIndex < filteredRecipients.length - 1) {
      setCurrentIndex(currentIndex + 1)
      return
    }

    if (page < totalPages) {
      pendingIndexRef.current = 0
      setPage((prevPage) => prevPage + 1)
    }
  }

  const handleQuickReached = (recipient) => {
    if (!recipient) return
    handleUpdateStatus(recipient, 'reached')
  }

  /* Redesigned DialerCard: mobile-first polished layout */
  const DialerCard = ({ recipient }) => {
    if (!recipient) return null
    const mobileRaw = recipient.mobile || recipient.phone || recipient.phoneNumber || recipient.mobileNumber || ''
    const aadhaar = recipient.aadhaar || recipient.aadhaarNumber || recipient.aadhaar_no
    const statusVal = recipient.status || recipient.call_status || recipient.verification_status || ''
    const statusVariant = getStatusVariant(statusVal)
    const isReached = String(statusVal || '').toLowerCase() === 'reached'
    const recipientPosition = (page - 1) * pageSize + currentIndex + 1
    const recipientTotal = total > 0 ? total : filteredRecipients?.length || 0
    const designationText = getDesignation(recipient)
    const centreName = recipient.centre || recipient.centreName || recipient.location || recipient.locationName || '-'
    const centreCode = recipient.centreCode || recipient.centre_code || recipient.centerCode || recipient.code || ''

    const isSupervisor = designationText.toLowerCase().includes('supervisor')

    return (
      <div className={`verifier-dialer-wrapper${recipient.replaced ? ' verifier-card-replaced' : ''}`}>
        <div className="dialer-card">
          <div className="dialer-recipient-counter">
            Recipient <span className="counter-number">{recipientPosition}</span> of <span className="counter-total">{recipientTotal}</span>
          </div>

          <div className="dialer-topbar">
            <div className="dialer-topbar-main">
              <div className="dialer-title-row">
                <div className="dialer-title">{recipient.name || recipient.fullName || recipient.full_name || recipient.candidateName || '-'}</div>
                {designationText ? (
                  <span className={`verifier-designation-pill${isSupervisor ? ' verifier-designation-supervisor' : ''}`}>
                    {designationText}
                  </span>
                ) : null}
                {recipient.replaced && <span className="verifier-replaced-badge">Replaced</span>}
              </div>
              {(centreName || centreCode) && (
                <div className="dialer-meta-pills">
                  {centreName && centreName !== '-' && <span className="dialer-meta-pill dialer-meta-centre">{centreName}</span>}
                  {centreCode && <span className="dialer-meta-pill dialer-meta-centre-code">Code {centreCode}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="dialer-info-panel">
            <div className="dialer-info-item">
              <div className="dialer-field-title">Mobile</div>
              <div className="dialer-field-value">{maskMobile(mobileRaw)}</div>
            </div>
            {aadhaar && (
              <div className="dialer-info-item">
                <div className="dialer-field-title">Aadhaar</div>
                <div className="dialer-field-value">{maskAadhaar(aadhaar)}</div>
              </div>
            )}
          </div>

          <div className="dialer-call-section">
            <div className="dialer-primary-actions">
              <button
                className={`verifier-action-button dialer-call-btn${isMobileView ? ' dialer-call-btn-mobile' : ''}`}
                type="button"
                onClick={() => handleMakeCall(recipient)}
                disabled={callInProgress === (recipient.id || recipient.recipientId || recipient.recipient_id)}
                aria-label="Call recipient"
              >
                <span className="dialer-call-icon">📞</span>
                <span className="dialer-call-text">{isMobileView ? 'Tap to call' : 'Call'}</span>
              </button>
              {canShowChecklistButton(recipient) && (
                <button className="verifier-action-button dialer-checklist-btn" type="button" onClick={() => openChecklistModal(recipient)}>
                  Checklist
                </button>
              )}
              {isDataAadharVerificationTitle && (
                <button className="verifier-action-button dialer-copy-link-btn" type="button" onClick={() => copyRecipientKycLink(recipient)}>
                  Copy link
                </button>
              )}
            </div>
            <div className="dialer-secondary-actions">
              <button className="dialer-status-control" type="button" onClick={() => openStatusModal(recipient)}>
                <span className="dialer-status-control-label">Change status</span>
                <span className="dialer-status-control-row">
                  <span className={`dialer-status-control-value ${statusVariant === 'green' ? 'dialer-status-control-value-success' : statusVariant === 'red' ? 'dialer-status-control-value-danger' : 'dialer-status-control-value-warning'}`}>
                    {statusVal || 'Pending'}
                  </span>
                  <span className="dialer-status-control-pencil" aria-hidden="true">✎</span>
                </span>
              </button>
              {isExamDay && (
                <button className="verifier-action-button dialer-issue-status-btn" type="button" onClick={() => openIssueStatusModal(recipient)}>
                  Issue status
                </button>
              )}
              {canShowReachedButton(recipient) && (
                <button className={`verifier-action-button dialer-reached-btn${isReached ? ' verifier-action-success' : ''}`} type="button" onClick={() => handleQuickReached(recipient)} disabled={isReached}>
                  {isReached ? '✓ Reached' : 'Mark Reached'}
                </button>
              )}
            </div>
          </div>

          <div className="dialer-nav-row">
            <button
              className="dialer-nav-btn"
              type="button"
              onClick={goPrev}
              disabled={page === 1 && currentIndex === 0}
              aria-label="Previous recipient"
            >
              Previous
            </button>
            <button
              className="dialer-nav-btn"
              type="button"
              onClick={goNext}
              disabled={page === Math.max(1, Math.ceil((total || 0) / pageSize)) && currentIndex >= (recipients ? recipients.length - 1 : 0)}
              aria-label="Next recipient"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* Desktop recipient card used for pre-day larger view */
  const RecipientCard = ({ recipient }) => {
    if (!recipient) return null
    const mobileRaw = recipient.mobile || recipient.phone || recipient.phoneNumber || recipient.mobileNumber || ''
    const aadhaar = recipient.aadhaar || recipient.aadhaarNumber || recipient.aadhaar_no
    const statusVal = recipient.status || recipient.call_status || recipient.verification_status || ''
    const statusVariant = getStatusVariant(statusVal)
    const isReached = String(statusVal || '').toLowerCase() === 'reached'
    const designationText = getDesignation(recipient)
    const centreName = recipient.centre || recipient.centreName || recipient.location || recipient.locationName || '-'
    const centreCode = recipient.centreCode || recipient.centre_code || recipient.centerCode || recipient.code || ''

    return (
      <div
        style={{
          border: recipient.replaced ? '1px solid #f59e0b' : '1px solid #e6e6ef',
          padding: 18,
          borderRadius: 10,
          width: '100%',
          maxWidth: 720,
          background: recipient.replaced ? '#fff7ed' : 'transparent',
          boxShadow: recipient.replaced ? '0 0 0 1px rgba(245, 158, 11, 0.18) inset' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: '1 1 360px' }}>
            <div className="verifier-card-heading">
              <div className="verifier-card-name-row">
                <div style={{ fontSize: 16, fontWeight: 700 }}>{recipient.name || recipient.fullName || recipient.full_name || recipient.candidateName || '-'}</div>
                {designationText ? (
                  <span className={`verifier-designation-pill${String(designationText).toLowerCase().includes('supervisor') ? ' verifier-designation-supervisor' : ''}`}>
                    {designationText}
                  </span>
                ) : null}
                {recipient.replaced && <span className="verifier-replaced-badge">Replaced</span>}
              </div>
              {(centreName || centreCode) && (
                <div className="verifier-card-centre-block">
                  {centreName && centreName !== '-' && <div className="verifier-card-centre-name">{centreName}</div>}
                  {centreCode && <div className="verifier-card-centre-code">Code: {centreCode}</div>}
                </div>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{maskMobile(mobileRaw)}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>{aadhaar ? maskAadhaar(aadhaar) : ''}</div>
          </div>
          <div className="verifier-card-right">
            <div className="verifier-card-status-row">
              <button className="dialer-status-control" type="button" onClick={() => openStatusModal(recipient)}>
                <span className="dialer-status-control-label">Change status</span>
                <span className="dialer-status-control-row">
                  <span className={`dialer-status-control-value ${statusVariant === 'green' ? 'dialer-status-control-value-success' : statusVariant === 'red' ? 'dialer-status-control-value-danger' : 'dialer-status-control-value-warning'}`}>
                    {statusVal || 'Pending'}
                  </span>
                  <span className="dialer-status-control-pencil" aria-hidden="true">✎</span>
                </span>
              </button>
              {canShowReachedButton(recipient) && (
                <button className={`verifier-action-button dialer-reached-btn${isReached ? ' verifier-action-success' : ''}`} type="button" onClick={() => handleQuickReached(recipient)} disabled={isReached}>
                  {isReached ? 'Reached ✓' : 'Mark as Reached'}
                </button>
              )}
            </div>
            <div className="verifier-card-action-stack">
              <button className="verifier-action-button dialer-call-btn" onClick={() => handleMakeCall(recipient)} disabled={callInProgress === (recipient.id || recipient.recipientId || recipient.recipient_id)}>Call</button>
              {canShowChecklistButton(recipient) && (
                <button className="verifier-action-button dialer-checklist-btn" type="button" onClick={() => openChecklistModal(recipient)} aria-label="View checklist">
                  Checklist
                </button>
              )}
              {isDataAadharVerificationTitle && (
                <button className="verifier-action-button dialer-copy-link-btn" type="button" onClick={() => copyRecipientKycLink(recipient)} aria-label="Copy verification link">
                  Copy link
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const rows = useMemo(() => filteredRecipients.map((recipient, idx) => {
    const sno = (page - 1) * pageSize + idx + 1
    const name = recipient.name || recipient.fullName || recipient.full_name || recipient.candidateName || '-'
    const mobileRaw = recipient.mobile || recipient.phone || recipient.phoneNumber || recipient.mobileNumber || ''
    const mobile = maskMobile(mobileRaw)
    const aadhaar = maskAadhaar(recipient.aadhaar || recipient.aadhaarNumber || recipient.aadhaar_no)
    const status = recipient.status || recipient.call_status || recipient.verification_status || '-'
    const designation = getDesignation(recipient)
    const centreName = recipient.centre || recipient.centreName || recipient.location || recipient.locationName || '-'
    const centreCode = recipient.centreCode || recipient.centre_code || recipient.centerCode || recipient.code || '-'
    const isReached = String(status || '').toLowerCase() === 'reached'
    const isSupervisor = String(designation || '').toLowerCase().includes('supervisor')

    const actions = (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {canShowReachedButton(recipient) && (
          <button className={`btn btn-xs ${isReached ? 'btn-success' : 'btn-outline'}`} type="button" onClick={() => handleQuickReached(recipient)} disabled={isReached}>
            {isReached ? 'Reached ✓' : 'Mark as Reached'}
          </button>
        )}
        {isDataAadharVerificationTitle && (
          <button className="btn btn-outline btn-xs" type="button" onClick={() => copyRecipientKycLink(recipient)} title="Copy verification link">Copy link</button>
        )}
        {canShowChecklistButton(recipient) && (
          <button className="btn btn-outline btn-xs" type="button" onClick={() => openChecklistModal(recipient)} title="View checklist">Checklist</button>
        )}
        {isExamDay && (
          <button className="btn btn-outline btn-xs" type="button" onClick={() => openIssueStatusModal(recipient)} title="Issue status">Issue status</button>
        )}
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => handleMakeCall(recipient)}
          disabled={callInProgress === (recipient.id || recipient.recipientId || recipient.recipient_id)}
          style={{ padding: '4px 8px', fontSize: 11 }}
        >
          {callInProgress === (recipient.id || recipient.recipientId || recipient.recipient_id) ? 'Calling…' : 'Call'}
        </button>
      </div>
    )

    return [sno, centreCode, centreName, <span key={`designation-${idx}`} className={`verifier-designation-pill${isSupervisor ? ' verifier-designation-supervisor' : ''}`}>{designation}</span>, name, mobile, aadhaar, <div key={`status-edit-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Tag variant={getStatusVariant(status)}>{status}</Tag>
      <button className="btn btn-ghost btn-xs" title="Edit status" onClick={() => openStatusModal(recipient)}>✎</button>
    </div>, actions]
  }), [filteredRecipients, callInProgress, page, pageSize, projectDay])

  const lastPage = Math.max(1, Math.ceil((total || 0) / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(page * pageSize, total)
  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, lastPage - 4)))
  const pageEnd = Math.min(lastPage, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  const currentRecipient = filteredRecipients[Math.min(Math.max(currentIndex, 0), Math.max(0, filteredRecipients.length - 1))] || null
  const statusOptions = getStatusOptions(modalRecipient || currentRecipient || {})
  const showReplaceInModal = String(statusSelection || '').toLowerCase() === 'replaced'

  const subtitle = `Verifier • ${projectDay === 'exam' ? 'Exam day' : 'Pre-day'}`
  const isPreday = projectDay !== 'exam'

  const recipientPosition = (page - 1) * pageSize + currentIndex + 1
  const recipientTotal = total > 0 ? total : (filteredRecipients?.length || 0)
  const displayCount = total === 0 ? 0 : Math.min(recipients.length, total)

  useEffect(() => {
    if (currentRecipient) {
      const s = currentRecipient.status || currentRecipient.call_status || currentRecipient.verification_status || ''
      setStatusSelection(s)
      setStatusNotes(currentRecipient.notes || currentRecipient.note || '')
    } else {
      setStatusSelection('')
      setStatusNotes('')
    }
  }, [currentRecipient])

  useEffect(() => {
    const onResize = () => setIsMobileView(getIsCompactView())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleUpdateStatus = async (recipient, newStatus, options = {}) => {
    const recipientId = recipient.id || recipient.recipientId || recipient.recipient_id
    if (!recipientId) {
      alert('Recipient id missing')
      return false
    }

    const centreKey = getCentreKey(recipient)
    const recipientName = recipient.name || recipient.fullName || recipient.full_name || recipient.candidateName || ''
    const recipientMobile = recipient.phone || recipient.mobile || recipient.phoneNumber || recipient.mobileNumber || ''
    const recipientAadhaar = recipient.aadhaar || recipient.aadhaarNumber || recipient.aadhaar_no || ''
    const recipientDesignation = getDesignation(recipient)
    const notesValue = options.notes ?? statusNotes

    try {
      await api.updateVerifierRecipientStatus(
        registrationId,
        recipientId,
        {
          status: newStatus,
          notes: notesValue || undefined,
          recipient_id: recipientId,
          name: recipientName,
          mobile: recipientMobile,
          aadhaar: recipientAadhaar,
          designation: recipientDesignation,
          day: projectDay,
        },
        {
          titleId: title_id || state.titleId || undefined,
          title_id: title_id || state.titleId || undefined,
          venue,
          centreId: centreKey,
          centreCode: centreKey,
          recipientId,
          name: recipientName,
          mobile: recipientMobile,
          aadhaar: recipientAadhaar,
          designation: recipientDesignation,
          day: projectDay,
          projectDay,
          notes: notesValue || undefined,
        }
      )
      if (!options.silent) {
        alert('Status updated')
      }
      if (options.closeModal !== false) {
        setShowStatusModal(false)
      }
      if (options.clearNotes !== false) {
        setStatusNotes('')
      }
      if (options.refresh !== false) {
        fetchRecipients()
      }
      return true
    } catch (err) {
      console.error('Failed to update status', err)
      alert('Failed to update status')
      return false
    }
  }

  const openStatusModal = (recipient) => {
    if (!recipient) return
    setModalRecipient(recipient)
    const s = recipient.status || recipient.call_status || recipient.verification_status || ''
    setStatusSelection(s)
    setStatusNotes(recipient.notes || recipient.note || '')
    setShowStatusModal(true)
  }

  const openReplaceModal = (recipient) => {
    if (!recipient) return
    setReplaceRecipient(recipient)
    setReplaceForm({ name: '', mobile: '', aadhaar: '' })
    setShowReplaceModal(true)
  }

  const submitReplaceModal = async () => {
    if (!replaceRecipient) return
    const trimmedName = replaceForm.name.trim()
    const trimmedMobile = replaceForm.mobile.replace(/\D/g, '').slice(0, 10)
    const trimmedAadhaar = replaceForm.aadhaar.replace(/\D/g, '').slice(0, 12)

    if (!trimmedName || !trimmedMobile || !trimmedAadhaar) {
      alert('Please fill in name, mobile number, and aadhaar number.')
      return
    }

    const recipientId = getRecipientId(replaceRecipient)
    if (!recipientId) {
      alert('Recipient id missing')
      return
    }

    if (!statusSelection) {
      alert('Please select a status')
      return
    }

    const centreKey = getCentreKey(replaceRecipient)
    setReplaceInProgress(true)
    try {
      const statusUpdated = await handleUpdateStatus(replaceRecipient, statusSelection, {
        notes: statusNotes,
        silent: true,
        closeModal: false,
        clearNotes: false,
        refresh: false,
      })

      if (!statusUpdated) {
        throw new Error('Status update failed')
      }

      await api.replaceVerifierRecipient(
        registrationId,
        recipientId,
        {
          name: trimmedName,
          mobile: trimmedMobile,
          aadhaar: trimmedAadhaar,
          projectDay,
          replacementFor: recipientId,
        },
        title_id,
        venue,
        centreKey,
      )

      const replacementRecipient = {
        ...replaceRecipient,
        id: `${recipientId}-replaced-${Date.now()}`,
        recipientId: `${recipientId}-replaced-${Date.now()}`,
        name: trimmedName,
        fullName: trimmedName,
        mobile: trimmedMobile,
        phone: trimmedMobile,
        phoneNumber: trimmedMobile,
        mobileNumber: trimmedMobile,
        aadhaar: trimmedAadhaar,
        aadhaarNumber: trimmedAadhaar,
        aadhaar_no: trimmedAadhaar,
        status: 'pending',
        call_status: 'pending',
        verification_status: 'pending',
      }

      setRecipients((prev) => prev.map((item) => getRecipientId(item) === recipientId ? replacementRecipient : item))
      setShowReplaceModal(false)
      setShowStatusModal(false)
      setReplaceForm({ name: '', mobile: '', aadhaar: '' })
      setReplaceRecipient(null)
      setStatusNotes('')
      fetchRecipients()
      alert('Replacement candidate submitted successfully.')
    } catch (err) {
      console.error('Failed to replace recipient', err)
      alert('Failed to submit replacement. Please try again.')
    } finally {
      setReplaceInProgress(false)
    }
  }

  const submitStatusModal = () => {
    if (!modalRecipient) return
    if (!statusSelection) {
      alert('Please select a status')
      return
    }
    if (statusSelection.toLowerCase() === 'replaced') {
      setShowStatusModal(false)
      openReplaceModal(modalRecipient)
      return
    }
    handleUpdateStatus(modalRecipient, statusSelection)
  }

  return (
    <div className="candidate-calling-page" ref={scrollContainerRef}>
      {!initialState && (
        <PageHeader
          title={`${title || 'Assignment'} • ${venue}`}
          subtitle="Assigned Recipients"
          action={(
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleBackToVenues}
            >
              Back to venues
            </button>
          )}
        />
      )}

      <Card>
        <CardHeader title="Assigned Recipients" action={(
          <div className="callers-filters">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: typeof window !== 'undefined' && window.innerWidth > 500 ? 'nowrap' : 'wrap', overflowX: 'auto' }}>
              <select className="form-control" style={{minWidth: '160px'}} value={selectedCentre} onChange={(e) => { setSelectedCentre(e.target.value); setPage(1); setHasMore(true); setRecipients([]) }}>
                <option value="">All centres</option>
                {centresList.map((c) => {
                  const centreCode = c.centreCode || c.code || c.id || ''
                  const centreName = c.centre || c.name || centreCode
                  return (
                    <option key={centreCode || centreName} value={centreCode || centreName}>
                      {centreName}{centreCode ? ` - ${centreCode}` : ''}
                    </option>
                  )
                })}
              </select>
              <select className="form-control" style={{minWidth: '180px'}} value={designationFilter} onChange={(e) => { setDesignationFilter(e.target.value); setPage(1); setHasMore(true); setRecipients([]) }}>
                <option value="">All designations</option>
                {designationOptions.map((designation) => (
                  <option key={designation} value={designation}>{designation}</option>
                ))}
              </select>
              <div className="callers-search-group">
                <input
                  className="form-control"
                  placeholder={isPreday ? 'Search recipients (pre-day list)' : 'Search recipients'}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); setHasMore(true); setRecipients([]) }}
                />
              </div>
            </div>
          </div>
        )} />

        {loading && <div>Loading recipients…</div>}
        {!loading && recipients.length === 0 && <div>No recipients found.</div>}
        {!loading && recipients.length > 0 && (
          <>
            {!isPreday && (
              <div className="exam-day-top-summary">
                {isMobileView ? (
                  <div style={{ width: '100%', textAlign: 'center' }}>
                    <span>Recipient <strong className="counter-number">{recipientPosition}</strong> of <strong className="counter-total">{recipientTotal}</strong></span>
                  </div>
                ) : (
                  <>
                    <span>Total recipients</span>
                    <strong>{total}</strong>
                  </>
                )}
              </div>
            )}
            {isPreday ? (
              <>
                {isMobileView ? (
                  <>
                    <div className="mobile-only">
                      <DialerCard recipient={currentRecipient} />
                    </div>
                    <div className="mobile-only" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        className="form-control"
                        style={{ minWidth: 120, flex: '1 1 auto' }}
                        placeholder="Go to recipient #"
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const requestedRecipient = Number(pageInput)
                            if (!requestedRecipient || requestedRecipient < 1) return
                            const targetPage = Math.min(lastPage, Math.max(1, Math.ceil(requestedRecipient / pageSize)))
                            changePage(targetPage, 0)
                            setPageInput('')
                          }
                        }}
                      />
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={() => {
                          const requestedRecipient = Number(pageInput)
                          if (!requestedRecipient || requestedRecipient < 1) return
                          const targetPage = Math.min(lastPage, Math.max(1, Math.ceil(requestedRecipient / pageSize)))
                          changePage(targetPage, 0)
                          setPageInput('')
                        }}
                      >
                        Go
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="desktop-only">
                    <RecipientCard recipient={currentRecipient} />
                  </div>
                )}
              </>
            ) : (
              isMobileView ? (
                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredRecipients.map((recipient, idx) => {
                    const status = recipient.status || recipient.call_status || recipient.verification_status || 'pending'
                    const designation = getDesignation(recipient)
                    const centreName = recipient.centreName || recipient.centre || recipient.location || recipient.locationName || '-'
                    const centreCode = recipient.centreCode || recipient.centre_code || recipient.centerCode || recipient.code || ''
                    const mobile = maskMobile(recipient.mobile || recipient.phone || recipient.phoneNumber || recipient.mobileNumber || '')
                    const aadhaar = maskAadhaar(recipient.aadhaar || recipient.aadhaarNumber || recipient.aadhaar_no)
                    const isReached = String(status || '').toLowerCase() === 'reached'
                    const isSupervisor = String(designation || '').toLowerCase().includes('supervisor')
                    return (
                      <div key={recipient.id || recipient.recipientId || recipient.recipient_id || idx} className="compact-card">
                        <div className="compact-card-top">
                          <div className="compact-card-title-section">
                            <div className="compact-card-name-row">
                              <div className="compact-card-name">{recipient.name || recipient.fullName || recipient.full_name || recipient.candidateName || 'Recipient'}</div>
                              {designation ? (
                                <span className={`compact-card-designation${isSupervisor ? ' supervisor' : ''}`}>{designation}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        
                        <div className="compact-card-centre-info">
                          <span className="centre-name">{centreName}</span>
                          {centreCode && <span className="centre-code">Code {centreCode}</span>}
                        </div>
                        
                        <div className="compact-card-details-grid">
                          <div className="detail-item">
                            <span className="detail-label">Number</span>
                            <span className="detail-value">{mobile}</span>
                          </div>
                          {aadhaar && aadhaar !== '-' && (
                            <div className="detail-item">
                              <span className="detail-label">Aadhaar</span>
                              <span className="detail-value">{aadhaar}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="compact-card-buttons-grid">
                          <div className="dialer-call-section compact-card-call-section">
                            <div className="dialer-primary-actions">
                              <button className="verifier-action-button dialer-call-btn compact-card-call-btn" type="button" onClick={() => handleMakeCall(recipient)} disabled={callInProgress === getRecipientId(recipient)} title="Call">
                                <span className="dialer-call-icon">📞</span>
                                <span className="dialer-call-text">Call</span>
                              </button>
                              {canShowChecklistButton(recipient) && (
                                <button className="verifier-action-button dialer-checklist-btn compact-card-checklist-btn" type="button" onClick={() => openChecklistModal(recipient)}>
                                  Checklist
                                </button>
                              )}
                              {projectDay === 'exam' && (
                                <button className="verifier-action-button dialer-issue-status-btn compact-card-issue-status-btn" type="button" onClick={() => openIssueStatusModal(recipient)}>
                                  Issue status
                                </button>
                              )}
                              {projectDay === 'exam' && (
                                <button className="verifier-action-button dialer-checklist-btn compact-card-checklist-btn" type="button" onClick={openSchoolAttendanceModal}>
                                  School Attendance
                                </button>
                              )}
                            </div>
                            <div className="dialer-secondary-actions">
                              {projectDay === 'exam' && (
                                <button className="dialer-status-control compact-card-status-control" type="button" onClick={() => openStatusModal(recipient)}>
                                  <span className="dialer-status-control-label">Change status</span>
                                  <span className="dialer-status-control-row">
                                    <span className={`dialer-status-control-value ${getStatusVariant(status) === 'green' ? 'dialer-status-control-value-success' : getStatusVariant(status) === 'red' ? 'dialer-status-control-value-danger' : 'dialer-status-control-value-warning'}`}>
                                      {status || 'Pending'}
                                    </span>
                                    <span className="dialer-status-control-pencil" aria-hidden="true">✎</span>
                                  </span>
                                </button>
                              )}
                              {canShowReachedButton(recipient) && (
                                <button className={`verifier-action-button dialer-reached-btn${isReached ? ' verifier-action-success' : ''}`} type="button" onClick={() => handleQuickReached(recipient)} disabled={isReached}>
                                  {isReached ? '✓ Reached' : 'Mark Reached'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {isExamDay && <div ref={loadMoreSentinelRef} style={{ height: 1 }} />}
                </div>
              ) : (
                <div className="desktop-only">
                  <DataTable
                    columns={['S.No', 'Centre Code', 'Centre Name', 'Designation', 'Name', 'Number', 'Aadhaar', 'Status', 'Actions']}
                    rows={rows}
                    emptyMessage={loading ? 'Loading recipients…' : 'No recipients found.'}
                    getRowClassName={(row, index) => filteredRecipients[index]?.replaced ? 'verifier-table-row-replaced' : ''}
                  />
                  {isExamDay && <div ref={loadMoreSentinelRef} style={{ height: 1 }} />}
                </div>
              )
            )}
          </>
        )}

        <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update recipient status" footer={(
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowStatusModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" type="button" onClick={submitStatusModal} disabled={!statusSelection}>
              {showReplaceInModal ? 'Update and Replace' : 'Update'}
            </button>
          </div>
        )}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>{modalRecipient?.name || modalRecipient?.fullName || modalRecipient?.candidateName}</div>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Status</label>
              <select className="form-control" value={statusSelection} onChange={(e) => setStatusSelection(e.target.value)}>
                <option value="">Select status</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Notes (optional)</label>
              <textarea className="form-control" rows={4} value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} />
            </div>
          </div>
        </Modal>

        <Modal isOpen={showReplaceModal} onClose={() => setShowReplaceModal(false)} title="Replace candidate" footer={(
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowReplaceModal(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" type="button" onClick={submitReplaceModal} disabled={replaceInProgress}>Submit replacement</button>
          </div>
        )}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>{replaceRecipient?.name || replaceRecipient?.fullName || replaceRecipient?.candidateName || 'Current recipient'}</div>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Name</label>
              <input className="form-control" value={replaceForm.name} onChange={(e) => setReplaceForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Enter replacement name" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Mobile number</label>
              <input className="form-control" value={replaceForm.mobile} onChange={(e) => setReplaceForm((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="Enter mobile number" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Aadhaar number</label>
              <input className="form-control" value={replaceForm.aadhaar} onChange={(e) => setReplaceForm((prev) => ({ ...prev, aadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) }))} placeholder="Enter aadhaar number" />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showChecklistModal}
          onClose={() => setShowChecklistModal(false)}
          title={checklistRecipient ? `${resolveDay(checklistRecipient) === 'exam' ? 'Exam Day' : 'Pre-day'} Checklist: ${checklistRecipient.name || checklistRecipient.fullName || ''}` : 'Checklist'}
        >
          {checklistLoading ? (
            <div>Loading checklist…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, color: '#475569', flex: '1 1 320px' }}>
                  Review or update the checklist items below. Previous values are loaded when available.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    disabled={!checklistRecipient || checklistLoading}
                    onClick={() => exportChecklistToPdf(checklistRecipient, checklistItems)}
                  >
                    Export PDF
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    disabled={!checklistRecipient || checklistLoading}
                    onClick={() => exportChecklistToExcel(checklistRecipient, checklistItems)}
                  >
                    Export Excel
                  </button>
                </div>
              </div>
              {checklistItems.map((item) => (
                <div key={item.id} style={{ padding: 12, borderRadius: 12, border: '1px solid #e5e7eb', background: '#fbfbfd' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.checked)}
                      onChange={(e) => updateChecklistItem(item.id, { checked: e.target.checked })}
                      style={{ marginTop: 4 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{item.label}</div>
                      {item.hasRemarks && (
                        <textarea
                          className="form-control"
                          rows={2}
                          placeholder="Notes (optional)"
                          value={item.note || ''}
                          onChange={(e) => updateChecklistItem(item.id, { note: e.target.value })}
                          style={{ width: '100%', resize: 'vertical' }}
                        />
                      )}
                    </div>
                  </label>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowChecklistModal(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={submitChecklistModal} disabled={checklistInProgress || checklistLoading}>
                  {checklistInProgress ? 'Saving…' : 'Save checklist'}
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={showIssueStatusModal}
          onClose={() => setShowIssueStatusModal(false)}
          title="Exam Day Issue Status"
          footer={(
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowIssueStatusModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" type="button" onClick={submitIssueStatusModal} disabled={!issueStatusSelection || issueStatusInProgress}>
                {issueStatusInProgress ? 'Saving…' : 'Save issue status'}
              </button>
            </div>
          )}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, color: '#475569' }}>
              Select the issue that applies for this recipient on exam day.
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Issue status</label>
              <select className="form-control" value={issueStatusSelection} onChange={(e) => setIssueStatusSelection(e.target.value)}>
                <option value="">Select issue status</option>
                {getIssueStatusOptions().map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6 }}>Notes (optional)</label>
              <textarea
                className="form-control"
                rows={4}
                value={issueStatusNotes}
                onChange={(e) => setIssueStatusNotes(e.target.value)}
                placeholder="Add any details about the issue"
              />
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showSchoolAttendanceModal}
          onClose={() => setShowSchoolAttendanceModal(false)}
          title="School Attendance"
          footer={(
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowSchoolAttendanceModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" type="button" onClick={submitSchoolAttendance} disabled={schoolAttendanceSaving || schoolAttendanceLoading}>
                {schoolAttendanceSaving ? 'Saving…' : 'Save attendance'}
              </button>
            </div>
          )}
        >
          {schoolAttendanceLoading ? (
            <div>Loading school attendance…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-zebra w-full" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 50 }}>S.No</th>
                    <th style={{ minWidth: 140 }}>Centre Code</th>
                    <th style={{ minWidth: 240 }}>Centre Name</th>
                    <th style={{ minWidth: 120 }}>Allocated</th>
                    <th style={{ minWidth: 120 }}>Shift 1 Count</th>
                    <th style={{ minWidth: 120 }}>Shift 2 Count</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolAttendanceRows.map((row, index) => (
                    <tr key={row.id || index}>
                      <td>{index + 1}</td>
                      <td>{row.centreCode || '-'}</td>
                      <td>{row.centreName || '-'}</td>
                      <td>
                        <input
                          className="form-control"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.allocated}
                          onChange={(e) => updateSchoolAttendanceRow(row.id, 'allocated', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.shift1Count}
                          onChange={(e) => updateSchoolAttendanceRow(row.id, 'shift1Count', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={row.shift2Count}
                          onChange={(e) => updateSchoolAttendanceRow(row.id, 'shift2Count', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px', gap: 16 }}>
          {isExamDay ? (
            <>
              <div style={{ fontSize: '12px' }}>{total === 0 ? 'Showing 0 of 0' : `Showing ${displayCount} of ${total}`}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {loadingMore ? 'Loading more…' : hasMore ? 'Scroll down to load more recipients' : 'All recipients loaded'}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '12px' }}>{total === 0 ? 'Showing 0 of 0' : `Showing ${start}-${end} of ${total}`}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {isMobileView ? (
                  <>
                    <button className="firstprev pagination-page-btn" type="button" disabled={page === 1} onClick={() => changePage(Math.max(1, page - 1), 0)}>Prev</button>
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
                      {pageEnd < lastPage - 1 && <span className="pagination-ellipsis">…</span>}
                      {pageEnd < lastPage && <button className="pagination-page-btn" type="button" onClick={() => setPage(lastPage)}>{lastPage}</button>}
                    </div>
                    <button className="lastprev pagination-page-btn" type="button" disabled={page === lastPage} onClick={() => changePage(Math.min(lastPage, page + 1), 0)}>Next</button>
                  </>
                ) : (
                  <>
                    <button className="firstprev pagination-page-btn" type="button" disabled={page === 1} onClick={() => setPage(1)}>First</button>
                    <button className="firstprev pagination-page-btn" type="button" disabled={page === 1} onClick={() => { setPage((p) => Math.max(1, p - 1)) }}>Prev</button>
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
                      {pageEnd < lastPage - 1 && <span className="pagination-ellipsis">…</span>}
                      {pageEnd < lastPage && <button className="pagination-page-btn" type="button" onClick={() => setPage(lastPage)}>{lastPage}</button>}
                    </div>
                    <button className="lastprev pagination-page-btn" type="button" disabled={page === lastPage} onClick={() => { setPage((p) => Math.min(lastPage, p + 1)) }}>Next</button>
                    <button className="lastprev pagination-page-btn" type="button" disabled={page === lastPage} onClick={() => { setPage(lastPage) }}>Last</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                      <input
                        className="form-control"
                        style={{ width: 80 }}
                        placeholder="Go to recipient #"
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const requestedRecipient = Number(pageInput)
                            if (!requestedRecipient || requestedRecipient < 1) return
                            const targetPage = Math.min(lastPage, Math.max(1, Math.ceil(requestedRecipient / pageSize)))
                            setPage(targetPage)
                            setPageInput('')
                          }
                        }}
                      />
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => {
                        const requestedRecipient = Number(pageInput)
                        if (!requestedRecipient || requestedRecipient < 1) return
                        const targetPage = Math.min(lastPage, Math.max(1, Math.ceil(requestedRecipient / pageSize)))
                        setPage(targetPage)
                        setPageInput('')
                      }}>Go</button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {isMobileView && !isPreday && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input
              className="form-control"
              style={{ minWidth: 100, flex: '0 1 auto' }}
              placeholder="Go to #"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const requestedRecipient = Number(pageInput)
                  if (!requestedRecipient || requestedRecipient < 1) return
                  const targetPage = Math.min(lastPage, Math.max(1, Math.ceil(requestedRecipient / pageSize)))
                  setPage(targetPage)
                  setPageInput('')
                }
              }}
            />
            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={() => {
                const requestedRecipient = Number(pageInput)
                if (!requestedRecipient || requestedRecipient < 1) return
                const targetPage = Math.min(lastPage, Math.max(1, Math.ceil(requestedRecipient / pageSize)))
                setPage(targetPage)
                setPageInput('')
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              Go
            </button>
          </div>
        )}
      </Card>

      <style>{`
        .verifier-card-replaced {
          border: 1px solid #f59e0b !important;
          background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%);
          box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.18) inset;
        }
        .verifier-replaced-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 999px;
          background: #fef3c7;
          color: #92400e;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .verifier-table-row-replaced {
          background: #fff7ed !important;
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.22);
        }
        .verifier-table-row-replaced td {
          background: transparent;
        }
        
        /* Dialer Card Styles */
        .dialer-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px;
          background: #fff;
        }
        
        .dialer-recipient-counter {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          text-align: center;
          padding: 10px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          letter-spacing: -0.3px;
        }
        
        .dialer-recipient-counter .counter-number {
          font-size: 24px;
          font-weight: 700;
          color: #1f2937;
        }
        
        .dialer-recipient-counter .counter-total {
          font-size: 18px;
          font-weight: 600;
          color: #6b7280;
        }
        
        .dialer-topbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        
        .dialer-topbar-main {
          flex: 1;
          min-width: 0;
        }

        .dialer-meta-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
        }

        .dialer-meta-pill {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 4px 10px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
        }

        .dialer-meta-centre-code {
          background: #eef2ff;
          color: #3730a3;
          border-color: #c7d2fe;
        }
        
        .dialer-title-row,
        .verifier-card-name-row,
        .compact-card-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .dialer-title {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          word-break: break-word;
        }

        .verifier-action-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 40px;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
          white-space: nowrap;
        }

        .verifier-action-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
        }

        .verifier-action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .verifier-action-success {
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #fff;
          border-color: #15803d;
        }

        .dialer-call-stack,
        .verifier-card-action-stack,
        .compact-card-buttons-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .dialer-status-actions {
          display: flex;
          align-items: stretch;
          gap: 8px;
          flex-wrap: wrap;
          flex: 1;
        }

        .dialer-checklist-btn,
        .dialer-copy-link-btn,
        .verifier-card-checklist-btn,
        .compact-card-checklist-btn,
        .dialer-topbar-checklist-btn {
          background: #fff;
          color: #334155;
          border-color: #cbd5e1;
        }
        
        .dialer-copy-link-btn {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .dialer-subtitle {
          font-size: 13px;
          color: #6b7280;
          margin-top: 4px;
        }
        
        /* Info Panel - 2x2 Grid */
        .dialer-info-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        
        .dialer-info-item {
          padding: 10px;
          border-radius: 6px;
          background: #f9fafb;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          border: 1px solid #f3f4f6;
        }
        
        .dialer-info-item.dialer-info-supervisor {
          background: #fef9e7;
          border: 1px solid #fde68a;
        }
        
        .dialer-field-title {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .dialer-field-value {
          font-size: 14px;
          color: #1f2937;
          font-weight: 600;
          word-break: break-word;
          line-height: 1.4;
        }
        
        /* Call Section with Status */
        .dialer-call-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .dialer-primary-actions,
        .dialer-secondary-actions {
          display: flex;
          gap: 8px;
          align-items: stretch;
          flex-wrap: wrap;
        }

        .dialer-primary-actions {
          width: 100%;
        }

        .dialer-secondary-actions {
          justify-content: space-between;
        }

        .dialer-status-control {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          flex: 1 1 180px;
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #fff;
          color: #0f172a;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
          text-align: left;
        }

        .dialer-status-control:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .dialer-status-control-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
        }

        .dialer-status-control-row {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
        }

        .dialer-status-control-value {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #f1f5f9;
          color: #334155;
        }

        .dialer-status-control-pencil {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
        }

        .dialer-status-control-value-success {
          background: #dcfce7;
          color: #166534;
        }

        .dialer-status-control-value-danger {
          background: #fee2e2;
          color: #b91c1c;
        }

        .dialer-status-control-value-warning {
          background: #fef3c7;
          color: #92400e;
        }
        
        .dialer-call-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          border-color: #1d4ed8;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          min-width: 120px;
        }
        
        .dialer-call-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          color: white;
        }
        
        .dialer-call-btn:active:not(:disabled) {
          opacity: 0.95;
        }
        
        .dialer-call-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .dialer-call-icon {
          font-size: 18px;
          display: flex;
          align-items: center;
          filter: brightness(0) invert(1);
        }
        
        .dialer-call-text {
          font-weight: 600;
        }
        
        .dialer-call-btn-mobile .dialer-call-text {
          display: none;
        }
        
        .dialer-call-btn-mobile {
          min-width: auto;
          padding: 10px 12px;
        }
        
        /* Reached and Checklist Buttons */
        .dialer-action-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .dialer-action-buttons .btn {
          flex: 1;
          min-width: 100px;
          font-size: 13px;
          padding: 8px 10px;
          font-weight: 600;
        }
        
        /* Nav Row */
        .dialer-nav-row {
          display: flex;
          gap: 8px;
        }
        
        .dialer-nav-btn {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          color: #374151;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
          transition: all 0.2s ease;
        }
        
        .dialer-nav-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
        
        .dialer-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        
        /* Compact Card Grid Layout */
        .candidate-calling-page .exam-day-top-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          margin: 0 0 10px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 13px;
        }

        .candidate-calling-page .exam-day-top-summary strong {
          color: #0f172a;
          font-size: 14px;
        }

        .candidate-calling-page .compact-card {
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          padding: 12px;
          background: var(--card, #fff);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .candidate-calling-page .detail-item.supervisor-highlight-block {
          background: #fef9e7;
          border: 1px solid #fde68a;
          border-radius: 10px;
          padding: 8px 10px;
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.12);
        }
        
        .candidate-calling-page .compact-card-top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: start;
        }

        .candidate-calling-page .verifier-card-heading {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .candidate-calling-page .verifier-card-centre-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #475569;
          font-size: 13px;
        }

        .candidate-calling-page .verifier-card-centre-name {
          font-weight: 600;
          color: #334155;
        }

        .candidate-calling-page .verifier-card-centre-code {
          font-size: 12px;
          color: #64748b;
        }

        .candidate-calling-page .verifier-card-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }

        .candidate-calling-page .verifier-card-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .candidate-calling-page .verifier-card-action-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
          min-width: 132px;
        }
        
        .candidate-calling-page .compact-card-title-section {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        
        .candidate-calling-page .compact-card-name {
          font-weight: 700;
          font-size: 15px;
          color: var(--text1, #1f2937);
          word-break: break-word;
        }
        
        .candidate-calling-page .compact-card-designation {
          font-size: 12px;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 4px 8px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .candidate-calling-page .compact-card-designation.supervisor {
          background: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
          font-weight: 700;
        }
        
        .candidate-calling-page .compact-card-checklist-btn {
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
          border-radius: 8px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }
        
        .candidate-calling-page .compact-card-centre-info {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        
        .candidate-calling-page .compact-card-centre-info .centre-name,
        .candidate-calling-page .compact-card-centre-info .centre-code {
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.12);
          font-size: 12px;
          color: var(--text3, #475569);
          white-space: nowrap;
          display: inline-block;
        }
        
        .candidate-calling-page .compact-card-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          font-size: 13px;
        }
        
        .candidate-calling-page .detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .candidate-calling-page .detail-label {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        
        .candidate-calling-page .detail-value {
          font-size: 13px;
          color: #334155;
          font-weight: 500;
          word-break: break-word;
        }
        
        .candidate-calling-page .compact-card-buttons-grid {
          display: flex;
          flex-direction: row;
          gap: 8px;
          align-items: stretch;
          justify-content: space-between;
          padding: 0;
        }

        .candidate-calling-page .compact-card-call-section {
          display: flex;
          gap: 8px;
          align-items: stretch;
          flex: 1 1 auto;
          padding: 6px;
          border-radius: 8px;
          border: 1px solid rgba(229,231,235,0.9);
          background: #fff;
        }

        /* keep default verifier-action-button sizing so it matches dialer */

        .candidate-calling-page .compact-card-call-btn {
          flex: 1 1 60%;
          min-width: 0;
          font-size: 14px;
          padding: 10px 12px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          border-color: #1d4ed8;
          border-radius: 8px;
          line-height: 1.1;
        }

        .candidate-calling-page .compact-card-call-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          color: white;
        }

        .candidate-calling-page .compact-card-checklist-btn {
          flex: 1 1 40%;
          min-width: 0;
          padding: 10px 12px;
          border-radius: 8px;
        }

        .candidate-calling-page .compact-card-status-control {
          flex: 0 0 160px;
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #fff;
          color: #0f172a;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
          text-align: left;
        }

        .candidate-calling-page .compact-card-status-control:hover {
          border-color: #94a3b8;
          background: #f8fafc;
        }

        .candidate-calling-page .btn-call-icon .dialer-call-icon {
          filter: none;
        }

        .candidate-calling-page .verifier-designation-pill {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 4px 8px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
        }

        .candidate-calling-page .verifier-designation-supervisor {
          background: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
        }
        
        .mobile-only { display: none; }
        .desktop-only { display: block; }
        
        @media (min-width: 500px) and (max-width: 768px) {
          .dialer-call-section {
            flex-wrap: nowrap;
            align-items: stretch;
          }
          .dialer-call-stack,
          .dialer-status-actions {
            min-width: 0;
          }
          .dialer-call-stack {
            flex: 1 1 0;
          }
          .dialer-status-actions {
            flex: 0 0 auto;
          }
          .verifier-action-button,
          .dialer-call-btn,
          .dialer-reached-btn,
          .dialer-nav-btn {
            min-height: 44px;
          }
          .candidate-calling-page .compact-card-buttons-grid {
            display: flex;
            flex-direction: column;
          }
          .candidate-calling-page .compact-card-call-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .candidate-calling-page .dialer-primary-actions,
          .candidate-calling-page .dialer-secondary-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .candidate-calling-page .compact-card-buttons-grid .verifier-action-button,
          .candidate-calling-page .compact-card-buttons-grid .dialer-status-control {
            flex: 1 1 0;
            min-width: 0;
          }
        }
        
        @media (max-width: 680px), (max-width: 1024px) and (orientation: portrait) {
          .mobile-only { display: block; }
          .desktop-only { display: none; }
        }
      `}</style>
    </div>
  )
}
