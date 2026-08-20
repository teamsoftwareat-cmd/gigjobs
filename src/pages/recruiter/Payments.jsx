import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileExcel, faInfoCircle, faDownload } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { PageHeader, Card } from '../../components/ui'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import './Payments.css'

const EXPORT_HEADERS = [
  'Name of Contact',
  'Payout Link Amount',
  'Contact Phone Number',
  'Registered Number',
  'Registered Aadhaar',
  'Attendance Aadhaar',
  'Contact Email ID',
  'Send Link to Phone Number',
  'Send Link to Mail ID',
  'Contact Type',
  'Payout Purpose',
  'Payout Description',
  'Reference ID(optional)',
  'Internal notes(optional): Title',
  'Internal notes(optional): Description',
]

const RESPONSE_PREVIEW_HEADERS = [...EXPORT_HEADERS]
const DEFAULT_EXPORT_FILE_NAME = 'payment_export'

const PAYMENT_SHEET_NAMES = new Set([
  'all_districts_centres',
  'all_locations',
])

const normalize = (value) => String(value || '').trim()
const normalizeHeader = (value) => String(value || '').trim().toLowerCase()
const extractNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value).replace(/,/g, '').trim()
  const match = text.match(/-?[0-9]+(?:\.[0-9]+)?/g)
  if (!match) return 0
  return Number(parseFloat(match[0]))
}

const findHeaderIndex = (row, patterns) => {
  const normalized = row.map(normalizeHeader)
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i')
    const index = normalized.findIndex((cell) => regex.test(cell))
    if (index >= 0) return index
  }
  return -1
}

const findAmountHeaderIndex = (headers) => {
  const normalized = headers.map(normalizeHeader)
  const preferred = ['amount to be paid', 'amount payable', 'amount paid', 'total payable', 'total amount']
  for (const pattern of preferred) {
    const index = normalized.findIndex((cell) => cell.includes(pattern))
    if (index >= 0) return index
  }

  const fallback = normalized
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => /amount|payable|total|payment/.test(cell))
    .filter(({ cell }) => !/per|rate|hour|ot|overtime|worked|days|date|allowance|total ot|total amount per/i.test(cell))
  if (fallback.length > 0) return fallback[fallback.length - 1].index
  return normalized.findIndex((cell) => /amount|payable|payment/.test(cell))
}

const findHeaderRowIndex = (matrix) => {
  const candidateKeywords = ['candidate name', 'candidate', 'name', 's.no', 'sno']
  const amountKeywords = ['amount to be paid', 'amount payable', 'total amount', 'amount', 'payment']

  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 8); rowIndex += 1) {
    const row = matrix[rowIndex] || []
    const lower = row.map(normalizeHeader)
    const hasCandidate = candidateKeywords.some((keyword) => lower.some((cell) => cell.includes(keyword)))
    const hasAmount = amountKeywords.some((keyword) => lower.some((cell) => cell.includes(keyword)))
    if (hasCandidate && hasAmount) {
      return rowIndex
    }
  }
  return -1
}

const isTotalsRow = (row, candidateIndex) => {
  const candidateValue = normalize(row[candidateIndex] || '')
  return /total|grand total|subtotal|net total|summary/i.test(candidateValue)
}

