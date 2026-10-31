import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faUpload, faCheck, faFileExcel, faTimes, faWindowMaximize, faWindowMinimize } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { Card, PageHeader, Modal } from '../../components/ui'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { useAuth } from '../../context/AuthContext'
import './Payments.css'
import './PaymentsNew.css'

const PAYMENT_CATEGORIES = ['Expenses', 'Food', 'Attendance']
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

const getPaymentSheetRowExpenseIds = (row, rowIndex, sourceExpenses) => {
  const rowIds = getPaymentSheetExpenseIds(row && typeof row === 'object' ? row : {})
  const rowId = getExpenseId(row)
  const directIds = rowId !== undefined && rowId !== null && rowId !== '' && !Array.isArray(rowId)
    ? [String(rowId)]
    : []
  const recipientKey = getSheetRecipientKey(row)
  const candidateExpenses = recipientKey
    ? sourceExpenses.filter((expense) => getSheetRecipientKey(expense) === recipientKey)
    : sourceExpenses
  const rowText = Object.values(row || {}).map((value) => (
    value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  )).join(' ')
  const rowLocation = normalizeSheetField(getSheetRecordValue(row, [
    'merged_location_name', 'mergedLocationName', 'location_name', 'locationName', 'location', 'district_name', 'district', 'venue',
  ]))
  const matchedByLocation = candidateExpenses.filter((expense) => {
    const location = normalizeSheetField(getSheetRecordValue(expense, [
      'merged_location_name', 'mergedLocationName', 'location_name', 'locationName', 'location', 'district_name', 'district', 'venue',
    ]))
    return location && (rowLocation ? location === rowLocation : normalizeSheetField(rowText).includes(location))
  })
  const candidateLocations = new Set(candidateExpenses.map((expense) => normalizeSheetField(getSheetRecordValue(expense, [
    'merged_location_name', 'mergedLocationName', 'location_name', 'locationName', 'location', 'district_name', 'district', 'venue',
  ]))).filter(Boolean))
  const matchingExpenses = matchedByLocation.length
    ? matchedByLocation
    : candidateLocations.size === 1
      ? candidateExpenses
      : []
  const matchingIds = matchingExpenses
    .map(getExpenseId)
    .filter((id) => id !== undefined && id !== null && id !== '')
    .map(String)
  const resolvedIds = [...new Set([...rowIds, ...directIds, ...matchingIds])]
  if (resolvedIds.length) return resolvedIds

  const sourceExpenseId = getExpenseId(sourceExpenses[rowIndex])
  return sourceExpenseId !== undefined && sourceExpenseId !== null && sourceExpenseId !== ''
    ? [String(sourceExpenseId)]
    : []
}

const getPaymentSheetRowAmount = (row) => {
  const value = getSheetRecordValue(row, ['payout_link_amount', 'payout_amount', 'amount', 'total_amount', 'total_payout'])
  const amount = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(amount) ? amount : 0
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
  amount: Number(expense.amount || 0),
  merged_project_id: expense.merged_project_id || expense.mergedProjectId || '',
  merged_project_name: expense.merged_project_name || expense.mergedProjectName || '',
  merged_location_id: getPaymentPayloadValue(expense, ['merged_location_id', 'mergedLocationId']),
  merged_location_name: getPaymentPayloadValue(expense, ['merged_location_name', 'mergedLocationName']),
})

