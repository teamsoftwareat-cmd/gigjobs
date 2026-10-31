import { Fragment, useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArchive, faCheck, faDownload, faFileExcel, faIndianRupee, faPencilAlt, faTimes, faUsers } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Card, Modal, PageHeader, StatCard, Tag } from '../../components/ui'
import SearchableProjectSelect from '../../components/ui/SearchableProjectSelect'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { useAuth } from '../../context/AuthContext'
const TIMING_EXPENSE_CATEGORIES = ['Hotel', 'Travel', 'Food', 'Supplies', 'Rental', 'Others']
const EXPENSE_STATUSES = ['all', 'pending', 'approved', 'rejected', 'paid']
const TRAVEL_BOOKING_PLATFORMS = ['MakeMyTrip', 'IRCTC', 'Ixigo', 'Cleartrip', 'Yatra', 'Airline / hotel website', 'Travel agent']
const PAYMENT_CARD_OPTIONS = ['Indian Bank - XXXX', 'State Bank of India - XXXX', 'HDFC Bank - XXXX', 'ICICI Bank - XXXX', 'Other - XXXX']

const getExpenseId = (expense) => expense.id || expense.expense_id || expense.expenseId
const isRegisteredExpense = (expense) => [true, 1, '1', 'true'].includes(
  typeof expense?.registration === 'string' ? expense.registration.trim().toLowerCase() : expense?.registration
)
const getMergedProjectId = (expense) => expense.merged_project_id ?? expense.mergedProjectId
const getMergedProjectName = (expense) => expense.merged_project_name ?? expense.mergedProjectName
const hasMergedProject = (expense) => [getMergedProjectId(expense), getMergedProjectName(expense)]
  .every((value) => value !== null && value !== undefined && String(value).trim() !== '')
const getMergedLocationId = (expense) => expense.merged_location_id ?? expense.mergedLocationId
const getMergedLocationName = (expense) => expense.merged_location_name ?? expense.mergedLocationName
const hasMergedLocation = (expense) => [getMergedLocationId(expense), getMergedLocationName(expense)]
  .every((value) => value !== null && value !== undefined && String(value).trim() !== '')
const getPaymentSheetProjectKey = (expense) => {
  const projectId = getMergedProjectId(expense) || expense.project_id || expense.projectId
  if (projectId) return `id:${String(projectId).replace(/^proj_/i, '')}`
  const projectName = getMergedProjectName(expense) || expense.project_name || expense.projectName || expense.project
  return projectName ? `name:${normalizeProjectName(projectName)}` : ''
}
const getVendorName = (expense) => expense.vendor || expense.vendor_name || expense.vendorName || expense.supplier || expense.supplier_name || ''
const getNormalizedStatus = (expense) => {
  const status = String(expense.status || 'pending').toLowerCase()
  return status === 'approve' ? 'approved' : status === 'reject' ? 'rejected' : status
}
const isPaymentSheetGenerated = (expense) => [true, 1, '1', 'true'].includes(
  typeof expense?.generated_payment_sheet === 'string'
    ? expense.generated_payment_sheet.trim().toLowerCase()
    : expense?.generated_payment_sheet
)
const normalizeProjectExpenseSummary = (response, project) => {
  const payload = response?.data?.data || response?.data || {}
  const summary = payload.summary || payload.kpis || payload.totals || payload
  const statusNames = ['pending', 'approved', 'rejected', 'paid']
  const records = Array.isArray(payload) ? payload : payload.expenses || payload.items || payload.records || []
  const byStatus = Object.fromEntries(statusNames.map((status) => {
    const direct = summary[status] || payload[status] || {}
    const matchedRecords = records.filter((expense) => getNormalizedStatus(expense) === status)
    const count = Number(direct.count ?? direct.total_count ?? summary[`${status}_count`] ?? summary[`${status}Count`] ?? payload[`${status}_count`] ?? matchedRecords.length)
    const amount = Number(direct.amount ?? direct.total_amount ?? summary[`${status}_amount`] ?? summary[`${status}Amount`] ?? payload[`${status}_amount`] ?? matchedRecords.reduce((sum, expense) => sum + Number(expense.amount || 0), 0))
    return [status, { count, amount }]
  }))
  const totalCount = Number(payload.total_count ?? payload.totalCount ?? payload.expense_count ?? payload.count ?? statusNames.reduce((sum, status) => sum + byStatus[status].count, 0))
  const totalAmount = Number(payload.total_amount ?? payload.totalAmount ?? statusNames.reduce((sum, status) => sum + byStatus[status].amount, 0))
  return {
    id: project.id || project.project_id || project.projectId,
    name: project.name || project.project_name || project.projectName || project.title || project.id,
    byStatus,
    totalCount,
    totalAmount,
  }
}
const getCandidateValue = (candidate, fields) => {
  const sources = [candidate, candidate.candidate, candidate.user, candidate.candidate_information, candidate.candidateInformation, candidate.profile]
  for (const source of sources) {
    const value = fields.map((field) => source?.[field]).find((item) => item !== undefined && item !== null && item !== '')
    if (value !== undefined) return value
  }
  return ''
}
const getRegistrationId = (expense) => getCandidateValue(expense, ['registration_id', 'registrationId'])
const normalizeMobile = (value) => String(value || '').replace(/\D/g, '')
const isPaymentSheetMobileExcluded = (expense) => normalizeMobile(
  getCandidateValue(expense, ['mobile_number', 'mobile', 'mobile_no', 'phone', 'phone_number', 'whatsapp', 'contact'])
).slice(-10) === '7449091641'
const buildTimingExpensePaymentSheetPayload = (expenses, options = {}) => ({
  type: 'expenses',
  expenses: expenses.map((expense) => ({
    expense_id: getExpenseId(expense),
    registration_id: getRegistrationId(expense),
    name: getCandidateValue(expense, ['name', 'candidate_name', 'full_name', 'fullName']),
    mobile_number: getCandidateValue(expense, ['mobile_number', 'mobile', 'mobile_no', 'phone', 'phone_number', 'whatsapp', 'contact']),
    amount: Number(expense.approved_amount ?? expense.amount ?? 0),
    merged_project_id: getCandidateValue(expense, ['merged_project_id', 'mergedProjectId']),
    merged_project_name: getCandidateValue(expense, ['merged_project_name', 'mergedProjectName']),
    merged_location_id: getCandidateValue(expense, ['merged_location_id', 'mergedLocationId']),
    merged_location_name: getCandidateValue(expense, ['merged_location_name', 'mergedLocationName']),
  })),
  ...options,
})
const getPaymentSheetRowValue = (row, fields) => {
  const normalized = Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]))
  for (const field of fields) {
    const value = normalized[field.toLowerCase().replace(/[^a-z0-9]/g, '')]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}
const isPaymentSheetDateColumn = (column) => String(column).toLowerCase().replace(/[^a-z0-9]/g, '').includes('date')
const buildPaymentSheetBreakdown = (expenses) => {
  const groups = new Map()
  expenses.forEach((expense) => {
    const candidateId = getRegistrationId(expense)
      || getCandidateValue(expense, ['candidate_id', 'candidateId', 'user_id', 'userId'])
      || normalizeMobile(getCandidateValue(expense, ['mobile_number', 'mobile', 'mobile_no', 'phone', 'phone_number', 'whatsapp', 'contact']))
      || getCandidateValue(expense, ['name', 'candidate_name', 'full_name', 'fullName'])
      || getExpenseId(expense)
    const projectId = getMergedProjectId(expense) || getMergedProjectName(expense)
    const key = `${String(projectId)}::${String(candidateId)}`
    const group = groups.get(key) || {
      candidate: getCandidateValue(expense, ['name', 'candidate_name', 'full_name', 'fullName']) || 'Unnamed candidate',
      registrationId: getRegistrationId(expense),
      project: getMergedProjectName(expense) || 'Project unavailable',
      expenseCount: 0,
      amount: 0,
      expenses: [],
    }
    const amount = Number(expense.approved_amount ?? expense.amount ?? 0) || 0
    group.expenseCount += 1
    group.amount += amount
    group.expenses.push({ id: getExpenseId(expense), category: expense.category || 'Expense', amount })
    groups.set(key, group)
  })
  return [...groups.values()].sort((left, right) => left.project.localeCompare(right.project) || left.candidate.localeCompare(right.candidate))
}

const getDraftPaymentSheets = (payload) => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['draft_payment_sheets', 'draftPaymentSheets', 'payment_sheets', 'paymentSheets', 'sheets', 'items', 'records', 'results']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  return payload.data && payload.data !== payload ? getDraftPaymentSheets(payload.data) : []
}

const getDraftSheetName = (sheet, index) => sheet?.sheet_name || sheet?.sheetName || sheet?.name || sheet?.title || `Draft ${index + 1}`

const getDraftSheetRows = (sheet) => {
  let rows = sheet?.payment_sheet ?? sheet?.paymentSheet ?? sheet?.sheet_data ?? sheet?.sheetData ?? sheet?.rows ?? sheet?.data
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows) } catch { return [] }
  }
  if (Array.isArray(rows)) return rows
  if (Array.isArray(rows?.rows)) return rows.rows
  return []
}

const getDraftSheetSourceExpenses = (sheet) => {
  let expenses = sheet?.source_expenses ?? sheet?.sourceExpenses ?? sheet?.expenses ?? sheet?.expense_records ?? sheet?.expenseRecords
  if (typeof expenses === 'string') {
    try { expenses = JSON.parse(expenses) } catch { return [] }
  }
  return Array.isArray(expenses) ? expenses : []
}

