import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarAlt, faChevronLeft, faChevronRight, faCompress, faExpand, faIndianRupee } from '@fortawesome/free-solid-svg-icons'
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
const PAYMENT_DEFAULT_ALLOWANCES = [
  { key: 'travel_day_meal_allowance', type: 'Travel Day Meal Allowance' },
  { key: 'food_allowance', type: 'Food Allowance' },
  { key: 'ground_visit_allowance', type: 'Ground Visit' },
  { key: 'training_allowance', type: 'Training' },
  { key: 'laundry_allowance', type: 'Laundry' },
  { key: 'other_allowance', type: 'Other Allowance' },
]
const DEFAULT_RATE_COMPONENTS = [
  { key: 'base_salary', label: 'Base salary' },
  ...PAYMENT_DEFAULT_ALLOWANCES.map(({ key, type }) => ({ key, label: type })),
  { key: 'overtime_hourly_rate', label: 'Overtime' },
]
const getList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload?.data && !Array.isArray(payload.data)) {
    const nested = getList(payload.data)
    if (nested.length) return nested
  }
  for (const key of ['data', 'records', 'items', 'results', 'attendance', 'payments', 'payment_records', 'payment_sheets', 'attendance_payments', 'attendance_payment_sheet', 'sheets', 'projects']) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return []
}

const normalizeSavedAttendancePayments = (payload) => {
  const rows = getList(payload)
  if (rows.length) {
    return rows.flatMap((record) => (
      Array.isArray(record?.attendance)
        ? flattenAttendancePaymentRows([record])
        : [record]
    ))
  }
  const record = payload?.data ?? payload
  if (!record || typeof record !== 'object') return []
  return Array.isArray(record.attendance) ? flattenAttendancePaymentRows([record]) : [record]
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

const getCandidateIdentityKeys = (record) => {
  const candidateId = getRecordValue(record, ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'worker_id', 'id', '_id'])
  const mobile = String(getRecordValue(record, ['mobile', 'candidate_mobile', 'mobile_number', 'phone'], '')).replace(/\D/g, '')
  const aadhaar = String(getRecordValue(record, ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_number'], '')).replace(/\D/g, '')
  return [
    candidateId && `candidate:${String(candidateId).trim().toLowerCase()}`,
    mobile && `mobile:${mobile}`,
    aadhaar && `aadhaar:${aadhaar}`,
  ].filter(Boolean)
}

async function fetchCandidateJoiningDetails() {
  const records = []
  let offset = 0
  while (true) {
    const response = await recruiterAPI.getCandidateJoiningDetails({ offset, limit: PAGE_SIZE })
    const payload = response?.data ?? {}
    const rows = getList(payload)
    records.push(...rows)
    const total = Number(payload?.total ?? payload?.count ?? payload?.totalCount ?? payload?.total_count ?? payload?.data?.total)
    offset += rows.length
    if (!rows.length || rows.length < PAGE_SIZE || (Number.isFinite(total) && offset >= total)) break
  }
  return records
}

function attachPaymentDefaults(candidates, records) {
  const recordsByIdentity = new Map()
  records.forEach((record) => {
    getCandidateIdentityKeys(record).forEach((identity) => {
      if (!recordsByIdentity.has(identity)) recordsByIdentity.set(identity, record)
    })
  })
  return candidates.map((candidate) => {
    const defaultsRecord = getCandidateIdentityKeys(candidate)
      .map((identity) => recordsByIdentity.get(identity))
      .find(Boolean)
    if (!defaultsRecord) return candidate
    return {
      ...candidate,
      paymentDefaults: {
        base_salary: getRecordValue(defaultsRecord, ['base_salary', 'baseSalary', 'base_rate', 'daily_salary'], ''),
        ...Object.fromEntries(PAYMENT_DEFAULT_ALLOWANCES.map(({ key }) => [
          key,
          getRecordValue(defaultsRecord, [key, key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())], ''),
        ])),
        overtime_hourly_rate: getRecordValue(defaultsRecord, ['overtime_hourly_rate', 'overtimeHourlyRate', 'overtime_rate_per_hour', 'overtime_rate'], ''),
      },
    }
  })
}

const makeCandidateDefaultRule = (candidate, type, amount, id) => ({
  id: `candidate-default-${candidate.key}-${id}`,
  type,
  amount: Number(amount),
  scope: 'selected',
  candidateKeys: [candidate.key],
  dateScope: 'all',
  fromDate: '',
  toDate: '',
  specificDates: [],
})

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
  const attendanceRecords = [...selectedProjectRows, ...relevantHomeRows, ...relevantTravelRows]
  return {
    dateRange,
    attendanceRecords,
    candidates: buildCandidates(attendanceRecords, dateRange, projectTitle),
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
      attendanceId: String(getRecordValue(record, ['attendance_id', 'attendanceId', 'id'], '')),
      projectId: String(getRecordValue(record, ['project_id', 'projectId', 'projectID'], '')),
      projectName: String(getRecordValue(record, ['project_name', 'projectName', 'project_title', 'projectTitle'], '')),
      locationId: String(getRecordValue(record, ['location_id', 'locationId', 'district_id', 'districtId'], '')),
      locationName: String(getRecordValue(record, ['location_name', 'locationName', 'location', 'district_name', 'districtName'], '')),
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

const hasPresentProjectAttendance = (candidate, dates) => dates.some((date) => {
  const entry = candidate.attendance[date]
  return entry?.kind === 'project' && entry.status !== 'absent'
})

const money = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

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
  if (config.overtimeMode !== 'automatic') return 0
  const entry = candidate.attendance[date]
  if (entry?.kind !== 'project' || entry.status === 'absent') return 0
  const minutes = getOvertimeMinutes(entry.clockIn, entry.clockOut, config.standardStartTime, config.standardEndTime)
  return Math.floor(minutes / 60)
}

function buildExportSheetData(candidates, dates, config) {
  const allowanceTypes = [...new Set([
    ...config.allowances.map((allowance) => allowance.type),
    ...(config.overtimeRateRules?.length || config.overtimeMode === 'manual' ? ['Overtime'] : []),
  ])]
  const includeOvertimeRate = allowanceTypes.includes('Overtime')
  const includeBasePay = config.baseRateRules.length > 0 || candidates.some((candidate) => (
    config.salaryByCandidate[candidate.key] !== undefined && config.salaryByCandidate[candidate.key] !== ''
  ))
  const includeDeductions = config.deductions.length > 0
  const headers = [
    'S.No', 'Candidate Name', 'Mobile', 'Aadhaar',
    ...dates, 'Total OT Hours', ...(includeOvertimeRate ? ['OT Rate / Hour'] : []), 'Worked Days', ...(includeBasePay ? ['Average Base Rate / Day', 'Base Amount'] : []), ...allowanceTypes,
    'Gross Amount', ...(includeDeductions ? ['Deduction', 'Deduction Note'] : []), 'Net Amount',
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
      ...(includeOvertimeRate ? [amounts.overtimeHours ? amounts.overtimeAmount / amounts.overtimeHours : 0] : []),
      amounts.workedDays,
      ...(includeBasePay ? [amounts.baseRate, amounts.baseAmount] : []),
      ...allowanceTypes.map((type) => amounts.allowanceTotals[type] || 0),
      amounts.gross,
      ...(includeDeductions ? [amounts.deduction, amounts.deductionNote] : []),
      amounts.net,
    ]
  })
  const totalsRow = [
    'TOTAL', '', '', '',
    ...dates.map(() => ''),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.overtimeHours, 0),
    ...(includeOvertimeRate ? [''] : []),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.workedDays, 0),
    ...(includeBasePay ? [
      '',
      amountsByCandidate.reduce((sum, amounts) => sum + amounts.baseAmount, 0),
    ] : []),
    ...allowanceTypes.map((type) => amountsByCandidate.reduce((sum, amounts) => sum + (amounts.allowanceTotals[type] || 0), 0)),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.gross, 0),
    ...(includeDeductions ? [amountsByCandidate.reduce((sum, amounts) => sum + amounts.deduction, 0), ''] : []),
    amountsByCandidate.reduce((sum, amounts) => sum + amounts.net, 0),
  ]
  const overtimeHoursColumn = 4 + dates.length
  const overtimeRateColumn = overtimeHoursColumn + 1
  const workedDaysColumn = overtimeRateColumn + (includeOvertimeRate ? 1 : 0)
  const baseRateColumn = workedDaysColumn + 1
  const baseAmountColumn = baseRateColumn + 1
  const allowanceStartColumn = workedDaysColumn + (includeBasePay ? 3 : 1)
  const grossColumn = allowanceStartColumn + allowanceTypes.length
  const deductionColumn = grossColumn + 1
  const netColumn = grossColumn + (includeDeductions ? 3 : 1)
  const currencyColumns = includeBasePay ? [baseRateColumn, baseAmountColumn] : []
  if (includeOvertimeRate) currencyColumns.push(overtimeRateColumn)
  for (let column = allowanceStartColumn; column <= grossColumn; column += 1) currencyColumns.push(column)
  if (includeDeductions) currencyColumns.push(deductionColumn)
  currencyColumns.push(netColumn)

  return {
    headers,
    rows,
    totalsRow,
    allowanceTypes,
    columns: {
      workedDays: workedDaysColumn,
      includeBasePay,
      includeDeductions,
      currency: currencyColumns,
    },
  }
}