const downloadPaymentSheet = (rows, record, index) => {
  if (!rows.length) return false

  const columns = getSheetColumns(rows)
  const data = Array.isArray(rows[0])
    ? rows
    : [columns, ...rows.map((row) => columns.map((column) => row?.[column] ?? ''))]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), 'Payment Sheet')
  const filename = String(getSheetLabel(record, index)).replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)
  XLSX.writeFile(workbook, `${filename || `expenses-payment-sheet-${index + 1}`}.xlsx`)
  return true
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
  const [activeStatus, setActiveStatus] = useState('ready_for_payment')
  const [sheetSearch, setSheetSearch] = useState('')
  const [sheetFromDate, setSheetFromDate] = useState('')
  const [sheetToDate, setSheetToDate] = useState('')
  const [appliedSheetFilters, setAppliedSheetFilters] = useState({ search: '', from_date: '', to_date: '' })
  const [sheetOffset, setSheetOffset] = useState(0)
  const [sheetLimit, setSheetLimit] = useState(10)
  const [sheetTotal, setSheetTotal] = useState(null)
  const [sheetHasMore, setSheetHasMore] = useState(false)
  const [paymentSheets, setPaymentSheets] = useState([])
  const [paymentSheetsLoading, setPaymentSheetsLoading] = useState(false)
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
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [selectedPreviewExpenseIds, setSelectedPreviewExpenseIds] = useState(new Set())

  const selectedPaymentSheets = useMemo(() => paymentSheets.filter((record) => {
    const selectionKey = getSheetSelectionKey(record)
    return selectionKey !== undefined && selectionKey !== null && selectedSheetReferenceIds.has(String(selectionKey))
  }), [paymentSheets, selectedSheetReferenceIds])

  const trackPaymentSheetDownload = async (record, expenseIds) => {
    const sheetId = getPaymentSheetId(record)
    const normalizedExpenseIds = [...new Set(expenseIds
      .filter((expenseId) => expenseId !== undefined && expenseId !== null && String(expenseId).trim() !== '')
      .map((expenseId) => String(expenseId).trim()))]
    if (!normalizedExpenseIds.length) return

    const response = await recruiterAPI.trackGlobalPaymentSheetDownload({
      expense_ids: normalizedExpenseIds,
      user_id: userId,
    })
    const payload = response?.data?.data ?? response?.data ?? {}
    const updatedFields = {
      downloaded: true,
      is_downloaded: true,
      downloaded_at: payload?.downloaded_at || payload?.downloadedAt || new Date().toISOString(),
    }
    const selectionKey = getSheetSelectionKey(record)
    setPaymentSheets((current) => current.map((item) => (
      (sheetId && String(getPaymentSheetId(item)) === String(sheetId))
        || getPaymentSheetExpenseIds(item).some((expenseId) => normalizedExpenseIds.includes(expenseId))
        ? { ...item, ...updatedFields }
        : item
    )))
    if (selectionKey !== undefined && selectionKey !== null) {
      setSelectedSheetDetails((current) => ({
        ...current,
        [String(selectionKey)]: { ...(current[String(selectionKey)] || record), ...updatedFields },
      }))
    }
    setPreviewSheet((current) => current && String(getPaymentSheetId(current.record)) === String(sheetId)
      ? { ...current, record: { ...current.record, ...updatedFields } }
      : current)
  }

  useEffect(() => {
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
  }, [activeStatus, selectedPaymentSheets, userId])

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
  const loadingSelectedSheetDetails = selectedPaymentSheets.filter((record) => (
    loadingSheetDetails.has(String(getSheetSelectionKey(record)))
  )).length

  const fetchPaymentSheets = useCallback(async () => {
    setPaymentSheetsLoading(true)
    setPaymentSheetsError('')
    try {
      const response = await recruiterAPI.getglobalfinalpaymentsheet({
        type: 'expenses',
        status: activeStatus,
        user_id: userId,
        ...(appliedSheetFilters.search ? { search: appliedSheetFilters.search } : {}),
        ...(appliedSheetFilters.from_date ? { from_date: appliedSheetFilters.from_date } : {}),
        ...(appliedSheetFilters.to_date ? { to_date: appliedSheetFilters.to_date } : {}),
        offset: sheetOffset,
        limit: sheetLimit,
      })
      const body = response?.data ?? {}
      const payload = body?.data ?? body
      const records = getPaymentSheetRecords(payload)
      const pagination = body?.pagination || payload?.pagination || {}
      const totalValue = pagination.total ?? pagination.total_records ?? pagination.total_count ?? payload?.total ?? body?.total
      const parsedTotal = Number(totalValue)
      const responseOffset = Number(pagination.offset ?? sheetOffset)
      setPaymentSheets(records)
      setSheetTotal(Number.isFinite(parsedTotal) ? parsedTotal : null)
      setSheetHasMore(Number.isFinite(parsedTotal)
        ? responseOffset + records.length < parsedTotal
        : records.length >= sheetLimit)
      setSelectedSheetReferenceIds(new Set())
    } catch (error) {
      console.error('Failed to load expense payment sheets:', error)
      setPaymentSheets([])
      setPaymentSheetsError('Unable to load payment sheets. Please try again.')
    } finally {
      setPaymentSheetsLoading(false)
    }
  }, [activeStatus, appliedSheetFilters, sheetLimit, sheetOffset, userId])

  useEffect(() => {
    if (activeCategory === 'Expenses') fetchPaymentSheets()
  }, [activeCategory, fetchPaymentSheets])

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
    setSelectedPreviewExpenseIds(new Set())
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
      const response = await recruiterAPI.generateTimingExpensePaymentSheet({
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

      const response = await recruiterAPI.generateTimingExpensePaymentSheet({
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
    const expenseIds = [...new Set(previewRows.flatMap((row, rowIndex) => {
      const rowExpenseIds = getPaymentSheetRowExpenseIds(row, rowIndex, previewExpenses)
      return rowExpenseIds.some((expenseId) => selectedPreviewExpenseIds.has(expenseId))
        ? rowExpenseIds
        : []
    }))]
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

  const downloadSelectedPreviewRows = async () => {
    const selectedRows = previewRows.filter((row, rowIndex) => (
      getPaymentSheetRowExpenseIds(row, rowIndex, previewExpenses)
        .some((expenseId) => selectedPreviewExpenseIds.has(expenseId))
    ))
    if (!selectedRows.length) {
      alert('error', 'No selected payment sheet rows are available to download')
      return
    }
    if (!downloadPaymentSheet(selectedRows, previewSheet?.record, previewSheet?.index)) {
      alert('error', 'No selected payment sheet rows are available to download')
      return
    }
    try {
      await trackPaymentSheetDownload(previewSheet?.record, [...selectedPreviewExpenseIds])
    } catch (error) {
      console.error('Failed to track selected payment sheet download:', error)
      alert('error', 'The file downloaded, but its download status could not be saved.')
    }
  }

  const downloadPreviewSheet = async () => {
    if (!downloadPaymentSheet(previewRows, previewSheet?.record, previewSheet?.index)) {
      alert('error', 'No generated payment sheet rows are available to download')
      return
    }
    try {
      const expenseIds = [
        ...previewExpenses.map(getExpenseId),
        ...getPaymentSheetExpenseIds(previewSheet?.record),
      ]
      await trackPaymentSheetDownload(previewSheet?.record, expenseIds)
    } catch (error) {
      console.error('Failed to track payment sheet download:', error)
      alert('error', 'The file downloaded, but its download status could not be saved.')
    }
  }

  const downloadPaymentUploadSample = () => {
    const now = new Date()
    const excelDate = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(1899, 11, 30)) / 86400000)
    const sampleRows = [
      [excelDate, 'Sample Contact 1', 1000, '', 'sample1@example.com', 'No', 'Yes', 'Consultant', 'Sample payout', 'Example payment row 1', 'SAMPLE-001', 'Example only', 'Do not use as a real payment'],
      [excelDate, 'Sample Contact 2', 1500, '', 'sample2@example.com', 'No', 'Yes', 'Consultant', 'Sample payout', 'Example payment row 2', 'SAMPLE-002', 'Example only', 'Do not use as a real payment'],
      [excelDate, 'Sample Contact 3', 2000, '', 'sample3@example.com', 'No', 'Yes', 'Consultant', 'Sample payout', 'Example payment row 3', 'SAMPLE-003', 'Example only', 'Do not use as a real payment'],
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([PAYMENT_UPLOAD_HEADERS, ...sampleRows])
    worksheet['!cols'] = [9, 27, 17, 20, 35, 24, 18, 12, 14, 64, 45, 24, 64].map((wch) => ({ wch }))
    worksheet.A2.z = 'dd-mm-yyyy'
    worksheet.A3.z = 'dd-mm-yyyy'
    worksheet.A4.z = 'dd-mm-yyyy'

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Sample')
    XLSX.writeFile(workbook, 'payment_upload_sample.xlsx')
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
  const selectedPreviewAmount = selectedPreviewRows.reduce((total, row) => total + getPaymentSheetRowAmount(row), 0)

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
            aria-disabled={category !== 'Expenses'}
            disabled={category !== 'Expenses'}
            onClick={() => setActiveCategory(category)}
          >
            {category}
            {category !== 'Expenses' && <span>Coming soon</span>}
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
            {!paymentSheetsLoading && paymentSheets.length > 0 && <div className="payments-new-pagination">
              <label className="payments-new-page-size">
                <span>Rows</span>
                <select
                  className="form-control form-control-sm"
                  value={sheetLimit}
                  onChange={(event) => {
                    setSheetOffset(0)
                    setSheetLimit(Number(event.target.value))
                  }}
                >
                  {[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <span className="payments-new-pagination-summary">
                Showing {sheetOffset + 1}-{sheetOffset + paymentSheets.length}{sheetTotal !== null ? ` of ${sheetTotal}` : ''}
              </span>
              <div className="payments-new-pagination-actions">
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={() => setSheetOffset((offset) => Math.max(0, offset - sheetLimit))}
                  disabled={sheetOffset === 0}
                >Previous</button>
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={() => setSheetOffset((offset) => offset + sheetLimit)}
                  disabled={!sheetHasMore}
                >Next</button>
              </div>
            </div>}
          </>
        ) : (
          <div className="payments-new-empty">{activeCategory} payments will be available here later.</div>
        )}
      </Card>

      {selectedPaymentSheets.length > 0 && <aside className="payments-new-selection-summary" aria-live="polite" aria-label="Selected payment summary">
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

      <Modal
        title={previewSheet ? getSheetLabel(previewSheet.record, previewSheet.index) : 'Payment sheet preview'}
        isOpen={Boolean(previewSheet)}
        onClose={() => { if (!previewLoading) setPreviewSheet(null) }}
        maxWidth="1100px"
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
        <div className="payments-new-preview">
          {previewLoading ? (
            <div className="payments-new-empty" role="status">Generating payment sheet preview...</div>
          ) : previewError ? (
            <div className="payments-new-preview-error" role="alert">
              <span>{previewError}</span>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => openPaymentSheet(previewSheet.record, previewSheet.index)}>Retry</button>
            </div>
          ) : previewRows.length ? (
            <>
              <div className="payments-new-preview-meta">
                <strong>{previewRows.length} generated rows</strong>
                <span>{previewExpenses.length} source expenses</span>
                {isPaymentSheetDownloaded(previewSheet?.record) && <span className="payments-new-downloaded-hint">Downloaded previously</span>}
              </div>
              <div className="payments-new-preview-grid-wrap">
                <table className="payments-new-preview-grid">
                  <thead><tr>
                    <th className="payments-new-preview-row-number" aria-label="Row number">#</th>
                    <th className="payments-new-preview-select">Select</th>
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
              </div>
            </>
          ) : (
            <div className="payments-new-empty">The payment sheet service returned no rows.</div>
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