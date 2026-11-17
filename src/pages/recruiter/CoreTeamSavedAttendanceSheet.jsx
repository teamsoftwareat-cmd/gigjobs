import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotate } from '@fortawesome/free-solid-svg-icons'
import { faCircleExclamation, faRotate } from '@fortawesome/free-solid-svg-icons'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { coreRecruiterAPI, recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import './CoreTeamSavedAttendanceSheet.css'

const EMPTY_ROWS = []

const getList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload?.data && !Array.isArray(payload.data)) {
    const nested = getList(payload.data)
    if (nested.length) return nested
  }
  for (const key of ['data', 'records', 'items', 'results', 'attendance', 'payments', 'payment_records', 'attendance_payments', 'attendance_payment_sheet', 'sheets']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

const getValue = (record, keys, fallback = '') => {
  for (const key of keys) {
    const value = record?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

const getGeneratedRows = (response) => {
  const body = response?.data ?? response
  const payload = body?.data ?? body
  if (Array.isArray(payload)) return payload
  return payload?.payment_sheet || payload?.paymentSheet || payload?.rows || []
}

const getGeneratedCandidateBreakdown = (response) => {
  const body = response?.data && typeof response.data === 'object' && !Array.isArray(response.data)
    ? response.data
    : response
  const payload = body?.data && typeof body.data === 'object' && !Array.isArray(body.data)
    ? body.data
    : body
  const candidates = body?.candidates ?? payload?.candidates
  return Array.isArray(candidates) ? candidates : []
}

const getCandidateDetails = (record) => {
  const nested = [
    record?.candidate,
    record?.candidate_details,
    record?.candidateDetails,
    record?.user,
    record?.worker_details,
    record?.workerDetails,
    record?.profile,
  ].find((value) => value && typeof value === 'object' && !Array.isArray(value))
  return nested ? { ...nested, ...record } : record
}

const candidateIdentity = (record) => String(getValue(getCandidateDetails(record), [
  'candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'userId', 'id', 'mobile', 'phone', 'candidate_name', 'name',
]))

const normalizeCandidateDeductionDetails = (record) => {
  const entries = getValue(record, ['deductions', 'outstanding_deductions', 'outstandingDeductions', 'deduction_entries', 'deductionEntries'], [])
  const outstandingEntries = Array.isArray(entries) ? entries.flatMap((entry, index) => {
    const status = String(getValue(entry, ['status', 'state'], 'outstanding')).trim().toLowerCase()
    if (['proposed', 'recovered', 'paid', 'cancelled'].includes(status)) return []
    const amount = Number(getValue(entry, ['amount', 'outstanding_amount', 'deduction_amount'], 0))
    if (!Number.isFinite(amount) || amount <= 0) return []
    return [{
      id: String(getValue(entry, ['id', 'deduction_id', 'deductionId'], `deduction-${index}`)),
      amount,
      note: String(getValue(entry, ['note', 'description', 'reason'], '')),
    }]
  }) : []
  const parsedTotal = Number(getValue(record, ['overall_outstanding_deduction', 'overallOutstandingDeduction'], Number.NaN))
  const amount = Number.isFinite(parsedTotal)
    ? Math.max(0, parsedTotal)
    : outstandingEntries.reduce((total, entry) => total + entry.amount, 0)
  return { amount, entries: outstandingEntries }
}

async function fetchCandidateDeductionDetails(candidates) {
  const joiningDetails = []
  let offset = 0
  while (true) {
    const response = await recruiterAPI.getCandidateJoiningDetails({ offset, limit: 500 })
    const payload = response?.data ?? response
    const rows = getList(payload)
    joiningDetails.push(...rows)
    const total = Number(payload?.data?.total ?? payload?.total ?? payload?.count ?? payload?.totalCount ?? payload?.total_count)
    offset += rows.length
    if (!rows.length || rows.length < 500 || (Number.isFinite(total) && offset >= total)) break
  }

  return new Map(candidates.map((candidate) => {
    const candidateId = String(getValue(candidate, ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'userId', 'id'], '')).trim()
    const mobile = String(getValue(candidate, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], '')).replace(/\D/g, '')
    const details = joiningDetails.find((record) => {
      const recordId = String(getValue(record, ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'userId', 'id'], '')).trim()
      const recordMobile = String(getValue(record, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], '')).replace(/\D/g, '')
      return (candidateId && recordId === candidateId) || (mobile && recordMobile === mobile)
    })
    return [candidateIdentity(candidate), normalizeCandidateDeductionDetails(details || {})]
  }))
}