const parseWorkbookRecords = async (file) => {
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target.result)
    reader.onerror = (event) => reject(event.target.error)
    reader.readAsArrayBuffer(file)
  })

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetNames = workbook.SheetNames || []
  const candidateSheets = sheetNames.filter((name) => PAYMENT_SHEET_NAMES.has(String(name).trim().toLowerCase()))
  const records = []
  const seenKeys = new Set()

  for (const sheetName of candidateSheets) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true })
    if (!Array.isArray(matrix) || matrix.length === 0) continue

    const headerRowIndex = findHeaderRowIndex(matrix)
    if (headerRowIndex < 0) continue

    const headerRow = matrix[headerRowIndex].map(normalizeHeader)
    const candidateIndex = findHeaderIndex(headerRow, ['candidate name', 'candidate', 'name', 's\.no', 'sno'])
    const phoneIndex = findHeaderIndex(headerRow, ['mobile', 'phone', 'contact'])
    const emailIndex = findHeaderIndex(headerRow, ['email', 'contact email', 'email id'])
    const roleIndex = findHeaderIndex(headerRow, ['role', 'team'])
    const designationIndex = findHeaderIndex(headerRow, ['designation', 'position'])
    const locationIndex = findHeaderIndex(headerRow, ['location', 'site', 'area', 'place'])
    const districtIndex = findHeaderIndex(headerRow, ['district', 'region'])
    const centreIndex = findHeaderIndex(headerRow, ['centre', 'center'])
    const candidateIdIndex = findHeaderIndex(headerRow, ['candidate id', 'candidateid', 'candidate_id', 'id'])
    const amountIndex = findAmountHeaderIndex(headerRow)

    if (candidateIndex < 0 || amountIndex < 0) continue

    const dataRows = matrix.slice(headerRowIndex + 1)
    for (const row of dataRows) {
      if (!Array.isArray(row)) continue
      if (isTotalsRow(row, candidateIndex)) continue

      const candidateName = normalize(row[candidateIndex])
      if (!candidateName) continue

      const amount = extractNumber(row[amountIndex])
      if (amount === 0) continue

      const mobileRaw = row[phoneIndex]
      const emailRaw = row[emailIndex]
      const mobile = normalize(mobileRaw)
      const email = normalize(emailRaw)
      const candidateId = candidateIdIndex >= 0 ? normalize(row[candidateIdIndex]) : ''
      const key = [sheetName, candidateId, candidateName, mobile, email, amount].join('|')
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      records.push({
        sourceSheet: sheetName,
        name: candidateName,
        mobile,
        email,
        role: normalize(row[roleIndex]) || 'Consultant',
        designation: normalize(row[designationIndex]),
        location: normalize(row[locationIndex]),
        district: normalize(row[districtIndex]),
        centre: normalize(row[centreIndex]),
        candidateId,
        amount,
      })
    }
  }

  return records
}

const extractResponseRecords = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload?.data && Array.isArray(payload.data)) return payload.data
  if (payload?.records && Array.isArray(payload.records)) return payload.records
  return []
}

const normalizeExternalRecord = (record) => {
  if (!record || typeof record !== 'object') return null

  const normalizeRecordKey = (keys) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(record, key) && record[key] != null) {
        return record[key]
      }
    }
    return undefined
  }

  const name = normalize(normalizeRecordKey(['name', 'candidateName', 'candidate_name', 'contactName', 'Name of Contact', 'Candidate Name']))
  const amount = extractNumber(normalizeRecordKey(['amount', 'amountToBePaid', 'amount_to_be_paid', 'payoutLinkAmount', 'Payout Link Amount', 'Amount to be Paid']))
  const mobile = normalize(normalizeRecordKey(['mobile', 'phone', 'contact', 'contactPhoneNumber', 'Contact Phone Number']))
  const registeredName = normalize(normalizeRecordKey(['registeredName', 'registered_name', 'Registered Name', 'candidateName', 'name']))
  const registeredNumber = normalize(normalizeRecordKey(['registeredNumber', 'registered_mobile', 'Registered Number']))
  const registeredAadhaar = normalize(normalizeRecordKey(['registeredAadhaar', 'registered_aadhaar', 'Registered Aadhaar']))
  const attendanceAadhaar = normalize(normalizeRecordKey(['attendanceAadhaar', 'attendance_aadhaar', 'Attendance Aadhaar']))
  const email = normalize(normalizeRecordKey(['email', 'contactEmail', 'contactEmailID', 'Contact Email ID', 'Email']))
  const role = normalize(normalizeRecordKey(['role', 'team', 'contactType', 'Contact Type'])) || 'Consultant'
  const designation = normalize(normalizeRecordKey(['designation', 'position']))
  const location = normalize(normalizeRecordKey(['location', 'site', 'area', 'place', 'district', 'centre']))
  const district = normalize(normalizeRecordKey(['district', 'region']))
  const centre = normalize(normalizeRecordKey(['centre', 'center']))
  const candidateId = normalize(normalizeRecordKey(['candidateId', 'candidate_id', 'id', 'Candidate ID']))
  const payoutPurpose = normalize(normalizeRecordKey(['payoutPurpose', 'paymentPurpose', 'Payout Purpose']))
  const payoutDescription = normalize(normalizeRecordKey(['payoutDescription', 'description', 'Payout Description']))
  const referenceId = normalize(normalizeRecordKey(['referenceId', 'referenceID', 'Reference ID(optional)', 'Reference ID']))
  const notesTitle = normalize(normalizeRecordKey(['notesTitle', 'internalNotesTitle', 'Internal notes(optional): Title', 'Internal Notes Title']))
  const notesDescription = normalize(normalizeRecordKey(['notesDescription', 'internalNotesDescription', 'Internal notes(optional): Description', 'Internal Notes Description']))

  return {
    sourceSheet: 'External Sheet',
    name,
    amount,
    mobile,
    registeredName,
    registeredNumber,
    registeredAadhaar,
    attendanceAadhaar,
    email,
    role,
    designation,
    location,
    district,
    centre,
    candidateId,
    payoutPurpose,
    payoutDescription,
    referenceId,
    notesTitle,
    notesDescription,
  }
}

