import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faEye, faFileExcel, faArrowLeft, faCheck, faPhone, faMapMarkerAlt, faPencilAlt, faUserPlus, faSearch, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { PageHeader, Card, CardHeader, DataTable, Tag, Modal, FormField, StatCard } from '../../components/ui/index'
import { candidateAPI, recruiterAPI, DESIGNATION_FALLBACK_OPTIONS } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { useAuth } from '../../context/AuthContext'

export default function CallingRecipients({ initialState, useRecruiterApi = false, registrationIdOverride, onBack } = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const state = initialState ?? location.state
  const { user } = useAuth()
  const registrationId = registrationIdOverride ?? user?.registrationId
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const showCallButtons = !useRecruiterApi
  const handleBack = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack()
      return
    }
    navigate('/app/candidate/calling')
  }, [navigate, onBack])
  const showExportExcel = useRecruiterApi

  // Extract from navigation state
  const projectId = state?.projectId
  const projectType = state?.projectType || 'regular'
  const isWrittenExam = projectType === 'written'
  const callerId = state?.callerId
  const locationName = state?.location
  const locationId = state?.locationId
  const district = state?.district
  const centre = state?.centre
  const districtId = state?.districtId || state?.district_id
  const centreId = state?.centreId || state?.centre_id
  const projectName = state?.projectName || 'Project'
  const fullName = isWrittenExam 
    ? `${projectName}${district ? ` - ${district}` : ''}`
    : (state?.projectLocation || projectName)

  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [aadhaarSearch, setAadhaarSearch] = useState('')
  const [designationFilter, setDesignationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    called: 0,
    interested: 0,
    pending: 0,
    required: 0
  })
  const [districtCentreStats, setDistrictCentreStats] = useState([])
  const [statsLoading, setStatsLoading] = useState(false)

  const [isDistrictChartOpen, setIsDistrictChartOpen] = useState(false)
  const [callInProgress, setCallInProgress] = useState(null)
  const [editContactLoading, setEditContactLoading] = useState(null)
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false)
  const [editContactRecipient, setEditContactRecipient] = useState(null)
  const [editContactField, setEditContactField] = useState('')
  const [editContactValue, setEditContactValue] = useState('')

  // Centre selection modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [statusToUpdate, setStatusToUpdate] = useState('')
  const [aadhaarToUpdate, setAadhaarToUpdate] = useState('')
  const [availableCentres, setAvailableCentres] = useState([])
  const [selectedNewCentre, setSelectedNewCentre] = useState('')
  const [recipientToUpdate, setRecipientToUpdate] = useState(null)

  // Modal states for new requirements
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)
  const [referralForm, setReferralForm] = useState({
    name: '', mobile: '', aadhaar: '', designation: (Array.isArray(DESIGNATION_FALLBACK_OPTIONS) && DESIGNATION_FALLBACK_OPTIONS[0]) ? String(DESIGNATION_FALLBACK_OPTIONS[0]).toLowerCase() : 'operator',
    district: districtId || district || '', 
    centre: centreId || centre || '', 
    location: locationId || locationName || ''
  })
  const [isCentreRecipientsModalOpen, setIsCentreRecipientsModalOpen] = useState(false)
  const [centreRecipients, setCentreRecipients] = useState([])
  const [modalPage, setModalPage] = useState(1)
  const [modalPageSize, setModalPageSize] = useState(10)
  const [modalTotal, setModalTotal] = useState(0)
  const [modalSearch, setModalSearch] = useState('')
  const [centreRecipientsLoading, setCentreRecipientsLoading] = useState(false)
  const [selectedCentreForView, setSelectedCentreForView] = useState(null)
  const [referralLoading, setReferralLoading] = useState(false)

  const [selectedModalRows, setSelectedModalRows] = useState(new Set())
  const [shiftProjectId, setShiftProjectId] = useState(projectId || '')
  const [shiftAreaId, setShiftAreaId] = useState(isWrittenExam ? (districtId || district || '') : (locationId || locationName || ''))
  const [shiftProjectOptions, setShiftProjectOptions] = useState({ regular: [], written: [] })
  const [shiftAreaOptions, setShiftAreaOptions] = useState([])
  const [shiftCentreOptions, setShiftCentreOptions] = useState([])
  const [targetShiftCentreId, setTargetShiftCentreId] = useState('')
  const [isShiftLoading, setIsShiftLoading] = useState(false)
  const [isShiftProjectLoading, setIsShiftProjectLoading] = useState(false)
  const [isShiftAreaLoading, setIsShiftAreaLoading] = useState(false)
  const [isShiftCentreLoading, setIsShiftCentreLoading] = useState(false)

  const { confirm, alert } = useAlert()

  const designationOptions = (Array.isArray(DESIGNATION_FALLBACK_OPTIONS) && DESIGNATION_FALLBACK_OPTIONS.length)
    ? DESIGNATION_FALLBACK_OPTIONS
    : ['Operator', 'Supervisor']
  const statusOptions = [
    'pending',
    'Call unanswered',
    'Call busy',
    'Call not reachable',
    'Not interested',
    'Interested',
    'Call back later',
    'Wrong number',
    'Others'
  ]

  const formatAadhaar = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
    return digits.replace(/(\d{4})(?=\d)/g, '$1-')
  }

  const getReferralByName = (recipient) => {
    return recipient?.referredBy || recipient?.referred_by || recipient?.['referred by'] || recipient?.referredby || recipient?.referred_by_name || recipient?.referredByName || recipient?.referrer || ''
  }

  const isReferredRecipient = (recipient) => {
    if (!recipient) return false
    const raw = recipient.referred
    const normalized = String(raw).trim().toLowerCase()
    return raw === true || raw === 1 || normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y'
  }

  const renderReferralBadge = (recipient) => {
    if (!isReferredRecipient(recipient)) return null
    const referredBy = getReferralByName(recipient)
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 38,
          height: 20,
          marginLeft: 6,
          borderRadius: 12,
          background: '#1d4ed8',
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'help',
          padding: '0 8px',
          lineHeight: 1,
          letterSpacing: '0.02em',
          textTransform: 'uppercase'
        }}
        title={referredBy ? `Referred by ${referredBy}` : 'Referred candidate'}
      >
        Ref
      </span>
    )
  }

  // Redirect if no state provided
  useEffect(() => {
    const hasValidLocation = projectType === 'written'
      ? (projectId && (districtId || district) && (centreId || centre))
      : (projectId && locationId)
    if (!hasValidLocation) {
      navigate('/app/candidate/calling')
    }
  }, [projectId, projectType, locationId, district, centre, districtId, centreId, navigate])

  const fetchCentreStats = useCallback(async () => {
    if (projectType !== 'written' || !(districtId || district)) return

    setStatsLoading(true)
    try {
      const cleanProjectId = String(projectId || '').replace(/^proj-/, '') // Assuming API expects project ID without 'proj-' prefix
      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      const res = await apiClient.getCentreCallerStats(registrationId, cleanProjectId, districtId || district) // Using the new API for centre caller statistics
      const data = res.data?.data || res.data || []
      setDistrictCentreStats(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch centre stats:', err)
      setDistrictCentreStats([])
    } finally {
      setStatsLoading(false)
    }
  }, [registrationId, projectId, districtId, district, projectType])

  const fetchRecipients = useCallback(async () => {
    const hasValidLocation = projectType === 'written'
      ? (projectId && (districtId || district) && (centreId || centre) && registrationId)
      : (projectId && locationId && registrationId)
    if (!hasValidLocation) return

    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const params = {
        search: search || undefined,
        aadhaar: aadhaarSearch || undefined,
        from: fromDate || undefined,
        status: statusFilter || undefined,
        designation: designationFilter || undefined,
        to: toDate || undefined,
        offset,
        limit: pageSize,
        caller_id: callerId
      }

      let effectiveLocationId = undefined
      if (projectType === 'written') {
        params.districtId = districtId || district
        params.centreId = centreId || centre
      } else {
        effectiveLocationId = locationId
      }

      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      const res = await apiClient.getRecipientsForProjectLocation(registrationId, projectId, effectiveLocationId, params)
      const data = res.data?.data || {}
      const items = data.items || []
      setRecipients(items)

      // Only calculate stats from metadata for regular projects; written exams use the separate endpoint
      if (projectType !== 'written') {
        const meta = data.meta || data.summary || {}
        const calledCount = meta.calledCount ?? meta.called ?? items.filter(r => r.status && r.status.toLowerCase() !== 'pending').length
        const interestedCount = meta.interestedCount ?? meta.interested ?? items.filter(r => r.status && r.status.toLowerCase() === 'interested').length
        setStats({
          total: data.total || items.length || 0,
          called: calledCount,
          interested: interestedCount,
          pending: meta.pendingCount ?? meta.pending ?? (Math.max(0, (data.total || items.length) - calledCount)),
          required: meta.requiredCount ?? meta.required ?? data.total ?? items.length ?? 0
        })
      }
      setTotal(data.total || data.meta?.total || items.length)
    } catch (err) {
      console.error('Failed to fetch recipients:', err)
      setRecipients([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [projectId, projectType, locationId, district, centre, registrationId, search, aadhaarSearch, statusFilter, designationFilter, fromDate, toDate, page, pageSize])

  useEffect(() => {
    fetchRecipients()
  }, [fetchRecipients])

  useEffect(() => {
    if (projectType === 'written') {
      fetchCentreStats()
    }
  }, [fetchCentreStats, projectType])

  const loadDistrictCentres = useCallback(async () => {
    if (!projectId || !(districtId || district)) return
    try {
      const cleanProjectId = String(projectId || '').replace(/^proj-/, '')
      const res = await recruiterAPI.getDistrictCentres(cleanProjectId, districtId || district)
      const data = res.data?.data || res.data || []
      setAvailableCentres(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load centres', err)
    }
  }, [projectId, districtId, district])

  useEffect(() => {
    if (isReferralModalOpen && isWrittenExam && availableCentres.length === 0) {
      loadDistrictCentres()
    }
  }, [isReferralModalOpen, isWrittenExam, availableCentres.length, loadDistrictCentres])

  const normalizeOptions = useCallback((payload) => {
    const rawList = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.projects)
        ? payload.projects
        : Array.isArray(payload?.locations)
          ? payload.locations
          : Array.isArray(payload?.districts)
            ? payload.districts
            : Array.isArray(payload?.centre_options)
              ? payload.centre_options
              : Array.isArray(payload?.centres)
                ? payload.centres
                : Array.isArray(payload?.location_options)
                  ? payload.location_options
                  : Array.isArray(payload?.district_options)
                    ? payload.district_options
                    : []

    return Array.isArray(rawList)
      ? rawList.map((item) => {
          if (!item) return null
          if (typeof item === 'object') {
            const id = String(item.id ?? item.projectId ?? item.project_id ?? item.districtId ?? item.locationId ?? item.centreId ?? item.value ?? item.key ?? item._id ?? '')
            const name = String(item.name ?? item.project_name ?? item.title ?? item.label ?? item.location ?? item.district ?? item.centre ?? item.value ?? id)
            return id ? { id, name } : null
          }
          const text = String(item || '')
          return text ? { id: text, name: text } : null
        }).filter(Boolean)
      : []
  }, [])

  const shiftProjectType = useMemo(() => {
    if (shiftProjectId && shiftProjectOptions.written.some((proj) => proj.id === shiftProjectId)) {
      return 'written'
    }
    if (shiftProjectId && shiftProjectOptions.regular.some((proj) => proj.id === shiftProjectId)) {
      return 'regular'
    }
    return projectType
  }, [shiftProjectId, shiftProjectOptions, projectType])

  const shiftAreaLabel = shiftProjectType === 'written' ? 'District' : 'Location'

  const fetchShiftProjectOptions = useCallback(async () => {
    setIsShiftProjectLoading(true)
    try {
      const [regularResp, writtenResp] = await Promise.all([
        recruiterAPI.getProjectSuggestions('', 200, 'regular'),
        recruiterAPI.getProjectSuggestions('', 200, 'written'),
      ])
      setShiftProjectOptions({
        regular: normalizeOptions(regularResp.data ?? regularResp),
        written: normalizeOptions(writtenResp.data ?? writtenResp),
      })
    } catch (err) {
      console.error('Failed to load project options for shift modal:', err)
      setShiftProjectOptions({ regular: [], written: [] })
    } finally {
      setIsShiftProjectLoading(false)
    }
  }, [normalizeOptions])

  const fetchShiftAreaOptions = useCallback(async (projectIdArg, isWritten) => {
    if (!projectIdArg) {
      setShiftAreaOptions([])
      return
    }
    setIsShiftAreaLoading(true)
    try {
      const response = isWritten
        ? await recruiterAPI.getProjectDistricts(projectIdArg)
        : await recruiterAPI.getProjectLocations(projectIdArg)
      setShiftAreaOptions(normalizeOptions(response.data ?? response))
    } catch (err) {
      console.error('Failed to load shift area options:', err)
      setShiftAreaOptions([])
    } finally {
      setIsShiftAreaLoading(false)
    }
  }, [normalizeOptions])

  const fetchShiftCentreOptions = useCallback(async (projectIdArg, areaIdArg) => {
    if (!projectIdArg || !areaIdArg) {
      setShiftCentreOptions([])
      return
    }
    setIsShiftCentreLoading(true)
    try {
      const response = await recruiterAPI.getDistrictCentres(projectIdArg, areaIdArg)
      setShiftCentreOptions(normalizeOptions(response.data ?? response))
    } catch (err) {
      console.error('Failed to load shift centre options:', err)
      setShiftCentreOptions([])
    } finally {
      setIsShiftCentreLoading(false)
    }
  }, [normalizeOptions])

  useEffect(() => {
    fetchShiftProjectOptions()
  }, [fetchShiftProjectOptions])

  useEffect(() => {
    if (!shiftProjectId) return
    const currentAreaId = shiftProjectId === projectId
      ? (shiftProjectType === 'written' ? (districtId || district || '') : (locationId || locationName || ''))
      : ''
    fetchShiftAreaOptions(shiftProjectId, shiftProjectType)
    setShiftAreaId(currentAreaId)
    setShiftCentreOptions([])
    setTargetShiftCentreId('')
  }, [shiftProjectId, shiftProjectType, projectId, districtId, district, locationId, locationName, fetchShiftAreaOptions])

  useEffect(() => {
    if (!shiftProjectId || !shiftAreaId) {
      setShiftCentreOptions([])
      setTargetShiftCentreId('')
      return
    }
    fetchShiftCentreOptions(shiftProjectId, shiftAreaId)
  }, [shiftProjectId, shiftAreaId, fetchShiftCentreOptions])

  const aggregatedStats = useMemo(() => {
    if (projectType !== 'written' || districtCentreStats.length === 0) return null;
    return districtCentreStats.reduce((acc, c) => ({
      required: acc.required + (Number(c.total_required || c.required) || 0),
      assigned: acc.assigned + (Number(c.total_available || c.assigned || c.called) || 0),
      ops_required: acc.ops_required + (Number(c.operators_required || c.total_operators_required) || 0),
      ops_assigned: acc.ops_assigned + (Number(c.operators_assigned || c.operators) || 0),
      sups_required: acc.sups_required + (Number(c.supervisors_required || c.total_supervisors_required) || 0),
      sups_assigned: acc.sups_assigned + (Number(c.supervisors_assigned || c.supervisors) || 0),
      vids_required: acc.vids_required + (Number(c.videographers_required || c.total_videographers_required) || 0),
      vids_assigned: acc.vids_assigned + (Number(c.videographers_assigned || c.videographers) || 0),
    }), { required: 0, assigned: 0, ops_required: 0, ops_assigned: 0, sups_required: 0, sups_assigned: 0, vids_required: 0, vids_assigned: 0 });
  }, [districtCentreStats, projectType]);

  const MetricBar = ({ current, total, color, label }) => {
    const percent = total > 0 ? Math.min(100, (current / total) * 100) : 0;
    const isOver = current > total && total > 0;
    
    return (
      <div style={{ minWidth: '140px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', fontWeight: 600 }}>
          <span style={{ color: 'var(--text3)', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ color: isOver ? 'var(--red)' : 'var(--text1)' }}>{current} / {total}</span>
        </div>
        <div style={{ height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
        </div>
      </div>
    );
  };

  const [statusComment, setStatusComment] = useState('')
  const [selectedDesignation, setSelectedDesignation] = useState((Array.isArray(DESIGNATION_FALLBACK_OPTIONS) && DESIGNATION_FALLBACK_OPTIONS[0]) ? String(DESIGNATION_FALLBACK_OPTIONS[0]).toLowerCase() : '')

  const fetchCentreRecipients = useCallback(async () => {
    if (!selectedCentreForView) return
    setCentreRecipientsLoading(true)
    try {
      const params = {
        districtId: districtId || district,
        centreId: selectedCentreForView.id || selectedCentreForView.centre_id || selectedCentreForView.centre,
        offset: (modalPage - 1) * modalPageSize,
        limit: modalPageSize,
        search: modalSearch || undefined
      }
      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      const res = await apiClient.getCentreRecipients(registrationId, projectId, params)
      const data = res.data?.data || {}
      setCentreRecipients(data.items || [])
      setModalTotal(data.total || data.meta?.total || (data.items?.length || 0))
    } catch (err) {
      console.error('Failed to fetch centre recipients:', err)
      setCentreRecipients([])
    } finally {
      setCentreRecipientsLoading(false)
    }
  }, [selectedCentreForView, modalPage, modalPageSize, modalSearch, districtId, district, registrationId, projectId])

  useEffect(() => {
    if (isCentreRecipientsModalOpen) {
      fetchCentreRecipients()
    }
  }, [isCentreRecipientsModalOpen, modalPage, modalPageSize, modalSearch, fetchCentreRecipients])

  const modalPagination = useMemo(() => {
    const lastPage = Math.max(1, Math.ceil((modalTotal || 0) / modalPageSize))
    const pageStart = Math.max(1, Math.min(modalPage - 2, Math.max(1, lastPage - 4)))
    const pageEnd = Math.min(lastPage, pageStart + 4)
    const pageNumbers = []
    for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

    const start = modalTotal === 0 ? 0 : (modalPage - 1) * modalPageSize + 1
    const end = modalTotal === 0 ? 0 : Math.min(modalPage * modalPageSize, modalTotal)

    return { lastPage, pageStart, pageEnd, pageNumbers, start, end }
  }, [modalTotal, modalPageSize, modalPage])

  useEffect(() => {
    if (modalPage > modalPagination.lastPage) setModalPage(modalPagination.lastPage)
  }, [modalTotal, modalPageSize, modalPage, modalPagination.lastPage])

  const handleViewCentreRecipients = (centreData) => {
    setSelectedCentreForView(centreData)
    setModalPage(1)
    setModalSearch('')
    setSelectedModalRows(new Set())
    setIsCentreRecipientsModalOpen(true)
    setReferralForm((prev) => ({
      ...prev,
      district: districtId || district || prev.district,
      centre: centreData?.id || centreData?.centre_id || centreData?.centre || prev.centre,
      location: locationId || locationName || prev.location,
    }))
    
    // Fetch centres for shifting if not already loaded
    if (availableCentres.length === 0 && (districtId || district)) {
      loadDistrictCentres()
    }
  }

  const openReferralModalForCentre = (centre) => {
    setReferralForm((prev) => ({
      ...prev,
      district: districtId || district || prev.district,
      centre: centre?.id || centre?.centre_id || centre?.centre || prev.centre,
      location: locationId || locationName || prev.location,
    }))
    if (isWrittenExam && availableCentres.length === 0) {
      loadDistrictCentres()
    }
    setIsReferralModalOpen(true)
  }

  const handleShiftCandidates = async () => {
    if (selectedModalRows.size === 0) {
      alert('Error', 'Please select at least one candidate.')
      return
    }
    if (!shiftProjectId) {
      alert('Error', 'Please select a project.')
      return
    }
    if (!shiftAreaId) {
      alert('Error', `Please select a ${shiftAreaLabel.toLowerCase()}.`)
      return
    }
    if (!targetShiftCentreId) {
      alert('Error', 'Please select a target centre.')
      return
    }

    setIsShiftLoading(true)
    try {
      await candidateAPI.shiftRecipients({
        recipientIds: Array.from(selectedModalRows),
        projectId,
        targetProjectId: shiftProjectId || projectId,
        targetCentreId: targetShiftCentreId,
        registrationId,
        ...(shiftProjectType === 'written' ? { districtId: shiftAreaId } : { locationId: shiftAreaId }),
      })
      setSelectedModalRows(new Set())
      fetchCentreRecipients()
      fetchCentreStats()
    } catch (err) {
      // Global toast handles error message
    } finally {
      setIsShiftLoading(false)
    }
  }

  const exportCentreRecipients = () => {
    if (!centreRecipients.length) return
    const data = centreRecipients.map((r, idx) => ({
      'S.No': idx + 1,
      'District': selectedCentreForView?.district || district || '-',
      'Centre': selectedCentreForView?.name || '-',
      'Name': r.name || r.recipientName || '-',
      'Mobile': r.phone || r.mobile || '-',
      'Aadhaar': r.aadhaar || '-',
      'Designation': r.designation || '-',
      'Status': r.status || 'pending'
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recipients')
    XLSX.writeFile(wb, `Recipients_${selectedCentreForView?.name || 'Centre'}.xlsx`)
  }

  const exportAllCentresRecipients = async () => {
    // Use districtCentreStats for written projects
    let centresToExport = projectType === 'written' ? districtCentreStats : availableCentres
    if (!centresToExport || centresToExport.length === 0) {
      alert('Error', 'No centres available to export.')
      return
    }

    // Sort centres by ascending centre IDs
    centresToExport = [...centresToExport].sort((a, b) => {
      const idA = String(a.id || a.centre_id || a.centre || a.value || '')
      const idB = String(b.id || b.centre_id || b.centre || b.value || '')
      return idA.localeCompare(idB, undefined, { numeric: true })
    })

    setCentreRecipientsLoading(true)

    // Show loading toast
    window.dispatchEvent(new CustomEvent('apiMessage', {
      detail: {
        type: 'info',
        message: 'Exporting recipients from all centres...',
        icon: '📥',
        duration: 0
      }
    }))

    const getCentreName = (centre) => centre.name || centre.label || centre.centre || centre.value || centre.centre_name || centre.centreName || centre.id || ''
    const getCentreAddress = (centre) => centre.address || centre.centre_address || centre.centreAddress || centre.address_line || centre.location || ''
    const getCentreCode = (centre) => centre.centre_code || centre.code || centre.centreCode || centre.centre_id || centre.id || centre.value || ''
    const makeCentreNameAddress = (centre) => {
      const centreName = getCentreName(centre)
      const centreAddress = getCentreAddress(centre)
      return centreAddress ? `${centreName} - ${centreAddress}` : centreName
    }

    // Sort designation helper: supervisors first, then operators
    const normalizeDesignation = (value) => String(value || '').trim().toLowerCase()
    const designationOrder = { supervisor: 0, operator: 1 }
    const sortByDesignation = (recipients) => {
      return [...recipients].sort((a, b) => {
        const desigA = normalizeDesignation(a['DESIGNATION'])
        const desigB = normalizeDesignation(b['DESIGNATION'])
        const orderA = designationOrder[desigA] !== undefined ? designationOrder[desigA] : 2
        const orderB = designationOrder[desigB] !== undefined ? designationOrder[desigB] : 2
        if (orderA !== orderB) return orderA - orderB

        const nameA = String(a['NAME'] || '').trim()
        const nameB = String(b['NAME'] || '').trim()
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
      })
    }
    const sortByCentreAndDesignation = (recipients) => {
      return [...recipients].sort((a, b) => {
        const centreA = String(a['CENTRE'] || '')
        const centreB = String(b['CENTRE'] || '')
        const centreDiff = centreA.localeCompare(centreB, undefined, { numeric: true })
        if (centreDiff !== 0) return centreDiff

        const desigA = normalizeDesignation(a['DESIGNATION'])
        const desigB = normalizeDesignation(b['DESIGNATION'])
        const orderA = designationOrder[desigA] !== undefined ? designationOrder[desigA] : 2
        const orderB = designationOrder[desigB] !== undefined ? designationOrder[desigB] : 2
        if (orderA !== orderB) return orderA - orderB

        const nameA = String(a['NAME'] || '').trim()
        const nameB = String(b['NAME'] || '').trim()
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
      })
    }

    try {
      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      if (!apiClient || typeof apiClient.getCentreRecipients !== 'function') {
        throw new Error('API client not properly initialized')
      }

      const allRows = []
      const wb = XLSX.utils.book_new()
      const headers = ['S.NO', 'DISTRICT', 'CENTRE', 'CENTRE NAME & ADDRESS', 'DESIGNATION', 'NAME', 'CONTACT NO', 'AADHAR NO']

      // Helper to sanitize sheet names (max 31 chars, remove invalid chars, ensure uniqueness)
      const usedSheetNames = new Set(['All Centres']) // Track used sheet names
      const sanitizeSheetName = (name, centreId) => {
        if (!name) name = 'Centre'
        const cleaned = String(name).replace(/[:\\/?*\[\]]+/g, ' ').trim()
        
        // Create unique name: use centre ID as suffix for guaranteed uniqueness
        // Format: "CentreName (ID)" - truncate to fit in 31 chars
        const idSuffix = centreId ? ` (${String(centreId).slice(-4)})` : ''
        const maxNameLen = 31 - idSuffix.length
        const truncated = cleaned.slice(0, Math.max(1, maxNameLen))
        const uniqueName = truncated + idSuffix
        
        // If still duplicate (unlikely), append a counter
        let finalName = uniqueName
        let counter = 1
        while (usedSheetNames.has(finalName) && counter < 100) {
          const countSuffix = ` (${counter})`
          const adjustedNameLen = 31 - countSuffix.length
          const adjustedName = truncated.slice(0, Math.max(1, adjustedNameLen))
          finalName = adjustedName + countSuffix
          counter++
        }
        
        usedSheetNames.add(finalName)
        return finalName
      }

      // For each centre, page through results to fetch everything present
      const failedCentres = []
      for (let centreIdx = 0; centreIdx < centresToExport.length; centreIdx++) {
        const centre = centresToExport[centreIdx]
        const centreId = centre.id || centre.centre_id || centre.centre || centre.value
        const centreName = getCentreName(centre)
        const centreAddress = makeCentreNameAddress(centre)
        const centreCode = getCentreCode(centre)
        if (!centreId) {
          console.warn(`Skipping centre with missing ID: ${centreName}`)
          continue
        }

        try {
          const centreRows = []
          let offset = 0
          const pageSize = 1000
          while (true) {
            const res = await apiClient.getCentreRecipients(registrationId, projectId, {
              districtId: districtId || district,
              centreId,
              offset,
              limit: pageSize
            })

            // Validate response structure
            if (!res || typeof res !== 'object') {
              throw new Error(`Invalid response from API for centre ${centreName}`)
            }

            const data = res.data?.data || res.data || {}
            const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
            
            if (!Array.isArray(items)) {
              console.warn(`Unexpected items format for centre ${centreName}, got:`, typeof items)
              break
            }

            items.forEach((r) => {
              const normalizedDesignation = normalizeDesignation(r.designation || r.role || '-')
              const row = {
                'S.NO': allRows.length + 1,
                'DISTRICT': centre.district || centre.district_name || centre.districtName || districtId || district || '-',
                'CENTRE': centreCode || centreId,
                'CENTRE NAME & ADDRESS': centreAddress,
                'DESIGNATION': normalizedDesignation || '-',
                'NAME': String(r.name || r.recipientName || r.recipient_name || '-').trim(),
                'CONTACT NO': r.phone || r.mobile || r.contact || r.phone_number || '-',
                'AADHAR NO': r.aadhaar || r.aadhaar_no || r.aadhar || r.aadhar_no || r.aadhaarNo || '-'
              }
              centreRows.push(row)
              allRows.push(row)
            })

            const received = items.length
            const total = Number(data.total || data.meta?.total || 0)
            if (received === 0) break
            // If API gives total and we've fetched all for this centre, break
            if (total > 0 && centreRows.length >= total && received < pageSize) break
            // If fewer than pageSize returned, we've reached end
            if (received < pageSize) break
            offset += pageSize
          }

          // Sort recipients by designation within this centre (supervisor first, then operator)
          const sortedCentreRows = sortByDesignation(centreRows)
          // Re-number S.NO for sorted rows
          sortedCentreRows.forEach((row, idx) => {
            row['S.NO'] = allRows.length - centreRows.length + idx + 1
          })

          // Append per-centre sheet (even if empty to be explicit)
          const sheetName = sanitizeSheetName(centreName, centreId)
          const ws = XLSX.utils.json_to_sheet(
            sortedCentreRows.length
              ? sortedCentreRows
              : [{ 'CENTRE NAME & ADDRESS': centreAddress, 'DISTRICT': centre.district || centre.district_name || centre.districtName || districtId || district || '-', 'CENTRE': centreCode || centreId, Note: 'No recipients' }],
            { header: headers }
          )
          XLSX.utils.book_append_sheet(wb, ws, sheetName)
        } catch (centreErr) {
          const centreErrMsg = centreErr?.message || String(centreErr)
          const responseStatus = centreErr?.response?.status
          const responseMessage = centreErr?.response?.data?.message || centreErr?.response?.statusText
          const fullErrDetails = `${centreErrMsg}${responseStatus ? ` (HTTP ${responseStatus})` : ''}${responseMessage ? `: ${responseMessage}` : ''}`
          
          console.error(`Failed to export centre "${centreName}" (ID: ${centreId}):`, {
            error: centreErr,
            message: centreErrMsg,
            httpStatus: responseStatus,
            responseMessage,
            centreData: { id: centreId, name: centreName }
          })
          
          failedCentres.push(`${centreName}: ${centreErrMsg}`)
          // Continue with next centre instead of failing entirely
          continue
        }
      }

      if (allRows.length === 0 && failedCentres.length > 0) {
        const failureDetails = failedCentres.slice(0, 3).join('\n')
        const moreText = failedCentres.length > 3 ? `\n...and ${failedCentres.length - 3} more` : ''
        window.dispatchEvent(new CustomEvent('apiMessage', {
          detail: {
            type: 'error',
            message: 'Failed to export centre recipients. Check details.',
            icon: '❌'
          }
        }))
        alert('Error', `Failed to fetch recipients from centres:\n${failureDetails}${moreText}`)
        return
      }

      if (allRows.length === 0) {
        window.dispatchEvent(new CustomEvent('apiMessage', {
          detail: {
            type: 'info',
            message: 'No recipients found for the centres.',
            icon: 'ℹ️'
          }
        }))
        alert('Info', 'No recipients found for the centres.')
        return
      }

      // Consolidated sheet - sort by centre then designation
      const sortedAllRows = sortByCentreAndDesignation(allRows)
      sortedAllRows.forEach((row, idx) => {
        row['S.NO'] = idx + 1
      })

      const wsAll = XLSX.utils.json_to_sheet(sortedAllRows, { header: headers })
      wb.SheetNames.unshift('All Centres')
      wb.Sheets['All Centres'] = wsAll

      XLSX.writeFile(wb, `Recipients_All_Centres.xlsx`)

      // Show success toast
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: {
          type: 'success',
          message: `✅ Downloaded ${allRows.length} recipients successfully!`,
          icon: '✅'
        }
      }))

      // Notify user if some centres had failures
      if (failedCentres.length > 0) {
        const failureDetails = failedCentres.slice(0, 2).join('\n')
        const moreText = failedCentres.length > 2 ? `\n+${failedCentres.length - 2} more` : ''
        alert('Warning', `Exported successfully, but failed for some centres:\n${failureDetails}${moreText}`)
      }
    } catch (err) {
      const errorMessage = err?.message || String(err) || 'Unknown error occurred'
      console.error('Failed to export all centres:', err)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: {
          type: 'error',
          message: 'Failed to export recipients. Please try again.',
          icon: '❌'
        }
      }))
      alert('Error', `Failed to export all centres.\n\nDetails: ${errorMessage}`)
    } finally {
      setCentreRecipientsLoading(false)
    }
  }

  const exportInterestedCandidates = () => {
    const interestedRecipients = recipients.filter(r => r.status === 'Interested')
    
    if (!interestedRecipients.length) {
      alert('Info', 'No interested candidates to export.')
      return
    }

    const data = interestedRecipients.map((r, idx) => ({
      'S.No': idx + 1,
      'Name': r.name || r.recipientName || '-',
      'Mobile': r.phone || r.mobile || r.mobile_number || r.phone_number || '-',
      'Aadhaar': r.aadhaar || '-',
      'Designation': r.designation || '-',
      'Status': r.status || '-'
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Interested Candidates')
    XLSX.writeFile(wb, `Interested_Candidates_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleAddReferral = async (e) => {
    e.preventDefault()
    if (!referralForm.name || !referralForm.mobile) {
      alert('Error', 'Name and Mobile are required.')
      return
    }
    setReferralLoading(true)
    try {
      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      const payload = {
        ...referralForm,
        projectId,
        projectType,
        referredBy: registrationId,
        location: isWrittenExam ? undefined : referralForm.location,
        district: isWrittenExam ? referralForm.district : undefined,
        centre: isWrittenExam ? referralForm.centre : undefined,
      }
      await apiClient.addReferralCandidate(payload)
      setIsReferralModalOpen(false) // Only reached if API returns success: true
      fetchRecipients()
    } catch (err) {
      // Global toast handles error message
    } finally {
      setReferralLoading(false)
    }
  }

  const handleMakeCall = async (recipient, recipientPhone) => {
    const recipientId = recipient.id || recipient.recipientId || recipient.recipient_id
    const recipientName = recipient.name || recipient.recipientName || recipient.recipient_name || 'Recipient'
    const mobile = recipient.phone || recipient.mobile || recipient.mobile_number || recipient.phone_number || recipientPhone

    setCallInProgress(recipientId)
    try {
      const callPayload = {
        recipientId,
        name: recipientName,
        mobile,
        projectId,
        projectType,
        timestamp: new Date().toISOString(),
        status: 'initiated'
      }
      if (projectType === 'written') {
        // prefer ids when available
        if (districtId) callPayload.districtId = districtId
        if (centreId) callPayload.centreId = centreId
        // include names as fallback/for readability
        if (district && !districtId) callPayload.district = district
        if (centre && !centreId) callPayload.centre = centre
      } else {
        callPayload.locationId = locationId
        callPayload.location = locationName
      }
      await candidateAPI.makeCall(registrationId, recipientId, callPayload)

      // On mobile devices, open the phone dialer to initiate the call
      try {
        const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        if (isMobile && mobile) {
          // small delay so UI updates/alerts are visible before switching
          setTimeout(() => { window.location.href = `tel:${mobile}` }, 200)
        }
      } catch (e) {
        // ignore
      }
      fetchRecipients()
    } catch (err) {
      console.error('Failed to make call:', err)
    } finally {
      setCallInProgress(null)
    }
  }

  const handleOpenStatusModal = async (recipient) => {
    const currentStatus = recipient.status || 'pending'
    const selectedOption = statusOptions.includes(currentStatus) ? currentStatus : 'Others'
    const customStatus = selectedOption === 'Others' ? currentStatus : ''

    setRecipientToUpdate(recipient);
    setStatusToUpdate(selectedOption === 'Others' ? customStatus : selectedOption);
    setStatusComment(recipient.comment || ''); // Pre-fill comment if it exists
    setAadhaarToUpdate(recipient.aadhaar || '');
    if (projectType === 'written' && availableCentres.length === 0) {
      loadDistrictCentres()
    }
    setSelectedDesignation(recipient.designation || 'operator')
    setSelectedNewCentre(recipient.centreId || '')
    setIsStatusModalOpen(true)
  }

  const performStatusUpdate = async (recipient, status, extraData = {}) => {
    const recipientId = recipient.id || recipient.recipientId || recipient.recipient_id
    const recipientName = recipient.name || recipient.recipientName || recipient.recipient_name || 'Recipient'
    const mobile = recipient.phone || recipient.mobile || recipient.mobile_number || recipient.phone_number || ''

    // Pre-fill selectedNewCentre if recipient has centreId and status is 'Interested'
    if (status === 'Interested' && recipient.centreId) {
      setSelectedNewCentre(recipient.centreId);
    }
  }

  const handleUpdateStatus = async () => {
    if (!statusToUpdate || !recipientToUpdate) return

    const extra = {
      comment: statusComment,
      designation: selectedDesignation,
    }

    if (statusToUpdate === 'Interested') {
            if (!aadhaarToUpdate || aadhaarToUpdate.length !== 12) {
        alert('Error', 'Please enter a valid 12-digit Aadhaar number.')
        return
      }
      if (projectType === 'written') {
        if (!selectedNewCentre) {
          alert('Error', 'Please select a centre for Interested candidates.')
          return
        }
        const centreObj = availableCentres.find(c => String(c.id || c.value) === selectedNewCentre)
        extra.interestedCentreId = selectedNewCentre
        extra.interestedCentreName = centreObj?.name || centreObj?.label || selectedNewCentre
      }
    }

    try {
      const recipientId = recipientToUpdate.id || recipientToUpdate.recipientId || recipientToUpdate.recipient_id
      const statusPayload = {
        recipientId,
        name: recipientToUpdate.name || recipientToUpdate.recipientName || 'Recipient',
        mobile: recipientToUpdate.phone || recipientToUpdate.mobile || '',
        status: statusToUpdate,
        projectId,
        projectType,
        timestamp: new Date().toISOString(),
        aadhaar: statusToUpdate === 'Interested'
          ? aadhaarToUpdate
          : recipientToUpdate.aadhaar || undefined,
        ...extra
      }

      if (projectType === 'written') {
        if (districtId) statusPayload.districtId = districtId
        if (centreId) statusPayload.centreId = centreId
        if (district && !districtId) statusPayload.district = district
        if (centre && !centreId) statusPayload.centre = centre
      } else {
        statusPayload.locationId = locationId
        statusPayload.location = locationName
      }

      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      await apiClient.updateRecipientStatus(registrationId, recipientId, statusPayload)
      setIsStatusModalOpen(false)
      fetchRecipients()
      if (isCentreRecipientsModalOpen) {
        fetchCentreRecipients()
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleEditContact = (recipient, field) => {
    let currentValue = ''
    if (field === 'name') {
      currentValue = recipient.name || recipient.recipientName || recipient.recipient_name || ''
    } else if (field === 'mobile') {
      currentValue = recipient.phone || recipient.mobile || recipient.mobile_number || recipient.phone_number || ''
    } else if (field === 'aadhaar') {
      currentValue = recipient.aadhaar || ''
    } else if (field === 'designation') {
      currentValue = recipient.designation || ''
    }

    setEditContactRecipient(recipient)
    setEditContactField(field)
    setEditContactValue(currentValue)
    setIsEditContactModalOpen(true)
  }

  const handleSaveContact = async () => {
    if (!editContactRecipient || !editContactField) return

    const recipientId = editContactRecipient.id || editContactRecipient.recipientId || editContactRecipient.recipient_id
    const candidateId = editContactRecipient.candidateId || editContactRecipient.candidate_id || recipientId
    const userId = editContactRecipient.userId || editContactRecipient.user_id || user?.userId || user?.user_id || null
    const value = editContactValue.trim()
    if (!value) {
      let errorMessage = 'Value cannot be empty.'
      if (editContactField === 'name') errorMessage = 'Name cannot be empty.'
      else if (editContactField === 'mobile') errorMessage = 'Phone number cannot be empty.'
      else if (editContactField === 'aadhaar') errorMessage = 'Aadhaar number cannot be empty.'
      else if (editContactField === 'designation') errorMessage = 'Designation cannot be empty.'
      alert('Error', errorMessage)
      return
    }

    let normalizedValue = value
    if (editContactField === 'mobile') {
      normalizedValue = String(value).replace(/\D/g, '')
      if (normalizedValue.length < 10) {
        alert('Error', 'Please enter a valid 10-digit phone number.')
        return
      }
    }

    if (editContactField === 'aadhaar') {
      normalizedValue = String(value).replace(/\D/g, '').slice(0, 12)
      if (normalizedValue.length < 12) {
        alert('Error', 'Please enter a valid 12-digit Aadhaar number.')
        return
      }
    }

    let changedFrom = ''
    if (editContactField === 'name') {
      changedFrom = editContactRecipient.name || editContactRecipient.recipientName || editContactRecipient.recipient_name || ''
    } else if (editContactField === 'mobile') {
      changedFrom = editContactRecipient.phone || editContactRecipient.mobile || editContactRecipient.mobile_number || editContactRecipient.phone_number || ''
    } else if (editContactField === 'aadhaar') {
      changedFrom = editContactRecipient.aadhaar || ''
    } else if (editContactField === 'designation') {
      changedFrom = editContactRecipient.designation || ''
    }

    const changeLabel = editContactField === 'name'
      ? 'Name'
      : editContactField === 'mobile'
      ? 'Phone Number'
      : editContactField === 'aadhaar'
      ? 'Aadhaar Number'
      : 'Designation'

    setEditContactLoading(recipientId)
    try {
      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      const payload = {
        id: recipientId,
        candidateId,
        whatChanged: changeLabel,
        changedFrom: changedFrom,
        changedTo: normalizedValue,
        field: editContactField,
        userId: userId || undefined,
      }

      if (projectType === 'written') {
        if (districtId) payload.districtId = districtId
        if (centreId) payload.centreId = centreId
      } else {
        if (locationId) payload.locationId = locationId
        if (locationName) payload.location = locationName
      }

      const registrationArg = userId ? null : registrationId
      await apiClient.updateRecipientContact(registrationArg, recipientId, payload)
      setIsEditContactModalOpen(false)
      fetchRecipients()
      if (isCentreRecipientsModalOpen) {
        fetchCentreRecipients()
      }
    } catch (err) {
      console.error('Failed to update recipient contact:', err)
    } finally {
      setEditContactLoading(null)
    }
  }

  const parseDateTime = (rawDate) => {
    if (!rawDate) return { date: '-', time: '-' }
    const normalized = typeof rawDate === 'string' ? rawDate.trim().replace(/\s+/g, 'T') : rawDate
    const dateObj = rawDate instanceof Date ? rawDate : new Date(normalized)
    if (Number.isNaN(dateObj.getTime())) return { date: String(rawDate), time: '-' }

    const date = dateObj.toLocaleDateString('en-IN')
    const time = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    return { date, time }
  }

  const columns = showCallButtons
    ? ['S.No', 'Name', 'Phone', 'Aadhaar', 'Designation', 'Date', 'Time', 'Status', 'Actions']
    : ['S.No', 'Name', 'Phone', 'Aadhaar', 'Designation', 'Date', 'Time', 'Status']

  const rows = recipients.map((r, idx) => {
    const startIndex = (page - 1) * pageSize
    const recipientId = r.id || r.recipientId || r.recipient_id
    const recipientName = r.name || r.recipientName || r.recipient_name || '-'
    const recipientPhone = r.phone || r.mobile || r.mobile_number || r.phone_number || '-'
    const parsedDate = parseDateTime(r.date)
    const isCalling = callInProgress === recipientId
    const isEditingContact = editContactLoading === recipientId
    const commonCells = [
      startIndex + idx + 1,
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipientName}</span>
        {renderReferralBadge(r)}
        <button
          type="button"
          className="btn btn-link btn-sm"
          title="Edit name"
          onClick={() => handleEditContact(r, 'name')}
          disabled={isEditingContact}
          style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
        >
          <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
        </button>
      </div>,
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipientPhone}</span>
        <button
          type="button"
          className="btn btn-link btn-sm"
          title="Edit phone"
          onClick={() => handleEditContact(r, 'mobile')}
          disabled={isEditingContact}
          style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
        >
          <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
        </button>
      </div>,
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.aadhaar ? formatAadhaar(r.aadhaar) : '—'}</span>
        {r.aadhaar && (
          <button
            type="button"
            className="btn btn-link btn-sm"
            title="Edit Aadhaar"
            onClick={() => handleEditContact(r, 'aadhaar')}
            disabled={isEditingContact}
            style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
          >
            <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
          </button>
        )}
      </div>,
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.designation || '-'}</span>
        <button
          type="button"
          className="btn btn-link btn-sm"
          title="Edit Designation"
          onClick={() => handleEditContact(r, 'designation')}
          disabled={isEditingContact}
          style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
        >
          <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
        </button>
      </div>,
      parsedDate.date,
      parsedDate.time,
      <span
        style={{ cursor: 'pointer', textDecoration: 'underline', color: r.status ? '#666' : '#999' }}
        onClick={() => handleOpenStatusModal(r)}
        title="Click to update status"
      >
        {r.status || 'pending'}
      </span>
    ]

    if (!showCallButtons) {
      return commonCells
    }

    return [
      ...commonCells,
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary btn-sm"
          title="Make call"
          onClick={() => handleMakeCall(r)}
          disabled={isCalling}
          style={{ padding: '4px 8px', fontSize: '11px' }}
        >
          {isCalling ? 'Calling...' : '📞 Call'}
        </button>
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
    const lp = Math.max(1, Math.ceil((total || 0) / pageSize))
    if (page > lp) setPage(lp)
  }, [total, pageSize, page])

  return (
    <div className="recipient-calling-page">
      <PageHeader 
        title={fullName}
        subtitle="Call recipients and update their status"
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsReferralModalOpen(true)}>
              <FontAwesomeIcon icon={faUserPlus} /> Add Referral Candidate
            </button>
            <button 
              className="btn btn-outline btn-sm"
              onClick={handleBack}
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              <FontAwesomeIcon icon={faArrowLeft} /> Back
            </button>
          </div>
        }
      />

      {projectType === 'written' && aggregatedStats ? (
        <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <div className="stat-card-wrapper">
            <StatCard icon="📊" value={`${aggregatedStats.assigned} / ${aggregatedStats.required}`} label="Overall Mandays (Assigned/Req)" />
          </div>
          <div className="stat-card-wrapper">
            <StatCard icon="⌨️" value={`${aggregatedStats.ops_assigned} / ${aggregatedStats.ops_required}`} label="Operators (Assigned/Req)" />
          </div>
          <div className="stat-card-wrapper">
            <StatCard icon="🧑‍💼" value={`${aggregatedStats.sups_assigned} / ${aggregatedStats.sups_required}`} label="Supervisors (Assigned/Req)" />
          </div>
          <div className="stat-card-wrapper">
            <StatCard icon="📹" value={`${aggregatedStats.vids_assigned} / ${aggregatedStats.vids_required}`} label="Videographers (Assigned/Req)" />
          </div>
        </div>
      ) : (
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card-wrapper"><StatCard icon="📋" value={stats.required} label="Total Required" /></div>
          <div className="stat-card-wrapper"><StatCard icon="📞" value={stats.called} label="Calls Made" /></div>
          <div className="stat-card-wrapper"><StatCard icon="🌟" value={stats.interested} label="Interested" /></div>
          <div className="stat-card-wrapper"><StatCard icon="⏳" value={stats.pending} label="Pending" /></div>
        </div>
      )}

      {/* District Centres Overview Chart */}
      {projectType === 'written' && districtCentreStats.length > 0 && !statsLoading && (
        <Card style={{ marginBottom: 20 }}>
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '16px', 
              cursor: 'pointer',
              borderBottom: isDistrictChartOpen ? '1px solid #e2e8f0' : 'none'
            }}
            onClick={() => setIsDistrictChartOpen(!isDistrictChartOpen)}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Centre-wise Allocation ({district || districtId})</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }}></span> Mandays
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488' }}></span> Operators
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }}></span> Supervisors
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }}></span> Videographers
                </div>
              </div>
            <FontAwesomeIcon icon={isDistrictChartOpen ? faChevronUp : faChevronDown} style={{ color: 'var(--text3)' }} />
            </div>
          </div>
          
          {isDistrictChartOpen && (
            <div style={{ padding: '16px' }}>
              <div className="centre-stats-scroll" style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1, borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>Centre Details</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>Allocation Progress (Assigned / Required)</th>
                      <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text3)', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districtCentreStats.map((c, idx) => {
                      const req = Number(c.total_required || c.required || 0);
                      const asg = Number(c.total_available || c.assigned || c.called || 0);
                      const oReq = Number(c.operators_required || c.total_operators_required || 0);
                      const oAsg = Number(c.operators_assigned || c.operators || 0);
                      const sReq = Number(c.supervisors_required || c.total_supervisors_required || 0);
                      const sAsg = Number(c.supervisors_assigned || c.supervisors || 0);
                      const vReq = Number(c.videographers_required || c.total_videographers_required || 0);
                      const vAsg = Number(c.videographers_assigned || c.videographers || 0);
                      
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="centre-stat-row">
                          <td style={{ padding: '16px', verticalAlign: 'top', width: '30%' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text1)', marginBottom: 4 }}>{c.name || c.centre || 'Unknown'}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>ID: {c.id || c.centre_id || '-'}</div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px 24px' }}>
                              <MetricBar label="Overall" current={asg} total={req} color="#3b82f6" />
                              <MetricBar label="Operators" current={oAsg} total={oReq} color="#0d9488" />
                              <MetricBar label="Supervisors" current={sAsg} total={sReq} color="#d97706" />
                              <MetricBar label="Videographers" current={vAsg} total={vReq} color="#8b5cf6" />
                            </div>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <button 
                              className="btn btn-outline btn-sm"
                              onClick={() => handleViewCentreRecipients(c)}
                            >
                              <FontAwesomeIcon icon={faEye} /> View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title={`Recipients (${total})`} action={(
          <div className="callers-filters">
            <div className="callers-search-group">
              <input 
                className="form-control" 
                placeholder="Search by name or phone" 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1) }} 
              />
              <input 
                className="form-control" 
                placeholder="Search by Aadhaar" 
                value={aadhaarSearch} 
                onChange={(e) => { setAadhaarSearch(e.target.value.replace(/\D/g, '').slice(0, 12)); setPage(1) }} 
              />
              <select 
                className="form-control"
                value={designationFilter}
                onChange={(e) => { setDesignationFilter(e.target.value); setPage(1) }}
              >
                <option value="">All Designations</option>
                {designationOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <select 
                className="form-control"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              >
                <option value="">All Statuses</option>
                {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <div className="date-filter-group">
                <label htmlFor="fromDate" className="date-filter-label">From Date</label>
                <input 
                  id="fromDate"
                  type="date" 
                  className="form-control" 
                  value={fromDate} 
                  onChange={(e) => { setFromDate(e.target.value); setPage(1) }} 
                />
              </div>
              <div className="date-filter-group">
                <label htmlFor="toDate" className="date-filter-label">To Date</label>
                <input 
                  id="toDate"
                  type="date" 
                  className="form-control" 
                  value={toDate} 
                  onChange={(e) => { setToDate(e.target.value); setPage(1) }} 
                />
              </div>
              <select 
                className="form-control" 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              {showExportExcel && projectType === 'written' && (
                <button className="btn btn-secondary btn-sm" onClick={exportAllCentresRecipients} disabled={districtCentreStats.length === 0 || centreRecipientsLoading} style={{ marginLeft: 8 }}>
                  <FontAwesomeIcon icon={faFileExcel} /> Export All Centres
                </button>
              )}
              {projectType === 'regular' && (
                <button className="btn btn-secondary btn-sm" onClick={exportInterestedCandidates} disabled={recipients.filter(r => r.status === 'Interested').length === 0} style={{ marginLeft: 8 }}>
                  <FontAwesomeIcon icon={faFileExcel} /> Export Interested
                </button>
              )}
            </div>
          </div>
        )} />

        {/* Mobile-first card list (shown on small screens) */}
        <div className="mobile-only">
          {loading ? (
            <div style={{ padding: 16, color: 'var(--text3)' }}>Loading recipients…</div>
          ) : recipients.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text3)' }}>No recipients found for this project-location.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recipients.map((r, idx) => {
                const recipientId = r.id || r.recipientId || r.recipient_id
                const recipientName = r.name || r.recipientName || r.recipient_name || '-'
                const mobile = r.phone || r.mobile || r.mobile_number || r.phone_number || '-'
                const parsedDate = parseDateTime(r.date)
                const date = parsedDate.date
                const time = parsedDate.time
                const status = r.status || 'pending'
                const isCalling = callInProgress === recipientId
                const initials = recipientName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
                const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)

                return (
                  <div key={recipientId || idx} className="recipient-card" style={{ padding: 14, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.14)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                          {initials || 'NA'}
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipientName}</span>
                              {renderReferralBadge(r)}
                            </div>
                            <button
                              type="button"
                              className="btn btn-link btn-sm"
                              title="Edit name"
                              onClick={() => handleEditContact(r, 'name')}
                              disabled={editContactLoading === recipientId}
                              style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                            >
                              <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
                            </button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--text3)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span>{mobile}</span>
                            <button
                              type="button"
                              className="btn btn-link btn-sm"
                              title="Edit phone"
                              onClick={() => handleEditContact(r, 'mobile')}
                              disabled={editContactLoading === recipientId}
                              style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                            >
                              <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
                            </button>
                          </div>
                          {r.aadhaar && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', fontSize: 12, marginBottom: 2 }}>
                              <span>{formatAadhaar(r.aadhaar)}</span>
                              <button
                                type="button"
                                className="btn btn-link btn-sm"
                                title="Edit Aadhaar"
                                onClick={() => handleEditContact(r, 'aadhaar')}
                                disabled={editContactLoading === recipientId}
                                style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                              >
                                <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 11 }} />
                              </button>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, color: 'var(--text3)', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>{r.designation || 'NA'}</span>
                              <button
                                type="button"
                                className="btn btn-link btn-sm"
                                title="Edit Designation"
                                onClick={() => handleEditContact(r, 'designation')}
                                disabled={editContactLoading === recipientId}
                                style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                              >
                                <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 11 }} />
                              </button>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{date}{time !== '-' ? ` • ${time}` : ''}</span>
                            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(148, 163, 184, 0.12)', color: 'var(--text3)', fontSize: 10, fontWeight: 600, textTransform: 'capitalize' }}>{statusLabel}</span>
                          </div>
                        </div>
                      </div>

                      {showCallButtons && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ width: 44, height: 44, padding: 0, borderRadius: '50%', fontSize: 18, display: 'grid', placeItems: 'center' }}
                          onClick={() => handleMakeCall(r)}
                          disabled={isCalling}
                          title={`Call ${recipientName}`}
                        >
                          {isCalling ? '…' : '📞'}
                        </button>
                      )}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpenStatusModal(r)} style={{ padding: '8px 12px', width: '100%', textTransform: 'capitalize' }}>{statusLabel}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="desktop-only">
          <DataTable 
            columns={columns} 
            rows={rows} 
            emptyMessage={loading ? 'Loading recipients…' : 'No recipients found for this project-location.'}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: '12px' }}>
            {total === 0 ? `Showing 0 of 0` : `Showing ${start} - ${end} of ${total}`}
          </div>
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
                <button className="pagination-page-btn" type="type" onClick={() => setPage(totalPages)}>{totalPages}</button>
              )}
            </div>

            <button className="lastprev pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            <button className="lastprev pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last</button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Update Candidate Status"
        maxWidth="540px"
        zIndex={11500}
      >
        <div style={{ padding: '8px 0' }}>
          <FormField label="Call Status">
            <select className="form-control" value={statusToUpdate} onChange={(e) => setStatusToUpdate(e.target.value)}>
              <option value="">Select status...</option>
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </FormField>

          {statusToUpdate === 'Interested' && (
            <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px', fontWeight: 600 }}>
                Preferred assignment in {district || 'the current district'}:
              </p>
              
              <FormField label="Designation">
                <div className="designation-toggle-tabs">
                  <button 
                    className={`dt-tab ${selectedDesignation === 'operator' ? 'active' : ''}`}
                    onClick={() => setSelectedDesignation('operator')}
                  >
                    Operator
                  </button>
                  <button 
                    className={`dt-tab ${selectedDesignation === 'supervisor' ? 'active' : ''}`}
                    onClick={() => setSelectedDesignation('supervisor')}
                  >
                    Supervisor
                  </button>
                </div>
              </FormField>

              <FormField label="Aadhaar Number *">
                <input 
                  type="text" 
                  className="form-control" 
                  value={aadhaarToUpdate} 
                  onChange={(e) => setAadhaarToUpdate(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="12-digit Aadhaar number"
                />
              </FormField>

              {projectType === 'written' && (
                <FormField label="Preferred Centre">
                  <select 
                    className="form-control"
                    value={selectedNewCentre}
                    onChange={(e) => setSelectedNewCentre(e.target.value)}
                  >
                    <option value="">Choose a centre...</option>
                    {availableCentres.map(c => (
                      <option key={c.id || c.value} value={c.id || c.value}>
                        {c.name || c.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
            </div>
          )}

          <FormField label="Comments (Optional)" style={{ marginTop: 20 }}>
            <textarea 
              className="form-control" 
              rows={3} 
              placeholder="Type any internal notes or feedback from the call..."
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsStatusModalOpen(false)}>Cancel</button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleUpdateStatus} 
              disabled={!statusToUpdate}
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isEditContactModalOpen}
        onClose={() => setIsEditContactModalOpen(false)}
        title={editContactField === 'name' ? 'Edit Recipient Name' : editContactField === 'mobile' ? 'Edit Recipient Phone' : editContactField === 'aadhaar' ? 'Edit Aadhaar Number' : 'Edit Designation'}
        maxWidth="520px"
        zIndex={11500}
      >
        <div style={{ padding: '8px 0' }}>
          <FormField label={editContactField === 'name' ? 'Full Name' : editContactField === 'mobile' ? 'Phone Number' : editContactField === 'aadhaar' ? 'Aadhaar Number' : 'Designation'}>
            {editContactField === 'designation' ? (
              <select
                className="form-control"
                value={editContactValue}
                onChange={(e) => setEditContactValue(e.target.value)}
              >
                <option value="">Select designation...</option>
                {designationOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={editContactField === 'name' ? 'text' : editContactField === 'aadhaar' ? 'text' : 'tel'}
                className="form-control"
                value={editContactValue}
                onChange={(e) => {
                  if (editContactField === 'aadhaar') {
                    setEditContactValue(e.target.value.replace(/\D/g, '').slice(0, 12))
                  } else if (editContactField === 'mobile') {
                    setEditContactValue(e.target.value.replace(/\D/g, '').slice(0, 10))
                  } else {
                    setEditContactValue(e.target.value)
                  }
                }}
                placeholder={editContactField === 'name' ? 'Enter full name' : editContactField === 'aadhaar' ? 'Enter 12-digit Aadhaar number' : 'Enter 10-digit phone number'}
                maxLength={editContactField === 'mobile' ? 10 : editContactField === 'aadhaar' ? 12 : 100}
              />
            )}
          </FormField>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsEditContactModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveContact}
              disabled={!editContactValue.trim() || editContactLoading}
            >
              {editContactLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Centre Recipients View Modal */}
      <Modal
        isOpen={isCentreRecipientsModalOpen}
        onClose={() => setIsCentreRecipientsModalOpen(false)}
        title={`Recipients - ${selectedCentreForView?.name || 'Centre'}`}
        maxWidth="1000px"
      >
        <div className="modal-filter-header" style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filter-search-box" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
            <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
            <input 
              className="form-control" 
              placeholder="Search in this centre..." 
              value={modalSearch} 
              onChange={e => { setModalSearch(e.target.value); setModalPage(1) }} 
            />
          </div>
          <div className="entries-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text3)' }}>Show</label>
            <select 
              className="form-control" 
              style={{ width: '80px', padding: '4px 8px' }}
              value={modalPageSize} 
              onChange={(e) => { setModalPageSize(Number(e.target.value)); setModalPage(1) }}
            >
              {[5, 10, 25, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text3)' }}>entries</label>
          </div>
          {showExportExcel && (
            <button className="btn btn-secondary btn-sm" onClick={exportCentreRecipients} disabled={!centreRecipients.length}>
              <FontAwesomeIcon icon={faFileExcel} /> Export Excel
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openReferralModalForCentre(selectedCentreForView)}
            disabled={!selectedCentreForView}
          >
            <FontAwesomeIcon icon={faUserPlus} /> Add Referral Candidate
          </button>
        </div>

        {/* Mobile View for Modal Recipients */}
        <div className="mobile-only" style={{ marginBottom: '16px' }}>
          {centreRecipientsLoading ? (
            <div style={{ padding: 16, color: 'var(--text3)' }}>Loading recipients…</div>
          ) : centreRecipients.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text3)' }}>No candidates found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {centreRecipients.map((r, idx) => {
                const rid = r.id || r.recipientId;
                const isSelected = selectedModalRows.has(rid);
                return (
                  <div key={rid || idx} style={{ padding: 14, borderRadius: 12, background: 'var(--card)', border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        const next = new Set(selectedModalRows)
                        if (e.target.checked) next.add(rid)
                        else next.delete(rid)
                        setSelectedModalRows(next)
                      }}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name || r.recipientName || '-'}</span>
                          {renderReferralBadge(r)}
                        </div>
                        <button
                          type="button"
                          className="btn btn-link btn-sm"
                          title="Edit name"
                          onClick={() => handleEditContact(r, 'name')}
                          style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                        >
                          <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--text3)', fontSize: '12px' }}>
                        <span>{r.phone || r.mobile || '-'}</span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm"
                          title="Edit phone"
                          onClick={() => handleEditContact(r, 'mobile')}
                          style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                        >
                          <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
                        </button>
                      </div>
                      {r.aadhaar && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--text3)', fontSize: '12px', marginTop: 4 }}>
                          <span>{formatAadhaar(r.aadhaar)}</span>
                          <button
                            type="button"
                            className="btn btn-link btn-sm"
                            title="Edit Aadhaar"
                            onClick={() => handleEditContact(r, 'aadhaar')}
                            style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                          >
                            <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                           <span style={{ fontSize: 10, color: 'var(--text3)', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>{r.designation || 'NA'}</span>
                           <button
                             type="button"
                             className="btn btn-link btn-sm"
                             title="Edit Designation"
                             onClick={() => handleEditContact(r, 'designation')}
                             style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                           >
                             <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 10 }} />
                           </button>
                         </div>
                         <span
                           style={{ cursor: 'pointer' }}
                           onClick={() => handleOpenStatusModal(r)}
                           title="Click to update status"
                         >
                           <Tag variant={r.status === 'Interested' ? 'green' : 'gray'} style={{ fontSize: '10px' }}>{r.status || 'pending'}</Tag>
                         </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop View for Modal Recipients */}
        <div className="desktop-only">
        <DataTable 
          columns={[
            <input 
              type="checkbox" 
              checked={centreRecipients.length > 0 && selectedModalRows.size === centreRecipients.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedModalRows(new Set(centreRecipients.map(r => r.id || r.recipientId)))
                } else {
                  setSelectedModalRows(new Set())
                }
              }}
            />,
            'Name', 'Mobile', 'Aadhaar', 'Designation', 'Status'
          ]}
          rows={centreRecipients.map(r => {
            const rid = r.id || r.recipientId
            const rName = r.name || r.recipientName || r.recipient_name || '-'
            const rPhone = r.phone || r.mobile || r.mobile_number || r.phone_number || '-'
            return [
              <input 
                type="checkbox" 
                checked={selectedModalRows.has(rid)}
                onChange={(e) => {
                  const next = new Set(selectedModalRows)
                  if (e.target.checked) next.add(rid)
                  else next.delete(rid)
                  setSelectedModalRows(next)
                }}
              />,
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rName}</span>
              {renderReferralBadge(r)}
              <button
                type="button"
                className="btn btn-link btn-sm"
                title="Edit name"
                onClick={() => handleEditContact(r, 'name')}
                style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
              >
                <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
              </button>
            </div>,
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rPhone}</span>
              <button
                type="button"
                className="btn btn-link btn-sm"
                title="Edit phone"
                onClick={() => handleEditContact(r, 'mobile')}
                style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
              >
                <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
              </button>
            </div>,
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.aadhaar ? formatAadhaar(r.aadhaar) : '-'}</span>
              {r.aadhaar && (
                <button
                  type="button"
                  className="btn btn-link btn-sm"
                  title="Edit Aadhaar"
                  onClick={() => handleEditContact(r, 'aadhaar')}
                  style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                >
                  <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
                </button>
              )}
            </div>,
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.designation || '-'}</span>
              <button
                type="button"
                className="btn btn-link btn-sm"
                title="Edit Designation"
                onClick={() => handleEditContact(r, 'designation')}
                style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
              >
                <FontAwesomeIcon icon={faPencilAlt} style={{ fontSize: 12 }} />
              </button>
            </div>,
            <span
              style={{ cursor: 'pointer', display: 'inline-flex' }}
              onClick={() => handleOpenStatusModal(r)}
              title="Click to update status"
            >
              <Tag variant={r.status === 'Interested' ? 'green' : 'gray'}>{r.status || 'pending'}</Tag>
            </span>
          ]})}
          emptyMessage={centreRecipientsLoading ? 'Loading recipients...' : 'No candidates found.'}
        />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
            Showing {modalPagination.start} – {modalPagination.end} of {modalTotal} entries
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="recipient-calling-page">
            <button className="firstprev pagination-page-btn btn btn-outline btn-sm" type="button" disabled={modalPage === 1} onClick={() => setModalPage(1)}>First</button>
            <button className="firstprev pagination-page-btn btn btn-outline btn-sm" type="button" disabled={modalPage === 1} onClick={() => setModalPage((p) => Math.max(1, p - 1))}>Prev</button>

            <div className="pagination-pages" style={{ display: 'flex', gap: '4px' }}>
              {modalPagination.pageStart > 1 && (
                <>
                  <button className="pagination-page-btn btn btn-outline btn-sm" type="button" onClick={() => setModalPage(1)}>1</button>
                  {modalPagination.pageStart > 2 && <span className="pagination-ellipsis">…</span>}
                </>
              )}

              {modalPagination.pageNumbers.map((pnum) => (
                <button 
                  key={pnum} 
                  className={`pagination-page-btn btn btn-sm ${pnum === modalPage ? 'btn-primary' : 'btn-outline'}`} 
                  type="button" 
                  onClick={() => setModalPage(pnum)}
                >
                  {pnum}
                </button>
              ))}

              {modalPagination.pageEnd < modalPagination.lastPage - 1 && <span className="pagination-ellipsis">…</span>}
              {modalPagination.pageEnd < modalPagination.lastPage && (
                <button className="pagination-page-btn btn btn-outline btn-sm" type="button" onClick={() => setModalPage(modalPagination.lastPage)}>{modalPagination.lastPage}</button>
              )}
            </div>

            <button className="lastprev pagination-page-btn btn btn-outline btn-sm" type="button" disabled={modalPage === modalPagination.lastPage} onClick={() => setModalPage((p) => Math.min(modalPagination.lastPage, p + 1))}>Next</button>
            <button className="lastprev pagination-page-btn btn btn-outline btn-sm" type="button" disabled={modalPage === modalPagination.lastPage} onClick={() => setModalPage(modalPagination.lastPage)}>Last</button>
          </div>
        </div>

        {/* Shift Candidates Section */}
        <div style={{ marginTop: 24, padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 12 }}>Shift Selected Candidates</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Project</label>
              <select
                className="form-control"
                value={shiftProjectId}
                onChange={(e) => setShiftProjectId(e.target.value)}
              >
                <option value="">Select a project...</option>
                <optgroup label="Written Projects">
                  {shiftProjectOptions.written.map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Regular Projects">
                  {shiftProjectOptions.regular.map((proj) => (
                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>{shiftAreaLabel}</label>
              <select
                className="form-control"
                value={shiftAreaId}
                onChange={(e) => setShiftAreaId(e.target.value)}
                disabled={!shiftProjectId || isShiftAreaLoading}
              >
                <option value="">Select {shiftAreaLabel.toLowerCase()}...</option>
                {shiftAreaOptions.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Target Centre</label>
              <select 
                className="form-control" 
                value={targetShiftCentreId} 
                onChange={e => setTargetShiftCentreId(e.target.value)}
                disabled={!shiftAreaId || isShiftCentreLoading}
              >
                <option value="">Select target centre...</option>
                {shiftCentreOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button 
              style={{ flex: '1 1 200px' }}
              className="btn btn-primary" 
              disabled={selectedModalRows.size === 0 || !targetShiftCentreId || isShiftLoading}
              onClick={handleShiftCandidates}
            >
              {isShiftLoading ? 'Shifting...' : `Shift ${selectedModalRows.size} Candidates`}
            </button>
          </div>
          {selectedModalRows.size > 0 && (
            <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--primary)' }}>
              * Shifting will reassign selected candidates from <strong>{selectedCentreForView?.name}</strong> to the chosen target.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-outline" onClick={() => setIsCentreRecipientsModalOpen(false)}>Close</button>
        </div>
      </Modal>

      {/* Add Referral Candidate Modal */}
      <Modal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        title="Add Referral Candidate"
        maxWidth="500px"
      >
        <form onSubmit={handleAddReferral}>
          <FormField label="Full Name *">
            <input 
              className="form-control" 
              value={referralForm.name} 
              onChange={e => setReferralForm({...referralForm, name: e.target.value})} 
              required 
            />
          </FormField>
          <FormField label="Mobile Number *">
            <input 
              type="tel" 
              className="form-control" 
              value={referralForm.mobile} 
              onChange={e => setReferralForm({...referralForm, mobile: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
              required 
            />
          </FormField>
          <FormField label="Aadhaar Number (Optional)">
            <input 
              className="form-control" 
              value={referralForm.aadhaar} 
              onChange={e => setReferralForm({...referralForm, aadhaar: e.target.value.replace(/\D/g, '').slice(0, 12)})} 
            />
          </FormField>
          <FormField label="Designation">
            <select 
              className="form-control" 
              value={referralForm.designation} 
              onChange={e => setReferralForm({...referralForm, designation: e.target.value})}
            >
              <option value="operator">Operator</option>
              <option value="supervisor">Supervisor</option>
              <option value="videographer">Videographer</option>
            </select>
          </FormField>
          {isWrittenExam && (
            <FormField label="Assign to Centre">
              <select 
                className="form-control" 
                value={referralForm.centre} 
                onChange={e => setReferralForm({...referralForm, centre: e.target.value})}
                required
              >
                <option value="">Select Centre...</option>
                {availableCentres.map(c => (
                  <option key={c.id || c.centre_id} value={c.id || c.centre_id}>
                    {c.name || c.centre}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: '12px' }}>
            <strong>Assignment Context:</strong>
            <div style={{ marginTop: 4 }}>
              {isWrittenExam ? <>District: {district || districtId} / Centre: {centre || centreId}</> : <>Location: {locationName || locationId}</>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsReferralModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={referralLoading}>
              {referralLoading ? 'Adding...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </Modal>

      <style>{`
        .recipient-calling-page .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
        .recipient-calling-page .page-header { gap: 16px; }
        .recipient-calling-page .card { padding: 16px; }
        .recipient-calling-page .card-header { gap: 12px; }
        .recipient-calling-page .card-header > div { min-width: 0; }
        .recipient-calling-page .callers-filters { padding: 10px 0 0; }
        .recipient-calling-page .callers-search-group { flex-wrap: wrap; gap: 10px; width: 100%; min-width: 0; }
        .recipient-calling-page .callers-search-group input,
        .recipient-calling-page .callers-search-group select {
          flex: 1 1 45%;
          min-width: 0;
        }
        .recipient-calling-page .table-wrap table { min-width: 100%; }
        .recipient-calling-page .table-wrap table thead th,
        
        .modal-filter-header > * {
          flex: 1 1 100%;
          min-width: 0;
        }

        .recipient-calling-page .table-wrap table tbody td {
          padding: 10px 10px;
        }
        .recipient-calling-page .pagination-pages {
          display: flex;
          gap: 8px;
        }
        .recipient-calling-page .pagination-page-btn {
          min-width: auto;
          padding: 7px 12px;
        }

        @media (max-width: 680px) {
          .recipient-calling-page .page-title { font-size: 20px; }
          .recipient-calling-page .card-header { flex-direction: column; align-items: stretch; }
          .recipient-calling-page .card-header > div { width: 100%; }
          .recipient-calling-page .stats-grid { grid-template-columns: 1fr 1fr; }
          .recipient-calling-page .callers-filters { flex-direction: column; align-items: stretch; }
          .recipient-calling-page .callers-search-group input,
          .recipient-calling-page .callers-search-group select {
            flex: 1 1 100%;
          }
          .recipient-calling-page .date-filter-group {
            flex: 1 1 100%;
          }
          .recipient-calling-page .pagination-pages { justify-content: flex-start; }
          .recipient-calling-page .firstprev,
          .recipient-calling-page .lastprev {
            display: none;
          }
          .recipient-calling-page .btn.btn-sm { width: 100%; }
        }
          /* Mobile / desktop visibility helpers */
          .mobile-only { display: none; }
          .desktop-only { display: block; }
          @media (max-width: 680px) {
            .mobile-only { display: block; }
            .desktop-only { display: none; }
            .recipient-card { box-shadow: 0 6px 16px rgba(10,18,34,0.04); }
            .recipient-card .btn { min-width: auto; }
          }
        
        .recipient-calling-page .date-filter-group {
          flex: 1 1 45%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .recipient-calling-page .date-filter-label {
          font-size: 11px;
          color: var(--text3);
          text-transform: uppercase;
          margin-bottom: 0;
        }

        .centre-stat-row:hover {
          background: #fcfdfe;
        }

        .designation-toggle-tabs {
          display: flex;
          background: #edf2f7;
          padding: 4px;
          border-radius: 8px;
          gap: 4px;
        }
        .dt-tab {
          flex: 1;
          border: none;
          background: none;
          padding: 8px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          color: #718096;
        }
        .dt-tab.active {
          background: #fff;
          color: var(--primary);
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
      `}</style>
    </div>
  )
}