const normalizeSavedCandidateRecords = (payload, project) => {
  const candidates = new Map()
  const getCandidate = (record) => {
    const details = getCandidateDetails(record)
    const key = candidateIdentity(details)
    if (!key) return null
    if (!candidates.has(key)) {
      candidates.set(key, {
        candidate_id: getValue(details, ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'userId', 'id'], key),
        candidate_name: getValue(details, ['candidate_name', 'candidateName', 'name', 'worker_name', 'full_name', 'fullName'], 'Unknown'),
        mobile: getValue(details, ['mobile', 'mobile_number', 'candidate_mobile', 'phone', 'phone_number', 'contact', 'whatsapp']),
        aadhaar: getValue(details, ['aadhaar', 'aadhar', 'aadhaar_number', 'aadhaar_no', 'aadhaarNo', 'aadhaarNumber', 'candidate_aadhaar', 'candidate_aadhar', 'aadhar_number', 'aadhar_no']),
        project_id: getValue(record, ['project_id', 'projectId'], project.id),
        project_name: getValue(record, ['project_name', 'projectName'], project.name),
        locations: [],
        attendance: [],
        overtime: [],
        deductions: [],
      })
    }
    const candidate = candidates.get(key)
    if (!candidate.mobile) candidate.mobile = getValue(details, ['mobile', 'mobile_number', 'candidate_mobile', 'phone', 'phone_number', 'contact', 'whatsapp'])
    if (!candidate.aadhaar) candidate.aadhaar = getValue(details, ['aadhaar', 'aadhar', 'aadhaar_number', 'aadhaar_no', 'aadhaarNo', 'aadhaarNumber', 'candidate_aadhaar', 'candidate_aadhar', 'aadhar_number', 'aadhar_no'])
    if (candidate.candidate_name === 'Unknown') {
      candidate.candidate_name = getValue(details, ['candidate_name', 'candidateName', 'name', 'worker_name', 'full_name', 'fullName'], 'Unknown')
    }
    return candidate
  }

  getList(payload).forEach((record) => {
    const candidate = getCandidate(record)
    if (!candidate) return
    if (Array.isArray(record.attendance) || Array.isArray(record.overtime) || Array.isArray(record.deductions)) {
      candidate.attendance.push(...(record.attendance || []))
      candidate.overtime.push(...(record.overtime || []))
      candidate.deductions.push(...(record.deductions || []))
      candidate.locations.push(...(record.locations || []))
      return
    }

    const paymentType = String(getValue(record, ['payment_type', 'paymentType', 'type'], 'Payment'))
    const amount = Number(getValue(record, ['amount', 'payment_amount'], 0)) || 0
    if (paymentType.toLowerCase() === 'deduction' || amount < 0) {
      candidate.deductions.push({ amount: Math.abs(amount), note: getValue(record, ['note', 'description']) })
      return
    }

    const attendanceId = String(getValue(record, ['attendance_id', 'attendanceId'], ''))
    let attendance = candidate.attendance.find((item) => String(item.attendance_id) === attendanceId)
    if (!attendance) {
      attendance = {
        attendance_id: attendanceId,
        attendance_date: getValue(record, ['attendance_date', 'date']),
        project_id: getValue(record, ['project_id', 'projectId'], project.id),
        project_name: getValue(record, ['project_name', 'projectName'], project.name),
        location_id: getValue(record, ['location_id', 'locationId']),
        location_name: getValue(record, ['location_name', 'locationName', 'location']),
    const attendanceDate = getValue(record, ['attendance_date', 'date'])
    const locationId = getValue(record, ['location_id', 'locationId'])
    const locationName = getValue(record, ['location_name', 'locationName', 'location'])
    const recordProjectId = getValue(record, ['project_id', 'projectId'], project.id)
    let attendance = candidate.attendance.find((item) => (
      String(item.attendance_id) === attendanceId
      && normalizeDate(item.attendance_date || item.date) === normalizeDate(attendanceDate)
      && String(item.location_id || item.locationId || '') === String(locationId || '')
      && String(item.location_name || item.locationName || item.location || '') === String(locationName || '')
      && String(item.project_id || item.projectId || '') === String(recordProjectId || '')
    ))
    if (!attendance) {
      attendance = {
        attendance_id: attendanceId,
        attendance_date: attendanceDate,
        project_id: recordProjectId,
        project_name: getValue(record, ['project_name', 'projectName'], project.name),
        location_id: locationId,
        location_name: locationName,
        payments: [],
      }
      candidate.attendance.push(attendance)
    }
    attendance.payments.push({ payment_type: paymentType, amount, note: getValue(record, ['note', 'description']) })
  })

  return [...candidates.values()].map((candidate) => ({
    ...candidate,
    attendance: candidate.attendance.map((attendance) => ({
      ...attendance,
      payments: Array.isArray(attendance.payments) ? attendance.payments : [],
    })),
  }))
}

const flattenCandidateRecords = (candidateRecords) => candidateRecords.flatMap((candidate) => {
  const earnings = (candidate.attendance || []).flatMap((attendance) => (
    (attendance.payments || []).map((payment) => ({
      candidate_id: candidate.candidate_id,
      candidate_name: candidate.candidate_name,
      attendance_date: attendance.attendance_date,
      attendance_id: attendance.attendance_id,
      location_name: attendance.location_name,
      payment_type: payment.payment_type,
      amount: payment.amount,
      note: payment.note,
    }))
  ))
  const deductions = (candidate.deductions || []).map((deduction) => ({
    candidate_id: candidate.candidate_id,
    candidate_name: candidate.candidate_name,
    attendance_date: '',
    attendance_id: '',
    location_name: '',
    payment_type: 'Deduction',
    amount: -Math.abs(Number(deduction.amount) || 0),
    note: deduction.note,
  }))
  const overtime = (candidate.overtime || []).map((item) => ({
    candidate_id: candidate.candidate_id,
    candidate_name: candidate.candidate_name,
    attendance_date: '',
    from_date: item.from_date,
    to_date: item.to_date,
    attendance_id: '',
    location_name: '',
    payment_type: 'Overtime',
    amount: item.amount,
    overtime_hours: item.overtime_hours,
    overtime_rate: item.overtime_rate,
  }))
  return [...earnings, ...overtime, ...deductions]
})

const filterCandidateRecords = (candidateRecords, paymentTypes, includeDeductions, candidateIds, selectedDates) => candidateRecords
const getCandidateEarnings = (candidate) => (
  (candidate.attendance || []).reduce((total, attendance) => (
    total + (attendance.payments || []).reduce((paymentTotal, payment) => paymentTotal + (Number(payment.amount) || 0), 0)
  ), 0)
  + (candidate.overtime || []).reduce((total, item) => total + (Number(item.amount) || 0), 0)
)

const filterCandidateRecords = (candidateRecords, paymentTypes, candidateIds, selectedDates) => candidateRecords
  .filter((candidate) => candidateIds === null || candidateIds.has(candidateIdentity(candidate)))
  .map((candidate) => ({
    ...candidate,
    attendance: (candidate.attendance || []).map((attendance) => ({
      ...attendance,
      payments: (attendance.payments || []).filter((payment) => (
        paymentTypes.includes(String(payment.payment_type))
        && selectedDates.has(normalizeDate(attendance.attendance_date || attendance.date))
      )),
    })).filter((attendance) => attendance.payments.length),
    overtime: (candidate.overtime || []).filter((item) => {
      const periodDates = getDateRange(normalizeDate(item.from_date), normalizeDate(item.to_date))
      return paymentTypes.includes('Overtime')
        && periodDates.length > 0
        && periodDates.every((date) => selectedDates.has(date))
    }),
    deductions: includeDeductions ? candidate.deductions || [] : [],
  }))
  .filter((candidate) => candidate.attendance.length || candidate.overtime.length || candidate.deductions.length)
    deductions: [],
  }))
  .filter((candidate) => candidate.attendance.length || candidate.overtime.length)

const buildAttendancePaymentSheetPayload = (candidateRecords, project) => ({
  type: 'attendance',
  attendance: candidateRecords.map((candidate) => {
    const attendance = Array.isArray(candidate.attendance) ? candidate.attendance : []
    const locations = Array.isArray(candidate.locations) ? [...candidate.locations] : []
    attendance.forEach((item) => {
      const locationId = getValue(item, ['location_id', 'locationId', 'district_id', 'districtId'])
      const locationName = getValue(item, ['location_name', 'locationName', 'location', 'district_name', 'districtName'])
      if (!locationId && !locationName) return
      const alreadyIncluded = locations.some((location) => (
        String(getValue(location, ['location_id', 'locationId', 'district_id', 'districtId', 'id'])) === String(locationId)
        && String(getValue(location, ['location_name', 'locationName', 'location', 'district_name', 'districtName', 'name'])) === String(locationName)
      ))
      if (!alreadyIncluded) locations.push({ location_id: locationId, location_name: locationName })
    })

    const deductionAmount = Math.max(0, Number(candidate.overall_outstanding_deduction) || 0)
    return {
      ...candidate,
      candidate_id: getValue(candidate, ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'userId', 'id'], candidateIdentity(candidate)),
      candidate_name: getValue(candidate, ['candidate_name', 'candidateName', 'name', 'full_name', 'fullName'], 'Unknown'),
      project_id: getValue(candidate, ['project_id', 'projectId'], project.id),
      project_name: getValue(candidate, ['project_name', 'projectName'], project.name),
      locations,
      attendance,
      overtime: Array.isArray(candidate.overtime) ? candidate.overtime : [],
      overall_outstanding_deduction: deductionAmount,
      deductions: deductionAmount > 0 ? [{ amount: deductionAmount, note: 'Outstanding deduction' }] : [],
    }
  }),
})

const getFilterSignature = (filters) => JSON.stringify({
  candidateIds: filters.candidateIds == null ? null : [...filters.candidateIds].map(String).sort(),
  deductionCandidateIds: [...(filters.deductionCandidateIds || [])].map(String).sort(),
  paymentTypes: [...(filters.paymentTypes || [])].map(String).sort(),
  dateScope: filters.dateScope || 'all',
  rangeFromDate: filters.rangeFromDate || '',
  rangeToDate: filters.rangeToDate || '',
  dates: [...(filters.dates || [])].map(String).sort(),
})

const getAttendanceIds = (candidateRecords) => [...new Set(candidateRecords.flatMap((candidate) => (
  (candidate.attendance || []).map((attendance) => attendance.attendance_id)
)).filter((id) => id !== undefined && id !== null && id !== '').map(String))]

const getPreviewColumns = (rows) => {
  if (rows.some(Array.isArray)) {
    const count = Math.max(...rows.map((row) => Array.isArray(row) ? row.length : 0))
    return Array.from({ length: count }, (_, index) => `Column ${index + 1}`)
  }
  return [...new Set(rows.flatMap((row) => row && typeof row === 'object' ? Object.keys(row) : []))]
}

