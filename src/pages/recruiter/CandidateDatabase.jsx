import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faUpload, faUserPlus, faEye, faImages, faCheckCircle, faCopy, faMagnifyingGlass, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Card, PageHeader, Tag, Modal } from '../../components/ui/index'
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
  const [isAadhaarModalOpen, setIsAadhaarModalOpen] = useState(false)
  const [selectedAadhaarCandidate, setSelectedAadhaarCandidate] = useState(null)
  const [selectedAadhaarDetails, setSelectedAadhaarDetails] = useState(null)
  const [selectedAadhaarIndex, setSelectedAadhaarIndex] = useState(-1)
  const [aadhaarModalLoading, setAadhaarModalLoading] = useState(false)
  const [aadhaarModalError, setAadhaarModalError] = useState('')
  const [sendAadhaarIdLoading, setSendAadhaarIdLoading] = useState(false)
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
                {['#', 'Date', 'Time', 'Name', 'Temp ID', 'Mobile', 'Whatsapp', 'Aadhaar', 'Location', 'Aadhaar Status', 'Actions'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 32 }}>
                    Loading candidates…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--red)' }}>
                    {error}
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 32 }}>
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
                    <span className="candidate-mobile-index">#{offset + index + 1}</span>
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
    </div>
  )
}

export default CandidateDatabase
