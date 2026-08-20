import { useState, useEffect, useRef } from 'react'
import { Card, Button, Modal, LoadingOverlay } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'

// Import Chart.js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

// Import flatpickr
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.min.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const normalizeHeader = (value) =>
  String(value || '')
    .replace(/^\uFEFF/, '') // remove BOM if present
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, '') // strip surrounding quotes
    .replace(/\s+/g, '_')

const parseCsvHeaderRow = (line) => {
  const headers = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"' || char === "'") {
      if (inQuotes && nextChar === char) {
        current += char
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      headers.push(current)
      current = ''
      continue
    }

    current += char
  }

  headers.push(current)

  return headers
    .map((h) => normalizeHeader(h))
    .filter(Boolean)
}

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

export default function RecipientsDatabase() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fileInputRef = useRef(null)
  const { alert, confirm } = useAlert()

  // Mapping modal state
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState([]) // [{ original, normalized }]
  const [fieldMappings, setFieldMappings] = useState({})
  const [selectedPortalId, setSelectedPortalId] = useState('')

  // Dashboard state
  const [currentParams, setCurrentParams] = useState({ range: 'today' })
  const [originalParams, setOriginalParams] = useState(null)
  const [metrics, setMetrics] = useState({
    totalCandidates: { value: '-', loading: true },
    activePortals: { value: '-', loading: true },
    uploads: { value: '-', loading: true }
  })
  const [portalDistribution, setPortalDistribution] = useState([])
  const [chartData, setChartData] = useState(null)
  const [chartTimeframe, setChartTimeframe] = useState('Daily')
  const [selectedDateRange, setSelectedDateRange] = useState('Select Date Range')
  const [drillPath, setDrillPath] = useState('')
  const datePickerRef = useRef(null)
  const flatpickrInstance = useRef(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const pResp = await recruiterAPI.getProjectSuggestions('', 200)
        const pData = pResp?.data ?? {}
        const raw = Array.isArray(pData?.data) ? pData.data : Array.isArray(pData) ? pData : []
        if (mounted) {
          // kept for existing dashboard behavior even if not rendered here
          raw.map((it) => it).filter(Boolean)
        }
      } catch (e) {
        // ignore
      }

      try {
        const cResp = await recruiterAPI.getCallers({ limit: 500 })
        const cData = cResp?.data?.data || cResp?.data || {}
        const items = cData.items || cData.callers || []
        if (mounted) {
          items.map((it) => it).filter(Boolean)
        }
      } catch (e) {
        // ignore
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  // Load dashboard data on mount and when params change
  useEffect(() => {
    fetchAllDashboardData(currentParams)
  }, [currentParams])

  // Automatically fetch suggested field mappings when the mapping modal opens
  useEffect(() => {
    if (showMappingModal && selectedPortalId && csvHeaders.length > 0) {
      const fetchAutoMappings = async () => {
        try {
          const res = await recruiterAPI.getPortalFieldMappings(selectedPortalId)

          // Handle various JSON shapes:
          // { data: { mappings: {} } } or { mappings: {} } or {}
          const responseData = res.data?.data || res.data || {}
          const suggested =
            responseData.mappings ||
            (typeof responseData === 'object' && !Array.isArray(responseData) ? responseData : {})

          console.log('CSV Headers from file:', csvHeaders)
          console.log('Suggested mappings from API:', suggested)

          setFieldMappings((prev) => {
            const next = {}

            // Initialize only with normalized keys
            csvHeaders.forEach(({ normalized }) => {
              next[normalized] = prev[normalized] || ''
            })

            Object.entries(suggested).forEach(([csvHeader, candidateField]) => {
              const normalizedHeader = normalizeHeader(csvHeader)

              if (hasOwn(next, normalizedHeader)) {
                next[normalizedHeader] = candidateField
              } else {
                console.warn(
                  `API suggested mapping for CSV header "${csvHeader}" (normalized to "${normalizedHeader}") but no exact match found in uploaded CSV headers.`
                )
              }
            })

            return next
          })
        } catch (err) {
          console.error('Failed to fetch auto-mappings for portal:', err)
        }
      }

      fetchAutoMappings()
    }
  }, [showMappingModal, selectedPortalId, csvHeaders])

  // Initialize flatpickr
  useEffect(() => {
    if (datePickerRef.current && !flatpickrInstance.current) {
      flatpickrInstance.current = flatpickr(datePickerRef.current, {
        mode: 'range',
        dateFormat: 'M j, Y',
        maxDate: 'today',
        showMonths: 1,
        onClose: function (selectedDates) {
          if (selectedDates.length === 2) {
            const startDate = selectedDates[0]
            const endDate = selectedDates[1]

            const formattedStart = formatDate(startDate)
            const formattedEnd = formatDate(endDate)

            setSelectedDateRange(`${formattedStart} - ${formattedEnd}`)
            setOriginalParams(null)
            setDrillPath('')

            const newParams = {
              start_date: formatDateForAPI(startDate),
              end_date: formatDateForAPI(endDate)
            }

            setCurrentParams(newParams)
          }
        }
      })
    }

    return () => {
      if (flatpickrInstance.current) {
        flatpickrInstance.current.destroy()
        flatpickrInstance.current = null
      }
    }
  }, [])

  const handleFilesChange = (files) => {
    const f = files?.[0]
    if (!f) {
      setFile(null)
      return
    }

    const allowed = ['text/csv', 'application/vnd.ms-excel', 'application/csv']
    if (!allowed.includes(f.type) && !f.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file')
      setFile(null)
      return
    }

    if (f.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)')
      setFile(null)
      return
    }

    setError('')
    setFile(f)
  }

  const clearSelectedFile = () => {
    setFile(null)
    try {
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      // ignore
    }
  }

  const downloadSampleCsv = () => {
    const rows = [
      ['district', 'center_code', 'center_name', 'designation', 'full_name', 'phone', 'aadhaar'],
      ['Kanchipuram', 'CC001', 'Kanchipuram High School', 'Operator', 'testing1', '9514698450', '568978451232'],
      ['Kanchipuram', 'CC002', 'Kanchipuram High School', 'Supervisor', 'Manisha', '7305416997', '594942822619'],
      ['Kanchipuram', 'CC001', 'Kanchipuram High School', 'Operator', 'Sriman', '8428643716', '510521420006']
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'sample_recipients.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleMappingSubmit = async () => {
    setLoading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('csv_file', file)
      uploadFormData.append('portal_id', selectedPortalId)

      // Send normalized CSV header keys
      Object.entries(fieldMappings).forEach(([csvField, candidateField]) => {
        if (candidateField && candidateField !== 'extra') {
          uploadFormData.append(`mapping[${csvField}]`, candidateField)
        }
      })

      await recruiterAPI.uploadRecipients(uploadFormData)
      setSuccess(`Uploaded ${file.name} successfully`)
      setFile(null)
      setShowMappingModal(false)
      setFieldMappings({})
      setCsvHeaders([])

      setTimeout(() => {
        fetchAllDashboardData(currentParams)
        setSuccess('')
      }, 1000)
    } catch (err) {
      setError(err?.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldMappingChange = (csvField, value) => {
    if (
      value &&
      value !== 'extra' &&
      Object.values(fieldMappings).includes(value) &&
      fieldMappings[csvField] !== value
    ) {
      alert('This field is already mapped. Please select a different field or choose "Extra (Ignore)".')
      return
    }

    setFieldMappings((prev) => ({
      ...prev,
      [csvField]: value
    }))
  }

  const candidateFields = [
    { value: '', label: 'Select Field' },
    { value: 'source', label: "Portal Source (e.g., 'Naukri')" },
    { value: 'source_candidate_id', label: 'Source Candidate ID' },
    { value: 'full_name', label: 'Full Name' },
    { value: 'gender', label: 'Gender' },
    { value: 'date_of_birth', label: 'Date of Birth' },
    { value: 'age', label: 'Age' },
    { value: 'marital_status', label: 'Marital Status' },
    { value: 'languages', label: 'Languages' },
    { value: 'english_proficiency', label: 'English Proficiency' },
    { value: 'passport', label: 'Passport (Yes/No or Number)' },
    { value: 'work_permit_usa', label: 'Work Permit for USA' },
    { value: 'email', label: 'Email' },
    { value: 'alternate_email', label: 'Alternate Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'alternate_phone', label: 'Alternate Phone' },
    { value: 'address', label: 'Address' },
    { value: 'current_city', label: 'Current City' },
    { value: 'current_location', label: 'Current Location (detailed)' },
    { value: 'preferred_location', label: 'Preferred Location' },
    { value: 'pin_code', label: 'PIN Code' },
    { value: 'hometown', label: 'Hometown' },
    { value: 'resume_title', label: 'Resume Title' },
    { value: 'resume_headline', label: 'Resume Headline' },
    { value: 'summary', label: 'Profile Summary' },
    { value: 'profile_link', label: 'Profile Link' },
    { value: 'resume_link', label: 'Resume Link' },
    { value: 'key_skills', label: 'Key Skills' },
    { value: 'total_experience_years', label: 'Total Experience (Years)' },
    { value: 'current_job_title', label: 'Current Job Title' },
    { value: 'current_company', label: 'Current Company' },
    { value: 'current_salary', label: 'Current Salary (Annual)' },
    { value: 'notice_period', label: 'Notice Period' },
    { value: 'functional_area', label: 'Functional Area' },
    { value: 'role', label: 'Role' },
    { value: 'industry', label: 'Industry' },
    { value: 'department', label: 'Department' },
    { value: 'previous_job_title', label: 'Previous Job Title' },
    { value: 'previous_company', label: 'Previous Company' },
    { value: 'previous_experience_years', label: 'Previous Experience (Years)' },
    { value: 'years_in_current_job', label: 'Years in Current Job' },
    { value: 'ug_degree', label: 'UG Degree' },
    { value: 'ug_specialization', label: 'UG Specialization' },
    { value: 'ug_university', label: 'UG University/Institute' },
    { value: 'ug_graduation_year', label: 'UG Graduation Year' },
    { value: 'pg_degree', label: 'PG Degree' },
    { value: 'pg_specialization', label: 'PG Specialization' },
    { value: 'pg_university', label: 'PG University/Institute' },
    { value: 'pg_graduation_year', label: 'PG Graduation Year' },
    { value: 'doctorate_degree', label: 'Doctorate Degree' },
    { value: 'doctorate_specialization', label: 'Doctorate Specialization' },
    { value: 'doctorate_university', label: 'Doctorate University/Institute' },
    { value: 'doctorate_graduation_year', label: 'Doctorate Graduation Year' },
    { value: 'highest_education_level', label: 'Highest Education Level' },
    { value: 'education_details', label: 'Education Details (extra)' },
    { value: 'candidate_status', label: 'Candidate Status' },
    { value: 'remarks', label: 'Remarks' },
    { value: 'last_active_date', label: 'Last Active Date' },
    { value: 'applied_date', label: 'Applied Date' },
    { value: 'unlocked_at', label: 'Unlocked At' },
    { value: 'viewed_before', label: 'Viewed Before (Yes/No)' },
    { value: 'downloaded_before', label: 'Downloaded Before (Yes/No)' },
    { value: 'source_of_application', label: 'Source of Application' },
    { value: 'date_of_application', label: 'Date of Application' },
    { value: 'own_two_wheeler', label: 'Owns Two Wheeler (Yes/No)' },
    { value: 'preferences', label: 'Job Preferences' },
    { value: 'note', label: 'Note' },
    { value: 'district', label: 'district' },
    { value: 'center_code', label: 'center_code' },
    { value: 'center_name', label: 'center_name' },
    { value: 'designation', label: 'designation' },
    { value: 'aadhaar', label: 'aadhaar' },
    { value: 'extra', label: 'Extra Field (JSON – catch-all)' }
  ]

  const validateHeaders = (f) =>
    new Promise((resolve) => {
      const reader = new FileReader()

      reader.onload = () => {
        const text = String(reader.result || '')
        const firstLine = (text.split(/\r?\n/)[0] || '').trim()
        const normalizedHeaders = parseCsvHeaderRow(firstLine)

        const hasName = normalizedHeaders.some((h) => h.includes('name'))
        const hasNumber = normalizedHeaders.some(
          (h) => h.includes('number') || h.includes('mobile') || h.includes('phone')
        )

        resolve({
          ok: hasName && hasNumber,
          headers: normalizedHeaders.map((h) => ({
            original: h,
            normalized: h
          }))
        })
      }

      reader.onerror = () => resolve({ ok: false, headers: [] })

      const blob = f.slice(0, 64 * 1024)
      reader.readAsText(blob)
    })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const formData = new FormData(e.target)
    const portalId = formData.get('portal_id')

    if (!portalId) {
      await alert('Please select a portal')
      return
    }

    if (!file) {
      await alert('Please select a CSV file to upload')
      return
    }

    setLoading(true)
    try {
      const { ok, headers } = await validateHeaders(file)

      if (!ok) {
        const preview = headers.map((h) => h.original).join(', ')
        const proceed = await confirm(`CSV headers look unexpected: ${preview || 'No headers found'}. Continue upload?`)
        if (!proceed) {
          setLoading(false)
          return
        }
      }

      setSelectedPortalId(portalId)

      const parsedHeaders = headers.map((h) => ({
        original: h.original,
        normalized: normalizeHeader(h.normalized || h.original)
      }))

      setCsvHeaders(parsedHeaders)

      const initialMappings = {}
      parsedHeaders.forEach(({ normalized }) => {
        initialMappings[normalized] = ''
      })
      setFieldMappings(initialMappings)

      setLoading(false)
      setShowMappingModal(true)
    } catch (err) {
      setError(err?.message || 'Upload failed')
      setLoading(false)
    }
  }

  // Dashboard functions
  const fetchAllDashboardData = async (params) => {
    fetchTotalCandidates(params)
    fetchActivePortals(params)
    fetchUploads(params)
    fetchPortalDistribution(params)
    updateTimeframeDisplay(params)
    fetchChartData(params)
  }

  const updateTimeframeDisplay = (params) => {
    let timeframe = 'Daily'

    if (params.range === 'today' || params.range === 'yesterday') {
      timeframe = 'Hourly'
    } else if (params.start_date && params.end_date) {
      const start = new Date(params.start_date)
      const end = new Date(params.end_date)
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))

      if (diffDays <= 1) {
        timeframe = 'Hourly'
      } else if (diffDays > 31) {
        timeframe = 'Weekly'
      }
    }

    setChartTimeframe(timeframe)
  }

  const fetchTotalCandidates = async (params) => {
    setMetrics((prev) => ({ ...prev, totalCandidates: { ...prev.totalCandidates, loading: true } }))
    try {
      const response = await recruiterAPI.getTotalCandidates(params)
      const value = response?.data?.value || response?.data?.count || 0
      setMetrics((prev) => ({
        ...prev,
        totalCandidates: { value: value.toLocaleString(), loading: false }
      }))
    } catch (error) {
      console.error('Error fetching total candidates:', error)
      setMetrics((prev) => ({ ...prev, totalCandidates: { value: '-', loading: false } }))
    }
  }

  const fetchActivePortals = async (params) => {
    setMetrics((prev) => ({ ...prev, activePortals: { ...prev.activePortals, loading: true } }))
    try {
      const response = await recruiterAPI.getActivePortals(params)
      const active = response?.data?.active || response?.data?.count || 0
      setMetrics((prev) => ({ ...prev, activePortals: { value: active, loading: false } }))
    } catch (error) {
      console.error('Error fetching active portals:', error)
      setMetrics((prev) => ({ ...prev, activePortals: { value: '-', loading: false } }))
    }
  }

  const fetchUploads = async (params) => {
    setMetrics((prev) => ({ ...prev, uploads: { ...prev.uploads, loading: true } }))
    try {
      const response = await recruiterAPI.getUploadsCount(params)
      const value = response?.data?.value || response?.data?.count || 0
      setMetrics((prev) => ({
        ...prev,
        uploads: { value: value.toLocaleString(), loading: false }
      }))
    } catch (error) {
      console.error('Error fetching uploads:', error)
      setMetrics((prev) => ({ ...prev, uploads: { value: '-', loading: false } }))
    }
  }

  const fetchPortalDistribution = async (params) => {
    try {
      const response = await recruiterAPI.getPortalDistribution(params)
      const data = Array.isArray(response?.data) ? response.data : response?.data?.data || []
      setPortalDistribution(data)
    } catch (error) {
      console.error('Error fetching portal distribution:', error)
      setPortalDistribution([])
    }
  }

  const fetchChartData = async (params) => {
    try {
      const response = await recruiterAPI.getImportStatistics(params)
      const chartData = response?.data?.data || response?.data || null
      if (chartData && chartData.labels && chartData.values) {
        setChartData(chartData)
      } else {
        setChartData(null)
      }
    } catch (error) {
      console.error('Error fetching chart data:', error)
      setChartData(null)
    }
  }

  const handleDateRangeClick = (range) => {
    setOriginalParams(null)
    setDrillPath('')
    setCurrentParams({ range })
    setSelectedDateRange('Select Date Range')
    if (flatpickrInstance.current) {
      flatpickrInstance.current.clear()
    }
  }

  const handleDrillBack = () => {
    if (originalParams) {
      setCurrentParams(originalParams)
      setOriginalParams(null)
      setDrillPath('')
    }
  }

  const formatDate = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
  }

  const formatDateForAPI = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1a1f36',
        titleColor: 'white',
        bodyColor: '#e8f0fe',
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function (context) {
            return `Imports: ${context.raw}`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#eef2f6'
        },
        ticks: {
          stepSize: 1,
          callback: function (value) {
            if (Math.floor(value) === value) {
              return value
            }
          }
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  }

  const chartDataConfig = chartData
    ? {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Imports',
            data: chartData.values,
            borderColor: '#2a5c9a',
            backgroundColor: 'rgba(42, 92, 154, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#2a5c9a',
            pointBorderColor: 'white',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: true
          }
        ]
      }
    : null

  return (
    <div style={{ margin: '0 auto', padding: '24px' }}>
      <LoadingOverlay active={loading} message="Importing recipients..." />

      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1a1f36', margin: 0 }}>
            Recipients Database
          </h1>
          <div style={{ color: '#5b6e8c', fontSize: '14px', marginTop: '4px' }}>
            Upload candidate data from recruitment portals
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'white',
            borderRadius: '8px',
            padding: '4px',
            border: '1px solid #eef2f6'
          }}
        >
          <button
            className={`date-btn ${currentParams.range === 'today' ? 'active' : ''}`}
            onClick={() => handleDateRangeClick('today')}
            type="button"
          >
            Today
          </button>
          <button
            className={`date-btn ${currentParams.range === 'yesterday' ? 'active' : ''}`}
            onClick={() => handleDateRangeClick('yesterday')}
            type="button"
          >
            Yesterday
          </button>
          <button
            className={`date-btn ${currentParams.range === '7days' ? 'active' : ''}`}
            onClick={() => handleDateRangeClick('7days')}
            type="button"
          >
            Last 7 days
          </button>
          <button
            className={`date-btn ${currentParams.range === '30days' ? 'active' : ''}`}
            onClick={() => handleDateRangeClick('30days')}
            type="button"
          >
            Last 30 days
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: '#f9fafc',
              borderRadius: '6px',
              border: '1px solid #eef2f6',
              minWidth: '240px',
              cursor: 'pointer'
            }}
            ref={datePickerRef}
          >
            <i className="bi bi-calendar3" style={{ color: '#8a9cb0' }}></i>
            <span style={{ flex: 1, color: '#1a1f36' }}>{selectedDateRange}</span>
            <i className="bi bi-chevron-down"></i>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div className={`metric-card ${metrics.totalCandidates.loading ? 'loading' : ''}`}>
          <div className="metric-header">
            <span className="metric-title">Total Candidates - All time</span>
            <div className="metric-icon blue">
              <i className="bi bi-people"></i>
            </div>
          </div>
          <div className="metric-value">{metrics.totalCandidates.value}</div>
          <div className="metric-trend">
            <i className="bi bi-arrow-up"></i> {metrics.totalCandidates.loading ? 'Loading...' : 'Active'}
          </div>
        </div>

        <div className={`metric-card ${metrics.activePortals.loading ? 'loading' : ''}`}>
          <div className="metric-header">
            <span className="metric-title">Active Portals</span>
            <div className="metric-icon purple">
              <i className="bi bi-grid"></i>
            </div>
          </div>
          <div className="metric-value">{metrics.activePortals.value}</div>
          <div className="metric-trend">
            <i className="bi bi-check-circle"></i> {metrics.activePortals.loading ? 'Loading...' : 'Active'}
          </div>
        </div>

        <div className={`metric-card ${metrics.uploads.loading ? 'loading' : ''}`}>
          <div className="metric-header">
            <span className="metric-title">Uploads</span>
            <div className="metric-icon green">
              <i className="bi bi-cloud-upload"></i>
            </div>
          </div>
          <div className="metric-value">{metrics.uploads.value}</div>
          <div className="metric-trend">
            <i className="bi bi-arrow-up"></i> {metrics.uploads.loading ? 'Loading...' : 'Completed'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', marginBottom: '24px' }}>
        <Card>
          <div style={{ padding: '18px 24px', background: '#f9fafc', borderBottom: '1px solid #eef2f6' }}>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#1a1f36',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="bi bi-upload" style={{ color: '#2a5c9a' }}></i>
              Upload CSV File
            </h3>
          </div>

          <div style={{ padding: '24px' }}>
            <form onSubmit={handleSubmit}>
              {error && (
                <div
                  style={{
                    color: '#dc2626',
                    fontSize: '13px',
                    padding: '16px',
                    textAlign: 'center',
                    background: '#fef2f2',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  style={{
                    color: '#1e7b4c',
                    fontSize: '13px',
                    padding: '16px',
                    textAlign: 'center',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    marginBottom: '20px'
                  }}
                >
                  {success}
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#344767', marginBottom: '6px' }}
                >
                  Select Portal
                </label>
                <select
                  className="form-select"
                  name="portal_id"
                  defaultValue=""
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #dfe5ef',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1a1f36',
                    background: 'white'
                  }}
                  required
                >
                  <option value="" disabled>
                    Choose portal
                  </option>
                  <option value="1">Work India</option>
                  <option value="2">Placement India</option>
                  <option value="7">Naukri</option>
                  <option value="4">Apna</option>
                  <option value="5">Shine</option>
                  <option value="3">Quikr</option>
                  <option value="8">Others</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#344767', marginBottom: '6px' }}
                >
                  Upload File
                </label>
                <div
                  style={{
                    border: '1px dashed #dfe5ef',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    background: '#f9fafc',
                    cursor: 'pointer'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i
                    className="bi bi-cloud-arrow-up"
                    style={{ fontSize: '24px', color: '#8a9cb0', marginBottom: '8px' }}
                  ></i>
                  <div style={{ fontSize: '13px', color: '#344767' }}>Click to browse or drag and drop</div>
                  <div style={{ fontSize: '12px', color: '#8a9cb0', marginTop: '4px' }}>CSV files only</div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".csv"
                    onChange={(e) => handleFilesChange(e.target.files)}
                    required
                  />
                  {file && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div style={{ background: '#eef2ff', padding: '8px 12px', borderRadius: 8 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1a1f36' }}>{file.name}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedFile}
                        style={{
                          background: 'transparent',
                          border: '1px solid #dfe5ef',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    style={{
                      background: '#eef2ff',
                      color: '#1a56db',
                      border: '1px solid #c7d2fe',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Download sample CSV
                  </button>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>
                    Get the expected file format for recipient imports.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  background: '#1a1f36',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 500,
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  width: '100%',
                  justifyContent: 'center'
                }}
              >
                <i className="bi bi-arrow-right"></i>
                Upload & Continue
              </button>
            </form>
          </div>
        </Card>

        <div>
          <Card style={{ height: 'fit-content' }}>
            <div style={{ padding: '18px 24px', background: '#f9fafc', borderBottom: '1px solid #eef2f6' }}>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#1a1f36',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="bi bi-pie-chart" style={{ color: '#2a5c9a' }}></i>
                Portal Distribution
              </h3>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ minHeight: '180px' }}>
                {portalDistribution.map((portal, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                      fontSize: '13px'
                    }}
                  >
                    <span style={{ color: '#1a1f36' }}>{portal.name}</span>
                    <span style={{ fontWeight: 500, color: '#1a1f36' }}>{portal.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div
          style={{
            padding: '18px 24px',
            background: '#f9fafc',
            borderBottom: '1px solid #eef2f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#1a1f36',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="bi bi-graph-up" style={{ color: '#2a5c9a' }}></i>
            Import Statistics
          </h3>
          <span
            style={{
              background: '#e8f0fe',
              color: '#2a5c9a',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            {chartTimeframe}
          </span>
        </div>

        {drillPath && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              margin: '0 24px 16px 24px',
              padding: '12px 16px',
              background: '#f9fafc',
              borderRadius: '8px',
              fontSize: '13px',
              border: '1px solid #eef2f6'
            }}
          >
            <button className="drill-back-btn" onClick={handleDrillBack} type="button">
              <i className="bi bi-arrow-left"></i> Back to Weekly View
            </button>
            <span style={{ color: '#5b6e8c' }}>
              Currently viewing: <span style={{ fontWeight: 500, color: '#1a1f36' }}>{drillPath}</span>
            </span>
          </div>
        )}

        <div style={{ padding: '24px', height: '350px', position: 'relative' }}>
          {chartDataConfig ? (
            <Line data={chartDataConfig} options={chartOptions} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5b6e8c' }}>
              Loading chart data...
            </div>
          )}
        </div>
      </Card>

      <style>{`
        .date-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          background: transparent;
          border-radius: 6px;
          color: #5b6e8c;
          cursor: pointer;
          transition: all 0.2s;
        }

        .date-btn:hover {
          background: #f0f2f5;
          color: #1a1f36;
        }

        .date-btn.active {
          background: #1a1f36;
          color: white;
        }

        .metric-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          border: 1px solid #eef2f6;
          position: relative;
          min-height: 120px;
        }

        .metric-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .metric-title {
          font-size: 13px;
          font-weight: 500;
          color: #5b6e8c;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .metric-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .metric-icon.blue { background: #e8f0fe; color: #2a5c9a; }
        .metric-icon.green { background: #e6f7e6; color: #1e7b4c; }
        .metric-icon.purple { background: #f3e8ff; color: #6941c6; }

        .metric-value {
          font-size: 28px;
          font-weight: 600;
          color: #1a1f36;
          margin-bottom: 4px;
        }

        .metric-trend {
          font-size: 12px;
          color: #1e7b4c;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .drill-back-btn {
          background: white;
          border: 1px solid #dfe5ef;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          color: #1a1f36;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .drill-back-btn:hover {
          background: #f0f2f5;
          border-color: #cbd5e1;
        }

        .loading {
          position: relative;
          opacity: 0.6;
          pointer-events: none;
        }

        .loading::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          margin: -10px 0 0 -10px;
          border: 2px solid #f0f2f5;
          border-top-color: #1a1f36;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <Modal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        title="Step 2: Map CSV Fields"
        maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="secondary" onClick={() => setShowMappingModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleMappingSubmit} disabled={loading}>
              {loading ? 'Starting Import...' : 'Start Import'}
            </Button>
          </div>
        }
      >
        <div style={{ padding: '20px 0' }}>
          <div
            style={{
              background: '#e8f4fd',
              color: '#0c5460',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #bee5eb'
            }}
          >
            Please map the CSV columns with the correct candidate fields.
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#343a40', color: 'white', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6', width: '40%' }}>
                    CSV Column
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6', width: '60%' }}>
                    Assign Candidate Field
                  </th>
                </tr>
              </thead>
              <tbody>
                {csvHeaders.map((header, index) => (
                  <tr key={header.normalized || index} style={{ background: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: '500' }}>
                      {header.original}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                      <select
                        value={fieldMappings[header.normalized] || ''}
                        onChange={(e) => handleFieldMappingChange(header.normalized, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        {candidateFields.map((field) => {
                          const isSelectedElsewhere =
                            field.value &&
                            field.value !== 'extra' &&
                            Object.entries(fieldMappings).some(
                              ([key, val]) => key !== header.normalized && val === field.value
                            )

                          return (
                            <option
                              key={field.value}
                              value={field.value}
                              disabled={isSelectedElsewhere}
                              style={{ color: isSelectedElsewhere ? '#6c757d' : 'inherit' }}
                            >
                              {field.label}
                            </option>
                          )
                        })}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  )
}