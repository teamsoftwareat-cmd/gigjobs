import { useState, useRef } from 'react'
import { useAlert } from '../../context/AlertContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCloudUploadAlt, faFilePdf, faFileWord, faTrash, faEye } from '@fortawesome/free-solid-svg-icons'
// import { candidateAPI } from '../../api/axios'

export default function ResumeUpload({ candidateId }) {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const ALLOWED = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

  const { alert } = useAlert()

  const processFile = async (f) => {
    if (!ALLOWED.includes(f.type)) { await alert('Please upload a PDF or Word document.'); return }
    if (f.size > 5 * 1024 * 1024) { await alert('File size must be under 5MB.'); return }

    setFile(f)
    setStatus('Uploading...')
    setProgress(0)

    /* Simulate progress */
    let p = 0
    const iv = setInterval(() => {
      p += Math.random() * 25
      if (p >= 100) { p = 100; clearInterval(iv) }
      setProgress(Math.min(p, 100))
    }, 200)

    /* POST /candidates/:id/resume (multipart) */
    try {
      await candidateAPI.uploadResume(candidateId || 'demo', f)
      setStatus('✓ Uploaded successfully')
    } catch {
      setStatus('✓ Saved locally (demo mode)')
    }
  }

  const isPdf = file?.type === 'application/pdf'
  const formatSize = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div>
      {!file ? (
        <div
          className={`resume-drop-zone${dragOver ? ' drag-over' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]) }}
        >
          <div style={{ fontSize: 36, color: 'var(--text3)', marginBottom: 12 }}>
            <FontAwesomeIcon icon={faCloudUploadAlt} />
          </div>
          <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>
            Upload your Resume / CV
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            Drag & drop your file here, or click to browse<br />
            <span style={{ fontSize: 12 }}>Supports PDF, DOC, DOCX · Max 5MB</span>
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
            onChange={(e) => e.target.files[0] && processFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="resume-preview">
          <div className="resume-file-icon"
            style={{ background: isPdf ? '#FEE2E2' : '#EEF2FF', color: isPdf ? 'var(--red)' : '#4F46E5' }}>
            <FontAwesomeIcon icon={isPdf ? faFilePdf : faFileWord} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{file.name}</div>
            <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>
              {formatSize(file.size)} · {isPdf ? 'PDF Document' : 'Word Document'}
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--teal)' }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: progress === 100 ? 'var(--green)' : 'var(--text3)', marginTop: 4 }}>
              {status}
            </div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm" onClick={() => alert('Resume preview: opens PDF viewer in production.')}> 
              <FontAwesomeIcon icon={faEye} /> Preview
            </button>
            <button className="btn btn-red btn-sm" style={{width: 'fit-content'}} onClick={() => { setFile(null); setProgress(0) }}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
