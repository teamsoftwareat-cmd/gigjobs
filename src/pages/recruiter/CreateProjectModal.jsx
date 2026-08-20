import { useState, useEffect, useRef, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faMinus, faUpload, faDownload } from '@fortawesome/free-solid-svg-icons'
import * as XLSX from 'xlsx'
import { Modal } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const AMOUNT_OPTIONS = ['Select Amount', '400', '500', '600', '700', '800', '900', '1000']
const DRESS_CODES = ['Formal', 'Business Casual', 'Casual', 'Safety Gear']
const WORKING_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const PROJECT_KINDS = ['PET', 'Survey', 'Shipments', 'Scanning']

const DESIGNATION_FALLBACK_OPTIONS = [
  'Biometric Operators',
  'Operator',
  'Supervisors',
  'Videographers',
  'Centre Head',
  'HR',
  'Bib Distribution',
  'Bib Collection',
  'Registration Executive',
  'Long Jump',
  'High Jump',
  'Chip Tying',
  'Chip Collection',
  'Verification',
  'CCTV',
  'Networking',
  'PST Operators',
  'PST Head',
  'Leica Operators',
  'Timers',
  'Enumerator',
  'Supervisor',
  'Security Escort',
  'Scanning',
  'Quality Control'
]

const emptyForm = {
  projectName: '',
  clientName: '',
  designation: [],
  startDate: '',
  endDate: '',
  requiredCandidates: '',
  salary: '',
  about: '',
  jobDescription: '',
  address: '',
  website: '',
  email: '',
  mobile: '',
  startTime: '',
  endTime: '',
  dressCode: '',
}

const DATA_HEADERS_PRIORITY = ['id', 's_no', 'date', 'district', 'centre_code', 'centre_name', 'supervisor', 'operator', 'videographer']

/**
 * Normalizes keys to handle common variations (S.No vs s_no, Center vs Centre)
 * and casing mismatches which cause duplicated columns in the preview.
 */
const normalizeHeaderKey = (key) => {
  const k = String(key || '').trim().toLowerCase().replace(/[\s\.]+/g, '_')
  if (k === 's_no' || k === 'sno' || k === 'serial_no') return 's_no'
  if (k === 'center_code') return 'centre_code'
  if (k === 'center_name') return 'centre_name'
  if (k === 'operators') return 'operator'
  if (k === 'supervisors') return 'supervisor'
  if (k === 'videographers') return 'videographer'
  return k
}

const buildHeaderFromObjects = (objects) => {
  const allKeys = Array.from(new Set(objects.flatMap((item) => Object.keys(item || {}))))
  // Exclude keys that normalize to our priority headers to prevent duplication
  const otherKeys = allKeys.filter((key) => !DATA_HEADERS_PRIORITY.includes(normalizeHeaderKey(key)))
  return [...DATA_HEADERS_PRIORITY, ...otherKeys]
}

const createPreviewFromObjectRows = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null

  // Transform objects so keys matching priority headers are consistent
  const normalizedItems = items.map(item => {
    const newItem = {}
    Object.entries(item).forEach(([k, v]) => {
      const normalized = normalizeHeaderKey(k)
      const priorityMatch = DATA_HEADERS_PRIORITY.find(pk => pk === normalized)
      newItem[priorityMatch || k] = v
    })
    return newItem
  })

  const header = buildHeaderFromObjects(normalizedItems)
  const rows = normalizedItems.map((item) => header.map((key) => item[key] ?? ''))
  return { header, rows }
}

const getDataPreviewFromProjectData = (projectData) => {
  if (!projectData) return null

  const possibleData = projectData.data || projectData.excelData || projectData.centreData || projectData.centerData || projectData.centreRows || projectData.rows || projectData.examCenters || projectData.centres || projectData.centerRows
  if (!possibleData) return null

  if (possibleData?.header && Array.isArray(possibleData.rows)) {
    return { header: possibleData.header, rows: possibleData.rows }
  }

  if (Array.isArray(possibleData)) {
    if (possibleData.length === 0) {
      return { header: DATA_HEADERS_PRIORITY, rows: [] }
    }
    if (Array.isArray(possibleData[0])) {
      const [header, ...rows] = possibleData
      return { header, rows }
    }
    return createPreviewFromObjectRows(possibleData)
  }

  return null
}

