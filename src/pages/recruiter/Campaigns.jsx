import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faSpinner, faCheckCircle, faSearch, faTimes } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { PageHeader, Card } from '../../components/ui/index'
import MultiSelectDropdown from '../../components/Common/MultiSelectDropdown'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import { TAGGED_FIELD_OPTIONS } from '../../components/ui/WhatsAppMessenger'
import { encryptRegistrationId } from '../../utils/faceEnrollLinkCrypto'
import * as XLSX from 'xlsx'
import './Campaigns.css'

const CANDIDATE_LOCATION_OPTIONS = ['Tambaram', 'Velachery', 'Guindy', 'OMR', 'Anna Nagar']

const getUrlTemplateVariables = (url = '') => [...String(url).matchAll(/{{\s*([^{}\s]+)\s*}}/g)].map((match) => match[1])

export default function Campaigns() {
  const [projects, setProjects] = useState([])
  const [projLoading, setProjLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')
  const [otherProjectName, setOtherProjectName] = useState('')
  const [taggedField, setTaggedField] = useState('')
  const [portal, setPortal] = useState('whatsapp')
  const [messageType, setMessageType] = useState('registration')
  const [importSource, setImportSource] = useState('file')
  const [databaseCandidates, setDatabaseCandidates] = useState([])
  const [databaseTotal, setDatabaseTotal] = useState(0)
  const [databaseLoading, setDatabaseLoading] = useState(false)
  const [databaseError, setDatabaseError] = useState('')
  const [databaseFilters, setDatabaseFilters] = useState({
    candidates: { name: '', mobile: '', whatsapp: '', email: '', aadhaar: '', location: 'All', from: '', to: '' },
    recipients: { name: '', mobile: '', states: [], locations: [] },
  })
  const [appliedDatabaseFilters, setAppliedDatabaseFilters] = useState({
    candidates: { name: '', mobile: '', whatsapp: '', email: '', aadhaar: '', location: 'All', from: '', to: '' },
    recipients: { name: '', mobile: '', states: [], locations: [] },
  })
  const [databasePages, setDatabasePages] = useState({ candidates: 1, recipients: 1 })
  const [databasePageSizes, setDatabasePageSizes] = useState({ candidates: 10, recipients: 10 })
  const [recipientStateOptions, setRecipientStateOptions] = useState([])
  const [recipientLocationOptions, setRecipientLocationOptions] = useState([])
  const [recipientLocationSearch, setRecipientLocationSearch] = useState('')
  const [recipientStatesLoading, setRecipientStatesLoading] = useState(false)
  const [recipientLocationsLoading, setRecipientLocationsLoading] = useState(false)
  const [databasePanelOpen, setDatabasePanelOpen] = useState('')
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false)
  const [selectedDatabaseCandidates, setSelectedDatabaseCandidates] = useState({})
  const databaseSelectAllRef = useRef(null)
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateDetails, setTemplateDetails] = useState(null)
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false)
  const [templateDetailsError, setTemplateDetailsError] = useState('')
  const [templateVariables, setTemplateVariables] = useState({})
  const [templateImage, setTemplateImage] = useState(null)
  const [candidateNamePlaceholder, setCandidateNamePlaceholder] = useState('')
  const [buttonVariableValues, setButtonVariableValues] = useState({})
  const [templateError, setTemplateError] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [history, setHistory] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [historySearch, setHistorySearch] = useState('')
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [historyProjectFilter, setHistoryProjectFilter] = useState('')
  const [historyPortalFilter, setHistoryPortalFilter] = useState('')
  const [historyMessageTypeFilter, setHistoryMessageTypeFilter] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attendanceFromDate, setAttendanceFromDate] = useState('')
  const [attendanceToDate, setAttendanceToDate] = useState('')
  const [attendanceDateTimes, setAttendanceDateTimes] = useState({})
  const [attendanceCopyFromDate, setAttendanceCopyFromDate] = useState('')
  const fileRef = useRef(null)
  const imageFileRef = useRef(null)

  const unwrapRows = (response) => {
    const payload = response?.data?.data ?? response?.data ?? response
    const rows = Array.isArray(payload)
      ? payload
      : payload?.items || payload?.candidates || payload?.results || []
    return { rows: Array.isArray(rows) ? rows : [], total: Number(payload?.total ?? payload?.totalCount ?? payload?.count ?? payload?.meta?.total ?? rows.length) || 0 }
  }

  const getDatabaseCandidateId = (candidate) => String(candidate.id ?? candidate.recipient_id ?? candidate.recipientId ?? candidate.candidateId ?? candidate.candidate_id ?? candidate._id ?? candidate.new_id ?? candidate.newId ?? candidate.registration_id ?? candidate.cid ?? '')
  const getDatabaseCandidateName = (candidate) => String(candidate.name ?? candidate.fullName ?? candidate.candidate_name ?? candidate.recipient_name ?? '')
  const getDatabaseCandidateMobile = (candidate) => String(candidate.mobile ?? candidate.mobile_no ?? candidate.mobileNo ?? candidate.mobileNumber ?? candidate.mobile_number ?? candidate.whatsapp ?? candidate.phone ?? candidate.phone_number ?? candidate.candidate_mobile_number ?? candidate.contact_number ?? candidate.contact ?? '').trim()
  const getDatabaseCandidateEmail = (candidate) => String(candidate.email ?? candidate.email_id ?? candidate.email_address ?? candidate.primary_email ?? '').trim()
  const getCampaignRecipientDetails = (selection) => ({
    id: getDatabaseCandidateId(selection.record),
    name: getDatabaseCandidateName(selection.record),
    mobile: getDatabaseCandidateMobile(selection.record),
    email: getDatabaseCandidateEmail(selection.record),
    origin: selection.source === 'candidates' ? 'candidate_database_id' : 'recipient_database_id',
  })
  const getUploadedCampaignRecipientDetails = async (uploadedFile) => {
    const workbook = XLSX.read(await uploadedFile.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    return XLSX.utils.sheet_to_json(sheet).map((row) => {
      const id = row.id ?? row.candidate_id ?? row.recipient_id
      return {
        ...(id !== undefined && id !== null && id !== '' ? { id: String(id) } : {}),
        name: String(row.candidate_name ?? row['candidate name'] ?? row.name ?? ''),
        mobile: String(row.candidate_mobile_number ?? row['candidate mobile number'] ?? row.mobile ?? row.phone ?? '').trim(),
        email: String(row.email ?? row.email_id ?? row.email_address ?? '').trim(),
        origin: 'upload',
      }
    })
  }
  const getDatabaseSelectionKey = (candidate, source) => JSON.stringify([
    source,
    getDatabaseCandidateId(candidate),
    getDatabaseCandidateMobile(candidate),
    getDatabaseCandidateName(candidate),
    candidate.email ?? candidate.email_id ?? candidate.email_address ?? '',
    candidate.state ?? candidate.state_name ?? '',
    candidate.location ?? candidate.area ?? candidate.locality ?? candidate.city ?? '',
  ])

  const selectedTemplate = templates.find((template) => String(template.id ?? template.template_id ?? template.name) === String(selectedTemplateId))
  const selectedTemplateName = String(selectedTemplate?.name ?? selectedTemplate?.title ?? selectedTemplateId)
  const attendanceDates = (() => {
    if (!attendanceFromDate || !attendanceToDate || attendanceToDate < attendanceFromDate) return []
    const dates = []
    const current = new Date(`${attendanceFromDate}T00:00:00Z`)
    const end = new Date(`${attendanceToDate}T00:00:00Z`)
    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10))
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return dates
  })()
  const attendanceSchedule = attendanceDates.map((date) => ({
    date,
    send_time: attendanceDateTimes[date]?.send_time || '',
    reminder_time: attendanceDateTimes[date]?.reminder_time || '',
  }))
  const selectedDatabaseEntries = Object.entries(selectedDatabaseCandidates)
  const currentDatabaseRows = databaseCandidates.map((candidate) => {
    return { candidate, key: getDatabaseSelectionKey(candidate, databasePanelOpen) }
  })
  const selectableDatabaseRows = currentDatabaseRows.filter(({ candidate }) => getDatabaseCandidateId(candidate) && getDatabaseCandidateMobile(candidate))
  const selectedVisibleCount = selectableDatabaseRows.filter(({ key }) => Boolean(selectedDatabaseCandidates[key])).length
  const allVisibleDatabaseRowsSelected = selectableDatabaseRows.length > 0 && selectedVisibleCount === selectableDatabaseRows.length
  const effectiveAttendanceCopyDate = attendanceDates.includes(attendanceCopyFromDate) ? attendanceCopyFromDate : attendanceDates[0] || ''
  const selectedCandidateCount = selectedDatabaseEntries.filter(([, selection]) => selection.source === 'candidates').length
  const selectedRecipientCount = selectedDatabaseEntries.filter(([, selection]) => selection.source === 'recipients').length
  const selectedTemplateDetails = templateDetails?.templateId === selectedTemplateId ? templateDetails : null
  const templateContent = String(selectedTemplateDetails?.content ?? selectedTemplate?.content ?? selectedTemplate?.body ?? '')
  const isImageTemplate = String(selectedTemplateDetails?.header?.type ?? selectedTemplateDetails?.type ?? '').toLowerCase() === 'image'
  const templateVariableNames = [...new Set([...templateContent.matchAll(/{{\s*([^{}\s]+)\s*}}/g)].map((match) => match[1]))]
  const suggestedCandidateNamePlaceholder = templateVariableNames.find((name) => ['candidatename', 'recipientname'].includes(name.toLowerCase().replace(/[^a-z0-9]/g, '')))
    || templateVariableNames.find((name) => /^\d+$/.test(name))
    || ''
  const templateButtons = portal === 'whatsapp' && Array.isArray(selectedTemplateDetails?.buttons)
    ? selectedTemplateDetails.buttons
    : portal === 'whatsapp' && Array.isArray(selectedTemplate?.buttons)
      ? selectedTemplate.buttons
      : []
  const buttonVariableMappings = templateButtons.flatMap((button, index) => {
    if (String(button.type || '').toUpperCase() !== 'URL') return []
    const variables = getUrlTemplateVariables(button.url)
    return variables.length ? [{ ...button, index, variables }] : []
  })
  const previewTemplateContent = templateContent.replace(/{{\s*([^{}\s]+)\s*}}/g, (placeholder, key) => {
    if (templateVariables[key] === 'candidate_name') return 'Candidate name'
    return templateVariables[key] || placeholder
  })

  const handleCandidateNamePlaceholderChange = (event) => {
    const nextPlaceholder = event.target.value
    setTemplateVariables((current) => {
      const next = { ...current }
      if (candidateNamePlaceholder && next[candidateNamePlaceholder] === 'candidate_name') next[candidateNamePlaceholder] = ''
      if (nextPlaceholder) next[nextPlaceholder] = 'candidate_name'
      return next
    })
    setCandidateNamePlaceholder(nextPlaceholder)
  }

  useEffect(() => {
    const defaults = Object.fromEntries(templateVariableNames.map((name) => [
      name,
      name === suggestedCandidateNamePlaceholder ? 'candidate_name' : '',
    ]))
    setCandidateNamePlaceholder(suggestedCandidateNamePlaceholder)
    setTemplateVariables(defaults)
    setButtonVariableValues({})
    setTemplateImage(null)
    if (imageFileRef.current) imageFileRef.current.value = ''
  }, [selectedTemplateId, templateVariableNames.join('|')])

  useEffect(() => {
    let active = true
    recruiterAPI.getWhatsAppTemplates()
      .then((response) => {
        const payload = response?.data?.data ?? response?.data ?? response
        const list = Array.isArray(payload?.templates) ? payload.templates : Array.isArray(payload) ? payload : null
        if (!list) throw new Error('Invalid WhatsApp templates response')
        if (active) setTemplates(list)
      })
      .catch(() => {
        if (active) setTemplateError('Could not load WhatsApp templates.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateDetails(null)
      setTemplateDetailsError('')
      setTemplateDetailsLoading(false)
      return undefined
    }

    let active = true
    setTemplateDetailsLoading(true)
    setTemplateDetailsError('')
    recruiterAPI.getWhatsAppTemplateDetails(selectedTemplateId)
      .then((response) => {
        const payload = response?.data?.data ?? response?.data ?? response
        const isImageTemplate = String(payload?.header?.type ?? payload?.type ?? '').toLowerCase() === 'image'
        if (payload?.success === false || (typeof payload?.content !== 'string' && !isImageTemplate)) {
          throw new Error('Template content is missing from the details response.')
        }
        if (active) setTemplateDetails({ ...payload, templateId: selectedTemplateId })
      })
      .catch(() => {
        if (active) {
          setTemplateDetails(null)
          setTemplateDetailsError('Could not load template body content.')
        }
      })
      .finally(() => {
        if (active) setTemplateDetailsLoading(false)
      })
    return () => { active = false }
  }, [selectedTemplateId])

  useEffect(() => {
    if (!databasePanelOpen) return undefined
    let active = true
    const loadCandidates = async () => {
      setDatabaseLoading(true)
      setDatabaseError('')
      try {
        const page = databasePages[databasePanelOpen]
        const pageSize = databasePageSizes[databasePanelOpen]
        const filters = appliedDatabaseFilters[databasePanelOpen]
        const params = databasePanelOpen === 'candidates'
          ? {
              search: [filters.name, filters.mobile, filters.whatsapp, filters.email, filters.aadhaar].filter(Boolean).join(' ') || undefined,
              name: filters.name.trim() || undefined,
              mobile: filters.mobile.trim() || undefined,
              whatsapp: filters.whatsapp.trim() || undefined,
              email: filters.email.trim() || undefined,
              aadhaar: filters.aadhaar.trim() || undefined,
              location: filters.location !== 'All' ? filters.location : undefined,
              from: filters.from || undefined,
              to: filters.to || undefined,
              offset: (page - 1) * pageSize,
              limit: pageSize,
            }
          : {
              search: filters.name.trim() || undefined,
              mobile: filters.mobile.trim() || undefined,
              states: filters.states.join(',') || undefined,
              location: filters.locations.join(',') || undefined,
              offset: (page - 1) * pageSize,
              limit: pageSize,
            }
        const response = databasePanelOpen === 'candidates'
          ? await recruiterAPI.getCandidates(params)
          : await recruiterAPI.getImportedRecipients(params)
        const result = unwrapRows(response)
        if (active) {
          setDatabaseCandidates(result.rows)
          setDatabaseTotal(result.total)
        }
      } catch (loadError) {
        if (active) {
          setDatabaseCandidates([])
          setDatabaseTotal(0)
          setDatabaseError('Unable to load records from this database.')
        }
      } finally {
        if (active) setDatabaseLoading(false)
      }
    }
    loadCandidates()
    return () => { active = false }
  }, [databasePanelOpen, databasePages, databasePageSizes, appliedDatabaseFilters])

  useEffect(() => {
    if (!databasePanelOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setDatabasePanelOpen('')
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [databasePanelOpen])

  useEffect(() => {
    if (databaseSelectAllRef.current) {
      databaseSelectAllRef.current.indeterminate = selectedVisibleCount > 0 && !allVisibleDatabaseRowsSelected
    }
  }, [selectedVisibleCount, allVisibleDatabaseRowsSelected])

  useEffect(() => {
    if (databasePanelOpen !== 'recipients') return undefined
    let active = true
    setRecipientStatesLoading(true)
    recruiterAPI.getImportedRecipientStateCounts()
      .then((response) => {
        const data = response?.data?.data || response?.data || {}
        const states = Array.isArray(data.states) ? data.states : []
        if (active) setRecipientStateOptions(states.map((item) => {
          const state = typeof item === 'string' ? item : String(item.state || item.state_name || item.name || '')
          const count = typeof item === 'string' ? null : Number(item.count ?? item.candidate_count ?? item.total ?? 0)
          return { value: state.trim(), label: count === null ? state.trim() : `${state.trim()} (${count.toLocaleString()})` }
        }).filter((item) => item.value))
      })
      .catch(() => { if (active) setRecipientStateOptions([]) })
      .finally(() => { if (active) setRecipientStatesLoading(false) })
    return () => { active = false }
  }, [databasePanelOpen])

  useEffect(() => {
    const states = databaseFilters.recipients.states
    if (databasePanelOpen !== 'recipients' || !states.length) {
      setRecipientLocationOptions([])
      setRecipientLocationsLoading(false)
      return undefined
    }
    let active = true
    const search = recipientLocationSearch.trim()
    const timer = window.setTimeout(async () => {
      setRecipientLocationsLoading(true)
      try {
        const response = await recruiterAPI.getImportedRecipientLocationOptions({ states: states.join(','), search: search || undefined, limit: 10 })
        const data = response?.data?.data || response?.data || {}
        const locations = Array.isArray(data.locations) ? data.locations : Array.isArray(data.items) ? data.items : Array.isArray(data.results) ? data.results : []
        if (active) setRecipientLocationOptions(locations.map((item) => {
          const value = typeof item === 'string' ? item : String(item.name || item.location || item.area || item.locality || item.city || item.value || '')
          return { value, label: value }
        }).filter((item) => item.value))
      } catch {
        if (active) setRecipientLocationOptions([])
      } finally {
        if (active) setRecipientLocationsLoading(false)
      }
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [databasePanelOpen, databaseFilters.recipients.states, recipientLocationSearch])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setProjLoading(true)
      try {
        const resp = await recruiterAPI.getProjectSuggestions('', 1000)
        const data = resp.data?.data ?? resp.data ?? resp
        const list = Array.isArray(data)
          ? data
          : data.projects || data.items || data.results || []
        if (!mounted) return
        setProjects(list.map((project) => {
          const id = String(project.id ?? project.project_id ?? project.projectId ?? project.value ?? project.key ?? project.name ?? project.title ?? '')
          const name = String(project.name ?? project.project_name ?? project.projectName ?? project.title ?? project.label ?? project.project ?? id)
          return { ...project, id, name }
        }).filter((project) => project.id && project.name))
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setProjLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const normalizeCampaignRow = (row) => ({
    id: row.id || row._id || row.campaign_id || String(Math.random()),
    project: row.project_name || row.project || row.projectTitle || row.projectName || row.name || '',
    portal: row.portal || row.channel || '',
    messageType: row.message_type || row.messageType || row.type || '',
    status: row.status || row.state || 'Sent',
    candidateName: row.candidate_name || '',
    candidateMobileNumber: row.candidate_mobile_number || row.mobile_number || '',
    datetime: row.datetime || row.sent_at || row.created_at || row.updated_at || new Date().toISOString(),
  })

  const parseCampaignHistory = (payload) => {
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : []
    return rows.map(normalizeCampaignRow)
  }

  const getHistoryPayload = (response) => {
    const payload = response?.data ?? response
    if (!payload) return { items: [], total: 0 }

    if (Array.isArray(payload)) {
      return { items: payload, total: payload.length }
    }

    if (Array.isArray(payload.items)) {
      return { items: payload.items, total: typeof payload.total === 'number' ? payload.total : payload.items.length }
    }

    if (Array.isArray(payload.data)) {
      return { items: payload.data, total: typeof payload.total === 'number' ? payload.total : payload.data.length }
    }

    if (payload?.data && Array.isArray(payload.data.items)) {
      return { items: payload.data.items, total: typeof payload.data.total === 'number' ? payload.data.total : payload.data.items.length }
    }

    return { items: [], total: 0 }
  }

  const fetchCampaignHistory = async () => {
    setHistoryLoading(true)
    try {
      const resp = await recruiterAPI.getCampaignHistory({
        offset: (historyPage - 1) * historyPageSize,
        limit: historyPageSize,
        search: historySearchQuery || undefined,
        project_id: historyProjectFilter || undefined,
        portal: historyPortalFilter || undefined,
        message_type: historyMessageTypeFilter || undefined,
      })
      const { items, total } = getHistoryPayload(resp.data?.data || resp.data || resp)
      setHistory(parseCampaignHistory(items))
      setHistoryTotal(total)
    } catch (err) {
      console.warn('Failed to load campaign history', err)
      setHistory([])
      setHistoryTotal(0)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaignHistory()
  }, [historyPage, historyPageSize, historySearchQuery, historyProjectFilter, historyPortalFilter, historyMessageTypeFilter])

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    setFile(f)
    parseFileForPreview(f)
  }

  const downloadSampleFile = () => {
    try {
      const sampleData = [
        { 'S.no': 1, candidate_name: 'John Doe', candidate_mobile_number: '9876543210' },
        { 'S.no': 2, candidate_name: 'Jane Smith', candidate_mobile_number: '9876543211' },
        { 'S.no': 3, candidate_name: 'Robert Johnson', candidate_mobile_number: '9876543212' },
      ]
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(sampleData))
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'campaign_candidates_template.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to generate sample file', err)
      setError('Failed to generate sample file')
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setHistorySearchQuery(historySearch.trim()), 350)
    return () => clearTimeout(timer)
  }, [historySearch])

  const handleHistorySearch = (value) => {
    setHistorySearch(value)
    setHistoryPage(1)
  }

  const handleHistoryFilterChange = (setter) => (value) => {
    setter(value)
    setHistoryPage(1)
  }

  const historyPageCount = Math.max(1, Math.ceil(historyTotal / historyPageSize))
  const historyPageNumbers = []
  const historyPageStart = Math.max(1, Math.min(historyPage - 2, Math.max(1, historyPageCount - 4)))
  const historyPageEnd = Math.min(historyPageCount, historyPageStart + 4)
  for (let i = historyPageStart; i <= historyPageEnd; i += 1) {
    historyPageNumbers.push(i)
  }

  const parseFileForPreview = async (f) => {
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      const rows = json.map((r, idx) => ({
        s_no: r['S.no'] || r.s_no || idx + 1,
        candidate_name: r.candidate_name || r.name || '',
        candidate_mobile_number: r.candidate_mobile_number || r.mobile || '',
      }))
      setPreview(rows.slice(0, 200))
    } catch (err) {
      setError('Failed to parse file. Upload a valid Excel/CSV file.')
      setPreview([])
    }
  }

  const handleSend = async () => {
    if (!selectedProject) return setError('Select a project')
    if (selectedProject === 'others' && !otherProjectName.trim()) return setError('Enter the project name')
    const chosenCandidates = selectedDatabaseEntries.map(([, selection]) => selection)
    if (importSource === 'file' && !file) return setError('Upload the exported Excel')
    if (importSource !== 'file' && chosenCandidates.length === 0) return setError('Select at least one candidate')
    if (portal === 'whatsapp' && !selectedTemplateId) return setError('Select a WhatsApp template')
    if (portal === 'whatsapp' && isImageTemplate && !templateImage) return setError('Upload an image for this WhatsApp template')
    if (portal === 'whatsapp' && selectedProject && !taggedField.trim()) return setError('Enter a tagged field for the project')

    if (!attendanceDates.length) {
      return setError('Choose a valid schedule date range.')
    }
    if (attendanceToDate < attendanceFromDate) {
      return setError('The schedule end date must be on or after the start date.')
    }
    if (attendanceSchedule.some(({ send_time, reminder_time }) => !send_time || !reminder_time)) {
      return setError('Choose sending and reminder times for every schedule date.')
    }

    const templateButtons = portal === 'whatsapp' && Array.isArray(selectedTemplateDetails?.buttons) ? selectedTemplateDetails.buttons : []
    const applyButton = templateButtons.find((button) => String(button.type || '').toUpperCase() === 'URL' && String(button.url || '').includes('/apply/'))
    if (applyButton && selectedProject === 'others') return setError('Select an existing project to use its application link.')

    setLoading(true)
    setError('')
    const projectId = selectedProject === 'others' ? 'others' : String(selectedProject).replace(/^proj_/, '')
    const selectedProjectRecord = projects.find((project) => String(project.id || project.projectId || project.project_id || project.name) === String(selectedProject))
    const projectName = selectedProject === 'others'
      ? otherProjectName.trim()
      : selectedProjectRecord?.name || selectedProjectRecord?.title || selectedProjectRecord?.projectName || selectedProject
    const attendanceScheduleFields = { attendance_schedule: attendanceSchedule }

    try {
      const buttonValues = {}
      buttonVariableMappings.forEach(({ index, variables }) => {
        const values = variables.map((key) => String(buttonVariableValues[`${index}:${key}`] || '').trim())
        if (values.some(Boolean)) buttonValues[String(index + 1)] = values
      })
      let applicationLinkFields = Object.keys(buttonValues).length ? { buttonValues } : {}
      if (applyButton) {
        const encryptedProjectId = await encryptRegistrationId(selectedProject)
        const buttonIndex = templateButtons.indexOf(applyButton)
        const templateUrl = String(applyButton.url)
        const applyPathStart = templateUrl.indexOf('/apply/')
        const staticPrefix = templateUrl.slice(0, applyPathStart + '/apply/'.length)
        const applyVariables = getUrlTemplateVariables(templateUrl)
        if (applyVariables.length) {
          buttonValues[String(buttonIndex + 1)] = applyVariables.map((key, index) => (
            index === 0 ? encryptedProjectId : String(buttonVariableValues[`${buttonIndex}:${key}`] || '').trim()
          ))
        }
        applicationLinkFields = {
          ...applicationLinkFields,
          application_project_id: encryptedProjectId,
          application_link: `${staticPrefix}${encodeURIComponent(encryptedProjectId)}`,
          ...(Object.keys(buttonValues).length ? { buttonValues: { ...buttonValues } } : {}),
        }
      }

      if (importSource === 'file') {
        const form = new FormData()
        form.append('file', file)
        form.append('to', JSON.stringify(await getUploadedCampaignRecipientDetails(file)))
        Object.entries(attendanceScheduleFields).forEach(([key, value]) => form.append(key, JSON.stringify(value)))
        if (portal === 'whatsapp') {
          form.append('template_id', selectedTemplateId)
          form.append('template_name', selectedTemplateName)
          form.append('template_variables', JSON.stringify(templateVariables))
          if (templateImage) form.append('image', templateImage)
        }
        Object.entries(applicationLinkFields).forEach(([key, value]) => form.append(key, typeof value === 'object' ? JSON.stringify(value) : value))
        await recruiterAPI.notifyCampaign(form, { project_id: projectId, project_name: projectName, portal, message_type: messageType, tagged_field: taggedField.trim() || undefined })
      } else if (portal === 'sms') {
        const recipientRows = chosenCandidates.map((selection, index) => ({
          'S.no': index + 1,
          candidate_name: getDatabaseCandidateName(selection.record),
          candidate_mobile_number: getDatabaseCandidateMobile(selection.record),
        }))
        const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(recipientRows))
        const form = new FormData()
        form.append('file', new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'campaign_recipients.csv')
        form.append('to', JSON.stringify(chosenCandidates.map(getCampaignRecipientDetails)))
        Object.entries(attendanceScheduleFields).forEach(([key, value]) => form.append(key, JSON.stringify(value)))
        await recruiterAPI.notifyCampaign(form, { project_id: projectId, project_name: projectName, portal, message_type: messageType, tagged_field: taggedField.trim() || undefined })
      } else {
        const recipientRows = chosenCandidates.map((selection, index) => ({
          'S.no': index + 1,
          candidate_name: getDatabaseCandidateName(selection.record),
          candidate_mobile_number: getDatabaseCandidateMobile(selection.record),
        }))
        const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(recipientRows))
        const form = new FormData()
        form.append('file', new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'campaign_recipients.csv')
        form.append('to', JSON.stringify(chosenCandidates.map(getCampaignRecipientDetails)))
        form.append('template_id', selectedTemplateId)
        form.append('template_name', selectedTemplateName)
        form.append('template_variables', JSON.stringify(templateVariables))
        if (templateImage) form.append('image', templateImage)
        Object.entries(attendanceScheduleFields).forEach(([key, value]) => form.append(key, JSON.stringify(value)))
        Object.entries(applicationLinkFields).forEach(([key, value]) => form.append(key, typeof value === 'object' ? JSON.stringify(value) : value))
        await recruiterAPI.notifyCampaign(form, { project_id: projectId, project_name: projectName, portal, message_type: messageType, tagged_field: taggedField.trim() || undefined })
      }
      setLoading(false)
      setFile(null)
      setTemplateImage(null)
      if (imageFileRef.current) imageFileRef.current.value = ''
      setPreview([])
      setSelectedDatabaseCandidates({})
      setAttendanceFromDate('')
      setAttendanceToDate('')
      setAttendanceDateTimes({})
      await fetchCampaignHistory()
      alert('Campaign scheduled')
    } catch (err) {
      setLoading(false)
      setError(err.response?.data?.message || 'Failed to send campaign')
    }
  }

  return (
    <div className="campaigns-page">
      <PageHeader title="Campaigns" subtitle="Run bulk WhatsApp campaigns" />

      <Card className="campaigns-compose-card">
        <div className="card-header">
          <div>
            <div className="card-title">Campaign details</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Choose a project, portal, and recipient source.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" type="button" disabled>
              {projLoading ? 'Loading projects…' : `${projects.length} projects loaded`}
            </button>
          </div>
        </div>

        <div className="grid-3" style={{ gap: 16, alignItems: 'flex-end', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="form-group">
            <label className="form-label">Project</label>
            <SearchableProjectSelect
              options={[...projects, { id: 'others', name: 'Others' }]}
              value={selectedProject}
              onChange={(value) => { setSelectedProject(value); setTaggedField('') }}
              placeholder={projLoading ? 'Loading projects...' : 'Select project'}
            />
            {selectedProject === 'others' && (
              <input className="form-control" style={{ marginTop: 8 }} value={otherProjectName} onChange={(e) => setOtherProjectName(e.target.value)} placeholder="Enter project name" />
            )}
            {portal === 'whatsapp' && selectedProject && (
              <div style={{ marginTop: 12 }}>
                <label className="form-label" htmlFor="campaign-tagged-field">Tagged field</label>
                <select id="campaign-tagged-field" className="form-control" value={taggedField} onChange={(e) => setTaggedField(e.target.value)}>
                  <option value="">Select a tagged field</option>
                  {TAGGED_FIELD_OPTIONS.map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Portal</label>
            <select className="form-control" value={portal} onChange={(e) => setPortal(e.target.value)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Message type</label>
            <select className="form-control" value={messageType} onChange={(e) => setMessageType(e.target.value)}>
              <option value="registration">Registration</option>
              <option value="attendance">Attendance</option>
              <option value="hiring">Hiring</option>
              <option value="training">Training</option>
            </select>
          </div>

          {portal === 'whatsapp' && <div className="form-group">
            <label className="form-label">WhatsApp template</label>
            <select
              className="form-control"
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value)
                setTemplateVariables({})
              }}
            >
              <option value="">{templateError || 'Select template'}</option>
              {templates.map((template) => {
                const id = String(template.id ?? template.template_id ?? template.name ?? '')
                return <option key={id} value={id}>{template.name || template.title || id}</option>
              })}
            </select>
            <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setTemplatePanelOpen(true)}>
              Preview template and enter variables
            </button>
          </div>}
        </div>

        {templatePanelOpen && (
            <section className="campaign-template-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setTemplatePanelOpen(false)
            }}>
              <div className="campaign-template-dialog" role="dialog" aria-modal="true" aria-label="WhatsApp template and field mapping">
              <div className="campaign-template-header">
                <div>
                  <div className="card-title">WhatsApp template</div>
                  <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Preview message and enter body or button values.</div>
                </div>
                <button className="btn btn-outline btn-sm" type="button" aria-label="Close" onClick={() => setTemplatePanelOpen(false)}><FontAwesomeIcon icon={faTimes} /></button>
              </div>
              <div className="campaign-template-content">
                <div className="form-group">
                  <label className="form-label">Select template</label>
                  <select className="form-control" value={selectedTemplateId} onChange={(e) => { setSelectedTemplateId(e.target.value); setTemplateVariables({}) }}>
                    <option value="">{templateError || 'Select template'}</option>
                    {templates.map((template) => {
                      const id = String(template.id ?? template.template_id ?? template.name ?? '')
                      return <option key={id} value={id}>{template.name || template.title || id}</option>
                    })}
                  </select>
                  {templateDetailsLoading && <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }} role="status">Loading template body...</div>}
                  {templateDetailsError && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }} role="alert">{templateDetailsError}{templateContent ? ' Showing list content as fallback.' : ''}</div>}
                </div>
                {isImageTemplate && <div className="form-group">
                  <label className="form-label" htmlFor="campaign-template-image">Template image</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      ref={imageFileRef}
                      id="campaign-template-image"
                      type="file"
                      accept="image/*"
                      onChange={(event) => setTemplateImage(event.target.files?.[0] || null)}
                      style={{ display: 'none' }}
                    />
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => imageFileRef.current?.click()}>
                      <FontAwesomeIcon icon={faUpload} />
                      <span>{templateImage?.name || 'Upload image'}</span>
                    </button>
                  </div>
                </div>}
                <div className="grid-2" style={{ gap: 18, alignItems: 'start' }}>
                  <div className="form-group">
                    <label className="form-label">Template preview</label>
                    <div className="form-control" style={{ minHeight: 180, height: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                      {selectedTemplate ? previewTemplateContent || 'Template content is unavailable.' : 'Select a template to preview its message.'}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message content variables</label>
                    {templateVariableNames.length ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--text2)' }}>
                          <span>Candidate name placeholder</span>
                          <select className="form-control" value={candidateNamePlaceholder} onChange={handleCandidateNamePlaceholderChange}>
                            <option value="">Do not map candidate name</option>
                            {templateVariableNames.map((name) => <option key={name} value={name}>{`{{${name}}}`}</option>)}
                          </select>
                        </label>
                        {templateVariableNames.map((name) => (
                          <label key={name} style={{ display: 'grid', gridTemplateColumns: 'minmax(52px, .35fr) minmax(150px, 1.65fr)', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--text2)' }}>
                            <span>{`{{${name}}}`}</span>
                            {name === candidateNamePlaceholder ? (
                              <input className="form-control" value="Candidate name (automatic)" readOnly />
                            ) : (
                              <input className="form-control" value={templateVariables[name] || ''} onChange={(event) => setTemplateVariables((current) => ({ ...current, [name]: event.target.value }))} placeholder={`Enter ${name}`} />
                            )}
                          </label>
                        ))}
                      </div>
                    ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>No variables were found in this template body.</div>}
                    {buttonVariableMappings.length > 0 && (
                      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>Button URL variables</label>
                        {buttonVariableMappings.flatMap((button) => button.variables.map((name, variableIndex) => (
                          <label key={`${button.index}:${name}:${variableIndex}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(52px, .35fr) minmax(150px, 1.65fr)', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--text2)' }}>
                            <span>{`${button.text || `Button ${button.index + 1}`} {{${name}}}`}</span>
                            <input
                              className="form-control"
                              value={String(button.url || '').includes('/apply/') && variableIndex === 0 ? 'Generated from selected project' : buttonVariableValues[`${button.index}:${name}`] || ''}
                              onChange={(event) => setButtonVariableValues((current) => ({ ...current, [`${button.index}:${name}`]: event.target.value }))}
                              placeholder={String(button.url || '').includes('/apply/') && variableIndex === 0 ? 'Application link is generated automatically' : `Enter ${name}`}
                              readOnly={String(button.url || '').includes('/apply/') && variableIndex === 0}
                            />
                          </label>
                        )))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="campaign-template-footer">
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setTemplatePanelOpen(false)}>Done</button>
              </div>
              </div>
            </section>
        )}

        <div className="form-group campaigns-recipient-source" style={{ marginTop: 16 }}>
          <label className="form-label">Recipients</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className={`btn btn-sm ${importSource === 'file' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setImportSource('file'); setDatabasePanelOpen('') }}>Upload file</button>
            <button type="button" className={`btn btn-sm ${importSource === 'candidates' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setImportSource('candidates'); setDatabasePages((pages) => ({ ...pages, candidates: 1 })); setDatabasePanelOpen('candidates'); setError('') }}>
              Import from candidate database{selectedCandidateCount ? ` (${selectedCandidateCount})` : ''}
            </button>
            <button type="button" className={`btn btn-sm ${importSource === 'recipients' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setImportSource('recipients'); setDatabasePages((pages) => ({ ...pages, recipients: 1 })); setDatabasePanelOpen('recipients'); setError('') }}>
              Import from recipients database{selectedRecipientCount ? ` (${selectedRecipientCount})` : ''}
            </button>
          </div>
        </div>

        {importSource === 'file' && <div className="form-group campaigns-upload-group" style={{ marginTop: 16 }}>
          <label className="form-label">Upload candidate list</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
            <button className="btn btn-outline btn-sm" type="button" onClick={() => fileRef.current && fileRef.current.click()}>
              <FontAwesomeIcon icon={faUpload} />
              <span>{file ? file.name : 'Upload Excel'}</span>
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={downloadSampleFile}>
              <FontAwesomeIcon icon={faUpload} style={{ transform: 'rotate(180deg)' }} />
              <span>Download sample</span>
            </button>
            {file && <span style={{ color: 'var(--text3)', fontSize: 13 }}>{Math.round(file.size / 1024)} KB selected</span>}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>
            Upload the exported not-registered file with columns: <strong>S.no</strong>, <strong>candidate_name</strong>, <strong>candidate_mobile_number</strong>.
          </div>
        </div>}

        {databasePanelOpen && (
          <div className="campaigns-database-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDatabasePanelOpen('')
          }}>
            <section className="campaigns-database-panel" role="dialog" aria-modal="true" aria-label={`${databasePanelOpen === 'candidates' ? 'Candidate' : 'Recipients'} database import`}>
              <div className="campaigns-database-header">
                <div>
                  <div className="card-title">{databasePanelOpen === 'candidates' ? 'Candidate database' : 'Recipients database'}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>Filter and select records to add to your campaign.</div>
                </div>
                <button className="campaigns-database-close" type="button" aria-label="Close database selection" title="Close" onClick={() => setDatabasePanelOpen('')}><FontAwesomeIcon icon={faTimes} /></button>
              </div>
              <div className="campaigns-database-content">
                <div className="campaigns-database-tabs">
                  <button type="button" className={`btn btn-sm ${databasePanelOpen === 'candidates' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setImportSource('candidates'); setDatabasePanelOpen('candidates') }}>Candidates ({selectedCandidateCount})</button>
                  <button type="button" className={`btn btn-sm ${databasePanelOpen === 'recipients' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setImportSource('recipients'); setDatabasePanelOpen('recipients') }}>Recipients ({selectedRecipientCount})</button>
                </div>
                {selectedDatabaseEntries.length > 0 && (
                  <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, padding: 10, maxHeight: 120, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Selected from both databases</div>
                    <div style={{ display: 'grid', gap: 5 }}>
                      {selectedDatabaseEntries.map(([key, selection]) => {
                        const record = selection.record
                        const name = getDatabaseCandidateName(record) || getDatabaseCandidateMobile(record) || 'Unnamed record'
                        return <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <span>{name} <span style={{ color: 'var(--text3)' }}>({selection.source === 'candidates' ? 'Candidate' : 'Recipient'})</span></span>
                          <button type="button" className="btn btn-outline btn-sm" aria-label={`Remove ${name}`} onClick={() => setSelectedDatabaseCandidates((current) => { const next = { ...current }; delete next[key]; return next })} style={{ width: 30, minWidth: 30, height: 30, padding: 0, flex: '0 0 30px', justifyContent: 'center' }}><FontAwesomeIcon icon={faTimes} /></button>
                        </div>
                      })}
                    </div>
                  </div>
                )}
                {databasePanelOpen === 'candidates' ? (
                  <div className="campaign-filter-block">
                    <div className="campaign-filter-heading">
                      <div><strong>Candidate filters</strong><span>Set your filters, then search the database.</span></div>
                      <div className="campaign-filter-actions">
                        <button type="button" className="btn btn-primary btn-sm" disabled={databaseLoading} onClick={() => {
                          setAppliedDatabaseFilters((current) => ({ ...current, candidates: { ...databaseFilters.candidates } }))
                          setDatabasePages((pages) => ({ ...pages, candidates: 1 }))
                        }}>Search</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => {
                        const clearedFilters = { name: '', mobile: '', whatsapp: '', email: '', aadhaar: '', location: 'All', from: '', to: '' }
                        setDatabaseFilters((current) => ({ ...current, candidates: clearedFilters }))
                        setAppliedDatabaseFilters((current) => ({ ...current, candidates: clearedFilters }))
                        setDatabasePages((pages) => ({ ...pages, candidates: 1 }))
                        }}>Clear filters</button>
                      </div>
                    </div>
                    <div className="campaign-filter-grid">
                    {[
                      ['name', 'Name', 'Search by name'],
                      ['mobile', 'Mobile number', 'Search by mobile'],
                      ['whatsapp', 'WhatsApp', 'Search by WhatsApp'],
                      ['email', 'Email', 'Search by email'],
                      ['aadhaar', 'Aadhaar', 'Search by Aadhaar'],
                    ].map(([key, label, placeholder]) => (
                      <label key={key} style={{ display: 'grid', gap: 4, minWidth: 0, fontSize: 12, color: 'var(--text2)' }}>
                        <span>{label}</span>
                        <input className="form-control" value={databaseFilters.candidates[key]} placeholder={placeholder} onChange={(event) => {
                          const value = key === 'aadhaar' ? event.target.value.replace(/\D/g, '').slice(0, 12) : event.target.value
                          setDatabaseFilters((current) => ({ ...current, candidates: { ...current.candidates, [key]: value } }))
                        }} />
                      </label>
                    ))}
                    <label style={{ display: 'grid', gap: 4, minWidth: 0, fontSize: 12, color: 'var(--text2)' }}>
                      <span>Location</span>
                      <select className="form-control" value={databaseFilters.candidates.location} onChange={(event) => {
                        setDatabaseFilters((current) => ({ ...current, candidates: { ...current.candidates, location: event.target.value } }))
                      }}>
                        {['All', ...CANDIDATE_LOCATION_OPTIONS].map((location) => <option key={location} value={location}>{location}</option>)}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: 4, minWidth: 0, fontSize: 12, color: 'var(--text2)' }}>
                      <span>From</span>
                      <input type="date" className="form-control" value={databaseFilters.candidates.from} onChange={(event) => {
                        setDatabaseFilters((current) => ({ ...current, candidates: { ...current.candidates, from: event.target.value } }))
                      }} />
                    </label>
                    <label style={{ display: 'grid', gap: 4, minWidth: 0, fontSize: 12, color: 'var(--text2)' }}>
                      <span>To</span>
                      <input type="date" className="form-control" value={databaseFilters.candidates.to} onChange={(event) => {
                        setDatabaseFilters((current) => ({ ...current, candidates: { ...current.candidates, to: event.target.value } }))
                      }} />
                    </label>
                    </div>
                  </div>
                ) : (
                  <div className="campaign-filter-block">
                    <div className="campaign-filter-heading">
                      <div><strong>Recipient filters</strong><span>Set your filters, then search the database.</span></div>
                      <div className="campaign-filter-actions">
                        <button type="button" className="btn btn-primary btn-sm" disabled={databaseLoading} onClick={() => {
                          setAppliedDatabaseFilters((current) => ({ ...current, recipients: { ...databaseFilters.recipients } }))
                          setDatabasePages((pages) => ({ ...pages, recipients: 1 }))
                        }}>Search</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => {
                        const clearedFilters = { name: '', mobile: '', states: [], locations: [] }
                        setDatabaseFilters((current) => ({ ...current, recipients: clearedFilters }))
                        setAppliedDatabaseFilters((current) => ({ ...current, recipients: clearedFilters }))
                        setDatabasePages((pages) => ({ ...pages, recipients: 1 }))
                        setRecipientLocationSearch('')
                        }}>Clear filters</button>
                      </div>
                    </div>
                    <div className="campaign-filter-grid">
                    {[
                      ['name', 'Name', 'Search name'],
                      ['mobile', 'Mobile number', 'Search mobile number'],
                    ].map(([key, label, placeholder]) => (
                      <label key={key} style={{ display: 'grid', gap: 4, minWidth: 0, fontSize: 12, color: 'var(--text2)' }}>
                        <span>{label}</span>
                        <input className="form-control" value={databaseFilters.recipients[key]} placeholder={placeholder} onChange={(event) => {
                          setDatabaseFilters((current) => ({ ...current, recipients: { ...current.recipients, [key]: event.target.value } }))
                        }} />
                      </label>
                    ))}
                    <div className="campaign-filter-field">
                      <span>State</span>
                      {recipientStatesLoading ? <span style={{ padding: 9, color: 'var(--text3)' }}>Loading states...</span> : <MultiSelectDropdown
                        options={recipientStateOptions}
                        selectedValues={databaseFilters.recipients.states}
                        onChange={(states) => {
                          setDatabaseFilters((current) => ({ ...current, recipients: { ...current.recipients, states, locations: [] } }))
                          setRecipientLocationSearch('')
                        }}
                        placeholder="All states"
                        allowCustomValues={false}
                        menuMaxHeight={160}
                      />}
                    </div>
                    <div className="campaign-filter-field">
                      <span>Area / Locality</span>
                      {databaseFilters.recipients.states.length === 0 ? <span style={{ padding: 9, color: 'var(--text3)' }}>Choose a state first</span> : <MultiSelectDropdown
                        options={recipientLocationOptions}
                        selectedValues={databaseFilters.recipients.locations}
                        onChange={(locations) => {
                          setDatabaseFilters((current) => ({ ...current, recipients: { ...current.recipients, locations } }))
                        }}
                        onSearch={(search) => { setRecipientLocationSearch(search); setRecipientLocationOptions([]) }}
                        placeholder={recipientLocationsLoading ? 'Searching areas...' : 'Search area or locality'}
                        allowCustomValues={false}
                        noOptionsMessage={recipientLocationsLoading ? 'Searching locations...' : 'No locations found'}
                        menuMaxHeight={160}
                        searchResetKey={databaseFilters.recipients.states.join('|')}
                        scrollSelectedValues
                      />}
                    </div>
                    </div>
                  </div>
                )}
                <div className="excel-preview" style={{ minHeight: 280, maxHeight: '55vh', overflow: 'auto' }}>
                  {databaseLoading ? <div style={{ padding: 16, color: 'var(--text3)' }}>Loading {databasePanelOpen}...</div> : databaseError ? <div style={{ padding: 16, color: 'var(--red)' }}>{databaseError}</div> : databaseCandidates.length === 0 ? <div style={{ padding: 16, color: 'var(--text3)' }}>No {databasePanelOpen} found.</div> : (
                    <div className="excel-table-wrap" style={{ maxHeight: '100%', overflowX: 'auto', overflowY: 'auto' }}>
                      <table className="excel-preview-table">
                        <thead><tr><th><input
                          ref={databaseSelectAllRef}
                          type="checkbox"
                          aria-label="Select all available records on this page"
                          checked={allVisibleDatabaseRowsSelected}
                          disabled={selectableDatabaseRows.length === 0 || databaseLoading}
                          onChange={(event) => setSelectedDatabaseCandidates((current) => {
                            const next = { ...current }
                            selectableDatabaseRows.forEach(({ candidate, key }) => {
                              if (event.target.checked) next[key] = { record: candidate, source: databasePanelOpen }
                              else delete next[key]
                            })
                            return next
                          })}
                        /></th><th>Name</th><th>Mobile</th><th>Location</th></tr></thead>
                        <tbody>{currentDatabaseRows.map(({ candidate, key: id }) => {
                          const recordId = getDatabaseCandidateId(candidate)
                          const source = databasePanelOpen
                          const phone = getDatabaseCandidateMobile(candidate)
                          return <tr key={id}>
                            <td><input type="checkbox" aria-label={`Select ${getDatabaseCandidateName(candidate) || phone}`} disabled={!phone || !recordId} checked={Boolean(selectedDatabaseCandidates[id])} onChange={(e) => setSelectedDatabaseCandidates((current) => {
                              const next = { ...current }
                              if (e.target.checked) next[id] = { record: candidate, source }
                              else delete next[id]
                              return next
                            })} /></td>
                            <td>{getDatabaseCandidateName(candidate) || '-'}</td>
                            <td>{phone || '-'}</td>
                            <td>{candidate.location || candidate.city || '-'}</td>
                          </tr>
                        })}</tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Show entries</span>
                    <select className="form-control" value={databasePageSizes[databasePanelOpen]} disabled={databaseLoading} onChange={(event) => {
                      const pageSize = Number(event.target.value)
                      setDatabasePageSizes((sizes) => ({ ...sizes, [databasePanelOpen]: pageSize }))
                      setDatabasePages((pages) => ({ ...pages, [databasePanelOpen]: 1 }))
                    }} style={{ width: 82, padding: '6px 8px' }}>
                      {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                  <span>Showing {databaseTotal === 0 ? 0 : (databasePages[databasePanelOpen] - 1) * databasePageSizes[databasePanelOpen] + 1}–{Math.min(databasePages[databasePanelOpen] * databasePageSizes[databasePanelOpen], databaseTotal)} of {databaseTotal}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" type="button" disabled={databasePages[databasePanelOpen] <= 1 || databaseLoading} onClick={() => setDatabasePages((pages) => ({ ...pages, [databasePanelOpen]: pages[databasePanelOpen] - 1 }))}>Previous</button>
                    <button className="btn btn-outline btn-sm" type="button" disabled={databasePages[databasePanelOpen] * databasePageSizes[databasePanelOpen] >= databaseTotal || databaseLoading} onClick={() => setDatabasePages((pages) => ({ ...pages, [databasePanelOpen]: pages[databasePanelOpen] + 1 }))}>Next</button>
                  </div>
                </div>
              </div>
              <div className="campaigns-database-footer">
                <span style={{ fontSize: 13 }}>{selectedDatabaseEntries.length} recipients selected</span>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setDatabasePanelOpen('')}>Use selected recipients</button>
              </div>
            </section>
          </div>
        )}

        <>
          <div className="grid-2" style={{ gap: 16, marginTop: 16 }}>
            <div className="form-group">
              <label className="form-label">From date</label>
              <input type="date" className="form-control" value={attendanceFromDate} onChange={(e) => { setAttendanceFromDate(e.target.value); setError('') }} />
            </div>
            <div className="form-group">
              <label className="form-label">To date</label>
              <input type="date" className="form-control" min={attendanceFromDate || undefined} value={attendanceToDate} onChange={(e) => { setAttendanceToDate(e.target.value); setError('') }} />
            </div>
          </div>
          {attendanceDates.length > 0 && <div style={{ marginTop: 12, border: '1px solid var(--border, #e5e7eb)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>Daily sending schedule ({attendanceDates.length} {attendanceDates.length === 1 ? 'date' : 'dates'})</strong>
              {attendanceDates.length > 1 && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label htmlFor="attendance-copy-source-date" style={{ fontSize: 12, color: 'var(--text2)' }}>Copy times from</label>
                <select id="attendance-copy-source-date" className="form-control" value={effectiveAttendanceCopyDate} onChange={(event) => setAttendanceCopyFromDate(event.target.value)} style={{ width: 'auto', minWidth: 140, padding: '6px 8px' }}>
                  {attendanceDates.map((date) => <option key={date} value={date}>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</option>)}
                </select>
                <button type="button" className="btn btn-outline btn-sm" disabled={!attendanceDateTimes[effectiveAttendanceCopyDate]?.send_time && !attendanceDateTimes[effectiveAttendanceCopyDate]?.reminder_time} onClick={() => {
                  const sourceTimes = attendanceDateTimes[effectiveAttendanceCopyDate] || {}
                  setAttendanceDateTimes((times) => {
                    const next = { ...times }
                    attendanceDates.forEach((date) => {
                      next[date] = { send_time: sourceTimes.send_time || '', reminder_time: sourceTimes.reminder_time || '' }
                    })
                    return next
                  })
                  setError('')
                }}>Apply times to all</button>
              </div>}
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {attendanceSchedule.map(({ date, send_time, reminder_time }) => (
                <div key={date} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                  <strong style={{ fontSize: 13 }}>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
                    <span>Sending time</span>
                    <input type="time" className="form-control" value={send_time} onChange={(event) => {
                      setAttendanceDateTimes((times) => ({ ...times, [date]: { ...times[date], send_time: event.target.value } }))
                      setError('')
                    }} />
                  </label>
                  <label style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
                    <span>Reminder time</span>
                    <input type="time" className="form-control" value={reminder_time} onChange={(event) => {
                      setAttendanceDateTimes((times) => ({ ...times, [date]: { ...times[date], reminder_time: event.target.value } }))
                      setError('')
                    }} />
                  </label>
                </div>
              ))}
            </div>
          </div>}
        </>

        {error && <div style={{ color: 'var(--red)', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary btn-sm" type="button" onClick={handleSend} disabled={loading || (importSource === 'file' ? !file : Object.keys(selectedDatabaseCandidates).length === 0) || !selectedProject || (portal === 'whatsapp' && !selectedTemplateId)}>
            {loading
              ? <><FontAwesomeIcon icon={faSpinner} spin /> Sending...</>
              : <><FontAwesomeIcon icon={faCheckCircle} /> Send campaign</>
            }
          </button>
        </div>
      </Card>

      <Card className="campaigns-history-card">
        <div className="card-header">
          <div>
            <div className="card-title">Campaign history</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>View past and ongoing campaigns with date, time, project, portal, message type, and status.</div>
          </div>
        </div>

        <div className="projects-table-filters" style={{ marginTop: 0, marginBottom: 0 }}>
          <div className="projects-table-filter-group search-group">
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control search-input"
                placeholder="Search campaign or project"
                value={historySearch}
                onChange={(e) => handleHistorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setHistorySearchQuery(historySearch.trim())}
              />
            </div>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Project</div>
            <SearchableProjectSelect
              options={[{ id: '', name: 'All projects' }, ...projects]}
              value={historyProjectFilter}
              onChange={handleHistoryFilterChange(setHistoryProjectFilter)}
              placeholder="All projects"
            />
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Portal</div>
            <select className="form-control" value={historyPortalFilter} onChange={(e) => handleHistoryFilterChange(setHistoryPortalFilter)(e.target.value)}>
              <option value="">All portals</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              {/* <option value="email">Email</option> */}
            </select>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Message type</div>
            <select className="form-control" value={historyMessageTypeFilter} onChange={(e) => handleHistoryFilterChange(setHistoryMessageTypeFilter)(e.target.value)}>
              <option value="">All types</option>
              <option value="registration">Registration</option>
              <option value="attendance">Attendance</option>
              <option value="hiring">Hiring</option>
              <option value="training">Training</option>
            </select>
          </div>

          <div className="projects-table-filter-group date-group" style={{ alignItems: 'flex-end' }}>
            <div className="filter-label">Show</div>
            <select className="form-control" value={historyPageSize} onChange={(e) => { setHistoryPageSize(Number(e.target.value)); setHistoryPage(1); }}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
          </div>
        </div>

        <div className="excel-preview">
          {historyLoading ? (
            <div style={{ color: 'var(--text3)', padding: 20 }}>Loading campaign history…</div>
          ) : history.length === 0 ? (
            <div style={{ color: 'var(--text3)', padding: 20 }}>No campaigns found for the selected filters.</div>
          ) : (
            <div className="excel-table-wrap">
              <table className="excel-preview-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Candidate Name</th>
                    <th>Mobile Number</th>
                    <th>Project</th>
                    <th>Portal</th>
                    <th>Message type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((campaign) => {
                    const datetime = new Date(campaign.datetime)
                    return (
                      <tr key={campaign.id}>
                        <td>{datetime.toLocaleDateString()}</td>
                        <td>{datetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{campaign.candidateName || '-'}</td>
                        <td>{campaign.candidateMobileNumber || '-'}</td>
                        <td>{campaign.project || '-'}</td>
                        <td>{campaign.portal}</td>
                        <td>{campaign.messageType}</td>
                        <td>{campaign.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!historyLoading && historyTotal > historyPageSize && (
            <div className="projects-table-pagination" style={{ marginTop: 16 }}>
              <div className="pagination-summary">Showing <strong>{(historyPage - 1) * historyPageSize + 1}</strong> - <strong>{Math.min(historyPage * historyPageSize, historyTotal)}</strong> of <strong>{historyTotal}</strong></div>
              <div className="pagination-actions">
                <button className="btn btn-outline btn-sm" type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}>Previous</button>
                <div className="pagination-pages">
                  {historyPageStart > 1 && (<button className="pagination-page-btn" type="button" onClick={() => setHistoryPage(1)}>1</button>)}
                  {historyPageStart > 2 && <span className="pagination-ellipsis">…</span>}
                  {historyPageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={`pagination-page-btn${pageNumber === historyPage ? ' active' : ''}`}
                      type="button"
                      onClick={() => setHistoryPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  {historyPageEnd < historyPageCount - 1 && <span className="pagination-ellipsis">…</span>}
                  {historyPageEnd < historyPageCount && (<button className="pagination-page-btn" type="button" onClick={() => setHistoryPage(historyPageCount)}>{historyPageCount}</button>)}
                </div>
                <button className="btn btn-outline btn-sm" type="button" disabled={historyPage >= historyPageCount} onClick={() => setHistoryPage((prev) => Math.min(historyPageCount, prev + 1))}>Next</button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
