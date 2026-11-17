import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faUpload, faCheck, faFileExcel, faTimes, faMinus, faWindowMaximize, faWindowMinimize } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { Card, PageHeader, Modal } from '../../components/ui'
import { coreRecruiterAPI, recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { useAuth } from '../../context/AuthContext'
import './Payments.css'
import './PaymentsNew.css'

const PAYMENT_CATEGORIES = ['Expenses', 'Attendance']
const PAYMENT_SHEET_PAGE_SIZE = 10
const PAYMENT_STATUSES = [
  { label: 'Pending', value: 'ready_for_payment' },
  { label: 'Paid', value: 'paid' },
  { label: 'Rejected', value: 'rejected' },
]

const PAYMENT_UPLOAD_HEADERS = [
  'DATE',
  'Name of Contact',
  'Payout Link Amount',
  'Contact Phone Number',
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

const WINDOWS_1252_SPECIAL_CHARACTERS = {
  '\u20ac': 0x80,
  '\u201a': 0x82,
  '\u0192': 0x83,
  '\u201e': 0x84,
  '\u2026': 0x85,
  '\u2020': 0x86,
  '\u2021': 0x87,
  '\u02c6': 0x88,
  '\u2030': 0x89,
  '\u0160': 0x8a,
  '\u2039': 0x8b,
  '\u0152': 0x8c,
  '\u017d': 0x8e,
  '\u2018': 0x91,
  '\u2019': 0x92,
  '\u201c': 0x93,
  '\u2022': 0x95,
  '\u2013': 0x96,
  '\u2014': 0x97,
  '\u02dc': 0x98,
  '\u2122': 0x99,
  '\u0161': 0x9a,
  '\u203a': 0x9b,
  '\u0153': 0x9c,
  '\u017e': 0x9e,
  '\u0178': 0x9f,
}

const encodeWindows1252 = (value) => {
  const bytes = []
  let replacedCharacters = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    const byte = codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)
      ? codePoint
      : WINDOWS_1252_SPECIAL_CHARACTERS[character]
    if (byte === undefined) {
      bytes.push(0x3f)
      replacedCharacters += 1
    } else {
      bytes.push(byte)
    }
  }
  return { bytes: new Uint8Array(bytes), replacedCharacters }
}

const downloadLegacyCsv = (workbook, filename) => {
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ',' })
  const { bytes, replacedCharacters } = encodeWindows1252(csv)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/csv;charset=windows-1252' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return replacedCharacters
}

const getPaymentSheetRecords = (payload) => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['payment_sheets', 'paymentSheets', 'sheets', 'items', 'records', 'results']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  return payload.data && payload.data !== payload ? getPaymentSheetRecords(payload.data) : []
}

const getExpenseId = (expense) => expense?.expense_id || expense?.expenseId || expense?.id || expense?._id
const getPaymentSheetId = (record) => record?.id || record?.payment_sheet_id || record?.paymentSheetId
const getAttendanceSheetSelectionKey = (record) => getPaymentSheetId(record)
const getSheetReferenceId = (record) => [
  record?.reference_id,
  record?.referenceId,
  record?.referenceID,
  record?.ref_id,
  record?.sheet?.reference_id,
  record?.data?.reference_id,
].find((value) => value !== undefined && value !== null && value !== '')
const getDetailedPaymentSheetRecord = (response) => {
  const body = response?.data ?? {}
  const payload = body?.data ?? body
  return payload?.sheet || payload?.payment_sheet_record || payload?.paymentSheetRecord || payload
}
const getSheetSelectionKey = (record) => [
  getSheetReferenceId(record),
  record?.id,
  record?.payment_sheet_id,
  record?.paymentSheetId,
].find((value) => value !== undefined && value !== null && value !== '')

const getRecordExpenses = (record) => {
  const expenses = record?.source_expenses || record?.sourceExpenses || record?.expenses || record?.expense_records || record?.expenseRecords
  if (Array.isArray(expenses)) return expenses
  const expenseIds = record?.expense_ids || record?.expenseIds
  if (Array.isArray(expenseIds)) return expenseIds.map((id) => typeof id === 'object' ? id : { expense_id: id })
  const sheetRows = record?.payment_sheet || record?.paymentSheet || record?.rows
  if (Array.isArray(sheetRows)) {
    const expensesFromSheet = sheetRows.filter((row) => getExpenseId(row))
    if (expensesFromSheet.length) return expensesFromSheet
  }
  return getExpenseId(record) ? [record] : []
}

const getSheetRows = (record) => {
  const rows = record?.payment_sheet || record?.paymentSheet || record?.sheet || record?.rows || record?.data
  if (Array.isArray(rows)) return rows
  if (typeof rows === 'string') {
    try {
      const parsed = JSON.parse(rows)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return getRecordExpenses(record)
}

const getAttendancePaymentSheetRows = (record) => {
  let rows = record?.payment_sheet ?? record?.paymentSheet ?? record?.sheet_data ?? record?.sheetData ?? record?.rows ?? record?.data
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows) } catch { return [] }
  }
  if (Array.isArray(rows)) return rows
  return Array.isArray(rows?.rows) ? rows.rows : []
}

const getAttendancePaymentRowReferenceId = (row, rowIndex, rows) => {
  const referenceFields = [
    'reference_id', 'referenceId', 'referenceID', 'ref_id', 'tagged_reference_id',
    'Reference ID(optional)', 'Reference ID', 'Tagged Reference ID',
  ]
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    return String(getSheetRecordValue(row, referenceFields) || '').trim()
  }
  if (!Array.isArray(row)) return ''

  const referenceHeaders = new Set(referenceFields.map(normalizeSheetField))
  const headerIndex = rows.findIndex((candidate) => Array.isArray(candidate)
    && candidate.some((value) => referenceHeaders.has(normalizeSheetField(value))))
  if (headerIndex < 0 || rowIndex <= headerIndex) return ''
  const referenceIndex = rows[headerIndex].findIndex((value) => referenceHeaders.has(normalizeSheetField(value)))
  return referenceIndex < 0 ? '' : String(row[referenceIndex] ?? '').trim()
}

const mergeAttendancePaymentCandidates = (candidates) => {
  const mergedCandidates = new Map()
  candidates.forEach((candidate) => {
    const candidateId = candidate?.candidate_id || candidate?.candidateId || candidate?.registration_id || candidate?.registrationId || candidate?.user_id || candidate?.id
    const candidateKey = [candidateId || candidate?.candidate_name || candidate?.name || candidate?.mobile, candidate?.project_id || candidate?.projectId].join(':')
    if (!candidateKey || candidateKey === ':') return

    if (!mergedCandidates.has(candidateKey)) {
      mergedCandidates.set(candidateKey, { ...candidate, locations: [], attendance: [], overtime: [], deductions: [] })
    }
    const mergedCandidate = mergedCandidates.get(candidateKey)
    mergedCandidate.locations = [...new Map([
      ...(mergedCandidate.locations || []),
      ...(candidate.locations || []),
    ].map((location) => [JSON.stringify(location), location])).values()]
    mergedCandidate.overtime = [...new Map([
      ...(mergedCandidate.overtime || []),
      ...(candidate.overtime || []),
    ].map((item) => [JSON.stringify(item), item])).values()]
    mergedCandidate.deductions = [...new Map([
      ...(mergedCandidate.deductions || []),
      ...(candidate.deductions || []),
    ].map((item) => [JSON.stringify(item), item])).values()]
    mergedCandidate.overall_outstanding_deduction = Math.max(
      Number(mergedCandidate.overall_outstanding_deduction) || 0,
      Number(candidate.overall_outstanding_deduction) || 0,
    )

    const attendanceByKey = new Map((mergedCandidate.attendance || []).map((item) => [[
      item?.attendance_id || item?.attendanceId || '',
      item?.attendance_date || item?.date || '',
      item?.project_id || item?.projectId || '',
      item?.location_id || item?.locationId || '',
    ].join('|'), item]))
    ;(candidate.attendance || []).forEach((item) => {
      const attendanceKey = [
        item?.attendance_id || item?.attendanceId || '',
        item?.attendance_date || item?.date || '',
        item?.project_id || item?.projectId || '',
        item?.location_id || item?.locationId || '',
      ].join('|')
      const existing = attendanceByKey.get(attendanceKey)
      if (!existing) {
        attendanceByKey.set(attendanceKey, { ...item, payments: [...(item.payments || [])] })
      } else {
        existing.payments = [...new Map([
          ...(existing.payments || []),
          ...(item.payments || []),
        ].map((payment) => [JSON.stringify(payment), payment])).values()]
      }
    })
    mergedCandidate.attendance = [...attendanceByKey.values()]
  })
  return [...mergedCandidates.values()]
}

const getPaymentSheetExpenseIds = (record) => {
  const parseExpenseList = (value) => {
    if (Array.isArray(value)) return value.flatMap(parseExpenseList)
    if (value && typeof value === 'object') return [value]
    if (value === undefined || value === null || value === '') return []
    if (typeof value !== 'string') return [value]
    const trimmedValue = value.trim()
    if (!trimmedValue) return []
    try {
      const parsed = JSON.parse(trimmedValue)
      return parsed === trimmedValue ? [trimmedValue] : parseExpenseList(parsed)
    } catch {
      return trimmedValue.split(',').map((id) => id.trim()).filter(Boolean)
    }
  }
  const records = [
    record,
    record?.data,
    record?.sheet,
    record?.payment_sheet_record,
    record?.paymentSheetRecord,
  ].filter((item) => item && typeof item === 'object')
  const expenseIds = [
    ...records.flatMap((item) => [
      ...parseExpenseList(item.expense_ids ?? item.expenseIds),
      ...parseExpenseList(item.expense_id ?? item.expenseId),
    ]),
  ]
  const expenses = [
    ...records.flatMap((item) => [
      ...parseExpenseList(item.source_expenses ?? item.sourceExpenses ?? item.expenses ?? item.expense_records ?? item.expenseRecords),
      ...parseExpenseList(item.payment_sheet ?? item.paymentSheet ?? item.sheet_data ?? item.sheetData ?? item.rows),
    ]),
  ]

  return [...new Set([...expenseIds, ...expenses]
    .map((expense) => typeof expense === 'object' && expense !== null ? getExpenseId(expense) : expense)
    .filter((id) => id !== undefined && id !== null && id !== '')
    .map(String))]
}

const getReferenceExpenseIds = (value) => {
  const reference = String(value ?? '').trim()
  const listMatch = reference.match(/\[([^\]]*)\]\s*$/)
  if (!listMatch) return getPaymentSheetExpenseIds({ expense_ids: value })
  return [...new Set(listMatch[1].split(',').map((id) => id.trim()).filter(Boolean))]
}

const resolveReferenceExpenseIds = (value, sourceExpenses) => [...new Set(getReferenceExpenseIds(value).map((referenceId) => {
  const sourceExpense = sourceExpenses.find((expense) => (
    [expense?.expense_id, expense?.expenseId, expense?.id, expense?._id]
      .some((id) => id !== undefined && id !== null && String(id) === referenceId)
  ))
  const expenseId = sourceExpense?.expense_id ?? sourceExpense?.expenseId
  return expenseId === undefined || expenseId === null || expenseId === '' ? null : String(expenseId)
}).filter(Boolean))]