const buildExportRows = (records, metadata) => {
  const startNumber = Number(metadata.referenceStart || '1') || 1
  const maxNumber = startNumber + records.length - 1
  const paddingLength = Math.max(String(startNumber).length, String(maxNumber).length)
  const prefix = metadata.referencePrefix || ''
  const titlePrefix = metadata.notesTitlePrefix || ''
  const descriptionValue = metadata.description || ''

  return records.map((record, index) => {
    const referenceId = record.referenceId || `${prefix}${String(startNumber + index).padStart(paddingLength, '0')}`
    const candidateId = record.candidateId || record.id || ''
    const notesTitle = record.notesTitle || (candidateId ? `${titlePrefix}${candidateId}` : titlePrefix)
    const payoutPurpose = record.payoutPurpose || metadata.payoutPurpose || 'payout'
    const payoutDescription = record.payoutDescription || descriptionValue
    const notesDescription = record.notesDescription || descriptionValue

    return [
      record.name || '',
      record.amount || 0,
      record.mobile || '',
      record.registeredNumber || '',
      record.registeredAadhaar || '',
      record.attendanceAadhaar || '',
      record.email || '',
      'Yes',
      'Yes',
      record.role || 'Consultant',
      payoutPurpose,
      payoutDescription,
      referenceId,
      notesTitle,
      notesDescription,
    ]
  })
}

const parseUploadedCsvRows = async (file) => {
  const buffer = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target.result)
    reader.onerror = (event) => reject(event.target.error)
    reader.readAsArrayBuffer(file)
  })

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, raw: true })
  const firstSheet = workbook.Sheets[workbook.SheetNames?.[0]]
  if (!firstSheet) return []

  return XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', blankrows: true, raw: true })
}

const buildOriginalUploadSheetRows = (originalRows, responseRecords) => {
  const rows = Array.isArray(originalRows) ? originalRows : []
  const extraHeaders = ['registered_name', 'registered_aadhaar', 'registered_mobile']

  return rows.map((row, index) => {
    const values = Array.isArray(row)
      ? row.map((value) => (value == null ? '' : value))
      : []

    if (index === 0) {
      return [...values, ...extraHeaders]
    }

    const normalizedRecord = responseRecords?.[index - 1]
      ? normalizeExternalRecord(responseRecords[index - 1])
      : null

    return [
      ...values,
      normalizedRecord?.registeredName || '',
      normalizedRecord?.registeredAadhaar || '',
      normalizedRecord?.registeredNumber || '',
    ]
  })
}