export default function CreateProjectModal({ isOpen, onClose, project = null }) {
  const { user } = useAuth()
  const [projectType, setProjectType] = useState('regular')
  const [projectKind, setProjectKind] = useState('PET')
  const [form, setForm] = useState(emptyForm)
  const [projectLocations, setProjectLocations] = useState([{ address: '', latitude: '', longitude: '', mapLocation: '' }])
  const [workingDays, setWorkingDays] = useState(WORKING_DAYS.reduce((acc, day) => ({ ...acc, [day]: false }), {}))
  const [excelFile, setExcelFile] = useState(null)
  const [excelPreview, setExcelPreview] = useState(null)
  const [excelParseError, setExcelParseError] = useState('')
  const [showExcelPreview, setShowExcelPreview] = useState(false)
  const [excelPreviewSource, setExcelPreviewSource] = useState('')
  const [designationOptions, setDesignationOptions] = useState(DESIGNATION_FALLBACK_OPTIONS)
  const [isDesignationDropdownOpen, setIsDesignationDropdownOpen] = useState(false)
  const designationRef = useRef(null)

  const [rowSaveStatus, setRowSaveStatus] = useState({})
  const [previewSearch, setPreviewSearch] = useState('')
  const [previewDistrict, setPreviewDistrict] = useState('')
  const [previewCentre, setPreviewCentre] = useState('')
  const [previewDistrictOptions, setPreviewDistrictOptions] = useState([])
  const [previewCentreOptions, setPreviewCentreOptions] = useState([])
  const [previewOffset, setPreviewOffset] = useState(0)
  const [previewLimit, setPreviewLimit] = useState(20)
  const [previewTotalCount, setPreviewTotalCount] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (designationRef.current && !designationRef.current.contains(event.target)) {
        setIsDesignationDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchWrittenExamData = async (projectId, params = {}) => {
    setPreviewLoading(true)
    try {
      const query = {
        search: previewSearch,
        district: previewDistrict,
        centre: previewCentre,
        offset: previewOffset,
        limit: previewLimit,
        ...params,
      }
      const cleanQuery = Object.entries(query).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = value
        }
        return acc
      }, {})

      const examResponse = await recruiterAPI.getWrittenExamData(projectId, { params: cleanQuery })
      const responseData = examResponse.data?.data ?? examResponse.data
      const rows = Array.isArray(responseData) ? responseData : (Array.isArray(responseData?.rows) ? responseData.rows : [])
      const total = examResponse.data?.total ?? examResponse.data?.count ?? responseData?.total ?? responseData?.count ?? null
      setPreviewTotalCount(total)

      if (rows.length > 0) {
        const preview = createPreviewFromObjectRows(rows)
        setExcelPreview(preview)
        setExcelPreviewSource('api')
      } else {
        setExcelPreview({ header: DATA_HEADERS_PRIORITY, rows: [] })
      }
    } catch (err) {
      console.warn('Unable to fetch written exam data', err)
      setExcelPreview({ header: DATA_HEADERS_PRIORITY, rows: [] })
      setPreviewTotalCount(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const normalizeOptionList = (payload) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.districts)
          ? payload.districts
          : Array.isArray(payload?.centres)
            ? payload.centres
            : []

    return list.map((item) => ({
      id: String(item?.id ?? item?.districtId ?? item?.centreId ?? item?.locationId ?? ''),
      name: String(item?.name ?? item?.district ?? item?.centre ?? item?.label ?? item?.title ?? ''),
    })).filter((option) => option.id)
  }

  const loadPreviewDistrictOptions = async (projectId) => {
    try {
      const response = await recruiterAPI.getProjectDistricts(projectId)
      const options = normalizeOptionList(response.data?.data ?? response.data)
      setPreviewDistrictOptions(options)
    } catch (err) {
      console.warn('Unable to load district options', err)
      setPreviewDistrictOptions([])
    }
  }

  const loadPreviewCentreOptions = async (projectId, districtId) => {
    if (!districtId) {
      setPreviewCentreOptions([])
      return
    }

    try {
      const response = await recruiterAPI.getDistrictCentres(projectId, districtId)
      const options = normalizeOptionList(response.data?.data ?? response.data)
      setPreviewCentreOptions(options)
    } catch (err) {
      console.warn('Unable to load centre options', err)
      setPreviewCentreOptions([])
    }
  }

  const handlePreviewSearchChange = async (value) => {
    setPreviewSearch(value)
    setPreviewOffset(0)
    const projectId = project?.id || project?.projectId
    if (projectId) {
      await fetchWrittenExamData(projectId, { search: value, offset: 0 })
    }
  }

  const handlePreviewDistrictChange = async (value) => {
    setPreviewDistrict(value)
    setPreviewCentre('')
    setPreviewOffset(0)
    const projectId = project?.id || project?.projectId
    if (projectId) {
      await loadPreviewCentreOptions(projectId, value)
      await fetchWrittenExamData(projectId, { district: value, centre: '', offset: 0 })
    }
  }

  const handlePreviewCentreChange = async (value) => {
    setPreviewCentre(value)
    setPreviewOffset(0)
    const projectId = project?.id || project?.projectId
    if (projectId) {
      await fetchWrittenExamData(projectId, { centre: value, offset: 0 })
    }
  }

  const handlePreviewLimitChange = async (value) => {
    setPreviewLimit(value)
    setPreviewOffset(0)
    const projectId = project?.id || project?.projectId
    if (projectId) {
      await fetchWrittenExamData(projectId, { limit: value, offset: 0 })
    }
  }

  const handlePreviewPageChange = async (newOffset) => {
    setPreviewOffset(newOffset)
    const projectId = project?.id || project?.projectId
    if (projectId) {
      await fetchWrittenExamData(projectId, { offset: newOffset })
    }
  }

  useEffect(() => {
    const projectId = project?.id || project?.projectId
    if (projectId) {
      loadPreviewDistrictOptions(projectId)
    }
  }, [project?.id, project?.projectId])

  useEffect(() => {
    const projectId = project?.id || project?.projectId
    if (projectId && previewDistrict) {
      loadPreviewCentreOptions(projectId, previewDistrict)
    }
  }, [project?.id, project?.projectId, previewDistrict])

  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [clientOptions, setClientOptions] = useState([])

  const isEditing = !!project

  const getClientOptionLabel = (client) => {
    if (typeof client === 'string') return client
    return client.name || client.clientName || client.label || client.title || ''
  }

  const normalizeNullableValue = (value) => {
    if (value == null) return null
    const trimmed = String(value).trim()
    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return null
    return value
  }

  const normalizeProjectType = (type) => {
    const value = String(type || '').trim().toLowerCase()
    if (value === 'written' || value === 'writtenexam' || value === 'written_exam') return 'writtenExam'
    return 'regular'
  }

  const isWrittenProject = (type) => ['written', 'writtenexam', 'written_exam'].includes(String(type || '').trim().toLowerCase())

  const resetForm = () => {
    setForm(emptyForm)
    setProjectLocations([{ address: '', latitude: '', longitude: '', mapLocation: '' }])
    setWorkingDays(WORKING_DAYS.reduce((acc, day) => ({ ...acc, [day]: false }), {}))
    setExcelFile(null)
    setExcelPreview(null)
    setShowExcelPreview(false)
    setErrors({})
    setSuccess(false)
    setFetchLoading(false)
    setProjectKind('PET')
  }

  const normalizeDesignationList = (payload) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : []

    return list.map((item) => {
      if (typeof item === 'string') return item.trim()
      return String(item?.name || item?.designation || '').trim()
    }).filter(Boolean)
  }

  const fetchDesignationOptions = useCallback(async () => {
    try {
      const projectId = project?.id || project?.projectId || undefined
      const response = await recruiterAPI.getDesignations(projectId)
      const payload = response?.data ?? {}
      const normalized = normalizeDesignationList(payload)
      setDesignationOptions(normalized.length > 0 ? normalized : DESIGNATION_FALLBACK_OPTIONS)
    } catch (err) {
      console.warn('Unable to load designation options', err)
      setDesignationOptions(DESIGNATION_FALLBACK_OPTIONS)
    }
  }, [project])

  const fetchClientOptions = async () => {
    if (!isOpen) return
    try {
      const response = await recruiterAPI.getClients()
      const payload = response?.data ?? {}
      const list = Array.isArray(payload) ? payload : payload?.data || payload?.items || payload?.clients || []
      setClientOptions(Array.isArray(list) ? list : [])
    } catch (err) {
      console.warn('Unable to load client options', err)
      setClientOptions([])
    }
  }

  useEffect(() => {
    if (!isOpen) return
    fetchClientOptions()
    fetchDesignationOptions()
  }, [isOpen])

  // Fetch project data when editing
  useEffect(() => {
    if (isEditing && project && isOpen) {
      const projectId = project.id || project.projectId
      if (!projectId) {
        console.error('No project ID found for editing')
        setErrors({ form: 'Invalid project data' })
        return
      }

      setFetchLoading(true)
      recruiterAPI.getProject(projectId)
        .then(async (response) => {
          const projectData = response.data?.data || response.data

          const designationsValue = projectData.designation || projectData.designations || []
          const parsedDesignations = Array.isArray(designationsValue) 
            ? designationsValue.map(String) 
            : typeof designationsValue === 'string' 
              ? designationsValue.split(',').map(s => s.trim()).filter(Boolean)
              : []

          setForm({
            projectName: projectData.projectName || projectData.name || '',
            clientName: projectData.clientName || '',
            designation: parsedDesignations,
            startDate: projectData.startDate ? projectData.startDate.split('T')[0] : '',
            endDate: projectData.endDate ? projectData.endDate.split('T')[0] : '',
            requiredCandidates: projectData.requiredCandidates || '',
            salary: projectData.salary || '',
            about: projectData.about || '',
            jobDescription: projectData.jobDescription || '',
            address: projectData.address || '',
            website: projectData.website || '',
            email: projectData.email || '',
            mobile: projectData.mobile || '',
            startTime: projectData.startTime || '',
            endTime: projectData.endTime || '',
            dressCode: projectData.dressCode || '',
          })
          const normalizedType = normalizeProjectType(projectData.projectType || projectData.type)
          setProjectType(normalizedType)
          setProjectKind(projectData.projectKind || projectData.kind || projectData.type || 'PET')
          setProjectLocations((projectData.projectLocations || [{ address: '', latitude: '', longitude: '', mapLocation: '' }]).map((location) => ({
            // Preserve server-provided location identifiers so updates include them
            ...(location?.location_id ? { location_id: location.location_id } : {}),
            ...(location?.locationId ? { locationId: location.locationId } : {}),
            address: location?.address || '',
            latitude: normalizeNullableValue(location?.latitude) ?? '',
            longitude: normalizeNullableValue(location?.longitude) ?? '',
            mapLocation: normalizeNullableValue(location?.mapLocation) ?? '',
          })))
          setWorkingDays(WORKING_DAYS.reduce((acc, day) => ({ ...acc, [day]: projectData.workingDays?.includes(day) || false }), {}))

          const previewFromData = getDataPreviewFromProjectData(projectData)
          if (previewFromData && !isWrittenProject(normalizedType)) {
            setExcelPreview(previewFromData)
            setExcelPreviewSource('data')
          }

          if (isWrittenProject(normalizedType)) {
            // Fetch written exam rows from the dedicated endpoint
            await fetchWrittenExamData(projectId)
          } else {
            const excelUrl = normalizeNullableValue(projectData.excelFileUrl)
            const excelName = normalizeNullableValue(projectData.excelFileName)

            // Auto-fetch Excel file only if inline data object is not available
            if (isWrittenProject(projectData.projectType || projectData.type) && excelUrl) {
            try {
              const res = await fetch(excelUrl)
              const blob = await res.blob()
              // Try to get filename from Content-Disposition or fallback
              let fileName = 'uploaded_excel.xlsx'
              const disposition = res.headers.get('Content-Disposition') || res.headers.get('content-disposition')
              if (disposition) {
                const match = disposition.match(/filename="?([^";]+)"?/)
                if (match) fileName = match[1]
              } else if (excelName) {
                fileName = excelName
              }
              const file = new File([blob], fileName, { type: blob.type })
              setExcelFile(file)
              // Optionally, parse preview as well
              try {
                const isCsv = file.name.toLowerCase().endsWith('.csv')
                const data = isCsv ? await file.text() : await file.arrayBuffer()
              
              const formatExcelVal = (v) => {
                if (v instanceof Date) {
                  return v.toISOString().split('T')[0] // Returns YYYY-MM-DD
                }
                if (typeof v === 'string') {
                  const match = v.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
                  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
                }
                return v == null ? '' : String(v).trim()
              }

                const workbook = isCsv
                ? XLSX.read(data, { type: 'string', cellDates: true })
                : XLSX.read(data, { type: 'array', cellDates: true })
                const sheet = workbook.Sheets[workbook.SheetNames[0]]
              const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true })
                if (rows && rows.length > 0) {
                const header = rows[0].map(formatExcelVal)
                const body = rows.slice(1).map((row) => row.map(formatExcelVal))
                  setExcelPreview({ header, rows: body })
                  setExcelPreviewSource('file')
                }
              } catch {}
            } catch (err) {
              setExcelParseError('Unable to fetch or parse the uploaded Excel file.')
            }
          }
        }
        })
        .catch((error) => {
          console.error('Failed to fetch project:', error)
          setErrors({ form: 'Failed to load project data.' })
        })
        .finally(() => {
          setFetchLoading(false)
        })
    } else if (!isEditing) {
      resetForm()
    }
  }, [isEditing, project, isOpen])

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleDesignationToggle = (option) => {
    setForm(prev => {
      const current = Array.isArray(prev.designation) ? prev.designation : []
      const next = current.includes(option)
        ? current.filter(d => d !== option)
        : [...current, option]
      return { ...prev, designation: next }
    })
    setErrors(prev => ({ ...prev, designation: undefined }))
  }

  const updateLocation = (index, field, value) => {
    setProjectLocations((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)))
  }

  const addLocation = () => setProjectLocations((prev) => [...prev, { address: '', latitude: '', longitude: '', mapLocation: '' }])
  const removeLocation = (index) => setProjectLocations((prev) => prev.filter((_, idx) => idx !== index))
  const toggleDay = (day) => setWorkingDays((prev) => ({ ...prev, [day]: !prev[day] }))

  const handleFileChange = async (event) => {
    const file = event.target.files[0]
    setExcelFile(file || null)
    setErrors((prev) => ({ ...prev, excelFile: undefined }))
    setExcelParseError('')

    if (!file) return

    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv')
      const data = isCsv ? await file.text() : await file.arrayBuffer()
      const workbook = isCsv
        ? XLSX.read(data, { type: 'string', cellDates: true })
        : XLSX.read(data, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      
      const formatExcelVal = (v) => {
        if (v instanceof Date) {
          return v.toISOString().split('T')[0]
        }
        if (typeof v === 'string') {
          const match = v.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
          if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
        }
        return v == null ? '' : String(v).trim()
      }

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true })
      if (!rows || rows.length === 0) {
        setExcelParseError('Unable to read data from the file.')
        return
      }
      const header = rows[0].map(formatExcelVal)
      const body = rows.slice(1).map((row) => row.map(formatExcelVal))
      const rowObjects = body.map((row) => {
        const objectRow = {}
        header.forEach((key, index) => {
          objectRow[key] = row[index] ?? ''
        })
        return objectRow
      })

      const projectId = project?.id || project?.projectId
      if (projectId) {
        try {
          await recruiterAPI.updateWrittenExamData(projectId, { data: rowObjects })
          await fetchWrittenExamData(projectId)
          setShowExcelPreview(true)
          setExcelPreviewSource('api')
        } catch (err) {
          console.warn('Failed to save uploaded rows', err)
          setExcelParseError('Unable to upload rows. Please try again.')
        }
      } else {
        // No project yet: fall back to local preview for create flow
        setExcelPreview(createPreviewFromObjectRows(rowObjects))
        setExcelPreviewSource('file')
        // For written exam create, don't show modal - data will be posted directly on create
        if (projectType !== 'writtenExam') {
          setShowExcelPreview(true)
        }
      }
    } catch (err) {
      setExcelParseError('Unable to parse the uploaded file. Please use a valid Excel or CSV file.')
    }
  }

  const cleanProjectLocations = () => projectLocations
    .filter((location) => location.address.trim())
    .map((location) => {
      if (isWrittenProject(projectType)) {
        return { address: location.address.trim() }
      }
      // Preserve existing location identifiers when editing regular projects
      const locId = location.location_id ?? location.locationId
      return {
        ...(locId ? { location_id: locId } : {}),
        address: location.address.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        mapLocation: location.mapLocation,
      }
    })

  const buildFileFromPreview = (preview) => {
    const aoa = [preview.header, ...preview.rows]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const fileName = excelFile?.name || 'edited_written_exam.xlsx'
    return new File([arrayBuffer], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  const handleExcelPreviewCellChange = (rowIndex, colIndex, value) => {
    setExcelPreview((prev) => {
      if (!prev) return prev
      const rows = prev.rows.map((row, idx) => idx === rowIndex ? row.map((cell, colIdx) => colIdx === colIndex ? value : cell) : row)
      return { ...prev, rows }
    })
  }

  const handleDeleteRow = async (rowIndex) => {
    if (!window.confirm('Are you sure you want to delete this row? This action cannot be undone.')) {
      return
    }

    const projectId = project?.id || project?.projectId
    const idIndex = excelPreview?.header.findIndex((h) => h.toLowerCase() === 'id')
    const rowId = (idIndex !== -1 && excelPreview?.rows[rowIndex]) ? excelPreview.rows[rowIndex][idIndex] : null

    if (projectId && rowId) {
      setPreviewLoading(true)
      try {
        await recruiterAPI.deleteWrittenExamRow(projectId, rowId)
        // Refresh data from server to ensure synchronization
        await fetchWrittenExamData(projectId)
      } catch (err) {
        console.error('Failed to delete row:', err)
        setErrors({ form: 'Unable to delete row from server. Please try again.' })
      } finally {
        setPreviewLoading(false)
      }
    } else {
      // Local removal for unsaved rows
      setExcelPreview((prev) => {
        if (!prev) return prev
        const rows = prev.rows.filter((_, idx) => idx !== rowIndex)
        return { ...prev, rows }
      })
    }
  }

  const handleAddRow = () => {
    setExcelPreview((prev) => {
      if (!prev) return prev
      const newRow = new Array(prev.header.length).fill('')
      const rows = [...prev.rows, newRow]
      return { ...prev, rows }
    })
  }

  const saveRowSeparately = async (rowIndex) => {
    if (!project) {
      setErrors({ form: 'Project must be saved before saving rows individually.' })
      return
    }

    const projectId = project.id || project.projectId
    if (!projectId) {
      setErrors({ form: 'Missing project ID for row save.' })
      return
    }

    if (!excelPreview || !excelPreview.rows[rowIndex] || !excelPreview.header) return

    const idIndex = excelPreview.header.findIndex((h) => h.toLowerCase() === 'id')
    const isNewRow = idIndex !== -1 ? !excelPreview.rows[rowIndex][idIndex] : true

    setRowSaveStatus((prev) => ({
      ...prev,
      [rowIndex]: { loading: true, saved: false, error: null },
    }))

    const rowObject = {}
    excelPreview.header.forEach((key, index) => {
      rowObject[key] = excelPreview.rows[rowIndex][index] ?? ''
    })

    try {
      if (isNewRow) {
        await recruiterAPI.updateWrittenExamData(projectId, { data: [rowObject] })
      } else {
        await recruiterAPI.saveWrittenExamRow(projectId, rowObject)
      }
      await fetchWrittenExamData(projectId)
      setRowSaveStatus({})
      setExcelPreviewSource('api')
    } catch (err) {
      setRowSaveStatus((prev) => ({
        ...prev,
        [rowIndex]: { loading: false, saved: false, error: 'Unable to save row' },
      }))
      setErrors({ form: 'Unable to save row individually. Please try again.' })
    }
  }

  const handleDownloadExcel = () => {
    if (!excelPreview) return
    const aoa = [excelPreview.header, ...excelPreview.rows]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, excelFile?.name || 'edited_excel.xlsx')
  }

  const buildFormPayload = () => {
    const payload = {
      ...form,
      projectType: projectType === 'writtenExam' ? 'written' : projectType,
      projectKind: projectType === 'regular' ? projectKind : 'Written',
      projectLocations: projectType === 'regular' ? cleanProjectLocations() : undefined,
      workingDays: Object.keys(workingDays).filter((day) => workingDays[day]),
      userId: user?.userId,
    }

    if (projectType === 'writtenExam' && excelPreview?.rows?.length > 0 && !isEditing) {
      const rowObjects = excelPreview.rows.map((row) => {
        const objectRow = {}
        excelPreview.header.forEach((key, index) => {
          objectRow[key] = row[index] ?? ''
        })
        return objectRow
      })
      payload.writtenExamData = rowObjects
    }

    return payload
  }


  const buildFormData = (payload) => {
    const formData = new FormData()
    const appendValue = (key, value) => {
      if (value === undefined || value === null) return
      if (value instanceof File) {
        formData.append(key, value)
      } else if (Array.isArray(value) || typeof value === 'object') {
        formData.append(key, JSON.stringify(value))
      } else {
        formData.append(key, value)
      }
    }
    Object.entries(payload).forEach(([key, value]) => appendValue(key, value))
    return formData
  }

  const validate = () => {
    const nextErrors = {}
    if (!form.projectName) nextErrors.projectName = 'Project name is required.'
    if (!form.clientName) nextErrors.clientName = 'Client name is required.'
    if (projectType === 'regular' && !projectLocations.some((location) => location.address.trim())) nextErrors.projectLocations = 'Add at least one location with an address.'
    if (!form.startDate) nextErrors.startDate = 'Start date is required.'
    if (!form.endDate) nextErrors.endDate = 'End date is required.'
    if (!form.mobile) nextErrors.mobile = 'Mobile number is required.'
    if (!form.email) nextErrors.email = 'Email is required.'
    if (isWrittenProject(projectType) && !(excelPreview?.rows?.length > 0)) {
      nextErrors.excelFile = 'Please upload or add at least one exam centre row.'
    }
    return nextErrors
  }

  const handleSubmit = async () => {
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setLoading(true)
    setErrors({})

    const payload = buildFormPayload()
    let requestData = payload

    if (!isEditing && isWrittenProject(projectType)) {
      requestData = buildFormData({ ...payload, excelFile })
    } else if (isEditing && projectType === 'writtenExam') {
      requestData = payload
    } else if (!isEditing) {
      requestData = buildFormData(payload)
    }

    try {
      if (isEditing) {
        await recruiterAPI.updateProject(project.id || project.projectId, requestData)
      } else {
        if (projectType === 'regular') {
          await recruiterAPI.createRegularProject(requestData)
        } else if (projectType === 'writtenExam') {
          await recruiterAPI.createWrittenExamProject(requestData)
        }
      }
      handleClose() // Global toast handled the message, close the modal immediately
    } catch (error) {
      // Errors are handled by the global toast interceptor in axios.js
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={isEditing ? "Edit Project" : "Create Project"}
      footer={(
        <>
          <button className="btn btn-outline" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || fetchLoading}>
            {loading ? (isEditing ? 'Updating…' : 'Creating…') : (isEditing ? 'Update Project' : 'Create Project')}
          </button>
        </>
      )}
      maxWidth="700px"
    >
      {fetchLoading ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>Loading project data…</div>
      ) : (
        <>
          <div className="project-type-toggle">
            <button
              type="button"
              className={`btn btn-sm ${projectType === 'regular' ? 'active' : 'btn-outline'}`}
              onClick={() => setProjectType('regular')}
              disabled={isEditing}
            >
              Regular project
            </button>
            <button
              type="button"
              className={`btn btn-sm ${projectType === 'writtenExam' ? 'active' : 'btn-outline'}`}
              onClick={() => setProjectType('writtenExam')}
              disabled={isEditing}
            >
              Written exam project
            </button>
          </div>

          {projectType === 'writtenExam' && (
            <input type="hidden" value="Written" />
          )}

          {errors.form && <div className="alert-error">{errors.form}</div>}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Project Name</label>
              <input className={`form-control${errors.projectName ? ' invalid' : ''}`} value={form.projectName} onChange={(e) => updateField('projectName', e.target.value)} placeholder="Project name" />
              {errors.projectName && <div className="field-error">{errors.projectName}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Client Name</label>
              <input
                className={`form-control${errors.clientName ? ' invalid' : ''}`}
                list="client-options"
                value={form.clientName}
                onChange={(e) => updateField('clientName', e.target.value)}
                placeholder="Select or type a client"
              />
              <datalist id="client-options">
                {clientOptions.map((client, index) => {
                  const label = getClientOptionLabel(client)
                  if (!label) return null
                  return <option key={`${label}-${index}`} value={label} />
                })}
              </datalist>
              {errors.clientName && <div className="field-error">{errors.clientName}</div>}
            </div>
          </div>

          {projectType === 'regular' && (
            <div className="form-group">
              <label className="form-label">Project Type</label>
              <select className="form-control" value={projectKind} onChange={(e) => setProjectKind(e.target.value)}>
                <option value="">Select project type</option>
                {PROJECT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`type-bar ${'type-' + (projectKind || '').toLowerCase().replace(/\s+/g, '-')}`} />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{projectKind || '—'}</span>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group" ref={designationRef} style={{ position: 'relative' }}>
              <label className="form-label">Designations</label>
              <div 
                className={`form-control custom-multiselect-trigger${errors.designation ? ' invalid' : ''}`}
                onClick={() => setIsDesignationDropdownOpen(!isDesignationDropdownOpen)}
                style={{ cursor: 'pointer', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '90%', minHeight: '24px', alignItems: 'center' }}>
                  {form.designation?.length > 0 ? form.designation.map((item) => (
                    <span key={item} style={{ padding: '4px 8px', borderRadius: '999px', background: '#e6f4ff', color: '#0a4d8c', fontSize: '12px', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item}
                    </span>
                  )) : (
                    <span style={{ color: 'var(--text3)' }}>Select designations</span>
                  )}
                </div>
                <FontAwesomeIcon icon={isDesignationDropdownOpen ? faPlus : faMinus} style={{ fontSize: '10px' }} />
                
                {isDesignationDropdownOpen && (
                  <div className="custom-multiselect-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'white', border: '1px solid #ddd', borderRadius: '4px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', padding: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {designationOptions.map((option) => (
                      <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer', margin: 0, fontSize: '13px' }} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={form.designation?.includes(option)} 
                          onChange={() => handleDesignationToggle(option)}
                          style={{ cursor: 'pointer' }}
                        />
                        {option}
                      </label>
                    ))}
                    {designationOptions.length === 0 && <div style={{ padding: '8px', textAlign: 'center', color: '#888' }}>No options found</div>}
                  </div>
                )}
              </div>
              {errors.designation && <div className="field-error">{errors.designation}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Required Candidates</label>
              <input className="form-control" type="number" min="0" value={form.requiredCandidates} onChange={(e) => updateField('requiredCandidates', e.target.value)} placeholder="Number of candidates" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className={`form-control${errors.startDate ? ' invalid' : ''}`} type="date" value={form.startDate} onChange={(e) => updateField('startDate', e.target.value)} />
              {errors.startDate && <div className="field-error">{errors.startDate}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className={`form-control${errors.endDate ? ' invalid' : ''}`} type="date" value={form.endDate} onChange={(e) => updateField('endDate', e.target.value)} />
              {errors.endDate && <div className="field-error">{errors.endDate}</div>}
            </div>
          </div>

          {projectType === 'regular' && (
            <div className="form-group">
            <label className="form-label">Project Locations</label>
            {projectLocations.map((location, index) => (
              <div key={index} style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontWeight: 500, fontSize: 14 }}>Location {index + 1}</label>
                  {projectLocations.length > 1 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => removeLocation(index)}>
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                  )}
                </div>
                
                <div style={{ marginBottom: 8 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Address</label>
                  <input
                    className="form-control"
                    value={location.address}
                    onChange={(e) => updateLocation(index, 'address', e.target.value)}
                    placeholder="Enter address"
                  />
                </div>

                {projectType === 'regular' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label className="form-label" style={{ fontSize: 12 }}>Latitude</label>
                        <input
                          className="form-control"
                          type="number"
                          step="0.000001"
                          value={location.latitude}
                          onChange={(e) => updateLocation(index, 'latitude', e.target.value)}
                          placeholder="e.g., 40.7128"
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: 12 }}>Longitude</label>
                        <input
                          className="form-control"
                          type="number"
                          step="0.000001"
                          value={location.longitude}
                          onChange={(e) => updateLocation(index, 'longitude', e.target.value)}
                          placeholder="e.g., -74.0060"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: 12 }}>Map Location</label>
                      <input
                        className="form-control"
                        value={location.mapLocation}
                        onChange={(e) => updateLocation(index, 'mapLocation', e.target.value)}
                        placeholder="Enter map location or coordinates"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={addLocation} style={{ marginTop: 6 }}>
              <FontAwesomeIcon icon={faPlus} /> Add location
            </button>
            {errors.projectLocations && <div className="field-error">{errors.projectLocations}</div>}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Amount</label>
              <select className="form-control" value={form.salary} onChange={(e) => updateField('salary', e.target.value)}>
                {AMOUNT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="form-group checkbox-grid">
              <label className="form-label">Working Days</label>
              <div className="working-days-grid">
                {WORKING_DAYS.map((day) => (
                  <label key={day} className="checkbox-inline">
                    <input type="checkbox" checked={workingDays[day]} onChange={() => toggleDay(day)} /> {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">About Us</label>
            <textarea className="form-control" value={form.about} onChange={(e) => updateField('about', e.target.value)} placeholder="About the project or client" rows={3} />
          </div>

          <div className="form-group">
            <label className="form-label">Job Description</label>
            <textarea className="form-control" value={form.jobDescription} onChange={(e) => updateField('jobDescription', e.target.value)} placeholder="Job description" rows={4} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-control" value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Address" />
            </div>
            <div className="form-group">
              <label className="form-label">Website Link</label>
              <input className="form-control" type="url" value={form.website} onChange={(e) => updateField('website', e.target.value)} placeholder="Website URL" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dress Code</label>
              <select className="form-control" value={form.dressCode} onChange={(e) => updateField('dressCode', e.target.value)}>
                <option value="">Select dress code</option>
                {DRESS_CODES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">E-mail ID</label>
              <input className={`form-control${errors.email ? ' invalid' : ''}`} type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Email address" />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input className={`form-control${errors.mobile ? ' invalid' : ''}`} type="tel" value={form.mobile} onChange={(e) => updateField('mobile', e.target.value)} placeholder="Mobile number" />
              {errors.mobile && <div className="field-error">{errors.mobile}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input className="form-control" type="time" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input className="form-control" type="time" value={form.endTime} onChange={(e) => updateField('endTime', e.target.value)} />
            </div>
          </div>

          {projectType === 'writtenExam' && (
            <div className="form-group">
              <label className="form-label">Exam centre data</label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    // Create a sample Excel template
                    const templateData = [
                      ['s_no', 'date', 'district', 'centre_code', 'centre_name', 'supervisor', 'operator', 'videographer'],
                      ['1', '17-04-2026', 'Chennai', 'CC003', 'Anna Nagar Examination Centre', '2', '1', '1']
                    ]

                    const ws = XLSX.utils.aoa_to_sheet(templateData)
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, 'Exam Centers')

                    // Auto-size columns
                    const colWidths = [
                      { wch: 8 },  // s_no
                      { wch: 15 }, // date
                      { wch: 20 }, // district
                      { wch: 15 }, // centre_code
                      { wch: 30 }, // centre_name
                      { wch: 12 }, // supervisor
                      { wch: 12 }, // operator
                      { wch: 12 }  // videographer
                    ]
                    ws['!cols'] = colWidths

                    XLSX.writeFile(wb, 'written_exam_centres_template.xlsx')
                  }}
                >
                  <FontAwesomeIcon icon={faDownload} /> Download Template
                </button>
              </div>
              <input className={`form-control${errors.excelFile ? ' invalid' : ''}`} type="file" accept=".xls,.xlsx,.csv" onChange={handleFileChange} />
              <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                Upload an Excel or CSV to include rows for creation. Preview edit is only available after the written exam project exists.
              </div>
              {excelPreview && (
                <div className="excel-file-actions" style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="text-sm">{excelFile?.name || 'Existing data loaded'}</div>
                  <div className="text-sm">Rows loaded: {excelPreview.rows.length}</div>
                  {(isEditing || projectType !== 'writtenExam') && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowExcelPreview(true)}>
                      Edit in UI
                    </button>
                  )}
                </div>
              )}
              {errors.excelFile && <div className="field-error">{errors.excelFile}</div>}
              {excelParseError && <div className="field-error">{excelParseError}</div>}
            </div>
          )}

        </>
      )}
    </Modal>

      <ExcelPreviewModal
        isOpen={showExcelPreview && !!excelPreview}
        onClose={() => setShowExcelPreview(false)}
        onCellChange={handleExcelPreviewCellChange}
        onDeleteRow={handleDeleteRow}
        onAddRow={handleAddRow}
        onDownload={handleDownloadExcel}
        onUploadRows={handleFileChange}
        onSaveRow={saveRowSeparately}
        rowSaveStatus={rowSaveStatus}
        projectId={project?.id || project?.projectId}
        preview={excelPreview}
        fileName={excelFile?.name || 'Excel file'}
        search={previewSearch}
        district={previewDistrict}
        centre={previewCentre}
        districtOptions={previewDistrictOptions}
        centreOptions={previewCentreOptions}
        offset={previewOffset}
        limit={previewLimit}
        totalCount={previewTotalCount}
        isLoading={previewLoading}
        onSearchChange={handlePreviewSearchChange}
        onDistrictChange={handlePreviewDistrictChange}
        onCentreChange={handlePreviewCentreChange}
        onLimitChange={handlePreviewLimitChange}
        onPageChange={handlePreviewPageChange}
      />
    </>
  )
}

function ExcelPreviewModal({ isOpen, onClose, onCellChange, onDeleteRow, onAddRow, onDownload, onUploadRows, onSaveRow, rowSaveStatus, projectId, preview, fileName, search, district, centre, districtOptions, centreOptions, offset, limit, totalCount, isLoading, onSearchChange, onDistrictChange, onCentreChange, onLimitChange, onPageChange }) {
  if (!isOpen) return null

  const rows = Array.isArray(preview?.rows) ? preview.rows : []
  const idIndex = preview.header.findIndex((h) => h.toLowerCase() === 'id')
  const currentPage = limit ? Math.floor(offset / limit) + 1 : 1
  const totalPages = limit && totalCount != null ? Math.max(1, Math.ceil(totalCount / limit)) : 1

  const paginationButtons = []
  if (totalPages > 0) {
    const startPage = Math.max(1, currentPage - 2)
    const endPage = Math.min(totalPages, currentPage + 2)

    if (startPage > 1) {
      paginationButtons.push(1)
      if (startPage > 2) paginationButtons.push('start-ellipsis')
    }

    for (let page = startPage; page <= endPage; page += 1) {
      paginationButtons.push(page)
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) paginationButtons.push('end-ellipsis')
      paginationButtons.push(totalPages)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Excel Preview" maxWidth="1200px"
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={onDownload}>
              <FontAwesomeIcon icon={faDownload} /> Download Excel
            </button>
            <button className="btn btn-outline" onClick={onAddRow}>
              <FontAwesomeIcon icon={faPlus} /> Add Row
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      )}>
      <div className="form-group">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input
            className="form-control"
            type="text"
            placeholder="Search rows..."
            value={search ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          <select
            className="form-control"
            value={district ?? ''}
            onChange={(e) => onDistrictChange?.(e.target.value)}
          >
            <option value="">{districtOptions.length ? 'Select district' : 'Loading districts...'}</option>
            {districtOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          <select
            className="form-control"
            value={centre ?? ''}
            onChange={(e) => onCentreChange?.(e.target.value)}
            disabled={!district || centreOptions.length === 0}
          >
            <option value="">{district ? (centreOptions.length ? 'Select centre' : 'Loading centres...') : 'Select a district first'}</option>
            {centreOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          <select
            className="form-control"
            value={limit}
            onChange={(e) => onLimitChange?.(Number(e.target.value))}
            style={{ minWidth: 120 }}
          >
            {[10, 25, 50, 100].map((option) => (
              <option key={option} value={option}>{option} rows</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <strong>{totalCount != null ? `${totalCount} rows` : `${rows.length} rows`}</strong>
            {projectId && totalCount != null && <span> · Page {currentPage} of {totalPages}</span>}
          </div>
          {onUploadRows && (
            <label className="btn btn-outline btn-sm" style={{ margin: 0 }}>
              <input type="file" accept=".xls,.xlsx,.csv" onChange={onUploadRows} style={{ display: 'none' }} />
              <FontAwesomeIcon icon={faUpload} /> Upload more rows
            </label>
          )}
        </div>

        <div className="excel-table-wrap">
          <table className="excel-preview-table">
            <thead>
              <tr>
                {preview.header.map((heading, idx) => (
                  <th key={idx}>{heading || `Column ${idx + 1}`}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const saveStatus = rowSaveStatus?.[rowIndex] || {}
                const isNewRow = idIndex !== -1 ? !row[idIndex] : true
                return (
                  <tr key={rowIndex}>
                    {preview.header.map((headerKey, colIndex) => (
                      <td key={colIndex}>
                        <input
                          className="form-control"
                          value={row[colIndex] ?? ''}
                          onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
                          disabled={headerKey === 'id'}
                          placeholder={headerKey === 'id' ? 'Assigned by server' : ''}
                        />
                      </td>
                    ))}
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {onSaveRow && projectId && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onSaveRow(rowIndex)}
                          disabled={saveStatus.loading}
                          title={isNewRow ? "Create this row" : "Save this row"}
                        >
                          {saveStatus.loading ? 'Saving…' : saveStatus.saved ? 'Saved' : isNewRow ? 'Create' : 'Save'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onDeleteRow(rowIndex)}
                        title="Delete row"
                      >
                        <FontAwesomeIcon icon={faMinus} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            disabled={isLoading || currentPage <= 1}
            onClick={() => onPageChange?.(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          {paginationButtons.map((page, index) => {
            if (page === 'start-ellipsis' || page === 'end-ellipsis') {
              return <span key={`${page}-${index}`} style={{ padding: '0 6px' }}>…</span>
            }
            const isCurrent = page === currentPage
            return (
              <button
                key={page}
                type="button"
                className={`btn btn-outline btn-sm${isCurrent ? ' active' : ''}`}
                disabled={isLoading || isCurrent}
                onClick={() => onPageChange?.((page - 1) * limit)}
              >
                {page}
              </button>
            )
          })}
          <button
            className="btn btn-outline btn-sm"
            type="button"
            disabled={isLoading || currentPage >= totalPages}
            onClick={() => onPageChange?.(Math.min((totalPages - 1) * limit, offset + limit))}
          >
            Next
          </button>
        </div>
      </div>
    </Modal>
  )
}
