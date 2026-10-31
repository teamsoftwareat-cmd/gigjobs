import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons'
import { coreRecruiterAPI, recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import * as XLSX from 'xlsx-js-style'
import CandidateAttendanceCalendar from './CandidateAttendanceCalendar'
import './CoreTeamPaymentSheet.css'

const PAGE_SIZE = 500
const ALLOWANCE_TYPES = [
  'Travel Day Meal Allowance',
  'Food Allowance',
  'Ground Visit',
  'Training',
  'Laundry',
  'Other Allowance',
  'Overtime',
]
const ATTENDANCE_CELL_STYLES = {
  P: { fill: { fgColor: { rgb: 'D9EAD3' } }, font: { color: { rgb: '274E13' }, bold: true } },
  H: { fill: { fgColor: { rgb: 'D9EAF7' } }, font: { color: { rgb: '0B5394' }, bold: true } },
  T: { fill: { fgColor: { rgb: 'FCE5CD' } }, font: { color: { rgb: '783F04' }, bold: true } },
  A: { fill: { fgColor: { rgb: 'F4CCCC' } }, font: { color: { rgb: '990000' }, bold: true } },
}

const getList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload?.data && !Array.isArray(payload.data)) {
    const nested = getList(payload.data)
    if (nested.length) return nested
  }
  for (const key of ['data', 'records', 'items', 'results', 'attendance', 'projects']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

const getRecordValue = (record, keys, fallback = '') => {
  for (const key of keys) {
    const value = record?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

const normalizeDate = (value) => {
  if (!value) return ''
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const getDateRange = (from, to) => {
  const dates = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

const normalizeAttendanceStatus = (record) => {
  const value = String(getRecordValue(record, ['status', 'attendance_status', 'attendanceStatus'])).trim().toLowerCase()
  if (['half', 'h'].includes(value)) return 'half'
  if (['present', 'late', 'p', 'pr', '1'].includes(value)) return 'present'
  if (['absent', 'a', 'ab', 'missing', 'not marked', 'not_marked'].includes(value)) return 'absent'
  return getRecordValue(record, ['clock_in', 'clockIn', 'check_in_time', 'checkInTime', 'check_in']) ? 'present' : 'absent'
}

const getAttendanceKind = (record, sourceProjectId, projectTitle) => {
  const project = String(getRecordValue(record, ['project_name', 'projectName', 'project_title', 'projectTitle', 'project'], '')).toLowerCase()
  const location = String(getRecordValue(record, ['location_name', 'locationName', 'location'], '')).toLowerCase()
  const source = String(sourceProjectId || '').toLowerCase()
  if (source === 'home' || /\bhome\b/.test(`${project} ${location}`)) return 'home'
  if (source === 'travel' || /\btravel\b/.test(`${project} ${location}`)) return 'travel'
  return 'project'
}

const candidateKeyFor = (record) => String(getRecordValue(record, [
  'candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'worker_id', 'id',
  'mobile', 'phone', 'candidate_name', 'worker_name', 'name',
]))

async function fetchProjectRecords(api, projectId, from, to) {
  const records = []
  let offset = 0
  while (true) {
    const response = await api({ projectId, project_id: projectId, from, to, offset, limit: PAGE_SIZE })
    let payload = response?.data ?? {}
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload) } catch { payload = {} }
    }
    const rows = getList(payload)
    records.push(...rows.map((record) => ({ ...record, _coreSheetSourceProjectId: projectId })))
    const total = Number(payload?.total ?? payload?.count ?? payload?.total_count ?? payload?.meta?.total)
    offset += rows.length
    if (!rows.length || rows.length < PAGE_SIZE || (Number.isFinite(total) && offset >= total)) break
  }
  return records
}

const normalizeProjectId = (value) => String(value || '').trim().replace(/^(proj_|project_)/i, '').toLowerCase()
const normalizeProjectName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

function matchesSelectedProject(record, projectId, projectTitle) {
  const nestedProject = record?.project
  const recordProjectId = getRecordValue(record, ['project_id', 'projectId', 'projectID'], getRecordValue(nestedProject, ['id', 'project_id', 'projectId']))
  if (recordProjectId) return normalizeProjectId(recordProjectId) === normalizeProjectId(projectId)

  const recordProjectName = getRecordValue(
    record,
    ['project_name', 'projectName', 'project_title', 'projectTitle'],
    typeof nestedProject === 'string' ? nestedProject : getRecordValue(nestedProject, ['name', 'project_name', 'projectName', 'title']),
  )
  if (recordProjectName && projectTitle) return normalizeProjectName(recordProjectName) === normalizeProjectName(projectTitle)
  return true
}

async function loadCoreAttendanceData(projectId, fromDate, toDate, projectType, projectTitle) {
  const dateRange = getDateRange(fromDate, toDate)
  const projectApi = projectType === 'written' || projectType === 'written_exam'
    ? coreRecruiterAPI.getWrittenExamAttendanceRecords
    : coreRecruiterAPI.getAttendanceRecords
  const [projectRows, homeRows, travelRows] = await Promise.all([
    fetchProjectRecords(projectApi, projectId, fromDate, toDate),
    fetchProjectRecords(coreRecruiterAPI.getAttendanceRecords, 'Home', fromDate, toDate),
    fetchProjectRecords(coreRecruiterAPI.getAttendanceRecords, 'Travel', fromDate, toDate),
  ])
  const selectedProjectRows = projectRows.filter((record) => matchesSelectedProject(record, projectId, projectTitle))
  const projectCandidateKeys = new Set(selectedProjectRows.map(candidateKeyFor).filter(Boolean))
  const relevantHomeRows = homeRows.filter((record) => projectCandidateKeys.has(candidateKeyFor(record)))
  const relevantTravelRows = travelRows.filter((record) => projectCandidateKeys.has(candidateKeyFor(record)))
  return {
    dateRange,
    candidates: buildCandidates([...selectedProjectRows, ...relevantHomeRows, ...relevantTravelRows], dateRange, projectTitle),
  }
}

function buildCandidates(records, dates, projectTitle) {
  const candidates = new Map()
  records.forEach((record) => {
    const key = candidateKeyFor(record)
    const date = normalizeDate(getRecordValue(record, ['date', 'attendance_date', 'attendanceDate']))
    if (!key || !dates.includes(date)) return
    if (!candidates.has(key)) { 
      candidates.set(key, {
        key,
        id: String(getRecordValue(record, ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'worker_id', 'id'], key)),
        registrationId: String(getRecordValue(record, ['registration_id', 'registrationId', 'candidate_id', 'candidateId'], '')),
        name: String(getRecordValue(record, ['candidate_name', 'worker_name', 'worker', 'name', 'full_name', 'fullName'], 'Unknown')),
        mobile: String(getRecordValue(record, ['mobile', 'phone', 'whatsapp', 'contact'], '')),
        aadhaar: String(getRecordValue(record, ['aadhaar', 'aadhar', 'aadhaar_number', 'aadhar_number'], '')),
        source: String(getRecordValue(record, ['source', 'candidate_source', 'staff_source'], '')),
        location: String(getRecordValue(record, ['location_name', 'locationName', 'location'], '')),
        attendance: {},
      })
    }
    const candidate = candidates.get(key)
    const entry = {
      status: normalizeAttendanceStatus(record),
      kind: getAttendanceKind(record, record._coreSheetSourceProjectId, projectTitle),
      clockIn: getRecordValue(record, ['clock_in', 'clockIn', 'check_in_time', 'checkInTime', 'check_in']),
      clockOut: getRecordValue(record, ['clock_out', 'clockOut', 'check_out_time', 'checkOutTime', 'check_out']),
    }
    const current = candidate.attendance[date]
    const priority = { project: 0, travel: 1, home: 2 }
    if (!current || priority[entry.kind] > priority[current.kind]) candidate.attendance[date] = entry
  })
  return [...candidates.values()].sort((first, second) => first.name.localeCompare(second.name))
}

const attendanceWeight = (candidate, date) => {
  const entry = candidate.attendance[date]
  if (!entry || entry.kind === 'home' || entry.status === 'absent') return 0
  return entry.status === 'half' ? 0.5 : 1
}

const projectWorkedWeight = (candidate, date) => {
  const entry = candidate.attendance[date]
  return entry?.kind === 'project' ? attendanceWeight(candidate, date) : 0
}

const money = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

const normalizeSheetHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const normalizeIdentifier = (value) => String(value || '').replace(/\D/g, '')
const formatUploadDateLabel = (date) => {
  const month = new Date(`${date}T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${date.slice(8, 10)}-${month}`
}
const normalizeSheetDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return normalizeDate(value)
}

const getSheetHeaderDate = (value, dates) => {
  const normalized = normalizeSheetHeader(value)
  const directDate = normalizeSheetDate(value)
  if (dates.includes(directDate)) return directDate
  return dates.find((date) => normalized.includes(normalizeSheetHeader(date)) || normalized.includes(normalizeSheetHeader(formatUploadDateLabel(date)))) || ''
}

function getOvertimeMinutes(clockIn, clockOut, standardStart, standardEnd) {
  if (!clockIn || !clockOut || !standardStart || !standardEnd) return 0
  const toMinutes = (value) => {
    const match = String(value).match(/(\d{1,2}):(\d{2})/)
    if (!match) return null
    const hour = Number(match[1])
    const minute = Number(match[2])
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null
  }
  let actualStart = toMinutes(clockIn)
  let actualEnd = toMinutes(clockOut)
  const scheduledStart = toMinutes(standardStart)
  let scheduledEnd = toMinutes(standardEnd)
  if ([actualStart, actualEnd, scheduledStart, scheduledEnd].some((value) => value === null)) return 0
  if (scheduledEnd <= scheduledStart) scheduledEnd += 24 * 60
  if (scheduledEnd > 24 * 60 && actualStart < scheduledStart && actualEnd < 24 * 60) {
    actualStart += 24 * 60
    actualEnd += 24 * 60
  }
  if (actualEnd < actualStart) actualEnd += 24 * 60
  const scheduledOverlap = Math.max(0, Math.min(actualEnd, scheduledEnd) - Math.max(actualStart, scheduledStart))
  return Math.max(0, actualEnd - actualStart - scheduledOverlap)
}

function getCandidateOvertimeHours(candidate, date, config) {
  const entry = candidate.attendance[date]
  const minutes = config.overtimeMode === 'external'
    ? Math.max(0, money(config.externalOvertime[`${candidate.key}|${date}`])) * 60
    : entry?.kind === 'project' && entry.status !== 'absent'
      ? getOvertimeMinutes(entry.clockIn, entry.clockOut, config.standardStartTime, config.standardEndTime)
      : 0
  return Math.floor(minutes / 60)
}

function buildExportSheetData(candidates, dates, config) {
  const allowanceTypes = [...new Set([
    ...config.allowances.map((allowance) => allowance.type),
    ...(config.overtimeHourlyRate !== '' || Object.keys(config.externalOvertime || {}).length > 0 ? ['Overtime'] : []),
  ])]
  const includeOvertimeRate = allowanceTypes.includes('Overtime')
  const headers = [
    'S.No', 'Candidate Name', 'Mobile', 'Aadhaar',
    ...dates, 'Total OT Hours', ...(includeOvertimeRate ? ['OT Rate / Hour'] : []), 'Worked Days', 'Average Base Rate / Day', 'Base Amount', ...allowanceTypes,
    'Gross Amount', 'Deduction', 'Deduction Note', 'Net Amount',
  ]
  const amountsByCandidate = candidates.map((candidate) => calculateCandidate(candidate, dates, config))
  const rows = candidates.map((candidate, index) => {
    const amounts = amountsByCandidate[index]
    return [
      index + 1,
      candidate.name,
      candidate.mobile,
      candidate.aadhaar,
      ...dates.map((date) => {
        const status = formatAttendance(candidate.attendance[date])
        const overtimeHours = amounts.overtimeHoursByDate[date] || 0
        return overtimeHours ? `${status} (+${overtimeHours} hrs)` : status
      }),
      amounts.overtimeHours,
      ...(includeOvertimeRate ? [money(config.overtimeHourlyRate)] : []),
      amounts.workedDays,
      amounts.baseRate,
      amounts.baseAmount,
      ...allowanceTypes.map((type) => amounts.allowanceTotals[type] || 0),
      amounts.gross,
      amounts.deduction,
      amounts.deductionNote,
      amounts.net,
    ]
  })
  const totalsRow = [
    'TOTAL', '', '', '',
    ...dates.map(() => ''),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.overtimeHours, 0),
    ...(includeOvertimeRate ? [''] : []),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.workedDays, 0),
    '',
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.baseAmount, 0),
    ...allowanceTypes.map((type) => amountsByCandidate.reduce((sum, amounts) => sum + (amounts.allowanceTotals[type] || 0), 0)),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.gross, 0),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.deduction, 0),
    '',
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.net, 0),
  ]
  const overtimeRateColumn = 5 + dates.length
  const workedDaysColumn = overtimeRateColumn + (includeOvertimeRate ? 1 : 0)
  const baseRateColumn = workedDaysColumn + 1
  const baseAmountColumn = baseRateColumn + 1
  const allowanceStartColumn = baseAmountColumn + 1
  const grossColumn = allowanceStartColumn + allowanceTypes.length
  const deductionColumn = grossColumn + 1
  const deductionNoteColumn = deductionColumn + 1
  const netColumn = deductionNoteColumn + 1
  const currencyColumns = [baseRateColumn, baseAmountColumn]
  if (includeOvertimeRate) currencyColumns.push(overtimeRateColumn)
  for (let column = allowanceStartColumn; column <= netColumn; column += 1) {
    if (column !== deductionNoteColumn) currencyColumns.push(column)
  }

  return {
    headers,
    rows,
    totalsRow,
    allowanceTypes,
    columns: {
      workedDays: workedDaysColumn,
      currency: currencyColumns,
    },
  }
}

