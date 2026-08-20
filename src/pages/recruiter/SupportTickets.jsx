import { useState, useEffect, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSearch,
  faFilter,
  faCheckCircle,
  faTimesCircle,
  faHourglassHalf,
  faEye,
  faReply,
  faFileAlt,
  faTimes,
  faEnvelope,
  faDownload,
  faHistory,
  faFileExcel,
} from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { useAuth } from '../../context/AuthContext'
import { LoadingOverlay } from '../../components/ui'
import { EmailMessenger } from '../../components/ui/EmailMessenger'
import { WhatsAppMessenger } from '../../components/ui/WhatsAppMessenger'
import './SupportTickets.css'

import { TicketActivityLineChart } from '../../components/ui/Charts'
const TICKET_STATUS = {
  open: 'Open',
  inReview: 'In Review',
  resolved: 'Resolved',
}

const CATEGORIES = [
  'Payment',
  'Attendance',
  'KYC',
  'Job-application',
  'Offer/Joining',
  'Contract/agreement',
  'Harassment/misconduct',
  'Registration',
  'Invoice/Billing',
  'Performance',
  'Other',
]

const EMAIL_TEMPLATES = [
  {
    id: 'interview_invite',
    name: 'Interview invitation',
    subject: 'Interview invitation for {{role}}',
    body:
      'Dear {{candidate_name}},\n\nGreetings from Cynosure Corporate Solutions!\n\nYou are invited to attend a walk-in interview for the role of {{role}} at our organization.\n\n*Date:* {{interview_date}}\n*Time:* {{interview_time}}\n*Location:* {{location}}\n*Map Link:* {{location_link}}\n\nPlease register using the following link: {{registration_link}}\n\nRegards,\nTeam Cynosure',
    variables: ['candidate_name', 'role', 'interview_date', 'interview_time', 'location', 'location_link', 'registration_link'],
  },
  {
    id: 'payment_followup',
    name: 'Pending payment follow-up',
    subject: 'Payment update for {{candidate_name}}',
    body:
      'Hello {{candidate_name}},\n\nWe are following up regarding your pending payout for {{project_name}}.\nPlease share any missing documents or confirm your bank details so we can process the payment.\n\nThank you,\nTeam Cynosure',
    variables: ['candidate_name', 'project_name'],
  },
]

const WHATSAPP_TEMPLATES = [
  {
    id: 'whatsapp_interview',
    name: 'Interview reminder',
    body:
      'Dear {{candidate_name}}, your interview for {{role}} is scheduled on {{interview_date}} at {{interview_time}}. Venue: {{location}}. Please confirm your attendance.',
    variables: ['candidate_name', 'role', 'interview_date', 'interview_time', 'location'],
  },
  {
    id: 'whatsapp_application_status',
    name: 'Application status update',
    body:
      'Hello {{candidate_name}}, your application for {{role}} has been moved to the next stage. Our team will contact you shortly.',
    variables: ['candidate_name', 'role'],
  },
]

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]

const normalizeOptionList = (rawList) =>
  (Array.isArray(rawList) ? rawList : [])
    .map((item) => {
      if (!item) return null
      if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item)
        return { id: value, name: value }
      }

      const id = String(
        item.id ??
        item.project_id ??
        item.value ??
        item.key ??
        item._id ??
        item.projectId ??
        item.locationId ??
        item.name ??
        item.label ??
        ''
      )
      const name = String(
        item.name ??
        item.project_name ??
        item.title ??
        item.label ??
        item.value ??
        id
      )
      return id ? { id, name } : null
    })
    .filter(Boolean)

const extractOptionArray = (response) => {
  const payload = response?.data ?? {}
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.projects)) return payload.projects
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.locations)) return payload.locations
  if (Array.isArray(payload?.location_options)) return payload.location_options
  if (Array.isArray(payload?.locationOptions)) return payload.locationOptions
  if (Array.isArray(payload?.districts)) return payload.districts
  if (Array.isArray(payload?.centres)) return payload.centres
  if (Array.isArray(payload)) return payload
  return []
}

const normalizeProjectOption = (item) => {
  if (!item) return null
  if (typeof item === 'string' || typeof item === 'number') {
    const value = String(item)
    return { id: value, name: value, projectType: 'regular' }
  }

  const id = String(
    item.id ??
    item.project_id ??
    item.value ??
    item.key ??
    item._id ??
    item.projectId ??
    item.project_id ??
    item.project ??
    ''
  )
  const name = String(
    item.projectName ??
    item.name ??
    item.project_name ??
    item.title ??
    item.label ??
    item.value ??
    id
  )
  const rawProjectType = String(
    item.projectKind ??
    item.project_type ??
    item.projectType ??
    item.kind ??
    item.type ??
    ''
  ).toLowerCase()
  const projectType = rawProjectType === 'written' || rawProjectType === 'writtenexam' || rawProjectType === 'written_exam' ? 'written' : 'regular'

  return id ? { id, name, projectType } : null
}