const normalizeSheetField = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const getSheetRecordValue = (record, fields) => {
  const values = Object.fromEntries(Object.entries(record || {}).map(([key, value]) => [normalizeSheetField(key), value]))
  for (const field of fields) {
    const value = values[normalizeSheetField(field)]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

const getSheetRowObjects = (record) => {
  const rows = getSheetRows(record)
  if (!rows.some(Array.isArray)) return rows.filter((row) => row && typeof row === 'object')
  const headerIndex = rows.findIndex((row) => Array.isArray(row) && row.some((value) => /name|candidate|registration|mobile|amount|project|reference/i.test(String(value))))
  if (headerIndex < 0) return []
  const headers = rows[headerIndex]
  return rows.slice(headerIndex + 1).filter(Array.isArray).map((row) => Object.fromEntries(
    headers.map((header, index) => [String(header || `Column ${index + 1}`), row[index]])
  ))
}

const getSheetRecipientKey = (person) => {
  const value = getSheetRecordValue(person, ['registration_id', 'registrationId', 'candidate_id', 'candidateId', 'user_id', 'userId', 'mobile_number', 'mobile', 'phone', 'email', 'email_id', 'name', 'candidate_name', 'candidateName', 'full_name', 'fullName'])
  if (!value) return ''
  const field = ['registration_id', 'registrationId', 'candidate_id', 'candidateId', 'user_id', 'userId'].some((key) => getSheetRecordValue(person, [key]))
    ? 'id'
    : ['mobile_number', 'mobile', 'phone'].some((key) => getSheetRecordValue(person, [key]))
      ? 'mobile'
      : ['email', 'email_id'].some((key) => getSheetRecordValue(person, [key]))
        ? 'email'
        : 'name'
  return `${field}:${String(value).trim().toLowerCase()}`
}

const getPaymentSheetRowExpenseIds = (row, rowIndex, sourceExpenses) => getPaymentCheckSourceExpenseIds(row, sourceExpenses)

const getPaymentCheckSourceExpenseIds = (row, sourceExpenses) => {
  const referenceId = getSheetRecordValue(row, [
    'reference_id', 'referenceId', 'Reference ID(optional)', 'ref_id',
  ])
  const referenceExpenseIds = getReferenceExpenseIds(referenceId)
  if (referenceExpenseIds.length) return resolveReferenceExpenseIds(referenceId, sourceExpenses)

  const explicitIds = getPaymentSheetExpenseIds(row && typeof row === 'object' ? row : {})
  if (explicitIds.length) return [...new Set(explicitIds.map(String))]

  const rowId = getExpenseId(row)
  if (rowId !== undefined && rowId !== null && rowId !== '') return [String(rowId)]

  const recipientKey = getSheetRecipientKey(row)
  const candidateExpenses = recipientKey
    ? sourceExpenses.filter((expense) => getSheetRecipientKey(expense) === recipientKey)
    : sourceExpenses
  const rowText = Object.values(row || {}).map((value) => (
    value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  )).join(' ')
  const rowProject = normalizeSheetField(getSheetRecordValue(row, [
    'merged_project_name', 'project_name', 'project',
  ]))
  const projectExpenses = rowProject
    ? candidateExpenses.filter((expense) => normalizeSheetField(getSheetRecordValue(expense, [
      'merged_project_name', 'project_name', 'project',
    ])) === rowProject)
    : candidateExpenses
  const rowLocation = normalizeSheetField(getSheetRecordValue(row, [
    'merged_location_name', 'mergedLocationName', 'location_name', 'locationName', 'location', 'district_name', 'district', 'venue',
  ]))
  const matchingByLocation = projectExpenses.filter((expense) => {
    const location = normalizeSheetField(getSheetRecordValue(expense, [
      'merged_location_name', 'mergedLocationName', 'location_name', 'locationName', 'location', 'district_name', 'district', 'venue',
    ]))
    return location && (rowLocation ? location === rowLocation : normalizeSheetField(rowText).includes(location))
  })
  const matchingProjects = new Set(matchingByLocation.map((expense) => normalizeSheetField(getSheetRecordValue(expense, [
    'merged_project_name', 'project_name', 'project',
  ]))).filter(Boolean))
  const candidateLocations = new Set(projectExpenses.map((expense) => normalizeSheetField(getSheetRecordValue(expense, [
    'merged_location_name', 'mergedLocationName', 'location_name', 'locationName', 'location', 'district_name', 'district', 'venue',
  ]))).filter(Boolean))
  const candidateProjects = new Set(projectExpenses.map((expense) => normalizeSheetField(getSheetRecordValue(expense, [
    'merged_project_name', 'project_name', 'project',
  ]))).filter(Boolean))
  const matchingExpenses = matchingByLocation.length && matchingProjects.size <= 1
    ? matchingByLocation
    : candidateLocations.size === 1 && candidateProjects.size <= 1
      ? projectExpenses
      : []

  return [...new Set(matchingExpenses
    .map(getExpenseId)
    .filter((id) => id !== undefined && id !== null && id !== '')
    .map(String))]
}

const getPaymentSheetRowAmount = (row) => {
  const value = getSheetRecordValue(row, ['payout_link_amount', 'payout_amount', 'amount', 'total_amount', 'total_payout'])
  const amount = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

const parsePaymentAmount = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const amount = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(amount) ? amount : null
}

const getSheetRecipientCount = (record) => {
  const people = [...getRecordExpenses(record), ...getSheetRowObjects(record)]
  const recipientKeys = new Set(people.map(getSheetRecipientKey).filter(Boolean))
  if (recipientKeys.size) return { keys: [...recipientKeys], fallbackCount: 0, unavailable: false }
  const count = Number(getSheetRecordValue(record, ['people_count', 'peopleCount', 'candidate_count', 'candidateCount', 'recipient_count', 'recipientCount']))
  return Number.isFinite(count)
    ? { keys: [], fallbackCount: count, unavailable: false }
    : { keys: [], fallbackCount: 0, unavailable: true }
}

const getSheetAmount = (record) => {
  const amountValue = getSheetRecordValue(record, ['total_amount', 'totalAmount', 'total_payout', 'totalPayout', 'amount'])
  if (amountValue !== '') {
    const amount = Number(amountValue)
    if (Number.isFinite(amount)) return amount
  }
  const expenses = getRecordExpenses(record).filter((expense) => expense && typeof expense === 'object' && expense.amount !== undefined)
  if (expenses.length) return expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  const amounts = getSheetRowObjects(record).map((row) => Number(getSheetRecordValue(row, ['amount', 'total_amount', 'payout_link_amount', 'payout_amount']))).filter(Number.isFinite)
  return amounts.length ? amounts.reduce((sum, amount) => sum + amount, 0) : null
}

const getSheetProjectLocationGroups = (record) => {
  const locationsByProject = new Map()
  const items = [...getRecordExpenses(record), ...getSheetRowObjects(record), record]
  items.forEach((item) => {
    const project = String(getSheetRecordValue(item, ['merged_project_name', 'mergedProjectName', 'project_name', 'projectName', 'project']) || '').trim()
    const location = String(getSheetRecordValue(item, ['merged_location_name', 'mergedLocationName', 'location_name', 'locationName', 'location', 'venue']) || '').trim()
    if (!project && !location) return

    const projectName = project || 'Project unavailable'
    const locationName = location || 'Location unavailable'
    if (!locationsByProject.has(projectName)) locationsByProject.set(projectName, new Set())
    locationsByProject.get(projectName).add(locationName)
  })

  return locationsByProject
}

const getSheetColumns = (rows) => {
  if (rows.some(Array.isArray)) {
    const columnCount = Math.max(...rows.map((row) => Array.isArray(row) ? row.length : 0))
    return Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`)
  }
  return [...new Set(rows.flatMap((row) => (
    row && typeof row === 'object' ? Object.keys(row) : []
  )))]
}

const getSheetLabel = (record, index) => record?.sheet_name || record?.sheetName || record?.name || record?.project_name || record?.projectName
  || record?.created_at || record?.createdAt || record?.id || `Payment sheet ${index + 1}`

const isPaymentSheetDownloaded = (record) => Boolean(
  record?.downloaded_at || record?.downloadedAt || record?.is_downloaded || record?.isDownloaded
  || record?.downloaded === true || record?.downloaded === 1 || record?.downloaded === 'true'
)

const getPaymentPayloadValue = (expense, fields) => {
  const sources = [expense, expense?.candidate, expense?.user, expense?.candidate_information, expense?.candidateInformation, expense?.profile]
  for (const source of sources) {
    const value = fields.map((field) => source?.[field]).find((item) => item !== undefined && item !== null && item !== '')
    if (value !== undefined) return value
  }
  return ''
}

const PAYMENT_MOBILE_FIELDS = ['mobile_number', 'mobile', 'mobile_no', 'phone', 'phone_number', 'whatsapp', 'contact']
const PAYMENT_NAME_FIELDS = ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName', 'contact_name', 'name_of_contact']
const PAYMENT_EMAIL_FIELDS = ['email', 'email_id', 'contact_email', 'contact_email_id', 'mail', 'contact_mail']
const PAYMENT_TEMP_ID_FIELDS = ['internal_notes_title', 'internal_notes_optional_title', 'title']
const PAYMENT_CHECK_ITEMS = [
  { key: 'nameMatch', label: 'Mobile + name' },
  { key: 'emailMatch', label: 'Email' },
  { key: 'amountCheck', label: 'Amount' },
  { key: 'expenseIdCheck', label: 'Expense IDs' },
  { key: 'registration', label: 'Registration' },
  { key: 'tempId', label: 'Temp ID' },
]

const normalizePaymentCheckValue = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const normalizePaymentCheckMobile = (value) => String(value ?? '').replace(/\D/g, '').slice(-10)
const normalizePaymentCheckEmail = (value) => String(value ?? '').trim().toLowerCase()
const getPaymentCheckRows = (rows, expenses) => {
  if (!rows.some(Array.isArray)) return rows.map((row, index) => ({ row: row || {}, expense: expenses[index] || {} }))

  const headerIndex = rows.findIndex((row) => Array.isArray(row) && row.some((value) => /name|candidate|mobile|phone|internal notes/i.test(String(value))))
  if (headerIndex < 0) return rows.map((row, index) => ({ row: {}, expense: expenses[index] || {} }))
  const headers = rows[headerIndex]
  return rows.slice(headerIndex + 1).filter(Array.isArray).map((values, index) => ({
    row: Object.fromEntries(headers.map((header, columnIndex) => [String(header || `Column ${columnIndex + 1}`), values[columnIndex]])),
    expense: expenses[index] || {},
  }))
}

const getPaymentCheckValue = (row, expense, fields) => (
  getSheetRecordValue(row, fields) || getPaymentPayloadValue(expense, fields)
)

const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
const getRegistrationResult = (record) => {
  const value = record?.is_registered ?? record?.registered
  if (value === true || value === 1 || ['true', '1', 'yes', 'registered'].includes(String(value).toLowerCase())) return 'Registered'
  if (value === false || value === 0 || ['false', '0', 'no', 'not registered'].includes(String(value).toLowerCase())) return 'Not registered'
  return 'Unavailable'
}

const getPaymentCheckStatusTone = (value) => {
  if (['Match', 'Registered', 'Valid', 'Email found', 'IDs matched', 'Amount matched'].includes(value)) return 'success'
  if (['Name mismatch', 'Not found', 'Not registered', 'Invalid', 'Email mismatch', 'ID mismatch', 'Amount mismatch'].includes(value)) return 'danger'
  return 'warning'
}

const getPaymentCheckStatusIcon = (value) => {
  const tone = getPaymentCheckStatusTone(value)
  return tone === 'success' ? faCheck : tone === 'danger' ? faTimes : faMinus
}

const getCandidateRecords = (response) => {
  const payload = response?.data?.data ?? response?.data ?? response
  if (Array.isArray(payload)) return payload
  return payload?.items || payload?.candidates || payload?.results || payload?.records || []
}

const updatePaymentSheetStatusForExpenses = (expenseIds, status, userId) => {
  const uniqueExpenseIds = [...new Set(expenseIds
    .filter((expenseId) => expenseId !== undefined && expenseId !== null && String(expenseId).trim() !== '')
    .map(String))]
  if (!uniqueExpenseIds.length) return Promise.resolve()

  return recruiterAPI.updateGlobalPaymentSheetStatus({
    expense_ids: uniqueExpenseIds,
    status,
    type: 'expenses',
    user_id: userId,
  })
}

const getPaymentPayload = (expense) => ({
  expense_id: getExpenseId(expense),
  registration_id: expense.registration_id || expense.registrationId || expense.candidate_id || expense.candidateId || '',
  name: expense.name || expense.candidate_name || expense.candidateName || '',
  mobile_number: getPaymentPayloadValue(expense, PAYMENT_MOBILE_FIELDS),
  amount: Number(expense.approved_amount ?? expense.amount ?? 0),
  merged_project_id: expense.merged_project_id || expense.mergedProjectId || '',
  merged_project_name: expense.merged_project_name || expense.mergedProjectName || '',
  merged_location_id: getPaymentPayloadValue(expense, ['merged_location_id', 'mergedLocationId']),
  merged_location_name: getPaymentPayloadValue(expense, ['merged_location_name', 'mergedLocationName']),
})

const downloadPaymentSheet = (rows, record, index) => {
  if (!rows.length) return null

  const columns = getSheetColumns(rows)
  const data = Array.isArray(rows[0])
    ? rows
    : [columns, ...rows.map((row) => columns.map((column) => row?.[column] ?? ''))]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), 'Payment Sheet')
  const filename = String(getSheetLabel(record, index)).replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)
  return downloadLegacyCsv(workbook, `${filename || `expenses-payment-sheet-${index + 1}`}.csv`)
}

export default function RecruiterPaymentsNew() {
  const { user } = useAuth()
  const { alert, confirm } = useAlert()
  const userId = user?.userId || 1
  const [isUploadPaymentsOpen, setIsUploadPaymentsOpen] = useState(false)
  const [globalUploadFile, setGlobalUploadFile] = useState(null)
  const [globalUploadLoading, setGlobalUploadLoading] = useState(false)
  const [globalUploadError, setGlobalUploadError] = useState('')
  const [globalUploadSuccess, setGlobalUploadSuccess] = useState('')
  const [activeCategory, setActiveCategory] = useState('Expenses')
    const [attendanceSource, setAttendanceSource] = useState('core')
  const [activeStatus, setActiveStatus] = useState('ready_for_payment')
  const [sheetSearch, setSheetSearch] = useState('')
  const [sheetFromDate, setSheetFromDate] = useState('')
  const [sheetToDate, setSheetToDate] = useState('')
  const [appliedSheetFilters, setAppliedSheetFilters] = useState({ search: '', from_date: '', to_date: '' })
  const [sheetOffset, setSheetOffset] = useState(0)
  const [sheetHasMore, setSheetHasMore] = useState(false)
  const [paymentSheets, setPaymentSheets] = useState([])
  const [paymentSheetsLoading, setPaymentSheetsLoading] = useState(false)
  const [loadingMoreSheets, setLoadingMoreSheets] = useState(false)
  const [paymentSheetsError, setPaymentSheetsError] = useState('')
  const [selectedSheetReferenceIds, setSelectedSheetReferenceIds] = useState(new Set())
  const [selectedSheetDetails, setSelectedSheetDetails] = useState({})
  const [loadingSheetDetails, setLoadingSheetDetails] = useState(new Set())
  const requestedSheetDetails = useRef(new Set())
  const [selectionSummaryMinimized, setSelectionSummaryMinimized] = useState(false)
  const [updatingSheetStatus, setUpdatingSheetStatus] = useState(false)
  const [consolidatingSheets, setConsolidatingSheets] = useState(false)
  const [previewSheet, setPreviewSheet] = useState(null)
  const [previewExpenses, setPreviewExpenses] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [previewTab, setPreviewTab] = useState('generated')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [selectedPreviewExpenseIds, setSelectedPreviewExpenseIds] = useState(new Set())
  const [paymentChecksLoading, setPaymentChecksLoading] = useState(false)
  const [paymentCheckResults, setPaymentCheckResults] = useState([])
  const [paymentCheckError, setPaymentCheckError] = useState('')
  const [paymentCheckPanelOpen, setPaymentCheckPanelOpen] = useState(false)
  const [expandedPaymentCheckRows, setExpandedPaymentCheckRows] = useState(new Set())
  const selectAllSheetsRef = useRef(null)
  const selectAllPreviewRef = useRef(null)
  const paymentSheetsEndRef = useRef(null)
  const loadingMoreSheetsRef = useRef(false)
  const paymentSheetsRequestRef = useRef(0)
  const [attendancePaymentSheets, setAttendancePaymentSheets] = useState([])
  const [attendanceSheetsLoading, setAttendanceSheetsLoading] = useState(false)
  const [attendanceLoadingMore, setAttendanceLoadingMore] = useState(false)
  const [attendanceSheetsError, setAttendanceSheetsError] = useState('')
  const [attendanceOffset, setAttendanceOffset] = useState(0)
  const [attendanceHasMore, setAttendanceHasMore] = useState(false)
  const [attendancePreviewSheet, setAttendancePreviewSheet] = useState(null)
  const [attendancePreviewRows, setAttendancePreviewRows] = useState([])
  const [selectedAttendancePreviewReferenceIds, setSelectedAttendancePreviewReferenceIds] = useState(new Set())
  const [attendancePreviewLoading, setAttendancePreviewLoading] = useState(false)
  const [attendancePreviewError, setAttendancePreviewError] = useState('')
  const [selectedAttendanceSheetIds, setSelectedAttendanceSheetIds] = useState(new Set())
  const [updatingAttendanceSheetStatus, setUpdatingAttendanceSheetStatus] = useState(false)
  const [consolidatingAttendanceSheets, setConsolidatingAttendanceSheets] = useState(false)
  const attendanceSheetsRequestRef = useRef(0)
  const attendancePreviewRequestRef = useRef(0)
  const selectAllAttendanceSheetsRef = useRef(null)
  const selectAllAttendancePreviewRef = useRef(null)

  const selectedPaymentSheets = useMemo(() => paymentSheets.filter((record) => {
    const selectionKey = getSheetSelectionKey(record)
    return selectionKey !== undefined && selectionKey !== null && selectedSheetReferenceIds.has(String(selectionKey))
  }), [paymentSheets, selectedSheetReferenceIds])
  const selectableSheetKeys = paymentSheets
    .map(getSheetSelectionKey)
    .filter((key) => key !== undefined && key !== null && key !== '')
    .map(String)
  const allPaymentSheetsSelected = selectableSheetKeys.length > 0
    && selectableSheetKeys.every((key) => selectedSheetReferenceIds.has(key))
  const somePaymentSheetsSelected = selectableSheetKeys.some((key) => selectedSheetReferenceIds.has(key))
  const selectableAttendanceSheetKeys = attendancePaymentSheets
    .map(getAttendanceSheetSelectionKey)
    .filter((key) => key !== undefined && key !== null && key !== '')
    .map(String)
  const selectedAttendancePaymentSheets = attendancePaymentSheets.filter((record) => (
    selectedAttendanceSheetIds.has(String(getAttendanceSheetSelectionKey(record)))
  ))
  const allAttendanceSheetsSelected = selectableAttendanceSheetKeys.length > 0
    && selectableAttendanceSheetKeys.every((key) => selectedAttendanceSheetIds.has(key))
  const someAttendanceSheetsSelected = selectableAttendanceSheetKeys.some((key) => selectedAttendanceSheetIds.has(key))
  const selectableAttendancePreviewIds = [...new Set(attendancePreviewRows
    .map((row, index) => getAttendancePaymentRowReferenceId(row, index, attendancePreviewRows))
    .filter((id) => id !== undefined && id !== null && id !== '')
    .map(String))]
  const allAttendancePreviewRowsSelected = selectableAttendancePreviewIds.length > 0
    && selectableAttendancePreviewIds.every((id) => selectedAttendancePreviewReferenceIds.has(id))
  const someAttendancePreviewRowsSelected = selectableAttendancePreviewIds.some((id) => selectedAttendancePreviewReferenceIds.has(id))

  useEffect(() => {
    if (selectAllAttendancePreviewRef.current) {
      selectAllAttendancePreviewRef.current.indeterminate = someAttendancePreviewRowsSelected && !allAttendancePreviewRowsSelected
    }
  }, [someAttendancePreviewRowsSelected, allAttendancePreviewRowsSelected])

  useEffect(() => {
    if (selectAllAttendanceSheetsRef.current) {
      selectAllAttendanceSheetsRef.current.indeterminate = someAttendanceSheetsSelected && !allAttendanceSheetsSelected
    }
  }, [someAttendanceSheetsSelected, allAttendanceSheetsSelected])

  useEffect(() => {
    if (selectAllSheetsRef.current) {
      selectAllSheetsRef.current.indeterminate = somePaymentSheetsSelected && !allPaymentSheetsSelected
    }
  }, [somePaymentSheetsSelected, allPaymentSheetsSelected])

  useEffect(() => {
    if (activeCategory !== 'Expenses') return
    selectedPaymentSheets.forEach((record) => {
      const selectionKey = String(getSheetSelectionKey(record))
      const requestKey = `${activeStatus}:${selectionKey}`
      if (requestedSheetDetails.current.has(requestKey)) return
      requestedSheetDetails.current.add(requestKey)
      const sheetId = getPaymentSheetId(record)

      if (!sheetId) {
        setSelectedSheetDetails((current) => ({ ...current, [selectionKey]: { ...record } }))
        return
      }

      setLoadingSheetDetails((current) => new Set(current).add(selectionKey))
      recruiterAPI.getglobalfinalpaymentsheetdetails(sheetId, {
        type: 'expenses',
        status: activeStatus,
        user_id: userId,
      })
        .then((response) => {
          const detail = getDetailedPaymentSheetRecord(response)
          setSelectedSheetDetails((current) => ({
            ...current,
            [selectionKey]: { ...record, ...(detail && typeof detail === 'object' ? detail : {}) },
          }))
        })
        .catch((error) => {
          console.error('Failed to load selected payment sheet details:', error)
          setSelectedSheetDetails((current) => ({ ...current, [selectionKey]: { ...record } }))
        })
        .finally(() => {
          setLoadingSheetDetails((current) => {
            const next = new Set(current)
            next.delete(selectionKey)
            return next
          })
        })
    })
  }, [activeCategory, activeStatus, selectedPaymentSheets, userId])

  const selectedSheetSummary = useMemo(() => {
    const recipientKeys = new Set()
    const projectLocations = new Map()
    let fallbackPeopleCount = 0
    let peopleUnavailable = false
    let totalAmount = 0
    let amountUnavailable = false

    selectedPaymentSheets.forEach((listRecord) => {
      const selectionKey = String(getSheetSelectionKey(listRecord))
      const record = selectedSheetDetails[selectionKey] || listRecord
      const recipients = getSheetRecipientCount(record)
      recipients.keys.forEach((key) => recipientKeys.add(key))
      fallbackPeopleCount += recipients.fallbackCount
      peopleUnavailable ||= recipients.unavailable

      const amount = getSheetAmount(record)
      if (amount === null) amountUnavailable = true
      else totalAmount += amount

      getSheetProjectLocationGroups(record).forEach((locations, project) => {
        if (!projectLocations.has(project)) projectLocations.set(project, new Set())
        locations.forEach((location) => projectLocations.get(project).add(location))
      })
    })

    return {
      peopleCount: recipientKeys.size + fallbackPeopleCount,
      peopleUnavailable,
      totalAmount,
      amountUnavailable,
      projectLocations: [...projectLocations].map(([project, locations]) => ({ project, locations: [...locations] })),
    }
  }, [selectedPaymentSheets, selectedSheetDetails])
  const selectedAttendanceSheetSummary = useMemo(() => {
    const recipientKeys = new Set()
    const projectLocations = new Map()
    let fallbackPeopleCount = 0
    let peopleUnavailable = false
    let totalAmount = 0
    let amountUnavailable = false

    selectedAttendancePaymentSheets.forEach((record) => {
      const recipients = getSheetRecipientCount(record)
      recipients.keys.forEach((key) => recipientKeys.add(key))
      fallbackPeopleCount += recipients.fallbackCount
      peopleUnavailable ||= recipients.unavailable

      const amount = getSheetAmount(record)
      if (amount === null) amountUnavailable = true
      else totalAmount += amount

      getSheetProjectLocationGroups(record).forEach((locations, project) => {
        if (!projectLocations.has(project)) projectLocations.set(project, new Set())
        locations.forEach((location) => projectLocations.get(project).add(location))
      })
    })

    return {
      peopleCount: recipientKeys.size + fallbackPeopleCount,
      peopleUnavailable,
      totalAmount,
      amountUnavailable,
      projectLocations: [...projectLocations].map(([project, locations]) => ({ project, locations: [...locations] })),
    }
  }, [selectedAttendancePaymentSheets])
  const loadingSelectedSheetDetails = selectedPaymentSheets.filter((record) => (
    loadingSheetDetails.has(String(getSheetSelectionKey(record)))
  )).length

  const fetchPaymentSheets = useCallback(async (offset = 0, append = false) => {
    if (append && loadingMoreSheetsRef.current) return
    const requestId = paymentSheetsRequestRef.current + 1
    paymentSheetsRequestRef.current = requestId
    if (append) {
      loadingMoreSheetsRef.current = true
      setLoadingMoreSheets(true)
    } else {
      loadingMoreSheetsRef.current = false
      setLoadingMoreSheets(false)
      setPaymentSheetsLoading(true)
    }
    setPaymentSheetsError('')
    try {
      const response = await recruiterAPI.getglobalfinalpaymentsheet({
        type: 'expenses',
        status: activeStatus,
        user_id: userId,
        ...(appliedSheetFilters.search ? { search: appliedSheetFilters.search } : {}),
        ...(appliedSheetFilters.from_date ? { from_date: appliedSheetFilters.from_date } : {}),
        ...(appliedSheetFilters.to_date ? { to_date: appliedSheetFilters.to_date } : {}),
        offset,
        limit: PAYMENT_SHEET_PAGE_SIZE,
      })
      if (requestId !== paymentSheetsRequestRef.current) return
      const body = response?.data ?? {}
      const payload = body?.data ?? body
      const records = getPaymentSheetRecords(payload)
      const pagination = body?.pagination || payload?.pagination || {}
      const totalValue = pagination.total ?? pagination.total_records ?? pagination.total_count ?? payload?.total ?? body?.total
      const parsedTotal = Number(totalValue)
      const responseOffset = Number(pagination.offset ?? offset)
      setPaymentSheets((current) => append ? [...current, ...records] : records)
      setSheetOffset(responseOffset + records.length)
      setSheetHasMore(Number.isFinite(parsedTotal)
        ? responseOffset + records.length < parsedTotal
        : records.length >= PAYMENT_SHEET_PAGE_SIZE)
      if (!append) setSelectedSheetReferenceIds(new Set())
    } catch (error) {
      console.error('Failed to load expense payment sheets:', error)
      if (!append) setPaymentSheets([])
      setPaymentSheetsError('Unable to load payment sheets. Please try again.')
    } finally {
      if (requestId === paymentSheetsRequestRef.current) {
        if (append) {
          loadingMoreSheetsRef.current = false
          setLoadingMoreSheets(false)
        } else {
          setPaymentSheetsLoading(false)
        }
      }
    }
  }, [activeStatus, appliedSheetFilters, userId])

  const fetchAttendancePaymentSheets = useCallback(async (offset = 0, append = false) => {
    const requestId = attendanceSheetsRequestRef.current + 1
    attendanceSheetsRequestRef.current = requestId
    if (append) setAttendanceLoadingMore(true)
    else setAttendanceSheetsLoading(true)
    setAttendanceSheetsError('')
    try {
      const params = {
        status: activeStatus,
        user_id: userId,
        ...(appliedSheetFilters.search ? { search: appliedSheetFilters.search } : {}),
        ...(appliedSheetFilters.from_date ? { from_date: appliedSheetFilters.from_date } : {}),
        ...(appliedSheetFilters.to_date ? { to_date: appliedSheetFilters.to_date } : {}),
        offset,
        limit: PAYMENT_SHEET_PAGE_SIZE,
      }
      const response = attendanceSource === 'core'
        ? await coreRecruiterAPI.getCoreTeamPaymentSheets(params)
        : await coreRecruiterAPI.getConsultantPaymentSheets(params)
      if (requestId !== attendanceSheetsRequestRef.current) return
      const body = response?.data ?? {}
      const payload = body?.data ?? body
      const records = getPaymentSheetRecords(payload)
      const pagination = body?.pagination || payload?.pagination || {}
      const totalValue = pagination.total ?? pagination.total_records ?? pagination.total_count ?? payload?.total ?? body?.total
      const parsedTotal = Number(totalValue)
      const responseOffset = Number(pagination.offset ?? offset)
      setAttendancePaymentSheets((current) => append ? [...current, ...records] : records)
      if (!append) setSelectedAttendanceSheetIds(new Set())
      setAttendanceOffset(responseOffset + records.length)
      setAttendanceHasMore(Number.isFinite(parsedTotal)
        ? responseOffset + records.length < parsedTotal
        : records.length >= PAYMENT_SHEET_PAGE_SIZE)
    } catch (error) {
      if (requestId !== attendanceSheetsRequestRef.current) return
      console.error(`Failed to load ${attendanceSource} attendance payment sheets:`, error)
      if (!append) setAttendancePaymentSheets([])
      setAttendanceSheetsError('Unable to load attendance payment sheets. Please try again.')
    } finally {
      if (requestId === attendanceSheetsRequestRef.current) {
        setAttendanceSheetsLoading(false)
        setAttendanceLoadingMore(false)
      }
    }
  }, [activeStatus, appliedSheetFilters, attendanceSource, userId])

  useEffect(() => {
    if (activeCategory === 'Expenses') fetchPaymentSheets()
  }, [activeCategory, fetchPaymentSheets])

  useEffect(() => {
    if (activeCategory === 'Attendance') fetchAttendancePaymentSheets()
  }, [activeCategory, fetchAttendancePaymentSheets])

  const loadMoreAttendancePaymentSheets = () => {
    if (!attendanceHasMore || attendanceSheetsLoading || attendanceLoadingMore) return
    fetchAttendancePaymentSheets(attendanceOffset, true)
  }

  const toggleAttendanceSheetSelection = (record) => {
    const selectionKey = getAttendanceSheetSelectionKey(record)
    if (selectionKey === undefined || selectionKey === null || selectionKey === '') return
    setSelectedAttendanceSheetIds((current) => {
      const next = new Set(current)
      if (next.has(String(selectionKey))) next.delete(String(selectionKey))
      else next.add(String(selectionKey))
      return next
    })
  }

  const updateSelectedAttendancePaymentSheets = async (status) => {
    if (!selectedAttendancePaymentSheets.length || updatingAttendanceSheetStatus) return
    const sheetIds = selectedAttendancePaymentSheets.map(getPaymentSheetId).filter(Boolean).map(String)
    if (sheetIds.length !== selectedAttendancePaymentSheets.length) {
      alert('error', 'A selected attendance sheet is missing its ID.')
      return
    }
    setUpdatingAttendanceSheetStatus(true)
    try {
      const isPaid = status === 'paid'
      const confirmed = await confirm(
        `${isPaid ? 'Mark' : 'Reject'} ${sheetIds.length} selected attendance sheet${sheetIds.length === 1 ? '' : 's'}?`,
        isPaid ? 'Confirm payment' : 'Confirm rejection',
        { okLabel: isPaid ? 'Mark as paid' : 'Reject' },
      )
      if (!confirmed) return

      await coreRecruiterAPI.updateAttendancePaymentSheetsStatus({
        sheet_ids: sheetIds,
        status,
        type: attendanceSource,
        user_id: userId,
      })
      alert('success', `${sheetIds.length} attendance sheet${sheetIds.length === 1 ? '' : 's'} ${isPaid ? 'marked as paid' : 'rejected'}.`)
      setSelectedAttendanceSheetIds(new Set())
      await fetchAttendancePaymentSheets()
    } catch (error) {
      alert('error', error.message || `Failed to ${status === 'paid' ? 'mark attendance sheets as paid' : 'reject attendance sheets'}.`)
      await fetchAttendancePaymentSheets()
    } finally {
      setUpdatingAttendanceSheetStatus(false)
    }
  }

  const consolidateSelectedAttendanceSheets = async () => {
    if (selectedAttendancePaymentSheets.length < 2 || consolidatingAttendanceSheets) return
    setConsolidatingAttendanceSheets(true)
    try {
      const sheetAttendance = await Promise.all(selectedAttendancePaymentSheets.map(async (record) => {
        const sheetId = getPaymentSheetId(record)
        if (!sheetId) throw new Error('A selected attendance sheet is missing its ID.')
        const params = { status: activeStatus, user_id: userId }
        const response = attendanceSource === 'core'
          ? await coreRecruiterAPI.getCoreTeamPaymentSheetDetails(sheetId, params)
          : await coreRecruiterAPI.getConsultantPaymentSheetDetails(sheetId, params)
        const body = response?.data ?? {}
        const payload = body?.data && !Array.isArray(body.data) ? body.data : body
        const detail = Array.isArray(payload)
          ? { payment_sheet: payload }
          : payload?.sheet || payload?.payment_sheet_record || payload?.paymentSheetRecord || payload
        const detailedRecord = { ...record, ...(detail && typeof detail === 'object' ? detail : {}) }
        return Array.isArray(detailedRecord.attendance) ? detailedRecord.attendance : []
      }))
      const attendance = mergeAttendancePaymentCandidates(sheetAttendance.flat())
      if (!attendance.length) throw new Error('The selected attendance sheets contain no attendance records to regenerate.')
      const response = await coreRecruiterAPI.generateAttendancePaymentSheet({
        type: 'attendance',
        attendance,
      })
      const body = response?.data ?? response
      const payload = body?.data ?? body
      const rows = Array.isArray(payload)
        ? payload
        : payload?.payment_sheet || payload?.paymentSheet || payload?.rows
      if (!Array.isArray(rows) || !rows.length) throw new Error('The attendance payment generator returned no rows.')
      attendancePreviewRequestRef.current += 1
      setAttendancePreviewSheet({
        record: { sheet_name: `Consolidated ${attendanceSource} attendance payment sheets`, isConsolidated: true },
        index: 0,
      })
      setAttendancePreviewRows(rows)
      setSelectedAttendancePreviewReferenceIds(new Set())
      setAttendancePreviewError('')
      alert('success', `Regenerated one payment sheet from ${selectedAttendancePaymentSheets.length} attendance sheets.`)
    } catch (error) {
      alert('error', error.message || 'Failed to consolidate attendance sheets.')
    } finally {
      setConsolidatingAttendanceSheets(false)
    }
  }

  const loadMorePaymentSheets = useCallback(() => {
    if (!sheetHasMore || paymentSheetsLoading || loadingMoreSheetsRef.current) return
    fetchPaymentSheets(sheetOffset, true)
  }, [fetchPaymentSheets, paymentSheetsLoading, sheetHasMore, sheetOffset])

  useEffect(() => {
    const sentinel = paymentSheetsEndRef.current
    if (!sentinel || !sheetHasMore || paymentSheetsLoading) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMorePaymentSheets()
    }, { rootMargin: '240px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMorePaymentSheets, paymentSheetsLoading, sheetHasMore])

  const togglePaymentSheetSelection = (record) => {
    const selectionKey = getSheetSelectionKey(record)
    if (selectionKey === undefined || selectionKey === null || selectionKey === '') return
    setSelectedSheetReferenceIds((current) => {
      const next = new Set(current)
      if (next.has(String(selectionKey))) next.delete(String(selectionKey))
      else next.add(String(selectionKey))
      return next
    })
  }

  const openPaymentSheet = async (record, index) => {
    setPreviewSheet({ record, index })
    setPreviewExpenses([])
    setPreviewRows([])
    setPreviewTab('generated')
    setSelectedPreviewExpenseIds(new Set())
    setPaymentCheckResults([])
    setPaymentCheckError('')
    setExpandedPaymentCheckRows(new Set())
    setPaymentCheckPanelOpen(false)
    setPreviewError('')
    setPreviewLoading(true)
    try {
      const sheetId = getPaymentSheetId(record)
      if (!sheetId) throw new Error('This payment sheet is missing its ID')
      const detailResponse = await recruiterAPI.getglobalfinalpaymentsheetdetails(sheetId, {
        type: 'expenses',
        status: activeStatus,
        user_id: userId,
      })
      const detailedRecord = getDetailedPaymentSheetRecord(detailResponse)
      const selectedRecord = { ...record, ...(detailedRecord && typeof detailedRecord === 'object' ? detailedRecord : {}) }
      setPreviewSheet({ record: selectedRecord, index })

      const savedExpenses = selectedRecord?.source_expenses || selectedRecord?.sourceExpenses || selectedRecord?.expenses || selectedRecord?.expense_records || selectedRecord?.expenseRecords
      let sourceExpenses = Array.isArray(savedExpenses) && savedExpenses.length
        ? savedExpenses
        : getRecordExpenses(selectedRecord)

      if (!Array.isArray(savedExpenses) || !savedExpenses.length) {
        const sheetRows = getSheetRows(selectedRecord)
        sourceExpenses = sourceExpenses.map((expense, expenseIndex) => ({
          ...(sheetRows[expenseIndex] && typeof sheetRows[expenseIndex] === 'object' ? sheetRows[expenseIndex] : {}),
          ...expense,
        }))
        const detailedExpenses = []
        for (let start = 0; start < sourceExpenses.length; start += 5) {
          const batch = sourceExpenses.slice(start, start + 5)
          const details = await Promise.all(batch.map(async (expense) => {
            const expenseId = getExpenseId(expense)
            if (!expenseId) return expense
            const response = await recruiterAPI.getTimingExpenseDetails(expenseId, { user_id: userId })
            const detail = response?.data?.data?.expense || response?.data?.expense || response?.data?.data || response?.data
            return detail && typeof detail === 'object' ? { ...expense, ...detail } : expense
          }))
          detailedExpenses.push(...details)
        }
        sourceExpenses = detailedExpenses
      }

      if (!sourceExpenses.length) throw new Error('This payment sheet does not contain source expenses to regenerate')
      setPreviewExpenses(sourceExpenses)
      const response = await recruiterAPI.generateExpensePaymentSheet({
        type: 'expenses',
        expenses: sourceExpenses.map(getPaymentPayload),
      })
      const payload = response?.data?.data ?? response?.data
      const rows = Array.isArray(payload)
        ? payload
        : payload?.payment_sheet || payload?.paymentSheet || payload?.rows
      if (!Array.isArray(rows)) throw new Error('Payment sheet service returned invalid data')
      setPreviewRows(rows)
    } catch (error) {
      console.error('Failed to regenerate payment sheet:', error)
      setPreviewError(error.message || 'Unable to regenerate this payment sheet')
    } finally {
      setPreviewLoading(false)
    }
  }

  const openAttendancePaymentSheet = async (record, index) => {
    const requestId = attendancePreviewRequestRef.current + 1
    attendancePreviewRequestRef.current = requestId
    setAttendancePreviewSheet({ record, index })
    setAttendancePreviewRows(getAttendancePaymentSheetRows(record))
    setSelectedAttendancePreviewReferenceIds(new Set())
    setAttendancePreviewError('')
    setAttendancePreviewLoading(true)
    try {
      const sheetId = getPaymentSheetId(record)
      if (!sheetId) throw new Error('This attendance sheet is missing its ID.')
      const params = { status: activeStatus, user_id: userId }
      const detailResponse = attendanceSource === 'core'
        ? await coreRecruiterAPI.getCoreTeamPaymentSheetDetails(sheetId, params)
        : await coreRecruiterAPI.getConsultantPaymentSheetDetails(sheetId, params)
      if (requestId !== attendancePreviewRequestRef.current) return
      const body = detailResponse?.data ?? {}
      const payload = body?.data ?? body
      const detail = Array.isArray(payload)
        ? { payment_sheet: payload }
        : payload?.sheet || payload?.payment_sheet_record || payload?.paymentSheetRecord || payload
      const detailedRecord = { ...record, ...(detail && typeof detail === 'object' ? detail : {}) }
      setAttendancePreviewSheet({ record: detailedRecord, index })
      setAttendancePreviewRows(getAttendancePaymentSheetRows(detailedRecord))
    } catch (error) {
      if (requestId !== attendancePreviewRequestRef.current) return
      console.error(`Failed to load ${attendanceSource} attendance payment sheet details:`, error)
      setAttendancePreviewError(error.message || 'Unable to load attendance payment sheet details.')
    } finally {
      if (requestId === attendancePreviewRequestRef.current) setAttendancePreviewLoading(false)
    }
  }

  const downloadAttendancePaymentSheet = () => {
    if (!attendancePreviewRows.length) return
    const columns = getSheetColumns(attendancePreviewRows)
    const rows = Array.isArray(attendancePreviewRows[0])
      ? attendancePreviewRows
      : [columns, ...attendancePreviewRows.map((row) => columns.map((column) => row?.[column] ?? ''))]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Attendance Payment Sheet')
    const filename = String(getSheetLabel(attendancePreviewSheet?.record, attendancePreviewSheet?.index) || 'attendance-payment-sheet')
      .replace(/[<>:"/\\|?*]/g, '_')
      .slice(0, 100)
    XLSX.writeFile(workbook, `${filename || 'attendance-payment-sheet'}.xlsx`)
  }

  const updateSelectedAttendancePreviewRows = async (status) => {
    const referenceIds = [...selectedAttendancePreviewReferenceIds]
    if (!referenceIds.length || updatingAttendanceSheetStatus || activeStatus !== 'ready_for_payment') return
    setUpdatingAttendanceSheetStatus(true)
    try {
      const isPaid = status === 'paid'
      const confirmed = await confirm(
        `${isPaid ? 'Mark' : 'Reject'} ${referenceIds.length} selected attendance row${referenceIds.length === 1 ? '' : 's'}?`,
        isPaid ? 'Confirm payment' : 'Confirm rejection',
        { okLabel: isPaid ? 'Mark as paid' : 'Reject' },
      )
      if (!confirmed) return

      await coreRecruiterAPI.updateAttendancePaymentSheetsStatus({
        reference_ids: referenceIds,
        status,
        type: attendanceSource,
        user_id: userId,
      })
      alert('success', `${referenceIds.length} attendance row${referenceIds.length === 1 ? '' : 's'} ${isPaid ? 'marked as paid' : 'rejected'}.`)
      setSelectedAttendancePreviewReferenceIds(new Set())
      await fetchAttendancePaymentSheets()
      if (attendancePreviewSheet?.record?.isConsolidated) {
        const updatedIds = new Set(referenceIds)
        setAttendancePreviewRows((current) => current.filter((row, index) => (
          !updatedIds.has(getAttendancePaymentRowReferenceId(row, index, current))
        )))
      } else if (attendancePreviewSheet) {
        await openAttendancePaymentSheet(attendancePreviewSheet.record, attendancePreviewSheet.index)
      }
    } catch (error) {
      alert('error', error.message || `Failed to ${status === 'paid' ? 'mark attendance rows as paid' : 'reject attendance rows'}.`)
    } finally {
      setUpdatingAttendanceSheetStatus(false)
    }
  }

  const runPaymentChecks = async () => {
    if (!previewRows.length || paymentChecksLoading) return
    setPaymentCheckPanelOpen(true)
    setPaymentChecksLoading(true)
    setPaymentCheckError('')
    setPaymentCheckResults([])
    try {
      const checkRows = getPaymentCheckRows(previewRows, previewExpenses).map(({ row, expense }, index) => ({
        row,
        expense,
        index,
        name: String(getPaymentCheckValue(row, expense, PAYMENT_NAME_FIELDS) || '').trim(),
        mobile: String(getPaymentCheckValue(row, expense, [...PAYMENT_MOBILE_FIELDS, 'contact_phone_number']) || '').trim(),
        email: String(getPaymentCheckValue(row, expense, PAYMENT_EMAIL_FIELDS) || '').trim(),
        tempId: String(getSheetRecordValue(row, PAYMENT_TEMP_ID_FIELDS) || '').trim(),
      }))
      const sourceExpenseIdsByRow = checkRows.map(({ row }) => getPaymentCheckSourceExpenseIds(row, previewExpenses))
      const sourceExpenseIds = [...new Set(sourceExpenseIdsByRow.flat())]
      const timingExpensesById = new Map()
      const failedTimingExpenseIds = new Set()
      for (let start = 0; start < sourceExpenseIds.length; start += 5) {
        const batch = sourceExpenseIds.slice(start, start + 5)
        await Promise.all(batch.map(async (expenseId) => {
          try {
            const response = await recruiterAPI.getTimingExpenseDetails(expenseId, { user_id: userId })
            const expense = response?.data?.data?.expense
              || response?.data?.expense
              || response?.data?.data
              || response?.data
            if (expense && typeof expense === 'object') timingExpensesById.set(expenseId, expense)
            else failedTimingExpenseIds.add(expenseId)
          } catch (error) {
            console.error(`Failed to load timing expense ${expenseId} for payment checks:`, error)
            failedTimingExpenseIds.add(expenseId)
          }
        }))
      }
      const registrationRows = checkRows.filter(({ mobile }) => normalizePaymentCheckMobile(mobile))
      let registrationResults = []

      if (registrationRows.length) {
        const csv = [
          'candidate_name,candidate_mobile_number',
          ...registrationRows.map(({ name, mobile }) => [name, mobile].map(escapeCsvValue).join(',')),
        ].join('\n')
        const formData = new FormData()
        formData.append('file', new Blob([csv], { type: 'text/csv' }), 'payment-registration-check.csv')
        try {
          const response = await recruiterAPI.checkRegistrationStatus(formData)
          const payload = response?.data?.data ?? response?.data ?? []
          registrationResults = Array.isArray(payload) ? payload : []
        } catch (error) {
          console.error('Payment registration check failed:', error)
        }
      }

      const candidateResults = await Promise.all(checkRows.map(async ({ mobile, email }) => {
        const [mobileLookup, emailLookup] = await Promise.all([
          normalizePaymentCheckMobile(mobile)
            ? recruiterAPI.getCandidates({ mobile, offset: 0, limit: 100 })
              .then((response) => ({
                candidates: getCandidateRecords(response).filter((candidate) => (
                  normalizePaymentCheckMobile(getPaymentPayloadValue(candidate, PAYMENT_MOBILE_FIELDS)) === normalizePaymentCheckMobile(mobile)
                )),
                error: false,
              }))
              .catch((error) => {
                console.error('Payment candidate mobile check failed:', error)
                return { candidates: [], error: true }
              })
            : Promise.resolve({ candidates: [], error: false }),
          normalizePaymentCheckEmail(email)
            ? recruiterAPI.getCandidates({ email, offset: 0, limit: 100 })
              .then((response) => ({
                candidates: getCandidateRecords(response).filter((candidate) => (
                  normalizePaymentCheckEmail(getPaymentPayloadValue(candidate, PAYMENT_EMAIL_FIELDS)) === normalizePaymentCheckEmail(email)
                )),
                error: false,
              }))
              .catch((error) => {
                console.error('Payment candidate email check failed:', error)
                return { candidates: [], error: true }
              })
            : Promise.resolve({ candidates: [], error: false }),
        ])

        return {
          mobileCandidates: mobileLookup.candidates,
          emailCandidates: emailLookup.candidates,
          mobileError: mobileLookup.error,
          emailError: emailLookup.error,
        }
      }))

      setPaymentCheckResults(checkRows.map(({ name, mobile, email, tempId, index }, resultIndex) => {
        const { mobileCandidates, emailCandidates, mobileError, emailError } = candidateResults[resultIndex]
        const matchedCandidate = mobileCandidates.find((candidate) => (
          normalizePaymentCheckValue(getPaymentPayloadValue(candidate, PAYMENT_NAME_FIELDS)) === normalizePaymentCheckValue(name)
        ))
        const registration = registrationRows.findIndex((item) => normalizePaymentCheckMobile(item.mobile) === normalizePaymentCheckMobile(mobile))
        const registrationRecord = registration >= 0 ? registrationResults[registration] : null
        const candidateTempIds = mobileCandidates.map((candidate) => String(candidate.new_id ?? candidate.newId ?? '').trim()).filter(Boolean)
        const normalizedTempId = normalizePaymentCheckValue(tempId).replace(/^cyn\d*temp/, '')
        const tempIdValid = Boolean(normalizedTempId && candidateTempIds.some((id) => normalizePaymentCheckValue(id) === normalizedTempId))
        const rowExpenseIds = sourceExpenseIdsByRow[resultIndex]
        const matchedSourceExpenses = rowExpenseIds.map((id) => timingExpensesById.get(id)).filter(Boolean)
        const sourceIdsMatched = rowExpenseIds.length > 0 && matchedSourceExpenses.length === rowExpenseIds.length
        const sheetAmount = parsePaymentAmount(getSheetRecordValue(checkRows[resultIndex].row, [
          'payout_link_amount', 'payout_amount', 'amount', 'total_amount', 'total_payout',
        ]))
        const sourceExpenseAmounts = rowExpenseIds.map((id) => {
          const expense = timingExpensesById.get(id)
          return {
            id,
            amount: expense ? parsePaymentAmount(getSheetRecordValue(expense, [
              'approved_amount', 'amount', 'total_amount', 'payout_link_amount', 'payout_amount',
            ])) : null,
          }
        })
        const sourceAmount = sourceExpenseAmounts.length && sourceExpenseAmounts.every(({ amount }) => amount !== null)
          ? sourceExpenseAmounts.reduce((total, { amount }) => total + Math.round(amount * 100), 0) / 100
          : null
        const amountsMatch = sheetAmount !== null && sourceAmount !== null
          && Math.trunc(sheetAmount) === Math.trunc(sourceAmount)
        const sourceAmountLookupFailed = rowExpenseIds.some((id) => failedTimingExpenseIds.has(id))
        const emailMatchesMobileCandidate = mobileCandidates.some((candidate) => (
          normalizePaymentCheckEmail(getPaymentPayloadValue(candidate, PAYMENT_EMAIL_FIELDS)) === normalizePaymentCheckEmail(email)
        ))
        const emailMatchesCandidateName = emailCandidates.some((candidate) => (
          normalizePaymentCheckValue(getPaymentPayloadValue(candidate, PAYMENT_NAME_FIELDS)) === normalizePaymentCheckValue(name)
        ))

        return {
          row: index + 1,
          name,
          mobile,
          email,
          nameMatch: !mobile ? 'Missing mobile' : mobileError ? 'Check failed' : matchedCandidate ? 'Match' : mobileCandidates.length ? 'Name mismatch' : 'Not found',
          emailMatch: !email ? 'Missing email' : emailError ? 'Check failed' : mobileCandidates.length ? emailMatchesMobileCandidate ? 'Match' : 'Email mismatch' : emailMatchesCandidateName ? 'Email found' : emailCandidates.length ? 'Name mismatch' : 'Not found',
          expenseIds: rowExpenseIds,
          sourceExpenseAmounts,
          expenseIdCheck: sourceIdsMatched ? 'IDs matched' : rowExpenseIds.length ? 'ID mismatch' : 'Unavailable',
          sheetAmount,
          sourceAmount,
          amountCheck: sourceAmountLookupFailed ? 'Check failed' : sheetAmount === null || sourceAmount === null ? 'Unavailable' : amountsMatch ? 'Amount matched' : 'Amount mismatch',
          registration: !mobile ? 'Missing mobile' : registrationResults.length ? getRegistrationResult(registrationRecord) : 'Check failed',
          tempId: !tempId ? 'Missing' : mobileError ? 'Check failed' : tempIdValid ? 'Valid' : mobileCandidates.length ? 'Invalid' : 'Not found',
        }
      }))
      if (registrationRows.length && !registrationResults.length) {
        setPaymentCheckError('Registration status could not be retrieved. Candidate and temp ID checks are still shown where available.')
      }
    } catch (error) {
      console.error('Failed to run payment checks:', error)
      setPaymentCheckError(error.message || 'Unable to run payment checks. Please try again.')
    } finally {
      setPaymentChecksLoading(false)
    }
  }

  const updateSelectedPaymentSheets = async (status) => {
    if (!selectedPaymentSheets.length || updatingSheetStatus) return
    setUpdatingSheetStatus(true)
    try {
      const isPaid = status === 'paid'
      const confirmed = await confirm(
        `${isPaid ? 'Mark' : 'Reject'} ${selectedPaymentSheets.length} selected payment sheet${selectedPaymentSheets.length === 1 ? '' : 's'}?`,
        isPaid ? 'Confirm payment' : 'Confirm rejection',
        { okLabel: isPaid ? 'Mark as paid' : 'Reject' },
      )
      if (!confirmed) return

      const expenseIdGroups = await Promise.all(selectedPaymentSheets.map(async (record) => {
        const sheetId = getPaymentSheetId(record)
        if (!sheetId) throw new Error('A selected sheet is missing its ID')
        const response = await recruiterAPI.getglobalfinalpaymentsheetdetails(sheetId, {
          type: 'expenses',
          status: activeStatus,
          user_id: userId,
        })
        const detail = getDetailedPaymentSheetRecord(response)
        return getPaymentSheetExpenseIds({
          ...record,
          ...(detail && typeof detail === 'object' ? detail : {}),
        })
      }))
      if (expenseIdGroups.some((expenseIds) => !expenseIds.length)) {
        alert('error', 'A selected sheet does not include expense IDs')
        return
      }
      const expenseIds = [...new Set(expenseIdGroups.flat())]
      await updatePaymentSheetStatusForExpenses(expenseIds, status, userId)
      alert('success', `${selectedPaymentSheets.length} payment sheet${selectedPaymentSheets.length === 1 ? '' : 's'} ${status === 'paid' ? 'marked as paid' : 'rejected'}`)
      setSelectedSheetReferenceIds(new Set())
      await fetchPaymentSheets()
    } catch (error) {
      alert('error', error.message || `Failed to ${status === 'paid' ? 'mark payment sheets as paid' : 'reject payment sheets'}`)
      await fetchPaymentSheets()
    } finally {
      setUpdatingSheetStatus(false)
    }
  }

  const consolidateSelectedPaymentSheets = async () => {
    if (selectedPaymentSheets.length < 2 || consolidatingSheets || activeStatus !== 'ready_for_payment') return
    setConsolidatingSheets(true)
    try {
      const sheetExpenseData = await Promise.all(selectedPaymentSheets.map(async (record) => {
        const sheetId = getPaymentSheetId(record)
        if (!sheetId) throw new Error('A selected sheet is missing its ID')
        const response = await recruiterAPI.getglobalfinalpaymentsheetdetails(sheetId, {
          type: 'expenses',
          status: activeStatus,
          user_id: userId,
        })
        const detail = getDetailedPaymentSheetRecord(response)
        const detailedRecord = {
          ...record,
          ...(detail && typeof detail === 'object' ? detail : {}),
        }
        return {
          expenseIds: getPaymentSheetExpenseIds(detailedRecord),
          expenses: getRecordExpenses(detailedRecord),
        }
      }))
      if (sheetExpenseData.some(({ expenseIds }) => !expenseIds.length)) {
        throw new Error('A selected sheet does not include expense IDs')
      }

      const expenseIds = [...new Set(sheetExpenseData.flatMap(({ expenseIds }) => expenseIds))]
      const savedExpensesById = new Map()
      sheetExpenseData.flatMap(({ expenses }) => expenses).forEach((expense) => {
        const expenseId = getExpenseId(expense)
        if (!expenseId) return
        const key = String(expenseId)
        const current = savedExpensesById.get(key) || {}
        const mobileNumber = getPaymentPayloadValue(expense, PAYMENT_MOBILE_FIELDS)
          || getPaymentPayloadValue(current, PAYMENT_MOBILE_FIELDS)
        savedExpensesById.set(key, {
          ...current,
          ...expense,
          ...(mobileNumber ? { mobile_number: mobileNumber } : {}),
        })
      })

      const sourceExpenses = []
      for (let start = 0; start < expenseIds.length; start += 5) {
        const batch = expenseIds.slice(start, start + 5)
        const details = await Promise.all(batch.map(async (expenseId) => {
          const savedExpense = savedExpensesById.get(String(expenseId)) || { expense_id: expenseId }
          const savedMobileNumber = getPaymentPayloadValue(savedExpense, PAYMENT_MOBILE_FIELDS)
          if (savedMobileNumber) {
            return { ...savedExpense, expense_id: getExpenseId(savedExpense) || expenseId, mobile_number: savedMobileNumber }
          }

          const response = await recruiterAPI.getTimingExpenseDetails(expenseId, { user_id: userId })
          const detail = response?.data?.data?.expense || response?.data?.expense || response?.data?.data || response?.data
          if (!detail || typeof detail !== 'object') throw new Error(`Unable to load expense ${expenseId}`)
          const detailMobileNumber = getPaymentPayloadValue(detail, PAYMENT_MOBILE_FIELDS)
          return {
            ...savedExpense,
            ...detail,
            expense_id: getExpenseId(detail) || getExpenseId(savedExpense) || expenseId,
            ...(detailMobileNumber || savedMobileNumber
              ? { mobile_number: detailMobileNumber || savedMobileNumber }
              : {}),
          }
        }))
        sourceExpenses.push(...details)
      }

      const response = await recruiterAPI.generateExpensePaymentSheet({
        type: 'expenses',
        expenses: sourceExpenses.map(getPaymentPayload),
      })
      const payload = response?.data?.data ?? response?.data
      const rows = Array.isArray(payload)
        ? payload
        : payload?.payment_sheet || payload?.paymentSheet || payload?.rows
      if (!Array.isArray(rows) || !rows.length) throw new Error('Payment sheet service returned no rows')

      setPreviewSheet({
        record: {
          sheet_name: 'Consolidated payment sheet',
          isConsolidated: true,
        },
        index: 0,
      })
      setPreviewExpenses(sourceExpenses)
      setPreviewRows(rows)
      setPreviewTab('generated')
      setPaymentCheckResults([])
      setPaymentCheckError('')
      setExpandedPaymentCheckRows(new Set())
      setPaymentCheckPanelOpen(false)
      setSelectedPreviewExpenseIds(new Set())
      setPreviewError('')
      alert('success', `Generated one sheet from ${selectedPaymentSheets.length} sheets and ${expenseIds.length} expenses`)
    } catch (error) {
      alert('error', error.message || 'Failed to consolidate selected payment sheets')
    } finally {
      setConsolidatingSheets(false)
    }
  }

  const updateSelectedPreviewRows = async (status) => {
    const expenseIds = [...selectedPreviewExpenseIds]
    if (!expenseIds.length || updatingSheetStatus || activeStatus !== 'ready_for_payment') return
    setUpdatingSheetStatus(true)
    try {
      const isPaid = status === 'paid'
      const confirmed = await confirm(
        `${isPaid ? 'Mark' : 'Reject'} ${expenseIds.length} selected expense${expenseIds.length === 1 ? '' : 's'}?`,
        isPaid ? 'Confirm payment' : 'Confirm rejection',
        { okLabel: isPaid ? 'Mark as paid' : 'Reject' },
      )
      if (!confirmed) return

      await updatePaymentSheetStatusForExpenses(expenseIds, status, userId)
      alert('success', `${expenseIds.length} expense${expenseIds.length === 1 ? '' : 's'} ${status === 'paid' ? 'marked as paid' : 'rejected'}`)
      setSelectedPreviewExpenseIds(new Set())
      await fetchPaymentSheets()
      if (previewSheet?.record?.isConsolidated) {
        const updatedIds = new Set(expenseIds)
        setPreviewExpenses((current) => current.filter((expense) => !updatedIds.has(String(getExpenseId(expense)))))
        setPreviewRows((current) => current.filter((row, rowIndex) => (
          !getPaymentSheetRowExpenseIds(row, rowIndex, previewExpenses).some((expenseId) => updatedIds.has(expenseId))
        )))
      } else if (previewSheet) {
        await openPaymentSheet(previewSheet.record, previewSheet.index)
      }
    } catch (error) {
      alert('error', error.message || `Failed to ${status === 'paid' ? 'mark selected expenses as paid' : 'reject selected expenses'}`)
    } finally {
      setUpdatingSheetStatus(false)
    }
  }

  const downloadSelectedPreviewRows = () => {
    const selectedRows = previewRows.filter((row, rowIndex) => (
      getPaymentSheetRowExpenseIds(row, rowIndex, previewExpenses)
        .some((expenseId) => selectedPreviewExpenseIds.has(expenseId))
    ))
    if (!selectedRows.length) {
      alert('error', 'No selected payment sheet rows are available to download')
      return
    }
    const replacedCharacters = downloadPaymentSheet(selectedRows, previewSheet?.record, previewSheet?.index)
    if (replacedCharacters === null) {
      alert('error', 'No selected payment sheet rows are available to download')
      return
    }
    if (replacedCharacters) alert(`${replacedCharacters} character${replacedCharacters === 1 ? '' : 's'} could not be represented in legacy CSV and ${replacedCharacters === 1 ? 'was' : 'were'} replaced with ?`, 'Legacy CSV encoding')
  }

  const downloadPreviewSheet = () => {
    const replacedCharacters = downloadPaymentSheet(previewRows, previewSheet?.record, previewSheet?.index)
    if (replacedCharacters === null) {
      alert('error', 'No generated payment sheet rows are available to download')
      return
    }
    if (replacedCharacters) alert(`${replacedCharacters} character${replacedCharacters === 1 ? '' : 's'} could not be represented in legacy CSV and ${replacedCharacters === 1 ? 'was' : 'were'} replaced with ?`, 'Legacy CSV encoding')
  }

  const downloadPaymentUploadSample = () => {
    const now = new Date()
    const sampleDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
    const sampleRows = [
      [sampleDate, 'Sample Contact 1', 1000, '', 'sample1@example.com', 'No', 'Yes', 'Consultant', 'Sample payout', 'Example payment row 1', 'SAMPLE-001', 'Example only', 'Do not use as a real payment'],
      [sampleDate, 'Sample Contact 2', 1500, '', 'sample2@example.com', 'No', 'Yes', 'Consultant', 'Sample payout', 'Example payment row 2', 'SAMPLE-002', 'Example only', 'Do not use as a real payment'],
      [sampleDate, 'Sample Contact 3', 2000, '', 'sample3@example.com', 'No', 'Yes', 'Consultant', 'Sample payout', 'Example payment row 3', 'SAMPLE-003', 'Example only', 'Do not use as a real payment'],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([PAYMENT_UPLOAD_HEADERS, ...sampleRows])

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Sample')
    const replacedCharacters = downloadLegacyCsv(workbook, 'payment_upload_sample.csv')
    if (replacedCharacters) alert(`${replacedCharacters} character${replacedCharacters === 1 ? '' : 's'} could not be represented in legacy CSV and ${replacedCharacters === 1 ? 'was' : 'were'} replaced with ?`, 'Legacy CSV encoding')
  }

  const uploadPaymentsFile = async () => {
    if (!globalUploadFile) {
      setGlobalUploadError('Choose a payment file to upload.')
      return
    }

    setGlobalUploadLoading(true)
    setGlobalUploadError('')
    setGlobalUploadSuccess('')
    const formData = new FormData()
    formData.append('file', globalUploadFile)

    try {
      await recruiterAPI.uploadPaymentsFile(formData)
      setGlobalUploadSuccess('Payments uploaded successfully.')
      setGlobalUploadFile(null)
    } catch (uploadError) {
      console.error('Failed to upload payment file:', uploadError)
      setGlobalUploadError('Unable to upload the payment file. Please try again.')
    } finally {
      setGlobalUploadLoading(false)
    }
  }

  const selectedPreviewRows = previewRows.filter((row, rowIndex) => {
    const expenseIds = getPaymentSheetRowExpenseIds(row, rowIndex, previewExpenses)
    return expenseIds.length > 0 && expenseIds.every((expenseId) => selectedPreviewExpenseIds.has(expenseId))
  })
  const selectablePreviewExpenseIds = [...new Set(previewRows.flatMap((row, rowIndex) => (
    getPaymentSheetRowExpenseIds(row, rowIndex, previewExpenses)
  )))]
  const allPreviewRowsSelected = selectablePreviewExpenseIds.length > 0
    && selectablePreviewExpenseIds.every((expenseId) => selectedPreviewExpenseIds.has(expenseId))
  const somePreviewRowsSelected = selectablePreviewExpenseIds.some((expenseId) => selectedPreviewExpenseIds.has(expenseId))

  useEffect(() => {
    if (selectAllPreviewRef.current) {
      selectAllPreviewRef.current.indeterminate = somePreviewRowsSelected && !allPreviewRowsSelected
    }
  }, [somePreviewRowsSelected, allPreviewRowsSelected])

  const selectedPreviewAmount = selectedPreviewRows.reduce((total, row) => total + getPaymentSheetRowAmount(row), 0)
  const paymentCheckKpis = PAYMENT_CHECK_ITEMS.map(({ key, label }) => ({
    key,
    label: key === 'registration' ? 'Registered' : `${label} matched`,
    matched: paymentCheckResults.filter((result) => getPaymentCheckStatusTone(result[key]) === 'success').length,
    total: paymentCheckResults.length,
  }))
  return (
    <div className="payments-page payments-new-page">
      <PageHeader
        title="Payments"
        subtitle="Review confirmed payment sheets and track expense payouts."
        action={(
          <div className="payments-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={() => setIsUploadPaymentsOpen(true)}>
              <FontAwesomeIcon icon={faUpload} /> Upload Payments
            </button>
          </div>
        )}
      />

      <div className="payments-new-category-switch" role="tablist" aria-label="Payment category">
        {PAYMENT_CATEGORIES.map((category) => (
          <button
            key={category}
            className={`payments-new-toggle${activeCategory === category ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeCategory === category}
            onClick={() => {
              setActiveCategory(category)
              setSelectedSheetReferenceIds(new Set())
              setSelectedAttendanceSheetIds(new Set())
              setPreviewSheet(null)
              attendancePreviewRequestRef.current += 1
              setAttendancePreviewSheet(null)
            }}
          >
            {category}
          </button>
        ))}
      </div>

      <Card className="payments-new-content">
        {activeCategory === 'Expenses' ? (
          <>
            <div className="payments-new-toolbar">
              <div className="payments-new-status-switch" role="tablist" aria-label="Expense payment status">
                {PAYMENT_STATUSES.map((status) => (
                  <button
                    key={status.value}
                    className={`payments-new-status${activeStatus === status.value ? ' active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={activeStatus === status.value}
                    onClick={() => {
                      setPreviewSheet(null)
                      setSelectedSheetReferenceIds(new Set())
                      setSheetOffset(0)
                      setActiveStatus(status.value)
                    }}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
              <label className="payments-new-select-all-sheets">
                <input
                  ref={selectAllSheetsRef}
                  type="checkbox"
                  checked={allPaymentSheetsSelected}
                  disabled={!selectableSheetKeys.length || updatingSheetStatus || paymentSheetsLoading}
                  onChange={(event) => setSelectedSheetReferenceIds((current) => {
                    const next = new Set(current)
                    selectableSheetKeys.forEach((key) => event.target.checked ? next.add(key) : next.delete(key))
                    return next
                  })}
                />
                Select all sheets
              </label>
              {activeStatus === 'ready_for_payment' && (
                <div className="payments-new-sheet-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    onClick={() => updateSelectedPaymentSheets('paid')}
                    disabled={!selectedPaymentSheets.length || updatingSheetStatus || paymentSheetsLoading}
                  >
                    <FontAwesomeIcon icon={faCheck} /> {updatingSheetStatus ? 'Updating...' : `Mark as paid${selectedPaymentSheets.length ? ` (${selectedPaymentSheets.length})` : ''}`}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    type="button"
                    onClick={() => updateSelectedPaymentSheets('reject')}
                    disabled={!selectedPaymentSheets.length || updatingSheetStatus || paymentSheetsLoading}
                  >
                    <FontAwesomeIcon icon={faTimes} /> Reject{selectedPaymentSheets.length ? ` (${selectedPaymentSheets.length})` : ''}
                  </button>
                </div>
              )}
            </div>

            <form
              className="payments-new-sheet-filters"
              onSubmit={(event) => {
                event.preventDefault()
                setPreviewSheet(null)
                setSelectedSheetReferenceIds(new Set())
                setSheetOffset(0)
                setAppliedSheetFilters({
                  search: sheetSearch.trim(),
                  from_date: sheetFromDate,
                  to_date: sheetToDate,
                })
              }}
            >
              <input
                className="form-control"
                type="search"
                value={sheetSearch}
                placeholder="Search payment sheets"
                aria-label="Search payment sheets"
                onChange={(event) => setSheetSearch(event.target.value)}
              />
              <label className="payments-new-date-filter">
                <span>Date from</span>
                <input className="form-control" type="date" value={sheetFromDate} onChange={(event) => setSheetFromDate(event.target.value)} />
              </label>
              <label className="payments-new-date-filter">
                <span>Date to</span>
                <input className="form-control" type="date" value={sheetToDate} onChange={(event) => setSheetToDate(event.target.value)} />
              </label>
              <button className="btn btn-primary btn-sm" type="submit" disabled={paymentSheetsLoading}>Search</button>
            </form>

            {paymentSheetsError && <div className="upload-error" role="alert">{paymentSheetsError}</div>}
            {paymentSheetsLoading ? (
              <div className="payments-new-empty" role="status">Loading expense payment sheets...</div>
            ) : paymentSheets.length === 0 ? (
              <div className="payments-new-empty">No {activeStatus === 'ready_for_payment' ? 'pending' : activeStatus} expense payment sheets found.</div>
            ) : (
              <div className="payments-new-sheet-cards">
                {paymentSheets.map((record, index) => {
                  const sheetId = record.id || record.payment_sheet_id || record.paymentSheetId || index
                  const expenseCount = record.expense_count ?? record.expenses_count ?? record.row_count
                  const amount = record.amount ?? record.total_amount ?? record.totalAmount
                  const amountLabel = amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount))
                    ? `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : ''
                  return (
                    <article
                      className="payments-new-sheet-card"
                      key={sheetId}
                      aria-busy={previewLoading}
                    >
                      <input
                        className="payments-new-sheet-checkbox"
                        type="checkbox"
                        checked={selectedSheetReferenceIds.has(String(getSheetSelectionKey(record)))}
                        onChange={() => togglePaymentSheetSelection(record)}
                        aria-label={`Select ${getSheetLabel(record, index)} for status update`}
                        disabled={!getSheetSelectionKey(record) || updatingSheetStatus || paymentSheetsLoading}
                      />
                      <button
                        className="payments-new-sheet-card-content"
                        type="button"
                        onClick={() => openPaymentSheet(record, index)}
                        disabled={previewLoading || updatingSheetStatus}
                      >
                        <FontAwesomeIcon icon={faFileExcel} aria-hidden="true" />
                        <span className="payments-new-sheet-card-copy">
                          <strong>{getSheetLabel(record, index)}</strong>
                          <small>Sheet ID: {record.id || record.payment_sheet_id || record.paymentSheetId || 'Unavailable'}{expenseCount !== undefined ? ` · ${expenseCount} expenses` : ''}</small>
                          <small>Reference ID: {getSheetReferenceId(record) || 'Unavailable'}</small>
                          {isPaymentSheetDownloaded(record) && <small className="payments-new-downloaded-hint">Downloaded previously</small>}
                        </span>
                        <strong className="payments-new-sheet-card-total">{amountLabel || 'Amount unavailable'}</strong>
                        <span className="payments-new-sheet-card-open">Open</span>
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
            {!paymentSheetsLoading && paymentSheets.length > 0 && <div
              ref={paymentSheetsEndRef}
              className="payments-new-sheet-scroll-status"
              aria-live="polite"
            >
              {loadingMoreSheets
                ? 'Loading more payment sheets...'
                : !sheetHasMore ? 'All payment sheets loaded' : ''}
            </div>}
          </>
        ) : activeCategory === 'Attendance' ? (
          <>
            <div className="payments-new-toolbar attendance-payments-toolbar">
              <div className="payments-new-attendance-controls">
                <div className="payments-new-attendance-control">
                  <span>Recipient group</span>
                  <div className="payments-new-status-switch attendance-payment-source-switch" role="tablist" aria-label="Attendance sheet type">
                    <button className={`payments-new-status${attendanceSource === 'core' ? ' active' : ''}`} type="button" role="tab" aria-selected={attendanceSource === 'core'} onClick={() => {
                      attendancePreviewRequestRef.current += 1
                      setAttendancePreviewSheet(null)
                      setSelectedAttendanceSheetIds(new Set())
                      setAttendanceOffset(0)
                      setAttendanceSource('core')
                    }}>Core team</button>
                    <button className={`payments-new-status${attendanceSource === 'consultant' ? ' active' : ''}`} type="button" role="tab" aria-selected={attendanceSource === 'consultant'} onClick={() => {
                      attendancePreviewRequestRef.current += 1
                      setAttendancePreviewSheet(null)
                      setSelectedAttendanceSheetIds(new Set())
                      setAttendanceOffset(0)
                      setAttendanceSource('consultant')
                    }}>Consultant</button>
                  </div>
                </div>
                <div className="payments-new-attendance-control">
                  <span>Payment status</span>
                  <div className="payments-new-status-switch" role="tablist" aria-label="Attendance payment status">
                    {PAYMENT_STATUSES.map((status) => <button
                      key={status.value}
                      className={`payments-new-status${activeStatus === status.value ? ' active' : ''}`}
                      type="button"
                      role="tab"
                      aria-selected={activeStatus === status.value}
                      onClick={() => {
                        attendancePreviewRequestRef.current += 1
                        setAttendancePreviewSheet(null)
                        setSelectedAttendanceSheetIds(new Set())
                        setAttendanceOffset(0)
                        setActiveStatus(status.value)
                      }}
                    >{status.label}</button>)}
                  </div>
                </div>
              </div>
              <div className="payments-new-attendance-sheet-actions">
                <label className="payments-new-select-all-sheets">
                  <input
                    ref={selectAllAttendanceSheetsRef}
                    type="checkbox"
                    checked={allAttendanceSheetsSelected}
                    disabled={!selectableAttendanceSheetKeys.length || updatingAttendanceSheetStatus || attendanceSheetsLoading}
                    onChange={(event) => setSelectedAttendanceSheetIds((current) => {
                      const next = new Set(current)
                      selectableAttendanceSheetKeys.forEach((key) => event.target.checked ? next.add(key) : next.delete(key))
                      return next
                    })}
                  />
                  Select all sheets
                </label>
                <div className="payments-new-sheet-actions">
                  {activeStatus === 'ready_for_payment' && <>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => updateSelectedAttendancePaymentSheets('paid')} disabled={!selectedAttendancePaymentSheets.length || updatingAttendanceSheetStatus || attendanceSheetsLoading}>
                      <FontAwesomeIcon icon={faCheck} /> {updatingAttendanceSheetStatus ? 'Updating...' : `Mark as paid${selectedAttendancePaymentSheets.length ? ` (${selectedAttendancePaymentSheets.length})` : ''}`}
                    </button>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => updateSelectedAttendancePaymentSheets('rejected')} disabled={!selectedAttendancePaymentSheets.length || updatingAttendanceSheetStatus || attendanceSheetsLoading}>
                      <FontAwesomeIcon icon={faTimes} /> Reject{selectedAttendancePaymentSheets.length ? ` (${selectedAttendancePaymentSheets.length})` : ''}
                    </button>
                  </>}
                </div>
              </div>
            </div>

            <form className="payments-new-sheet-filters" onSubmit={(event) => {
              event.preventDefault()
              attendancePreviewRequestRef.current += 1
              setAttendancePreviewSheet(null)
              setSelectedAttendanceSheetIds(new Set())
              setAttendanceOffset(0)
              setAppliedSheetFilters({ search: sheetSearch.trim(), from_date: sheetFromDate, to_date: sheetToDate })
            }}>
              <input className="form-control" type="search" value={sheetSearch} placeholder="Search attendance sheets" aria-label="Search attendance sheets" onChange={(event) => setSheetSearch(event.target.value)} />
              <label className="payments-new-date-filter"><span>Date from</span><input className="form-control" type="date" value={sheetFromDate} onChange={(event) => setSheetFromDate(event.target.value)} /></label>
              <label className="payments-new-date-filter"><span>Date to</span><input className="form-control" type="date" value={sheetToDate} onChange={(event) => setSheetToDate(event.target.value)} /></label>
              <button className="btn btn-primary btn-sm" type="submit" disabled={attendanceSheetsLoading}>Search</button>
            </form>

            {attendanceSheetsError && <div className="upload-error" role="alert">{attendanceSheetsError}</div>}
            {attendanceSheetsLoading ? (
              <div className="payments-new-empty" role="status">Loading {attendanceSource} attendance payment sheets...</div>
            ) : attendancePaymentSheets.length === 0 ? (
              <div className="payments-new-empty">No {activeStatus === 'ready_for_payment' ? 'pending' : activeStatus} {attendanceSource} attendance sheets found.</div>
            ) : (
              <div className="payments-new-sheet-cards attendance-payment-sheet-cards">
                {attendancePaymentSheets.map((record, index) => {
                  const sheetId = getPaymentSheetId(record) || index
                  const selectionKey = getAttendanceSheetSelectionKey(record)
                  const rowCount = record.row_count ?? record.rows_count ?? record.attendance_count
                  const amount = record.amount ?? record.total_amount ?? record.totalAmount
                  const amountLabel = amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount))
                    ? `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'Amount unavailable'
                  return <article className="payments-new-sheet-card" key={sheetId} aria-busy={attendancePreviewLoading}>
                    <input
                      className="payments-new-sheet-checkbox"
                      type="checkbox"
                      checked={selectionKey !== undefined && selectionKey !== null && selectedAttendanceSheetIds.has(String(selectionKey))}
                      onChange={() => toggleAttendanceSheetSelection(record)}
                      aria-label={`Select ${getSheetLabel(record, index)} for attendance payment actions`}
                      disabled={!getPaymentSheetId(record) || updatingAttendanceSheetStatus || attendanceSheetsLoading}
                    />
                    <button className="payments-new-sheet-card-content" type="button" onClick={() => openAttendancePaymentSheet(record, index)} disabled={attendancePreviewLoading || updatingAttendanceSheetStatus}>
                      <FontAwesomeIcon icon={faFileExcel} aria-hidden="true" />
                      <span className="payments-new-sheet-card-copy"><strong>{getSheetLabel(record, index)}</strong><small>Sheet ID: {getPaymentSheetId(record) || 'Unavailable'}{rowCount !== undefined ? ` · ${rowCount} rows` : ''}</small></span>
                      <strong className="payments-new-sheet-card-total">{amountLabel}</strong>
                      <span className="payments-new-sheet-card-open">Open</span>
                    </button>
                  </article>
                })}
              </div>
            )}
            {!attendanceSheetsLoading && attendancePaymentSheets.length > 0 && <div className="payments-new-sheet-scroll-status">
              {attendanceLoadingMore ? 'Loading more attendance sheets...' : !attendanceHasMore ? 'All attendance sheets loaded' : <button className="btn btn-outline btn-sm" type="button" onClick={() => fetchAttendancePaymentSheets(attendanceOffset, true)}>Load more</button>}
            </div>}
          </>
        ) : (
          <div className="payments-new-empty">{activeCategory} payments will be available here later.</div>
        )}
      </Card>

      {activeCategory === 'Expenses' && selectedPaymentSheets.length > 0 && <aside className="payments-new-selection-summary" aria-live="polite" aria-label="Selected payment summary">
        <header className="payments-new-selection-summary-header">
          <div>
            <p>Payment selection</p>
            <strong>{selectedPaymentSheets.length} sheet{selectedPaymentSheets.length === 1 ? '' : 's'} selected</strong>
          </div>
          <div className="payments-new-selection-summary-controls">
            <button
              className="payments-new-selection-summary-toggle"
              type="button"
              onClick={() => setSelectionSummaryMinimized((minimized) => !minimized)}
              aria-label={selectionSummaryMinimized ? 'Restore payment summary' : 'Minimize payment summary'}
              aria-expanded={!selectionSummaryMinimized}
              aria-controls="payments-new-selection-summary-content"
              title={selectionSummaryMinimized ? 'Restore summary' : 'Minimize summary'}
            ><FontAwesomeIcon icon={selectionSummaryMinimized ? faWindowMaximize : faWindowMinimize} /></button>
            <button
              className="payments-new-selection-summary-clear"
              type="button"
              onClick={() => setSelectedSheetReferenceIds(new Set())}
              aria-label="Clear selected payment sheets"
              title="Clear selection"
            ><FontAwesomeIcon icon={faTimes} /></button>
          </div>
        </header>
        <div id="payments-new-selection-summary-content" hidden={selectionSummaryMinimized}>
          <div className="payments-new-selection-summary-stats">
            <div><span>People</span><strong>{selectedSheetSummary.peopleUnavailable && !selectedSheetSummary.peopleCount ? 'Unavailable' : `${selectedSheetSummary.peopleCount.toLocaleString('en-IN')}${selectedSheetSummary.peopleUnavailable ? '+' : ''}`}</strong></div>
            <div><span>Total amount</span><strong>{selectedSheetSummary.amountUnavailable ? `₹${selectedSheetSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}+` : `₹${selectedSheetSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong></div>
          </div>
          <div className="payments-new-selection-summary-projects">
            <span>Project locations</span>
            {selectedSheetSummary.projectLocations.length ? (
              <ul>{selectedSheetSummary.projectLocations.map(({ project, locations }) => (
                <li key={project}><strong>{project}</strong> - {locations.join(', ')}</li>
              ))}</ul>
            ) : <strong>Project/location details unavailable</strong>}
          </div>
          {activeStatus === 'ready_for_payment' && selectedPaymentSheets.length > 1 && <div className="payments-new-selection-summary-action">
            <button
              className="btn btn-outline btn-sm payments-new-selection-summary-consolidate"
              type="button"
              onClick={consolidateSelectedPaymentSheets}
              disabled={consolidatingSheets || updatingSheetStatus || paymentSheetsLoading}
            >
              <FontAwesomeIcon icon={faFileExcel} /> {consolidatingSheets ? 'Consolidating...' : 'Consolidate'}
            </button>
          </div>}
          {selectedSheetSummary.peopleUnavailable && <p className="payments-new-selection-summary-note">Some sheets do not include recipient details.</p>}
          {selectedSheetSummary.amountUnavailable && <p className="payments-new-selection-summary-note">Some sheet totals are unavailable.</p>}
          {loadingSelectedSheetDetails > 0 && <p className="payments-new-selection-summary-note" role="status">Loading details for {loadingSelectedSheetDetails} selected sheet{loadingSelectedSheetDetails === 1 ? '' : 's'}...</p>}
        </div>
      </aside>}

      {activeCategory === 'Attendance' && selectedAttendancePaymentSheets.length > 0 && <aside className="payments-new-selection-summary" aria-live="polite" aria-label="Selected attendance payment summary">
        <header className="payments-new-selection-summary-header">
          <div>
            <p>Attendance selection</p>
            <strong>{selectedAttendancePaymentSheets.length} sheet{selectedAttendancePaymentSheets.length === 1 ? '' : 's'} selected</strong>
          </div>
          <div className="payments-new-selection-summary-controls">
            <button
              className="payments-new-selection-summary-toggle"
              type="button"
              onClick={() => setSelectionSummaryMinimized((minimized) => !minimized)}
              aria-label={selectionSummaryMinimized ? 'Restore attendance summary' : 'Minimize attendance summary'}
              aria-expanded={!selectionSummaryMinimized}
              aria-controls="payments-new-attendance-selection-summary-content"
              title={selectionSummaryMinimized ? 'Restore summary' : 'Minimize summary'}
            ><FontAwesomeIcon icon={selectionSummaryMinimized ? faWindowMaximize : faWindowMinimize} /></button>
            <button
              className="payments-new-selection-summary-clear"
              type="button"
              onClick={() => setSelectedAttendanceSheetIds(new Set())}
              aria-label="Clear selected attendance sheets"
              title="Clear selection"
            ><FontAwesomeIcon icon={faTimes} /></button>
          </div>
        </header>
        <div id="payments-new-attendance-selection-summary-content" hidden={selectionSummaryMinimized}>
          <div className="payments-new-selection-summary-stats">
            <div><span>People</span><strong>{selectedAttendanceSheetSummary.peopleUnavailable && !selectedAttendanceSheetSummary.peopleCount ? 'Unavailable' : `${selectedAttendanceSheetSummary.peopleCount.toLocaleString('en-IN')}${selectedAttendanceSheetSummary.peopleUnavailable ? '+' : ''}`}</strong></div>
            <div><span>Total amount</span><strong>{selectedAttendanceSheetSummary.amountUnavailable ? `₹${selectedAttendanceSheetSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}+` : `₹${selectedAttendanceSheetSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong></div>
          </div>
          <div className="payments-new-selection-summary-projects">
            <span>Project locations</span>
            {selectedAttendanceSheetSummary.projectLocations.length ? (
              <ul>{selectedAttendanceSheetSummary.projectLocations.map(({ project, locations }) => (
                <li key={project}><strong>{project}</strong> - {locations.join(', ')}</li>
              ))}</ul>
            ) : <strong>Project/location details unavailable</strong>}
          </div>
          {activeStatus === 'ready_for_payment' && selectedAttendancePaymentSheets.length > 1 && <div className="payments-new-selection-summary-action">
            <button
              className="btn btn-outline btn-sm payments-new-selection-summary-consolidate"
              type="button"
              onClick={consolidateSelectedAttendanceSheets}
              disabled={consolidatingAttendanceSheets || updatingAttendanceSheetStatus || attendanceSheetsLoading}
            >
              <FontAwesomeIcon icon={faFileExcel} /> {consolidatingAttendanceSheets ? 'Consolidating...' : 'Consolidate'}
            </button>
          </div>}
          {selectedAttendanceSheetSummary.peopleUnavailable && <p className="payments-new-selection-summary-note">Some sheets do not include recipient details.</p>}
          {selectedAttendanceSheetSummary.amountUnavailable && <p className="payments-new-selection-summary-note">Some sheet totals are unavailable.</p>}
        </div>
      </aside>}

      <Modal
        title={previewSheet ? getSheetLabel(previewSheet.record, previewSheet.index) : 'Payment sheet preview'}
        isOpen={Boolean(previewSheet)}
        onClose={() => { if (!previewLoading) setPreviewSheet(null) }}
        headerAction={<button className="payments-new-run-check" type="button" onClick={runPaymentChecks} aria-expanded={paymentCheckPanelOpen} aria-controls="payments-new-check-offcanvas" disabled={previewLoading || paymentChecksLoading || !previewRows.length}>
          <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
          <span>{paymentChecksLoading ? 'Checking...' : 'Run checks'}</span>
        </button>}
        overlayContent={paymentCheckPanelOpen && previewRows.length > 0 && <>
          <button
            className="payments-new-check-backdrop"
            type="button"
            aria-label="Close candidate checks"
            onClick={() => setPaymentCheckPanelOpen(false)}
          />
          <aside className="payments-new-check-offcanvas" id="payments-new-check-offcanvas" aria-label="Candidate validation results">
            <header className="payments-new-check-offcanvas-header">
              <div>
                <span>RECIPIENT VALIDATION</span>
                <h2>Candidate checks</h2>
                <p>Six checks per recipient</p>
              </div>
              <button className="payments-new-check-offcanvas-close" type="button" onClick={() => setPaymentCheckPanelOpen(false)} aria-label="Close candidate checks">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </header>
            <div className="payments-new-check-offcanvas-body">
              {paymentChecksLoading ? (
                <div className="payments-new-check-state" role="status">
                  <span className="payments-new-check-loader" />
                  <strong>Checking recipients</strong>
                  <span>Comparing names, registration, and temp IDs against the candidate database.</span>
                </div>
              ) : paymentCheckError ? (
                <div className="payments-new-check-error" role="alert">{paymentCheckError}</div>
              ) : paymentCheckResults.length > 0 ? (
                <section className="payments-new-check-panel">
                  <div className="payments-new-check-kpis" aria-label="Matched results by check">
                    {paymentCheckKpis.map(({ key, label, matched, total }) => <div className={matched < total ? 'is-incomplete' : ''} key={key}>
                      <strong>{matched} / {total}</strong>
                      <span>{label}</span>
                    </div>)}
                  </div>
                  <div className="payments-new-check-legend" aria-label="Check order legend">
                    <span aria-hidden="true" />
                    <span>Recipient</span>
                    <div className="payments-new-check-legend-items">
                      {PAYMENT_CHECK_ITEMS.map(({ key, label }) => <span key={key}>{label}</span>)}
                    </div>
                  </div>
                  <div className="payments-new-check-list" role="list">
                    {paymentCheckResults.map((result) => {
                      const hasFailedCheck = PAYMENT_CHECK_ITEMS.some(({ key }) => getPaymentCheckStatusTone(result[key]) === 'danger')
                      const hasWarningCheck = !hasFailedCheck && PAYMENT_CHECK_ITEMS.some(({ key }) => getPaymentCheckStatusTone(result[key]) === 'warning')
                      return <article className={`payments-new-check-row${hasFailedCheck ? ' has-failure' : hasWarningCheck ? ' has-warning' : ''}`} key={result.row} role="listitem">
                        <span className="payments-new-check-row-number">{String(result.row).padStart(2, '0')}</span>
                        <div className="payments-new-check-recipient">
                          <strong className="payments-new-check-name">{result.name || 'Name unavailable'}</strong>
                          <button
                            className="payments-new-check-details-toggle"
                            type="button"
                            aria-expanded={expandedPaymentCheckRows.has(result.row)}
                            aria-controls={`payments-new-check-details-${result.row}`}
                            onClick={() => setExpandedPaymentCheckRows((current) => {
                              const next = new Set(current)
                              if (next.has(result.row)) next.delete(result.row)
                              else next.add(result.row)
                              return next
                            })}
                          >{expandedPaymentCheckRows.has(result.row) ? 'Hide details' : 'Details'}</button>
                        </div>
                        <div className="payments-new-check-items">
                          {PAYMENT_CHECK_ITEMS.map(({ key, label }) => {
                            const status = result[key]
                            return <span
                              className={`payments-new-check-tick is-${getPaymentCheckStatusTone(status)}`}
                              key={key}
                              role="img"
                              aria-label={`${label}: ${status}`}
                              title={`${label}: ${status}`}
                            >
                              <FontAwesomeIcon icon={getPaymentCheckStatusIcon(status)} aria-hidden="true" />
                            </span>
                          })}
                        </div>
                        {expandedPaymentCheckRows.has(result.row) && <div className="payments-new-check-details" id={`payments-new-check-details-${result.row}`}>
                          <div><span>Mobile</span><strong>{result.mobile || 'Unavailable'}</strong></div>
                          <div><span>Email</span><strong>{result.email || 'Unavailable'}</strong></div>
                          <div><span>Source expense IDs</span><strong>{result.expenseIds.length ? result.expenseIds.join(', ') : 'Unavailable'}</strong></div>
                          <div><span>Payout amount</span><strong>{result.sheetAmount !== null && result.sourceAmount !== null
                            ? `Sheet ₹${result.sheetAmount.toFixed(2)} / approved source ₹${result.sourceAmount.toFixed(2)}`
                            : 'Amount unavailable'}</strong></div>
                          <section className="payments-new-check-amounts">
                            <span>Approved amounts by expense ID</span>
                            {result.sourceExpenseAmounts.length ? <div className="payments-new-check-amount-table-wrap">
                              <table className="payments-new-check-amount-table">
                                <thead><tr><th>Expense ID</th><th>Approved amount</th></tr></thead>
                                <tbody>{result.sourceExpenseAmounts.map(({ id, amount }, index) => <tr key={`${id}-${index}`}>
                                  <td>#{id}</td>
                                  <td>{amount === null ? 'Unavailable' : `₹${amount.toFixed(2)}`}</td>
                                </tr>)}</tbody>
                              </table>
                            </div> : <strong>Expense IDs unavailable</strong>}
                          </section>
                          {PAYMENT_CHECK_ITEMS.map(({ key, label }) => (
                            <div key={key}><span>{label}</span><strong>{result[key]}</strong></div>
                          ))}
                        </div>}
                      </article>
                    })}
                  </div>
                </section>
              ) : (
                <div className="payments-new-check-state">No recipient checks are available.</div>
              )}
            </div>
          </aside>
        </>}
        maxWidth="1100px"
        fullScreen
        footer={<div className="payments-new-preview-footer">
          <div className="payments-new-preview-selected-total" aria-live="polite">
            <span>Selected total</span>
            <strong>₹{selectedPreviewAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div className="payments-new-preview-actions">
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setPreviewSheet(null)} disabled={previewLoading}>Back to sheets</button>
            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={downloadSelectedPreviewRows}
              disabled={previewLoading || !selectedPreviewExpenseIds.size}
            >
              <FontAwesomeIcon icon={faDownload} /> Download selected{selectedPreviewExpenseIds.size ? ` (${selectedPreviewExpenseIds.size})` : ''}
            </button>
            {activeStatus === 'ready_for_payment' && <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => updateSelectedPreviewRows('paid')}
              disabled={previewLoading || updatingSheetStatus || !selectedPreviewExpenseIds.size}
            >
              <FontAwesomeIcon icon={faCheck} /> Mark selected paid{selectedPreviewExpenseIds.size ? ` (${selectedPreviewExpenseIds.size})` : ''}
            </button>}
            {activeStatus === 'ready_for_payment' && <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={() => updateSelectedPreviewRows('reject')}
              disabled={previewLoading || updatingSheetStatus || !selectedPreviewExpenseIds.size}
            >
              <FontAwesomeIcon icon={faTimes} /> Reject selected{selectedPreviewExpenseIds.size ? ` (${selectedPreviewExpenseIds.size})` : ''}
            </button>}
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={downloadPreviewSheet}
              disabled={previewLoading || !previewRows.length}
            >
              <FontAwesomeIcon icon={faDownload} /> Download sheet
            </button>
          </div>
        </div>}
      >
        <div className={`payments-new-preview${paymentCheckPanelOpen ? ' has-check-panel' : ''}`}>
          {previewLoading ? (
            <div className="payments-new-empty" role="status">Generating payment sheet preview...</div>
          ) : previewError ? (
            <div className="payments-new-preview-error" role="alert">
              <span>{previewError}</span>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => openPaymentSheet(previewSheet.record, previewSheet.index)}>Retry</button>
            </div>
          ) : previewRows.length ? (
            <div className="payments-new-preview-workspace">
              <div className="payments-new-preview-meta">
                <strong>{previewRows.length} generated rows</strong>
                <span>{previewExpenses.length} source expenses</span>
                {isPaymentSheetDownloaded(previewSheet?.record) && <span className="payments-new-downloaded-hint">Downloaded previously</span>}
              </div>
              <div className="payments-new-preview-tabs" role="tablist" aria-label="Payment sheet preview views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewTab === 'generated'}
                  onClick={() => setPreviewTab('generated')}
                >Generated sheet</button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewTab === 'source'}
                  onClick={() => setPreviewTab('source')}
                >Source expenses</button>
              </div>
              {previewTab === 'generated' ? <div className="payments-new-preview-grid-wrap" role="tabpanel">
                <table className="payments-new-preview-grid">
                  <thead><tr>
                    <th className="payments-new-preview-row-number" aria-label="Row number">#</th>
                    <th className="payments-new-preview-select">
                      <label>
                        <input
                          ref={selectAllPreviewRef}
                          type="checkbox"
                          checked={allPreviewRowsSelected}
                          disabled={!selectablePreviewExpenseIds.length || updatingSheetStatus || activeStatus !== 'ready_for_payment'}
                          aria-label="Select all payment rows"
                          onChange={(event) => setSelectedPreviewExpenseIds((current) => {
                            const next = new Set(current)
                            selectablePreviewExpenseIds.forEach((id) => event.target.checked ? next.add(id) : next.delete(id))
                            return next
                          })}
                        />
                        Select all
                      </label>
                    </th>
                    {getSheetColumns(previewRows).map((column) => <th key={column}>{column}</th>)}
                  </tr></thead>
                  <tbody>{previewRows.map((row, rowIndex) => {
                    const expenseIds = getPaymentSheetRowExpenseIds(row, rowIndex, previewExpenses)
                    const isSelected = expenseIds.length > 0 && expenseIds.every((id) => selectedPreviewExpenseIds.has(id))
                    return <tr key={rowIndex}>
                      <th className="payments-new-preview-row-number" scope="row">{rowIndex + 1}</th>
                      <td className="payments-new-preview-select">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!expenseIds.length || updatingSheetStatus || activeStatus !== 'ready_for_payment'}
                          aria-label={`Select row ${rowIndex + 1} for payment`}
                          onChange={(event) => setSelectedPreviewExpenseIds((current) => {
                            const next = new Set(current)
                            expenseIds.forEach((id) => event.target.checked ? next.add(id) : next.delete(id))
                            return next
                          })}
                        />
                      </td>
                      {getSheetColumns(previewRows).map((column, columnIndex) => {
                        const value = Array.isArray(row) ? row[columnIndex] : row?.[column]
                        return <td key={column}>{value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                      })}
                    </tr>
                  })}</tbody>
                </table>
              </div> : <div className="payments-new-preview-grid-wrap" role="tabpanel" aria-label="Source expenses">
                <table className="payments-new-preview-grid payments-new-source-expenses-grid">
                  <thead><tr>
                    <th className="payments-new-preview-row-number" aria-label="Row number">#</th>
                    <th>Expense ID</th>
                    <th>Candidate</th>
                    <th>Mobile</th>
                    <th>Project</th>
                    <th>Location</th>
                    <th>Approved amount</th>
                  </tr></thead>
                  <tbody>{previewExpenses.map((expense, index) => {
                    const amount = parsePaymentAmount(getSheetRecordValue(expense, ['approved_amount', 'amount']))
                    return <tr key={`${getExpenseId(expense) || 'expense'}-${index}`}>
                      <th className="payments-new-preview-row-number" scope="row">{index + 1}</th>
                      <td>{getExpenseId(expense) || '—'}</td>
                      <td>{getPaymentPayloadValue(expense, PAYMENT_NAME_FIELDS) || '—'}</td>
                      <td>{getPaymentPayloadValue(expense, PAYMENT_MOBILE_FIELDS) || '—'}</td>
                      <td>{getSheetRecordValue(expense, ['merged_project_name', 'project_name', 'project']) || '—'}</td>
                      <td>{getSheetRecordValue(expense, ['merged_location_name', 'location_name', 'location']) || '—'}</td>
                      <td>{amount === null ? '—' : `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td>
                    </tr>
                  })}</tbody>
                </table>
              </div>}
            </div>
          ) : (
            <div className="payments-new-empty">The payment sheet service returned no rows.</div>
          )}
        </div>
      </Modal>

      <Modal
        title={attendancePreviewSheet ? getSheetLabel(attendancePreviewSheet.record, attendancePreviewSheet.index) : 'Attendance payment sheet'}
        isOpen={Boolean(attendancePreviewSheet)}
        onClose={() => {
          if (attendancePreviewLoading) return
          attendancePreviewRequestRef.current += 1
          setAttendancePreviewSheet(null)
        }}
        maxWidth="1100px"
        fullScreen
        footer={<div className="payments-new-preview-actions">
          <button className="btn btn-outline btn-sm" type="button" onClick={() => setAttendancePreviewSheet(null)} disabled={attendancePreviewLoading}>Back to sheets</button>
          {activeStatus === 'ready_for_payment' && <>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => updateSelectedAttendancePreviewRows('paid')} disabled={attendancePreviewLoading || updatingAttendanceSheetStatus || !selectedAttendancePreviewReferenceIds.size}>
              <FontAwesomeIcon icon={faCheck} /> Mark selected paid{selectedAttendancePreviewReferenceIds.size ? ` (${selectedAttendancePreviewReferenceIds.size})` : ''}
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => updateSelectedAttendancePreviewRows('rejected')} disabled={attendancePreviewLoading || updatingAttendanceSheetStatus || !selectedAttendancePreviewReferenceIds.size}>
              <FontAwesomeIcon icon={faTimes} /> Reject selected{selectedAttendancePreviewReferenceIds.size ? ` (${selectedAttendancePreviewReferenceIds.size})` : ''}
            </button>
          </>}
          <button className="btn btn-primary btn-sm" type="button" onClick={downloadAttendancePaymentSheet} disabled={attendancePreviewLoading || !attendancePreviewRows.length}>
            <FontAwesomeIcon icon={faDownload} /> Download sheet
          </button>
        </div>}
      >
        <div className="payments-new-preview-workspace">
          {attendancePreviewLoading ? (
            <div className="payments-new-empty" role="status">Loading attendance payment sheet...</div>
          ) : attendancePreviewError ? (
            <div className="payments-new-preview-error" role="alert">{attendancePreviewError}</div>
          ) : attendancePreviewRows.length ? (
            <>
              <div className="payments-new-preview-meta">
                <strong>{attendancePreviewRows.length} rows</strong>
                <span>{attendanceSource === 'core' ? 'Core team' : 'Consultant'} attendance</span>
              </div>
              <div className="payments-new-preview-grid-wrap">
                <table className="payments-new-preview-grid">
                  <thead><tr>
                    <th className="payments-new-preview-row-number">#</th>
                    {activeStatus === 'ready_for_payment' && <th className="payments-new-preview-select">
                      <label><input
                        ref={selectAllAttendancePreviewRef}
                        type="checkbox"
                        checked={allAttendancePreviewRowsSelected}
                        disabled={!selectableAttendancePreviewIds.length || attendancePreviewLoading || updatingAttendanceSheetStatus}
                        aria-label="Select all attendance rows"
                        onChange={(event) => setSelectedAttendancePreviewReferenceIds((current) => {
                          const next = new Set(current)
                          selectableAttendancePreviewIds.forEach((id) => event.target.checked ? next.add(id) : next.delete(id))
                          return next
                        })}
                      /> Select all</label>
                    </th>}
                    {getSheetColumns(attendancePreviewRows).map((column) => <th key={column}>{column}</th>)}
                  </tr></thead>
                  <tbody>{attendancePreviewRows.map((row, rowIndex) => <tr key={rowIndex}>
                    <th className="payments-new-preview-row-number" scope="row">{rowIndex + 1}</th>
                    {activeStatus === 'ready_for_payment' && <td className="payments-new-preview-select">
                      <input
                        type="checkbox"
                        checked={Boolean(getAttendancePaymentRowReferenceId(row, rowIndex, attendancePreviewRows)) && selectedAttendancePreviewReferenceIds.has(getAttendancePaymentRowReferenceId(row, rowIndex, attendancePreviewRows))}
                        disabled={!getAttendancePaymentRowReferenceId(row, rowIndex, attendancePreviewRows) || attendancePreviewLoading || updatingAttendanceSheetStatus}
                        aria-label={`Select attendance row ${rowIndex + 1} for payment`}
                        onChange={(event) => {
                          const referenceId = getAttendancePaymentRowReferenceId(row, rowIndex, attendancePreviewRows)
                          setSelectedAttendancePreviewReferenceIds((current) => {
                            const next = new Set(current)
                            if (event.target.checked) next.add(referenceId)
                            else next.delete(referenceId)
                            return next
                          })
                        }}
                      />
                    </td>}
                    {getSheetColumns(attendancePreviewRows).map((column, columnIndex) => {
                      const value = Array.isArray(row) ? row[columnIndex] : row?.[column]
                      return <td key={column}>{value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                    })}
                  </tr>)}</tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="payments-new-empty">This attendance sheet contains no preview rows.</div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isUploadPaymentsOpen}
        onClose={() => setIsUploadPaymentsOpen(false)}
        title="Upload payments"
        maxWidth="520px"
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsUploadPaymentsOpen(false)} disabled={globalUploadLoading}>Close</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={uploadPaymentsFile} disabled={globalUploadLoading || !globalUploadFile}>
              <FontAwesomeIcon icon={faUpload} /> {globalUploadLoading ? 'Uploading...' : 'Upload file'}
            </button>
          </div>
        )}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label className="form-label" htmlFor="global-payment-upload" style={{ margin: 0 }}>Payment file</label>
            <button type="button" className="btn btn-outline btn-sm" onClick={downloadPaymentUploadSample}>
              <FontAwesomeIcon icon={faDownload} /> Download sample
            </button>
          </div>
          <input
            id="global-payment-upload"
            className="form-control"
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={(event) => {
              setGlobalUploadFile(event.target.files?.[0] || null)
              setGlobalUploadError('')
              setGlobalUploadSuccess('')
            }}
          />
          {globalUploadFile && <div style={{ color: 'var(--text2)', fontSize: 13 }}>{globalUploadFile.name}</div>}
          {globalUploadError && <div className="upload-error" role="alert">{globalUploadError}</div>}
          {globalUploadSuccess && <div className="upload-status" role="status">{globalUploadSuccess}</div>}
        </div>
      </Modal>
    </div>
  )
}