export default function CoreTeamPaymentSheet({ isOpen, onClose, projectId, projectTitle, projectType = 'regular' }) {
  const initialProjectId = ['home', 'travel'].includes(String(projectId || '').toLowerCase())
    ? ''
    : String(projectId || '')
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId)
  const [availableProjects, setAvailableProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [dates, setDates] = useState([])
  const [candidates, setCandidates] = useState([])
  const [ready, setReady] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [salaryByCandidate, setSalaryByCandidate] = useState({})
  const [defaultBaseRate, setDefaultBaseRate] = useState('')
  const [groupBaseRate, setGroupBaseRate] = useState('')
  const [baseRateMode, setBaseRateMode] = useState('default')
  const [baseRateAudience, setBaseRateAudience] = useState('all')
  const [baseRateRules, setBaseRateRules] = useState([])
  const [baseRateCandidateKeys, setBaseRateCandidateKeys] = useState(new Set())
  const [baseRateDateScope, setBaseRateDateScope] = useState('all')
  const [baseRateFromDate, setBaseRateFromDate] = useState('')
  const [baseRateToDate, setBaseRateToDate] = useState('')
  const [baseRateSpecificDates, setBaseRateSpecificDates] = useState(new Set())
  const [deductions, setDeductions] = useState([])
  const [deductionAmount, setDeductionAmount] = useState('')
  const [deductionNote, setDeductionNote] = useState('')
  const [deductionCandidateKeys, setDeductionCandidateKeys] = useState(new Set())
  const [allowances, setAllowances] = useState([])
  const [allowanceType, setAllowanceType] = useState(ALLOWANCE_TYPES[0])
  const [allowanceAmount, setAllowanceAmount] = useState('')
  const [allowanceCandidateKeys, setAllowanceCandidateKeys] = useState(new Set())
  const [allowanceDateScope, setAllowanceDateScope] = useState('all')
  const [allowanceFromDate, setAllowanceFromDate] = useState('')
  const [allowanceToDate, setAllowanceToDate] = useState('')
  const [allowanceSpecificDates, setAllowanceSpecificDates] = useState(new Set())
  const [overtimeMode, setOvertimeMode] = useState('internal')
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState('')
  const [standardStartTime, setStandardStartTime] = useState('')
  const [standardEndTime, setStandardEndTime] = useState('')
  const [externalOvertime, setExternalOvertime] = useState({})
  const [overtimeImportSummary, setOvertimeImportSummary] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [attendanceCandidate, setAttendanceCandidate] = useState(null)
  const selectedProject = availableProjects.find((project) => project.id === selectedProjectId)
  const selectedProjectTitle = selectedProject?.name || (selectedProjectId === initialProjectId ? projectTitle : '')
  const selectedProjectTypeValue = String(selectedProject?.projectType || '').toLowerCase().replace(/[-\s]/g, '_')
  const selectedProjectType = selectedProjectTypeValue.includes('written') || selectedProjectTypeValue.includes('exam')
    ? 'written_exam'
    : selectedProject ? 'regular' : projectType
  const projectOptions = useMemo(() => {
    if (selectedProjectId && !availableProjects.some((project) => project.id === selectedProjectId) && selectedProjectTitle) {
      return [...availableProjects, { id: selectedProjectId, name: selectedProjectTitle }]
    }
    return availableProjects
  }, [availableProjects, selectedProjectId, selectedProjectTitle])

  useEffect(() => {
    if (!isOpen) return undefined
    let cancelled = false
    setProjectsLoading(true)
    recruiterAPI.getProjectSuggestions('', 1000, projectType === 'written_exam' ? 'written' : projectType)
      .then((response) => {
        const payload = response?.data?.data ?? response?.data ?? response
        const rows = getList(payload).map((project) => {
          const id = String(getRecordValue(project, ['id', 'project_id', 'projectId', 'value', '_id']))
          if (!id) return null
          return {
            id,
            name: String(getRecordValue(project, ['name', 'project_name', 'projectName', 'title', 'label'], id)),
            projectType: String(getRecordValue(project, ['projectType', 'project_type', 'projectKind', 'project_kind', 'type'], '')),
          }
        }).filter(Boolean)
        if (!cancelled) setAvailableProjects(rows)
      })
      .catch((loadError) => {
        console.error('Failed to load projects for core team payment sheet:', loadError)
        if (!cancelled) setAvailableProjects([])
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false)
      })
    return () => { cancelled = true }
  }, [isOpen, projectType])

  const totals = useMemo(() => candidates.reduce((result, candidate) => {
    const amount = calculateCandidate(candidate, dates, {
      salaryByCandidate,
      baseRateRules,
      deductions,
      allowances,
      overtimeMode,
      overtimeHourlyRate,
      standardStartTime,
      standardEndTime,
      externalOvertime,
    })
    result.gross += amount.gross
    result.net += amount.net
    result.overtimeHours += amount.overtimeHours
    result.overtimeAmount += amount.overtimeAmount
    return result
  }, { gross: 0, net: 0, overtimeHours: 0, overtimeAmount: 0 }), [allowances, baseRateRules, candidates, dates, deductions, externalOvertime, overtimeHourlyRate, overtimeMode, salaryByCandidate, standardEndTime, standardStartTime])
  const exportSheetData = useMemo(() => buildExportSheetData(candidates, dates, {
    salaryByCandidate,
    baseRateRules,
    deductions,
    allowances,
    overtimeMode,
    overtimeHourlyRate,
    standardStartTime,
    standardEndTime,
    externalOvertime,
  }), [allowances, baseRateRules, candidates, dates, deductions, externalOvertime, overtimeHourlyRate, overtimeMode, salaryByCandidate, standardEndTime, standardStartTime])
  const calculateCurrentCandidate = (candidate) => calculateCandidate(candidate, dates, {
    salaryByCandidate,
    baseRateRules,
    deductions,
    allowances,
    overtimeMode,
    overtimeHourlyRate,
    standardStartTime,
    standardEndTime,
    externalOvertime,
  })

  const downloadOvertimeTemplate = () => {
    const sampleDates = dates.slice(0, 2)
    const sampleCandidates = candidates.slice(0, 3)
    const headers = [
      'S.NO', 'NAME', 'NUMBER', 'SOURCE', 'LOCATION',
      ...sampleDates.flatMap((date) => [formatUploadDateLabel(date), 'IN-TIME', 'OUT-TIME', 'OT-HOURS']),
      'WORKING DAYS', 'PER DAY', 'AMOUNT TO PAY', 'OT-HOURS', 'OT-AMOUNT',
      'LAUNDRY ALLOWANCE', 'FOODING @400', 'COMMISSION', 'TOTAL AMOUNT TO PAY',
      'ACCOUNT NUMBER', 'IFSC CODE', 'PAN NUMBER', 'PAYEE NAME',
    ]
    const rows = sampleCandidates.map((candidate, index) => [
      index + 1,
      candidate.name,
      candidate.mobile,
      candidate.source || selectedProjectTitle,
      candidate.location,
      ...sampleDates.flatMap((date) => {
        const entry = candidate.attendance[date]
        return [entry ? formatAttendance(entry) : '', entry?.clockIn || '', entry?.clockOut || '', '']
      }),
      dates.reduce((sum, date) => sum + projectWorkedWeight(candidate, date), 0),
      '', '', '', '', '', '', '', '', '', '', '', '',
    ]).map((row) => row.slice(0, headers.length))
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    worksheet['!cols'] = [
      { wch: 8 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      ...sampleDates.flatMap(() => [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]),
      { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
      { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 26 },
    ]
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) }
    headers.forEach((_, column) => {
      const address = XLSX.utils.encode_cell({ r: 0, c: column })
      worksheet[address].s = {
        fill: { fgColor: { rgb: '244A6B' } },
        font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: { bottom: { style: 'medium', color: { rgb: '15334F' } } },
      }
    })
    worksheet['!rows'] = [{ hpt: 28 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Sheet')
    XLSX.writeFile(workbook, `overtime_upload_template_${fromDate}_${toDate}.xlsx`)
  }

  const loadAttendance = async () => {
    setError('')
    if (!selectedProjectId) {
      setError('Select a project to continue.')
      return
    }
    if (!fromDate || !toDate) {
      setError('Enter both a from date and a to date to continue.')
      return
    }
    if (fromDate > toDate) {
      setError('The from date must be on or before the to date.')
      return
    }

    setLoading(true)
    try {
      const { dateRange, candidates: nextCandidates } = await loadCoreAttendanceData(selectedProjectId, fromDate, toDate, selectedProjectType, selectedProjectTitle)
      setDates(dateRange)
      setCandidates(nextCandidates)
      setSalaryByCandidate(Object.fromEntries(nextCandidates.map((candidate) => [candidate.key, ''])))
      setBaseRateRules([])
      setDeductions([])
      setExternalOvertime({})
      setOvertimeImportSummary('')
      setReady(true)
      setStep(1)
    } catch (loadError) {
      console.error('Failed to load core team payment attendance:', loadError)
      setError('Unable to load attendance for this date range. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const refreshAttendance = async () => {
    setLoading(true)
    try {
      const { dateRange, candidates: nextCandidates } = await loadCoreAttendanceData(selectedProjectId, fromDate, toDate, selectedProjectType, selectedProjectTitle)
      setDates(dateRange)
      setCandidates(nextCandidates)
      setSalaryByCandidate((current) => Object.fromEntries(nextCandidates.map((candidate) => [
        candidate.key,
        current[candidate.key] ?? '',
      ])))
      setError('')
      return true
    } catch (loadError) {
      console.error('Failed to refresh core team payment attendance:', loadError)
      setError('Attendance was approved, but the payment table could not be refreshed. Please reload attendance.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const addAllowance = (scope) => {
    if (allowanceType === 'Overtime') return
    if (!allowanceType || !allowanceAmount || money(allowanceAmount) < 0) {
      setError('Enter a valid allowance type and amount.')
      return
    }
    if (scope === 'selected' && allowanceCandidateKeys.size === 0) {
      setError('Select at least one team member for this allowance rate.')
      return
    }
    if ((allowanceDateScope === 'range' && (!allowanceFromDate || !allowanceToDate || allowanceFromDate > allowanceToDate)) || (allowanceDateScope === 'specific' && allowanceSpecificDates.size === 0)) {
      setError('Choose valid dates for this allowance.')
      return
    }
    setError('')
    setAllowances((current) => [...current, {
      id: `${Date.now()}-${current.length}`,
      type: allowanceType,
      amount: money(allowanceAmount),
      scope,
      candidateKeys: scope === 'selected' ? [...allowanceCandidateKeys] : [],
      dateScope: allowanceDateScope,
      fromDate: allowanceDateScope === 'range' ? allowanceFromDate : '',
      toDate: allowanceDateScope === 'range' ? allowanceToDate : '',
      specificDates: allowanceDateScope === 'specific' ? [...allowanceSpecificDates] : [],
    }])
    setAllowanceAmount('')
    setAllowanceFromDate('')
    setAllowanceToDate('')
    setAllowanceSpecificDates(new Set())
    setAllowanceCandidateKeys(new Set())
    setAllowanceDateScope('all')
  }

  const importOvertimeSheet = async (file) => {
    if (!file) return
    setError('')
    setExternalOvertime({})
    setOvertimeImportSummary('')
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: true })
      const headerRowIndex = matrix.findIndex((row) => {
        const headers = row.map(normalizeSheetHeader)
        const hasIdentity = headers.some((header) => header === 'number' || ['mobile', 'phone', 'whatsapp', 'contact', 'aadhaar', 'aadhar'].some((part) => header.includes(part)))
        const hasDate = headers.some((header) => ['date', 'attendanceDate'].map(normalizeSheetHeader).includes(header))
        const hasHours = headers.some((header) => ['othours', 'othrs', 'overtimehours', 'overtimehrs', 'hours', 'overtime', 'totalot', 'totalothrs'].includes(header))
        const hasDateColumns = row.some((header) => getSheetHeaderDate(header, dates))
        return hasIdentity && ((hasDate && hasHours) || hasDateColumns)
      })
      if (headerRowIndex < 0) throw new Error('Could not find identity and overtime columns in the first worksheet.')

      const headers = matrix[headerRowIndex].map(normalizeSheetHeader)
      const findColumn = (names) => headers.findIndex((header) => names.includes(header))
      const mobileColumn = headers.findIndex((header) => header === 'number' || ['mobile', 'phone', 'whatsapp', 'contact'].some((part) => header.includes(part)))
      const aadhaarColumn = headers.findIndex((header) => ['aadhaar', 'aadhar'].some((part) => header.includes(part)))
      const dateColumn = findColumn(['date', 'attendancedate'])
      const hoursColumn = findColumn(['othours', 'othrs', 'overtimehours', 'overtimehrs', 'hours', 'overtime', 'totalot', 'totalothrs'])
      let currentDate = ''
      let hasInTime = false
      let hasOutTime = false
      const overtimeDateColumns = headers.map((header, index) => {
        const headerDate = getSheetHeaderDate(matrix[headerRowIndex][index], dates)
        if (headerDate) {
          currentDate = headerDate
          hasInTime = false
          hasOutTime = false
        }
        if (header.includes('intime') || header.includes('clockin')) hasInTime = true
        if (header.includes('outtime') || header.includes('clockout')) hasOutTime = true
        const isOvertimeHours = /(?:ot|overtime).*(?:hours|hrs)|(?:hours|hrs).*(?:ot|overtime)/.test(header)
        const date = headerDate || (hasInTime && hasOutTime ? currentDate : '')
        if (isOvertimeHours && date) {
          hasInTime = false
          hasOutTime = false
          return { date, index }
        }
        return null
      }).filter(Boolean)
      const nextOvertime = {}
      let importedRows = 0
      let unmatchedRows = 0
      const dataRows = matrix.slice(headerRowIndex + 1)

      const matchCandidate = (row) => {
        const mobile = normalizeIdentifier(mobileColumn >= 0 ? row[mobileColumn] : '')
        const aadhaar = normalizeIdentifier(aadhaarColumn >= 0 ? row[aadhaarColumn] : '')
        if (!mobile && !aadhaar) return null
        const matches = candidates.filter((candidate) => {
          const mobileMatches = mobile && normalizeIdentifier(candidate.mobile).slice(-10) === mobile.slice(-10)
          const aadhaarMatches = aadhaar && normalizeIdentifier(candidate.aadhaar) === aadhaar
          return mobile && aadhaar ? mobileMatches && aadhaarMatches : mobileMatches || aadhaarMatches
        })
        return matches.length === 1 ? matches[0] : null
      }
      const addHours = (candidate, date, value) => {
        if (value === '' || value === null || value === undefined) return false
        const hours = Number(String(value).trim().replace(',', '.'))
        if (!candidate || !dates.includes(date) || !Number.isFinite(hours) || hours < 0) return false
        const key = `${candidate.key}|${date}`
        nextOvertime[key] = (nextOvertime[key] || 0) + hours
        importedRows += 1
        return true
      }

      dataRows.forEach((row) => {
        const candidate = matchCandidate(row)
        if (dateColumn >= 0 && hoursColumn >= 0) {
          const date = normalizeSheetDate(row[dateColumn])
          if (row[hoursColumn] === '' || row[hoursColumn] === null || row[hoursColumn] === undefined) return
          if (!addHours(candidate, date, row[hoursColumn])) unmatchedRows += 1
          return
        }
        let rowImported = false
        overtimeDateColumns.forEach(({ date, index }) => {
          if (row[index] !== '' && row[index] !== null && row[index] !== undefined) {
            rowImported = addHours(candidate, date, row[index]) || rowImported
          }
        })
        if (!rowImported && row.some((value) => value !== '' && value !== null && value !== undefined)) unmatchedRows += 1
      })
      if (!importedRows) throw new Error('No valid overtime hours matched the loaded team members and dates.')
      setExternalOvertime(nextOvertime)
      setOvertimeImportSummary(`${importedRows} date entries imported${unmatchedRows ? `; ${unmatchedRows} rows skipped` : ''}.`)
    } catch (importError) {
      console.error('Failed to import overtime sheet:', importError)
      setError(importError.message || 'Unable to read the overtime sheet. Use a CSV, XLS, or XLSX file.')
    }
  }

  const addDeduction = (scope) => {
    if (!deductionAmount || money(deductionAmount) <= 0 || !deductionNote.trim()) {
      setError('Enter a deduction amount and a note.')
      return
    }
    if (scope === 'selected' && deductionCandidateKeys.size === 0) {
      setError('Select at least one team member for this deduction rate.')
      return
    }
    setError('')
    setDeductions((current) => [...current, {
      id: `${Date.now()}-${current.length}`,
      amount: money(deductionAmount),
      note: deductionNote.trim(),
      scope,
      candidateKeys: scope === 'selected' ? [...deductionCandidateKeys] : [],
    }])
    setDeductionAmount('')
    setDeductionNote('')
    setDeductionCandidateKeys(new Set())
  }

  const applyBaseRate = (candidateKeys, amount) => {
    if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      setError('Enter a valid base rate of zero or more.')
      return false
    }
    setSalaryByCandidate((current) => {
      const next = { ...current }
      candidateKeys.forEach((candidateKey) => { next[candidateKey] = String(amount) })
      return next
    })
    setError('')
    return true
  }

  const applyDefaultBaseRate = () => {
    if (baseRateAudience === 'selected' && baseRateCandidateKeys.size === 0) {
      setError('Select at least one team member for this default base rate.')
      return
    }
    const candidateKeys = baseRateAudience === 'all'
      ? candidates.map((candidate) => candidate.key)
      : [...baseRateCandidateKeys]
    applyBaseRate(candidateKeys, defaultBaseRate)
  }

  const addBaseRateRule = () => {
    if (groupBaseRate === '' || !Number.isFinite(Number(groupBaseRate)) || Number(groupBaseRate) < 0) {
      setError('Enter a valid base rate of zero or more.')
      return
    }
    if (baseRateAudience === 'selected' && baseRateCandidateKeys.size === 0) {
      setError('Select at least one team member for this base rate.')
      return
    }
    if ((baseRateDateScope === 'range' && (!baseRateFromDate || !baseRateToDate || baseRateFromDate > baseRateToDate)) || (baseRateDateScope === 'specific' && baseRateSpecificDates.size === 0)) {
      setError('Choose valid dates for this base rate.')
      return
    }
    setError('')
    setBaseRateRules((current) => [...current, {
      id: `${Date.now()}-${current.length}`,
      amount: Number(groupBaseRate),
      scope: baseRateAudience,
      candidateKeys: baseRateAudience === 'selected' ? [...baseRateCandidateKeys] : [],
      dateScope: baseRateDateScope,
      fromDate: baseRateDateScope === 'range' ? baseRateFromDate : '',
      toDate: baseRateDateScope === 'range' ? baseRateToDate : '',
      specificDates: baseRateDateScope === 'specific' ? [...baseRateSpecificDates] : [],
    }])
    setGroupBaseRate('')
    setBaseRateCandidateKeys(new Set())
    setBaseRateFromDate('')
    setBaseRateToDate('')
    setBaseRateSpecificDates(new Set())
    setBaseRateDateScope('all')
  }

  const continueToReview = () => {
    if (candidates.some((candidate) => money(salaryByCandidate[candidate.key]) < 0)) {
      setError('Base salary amounts must be zero or greater.')
      return
    }
    const overtimeEnabled = allowanceType === 'Overtime' || overtimeHourlyRate !== '' || Object.keys(externalOvertime).length > 0
    if (overtimeEnabled) {
      if (overtimeHourlyRate === '' || !Number.isFinite(Number(overtimeHourlyRate)) || Number(overtimeHourlyRate) < 0) {
        setError('Enter a valid overtime amount per hour.')
        return
      }
      if (overtimeMode === 'internal' && (!standardStartTime || !standardEndTime)) {
        setError('Enter the project standard start and end times to calculate overtime.')
        return
      }
      if (overtimeMode === 'external' && Object.keys(externalOvertime).length === 0) {
        setError('Upload an overtime sheet with valid hours before reviewing.')
        return
      }
    }
    setError('')
    setStep(2)
  }

  const exportWorkbook = async () => {
    if (!candidates.length) {
      setError('No attendance records were found for this date range.')
      return
    }
    const hasNegativeAmount = candidates.some((candidate) =>
      money(salaryByCandidate[candidate.key]) < 0,
    )
    if (hasNegativeAmount) {
      setError('Base salary and deduction amounts must be zero or greater.')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const { headers, rows, totalsRow, allowanceTypes, columns } = exportSheetData
      const worksheet = XLSX.utils.aoa_to_sheet([
        [`${selectedProjectTitle || 'Core Team'} Core Team Attendance and Payment Sheet`],
        [`Date range: ${fromDate} to ${toDate}`],
        headers,
        ...rows,
        totalsRow,
      ])
      const totalsRowIndex = rows.length + 3
      const workedDaysColumn = columns.workedDays
      const thinBlueBorder = { style: 'thin', color: { rgb: 'A8C5E2' } }
      const cellBorder = {
        top: thinBlueBorder,
        bottom: thinBlueBorder,
        left: thinBlueBorder,
        right: thinBlueBorder,
      }

      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      ]
      worksheet['!cols'] = headers.map((header, index) => ({
        wch: index === 0 ? 8
          : index === 1 ? 24
            : index === 2 ? 16
              : index === 3 ? 18
                : index >= 4 && index < 4 + dates.length ? 12
                  : index === workedDaysColumn ? 13
                    : columns.currency.includes(index) ? 16
                      : Math.min(30, Math.max(14, String(header).length + 2)),
      }))

      worksheet['A1'].s = {
        fill: { fgColor: { rgb: '15334F' } },
        font: { name: 'Aptos Display', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
      worksheet['A2'].s = {
        fill: { fgColor: { rgb: 'D9EAF7' } },
        font: { name: 'Aptos', sz: 10, italic: true, color: { rgb: '15334F' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      }

      for (let row = 2; row <= totalsRowIndex; row += 1) {
        for (let column = 0; column < headers.length; column += 1) {
          const address = XLSX.utils.encode_cell({ r: row, c: column })
          if (!worksheet[address]) worksheet[address] = { t: 's', v: '' }
          worksheet[address].s = {
            ...(worksheet[address].s || {}),
            border: cellBorder,
          }
        }
      }

      headers.forEach((_, column) => {
        const address = XLSX.utils.encode_cell({ r: 2, c: column })
        worksheet[address].s = {
          ...worksheet[address].s,
          fill: { fgColor: { rgb: '244A6B' } },
          font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: column >= 4 && column < 4 + dates.length ? 'center' : 'left', vertical: 'center', wrapText: true },
        }
      })

      for (let column = 0; column < headers.length; column += 1) {
        const address = XLSX.utils.encode_cell({ r: totalsRowIndex, c: column })
        worksheet[address].s = {
          ...worksheet[address].s,
          fill: { fgColor: { rgb: 'D9EAF7' } },
          font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: '15334F' } },
          border: {
            ...cellBorder,
            top: { style: 'medium', color: { rgb: '244A6B' } },
          },
        }
      }

      for (let row = 3; row <= totalsRowIndex; row += 1) {
        const workedDaysAddress = XLSX.utils.encode_cell({ r: row, c: workedDaysColumn })
        if (worksheet[workedDaysAddress]) worksheet[workedDaysAddress].z = '0.##'
        columns.currency.forEach((column) => {
          const address = XLSX.utils.encode_cell({ r: row, c: column })
          if (worksheet[address]) worksheet[address].z = '"₹"#,##0.00'
        })
      }

      dates.forEach((_, dateIndex) => {
        const column = dateIndex + 4
        candidates.forEach((candidate, candidateIndex) => {
          const status = formatAttendance(candidate.attendance[dates[dateIndex]])
          const address = XLSX.utils.encode_cell({ r: candidateIndex + 3, c: column })
          if (worksheet[address] && ATTENDANCE_CELL_STYLES[status]) {
            worksheet[address].s = {
              ...ATTENDANCE_CELL_STYLES[status],
              border: cellBorder,
              alignment: { horizontal: 'center' },
            }
          }
        })
      })
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Core Team Payments')
      const safeTitle = String(selectedProjectTitle || 'core_team').replace(/[\\/:*?"<>|]+/g, '_').trim()
      XLSX.writeFile(workbook, `core_team_payment_${safeTitle}_${fromDate}_${toDate}.xlsx`)
      onClose?.()
    } catch (exportError) {
      console.error('Failed to generate core team payment sheet:', exportError)
      setError('Unable to generate the Excel sheet. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const visibleCandidates = candidates.filter((candidate) =>
    !candidateSearch || `${candidate.name} ${candidate.id} ${candidate.mobile}`.toLowerCase().includes(candidateSearch.trim().toLowerCase()),
  )
  const activeAllowanceTypes = [...new Set([
    ...allowances.map((allowance) => allowance.type),
    ...(overtimeHourlyRate !== '' || Object.keys(externalOvertime).length > 0 || allowanceType === 'Overtime' ? ['Overtime'] : []),
  ])]
  const totalWorkedDays = candidates.reduce((sum, candidate) => sum + dates.reduce((days, date) => days + projectWorkedWeight(candidate, date), 0), 0)
  const formatPreviewValue = (value, column) => {
    if (value === '' || value === null || value === undefined) return ''
    if (exportSheetData.columns.currency.includes(column)) {
      return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return String(value)
  }

  const stepNames = ['Period', 'Pay setup', 'Review']
  const footer = (
    <div className="core-payment-footer">
      <button type="button" className="btn btn-outline" onClick={step === 0 ? onClose : () => { setStep((current) => current - 1); setError('') }}>
        {step === 0 ? 'Cancel' : 'Back'}
      </button>
      {step === 0 && <button type="button" className="btn btn-primary" onClick={loadAttendance} disabled={loading}>{loading ? 'Loading attendance...' : 'Load attendance'}</button>}
      {step === 1 && <button type="button" className="btn btn-primary" onClick={continueToReview}>Review amounts</button>}
      {step === 2 && <button type="button" className="btn btn-primary" onClick={exportWorkbook} disabled={loading || generating || candidates.length === 0}>{generating ? 'Preparing workbook...' : 'Export Excel'}</button>}
    </div>
  )

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Core team payment sheet" fullScreen footer={footer}>
      <div className="core-payment-sheet">
        <nav className="core-payment-steps" aria-label="Payment sheet steps">
          {stepNames.map((name, index) => <div key={name} className={`core-payment-step${step === index ? ' active' : ''}${step > index ? ' complete' : ''}`}><span>{step > index ? '✓' : index + 1}</span>{name}</div>)}
        </nav>

        {step === 0 && <section className="core-payment-period">
          <div className="core-payment-intro">
            <span className="core-payment-eyebrow">STEP 1 · ATTENDANCE PERIOD</span>
            <h2>Which dates should be included?</h2>
            <p>We’ll combine attendance from <strong>{selectedProjectTitle || 'your selected project'}</strong>, Home, and Travel for this period.</p>
          </div>
          <div className="core-payment-date-fields">
            <label><span>From date</span><input className="form-control" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label><span>To date</span><input className="form-control" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <label><span>Project</span><SearchableProjectSelect options={projectOptions} value={selectedProjectId} onChange={setSelectedProjectId} placeholder={projectsLoading ? 'Loading projects...' : 'Search project'} disabled={projectsLoading} /></label>
          </div>
          <div className="core-payment-note">Only attendance inside these dates will be used. Home and Travel count toward eligible allowances, not base pay.</div>
          {error && <div className="attendance-message error">{error}</div>}
        </section>}

        {step === 1 && ready && <div className="core-payment-workspace">
          <header className="core-payment-context">
            <div><span className="core-payment-eyebrow">STEP 2 · PAY SETUP</span><strong>{selectedProjectTitle} + Home + Travel</strong></div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setStep(0); setReady(false); setError('') }}>Change dates</button>
            <span>{fromDate} to {toDate} · {candidates.length} team members</span>
          </header>
          <div className="core-payment-formula"><strong>Pay calculation</strong><span>Project days (P) × daily rate + allowances + overtime − deductions</span></div>
          {error && <div className="attendance-message error">{error}</div>}

          <section className="core-payment-panel">
            <div className="core-payment-panel-heading"><div><h3>Base salary</h3><p>Set a default daily rate, then add date-specific rates for everyone or selected people. Base salary applies to project attendance (P) only.</p></div><span className="core-payment-member-count">{candidates.length} people</span></div>
            <div className="core-payment-rate-tools">
              <div className="core-payment-base-rate-choices">
                <div>
                  <span className="core-payment-target-label">Rate type</span>
                  <div className="core-payment-segmented" role="group" aria-label="Base rate type">
                    <button type="button" className={baseRateMode === 'default' ? 'active' : ''} aria-pressed={baseRateMode === 'default'} onClick={() => setBaseRateMode('default')}>Default rate</button>
                    <button type="button" className={baseRateMode === 'dated' ? 'active' : ''} aria-pressed={baseRateMode === 'dated'} onClick={() => setBaseRateMode('dated')}>Date-specific rate</button>
                  </div>
                </div>
                <div>
                  <span className="core-payment-target-label">Applies to</span>
                  <div className="core-payment-segmented" role="group" aria-label="Who receives this base rate">
                    <button type="button" className={baseRateAudience === 'all' ? 'active' : ''} aria-pressed={baseRateAudience === 'all'} onClick={() => setBaseRateAudience('all')}>Everyone</button>
                    <button type="button" className={baseRateAudience === 'selected' ? 'active' : ''} aria-pressed={baseRateAudience === 'selected'} onClick={() => setBaseRateAudience('selected')}>Selected people</button>
                  </div>
                </div>
              </div>
              <div className="core-payment-rate-group-controls">
                <label><span>{baseRateMode === 'default' ? 'Default daily rate' : 'Daily rate'}</span><div className="core-payment-currency"><span>₹</span><input className="form-control" type="number" min="0" value={baseRateMode === 'default' ? defaultBaseRate : groupBaseRate} onChange={(event) => baseRateMode === 'default' ? setDefaultBaseRate(event.target.value) : setGroupBaseRate(event.target.value)} placeholder="Enter amount" /></div></label>
              </div>
              {baseRateMode === 'dated' && <TargetingControls title="Apply on" dates={dates} dateScope={baseRateDateScope} onDateScopeChange={setBaseRateDateScope} fromDate={baseRateFromDate} onFromDateChange={setBaseRateFromDate} toDate={baseRateToDate} onToDateChange={setBaseRateToDate} specificDates={baseRateSpecificDates} onSpecificDatesChange={setBaseRateSpecificDates} />}
              {baseRateAudience === 'selected' && <CandidateGroupPicker candidates={candidates} selectedCandidateKeys={baseRateCandidateKeys} onSelectedCandidateKeysChange={setBaseRateCandidateKeys} getCandidateDetail={(candidate) => `Current default: ₹${money(salaryByCandidate[candidate.key]).toFixed(2)}/day`} />}
              <div className="core-payment-adjustment-actions">
                <button type="button" className="btn btn-primary" onClick={baseRateMode === 'default' ? applyDefaultBaseRate : addBaseRateRule} disabled={baseRateAudience === 'selected' && baseRateCandidateKeys.size === 0}>
                  {baseRateMode === 'default' ? 'Apply default rate' : 'Add date-specific rate'}
                </button>
              </div>
              {baseRateRules.length > 0 && <ul className="core-payment-allowance-list">{baseRateRules.map((rule) => <li key={rule.id}><span><strong>₹{rule.amount}/day</strong> · {rule.scope === 'all' ? 'Everyone' : `${rule.candidateKeys.length} selected`} · {describeRuleDates(rule)}</span><button type="button" onClick={() => setBaseRateRules((current) => current.filter((item) => item.id !== rule.id))}>Remove</button></li>)}</ul>}
            </div>
          </section>

          <div className="core-payment-adjustment-grid">
          <section className="core-payment-panel">
            <div className="core-payment-panel-heading"><div><h3>Allowances</h3><p>Travel-day meal applies on Travel days, other daily allowances apply on present project days (P), and overtime follows the selected hours source.</p></div></div>
            <div className="core-payment-allowance-form">
              <label><span>Allowance type</span><select className="form-control" value={allowanceType} onChange={(event) => setAllowanceType(event.target.value)}>{ALLOWANCE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              {allowanceType !== 'Overtime' && <label><span>Amount per day</span><div className="core-payment-currency"><span>₹</span><input className="form-control" type="number" min="0" value={allowanceAmount} onChange={(event) => setAllowanceAmount(event.target.value)} placeholder="0" /></div></label>}
            </div>
            {allowanceType === 'Overtime' && <div className="core-payment-overtime-settings">
              <div className="core-payment-overtime-modes">
                <span className="core-payment-target-label">Overtime hours source</span>
                <div className="core-payment-segmented" role="group" aria-label="Overtime hours source">
                  <button type="button" className={overtimeMode === 'internal' ? 'active' : ''} aria-pressed={overtimeMode === 'internal'} onClick={() => setOvertimeMode('internal')}>Attendance clock times</button>
                  <button type="button" className={overtimeMode === 'external' ? 'active' : ''} aria-pressed={overtimeMode === 'external'} onClick={() => setOvertimeMode('external')}>Upload OT hours</button>
                </div>
              </div>
              <label><span>Overtime amount per hour</span><div className="core-payment-currency"><span>₹</span><input className="form-control" type="number" min="0" value={overtimeHourlyRate} onChange={(event) => setOvertimeHourlyRate(event.target.value)} placeholder="Enter amount" /></div></label>
              {overtimeMode === 'internal' ? <div className="core-payment-overtime-times">
                <label><span>Standard start time</span><input className="form-control" type="time" value={standardStartTime} onChange={(event) => setStandardStartTime(event.target.value)} /></label>
                <label><span>Standard end time</span><input className="form-control" type="time" value={standardEndTime} onChange={(event) => setStandardEndTime(event.target.value)} /></label>
                <p>Only complete hours before the start or after the end count; partial hours are ignored.</p>
              </div> : <div className="core-payment-overtime-upload">
                <label><span>Upload Excel or CSV</span><input className="form-control" type="file" accept=".csv,.xls,.xlsx" onChange={(event) => { importOvertimeSheet(event.target.files?.[0]); event.target.value = '' }} /></label>
                <button type="button" className="btn btn-outline" onClick={downloadOvertimeTemplate} disabled={!candidates.length || !dates.length}>Download upload template</button>
                <p>Use Mobile and/or Aadhaar with Date and OT Hours, or put each date in its own column. Only dates in this payment period are imported.</p>
                {overtimeImportSummary && <strong>{overtimeImportSummary}</strong>}
              </div>}
            </div>}
            {allowanceType !== 'Overtime' && <>
            <details className="core-payment-rate-groups">
              <summary>Set a different allowance rate for selected people</summary>
              <p>Choose a group, enter its amount per day above, and add it. Repeat to set a different rate for another group.</p>
              <CandidateGroupPicker candidates={candidates} selectedCandidateKeys={allowanceCandidateKeys} onSelectedCandidateKeysChange={setAllowanceCandidateKeys} getCandidateDetail={(candidate) => {
                const currentRates = new Set(dates.map((date) => (
                  getEffectiveAllowanceRule(allowances, candidate.key, allowanceType, date)?.amount ?? 0
                )))
                if (currentRates.size > 1) return 'Current: Varies by date'
                return `Current: ₹${money([...currentRates][0]).toFixed(2)}/day`
              }} />
            </details>
            <TargetingControls title="Allowance dates" dates={dates} dateScope={allowanceDateScope} onDateScopeChange={setAllowanceDateScope} fromDate={allowanceFromDate} onFromDateChange={setAllowanceFromDate} toDate={allowanceToDate} onToDateChange={setAllowanceToDate} specificDates={allowanceSpecificDates} onSpecificDatesChange={setAllowanceSpecificDates} />
            {allowances.length > 0 && <ul className="core-payment-allowance-list">{allowances.map((allowance) => <li key={allowance.id}><span><strong>{allowance.type}</strong> · ₹{allowance.amount} · {allowance.scope === 'all' ? 'Everyone' : `${allowance.candidateKeys.length} selected`} · {describeRuleDates(allowance)}</span><button type="button" onClick={() => setAllowances((current) => current.filter((item) => item.id !== allowance.id))}>Remove</button></li>)}</ul>}
            <div className="core-payment-adjustment-actions">
              <button type="button" className="btn btn-primary" onClick={() => addAllowance('all')}>Add for everyone</button>
              <button type="button" className="btn btn-outline" onClick={() => addAllowance('selected')} disabled={allowanceCandidateKeys.size === 0}>Add to {allowanceCandidateKeys.size} selected</button>
            </div>
            </>}
          </section>

          <section className="core-payment-panel">
            <div className="core-payment-panel-heading"><div><h3>Deductions</h3><p>Apply a one-time deduction to everyone or a selected group. Add a reason for the record.</p></div></div>
            <div className="core-payment-allowance-form core-payment-deduction-form">
              <label><span>Deduction per person</span><div className="core-payment-currency"><span>₹</span><input className="form-control" type="number" min="0" value={deductionAmount} onChange={(event) => setDeductionAmount(event.target.value)} placeholder="0" /></div></label>
              <label className="core-payment-note-field"><span>Note / reason</span><input className="form-control" value={deductionNote} onChange={(event) => setDeductionNote(event.target.value)} placeholder="Required" /></label>
            </div>
            <details className="core-payment-rate-groups">
              <summary>Set a different deduction for selected people</summary>
              <p>Choose a group, enter its one-time amount per person above, and add it. Repeat to set a different amount for another group.</p>
              <CandidateGroupPicker candidates={candidates} selectedCandidateKeys={deductionCandidateKeys} onSelectedCandidateKeysChange={setDeductionCandidateKeys} />
            </details>
            {deductions.length > 0 && <ul className="core-payment-allowance-list">{deductions.map((rule) => <li key={rule.id}><span><strong>₹{rule.amount} once</strong> · {rule.note} · {rule.scope === 'all' ? 'Everyone' : `${rule.candidateKeys.length} selected`}</span><button type="button" onClick={() => setDeductions((current) => current.filter((item) => item.id !== rule.id))}>Remove</button></li>)}</ul>}
            <div className="core-payment-adjustment-actions">
              <button type="button" className="btn btn-primary" onClick={() => addDeduction('all')}>Add for everyone</button>
              <button type="button" className="btn btn-outline" onClick={() => addDeduction('selected')} disabled={deductionCandidateKeys.size === 0}>Add to {deductionCandidateKeys.size} selected</button>
            </div>
          </section>
          </div>

        </div>}

        {step === 1 && ready && <section className="core-payment-panel core-payment-members">
            <div className="core-payment-panel-heading"><div><h3>Attendance and payment table</h3><p>Review each person’s attendance by date and calculated pay.</p></div></div>
            <label className="core-payment-search"><span className="sr-only">Search team members</span><input className="form-control" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search name, ID, or mobile" /></label>
            <div className="core-payment-table-wrap"><table className="core-payment-table"><thead><tr><th>Team member</th>{dates.map((date) => <th className="core-payment-date-column" key={date}>{date}</th>)}{activeAllowanceTypes.includes('Overtime') && <th>Total OT Hrs</th>}<th>Base rate / day</th><th>Base pay</th>{activeAllowanceTypes.map((type) => <th key={type}>{type}</th>)}<th>Deductions</th><th>Net pay</th></tr></thead><tbody>
              {visibleCandidates.map((candidate) => {
                const amounts = calculateCurrentCandidate(candidate)
                return <tr key={candidate.key}>
                  <td><div className="core-payment-member-identity"><strong>{candidate.name}</strong><button type="button" className="core-payment-calendar-button" onClick={() => setAttendanceCandidate(candidate)} disabled={!candidate.registrationId} title={candidate.registrationId ? `Edit attendance for ${candidate.name}` : 'Registration ID unavailable'} aria-label={`Open attendance calendar for ${candidate.name}`}><FontAwesomeIcon icon={faCalendarAlt} /></button></div><small>{candidate.id}{candidate.mobile ? ` · ${candidate.mobile}` : ''}</small></td>
                  {dates.map((date) => <td className="core-payment-date-column" key={date}>{`${formatPaymentAttendance(candidate.attendance[date])}${amounts.overtimeHoursByDate[date] ? ` (+${amounts.overtimeHoursByDate[date]} hrs)` : ''}`}</td>)}
                  {activeAllowanceTypes.includes('Overtime') && <td className="core-payment-date-column">{amounts.overtimeHours}</td>}
                  <td><label className="core-payment-currency"><span>₹</span><input className="form-control" type="number" min="0" value={salaryByCandidate[candidate.key] || ''} onChange={(event) => setSalaryByCandidate((current) => ({ ...current, [candidate.key]: event.target.value }))} aria-label={`Fallback base salary per day for ${candidate.name}`} title="Fallback rate when no date-specific rate applies" placeholder="0" /></label></td>
                  <td>₹{amounts.baseAmount.toFixed(2)}</td>
                  {activeAllowanceTypes.map((type) => <td key={type}>₹{(amounts.allowanceTotals[type] || 0).toFixed(2)}</td>)}
                  <td title={amounts.deductionNote}>₹{amounts.deduction.toFixed(2)}</td><td><strong>₹{amounts.net.toFixed(2)}</strong></td>
                </tr>
              })}
              <tr className="core-payment-total-row">
                <td>Total</td>
                {dates.map((date) => <td className="core-payment-date-column" key={date}></td>)}
                {activeAllowanceTypes.includes('Overtime') && <td>{totals.overtimeHours}</td>}
                <td></td>
                <td>₹{candidates.reduce((sum, candidate) => sum + calculateCurrentCandidate(candidate).baseAmount, 0).toFixed(2)}</td>
                {activeAllowanceTypes.map((type) => <td key={type}>₹{candidates.reduce((sum, candidate) => sum + (calculateCurrentCandidate(candidate).allowanceTotals[type] || 0), 0).toFixed(2)}</td>)}
                <td>₹{candidates.reduce((sum, candidate) => sum + calculateCurrentCandidate(candidate).deduction, 0).toFixed(2)}</td>
                <td>₹{totals.net.toFixed(2)}</td>
              </tr>
            </tbody></table>{visibleCandidates.length === 0 && <div className="core-payment-empty">No team members match that search.</div>}</div>
          </section>}

        {step === 2 && <section className="core-payment-review">
          <div className="core-payment-intro"><span className="core-payment-eyebrow">STEP 3 · REVIEW</span><h2>Check the totals before exporting</h2><p>{selectedProjectTitle} + Home + Travel · {fromDate} to {toDate}</p></div>
          <div className="core-payment-summary">
            <div><span>Team members</span><strong>{candidates.length}</strong></div><div><span>Worked days</span><strong>{totalWorkedDays}</strong></div><div><span>OT hours</span><strong>{totals.overtimeHours}</strong></div><div><span>OT pay</span><strong>₹{totals.overtimeAmount.toFixed(2)}</strong></div><div><span>Gross pay</span><strong>₹{totals.gross.toFixed(2)}</strong></div><div><span>Deductions</span><strong>₹{candidates.reduce((sum, candidate) => sum + calculateCurrentCandidate(candidate).deduction, 0).toFixed(2)}</strong></div><div className="net"><span>Net payable</span><strong>₹{totals.net.toFixed(2)}</strong></div>
          </div>
          <div className="core-payment-export-preview">
            <div className="core-payment-export-title">{selectedProjectTitle || 'Core Team'} Core Team Attendance and Payment Sheet</div>
            <div className="core-payment-export-date-range">Date range: {fromDate} to {toDate}</div>
            <div className="core-payment-export-table-wrap">
              <table className="core-payment-export-table">
                <thead><tr>{exportSheetData.headers.map((header, column) => <th className={column >= 4 && column < 4 + dates.length ? 'attendance-date' : ''} key={`${header}-${column}`}>{header}</th>)}</tr></thead>
                <tbody>
                  {exportSheetData.rows.map((row, rowIndex) => <tr key={`candidate-${rowIndex}`}>
                    {row.map((value, column) => {
                      const isAttendanceDate = column >= 4 && column < 4 + dates.length
                      const attendanceStatus = isAttendanceDate ? String(value).match(/^[PHTA]/)?.[0] : null
                      const attendanceStyle = attendanceStatus ? ATTENDANCE_CELL_STYLES[attendanceStatus] : null
                      const style = attendanceStyle ? {
                        backgroundColor: `#${attendanceStyle.fill.fgColor.rgb}`,
                        color: `#${attendanceStyle.font.color.rgb}`,
                        fontWeight: 700,
                        textAlign: 'center',
                      } : undefined
                      return <td className={isAttendanceDate ? 'attendance-date' : ''} style={style} key={`${rowIndex}-${column}`}>{formatPreviewValue(value, column)}</td>
                    })}
                  </tr>)}
                  <tr className="total-row">{exportSheetData.totalsRow.map((value, column) => <td key={`total-${column}`}>{formatPreviewValue(value, column)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
          {error && <div className="attendance-message error">{error}</div>}
        </section>}
      </div>
    </Modal>
    <CandidateAttendanceCalendar isOpen={Boolean(attendanceCandidate)} candidate={attendanceCandidate} onClose={() => setAttendanceCandidate(null)} onAttendanceUpdated={refreshAttendance} />
    </>
  )
}

function CandidateGroupPicker({ candidates, selectedCandidateKeys, onSelectedCandidateKeysChange, getCandidateDetail }) {
  const [candidateSearch, setCandidateSearch] = useState('')
  const filteredCandidates = candidates.filter((candidate) =>
    `${candidate.name} ${candidate.id} ${candidate.mobile}`.toLowerCase().includes(candidateSearch.trim().toLowerCase()),
  )

  return (
    <div className="core-payment-rate-group-picker">
      <div className="core-payment-rate-group-actions"><input className="form-control" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search team members" aria-label="Search team members for group rate" /><button type="button" onClick={() => onSelectedCandidateKeysChange(new Set(candidates.map((candidate) => candidate.key)))}>Select all</button><button type="button" onClick={() => onSelectedCandidateKeysChange(new Set())}>Clear</button></div>
      <div className="core-payment-rate-group-list">{filteredCandidates.map((candidate) => <label key={candidate.key}><input type="checkbox" checked={selectedCandidateKeys.has(candidate.key)} onChange={(event) => onSelectedCandidateKeysChange((current) => toggleSetValue(current, candidate.key, event.target.checked))} /><span>{candidate.name}{getCandidateDetail && <small>{getCandidateDetail(candidate)}</small>}</span></label>)}</div>
    </div>
  )
}

function TargetingControls({
  title,
  dates,
  dateScope,
  onDateScopeChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  specificDates,
  onSpecificDatesChange,
}) {
  return (
    <div className="core-payment-targeting">
      <h4>{title}</h4>
      <div className="core-payment-target-block">
        <span className="core-payment-target-label">Dates</span>
        <div className="core-payment-segmented" role="group" aria-label={`${title}: dates`}>
          <button type="button" className={dateScope === 'all' ? 'active' : ''} aria-pressed={dateScope === 'all'} onClick={() => onDateScopeChange('all')}>All dates</button>
          <button type="button" className={dateScope === 'range' ? 'active' : ''} aria-pressed={dateScope === 'range'} onClick={() => onDateScopeChange('range')}>Date range</button>
          <button type="button" className={dateScope === 'specific' ? 'active' : ''} aria-pressed={dateScope === 'specific'} onClick={() => onDateScopeChange('specific')}>Specific dates{dateScope === 'specific' && specificDates.size ? ` (${specificDates.size})` : ''}</button>
        </div>
        {dateScope === 'range' && <div className="core-payment-range-fields"><label><span>From</span><input className="form-control" type="date" min={dates[0]} max={dates[dates.length - 1]} value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} /></label><label><span>To</span><input className="form-control" type="date" min={dates[0]} max={dates[dates.length - 1]} value={toDate} onChange={(event) => onToDateChange(event.target.value)} /></label></div>}
        {dateScope === 'specific' && <details className="core-payment-selection">
          <summary>{specificDates.size ? `${specificDates.size} dates selected` : 'Choose dates'}</summary>
          <div className="core-payment-selection-actions"><button type="button" onClick={() => onSpecificDatesChange(new Set(dates))}>Select all</button><button type="button" onClick={() => onSpecificDatesChange(new Set())}>Clear</button></div>
          <div className="core-payment-selection-list date-list">{dates.map((date) => <label key={date}><input type="checkbox" checked={specificDates.has(date)} onChange={(event) => onSpecificDatesChange((current) => toggleSetValue(current, date, event.target.checked))} /><span>{date}</span></label>)}</div>
        </details>}
      </div>
    </div>
  )
}

function describeRuleDates(rule) {
  if (rule.dateScope === 'range') return `${rule.fromDate} to ${rule.toDate}`
  if (rule.dateScope === 'specific') return `${rule.specificDates.length} selected dates`
  return 'All dates'
}

function calculateCandidate(candidate, dates, config) {
  const salary = money(config.salaryByCandidate[candidate.key])
  let workedDays = 0
  let baseAmount = 0
  const allowanceTotals = {}
  const overtimeHoursByDate = {}
  const overtimeRate = money(config.overtimeHourlyRate)
  let deduction = 0
  const deductionNotes = new Set()
  const allowanceTypes = new Set(config.allowances.map((allowance) => allowance.type))
  dates.forEach((date) => {
    const entry = candidate.attendance[date]
    const weight = projectWorkedWeight(candidate, date)
    workedDays += weight
    if (weight > 0) {
      baseAmount += getEffectiveBaseRate(config.baseRateRules || [], candidate.key, date, salary) * weight
    }
    allowanceTypes.forEach((type) => {
      const allowance = getEffectiveAllowanceRule(config.allowances, candidate.key, type, date)
      if (!allowance) return
      if (type === 'Travel Day Meal Allowance') {
        const travelWeight = attendanceWeight(candidate, date)
        if (entry?.kind !== 'travel' || travelWeight <= 0) return
        allowanceTotals[type] = (allowanceTotals[type] || 0) + allowance.amount * travelWeight
        return
      }
      if (weight <= 0) return
      allowanceTotals[type] = (allowanceTotals[type] || 0) + allowance.amount * weight
    })
    const overtimeHours = getCandidateOvertimeHours(candidate, date, config)
    overtimeHoursByDate[date] = overtimeHours
    if (overtimeHours > 0) allowanceTotals.Overtime = (allowanceTotals.Overtime || 0) + overtimeHours * overtimeRate
  })
  config.deductions.forEach((rule) => {
    if (rule.scope === 'selected' && !rule.candidateKeys.includes(candidate.key)) return
    deduction += rule.amount
    deductionNotes.add(rule.note)
  })
  const otherAllowanceTotal = Object.values(allowanceTotals).reduce((sum, amount) => sum + amount, 0)
  const gross = baseAmount + otherAllowanceTotal
  return {
    workedDays,
    baseRate: workedDays > 0 ? baseAmount / workedDays : salary,
    baseAmount,
    overtimeHoursByDate,
    overtimeHours: Object.values(overtimeHoursByDate).reduce((sum, hours) => sum + hours, 0),
    overtimeAmount: allowanceTotals.Overtime || 0,
    allowanceTotals,
    gross,
    deduction,
    deductionNote: [...deductionNotes].join('; '),
    net: gross - deduction,
  }
}

function isRuleDateIncluded(rule, date) {
  if (rule.dateScope === 'range') return date >= rule.fromDate && date <= rule.toDate
  if (rule.dateScope === 'specific') return rule.specificDates.includes(date)
  return true
}

function getEffectiveBaseRate(rules, candidateKey, date, fallback) {
  let effectiveRule = null
  let highestPriority = -1
  rules.forEach((rule) => {
    if (rule.scope === 'selected' && !rule.candidateKeys.includes(candidateKey)) return
    if (!isRuleDateIncluded(rule, date)) return

    const candidatePriority = rule.scope === 'selected' ? 10 : 0
    const datePriority = rule.dateScope === 'specific' ? 2 : rule.dateScope === 'range' ? 1 : 0
    const priority = candidatePriority + datePriority
    if (priority >= highestPriority) {
      effectiveRule = rule
      highestPriority = priority
    }
  })
  return effectiveRule ? effectiveRule.amount : fallback
}

function getEffectiveAllowanceRule(allowances, candidateKey, type, date) {
  let effectiveRule = null
  let highestPriority = -1
  allowances.forEach((rule, index) => {
    if (rule.type !== type) return
    if (rule.scope === 'selected' && !rule.candidateKeys.includes(candidateKey)) return
    if (!isRuleDateIncluded(rule, date)) return

    const candidatePriority = rule.scope === 'selected' ? 10 : 0
    const datePriority = rule.dateScope === 'specific' ? 2 : rule.dateScope === 'range' ? 1 : 0
    const priority = candidatePriority + datePriority
    if (priority > highestPriority || priority === highestPriority) {
      effectiveRule = rule
      highestPriority = priority
    }
  })
  return effectiveRule
}

function formatAttendance(entry) {
  if (!entry || entry.status === 'absent') return 'A'
  if (entry.kind === 'home') return 'H'
  if (entry.kind === 'travel') return 'T'
  return 'P'
}

function formatPaymentAttendance(entry) {
  if (!entry || entry.status === 'absent') return '-'
  if (entry.kind === 'home') return 'H'
  if (entry.kind === 'travel') return 'T'
  return 'P'
}

function toggleSetValue(current, value, checked) {
  const next = new Set(current)
  if (checked) next.add(value)
  else next.delete(value)
  return next
}