export default function RecruiterPayments() {
  const { alert } = useAlert()
  const [uploadFile, setUploadFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [sheetNames, setSheetNames] = useState([])
  const [parsedRecords, setParsedRecords] = useState([])
  const [responseRecords, setResponseRecords] = useState([])
  const [previewError, setPreviewError] = useState('')

  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  // Payments list & filters
  const [payments, setPayments] = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentsTotal, setPaymentsTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterDistrict, setFilterDistrict] = useState('')
  const [filterCentre, setFilterCentre] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const [projectLocations, setProjectLocations] = useState([])
  const [projectDistricts, setProjectDistricts] = useState([])
  const [districtCentres, setDistrictCentres] = useState([])

  useEffect(() => {
    let mounted = true
    recruiterAPI.getProjects({ limit: 1000 }).then((res) => {
      if (!mounted) return
      const list = Array.isArray(res?.data?.data?.items)
        ? res.data.data.items
        : Array.isArray(res?.data?.items)
          ? res.data.items
          : Array.isArray(res?.data)
            ? res.data
            : []
      setProjects(list)
      if (list.length === 1) setSelectedProject(String(list[0]?.id || list[0]?.projectId || ''))
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Load dependent lists when filterProject or filterDistrict changes
  useEffect(() => {
    const rawProject = String(filterProject || '').trim()
    const projId = rawProject ? rawProject.replace(/^proj_/, '') : ''
    if (!projId) {
      setProjectLocations([])
      setProjectDistricts([])
      setDistrictCentres([])
      return
    }

    recruiterAPI.getProjectLocations(projId).then((res) => {
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : []
      setProjectLocations(list)
    }).catch(() => {})

    recruiterAPI.getProjectDistricts(projId).then((res) => {
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : []
      setProjectDistricts(list)
    }).catch(() => {})
  }, [filterProject])

  useEffect(() => {
    const rawProject = String(filterProject || '').trim()
    const projId = rawProject ? rawProject.replace(/^proj_/, '') : ''
    if (!projId || !filterDistrict) {
      setDistrictCentres([])
      return
    }
    recruiterAPI.getDistrictCentres(projId, filterDistrict).then((res) => {
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : []
      setDistrictCentres(list)
    }).catch(() => {})
  }, [filterProject, filterDistrict])

  const fetchPayments = async (opts = {}) => {
    setPaymentsLoading(true)
    try {
      const projectRaw = String(opts.project !== undefined ? opts.project : (filterProject || '')).trim()
      const projectParam = projectRaw ? projectRaw.replace(/^proj_/, '') : undefined

      const params = {
        search: opts.search !== undefined ? opts.search : search,
        project: projectParam,
        location: opts.location !== undefined ? opts.location : filterLocation,
        district: opts.district !== undefined ? opts.district : filterDistrict,
        centre: opts.centre !== undefined ? opts.centre : filterCentre,
        status: opts.status !== undefined ? opts.status : filterStatus,
        offset: opts.offset !== undefined ? opts.offset : offset,
        limit: opts.limit !== undefined ? opts.limit : limit,
      }

      const res = await recruiterAPI.getPaymentsList(params)
      // Expected shapes: { data: { items: [...], total, offset, limit } } or { data: [...], total }
      const items = (res?.data?.data && Array.isArray(res.data.data.items)) ? res.data.data.items
        : Array.isArray(res?.data?.items) ? res.data.items
        : Array.isArray(res?.data) ? res.data
        : []
      const total = res?.data?.data?.total ?? res?.data?.total ?? (Array.isArray(res?.data) ? res.data.length : 0)

      setPayments(items)
      setPaymentsTotal(Number(total || 0))
    } catch (err) {
      console.error(err)
      alert('error', 'Failed to load payments list')
    } finally {
      setPaymentsLoading(false)
    }
  }

  useEffect(() => {
    // Fetch list on mount and when filters/pagination change
    fetchPayments({})
    // reset selection when data changes
    setSelectedIds(new Set())
    setSelectAll(false)
  }, [filterProject, filterLocation, filterDistrict, filterCentre, filterStatus, offset, limit, search])

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set())
      setSelectAll(false)
      return
    }
    const ids = new Set(payments.map((p) => p.id || p.paymentId || p._id).filter(Boolean))
    setSelectedIds(ids)
    setSelectAll(true)
  }

  const toggleSelectRow = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
    setSelectAll(next.size === payments.filter((p) => p.id || p.paymentId || p._id).length)
  }

  const handleMarkAsPaid = async () => {
    if (selectedIds.size === 0) {
      alert('error', 'Please select at least one payment to mark as paid.')
      return
    }
    const ids = Array.from(selectedIds)
    try {
      await recruiterAPI.markPaymentsPaid(ids)
      alert('success', 'Selected payments marked as paid')
      // refresh
      fetchPayments()
    } catch (err) {
      console.error(err)
      alert('error', 'Failed to mark payments as paid')
    }
  }

  const onFileChange = (event) => {
    const file = event.target.files?.[0] || null
    setUploadFile(file)
    setPreviewError('')
    setParsedRecords([])
    setResponseRecords([])
    setSheetNames([])
    if (!file) return

    const extension = String(file.name).split('.').pop().toLowerCase()
    if (extension !== 'csv') {
      setPreviewError('Please upload a .csv file for external sheet mode.')
      setUploadFile(null)
      return
    }
  }

  const generateWorkbook = async (recordsToUse, metadataToUse, originalRows, responseRecords) => {
    const rows = buildExportRows(recordsToUse, metadataToUse)
    const exportWorksheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows])
    exportWorksheet['!cols'] = EXPORT_HEADERS.map((header) => ({ wch: Math.max(14, header.length + 4) }))

    const uploadedWorksheet = XLSX.utils.aoa_to_sheet(buildOriginalUploadSheetRows(originalRows, responseRecords))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, exportWorksheet, 'Current Export')
    XLSX.utils.book_append_sheet(workbook, uploadedWorksheet, 'Upload + Registered')

    const filename = `${metadataToUse.fileName || DEFAULT_EXPORT_FILE_NAME}.xlsx`
    XLSX.writeFile(workbook, filename)
    alert('success', 'Payment workbook generated successfully.')
  }

  const handleGenerate = async () => {
    if (!uploadFile) {
      alert('error', 'Please select a CSV file and fill the form fields before submitting.')
      return
    }

    setParsing(true)
    setPreviewError('')
    setParsedRecords([])
    setSheetNames([])

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const selectedRaw = String(selectedProject || '').trim()
      formData.append('projectId', selectedRaw ? selectedRaw.replace(/^proj_/, '') : '')

      const response = await recruiterAPI.processExternalPaymentSheet(formData)
      const payload = response?.data
      const rawRecords = extractResponseRecords(payload)
      const normalizedRecords = rawRecords
        .map(normalizeExternalRecord)
        .filter((record) => record && record.name && record.amount > 0)

      if (normalizedRecords.length === 0) {
        setPreviewError('No valid records were returned from the conversion service.')
        return
      }

      setResponseRecords(rawRecords)

      const originalRows = await parseUploadedCsvRows(uploadFile)
      setParsedRecords(normalizedRecords)
      setSheetNames(['Current Export', 'Upload + Registered'])
      await generateWorkbook(normalizedRecords, { fileName: DEFAULT_EXPORT_FILE_NAME }, originalRows, rawRecords)
    } catch (err) {
      console.error(err)
      setPreviewError('Failed to upload and convert the file. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  const downloadSampleTemplate = () => {
    const sampleRow = [
      'Aarif Khan',
      7490,
      '9238233725',
      'aarifkhan8052@gmail.com',
      'Yes',
      'Yes',
      'Consultant',
      'payout',
      'March payment',
      'REF-2026-001',
      'CYN2026PAY-001',
      'Batch payout for attendance',
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, sampleRow])
    worksheet['!cols'] = EXPORT_HEADERS.map((header) => ({ wch: Math.max(14, header.length + 4) }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Payment Sheet')
    XLSX.writeFile(workbook, 'payment_export_sample.xlsx')
  }

  const downloadExternalSampleTemplate = () => {
    const rows = [
      [
        'S.No',
        'Candidate Name',
        'Aadhaar',
        'Mobile',
        'District',
        'Centre',
        'Designation',
        'Amount to be Paid',
      ],
      [
        1,
        'Aarif Khan',
        '123456789012',
        '9238233725',
        'Bhagalpur',
        'Govt. Girl’s High School, Near Ghanta Ghar Chowk',
        'Biometric Operators',
        7490,
      ],
      [
        2,
        'Deepak Kumar',
        '234567890123',
        '9800890984',
        'Bhagalpur',
        'Govt. Girl’s High School, Near Ghanta Ghar Chowk',
        'Supervisors',
        10000,
      ],
      [
        3,
        'Saurav Kumar',
        '345678901234',
        '9800890985',
        'Patna',
        'J.L.N.S.H. High School, Gulab Bagh, Purnea',
        'Biometric Operators',
        100,
      ],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    const csv = XLSX.utils.sheet_to_csv(worksheet)
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'external_payment_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="payments-page">
      <PageHeader
        title="Payments"
        subtitle="Upload attendance payment workbooks generated from PaymentSheet and export the payout-ready format."
        action={(
          <div className="payments-actions">
            <button className="btn btn-secondary btn-sm" type="button" onClick={downloadSampleTemplate}>
              <FontAwesomeIcon icon={faDownload} /> Download Output Sample
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={downloadExternalSampleTemplate}>
              <FontAwesomeIcon icon={faDownload} /> Download External Template
            </button>
          </div>
        )}
      />

      <Card className="upload-card">
        <div className="upload-card-content">
          <h3>Upload external payment workbook</h3>
          <p className="text-muted">Upload the external payment sheet in CSV format. The file will be sent to the conversion backend and transformed into the payout-ready export format.</p>

          <div className="form-group">
            <label htmlFor="payment-upload" className="form-label">Choose file</label>
            <input
              id="payment-upload"
              type="file"
              accept=".csv"
              className="form-control"
              onChange={onFileChange}
            />
          </div>

          {parsing && <div className="upload-status">Parsing workbook...</div>}
          {previewError && <div className="upload-error">{previewError}</div>}

          {uploadFile && !parsing && !previewError && (
            <div className="upload-summary">
              <div><strong>Selected file:</strong> {uploadFile.name}</div>
              <div><strong>Detected sheets:</strong> {sheetNames.length > 0 ? sheetNames.join(', ') : 'None'}</div>
              <div><strong>Backend response records:</strong> {responseRecords.length}</div>
            </div>
          )}

          <div className="export-settings">
            <h4>Payment metadata</h4>
            <div className="settings-grid">
              <div className="form-group">
                <label>Project</label>
                <select
                  className="form-control"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id || p.projectId || p.projectName} value={p.id || p.projectId || ''}>{p.projectName || p.id || p.projectId}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="upload-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleGenerate}
              disabled={!uploadFile || parsing}
            >
              <FontAwesomeIcon icon={faFileExcel} /> Upload & Convert
            </button>
          </div>
        </div>
      </Card>

      {responseRecords.length > 0 && (
        <Card className="preview-card" style={{display: 'none'}}>
          <div className="preview-card-content">
            <div className="preview-header">
              <h3>Preview backend response records</h3>
              <span className="preview-badge">{responseRecords.length} records</span>
            </div>

            <div className="preview-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    {RESPONSE_PREVIEW_HEADERS.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {responseRecords.slice(0, 20).map((record, index) => (
                    <tr key={`${record['Name of Contact'] || 'row'}-${index}`}>
                      {RESPONSE_PREVIEW_HEADERS.map((header) => (
                        <td key={header}>{record[header] != null && record[header] !== '' ? record[header] : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {responseRecords.length > 20 && (
                <div className="preview-note">Showing first 20 rows.</div>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="info-card">
        <div className="info-card-content">
          <div className="info-row">
            <FontAwesomeIcon icon={faInfoCircle} />
            <div>
              <strong>How this works</strong>
              <p className="text-muted">
                Upload the attendance workbook exported from attendance sheet. This tool reads the generated attendance/payment sheets and converts them into the payout format expected by the payments processor.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="payments-card">
        <div className="preview-card-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3>Payments</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" className="form-control" placeholder="Search" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} style={{ minWidth: 200 }} />
              <select className="form-control" value={filterProject} onChange={(e) => {
                const v = e.target.value
                setFilterProject(v)
                // reset dependent filters when project changes
                setFilterLocation('')
                setFilterDistrict('')
                setFilterCentre('')
                setOffset(0)
              }}>
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id || p.projectId || p.projectName} value={p.id || p.projectId || ''}>{p.projectName || p.id || p.projectId}</option>
                ))}
              </select>
              {projectLocations && projectLocations.length > 0 ? (
                <select className="form-control" value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); setOffset(0); }}>
                  <option value="">All locations</option>
                  {projectLocations.map((l) => (
                    <option key={l.id || l} value={l.id || l}>{l.name || l}</option>
                  ))}
                </select>
              ) : (
                <>
                  <select className="form-control" value={filterDistrict} onChange={(e) => { setFilterDistrict(e.target.value); setOffset(0); }}>
                    <option value="">All districts</option>
                    {projectDistricts.map((d) => (
                      <option key={d.id || d} value={d.id || d}>{d.name || d}</option>
                    ))}
                  </select>
                  <select className="form-control" value={filterCentre} onChange={(e) => { setFilterCentre(e.target.value); setOffset(0); }}>
                    <option value="">All centres</option>
                    {districtCentres.map((c) => (
                      <option key={c.id || c} value={c.id || c}>{c.name || c}</option>
                    ))}
                  </select>
                </>
              )}
              <select className="form-control" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }}>
                <option value="">All status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" type="button" onClick={handleMarkAsPaid} disabled={selectedIds.size === 0}>Mark as paid</button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rows</label>
              <select className="form-control" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="preview-table-wrapper" style={{ marginTop: 12 }}>
            <table className="preview-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                  </th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Amount</th>
                  <th>Project</th>
                  <th>Location</th>
                  <th>District</th>
                  <th>Centre</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading && (
                  <tr>
                    <td colSpan={10} className="loading-state">Loading payments...</td>
                  </tr>
                )}
                {!paymentsLoading && payments.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty-state">No payments found.</td>
                  </tr>
                )}
                {!paymentsLoading && payments.map((p) => {
                  const id = p.id || p.paymentId || p._id
                  return (
                    <tr key={id}>
                      <td>
                        <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelectRow(id)} />
                      </td>
                      <td>{p.name || p.contactName || '—'}</td>
                      <td>{p.mobile || p.phone || '—'}</td>
                      <td>{p.email || '—'}</td>
                      <td>{p.amount != null ? p.amount : '—'}</td>
                      <td>{p.projectName || p.project || '—'}</td>
                      <td>{p.location || '—'}</td>
                      <td>{p.district || '—'}</td>
                      <td>{p.centre || p.center || '—'}</td>
                      <td>{(p.status || '').toString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Showing {Math.min(offset + 1, paymentsTotal || 0)} - {Math.min(offset + payments.length, paymentsTotal || 0)} of {paymentsTotal}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Prev</button>
              <button className="btn btn-secondary" type="button" disabled={offset + limit >= paymentsTotal} onClick={() => setOffset(offset + limit)}>Next</button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
