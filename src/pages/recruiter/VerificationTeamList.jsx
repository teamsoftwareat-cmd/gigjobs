import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { PageHeader, Card, Button, LoadingOverlay, Modal, FormField } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import VerifierAssignmentsModal from './VerifierAssignmentsModal'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const DEFAULT_ASSIGNMENT = {
  titleId: '',
  venue: '',
  recipientCount: undefined,
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

const defaultVerifierForm = {
  name: '',
  phone: '',
  registrationId: '',
  email: ''
}

export default function VerificationTeamList() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [activeStep, setActiveStep] = useState(1)
  const [assignments, setAssignments] = useState([{ ...DEFAULT_ASSIGNMENT }])
  const [activeAssignmentIndex, setActiveAssignmentIndex] = useState(0)
  const [originalPhone, setOriginalPhone] = useState('')
  const [form, setForm] = useState({ ...defaultVerifierForm })
  const [modalLoading, setModalLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpMessage, setOtpMessage] = useState('')
  const [candidateSuggestions, setCandidateSuggestions] = useState([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [showCandidateSuggestions, setShowCandidateSuggestions] = useState(false)
  const suggestionsRef = useRef(null)
  const { alert } = useAlert()

  const [titleOptions, setTitleOptions] = useState([])
  const [venueOptionsByTitle, setVenueOptionsByTitle] = useState({})
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false)
  const [selectedVerifierForAssignments, setSelectedVerifierForAssignments] = useState(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedExportTitle, setSelectedExportTitle] = useState('')
  const [exportPreviewRows, setExportPreviewRows] = useState([])
  const [exportPreviewTitleLabel, setExportPreviewTitleLabel] = useState('')
  const [exporting, setExporting] = useState(false)

  const offset = useMemo(() => Math.max(0, (page - 1) * pageSize), [page, pageSize])
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const firstRow = total === 0 ? 0 : offset + 1
  const lastRow = Math.min(offset + pageSize, total)
  const activeAssignment = assignments[activeAssignmentIndex] || { ...DEFAULT_ASSIGNMENT }

  const updateAssignmentAtIndex = useCallback((index, updater) => {
    setAssignments((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const nextValue = typeof updater === 'function' ? updater(item) : updater
      return { ...item, ...nextValue }
    }))
  }, [])

  const addAssignmentCard = useCallback(() => {
    setAssignments((prev) => [...prev, { ...DEFAULT_ASSIGNMENT }])
    setActiveAssignmentIndex((prev) => prev + 1)
  }, [])

  const removeAssignmentCard = useCallback((index) => {
    setAssignments((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, itemIndex) => itemIndex !== index)
      return next.length > 0 ? next : [{ ...DEFAULT_ASSIGNMENT }]
    })
    setActiveAssignmentIndex((prev) => Math.max(0, Math.min(prev, (assignments.length - 2))))
  }, [assignments.length])

  const loadMembers = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        search: appliedSearch || undefined,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        offset,
        limit: pageSize,
      }
      const response = await recruiterAPI.getVerificationTeamMembers(params)
      const payload = response.data?.data || response.data || {}
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload) ? payload : []
      const count = payload.total || payload.count || payload.meta?.total || items.length
      setMembers(items)
      setTotal(typeof count === 'number' ? count : Number(count) || items.length)
    } catch (err) {
      console.error('Failed to load verification team members', err)
      setMembers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, appliedFrom, appliedTo, offset, pageSize])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowCandidateSuggestions(false)
      }
    }

    if (showCandidateSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCandidateSuggestions])

  const handleApplyFilters = () => {
    setAppliedSearch(search.trim())
    setAppliedFrom(from)
    setAppliedTo(to)
    setPage(1)
  }

  const resetModalState = () => {
    setEditMember(null)
    setActiveStep(1)
    setForm({ ...defaultVerifierForm })
    setOriginalPhone('')
    setOtpSent(false)
    setOtp('')
    setOtpVerified(false)
    setOtpMessage('')
    setCandidateSuggestions([])
    setCandidateLoading(false)
    setShowCandidateSuggestions(false)
    setModalLoading(false)
    setAssignments([{ ...DEFAULT_ASSIGNMENT }])
    setActiveAssignmentIndex(0)
  }

  const openAddModal = () => {
    resetModalState()
    setShowModal(true)
  }

  const openEditModal = (member) => {
    resetModalState()
    setEditMember(member)
    setOriginalPhone(member.phone || member.mobile || '')
    setForm({
      name: member.name || '',
      phone: member.phone || member.mobile || '',
      registrationId: member.registration_id || member.registrationId || member.candidate_id || member.candidateId || '',
      email: member.email || ''
    })

    const memberAssignments = Array.isArray(member.project_locations) && member.project_locations.length > 0
      ? member.project_locations.map((item) => {
          const rawCount = item?.recipientCount ?? item?.recipient_count ?? item?.count
          const count = Number.isFinite(rawCount) ? rawCount : Number(rawCount)

          return {
            ...DEFAULT_ASSIGNMENT,
            titleId: item?.title_id || item?.titleId || item?.title || '',
            venue: item?.venue || item?.venue_name || item?.venueName || '',
            recipientCount: Number.isFinite(count) ? count : undefined,
          }
        })
      : [{
          ...DEFAULT_ASSIGNMENT,
          titleId: member?.title_id || member?.titleId || member?.title || '',

          venue: member?.venue || member?.venue_name || member?.venueName || '',
          recipientCount: Number.isFinite(member.recipientCount ?? member.recipient_count ?? member.count)
            ? Number(member.recipientCount ?? member.recipient_count ?? member.count)
            : undefined,
        }]

    setAssignments(memberAssignments)
    setActiveAssignmentIndex(0)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    resetModalState()
  }

  const isAssignmentReadyFor = (item) => Boolean(item?.titleId && item?.venue)

  const normalizeSelectionOptions = (resp, fallbackLabelKey = 'title') => {
    const payload = resp?.data ?? resp
    const raw = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.records)
          ? payload.records
          : Array.isArray(payload)
            ? payload
            : []

    return raw
      .map((item) => {
        if (!item) return null
        if (typeof item === 'object') {
          const label = String(item[fallbackLabelKey] ?? item.title ?? item.name ?? item.label ?? item.venue ?? item.location ?? item.value ?? '')
          // For venue selections, use the venue name as the value; for titles, use the ID
          const value = fallbackLabelKey === 'venue'
            ? label
            : String(item.id ?? item.value ?? item.key ?? item.title_id ?? item.titleId ?? label)
          const countValue = item.count ?? item.recipientCount ?? item.total ?? item.available_count
          const count = Number(countValue)
          return value ? { value, label, count: Number.isFinite(count) ? count : undefined } : null
        }
        const value = String(item || '')
        return value ? { value, label: value, count: undefined } : null
      })
      .filter(Boolean)
  }

  const fetchTitleOptions = useCallback(async () => {
    try {
      const res = await recruiterAPI.getVerificationTeamDatabaseRecordsWithTimer()
      setTitleOptions(normalizeSelectionOptions(res))
    } catch (err) {
      setTitleOptions([])
    }
  }, [])

  const fetchVenueOptionsForTitle = useCallback(async (titleId) => {
    if (!titleId) {
      setVenueOptionsByTitle((prev) => ({ ...prev, [titleId || '__empty__']: [] }))
      return
    }

    try {
      const res = await recruiterAPI.getVerificationTeamDatabaseVenueRecords(titleId)
      const list = normalizeSelectionOptions(res, 'venue')
      setVenueOptionsByTitle((prev) => ({ ...prev, [titleId]: list }))
    } catch (err) {
      setVenueOptionsByTitle((prev) => ({ ...prev, [titleId]: [] }))
    }
  }, [])

  const fetchRecipientCountForAssignment = useCallback(async (assignmentIndex, titleId, venueName) => {
    if (!titleId || !venueName) {
      updateAssignmentAtIndex(assignmentIndex, { recipientCount: undefined })
      return
    }

    try {
      const response = await recruiterAPI.getVerificationRecipientsCount({ title_id: titleId, venue: venueName })
      const payload = response.data?.data ?? response.data ?? response
      const rawCount = payload.count ?? payload.total ?? payload.recipientCount ?? payload.recipient_count
      const count = Number(rawCount)
      updateAssignmentAtIndex(assignmentIndex, {
        recipientCount: Number.isFinite(count) ? count : undefined,
      })
    } catch (err) {
      updateAssignmentAtIndex(assignmentIndex, { recipientCount: undefined })
    }
  }, [updateAssignmentAtIndex])

  const buildVerifierExportRows = useCallback(async (titleValue) => {
    if (!titleValue) return { rows: [], titleLabel: '' }

    const exportResponse = await recruiterAPI.getVerificationTeamMembers({
      search: appliedSearch || undefined,
      from: appliedFrom || undefined,
      to: appliedTo || undefined,
      offset: 0,
      limit: Math.max(total || 0, 1000),
    })
    const exportPayload = exportResponse.data?.data || exportResponse.data || {}
    const exportItems = Array.isArray(exportPayload.items)
      ? exportPayload.items
      : Array.isArray(exportPayload)
        ? exportPayload
        : []

    const matchedTitleOption = titleOptions.find((option) => String(option.value) === String(titleValue))
    const selectedTitleLabel = matchedTitleOption?.label || titleValue
    const rows = []

    for (const member of exportItems) {
      const registrationId = member?.registration_id || member?.registrationId || member?.candidate_id || member?.candidateId
      if (!registrationId) continue

      try {
        const response = await recruiterAPI.getVerifierProjects(registrationId, { offset: 0, limit: 1000 })
        const payload = response.data?.data || response.data || {}
        const assignments = Array.isArray(payload.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : []

        const matchingAssignments = assignments.filter((assignment) => {
          const titleId = assignment?.title_id || assignment?.titleId || assignment?.id || ''
          const titleName = assignment?.title || assignment?.name || assignment?.title_name || assignment?.titleName || ''
          return String(titleId) === String(titleValue) || String(titleName).toLowerCase() === String(selectedTitleLabel).toLowerCase()
        })

        let venueNames = []
        try {
          const venueResponse = await recruiterAPI.getVerifierProjectVenues(registrationId, titleValue, { offset: 0, limit: 1000 })
          const venuePayload = venueResponse.data?.data || venueResponse.data || {}
          const venueItems = Array.isArray(venuePayload.items)
            ? venuePayload.items
            : Array.isArray(venuePayload)
              ? venuePayload
              : Array.isArray(venuePayload?.data)
                ? venuePayload.data
                : []

          venueNames = venueItems
            .map((venueItem) => {
              if (!venueItem) return ''
              if (typeof venueItem === 'string') return venueItem
              return String(venueItem.venue || venueItem.venue_name || venueItem.venueName || venueItem.name || venueItem.label || venueItem.title || '')
            })
            .filter(Boolean)
        } catch (venueErr) {
          console.error('Failed to fetch verifier project venues for export', venueErr)
        }

        if (matchingAssignments.length === 0 && venueNames.length === 0) continue

        const venues = venueNames.length > 0
          ? venueNames
          : matchingAssignments
            .map((assignment) => assignment?.venue || assignment?.location || assignment?.venue_name || assignment?.venueName || '')
            .filter(Boolean)
        const recipientCount = matchingAssignments.reduce((sum, assignment) => {
          const rawCount = assignment?.recipient_count ?? assignment?.recipientCount ?? assignment?.count ?? assignment?.totalRecipients ?? 0
          const parsedCount = Number(rawCount)
          return sum + (Number.isFinite(parsedCount) ? parsedCount : 0)
        }, 0)
        const calledCount = matchingAssignments.reduce((sum, assignment) => {
          const rawCount = assignment?.called_count ?? assignment?.calledCount ?? assignment?.called ?? 0
          const parsedCount = Number(rawCount)
          return sum + (Number.isFinite(parsedCount) ? parsedCount : 0)
        }, 0)
        const pendingCount = matchingAssignments.reduce((sum, assignment) => {
          const rawCount = assignment?.pending_count ?? assignment?.pendingCount ?? assignment?.pending ?? 0
          const parsedCount = Number(rawCount)
          return sum + (Number.isFinite(parsedCount) ? parsedCount : 0)
        }, 0)

        rows.push({
          verifierName: member?.name || '-',
          mobile: member?.phone || member?.mobile || '-',
          email: member?.email || '-',
          designation: member?.designation || member?.role || '-',
          title: selectedTitleLabel,
          venue: venues.join(', '),
          recipientCount,
          calledCount,
          pendingCount,
        })
      } catch (memberErr) {
        console.error('Failed to export verifier projects for member', member?.id, memberErr)
      }
    }

    return { rows, titleLabel: selectedTitleLabel }
  }, [appliedFrom, appliedSearch, appliedTo, titleOptions, total])

  const handlePreviewVerifierAssignments = useCallback(async () => {
    if (!selectedExportTitle) {
      await alert('Please select a title before previewing.')
      return
    }

    setExporting(true)
    try {
      const { rows, titleLabel } = await buildVerifierExportRows(selectedExportTitle)
      setExportPreviewRows(rows)
      setExportPreviewTitleLabel(titleLabel)
      if (rows.length === 0) {
        await alert('No verifiers were found with this title assignment.')
      }
    } catch (err) {
      console.error('Failed to prepare verifier title assignment preview', err)
      await alert(err?.response?.data?.message || err?.message || 'Preview failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [alert, buildVerifierExportRows, selectedExportTitle])

  const handleDownloadVerifierAssignments = useCallback(async () => {
    if (!exportPreviewRows.length) {
      await alert('No preview data available to download.')
      return
    }

    try {
      const ws = XLSX.utils.json_to_sheet(exportPreviewRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Verifier Title Export')
      const safeTitleName = String(exportPreviewTitleLabel).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'title'
      XLSX.writeFile(wb, `verifier_title_${safeTitleName}_${new Date().toISOString().split('T')[0]}.xlsx`)
      setShowExportModal(false)
      setSelectedExportTitle('')
      setExportPreviewRows([])
      setExportPreviewTitleLabel('')
    } catch (err) {
      console.error('Failed to download verifier title assignments', err)
      await alert(err?.response?.data?.message || err?.message || 'Download failed. Please try again.')
    }
  }, [alert, exportPreviewRows, exportPreviewTitleLabel])

  useEffect(() => {
    if (showModal) {
      fetchTitleOptions()
    }
  }, [showModal, fetchTitleOptions])

  useEffect(() => {
    if (showExportModal) {
      fetchTitleOptions()
    }
  }, [showExportModal, fetchTitleOptions])

  useEffect(() => {
    if (showModal && activeAssignment?.titleId) {
      fetchVenueOptionsForTitle(activeAssignment.titleId)
    }
  }, [showModal, activeAssignment?.titleId, fetchVenueOptionsForTitle])

  const isOtpRequired = useMemo(() => {
    if (!editMember) return true
    return String(form.phone || '').trim() !== String(originalPhone || '').trim()
  }, [editMember, form.phone, originalPhone])

  const canAdvanceFromStep1 = useMemo(() => Boolean(form.registrationId), [form.registrationId])

  const phoneSelectionRequired = useMemo(() => {
    if (!editMember) return true
    return String(form.phone || '').trim() !== String(originalPhone || '').trim()
  }, [editMember, form.phone, originalPhone])

  const normalizeCandidateItems = (payload) => {
    const rawList = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.candidates)
            ? payload.candidates
            : Array.isArray(payload)
              ? payload
              : []

    return rawList
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const registrationId = String(item.registration_id ?? item.registrationId ?? item.id ?? item.candidate_id ?? item.candidateId ?? item._id ?? '')
        const mobile = String(item.mobile || item.phone || item.whatsapp || item.contact || item.phone_number || item.mobile_number || '').trim()
        const name = String(item.name || item.fullName || item.candidate_name || item.worker_name || item.username || '').trim()
        const email = String(item.email || item.emailId || item.email_address || '').trim()
        if (!registrationId || !mobile) return null
        return { registrationId, mobile, name, email }
      })
      .filter(Boolean)
  }

  const fetchCandidateSuggestions = useCallback(async (query) => {
    const trimmedQuery = String(query || '').trim()
    if (trimmedQuery.length < 3) {
      setCandidateSuggestions([])
      setShowCandidateSuggestions(false)
      return
    }

    setCandidateLoading(true)
    try {
      const response = await recruiterAPI.getCandidates({ search: trimmedQuery, mobile: trimmedQuery, limit: 10 })
      const payload = response.data?.data ?? response.data ?? {}
      setCandidateSuggestions(normalizeCandidateItems(payload))
      setShowCandidateSuggestions(true)
    } catch (err) {
      setCandidateSuggestions([])
      setShowCandidateSuggestions(true)
    } finally {
      setCandidateLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedPhone = String(form.phone || '').trim()
      if (!trimmedPhone || trimmedPhone.length < 3 || form.registrationId) {
        setCandidateSuggestions([])
        setShowCandidateSuggestions(false)
        return
      }
      fetchCandidateSuggestions(trimmedPhone)
    }, 300)

    return () => clearTimeout(timer)
  }, [form.phone, form.registrationId, fetchCandidateSuggestions])

  const handleMobileChange = (value) => {
    setForm((prev) => ({ ...prev, phone: value, registrationId: '', name: '', email: '' }))
    setOtpSent(false)
    setOtpVerified(false)
    setOtp('')
    setOtpMessage('')
    setShowCandidateSuggestions(true)
  }

  const handleCandidateSelect = (candidate) => {
    setForm((prev) => ({
      ...prev,
      phone: candidate.mobile,
      registrationId: candidate.registrationId,
      name: candidate.name || prev.name,
      email: candidate.email || prev.email,
    }))
    setCandidateSuggestions([])
    setShowCandidateSuggestions(false)
    setOtpSent(false)
    setOtpVerified(false)
    setOtp('')
    setOtpMessage('')
  }

  const handleSendOtp = async () => {
    if (!form.phone.trim()) {
      await alert('Enter a mobile number before sending OTP.')
      return
    }
    if (phoneSelectionRequired && !form.registrationId) {
      await alert('Select a registered mobile number from the suggestions before sending OTP.')
      return
    }
    setOtpLoading(true)
    setOtpMessage('')
    try {
      await recruiterAPI.sendMobileOTPforverifiers(form.phone.trim())
      setOtpSent(true)
      setOtpVerified(false)
      setOtp('')
      setOtpMessage('OTP sent to the provided mobile number.')
    } catch (err) {
      setOtpMessage(err?.response?.data?.message || err?.message || 'Unable to send OTP. Please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      await alert('Enter the OTP received on mobile.')
      return
    }
    setOtpLoading(true)
    try {
      await recruiterAPI.verifyMobileOTPforverifiers(form.phone.trim(), otp.trim())
      setOtpVerified(true)
      setOtpMessage('Mobile verified. You may now save the verifier.')
    } catch (err) {
      setOtpVerified(false)
      setOtpMessage(err?.response?.data?.message || err?.message || 'OTP verification failed.')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleSaveMember = async () => {
    if (!form.name.trim()) {
      await alert('Enter verifier name.')
      return
    }
    if (!form.phone.trim()) {
      await alert('Enter verifier mobile number.')
      return
    }
    if (phoneSelectionRequired && !form.registrationId) {
      await alert('Please select a registered mobile number from the suggestions before saving.')
      return
    }
    if (isOtpRequired && !otpVerified) {
      await alert('Please verify the mobile number with OTP before saving.')
      return
    }

    setModalLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        ...(form.registrationId ? { registration_id: form.registrationId } : {}),
      }

      const selectedAssignments = assignments.filter((item) => item?.titleId || item?.venue).map((item) => {
        const assignment = {}
        if (item.titleId) assignment.title_id = item.titleId
        if (item.venue) assignment.venue = item.venue
        if (item.recipientCount !== undefined && item.recipientCount !== null && item.recipientCount !== '') {
          assignment.count = Number(item.recipientCount)
        }
        return assignment
      })

      if (selectedAssignments.length > 0) {
        payload.project_locations = selectedAssignments
      }

      if (editMember && editMember.id) {
        await recruiterAPI.updateVerificationTeamMember(editMember.id, payload)
      } else {
        await recruiterAPI.createVerificationTeamMember(payload)
      }

      setModalLoading(false)
      closeModal()
      await loadMembers()
    } catch (err) {
      setModalLoading(false)
      await alert(err?.response?.data?.message || err?.message || 'Save failed. Please try again.')
    }
  }

  const tableRows = members.map((member, index) => {
    const phone = member.phone || member.mobile || '-'
    const email = member.email || '-'
    const designation = member.designation || member.role || '-'
    const status = member.status || 'active'
    const createdAt = member.createdAt || member.created_at || member.joined_at || ''

    return (
      <tr key={member.id || `${phone}-${index}`}>
        <td>{offset + index + 1}</td>
        <td>{member.name || '-'}</td>
        <td>{phone}</td>
        <td>{email}</td>
        <td>{designation}</td>
        <td style={{ textTransform: 'capitalize' }}>{status}</td>
        <td>{formatDateTime(createdAt)}</td>
        <td>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { setSelectedVerifierForAssignments(member); setShowAssignmentsModal(true) }}
              style={{ padding: '4px 8px', fontSize: '11px', minWidth: 'fit-content' }}
            >
              Assignments
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openEditModal(member)}
              style={{ padding: '4px 8px', fontSize: '11px', minWidth: 'fit-content' }}
            >
              Edit
            </button>
          </div>
        </td>
      </tr>
    )
  })

  return (
    <div style={{ margin: '0 auto', padding: '24px' }}>
      <LoadingOverlay
        active={modalLoading || (!showModal && loading) || exporting}
        message={modalLoading ? 'Saving verifier...' : exporting ? 'Exporting verifier assignments...' : loading ? 'Loading verification team members...' : ''}
      />

      <PageHeader
        title="Verification Team List"
        subtitle="Search, filter and add verifiers with mobile OTP verification"
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={() => { setSelectedExportTitle(''); setShowExportModal(true); if (titleOptions.length === 0) fetchTitleOptions() }}>Export Excel</Button>
            <Button variant="primary" onClick={openAddModal}>Add verifier</Button>
          </div>
        }
      />

      <Card>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 120px', gap: '12px', alignItems: 'end', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Name, mobile or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">From</label>
              <input
                type="date"
                className="form-control"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">To</label>
              <input
                type="date"
                className="form-control"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="button" variant="primary" className="btn-block" onClick={handleApplyFilters}>Apply</Button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Designation</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
                      No verification team members found.
                    </td>
                  </tr>
                ) : tableRows}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ color: '#6b7280' }}>
              Showing {firstRow}–{lastRow} of {total}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select className="form-control" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
                <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                <span style={{ color: '#374151' }}>Page {page} / {totalPages}</span>
                <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={closeModal} title={editMember ? 'Edit Verifier' : 'Add Verifier'} maxWidth="560px" closeOnBackdropClick={false}>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (activeStep === 1) {
              if (!canAdvanceFromStep1) {
                await alert('Select a registered mobile number from the suggestions before continuing.')
                return
              }
              setActiveStep(2)
              return
            }
            if (activeStep === 3) {
              await handleSaveMember()
              return
            }
            setActiveStep((s) => Math.min(3, s + 1))
          }}
        >
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#6b7280' }}>
              <span style={{ fontWeight: 700, color: activeStep >= 1 ? '#111827' : '#9ca3af' }}>1. Mobile</span>
              <span>›</span>
              <span style={{ fontWeight: 700, color: activeStep >= 2 ? '#111827' : '#9ca3af' }}>2. Details</span>
              <span>›</span>
              <span style={{ fontWeight: 700, color: activeStep >= 3 ? '#111827' : '#9ca3af' }}>3. OTP</span>
            </div>

            {activeStep === 1 && (
              <>
                <FormField label="Mobile">
                  <div style={{ position: 'relative' }} ref={suggestionsRef}>
                    <input
                      className="form-control"
                      value={form.phone}
                      onChange={(e) => handleMobileChange(e.target.value)}
                      required
                      autoComplete="off"
                      placeholder="Type a registered mobile number"
                    />
                    {showCandidateSuggestions && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 2000,
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        marginTop: '4px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.08)'
                      }}>
                        {candidateLoading ? (
                          <div style={{ padding: '10px', color: '#6b7280' }}>Looking up registered mobile numbers…</div>
                        ) : candidateSuggestions.length > 0 ? (
                          candidateSuggestions.map((candidate) => (
                            <button
                              key={`${candidate.registrationId}-${candidate.mobile}`}
                              type="button"
                              className="btn btn-link"
                              onClick={() => handleCandidateSelect(candidate)}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 12px',
                                border: 'none',
                                background: 'transparent',
                                color: '#111827',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>{candidate.name || 'Registered candidate'}</div>
                              <div style={{ fontSize: 12, color: '#6b7280' }}>{candidate.mobile}{candidate.email ? ` • ${candidate.email}` : ''}</div>
                            </button>
                          ))
                        ) : (
                          <div style={{ padding: '10px', color: '#6b7280' }}>No registered mobile numbers found.</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: form.registrationId ? '#166534' : '#6b7280', marginTop: '6px' }}>
                    {form.registrationId
                      ? `✓ Registered mobile selected: ${form.phone}`
                      : 'Type a mobile number and select a registered suggestion.'}
                  </div>
                </FormField>
              </>
            )}

            {activeStep === 2 && (
              <>
                <FormField label="Name">
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Email">
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </FormField>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {assignments.map((assignmentItem, index) => (
                    <Card key={`assignment-${index}`} className="card-sub" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'grid', gap: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontWeight: 600 }}>Assignment {index + 1}</div>
                          {assignments.length > 1 && (
                            <Button type="button" variant="outline" onClick={() => removeAssignmentCard(index)}>Remove</Button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <FormField label="Title">
                            <select
                              className="form-control"
                              value={assignmentItem.titleId || ''}
                              onChange={async (e) => {
                                const value = e.target.value
                                setActiveAssignmentIndex(index)
                                updateAssignmentAtIndex(index, { titleId: value, venue: '', recipientCount: undefined })
                                await fetchVenueOptionsForTitle(value)
                              }}
                            >
                              <option value="">Select title</option>
                              {titleOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </FormField>
                                  <FormField label="Venue">
                            <select
                              className="form-control"
                              value={assignmentItem.venue || ''}
                              onChange={async (e) => {
                                const value = e.target.value
                                const selectedOption = (venueOptionsByTitle[assignmentItem.titleId] || []).find((opt) => opt.value === value)
                                const venueName = selectedOption?.label || value
                                setActiveAssignmentIndex(index)
                                updateAssignmentAtIndex(index, {
                                  venue: venueName,
                                  recipientCount: undefined,
                                })
                                await fetchRecipientCountForAssignment(index, assignmentItem.titleId, venueName)
                              }}
                              disabled={!assignmentItem.titleId}
                            >
                              <option value="">Select venue</option>
                              {(venueOptionsByTitle[assignmentItem.titleId] || []).map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </FormField>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <div style={{ color: '#475569' }}>
                            Available: <strong>{assignmentItem.recipientCount != null ? assignmentItem.recipientCount : '—'}</strong>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <Button type="button" variant="outline" onClick={addAssignmentCard}>Add more assignment</Button>
                </div>
              </>
            )}

            {activeStep === 3 && (
              <Card className="card-sub" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Mobile OTP verification</div>
                    <div style={{ color: '#6b7280' }}>
                      {otpVerified
                        ? 'Verified mobile will be used for this verifier.'
                        : 'Send OTP to the entered mobile number and verify before saving.'}
                    </div>
                  </div>
                  <Button type="button" variant="outline" onClick={handleSendOtp} disabled={otpLoading || !form.phone.trim()}>
                    {otpSent ? 'Resend OTP' : 'Send OTP'}
                  </Button>
                </div>
                {otpSent && (
                  <div style={{ marginTop: '12px', display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <FormField label="OTP Code">
                        <input
                          className="form-control"
                          value={otp}
                          maxLength={6}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        />
                      </FormField>
                      <Button type="button" variant="primary" onClick={handleVerifyOtp} disabled={otpLoading || otp.length < 4}>
                        Verify OTP
                      </Button>
                    </div>
                    {otpMessage && (
                      <div style={{ color: otpVerified ? '#166534' : '#b45309' }}>{otpMessage}</div>
                    )}
                  </div>
                )}
              </Card>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '8px' }}>
              <div>
                {activeStep > 1 && (
                  <Button type="button" variant="outline" onClick={() => setActiveStep((s) => Math.max(1, s - 1))}>Back</Button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button type="button" variant="outline" onClick={closeModal}>Cancel</Button>
                {activeStep < 3 ? (
                  <Button type="submit" variant="primary" disabled={activeStep === 1 && !canAdvanceFromStep1}>Next</Button>
                ) : (
                  <Button type="submit" variant="primary">{editMember ? 'Save changes' : 'Add verifier'}</Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false)
          setSelectedExportTitle('')
          setExportPreviewRows([])
          setExportPreviewTitleLabel('')
        }}
        title={exportPreviewRows.length > 0 ? 'Preview verifier title assignments' : 'Export verifier title assignments'}
        maxWidth="640px"
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          {exportPreviewRows.length > 0 ? (
            <>
              <div style={{ color: '#475569' }}>
                Review the prepared verifier assignment rows for <strong>{exportPreviewTitleLabel || selectedExportTitle}</strong> before downloading.
              </div>
              <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Verifier</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Mobile</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Venue</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Recipients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportPreviewRows.map((row, index) => (
                      <tr key={`${row.verifierName}-${index}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '8px' }}>{row.verifierName}</td>
                        <td style={{ padding: '8px' }}>{row.mobile}</td>
                        <td style={{ padding: '8px' }}>{row.venue}</td>
                        <td style={{ padding: '8px' }}>{row.recipientCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button type="button" variant="outline" onClick={() => {
                  setShowExportModal(false)
                  setSelectedExportTitle('')
                  setExportPreviewRows([])
                  setExportPreviewTitleLabel('')
                }}>Cancel</Button>
                <Button type="button" variant="primary" onClick={handleDownloadVerifierAssignments} disabled={exporting}>Download Excel</Button>
              </div>
            </>
          ) : (
            <>
              <FormField label="Select title">
                <select
                  className="form-control"
                  value={selectedExportTitle}
                  onChange={(e) => setSelectedExportTitle(e.target.value)}
                >
                  <option value="">Select title</option>
                  {titleOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FormField>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button type="button" variant="outline" onClick={() => {
                  setShowExportModal(false)
                  setSelectedExportTitle('')
                  setExportPreviewRows([])
                  setExportPreviewTitleLabel('')
                }}>Cancel</Button>
                <Button type="button" variant="primary" onClick={handlePreviewVerifierAssignments} disabled={exporting || !selectedExportTitle}>Preview</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <VerifierAssignmentsModal 
        isOpen={showAssignmentsModal} 
        onClose={() => setShowAssignmentsModal(false)} 
        verifier={selectedVerifierForAssignments}
      />

    </div>
  )
}
