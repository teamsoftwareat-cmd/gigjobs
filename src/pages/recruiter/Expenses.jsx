import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faChevronRight,
  faCheck,
  faTimes,
  faEye,
  faIndianRupee,
  faUsers,
  faFileExcel,
  faTags,
} from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { PageHeader, Card, StatCard, Modal, Tag } from '../../components/ui'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import './Payments.css'

const EXPENSE_CATEGORIES = [
  'Hotel',
  'Travel',
  'Food',
  'Stationary',
  'Electronics',
  'Rental',
  'Other',
]

export default function Expenses() {
  const { alert } = useAlert()

  // Tab state
  const [activeTab, setActiveTab] = useState('pending')

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    candidatename: '',
    aadhaar: '',
    phone: '',
    project: '',
    location: '',
    district: '',
    centre: '',
    category: '',
  })

  // Projects and locations for filters
  const [projects, setProjects] = useState([])
  const [locations, setLocations] = useState([])
  const [districts, setDistricts] = useState([])
  const [centres, setCentres] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [districtsLoading, setDistrictsLoading] = useState(false)
  const [centresLoading, setCentresLoading] = useState(false)

  const showLocationFilter = !filters.project || districts.length === 0
  const showAllLocationColumns = !filters.project

  // Current expenses data (paginated)
  const [currentExpenses, setCurrentExpenses] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(false)

  // State for details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [actionReason, setActionReason] = useState('')
  const [expenseDetailsLoading, setExpenseDetailsLoading] = useState(false)
  const isRejectedTab = activeTab === 'rejected'
  const isPendingTab = activeTab === 'pending'

  const formatExpenseValue = (value) => {
    if (value === null || value === undefined || value === '') return '—'
    return value
  }

  const getCategorySpecificFields = (expense) => {
    if (!expense) return []
    const category = String(expense.category || '').toLowerCase()
    const fields = []

    if (category === 'food') {
      fields.push({ label: 'Food from', value: expense.food_from_date })
      fields.push({ label: 'Food to', value: expense.food_to_date })
    } else if (category === 'travel') {
      fields.push({ label: 'Travel from', value: expense.travel_from || expense.travel_from_date })
      fields.push({ label: 'Travel to', value: expense.travel_to || expense.travel_to_date })
      fields.push({ label: 'Transport mode', value: expense.transport_mode })
      fields.push({ label: 'Purpose of travel', value: expense.purpose_of_travel })
    } else if (category === 'hotel' || category === 'accommodation') {
      fields.push({ label: 'Hotel name', value: expense.hotel_name })
      fields.push({ label: 'Hotel location', value: expense.hotel_location })
      fields.push({ label: 'Hotel phone', value: expense.hotel_phone })
      fields.push({ label: 'Check-in', value: expense.checkin_date })
      fields.push({ label: 'Check-out', value: expense.checkout_date })
      fields.push({ label: 'Number of days', value: expense.num_days })
      fields.push({ label: 'Number of persons', value: expense.num_persons })
      fields.push({ label: 'Number of rooms', value: expense.num_rooms })
    }

    if (expense.from_date || expense.to_date) {
      fields.push({ label: 'From date', value: expense.from_date })
      fields.push({ label: 'To date', value: expense.to_date })
    }

    return fields.filter((field) => field.value !== null && field.value !== undefined && field.value !== '')
  }

  const renderInfoCard = (label, value) => (
    <div style={{
      background: 'var(--bg)',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid var(--border-light)'
    }}>
      <label style={{
        display: 'block',
        fontSize: '11px',
        fontWeight: '700',
        color: 'var(--text3)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '4px'
      }}>
        {label}
      </label>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
        {formatExpenseValue(value)}
      </p>
    </div>
  )

  const renderCategoryDetailsSection = (expense) => {
    const fields = getCategorySpecificFields(expense)
    if (!fields.length) return null

    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
      }}>
        <h4 style={{
          margin: '0 0 12px',
          fontSize: '16px',
          fontWeight: '700',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FontAwesomeIcon icon={faTags} style={{ color: 'var(--primary)' }} />
          Category details
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px'
        }}>
          {fields.map((field, index) => (
            <div key={index}>
              {renderInfoCard(field.label, field.value)}
            </div>
          ))}
        </div>
      </div>
    )
  }
  // Expense access allocation state
  const [allocateAccessModalOpen, setAllocateAccessModalOpen] = useState(false)
  const [accessQuery, setAccessQuery] = useState('')
  const [accessCandidates, setAccessCandidates] = useState([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessModalMode, setAccessModalMode] = useState('grant')
  const [accessActionInProgress, setAccessActionInProgress] = useState(false)
  const [selectedAccessCandidates, setSelectedAccessCandidates] = useState([])
  const [selectedAccessProject, setSelectedAccessProject] = useState('')
  const [accessInfoMessage, setAccessInfoMessage] = useState('Search by name, Aadhaar number, or mobile number.')
  const [candidatesWithAccess, setCandidatesWithAccess] = useState([])
  const [accessWithExpenseLoading, setAccessWithExpenseLoading] = useState(false)

  const [selectedApprovedExpenseIds, setSelectedApprovedExpenseIds] = useState([])
  const [selectedPendingExpenseIds, setSelectedPendingExpenseIds] = useState([])
  const [selectedRejectedExpenseIds, setSelectedRejectedExpenseIds] = useState([])
  const [selectedPaidExpenseIds, setSelectedPaidExpenseIds] = useState([])
  const [paidExpensesModalOpen, setPaidExpensesModalOpen] = useState(false)
  const [paidExpenses, setPaidExpenses] = useState([])
  const [paidExpensesLoading, setPaidExpensesLoading] = useState(false)
  const [paidExpensesFilters, setPaidExpensesFilters] = useState({
    search: '',
    project: '',
    location: '',
    district: '',
    centre: '',
    category: '',
  })
  const showPaidExpensesLocationFilter = !paidExpensesFilters.project || districts.length === 0
  const showPaidExpensesAllLocationColumns = !paidExpensesFilters.project
  const [paidExpensesPagination, setPaidExpensesPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [markPaidInProgress, setMarkPaidInProgress] = useState(false)

  const fetchCandidatesWithAccess = useCallback(async (projectId) => {
    setAccessWithExpenseLoading(true)
    try {
      const params = projectId ? { projectId } : {}
      const response = await recruiterAPI.getCandidatesWithExpenseAccess(params)
      const responseData = response?.data?.data || response?.data || {}
      const items = Array.isArray(responseData.items)
        ? responseData.items
        : Array.isArray(responseData.candidates)
        ? responseData.candidates
        : Array.isArray(responseData)
        ? responseData
        : []

      const normalizedItems = items.map((item) => ({
        id: item.id || item.registration_id || item.candidateId || item.candidate_id || item._id,
        name: item.name || item.fullName || item.candidatename || item.worker_name || item.username || 'Unknown',
        mobile: item.mobile || item.phone || item.whatsapp || item.contact || item.mobile_number || 'Unknown',
        aadhaar: item.aadhaar || item.aadhaarNumber || item.aadhaar_number || 'Unknown',
        projectId: item.project_id || item.projectId || item.project?.id || item.projectId || null,
        projectName: item.project_name || item.projectName || item.project?.name || item.project?.title || 'Unknown project',
        status: item.status || item.current_status || 'active',
        location: item.location || item.city || item.locationName || item.location_name || 'Unknown',
        raw: item,
      }))

      setCandidatesWithAccess(normalizedItems)
    } catch (error) {
      console.warn('Failed to fetch candidates with access:', error)
      setCandidatesWithAccess([])
    } finally {
      setAccessWithExpenseLoading(false)
    }
  }, [])

  const fetchAccessCandidates = useCallback(async () => {
    const query = String(accessQuery || '').trim()

    if (!query) {
      setAccessCandidates([])
      setAccessInfoMessage('Search by name, Aadhaar number, or mobile number.')
      return
    }

    setAccessLoading(true)
    setAccessInfoMessage('')

    try {
      const params = {
        mobile: query,
        limit: 25,
      }

      const response = await recruiterAPI.getCandidates(params)
      const responseData = response?.data?.data || response?.data || {}
      const rawItems = Array.isArray(responseData.items)
        ? responseData.items
        : Array.isArray(responseData.candidates)
        ? responseData.candidates
        : Array.isArray(responseData.results)
        ? responseData.results
        : Array.isArray(responseData)
        ? responseData
        : []

      const items = rawItems.map((item) => ({
        id: item.id || item.registration_id || item.candidateId || item.candidate_id || item._id,
        name: item.name || item.fullName || item.candidatename || item.worker_name || item.username || 'Unknown',
        mobile: item.mobile || item.phone || item.whatsapp || item.contact || item.mobile_number || 'Unknown',
        aadhaar: item.aadhaar || item.aadhaarNumber || item.aadhaar_number || 'Unknown',
        location: item.location || item.city || item.locationName || item.location_name || 'Unknown',
        raw: item,
      }))

      setAccessCandidates(items)
      if (!items.length) {
        setAccessInfoMessage('No registered candidates found for this query.')
      }
    } catch (error) {
      setAccessCandidates([])
      setAccessInfoMessage('Unable to search candidates. Please try again.')
    } finally {
      setAccessLoading(false)
    }
  }, [accessQuery])

  const toggleSelectedAccessCandidate = useCallback((candidate) => {
    const candidateId = candidate.id || `${candidate.mobile}-${candidate.aadhaar}-${candidate.name}`
    setSelectedAccessCandidates((prev) => {
      const found = prev.some((item) => item.id === candidateId)
      if (found) {
        return prev.filter((item) => item.id !== candidateId)
      }
      return [...prev, { ...candidate, id: candidateId }]
    })
  }, [])

  const handleGrantExpenseAccess = async () => {
    if (!selectedAccessCandidates.length) {
      alert('error', 'Please select at least one candidate to allow expense access')
      return
    }
    if (!selectedAccessProject) {
      alert('error', 'Please select a project to grant access for')
      return
    }

    setAccessActionInProgress(true)

    try {
      const projectObj = projects.find((p) => String(p.id || p.project_id) === String(selectedAccessProject)) || {}
      await recruiterAPI.grantExpenseAccess?.({
        candidateIds: selectedAccessCandidates.map((candidate) => candidate.id),
        candidates: selectedAccessCandidates.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          mobile: candidate.mobile,
          aadhaar: candidate.aadhaar,
        })),
        projectId: selectedAccessProject,
        projectName: projectObj.name || projectObj.project_name || projectObj.title || '',
      })
      alert('success', 'Expense access granted successfully')
      setAllocateAccessModalOpen(false)
      setSelectedAccessCandidates([])
      setAccessCandidates([])
      setAccessQuery('')
      setSelectedAccessProject('')
      setAccessModalMode('grant')
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.msg || error?.message || 'Failed to grant expense access'
      alert('error', message)
    } finally {
      setAccessActionInProgress(false)
    }
  }

  const handleRevokeExpenseAccess = async () => {
    if (!selectedAccessCandidates.length) {
      alert('error', 'Please select at least one candidate to revoke expense access')
      return
    }
    if (!selectedAccessProject) {
      alert('error', 'Please select a project to revoke access for')
      return
    }

    setAccessActionInProgress(true)

    try {
      const projectObj = projects.find((p) => String(p.id || p.project_id) === String(selectedAccessProject)) || {}
      await recruiterAPI.revokeExpenseAccess?.({
        candidateIds: selectedAccessCandidates.map((candidate) => candidate.id),
        projectId: selectedAccessProject,
        projectName: projectObj.name || projectObj.project_name || projectObj.title || '',
      })
      alert('success', 'Expense access revoked successfully')
      setAllocateAccessModalOpen(false)
      setSelectedAccessCandidates([])
      setAccessCandidates([])
      setAccessQuery('')
      setSelectedAccessProject('')
      setAccessModalMode('grant')
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.msg || error?.message || 'Failed to revoke expense access'
      alert('error', message)
    } finally {
      setAccessActionInProgress(false)
    }
  }

  const toggleApprovedExpenseSelection = useCallback((expense) => {
    const expenseId = expense.id || expense.expenseId || `${expense.candidatename}-${expense.date}-${expense.amount}`
    setSelectedApprovedExpenseIds((prev) => {
      if (prev.includes(expenseId)) {
        return prev.filter((id) => id !== expenseId)
      }
      return [...prev, expenseId]
    })
  }, [])

  const toggleSelectAllApproved = useCallback(() => {
    const pageExpenseIds = currentExpenses
      .map((expense, idx) => expense.id || expense.expenseId || `${expense.candidatename}-${expense.date}-${expense.amount}`)
      .filter(Boolean)

    const allSelected = pageExpenseIds.every((id) => selectedApprovedExpenseIds.includes(id))
    if (allSelected) {
      return setSelectedApprovedExpenseIds((prev) => prev.filter((id) => !pageExpenseIds.includes(id)))
    }
    setSelectedApprovedExpenseIds((prev) => [...new Set([...prev, ...pageExpenseIds])])
  }, [currentExpenses, selectedApprovedExpenseIds])

  const handleMarkSelectedPaid = async () => {
    if (!selectedApprovedExpenseIds.length) {
      alert('error', 'Please select at least one approved expense to mark as paid')
      return
    }

    setMarkPaidInProgress(true)
    try {
      await Promise.all(
        selectedApprovedExpenseIds.map((id) => recruiterAPI.updateExpenseStatus?.(id, { action: 'paid' }))
      )
      alert('success', 'Selected expenses marked as paid successfully')
      setSelectedApprovedExpenseIds([])
      fetchExpenses(1, filters)
    } catch (error) {
      alert('error', 'Failed to mark selected expenses as paid')
    } finally {
      setMarkPaidInProgress(false)
    }
  }

  const handleMarkExpensePaid = async () => {
    if (!selectedExpense?.id) {
      alert('error', 'No expense selected to mark as paid')
      return
    }

    setActionInProgress(true)
    try {
      await recruiterAPI.updateExpenseStatus?.(selectedExpense.id, { action: 'paid' })
      alert('success', 'Expense marked as paid successfully')
      setDetailsModalOpen(false)
      setSelectedExpense(null)
      setActionReason('')
      fetchExpenses()
    } catch (error) {
      alert('error', 'Failed to mark expense as paid')
    } finally {
      setActionInProgress(false)
    }
  }

  const fetchPaidExpenses = useCallback(
    async (page = paidExpensesPagination.page, newFilters = paidExpensesFilters) => {
      setPaidExpensesLoading(true)
      try {
        const params = {
          status: 'paid',
          offset: (page - 1) * paidExpensesPagination.limit,
          limit: paidExpensesPagination.limit,
          ...newFilters,
        }

        Object.keys(params).forEach((key) => {
          if (params[key] === '' || params[key] === null || params[key] === undefined) {
            delete params[key]
          }
        })

        const response = await recruiterAPI.getExpensesReport?.(params)
        const payload = response?.data || {}
        const responseData = payload?.data || payload
        const items = Array.isArray(responseData?.items)
          ? responseData.items
          : Array.isArray(responseData)
            ? responseData
            : []
        const total = typeof responseData?.total === 'number'
          ? responseData.total
          : typeof responseData?.pagination?.total === 'number'
          ? responseData.pagination.total
          : 0

        setPaidExpenses(items)
        setPaidExpensesPagination((prev) => ({
          ...prev,
          page,
          total,
          totalPages: Math.ceil(total / prev.limit),
        }))
      } catch (error) {
        alert('error', 'Failed to load paid expenses')
      } finally {
        setPaidExpensesLoading(false)
      }
    },
    [paidExpensesFilters, paidExpensesPagination.limit, alert]
  )

  const handlePaidExpensesFilterChange = (filterKey, value) => {
    setPaidExpensesFilters((prev) => ({
      ...prev,
      [filterKey]: value,
      ...(filterKey === 'project' ? { location: '', district: '', centre: '' } : {}),
      ...(filterKey === 'district' ? { centre: '' } : {}),
    }))
    setPaidExpensesPagination((prev) => ({ ...prev, page: 1 }))

    if (filterKey === 'project') {
      if (value) {
        fetchLocations(value)
        fetchDistricts(value)
      } else {
        setLocations([])
        setDistricts([])
        setCentres([])
      }
    }

    const projectValue = filterKey === 'project' ? value : paidExpensesFilters.project
    if (filterKey === 'district' && projectValue) {
      fetchCentres(projectValue, value)
    }
  }

  const handlePaidExpensesPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= paidExpensesPagination.totalPages) {
      setPaidExpensesPagination((prev) => ({ ...prev, page: newPage }))
    }
  }

  useEffect(() => {
    if (activeTab !== 'approved') {
      setSelectedApprovedExpenseIds([])
    }
  }, [activeTab])

  useEffect(() => {
    if (paidExpensesModalOpen) {
      fetchPaidExpenses(paidExpensesPagination.page, paidExpensesFilters)
    }
  }, [paidExpensesModalOpen, fetchPaidExpenses, paidExpensesFilters, paidExpensesPagination.page, paidExpensesPagination.limit])

  useEffect(() => {
    if (!allocateAccessModalOpen) return

    if (accessModalMode === 'revoke') {
      if (selectedAccessProject) {
        fetchCandidatesWithAccess(selectedAccessProject)
      } else {
        // Clear list until a project is chosen to avoid fetching all-access entries
        setCandidatesWithAccess([])
      }
    } else if (accessModalMode === 'grant') {
      // For grant mode, fetch existing access so UI can mark already-granted candidates
      // Pass project if selected, otherwise fetch global access list
      fetchCandidatesWithAccess(selectedAccessProject || undefined)
    }
  }, [allocateAccessModalOpen, accessModalMode, selectedAccessProject, fetchCandidatesWithAccess])

  useEffect(() => {
    if (!allocateAccessModalOpen) return

    if (accessModalMode === 'revoke') {
      if (selectedAccessProject) {
        fetchCandidatesWithAccess(selectedAccessProject)
      } else {
        setCandidatesWithAccess([])
      }
    } else if (accessModalMode === 'grant') {
      fetchCandidatesWithAccess(selectedAccessProject || undefined)
    }
  }, [allocateAccessModalOpen, accessModalMode, selectedAccessProject, fetchCandidatesWithAccess])

  // State for attachment modal
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false)
  const [currentAttachment, setCurrentAttachment] = useState(null)
  const [attachmentIndex, setAttachmentIndex] = useState(0)
  const [allAttachments, setAllAttachments] = useState([])

  // State for stats
  const [stats, setStats] = useState({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalPendingAmount: 0,
    totalApprovedAmount: 0,
    totalPaid: 0,
    totalPaidAmount: 0,
  })

  // Fetch expenses data with pagination and filters
  const fetchExpenses = useCallback(
    async (page = pagination.page, newFilters = filters, minimal = true) => {
      setExpensesLoading(true)
      try {
        const statusParam = activeTab === 'approved' ? 'approve' : (activeTab === 'rejected' ? 'reject' : activeTab)
        const params = {
          status: statusParam,
          offset: (page - 1) * pagination.limit,
          limit: pagination.limit,
          ...newFilters,
        }

        // Remove empty filters
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null || params[key] === undefined) {
            delete params[key]
          }
        })

        const response = await recruiterAPI.getExpensesReport?.(params)
        const payload = response?.data || {}
        const responseData = payload?.data || payload
        const items = Array.isArray(responseData?.items)
          ? responseData.items
          : Array.isArray(responseData)
            ? responseData
            : []
        const summary = responseData?.summary || responseData?.data?.summary || {}
        const total = typeof responseData?.total === 'number'
          ? responseData.total
          : typeof responseData?.pagination?.total === 'number'
          ? responseData.pagination.total
          : 0

        setCurrentExpenses(items)

        setPagination(prev => ({
          ...prev,
          page,
          total,
          totalPages: Math.ceil(total / prev.limit),
        }))

        setStats({
          totalPending: summary.counts?.pending ?? 0,
          totalApproved: summary.counts?.approved ?? 0,
          totalRejected: summary.counts?.rejected ?? 0,
          totalPendingAmount: summary.totals?.pending ?? 0,
          totalApprovedAmount: summary.totals?.approved ?? 0,
          totalPaid: summary.counts?.paid ?? 0,
          totalPaidAmount: summary.totals?.paid ?? 0,
        })
      } catch (error) {
        alert('error', 'Failed to load expenses')
      } finally {
        setExpensesLoading(false)
      }
    },
    [alert, activeTab, pagination.limit, filters]
  )

  // Fetch full expense details for modal
  const fetchExpenseDetails = useCallback(
    async (expenseId) => {
      setExpenseDetailsLoading(true)
      try {
        const response = await recruiterAPI.getExpenseDetails?.(expenseId)
        const expenseData = response?.data?.data || response?.data || {}
        setSelectedExpense(expenseData)
        setActionReason(expenseData.updateReason || '')
      } catch (error) {
        alert('error', 'Failed to load expense details')
        setSelectedExpense(null)
        setActionReason('')
      } finally {
        setExpenseDetailsLoading(false)
      }
    },
    [alert]
  )

  // Re-fetch whenever the active tab, page, or filters change
  useEffect(() => {
    fetchExpenses(pagination.page, filters)
  }, [fetchExpenses, activeTab, pagination.page, filters])

  // Fetch projects for filter dropdown
  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const response = await recruiterAPI.getProjectSuggestions('', 200)
      let items = []
      const responseData = response?.data

      if (Array.isArray(responseData)) {
        items = responseData
      } else if (Array.isArray(responseData?.data)) {
        items = responseData.data
      } else if (Array.isArray(responseData?.items)) {
        items = responseData.items
      }

      setProjects(items)
    } catch (error) {
      alert('error', 'Failed to load projects')
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }, [alert])

  // Fetch locations for selected project
  const fetchLocations = useCallback(async (projectId) => {
    if (!projectId) {
      setLocations([])
      return
    }

    setLocationsLoading(true)
    try {
      const response = await recruiterAPI.getProjectLocations(projectId)
      let locations = []
      const responseData = response?.data

      if (Array.isArray(responseData)) {
        locations = responseData
      } else if (Array.isArray(responseData?.data)) {
        locations = responseData.data
      } else if (Array.isArray(responseData?.items)) {
        locations = responseData.items
      }

      setLocations(locations)
    } catch (error) {
      alert('error', 'Failed to load locations')
      setLocations([])
    } finally {
      setLocationsLoading(false)
    }
  }, [alert])

  // Fetch districts for selected project
  const fetchDistricts = useCallback(async (projectId) => {
    if (!projectId) {
      setDistricts([])
      return
    }

    setDistrictsLoading(true)
    try {
      const response = await recruiterAPI.getProjectDistricts(projectId)
      let districts = []
      const responseData = response?.data

      if (Array.isArray(responseData)) {
        districts = responseData
      } else if (Array.isArray(responseData?.data)) {
        districts = responseData.data
      } else if (Array.isArray(responseData?.items)) {
        districts = responseData.items
      }

      setDistricts(districts)
    } catch (error) {
      alert('error', 'Failed to load districts')
      setDistricts([])
    } finally {
      setDistrictsLoading(false)
    }
  }, [alert])

  // Fetch centres for selected district
  const fetchCentres = useCallback(async (projectId, districtId) => {
    if (!projectId || !districtId) {
      setCentres([])
      return
    }

    setCentresLoading(true)
    try {
      const response = await recruiterAPI.getDistrictCentres(projectId, districtId)
      let centres = []
      const responseData = response?.data

      if (Array.isArray(responseData)) {
        centres = responseData
      } else if (Array.isArray(responseData?.data)) {
        centres = responseData.data
      } else if (Array.isArray(responseData?.items)) {
        centres = responseData.items
      }

      setCentres(centres)
    } catch (error) {
      alert('error', 'Failed to load centres')
      setCentres([])
    } finally {
      setCentresLoading(false)
    }
  }, [alert])

  // Fetch projects on component mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }))
    }
  }

  // Handle filter change
  const handleFilterChange = (filterKey, value) => {
    if (filterKey === 'project') {
      setFilters(prev => ({ ...prev, project: value, location: '', district: '', centre: '' }))
      if (value) {
        fetchLocations(value)
        fetchDistricts(value)
      } else {
        setLocations([])
        setDistricts([])
        setCentres([])
      }
    } else if (filterKey === 'district') {
      setFilters(prev => ({ ...prev, district: value, centre: '' }))
      if (value && filters.project) {
        fetchCentres(filters.project, value)
      } else {
        setCentres([])
      }
    } else {
      setFilters(prev => ({ ...prev, [filterKey]: value }))
    }

    setPagination(prev => ({ ...prev, page: 1 })) // Reset to first page when filters change
  }

  // Handle limit change
  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
  }

  const handleExpenseClick = async (expense) => {
    setDetailsModalOpen(true)
    setActionReason(expense.updateReason || '')
    // Set minimal data first for immediate display
    setSelectedExpense(expense)
    // Then fetch full details
    if (expense.id) {
      await fetchExpenseDetails(expense.id)
    }
  }

  const handleViewAttachment = (attachmentUrl) => {
    const supportedFormats = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i
    if (supportedFormats.test(attachmentUrl)) {
      setCurrentAttachment(attachmentUrl)
      setAttachmentModalOpen(true)
    } else {
      // For unsupported files, open in new tab
      window.open(attachmentUrl, '_blank')
    }
  }

  const getFileType = (url) => {
    const ext = url.toLowerCase().split('.').pop()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    if (['doc', 'docx'].includes(ext)) return 'document'
    return 'unknown'
  }

  const handleApproveExpense = async () => {
    if (!selectedExpense) return

    setActionInProgress(true)
    try {
      await recruiterAPI.updateExpenseStatus?.(selectedExpense.id, { action: 'approve', reason: actionReason })
      setDetailsModalOpen(false)
      setSelectedExpense(null)
      setActionReason('')
      fetchExpenses()
    } catch (error) {
      alert('error', 'Failed to approve expense')
    } finally {
      setActionInProgress(false)
    }
  }

  const handleRejectExpense = async () => {
    if (!selectedExpense || !actionReason) {
      alert('error', 'Please provide a reason for rejection')
      return
    }

    setActionInProgress(true)
    try {
      await recruiterAPI.updateExpenseStatus?.(selectedExpense.id, { action: 'reject', reason: actionReason })
      setDetailsModalOpen(false)
      setSelectedExpense(null)
      setActionReason('')
      fetchExpenses()
    } catch (error) {
      alert('error', 'Failed to reject expense')
    } finally {
      setActionInProgress(false)
    }
  }

  const existingAccessCandidateIds = ([])
    .concat(
      candidatesWithAccess.map((candidate) => candidate.id).filter(Boolean),
      candidatesWithAccess.map((candidate) => `${candidate.mobile}-${candidate.aadhaar}-${candidate.name}`).filter(Boolean)
    )
  const accessCandidatesToDisplay = accessModalMode === 'revoke' ? candidatesWithAccess : accessCandidates
  const accessActionButtonText = accessModalMode === 'revoke' ? 'Revoke Access' : 'Allow Access'
  const accessActionLoadingText = accessModalMode === 'revoke' ? 'Revoking...' : 'Granting...'

  const handleAccessModalModeChange = useCallback((mode) => {
    if (mode === accessModalMode) return
    setAccessModalMode(mode)
    setSelectedAccessCandidates([])
    setAccessQuery('')
    if (mode === 'grant') {
      setAccessInfoMessage('Search by name, Aadhaar number, or mobile number.')
    }
  }, [accessModalMode])

  // Export function for category-wise Excel with full details
  const exportExpensesToExcel = useCallback(async (expenses, fileName) => {
    if (!expenses || expenses.length === 0) {
      alert('error', 'No expenses to export')
      return
    }

    try {
      // Fetch full details for each expense
      alert('info', 'Fetching expense details...')
      const fullExpensesPromises = expenses.map(expense => 
        recruiterAPI.getExpenseDetails(expense.id || expense.expenseId)
          .then(response => {
            const detailedData = response?.data?.data || response?.data || {}
            return { ...expense, ...detailedData }
          })
          .catch(error => {
            console.warn(`Failed to fetch details for expense ${expense.id}:`, error)
            return expense // Return original data if detail fetch fails
          })
      )
      
      const fullExpenses = await Promise.all(fullExpensesPromises)

      // Helper function to extract attachment URL
      const getAttachmentUrl = (expense) => {
        if (expense.attachments) {
          if (Array.isArray(expense.attachments) && expense.attachments.length > 0) {
            const first = expense.attachments[0]
            return typeof first === 'string' ? first : (first.url || first.path || '—')
          }
          if (typeof expense.attachments === 'string') {
            return expense.attachments
          }
        }
        if (expense.attachment) {
          if (typeof expense.attachment === 'string') return expense.attachment
          return expense.attachment.url || expense.attachment.path || '—'
        }
        if (expense.attachment_url) return expense.attachment_url
        if (expense.bill_url) return expense.bill_url
        return '—'
      }

      // Helper function to extract filename from URL
      const getFilenameFromUrl = (url) => {
        if (url === '—' || !url) return '—'
        try {
          const lastSlash = url.lastIndexOf('/')
          return lastSlash > -1 ? url.substring(lastSlash + 1) : url
        } catch (e) {
          return url
        }
      }

      // Helper function to get the appropriate date based on category
      const getExpenseDate = (expense, category) => {
        const categoryLower = String(category).toLowerCase()
        if (categoryLower === 'travel') {
          return expense.travel_from_date || expense.from_date || expense.date || '—'
        } else if (categoryLower === 'hotel') {
          return expense.checkin_date || expense.from_date || expense.date || '—'
        } else if (categoryLower === 'food') {
          return expense.food_from_date || expense.date || '—'
        }
        return expense.date || '—'
      }

      // Group expenses by category
      const groupedByCategory = {}
      fullExpenses.forEach((expense) => {
        const category = expense.category || 'Other'
        if (!groupedByCategory[category]) {
          groupedByCategory[category] = []
        }
        groupedByCategory[category].push(expense)
      })

      // Create workbook
      const wb = XLSX.utils.book_new()

      // Add a sheet for each category with category-specific columns
      Object.keys(groupedByCategory).sort().forEach((category) => {
        const categoryExpenses = groupedByCategory[category]
        const categoryLower = String(category).toLowerCase()
        
        // Define columns based on category
        let headers = ['Sl.No', 'P.id', 'Date', 'Type', 'Name', 'Mobile', 'Aadhaar', 'Project', 'Amount', 'Expense']
        let colWidths = [8, 12, 12, 12, 20, 15, 15, 20, 12, 25]

        if (categoryLower === 'travel') {
          headers = ['Sl.No', 'P.id', 'Date', 'Type', 'Name', 'Mobile', 'From', 'To', 'Mode of Transport', 'Purpose of Travel', 'Amount', 'Expense']
          colWidths = [8, 12, 12, 12, 20, 15, 15, 15, 18, 20, 12, 25]
        } else if (categoryLower === 'hotel') {
          headers = ['Sl.No', 'P.id', 'Date', 'Type', 'Name', 'Mobile', 'Hotel Name', 'Location', 'Check-in', 'Check-out', 'No. Days', 'No. Persons', 'Amount', 'Expense']
          colWidths = [8, 12, 12, 12, 20, 15, 20, 15, 12, 12, 10, 12, 12, 25]
        } else if (categoryLower === 'food') {
          headers = ['Sl.No', 'P.id', 'Date', 'Type', 'Name', 'Mobile', 'From Date', 'To Date', 'Amount', 'Expense']
          colWidths = [8, 12, 12, 12, 20, 15, 12, 12, 12, 25]
        } else if (['stationary', 'electronics', 'rental'].includes(categoryLower)) {
          headers = ['Sl.No', 'P.id', 'Date', 'Type', 'Name', 'Mobile', 'Units', 'Cost Per Unit', 'Amount', 'Expense']
          colWidths = [8, 12, 12, 12, 20, 15, 10, 15, 12, 25]
        }
        
        // Prepare data for this category
        const sheetData = []
        sheetData.push(headers)

        categoryExpenses.forEach((expense, idx) => {
          let rowData = [
            idx + 1,
            expense.project_id || '—',
            getExpenseDate(expense, category),
            category,
            expense.candidatename || expense.name || '—',
            expense.mobileNumber || expense.phone || '—'
          ]

          const attachmentUrl = getAttachmentUrl(expense)
          const attachmentFilename = getFilenameFromUrl(attachmentUrl)

          if (categoryLower === 'travel') {
            rowData = rowData.concat([
              expense.from || expense.travel_from || '—',
              expense.to || expense.travel_to || '—',
              expense.transport_mode || '—',
              expense.purpose_of_travel || '—',
              expense.amount || 0,
              attachmentFilename
            ])
          } else if (categoryLower === 'hotel') {
            rowData = rowData.concat([
              expense.hotel_name || '—',
              expense.hotel_location || '—',
              expense.checkin_date || '—',
              expense.checkout_date || '—',
              expense.num_days || '—',
              expense.num_persons || '—',
              expense.amount || 0,
              attachmentFilename
            ])
          } else if (categoryLower === 'food') {
            rowData = rowData.concat([
              expense.food_from_date || '—',
              expense.food_to_date || '—',
              expense.amount || 0,
              attachmentFilename
            ])
          } else if (['stationary', 'electronics', 'rental'].includes(categoryLower)) {
            rowData = rowData.concat([
              expense.units || '—',
              expense.cost_per_unit || '—',
              expense.amount || 0,
              attachmentFilename
            ])
          } else {
            // Generic category
            rowData = rowData.concat([
              expense.aadhaar || '—',
              expense.amount || 0,
              attachmentFilename
            ])
          }

          // Store the URL for this row (last column is always the attachment)
          rowData._attachmentUrl = attachmentUrl

          sheetData.push(rowData)
        })

        const ws = XLSX.utils.aoa_to_sheet(sheetData)
        ws['!cols'] = colWidths.map(wch => ({ wch }))

        // Add hyperlinks and borders
        const range = XLSX.utils.decode_range(ws['!ref'])
        for (let R = range.s.r; R <= range.e.r; R++) {
          for (let C = range.s.c; C <= range.e.c; C++) {
            const cellAddress = XLSX.utils.encode_col(C) + XLSX.utils.encode_row(R)
            if (!ws[cellAddress]) continue
            
            // Add hyperlink if this is the last column (attachment) and has a URL
            if (C === range.e.c && R > 0 && sheetData[R]) {
              const rowData = sheetData[R]
              if (rowData._attachmentUrl && rowData._attachmentUrl !== '—') {
                ws[cellAddress].l = { Target: rowData._attachmentUrl }
              }
            }
            
            ws[cellAddress].s = {
              border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
              }
            }
          }
        }

        const categorySheetName = category.substring(0, 31) // Excel sheet name limit
        XLSX.utils.book_append_sheet(wb, ws, categorySheetName)
      })

      // Write file
      const timestamp = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `${fileName}-${timestamp}.xlsx`)
      alert('success', 'Expenses exported successfully!')
    } catch (error) {
      console.error('Export failed:', error)
      alert('error', 'Failed to export expenses. Please try again.')
    }
  }, [activeTab, alert])

  // Toggle expense selection handlers
  const toggleExpenseSelection = useCallback((expense, selectedIds, setSelectedIds) => {
    const expenseId = expense.id || expense.expenseId || `${expense.candidatename}-${expense.date}-${expense.amount}`
    setSelectedIds((prev) => 
      prev.includes(expenseId) 
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    )
  }, [])

  const toggleSelectAllCurrentTab = useCallback((selectedIds, setSelectedIds) => {
    if (selectedIds.length === currentExpenses.length) {
      setSelectedIds([])
    } else {
      const allIds = currentExpenses.map(exp => exp.id || exp.expenseId || `${exp.candidatename}-${exp.date}-${exp.amount}`)
      setSelectedIds(allIds)
    }
  }, [currentExpenses])

  return (
    <div className="payments-page">
      <PageHeader
        title="Expenses Management"
        subtitle="Validate, approve, and reject candidate expenses"
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{width: 'fit-content'}}
              onClick={() => setAllocateAccessModalOpen(true)}
            >
              Allocate Expense Access
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPaidExpensesModalOpen(true)}
            >
              Show Paid Expenses
            </button>
            <button className="btn btn-secondary btn-sm" onClick={fetchExpenses}>
              <FontAwesomeIcon icon={faFileExcel} /> Refresh
            </button>
          </div>
        }
      />

      {/* Statistics Cards */}
      <div className="stats-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <StatCard
          label="Pending Expenses"
          value={stats.totalPending}
          icon={<FontAwesomeIcon icon={faUsers} />}
          iconStyle={{ background: 'var(--yellow-light)', color: 'var(--saffron)' }}
        />
        <StatCard
          label="Pending Amount"
          value={`₹ ${(stats.totalPendingAmount || 0).toLocaleString('en-IN')}`}
          icon={<FontAwesomeIcon icon={faIndianRupee} />}
          iconStyle={{ background: 'var(--orange-light)', color: 'var(--orange)' }}
        />
        <StatCard
          label="Approved Expenses"
          value={stats.totalApproved}
          icon={<FontAwesomeIcon icon={faCheck} />}
          iconStyle={{ background: 'var(--green-light)', color: 'var(--green)' }}
        />
        <StatCard
          label="Total Approved Amount"
          value={`₹ ${(stats.totalApprovedAmount || 0).toLocaleString('en-IN')}`}
          icon={<FontAwesomeIcon icon={faIndianRupee} />}
          iconStyle={{ background: 'var(--green-light)', color: 'var(--green)' }}
        />
        <StatCard
          label="Paid Expenses"
          value={stats.totalPaid}
          icon={<FontAwesomeIcon icon={faCheck} />}
          iconStyle={{ background: 'var(--blue-light)', color: 'var(--primary)' }}
        />
        <StatCard
          label="Total Paid Amount"
          value={`₹ ${(stats.totalPaidAmount || 0).toLocaleString('en-IN')}`}
          icon={<FontAwesomeIcon icon={faIndianRupee} />}
          iconStyle={{ background: 'var(--blue-light)', color: 'var(--primary)' }}
        />
      </div>

      {/* Tabs */}
      <div className="expenses-tabs">
        <button
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({stats.totalPending})
        </button>
        <button
          className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Approved ({stats.totalApproved})
        </button>
        <button
          className={`tab-button ${activeTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          Rejected ({stats.totalRejected})
        </button>
      </div>

      {/* Filters */}
      <div className="filter-controls" style={{
        marginBlock: '2px',
        background: 'white',
        padding: '12px',
        borderRadius: '8px',
        display: 'grid',
        gap: '12px'
      }}>
        <div className="search-box" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          border: '1px solid var(--border-light)',
          borderRadius: '6px',
          background: 'var(--bg)'
        }}>
          <FontAwesomeIcon icon={faUsers} />
          <input
            type="text"
            placeholder="Search by candidate name..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '14px'
            }}
          />
        </div>

        <div className="filter-group" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px'
        }}>
          <select
            className="form-control"
            value={filters.project}
            onChange={(e) => handleFilterChange('project', e.target.value)}
            disabled={projectsLoading}
          >
            <option value="">
              {projectsLoading ? 'Loading projects...' : 'All Projects'}
            </option>
            {projects.map((project) => (
              <option key={project.id || project.project_id} value={project.id || project.project_id}>
                {project.name || project.project_name || project.title}
              </option>
            ))}
          </select>

          {showLocationFilter ? (
            <select
              className="form-control"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              disabled={locationsLoading || !filters.project}
            >
              <option value="">
                {locationsLoading ? 'Loading locations...' : !filters.project ? 'Select project first' : 'All Locations'}
              </option>
              {locations.map((location) => (
                <option key={location.id || location.location_id} value={location.id || location.location_id}>
                  {location.name || location.location_name || location.city}
                </option>
              ))}
            </select>
          ) : (
            <>
              <select
                className="form-control"
                value={filters.district}
                onChange={(e) => handleFilterChange('district', e.target.value)}
                disabled={districtsLoading || !filters.project}
              >
                <option value="">
                  {districtsLoading ? 'Loading districts...' : !filters.project ? 'Select project first' : 'All Districts'}
                </option>
                {districts.map((district) => (
                  <option key={district.id || district.district_id} value={district.id || district.district_id}>
                    {district.name || district.district_name}
                  </option>
                ))}
              </select>

              <select
                className="form-control"
                value={filters.centre}
                onChange={(e) => handleFilterChange('centre', e.target.value)}
                disabled={centresLoading || !filters.district}
              >
                <option value="">
                  {centresLoading ? 'Loading centres...' : !filters.district ? 'Select district first' : 'All Centres'}
                </option>
                {centres.map((centre) => (
                  <option key={centre.id || centre.centre_id} value={centre.id || centre.centre_id}>
                    {centre.name || centre.centre_name}
                  </option>
                ))}
              </select>
            </>
          )}

          <select
            className="form-control"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .filter-group { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .filter-group { grid-template-columns: 1fr !important; }
          .expenses-table { font-size: 12px; }
          .expenses-table th, .expenses-table td { padding: 6px !important; }
        }
      `}</style>

      {/* Content */}
      <div className="expenses-content" style={{background: 'white'}}>
        {activeTab === 'approved' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            borderBottom: '1px solid var(--border-light)',
            background: '#f8faf9',
            '@media (max-width: 640px)': {
              gridTemplateColumns: '1fr',
              padding: '8px'
            }
          }}>
            <div style={{ color: 'var(--text3)', fontSize: '12px' }}>
              {selectedApprovedExpenseIds.length > 0 ? (
                <>
                  <strong>{selectedApprovedExpenseIds.length}</strong> approved expense{selectedApprovedExpenseIds.length > 1 ? 's' : ''} selected
                </>
              ) : (
                'Select approved expenses to mark as paid.'
              )}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const selectedExpenses = currentExpenses.filter(exp => selectedApprovedExpenseIds.includes(exp.id || exp.expenseId || `${exp.candidatename}-${exp.date}-${exp.amount}`))
                exportExpensesToExcel(selectedExpenses, `approved-expenses`)
              }}
              disabled={!selectedApprovedExpenseIds.length}
              style={{ width: 'fit-content' }}
              title="Export selected expenses to Excel"
            >
              <FontAwesomeIcon icon={faFileExcel} /> Export
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={handleMarkSelectedPaid}
              disabled={!selectedApprovedExpenseIds.length || markPaidInProgress}
              style={{ width: 'fit-content', minHeight: '36px' }}
            >
              {markPaidInProgress ? 'Marking...' : 'Mark as Paid'}
            </button>
          </div>
        )}
        
        {activeTab === 'pending' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            borderBottom: '1px solid var(--border-light)',
            background: '#f8faf9',
            '@media (max-width: 640px)': {
              gridTemplateColumns: '1fr',
              padding: '8px'
            }
          }}>
            <div style={{ color: 'var(--text3)', fontSize: '12px' }}>
              {selectedPendingExpenseIds.length > 0 ? (
                <>
                  <strong>{selectedPendingExpenseIds.length}</strong> pending expense{selectedPendingExpenseIds.length > 1 ? 's' : ''} selected
                </>
              ) : (
                'Select pending expenses to export.'
              )}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const selectedExpenses = currentExpenses.filter(exp => selectedPendingExpenseIds.includes(exp.id || exp.expenseId || `${exp.candidatename}-${exp.date}-${exp.amount}`))
                exportExpensesToExcel(selectedExpenses, `pending-expenses`)
              }}
              disabled={!selectedPendingExpenseIds.length}
              style={{ width: 'fit-content' }}
              title="Export selected expenses to Excel"
            >
              <FontAwesomeIcon icon={faFileExcel} /> Export
            </button>
          </div>
        )}
        
        {activeTab === 'rejected' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            borderBottom: '1px solid var(--border-light)',
            background: '#f8faf9',
            '@media (max-width: 640px)': {
              gridTemplateColumns: '1fr',
              padding: '8px'
            }
          }}>
            <div style={{ color: 'var(--text3)', fontSize: '12px' }}>
              {selectedRejectedExpenseIds.length > 0 ? (
                <>
                  <strong>{selectedRejectedExpenseIds.length}</strong> rejected expense{selectedRejectedExpenseIds.length > 1 ? 's' : ''} selected
                </>
              ) : (
                'Select rejected expenses to export.'
              )}
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const selectedExpenses = currentExpenses.filter(exp => selectedRejectedExpenseIds.includes(exp.id || exp.expenseId || `${exp.candidatename}-${exp.date}-${exp.amount}`))
                exportExpensesToExcel(selectedExpenses, `rejected-expenses`)
              }}
              disabled={!selectedRejectedExpenseIds.length}
              style={{ width: 'fit-content' }}
              title="Export selected expenses to Excel"
            >
              <FontAwesomeIcon icon={faFileExcel} /> Export
            </button>
          </div>
        )}
        
        {expensesLoading ? (
          <Card className="loading-state">Loading expenses...</Card>
        ) : currentExpenses.length === 0 ? (
          <Card className="empty-state">
            No {activeTab} expenses found
          </Card>
        ) : (
          <div className="expenses-list">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>S.No</th>
                  <th style={{ width: '38px' }}>
                    <input
                      type="checkbox"
                      checked={currentExpenses.length > 0 && currentExpenses.every((expense) => {
                        const expenseId = expense.id || expense.expenseId || `${expense.candidatename}-${expense.date}-${expense.amount}`
                        const selectedIds = activeTab === 'approved' ? selectedApprovedExpenseIds : activeTab === 'pending' ? selectedPendingExpenseIds : selectedRejectedExpenseIds
                        return selectedIds.includes(expenseId)
                      })}
                      onChange={() => {
                        if (activeTab === 'approved') {
                          toggleSelectAllCurrentTab(selectedApprovedExpenseIds, setSelectedApprovedExpenseIds)
                        } else if (activeTab === 'pending') {
                          toggleSelectAllCurrentTab(selectedPendingExpenseIds, setSelectedPendingExpenseIds)
                        } else if (activeTab === 'rejected') {
                          toggleSelectAllCurrentTab(selectedRejectedExpenseIds, setSelectedRejectedExpenseIds)
                        }
                      }}
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Mobile</th>
                  <th>Aadhaar</th>
                  <th>Project</th>
                  {showAllLocationColumns ? (
                    <>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Location</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>District</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Centre</th>
                    </>
                  ) : showLocationFilter ? (
                    <th style={{ padding: '8px', textAlign: 'left' }}>Location</th>
                  ) : (
                    <>
                      <th style={{ padding: '8px', textAlign: 'left' }}>District</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Centre</th>
                    </>
                  )}
                  <th style={{ padding: '8px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentExpenses.map((expense, idx) => {
                  const expenseId = expense.id || idx
                  const rowExpenseId = expense.id || expense.expenseId || `${expense.candidatename}-${expense.date}-${expense.amount}`
                  
                  let selectedIds = []
                  let setSelectedIds = () => {}
                  if (activeTab === 'approved') {
                    selectedIds = selectedApprovedExpenseIds
                    setSelectedIds = setSelectedApprovedExpenseIds
                  } else if (activeTab === 'pending') {
                    selectedIds = selectedPendingExpenseIds
                    setSelectedIds = setSelectedPendingExpenseIds
                  } else if (activeTab === 'rejected') {
                    selectedIds = selectedRejectedExpenseIds
                    setSelectedIds = setSelectedRejectedExpenseIds
                  }
                  
                  const isSelected = selectedIds.includes(rowExpenseId)

                  return (
                    <tr key={expenseId} style={{ borderBottom: '1px solid var(--border-light)', padding: '8px' }}>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>
                        {(pagination.page - 1) * pagination.limit + idx + 1}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleExpenseSelection(expense, selectedIds, setSelectedIds)}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <div className="expense-main" style={{ display: 'grid', gap: '4px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{expense.candidatename || '—'}</h4>
                          <p className="expense-description" style={{
                            margin: 0,
                            fontSize: '11px',
                            color: 'var(--text3)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '180px'
                          }}>
                            {expense.mobileNumber || expense.phone || '—'}
                          </p>
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>{expense.mobileNumber || expense.phone || '—'}</td>
                      <td style={{ padding: '8px' }}>{expense.aadhaar || '—'}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{expense.projectName || expense.project_name || '—'}</td>
                      {showAllLocationColumns ? (
                        <>
                          <td style={{ padding: '8px' }}>{expense.locationName || expense.location_name || expense.location_id || expense.location || '—'}</td>
                          <td style={{ padding: '8px' }}>{expense.districtName || expense.district_name || expense.district_id || expense.district || '—'}</td>
                          <td style={{ padding: '8px' }}>{expense.centreName || expense.centre_name || expense.centre_id || expense.centre || '—'}</td>
                        </>
                      ) : showLocationFilter ? (
                        <td style={{ padding: '8px' }}>{expense.locationName || expense.location_name || expense.location_id || expense.location || '—'}</td>
                      ) : (
                        <>
                          <td style={{ padding: '8px' }}>{expense.districtName || expense.district_name || expense.district_id || expense.district || '—'}</td>
                          <td style={{ padding: '8px' }}>{expense.centreName || expense.centre_name || expense.centre_id || expense.centre || '—'}</td>
                        </>
                      )}
                      <td style={{ padding: '8px' }}>{expense.category || '—'}</td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{expense.date || '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>₹ {(expense.amount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '4px', textAlign: 'center' }} className="expense-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleExpenseClick(expense)}
                          style={{ width: '32px', height: '32px', padding: '4px' }}
                          title="View"
                        >
                          <FontAwesomeIcon icon={faEye} />
                        </button>
                        {activeTab === 'pending' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => {
                                setSelectedExpense(expense)
                                setActionReason('')
                                handleApproveExpense()
                              }}
                              style={{ width: '32px', height: '32px'}}
                              title="Approve"
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleExpenseClick(expense)}
                              style={{ width: '32px', height: '32px'}}
                              title="Reject"
                            >
                              <FontAwesomeIcon icon={faTimes} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-footer" style={{
          marginTop: '0',
          display: 'grid',
          gap: '12px',
          padding: '12px',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center'
        }}>
            <div className="pagination-left">
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Show:
                <select
                  value={pagination.limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="form-control form-control-sm"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>

            <div className="pagination-right" style={{
              display: 'grid',
              gap: '8px',
              gridTemplateColumns: 'auto 1fr',
              alignItems: 'center'
            }}>
              <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                <div className="pagination-summary" style={{
                  fontSize: '11px',
                  color: 'var(--text3)',
                  whiteSpace: 'nowrap'
                }}>
                  Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </div>

              </div>

              <div className="pagination-controls" style={{
                display: 'flex',
                gap: '4px',
                justifyContent: 'flex-end',
                flexWrap: 'wrap'
              }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  ← Prev
                </button>

                {Array.from({ length: Math.min(3, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(pagination.totalPages - 2, pagination.page - 1)) + i
                  if (pageNum > pagination.totalPages) return null

                  return (
                    <button
                      key={pageNum}
                      className={`btn ${pagination.page === pageNum ? 'btn-primary' : 'btn-outline'} btn-sm`}
                      onClick={() => handlePageChange(pageNum)}
                      style={{ width: '32px', height: '32px', padding: '4px', fontSize: '12px' }}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
      </div>

      {/* Allocate Expense Access Modal */}
      <Modal
        title={accessModalMode === 'revoke' ? 'Revoke Expense Access' : 'Allocate Expense Access'}
        isOpen={allocateAccessModalOpen}
        onClose={() => {
          setAllocateAccessModalOpen(false)
          setSelectedAccessCandidates([])
          setAccessCandidates([])
          setAccessQuery('')
          setAccessInfoMessage('Search by name, Aadhaar number, or mobile number.')
          setSelectedAccessProject('')
          setAccessModalMode('grant')
        }}
        maxWidth="min(90vw, 900px)"
        footer={
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '12px',
            padding: '12px',
            borderTop: '1px solid var(--border-light)',
            background: 'var(--bg)',
            '@media (max-width: 640px)': {
              gridTemplateColumns: '1fr'
            }
          }}>
            <div style={{
              color: 'var(--text3)',
              fontSize: '12px',
              gridColumn: 'span 3',
              '@media (max-width: 640px)': {
                gridColumn: 'span 1'
              }
            }}>
              {accessModalMode === 'revoke'
                ? 'Select existing access candidates to revoke expense access.'
                : 'Search candidates from the results and click Allow Access.'}
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => {
              setAllocateAccessModalOpen(false)
              setSelectedAccessCandidates([])
              setAccessCandidates([])
              setAccessQuery('')
              setAccessInfoMessage('Search by name, Aadhaar number, or mobile number.')
              setSelectedAccessProject('')
              setAccessModalMode('grant')
            }} style={{ width: '100%' }}>
              Close
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={accessModalMode === 'revoke' ? handleRevokeExpenseAccess : handleGrantExpenseAccess}
              disabled={!selectedAccessCandidates.length || accessActionInProgress || !selectedAccessProject}
              style={{ width: '100%', minHeight: '36px' }}
            >
              {accessActionInProgress ? accessActionLoadingText : accessActionButtonText}
            </button>
          </div>
        }
      >
        <div style={{
          display: 'grid',
          gap: '16px',
          padding: '12px',
          gridTemplateColumns: '1fr',
          '@media (max-width: 640px)': {
            padding: '8px'
          }
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${accessModalMode === 'grant' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleAccessModalModeChange('grant')}
            >
              Grant access
            </button>
            <button
              type="button"
              className={`btn btn-sm ${accessModalMode === 'revoke' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => handleAccessModalModeChange('revoke')}
            >
              Revoke access
            </button>
          </div>

          {accessModalMode === 'grant' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px',
              '@media (max-width: 640px)': {
                gridTemplateColumns: '1fr'
              }
            }}>
              <div>
                <label className="form-label">Search candidate</label>
                <input
                  className="form-control"
                  type="text"
                  value={accessQuery}
                  placeholder="Enter name, mobile number, or Aadhaar"
                  onChange={(e) => setAccessQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAccessCandidates()}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={fetchAccessCandidates}
                  disabled={accessLoading}
                  style={{ width: '100%' }}
                >
                  {accessLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
            <label className="form-label">Project</label>
            <select
              className="form-control"
              value={selectedAccessProject}
              onChange={(e) => setSelectedAccessProject(e.target.value)}
              disabled={projectsLoading}
            >
              <option value="">{projectsLoading ? 'Loading projects...' : accessModalMode === 'revoke' ? 'Select project to revoke access' : 'Select project to grant access'}</option>
              {projects.map((project) => (
                <option key={project.id || project.project_id} value={project.id || project.project_id}>
                  {project.name || project.project_name || project.title}
                </option>
              ))}
            </select>
          </div>

          {selectedAccessCandidates.length > 0 && (
            <div style={{ color: 'var(--text)', fontSize: '14px' }}>
              {selectedAccessCandidates.length} candidate{selectedAccessCandidates.length > 1 ? 's' : ''} selected
            </div>
          )}

          <div style={{ minHeight: '160px', background: 'var(--bg)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px' }}>
            {accessModalMode === 'revoke' && accessWithExpenseLoading ? (
              <div style={{ color: 'var(--text3)' }}>Loading existing access candidates...</div>
            ) : accessModalMode === 'grant' && accessLoading ? (
              <div style={{ color: 'var(--text3)' }}>Searching candidates...</div>
            ) : accessCandidatesToDisplay.length === 0 ? (
              <div style={{ color: 'var(--text3)' }}>
                {accessModalMode === 'revoke'
                  ? 'No candidates currently have expense access.'
                  : accessInfoMessage}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="expenses-table" style={{ width: '100%', margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>S.No</th>
                      <th style={{ width: '38px' }}></th>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Aadhaar</th>
                      {accessModalMode === 'revoke' ? (
                        <>
                          <th>Project ID</th>
                          <th>Project</th>
                          <th>Status</th>
                        </>
                      ) : (
                        <th>Location</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {accessCandidatesToDisplay.map((candidate, idx) => {
                      const candidateId = candidate.id || `${candidate.mobile}-${candidate.aadhaar}-${candidate.name}`
                      const hasExistingAccess = existingAccessCandidateIds.includes(candidate.id) || existingAccessCandidateIds.includes(candidateId)
                      const isSelected = selectedAccessCandidates.some((item) => item.id === candidateId)
                      const isChecked = accessModalMode === 'grant' ? (isSelected || hasExistingAccess) : isSelected
                      return (
                        <tr
                          key={candidateId}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(14, 165, 233, 0.08)' : accessModalMode === 'grant' && hasExistingAccess ? 'rgba(34, 197, 94, 0.06)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>
                            {idx + 1}
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectedAccessCandidate({ ...candidate, id: candidateId })}
                              title={accessModalMode === 'grant' && hasExistingAccess ? 'Already has access' : ''}
                            />
                          </td>
                          <td>{candidate.id}</td>
                          <td>{candidate.name}{accessModalMode === 'grant' && hasExistingAccess && <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '6px' }}>✓</span>}</td>
                          <td>{candidate.mobile}</td>
                          <td>{candidate.aadhaar}</td>
                          {accessModalMode === 'revoke' ? (
                            <>
                              <td>{candidate.projectId}</td>
                              <td>{candidate.projectName}</td>
                              <td>{candidate.status}</td>
                            </>
                          ) : (
                            <td>{candidate.location}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Paid Expenses Modal */}
      <Modal
        title="Paid Expenses"
        isOpen={paidExpensesModalOpen}
        onClose={() => {
          setPaidExpensesModalOpen(false)
          setPaidExpenses([])
          setPaidExpensesFilters({
            search: '',
            project: '',
            location: '',
            district: '',
            centre: '',
            category: '',
          })
          setPaidExpensesPagination({
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          })
        }}
        maxWidth="min(90vw, 1100px)"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 24px', borderTop: '1px solid var(--border-light)', background: 'var(--bg)' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setPaidExpensesModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: '18px', padding: '12px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Search</label>
              <input
                className="form-control"
                type="text"
                value={paidExpensesFilters.search}
                placeholder="Search by candidate, mobile, Aadhaar or project"
                onChange={(e) => handlePaidExpensesFilterChange('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchPaidExpenses(1, paidExpensesFilters)}
              />
            </div>
            <div>
              <label className="form-label">Project</label>
              <select
                className="form-control"
                value={paidExpensesFilters.project}
                onChange={(e) => handlePaidExpensesFilterChange('project', e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id || project.project_id} value={project.id || project.project_id}>
                    {project.name || project.project_name || project.title}
                  </option>
                ))}
              </select>
            </div>
            {showPaidExpensesLocationFilter ? (
              <div>
                <label className="form-label">Location</label>
                <select
                  className="form-control"
                  value={paidExpensesFilters.location}
                  onChange={(e) => handlePaidExpensesFilterChange('location', e.target.value)}
                  disabled={!paidExpensesFilters.project}
                >
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id || location.location_id} value={location.id || location.location_id}>
                      {location.name || location.location_name || location.city}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="form-label">District</label>
                  <select
                    className="form-control"
                    value={paidExpensesFilters.district}
                    onChange={(e) => handlePaidExpensesFilterChange('district', e.target.value)}
                    disabled={!paidExpensesFilters.project}
                  >
                    <option value="">All Districts</option>
                    {districts.map((district) => (
                      <option key={district.id || district.district_id} value={district.id || district.district_id}>
                        {district.name || district.district_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Centre</label>
                  <select
                    className="form-control"
                    value={paidExpensesFilters.centre}
                    onChange={(e) => handlePaidExpensesFilterChange('centre', e.target.value)}
                    disabled={!paidExpensesFilters.district}
                  >
                    <option value="">All Centres</option>
                    {centres.map((centre) => (
                      <option key={centre.id || centre.centre_id} value={centre.id || centre.centre_id}>
                        {centre.name || centre.centre_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchPaidExpenses(1, paidExpensesFilters)} disabled={paidExpensesLoading}>
              {paidExpensesLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Paid Expenses Selection and Export */}
          {paidExpenses.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              borderRadius: '8px',
              background: '#f8faf9',
              '@media (max-width: 640px)': {
                gridTemplateColumns: '1fr',
                padding: '8px'
              }
            }}>
              <div style={{ color: 'var(--text3)', fontSize: '12px' }}>
                {selectedPaidExpenseIds.length > 0 ? (
                  <>
                    <strong>{selectedPaidExpenseIds.length}</strong> paid expense{selectedPaidExpenseIds.length > 1 ? 's' : ''} selected
                  </>
                ) : (
                  'Select paid expenses to export.'
                )}
              </div>
              <div></div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const selectedExpenses = paidExpenses.filter(exp => selectedPaidExpenseIds.includes(exp.id || exp.expenseId || `${exp.candidatename}-${exp.date}-${exp.amount}`))
                  exportExpensesToExcel(selectedExpenses, `paid-expenses`)
                }}
                disabled={!selectedPaidExpenseIds.length}
                style={{ width: 'fit-content' }}
                title="Export selected paid expenses to Excel"
              >
                <FontAwesomeIcon icon={faFileExcel} /> Export
              </button>
            </div>
          )}

          {/* Paid Expenses Table */}
          <div style={{ minHeight: '180px', background: 'var(--bg)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px' }}>
            {paidExpensesLoading ? (
              <div style={{ color: 'var(--text3)' }}>Loading paid expenses...</div>
            ) : paidExpenses.length === 0 ? (
              <div style={{ color: 'var(--text3)' }}>No paid expenses found for this filter.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="expenses-table" style={{ width: '100%', margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>S.No</th>
                      <th style={{ width: '38px' }}>
                        <input
                          type="checkbox"
                          checked={paidExpenses.length > 0 && paidExpenses.every((expense) => {
                            const expenseId = expense.id || expense.expenseId || `${expense.candidatename}-${expense.date}-${expense.amount}`
                            return selectedPaidExpenseIds.includes(expenseId)
                          })}
                          onChange={() => {
                            if (selectedPaidExpenseIds.length === paidExpenses.length) {
                              setSelectedPaidExpenseIds([])
                            } else {
                              const allIds = paidExpenses.map(exp => exp.id || exp.expenseId || `${exp.candidatename}-${exp.date}-${exp.amount}`)
                              setSelectedPaidExpenseIds(allIds)
                            }
                          }}
                        />
                      </th>
                      <th>Candidate</th>
                      <th>Mobile</th>
                      <th>Aadhaar</th>
                      <th>Project</th>
                      {showPaidExpensesAllLocationColumns ? (
                        <>
                          <th>Location</th>
                          <th>District</th>
                          <th>Centre</th>
                        </>
                      ) : showPaidExpensesLocationFilter ? (
                        <th>Location</th>
                      ) : (
                        <>
                          <th>District</th>
                          <th>Centre</th>
                        </>
                      )}
                      <th>Category</th>
                      <th>Date</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidExpenses.map((expense, idx) => {
                      const expenseId = expense.id || idx
                      const rowExpenseId = expense.id || expense.expenseId || `${expense.candidatename}-${expense.date}-${expense.amount}`
                      const isSelected = selectedPaidExpenseIds.includes(rowExpenseId)
                      return (
                        <tr key={expenseId}>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>
                            {(paidExpensesPagination.page - 1) * paidExpensesPagination.limit + idx + 1}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedPaidExpenseIds(prev => prev.filter(id => id !== rowExpenseId))
                                } else {
                                  setSelectedPaidExpenseIds(prev => [...prev, rowExpenseId])
                                }
                              }}
                            />
                          </td>
                          <td>
                            <div className="expense-main">
                              <h4>{expense.candidatename || expense.name || '—'}</h4>
                              <p className="expense-description">{expense.description || expense.reason || '—'}</p>
                            </div>
                          </td>
                          <td>{expense.mobileNumber || expense.phone || '—'}</td>
                          <td>{expense.aadhaar || '—'}</td>
                          <td>{expense.projectName || expense.project_name || '—'}</td>
                          {showPaidExpensesAllLocationColumns ? (
                            <>
                              <td>{expense.locationName || expense.location_name || '—'}</td>
                              <td>{expense.districtName || expense.district_name || '—'}</td>
                              <td>{expense.centreName || expense.centre_name || '—'}</td>
                            </>
                          ) : showPaidExpensesLocationFilter ? (
                            <td>{expense.locationName || expense.location_name || '—'}</td>
                          ) : (
                            <>
                              <td>{expense.districtName || expense.district_name || '—'}</td>
                              <td>{expense.centreName || expense.centre_name || '—'}</td>
                            </>
                          )}
                          <td>{expense.category || '—'}</td>
                          <td>{expense.date || '—'}</td>
                          <td>₹ {(expense.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paid Expenses Pagination */}
          <div className="pagination-footer" style={{marginTop: '0'}}>
            <div className="pagination-left">
              <label>
                Show:
                <select
                  value={paidExpensesPagination.limit}
                  onChange={(e) => setPaidExpensesPagination((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                  className="form-control form-control-sm"
                  style={{ marginLeft: '8px', width: 'auto' }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                entries
              </label>
            </div>

            <div className="pagination-right">
              <div className="pagination-summary">
                Showing {Math.min((paidExpensesPagination.page - 1) * paidExpensesPagination.limit + 1, paidExpensesPagination.total)} to{' '}
                {Math.min(paidExpensesPagination.page * paidExpensesPagination.limit, paidExpensesPagination.total)} of {paidExpensesPagination.total} entries
              </div>

              <div className="pagination-controls" style={{ flexWrap: 'nowrap' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handlePaidExpensesPageChange(paidExpensesPagination.page - 1)}
                  disabled={paidExpensesPagination.page <= 1}
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, paidExpensesPagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(paidExpensesPagination.totalPages - 4, paidExpensesPagination.page - 2)) + i
                  if (pageNum > paidExpensesPagination.totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      className={`btn ${paidExpensesPagination.page === pageNum ? 'btn-primary' : 'btn-outline'} btn-sm`}
                      onClick={() => handlePaidExpensesPageChange(pageNum)}
                      style={{ width: 'fit-content', height:'unset' }}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handlePaidExpensesPageChange(paidExpensesPagination.page + 1)}
                  disabled={paidExpensesPagination.page >= paidExpensesPagination.totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: activeTab === 'pending' ? 'linear-gradient(135deg, #fef3c7, #fde68a)' :
                         activeTab === 'approved' ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' :
                         'linear-gradient(135deg, #fee2e2, #fecaca)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeTab === 'pending' ? '#92400e' :
                     activeTab === 'approved' ? '#065f46' : '#991b1b'
            }}>
              <FontAwesomeIcon
                icon={activeTab === 'pending' ? faEye :
                      activeTab === 'approved' ? faCheck : faTimes}
                size="lg"
              />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>
                Expense Details
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text3)' }}>
                Review and update expense status
              </p>
            </div>
          </div>
        }
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setSelectedExpense(null)
          setActionReason('')
        }}
        maxWidth="700px"
        footer={
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderTop: '1px solid var(--border-light)',
            background: 'var(--bg)',
            width: '100%'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--text3)' }}>
              {actionReason ? `Reason: ${actionReason.substring(0, 40)}${actionReason.length > 40 ? '...' : ''}` : isRejectedTab ? 'This expense has already been rejected. Approve it to restore.' : 'Provide a reason if rejecting'}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setDetailsModalOpen(false)}
                style={{ minWidth: '80px' }}
              >
                Close
              </button>
              {activeTab === 'approved' ? (
                <>
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleMarkExpensePaid}
                  disabled={actionInProgress}
                  style={{
                    minWidth: '140px',
                    background: actionInProgress ? '#d1fae5' : 'linear-gradient(135deg, #059669, #047857)',
                    border: 'none',
                    color: 'white',
                    boxShadow: actionInProgress ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  <FontAwesomeIcon icon={faIndianRupee} style={{ marginRight: '6px' }} />
                  {actionInProgress ? 'Marking Paid...' : 'Mark as Paid'}
                </button>
                <button
                    className="btn btn-danger btn-sm"
                    onClick={handleRejectExpense}
                    disabled={actionInProgress || !actionReason}
                    style={{
                      minWidth: '120px',
                      background: actionInProgress || !actionReason ? '#fee2e2' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                      border: 'none',
                      color: 'white',
                      boxShadow: actionInProgress || !actionReason ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} style={{ marginRight: '6px' }} />
                    {actionInProgress ? 'Rejecting...' : 'Reject'}
                  </button>
                  </>
              ) : isRejectedTab ? (
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleApproveExpense}
                  disabled={actionInProgress}
                  style={{
                    minWidth: '120px',
                    background: actionInProgress ? '#d1fae5' : 'linear-gradient(135deg, #059669, #047857)',
                    border: 'none',
                    color: 'white',
                    boxShadow: actionInProgress ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)'
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} style={{ marginRight: '6px' }} />
                  {actionInProgress ? 'Approving...' : 'Approve'}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleRejectExpense}
                    disabled={actionInProgress || !actionReason}
                    style={{
                      minWidth: '120px',
                      background: actionInProgress || !actionReason ? '#fee2e2' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                      border: 'none',
                      color: 'white',
                      boxShadow: actionInProgress || !actionReason ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)'
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} style={{ marginRight: '6px' }} />
                    {actionInProgress ? 'Rejecting...' : 'Reject'}
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={handleApproveExpense}
                    disabled={actionInProgress}
                    style={{
                      minWidth: '120px',
                      background: actionInProgress ? '#d1fae5' : 'linear-gradient(135deg, #059669, #047857)',
                      border: 'none',
                      color: 'white',
                      boxShadow: actionInProgress ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.3)'
                    }}
                  >
                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: '6px' }} />
                    {actionInProgress ? 'Approving...' : 'Approve'}
                  </button>
                </>
              )}
            </div>
          </div>
        }
      >
        {expenseDetailsLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '16px',
            margin: '20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--border-light)',
              borderTop: '4px solid var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '16px'
            }}></div>
            <p style={{ margin: 0, color: 'var(--text3)', fontSize: '14px' }}>
              Loading expense details...
            </p>
          </div>
        ) : selectedExpense && (
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: '16px',
            padding: '20px'
          }}>
            {/* Header Section */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid var(--border-light)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{
                    margin: '0 0 4px',
                    fontSize: '18px',
                    fontWeight: '700',
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FontAwesomeIcon icon={faUsers} style={{ color: 'var(--primary)' }} />
                    {selectedExpense.candidatename || '—'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text3)' }}>
                    Expense ID: #{selectedExpense.id || 'N/A'}
                  </p>
                </div>
                <div style={{
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '18px',
                  fontWeight: '700',
                  textAlign: 'center',
                  minWidth: '120px',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                }}>
                  ₹ {(selectedExpense.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px',
                marginTop: '16px'
              }}>
                <div style={{
                  background: 'var(--bg)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--text3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px'
                  }}>
                    Category
                  </label>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                    {selectedExpense.category || '—'}
                  </p>
                </div>
                <div style={{
                  background: 'var(--bg)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--text3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px'
                  }}>
                    Date
                  </label>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                    {selectedExpense.date || '—'}
                  </p>
                </div>
                <div style={{
                  background: 'var(--bg)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)'
                }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--text3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px'
                  }}>
                    Project
                  </label>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                    {selectedExpense.projectName || selectedExpense.project_name || '—'}
                  </p>
                </div>
                {(selectedExpense.locationName || selectedExpense.location_name) ? (
                  <div style={{
                    background: 'var(--bg)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-light)'
                  }}>
                    <label style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: 'var(--text3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      Location
                    </label>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                      {selectedExpense.locationName || selectedExpense.location_name || '—'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{
                      background: 'var(--bg)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)'
                    }}>
                      <label style={{
                        display: 'block',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--text3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '4px'
                      }}>
                        District
                      </label>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                        {selectedExpense.districtname || selectedExpense.district_name || selectedExpense.district_id || '—'}
                      </p>
                    </div>
                    <div style={{
                      background: 'var(--bg)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)'
                    }}>
                      <label style={{
                        display: 'block',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--text3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '4px'
                      }}>
                        Centre
                      </label>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                        {selectedExpense.centrename || selectedExpense.centre_name || selectedExpense.centre_id || '—'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid var(--border-light)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}>
              <h4 style={{
                margin: '0 0 12px',
                fontSize: '16px',
                fontWeight: '700',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FontAwesomeIcon icon={faFileExcel} style={{ color: 'var(--primary)' }} />
                Description
              </h4>
              <div style={{
                background: 'var(--bg)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                fontSize: '14px',
                lineHeight: '1.6',
                color: 'var(--text2)'
              }}>
                {selectedExpense.description || selectedExpense.reason || 'No description provided'}
              </div>
            </div>

            {renderCategoryDetailsSection(selectedExpense)}

            {/* Attachment Section */}
            {(selectedExpense?.attachment || selectedExpense?.attachments?.length > 0) && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                border: '1px solid var(--border-light)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              }}>
                <h4 style={{
                  margin: '0 0 12px',
                  fontSize: '16px',
                  fontWeight: '700',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FontAwesomeIcon icon={faFileExcel} style={{ color: 'var(--primary)' }} />
                  {selectedExpense?.attachments?.length > 1 ? 'Attachments' : 'Attachment'}
                </h4>
                
                {/* Multiple attachments */}
                {selectedExpense?.attachments && selectedExpense.attachments.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {selectedExpense.attachments.map((attachment, index) => (
                      <div key={index} style={{
                        background: 'var(--bg)',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'center'
                      }}>
                        <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: '500' }}>
                          {attachment.name || `Attachment ${index + 1}`}
                        </span>
                        <button
                          onClick={() => handleViewAttachment(attachment.url || attachment)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 12px',
                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '12px',
                            transition: 'all 0.2s ease',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                          onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                        >
                          <FontAwesomeIcon icon={faEye} />
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Fallback for single attachment */
                  <button
                    onClick={() => handleViewAttachment(selectedExpense.attachment)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    <FontAwesomeIcon icon={faEye} />
                    View Receipt
                  </button>
                )}
              </div>
            )}

            {/* Action Section */}
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
              border: '1px solid #f59e0b',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)'
            }}>
              <h4 style={{
                margin: '0 0 12px',
                fontSize: '16px',
                fontWeight: '700',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FontAwesomeIcon icon={faTimes} />
                Update Status
              </h4>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#92400e',
                  marginBottom: '8px'
                }}>
                  {isRejectedTab ? 'Rejection reason' : 'Reason (Required if rejecting)'}
                </label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  readOnly={isRejectedTab}
                  placeholder={isRejectedTab ? 'Review the rejection reason.' : 'Provide a detailed reason for your action...'}
                  style={{
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    background: isRejectedTab ? '#f8f8f8' : 'white',
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>


          </div>
        )}
      </Modal>

      {/* File Attachment Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <FontAwesomeIcon icon={faEye} size="lg" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text)' }}>
                Receipt Preview
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text3)' }}>
                {currentAttachment && (
                  <>
                    {(() => {
                      const type = getFileType(currentAttachment)
                      return type === 'image' ? 'Image receipt preview' : type === 'pdf' ? 'PDF document' : 'Document preview'
                    })()}
                  </>
                )}
              </p>
            </div>
          </div>
        }
        isOpen={attachmentModalOpen}
        onClose={() => {
          setAttachmentModalOpen(false)
          setCurrentAttachment(null)
        }}
        maxWidth="90vw"
        footer={
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            padding: '20px 24px',
            borderTop: '1px solid var(--border-light)',
            background: 'var(--bg)'
          }}>
            <a
              href={currentAttachment}
              target="_blank"
              rel="noreferrer"
              download
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'var(--bg)',
                color: 'var(--text2)',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                border: '1px solid var(--border-light)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'var(--border-light)'
                e.target.style.color = 'var(--text)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'var(--bg)'
                e.target.style.color = 'var(--text2)'
              }}
            >
              <FontAwesomeIcon icon={faEye} />
              Download
            </a>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setAttachmentModalOpen(false)
                setCurrentAttachment(null)
              }}
              style={{ minWidth: '80px' }}
            >
              Close
            </button>
          </div>
        }
      >
        {currentAttachment && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            background: '#000',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {(() => {
              const fileType = getFileType(currentAttachment)
              
              if (fileType === 'image') {
                return (
                  <>
                    <img
                      src={currentAttachment}
                      alt="Receipt"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '70vh',
                        objectFit: 'contain',
                        borderRadius: '4px'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                    <div style={{
                      display: 'none',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '16px',
                      color: 'white',
                      padding: '40px'
                    }}>
                      <FontAwesomeIcon icon={faFileExcel} size="3x" style={{ opacity: 0.5 }} />
                      <p style={{ margin: 0, textAlign: 'center' }}>Unable to preview this image</p>
                    </div>
                  </>
                )
              } else if (fileType === 'pdf') {
                return (
                  <iframe
                    src={currentAttachment}
                    style={{
                      width: '100%',
                      height: '70vh',
                      border: 'none',
                      background: 'white',
                      borderRadius: '4px'
                    }}
                    title="PDF Preview"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                )
              } else if (fileType === 'document') {
                // Using Google Docs Viewer for Word documents
                const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(currentAttachment)}&embedded=true`
                return (
                  <iframe
                    src={viewerUrl}
                    style={{
                      width: '100%',
                      height: '70vh',
                      border: 'none',
                      background: 'white',
                      borderRadius: '4px'
                    }}
                    title="Document Preview"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                )
              }
            })()}
            {/* Fallback for load error */}
            <div style={{
              display: 'none',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              color: 'white',
              padding: '40px',
              textAlign: 'center'
            }}>
              <FontAwesomeIcon icon={faFileExcel} size="3x" style={{ opacity: 0.5 }} />
              <p style={{ margin: '0 0 10px' }}>Unable to preview this file</p>
              <a
                href={currentAttachment}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'underline', fontSize: '14px' }}
              >
                Download instead
              </a>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @media (max-width: 1024px) {
          .payments-page { padding: 12px; }
          .expenses-table { font-size: 13px; }
          .expenses-table th, .expenses-table td { padding: 8px; }
        }
        @media (max-width: 768px) {
          .payments-page { padding: 8px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .expenses-tabs { gap: 4px; }
          .expenses-tabs .tab-button { font-size: 12px; padding: 8px 12px; }
          .filter-group { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .payments-page { padding: 4px; }
          .stats-grid { grid-template-columns: 1fr; gap: 8px; }
          .expenses-tabs { flex-direction: column; }
          .expenses-tabs .tab-button { width: 100%; font-size: 12px; padding: 10px; }
          .filter-group { grid-template-columns: 1fr !important; }
          .expenses-table { font-size: 11px; }
          .expenses-table th, .expenses-table td { padding: 6px !important; }
          .expense-actions { gap: 2px; }
          .expense-actions .btn { width: 28px !important; height: 28px !important; padding: 2px !important; }
          .pagination-footer { gridTemplateColumns: 1fr !important; }
          .pagination-summary { font-size: 10px; }
          .pagination-controls button { padding: 4px 8px; font-size: 11px; }
        }
        @media (max-width: 480px) {
          .payments-page { padding: 2px; }
          .stats-grid { gap: 6px; }
          .stats-grid > div { padding: 10px 8px; }
          .filter-controls { padding: 8px; gap: 8px; }
          .expenses-table { font-size: 10px; }
          .expenses-table th { font-size: 9px; }
          .expense-main h4 { font-size: 12px; }
          .expense-main p { font-size: 10px; max-width: 120px; }
        }
      `}</style>
    </div>
  )
}
