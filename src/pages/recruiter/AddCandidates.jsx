import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarAlt, faCheckCircle, faExclamationTriangle, faFileExcel, faIdCard, faMobileAlt, faSearch, faTimesCircle, faUpload, faUser, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { Card, Modal, PageHeader } from '../../components/ui'
import { ImageModal } from '../../components/ui/ImageModal'
import { recruiterAPI } from '../../api/axios'
import { encryptFaceEnrollUserId, encryptRegistrationId } from '../../utils/faceEnrollLinkCrypto'
import CandidateAttendanceCalendar from './CandidateAttendanceCalendar'
import CandidateTravelTicketsModal from './CandidateTravelTicketsModal'
import QuickAttendanceModal from './QuickAttendanceModal'
import './AddCandidates.css'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const normalizeBulkHeader = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '')

const getBulkValue = (row, aliases) => {
  for (const alias of aliases) {
    const value = row[normalizeBulkHeader(alias)]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

const normalizeBulkDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }

  return String(value ?? '').trim()
}

const mapBulkCandidateRow = (sourceRow, rowNumber) => {
  const row = Object.fromEntries(Object.entries(sourceRow).map(([key, value]) => [normalizeBulkHeader(key), value]))
  const mobile = getBulkValue(row, ['mobile', 'mobile_number', 'candidate_mobile', 'candidate mobile', 'phone', 'contact'])
  const aadhaar = getBulkValue(row, ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_number', 'aadhaar number'])
  const bloodGroup = String(getBulkValue(row, ['blood_group', 'blood group', 'blood']) || '').trim()
  const motherName = String(getBulkValue(row, ['mother_name', 'mother name', 'mothers_name']) || '').trim()
  const panNumber = String(getBulkValue(row, ['pan_number', 'pan number', 'pan']) || '').trim().toUpperCase()
  const dateOfJoining = normalizeBulkDate(getBulkValue(row, ['date_of_joining', 'date of joining', 'joining_date', 'joining date']))
  const emergencyContactNumber = String(getBulkValue(row, ['emergency_contact_number', 'emergency contact number', 'emergency_contact', 'emergency phone']) || '').trim()
  return {
    rowNumber,
    payload: {
      ...(mobile ? { mobile: String(mobile).trim() } : {}),
      ...(aadhaar ? { aadhaar: String(aadhaar).trim() } : {}),
      blood_group: bloodGroup,
      mother_name: motherName,
      pan_number: panNumber,
      date_of_joining: dateOfJoining,
      emergency_contact_number: emergencyContactNumber,
    },
    missingFields: [
      !mobile && 'Mobile Number',
      !aadhaar && 'Aadhaar Number',
      !bloodGroup && 'Blood Group',
      !motherName && "Mother's Name",
      !dateOfJoining && 'Date of Joining',
      !emergencyContactNumber && 'Emergency Contact Number',
    ].filter(Boolean),
    valid: Boolean(mobile && aadhaar && bloodGroup && motherName && dateOfJoining && emergencyContactNumber),
  }
}

const getCandidateRecord = (payload) => {
  const topLevel = payload?.data ?? payload
  if (topLevel && !Array.isArray(topLevel) && (topLevel.id || topLevel.candidateId || topLevel.name || topLevel.email || topLevel.profileImage)) {
    return topLevel
  }
  const items = Array.isArray(topLevel?.items)
    ? topLevel.items
    : Array.isArray(topLevel?.data)
      ? topLevel.data
      : Array.isArray(topLevel)
        ? topLevel
        : []

  return topLevel?.item || topLevel?.candidate || topLevel?.result || items[0] || null
}

const getValue = (candidate, keys, fallback = '') => {
  for (const key of keys) {
    if (candidate?.[key] !== undefined && candidate?.[key] !== null && candidate?.[key] !== '') return candidate[key]
  }
  return fallback
}

const getPhoto = (candidate) => getValue(candidate, [
  'profileImage', 'profileimage', 'profile_image', 'candidate_image', 'candidate_photo', 'photo', 'image', 'image_url'
])

const getFaceImage = (candidate, side) => getValue(candidate, [
  `${side}_image_url`, `${side}ImageUrl`, `${side}_image`, `${side}Image`
])

const isRegistered = (candidate) => {
  const value = String(getValue(candidate, ['is_registered', 'registered', 'registration_status', 'registrationStatus'], '')).trim().toLowerCase()
  return ['true', '1', 'yes', 'registered', 'active', 'complete', 'verified'].includes(value)
}

const isFaceVerified = (candidate) => {
  const value = getValue(candidate, ['face_verified', 'faceVerified'], false)
  return value === true || ['true', '1', 'yes', 'verified', 'active'].includes(String(value).trim().toLowerCase())
}

export default function AddCandidates() {
  const navigate = useNavigate()
  const [mobile, setMobile] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [bloodGroup, setBloodGroup] = useState('')
  const [motherName, setMotherName] = useState('')
  const [panNumber, setPanNumber] = useState('')
  const [dateOfJoining, setDateOfJoining] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [savedCandidates, setSavedCandidates] = useState([])
  const [savedTotal, setSavedTotal] = useState(0)
  const [savedLoading, setSavedLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [tableName, setTableName] = useState('')
  const [tableMobile, setTableMobile] = useState('')
  const [tableAadhaar, setTableAadhaar] = useState('')
  const [tableFilters, setTableFilters] = useState({ name: '', mobile: '', aadhaar: '' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [imagePreview, setImagePreview] = useState({ isOpen: false, src: '', title: '', alt: '' })
  const [bulkRows, setBulkRows] = useState([])
  const [bulkFileName, setBulkFileName] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkResultModalOpen, setBulkResultModalOpen] = useState(false)
  const [quickAttendanceOpen, setQuickAttendanceOpen] = useState(false)
  const [attendanceCandidate, setAttendanceCandidate] = useState(null)
  const [travelTicketCandidate, setTravelTicketCandidate] = useState(null)

  const fetchSavedCandidates = useCallback(async () => {
    setSavedLoading(true)
    try {
      const response = await recruiterAPI.getCandidateJoiningDetails({
        offset: (page - 1) * limit,
        limit,
        name: tableFilters.name || undefined,
        mobile: tableFilters.mobile || undefined,
        aadhaar: tableFilters.aadhaar || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      const data = response?.data?.data || response?.data || {}
      const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
      setSavedCandidates(items)
      setSavedTotal(Number(data.total ?? data.totalCount ?? items.length) || 0)
    } catch (err) {
      console.error('Failed to load added candidates:', err)
      setSavedCandidates([])
      setSavedTotal(0)
    } finally {
      setSavedLoading(false)
    }
  }, [page, limit, tableFilters, statusFilter])

  useEffect(() => {
    fetchSavedCandidates()
  }, [fetchSavedCandidates])

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(savedTotal / limit))
    if (page > lastPage) setPage(lastPage)
  }, [savedTotal, limit, page])

  const handleSearch = async (event) => {
    event.preventDefault()
    if (!mobile.trim() && !aadhaar.trim()) {
      setError('Enter a mobile number or Aadhaar number to search.')
      setCandidate(null)
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    setDateOfJoining('')
    setMotherName('')
    setPanNumber('')
    try {
      const response = await recruiterAPI.getRegistrationKycStatus({
        mobile: mobile.trim() || undefined,
        aadhaar: aadhaar.trim() || undefined,
      })
      const record = getCandidateRecord(response?.data ?? {})
      if (!record) {
        setCandidate(null)
        setError('No candidate found for the provided details.')
        return
      }
        let candidateDetails = record
        const candidateId = getValue(record, ['candidate_id', 'candidateId', 'id', '_id'])
        if (candidateId) {
          try {
            const detailsResponse = await recruiterAPI.getCandidateById(candidateId, { silent: true })
            const details = getCandidateRecord(detailsResponse?.data ?? {})
            if (details) candidateDetails = { ...record, ...details }
          } catch (detailsError) {
            console.warn('Unable to load full candidate details:', detailsError)
          }
        }
        setCandidate(candidateDetails)
        setBloodGroup(getValue(candidateDetails, ['blood_group', 'bloodGroup']))
        setMotherName(getValue(candidateDetails, ['mother_name', 'motherName', 'mothers_name', 'mothersName']))
        setPanNumber(getValue(candidateDetails, ['pan_number', 'panNumber', 'pan', 'PAN']))
        setEmergencyContact(getValue(candidateDetails, ['emergency_contact_number', 'emergencyContactNumber', 'emergency_contact', 'emergencyContact']))
    } catch (err) {
      console.error('Failed to search candidate:', err)
      setCandidate(null)
      setError('Unable to load candidate details right now.')
    } finally {
      setLoading(false)
    }
  }

  const createAttendanceLink = () => {
    return `${window.location.origin}${window.location.pathname}#/attendance/core-attendance`
  }

  const handleCopyAttendanceLink = async () => {
    const baseUrl = createAttendanceLink()

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(baseUrl)
      } else {
        window.prompt('Copy this attendance link:', baseUrl)
      }

      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { icon: '✅', message: 'Attendance link copied.', type: 'success' }
      }))
    } catch (err) {
      console.error('Unable to copy attendance link:', err)
      window.prompt('Copy this attendance link:', baseUrl)
    }
  }

  const handleCopyFaceEnrollLink = async (savedCandidate) => {
    const candidateId = getValue(savedCandidate, ['candidate_id', 'candidateId', 'id', '_id'])
    if (!candidateId) {
      setError('This candidate does not have an ID, so no enrollment link can be created.')
      return
    }

    let baseUrl
    try {
      const token = await encryptFaceEnrollUserId(candidateId)
      baseUrl = `${window.location.origin}${window.location.pathname}#/attendance/face-enroll?token=${encodeURIComponent(token)}`
    } catch (error) {
      console.error('Unable to encrypt face enrollment link:', error)
      setError('Unable to create an encrypted face enrollment link.')
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(baseUrl)
      } else {
        window.prompt('Copy this face enrollment link:', baseUrl)
      }

      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { icon: '✅', message: 'Face enrollment link copied.', type: 'success' }
      }))
    } catch (err) {
      console.error('Unable to copy enrollment link:', err)
      window.prompt('Copy this face enrollment link:', baseUrl)
    }
  }

  const handleCopyAttendanceRequestLink = async (savedCandidate) => {
    const registrationId = getValue(savedCandidate, ['registration_id', 'registrationId', 'candidate_id', 'candidateId', 'id', '_id'])
    if (!registrationId) {
      setError('This candidate does not have a registration ID, so no attendance request link can be created.')
      return
    }

    try {
      const token = await encryptRegistrationId(registrationId)
      const link = `${window.location.origin}${window.location.pathname}#/attendance/request?registration_id=${encodeURIComponent(token)}`
      await navigator.clipboard?.writeText(link)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { icon: '✅', message: 'Attendance request link copied.', type: 'success' }
      }))
    } catch (linkError) {
      console.error('Unable to create attendance request link:', linkError)
      setError('Unable to create an encrypted attendance request link.')
    }
  }

  const openAttendanceCalendar = (savedCandidate) => {
    setAttendanceCandidate({
      ...savedCandidate,
      registrationId: getValue(savedCandidate, ['registration_id', 'registrationId', 'candidate_id', 'candidateId', 'id', '_id']),
      name: getValue(savedCandidate, ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName'], 'Candidate'),
      mobile: getValue(savedCandidate, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], ''),
    })
  }

  const handleBulkFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBulkFileName(file.name)
    setBulkResult(null)
    setError('')

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const sourceRows = firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) : []
      const rows = sourceRows.map((row, index) => mapBulkCandidateRow(row, index + 2))
      setBulkRows(rows)

      if (rows.length === 0) {
        setError('The uploaded spreadsheet does not contain any data rows.')
      }
    } catch (parseError) {
      console.error('Unable to parse bulk candidate file:', parseError)
      setBulkRows([])
      setError('Unable to read the spreadsheet. Please upload an Excel or CSV file with a header row.')
    }
  }

  const downloadBulkTemplate = () => {
    const template = [
      {
        mobile: '9876543210',
        aadhaar: '234567890123',
        blood_group: 'O+',
        mother_name: 'Lakshmi Kumar',
        pan_number: 'ABCDE1234F',
        date_of_joining: '2026-10-01',
        emergency_contact_number: '9123456780',
      },
      {
        mobile: '8765432109',
        aadhaar: '345678901234',
        blood_group: 'B+',
        mother_name: 'Meena Ravi',
        pan_number: 'BCDEF2345G',
        date_of_joining: '2026-10-15',
        emergency_contact_number: '9012345678',
      },
      {
        mobile: '7654321098',
        aadhaar: '456789012345',
        blood_group: 'A+',
        mother_name: 'Sujatha Prasad',
        pan_number: 'CDEFG3456H',
        date_of_joining: '2026-11-01',
        emergency_contact_number: '8899776655',
      },
    ]
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(template)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates')
    XLSX.writeFile(workbook, 'candidate_joining_details_template.xlsx')
  }

  const handleBulkUpload = async () => {
    const validRows = bulkRows.filter((row) => row.valid)
    const invalidRows = bulkRows.filter((row) => !row.valid)

    if (validRows.length === 0) {
      setError('No valid rows found. Each row must include all required fields.')
      return
    }

    setBulkLoading(true)
    setError('')
    setBulkResult(null)
    const totalRows = validRows.length
    let processedRows = 0
    const showBulkProgress = (icon, message, duration = 0) => {
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { icon, message, type: 'info', duration },
      }))
    }
    showBulkProgress('⏳', `Processing 0/${totalRows} valid rows...`)
    const results = {
      success: [],
      notRegistered: [],
      failed: [],
      skipped: invalidRows.map((row) => ({
        rowNumber: row.rowNumber,
        mobile: row.payload.mobile,
        reason: `Missing: ${row.missingFields.join(', ')}`,
      })),
    }

    for (const row of validRows) {
      try {
        const lookupResponse = await recruiterAPI.getRegistrationKycStatus({
          mobile: row.payload.mobile || undefined,
          aadhaar: row.payload.aadhaar || undefined,
        })
        const candidateRecord = getCandidateRecord(lookupResponse?.data ?? {})
        const candidateId = getValue(candidateRecord, ['candidate_id', 'candidateId', 'id', '_id'])

        if (!candidateRecord || !candidateId) {
          results.notRegistered.push({
            rowNumber: row.rowNumber,
            mobile: row.payload.mobile,
            aadhaar: row.payload.aadhaar,
            reason: 'No registered candidate matched this mobile number and Aadhaar number.',
          })
            processedRows += 1
            showBulkProgress('⚠️', `Not registered ${processedRows}/${totalRows}: ${row.payload.mobile || 'Mobile not provided'}`)
          continue
        }

        const resolvedMobile = getValue(candidateRecord, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], row.payload.mobile)
        const resolvedAadhaar = getValue(candidateRecord, ['aadhaar', 'aadhaar_number', 'aadhar_number'], row.payload.aadhaar)
        await recruiterAPI.saveCandidateJoiningDetails({
          ...row.payload,
          candidate_id: candidateId,
          mobile: resolvedMobile,
          aadhaar: resolvedAadhaar,
        })
        results.success.push({
          rowNumber: row.rowNumber,
          mobile: row.payload.mobile,
        })
        processedRows += 1
        showBulkProgress('✅', `Inserted ${processedRows}/${totalRows}: ${row.payload.mobile || 'Mobile not provided'}`)
      } catch (uploadError) {
        console.error(`Failed to resolve or save bulk candidate row ${row.rowNumber}:`, uploadError)
        results.failed.push({
          rowNumber: row.rowNumber,
          mobile: row.payload.mobile,
          reason: uploadError.response?.data?.message || uploadError.message || 'Lookup or save failed',
        })
        processedRows += 1
        showBulkProgress('❌', `Failed ${processedRows}/${totalRows}: ${row.payload.mobile || 'Mobile not provided'}`, 0)
      }
    }

    setBulkResult(results)
    setBulkLoading(false)
    setBulkResultModalOpen(true)
    showBulkProgress('✅', `Bulk upload complete: ${results.success.length} inserted, ${results.notRegistered.length} not registered, ${results.failed.length} failed, ${results.skipped.length} skipped.`, 4000)
    setPage(1)
    await fetchSavedCandidates()
  }

  const handleTableSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setTableFilters({
      name: tableName.trim(),
      mobile: tableMobile.trim(),
      aadhaar: tableAadhaar.trim(),
    })
  }

  const handleClearTableSearch = () => {
    setTableName('')
    setTableMobile('')
    setTableAadhaar('')
    setTableFilters({ name: '', mobile: '', aadhaar: '' })
    setStatusFilter('all')
    setPage(1)
  }

  const openImageModal = (src, title, alt) => {
    setImagePreview({ isOpen: true, src, title, alt })
  }

  const closeImageModal = () => {
    setImagePreview({ isOpen: false, src: '', title: '', alt: '' })
  }

  const handleSave = async (event) => {
    event.preventDefault()
      if (!candidate || !bloodGroup || !motherName || !dateOfJoining || !emergencyContact) {
        setError("Blood Group, Mother's Name, Date of Joining, and Emergency Contact Number are required.")
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        candidate_id: getValue(candidate, ['candidate_id', 'candidateId', 'id', '_id']),
        mobile: getValue(candidate, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], mobile),
        aadhaar: getValue(candidate, ['aadhaar', 'aadhaar_number', 'aadhar_number'], aadhaar),
        blood_group: bloodGroup,
        mother_name: motherName,
        pan_number: panNumber,
        date_of_joining: dateOfJoining,
        emergency_contact_number: emergencyContact,
      }
      await recruiterAPI.saveCandidateJoiningDetails(payload)
      setPage(1)
      if (page === 1) await fetchSavedCandidates()
      setMessage('Candidate joining details saved successfully.')
    } catch (err) {
      console.error('Failed to save joining details:', err)
      setError('Unable to save candidate details. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const name = getValue(candidate, ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName'], 'Candidate')
  const candidateMobile = getValue(candidate, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], '—')
  const candidateAadhaar = getValue(candidate, ['aadhaar', 'aadhaar_number', 'aadhar_number'], '—')
  const photo = getPhoto(candidate)
  const offset = (page - 1) * limit
  const totalPages = Math.max(1, Math.ceil(savedTotal / limit))
  const visibleSavedCandidates = savedCandidates

  return (
    <div className="recruiter-attendance-page add-candidates-page">
      <PageHeader
        title="Add Candidates"
        subtitle="Find a registered candidate and record their joining details."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setQuickAttendanceOpen(true)}>
              <FontAwesomeIcon icon={faCheckCircle} /> Quick attendance list
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleCopyAttendanceLink()}>
              Copy Attendance Link
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/app/recruiter/core-team-attendance')}>
              View Core Team Attendance
            </button>
          </div>
        }
      />

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <label>
              <span className="filter-label">Mobile Number</span>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faMobileAlt} className="filter-search-icon" />
                <input className="form-control" type="tel" inputMode="numeric" value={mobile} onChange={(event) => setMobile(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter mobile number" />
              </div>
            </label>
            <label>
              <span className="filter-label">Aadhaar Number</span>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faIdCard} className="filter-search-icon" />
                <input className="form-control" type="text" inputMode="numeric" value={aadhaar} onChange={(event) => setAadhaar(event.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="Enter Aadhaar number" />
              </div>
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifySelf: 'start' }}>
            <FontAwesomeIcon icon={faSearch} /> {loading ? 'Searching...' : 'Search Candidate'}
          </button>
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          {message && <div style={{ color: 'var(--green)', fontSize: 13 }}>{message}</div>}
        </form>
      </Card>

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Bulk upload joining details</h2>
            <p style={{ margin: '6px 0 0', color: 'var(--text3)', fontSize: 13 }}>
              Upload Excel or CSV. Each row must include every required field and is looked up by mobile and Aadhaar before being saved.
            </p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadBulkTemplate}>
            <FontAwesomeIcon icon={faFileExcel} /> Download template
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: bulkLoading ? 'not-allowed' : 'pointer' }}>
            <FontAwesomeIcon icon={faUpload} /> Choose Excel/CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleBulkFileChange}
              disabled={bulkLoading}
              style={{ display: 'none' }}
            />
          </label>
          {bulkFileName && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{bulkFileName}</span>}
          {bulkRows.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={handleBulkUpload} disabled={bulkLoading}>
              <FontAwesomeIcon icon={faUpload} /> {bulkLoading ? 'Uploading rows...' : `Upload ${bulkRows.filter((row) => row.valid).length} valid rows`}
            </button>
          )}
        </div>

        {bulkRows.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>
            Parsed {bulkRows.length} rows. {bulkRows.filter((row) => row.valid).length} ready to upload and {bulkRows.filter((row) => !row.valid).length} skipped because they are missing one or more required fields.
          </div>
        )}

        {bulkResult && (
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ color: 'var(--green)' }}>Successful rows: {bulkResult.success.length}</div>
            <div style={{ color: bulkResult.notRegistered.length ? 'var(--orange)' : 'var(--text3)' }}>
              Not registered: {bulkResult.notRegistered.length}
            </div>
            <div style={{ color: bulkResult.failed.length ? 'var(--red)' : 'var(--text3)' }}>Failed rows: {bulkResult.failed.length}</div>
            <div style={{ color: bulkResult.skipped.length ? 'var(--orange)' : 'var(--text3)' }}>Skipped rows: {bulkResult.skipped.length}</div>
          </div>
        )}
      </Card>

      {candidate && (
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            <div style={{ width: 140, height: 160, borderRadius: 12, overflow: 'hidden', background: 'var(--bg-light)', border: '1px solid var(--border-light)', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>
              {photo ? (
                <button
                  type="button"
                  onClick={() => openImageModal(photo, `${name} profile`, `${name} profile preview`)}
                  style={{ width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}
                >
                  <img src={photo} alt={`${name} profile`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ) : <FontAwesomeIcon icon={faUser} size="2x" />}
            </div>
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{name}</h2>
                <span style={{ padding: '5px 10px', borderRadius: 999, background: isRegistered(candidate) ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.16)', color: isRegistered(candidate) ? 'var(--green)' : 'var(--orange)', fontSize: 12, fontWeight: 700 }}>
                  {isRegistered(candidate) ? 'Registered' : 'Not Registered'}
                </span>
              </div>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 20 }}>
                <div><div className="filter-label">Mobile Number</div><strong>{candidateMobile}</strong></div>
                <div><div className="filter-label">Aadhaar Number</div><strong>{candidateAadhaar}</strong></div>
                <div><div className="filter-label">Email</div><strong>{getValue(candidate, ['email', 'email_id'], '—')}</strong></div>
                <div><div className="filter-label">Location</div><strong>{getValue(candidate, ['location', 'city', 'area'], '—')}</strong></div>
              </div>
              <form onSubmit={handleSave} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
                <label><span className="filter-label">Blood Group</span><select className="form-control" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} required><option value="">Select blood group</option>{BLOOD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
                <label><span className="filter-label">Mother's Name</span><input className="form-control" type="text" value={motherName} onChange={(event) => setMotherName(event.target.value)} placeholder="Enter mother's name" required /></label>
                <label><span className="filter-label">PAN Number</span><input className="form-control" type="text" value={panNumber} onChange={(event) => setPanNumber(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} placeholder="Enter PAN number (optional)" /></label>
                <label><span className="filter-label">Date of Joining</span><input className="form-control" type="date" value={dateOfJoining} onChange={(event) => setDateOfJoining(event.target.value)} required /></label>
                <label><span className="filter-label">Emergency Contact Number</span><input className="form-control" type="tel" inputMode="numeric" value={emergencyContact} onChange={(event) => setEmergencyContact(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter emergency contact" required /></label>
                <button className="btn btn-primary" type="submit" disabled={saving}><FontAwesomeIcon icon={faUserPlus} /> {saving ? 'Saving...' : 'Save Details'}</button>
              </form>
            </div>
          </div>
        </Card>
      )}

      <Card style={{ padding: 20, marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Added Candidates</h2>
          </div>
        </div>

        <form onSubmit={handleTableSearch} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', alignItems: 'end', marginBottom: 18 }}>
          <label>
            <span className="filter-label">Name</span>
            <input className="form-control" type="text" value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="Search by name" />
          </label>
          <label>
            <span className="filter-label">Mobile Number</span>
            <input className="form-control" type="tel" inputMode="numeric" value={tableMobile} onChange={(event) => setTableMobile(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Search by mobile" />
          </label>
          <label>
            <span className="filter-label">Aadhaar Number</span>
            <input className="form-control" type="text" inputMode="numeric" value={tableAadhaar} onChange={(event) => setTableAadhaar(event.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="Search by Aadhaar" />
          </label>
          <label>
            <span className="filter-label">Status</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All</option>
              <option value="verified">Verified</option>
              <option value="not_verified">Not Verified</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={savedLoading}>
              <FontAwesomeIcon icon={faSearch} /> Search
            </button>
            <button className="btn btn-outline" type="button" onClick={handleClearTableSearch} disabled={savedLoading}>
              Clear
            </button>
          </div>
        </form>

        <div className="add-candidates-table-wrap">
          <table className="add-candidates-table">
            <colgroup>{Array.from({ length: 15 }, (_, index) => <col key={index} />)}</colgroup>
            <thead>
              <tr>
                {['#', 'Profile & Face Images', 'Name', 'Mobile', 'Email', 'Location', "Mother's Name", 'PAN Number', 'Blood Group', 'Date of Joining', 'Emergency Contact', 'Face Verified', 'Face Enroll', 'Request Link', 'Travel Tickets'].map((heading) => (
                  <th key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {savedLoading ? (
                <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>Loading added candidates...</td></tr>
              ) : visibleSavedCandidates.length === 0 ? (
                <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>No candidates added yet.</td></tr>
              ) : visibleSavedCandidates.map((savedCandidate, index) => {
                const savedPhoto = getPhoto(savedCandidate)
                const faceImages = ['front', 'left', 'right'].map((side) => getFaceImage(savedCandidate, side))
                const faceVerified = isFaceVerified(savedCandidate)
                return (
                  <tr key={`${getValue(savedCandidate, ['candidate_id', 'candidateId', 'id', '_id'], 'candidate')}-${index}`}>
                    <td style={{ padding: '10px 8px' }}>{offset + index + 1}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {savedPhoto ? (
                          <button type="button" onClick={() => openImageModal(savedPhoto, `${getValue(savedCandidate, ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName'], 'Candidate')} profile`, 'Candidate profile preview')} style={{ padding: 0, border: 0, borderRadius: '50%', overflow: 'hidden', background: 'transparent', cursor: 'pointer' }}>
                            <img src={savedPhoto} alt="Candidate profile" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border-light)', display: 'block' }} />
                          </button>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-light)', color: 'var(--text3)', fontSize: 10 }}>N/A</span>
                        )}
                        {['front', 'left', 'right'].map((side, imageIndex) => {
                          const imageUrl = faceImages[imageIndex]
                          return (
                            <button
                              key={side}
                              type="button"
                              onClick={() => imageUrl && openImageModal(imageUrl, `${side.charAt(0).toUpperCase() + side.slice(1)} face`, `${side} face preview`)}
                              style={{
                                padding: 0,
                                border: imageUrl ? '1px solid var(--border-light)' : '1px dashed var(--border-light)',
                                borderRadius: 8,
                                background: 'transparent',
                                cursor: imageUrl ? 'pointer' : 'default',
                                opacity: imageUrl ? 1 : 0.7,
                                overflow: 'hidden',
                              }}
                            >
                              {imageUrl ? (
                                <img src={imageUrl} alt={`${side} face preview`} style={{ width: 34, height: 34, objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, color: 'var(--text3)', fontSize: 10 }}>{side.slice(0, 1).toUpperCase()}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <span>{getValue(savedCandidate, ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName'], '—')}</span>
                        <button
                          type="button"
                          onClick={() => openAttendanceCalendar(savedCandidate)}
                          disabled={!getValue(savedCandidate, ['registration_id', 'registrationId', 'candidate_id', 'candidateId', 'id', '_id'])}
                          title={getValue(savedCandidate, ['registration_id', 'registrationId', 'candidate_id', 'candidateId', 'id', '_id']) ? 'Open attendance calendar' : 'Registration ID unavailable'}
                          aria-label={`Open attendance calendar for ${getValue(savedCandidate, ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName'], 'candidate')}`}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flex: '0 0 28px', border: '1px solid var(--border-light)', borderRadius: 4, background: 'var(--card)', color: 'var(--teal)', cursor: 'pointer' }}
                        >
                          <FontAwesomeIcon icon={faCalendarAlt} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['email', 'email_id'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['location', 'city', 'area'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['mother_name', 'motherName', 'mothers_name', 'mothersName'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['pan_number', 'panNumber', 'pan', 'PAN'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['blood_group', 'bloodGroup'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['date_of_joining', 'dateOfJoining', 'joining_date'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>{getValue(savedCandidate, ['emergency_contact_number', 'emergencyContactNumber', 'emergency_contact', 'emergencyContact'], '—')}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: faceVerified ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.16)', color: faceVerified ? 'var(--green)' : 'var(--orange)', fontSize: 12, fontWeight: 700 }}>
                        {faceVerified ? 'Verified' : 'Not verified'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleCopyFaceEnrollLink(savedCandidate)}
                        style={{ minWidth: 108, justifyContent: 'center' }}
                      >
                        Copy link
                      </button>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => handleCopyAttendanceRequestLink(savedCandidate)} style={{ minWidth: 108, justifyContent: 'center' }}>
                        Copy link
                      </button>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setTravelTicketCandidate(savedCandidate)}
                        disabled={!getValue(savedCandidate, ['candidate_id', 'candidateId', 'id', '_id'])}
                        title={getValue(savedCandidate, ['candidate_id', 'candidateId', 'id', '_id']) ? 'View travel tickets' : 'Candidate ID unavailable'}
                        style={{ minWidth: 108, justifyContent: 'center' }}
                      >
                        View tickets
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--text3)' }}>
            <span>
              Showing {savedTotal === 0 ? 0 : offset + 1} - {Math.min(offset + savedCandidates.length, savedTotal)} of {savedTotal} records
            </span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
              <span>Show Entries</span>
              <select
                className="form-control"
                value={limit}
                onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }}
                style={{ width: 78, minWidth: 78, height: 34, padding: '4px 8px' }}
              >
                {[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-outline btn-sm" type="button" disabled={page <= 1 || savedLoading} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} style={{ minWidth: 84, justifyContent: 'center' }}>Previous</button>
            <span style={{ minWidth: 78, textAlign: 'center', fontSize: 12, color: 'var(--text2)' }}>Page {page} of {totalPages}</span>
            <button className="btn btn-outline btn-sm" type="button" disabled={page >= totalPages || savedLoading} onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))} style={{ minWidth: 70, justifyContent: 'center' }}>Next</button>
          </div>
        </div>
      </Card>

      <ImageModal
        isOpen={imagePreview.isOpen}
        onClose={closeImageModal}
        imageUrl={imagePreview.src}
        title={imagePreview.title}
        alt={imagePreview.alt}
      />

      <Modal
        isOpen={bulkResultModalOpen && Boolean(bulkResult)}
        onClose={() => setBulkResultModalOpen(false)}
        title="Bulk upload results"
        maxWidth="900px"
        footer={<button type="button" className="btn btn-primary" onClick={() => setBulkResultModalOpen(false)}>Close</button>}
      >
        {bulkResult && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {[
                ['Inserted', bulkResult.success.length, 'var(--green)', faCheckCircle],
                ['Not registered', bulkResult.notRegistered.length, 'var(--orange)', faExclamationTriangle],
                ['Failed', bulkResult.failed.length, 'var(--red)', faTimesCircle],
                ['Missing data', bulkResult.skipped.length, 'var(--orange)', faExclamationTriangle],
              ].map(([label, count, color, icon]) => (
                <div key={label} style={{ border: '1px solid var(--border-light)', borderRadius: 10, padding: 12 }}>
                  <div style={{ color, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><FontAwesomeIcon icon={icon} /> {label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{count}</div>
                </div>
              ))}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '10px 8px' }}>Excel row</th>
                    <th style={{ padding: '10px 8px' }}>Mobile from Excel</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...bulkResult.success.map((item) => ({ ...item, status: 'Inserted', color: 'var(--green)', reason: 'Joining details saved.' })),
                    ...bulkResult.notRegistered.map((item) => ({ ...item, status: 'Not registered', color: 'var(--orange)' })),
                    ...bulkResult.failed.map((item) => ({ ...item, status: 'Failed', color: 'var(--red)' })),
                    ...bulkResult.skipped.map((item) => ({ ...item, status: 'Skipped', color: 'var(--orange)' })),
                  ].map((item) => (
                    <tr key={`${item.rowNumber}-${item.status}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 8px' }}>{item.rowNumber}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{item.mobile || 'Mobile not provided in Excel'}</td>
                      <td style={{ padding: '10px 8px', color: item.color, fontWeight: 700 }}>{item.status}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text2)' }}>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
      <QuickAttendanceModal isOpen={quickAttendanceOpen} onClose={() => setQuickAttendanceOpen(false)} />
      <CandidateAttendanceCalendar isOpen={Boolean(attendanceCandidate)} candidate={attendanceCandidate} onClose={() => setAttendanceCandidate(null)} />
      <CandidateTravelTicketsModal candidate={travelTicketCandidate} onClose={() => setTravelTicketCandidate(null)} />
    </div>
  )
}