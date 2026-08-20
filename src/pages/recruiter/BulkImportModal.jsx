import { useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSpinner, faUpload, faCheckCircle } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'

function BulkImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ]

      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload a valid Excel (.xls, .xlsx) or CSV file')
        setFile(null)
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size should not exceed 10MB')
        setFile(null)
        return
      }

      setFile(selectedFile)
      setError('')
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.style.backgroundColor = 'rgba(33, 150, 243, 0.05)'
  }

  const handleDragLeave = (e) => {
    e.currentTarget.style.backgroundColor = 'transparent'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.currentTarget.style.backgroundColor = 'transparent'
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const fakeEvent = { target: { files: [droppedFile] } }
      handleFileChange(fakeEvent)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!file) {
      setError('Please select a file to upload')
      return
    }

    setLoading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev < 90) return prev + Math.random() * 20
          return prev
        })
      }, 300)

      // Call the API - you may need to add a bulk import endpoint to recruiterAPI
      await recruiterAPI.addCandidate(formData)

      clearInterval(progressInterval)
      setUploadProgress(100)

      setSuccess(`Successfully imported candidates from ${file.name}`)
      setFile(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to upload file. Please try again.')
      setUploadProgress(0)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          width: '90%',
          maxWidth: 500,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Bulk Import Candidates</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                color: 'var(--red)',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                color: 'var(--green)',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FontAwesomeIcon icon={faCheckCircle} />
              {success}
            </div>
          )}

          {/* File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: '2px dashed var(--border-light)',
              borderRadius: 8,
              padding: 32,
              textAlign: 'center',
              marginBottom: 20,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              backgroundColor: file ? 'rgba(33, 150, 243, 0.05)' : 'transparent',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".xls,.xlsx,.csv"
              onChange={handleFileChange}
              disabled={loading}
            />

            <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--primary)' }}>
              <FontAwesomeIcon icon={faUpload} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                {file ? file.name : 'Choose a file or drag it here'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Supported formats: Excel (.xls, .xlsx) or CSV
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Maximum file size: 10MB
              </div>
            </div>

            {!file && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                disabled={loading}
              >
                Browse Files
              </button>
            )}
          </div>

          {/* Required Format */}
          <div
            style={{
              backgroundColor: 'var(--bg-light)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Required CSV/Excel Columns:
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <li>Name</li>
              <li>Email</li>
              <li>Mobile Number</li>
              <li>WhatsApp Number (Optional)</li>
              <li>Aadhaar Number (Optional)</li>
              <li>Father's Name (Optional)</li>
              <li>Location</li>
              <li>Present Address (Optional)</li>
              <li>Permanent Address (Optional)</li>
            </ul>
          </div>

          {/* Progress Bar */}
          {loading && uploadProgress > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontSize: 12,
                }}
              >
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  backgroundColor: 'var(--border-light)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${uploadProgress}%`,
                    height: '100%',
                    backgroundColor: 'var(--primary)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !file}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {loading && <FontAwesomeIcon icon={faSpinner} spin />}
              {loading ? 'Uploading...' : 'Import Candidates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BulkImportModal
