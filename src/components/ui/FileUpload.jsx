import { useState, useRef } from 'react'
import { useAlert } from '../../context/AlertContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCloudUploadAlt, faFile, faTrash } from '@fortawesome/free-solid-svg-icons'

export default function FileUpload({
  multiple = false,
  accept = "*",
  acceptedTypes,
  maxSize = 5 * 1024 * 1024, // 5MB default
  onFilesChange,
  placeholder = "Upload files",
  helperText = "Drag & drop your files here, or click to browse"
}) {
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const { alert } = useAlert()

  const normalizeAccept = (value) => {
    if (!value) return "*"
    if (Array.isArray(value)) return value.join(',')
    return String(value)
  }

  const finalAccept = normalizeAccept(acceptedTypes ?? accept)

  const isAcceptedFileType = (file) => {
    if (finalAccept === '*') return true
    const patterns = finalAccept.split(',').map(p => p.trim()).filter(Boolean)
    if (!patterns.length) return true

    const fileName = file.name.toLowerCase()
    const fileType = file.type.toLowerCase()

    return patterns.some((pattern) => {
      if (pattern.startsWith('.')) {
        return fileName.endsWith(pattern.toLowerCase())
      }
      if (pattern.endsWith('/*')) {
        return fileType.startsWith(pattern.slice(0, -1).toLowerCase())
      }
      return fileType === pattern.toLowerCase()
    })
  }

  const processFiles = async (fileList) => {
    const validFiles = await Promise.all(Array.from(fileList).map(async (f) => {
      if (!isAcceptedFileType(f)) {
        await alert(`File "${f.name}" is not an accepted file type.`)
        return null
      }
      if (f.size > maxSize) {
        await alert(`File "${f.name}" is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`)
        return null
      }
      return f
    }))

    const filesFiltered = validFiles.filter(Boolean)

    if (multiple) {
      setFiles(prev => [...prev, ...filesFiltered])
      onFilesChange?.([...files, ...filesFiltered])
    } else {
      setFiles(filesFiltered.slice(0, 1))
      onFilesChange?.(filesFiltered.slice(0, 1))
    }
  }

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    onFilesChange?.(newFiles)
  }

  const formatSize = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div>
      <div
        className={`resume-drop-zone${dragOver ? ' drag-over' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, minWidth: '100%' }}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files) }}
      >
        <div style={{ fontSize: 36, color: 'var(--text3)', marginBottom: 12 }}>
          <FontAwesomeIcon icon={faCloudUploadAlt} />
        </div>
        <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
          {placeholder}
        </div>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>
          {helperText}<br />
          <span style={{ fontSize: 12 }}>
            {finalAccept !== "*" ? `Accepted: ${finalAccept}` : "All file types"} · Max {Math.round(maxSize / 1024 / 1024)}MB {multiple ? "per file" : ""}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={finalAccept}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={(e) => e.target.files.length && processFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            {multiple ? `Uploaded Files (${files.length})` : 'Uploaded File'}
          </div>
          {files.map((file, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 8
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: '#EEF2FF',
                color: '#4F46E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14
              }}>
                <FontAwesomeIcon icon={faFile} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{file.name}</div>
                <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>
                  {formatSize(file.size)}
                </div>
              </div>
              <button
                className="btn btn-red btn-sm"
                onClick={() => removeFile(index)}
                style={{ padding: '4px 8px', fontSize: 12, width: 'fit-content', flex: 'unset' }}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
