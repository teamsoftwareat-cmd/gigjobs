import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faSpinner, faCheckCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui/index'
import * as XLSX from 'xlsx'

export default function NotifyNotRegisteredModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState([])
  const [error, setError] = useState('')
  const fileRef = useRef(null)
  const [projects, setProjects] = useState([])
  const [projLoading, setProjLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState('')

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    setFile(f)
    parseFileForPreview(f)
  }

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setProjLoading(true)
      try {
        const resp = await recruiterAPI.getProjects({ limit: 100 })
        const data = resp.data?.data || resp.data || []
        if (!mounted) return
        setProjects(Array.isArray(data) ? data : (data.items || []))
      } catch (e) {
        // ignore errors
      } finally {
        if (mounted) setProjLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const parseFileForPreview = async (f) => {
    try {
      const data = await f.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      // Normalize keys to candidate_name and candidate_mobile_number if possible
      const rows = json.map((r, idx) => ({
        s_no: r['S.no'] || r.s_no || r['S No'] || idx + 1,
        candidate_name: r.candidate_name || r['candidate name'] || r.name || '',
        candidate_mobile_number: r.candidate_mobile_number || r['candidate mobile number'] || r.mobile || '',
      }))
      setPreview(rows.slice(0, 200))
    } catch (err) {
      setError('Failed to parse file. Please upload a valid Excel/CSV file.')
      setPreview([])
    }
  }

  const handleSend = async () => {
    if (!selectedProject) {
      setError('Please select a project to associate with this notification.')
      return
    }
    if (!file) {
      setError('Please upload the Excel generated from not-registered export.')
      return
    }
    setLoading(true)
    setError('')
    const form = new FormData()
    form.append('file', file)
    try {
      await recruiterAPI.notifyCampaign(form, { project_id: selectedProject, portal: 'sms', message_type: 'registration' })
      setLoading(false)
      onClose()
    } catch (err) {
      setLoading(false)
      setError(err.response?.data?.message || 'Failed to send SMS notifications. Please try again.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notify Not-Registered Candidates"
      maxWidth="800px"
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={loading || !file || !selectedProject}>
            {loading ? <><FontAwesomeIcon icon={faSpinner} spin /> Sending...</> : <><FontAwesomeIcon icon={faCheckCircle} /> Send SMS</>}
          </button>
        </div>
      }
    >
      <div style={{ padding: 8 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="form-label">Select Project</label>
            <select className="form-control" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="">{projLoading ? 'Loading projects…' : 'Select a project'}</option>
              {projects.map((p) => (
                <option key={p.id || p.projectId || p.project_id || p.name} value={p.id || p.projectId || p.project_id || p.name}>
                  {p.name || p.title || p.projectName || String(p.id || p.projectId || p.project_id)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
            <button className="btn btn-outline btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>
              <FontAwesomeIcon icon={faUpload} /> {file ? file.name : 'Upload Excel'}
            </button>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Upload the Excel generated from "Export Not Registered" (S.no, candidate_name, candidate_mobile_number)
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <small className="text-muted">Preview (first 200 rows):</small>
          {preview.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--text3)' }}>No preview available</div>
          ) : (
            <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--bg-border)', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 8 }}>S.no</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Mobile</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 8 }}>{r.s_no}</td>
                      <td style={{ padding: 8 }}>{r.candidate_name}</td>
                      <td style={{ padding: 8 }}>{r.candidate_mobile_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {error && <div style={{ color: 'var(--red)', marginTop: 10 }}>{error}</div>}
      </div>
    </Modal>
  )
}