const getPreviewValue = (row, column, index) => Array.isArray(row) ? row[index] : row?.[column]
const formatMoney = (value) => `₹${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const isBasePayType = (value) => ['salary', 'base salary', 'base pay'].includes(String(value).trim().toLowerCase())
const normalizeDate = (value) => {
  if (!value) return ''
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const parseLocalDate = (value) => {
  const [year, month, day] = normalizeDate(value).split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : undefined
}

const formatLocalDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const getDateRange = (from, to) => {
  if (!from || !to || from > to) return []
  const dates = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

const getSavedDateBounds = (candidateRecords) => {
  const dates = candidateRecords.flatMap((candidate) => [
    ...(candidate.attendance || []).map((attendance) => normalizeDate(attendance.attendance_date || attendance.date)),
    ...(candidate.overtime || []).flatMap((item) => [normalizeDate(item.from_date), normalizeDate(item.to_date)]),
  ])
    .filter(Boolean)
    .sort()
  return { first: dates[0] || '', last: dates[dates.length - 1] || '' }
}

const getMatrixStatus = (entry, hasSavedEarning) => {
  if (!entry) return hasSavedEarning ? 'P' : 'A'
  if (entry.status === 'absent') return 'A'
  if (entry.kind === 'home') return 'H'
  if (entry.kind === 'travel') return 'T'
  return 'P'
}

const loadAttendanceMatrixFromPayments = (candidateRecords) => candidateRecords.map((candidate) => {
  const attendance = {}
  ;(candidate.attendance || []).forEach((item) => {
    const date = normalizeDate(item.attendance_date || item.date)
    if (!date) return
    const isTravel = (item.payments || []).some((payment) => String(payment.payment_type).toLowerCase().includes('travel'))
    attendance[date] = { kind: isTravel ? 'travel' : 'project', status: 'present' }
  })
  return {
    candidate_id: candidate.candidate_id,
    candidate_name: candidate.candidate_name,
    mobile: candidate.mobile || '',
    aadhaar: candidate.aadhaar || '',
    attendance,
  }
})

export default function CoreTeamSavedAttendanceSheet({
  isOpen,
  onClose,
  project,
  embedded = false,
  initialFromDate = '',
  initialToDate = '',
  directMode = false,
  initialRecords = null,
  onFooterChange,
}) {
  const { user } = useAuth()
  const requestId = useRef(0)
  const lastAutoFilterSignature = useRef('')
  const directGenerationStarted = useRef(false)
  const projectId = project?.projectId || project?.id || ''
  const projectName = project?.projectName || project?.name || project?.title || String(projectId)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [candidateRecords, setCandidateRecords] = useState([])
  const [filteredCandidateRecords, setFilteredCandidateRecords] = useState([])
  const [candidateDeductionDetails, setCandidateDeductionDetails] = useState(new Map())
  const [selectedDeductionCandidateIds, setSelectedDeductionCandidateIds] = useState(new Set())
  const [deductionCandidateKey, setDeductionCandidateKey] = useState('')
  const [deductionDetailsLoading, setDeductionDetailsLoading] = useState(false)
  const [deductionDetailsError, setDeductionDetailsError] = useState('')
  const [attendanceCandidates, setAttendanceCandidates] = useState([])
  const [attendanceDates, setAttendanceDates] = useState([])
  const [attendanceDateRange, setAttendanceDateRange] = useState({ from: '', to: '' })
  const [attendanceWarning, setAttendanceWarning] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [includeDeductions, setIncludeDeductions] = useState(false)
  const [hasLoadedRecords, setHasLoadedRecords] = useState(false)
  const [autoFilterFailed, setAutoFilterFailed] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedCandidateIds, setSelectedCandidateIds] = useState(null)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [dateScope, setDateScope] = useState('all')
  const [rangeFromDate, setRangeFromDate] = useState('')
  const [rangeToDate, setRangeToDate] = useState('')
  const [specificDates, setSpecificDates] = useState(new Set())
  const [generatedSheet, setGeneratedSheet] = useState(null)
  const [generatedSheetView, setGeneratedSheetView] = useState('sheet')
  const [sheetName, setSheetName] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [savingStatus, setSavingStatus] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const savedRows = useMemo(() => flattenCandidateRecords(candidateRecords), [candidateRecords])
  const paymentTypes = useMemo(() => [...new Set(savedRows
    .filter((row) => row.payment_type !== 'Deduction')
    .map((row) => String(row.payment_type)))].sort((a, b) => a.localeCompare(b)), [savedRows])
  const includeBasePay = paymentTypes.some(isBasePayType)
  const allowanceTypes = useMemo(() => paymentTypes.filter((type) => !isBasePayType(type)), [paymentTypes])
  const earningsByCandidate = useMemo(() => new Map(candidateRecords.map((candidate) => [candidateIdentity(candidate), candidate])), [candidateRecords])
  const includeBasePay = selectedTypes.some(isBasePayType)
  const allowanceTypes = useMemo(() => paymentTypes.filter((type) => (
    selectedTypes.includes(type) && !isBasePayType(type)
  )), [paymentTypes, selectedTypes])
  const earningsByCandidate = useMemo(() => new Map(filteredCandidateRecords.map((candidate) => [candidateIdentity(candidate), candidate])), [filteredCandidateRecords])
  const savedEarningsByCandidateAndDate = useMemo(() => {
    const grouped = new Map()
    savedRows.forEach((row) => {
      if (!row.attendance_date || row.payment_type === 'Deduction') return
      const key = `${candidateIdentity(row)}|${normalizeDate(row.attendance_date)}`
      grouped.set(key, (grouped.get(key) || 0) + (Number(row.amount) || 0))
    })
    return grouped
  }, [savedRows])
  const matrixRows = useMemo(() => attendanceCandidates.map((candidate) => {
    const savedCandidate = earningsByCandidate.get(candidateIdentity(candidate))
    const typeTotals = {}
    let gross = 0
    let deduction = 0
    const deductionNotes = new Set()
  const selectedDates = useMemo(() => {
    if (dateScope === 'range') return attendanceDates.filter((date) => date >= rangeFromDate && date <= rangeToDate)
    if (dateScope === 'specific') return attendanceDates.filter((date) => specificDates.has(date))
    return attendanceDates
  }, [attendanceDates, dateScope, rangeFromDate, rangeToDate, specificDates])
  const matrixRows = useMemo(() => attendanceCandidates.map((candidate) => {
    const savedCandidate = earningsByCandidate.get(candidateIdentity(candidate))
    const candidateKey = candidateIdentity(candidate)
    const deductionDetails = candidateDeductionDetails.get(candidateKey) || { amount: 0, entries: [] }
    const deduction = selectedDeductionCandidateIds.has(candidateKey)
      ? Math.min(deductionDetails.amount, Math.max(0, getCandidateEarnings(savedCandidate || {})))
      : 0
    const typeTotals = {}
    let gross = 0
    const deductionNotes = new Set(deduction > 0 ? deductionDetails.entries.map((entry) => entry.note).filter(Boolean) : [])
    ;(savedCandidate?.attendance || []).forEach((attendance) => {
      ;(attendance.payments || []).forEach((payment) => {
        const amount = Number(payment.amount) || 0
        const type = String(payment.payment_type || 'Payment')
        typeTotals[type] = (typeTotals[type] || 0) + amount
        gross += amount
      })
    })
    ;(savedCandidate?.overtime || []).forEach((item) => {
      const amount = Number(item.amount) || 0
      typeTotals.Overtime = (typeTotals.Overtime || 0) + amount
      gross += amount
    })
    ;(savedCandidate?.deductions || []).forEach((item) => {
      deduction += Math.abs(Number(item.amount) || 0)
      if (item.note) deductionNotes.add(item.note)
    })
    let workedDays = 0
    attendanceDates.forEach((date) => {
    let workedDays = 0
    selectedDates.forEach((date) => {
      const entry = candidate.attendance[date]
      if (entry?.kind === 'project' && entry.status !== 'absent') workedDays += entry.status === 'half' ? 0.5 : 1
    })
    const baseAmount = Object.entries(typeTotals).reduce((sum, [type, amount]) => (
      isBasePayType(type) ? sum + amount : sum
    ), 0)
    const allowanceTotals = Object.fromEntries(allowanceTypes.map((type) => [type, typeTotals[type] || 0]))
    return {
      candidate,
      workedDays,
      baseRate: workedDays ? baseAmount / workedDays : 0,
      baseAmount,
      allowanceTotals,
      gross,
      deduction,
      deductionNote: [...deductionNotes].join('; '),
      net: gross - deduction,
    }
  }), [allowanceTypes, attendanceCandidates, attendanceDates, earningsByCandidate])
  }), [allowanceTypes, attendanceCandidates, candidateDeductionDetails, earningsByCandidate, selectedDates, selectedDeductionCandidateIds])
  const matrixTotals = useMemo(() => matrixRows.reduce((totals, row) => {
    totals.workedDays += row.workedDays
    totals.baseAmount += row.baseAmount
    totals.gross += row.gross
    totals.deduction += row.deduction
    totals.net += row.net
    allowanceTypes.forEach((type) => { totals.allowanceTotals[type] += row.allowanceTotals[type] || 0 })
    return totals
  }, {
    workedDays: 0,
    baseAmount: 0,
    gross: 0,
    deduction: 0,
    net: 0,
    allowanceTotals: Object.fromEntries(allowanceTypes.map((type) => [type, 0])),
  }), [allowanceTypes, matrixRows])
  const selectedDates = useMemo(() => {
    if (dateScope === 'range') return attendanceDates.filter((date) => date >= rangeFromDate && date <= rangeToDate)
    if (dateScope === 'specific') return attendanceDates.filter((date) => specificDates.has(date))
    return attendanceDates
  }, [attendanceDates, dateScope, rangeFromDate, rangeToDate, specificDates])
  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates])
  const candidateIds = useMemo(() => candidateRecords.map(candidateIdentity), [candidateRecords])
  const selectedCandidateCount = selectedCandidateIds === null ? candidateRecords.length : selectedCandidateIds.size
  const dateSelectionValid = dateScope !== 'range' || Boolean(rangeFromDate && rangeToDate && rangeFromDate <= rangeToDate)
  const selectedRecords = useMemo(() => filterCandidateRecords(
    candidateRecords,
    selectedTypes,
    includeDeductions,
    selectedCandidateIds,
    selectedDateSet,
  ), [candidateRecords, includeDeductions, selectedCandidateIds, selectedDateSet, selectedTypes])
  const selectedRows = useMemo(() => flattenCandidateRecords(selectedRecords), [selectedRecords])
  const generatedRows = generatedSheet?.rows || EMPTY_ROWS
  const previewColumns = useMemo(() => getPreviewColumns(generatedRows), [generatedRows])
  const deductionCandidateRow = matrixRows.find((row) => candidateIdentity(row.candidate) === deductionCandidateKey)
  const deductionCandidate = deductionCandidateRow?.candidate
  const activeDeductionDetails = deductionCandidateKey
    ? candidateDeductionDetails.get(deductionCandidateKey) || { amount: 0, entries: [] }
    : { amount: 0, entries: [] }
  const activeDeductionAppliedAmount = Math.min(activeDeductionDetails.amount, Math.max(0, deductionCandidateRow?.gross || 0))
  const activeDeductionSelected = selectedDeductionCandidateIds.has(deductionCandidateKey)
  const selectedDateSet = useMemo(() => new Set(selectedDates), [selectedDates])
  const candidateIds = useMemo(() => candidateRecords.map(candidateIdentity), [candidateRecords])
  const automaticFilters = useMemo(() => ({
    candidateIds: selectedCandidateIds === null ? undefined : [...selectedCandidateIds],
    deductionCandidateIds: [...selectedDeductionCandidateIds],
    paymentTypes: selectedTypes,
    dateScope,
    rangeFromDate,
    rangeToDate,
    dates: dateScope === 'specific' ? [...specificDates] : [],
  }), [dateScope, rangeFromDate, rangeToDate, selectedCandidateIds, selectedDeductionCandidateIds, selectedTypes, specificDates])
  const automaticFilterSignature = useMemo(() => getFilterSignature(automaticFilters), [automaticFilters])
  const selectedCandidateCount = selectedCandidateIds === null ? candidateRecords.length : selectedCandidateIds.size
  const dateSelectionValid = dateScope !== 'range' || Boolean(rangeFromDate && rangeToDate && rangeFromDate <= rangeToDate)
  const filterRequestPending = automaticFilterSignature !== lastAutoFilterSignature.current
  const selectedRecords = useMemo(() => filterCandidateRecords(
    filteredCandidateRecords,
    selectedTypes,
    selectedCandidateIds,
    selectedDateSet,
  ).map((candidate) => {
    const candidateKey = candidateIdentity(candidate)
    const details = candidateDeductionDetails.get(candidateKey) || { amount: 0, entries: [] }
    const applyDeduction = selectedDeductionCandidateIds.has(candidateKey)
    const deductionAmount = applyDeduction
      ? Math.min(details.amount, Math.max(0, getCandidateEarnings(candidate)))
      : 0
    return {
      ...candidate,
      deductions: applyDeduction ? details.entries : [],
      overall_outstanding_deduction: deductionAmount,
    }
  }), [candidateDeductionDetails, filteredCandidateRecords, selectedCandidateIds, selectedDateSet, selectedDeductionCandidateIds, selectedTypes])
  const selectedRows = useMemo(() => flattenCandidateRecords(selectedRecords), [selectedRecords])
  const generatedRows = generatedSheet?.rows || EMPTY_ROWS
  const previewColumns = useMemo(() => getPreviewColumns(generatedRows), [generatedRows])
  const generatedCandidateBreakdown = useMemo(
    () => getGeneratedCandidateBreakdown(generatedSheet?.response),
    [generatedSheet?.response],
  )

  const loadSavedRecords = useCallback(async (from = '', to = '', filters = {}) => {
    if (directMode) {
      requestId.current += 1
      setLoading(true)
      setStep(1)
      setError('')
      setGeneratedSheet(null)
      setSavedMessage('')
      const records = Array.isArray(initialRecords) ? initialRecords : []
      setCandidateRecords(records)
      setAttendanceCandidates([])
      setDeductionDetailsLoading(true)
      setDeductionDetailsError('')
      try {
        setCandidateDeductionDetails(await fetchCandidateDeductionDetails(records))
      } catch (deductionError) {
        console.error('Failed to load candidate outstanding deductions:', deductionError)
        setCandidateDeductionDetails(new Map())
        setDeductionDetailsError('Candidate outstanding deductions could not be loaded.')
      } finally {
        setDeductionDetailsLoading(false)
      }
      setSelectedDeductionCandidateIds(new Set())
      setCandidateRecords(records)
      setFilteredCandidateRecords(records)
      setAttendanceCandidates([])
      setHasLoadedRecords(true)
      const bounds = getSavedDateBounds(records)
      const rangeFrom = from || bounds.first
      const rangeTo = to || bounds.last
      setAttendanceDates(getDateRange(rangeFrom, rangeTo))
      setAttendanceDateRange({ from: rangeFrom, to: rangeTo })
      setAttendanceWarning('')
      const rows = flattenCandidateRecords(records)
      setSelectedCandidateIds(null)
      setCandidateSearch('')
      setDateScope('all')
      setRangeFromDate(rangeFrom)
      setRangeToDate(rangeTo)
      setSpecificDates(new Set())
      setSelectedTypes([...new Set(rows
        .filter((row) => row.payment_type !== 'Deduction')
        .map((row) => String(row.payment_type)))].sort((first, second) => first.localeCompare(second)))
      setIncludeDeductions(records.some((record) => (record.deductions || []).length > 0))
      setLoading(false)
      return
    }
    if (!projectId) return
    const currentRequestId = ++requestId.current
    setLoading(true)
    if (filters.preserveOptions) setAutoFilterFailed(false)
    setStep(1)
    setError('')
    setGeneratedSheet(null)
    setSavedMessage('')
    try {
      const requestedPaymentTypes = [
        ...(filters.paymentTypes || []),
        ...(filters.includeDeductions ? ['Deduction'] : []),
      ]
      const requestedPaymentTypes = filters.paymentTypes || []
      const response = await coreRecruiterAPI.getSavedAttendanceSheet({
        project_id: projectId,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(filters.candidateIds?.length ? { candidate_ids: filters.candidateIds.join(',') } : {}),
        ...(requestedPaymentTypes.length ? { payment_types: requestedPaymentTypes.join(',') } : {}),
        ...(filters.dates?.length ? { dates: filters.dates.join(',') } : {}),
      })
      const records = normalizeSavedCandidateRecords(response?.data ?? response, { id: projectId, name: projectName })
      if (currentRequestId !== requestId.current) return
      setCandidateRecords(records)
      if (!filters.preserveOptions) {
        setDeductionDetailsLoading(true)
        setDeductionDetailsError('')
        try {
          setCandidateDeductionDetails(await fetchCandidateDeductionDetails(records))
          setSelectedDeductionCandidateIds(new Set())
        } catch (deductionError) {
          console.error('Failed to load candidate outstanding deductions:', deductionError)
          setCandidateDeductionDetails(new Map())
          setDeductionDetailsError('Candidate outstanding deductions could not be loaded.')
        } finally {
          setDeductionDetailsLoading(false)
        }
      }
      const bounds = getSavedDateBounds(records)
      const rangeFrom = from || bounds.first
      const rangeTo = to || bounds.last
      const dates = getDateRange(rangeFrom, rangeTo)
      setAttendanceDates(dates)
      setAttendanceDateRange({ from: rangeFrom, to: rangeTo })
      setAttendanceWarning('')
      setAttendanceCandidates(loadAttendanceMatrixFromPayments(records))
      setSelectedCandidateIds(filters.candidateIds ? new Set(filters.candidateIds) : null)
      setDateScope(filters.dateScope || 'all')
      setRangeFromDate(filters.rangeFromDate || rangeFrom)
      setRangeToDate(filters.rangeToDate || rangeTo)
      setSpecificDates(new Set(filters.dates || []))
      const types = [...new Set(flattenCandidateRecords(records)
        .filter((row) => row.payment_type !== 'Deduction')
        .map((row) => String(row.payment_type)))].sort((a, b) => a.localeCompare(b))
      setSelectedTypes(filters.paymentTypes || types)
      setIncludeDeductions(Boolean(filters.includeDeductions))
    } catch (loadError) {
      if (currentRequestId !== requestId.current) return
      console.error('Failed to load saved core team attendance sheet:', loadError)
      setCandidateRecords([])
      setSelectedTypes([])
      const types = [...new Set(flattenCandidateRecords(records)
        .filter((row) => row.payment_type !== 'Deduction')
        .map((row) => String(row.payment_type)))].sort((a, b) => a.localeCompare(b))
      const resolvedFilters = filters.preserveOptions ? filters : {
        candidateIds: undefined,
        paymentTypes: types,
        dateScope: 'all',
        rangeFromDate: rangeFrom,
        rangeToDate: rangeTo,
        dates: [],
      }
      const datesForMatrix = resolvedFilters.dateScope === 'specific'
        ? resolvedFilters.dates || []
        : resolvedFilters.dateScope === 'range'
          ? getDateRange(resolvedFilters.rangeFromDate, resolvedFilters.rangeToDate)
          : dates
      const matrixRecords = filters.preserveOptions
        ? filterCandidateRecords(
          records,
          resolvedFilters.paymentTypes || [],
          resolvedFilters.candidateIds == null ? null : new Set(resolvedFilters.candidateIds),
          new Set(datesForMatrix),
        )
        : records
      if (!filters.preserveOptions) {
        setCandidateRecords(records)
        setAttendanceDates(dates)
      }
      setFilteredCandidateRecords(matrixRecords)
      setHasLoadedRecords(true)
      setAutoFilterFailed(false)
      setAttendanceDateRange({ from: rangeFrom, to: rangeTo })
      setAttendanceWarning('')
      setAttendanceCandidates(loadAttendanceMatrixFromPayments(matrixRecords))
      if (!filters.preserveOptions) {
        setSelectedCandidateIds(resolvedFilters.candidateIds ? new Set(resolvedFilters.candidateIds) : null)
        setDateScope(resolvedFilters.dateScope)
        setRangeFromDate(resolvedFilters.rangeFromDate)
        setRangeToDate(resolvedFilters.rangeToDate)
        setSpecificDates(new Set(resolvedFilters.dates))
        setSelectedTypes(resolvedFilters.paymentTypes)
      }
      lastAutoFilterSignature.current = getFilterSignature(resolvedFilters)
    } catch (loadError) {
      if (currentRequestId !== requestId.current) return
      console.error('Failed to load saved core team attendance sheet:', loadError)
      if (!filters.preserveOptions) {
        setCandidateRecords([])
        setFilteredCandidateRecords([])
        setSelectedTypes([])
      } else {
        setAutoFilterFailed(true)
      }
      setHasLoadedRecords(true)
      setError('Saved attendance earnings could not be loaded.')
    } finally {
      if (currentRequestId === requestId.current) setLoading(false)
    }
  }, [directMode, initialRecords, projectId, projectName, project])

  useEffect(() => {
    if (!isOpen) {
      requestId.current += 1
      return
    }
    setFromDate(initialFromDate)
    setToDate(initialToDate)
    setCandidateRecords([])
    setAttendanceCandidates([])
    setAttendanceDates([])
    setAttendanceDateRange({ from: '', to: '' })
    setGeneratedSheet(null)
    setSheetName('')
    setReviewed(false)
    setIncludeDeductions(false)
    loadSavedRecords(initialFromDate, initialToDate)
  }, [isOpen, initialFromDate, initialToDate, loadSavedRecords, projectId])

  const generatePaymentSheet = useCallback(async () => {
    if (!selectedTypes.length && !includeDeductions) {
      setError('Select at least one payment type or include deductions.')
    setFilteredCandidateRecords([])
    setCandidateDeductionDetails(new Map())
    setSelectedDeductionCandidateIds(new Set())
    setDeductionDetailsError('')
    setAttendanceDateRange({ from: '', to: '' })
    setHasLoadedRecords(false)
    setGeneratedSheet(null)
    setSheetName('')
    setReviewed(false)
    loadSavedRecords(initialFromDate, initialToDate)
  }, [isOpen, initialFromDate, initialToDate, loadSavedRecords, projectId])

  useEffect(() => {
    if (!isOpen || directMode || loading || !candidateRecords.length) return undefined
    if (!dateSelectionValid) return undefined
    if (automaticFilterSignature === lastAutoFilterSignature.current) return undefined

    const timer = setTimeout(() => {
      lastAutoFilterSignature.current = automaticFilterSignature
      setGeneratedSheet(null)
      setSavedMessage('')
      loadSavedRecords(
        dateScope === 'range' ? rangeFromDate : fromDate,
        dateScope === 'range' ? rangeToDate : toDate,
        { ...automaticFilters, preserveOptions: true },
      )
    }, 350)

    return () => clearTimeout(timer)
  }, [automaticFilterSignature, automaticFilters, candidateRecords.length, dateScope, dateSelectionValid, directMode, fromDate, isOpen, loadSavedRecords, loading, rangeFromDate, rangeToDate, selectedDeductionCandidateIds, specificDates.size, toDate])

  const generatePaymentSheet = useCallback(async () => {
    if (!selectedTypes.length && !selectedDeductionCandidateIds.size) {
      setError('Select at least one payment type or choose a candidate deduction.')
      return
    }
    if (!selectedRecords.length) {
      setError('No saved rows match the selected payment types.')
      return
    }
    setGenerating(true)
    setError('')
    setGeneratedSheet(null)
    setReviewed(false)
    setSavedMessage('')
    try {
      const response = await recruiterAPI.generateTimingExpensePaymentSheet({
        type: 'attendance',
        attendance: selectedRecords,
      })
      const body = response?.data ?? response
      const rows = getGeneratedRows(body)
      if (!Array.isArray(rows) || !rows.length) throw new Error('Payment sheet service returned no rows.')
      setGeneratedSheet({ rows, response: body, savedStatus: '' })
      const payload = buildAttendancePaymentSheetPayload(selectedRecords, { id: projectId, name: projectName })
      const response = await coreRecruiterAPI.generateAttendancePaymentSheet(payload)
      const body = response?.data ?? response
      const rows = getGeneratedRows(body)
      if (!Array.isArray(rows) || !rows.length) throw new Error('Payment sheet service returned no rows.')
      if (payload.attendance.some((candidate) => candidate.deductions.length > 0)) {
        await coreRecruiterAPI.saveAttendancePaymentSheet(payload.attendance)
      }
      setGeneratedSheet({ rows, response: body, savedStatus: '' })
      setGeneratedSheetView('sheet')
      setSheetName(`${projectName} payments${fromDate || toDate ? ` ${fromDate || 'start'} to ${toDate || 'end'}` : ''}`)
      setStep(2)
    } catch (generationError) {
      console.error('Failed to generate core team payment sheet:', generationError)
      setError(generationError.message || 'Unable to generate the payment sheet.')
    } finally {
      setGenerating(false)
    }
  }, [fromDate, projectName, selectedRecords, selectedTypes])

  useEffect(() => {
    if (!directMode || loading || generating || generatedSheet || !candidateRecords.length || directGenerationStarted.current) return
    directGenerationStarted.current = true
    generatePaymentSheet()
  }, [candidateRecords.length, directMode, generatedSheet, generatePaymentSheet, generating, loading])

  const savePaymentSheet = useCallback(async (status) => {
    if (!generatedRows.length || savingStatus) return
    if (!sheetName.trim()) {
      setError('Enter a name for this payment sheet.')
      return
    }
    if (status === 'ready_for_payment' && !reviewed) return
    setSavingStatus(status)
    setError('')
    setSavedMessage('')
    try {
      await recruiterAPI.confirmTimingExpensePaymentSheet({
      await coreRecruiterAPI.confirmAttendancePaymentSheet({
        type: 'attendance',
        user_id: user?.userId || 1,
        status,
        sheet_name: sheetName.trim(),
        payment_sheet: generatedRows,
        attendance_ids: getAttendanceIds(selectedRecords),
        deduction_allocations: status === 'ready_for_payment'
          ? selectedRecords.filter((candidate) => Number(candidate.overall_outstanding_deduction) > 0).map((candidate) => ({
            candidate_id: candidate.candidate_id,
            amount: Number(candidate.overall_outstanding_deduction),
          }))
          : [],
      })
      setGeneratedSheet((current) => ({ ...current, savedStatus: status }))
      setSavedMessage(status === 'draft' ? 'Payment sheet saved as draft.' : 'Payment sheet confirmed and ready for payment.')
    } catch (saveError) {
      console.error('Failed to save core team payment sheet:', saveError)
      setError(saveError.message || 'Unable to save the payment sheet.')
    } finally {
      setSavingStatus('')
    }
  }, [generatedRows, reviewed, savingStatus, selectedRecords, sheetName, user?.userId])

  const toggleType = (type, checked) => {
    setSelectedTypes((current) => checked ? [...new Set([...current, type])] : current.filter((value) => value !== type))
    setGeneratedSheet(null)
    setSavedMessage('')
  }

  const footer = useMemo(() => (
    <div className="core-saved-sheet-footer">
      {step === 2 && <button type="button" className="btn btn-outline" onClick={() => { setStep(1); setError('') }} disabled={Boolean(savingStatus)}>Back</button>}
      {!embedded && <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>}
      {step === 1 && !directMode && <button type="button" className="btn btn-outline" onClick={() => loadSavedRecords(
        dateScope === 'range' ? rangeFromDate : fromDate,
        dateScope === 'range' ? rangeToDate : toDate,
        {
          candidateIds: selectedCandidateIds === null ? undefined : [...selectedCandidateIds],
          paymentTypes: selectedTypes,
          includeDeductions,
          dateScope,
          rangeFromDate,
          rangeToDate,
          dates: dateScope === 'specific' ? [...specificDates] : undefined,
        },
      )} disabled={loading || (dateScope === 'range' && !dateSelectionValid) || (dateScope === 'specific' && specificDates.size === 0)}>
        <FontAwesomeIcon icon={faRotate} /> {loading ? 'Loading...' : 'Apply server filters'}
      </button>}
      {step === 1 && <button type="button" className="btn btn-primary" onClick={generatePaymentSheet} disabled={loading || generating || !dateSelectionValid || selectedRecords.length === 0}>
  const resetFilters = useCallback(() => {
    setCandidateSearch('')
    setGeneratedSheet(null)
    setSavedMessage('')
    loadSavedRecords(fromDate, toDate)
  }, [fromDate, loadSavedRecords, toDate])

  const footer = useMemo(() => (
    <div className="core-saved-sheet-footer">
      {step === 1 && !directMode && <button type="button" className="btn btn-outline core-saved-sheet-reset" onClick={resetFilters} disabled={loading}>
        <FontAwesomeIcon icon={faRotate} /> Reset filters
      </button>}
      {step === 2 && <button type="button" className="btn btn-outline" onClick={() => { setStep(1); setError('') }} disabled={Boolean(savingStatus)}>Back</button>}
      {!embedded && <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>}
      {step === 1 && <button type="button" className="btn btn-primary" onClick={generatePaymentSheet} disabled={loading || generating || filterRequestPending || autoFilterFailed || !dateSelectionValid || selectedRecords.length === 0}>
        {generating ? 'Generating...' : 'Generate payment sheet'}
      </button>}
      {step === 2 && generatedSheet?.savedStatus !== 'ready_for_payment' && <>
        <button type="button" className="btn btn-outline" onClick={() => savePaymentSheet('draft')} disabled={Boolean(savingStatus) || generatedSheet.savedStatus === 'draft'}>
          {savingStatus === 'draft' ? 'Saving...' : 'Save to draft'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => savePaymentSheet('ready_for_payment')} disabled={Boolean(savingStatus) || !reviewed}>
          {savingStatus === 'ready_for_payment' ? 'Confirming...' : 'Confirm ready to pay'}
        </button>
      </>}
    </div>
  ), [dateScope, dateSelectionValid, embedded, fromDate, generatedSheet, generatePaymentSheet, generating, includeDeductions, loadSavedRecords, loading, onClose, rangeFromDate, rangeToDate, reviewed, savePaymentSheet, savingStatus, selectedCandidateIds, selectedDates, selectedRecords.length, selectedTypes, specificDates, step, toDate])
  ), [directMode, embedded, fromDate, generatedSheet, generatePaymentSheet, generating, loadSavedRecords, loading, onClose, resetFilters, reviewed, savePaymentSheet, savingStatus, selectedRecords.length, step, toDate])

  useEffect(() => {
    if (!embedded || !onFooterChange) return undefined
    onFooterChange(footer)
    return () => onFooterChange(null)
  }, [embedded, footer, onFooterChange])

  const content = (
    <div className="core-saved-sheet">
        <header className="core-saved-sheet-inline-header">
          <div><span>STEP {step} OF 2 · {step === 1 ? 'CUMULATIVE ATTENDANCE' : 'PAYMENT SHEET'}</span><h2>{step === 1 ? 'Final cumulative attendance' : projectName}</h2></div>
          <strong>{attendanceDateRange.from || 'All dates'}{attendanceDateRange.to ? ` to ${attendanceDateRange.to}` : ''}</strong>
        </header>
        {error && <div className="attendance-message error" role="alert">{error}</div>}
        {loading ? <div className="core-saved-sheet-empty" role="status">{directMode ? 'Preparing payment sheet...' : 'Loading saved attendance earnings...'}</div> : <>
        {deductionDetailsLoading && <div className="core-saved-sheet-empty" role="status">Loading candidate outstanding deductions...</div>}
        {deductionDetailsError && <div className="attendance-message error" role="status">{deductionDetailsError} Deduction application is unavailable until balances load.</div>}
        {loading && !hasLoadedRecords ? <div className="core-saved-sheet-empty" role="status">{directMode ? 'Preparing payment sheet...' : 'Loading saved attendance earnings...'}</div> : <>
          {loading && <div className="core-saved-sheet-empty" role="status">Updating attendance filters...</div>}
          {attendanceWarning && <div className="attendance-message" role="status">{attendanceWarning}</div>}
          {directMode && generating && <div className="core-saved-sheet-empty" role="status">Preparing payment sheet from the attendance and earnings you just created...</div>}
          {!directMode && step === 1 && <>
          <section className="core-saved-sheet-section">
            <header><h3>Saved attendance earnings</h3><span>{savedRows.length} entries · {matrixRows.length} team members</span></header>
            <div className="core-saved-sheet-matrix-title">{projectName} Core Team Attendance and Payment Sheet</div>
            <div className="core-saved-sheet-matrix-range">Date range: {attendanceDateRange.from || '—'} to {attendanceDateRange.to || '—'}</div>
            <div className="core-saved-sheet-matrix-range">Showing {selectedDates.length} of {attendanceDates.length} dates</div>
            {matrixRows.length ? <div className="core-saved-sheet-table-wrap core-saved-sheet-matrix-wrap">
              <table className="core-saved-sheet-table core-saved-sheet-matrix">
                <thead><tr>
                  <th>S.No</th><th>Candidate Name</th><th>Mobile</th><th>Aadhaar</th>
                  {attendanceDates.map((date) => <th className="attendance-date" key={date}>{date}</th>)}
                  <th>Worked Days</th>{includeBasePay && <><th>Average Base Rate / Day</th><th>Base Amount</th></>}
                  {allowanceTypes.map((type) => <th key={type}>{type}</th>)}
                  <th>Gross Amount</th><th>Deduction</th><th>Deduction Note</th><th>Net Amount</th>
                  {selectedDates.map((date) => <th className="attendance-date" key={date}>{date}</th>)}
                  <th>Worked Days</th>{includeBasePay && <><th>Average Base Rate / Day</th><th>Base Amount</th></>}
                  {allowanceTypes.map((type) => <th key={type}>{type}</th>)}
                  <th>Gross Amount</th>{selectedDeductionCandidateIds.size > 0 && <><th>Deduction</th><th>Deduction Note</th></>}<th>Net Amount</th>
                </tr></thead>
                <tbody>
                  {matrixRows.map((row, index) => {
                    const candidateKey = candidateIdentity(row.candidate)
                    return <tr key={candidateKey}>
                      <td>{index + 1}</td>
                      <td>{row.candidate.candidate_name || 'Unknown'}</td>
                      <td>{row.candidate.mobile || '—'}</td>
                      <td>{row.candidate.aadhaar || '—'}</td>
                      {attendanceDates.map((date) => {
                    const deductionDetails = candidateDeductionDetails.get(candidateKey) || { amount: 0, entries: [] }
                    return <tr key={candidateKey}>
                      <td>{index + 1}</td>
                      <td><span className="core-saved-sheet-candidate-name">{row.candidate.candidate_name || 'Unknown'}{deductionDetails.amount > 0 && <button
                        type="button"
                        className={`core-saved-sheet-deduction-indicator${selectedDeductionCandidateIds.has(candidateKey) ? ' is-selected' : ''}`}
                        onClick={() => setDeductionCandidateKey(candidateKey)}
                        aria-label={`Review outstanding deduction of ${formatMoney(deductionDetails.amount)} for ${row.candidate.candidate_name || 'candidate'}`}
                        title={`Outstanding deduction: ${formatMoney(deductionDetails.amount)}`}
                      ><FontAwesomeIcon icon={faCircleExclamation} /></button>}</span></td>
                      <td>{row.candidate.mobile || '—'}</td>
                      <td>{row.candidate.aadhaar || '—'}</td>
                      {selectedDates.map((date) => {
                        const hasSavedEarning = savedEarningsByCandidateAndDate.has(`${candidateKey}|${date}`)
                        const status = getMatrixStatus(row.candidate.attendance[date], hasSavedEarning)
                        return <td className="attendance-date" key={date} title={hasSavedEarning ? 'Saved earnings on this date' : undefined} aria-label={`${status}${hasSavedEarning ? ', saved earnings' : ''}`}>
                          <span>{status}</span>
                        </td>
                      })}
                      <td>{row.workedDays}</td>{includeBasePay && <><td>{formatMoney(row.baseRate)}</td><td>{formatMoney(row.baseAmount)}</td></>}
                      {allowanceTypes.map((type) => <td key={type}>{formatMoney(row.allowanceTotals[type])}</td>)}
                      <td>{formatMoney(row.gross)}</td><td>{formatMoney(row.deduction)}</td><td>{row.deductionNote || ''}</td><td><strong>{formatMoney(row.net)}</strong></td>
                      <td>{formatMoney(row.gross)}</td>{selectedDeductionCandidateIds.size > 0 && <><td>{formatMoney(row.deduction)}</td><td>{row.deductionNote || ''}</td></>}<td><strong>{formatMoney(row.net)}</strong></td>
                    </tr>
                  })}
                  <tr className="core-saved-sheet-total-row">
                    <td>TOTAL</td><td></td><td></td><td></td>
                    {attendanceDates.map((date) => <td key={date}></td>)}
                    <td>{matrixTotals.workedDays}</td>{includeBasePay && <><td></td><td>{formatMoney(matrixTotals.baseAmount)}</td></>}
                    {allowanceTypes.map((type) => <td key={type}>{formatMoney(matrixTotals.allowanceTotals[type])}</td>)}
                    <td>{formatMoney(matrixTotals.gross)}</td><td>{formatMoney(matrixTotals.deduction)}</td><td></td><td>{formatMoney(matrixTotals.net)}</td>
                    {selectedDates.map((date) => <td key={date}></td>)}
                    <td>{matrixTotals.workedDays}</td>{includeBasePay && <><td></td><td>{formatMoney(matrixTotals.baseAmount)}</td></>}
                    {allowanceTypes.map((type) => <td key={type}>{formatMoney(matrixTotals.allowanceTotals[type])}</td>)}
                    <td>{formatMoney(matrixTotals.gross)}</td>{selectedDeductionCandidateIds.size > 0 && <><td>{formatMoney(matrixTotals.deduction)}</td><td></td></>}<td>{formatMoney(matrixTotals.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div> : <div className="core-saved-sheet-empty">No saved attendance earnings for this project and period.</div>}
          </section>

          <section className="core-saved-sheet-section core-saved-sheet-targeting">
            <header><h3>Who and when</h3><span>{selectedCandidateCount} of {candidateRecords.length} candidates · {selectedDates.length} of {attendanceDates.length} dates</span></header>
            <div className="core-saved-sheet-selection-grid">
              <fieldset>
                <legend>Candidates</legend>
                <div className="core-saved-sheet-type-actions">
                  <button type="button" onClick={() => setSelectedCandidateIds(null)}>Select all</button>
                  <button type="button" onClick={() => setSelectedCandidateIds(new Set())}>Clear</button>
                </div>
                <input className="form-control" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search candidates" aria-label="Search candidates" />
                <div className="core-saved-sheet-option-list">
                  {candidateRecords.filter((candidate) => `${candidate.candidate_name} ${candidate.mobile} ${candidate.aadhaar} ${candidateIdentity(candidate)}`.toLowerCase().includes(candidateSearch.trim().toLowerCase())).map((candidate) => {
                    const candidateId = candidateIdentity(candidate)
                    const checked = selectedCandidateIds === null || selectedCandidateIds.has(candidateId)
                    return <label key={candidateId}>
                      <input type="checkbox" checked={checked} onChange={(event) => setSelectedCandidateIds((current) => {
                        const next = new Set(current === null ? candidateIds : current)
                        if (event.target.checked) next.add(candidateId)
                        else next.delete(candidateId)
                        return next
                      })} />
                      <span>{candidate.candidate_name || 'Unknown'}<small>{candidate.mobile || candidateId}</small></span>
                    </label>
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend>Dates</legend>
                <div className="core-saved-sheet-date-scopes" role="group" aria-label="Dates to include">
                  <button type="button" className={dateScope === 'all' ? 'active' : ''} aria-pressed={dateScope === 'all'} onClick={() => setDateScope('all')}>All dates</button>
                  <button type="button" className={dateScope === 'range' ? 'active' : ''} aria-pressed={dateScope === 'range'} onClick={() => setDateScope('range')}>Date range</button>
                  <button type="button" className={dateScope === 'specific' ? 'active' : ''} aria-pressed={dateScope === 'specific'} onClick={() => setDateScope('specific')}>Specific dates</button>
                </div>
                {dateScope === 'range' && <div className="core-saved-sheet-date-range">
                  <label><span>From</span><input className="form-control" type="date" min={attendanceDates[0]} max={attendanceDates[attendanceDates.length - 1]} value={rangeFromDate} onChange={(event) => setRangeFromDate(event.target.value)} /></label>
                  <label><span>To</span><input className="form-control" type="date" min={attendanceDates[0]} max={attendanceDates[attendanceDates.length - 1]} value={rangeToDate} onChange={(event) => setRangeToDate(event.target.value)} /></label>
                </div>}
                {dateScope === 'range' && !dateSelectionValid && <p className="core-saved-sheet-note">Choose a valid date range to continue.</p>}
                {dateScope === 'specific' && <>
                  <div className="core-saved-sheet-type-actions">
                    <button type="button" onClick={() => setSpecificDates(new Set(attendanceDates))}>Select all</button>
                    <button type="button" onClick={() => setSpecificDates(new Set())}>Clear</button>
                  </div>
                  <div className="core-saved-sheet-option-list">
                    {attendanceDates.map((date) => <label key={date}>
                      <input type="checkbox" checked={specificDates.has(date)} onChange={(event) => setSpecificDates((current) => {
                        const next = new Set(current)
                        if (event.target.checked) next.add(date)
                        else next.delete(date)
                        return next
                      })} />
                      <span>{date}</span>
                    </label>)}
                  <div className="core-saved-sheet-calendar-actions">
                    <span>{specificDates.size} dates selected</span>
                    <button type="button" onClick={() => setSpecificDates(new Set(attendanceDates))}>Select all</button>
                    <button type="button" onClick={() => setSpecificDates(new Set())}>Clear dates</button>
                  </div>
                  <div className="core-saved-sheet-calendar-wrap">
                    {attendanceDates.length ? <DayPicker
                      mode="multiple"
                      className="core-saved-sheet-calendar"
                      defaultMonth={parseLocalDate(attendanceDates[0])}
                      selected={selectedDates.map(parseLocalDate)}
                      onSelect={(dates) => setSpecificDates(new Set((dates || []).map(formatLocalDate)))}
                      startMonth={parseLocalDate(attendanceDates[0])}
                      endMonth={parseLocalDate(attendanceDates[attendanceDates.length - 1])}
                      disabled={{
                        before: parseLocalDate(attendanceDates[0]),
                        after: parseLocalDate(attendanceDates[attendanceDates.length - 1]),
                      }}
                    /> : <div className="core-saved-sheet-empty">No dates available to select.</div>}
                  </div>
                </>}
              </fieldset>
            </div>
            <div className="core-saved-sheet-type-actions">
              <button type="button" className="btn btn-outline" onClick={() => loadSavedRecords(fromDate, toDate)} disabled={loading}>
                Reset filters
              </button>
            </div>
          </section>

          <section className="core-saved-sheet-section core-saved-sheet-selection">
            <header><h3>Payment sheet contents</h3><span>{selectedRows.length} selected entries</span></header>
            <div className="core-saved-sheet-type-actions">
              <button type="button" onClick={() => { setSelectedTypes(paymentTypes); setGeneratedSheet(null); setSavedMessage('') }}>Select all types</button>
              <button type="button" onClick={() => { setSelectedTypes([]); setGeneratedSheet(null); setSavedMessage('') }}>Clear types</button>
            </div>
            <div className="core-saved-sheet-types">
              {paymentTypes.length ? paymentTypes.map((type) => <label key={type}>
                <input type="checkbox" checked={selectedTypes.includes(type)} onChange={(event) => toggleType(type, event.target.checked)} />
                <span>{type}</span>
              </label>) : <span className="core-saved-sheet-empty-label">No earning types are available.</span>}
              {savedRows.some((row) => row.payment_type === 'Deduction') && <label className="core-saved-sheet-deduction-option">
                <input type="checkbox" checked={includeDeductions} onChange={(event) => { setIncludeDeductions(event.target.checked); setGeneratedSheet(null); setSavedMessage('') }} />
                <span>Include candidate deductions</span>
              </label>}
            </div>
            {includeDeductions && <p className="core-saved-sheet-note">Deductions apply to this generated sheet as a whole, not to an individual earning type.</p>}
            </div>
            {selectedDeductionCandidateIds.size > 0 && <p className="core-saved-sheet-note">Selected candidate deductions will be included and subtracted from their individual net amounts.</p>}
          </section>
          </>}

          {step === 2 && generatedSheet && <section className="core-saved-sheet-section">
            <header><h3>Generated payment sheet</h3><span>{generatedRows.length} rows</span></header>
            <label className="core-saved-sheet-name"><span>Sheet name</span><input className="form-control" value={sheetName} maxLength={100} onChange={(event) => setSheetName(event.target.value)} /></label>
            <div className="core-saved-sheet-table-wrap">
            <div className="core-saved-sheet-generated-tabs" role="tablist" aria-label="Generated payment sheet views">
              <button type="button" role="tab" aria-selected={generatedSheetView === 'sheet'} onClick={() => setGeneratedSheetView('sheet')}>Payout rows</button>
              <button type="button" role="tab" aria-selected={generatedSheetView === 'calculation'} disabled={!generatedCandidateBreakdown.length} onClick={() => setGeneratedSheetView('calculation')}>Calculation breakdown</button>
            </div>
            {generatedSheetView === 'sheet' && <div className="core-saved-sheet-table-wrap">
              <table className="core-saved-sheet-table core-saved-sheet-preview-table">
                <thead><tr><th>#</th>{previewColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>{generatedRows.map((row, rowIndex) => <tr key={rowIndex}>
                  <td>{rowIndex + 1}</td>
                  {previewColumns.map((column, columnIndex) => {
                    const value = getPreviewValue(row, column, columnIndex)
                    return <td key={`${rowIndex}-${columnIndex}`}>{value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                  })}
                </tr>)}</tbody>
              </table>
            </div>
            </div>}
            {generatedSheetView === 'calculation' && (generatedCandidateBreakdown.length ? <>
              <p className="core-saved-sheet-calculation-note">Balance = total amount + OT amount − deduction amount. Component amounts are returned by the payment generator.</p>
              <div className="core-saved-sheet-table-wrap">
                <table className="core-saved-sheet-table core-saved-sheet-calculation-table">
                  <thead><tr><th>Candidate</th><th>Candidate ID</th><th>Earnings breakdown</th><th>Total amount</th></tr></thead>
                  <tbody>{generatedCandidateBreakdown.map((candidate, index) => <tr key={`${candidate.candidate_id || candidate.registration_id || candidate.candidate_name || 'candidate'}-${index}`}>
                    <td>{candidate.candidate_name || candidate.name || 'Unknown'}</td>
                    <td>{candidate.candidate_id ?? candidate.registration_id ?? '—'}</td>
                    <td>{Array.isArray(candidate.earnings_breakdown) && candidate.earnings_breakdown.length ? <ul className="core-saved-sheet-earnings-breakdown">
                      {candidate.earnings_breakdown.map((component, componentIndex) => {
                        const componentName = component.component_name || component.payment_type || component.name || component.component_code || `Component ${componentIndex + 1}`
                        const componentAmount = component.amount ?? component.total_amt ?? component.total_amount
                        const unit = component.hours != null ? 'hour' : component.days != null ? 'day' : ''
                        const quantity = component.hours ?? component.days
                        const unitDetails = [
                          quantity != null && `${quantity} ${unit}${Number(quantity) === 1 ? '' : 's'}`,
                          component.rate != null && `${formatMoney(component.rate)}/${unit || 'unit'}`,
                        ].filter(Boolean).join(' · ')
                        return <li key={`${component.component_code || componentName}-${componentIndex}`}>
                          <span>{componentName}{unitDetails && <small>{unitDetails}</small>}</span>
                          <strong>{componentAmount == null ? '—' : formatMoney(componentAmount)}</strong>
                        </li>
                      })}
                    </ul> : <span className="core-saved-sheet-empty-label">No component breakdown returned</span>}</td>
                    <td>{candidate.total_amt == null ? '—' : formatMoney(candidate.total_amt)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </> : <div className="core-saved-sheet-empty">The payment generator did not return candidate calculation details.</div>)}
            {generatedSheet.savedStatus !== 'ready_for_payment' && <label className="core-saved-sheet-ack">
              <input type="checkbox" checked={reviewed} disabled={Boolean(savingStatus)} onChange={(event) => setReviewed(event.target.checked)} />
              <span>I reviewed this payment sheet and confirm it is ready to be paid.</span>
            </label>}
          </section>}
          {savedMessage && <div className="attendance-message success" role="status">{savedMessage}</div>}
        </>}
    </div>
  )

  if (embedded) return <div className="core-saved-sheet-embedded">{content}</div>
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Core team attendance sheet · ${projectName}`} maxWidth="1180px" footer={footer}>
      {content}
    </Modal>
  )
  const deductionReviewModal = (
    <Modal
      isOpen={Boolean(deductionCandidate)}
      onClose={() => setDeductionCandidateKey('')}
      title={`Outstanding deduction · ${deductionCandidate?.candidate_name || ''}`}
      maxWidth="440px"
      zIndex={12000}
      footer={<button type="button" className="btn btn-outline" onClick={() => setDeductionCandidateKey('')}>Close</button>}
    >
      {deductionCandidate && <section className="core-saved-sheet-deduction-review">
        <div><span>Overall outstanding</span><strong>{formatMoney(activeDeductionDetails.amount)}</strong></div>
        {activeDeductionDetails.entries.length > 0 && <ul>
          {activeDeductionDetails.entries.map((entry) => <li key={entry.id}>
            <span>{entry.note || 'Deduction'}</span><strong>{formatMoney(entry.amount)}</strong>
          </li>)}
        </ul>}
        <label className="core-saved-sheet-deduction-apply">
          <input
            type="checkbox"
            checked={activeDeductionSelected}
            disabled={deductionDetailsLoading || Boolean(deductionDetailsError)}
            onChange={(event) => setSelectedDeductionCandidateIds((current) => {
              const next = new Set(current)
              if (event.target.checked) next.add(deductionCandidateKey)
              else next.delete(deductionCandidateKey)
              setGeneratedSheet(null)
              setSavedMessage('')
              return next
            })}
          />
          <span>{activeDeductionSelected ? 'Deduction will be included in this sheet' : `Deduct up to ${formatMoney(activeDeductionAppliedAmount)} in this sheet`}</span>
        </label>
        {deductionDetailsError && <p className="core-saved-sheet-note">{deductionDetailsError}</p>}
      </section>}
    </Modal>
  )

  if (embedded) return <>
    <div className="core-saved-sheet-embedded">{content}</div>
    {deductionReviewModal}
  </>
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Core team attendance sheet · ${projectName}`} maxWidth="1180px" footer={footer}>
        {content}
      </Modal>
      {deductionReviewModal}
    </>
  )
}
