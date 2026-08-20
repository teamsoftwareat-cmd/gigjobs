import { useState, useEffect, useRef } from 'react'
import { Card, Button, LoadingOverlay, Modal } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'

const CALL_PURPOSE_OPTIONS = [
  { value: '', label: 'Select call purpose' },
  { value: 'verification', label: 'Verification' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'registration', label: 'Registration' },
  { value: 'others', label: 'Others' }
]

const CALL_DAY_OPTIONS = [
  { value: '', label: 'Select call day' },
  { value: 'preday', label: 'Pre-day' },
  { value: 'examday', label: 'Exam day' },
  { value: 'others', label: 'Others' }
]

const PROJECT_TYPE_OPTIONS = [
  { value: '', label: 'Select project type' },
  { value: 'regular', label: 'Regular' },
  { value: 'written', label: 'Written' }
]

const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || '-'

const formatDateTimeForInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const iso = date.toISOString()
  return iso.slice(0, 16)
}

const formatDateTimeForDisplay = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const downloadSampleCsv = (projectType) => {
  const headers =
    projectType === 'written'
      ? ['S.NO', 'DISTRICT', 'CENTRE', 'CENTRENAME&ADDRESS', 'DESIGNATION', 'NAME', 'CONTACTNO', 'AADHARNO']
      : ['S.NO', 'LOCATION', 'DESIGNATION', 'NAME', 'CONTACTNO', 'AADHARNO']

  const rows = [headers, ...headers.map((_, index) => {
    if (index === 0) return null
    return projectType === 'written'
      ? [index, 'Chennai', 'Test Centre', 'Test Centre Address', 'Verifier', 'Ravi Kumar', '9000000000', '123412341234']
      : [index, 'Chennai', 'Verifier', 'Ravi Kumar', '9000000000', '123412341234']
  }).filter(Boolean)]

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `verification_team_template_${projectType}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default function VerificationTeamDatabase() {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [activationDateTime, setActivationDateTime] = useState('')
  const [deactivationDateTime, setDeactivationDateTime] = useState('')
  const [callPurpose, setCallPurpose] = useState('')
  const [callDay, setCallDay] = useState('')
  const [projectType, setProjectType] = useState('regular')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [records, setRecords] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editLatitude, setEditLatitude] = useState('')
  const [editLongitude, setEditLongitude] = useState('')
  const [editActivationDateTime, setEditActivationDateTime] = useState('')
  const [editDeactivationDateTime, setEditDeactivationDateTime] = useState('')
  const [editCallPurpose, setEditCallPurpose] = useState('')
  const [editCallDay, setEditCallDay] = useState('')

  const { alert } = useAlert()
  const fileInputRef = useRef(null)

  const showGlobalToast = (message, icon = '✅', duration = 3000) => {
    window.dispatchEvent(new CustomEvent('apiMessage', {
      detail: { icon, message, type: icon === '❌' ? 'error' : 'success', duration }
    }))
  }

  const handleFillPalLocation = () => {
    setLatitude('25.62336963043891')
    setLongitude('85.04102559852575')
    showGlobalToast('# Pal Banquet Hall & Guest House location added')
  }

  const fetchRecords = async () => {
    setRecordsLoading(true)
    try {
      const params = {
        search: searchQuery || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        offset,
        limit
      }
      const response = await recruiterAPI.getVerificationTeamDatabaseRecords(params)
      const result = response?.data ?? []

      let items = []
      let total = 0

      if (Array.isArray(result)) {
        items = result
        total = result.length
      } else if (Array.isArray(result.data)) {
        items = result.data
        total = typeof result.total === 'number' ? result.total : items.length
      } else {
        items = []
        total = 0
      }

      setRecords(items)
      setTotalRecords(total)
    } catch (err) {
      console.error('Failed to load verification team records', err)
      setRecords([])
      setTotalRecords(0)
    } finally {
      setRecordsLoading(false)
    }
  }

  const handleApplyFilters = () => {
    setOffset(0)
    fetchRecords()
  }

  const handleChangePage = (newOffset) => {
    setOffset(newOffset)
  }

  const handleLimitChange = (value) => {
    setLimit(value)
    setOffset(0)
  }

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(totalRecords / limit))

  const openEditModal = (record) => {
    setSelectedRecord(record)
    setEditTitle(record.title || '')
    setEditLatitude(record.latitude || '')
    setEditLongitude(record.longitude || '')
    setEditActivationDateTime(formatDateTimeForInput(record.activation_date_time || record.activationDateTime || ''))
    setEditDeactivationDateTime(formatDateTimeForInput(record.deactivation_date_time || record.deactivationDateTime || ''))
    setEditCallPurpose(record.call_purpose || record.callPurpose || '')
    setEditCallDay(record.call_day || record.callDay || '')
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedRecord(null)
  }

  const handleSaveEdit = async () => {
    if (!selectedRecord) return
    if (!editTitle) {
      await alert('Please enter a title for this record.')
      return
    }
    if (!editCallPurpose) {
      await alert('Please select a call purpose.')
      return
    }
    if (!editCallDay) {
      await alert('Please select a call day.')
      return
    }
    if (!editActivationDateTime || !editDeactivationDateTime) {
      await alert('Please choose both activation and deactivation date/time.')
      return
    }

    setLoading(true)
    try {
      const updatePayload = {
        title: editTitle,
        latitude: editLatitude,
        longitude: editLongitude,
        activation_date_time: editActivationDateTime,
        deactivation_date_time: editDeactivationDateTime,
        call_purpose: editCallPurpose,
        call_day: editCallDay
      }
      await recruiterAPI.updateVerificationTeamDatabaseRecord(selectedRecord.id, updatePayload)
      setSuccess('Record updated successfully.')
      closeEditModal()
      fetchRecords()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Update failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetUploadForm = () => {
    setFile(null)
    setTitle('')
    setLatitude('')
    setLongitude('')
    setActivationDateTime('')
    setDeactivationDateTime('')
    setCallPurpose('')
    setCallDay('')
    try {
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [offset, limit])

  const handleFilesChange = (files) => {
    const selected = files?.[0]
    if (!selected) {
      setFile(null)
      return
    }

    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Please upload a CSV file only.')
      setFile(null)
      return
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum allowed size is 10MB.')
      setFile(null)
      return
    }

    setError('')
    setFile(selected)
  }

  const clearFile = () => {
    setFile(null)
    try {
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      // ignore
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!callPurpose) {
      await alert('Please select a call purpose.')
      return
    }

    if (!callDay) {
      await alert('Please select a call day.')
      return
    }

    if (!projectType) {
      await alert('Please select a project type.')
      return
    }

    if (!title) {
      await alert('Please enter a title for this upload.')
      return
    }

    if (!activationDateTime || !deactivationDateTime) {
      await alert('Please choose both activation and deactivation date/time.')
      return
    }

    if (!file) {
      await alert('Please upload a CSV file.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('csv_file', file)
      formData.append('title', title)
      formData.append('latitude', latitude)
      formData.append('longitude', longitude)
      formData.append('activation_date_time', activationDateTime)
      formData.append('deactivation_date_time', deactivationDateTime)
      formData.append('call_purpose', callPurpose)
      formData.append('call_day', callDay)
      formData.append('project_type', projectType)

      await recruiterAPI.uploadVerificationTeamDatabase(formData)

      setSuccess('Verification team data uploaded successfully.')
      resetUploadForm()
      fetchRecords()
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ margin: '0 auto', padding: '24px' }}>
      <LoadingOverlay active={loading} message="Uploading verification team data..." />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: '#1a1f36' }}>
            Verification Team Database
          </h1>
          <p style={{ margin: '8px 0 0', color: '#5b6e8c' }}>
            Upload your verification team roster and metadata using a CSV template.
          </p>
        </div>
      </div>

      <Card>
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '10px', background: '#ecfdf5', color: '#166534' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px', marginBottom: '24px' }}>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a memorable title for this upload"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Latitude</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 13.0827"
                    style={{ flex: 1, padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                  />
                  <button
                    type="button"
                    onClick={handleFillPalLocation}
                    title="Fill Pal Banquet Hall location"
                    style={{ border: '1px solid #cbd5e1', background: '#f8fafc', color: '#1d4ed8', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer' }}
                  >
                    ℹ️
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Longitude</label>
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g. 80.2707"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Activation Date & Time</label>
                <input
                  type="datetime-local"
                  value={activationDateTime}
                  onChange={(e) => setActivationDateTime(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Deactivation Date & Time</label>
                <input
                  type="datetime-local"
                  value={deactivationDateTime}
                  onChange={(e) => setDeactivationDateTime(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Call Purpose</label>
                <select
                  value={callPurpose}
                  onChange={(e) => setCallPurpose(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  {CALL_PURPOSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Call Day</label>
                <select
                  value={callDay}
                  onChange={(e) => setCallDay(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  {CALL_DAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Project Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                >
                  {PROJECT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Upload CSV File</label>
              <div
                style={{
                  border: '1px dashed #d1d5db',
                  borderRadius: '12px',
                  padding: '28px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={{ color: '#475569', marginBottom: '8px' }}>Click to select a file or drag it here.</div>
                <div style={{ color: '#64748b', fontSize: '13px' }}>Only .csv files are accepted.</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFilesChange(e.target.files)}
                />
                {file && (
                  <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '14px', color: '#0f172a' }}>{file.name}</div>
                    <button
                      type="button"
                      onClick={clearFile}
                      style={{ border: 'none', background: 'transparent', color: '#0f172a', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

                      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => downloadSampleCsv('regular')}
                  style={{ background: '#eef2ff', color: '#1d4ed8', border: '1px solid #c7d2fe', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}
                >
                  Download regular template
                </button>
                <button
                  type="button"
                  onClick={() => downloadSampleCsv('written')}
                  style={{ background: '#eef2ff', color: '#1d4ed8', border: '1px solid #c7d2fe', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}
                >
                  Download written template
                </button>
              </div>
            </div>

            <Button type="submit" variant="primary" style={{ width: '100%', padding: '14px 18px', fontSize: '15px' }}>
              Upload Verification Team CSV
            </Button>
          </form>
        </div>
      </Card>

      <Card style={{ marginTop: '24px' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1a1f36' }}>Uploaded Verification Records</h2>
            <Button type="button" variant="secondary" onClick={fetchRecords} style={{ padding: '10px 16px', fontSize: '14px' }}>
              Refresh
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title or data"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Date from</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Date to</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <Button type="button" variant="primary" onClick={handleApplyFilters} style={{ padding: '12px 16px', fontSize: '14px' }}>
                Apply filters
              </Button>
            </div>
          </div>
          {recordsLoading ? (
            <div style={{ padding: '28px', textAlign: 'center', color: '#475569' }}>Loading records...</div>
          ) : records.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: '#475569' }}>No records found yet.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>#</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Title</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Count</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Latitude</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Longitude</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Activation</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Deactivation</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Call Purpose</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Call Day</th>
                      <th style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={record.id || index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{offset + index + 1}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{record.title || '-'}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{record.count ?? '-'}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{record.latitude || '-'}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{record.longitude || '-'}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{formatDateTimeForDisplay(record.activation_date_time || record.activationDateTime)}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{formatDateTimeForDisplay(record.deactivation_date_time || record.deactivationDateTime)}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{getOptionLabel(CALL_PURPOSE_OPTIONS, record.call_purpose || record.callPurpose)}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>{getOptionLabel(CALL_DAY_OPTIONS, record.call_day || record.callDay)}</td>
                        <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(record)}
                            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px' }}>
                <div style={{ color: '#475569', fontSize: '14px' }}>
                  Showing {offset + 1} - {Math.min(offset + records.length, totalRecords)} of {totalRecords}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => handleChangePage(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: offset === 0 ? '#f8fafc' : '#ffffff',
                      color: offset === 0 ? '#94a3b8' : '#0f172a',
                      cursor: offset === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <div style={{ color: '#475569', fontSize: '14px' }}>
                    Page {currentPage} of {totalPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChangePage(Math.min((totalPages - 1) * limit, offset + limit))}
                    disabled={currentPage >= totalPages}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: currentPage >= totalPages ? '#f8fafc' : '#ffffff',
                      color: currentPage >= totalPages ? '#94a3b8' : '#0f172a',
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ color: '#475569', fontSize: '14px' }}>Rows:</label>
                    <select
                      value={limit}
                      onChange={(e) => handleLimitChange(Number(e.target.value))}
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff', fontSize: '14px' }}
                    >
                      {[10, 20, 50].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Edit Verification Record"
        maxWidth="700px"
        closeOnBackdropClick={true}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Enter a memorable title for this record"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Latitude</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={editLatitude}
                onChange={(e) => setEditLatitude(e.target.value)}
                placeholder="e.g. 13.0827"
                style={{ flex: 1, padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
              <button
                type="button"
                onClick={handleFillPalLocation}
                title="Fill Pal Banquet Hall location"
                style={{ border: '1px solid #cbd5e1', background: '#f8fafc', color: '#1d4ed8', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer' }}
              >
                ℹ️
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Longitude</label>
            <input
              type="text"
              value={editLongitude}
              onChange={(e) => setEditLongitude(e.target.value)}
              placeholder="e.g. 80.2707"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Activation Date & Time</label>
            <input
              type="datetime-local"
              value={editActivationDateTime}
              onChange={(e) => setEditActivationDateTime(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Deactivation Date & Time</label>
            <input
              type="datetime-local"
              value={editDeactivationDateTime}
              onChange={(e) => setEditDeactivationDateTime(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Call Purpose</label>
            <select
              value={editCallPurpose}
              onChange={(e) => setEditCallPurpose(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            >
              {CALL_PURPOSE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#344767' }}>Call Day</label>
            <select
              value={editCallDay}
              onChange={(e) => setEditCallDay(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            >
              {CALL_DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button type="button" variant="secondary" onClick={closeEditModal} style={{ padding: '12px 16px', fontSize: '14px' }}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSaveEdit} style={{ padding: '12px 16px', fontSize: '14px' }}>
            Save changes
          </Button>
        </div>
      </Modal>
    </div>
  )
}