function buildAttendancePaymentRecords(attendanceRecords, candidates, dates, config, projectId, projectTitle) {
  const recordsByCandidate = new Map()
  const missingAttendanceIds = new Set()
  const candidateByKey = new Map(candidates.map((candidate) => [candidate.key, candidate]))
  const overtimeByCandidate = new Map()
  const addOvertime = (candidate, hours, rate) => {
    if (hours <= 0 || rate <= 0) return
    const current = overtimeByCandidate.get(candidate.key) || { hours: 0, amount: 0 }
    current.hours += hours
    current.amount += hours * rate
    overtimeByCandidate.set(candidate.key, current)
  }
  const getCandidateRecord = (candidate) => {
    if (!recordsByCandidate.has(candidate.key)) {
      recordsByCandidate.set(candidate.key, {
        candidate_id: candidate.registrationId || candidate.id,
        candidate_name: candidate.name,
        project_id: projectId,
        project_name: projectTitle,
        locations: [],
        attendance: [],
        overtime: [],
        deductions: [],
      })
    }
    return recordsByCandidate.get(candidate.key)
  }
  const addRecord = (candidate, date, attendanceId, attendance, paymentType, amount, index, note = '') => {
    if (amount === 0) return
    if (!attendanceId) {
      missingAttendanceIds.add(`${candidate.key}|${date}|${index}`)
      return
    }
    const candidateRecord = getCandidateRecord(candidate)
    const locationId = getRecordValue(attendance, ['location_id', 'locationId', 'district_id', 'districtId'])
    const locationName = getRecordValue(attendance, ['location_name', 'locationName', 'location', 'district_name', 'districtName'])
    if (!candidateRecord.locations.some((location) => (
      String(location.location_id) === String(locationId) && String(location.location_name) === String(locationName)
    ))) {
      candidateRecord.locations.push({ location_id: locationId, location_name: locationName })
    }
    const attendanceKey = String(attendanceId)
    let attendanceRecord = candidateRecord.attendance.find((item) => item.attendance_id === attendanceKey)
    if (!attendanceRecord) {
      attendanceRecord = {
        attendance_id: attendanceKey,
        attendance_date: date,
        project_id: getRecordValue(attendance, ['project_id', 'projectId', 'projectID'], projectId),
        project_name: getRecordValue(attendance, ['project_name', 'projectName', 'project_title', 'projectTitle'], projectTitle),
        location_id: getRecordValue(attendance, ['location_id', 'locationId', 'district_id', 'districtId']),
        location_name: getRecordValue(attendance, ['location_name', 'locationName', 'location', 'district_name', 'districtName']),
        payments: [],
      }
      candidateRecord.attendance.push(attendanceRecord)
    }
    attendanceRecord.payments.push({
      payment_type: paymentType,
      amount: Number(amount.toFixed(2)),
      ...(note ? { note } : {}),
    })
  }

  attendanceRecords.forEach((attendance, index) => {
    const candidate = candidateByKey.get(candidateKeyFor(attendance))
    const date = normalizeDate(getRecordValue(attendance, ['date', 'attendance_date', 'attendanceDate']))
    if (!candidate || !dates.includes(date)) return

    const status = normalizeAttendanceStatus(attendance)
    const kind = getAttendanceKind(attendance, attendance._coreSheetSourceProjectId, projectTitle)
    if (status === 'absent') return
    const workedWeight = kind === 'project' ? (status === 'half' ? 0.5 : 1) : 0
    const attendanceWeightForRecord = kind !== 'home' ? (status === 'half' ? 0.5 : 1) : 0
    const attendanceId = getRecordValue(attendance, ['attendance_id', 'attendanceId', 'id'])

    if (workedWeight > 0) {
      const baseRate = getEffectiveBaseRate(config.baseRateRules || [], candidate.key, date, money(config.salaryByCandidate[candidate.key]))
      addRecord(candidate, date, attendanceId, attendance, 'salary', baseRate * workedWeight, index)
    }

    new Set(config.allowances.map((allowance) => allowance.type)).forEach((type) => {
      const allowance = getEffectiveAllowanceRule(config.allowances, candidate.key, type, date)
      if (!allowance) return
      if (type === 'Travel Day Meal Allowance') {
        if (kind !== 'travel' || attendanceWeightForRecord <= 0) return
        addRecord(candidate, date, attendanceId, attendance, type, allowance.amount * attendanceWeightForRecord, index)
        return
      }
      if (workedWeight <= 0) return
      addRecord(candidate, date, attendanceId, attendance, type, allowance.amount * workedWeight, index)
    })

    const overtimeMinutes = kind !== 'project' || config.overtimeMode !== 'automatic'
      ? 0
      : getOvertimeMinutes(
        getRecordValue(attendance, ['clock_in', 'clockIn', 'check_in_time', 'checkInTime', 'check_in']),
        getRecordValue(attendance, ['clock_out', 'clockOut', 'check_out_time', 'checkOutTime', 'check_out']),
        config.standardStartTime,
        config.standardEndTime,
      )
    const overtimeHours = Math.floor(overtimeMinutes / 60)
    const overtimeRate = getConfiguredOvertimeRate(config, candidate.key, date)
    addOvertime(candidate, overtimeHours, overtimeRate)
  })

  if (config.overtimeMode === 'manual') {
    candidates.forEach((candidate) => {
      const hours = Math.max(0, money(config.manualOvertimeHours?.[candidate.key]))
      const rate = getConfiguredOvertimeRate(config, candidate.key, '')
      if (!hasPresentProjectAttendance(candidate, dates)) return
      addOvertime(candidate, hours, rate)
    })
  }

  overtimeByCandidate.forEach(({ hours, amount }, candidateKey) => {
    const candidate = candidateByKey.get(candidateKey)
    const candidateRecord = getCandidateRecord(candidate)
    candidateRecord.overtime.push({
      from_date: dates[0],
      to_date: dates[dates.length - 1],
      amount: Number(amount.toFixed(2)),
      overtime_hours: hours,
      overtime_rate: Number((amount / hours).toFixed(2)),
    })
  })

  candidates.forEach((candidate) => {
    const applicableDeductions = (config.deductions || []).filter((rule) => (
      rule.scope !== 'selected' || rule.candidateKeys.includes(candidate.key)
    ))
    if (!applicableDeductions.length) return

    applicableDeductions.forEach((rule) => {
      getCandidateRecord(candidate).deductions.push({
        amount: money(rule.amount),
        note: rule.note,
      })
    })
  })

  return { records: [...recordsByCandidate.values()], missingAttendanceIdCount: missingAttendanceIds.size }
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
  const [selectedDefaultRateKeys, setSelectedDefaultRateKeys] = useState(() => new Set())
  const [dates, setDates] = useState([])
  const [candidates, setCandidates] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [existingAttendancePayments, setExistingAttendancePayments] = useState([])
  const [existingPaymentsLoading, setExistingPaymentsLoading] = useState(false)
  const [existingPaymentsError, setExistingPaymentsError] = useState('')
  const [paymentHistoryCandidate, setPaymentHistoryCandidate] = useState(null)
  const [ready, setReady] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [postingAttendanceSheet, setPostingAttendanceSheet] = useState(false)
  const [attendancePostResult, setAttendancePostResult] = useState(null)
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
  const [overtimeMode, setOvertimeMode] = useState('automatic')
  const [overtimeHourlyRate, setOvertimeHourlyRate] = useState('')
  const [standardStartTime, setStandardStartTime] = useState('')
  const [standardEndTime, setStandardEndTime] = useState('')
  const [manualOvertimeHours, setManualOvertimeHours] = useState({})
  const [overtimeRateRules, setOvertimeRateRules] = useState([])
  const [overtimeRateAudience, setOvertimeRateAudience] = useState('all')
  const [overtimeRateCandidateKeys, setOvertimeRateCandidateKeys] = useState(new Set())
  const [overtimeRateDateScope, setOvertimeRateDateScope] = useState('all')
  const [overtimeRateFromDate, setOvertimeRateFromDate] = useState('')
  const [overtimeRateToDate, setOvertimeRateToDate] = useState('')
  const [overtimeRateSpecificDates, setOvertimeRateSpecificDates] = useState(new Set())
  const [candidateSearch, setCandidateSearch] = useState('')
  const [attendanceCandidate, setAttendanceCandidate] = useState(null)
  const [activeConfigSection, setActiveConfigSection] = useState('base')
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [changedPreviewCells, setChangedPreviewCells] = useState(() => new Set())
  const previousPreviewSnapshot = useRef(null)
  const previewFlashTimer = useRef(null)
  const selectedProject = availableProjects.find((project) => project.id === selectedProjectId)
  const selectedProjectTitle = selectedProject?.name || (selectedProjectId === initialProjectId ? projectTitle : '')
  const selectedProjectTypeValue = String(selectedProject?.projectType || '').toLowerCase().replace(/[-\s]/g, '_')
  const selectedProjectType = selectedProjectTypeValue.includes('written') || selectedProjectTypeValue.includes('exam')
    ? 'written_exam'
    : selectedProject ? 'regular' : projectType
  const directPaymentProject = useMemo(() => ({
    id: selectedProjectId,
    name: selectedProjectTitle,
    projectType: selectedProjectType,
  }), [selectedProjectId, selectedProjectTitle, selectedProjectType])
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
      overtimeRateRules,
      overtimeHourlyRate,
      overtimeMode,
      manualOvertimeHours,
      standardStartTime,
      standardEndTime,
    })
    result.gross += amount.gross
    result.net += amount.net
    result.overtimeHours += amount.overtimeHours
    result.overtimeAmount += amount.overtimeAmount
    return result
  }, { gross: 0, net: 0, overtimeHours: 0, overtimeAmount: 0 }), [allowances, baseRateRules, candidates, dates, deductions, manualOvertimeHours, overtimeHourlyRate, overtimeMode, overtimeRateRules, salaryByCandidate, standardEndTime, standardStartTime])
  const exportSheetData = useMemo(() => buildExportSheetData(candidates, dates, {
    salaryByCandidate,
    baseRateRules,
    deductions,
    allowances,
    overtimeRateRules,
    overtimeHourlyRate,
    overtimeMode,
    manualOvertimeHours,
    standardStartTime,
    standardEndTime,
  }), [allowances, baseRateRules, candidates, dates, deductions, manualOvertimeHours, overtimeHourlyRate, overtimeMode, overtimeRateRules, salaryByCandidate, standardEndTime, standardStartTime])

  useEffect(() => {
    const currentRows = new Map(candidates.map((candidate, index) => [candidate.key, exportSheetData.rows[index]]))
    const currentSnapshot = {
      headers: exportSheetData.headers,
      rows: currentRows,
      totals: exportSheetData.totalsRow,
    }
    const previousSnapshot = previousPreviewSnapshot.current
    previousPreviewSnapshot.current = currentSnapshot
    if (!previousSnapshot) return

    const previousColumnByHeader = new Map(previousSnapshot.headers.map((header, index) => [header, index]))
    const changedCells = new Set()
    currentRows.forEach((row, candidateKey) => {
      const previousRow = previousSnapshot.rows.get(candidateKey)
      if (!previousRow) return
      for (let column = 4; column < exportSheetData.headers.length; column += 1) {
        const value = row[column]
        const previousColumn = previousColumnByHeader.get(exportSheetData.headers[column])
        const previousValue = previousColumn === undefined ? 0 : previousRow[previousColumn]
        if (typeof value === 'number' && value !== previousValue) {
          changedCells.add(`${candidateKey}:${column}`)
        }
      }
    })
    exportSheetData.totalsRow.forEach((value, column) => {
      const previousColumn = previousColumnByHeader.get(exportSheetData.headers[column])
      const previousValue = previousColumn === undefined ? 0 : previousSnapshot.totals[previousColumn]
      if (column >= 4 && typeof value === 'number' && value !== previousValue) {
        changedCells.add(`__total__:${column}`)
      }
    })
    if (!changedCells.size) return

    setChangedPreviewCells((current) => new Set([...current, ...changedCells]))
    if (previewFlashTimer.current) window.clearTimeout(previewFlashTimer.current)
    previewFlashTimer.current = window.setTimeout(() => setChangedPreviewCells(new Set()), 1100)
  }, [candidates, exportSheetData.headers, exportSheetData.rows, exportSheetData.totalsRow])

  useEffect(() => () => {
    if (previewFlashTimer.current) window.clearTimeout(previewFlashTimer.current)
  }, [])

  const calculateCurrentCandidate = (candidate) => calculateCandidate(candidate, dates, {
    salaryByCandidate,
    baseRateRules,
    deductions,
    allowances,
    overtimeRateRules,
    overtimeHourlyRate,
    overtimeMode,
    manualOvertimeHours,
    standardStartTime,
    standardEndTime,
  })

  const existingPaymentsByCandidate = new Map(candidates.map((candidate) => {
    const candidateIdentifiers = new Set([
      candidate.key,
      candidate.id,
      candidate.registrationId,
      candidate.mobile,
    ].filter(Boolean).map(String))
    const payments = existingAttendancePayments.filter((record) => (
      ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'user_id', 'userId', 'mobile', 'mobile_number', 'phone']
        .some((field) => {
          const value = record?.[field]
          return value !== undefined && value !== null && candidateIdentifiers.has(String(value))
        })
    ))
    return [candidate.key, payments]
  }))

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
      const { dateRange, candidates: nextCandidates, attendanceRecords: nextAttendanceRecords } = await loadCoreAttendanceData(selectedProjectId, fromDate, toDate, selectedProjectType, selectedProjectTitle)
      let joiningDetails = []
      try {
        joiningDetails = await fetchCandidateJoiningDetails()
      } catch (joiningDetailsError) {
        console.warn('Unable to load candidate payment defaults:', joiningDetailsError)
      }
      const candidatesWithDefaults = attachPaymentDefaults(nextCandidates, joiningDetails)
      const sharedDefault = (key) => {
        if (!selectedDefaultRateKeys.has(key)) return ''
        const values = candidatesWithDefaults
          .map((candidate) => candidate.paymentDefaults?.[key])
          .filter((value) => value !== '' && value !== null && value !== undefined)
          .map(Number)
        return values.length === candidatesWithDefaults.length && values.length > 0 && values.every((value) => value === values[0])
          ? String(values[0])
          : ''
      }
      const defaultAllowances = candidatesWithDefaults.flatMap((candidate) => PAYMENT_DEFAULT_ALLOWANCES.filter(({ key }) => (
        selectedDefaultRateKeys.has(key)
      )).flatMap(({ key, type }) => {
        const amount = candidate.paymentDefaults?.[key]
        return amount === '' || amount === null || amount === undefined || !Number.isFinite(Number(amount))
          ? []
          : [makeCandidateDefaultRule(candidate, type, amount, key)]
      }))
      const defaultOvertimeRates = candidatesWithDefaults.flatMap((candidate) => {
        if (!selectedDefaultRateKeys.has('overtime_hourly_rate')) return []
        const amount = candidate.paymentDefaults?.overtime_hourly_rate
        return amount === '' || amount === null || amount === undefined || !Number.isFinite(Number(amount))
          ? []
          : [makeCandidateDefaultRule(candidate, 'Overtime', amount, 'overtime_hourly_rate')]
      })
      setDates(dateRange)
      setCandidates(candidatesWithDefaults)
      setAttendanceRecords(nextAttendanceRecords)
      setExistingAttendancePayments([])
      setExistingPaymentsError('')
      setSalaryByCandidate(Object.fromEntries(candidatesWithDefaults.map((candidate) => [
        candidate.key,
        selectedDefaultRateKeys.has('base_salary') ? candidate.paymentDefaults?.base_salary ?? '' : '',
      ])))
      setDefaultBaseRate(sharedDefault('base_salary'))
      setAllowanceAmount(sharedDefault('travel_day_meal_allowance'))
      setAllowances(defaultAllowances)
      setOvertimeHourlyRate(sharedDefault('overtime_hourly_rate'))
      setOvertimeRateRules(defaultOvertimeRates)
      setDeductions([])
      setBaseRateRules([])
      setManualOvertimeHours({})
      setActiveConfigSection('base')
      setAttendancePostResult(null)
      setReady(true)
      setStep(1)
      setExistingPaymentsLoading(true)
      try {
        const attendanceIds = [...new Set(nextAttendanceRecords.map((record) => (
          getRecordValue(record, ['attendance_id', 'attendanceId', 'id'])
        )).filter(Boolean).map(String))]
        const savedPayments = []
        for (let offset = 0; offset < attendanceIds.length; offset += 25) {
          const batch = attendanceIds.slice(offset, offset + 25)
          const paymentResponses = await Promise.all(batch.map((attendanceId) => (
            coreRecruiterAPI.getAttendancePaymentSheet(attendanceId)
          )))
          paymentResponses.forEach((response) => {
            savedPayments.push(...normalizeSavedAttendancePayments(response?.data ?? response))
          })
        }
        setExistingAttendancePayments(savedPayments)
      } catch (paymentsError) {
        console.error('Failed to load saved attendance payments:', paymentsError)
        setExistingPaymentsError('Previously saved payments could not be loaded.')
      } finally {
        setExistingPaymentsLoading(false)
      }
    } catch (loadError) {
      console.error('Failed to load core team payment attendance:', loadError)
      setError('Unable to load attendance for this date range. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const continueFromPeriod = async () => {
    if (!selectedProjectId) {
      setError('Select a project to continue.')
      return
    }
    if (fromDate && toDate && fromDate > toDate) {
      setError('The from date must be on or before the to date.')
      return
    }
    await loadAttendance()
  }

  const refreshAttendance = async () => {
    setLoading(true)
    try {
      const { dateRange, candidates: nextCandidates, attendanceRecords: nextAttendanceRecords } = await loadCoreAttendanceData(selectedProjectId, fromDate, toDate, selectedProjectType, selectedProjectTitle)
      setDates(dateRange)
      setCandidates(nextCandidates)
      setAttendanceRecords(nextAttendanceRecords)
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

  const chooseAllowanceType = (type) => {
    setAllowanceType(type)
    const savedRates = type === 'Overtime'
      ? overtimeRateRules
      : allowances.filter((allowance) => allowance.type === type)
    const distinctAmounts = [...new Set(savedRates.map((rule) => String(rule.amount)))]
    setAllowanceAmount(distinctAmounts.length === 1 ? distinctAmounts[0] : '')
    setAllowanceCandidateKeys(new Set())
    setError('')
  }

  const addOvertimeRateRule = (scope) => {
    if (overtimeHourlyRate === '' || !Number.isFinite(Number(overtimeHourlyRate)) || Number(overtimeHourlyRate) < 0) {
      setError('Enter a valid overtime amount per hour.')
      return
    }
    if (scope === 'selected' && overtimeRateCandidateKeys.size === 0) {
      setError('Select at least one team member for this overtime rate.')
      return
    }
    if ((overtimeRateDateScope === 'range' && (!overtimeRateFromDate || !overtimeRateToDate || overtimeRateFromDate > overtimeRateToDate)) || (overtimeRateDateScope === 'specific' && overtimeRateSpecificDates.size === 0)) {
      setError('Choose valid dates for this overtime rate.')
      return
    }
    setError('')
    setOvertimeRateRules((current) => [...current, {
      id: `${Date.now()}-${current.length}`,
      amount: Number(overtimeHourlyRate),
      scope,
      candidateKeys: scope === 'selected' ? [...overtimeRateCandidateKeys] : [],
      dateScope: overtimeRateDateScope,
      fromDate: overtimeRateDateScope === 'range' ? overtimeRateFromDate : '',
      toDate: overtimeRateDateScope === 'range' ? overtimeRateToDate : '',
      specificDates: overtimeRateDateScope === 'specific' ? [...overtimeRateSpecificDates] : [],
    }])
    setOvertimeHourlyRate('')
    setOvertimeRateCandidateKeys(new Set())
    setOvertimeRateFromDate('')
    setOvertimeRateToDate('')
    setOvertimeRateSpecificDates(new Set())
    setOvertimeRateDateScope('all')
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

  const validateEarnings = () => {
    if (candidates.some((candidate) => money(salaryByCandidate[candidate.key]) < 0)) {
      setError('Base salary amounts must be zero or greater.')
      return
    }
    const overtimeEnabled = overtimeMode === 'manual'
      ? candidates.some((candidate) => money(manualOvertimeHours[candidate.key]) > 0)
      : overtimeRateRules.length > 0
    if (overtimeEnabled) {
      if (overtimeMode === 'manual' && (overtimeHourlyRate === '' || !Number.isFinite(Number(overtimeHourlyRate)) || Number(overtimeHourlyRate) < 0)) {
        setError('Enter a valid overtime hourly rate.')
        return
      }
      if (overtimeMode === 'automatic' && !overtimeRateRules.length) {
        setError('Add an overtime hourly rate for everyone or selected people.')
        return
      }
      if (overtimeMode === 'automatic' && (!standardStartTime || !standardEndTime)) {
        setError('Enter the project standard start and end times to calculate overtime.')
        return
      }
    }
    setError('')
    return true
  }

  const exportWorkbook = async () => {
    if (!candidates.length) {
      setError('No attendance records were found for this date range.')
      return
    }
    if (!validateEarnings()) return
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

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Core Team Payments')
      const safeTitle = String(selectedProjectTitle || 'core_team').replace(/[\\/:*?"<>|]+/g, '_').trim()
      XLSX.writeFile(workbook, `core_team_payment_${safeTitle}_${fromDate}_${toDate}.xlsx`)
    } catch (exportError) {
      console.error('Failed to generate core team payment sheet:', exportError)
      setError('Unable to generate the Excel sheet. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const postAttendanceSheetData = async () => {
    if (!candidates.length) {
      setError('No attendance records were found for this date range.')
      return
    }
    if (!validateEarnings()) return

    const { records, missingAttendanceIdCount } = buildAttendancePaymentRecords(attendanceRecords, candidates, dates, {
      salaryByCandidate,
      baseRateRules,
      deductions,
      allowances,
      overtimeRateRules,
      overtimeHourlyRate,
      overtimeMode,
      manualOvertimeHours,
      standardStartTime,
      standardEndTime,
    }, selectedProjectId, selectedProjectTitle)
    if (missingAttendanceIdCount) {
      setError(`${missingAttendanceIdCount} attendance record${missingAttendanceIdCount === 1 ? ' is' : 's are'} missing an attendance ID. No payment data was posted.`)
      return
    }
    if (!records.length) {
      setError('No payable attendance items were generated for this date range.')
      return
    }

    setPostingAttendanceSheet(true)
    setError('')
    setAttendancePostResult(null)
    try {
      const response = await coreRecruiterAPI.saveAttendancePaymentSheet(records)
      setAttendancePostResult({ request: records, response: response?.data ?? response })
    } catch (postError) {
      console.error('Failed to post attendance payment data:', postError)
      setError(postError.message || 'Unable to post attendance payment data.')
    } finally {
      setPostingAttendanceSheet(false)
    }
  }

  const visibleCandidateRows = candidates.map((candidate, index) => ({
    candidate,
    row: exportSheetData.rows[index],
  })).filter(({ candidate }) =>
    !candidateSearch || `${candidate.name} ${candidate.id} ${candidate.mobile}`.toLowerCase().includes(candidateSearch.trim().toLowerCase()),
  )
  const hasConfiguredBasePay = baseRateRules.length > 0 || candidates.some((candidate) => (
    salaryByCandidate[candidate.key] !== undefined && salaryByCandidate[candidate.key] !== ''
  ))
  const configuredBaseRateCount = baseRateRules.length + candidates.filter((candidate) => (
    salaryByCandidate[candidate.key] !== undefined && salaryByCandidate[candidate.key] !== ''
  )).length
  const configuredAllowanceCount = allowances.length + overtimeRateRules.length
  const totalWorkedDays = candidates.reduce((sum, candidate) => sum + dates.reduce((days, date) => days + projectWorkedWeight(candidate, date), 0), 0)
  const formatPreviewValue = (value, column) => {
    if (value === '' || value === null || value === undefined) return ''
    if (exportSheetData.columns.currency.includes(column)) {
      return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return String(value)
  }
  const formatCurrency = (value) => Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const stepNames = ['Period & project', 'Rates & review']
  const goBack = () => {
    setStep((current) => current - 1)
    setError('')
  }
  const footer = (
    <div className="core-payment-footer">
      <button type="button" className="btn btn-outline" onClick={step === 0 ? onClose : goBack}>
        {step === 0 ? 'Cancel' : 'Back'}
      </button>
      {step === 0 && <button type="button" className="btn btn-primary" onClick={continueFromPeriod} disabled={loading}>{loading ? 'Loading attendance...' : 'Load attendance & selected rates'}</button>}
      {step === 1 && <>
        <button type="button" className="btn btn-outline" onClick={postAttendanceSheetData} disabled={loading || generating || postingAttendanceSheet || candidates.length === 0}>{postingAttendanceSheet ? 'Saving attendance data...' : 'Save attendance data'}</button>
        <button type="button" className="btn btn-primary" onClick={exportWorkbook} disabled={loading || generating || postingAttendanceSheet || candidates.length === 0}>{generating ? 'Preparing workbook...' : 'Export Excel'}</button>
      </>}
    </div>
  )

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Core team attendance earnings" fullScreen footer={footer}>
      <div className="core-payment-sheet">
        <nav className="core-payment-steps" aria-label="Payment sheet steps">
          {stepNames.map((name, index) => <div key={name} className={`core-payment-step${step === index ? ' active' : ''}${step > index ? ' complete' : ''}`}><span>{step > index ? '✓' : index + 1}</span>{name}</div>)}
        </nav>

        {step === 0 && <section className="core-payment-period">
          <div className="core-payment-intro">
            <span className="core-payment-eyebrow">STEP 1 OF 2 · ATTENDANCE PERIOD</span>
            <h2>Choose a project and date range</h2>
            <p>Attendance from these dates will be brought into the payment sheet.</p>
          </div>
          <div className="core-payment-date-fields">
            <label><span>Project</span><SearchableProjectSelect options={projectOptions} value={selectedProjectId} onChange={setSelectedProjectId} placeholder={projectsLoading ? 'Loading projects...' : 'Search project'} disabled={projectsLoading} /></label>
            <label><span>From date</span><input className="form-control" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label><span>To date</span><input className="form-control" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          </div>
          <fieldset className="core-payment-default-rate-picker">
            <legend>Saved default rates to load</legend>
            <div className="core-payment-default-rate-heading">
              <span>Select the components to prefill. You can still change every amount in the next step.</span>
              <div>
                <button type="button" onClick={() => setSelectedDefaultRateKeys(new Set(DEFAULT_RATE_COMPONENTS.map(({ key }) => key)))}>Select all</button>
                <button type="button" onClick={() => setSelectedDefaultRateKeys(new Set())}>Clear</button>
              </div>
            </div>
            <div className="core-payment-default-rate-options">
              {DEFAULT_RATE_COMPONENTS.map(({ key, label }) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={selectedDefaultRateKeys.has(key)}
                    onChange={(event) => setSelectedDefaultRateKeys((current) => toggleSetValue(current, key, event.target.checked))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="core-payment-note"><strong>Included automatically</strong><span>Project attendance, plus eligible Home and Travel attendance. Home and Travel do not count toward base pay.</span></div>
          {error && <div className="attendance-message error">{error}</div>}
        </section>}

        {step === 1 && ready && <div className="core-payment-workspace">
          <header className="core-payment-context">
            <div><span className="core-payment-eyebrow">STEP 2 · EARNINGS SETUP</span><strong>{selectedProjectTitle} + Home + Travel</strong></div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setStep(0); setReady(false); setError('') }}>Change dates</button>
            <span>{fromDate} to {toDate} · {candidates.length} team members</span>
          </header>
          <div className="core-payment-formula"><strong>Configure rates, then review</strong><span>Base pay + allowances + overtime − deductions</span></div>
          {error && <div className="attendance-message error">{error}</div>}

          <div className={`core-payment-live-workspace${previewExpanded ? ' is-preview-expanded' : ''}`}>
          <div className="core-payment-setup-column">
          <nav className="core-payment-config-tabs" role="tablist" aria-label="Payment sheet setup">
            {[
              { id: 'base', label: 'Base pay', count: configuredBaseRateCount },
              { id: 'allowances', label: 'Allowances & OT', count: configuredAllowanceCount },
              { id: 'deductions', label: 'Deductions', count: deductions.length },
            ].map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                id={`core-payment-tab-${section.id}`}
                aria-selected={activeConfigSection === section.id}
                aria-controls="core-payment-config-panel"
                className={activeConfigSection === section.id ? 'active' : ''}
                onClick={() => setActiveConfigSection(section.id)}
              >
                <span>{section.label}</span>
                {section.count !== null && <small>{section.count}</small>}
              </button>
            ))}
          </nav>

          <div className="core-payment-config-panel" id="core-payment-config-panel" role="tabpanel" aria-labelledby={`core-payment-tab-${activeConfigSection}`}>
          {activeConfigSection === 'base' && <div className="core-payment-base-pay">
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
          </div>}

          {activeConfigSection === 'allowances' && <div className="core-payment-adjustment-grid">
          <section className="core-payment-panel">
            <div className="core-payment-panel-heading"><div><h3>Allowances & overtime</h3><p>Choose a category to review its saved rates or add a new one. Travel meal applies on Travel days; other allowances apply on present project days.</p></div></div>
            <div className="core-payment-allowance-categories" role="group" aria-label="Allowance category">
              {ALLOWANCE_TYPES.map((type) => {
                const savedRates = type === 'Overtime'
                  ? overtimeRateRules
                  : allowances.filter((allowance) => allowance.type === type)
                const distinctAmounts = [...new Set(savedRates.map((rule) => Number(rule.amount)))]
                const rateSummary = distinctAmounts.length === 0
                  ? 'No saved rate'
                  : distinctAmounts.length === 1
                    ? `₹${distinctAmounts[0]}${type === 'Overtime' ? '/hour' : '/day'}`
                    : `${savedRates.length} saved rates`
                return (
                  <button
                    key={type}
                    type="button"
                    className={allowanceType === type ? 'active' : ''}
                    aria-pressed={allowanceType === type}
                    onClick={() => chooseAllowanceType(type)}
                  >
                    <strong>{type}</strong>
                    <small>{rateSummary}</small>
                  </button>
                )
              })}
            </div>
            <div className="core-payment-allowance-form">
              <div className="core-payment-selected-category"><span>Editing category</span><strong>{allowanceType}</strong></div>
              {allowanceType !== 'Overtime' && <label><span>Amount per day</span><div className="core-payment-currency"><span>₹</span><input className="form-control" type="number" min="0" value={allowanceAmount} onChange={(event) => setAllowanceAmount(event.target.value)} placeholder="Enter amount" /></div></label>}
            </div>
            {allowanceType === 'Overtime' && <div className="core-payment-overtime-settings">
              <div className="core-payment-overtime-modes">
                <span className="core-payment-target-label">Overtime method</span>
                <div className="core-payment-segmented" role="group" aria-label="Overtime hours source">
                  <button type="button" className={overtimeMode === 'automatic' ? 'active' : ''} aria-pressed={overtimeMode === 'automatic'} onClick={() => setOvertimeMode('automatic')}>Automatic</button>
                  <button type="button" className={overtimeMode === 'manual' ? 'active' : ''} aria-pressed={overtimeMode === 'manual'} onClick={() => setOvertimeMode('manual')}>Manual</button>
                </div>
              </div>
              <div className="core-payment-overtime-rate-config">
                <label><span>{overtimeMode === 'manual' ? 'OT rate per hour' : 'Hourly rate for rule'}</span><div className="core-payment-currency"><span>₹</span><input className="form-control" type="number" min="0" value={overtimeHourlyRate} onChange={(event) => setOvertimeHourlyRate(event.target.value)} placeholder="Enter amount" /></div></label>
                {overtimeMode === 'automatic' && <>
                <div>
                  <span className="core-payment-target-label">Applies to</span>
                  <div className="core-payment-segmented" role="group" aria-label="Who receives this overtime rate">
                    <button type="button" className={overtimeRateAudience === 'all' ? 'active' : ''} aria-pressed={overtimeRateAudience === 'all'} onClick={() => setOvertimeRateAudience('all')}>Everyone</button>
                    <button type="button" className={overtimeRateAudience === 'selected' ? 'active' : ''} aria-pressed={overtimeRateAudience === 'selected'} onClick={() => setOvertimeRateAudience('selected')}>Selected people</button>
                  </div>
                </div>
                {overtimeRateAudience === 'selected' && <CandidateGroupPicker candidates={candidates} selectedCandidateKeys={overtimeRateCandidateKeys} onSelectedCandidateKeysChange={setOvertimeRateCandidateKeys} />}
                <TargetingControls title="Overtime rate dates" dates={dates} dateScope={overtimeRateDateScope} onDateScopeChange={setOvertimeRateDateScope} fromDate={overtimeRateFromDate} onFromDateChange={setOvertimeRateFromDate} toDate={overtimeRateToDate} onToDateChange={setOvertimeRateToDate} specificDates={overtimeRateSpecificDates} onSpecificDatesChange={setOvertimeRateSpecificDates} />
                {overtimeRateRules.length > 0 && <ul className="core-payment-allowance-list">{overtimeRateRules.map((rule) => <li key={rule.id}><span><strong>₹{rule.amount}/hour</strong> · {rule.scope === 'all' ? 'Everyone' : `${rule.candidateKeys.length} selected`} · {describeRuleDates(rule)}</span><button type="button" onClick={() => setOvertimeRateRules((current) => current.filter((item) => item.id !== rule.id))}>Remove</button></li>)}</ul>}
                </>}
              </div>
              {overtimeMode === 'automatic' ? <div className="core-payment-overtime-times">
                <label><span>Standard start time</span><input className="form-control" type="time" value={standardStartTime} onChange={(event) => setStandardStartTime(event.target.value)} /></label>
                <label><span>Standard end time</span><input className="form-control" type="time" value={standardEndTime} onChange={(event) => setStandardEndTime(event.target.value)} /></label>
                <p>Only complete hours before the start or after the end count; partial hours are ignored.</p>
              </div> : <div className="core-payment-overtime-times">
                <p>Enter total hours in the table. The OT amount is saved against the earliest present project date.</p>
              </div>}
              {overtimeMode === 'automatic' && <div className="core-payment-adjustment-actions">
                <button type="button" className="btn btn-primary" onClick={() => addOvertimeRateRule('all')}>Add for everyone</button>
                <button type="button" className="btn btn-outline" onClick={() => addOvertimeRateRule('selected')} disabled={overtimeRateCandidateKeys.size === 0}>Add to {overtimeRateCandidateKeys.size} selected</button>
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

          </div>}

          {activeConfigSection === 'deductions' && <div className="core-payment-adjustment-grid"><section className="core-payment-panel">
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
          </section></div>}

          </div>
          </div>

          <section className="core-payment-review" aria-label="Live payment sheet preview">
          {existingPaymentsError && <div className="attendance-message error" role="status">{existingPaymentsError}</div>}
          {existingPaymentsLoading && <div className="core-payment-existing-payments-status" role="status">Loading saved payments...</div>}
          <header className="core-payment-preview-heading">
            <div><strong>Live payment sheet</strong><span>Updates as you configure rates</span></div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPreviewExpanded((expanded) => !expanded)}
              aria-pressed={previewExpanded}
              aria-label={previewExpanded ? 'Exit full view' : 'View sheet full screen'}
            >
              <FontAwesomeIcon icon={previewExpanded ? faCompress : faExpand} />
              {previewExpanded ? 'Exit full view' : 'Full view'}
            </button>
          </header>
          <div className="core-payment-review-summary">
            <div><span>Team members</span><strong>{candidates.length}</strong></div>
            <div><span>Worked days</span><strong>{totalWorkedDays.toFixed(2)}</strong></div>
            <div><span>Gross earnings</span><strong>₹{formatCurrency(totals.gross)}</strong></div>
            <div className="net"><span>Estimated net</span><strong>₹{formatCurrency(totals.net)}</strong></div>
          </div>
          <div className="core-payment-export-preview">
            <div className="core-payment-export-title">{selectedProjectTitle || 'Core Team'} Core Team Attendance and Payment Sheet</div>
            <div className="core-payment-export-date-range">Date range: {fromDate} to {toDate}</div>
            <label className="core-payment-search"><span className="sr-only">Search team members</span><input className="form-control" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search name, ID, or mobile" /></label>
            <div className="core-payment-export-table-wrap">
              <table className="core-payment-export-table">
                <thead><tr>{exportSheetData.headers.map((header, column) => <th className={column >= 4 && column < 4 + dates.length ? 'attendance-date' : ''} key={`${header}-${column}`}>{header}</th>)}</tr></thead>
                <tbody>
                  {visibleCandidateRows.map(({ candidate, row }) => {
                    const savedPayments = existingPaymentsByCandidate.get(candidate.key) || []
                    return <tr key={candidate.key}>
                    {row.map((value, column) => {
                      if (overtimeMode === 'manual' && column === 4 + dates.length) {
                        const hasProjectAttendance = hasPresentProjectAttendance(candidate, dates)
                        return <td className={changedPreviewCells.has(`${candidate.key}:${column}`) ? 'core-payment-updated-cell' : ''} key={`${candidate.key}-${column}`}><input className="form-control core-payment-manual-ot-hours" type="number" min="0" step="0.25" value={manualOvertimeHours[candidate.key] ?? ''} onChange={(event) => setManualOvertimeHours((current) => ({ ...current, [candidate.key]: event.target.value }))} disabled={!hasProjectAttendance} title={hasProjectAttendance ? undefined : 'No present project attendance in this period'} aria-label={`Total overtime hours for ${candidate.name}`} /></td>
                      }
                      const isAttendanceDate = column >= 4 && column < 4 + dates.length
                      const attendanceParts = isAttendanceDate ? String(value).match(/^([PHTA])(?: \(\+(\d+) hrs\))?$/) : null
                      const date = isAttendanceDate ? dates[column - 4] : ''
                      const attendanceEntry = date ? candidate.attendance[date] : null
                      const datePayments = date ? savedPayments.filter((record) => normalizeDate(getRecordValue(record, ['attendance_date', 'date'])) === date) : []
                      const savedAmount = datePayments.reduce((sum, record) => sum + money(getRecordValue(record, ['amount', 'payment_amount'])), 0)
                      const savedDetails = datePayments.map((record) => `${getRecordValue(record, ['payment_type', 'paymentType', 'type'], 'Payment')}: ₹${money(getRecordValue(record, ['amount', 'payment_amount'])).toFixed(2)}`).join('\n')
                      const clockDetails = attendanceParts?.[1] === 'P' && attendanceEntry
                        ? [attendanceEntry.clockIn && `Check-in: ${attendanceEntry.clockIn}`, attendanceEntry.clockOut && `Check-out: ${attendanceEntry.clockOut}`].filter(Boolean).join('\n')
                        : ''
                      const cellTitle = [clockDetails, savedDetails].filter(Boolean).join('\n\n') || undefined
                      if (column === 1) return <td key={`${candidate.key}-${column}`}><div className="core-payment-member-identity"><strong>{value}</strong><button type="button" className="core-payment-calendar-button" onClick={() => setAttendanceCandidate(candidate)} disabled={!candidate.registrationId} title={candidate.registrationId ? `Edit attendance for ${candidate.name}` : 'Registration ID unavailable'} aria-label={`Open attendance calendar for ${candidate.name}`}><FontAwesomeIcon icon={faCalendarAlt} /></button><button type="button" className="core-payment-history-button" onClick={() => setPaymentHistoryCandidate(candidate)} title={`View saved payments for ${candidate.name}`} aria-label={`View saved payments for ${candidate.name}`}><FontAwesomeIcon icon={faIndianRupee} /></button></div></td>
                      const attendanceClassName = isAttendanceDate
                        ? `attendance-date${datePayments.length > 0 ? ' has-saved-payment' : ''}`
                        : ''
                      const updatedClassName = changedPreviewCells.has(`${candidate.key}:${column}`) ? 'core-payment-updated-cell' : ''
                      return <td className={[attendanceClassName, updatedClassName].filter(Boolean).join(' ')} title={cellTitle} key={`${candidate.key}-${column}`}>{attendanceParts ? <>{attendanceParts[1]}{attendanceParts[2] && <> (+{attendanceParts[2]} hrs)</>}{datePayments.length > 0 && <small className="core-payment-saved-date-amount">Saved net ₹{savedAmount.toFixed(2)}</small>}</> : formatPreviewValue(value, column)}</td>
                    })}
                    </tr>})}
                  {visibleCandidateRows.length === 0 && <tr><td colSpan={exportSheetData.headers.length}>No team members match that search.</td></tr>}
                  <tr className="total-row">{exportSheetData.totalsRow.map((value, column) => <td className={changedPreviewCells.has(`__total__:${column}`) ? 'core-payment-updated-cell' : ''} key={`total-${column}`}>{formatPreviewValue(value, column)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
          {error && <div className="attendance-message error">{error}</div>}
          {attendancePostResult && <details className="core-payment-post-result">
            <summary>POST payload and response</summary>
            <pre>{JSON.stringify(attendancePostResult, null, 2)}</pre>
          </details>}
          </section>
          </div>
        </div>}

      </div>
    </Modal>
    <Modal
      isOpen={Boolean(paymentHistoryCandidate)}
      onClose={() => setPaymentHistoryCandidate(null)}
      title={paymentHistoryCandidate ? `Saved payments · ${paymentHistoryCandidate.name}` : 'Saved payments'}
      maxWidth="1080px"
    >
      {paymentHistoryCandidate && (() => {
        const payments = existingPaymentsByCandidate.get(paymentHistoryCandidate.key) || []
        const positiveTotal = payments.reduce((sum, record) => {
          const amount = money(getRecordValue(record, ['amount', 'payment_amount']))
          return sum + Math.max(0, amount)
        }, 0)
        const deductionsTotal = payments.reduce((sum, record) => {
          const amount = money(getRecordValue(record, ['amount', 'payment_amount']))
          return sum + Math.max(0, -amount)
        }, 0)
        return <div className="core-payment-history-modal">
          <p className="core-payment-history-context">{selectedProjectTitle || 'Selected project'} · {fromDate} to {toDate}</p>
          {existingPaymentsLoading ? <div className="core-payment-empty" role="status">Loading saved payments...</div>
            : existingPaymentsError ? <div className="attendance-message error" role="alert">{existingPaymentsError}</div>
              : <>
                <div className="core-payment-history-summary">
                  <div><span>Saved earnings</span><strong>₹{positiveTotal.toFixed(2)}</strong></div>
                  <div><span>Deductions</span><strong>₹{deductionsTotal.toFixed(2)}</strong></div>
                  <div className="net"><span>Net saved</span><strong>₹{(positiveTotal - deductionsTotal).toFixed(2)}</strong></div>
                </div>
                {payments.length
                  ? <SavedPaymentsCalendar key={paymentHistoryCandidate.key} payments={payments} fromDate={fromDate} toDate={toDate} />
                  : <div className="core-payment-empty">No saved payment entries for this candidate in the selected period.</div>}
              </>}
        </div>
      })()}
    </Modal>
    <CandidateAttendanceCalendar isOpen={Boolean(attendanceCandidate)} candidate={attendanceCandidate} onClose={() => setAttendanceCandidate(null)} onAttendanceUpdated={refreshAttendance} />
    </>
  )
}

function SavedPaymentsCalendar({ payments, fromDate, toDate }) {
  const paymentDates = payments
    .map((record) => normalizeDate(getRecordValue(record, ['attendance_date', 'date'])))
    .filter(Boolean)
    .sort()
  const rangeStart = normalizeDate(fromDate) || paymentDates[0] || ''
  const rangeEnd = normalizeDate(toDate) || paymentDates[paymentDates.length - 1] || rangeStart
  const firstMonth = rangeStart.slice(0, 7)
  const lastMonth = rangeEnd.slice(0, 7)
  const [visibleMonth, setVisibleMonth] = useState(firstMonth)
  const paymentGroups = new Map()
  payments.forEach((record) => {
    const date = normalizeDate(getRecordValue(record, ['attendance_date', 'date']))
    if (!date) return
    if (!paymentGroups.has(date)) paymentGroups.set(date, [])
    paymentGroups.get(date).push(record)
  })
  const [year, month] = visibleMonth.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const leadingDays = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const changeMonth = (amount) => {
    const nextMonth = new Date(Date.UTC(year, month - 1 + amount, 1))
    setVisibleMonth(`${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <section className="core-payment-history-calendar" aria-label="Saved payments calendar">
      <header className="core-payment-history-calendar-header">
        <button type="button" className="core-payment-history-month-button" onClick={() => changeMonth(-1)} disabled={visibleMonth <= firstMonth} aria-label="Previous month" title="Previous month">
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <h3>{monthLabel}</h3>
        <button type="button" className="core-payment-history-month-button" onClick={() => changeMonth(1)} disabled={visibleMonth >= lastMonth} aria-label="Next month" title="Next month">
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </header>
      <div className="core-payment-history-weekdays" aria-hidden="true">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="core-payment-history-calendar-grid" style={{ '--calendar-week-count': cellCount / 7 }}>
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - leadingDays + 1
          if (day < 1 || day > daysInMonth) return <div className="core-payment-history-day is-empty" key={`empty-${index}`} />
          const date = `${visibleMonth}-${String(day).padStart(2, '0')}`
          const dayPayments = paymentGroups.get(date) || []
          const inRange = date >= rangeStart && date <= rangeEnd
          const dayTotal = dayPayments.reduce((sum, record) => sum + money(getRecordValue(record, ['amount', 'payment_amount'])), 0)
          return <div className={`core-payment-history-day${inRange ? ' in-range' : ' out-of-range'}${dayPayments.length ? ' has-payments' : ''}`} key={date}>
            <div className="core-payment-history-day-header">
              <span className="core-payment-history-day-number">{day}</span>
              {dayPayments.length > 0 && <strong className={dayTotal < 0 ? 'is-deduction' : ''}>₹{dayTotal.toFixed(2)}</strong>}
            </div>
            {dayPayments.map((record, recordIndex) => {
              const amount = money(getRecordValue(record, ['amount', 'payment_amount']))
              const type = getRecordValue(record, ['payment_type', 'paymentType', 'type'], 'Payment')
              const location = getRecordValue(record, ['location_name', 'locationName', 'location'])
              const note = getRecordValue(record, ['note', 'description'])
              return <div className={`core-payment-history-entry${amount < 0 ? ' is-deduction' : ''}`} key={`${type}-${recordIndex}`} title={[location, note].filter(Boolean).join(' · ') || undefined}>
                <span>{type}</span>
                <strong>₹{amount.toFixed(2)}</strong>
              </div>
            })}
          </div>
        })}
      </div>
    </section>
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
  const manualOvertimeHours = config.overtimeMode === 'manual' && hasPresentProjectAttendance(candidate, dates)
    ? Math.max(0, money(config.manualOvertimeHours?.[candidate.key]))
    : 0
  let workedDays = 0
  let baseAmount = 0
  const allowanceTotals = {}
  const overtimeHoursByDate = {}
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
    const overtimeRate = getConfiguredOvertimeRate(config, candidate.key, date)
    overtimeHoursByDate[date] = overtimeHours
    if (overtimeHours > 0) allowanceTotals.Overtime = (allowanceTotals.Overtime || 0) + overtimeHours * overtimeRate
  })
  if (manualOvertimeHours > 0) {
    const overtimeRate = getConfiguredOvertimeRate(config, candidate.key, dates[0])
    allowanceTotals.Overtime = (allowanceTotals.Overtime || 0) + manualOvertimeHours * overtimeRate
  }
  const totalOvertimeHours = config.overtimeMode === 'manual'
    ? manualOvertimeHours
    : Object.values(overtimeHoursByDate).reduce((sum, hours) => sum + hours, 0)
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
    overtimeHours: totalOvertimeHours,
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

function getEffectiveOvertimeRate(rules, candidateKey, date, fallback) {
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

function getConfiguredOvertimeRate(config, candidateKey, date) {
  if (config.overtimeMode === 'manual') return Math.max(0, money(config.overtimeHourlyRate))
  return getEffectiveOvertimeRate(config.overtimeRateRules || [], candidateKey, date, 0)
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