const normalizeProjectIdForApi = (value) => {
  const rawValue = value == null ? '' : String(value)
  return rawValue.replace(/^proj_/i, '')
}

export function SupportTickets() {
  const { alert } = useAlert()
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [updateNote, setUpdateNote] = useState('')
  const [updating, setUpdating] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activePanel, setActivePanel] = useState('details')
  const [pendingStatus, setPendingStatus] = useState('')

  // History state
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyTickets, setHistoryTickets] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Visualization state
  const [ticketStats, setTicketStats] = useState({ timeline: [] })
  const [statsLoading, setStatsLoading] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [centreFilter, setCentreFilter] = useState('')
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [total, setTotal] = useState(0)
  const [projectOptions, setProjectOptions] = useState([])
  const [locationOptions, setLocationOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [centreOptions, setCentreOptions] = useState([])
  const [projectLoading, setProjectLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [districtLoading, setDistrictLoading] = useState(false)
  const [centreLoading, setCentreLoading] = useState(false)
  const [kpis, setKpis] = useState({ total: 0, open: 0, inReview: 0, resolved: 0 })
  const [kpisLoading, setKpisLoading] = useState(false)

  // Pagination
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)

  // Offcanvas messengers
  const [showEmailMessenger, setShowEmailMessenger] = useState(false)
  const [showWhatsAppMessenger, setShowWhatsAppMessenger] = useState(false)

  const selectedProjectType = useMemo(() => {
    const selectedProject = projectOptions.find((option) => option.id === projectFilter)
    return selectedProject?.projectType || 'regular'
  }, [projectFilter, projectOptions])

  useEffect(() => {
    fetchTickets()
    fetchKPIs()
  }, [offset, limit, statusFilter, categoryFilter, searchTerm, dateFilter, projectFilter, locationFilter, districtFilter, centreFilter])

  useEffect(() => {
    const loadProjectOptions = async () => {
      setProjectLoading(true)
      try {
        const res = await recruiterAPI.getProjectsSupport({ limit: 1000 })
        const payload = res?.data ?? {}
        const rawList = Array.isArray(payload?.data?.items)
          ? payload.data.items
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data)
              ? payload.data
              : []

        const combined = rawList.map(normalizeProjectOption).filter(Boolean)
        setProjectOptions(combined)
      } catch (error) {
        setProjectOptions([])
      } finally {
        setProjectLoading(false)
      }
    }

    loadProjectOptions()
  }, [])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = {
        offset,
        limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        project: projectFilter || undefined,
        location: selectedProjectType === 'written' ? undefined : locationFilter || undefined,
        district: selectedProjectType === 'written' ? districtFilter || undefined : undefined,
        centre: selectedProjectType === 'written' ? centreFilter || undefined : undefined,
        search: searchTerm || undefined,
        dateFrom: dateFilter.from || undefined,
        dateTo: dateFilter.to || undefined,
      }
      const res = await recruiterAPI.getSupportTickets(params)
      const data = res.data?.data || {}
      setTickets(data.tickets || [])
      setTotal(data.total || data.meta?.total || (data.tickets?.length || 0))
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchKPIs = async () => {
    try {
      setKpisLoading(true)
      const params = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        project: projectFilter || undefined,
        location: selectedProjectType === 'written' ? undefined : locationFilter || undefined,
        district: selectedProjectType === 'written' ? districtFilter || undefined : undefined,
        centre: selectedProjectType === 'written' ? centreFilter || undefined : undefined,
        search: searchTerm || undefined,
        dateFrom: dateFilter.from || undefined,
        dateTo: dateFilter.to || undefined,
      }
      const res = await recruiterAPI.getSupportTicketKPIs(params)
      const data = res.data?.data || {}
      setKpis({
        total: data.total || 0,
        open: data.open || 0,
        inReview: data.inReview || 0,
        resolved: data.resolved || 0,
      })
    } catch (error) {
      console.error('Failed to fetch KPIs:', error)
      setKpis({ total: 0, open: 0, inReview: 0, resolved: 0 })
    } finally {
      setKpisLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const params = {
        dateFrom: dateFilter.from || undefined,
        dateTo: dateFilter.to || undefined,
      }
      const res = await recruiterAPI.getSupportTicketStats(params)
      setTicketStats(res.data?.data || { timeline: [] })
    } catch (error) {
      console.error('Failed to fetch ticket stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [dateFilter])

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const exportParams = {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        project: projectFilter || undefined,
        location: selectedProjectType === 'written' ? undefined : locationFilter || undefined,
        district: selectedProjectType === 'written' ? districtFilter || undefined : undefined,
        centre: selectedProjectType === 'written' ? centreFilter || undefined : undefined,
        search: searchTerm || undefined,
        dateFrom: dateFilter.from || undefined,
        dateTo: dateFilter.to || undefined,
        offset: 0,
        limit: 10000,
      }

      const [ticketsResponse, kpisResponse, statsResponse] = await Promise.all([
        recruiterAPI.getSupportTickets(exportParams),
        recruiterAPI.getSupportTicketKPIs({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          project: projectFilter || undefined,
          location: selectedProjectType === 'written' ? undefined : locationFilter || undefined,
          district: selectedProjectType === 'written' ? districtFilter || undefined : undefined,
          centre: selectedProjectType === 'written' ? centreFilter || undefined : undefined,
          search: searchTerm || undefined,
          dateFrom: dateFilter.from || undefined,
          dateTo: dateFilter.to || undefined,
        }),
        recruiterAPI.getSupportTicketStats({
          dateFrom: dateFilter.from || undefined,
          dateTo: dateFilter.to || undefined,
        }),
      ])

      const ticketPayload = ticketsResponse?.data?.data || {}
      const ticketsForExport = Array.isArray(ticketPayload.tickets) ? ticketPayload.tickets : []
      const kpiPayload = kpisResponse?.data?.data || {}
      const statsPayload = statsResponse?.data?.data || { timeline: [] }

      const exportRows = ticketsForExport.map((ticket) => ({
        TicketID: ticket.id,
        CandidateName: ticket.candidateName || '',
        CandidatePhone: ticket.candidatePhone || ticket.candidateMobile || '',
        CandidateEmail: ticket.candidateEmail || '',
        Aadhaar: ticket.aadhaar || ticket.aadhaarNumber || ticket.aadhaar_no || ticket.aadhar || ticket.aadhaarNo || ticket.identification || '',
        Project: ticket.projectName || ticket.project || '',
        Location: ticket.location || '',
        District: ticket.district || ticket.districtName || ticket.district_name || '',
        Centre: ticket.centre || ticket.centreName || ticket.centre_name || '',
        Category: ticket.category || '',
        Subject: ticket.subject || '',
        Status: TICKET_STATUS[ticket.status] || ticket.status || '',
        SubmittedAt: ticket.createdAt || '',
        Description: ticket.description || '',
      }))

      const summaryRows = [
        {
          Metric: 'Total Tickets',
          Value: kpiPayload.total || 0,
        },
        {
          Metric: 'Open',
          Value: kpiPayload.open || 0,
        },
        {
          Metric: 'In Review',
          Value: kpiPayload.inReview || 0,
        },
        {
          Metric: 'Resolved',
          Value: kpiPayload.resolved || 0,
        },
      ]

      const activityRows = Array.isArray(statsPayload.timeline)
        ? statsPayload.timeline.map((item) => ({
            Date: item.date || item.day || '',
            Open: item.open || 0,
            InReview: item.inReview || item.in_review || 0,
            Resolved: item.resolved || 0,
            Total: item.total || 0,
          }))
        : []

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(exportRows.length ? exportRows : [{ Note: 'No matching support tickets found.' }]),
        'Support Tickets'
      )
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ Note: 'No summary data available.' }]),
        'Summary'
      )
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(activityRows.length ? activityRows : [{ Note: 'No activity data available.' }]),
        'Activity'
      )

      XLSX.writeFile(workbook, `support_tickets_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
      setExporting(false)
      await alert('Excel export has been generated.')
    } catch (error) {
      console.error('Failed to export support tickets:', error)
      await alert('Unable to export Excel file right now. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const getTicketStatus = (ticket) => {
    let rawStatus =
      ticket?.status ||
      ticket?.currentStatus ||
      ticket?.ticketStatus ||
      ticket?.status_code ||
      ticket?.state ||
      ''

    // Normalize status to match TICKET_STATUS keys
    if (typeof rawStatus === 'string') {
      rawStatus = rawStatus.toLowerCase().trim()
      if (rawStatus === 'in_review' || rawStatus === 'inreview') {
        return 'inReview'
      }
      if (rawStatus === 'open') {
        return 'open'
      }
      if (rawStatus === 'resolved') {
        return 'resolved'
      }
    }

    return rawStatus || ''
  }

  const getLastHistoryNote = (ticket) => {
    const history =
      ticket?.statusHistory ||
      ticket?.status_history ||
      ticket?.history ||
      ticket?.statusUpdates ||
      ticket?.changes ||
      []

    if (!Array.isArray(history) || history.length === 0) return ''

    const lastEntry = history[history.length - 1]
    return lastEntry?.note || lastEntry?.notes || lastEntry?.comment || lastEntry?.message || ''
  }

  useEffect(() => {
    if (selectedTicket) {
      setPendingStatus(getTicketStatus(selectedTicket))
      setUpdateNote(getLastHistoryNote(selectedTicket))
    }
  }, [selectedTicket])

  const handleViewDetails = async (ticket) => {
    setActivePanel('details') // Always start with details panel
    setDetailLoading(true)
    setPendingStatus(getTicketStatus(ticket))

    try {
      const res = await recruiterAPI.getTicketDetails(ticket.id)
      const ticketData = res.data?.data || ticket
      setSelectedTicket(ticketData)
    } catch (error) {
      console.error('Failed to fetch ticket details:', error)
      setSelectedTicket(ticket)
    } finally {
      setDetailLoading(false)
      setShowDetailModal(true)
    }
  }

  const handleOpenHistory = async (candidatePhone) => {
    if (!candidatePhone) return
    setShowDetailModal(false)
    setShowHistoryModal(true)
    setHistoryLoading(true)

    try {
      // Fetch complete support history for this candidate
      const res = await recruiterAPI.getIndividualSupportHistory(candidatePhone)
      setHistoryTickets(res.data?.data?.tickets || res.data?.data || [])
    } catch (error) {
      console.error('Failed to fetch support history:', error)
      setHistoryTickets([])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (!projectFilter) {
      setLocationOptions([])
      setDistrictOptions([])
      setCentreOptions([])
      setLocationFilter('')
      setDistrictFilter('')
      setCentreFilter('')
      return
    }

    const selectedProject = projectOptions.find((option) => option.id === projectFilter)
    const projectType = selectedProject?.projectType || 'regular'
    const normalizedProjectId = normalizeProjectIdForApi(projectFilter)

    setLocationFilter('')
    setDistrictFilter('')
    setCentreFilter('')
    setLocationOptions([])
    setDistrictOptions([])
    setCentreOptions([])

    if (projectType === 'written') {
      const loadDistrictOptions = async () => {
        setDistrictLoading(true)
        try {
          const res = await recruiterAPI.getProjectDistricts(normalizedProjectId)
          const rawList = extractOptionArray(res)
          setDistrictOptions(normalizeOptionList(rawList))
        } catch (error) {
          setDistrictOptions([])
        } finally {
          setDistrictLoading(false)
        }
      }

      loadDistrictOptions()
      return
    }

    const loadLocationOptions = async () => {
      setLocationLoading(true)
      try {
        const res = await recruiterAPI.getProjectLocations(normalizedProjectId)
        const rawList = extractOptionArray(res)
        setLocationOptions(normalizeOptionList(rawList))
      } catch (error) {
        setLocationOptions([])
      } finally {
        setLocationLoading(false)
      }
    }

    loadLocationOptions()
  }, [projectFilter, projectOptions])

  useEffect(() => {
    if (!projectFilter || !districtFilter) {
      setCentreOptions([])
      setCentreFilter('')
      return
    }

    const selectedProject = projectOptions.find((option) => option.id === projectFilter)
    if (selectedProject?.projectType !== 'written') return

    const loadCentreOptions = async () => {
      setCentreLoading(true)
      try {
        const res = await recruiterAPI.getDistrictCentres(normalizeProjectIdForApi(projectFilter), districtFilter)
        const rawList = extractOptionArray(res)
        setCentreOptions(normalizeOptionList(rawList))
      } catch (error) {
        setCentreOptions([])
      } finally {
        setCentreLoading(false)
      }
    }

    loadCentreOptions()
  }, [projectFilter, districtFilter, projectOptions])

  const handleOpenEmailMessenger = () => {
    setShowDetailModal(false)
    setShowEmailMessenger(true)
  }

  const handleOpenWhatsAppMessenger = () => {
    setShowDetailModal(false)
    setShowWhatsAppMessenger(true)
  }

  const handleEmailSend = async ({ to, cc, subject, body, attachments, templateId, variables }) => {
    if (!selectedTicket) return
    const formData = new FormData()
    formData.append('to', to)
    if (cc) formData.append('cc', cc)
    formData.append('subject', subject)
    formData.append('body', body)
    if (selectedTicket.candidateId) formData.append('candidateId', selectedTicket.candidateId)
    if (templateId) formData.append('templateId', templateId)
    formData.append('meta', JSON.stringify({ 
      variables, 
      ticketId: selectedTicket.id,
      candidateId: selectedTicket.candidateId 
    }))
    // The templateId and variables are not used in the simplified EmailMessenger, but keeping them in the payload for consistency with the API if it expects them.
    attachments?.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file)
    })

    await recruiterAPI.sendEmailMessage(formData)
    await alert('Email request has been submitted.')
  }

  const handleWhatsAppSend = async ({ to, templateId, variables }) => {
    if (!selectedTicket) return
    await recruiterAPI.sendWhatsAppMessage({
      to,
      templateId,
      variables,
      ticketId: selectedTicket.id,
      candidateId: selectedTicket.candidateId,
    })
    await alert('WhatsApp message request has been submitted.')
  }

  const handleUpdateTicketStatus = async (newStatus) => {
    if (!selectedTicket) return
    try {
      setUpdating(true)
      await recruiterAPI.updateTicketStatus(selectedTicket.id, {
        status: newStatus,
        note: updateNote,
        candidateId: selectedTicket.candidateId,
        user_id: user?.userId,
      })
      setUpdateNote('')
      fetchTickets()
      if (selectedTicket) {
        setSelectedTicket({ ...selectedTicket, status: newStatus })
      }
    } catch (error) {
      console.error('Failed to update ticket:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleAddReply = async () => {
    if (!selectedTicket || !updateNote.trim()) return
    try {
      setUpdating(true)
      await recruiterAPI.addTicketReply(selectedTicket.id, {
        message: updateNote,
        candidateId: selectedTicket.candidateId,
      })
      setUpdateNote('')
      // Refresh ticket details
      const res = await recruiterAPI.getTicketDetails(selectedTicket.id)
      setSelectedTicket(res.data?.data)
      fetchTickets()
    } catch (error) {
      console.error('Failed to add reply:', error)
    } finally {
      setUpdating(false)
    }
  }

  const statusStats = useMemo(() => {
    return {
      total: kpis.total,
      open: kpis.open,
      inReview: kpis.inReview,
      resolved: kpis.resolved,
    }
  }, [kpis])

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit))
  const currentPage = Math.floor(offset / limit) + 1
  const start = total === 0 ? 0 : offset + 1
  const end = total === 0 ? 0 : Math.min(offset + limit, total)

  const pageStart = Math.max(1, Math.min(currentPage - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  useEffect(() => {
    const lp = Math.max(1, Math.ceil((total || 0) / limit))
    if (currentPage > lp && lp > 0) setOffset((lp - 1) * limit)
  }, [total, limit, currentPage])

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'open':
        return 'badge-open'
      case 'inReview':
        return 'badge-inreview'
      case 'resolved':
        return 'badge-resolved'
      default:
        return 'badge-open'
    }
  }


  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <FontAwesomeIcon icon={faHourglassHalf} className="status-icon" />
      case 'inReview':
        return <FontAwesomeIcon icon={faEye} className="status-icon" />
      case 'resolved':
        return <FontAwesomeIcon icon={faCheckCircle} className="status-icon" />
      default:
        return null
    }
  }

  const ticketHistory = (() => {
    const history =
      selectedTicket?.statusHistory ||
      selectedTicket?.status_history ||
      selectedTicket?.history ||
      selectedTicket?.statusUpdates ||
      selectedTicket?.changes ||
      []

    return Array.isArray(history) ? history : []
  })()

  return (
    <div className="support-tickets-container">
      <LoadingOverlay active={loading} message="Fetching support tickets..." />
      <LoadingOverlay active={updating} message="Updating ticket status..." />
      <LoadingOverlay active={exporting} message="Preparing Excel export..." />

      <div className="support-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <h1>Support Tickets</h1>
          <p>Manage and resolve candidate support queries</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExportExcel}
          disabled={exporting}
        >
          <FontAwesomeIcon icon={faFileExcel} /> {exporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

            {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Search by ticket ID, candidate name, or issue..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setOffset(0)
            }}
          />
        </div>

        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setOffset(0)
            }}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="inReview">In Review</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value)
              setLocationFilter('')
              setDistrictFilter('')
              setCentreFilter('')
              setOffset(0)
            }}
            className="filter-select"
          >
            <option value="">All Projects</option>
            {projectLoading ? (
              <option value="">Loading projects...</option>
            ) : (
              projectOptions.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))
            )}
          </select>

          {selectedProjectType === 'written' ? (
            <>
              <select
                value={districtFilter}
                onChange={(e) => {
                  setDistrictFilter(e.target.value)
                  setCentreFilter('')
                  setOffset(0)
                }}
                className="filter-select"
                disabled={!projectFilter || districtLoading}
              >
                <option value="">All Districts</option>
                {districtLoading ? (
                  <option value="">Loading districts...</option>
                ) : (
                  districtOptions.map((district) => (
                    <option key={district.id} value={district.id}>{district.name}</option>
                  ))
                )}
              </select>

              <select
                value={centreFilter}
                onChange={(e) => {
                  setCentreFilter(e.target.value)
                  setOffset(0)
                }}
                className="filter-select"
                disabled={!projectFilter || !districtFilter || centreLoading}
              >
                <option value="">All Centres</option>
                {centreLoading ? (
                  <option value="">Loading centres...</option>
                ) : (
                  centreOptions.map((centre) => (
                    <option key={centre.id} value={centre.id}>{centre.name}</option>
                  ))
                )}
              </select>
            </>
          ) : (
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value)
                setOffset(0)
              }}
              className="filter-select"
              disabled={!projectFilter}
            >
              <option value="">All Locations</option>
              {locationLoading ? (
                <option value="">Loading locations...</option>
              ) : (
                locationOptions.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))
              )}
            </select>
          )}

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setOffset(0)
            }}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value))
              setOffset(0)
            }}
            className="filter-select"
            style={{ width: '120px' }}
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt} entries</option>
            ))}
          </select>

          <div className="date-filter">
            <input
              type="date"
              value={dateFilter.from}
              onChange={(e) => {
                setDateFilter({ ...dateFilter, from: e.target.value })
                setOffset(0)
              }}
              className="filter-date"
            />
            <span>to</span>
            <input
              type="date"
              value={dateFilter.to}
              onChange={(e) => {
                setDateFilter({ ...dateFilter, to: e.target.value })
                setOffset(0)
              }}
              className="filter-date"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{kpisLoading ? '...' : statusStats.total}</div>
          <div className="stat-label">Total Tickets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value open">{kpisLoading ? '...' : statusStats.open}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-card">
          <div className="stat-value inreview">{kpisLoading ? '...' : statusStats.inReview}</div>
          <div className="stat-label">In Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value resolved">{kpisLoading ? '...' : statusStats.resolved}</div>
          <div className="stat-label">Resolved</div>
        </div>
      </div>

      {/* Ticket Activity Visualization */}
      <div className="stats-row charts-section" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ flex: '1 1 100%', minHeight: '220px', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Ticket Activity</h3>
            {statsLoading && <span style={{ fontSize: '12px', color: 'var(--primary)' }}>Refreshing data...</span>}
          </div>

          {/* Using the new TicketActivityLineChart component */}
          <TicketActivityLineChart data={ticketStats.timeline} />
        </div>
      </div>


      {/* Tickets Table */}
      <div className="tickets-table-wrapper">
        {loading ? (
          <div className="loading-state">
            <p>Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <FontAwesomeIcon icon={faFileAlt} className="empty-icon" />
            <p>No support tickets found</p>
          </div>
        ) : (
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Candidate</th>
                <th>Project</th>
                <th>Location</th>
                <th>District</th>
                <th>Centre</th>
                <th>Category</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="ticket-row">
                  <td className="ticket-id">#{ticket.id}</td>
                  <td>
                    <div className="candidate-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <p className="candidate-name">{ticket.candidateName}</p>
                      <p className="candidate-contact">{ticket.candidatePhone || ticket.candidateMobile || 'No phone'}</p>
                      <p className="candidate-aadhaar">{ticket.aadhaar || ticket.aadhaarNumber || ticket.aadhaar_no || ticket.aadhar || ticket.aadhaarNo || ticket.identification || '-'}</p>
                    </div>
                  </td>
                  <td>{ticket.projectName || ticket.project || '-'}</td>
                  <td>{ticket.location || '-'}</td>
                  <td>{ticket.district || ticket.districtName || ticket.district_name || '-'}</td>
                  <td>{ticket.centre || ticket.centreName || ticket.centre_name || '-'}</td>
                  <td>{ticket.category}</td>
                  <td className="subject-cell">{ticket.subject}</td>
                  <td>
                    <span className={`badge status-badge ${getStatusBadgeClass(ticket.status)}`}>
                      {getStatusIcon(ticket.status)} {TICKET_STATUS[ticket.status]}
                    </span>
                  </td>
                  <td>{formatDate(ticket.createdAt)}</td>
                  <td className="action-cell">
                    <button
                      className="btn-action view-btn"
                      onClick={() => handleViewDetails(ticket, 'details')}
                      title="View details"
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && tickets.length > 0 && (
        <div className="pagination-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
          <div className="page-info" style={{ color: 'var(--text3)', fontSize: '14px' }}>
            Showing {start} - {end} of {total}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setOffset(0)}
              disabled={currentPage === 1}
              className="btn-pagination"
            >
              First
            </button>
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={currentPage === 1}
              className="btn-pagination"
            >
              Prev
            </button>

            <div className="pagination-pages" style={{ display: 'flex', gap: '4px' }}>
              {pageStart > 1 && <span style={{ padding: '0 4px' }}>...</span>}
              {pageNumbers.map((pnum) => (
                <button
                  key={pnum}
                  onClick={() => setOffset((pnum - 1) * limit)}
                  className={`btn-pagination ${currentPage === pnum ? 'active' : ''}`}
                  style={currentPage === pnum ? { backgroundColor: 'green', color: 'white', borderColor: 'var(--primary)' } : {}}
                >
                  {pnum}
                </button>
              ))}
              {pageEnd < totalPages && <span style={{ padding: '0 4px' }}>...</span>}
            </div>

            <button
              onClick={() => setOffset(Math.min((totalPages - 1) * limit, offset + limit))}
              disabled={currentPage === totalPages}
              className="btn-pagination"
            >
              Next
            </button>
            <button
              onClick={() => setOffset((totalPages - 1) * limit)}
              disabled={currentPage === totalPages}
              className="btn-pagination"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Detail Offcanvas */}
{/* Detail Offcanvas */}
{showDetailModal && selectedTicket && (
  <>
    <div className="offcanvas-overlay">
      <div
        className="offcanvas-panel ticket-detail-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="offcanvas-title-bar ticket-detail-header">
          <div className="ticket-header-main">
            <div className="ticket-title-row">
              <h2>Ticket #{selectedTicket.id}</h2>
            </div>
            <p className="offcanvas-subtitle">
              Candidate support details, attachments, history, and messaging.
            </p>
          </div>

          <button type="button" className="btn-close ticket-close-btn" onClick={() => setShowDetailModal(false)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {detailLoading ? (
          <div className="offcanvas-body">
            <div className="loading-state">
              <p>Loading ticket details...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="offcanvas-body ticket-detail-body">
                
              <div className="detail-section-card detail-accent-card" style={{display: 'none'}}>
                <div className="detail-card-header">
                  <h3>Message Candidate</h3>
                </div>

                <div className="messaging-actions">
                  <button
                    type="button"
                    className="btn btn-white detail-action-btn"
                    onClick={handleOpenEmailMessenger}
                  >
                    <FontAwesomeIcon icon={faEnvelope} />
                    Send Email
                  </button>

                  <button
                    type="button"
                    className="btn btn-white detail-action-btn"
                    onClick={handleOpenWhatsAppMessenger}
                  >
                    💬 Send WhatsApp
                  </button>
                </div>
              </div>

              <div className="detail-section-card detail-summary-card">
                <div className="detail-card-header">
                  <h3>Ticket Snapshot</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-tertiary btn-sm" onClick={() => handleOpenHistory(selectedTicket.candidatePhone)}>
                      <FontAwesomeIcon icon={faHistory} /> Previous Tickets
                    </button>
                    <span className="detail-card-chip">Submitted {formatDate(selectedTicket.createdAt)}</span>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Candidate</span>
                    <span className="detail-value">{selectedTicket.candidateName}</span>
                    <span className="detail-muted">{selectedTicket.candidateEmail || 'No email'}</span>
                    <span className="detail-muted">{selectedTicket.candidatePhone || selectedTicket.candidateMobile || 'No phone'}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Category</span>
                    <span className="detail-value">{selectedTicket.category}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Submitted On</span>
                    <span className="detail-value">{formatDate(selectedTicket.createdAt)}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label"> Status</span>
                    <div className="detail-pill-row">
                      <span className={`badge status-badge ${getStatusBadgeClass(selectedTicket.status)}`}>
                        {getStatusIcon(selectedTicket.status)} {TICKET_STATUS[selectedTicket.status]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="detail-section-card">
                <div className="detail-card-header">
                  <h3>Issue Details</h3>
                </div>

                <div className="detail-block">
                  <span className="detail-label">Subject</span>
                  <h4 className="detail-subject">{selectedTicket.subject}</h4>
                </div>

                <div className="detail-block">
                  <span className="detail-label">Description</span>
                  <div className="detail-description">
                    {selectedTicket.description || 'No description provided.'}
                  </div>
                </div>
              </div>

              {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                <div className="detail-section-card">
                  <div className="detail-card-header">
                    <h3>Attachments</h3>
                    <span className="detail-card-chip">{selectedTicket.attachments.length} file(s)</span>
                  </div>

                  <div className="attachment-list">
                    {selectedTicket.attachments.map((file, idx) => (
                      <div key={idx} className="attachment-item">
                        <div className="attachment-icon-wrap">
                          <FontAwesomeIcon icon={faFileAlt} />
                        </div>

                        <div className="attachment-meta">
                          <a href={file.url} download className="attachment-name">
                            {file.name}
                          </a>
                          <span className="attachment-subtext">Click to download</span>
                        </div>

                        <a href={file.url} download className="btn-download">
                          <FontAwesomeIcon icon={faDownload} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ticketHistory && ticketHistory.length > 0 && (
                <div className="detail-section-card">
                  <div className="detail-card-header">
                    <h3>Status History</h3>
                  </div>

                  <div className="history-list">
                    {ticketHistory.map((entry, idx) => {
                      const changedAt = entry.changedAt || entry.updatedAt || entry.createdAt || entry.date || entry.timestamp
                      const status = entry.status || entry.newStatus || entry.toStatus || entry.currentStatus
                      const note = entry.note || entry.notes || entry.comment || entry.message || ''
                      const changedBy = entry.changedBy || entry.updatedBy || entry.user || entry.userId || entry.by || ''

                      return (
                        <div key={idx} className="history-item">
                          <div className="history-main">
                            <span className="history-status">{status || 'Status update'}</span>
                            <span className="history-date">{changedAt ? new Date(changedAt).toLocaleString() : 'No date'}</span>
                          </div>
                          {changedBy && <div className="history-meta">Changed by: {changedBy}</div>}
                          {note && <div className="history-note">{note}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="detail-section-card">
                <div className="detail-card-header">
                  <h3>Update Ticket Status</h3>
                </div>

                <div className="status-editor">
                  <select
                    value={pendingStatus}
                    onChange={(e) => setPendingStatus(e.target.value)}
                    className="form-control detail-select"
                    disabled={updating}
                  >
                    {Object.entries(TICKET_STATUS).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>

                  <button
                    className="btn btn-primary detail-primary-btn"
                    onClick={() => handleUpdateTicketStatus(pendingStatus)}
                    disabled={updating}
                    type="button"
                  >
                    {updating ? 'Saving...' : 'Save Status'}
                  </button>
                </div>

                <textarea
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  placeholder="Add a note for this status update (optional)..."
                  className="form-control detail-textarea"
                  rows="3"
                />
              </div>

            </div>

            <div className="offcanvas-footer ticket-detail-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetailModal(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  </>
)}

      {/* Previous Tickets History Offcanvas */}
      {showHistoryModal && (
        <>
          <div className="offcanvas-backdrop" />
          <div className="offcanvas offcanvas-end" style={{ width: '600px' }}>
            <div className="offcanvas-header">
              <div>
                <h5 className="offcanvas-title">Ticket History</h5>
                <p className="recipients-count">All tickets raised by {selectedTicket?.candidateName}</p>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowHistoryModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="offcanvas-body">
              {historyLoading ? (
                <div className="loading-state">
                  <p>Loading history...</p>
                </div>
              ) : historyTickets.length === 0 ? (
                <div className="empty-state">
                  <p>No other tickets found for this candidate.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historyTickets.map((ticket) => (
                    <div 
                      key={ticket.id} 
                      className="detail-section-card" 
                      style={{ 
                        cursor: 'pointer', 
                        transition: 'transform 0.2s',
                        border: ticket.id === selectedTicket?.id ? '2px solid var(--primary)' : '1px solid var(--border-light)' 
                      }}
                      onClick={() => {
                        setShowHistoryModal(false)
                        handleViewDetails(ticket)
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px' }}>#{ticket.id}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{formatDate(ticket.createdAt)}</span>
                      </div>
                      <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>{ticket.subject}</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className={`badge status-badge ${getStatusBadgeClass(ticket.status)}`} style={{ fontSize: '10px' }}>
                          {TICKET_STATUS[ticket.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="offcanvas-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowHistoryModal(false)
                  setShowDetailModal(true)
                }}
                type="button"
              >
                Back to Current Ticket
              </button>
            </div>
          </div>
        </>
      )}

      {/* Email Messenger Offcanvas */}
      <EmailMessenger
        isOpen={showEmailMessenger}
        templates={EMAIL_TEMPLATES}
        recipientEmail={selectedTicket?.candidateEmail}
        recipientName={selectedTicket?.candidateName}
        recipients={[selectedTicket]}
        onClose={() => setShowEmailMessenger(false)}
        onSend={async (payload) => {
          try {
            await handleEmailSend(payload)
            setShowEmailMessenger(false)
          } catch (error) {
            console.error('Email send failed', error)
          }
        }}
      />

      {/* WhatsApp Messenger Offcanvas */}
      <WhatsAppMessenger
        isOpen={showWhatsAppMessenger}
        templates={WHATSAPP_TEMPLATES}
        recipientPhone={selectedTicket?.candidatePhone || selectedTicket?.candidateMobile}
        recipientName={selectedTicket?.candidateName}
        recipients={[selectedTicket]}
        onClose={() => setShowWhatsAppMessenger(false)}
        onSend={async (payload) => {
          try {
            await handleWhatsAppSend(payload)
            setShowWhatsAppMessenger(false)
          } catch (error) {
            console.error('WhatsApp send failed', error)
          }
        }}
      />
    </div>
  )
}