const getDraftSheetColumns = (rows) => {
  if (rows.some(Array.isArray)) {
    const columnCount = Math.max(...rows.map((row) => Array.isArray(row) ? row.length : 0))
    return Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`)
  }
  return [...new Set(rows.flatMap((row) => row && typeof row === 'object' ? Object.keys(row) : []))]
}

const getDraftSheetExpenseIds = (sheet, rows) => {
  let source = sheet?.expense_ids ?? sheet?.expenseIds
  if (typeof source === 'string') {
    try { source = JSON.parse(source) } catch { source = source.split(',').map((id) => id.trim()).filter(Boolean) }
  }
  if (!Array.isArray(source)) {
    source = getDraftSheetSourceExpenses(sheet)
  }
  if (!Array.isArray(source)) source = rows
  return [...new Set(source.map((item) => typeof item === 'object' ? getExpenseId(item) : item).filter(Boolean).map(String))]
}

const normalizeMergeLocations = (response) => {
  const payload = response?.data?.data || response?.data || response
  const rows = Array.isArray(payload)
    ? payload
    : typeof payload === 'string' || typeof payload === 'number'
      ? [payload]
      : [
    payload?.suggestions,
    payload?.districts,
    payload?.locations,
    payload?.items,
    payload?.results,
    payload?.data?.suggestions,
    payload?.data?.districts,
    payload?.data?.locations,
    payload?.data?.items,
    payload?.data?.results,
    Array.isArray(payload?.data) ? payload.data : null,
  ].find((value) => Array.isArray(value) && value.length) || []
  const seen = new Set()

  return rows.map((item) => {
    const name = typeof item === 'string' || typeof item === 'number'
      ? String(item)
      : item?.name || item?.label || item?.district || item?.district_name || item?.location || item?.location_name || item?.title
    if (!name) return null
    const id = typeof item === 'object' && item !== null
      ? item.id || item.district_id || item.location_id || item.value || item._id || name
      : name
    return { id: String(id), name: String(name).trim() }
  }).filter((item) => {
    if (!item || !item.name || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const normalizeProjectMerges = (response) => {
  const payload = response?.data?.data || response?.data || response
  const rows = Array.isArray(payload) ? payload : [
    payload?.merges,
    payload?.project_merges,
    payload?.location_mappings,
    payload?.district_mappings,
    payload?.items,
    payload?.records,
    payload?.results,
    payload?.data?.merges,
    payload?.data?.project_merges,
    payload?.data?.location_mappings,
    payload?.data?.district_mappings,
    payload?.data?.items,
    payload?.data?.records,
    payload?.data?.results,
    Array.isArray(payload?.data) ? payload.data : null,
  ].find((value) => Array.isArray(value) && value.length) || []

  return rows.map((merge) => ({
    id: String(merge?.merge_id || merge?.project_merge_id || merge?.mapping_id || merge?.id || ''),
    timingLocationId: String(merge?.timing_location_id || merge?.timing_district_id || ''),
    timingLocationName: String(merge?.timing_location_name || merge?.timing_district_name || 'Timing location'),
    gigJobsLocationId: String(merge?.gigjobs_location_id || merge?.gigjobs_district_id || ''),
    gigJobsLocationName: String(merge?.gigjobs_location_name || merge?.gigjobs_district_name || 'GigJobs location'),
  })).filter((merge) => merge.id)
}

const normalizeProjectName = (name) => String(name || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
const normalizeProjectId = (id) => String(id || '').replace(/^proj_/i, '')
const isWrittenProject = (project) => {
  const writtenFlag = project?.is_written ?? project?.isWritten ?? project?.written_exam
  if (writtenFlag === true || writtenFlag === 1 || writtenFlag === '1') return true
  const kind = project?.mergeProjectType ?? project?.projectkind ?? project?.project_kind ?? project?.projectKind ?? project?.project_type ?? project?.projectType ?? project?.type ?? project?.kind
  return /written|exam/i.test(String(kind || project?.name || project?.project_name || project?.title || ''))
}

const getExpenseAttachments = (expense) => {
  const value = expense?.attachments || expense?.files || expense?.attachment || expense?.bill_url || expense?.attachment_url || []
  return (Array.isArray(value) ? value : [value]).filter(Boolean).map((item) => ({
    name: typeof item === 'string' ? item.split('/').pop() : item.name || item.filename || item.file_name || 'Attachment',
    url: typeof item === 'string' ? item : item.url || item.path || item.file_url || item.download_url || item.attachment_url || '',
  })).filter((item) => item.url)
}

const resolveAttachmentUrl = (url) => {
  if (/^(https?:|blob:|data:)/i.test(url)) return url
  const apiBase = 'https://cynosurejobs.net/gig_jobs_backend/gigjobs_cyno/public/api'
  return new URL(url.startsWith('/') ? url : `/${url}`, new URL(apiBase).origin).href
}

const createExpensesWorkbook = (expenses) => {
  const maxAttachments = Math.max(0, ...expenses.map((expense) => getExpenseAttachments(expense).length))
  const rows = expenses.map((expense) => {
    const row = {
      Expense: expense.title || expense.description || expense.category || 'Expense',
      Candidate: expense.name || expense.candidate_name || '—',
      Mobile: expense.mobile || expense.mobile_number || expense.phone || '—',
      Vendor: getVendorName(expense) || '—',
      Category: expense.category || '—',
      Project: expense.project_name || expense.project || expense.project_id || '—',
      Location: expense.location_name || expense.location || '—',
      Date: expense.date || expense.expense_date || '—',
      Amount: Number(expense.amount || 0),
      Status: expense.status || '—',
      Description: expense.description || expense.purpose || '—',
    }
    const attachments = getExpenseAttachments(expense)
    attachments.forEach((file, index) => {
      row[`Attachment ${index + 1}`] = { v: file.name, l: { Target: resolveAttachmentUrl(file.url) } }
    })
    for (let index = attachments.length; index < maxAttachments; index += 1) {
      row[`Attachment ${index + 1}`] = ''
    }
    return row
  })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Timing Expenses')
  return workbook
}

const safeFilename = (value) => String(value || 'expense').replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)

const createCandidateInvoicePdf = (candidate, expenses, invoiceNumber) => {
  const invoice = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = invoice.internal.pageSize.getWidth()
  const margin = 16
  const right = pageWidth - margin
  const muted = [92, 92, 92]
  const ink = [20, 20, 20]
  const categoryTotals = new Map()
  expenses.forEach((expense) => {
    const category = String(expense.category || 'Other').trim() || 'Other'
    const key = category.toLowerCase()
    const total = categoryTotals.get(key) || { category, count: 0, amount: 0 }
    total.count += 1
    total.amount += Number(expense.amount) || 0
    categoryTotals.set(key, total)
  })
  const categories = [...categoryTotals.values()]
  const totalAmount = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0)
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const formatCurrency = (amount) => `INR ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const drawRule = (y) => {
    invoice.setDrawColor(175, 175, 175)
    invoice.setLineWidth(0.25)
    invoice.line(margin, y, right, y)
  }

  invoice.setTextColor(...muted)
  invoice.setFont('helvetica', 'normal')
  invoice.setFontSize(7)
  invoice.text(invoiceNumber, margin, 13)
  invoice.text(`DATE: ${today}`, margin, 18)
  invoice.setTextColor(...ink)
  invoice.setFont('helvetica', 'bold')
  invoice.setFontSize(26)
  invoice.text('INVOICE', right, 24, { align: 'right' })
  drawRule(29)

  invoice.setFontSize(8)
  invoice.text('BILL TO', margin, 39)
  invoice.setFont('helvetica', 'bold')
  invoice.setFontSize(9)
  invoice.text('TIMING TECHNOLOGIES INDIA PRIVATE LIMITED', margin, 46)
  invoice.setFont('helvetica', 'normal')
  invoice.setFontSize(8)
  invoice.setTextColor(...muted)
  invoice.text([
    'West Wing Block No. 1, 3RD FLOOR, MY HOME HUB,',
    'SY NO. 79P AND 64P, MADHAPUR,',
    'Hyderbad',
    '500081 Telangana',
    'India',
    'GSTIN 36AAMCS7126C2ZB',
  ], margin, 52)

  autoTable(invoice, {
    startY: 78,
    head: [['CATEGORY', 'BILLS', 'AMOUNT']],
    body: categories.map((item) => [item.category, String(item.count), formatCurrency(item.amount)]),
    foot: [['TOTAL', String(expenses.length), formatCurrency(totalAmount)]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, textColor: ink, cellPadding: { top: 4, right: 2, bottom: 4, left: 2 } },
    headStyles: { fontStyle: 'bold', textColor: ink },
    footStyles: { fontStyle: 'bold', textColor: ink },
    columnStyles: { 1: { halign: 'center', cellWidth: 24 }, 2: { halign: 'right', cellWidth: 42 } },
    didParseCell: (data) => {
      if (data.section === 'head' || data.section === 'foot') data.cell.styles.lineWidth = { bottom: 0.25 }
    },
  })

  const paymentDetails = [
    ['ACCOUNT NAME', getCandidateValue(candidate, ['account_holder_name', 'bank_account_name', 'account_name', 'accountName'])],
    ['ACCOUNT NUMBER', getCandidateValue(candidate, ['account_no', 'account_number', 'bank_account_number', 'accountNumber'])],
    ['IFSC CODE', getCandidateValue(candidate, ['ifsc_code', 'ifsc', 'ifscCode'])],
  ].filter(([, value]) => value)
  const identityDetails = [
    ['PAN NUMBER', getCandidateValue(candidate, ['pan_no', 'pan_number', 'pan'])],
    ['AADHAAR NUMBER', getCandidateValue(candidate, ['aadhaar_number', 'aadhar_number', 'aadhaar_no', 'aadhar_no', 'aadhaar', 'aadhar'])],
  ].filter(([, value]) => value)
  const pageHeight = invoice.internal.pageSize.getHeight()
  const getSectionLayout = (items) => {
    if (!items.length) return null
    const columnWidth = (right - margin) / items.length
    const values = items.map(([label, value]) => ({
      label,
      lines: invoice.splitTextToSize(String(value), columnWidth - 5),
    }))
    const valueLineCount = Math.max(...values.map(({ lines }) => lines.length))
    return { values, columnWidth, height: 11 + valueLineCount * 4 }
  }
  const footerSections = [
    ['PAYMENT INFORMATION', getSectionLayout(paymentDetails)],
    ['IDENTIFICATION DETAILS', getSectionLayout(identityDetails)],
  ].filter(([, layout]) => layout)
  if (footerSections.length) {
    const footerContentHeight = footerSections.reduce((height, [, layout]) => height + layout.height, 0) + (footerSections.length - 1) * 3
    const footerTop = pageHeight - 17 - footerContentHeight - 6
    if (invoice.lastAutoTable.finalY + 8 > footerTop) invoice.addPage()
    drawRule(footerTop)
    let footerY = footerTop + 6
    footerSections.forEach(([title, layout], index) => {
      invoice.setFont('helvetica', 'bold')
      invoice.setFontSize(7)
      invoice.setTextColor(...ink)
      invoice.text(title, margin, footerY)
      footerY += 5
      layout.values.forEach(({ label, lines }, itemIndex) => {
        const x = margin + itemIndex * layout.columnWidth
        invoice.setFont('helvetica', 'normal')
        invoice.setFontSize(7)
        invoice.setTextColor(...muted)
        invoice.text(label, x, footerY)
        invoice.setFont('helvetica', 'bold')
        invoice.setFontSize(8)
        invoice.setTextColor(...ink)
        invoice.text(lines, x, footerY + 5)
      })
      footerY += 6 + Math.max(...layout.values.map(({ lines }) => lines.length)) * 4
      if (index < footerSections.length - 1) footerY += 3
    })
  }

  const pageCount = invoice.getNumberOfPages()
  if (pageCount > 1) {
    for (let page = 1; page <= pageCount; page += 1) {
      invoice.setPage(page)
      invoice.setFont('helvetica', 'normal')
      invoice.setFontSize(7)
      invoice.setTextColor(...muted)
      invoice.text(`${page} / ${pageCount}`, right, 289, { align: 'right' })
    }
  }
  return invoice.output('blob')
}

export default function TimingExpensesView({ onSwitchToGigjobs }) {
  const { user } = useAuth()
  const { alert } = useAlert()
  const [expenses, setExpenses] = useState([])
  const [projects, setProjects] = useState([])
  const [gigJobsProjects, setGigJobsProjects] = useState([])
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeProjectsLoading, setMergeProjectsLoading] = useState(false)
  const [mergeProjectsSaving, setMergeProjectsSaving] = useState(false)
  const [selectedTimingProjectId, setSelectedTimingProjectId] = useState('')
  const [selectedGigJobsProjectId, setSelectedGigJobsProjectId] = useState('')
  const [timingSourceLocations, setTimingSourceLocations] = useState([])
  const [gigJobsTargetLocations, setGigJobsTargetLocations] = useState([])
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState([])
  const [timingLocationBySuggestion, setTimingLocationBySuggestion] = useState({})
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [mergeConfirmed, setMergeConfirmed] = useState(false)
  const [mergeAutoMatchMessage, setMergeAutoMatchMessage] = useState('')
  const [mergeError, setMergeError] = useState('')
  const [existingProjectMerges, setExistingProjectMerges] = useState([])
  const [existingMergesLoading, setExistingMergesLoading] = useState(false)
  const [existingMergesError, setExistingMergesError] = useState('')
  const [existingMergesReloadKey, setExistingMergesReloadKey] = useState(0)
  const [unmergingProjectId, setUnmergingProjectId] = useState('')
  const [vendorOptions, setVendorOptions] = useState([])
  const [projectSummaries, setProjectSummaries] = useState([])
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileSearch, setMobileSearch] = useState('')
  const [project, setProject] = useState('')
  const [vendor, setVendor] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(5)
  const [total, setTotal] = useState(0)
  const [kpis, setKpis] = useState({
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
  })
  const [loading, setLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [paymentExpenseId, setPaymentExpenseId] = useState(null)
  const [paymentDraft, setPaymentDraft] = useState(null)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [selectedExpenses, setSelectedExpenses] = useState([])
  const [downloadInProgress, setDownloadInProgress] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportScope, setExportScope] = useState('selected')
  const [exportProgress, setExportProgress] = useState({ percent: 0, status: '' })
  const [paymentSheetOmissions, setPaymentSheetOmissions] = useState(null)
  const [paymentSheetReview, setPaymentSheetReview] = useState(null)
  const [paymentSheetReviewed, setPaymentSheetReviewed] = useState(false)
  const [paymentSheetConfirming, setPaymentSheetConfirming] = useState(false)
  const [paymentSheetReviewTab, setPaymentSheetReviewTab] = useState('sheet')
  const [paymentSheetAction, setPaymentSheetAction] = useState('')
  const [paymentSheetNameEditing, setPaymentSheetNameEditing] = useState(false)
  const [draftSheetsOpen, setDraftSheetsOpen] = useState(false)
  const [draftPaymentSheets, setDraftPaymentSheets] = useState([])
  const [selectedDraftSheetIndex, setSelectedDraftSheetIndex] = useState(null)
  const [draftSheetSearch, setDraftSheetSearch] = useState('')
  const [draftSheetFromDate, setDraftSheetFromDate] = useState('')
  const [draftSheetToDate, setDraftSheetToDate] = useState('')
  const [appliedDraftSheetFilters, setAppliedDraftSheetFilters] = useState({ search: '', from_date: '', to_date: '' })
  const [draftSheetOffset, setDraftSheetOffset] = useState(0)
  const [draftSheetLimit, setDraftSheetLimit] = useState(10)
  const [draftSheetTotal, setDraftSheetTotal] = useState(null)
  const [draftSheetHasMore, setDraftSheetHasMore] = useState(false)
  const [draftSheetsLoading, setDraftSheetsLoading] = useState(false)
  const [draftSheetsError, setDraftSheetsError] = useState('')
  const [draftSheetReviewed, setDraftSheetReviewed] = useState(false)
  const [draftSheetConfirming, setDraftSheetConfirming] = useState(false)
  const [draftSheetRegenerating, setDraftSheetRegenerating] = useState(false)

  const userId = user?.userId || 1

  const fetchDraftPaymentSheets = useCallback(async () => {
    setDraftSheetsLoading(true)
    setDraftSheetsError('')
    try {
      const response = await recruiterAPI.getglobaldraftpaymentsheet({
        type: 'expenses',
        user_id: userId,
        ...(appliedDraftSheetFilters.search ? { search: appliedDraftSheetFilters.search } : {}),
        ...(appliedDraftSheetFilters.from_date ? { from_date: appliedDraftSheetFilters.from_date } : {}),
        ...(appliedDraftSheetFilters.to_date ? { to_date: appliedDraftSheetFilters.to_date } : {}),
        offset: draftSheetOffset,
        limit: draftSheetLimit,
      })
      const body = response?.data ?? {}
      const payload = body?.data ?? body
      const sheets = getDraftPaymentSheets(payload)
      const pagination = body?.pagination || payload?.pagination || {}
      const totalValue = pagination.total ?? pagination.total_records ?? pagination.total_count ?? payload?.total ?? body?.total
      const parsedTotal = Number(totalValue)
      const responseOffset = Number(pagination.offset ?? draftSheetOffset)
      setDraftPaymentSheets(sheets)
      setDraftSheetTotal(Number.isFinite(parsedTotal) ? parsedTotal : null)
      setDraftSheetHasMore(Number.isFinite(parsedTotal)
        ? responseOffset + sheets.length < parsedTotal
        : sheets.length >= draftSheetLimit)
    } catch (error) {
      console.error('Failed to load draft payment sheets:', error)
      setDraftSheetsError('Unable to load draft payment sheets. Please try again.')
    } finally {
      setDraftSheetsLoading(false)
    }
  }, [appliedDraftSheetFilters, draftSheetLimit, draftSheetOffset, userId])

  useEffect(() => {
    if (draftSheetsOpen) fetchDraftPaymentSheets()
  }, [draftSheetsOpen, fetchDraftPaymentSheets])

  const openDraftPaymentSheets = () => {
    setDraftSheetsOpen(true)
    setSelectedDraftSheetIndex(null)
    setDraftSheetReviewed(false)
  }

  const selectedDraftSheet = draftPaymentSheets[selectedDraftSheetIndex]
  const selectedDraftRows = selectedDraftSheet ? getDraftSheetRows(selectedDraftSheet) : []
  const selectedDraftColumns = getDraftSheetColumns(selectedDraftRows)

  const regenerateDraftPaymentSheet = async (sheet = selectedDraftSheet, sheetIndex = selectedDraftSheetIndex) => {
    if (!sheet || sheetIndex === null || draftSheetRegenerating) return
    setDraftSheetRegenerating(true)
    try {
      const sheetId = sheet.id || sheet.sheet_id || sheet.sheetId || sheet.payment_sheet_id || sheet.paymentSheetId
      if (!sheetId) throw new Error('This draft payment sheet is missing its ID')
      const detailResponse = await recruiterAPI.getglobaldraftpaymentsheetdetails(sheetId, {
        type: 'expenses',
        user_id: userId,
      })
      const detailBody = detailResponse?.data ?? {}
      const detailPayload = detailBody?.data ?? detailBody
      const detailSheet = detailPayload?.sheet || detailPayload?.draft_payment_sheet || detailPayload?.draftPaymentSheet || detailPayload
      const selectedSheet = { ...sheet, ...(detailSheet && typeof detailSheet === 'object' ? detailSheet : {}) }
      const sheetRows = getDraftSheetRows(selectedSheet)
      const expenseIds = getDraftSheetExpenseIds(selectedSheet, sheetRows)
      const savedExpenses = getDraftSheetSourceExpenses(selectedSheet)
      if (!savedExpenses.length && !expenseIds.length) {
        throw new Error('This draft does not contain expense IDs to regenerate from')
      }
      const sourceExpenses = savedExpenses.length
        ? savedExpenses
        : await getPaymentSheetExpenseDetails(expenseIds.map((expenseId) => ({ expense_id: expenseId })))
      const response = await recruiterAPI.generateTimingExpensePaymentSheet(
        buildTimingExpensePaymentSheetPayload(sourceExpenses)
      )
      const rows = response?.data?.data
      if (!Array.isArray(rows)) throw new Error('Payment sheet service returned invalid data')
      setDraftPaymentSheets((current) => current.map((sheet, index) => (
        index === sheetIndex
          ? { ...selectedSheet, payment_sheet: rows, source_expenses: sourceExpenses }
          : sheet
      )))
      alert('success', 'Draft payment sheet regenerated')
    } catch (error) {
      console.error('Failed to regenerate draft payment sheet:', error)
      alert('error', error.message || 'Failed to regenerate draft payment sheet')
    } finally {
      setDraftSheetRegenerating(false)
    }
  }

  const downloadDraftPaymentSheet = () => {
    if (!selectedDraftRows.length || !selectedDraftColumns.length) {
      alert('error', 'This draft does not contain sheet rows to download')
      return
    }
    const data = Array.isArray(selectedDraftRows[0])
      ? selectedDraftRows
      : [selectedDraftColumns, ...selectedDraftRows.map((row) => selectedDraftColumns.map((column) => row?.[column] ?? ''))]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), 'Payment Sheet')
    XLSX.writeFile(workbook, `${safeFilename(getDraftSheetName(selectedDraftSheet, selectedDraftSheetIndex))}.xlsx`)
  }

  const confirmDraftPaymentSheet = async () => {
    if (!selectedDraftSheet || !selectedDraftRows.length || !draftSheetReviewed || draftSheetConfirming) return
    const sheetName = String(getDraftSheetName(selectedDraftSheet, selectedDraftSheetIndex)).trim()
    setDraftSheetConfirming(true)
    try {
      await recruiterAPI.confirmTimingExpensePaymentSheet({
        type: 'expenses',
        user_id: userId,
        status: 'ready_for_payment',
        sheet_name: sheetName,
        payment_sheet: selectedDraftRows,
        expense_ids: getDraftSheetExpenseIds(selectedDraftSheet, selectedDraftRows),
      })
      alert('success', 'Payment sheet confirmed as final and ready for payment')
      setDraftSheetReviewed(false)
      setSelectedDraftSheetIndex(null)
      await fetchDraftPaymentSheets()
    } catch (error) {
      alert('error', error.message || 'Failed to confirm payment sheet')
    } finally {
      setDraftSheetConfirming(false)
    }
  }

  const selectedTimingProject = projects.find((item) => String(item.id || item.project_id || item.projectId) === String(selectedTimingProjectId))
  const selectedGigJobsProject = gigJobsProjects.find((item) => String(item.id || item.project_id || item.projectId || item.value) === String(selectedGigJobsProjectId))
  const selectedProjectIsWritten = isWrittenProject(selectedGigJobsProject)
  const selectedLocationMappings = selectedSuggestionIds.map((suggestionId) => {
    const timingLocation = timingSourceLocations.find((item) => item.id === suggestionId)
    const gigJobsLocation = gigJobsTargetLocations.find((item) => item.id === timingLocationBySuggestion[suggestionId])
    return timingLocation && gigJobsLocation ? { timingLocation, gigJobsLocation } : null
  }).filter(Boolean)
  const locationMappingsComplete = selectedLocationMappings.length === selectedSuggestionIds.length
  const locationSelectionsComplete = (timingSourceLocations.length === 0 || selectedSuggestionIds.length > 0)
    && locationMappingsComplete

  const fetchTimingProjects = useCallback(async () => {
    try {
      const allProjects = []
      const pageSize = 10
      let offset = 0
      let pageCount = 0
      const seenPages = new Set()
      while (pageCount < 500) {
        const response = await recruiterAPI.getTimingExpenseProjects({ offset, limit: pageSize, user_id: userId })
        const payload = response?.data?.data || response?.data || {}
        const items = Array.isArray(payload) ? payload : payload.projects || payload.items || payload.data || []
        const pageSignature = items.map((item) => item.id || item.project_id || item.name || item.project_name).join('|') || JSON.stringify(items)
        if (!items.length || seenPages.has(pageSignature)) break
        seenPages.add(pageSignature)
        allProjects.push(...items)
        const totalProjects = Number(payload.pagination?.total ?? payload.pagination?.total_records ?? payload.total)
        if (Number.isFinite(totalProjects) ? allProjects.length >= totalProjects : items.length < pageSize) break
        offset += items.length
        pageCount += 1
      }
      setProjects(allProjects)
    } catch (error) {
      setProjects([])
      alert('error', 'Failed to load timing expense projects')
    }
  }, [alert, userId])

  useEffect(() => {
    if (!mergeModalOpen || !selectedTimingProjectId || !selectedGigJobsProjectId) {
      setExistingProjectMerges([])
      setExistingMergesError('')
      setExistingMergesLoading(false)
      return undefined
    }

    let active = true
    setExistingProjectMerges([])
    setExistingMergesError('')
    setExistingMergesLoading(true)
    recruiterAPI.getTimingExpenseProjectMerges({
      timing_project_id: selectedTimingProjectId,
      gigjobs_project_id: normalizeProjectId(selectedGigJobsProjectId),
      user_id: userId,
    })
      .then((response) => {
        if (active) setExistingProjectMerges(normalizeProjectMerges(response))
      })
      .catch((error) => {
        if (active) setExistingMergesError(error.message || 'Unable to load existing project merges')
      })
      .finally(() => {
        if (active) setExistingMergesLoading(false)
      })
    return () => { active = false }
  }, [mergeModalOpen, selectedTimingProjectId, selectedGigJobsProjectId, userId, existingMergesReloadKey])

  const openMergeProjects = async () => {
    setMergeModalOpen(true)
    setMergeProjectsLoading(true)
    setSelectedTimingProjectId('')
    setSelectedGigJobsProjectId('')
    setTimingSourceLocations([])
    setGigJobsTargetLocations([])
    setSelectedSuggestionIds([])
    setTimingLocationBySuggestion({})
    setMergeConfirmed(false)
    setMergeAutoMatchMessage('')
    setMergeError('')
    try {
      const results = await Promise.allSettled([
        recruiterAPI.getProjectSuggestions('', 1000, 'regular'),
        recruiterAPI.getProjectSuggestions('', 1000, 'written'),
      ])
      const projectItems = results.flatMap((result, index) => {
        if (result.status !== 'fulfilled') return []
        const payload = result.value?.data?.data || result.value?.data || {}
        const items = Array.isArray(payload) ? payload : payload.projects || payload.items || payload.results || payload.data || []
        const mergeProjectType = index === 1 ? 'written' : 'regular'
        return items.map((item) => ({ ...item, mergeProjectType }))
      })
      if (!projectItems.length && results.every((result) => result.status === 'rejected')) {
        throw results[0].reason || new Error('Unable to load GigJobs projects')
      }
      const uniqueProjects = new Map()
      projectItems.forEach((item) => {
        const id = String(item.id || item.project_id || item.projectId || item.value || '')
        if (id && !uniqueProjects.has(id)) uniqueProjects.set(id, item)
      })
      setGigJobsProjects([...uniqueProjects.values()])
    } catch (error) {
      setGigJobsProjects([])
      setMergeError('Failed to load GigJobs projects')
    } finally {
      setMergeProjectsLoading(false)
    }
  }

  const loadGigJobsLocations = async (projectItem) => {
    setGigJobsTargetLocations([])
    setSelectedSuggestionIds([])
    setTimingLocationBySuggestion({})
    setMergeAutoMatchMessage('')
    setMergeConfirmed(false)
    if (!projectItem) return
    setSuggestionsLoading(true)
    setMergeError('')
    try {
      const projectId = normalizeProjectId(projectItem.id || projectItem.project_id || projectItem.projectId || projectItem.value)
      const response = isWrittenProject(projectItem)
        ? await recruiterAPI.getProjectDistricts(projectId)
        : await recruiterAPI.getProjectLocations(projectId)
      setGigJobsTargetLocations(normalizeMergeLocations(response))
    } catch (error) {
      setMergeError(error.message || 'Unable to load GigJobs project locations')
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const loadTimingProjectLocations = async (projectItem) => {
    setTimingSourceLocations([])
    setSelectedSuggestionIds([])
    setTimingLocationBySuggestion({})
    setMergeConfirmed(false)
    if (!projectItem) return
    const embeddedLocations = normalizeMergeLocations(isWrittenProject(projectItem)
      ? projectItem.districts || projectItem.district_names || projectItem.district || projectItem.locations || projectItem.location_names || projectItem.location || projectItem.location_name
      : projectItem.locations || projectItem.location_names || projectItem.location || projectItem.location_name)
    if (embeddedLocations.length) {
      setTimingSourceLocations(embeddedLocations)
      return
    }
    setMergeError('This Timing project has no embedded location data available to map.')
  }

  const tryAutoMatchLocations = () => {
    const sourceCounts = new Map()
    const destinationCounts = new Map()
    const destinationByName = new Map()
    timingSourceLocations.forEach((item) => {
      const key = normalizeProjectName(item.name)
      if (key) sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1)
    })
    gigJobsTargetLocations.forEach((item) => {
      const key = normalizeProjectName(item.name)
      if (!key) return
      destinationCounts.set(key, (destinationCounts.get(key) || 0) + 1)
      destinationByName.set(key, item)
    })
    const matches = timingSourceLocations.flatMap((source) => {
      const key = normalizeProjectName(source.name)
      const destination = destinationByName.get(key)
      return key && sourceCounts.get(key) === 1 && destinationCounts.get(key) === 1 && destination
        ? [{ timingLocation: source, gigJobsLocation: destination }]
        : []
    })
    setSelectedSuggestionIds(matches.map(({ timingLocation }) => timingLocation.id))
    setTimingLocationBySuggestion(Object.fromEntries(matches.map(({ timingLocation, gigJobsLocation }) => [timingLocation.id, gigJobsLocation.id])))
    setMergeConfirmed(false)
    setMergeAutoMatchMessage(matches.length
      ? `${matches.length} exact match${matches.length === 1 ? '' : 'es'} found. Review unmatched locations manually.`
      : 'No unambiguous exact matches found. Map locations manually.')
  }

  const mergeSelectedProjects = async () => {
    if (!selectedTimingProject || !selectedGigJobsProject || !mergeConfirmed || !locationSelectionsComplete || mergeProjectsSaving) return
    setMergeProjectsSaving(true)
    setMergeError('')
    try {
      await recruiterAPI.mergeTimingExpenseProjects({
        timing_project_id: String(selectedTimingProject.id || selectedTimingProject.project_id || selectedTimingProject.projectId),
        gigjobs_project_id: normalizeProjectId(selectedGigJobsProject.id || selectedGigJobsProject.project_id || selectedGigJobsProject.projectId || selectedGigJobsProject.value),
        user_id: userId,
        ...(selectedProjectIsWritten
          ? { district_mappings: selectedLocationMappings.map(({ timingLocation, gigJobsLocation }) => ({
            gigjobs_district_id: gigJobsLocation.id,
            gigjobs_district_name: gigJobsLocation.name,
            timing_location_id: timingLocation.id,
            timing_location_name: timingLocation.name,
          })) }
          : { location_mappings: selectedLocationMappings.map(({ timingLocation, gigJobsLocation }) => ({
            gigjobs_location_id: gigJobsLocation.id,
            gigjobs_location_name: gigJobsLocation.name,
            timing_location_id: timingLocation.id,
            timing_location_name: timingLocation.name,
          })) }),
      })
      alert('success', `${getProjectLabel(selectedTimingProject)} merged into ${selectedGigJobsProject.name || selectedGigJobsProject.project_name || 'GigJobs project'}`)
      setMergeModalOpen(false)
      await fetchTimingProjects()
    } catch (error) {
      setMergeError(error.message || 'Failed to merge projects')
    } finally {
      setMergeProjectsSaving(false)
    }
  }

  const unmergeProject = async (merge) => {
    if (!merge.id || unmergingProjectId) return
    const confirmed = window.confirm(`Unmerge ${merge.timingLocationName} from ${merge.gigJobsLocationName}?`)
    if (!confirmed) return
    setUnmergingProjectId(merge.id)
    setExistingMergesError('')
    try {
      await recruiterAPI.unmergeTimingExpenseProject({ merge_id: merge.id, user_id: userId })
      setExistingProjectMerges((current) => current.filter((item) => item.id !== merge.id))
      alert('success', 'Project mapping removed')
    } catch (error) {
      setExistingMergesError(error.message || 'Unable to unmerge this project mapping')
    } finally {
      setUnmergingProjectId('')
    }
  }

  const fetchTimingExpenses = useCallback(async (requestedPage = 1) => {
    setLoading(true)
    try {
      const params = {
        offset: (requestedPage - 1) * limit,
        limit,
        ...(activeStatus !== 'all' ? { status: activeStatus } : {}),
        user_id: userId,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(mobileSearch.trim() ? { mobile_number: mobileSearch.trim() } : {}),
        ...(category ? { category } : {}),
        ...(project ? { project_id: project } : {}),
        ...(vendor ? { vendor } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(fromDate ? { from_date: fromDate } : {}),
        ...(toDate ? { to_date: toDate } : {}),
      }
      const response = await recruiterAPI.getTimingExpenses(params)
      const payload = response?.data?.data || response?.data || {}
      const items = Array.isArray(payload) ? payload : payload.expenses || payload.items || []
      const pagination = payload.pagination || {}
      setExpenses(items)
      setTotal(Number(pagination.total ?? payload.total ?? 0))
      setKpis(payload.kpis || {})
      setPage(Number(pagination.current_page || requestedPage))
    } catch (error) {
      setExpenses([])
      setTotal(0)
      alert('error', 'Failed to load timing expenses')
    } finally {
      setLoading(false)
    }
  }, [activeStatus, alert, category, fromDate, limit, location, mobileSearch, project, search, toDate, userId, vendor])

  useEffect(() => {
    fetchTimingProjects()
  }, [fetchTimingProjects])

  useEffect(() => {
    let isMounted = true
    recruiterAPI.getTimingExpenseVendors({ user_id: userId })
      .then((response) => {
        const payload = response?.data?.data || response?.data || {}
        const items = Array.isArray(payload) ? payload : payload.vendors || payload.items || payload.data || payload.vendor_list || []
        const names = items.map((item) => typeof item === 'string' ? item : getVendorName(item) || item.name || item.label || '')
          .filter(Boolean)
        if (isMounted) setVendorOptions([...new Set(names)])
      })
      .catch(() => {
        if (isMounted) setVendorOptions([])
      })
    return () => { isMounted = false }
  }, [userId])

  useEffect(() => {
    fetchTimingExpenses(1)
  }, [fetchTimingExpenses])

  useEffect(() => {
    let isMounted = true
    const loadProjectSummaries = async () => {
      if (!projects.length) {
        setProjectSummaries([])
        setOverviewLoading(false)
        return
      }
      setOverviewLoading(true)
      const summaries = []
      try {
        for (let start = 0; start < projects.length && isMounted; start += 3) {
          const batch = projects.slice(start, start + 3)
          const responses = await Promise.allSettled(batch.map((projectItem) => recruiterAPI.getTimingProjectExpenseSummary(
            projectItem.id || projectItem.project_id || projectItem.projectId,
            { user_id: userId }
          )))
          responses.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              summaries.push(normalizeProjectExpenseSummary(result.value, batch[index]))
            }
          })
          if (isMounted) setProjectSummaries([...summaries])
        }
      } finally {
        if (isMounted) setOverviewLoading(false)
      }
    }
    loadProjectSummaries()
    return () => { isMounted = false }
  }, [projects, userId])

  const openDetails = async (expense) => {
    setDetailsOpen(true)
    setSelectedExpense(expense)
    setDetailsLoading(true)
    try {
      const response = await recruiterAPI.getTimingExpenseDetails(getExpenseId(expense), { user_id: userId })
      setSelectedExpense(response?.data?.data?.expense || response?.data?.expense || response?.data || expense)
    } catch (error) {
      alert('error', 'Failed to load timing expense details')
    } finally {
      setDetailsLoading(false)
    }
  }

  const openPaymentDetails = (expense) => {
    const expenseId = getExpenseId(expense)
    if (!expenseId) {
      alert('error', 'Cannot save payment details without an expense ID')
      return
    }
    if (String(paymentExpenseId) === String(expenseId)) {
      setPaymentExpenseId(null)
      setPaymentDraft(null)
      return
    }
    setPaymentExpenseId(expenseId)
    const bookingPlatform = expense.booking_platform || expense.travel_booking_platform || ''
    setPaymentDraft({
      payment_mode: expense.payment_mode || expense.transaction_mode || '',
      booking_platform: TRAVEL_BOOKING_PLATFORMS.find((option) => option.toLowerCase() === bookingPlatform.toLowerCase()) || '',
      card_used: expense.card_used || expense.card_label || '',
      transaction_reference: expense.transaction_reference || expense.transaction_id || expense.utr_number || '',
    })
  }

  const savePaymentDetails = async (event, expense) => {
    event.preventDefault()
    if (paymentSaving || !paymentDraft) return
    if (!paymentDraft.payment_mode) {
      alert('error', 'Select a transaction mode before saving')
      return
    }
    const expenseId = getExpenseId(expense)
    if (!expenseId) {
      alert('error', 'Cannot save payment details without an expense ID')
      return
    }

    const paymentDetails = {
      expense_id: expenseId,
      user_id: userId,
      payment_mode: paymentDraft.payment_mode,
      booking_platform: paymentDraft.booking_platform,
      card_used: ['credit_card', 'debit_card'].includes(paymentDraft.payment_mode) ? paymentDraft.card_used : '',
      transaction_reference: paymentDraft.transaction_reference.trim(),
    }

    setPaymentSaving(true)
    try {
      await recruiterAPI.saveTimingExpensePaymentDetails(paymentDetails)
      setExpenses((current) => current.map((item) => String(getExpenseId(item)) === String(expenseId)
        ? { ...item, ...paymentDetails }
        : item))
      alert('success', 'Payment details saved')
      setPaymentExpenseId(null)
      setPaymentDraft(null)
    } catch (error) {
      alert('error', error.message || 'Failed to save payment details')
    } finally {
      setPaymentSaving(false)
    }
  }

  const buildExpenseParams = (offset = 0, requestedLimit = limit) => ({
    offset,
    limit: requestedLimit,
    ...(activeStatus !== 'all' ? { status: activeStatus } : {}),
    user_id: userId,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(mobileSearch.trim() ? { mobile_number: mobileSearch.trim() } : {}),
    ...(category ? { category } : {}),
    ...(project ? { project_id: project } : {}),
    ...(vendor ? { vendor } : {}),
    ...(location.trim() ? { location: location.trim() } : {}),
    ...(fromDate ? { from_date: fromDate } : {}),
    ...(toDate ? { to_date: toDate } : {}),
  })

  const loadAllFilteredExpenses = async () => {
    const batchSize = 10
    const allExpenses = []
    let offset = 0
    let pageCount = 0
    const seenPages = new Set()

    while (pageCount < 500) {
      const response = await recruiterAPI.getTimingExpenses(buildExpenseParams(offset, batchSize))
      const payload = response?.data?.data || response?.data || {}
      const batch = Array.isArray(payload) ? payload : payload.expenses || payload.items || []
      const pageSignature = batch.map((item) => getExpenseId(item) || `${item.project_id}-${item.date}-${item.amount}`).join('|') || JSON.stringify(batch)
      if (!batch.length || seenPages.has(pageSignature)) break
      seenPages.add(pageSignature)
      allExpenses.push(...batch)
      const reportedTotal = Number(payload.pagination?.total ?? payload.pagination?.total_records ?? payload.total)
      const percent = Number.isFinite(reportedTotal) && reportedTotal > 0
        ? Math.min(25, Math.round((allExpenses.length / reportedTotal) * 25))
        : Math.min(25, Math.ceil(pageCount / 4))
      setExportProgress({ active: true, percent, status: `Loading filtered expenses (${allExpenses.length}${Number.isFinite(reportedTotal) ? ` of ${reportedTotal}` : ''})...` })
      if (Number.isFinite(reportedTotal) ? allExpenses.length >= reportedTotal : batch.length < batchSize) break
      offset += batch.length
      pageCount += 1
    }
    return allExpenses
  }

  const getDetailedExpenses = async (source, progressStart = 10, progressEnd = 75) => {
    const detailed = []
    const concurrency = 5
    setExportProgress({ active: true, percent: progressStart, status: `Loading expense details (0 of ${source.length})...` })
    for (let start = 0; start < source.length; start += concurrency) {
      const batch = source.slice(start, start + concurrency)
      const details = await Promise.all(batch.map(async (expense) => {
        const id = getExpenseId(expense)
        if (!id) return expense
        try {
          const response = await recruiterAPI.getTimingExpenseDetails(id, { user_id: userId })
          const detail = response?.data?.data?.expense || response?.data?.expense || response?.data?.data || response?.data || {}
          return { ...expense, ...detail }
        } catch {
          return expense
        }
      }))
      detailed.push(...details)
      const percent = progressStart + Math.round((detailed.length / source.length) * (progressEnd - progressStart))
      setExportProgress({ active: true, percent, status: `Loading expense details (${detailed.length} of ${source.length})...` })
    }
    return detailed
  }

  const getPaymentSheetExpenseDetails = async (source) => {
    const detailed = []
    const batchSize = 5
    for (let start = 0; start < source.length; start += batchSize) {
      const batch = source.slice(start, start + batchSize)
      const details = await Promise.all(batch.map(async (expense) => {
        const expenseId = getExpenseId(expense)
        if (!expenseId) throw new Error('Cannot verify project merge without an expense ID')
        const response = await recruiterAPI.getTimingExpenseDetails(expenseId, { user_id: userId })
        const detail = response?.data?.data?.expense || response?.data?.expense || response?.data?.data || response?.data
        if (!detail || typeof detail !== 'object') throw new Error(`Unable to verify project merge for expense ${expenseId}`)
        const registrationId = getRegistrationId(expense) || getRegistrationId(detail)
        return {
          ...expense,
          ...detail,
          ...(registrationId ? { registration_id: registrationId } : {}),
        }
      }))
      detailed.push(...details)
      setExportProgress({
        active: true,
        percent: Math.round((detailed.length / source.length) * 35),
        status: `Checking project merges (${detailed.length} of ${source.length})...`,
      })
    }
    return detailed
  }

  const exportExpenses = async (source, filename) => {
    if (!source.length) {
      alert('info', 'No expenses to export')
      return
    }
    setDownloadInProgress(true)
    setExportProgress({ active: true, percent: 5, status: 'Preparing spreadsheet...' })
    try {
      const details = await getDetailedExpenses(source, 10, 85)
      setExportProgress({ active: true, percent: 92, status: 'Writing Excel workbook...' })
      XLSX.writeFile(createExpensesWorkbook(details), `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`)
      setExportProgress({ active: false, percent: 100, status: 'Spreadsheet downloaded.' })
      alert('success', 'Expenses exported successfully')
    } catch (error) {
      setExportProgress({ active: false, percent: 0, status: 'Export failed.' })
      alert('error', 'Failed to export expenses')
    } finally {
      setDownloadInProgress(false)
    }
  }

  const downloadExpensesZip = async (source, filename) => {
    if (!source.length) {
      alert('info', 'No expenses to download')
      return
    }
    setDownloadInProgress(true)
    setExportProgress({ active: true, percent: 3, status: 'Preparing ZIP archive...' })
    try {
      const details = await getDetailedExpenses(source, 8, 50)
      const zip = new JSZip()
      zip.file('timing-expenses.xlsx', XLSX.write(createExpensesWorkbook(details), { bookType: 'xlsx', type: 'array' }))
      const attachmentsFolder = zip.folder('Attachments')
      let attachmentCount = 0
      const allFiles = details.flatMap((expense) => getExpenseAttachments(expense).map((file) => ({ expense, file })))
      setExportProgress({ active: true, percent: 52, status: `Downloading attachments (0 of ${allFiles.length})...` })
      for (const [fileIndex, { expense, file }] of allFiles.entries()) {
        const response = await fetch(resolveAttachmentUrl(file.url))
        if (!response.ok) throw new Error(`Unable to download ${file.name}`)
        const folder = attachmentsFolder.folder(`${safeFilename(expense.name || expense.candidate_name || `expense-${fileIndex + 1}`)}-${safeFilename(getExpenseId(expense) || fileIndex + 1)}`)
        folder.file(`${String(fileIndex + 1).padStart(2, '0')}-${safeFilename(file.name)}`, await response.blob())
        attachmentCount += 1
        setExportProgress({ active: true, percent: 50 + Math.round((attachmentCount / allFiles.length) * 35), status: `Downloading attachments (${attachmentCount} of ${allFiles.length})...` })
      }
      if (!attachmentCount) attachmentsFolder.file('No attachments.txt', 'No attachments were available for these expenses.')
      setExportProgress({ active: true, percent: 87, status: 'Compressing ZIP archive...' })
      const archive = await zip.generateAsync({ type: 'blob' }, ({ percent }) => setExportProgress({ active: true, percent: 87 + Math.round(percent * 0.12), status: `Compressing ZIP archive (${Math.round(percent)}%)...` }))
      saveAs(archive, `${filename}-${new Date().toISOString().slice(0, 10)}.zip`)
      setExportProgress({ active: false, percent: 100, status: 'ZIP downloaded.' })
      alert('success', 'Expenses ZIP downloaded successfully')
    } catch (error) {
      setExportProgress({ active: false, percent: 0, status: 'ZIP download failed.' })
      alert('error', error.message || 'Failed to download expenses ZIP')
    } finally {
      setDownloadInProgress(false)
    }
  }

  const generateInvoices = async (source, filename) => {
    if (!source.length) {
      alert('info', 'No expenses available to invoice')
      return
    }
    setDownloadInProgress(true)
    try {
      setExportProgress({ active: true, percent: 5, status: 'Loading expense details...' })
      const details = await getDetailedExpenses(source, 10, 65)
      const grouped = new Map()
      details.forEach((expense) => {
        const candidateKey = getCandidateValue(expense, ['candidate_id', 'candidateId', 'user_id', 'userId'])
          || getCandidateValue(expense, ['mobile', 'mobile_number', 'mobile_no', 'phone'])
          || getCandidateValue(expense, ['name', 'candidate_name', 'full_name', 'fullName'])
          || getExpenseId(expense)
        const group = grouped.get(String(candidateKey)) || []
        group.push(expense)
        grouped.set(String(candidateKey), group)
      })

      const zip = new JSZip()
      let invoiceIndex = 0
      for (const candidateExpenses of grouped.values()) {
        const candidate = candidateExpenses[0]
        const name = getCandidateValue(candidate, ['name', 'candidate_name', 'full_name', 'fullName']) || 'Candidate'
        const candidateId = getCandidateValue(candidate, ['candidate_id', 'candidateId', 'user_id', 'userId'])
          || getCandidateValue(candidate, ['mobile', 'mobile_number', 'mobile_no', 'phone'])
          || getExpenseId(candidate)
        const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const invoiceNumber = `INV-${dateStamp}-${safeFilename(candidateId)}`
        const invoiceFilename = `${safeFilename(name)}-${safeFilename(candidateId)}-invoice.pdf`
        const invoicePdf = createCandidateInvoicePdf(candidate, candidateExpenses, invoiceNumber)
        if (grouped.size === 1) saveAs(invoicePdf, invoiceFilename)
        else zip.file(invoiceFilename, invoicePdf)
        invoiceIndex += 1
        setExportProgress({ active: true, percent: 65 + Math.round((invoiceIndex / grouped.size) * 20), status: `Generating candidate invoices (${invoiceIndex} of ${grouped.size})...` })
      }
      if (grouped.size > 1) {
        setExportProgress({ active: true, percent: 87, status: 'Packaging invoice PDFs...' })
        const archive = await zip.generateAsync({ type: 'blob' }, ({ percent }) => {
          setExportProgress({ active: true, percent: 87 + Math.round(percent * 0.12), status: `Creating invoice ZIP (${Math.round(percent)}%)...` })
        })
        saveAs(archive, `${filename}-${new Date().toISOString().slice(0, 10)}.zip`)
      }
      setExportProgress({ active: false, percent: 100, status: 'Invoices downloaded.' })
      alert('success', `${grouped.size} candidate invoice${grouped.size === 1 ? '' : 's'} generated`)
    } catch (error) {
      setExportProgress({ active: false, percent: 0, status: 'Invoice generation failed.' })
      alert('error', 'Failed to generate candidate invoices')
    } finally {
      setDownloadInProgress(false)
    }
  }

  const submitPaymentSheet = async (source, filename) => {
    if (!source.length) {
      alert('info', 'No expenses available for a payment sheet')
      return
    }

    setDownloadInProgress(true)
    setExportProgress({ active: true, percent: 10, status: 'Sending expenses to payment sheet service...' })
    try {
      const response = await recruiterAPI.generateTimingExpensePaymentSheet(buildTimingExpensePaymentSheetPayload(source))
      const rows = response?.data?.data
      if (!Array.isArray(rows)) throw new Error('Payment sheet service returned invalid data')
      setPaymentSheetReview({ rows, expenses: source, filename })
      setPaymentSheetReviewed(false)
      setPaymentSheetReviewTab('sheet')
      setPaymentSheetNameEditing(false)
      setPaymentSheetOmissions(null)
      setExportProgress({ active: false, percent: 100, status: 'Payment sheet generated. Review it before confirming.' })
      await fetchTimingExpenses(page)
      alert('success', 'Payment sheet generated and ready for review')
    } catch (error) {
      setExportProgress({ active: false, percent: 0, status: 'Payment sheet preparation failed.' })
      alert('error', error.message || 'Failed to generate payment sheet')
    } finally {
      setDownloadInProgress(false)
    }
  }

  const generatePaymentSheet = async (source, filename) => {
    const approvedSource = source.filter((expense) => getNormalizedStatus(expense) === 'approved')
    if (!approvedSource.length) {
      alert('info', 'No approved expenses available for a payment sheet')
      return
    }
    if (new Set(approvedSource.map(getPaymentSheetProjectKey).filter(Boolean)).size > 1) {
      alert('error', 'Generate one payment sheet at a time for expenses from a single project.')
      return
    }
    setDownloadInProgress(true)
    setExportProgress({ active: true, percent: 0, status: 'Checking expense registration and project merges...' })
    try {
      const verifiedExpenses = await getPaymentSheetExpenseDetails(approvedSource)
      if (new Set(verifiedExpenses.map(getPaymentSheetProjectKey).filter(Boolean)).size > 1) {
        alert('error', 'Generate one payment sheet at a time for expenses from a single project.')
        return
      }
      const eligibleExpenses = verifiedExpenses.filter((expense) => isRegisteredExpense(expense) && hasMergedProject(expense) && hasMergedLocation(expense) && !isPaymentSheetMobileExcluded(expense))
      const unregisteredCandidates = new Map()
      verifiedExpenses.filter((expense) => !isRegisteredExpense(expense)).forEach((expense, index) => {
        const name = getCandidateValue(expense, ['name', 'candidate_name', 'full_name', 'fullName']) || 'Unnamed candidate'
        const mobile = getCandidateValue(expense, ['mobile_number', 'mobile', 'mobile_no', 'phone', 'phone_number', 'whatsapp', 'contact'])
        const candidateId = getCandidateValue(expense, ['candidate_id', 'candidateId', 'registration_id', 'registrationId'])
        const key = String(String(mobile || '').replace(/\D/g, '') || candidateId || name || getExpenseId(expense) || index)
        if (!unregisteredCandidates.has(key)) unregisteredCandidates.set(key, { name, mobile })
      })
      const excludedMobileCandidates = new Map()
      verifiedExpenses.filter(isPaymentSheetMobileExcluded).forEach((expense) => {
        const name = getCandidateValue(expense, ['name', 'candidate_name', 'full_name', 'fullName']) || 'Unnamed candidate'
        const mobile = getCandidateValue(expense, ['mobile_number', 'mobile', 'mobile_no', 'phone', 'phone_number', 'whatsapp', 'contact'])
        const key = normalizeMobile(mobile)
        const candidate = excludedMobileCandidates.get(key) || { name, mobile, expenseIds: [] }
        candidate.expenseIds.push(getExpenseId(expense) || 'Unavailable')
        excludedMobileCandidates.set(key, candidate)
      })
      const unmergedProjects = new Map()
      verifiedExpenses.filter((expense) => !hasMergedProject(expense)).forEach((expense) => {
        const projectId = expense.project_id || expense.projectId || ''
        const projectName = expense.project_name || expense.projectName || expense.project || 'Unknown project'
        const key = String(projectId || projectName)
        if (!unmergedProjects.has(key)) unmergedProjects.set(key, { id: projectId, name: projectName })
      })
      const unmergedLocations = new Map()
      verifiedExpenses.filter((expense) => !hasMergedLocation(expense)).forEach((expense) => {
        const locationId = expense.location_id || expense.locationId || expense.district_id || expense.districtId || ''
        const locationName = expense.location_name || expense.locationName || expense.location || expense.district_name || expense.districtName || 'Unknown location'
        const projectName = expense.project_name || expense.projectName || expense.project || 'Unknown project'
        const key = String(locationId || `${projectName}:${locationName}`)
        if (!unmergedLocations.has(key)) unmergedLocations.set(key, { id: locationId, name: locationName, projectName })
      })
      if (eligibleExpenses.length !== verifiedExpenses.length) {
        setPaymentSheetOmissions({
          eligibleExpenses,
          unregisteredCandidates: [...unregisteredCandidates.values()],
          excludedMobileCandidates: [...excludedMobileCandidates.values()],
          unmergedProjects: [...unmergedProjects.values()],
          unmergedLocations: [...unmergedLocations.values()],
          filename,
        })
        return
      }
      setDownloadInProgress(false)
      await submitPaymentSheet(eligibleExpenses, filename)
    } catch (error) {
      setExportProgress({ active: false, percent: 0, status: 'Payment sheet generation stopped.' })
      alert('error', error.message || 'Unable to verify expense project merges')
    } finally {
      setDownloadInProgress(false)
    }
  }

  const confirmPaymentSheetGeneration = () => {
    if (!paymentSheetOmissions?.eligibleExpenses.length) return
    submitPaymentSheet(paymentSheetOmissions.eligibleExpenses, paymentSheetOmissions.filename)
  }

  const downloadReviewedPaymentSheet = () => {
    if (!paymentSheetReview?.rows.length || !paymentSheetColumns.length) return
    const csvColumns = paymentSheetColumns.filter((column) => !isPaymentSheetDateColumn(column))
    if (!csvColumns.length) return
    const dataRows = paymentSheetReview.rows.map((row) => csvColumns.map((column) => {
      const value = row?.[column]
      return value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : value
    })).filter((row) => row.some((value) => value !== ''))
    const csvRows = [csvColumns, ...dataRows]
    const worksheet = XLSX.utils.aoa_to_sheet(csvRows)
    const csv = XLSX.utils.sheet_to_csv(worksheet).replace(/(?:\r?\n)+$/, '')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `${safeFilename(paymentSheetReview.filename)}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const confirmReviewedPaymentSheet = async (status) => {
    if (!paymentSheetReview || !paymentSheetReview.rows.length || paymentSheetConfirming) return
    const sheetName = String(paymentSheetReview.filename || '').trim()
    if (!sheetName) {
      alert('error', 'Enter a name for this payment sheet')
      return
    }
    if (status === 'ready_for_payment' && !paymentSheetReviewed) return
    setPaymentSheetConfirming(true)
    setPaymentSheetAction(status)
    try {
      await recruiterAPI.confirmTimingExpensePaymentSheet({
        type: 'expenses',
        user_id: userId,
        status,
        sheet_name: sheetName,
        payment_sheet: paymentSheetReview.rows,
        expense_ids: paymentSheetReview.expenses.map(getExpenseId).filter(Boolean),
      })
      setPaymentSheetReview((current) => ({ ...current, savedStatus: status }))
      alert('success', status === 'draft' ? 'Payment sheet saved as draft' : 'Payment sheet confirmed as final and ready for payment')
      await fetchTimingExpenses(page)
    } catch (error) {
      alert('error', error.message || (status === 'draft' ? 'Failed to move payment sheet to draft' : 'Failed to confirm payment sheet'))
    } finally {
      setPaymentSheetConfirming(false)
      setPaymentSheetAction('')
    }
  }

  const toggleExpense = (expense) => {
    const id = getExpenseId(expense)
    if (!id) return
    setSelectedExpenses((current) => current.some((item) => String(getExpenseId(item)) === String(id))
      ? current.filter((item) => String(getExpenseId(item)) !== String(id))
      : [...current, expense])
  }

  const toggleCurrentPage = () => {
    const currentIds = expenses.map(getExpenseId).filter(Boolean).map(String)
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedExpenses.some((item) => String(getExpenseId(item)) === id))
    setSelectedExpenses((current) => allSelected
      ? current.filter((item) => !currentIds.includes(String(getExpenseId(item))))
      : [...current.filter((item) => !currentIds.includes(String(getExpenseId(item)))), ...expenses.filter((item) => currentIds.includes(String(getExpenseId(item))))])
  }

  const handleFilterChange = (setter, value) => {
    setter(value)
    setPage(1)
    setSelectedExpenses([])
  }

  const runExportAction = async (action, filename) => {
    if (downloadInProgress) return
    let isBulkLoad = false
    try {
      let source = selectedExpenses
      if (exportScope === 'all') {
        isBulkLoad = true
        setDownloadInProgress(true)
        setExportProgress({ active: true, percent: 0, status: 'Loading all filtered expenses...' })
        source = await loadAllFilteredExpenses()
        setDownloadInProgress(false)
      }
      await action(source, filename)
    } catch (error) {
      setExportProgress({ active: false, percent: 0, status: 'Export failed.' })
      alert('error', 'Failed to load filtered expenses')
    } finally {
      if (isBulkLoad) setDownloadInProgress(false)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const getProjectLabel = (item) => item.name || item.project_name || item.title || item.project || item.id
  const getLocationValues = (item) => {
    const rawLocations = item.locations || item.location_names || item.location || item.location_name || []
    const values = Array.isArray(rawLocations) ? rawLocations : [rawLocations]

    return values
      .map((value) => {
        if (typeof value === 'string' || typeof value === 'number') return String(value)
        return value?.name || value?.location_name || value?.location || value?.title || value?.id
      })
      .filter(Boolean)
  }
  const timingLocations = [...new Set(
    projects
      .filter((item) => !project || String(item.id || item.project_id) === String(project))
      .flatMap(getLocationValues)
  )]
  const vendors = vendorOptions
  const filteredProjectSummaries = projectSummaries.filter((summary) => summary.totalCount > 0)
  const attachments = getExpenseAttachments(selectedExpense || {})
  const paymentSheetSelectionHasMultipleProjects = new Set(selectedExpenses.map(getPaymentSheetProjectKey).filter(Boolean)).size > 1
  const paymentSheetBreakdown = paymentSheetReview ? buildPaymentSheetBreakdown(paymentSheetReview.expenses) : []
  const paymentSheetColumns = paymentSheetReview
    ? [...new Set(paymentSheetReview.rows.flatMap((row) => Object.keys(row || {})))]
      .filter((column) => !isPaymentSheetDateColumn(column))
    : []
  const detailFields = selectedExpense ? [
    ['Candidate', getCandidateValue(selectedExpense, ['name', 'candidate_name', 'full_name', 'fullName'])],
  ['Email', getCandidateValue(selectedExpense, ['email', 'email_id', 'email_address'])],
  ['Mobile', getCandidateValue(selectedExpense, ['mobile', 'mobile_number', 'mobile_no', 'phone'])],
    ['Vendor', getVendorName(selectedExpense)],
    ['Category', selectedExpense.category],
    ['Status', selectedExpense.status || 'pending'],
    ['Date', selectedExpense.date || selectedExpense.expense_date],
    ['Project', selectedExpense.project_name || selectedExpense.project || selectedExpense.project_id],
    ['Location', selectedExpense.location_name || selectedExpense.location],
    ['Hotel name', selectedExpense.hotel_name],
    ['Hotel location', selectedExpense.hotel_location],
    ['Hotel phone', selectedExpense.hotel_phone],
    ['Check-in', selectedExpense.checkin_date || selectedExpense.check_in_date],
    ['Check-out', selectedExpense.checkout_date || selectedExpense.check_out_date],
    ['Number of days', selectedExpense.num_days],
    ['Number of persons', selectedExpense.num_persons],
    ['Number of rooms', selectedExpense.num_rooms],
    ['Food from', selectedExpense.food_from_date],
    ['Food to', selectedExpense.food_to_date],
    ['Travel from', selectedExpense.travel_from || selectedExpense.travel_from_date],
    ['Travel to', selectedExpense.travel_to || selectedExpense.travel_to_date],
    ['Transport mode', selectedExpense.transport_mode],
    ['Purpose of travel', selectedExpense.purpose_of_travel],
    ['Ticket status', selectedExpense.ticket_status],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : []

  return (
    <div className="payments-page expenses-page expenses-timing-page">
      <PageHeader
        title="Timing Expenses"
        subtitle="View timing project expense submissions"
        action={<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={openDraftPaymentSheets}>
            <FontAwesomeIcon icon={faFileExcel} /> Open drafts
          </button>
          <button className="btn btn-outline btn-sm" type="button" onClick={openMergeProjects}>Merge projects</button>
          <button className="btn btn-secondary btn-sm" onClick={onSwitchToGigjobs}>Switch to Gigjobs Expenses</button>
        </div>}
      />

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          ['Pending Expenses', kpis.pending, faUsers, 'var(--yellow-light)', 'var(--saffron)'],
          ['Approved Expenses', kpis.approved, faCheck, 'var(--green-light)', 'var(--green)'],
          ['Rejected Expenses', kpis.rejected, faTimes, 'var(--red-light)', 'var(--red)'],
          ['Paid Expenses', kpis.paid, faIndianRupee, 'var(--blue-light)', 'var(--primary)'],
        ].map(([label, kpi, icon, background, color]) => (
          <StatCard
            key={label}
            label={label}
            value={`${kpi?.count || 0} · ₹ ${Number(kpi?.amount || 0).toLocaleString('en-IN')}`}
            icon={<FontAwesomeIcon icon={icon} />}
            iconStyle={{ background, color }}
          />
        ))}
      </div>

      <details className="timing-project-summary">
        <summary>
          <span>Expenses by project</span>
          <span>{overviewLoading ? 'Loading project totals...' : `${filteredProjectSummaries.length} projects`}</span>
        </summary>
        {overviewLoading ? (
          <p className="timing-project-summary-empty">Loading project totals...</p>
        ) : filteredProjectSummaries.length ? (
          <div className="timing-project-summary-scroll">
            <table className="expenses-table timing-project-summary-table">
              <thead><tr>
                <th>Project</th>
                {['pending', 'approved', 'rejected', 'paid'].map((status) => <th key={status}>{status[0].toUpperCase() + status.slice(1)}</th>)}
                <th>Total</th>
              </tr></thead>
              <tbody>{filteredProjectSummaries.map((summary) => <tr key={summary.id}>
                <th>{summary.name}</th>
                {['pending', 'approved', 'rejected', 'paid'].map((status) => <td key={status}>{summary.byStatus[status].count} · ₹{summary.byStatus[status].amount.toLocaleString('en-IN')}</td>)}
                <td><strong>{summary.totalCount}</strong> · ₹{summary.totalAmount.toLocaleString('en-IN')}</td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : (
          <p className="timing-project-summary-empty">No project expenses found.</p>
        )}
      </details>

      <div className="expenses-tabs" role="tablist" aria-label="Timing expense status">
        {EXPENSE_STATUSES.map((status) => (
          <button
            className={`tab-button ${activeStatus === status ? 'active' : ''}`}
            key={status}
            type="button"
            role="tab"
            aria-selected={activeStatus === status}
            onClick={() => handleFilterChange(setActiveStatus, status)}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && kpis[status]?.count !== undefined ? ` (${kpis[status].count})` : ''}
          </button>
        ))}
      </div>

      <div className="filter-controls timing-expense-filters" style={{ marginBlock: '2px', background: 'white', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <select className="form-control" value={category} onChange={(event) => handleFilterChange(setCategory, event.target.value)}>
          <option value="">All Categories</option>
          {TIMING_EXPENSE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="form-control" value={project} onChange={(event) => handleFilterChange(setProject, event.target.value)}>
          <option value="">All Projects</option>
          {projects.map((item) => <option key={item.id || item.project_id} value={item.id || item.project_id}>{getProjectLabel(item)}</option>)}
        </select>
        <select className="form-control" value={vendor} onChange={(event) => handleFilterChange(setVendor, event.target.value)}>
          <option value="">All Vendors</option>
          {vendors.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="form-control" value={location} onChange={(event) => handleFilterChange(setLocation, event.target.value)}>
          <option value="">All Locations</option>
          {timingLocations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input className="form-control" type="date" value={fromDate} aria-label="From date" onChange={(event) => handleFilterChange(setFromDate, event.target.value)} />
        <input className="form-control" type="date" value={toDate} aria-label="To date" onChange={(event) => handleFilterChange(setToDate, event.target.value)} />
        <input className="form-control" value={search} placeholder="Search candidate or expense" onChange={(event) => handleFilterChange(setSearch, event.target.value)} onKeyDown={(event) => event.key === 'Enter' && fetchTimingExpenses(1)} />
        <input className="form-control" value={mobileSearch} inputMode="numeric" placeholder="Search mobile number" aria-label="Search mobile number" onChange={(event) => handleFilterChange(setMobileSearch, event.target.value)} onKeyDown={(event) => event.key === 'Enter' && fetchTimingExpenses(1)} />
        <button className="btn btn-primary btn-sm" onClick={() => fetchTimingExpenses(1)} disabled={loading}>{loading ? 'Loading...' : 'Search'}</button>
      </div>

      <div className="expenses-content" style={{ background: 'white' }}>
        <div className="timing-expense-toolbar">
          <span>{selectedExpenses.length ? `${selectedExpenses.length} selected` : 'View and export expenses'}</span>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={downloadInProgress || loading}
            onClick={() => {
              setExportScope(selectedExpenses.length ? 'selected' : 'all')
              setExportProgress({ active: false, percent: 0, status: '' })
              setPaymentSheetOmissions(null)
              setPaymentSheetReview(null)
              setPaymentSheetReviewed(false)
              setExportModalOpen(true)
            }}
          >
            <FontAwesomeIcon icon={faDownload} /> Export / Download
          </button>
        </div>
        {loading ? <Card className="loading-state">Loading timing expenses...</Card> : expenses.length === 0 ? <Card className="empty-state">No timing expenses found</Card> : (
          <div className="expenses-list"><table className="expenses-table timing-expenses-table">
            <thead><tr>
              <th><input type="checkbox" checked={expenses.length > 0 && expenses.every((expense) => selectedExpenses.some((item) => String(getExpenseId(item)) === String(getExpenseId(expense))))} onChange={toggleCurrentPage} aria-label="Select all expenses on this page" /></th>
              <th>Expense</th><th>Candidate</th><th>Mobile</th><th>Category</th><th>Project</th><th>Location</th><th>Date</th><th>{activeStatus === 'approved' ? 'Approved Amount' : 'Amount'}</th><th>Status</th><th>Details</th>
            </tr></thead>
            <tbody>{expenses.map((expense) => <Fragment key={getExpenseId(expense)}>
              <tr className={isPaymentSheetGenerated(expense) ? 'is-payment-sheet-generated' : ''}>
                <td><input type="checkbox" checked={selectedExpenses.some((item) => String(getExpenseId(item)) === String(getExpenseId(expense)))} onChange={() => toggleExpense(expense)} aria-label={`Select ${expense.title || 'expense'}`} /></td>
                <td>{expense.title || expense.description || '—'}</td>
                <td>{expense.name || expense.candidate_name || '—'}</td>
                <td>{expense.mobile || expense.mobile_number || expense.phone || '—'}</td>
                <td>{expense.category || '—'}</td>
                <td>{expense.project_name || expense.project || expense.project_id || '—'}</td>
                <td>{expense.location_name || expense.location || '—'}</td>
                <td>{expense.date || expense.expense_date || '—'}</td>
                <td>₹ {Number(activeStatus === 'approved'
                  ? expense.approved_amount ?? expense.amount ?? 0
                  : expense.amount || 0).toLocaleString('en-IN')}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag>{expense.status || 'pending'}</Tag>
                    {isPaymentSheetGenerated(expense) && <span className="timing-payment-sheet-generated-label">Sheet generated</span>}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => openDetails(expense)}>View details</button>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => openPaymentDetails(expense)}>
                      {String(paymentExpenseId) === String(getExpenseId(expense)) ? 'Hide payment' : 'Payment details'}
                    </button>
                  </div>
                </td>
              </tr>
              {String(paymentExpenseId) === String(getExpenseId(expense)) && paymentDraft && <tr className="timing-payment-details-row">
                <td colSpan={11}>
                  <form className="timing-payment-details-form" onSubmit={(event) => savePaymentDetails(event, expense)}>
                    <label className="timing-payment-details-field">
                      Transaction mode *
                      <select className="form-control" value={paymentDraft.payment_mode} onChange={(event) => {
                        const payment_mode = event.target.value
                        setPaymentDraft({ ...paymentDraft, payment_mode, ...(payment_mode === 'credit_card' || payment_mode === 'debit_card' ? {} : { card_used: '' }) })
                      }} required>
                        <option value="">Select mode</option>
                        <option value="credit_card">Credit card</option>
                        <option value="debit_card">Debit card</option>
                        <option value="upi">UPI</option>
                        <option value="net_banking">Net banking</option>
                        <option value="cash">Cash</option>
                        <option value="wallet">Wallet</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    {['travel', 'hotel', 'accommodation'].includes(String(expense.category || '').toLowerCase()) && <label className="timing-payment-details-field">
                      Booking platform
                      <select className="form-control" value={paymentDraft.booking_platform} onChange={(event) => setPaymentDraft({ ...paymentDraft, booking_platform: event.target.value })}>
                        <option value="">Select platform</option>
                        {TRAVEL_BOOKING_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                      </select>
                    </label>}
                    {['credit_card', 'debit_card'].includes(paymentDraft.payment_mode) && <label className="timing-payment-details-field">
                      Card used
                      <select className="form-control" value={paymentDraft.card_used} onChange={(event) => setPaymentDraft({ ...paymentDraft, card_used: event.target.value })}>
                        <option value="">Select card</option>
                        {PAYMENT_CARD_OPTIONS.map((card) => <option key={card} value={card}>{card}</option>)}
                      </select>
                    </label>}
                    <label className="timing-payment-details-field">
                      Transaction / UPI reference
                      <input className="form-control" value={paymentDraft.transaction_reference} placeholder="Transaction ID, UTR, etc." onChange={(event) => setPaymentDraft({ ...paymentDraft, transaction_reference: event.target.value })} />
                    </label>
                    <div className="timing-payment-details-actions">
                      <button className="btn btn-primary btn-sm" type="submit" disabled={paymentSaving}>{paymentSaving ? 'Saving...' : 'Save payment details'}</button>
                    </div>
                  </form>
                </td>
              </tr>}
            </Fragment>)}</tbody>
          </table></div>
        )}
        <div className="pagination-footer timing-pagination" style={{ marginTop: 0 }}>
          <label className="timing-pagination-size">
            Show
            <select
              className="form-control form-control-sm"
              value={limit}
              onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            entries
          </label>
          <div className="pagination-summary">Showing {total ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total} entries</div>
          <div className="pagination-controls timing-pagination-controls">
            <button className="btn btn-outline btn-sm timing-pagination-wide" disabled={page <= 1 || loading} onClick={() => fetchTimingExpenses(page - 1)}>Previous</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, index) => { const pageNumber = Math.max(1, Math.min(totalPages - 4, page - 2)) + index; return <button key={pageNumber} className={`btn ${page === pageNumber ? 'btn-primary' : 'btn-outline'} btn-sm timing-pagination-number`} onClick={() => fetchTimingExpenses(pageNumber)}>{pageNumber}</button> })}
            <button className="btn btn-outline btn-sm timing-pagination-wide" disabled={page >= totalPages || loading} onClick={() => fetchTimingExpenses(page + 1)}>Next</button>
          </div>
        </div>
      </div>

      <style>{`
        .timing-merge-body { display: grid; gap: 14px; padding: 16px 18px 18px; color: #52655a; font-size: 12px; }
        .timing-merge-copy { margin: 0; color: #718178; font-size: 12px; line-height: 1.5; }
        .timing-merge-error { margin: 0; padding: 10px 12px; border: 1px solid #efd0cb; border-radius: 5px; background: #fff3f1; color: #a34e44; font-size: 12px; }
        .timing-merge-empty { margin: 0; padding: 8px; color: #809087; font-size: 11px; }
        .timing-merge-flow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(90px, .32fr) minmax(0, 1fr); align-items: center; gap: 10px; }
        .timing-merge-project { display: grid; min-width: 0; gap: 10px; padding: 13px; border: 1px solid #dce7df; border-radius: 6px; background: #f8faf8; }
        .timing-merge-project.is-source { border-top: 3px solid #739b83; }
        .timing-merge-project.is-destination { border-top: 3px solid #4d785e; background: #f5f8f3; }
        .timing-merge-project-heading { display: flex; align-items: center; gap: 9px; }
        .timing-merge-project-heading > span { display: grid; width: 27px; height: 27px; flex: 0 0 27px; place-items: center; border: 1px solid #d4e1d7; border-radius: 50%; color: #527060; font-size: 10px; font-weight: 700; }
        .timing-merge-project-heading div { display: grid; gap: 3px; }
        .timing-merge-project-heading small, .timing-merge-id { color: #809087; font-size: 10px; }
        .timing-merge-project-heading strong { color: #40564a; font-size: 12px; }
        .timing-merge-id { overflow-wrap: anywhere; }
        .timing-merge-connector { display: grid; grid-template-columns: minmax(8px, 1fr) auto minmax(8px, 1fr); align-items: center; gap: 5px; color: #66806f; text-align: center; }
        .timing-merge-connector span { font-size: 9px; white-space: nowrap; }
        .timing-merge-connector i { height: 1px; background: #9ab4a1; }
        .timing-merge-location-flow { display: grid; gap: 10px; padding: 13px; border: 1px solid #e2e9e0; border-radius: 6px; background: #fbfcfa; }
        .timing-merge-existing { display: grid; gap: 8px; padding: 13px; border: 1px solid #e2e9e0; border-radius: 6px; background: #fbfcfa; }
        .timing-merge-existing h3 { margin: 0; color: #40564a; font-size: 13px; font-weight: 600; }
        .timing-merge-existing-row { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px; border: 1px solid #e3eae4; border-radius: 5px; background: #fff; }
        .timing-merge-existing-row span { min-width: 0; overflow-wrap: anywhere; color: #40564a; font-size: 11px; }
        .timing-merge-existing-row .timing-merge-existing-arrow { color: #809087; }
        .timing-merge-existing-row button { white-space: nowrap; }
        .timing-merge-location-flow > header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .timing-merge-location-flow > header p { margin: 0 0 3px; color: #7b8a80; font-size: 9px; text-transform: uppercase; }
        .timing-merge-location-flow > header h3 { margin: 0; color: #40564a; font-size: 14px; font-weight: 600; }
        .timing-merge-tools { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
        .timing-merge-tools > span { padding: 4px 7px; border: 1px solid #dce7df; border-radius: 4px; color: #527060; font-size: 10px; white-space: nowrap; }
        .timing-merge-map-header, .timing-merge-map-row { display: grid; grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr); align-items: center; gap: 9px; min-width: 0; }
        .timing-merge-map-header { padding: 0 8px 2px; color: #718178; font-size: 9px; font-weight: 700; text-transform: uppercase; }
        .timing-merge-map-header span:nth-child(2) { text-align: center; }
        .timing-merge-map-list { display: grid; gap: 6px; }
        .timing-merge-map-row { padding: 7px 8px; border: 1px solid #e3eae4; border-radius: 5px; background: white; }
        .timing-merge-map-row.is-selected { border-color: #d9c89d; background: #fffdf8; }
        .timing-merge-map-row > label { display: flex; align-items: center; gap: 7px; min-width: 0; color: #40564a; font-size: 11px; cursor: pointer; }
        .timing-merge-map-row > label span { min-width: 0; overflow-wrap: anywhere; }
        .timing-merge-map-row input { flex: 0 0 auto; margin: 0; accent-color: #3e7650; }
        .timing-merge-map-row > i { height: 1px; background: #a7bca9; }
        .timing-merge-map-row select { width: 100%; min-width: 0; min-height: 32px; padding: 4px 7px; border: 1px solid #dbe5db; border-radius: 4px; background: #fff; color: #52655a; font: inherit; font-size: 10px; }
        .timing-merge-map-row select:disabled { background: #f3f5f2; color: #9aa59d; }
        .timing-merge-match { margin: 0; color: #9a752c; font-size: 11px; }
        .timing-merge-match.is-match { color: #3e7650; }
        .timing-merge-confirm { display: flex; align-items: flex-start; gap: 8px; color: #52655a; font-size: 11px; }
        .timing-merge-confirm input { margin: 1px 0 0; accent-color: #3e7650; }
        .timing-project-summary { margin: 0 0 20px; background: white; border: 1px solid var(--border-light); border-radius: 8px; }
        .timing-project-summary > summary { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; font-weight: 700; color: var(--text); }
        .timing-project-summary > summary span:last-child { color: var(--text3); font-size: 12px; font-weight: 500; }
        .timing-project-summary-scroll { overflow-x: auto; border-top: 1px solid var(--border-light); }
        .timing-project-summary-table { min-width: 760px; margin: 0; }
        .timing-project-summary-table th, .timing-project-summary-table td { padding: 10px 12px; white-space: nowrap; }
        .timing-project-summary-empty { margin: 0; padding: 16px; border-top: 1px solid var(--border-light); color: var(--text3); }
        .timing-expense-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--border-light); background: #f8faf9; color: var(--text3); font-size: 13px; }
        .timing-expenses-table { min-width: 1120px; }
        .timing-expenses-table tr.is-payment-sheet-generated > td { background: #eef7ef; }
        .timing-expenses-table tr.is-payment-sheet-generated > td:first-child { box-shadow: inset 3px 0 #35804b; }
        .timing-payment-sheet-generated-label { color: #347447; font-size: 10px; font-weight: 600; white-space: nowrap; }
        .timing-payment-details-row > td { padding: 0; background: var(--bg); }
        .timing-payment-details-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; padding: 16px; border-block: 1px solid var(--border-light); }
        .timing-payment-details-field { display: grid; align-content: start; gap: 6px; color: var(--text2); font-size: 12px; font-weight: 600; }
        .timing-payment-details-field small { color: var(--text3); font-size: 11px; font-weight: 400; }
        .timing-payment-details-actions { display: flex; align-items: end; gap: 8px; }
        .timing-expense-details { display: grid; gap: 18px; padding: 4px; }
        .timing-expense-details-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding: 18px; background: var(--bg); border: 1px solid var(--border-light); border-radius: 8px; }
        .timing-expense-details-kicker { margin: 0 0 6px; color: var(--text3); font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .timing-expense-details-header h2 { margin: 0 0 6px; font-size: 20px; line-height: 1.25; color: var(--text); }
        .timing-expense-details-id { margin: 0; color: var(--text3); font-size: 12px; }
        .timing-expense-details-amount { flex: 0 0 auto; display: grid; gap: 4px; padding: 10px 14px; border-left: 3px solid var(--green); background: white; }
        .timing-expense-details-amount span { color: var(--text3); font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .timing-expense-details-amount strong { color: var(--text); font-size: 19px; }
        .timing-expense-details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1px; overflow: hidden; background: var(--border-light); border: 1px solid var(--border-light); border-radius: 8px; }
        .timing-expense-details-field { min-width: 0; padding: 12px 14px; background: white; }
        .timing-expense-details-field dt { margin-bottom: 5px; color: var(--text3); font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .timing-expense-details-field dd { margin: 0; color: var(--text); font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
        .timing-expense-details-section { display: grid; gap: 8px; }
        .timing-expense-details-section h3 { margin: 0; color: var(--text); font-size: 13px; }
        .timing-expense-details-description { margin: 0; padding: 14px; color: var(--text2); background: var(--bg); border: 1px solid var(--border-light); border-radius: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
        .timing-expense-attachments { display: flex; flex-wrap: wrap; gap: 8px; }
        .timing-expense-attachment { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; }
        .timing-expense-attachment span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .timing-pagination { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px; }
        .timing-pagination-size { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; font-size: 13px; color: var(--text-secondary); }
        .timing-pagination-size select { width: 64px; }
        .timing-pagination-controls { display: flex; justify-content: flex-end; gap: 6px; flex-wrap: nowrap; }
        .timing-pagination-controls .timing-pagination-wide { width: 84px; min-width: 84px; }
        .timing-pagination-controls .timing-pagination-number { width: 36px; min-width: 36px; padding-inline: 0; }
        .timing-payment-review { display: grid; gap: 16px; }
        .draft-payment-sheets { display: flex; flex-direction: column; height: 100%; min-height: 0; color: var(--text); }
        .modal:has(.draft-payment-sheets) .modal-body { display: flex; flex-direction: column; overflow: hidden; padding: 0; }
        .draft-payment-sheets-state { display: grid; min-height: 220px; place-items: center; padding: 24px; color: var(--text-secondary); font-size: 13px; text-align: center; }
        .draft-payment-sheet-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); align-content: start; gap: 12px; height: 100%; overflow: auto; padding: 24px; }
        .draft-payment-sheet-filters { display: grid; grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(150px, 1fr)) auto; align-items: end; gap: 12px; padding: 14px; border-bottom: 1px solid var(--border-light); background: var(--bg-secondary); }
        .draft-payment-sheet-filters > input, .draft-payment-sheet-date .form-control { min-width: 0; min-height: 40px; }
        .draft-payment-sheet-date { display: grid; min-width: 0; gap: 5px; color: var(--text-secondary); font-size: 11px; font-weight: 600; }
        .draft-payment-sheet-filters > .btn { min-height: 40px; padding-inline: 18px; }
        .draft-payment-sheet-card { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; column-gap: 12px; row-gap: 8px; min-width: 0; min-height: 108px; padding: 15px; border: 1px solid var(--border-light); border-radius: 6px; background: var(--surface); color: var(--text); text-align: left; cursor: pointer; }
        .draft-payment-sheet-card:hover:not(:disabled) { border-color: var(--green); background: #f7faf7; }
        .draft-payment-sheet-card:disabled { cursor: wait; opacity: .65; }
        .draft-payment-sheet-card > svg { grid-column: 1; grid-row: 1 / 3; align-self: start; margin-top: 2px; color: var(--green); font-size: 20px; }
        .draft-payment-sheet-card-copy { display: grid; grid-column: 2; grid-row: 1; min-width: 0; gap: 5px; }
        .draft-payment-sheet-card-copy strong { display: -webkit-box; overflow: hidden; font-size: 13px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
        .draft-payment-sheet-card-copy small { color: var(--text-secondary); font-size: 11px; }
        .draft-payment-sheet-card-copy .draft-payment-sheet-moved-status.is-moved { color: var(--green); font-weight: 600; }
        .draft-payment-sheet-card-total { grid-column: 2; grid-row: 2; color: var(--text); font-size: 15px; font-weight: 700; }
        .draft-payment-sheet-card-open { grid-column: 3; grid-row: 1 / 3; align-self: center; padding-left: 8px; color: var(--primary); font-size: 11px; font-weight: 600; white-space: nowrap; }
        .draft-payment-sheet-pagination { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; padding: 12px 24px; border-top: 1px solid var(--border-light); }
        .draft-payment-sheet-page-size { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 12px; }
        .draft-payment-sheet-page-size select { width: 72px; }
        .draft-payment-sheet-page-summary { color: var(--text-secondary); font-size: 12px; text-align: center; }
        .draft-payment-sheet-page-actions { display: flex; gap: 8px; }
        .draft-payment-sheet-workspace { display: flex; flex: 1; flex-direction: column; min-height: 0; }
        .draft-payment-sheet-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--border-light); background: var(--surface); }
        .draft-payment-sheet-actions { display: flex; flex: 0 0 auto; justify-content: flex-end; gap: 8px; }
        .draft-payment-sheet-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; font-size: 12px; }
        .draft-payment-sheet-meta strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .draft-payment-sheet-meta span { flex: 0 0 auto; color: var(--text-secondary); }
        .draft-payment-sheet-grid-wrap { flex: 1; min-height: 220px; overflow: auto; border: 1px solid var(--border-light); background: var(--surface); }
        .draft-payment-sheet-grid { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
        .draft-payment-sheet-grid th, .draft-payment-sheet-grid td { min-width: 110px; max-width: 360px; padding: 8px 10px; border-right: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        .draft-payment-sheet-grid thead th { position: sticky; top: 0; z-index: 2; background: #e8f0e9; color: var(--text); font-weight: 600; }
        .draft-payment-sheet-grid .draft-payment-sheet-row-number { position: sticky; left: 0; z-index: 1; width: 42px; min-width: 42px; max-width: 42px; background: #f3f6f3; color: var(--text-secondary); text-align: center; font-weight: 500; }
        .draft-payment-sheet-grid thead .draft-payment-sheet-row-number { z-index: 3; background: #e1ebe2; }
        .draft-payment-sheet-grid tbody tr:nth-child(even) td { background: #fafcfa; }
        .draft-payment-sheet-ack { max-width: none; padding: 10px 12px; border-bottom: 1px solid var(--border-light); }
        .timing-payment-review-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .timing-payment-review-stat { display: grid; gap: 4px; min-width: 0; padding: 12px 14px; border: 1px solid var(--border-light); border-left: 3px solid var(--green); border-radius: 6px; background: var(--bg); }
        .timing-payment-review-stat span { color: var(--text3); font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .timing-payment-review-stat strong { color: var(--text); font-size: 17px; overflow-wrap: anywhere; }
        .timing-payment-review-tabs { display: inline-flex; gap: 3px; width: fit-content; padding: 3px; border: 1px solid var(--border-light); border-radius: 6px; background: var(--bg); }
        .timing-payment-review-tabs button { padding: 7px 12px; border: 0; border-radius: 4px; background: transparent; color: var(--text2); font: inherit; font-size: 12px; cursor: pointer; }
        .timing-payment-review-tabs button[aria-selected="true"] { background: white; color: var(--text); font-weight: 700; box-shadow: 0 1px 3px var(--shadow); }
        .timing-payment-review-section { display: grid; gap: 8px; min-width: 0; }
        .timing-payment-review-section > header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .timing-payment-review-section h3 { margin: 0; color: var(--text); font-size: 14px; }
        .timing-payment-review-section header span { color: var(--text3); font-size: 11px; }
        .timing-payment-review-table-wrap { max-height: min(48vh, 480px); overflow: auto; border: 1px solid var(--border-light); border-radius: 6px; background: white; }
        .timing-payment-review-table { width: max-content; min-width: 100%; margin: 0; }
        .timing-payment-review-table thead th { position: sticky; top: 0; z-index: 1; background: var(--bg); }
        .timing-payment-review-table tbody td { max-width: 340px; }
        .timing-payment-review-table .is-amount { text-align: right; white-space: nowrap; }
        .timing-payment-review-table tfoot th { position: sticky; bottom: 0; z-index: 1; background: var(--bg); border-top: 1px solid var(--border-light); }
        .timing-payment-review-expenses { display: grid; gap: 3px; min-width: 180px; }
        .timing-payment-review-expenses span { color: var(--text2); font-size: 11px; }
        .timing-payment-review-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; }
        .timing-payment-review-ack { display: flex; align-items: flex-start; gap: 8px; max-width: 470px; color: var(--text2); font-size: 12px; line-height: 1.4; }
        .timing-payment-review-ack input { flex: 0 0 auto; margin: 2px 0 0; accent-color: var(--green); }
        .timing-payment-review-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .timing-payment-omissions { display: grid; gap: 16px; }
        .timing-payment-omissions-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
        .timing-payment-omissions-stat { display: grid; gap: 4px; min-width: 0; padding: 11px 13px; border: 1px solid var(--border-light); border-top: 3px solid var(--green); border-radius: 6px; background: var(--bg); }
        .timing-payment-omissions-stat.is-excluded { border-top-color: var(--saffron); }
        .timing-payment-omissions-stat span { color: var(--text3); font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .timing-payment-omissions-stat strong { color: var(--text); font-size: 17px; }
        .timing-payment-omissions-section { display: grid; gap: 8px; min-width: 0; }
        .timing-payment-omissions-section > header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .timing-payment-omissions-section h3 { margin: 0; color: var(--text); font-size: 14px; }
        .timing-payment-omissions-section > header span { color: var(--text3); font-size: 12px; }
        .timing-payment-omissions-table-wrap { max-height: 330px; overflow: auto; border: 1px solid var(--border-light); border-radius: 6px; background: white; }
        .timing-payment-omissions-table { min-width: 720px; margin: 0; }
        .timing-payment-omissions-table thead th { position: sticky; top: 0; z-index: 1; background: var(--bg); }
        .timing-payment-omissions-table .is-amount { text-align: right; white-space: nowrap; }
        .timing-payment-omissions-table tfoot th { position: sticky; bottom: 0; background: var(--bg); border-top: 1px solid var(--border-light); }
        .timing-payment-omissions-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
        .timing-payment-omissions-group { display: grid; align-content: start; gap: 8px; min-width: 0; padding: 12px; border: 1px solid var(--border-light); border-radius: 6px; background: white; }
        .timing-payment-omissions-group h3 { margin: 0; color: var(--text); font-size: 13px; }
        .timing-payment-omissions-list { display: grid; gap: 0; max-height: 180px; overflow: auto; margin: 0; padding: 0; list-style: none; }
        .timing-payment-omissions-list li { padding: 8px 0; border-top: 1px solid var(--border-light); color: var(--text2); font-size: 12px; overflow-wrap: anywhere; }
        .timing-payment-omissions-list li:first-child { border-top: 0; }
        .timing-payment-omissions-list small { display: block; margin-top: 3px; color: var(--text3); font-size: 11px; }
        .timing-payment-omissions-empty { margin: 0; padding: 10px; border: 1px dashed var(--border-light); border-radius: 5px; color: var(--text3); font-size: 12px; text-align: center; }
        .timing-payment-omissions-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
        .timing-payment-omissions-footer > div { display: flex; gap: 8px; }
        @media (max-width: 700px) {
          .timing-merge-flow { grid-template-columns: 1fr; }
          .timing-merge-connector { width: min(100%, 220px); margin: 0 auto; }
          .timing-merge-location-flow > header { align-items: flex-start; flex-direction: column; }
          .timing-merge-tools { width: 100%; justify-content: space-between; flex-wrap: wrap; }
          .timing-merge-existing-row { grid-template-columns: minmax(0, 1fr) auto; }
          .timing-merge-existing-row .timing-merge-existing-arrow { display: none; }
          .timing-merge-existing-row button { grid-column: 1 / -1; justify-self: end; }
          .timing-merge-map-header { display: none; }
          .timing-merge-map-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
          .timing-merge-map-row > i { width: 1px; height: 14px; justify-self: center; }
          .timing-expense-toolbar { align-items: stretch; flex-direction: column; }
          .timing-expense-details-header { flex-direction: column; gap: 12px; }
          .timing-expense-details-amount { width: 100%; }
          .timing-pagination { grid-template-columns: 1fr 1fr; }
          .timing-pagination .pagination-summary { grid-column: 1 / -1; grid-row: 1; }
          .timing-pagination-controls { grid-column: 1 / -1; grid-row: 3; justify-content: flex-start; overflow-x: auto; padding-bottom: 2px; }
          .timing-payment-review-summary { grid-template-columns: 1fr; }
          .draft-payment-sheet-cards { grid-template-columns: 1fr; padding: 16px; }
          .draft-payment-sheet-filters { grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px; }
          .draft-payment-sheet-filters > input { grid-column: 1 / -1; }
          .draft-payment-sheet-filters > .btn { grid-column: 1 / -1; justify-self: start; }
          .draft-payment-sheet-pagination { grid-template-columns: 1fr auto; padding: 12px 16px; }
          .draft-payment-sheet-page-summary { grid-column: 1 / -1; grid-row: 1; text-align: left; }
          .draft-payment-sheet-page-actions { justify-self: end; }
          .draft-payment-sheet-toolbar { align-items: flex-start; flex-direction: column; }
          .draft-payment-sheet-actions { justify-content: flex-start; flex-wrap: wrap; }
          .timing-payment-review-footer { align-items: stretch; flex-direction: column; }
          .timing-payment-review-ack { max-width: none; }
          .timing-payment-review-actions { display: grid; grid-template-columns: 1fr 1fr; }
          .timing-payment-review-actions .timing-payment-review-close { grid-column: 1 / -1; }
          .timing-payment-omissions-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .timing-payment-omissions-groups { grid-template-columns: 1fr; }
          .timing-payment-omissions-footer { align-items: stretch; flex-direction: column; }
          .timing-payment-omissions-footer > div { display: grid; grid-template-columns: 1fr 1fr; }
          .timing-payment-omissions-footer > .btn-primary { order: -1; }
        }
        @media (max-width: 420px) {
          .draft-payment-sheet-filters { grid-template-columns: 1fr; }
          .draft-payment-sheet-filters > input, .draft-payment-sheet-filters > .btn { grid-column: auto; }
          .draft-payment-sheet-card { grid-template-columns: 26px minmax(0, 1fr); padding: 13px; }
          .draft-payment-sheet-card-open { display: none; }
          .timing-payment-omissions-summary { grid-template-columns: 1fr 1fr; gap: 6px; }
          .timing-payment-omissions-stat { padding: 9px; }
          .timing-payment-omissions-stat strong { font-size: 15px; }
        }
      `}</style>

      <Modal
        title="Merge projects"
        isOpen={mergeModalOpen}
        onClose={() => { if (!mergeProjectsSaving) setMergeModalOpen(false) }}
        maxWidth="920px"
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px' }}>
          <button className="btn btn-outline btn-sm" type="button" disabled={mergeProjectsSaving} onClick={() => setMergeModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" type="button" disabled={mergeProjectsLoading || suggestionsLoading || mergeProjectsSaving || !selectedTimingProject || !selectedGigJobsProject || !mergeConfirmed || !locationSelectionsComplete} onClick={mergeSelectedProjects}>
            {mergeProjectsSaving ? 'Merging...' : 'Merge projects'}
          </button>
        </div>}
      >
        <div className="timing-merge-body">
          <p className="timing-merge-copy">Choose the Timing source and GigJobs destination, then map each Timing location to its GigJobs location.</p>
          {mergeError && <p className="timing-merge-error" role="alert">{mergeError}</p>}
          {mergeProjectsLoading && <p className="timing-merge-empty" role="status">Loading GigJobs projects...</p>}
          <div className="timing-merge-flow">
            <section className="timing-merge-project is-source">
              <div className="timing-merge-project-heading"><span>01</span><div><small>Source record</small><strong>Timing project</strong></div></div>
              <SearchableProjectSelect
                options={projects.map((item) => ({ id: item.id || item.project_id || item.projectId, name: getProjectLabel(item) }))}
                value={selectedTimingProjectId}
                onChange={(nextId) => {
                  const item = projects.find((candidate) => String(candidate.id || candidate.project_id || candidate.projectId) === nextId)
                  setSelectedTimingProjectId(nextId)
                  setMergeAutoMatchMessage('')
                  loadTimingProjectLocations(item)
                }}
                placeholder="Search Timing project"
                disabled={mergeProjectsSaving}
              />
              {selectedTimingProject && <small className="timing-merge-id">Timing ID: {selectedTimingProjectId}</small>}
            </section>
            <div className="timing-merge-connector" aria-hidden="true"><span>maps into</span><i /></div>
            <section className="timing-merge-project is-destination">
              <div className="timing-merge-project-heading"><span>02</span><div><small>Destination record</small><strong>GigJobs project</strong></div></div>
              <SearchableProjectSelect
                options={gigJobsProjects.map((item) => ({
                  id: item.id || item.project_id || item.projectId || item.value,
                  name: item.name || item.project_name || item.projectName || item.title || item.label || item.id,
                }))}
                value={selectedGigJobsProjectId}
                onChange={(nextId) => {
                  const item = gigJobsProjects.find((candidate) => String(candidate.id || candidate.project_id || candidate.projectId || candidate.value) === nextId)
                  setSelectedGigJobsProjectId(nextId)
                  setMergeAutoMatchMessage('')
                  loadGigJobsLocations(item)
                }}
                placeholder="Search GigJobs project"
                disabled={mergeProjectsLoading || mergeProjectsSaving}
              />
              {selectedGigJobsProject && <small className="timing-merge-id">GigJobs ID: {normalizeProjectId(selectedGigJobsProjectId)}</small>}
            </section>
          </div>

          <section className="timing-merge-location-flow" aria-live="polite">
            <header>
              <div><p>Step 2 · Location mapping</p><h3>Connect each source location</h3></div>
              <div className="timing-merge-tools">
                <span>{selectedSuggestionIds.length ? `${selectedLocationMappings.length} of ${selectedSuggestionIds.length} selected mapped` : 'No locations selected'}</span>
                <button
                  className="btn btn-outline btn-sm"
                  type="button"
                  onClick={tryAutoMatchLocations}
                  disabled={suggestionsLoading || !timingSourceLocations.length || !gigJobsTargetLocations.length || mergeProjectsSaving}
                >Try automatching</button>
              </div>
            </header>
            {mergeAutoMatchMessage && <p className="timing-merge-copy" role="status">{mergeAutoMatchMessage}</p>}
            {suggestionsLoading && <p className="timing-merge-empty" role="status">Loading GigJobs {selectedProjectIsWritten ? 'districts' : 'locations'}...</p>}
            {!selectedTimingProject && <p className="timing-merge-empty">Choose a Timing project to load its locations.</p>}
            {!selectedGigJobsProject && <p className="timing-merge-empty">Choose a GigJobs project to load its locations.</p>}
            {!suggestionsLoading && selectedTimingProject && !timingSourceLocations.length && <p className="timing-merge-empty">No Timing source locations found for this project.</p>}
            {!suggestionsLoading && selectedGigJobsProject && !gigJobsTargetLocations.length && <p className="timing-merge-empty">No GigJobs target locations found for this project.</p>}
            {(timingSourceLocations.length > 0 || gigJobsTargetLocations.length > 0) && <>
              <div className="timing-merge-map-header">
                <span>Timing location</span><span>Connection</span><span>{selectedProjectIsWritten ? 'GigJobs district' : 'GigJobs location'}</span>
              </div>
              <div className="timing-merge-map-list">
                {timingSourceLocations.map((timingLocation) => {
                  const selected = selectedSuggestionIds.includes(timingLocation.id)
                  return <div className={`timing-merge-map-row${selected ? ' is-selected' : ''}`} key={timingLocation.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={mergeProjectsSaving}
                        onChange={(event) => {
                          setSelectedSuggestionIds((current) => event.target.checked
                            ? [...current, timingLocation.id]
                            : current.filter((id) => id !== timingLocation.id))
                          if (!event.target.checked) {
                            setTimingLocationBySuggestion((current) => {
                              const next = { ...current }
                              delete next[timingLocation.id]
                              return next
                            })
                          }
                          setMergeConfirmed(false)
                        }}
                      />
                      <span>{timingLocation.name}</span>
                    </label>
                    <i aria-hidden="true" />
                    <SearchableProjectSelect
                      options={gigJobsTargetLocations}
                      value={timingLocationBySuggestion[timingLocation.id] || ''}
                      onChange={(value) => {
                        setTimingLocationBySuggestion((current) => ({ ...current, [timingLocation.id]: value }))
                        setMergeConfirmed(false)
                      }}
                      disabled={!selected || !gigJobsTargetLocations.length || mergeProjectsSaving}
                      placeholder={`Search GigJobs ${selectedProjectIsWritten ? 'district' : 'location'}`}
                    />
                  </div>
                })}
              </div>
            </>}
          </section>

          {selectedTimingProject && selectedGigJobsProject && <section className="timing-merge-existing" aria-live="polite">
            <h3>Existing project mappings ({existingProjectMerges.length})</h3>
            {existingMergesLoading && <p className="timing-merge-empty" role="status">Loading existing mappings...</p>}
            {existingMergesError && <div className="timing-merge-error" role="alert">
              <span>{existingMergesError}</span>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => setExistingMergesReloadKey((key) => key + 1)} disabled={existingMergesLoading}>Retry</button>
            </div>}
            {!existingMergesLoading && !existingMergesError && existingProjectMerges.length === 0 && <p className="timing-merge-empty">No existing mappings for this project pair.</p>}
            {existingProjectMerges.map((merge) => <div className="timing-merge-existing-row" key={merge.id}>
              <span>{merge.timingLocationName}</span>
              <span className="timing-merge-existing-arrow" aria-hidden="true">maps to</span>
              <span>{merge.gigJobsLocationName}</span>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={() => unmergeProject(merge)}
                disabled={Boolean(unmergingProjectId)}
              >{unmergingProjectId === merge.id ? 'Unmerging...' : 'Unmerge'}</button>
            </div>)}
          </section>}

          {selectedTimingProject && selectedGigJobsProject && <>
            <p className={`timing-merge-match${normalizeProjectName(getProjectLabel(selectedTimingProject)) === normalizeProjectName(selectedGigJobsProject.name || selectedGigJobsProject.project_name || selectedGigJobsProject.projectName || selectedGigJobsProject.title) ? ' is-match' : ''}`} role="status">
              {normalizeProjectName(getProjectLabel(selectedTimingProject)) === normalizeProjectName(selectedGigJobsProject.name || selectedGigJobsProject.project_name || selectedGigJobsProject.projectName || selectedGigJobsProject.title)
                ? 'Project names match.'
                : 'Project names differ. Review both selections carefully.'}
            </p>
            <label className="timing-merge-confirm">
              <input type="checkbox" checked={mergeConfirmed} onChange={(event) => setMergeConfirmed(event.target.checked)} disabled={mergeProjectsSaving} />
              <span>I confirm these records represent the same project.</span>
            </label>
          </>}
        </div>
      </Modal>

      <Modal
        title="Draft payment sheets"
        isOpen={draftSheetsOpen}
        onClose={() => { if (!draftSheetConfirming && !draftSheetRegenerating) setDraftSheetsOpen(false) }}
        fullScreen
        footer={selectedDraftSheet ? <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => { setSelectedDraftSheetIndex(null); setDraftSheetReviewed(false) }} disabled={draftSheetConfirming || draftSheetRegenerating}>Back to drafts</button>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setDraftSheetsOpen(false)} disabled={draftSheetConfirming || draftSheetRegenerating}>Close</button>
            <button className="btn btn-primary btn-sm" type="button" onClick={confirmDraftPaymentSheet} disabled={!selectedDraftRows.length || !draftSheetReviewed || draftSheetConfirming || draftSheetRegenerating}>
              {draftSheetConfirming ? 'Confirming...' : 'Confirm ready to pay'}
            </button>
          </div>
        </div> : <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => setDraftSheetsOpen(false)}>Close</button>
        </div>}
      >
        <div className="draft-payment-sheets">
          {!selectedDraftSheet && <form
            className="draft-payment-sheet-filters"
            onSubmit={(event) => {
              event.preventDefault()
              setSelectedDraftSheetIndex(null)
              setDraftSheetReviewed(false)
              setDraftSheetOffset(0)
              setAppliedDraftSheetFilters({
                search: draftSheetSearch.trim(),
                from_date: draftSheetFromDate,
                to_date: draftSheetToDate,
              })
            }}
          >
            <input
              className="form-control"
              type="search"
              value={draftSheetSearch}
              placeholder="Search draft sheets"
              aria-label="Search draft sheets"
              onChange={(event) => setDraftSheetSearch(event.target.value)}
            />
            <label className="draft-payment-sheet-date">
              <span>Date from</span>
              <input className="form-control" type="date" value={draftSheetFromDate} onChange={(event) => setDraftSheetFromDate(event.target.value)} />
            </label>
            <label className="draft-payment-sheet-date">
              <span>Date to</span>
              <input className="form-control" type="date" value={draftSheetToDate} onChange={(event) => setDraftSheetToDate(event.target.value)} />
            </label>
            <button className="btn btn-primary btn-sm" type="submit" disabled={draftSheetsLoading}>Search</button>
          </form>}
          {draftSheetsLoading ? (
            <div className="draft-payment-sheets-state" role="status">Loading draft sheets...</div>
          ) : draftSheetsError ? (
            <div className="upload-error" role="alert">{draftSheetsError}</div>
          ) : draftPaymentSheets.length === 0 ? (
            <div className="draft-payment-sheets-state">No draft payment sheets found.</div>
          ) : !selectedDraftSheet ? (
            <>
              <div className="draft-payment-sheet-cards" aria-label="Draft payment sheets">
                {draftPaymentSheets.map((sheet, index) => {
                  const sheetId = sheet.id || sheet.sheet_id || sheet.sheetId || sheet.payment_sheet_id || sheet.paymentSheetId
                  const rowCount = sheet.expense_count ?? sheet.expenses_count ?? sheet.row_count
                  const movedStatus = String(sheet.moved_status ?? sheet.movedStatus ?? '').trim()
                  const amount = sheet.amount ?? sheet.total_amount ?? sheet.totalAmount
                  const amountLabel = amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount))
                    ? `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : ''
                  return (
                    <button
                      className="draft-payment-sheet-card"
                      key={sheetId || `${getDraftSheetName(sheet, index)}-${index}`}
                      type="button"
                      disabled={draftSheetRegenerating || draftSheetsLoading}
                      onClick={() => {
                        setSelectedDraftSheetIndex(index)
                        setDraftSheetReviewed(false)
                        regenerateDraftPaymentSheet(sheet, index)
                      }}
                    >
                      <FontAwesomeIcon icon={faFileExcel} />
                      <span className="draft-payment-sheet-card-copy">
                        <strong>{getDraftSheetName(sheet, index)}</strong>
                        <small>Sheet ID: {sheetId || 'Unavailable'}{rowCount !== undefined ? ` · ${rowCount} expenses` : ''}</small>
                        <small className={`draft-payment-sheet-moved-status${movedStatus ? ' is-moved' : ''}`}>
                          Moved status: {movedStatus || 'Not moved'}
                        </small>
                      </span>
                      <strong className="draft-payment-sheet-card-total">{amountLabel || 'Amount unavailable'}</strong>
                      <span className="draft-payment-sheet-card-open">Open</span>
                    </button>
                  )
                })}
              </div>
              {draftPaymentSheets.length > 0 && <div className="draft-payment-sheet-pagination">
                <label className="draft-payment-sheet-page-size">
                  <span>Rows</span>
                  <select
                    className="form-control form-control-sm"
                    value={draftSheetLimit}
                    onChange={(event) => {
                      setDraftSheetOffset(0)
                      setDraftSheetLimit(Number(event.target.value))
                    }}
                  >
                    {[5, 10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <span className="draft-payment-sheet-page-summary">
                  Showing {draftSheetOffset + 1}-{draftSheetOffset + draftPaymentSheets.length}{draftSheetTotal !== null ? ` of ${draftSheetTotal}` : ''}
                </span>
                <div className="draft-payment-sheet-page-actions">
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => setDraftSheetOffset((offset) => Math.max(0, offset - draftSheetLimit))} disabled={draftSheetOffset === 0 || draftSheetsLoading}>Previous</button>
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => setDraftSheetOffset((offset) => offset + draftSheetLimit)} disabled={!draftSheetHasMore || draftSheetsLoading}>Next</button>
                </div>
              </div>}
            </>
          ) : (
            <section className="draft-payment-sheet-workspace" aria-label="Selected draft sheet">
              {draftSheetRegenerating ? (
                <div className="draft-payment-sheets-state" role="status">Regenerating sheet preview...</div>
              ) : (
                <>
                <header className="draft-payment-sheet-toolbar">
                  <div className="draft-payment-sheet-meta">
                    <strong>{getDraftSheetName(selectedDraftSheet, selectedDraftSheetIndex)}</strong>
                    <span>{selectedDraftRows.length} rows</span>
                  </div>
                  <div className="draft-payment-sheet-actions">
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={downloadDraftPaymentSheet}
                      disabled={draftSheetRegenerating || !selectedDraftRows.length}
                    >
                      <FontAwesomeIcon icon={faDownload} /> Download sheet
                    </button>
                  </div>
                </header>
                {selectedDraftRows.length > 0 && selectedDraftColumns.length > 0 ? (
                  <div className="draft-payment-sheet-grid-wrap">
                    <table className="draft-payment-sheet-grid">
                      <thead><tr>
                        <th className="draft-payment-sheet-row-number" aria-label="Row number">#</th>
                        {selectedDraftColumns.map((column) => <th key={column}>{column}</th>)}
                      </tr></thead>
                      <tbody>{selectedDraftRows.map((row, rowIndex) => <tr key={rowIndex}>
                        <th className="draft-payment-sheet-row-number" scope="row">{rowIndex + 1}</th>
                        {selectedDraftColumns.map((column, columnIndex) => {
                          const value = Array.isArray(row) ? row[columnIndex] : row?.[column]
                          return <td key={column}>{value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                        })}
                      </tr>)}</tbody>
                    </table>
                  </div>
                ) : (
                  <div className="draft-payment-sheets-state">This draft does not contain tabular sheet rows.</div>
                )}
                <label className="timing-payment-review-ack draft-payment-sheet-ack">
                  <input
                    type="checkbox"
                    checked={draftSheetReviewed}
                    disabled={draftSheetConfirming || draftSheetRegenerating}
                    onChange={(event) => setDraftSheetReviewed(event.target.checked)}
                  />
                  <span>I reviewed this sheet and confirm it is final and ready to be paid.</span>
                </label>
                </>
              )}
            </section>
          )}
        </div>
      </Modal>

      <Modal
        title={paymentSheetReview ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {paymentSheetNameEditing ? (
              <input
                autoFocus
                className="form-control"
                aria-label="Payment sheet name"
                value={paymentSheetReview.filename || ''}
                maxLength={100}
                onChange={(event) => setPaymentSheetReview((current) => ({ ...current, filename: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.preventDefault()
                    setPaymentSheetNameEditing(false)
                  }
                }}
                style={{ minWidth: 0, width: 'min(420px, 55vw)', fontSize: 16, fontWeight: 600 }}
              />
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {paymentSheetReview.filename || 'Payment sheet'}
              </span>
            )}
            <button
              className="btn btn-outline btn-sm"
              type="button"
              aria-label={paymentSheetNameEditing ? 'Finish editing sheet name' : 'Edit sheet name'}
              title={paymentSheetNameEditing ? 'Finish editing sheet name' : 'Edit sheet name'}
              onClick={() => setPaymentSheetNameEditing((editing) => !editing)}
              disabled={paymentSheetConfirming}
              style={{ flex: '0 0 auto', padding: '5px 8px' }}
            >
              <FontAwesomeIcon icon={faPencilAlt} />
            </button>
          </div>
        ) : paymentSheetOmissions ? 'Review omitted expenses' : 'Export timing expenses'}
        isOpen={exportModalOpen}
        onClose={() => { if (!downloadInProgress && !paymentSheetConfirming) setExportModalOpen(false) }}
        maxWidth={paymentSheetReview ? '1120px' : paymentSheetOmissions ? '920px' : '560px'}
        footer={paymentSheetReview ? <div className="timing-payment-review-footer">
          {paymentSheetReview.savedStatus === 'ready_for_payment' ? <p role="status" style={{ margin: 0, color: 'var(--green)', fontSize: '13px', fontWeight: 600 }}>
            Final sheet confirmed and ready for payment.
          </p> : paymentSheetReview.savedStatus === 'draft' && <p role="status" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
            Payment sheet saved as draft.
          </p>}
          {paymentSheetReview.savedStatus !== 'ready_for_payment' && <label className="timing-payment-review-ack">
            <input type="checkbox" checked={paymentSheetReviewed} disabled={paymentSheetConfirming} onChange={(event) => setPaymentSheetReviewed(event.target.checked)} />
            <span>I reviewed this sheet and its candidate/project totals. It is final and ready to be paid.</span>
          </label>}
          <div className="timing-payment-review-actions">
            <button className="btn btn-outline btn-sm" type="button" disabled={downloadInProgress} onClick={downloadReviewedPaymentSheet}>
              <FontAwesomeIcon icon={faDownload} /> Download CSV
            </button>
            {paymentSheetReview.savedStatus !== 'ready_for_payment' && <>
              <button className="btn btn-outline btn-sm" type="button" disabled={!paymentSheetReview.rows.length || paymentSheetConfirming} onClick={() => confirmReviewedPaymentSheet('draft')}>
                {paymentSheetConfirming && paymentSheetAction === 'draft' ? 'Moving to draft...' : 'Move to draft'}
              </button>
              <button className="btn btn-primary btn-sm" type="button" disabled={!paymentSheetReview.rows.length || !paymentSheetReviewed || paymentSheetConfirming} onClick={() => confirmReviewedPaymentSheet('ready_for_payment')}>
                {paymentSheetConfirming && paymentSheetAction === 'ready_for_payment' ? 'Confirming...' : 'Confirm ready to pay'}
              </button>
            </>}
            <button className="btn btn-outline btn-sm timing-payment-review-close" type="button" disabled={downloadInProgress || paymentSheetConfirming} onClick={() => setExportModalOpen(false)}>Close</button>
          </div>
        </div> : paymentSheetOmissions ? <div className="timing-payment-omissions-footer">
          <div>
            <button className="btn btn-outline btn-sm" type="button" disabled={downloadInProgress} onClick={() => setPaymentSheetOmissions(null)}>Back</button>
            <button className="btn btn-outline btn-sm" type="button" disabled={downloadInProgress} onClick={() => setExportModalOpen(false)}>Close</button>
          </div>
          <button className="btn btn-primary btn-sm" type="button" disabled={!paymentSheetOmissions.eligibleExpenses.length || downloadInProgress} onClick={confirmPaymentSheetGeneration}>
            {downloadInProgress ? 'Generating...' : `Generate sheet for ${paymentSheetOmissions.eligibleExpenses.length} eligible`}
          </button>
        </div> : <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px' }}>
          <button className="btn btn-outline btn-sm" type="button" disabled={downloadInProgress || paymentSheetConfirming} onClick={() => setExportModalOpen(false)}>Close</button>
        </div>}
      >
        <div style={{ display: 'grid', gap: '16px', padding: '8px 0' }}>
          {paymentSheetReview ? <section className="timing-payment-review">
            <div className="timing-payment-review-summary">
              <div className="timing-payment-review-stat"><span>Sheet rows</span><strong>{paymentSheetReview.rows.length.toLocaleString('en-IN')}</strong></div>
              <div className="timing-payment-review-stat"><span>Source expenses</span><strong>{paymentSheetBreakdown.reduce((sum, group) => sum + group.expenseCount, 0).toLocaleString('en-IN')}</strong></div>
              <div className="timing-payment-review-stat"><span>Reconciled total</span><strong>₹ {paymentSheetBreakdown.reduce((sum, group) => sum + group.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
            </div>

            <div className="timing-payment-review-tabs" role="tablist" aria-label="Payment sheet review sections">
              <button type="button" role="tab" aria-selected={paymentSheetReviewTab === 'sheet'} onClick={() => setPaymentSheetReviewTab('sheet')}>Generated sheet</button>
              <button type="button" role="tab" aria-selected={paymentSheetReviewTab === 'breakdown'} onClick={() => setPaymentSheetReviewTab('breakdown')}>Expense reconciliation</button>
            </div>

            {paymentSheetReviewTab === 'sheet' ? <section className="timing-payment-review-section" role="tabpanel">
              <header><h3>Generated payment sheet</h3><span>Exact rows returned by the payment-sheet service</span></header>
              {paymentSheetColumns.length ? <div className="timing-payment-review-table-wrap">
                <table className="expenses-table timing-payment-review-table">
                  <thead><tr>{paymentSheetColumns.map((column) => <th key={column} className={/amount|total|payout/i.test(column) ? 'is-amount' : ''}>{column}</th>)}</tr></thead>
                  <tbody>{paymentSheetReview.rows.map((row, rowIndex) => <tr key={`${rowIndex}-${getPaymentSheetRowValue(row, ['registration_id', 'candidate_id', 'name'])}`}>
                    {paymentSheetColumns.map((column) => {
                      const value = row?.[column]
                      return <td key={column} className={/amount|total|payout/i.test(column) ? 'is-amount' : ''}>{value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                    })}
                  </tr>)}</tbody>
                </table>
              </div> : <p style={{ margin: 0, color: 'var(--text3)' }}>The payment sheet service returned no columns.</p>}
            </section> : <section className="timing-payment-review-section" role="tabpanel">
              <header><h3>Expense reconciliation</h3><span>Amounts grouped by project and unique candidate</span></header>
              <div className="timing-payment-review-table-wrap">
                <table className="expenses-table timing-payment-review-table">
                  <thead><tr><th>Project</th><th>Candidate</th><th>Registration ID</th><th>Source expenses</th><th className="is-amount">Candidate total</th></tr></thead>
                  <tbody>{paymentSheetBreakdown.map((group, index) => <tr key={`${group.project}-${group.registrationId || group.candidate}-${index}`}>
                    <td>{group.project}</td>
                    <td>{group.candidate}</td>
                    <td>{group.registrationId || '—'}</td>
                    <td><div className="timing-payment-review-expenses">{group.expenses.map((expense, expenseIndex) => <span key={`${expense.id || 'expense'}-${expenseIndex}`}>
                      {expense.category}{expense.id ? ` · #${expense.id}` : ''}: ₹ {expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>)}</div></td>
                    <td className="is-amount"><strong>₹ {group.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                  </tr>)}</tbody>
                  <tfoot><tr><th colSpan={4}>Total source expenses</th><th className="is-amount">₹ {paymentSheetBreakdown.reduce((sum, group) => sum + group.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</th></tr></tfoot>
                </table>
              </div>
            </section>}
          </section> : paymentSheetOmissions ? <section className="timing-payment-omissions">
            <div className="timing-payment-omissions-summary">
              <div className="timing-payment-omissions-stat"><span>Eligible expenses</span><strong>{paymentSheetOmissions.eligibleExpenses.length}</strong></div>
              <div className="timing-payment-omissions-stat"><span>Eligible amount</span><strong>₹ {paymentSheetOmissions.eligibleExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
              <div className="timing-payment-omissions-stat is-excluded"><span>Unregistered</span><strong>{paymentSheetOmissions.unregisteredCandidates.length}</strong></div>
              <div className="timing-payment-omissions-stat is-excluded"><span>Unmerged projects</span><strong>{paymentSheetOmissions.unmergedProjects.length}</strong></div>
              <div className="timing-payment-omissions-stat is-excluded"><span>Unmerged locations</span><strong>{paymentSheetOmissions.unmergedLocations.length}</strong></div>
              <div className="timing-payment-omissions-stat is-excluded"><span>Excluded mobile</span><strong>{paymentSheetOmissions.excludedMobileCandidates.length}</strong></div>
            </div>

            <section className="timing-payment-omissions-section">
              <header>
                <h3>Eligible expenses</h3>
                <span>Registered and linked to a merged project and location</span>
              </header>
              {paymentSheetOmissions.eligibleExpenses.length ? <div className="timing-payment-omissions-table-wrap">
                <table className="expenses-table timing-payment-omissions-table">
                  <thead><tr><th>Candidate</th><th>Expense ID</th><th>Mobile</th><th>Project</th><th className="is-amount">Amount</th></tr></thead>
                  <tbody>{paymentSheetOmissions.eligibleExpenses.map((expense, index) => <tr key={`${getExpenseId(expense) || 'expense'}-${index}`}>
                    <td>{getCandidateValue(expense, ['name', 'candidate_name', 'full_name', 'fullName']) || 'Unnamed candidate'}</td>
                    <td>{getExpenseId(expense) || 'Unavailable'}</td>
                    <td>{getCandidateValue(expense, ['mobile_number', 'mobile', 'mobile_no', 'phone', 'phone_number', 'whatsapp', 'contact']) || '—'}</td>
                    <td>{getMergedProjectName(expense) || 'Project unavailable'}</td>
                    <td className="is-amount">₹ {Number(expense.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>)}</tbody>
                  <tfoot><tr><th colSpan={4}>Eligible total</th><th className="is-amount">₹ {paymentSheetOmissions.eligibleExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</th></tr></tfoot>
                </table>
              </div> : <p className="timing-payment-omissions-empty">No expenses are eligible for this payment sheet.</p>}
            </section>

            <div className="timing-payment-omissions-groups">
              <section className="timing-payment-omissions-group">
                <h3>Unregistered candidates · {paymentSheetOmissions.unregisteredCandidates.length}</h3>
                {paymentSheetOmissions.unregisteredCandidates.length ? <ul className="timing-payment-omissions-list">
                  {paymentSheetOmissions.unregisteredCandidates.map((candidate, index) => <li key={`${candidate.mobile}-${index}`}>
                    <strong>{candidate.name}</strong>{candidate.mobile && <small>{candidate.mobile}</small>}
                  </li>)}
                </ul> : <p className="timing-payment-omissions-empty">None</p>}
              </section>
              <section className="timing-payment-omissions-group">
                <h3>Projects without a merge · {paymentSheetOmissions.unmergedProjects.length}</h3>
                {paymentSheetOmissions.unmergedProjects.length ? <ul className="timing-payment-omissions-list">
                  {paymentSheetOmissions.unmergedProjects.map((projectItem, index) => <li key={`${projectItem.id || projectItem.name}-${index}`}>
                    <strong>{projectItem.name}</strong>{projectItem.id && <small>Project ID: {projectItem.id}</small>}
                  </li>)}
                </ul> : <p className="timing-payment-omissions-empty">None</p>}
              </section>
              <section className="timing-payment-omissions-group">
                <h3>Locations without a merge · {paymentSheetOmissions.unmergedLocations.length}</h3>
                {paymentSheetOmissions.unmergedLocations.length ? <ul className="timing-payment-omissions-list">
                  {paymentSheetOmissions.unmergedLocations.map((locationItem, index) => <li key={`${locationItem.id || locationItem.name}-${index}`}>
                    <strong>{locationItem.name}</strong>
                    <small>Project: {locationItem.projectName}</small>
                    {locationItem.id && <small>Location ID: {locationItem.id}</small>}
                  </li>)}
                </ul> : <p className="timing-payment-omissions-empty">None</p>}
              </section>
              <section className="timing-payment-omissions-group">
                <h3>Excluded mobile numbers · {paymentSheetOmissions.excludedMobileCandidates.length}</h3>
                {paymentSheetOmissions.excludedMobileCandidates.length ? <ul className="timing-payment-omissions-list">
                  {paymentSheetOmissions.excludedMobileCandidates.map((candidate, index) => <li key={`${candidate.mobile}-${index}`}>
                    <strong>{candidate.name}</strong>{candidate.mobile && <small>{candidate.mobile}</small>}
                    <small>Expense IDs: {candidate.expenseIds.join(', ')}</small>
                  </li>)}
                </ul> : <p className="timing-payment-omissions-empty">None</p>}
              </section>
            </div>
          </section> : <>
          <fieldset style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', margin: 0, padding: '12px', border: '1px solid var(--border-light)', borderRadius: '6px' }}>
            <legend style={{ padding: '0 6px', fontSize: '13px', fontWeight: 600 }}>Expenses to include</legend>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="radio" name="timing-export-scope" value="selected" checked={exportScope === 'selected'} disabled={!selectedExpenses.length || downloadInProgress} onChange={() => setExportScope('selected')} />
              Selected ({selectedExpenses.length})
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="radio" name="timing-export-scope" value="all" checked={exportScope === 'all'} disabled={downloadInProgress} onChange={() => setExportScope('all')} />
              All filtered expenses
            </label>
          </fieldset>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <button className="btn btn-outline" type="button" disabled={downloadInProgress || (exportScope === 'selected' && !selectedExpenses.length)} onClick={() => runExportAction(exportExpenses, 'timing-expenses')}>
              <FontAwesomeIcon icon={faFileExcel} /> Download Excel
            </button>
            <button className="btn btn-outline" type="button" disabled={downloadInProgress || (exportScope === 'selected' && !selectedExpenses.length)} onClick={() => runExportAction(downloadExpensesZip, 'timing-expenses')}>
              <FontAwesomeIcon icon={faArchive} /> Download as ZIP
            </button>
            <button className="btn btn-outline" type="button" disabled={downloadInProgress || (exportScope === 'selected' && !selectedExpenses.length)} onClick={() => runExportAction(generateInvoices, 'candidate-invoices')}>
              Generate invoices
            </button>
            {activeStatus === 'approved' && (
              <button className="btn btn-outline" type="button" disabled={downloadInProgress || (exportScope === 'selected' && (!selectedExpenses.length || paymentSheetSelectionHasMultipleProjects))} onClick={() => runExportAction(generatePaymentSheet, 'timing-payment-sheet')}>
                <FontAwesomeIcon icon={faFileExcel} /> Generate payment sheet
              </button>
            )}
          </div>
          {exportScope === 'selected' && paymentSheetSelectionHasMultipleProjects && <p role="status" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '12px' }}>
            Payment sheets can include expenses from one project only. Select expenses from a single project.
          </p>}
          {exportProgress.status && (
            <div aria-live="polite" style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
                <span>{exportProgress.status}</span>
                <strong>{exportProgress.percent}%</strong>
              </div>
              <progress value={exportProgress.percent} max="100" aria-label="Export progress" style={{ width: '100%', height: '12px' }} />
            </div>
          )}
          </>}
        </div>
      </Modal>

      <Modal title="Timing Expense Details" isOpen={detailsOpen} onClose={() => { setDetailsOpen(false); setSelectedExpense(null) }} maxWidth="800px">
        {detailsLoading ? <Card className="loading-state">Loading expense details...</Card> : selectedExpense && <div className="timing-expense-details">
          <header className="timing-expense-details-header">
            <div>
              <p className="timing-expense-details-kicker">Timing expense</p>
              <h2>{selectedExpense.title || selectedExpense.description || selectedExpense.category || 'Expense details'}</h2>
              <p className="timing-expense-details-id">Expense ID: {getExpenseId(selectedExpense) || '—'}</p>
            </div>
            <div className="timing-expense-details-amount">
              <span>Submitted amount</span>
              <strong>₹ {Number(selectedExpense.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </header>
          <dl className="timing-expense-details-grid">
            {detailFields.map(([label, value]) => <div className="timing-expense-details-field" key={label}>
              <dt>{label}</dt>
              <dd>{label === 'Status' ? <Tag>{String(value)}</Tag> : String(value)}</dd>
            </div>)}
          </dl>
          {(selectedExpense.description || selectedExpense.reason || selectedExpense.purpose) && <section className="timing-expense-details-section">
            <h3>Description</h3>
            <p className="timing-expense-details-description">{selectedExpense.description || selectedExpense.reason || selectedExpense.purpose}</p>
          </section>}
          {attachments.length > 0 && <section className="timing-expense-details-section">
            <h3>Receipts and attachments ({attachments.length})</h3>
            <div className="timing-expense-attachments">{attachments.map((file, index) => <button key={`${file.url}-${index}`} className="btn btn-outline btn-sm timing-expense-attachment" onClick={() => setAttachment(file.url)} title={file.name}>
              <FontAwesomeIcon icon={faDownload} /> <span>{file.name || `Attachment ${index + 1}`}</span>
            </button>)}</div>
          </section>}
        </div>}
      </Modal>
      <Modal
        title="Attachment Preview"
        isOpen={Boolean(attachment)}
        onClose={() => setAttachment(null)}
        maxWidth="90vw"
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px' }}>
          <a className="btn btn-outline btn-sm" href={attachment ? resolveAttachmentUrl(attachment) : undefined} target="_blank" rel="noreferrer" download><FontAwesomeIcon icon={faDownload} /> Download</a>
          <button className="btn btn-outline btn-sm" onClick={() => setAttachment(null)}>Close</button>
        </div>}
      >
        {attachment && (/\.pdf($|\?)/i.test(attachment) ? <iframe src={resolveAttachmentUrl(attachment)} title="Expense attachment" style={{ width: '100%', height: '70vh', border: 0 }} /> : /\.(doc|docx|xls|xlsx)($|\?)/i.test(attachment) ? <div style={{ padding: '32px', textAlign: 'center' }}>Preview is unavailable for this file type. Use Download to open it.</div> : <img src={resolveAttachmentUrl(attachment)} alt="Expense attachment" style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: 'auto' }} />)}
      </Modal>
    </div>
  )
}
