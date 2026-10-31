import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch } from '@fortawesome/free-solid-svg-icons'
import { coreRecruiterAPI, recruiterAPI } from '../../api/axios'
import { DataTable, Modal } from '../../components/ui'
import { ImageModal } from '../../components/ui/ImageModal'

const PAGE_SIZE = 100

const getValue = (record, keys, fallback = '') => {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key]
  }
  return fallback
}

const getList = (payload, keys = []) => {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
  }
  return Array.isArray(payload) ? payload : []
}

const getApiPage = (response) => {
  let payload = response?.data ?? response
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch (error) {
      console.error('Failed to parse quick attendance response:', error)
      throw new Error('The attendance service returned invalid data.')
    }
  }

  const body = payload?.data ?? payload
  const rows = getList(body, ['items', 'records', 'attendance', 'results', 'candidates', 'members', 'data'])
  const total = Number(payload?.total ?? payload?.count ?? payload?.totalCount ?? payload?.total_count ?? body?.total ?? body?.count ?? body?.totalCount)
  return { rows, total: Number.isFinite(total) ? total : null }
}

const getAllPages = async (fetchPage, baseParams) => {
  const allRows = []
  let offset = 0

  while (true) {
    const response = await fetchPage({ ...baseParams, offset, limit: PAGE_SIZE })
    const { rows, total } = getApiPage(response)
    allRows.push(...rows)
    if (rows.length === 0 || (rows.length < PAGE_SIZE && (total === null || offset + rows.length >= total))) break
    offset += rows.length
    if (total !== null && offset >= total) break
  }

  return allRows
}

const getIdentities = (record, includeRecordId = false) => {
  const identities = []
  const addIdentity = (type, value) => {
    const normalized = String(value ?? '').trim().replace(/\s+/g, '')
    if (normalized) identities.push(`${type}:${normalized.toLowerCase()}`)
  }
  const aadhaar = getValue(record, ['aadhaar', 'aadhar', 'aadhaar_number', 'aadhaarNumber', 'aadhaar_no', 'aadharNumber', 'worker_aadhaar', 'candidate_aadhaar'])
  const mobile = getValue(record, ['mobile', 'phone', 'contact', 'mobile_number', 'mobileNumber', 'phone_number'])
  const candidateId = getValue(record, ['candidate_id', 'candidateId', 'registration_id', 'registrationId', 'registration_number', 'worker_id', 'workerId'])

  addIdentity('aadhaar', String(aadhaar).replace(/\D/g, ''))
  addIdentity('mobile', String(mobile).replace(/\D/g, ''))
  addIdentity('candidate', candidateId)
  if (includeRecordId) addIdentity('candidate', getValue(record, ['id', '_id']))
  return identities
}

const getLocalDate = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const hasCheckIn = (record) => {
  const checkIn = getValue(record, [
    'clock_in', 'clockIn', 'check_in_time', 'checkInTime', 'checkin_time',
    'check_in', 'checkin', 'checkIn', 'check_in_image', 'checkin_image',
    'checkInImage', 'check_in_photo', 'check_in_img',
  ], null)
  return checkIn !== null && checkIn !== false && String(checkIn).trim() !== ''
}

export default function QuickAttendanceModal({ isOpen, onClose }) {
  const [members, setMembers] = useState([])
  const [attendanceDate, setAttendanceDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [imagePreview, setImagePreview] = useState({ isOpen: false, src: '', title: '', alt: '' })

  useEffect(() => {
    if (!isOpen) return undefined
    let active = true
    const date = getLocalDate()

    const loadQuickAttendance = async () => {
      setLoading(true)
      setError('')
      setMembers([])
      setAttendanceDate(date)
      try {
        const [coreMembers, regularAttendance, writtenAttendance] = await Promise.all([
          getAllPages((params) => recruiterAPI.getCandidateJoiningDetails(params), {}),
          getAllPages((params) => coreRecruiterAPI.getAttendanceRecords(params), { from: date, to: date }),
          getAllPages((params) => coreRecruiterAPI.getWrittenExamAttendanceRecords(params), { from: date, to: date }),
        ])

        const presentIdentities = new Set()
        ;[...regularAttendance, ...writtenAttendance].forEach((record) => {
          const status = String(getValue(record, ['status', 'attendance_status', 'attendanceStatus'], '')).trim().toLowerCase()
          if (!hasCheckIn(record) && status && !['present', 'late', 'approved'].includes(status)) return
          if (!hasCheckIn(record) && !status) return
          getIdentities(record).forEach((identity) => presentIdentities.add(identity))
        })

        const uniqueMembers = new Map()
        coreMembers.forEach((member, index) => {
          const identities = getIdentities(member, true)
          const primaryIdentity = identities[0] || `member:${index}`
          if (!uniqueMembers.has(primaryIdentity)) uniqueMembers.set(primaryIdentity, { member, identities })
        })

        const results = Array.from(uniqueMembers.values()).map(({ member, identities }) => {
          const present = identities.some((identity) => presentIdentities.has(identity))
          return {
            name: getValue(member, ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName'], 'Unknown'),
            mobile: getValue(member, ['mobile', 'phone', 'contact', 'mobile_number', 'mobileNumber'], '—'),
            photo: getValue(member, ['profileImage', 'profileimage', 'profile_image', 'candidate_image', 'candidate_photo', 'photo', 'image', 'image_url']),
            present,
          }
        }).sort((first, second) => Number(second.present) - Number(first.present) || first.name.localeCompare(second.name))

        if (active) setMembers(results)
      } catch (loadError) {
        console.error('Failed to load quick core team attendance:', loadError)
        if (active) setError(loadError?.message || 'Unable to load quick attendance right now.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadQuickAttendance()
    return () => { active = false }
  }, [isOpen])

  const presentCount = members.filter((member) => member.present).length
  const filteredMembers = members.filter((member) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || member.name.toLowerCase().includes(query) || member.mobile.toLowerCase().includes(query)
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'present' ? member.present : !member.present)
    return matchesSearch && matchesStatus
  })
  const rows = filteredMembers.map((member, index) => [
    index + 1,
    member.photo
      ? <button key={`photo-${index}`} type="button" onClick={() => setImagePreview({ isOpen: true, src: member.photo, title: `${member.name} profile`, alt: `${member.name} profile photo` })} aria-label={`View ${member.name} profile photo`} style={{ padding: 0, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer' }}>
          <img src={member.photo} alt={`${member.name} profile`} loading="lazy" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        </button>
      : <span key={`photo-${index}`} aria-label="No profile photo" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-light)', color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>N/A</span>,
    <span key={`status-${index}`} className={`tag ${member.present ? 'tag-green' : 'tag-red'}`}>{member.present ? 'Present' : 'Absent'}</span>,
    member.name,
    member.mobile,
  ])

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Quick attendance list" maxWidth="900px" footer={<button type="button" className="btn btn-outline" onClick={onClose}>Close</button>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong>{attendanceDate ? new Date(`${attendanceDate}T00:00:00`).toLocaleDateString('en-IN') : 'Today'}</strong>
            {!loading && !error && <span style={{ color: 'var(--text2)', fontSize: 13 }}>{presentCount} present · {members.length - presentCount} absent · Showing {filteredMembers.length} of {members.length}</span>}
          </div>
          <div className="projects-table-filters" style={{ alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div className="projects-table-filter-group search-group" style={{ minWidth: 0, flex: '1 1 240px' }}>
              <label className="filter-label" htmlFor="quick-attendance-search">Search by name or mobile</label>
              <div className="filter-search-box">
                <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                <input
                  id="quick-attendance-search"
                  className="form-control"
                  type="search"
                  value={search}
                  placeholder="Enter a name or mobile number"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <label className="projects-table-filter-group" style={{ minWidth: 150 }}>
              <span className="filter-label">Attendance status</span>
              <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">Present and absent</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </label>
          </div>
          {error && <div className="attendance-message error">{error}</div>}
          <DataTable
            columns={['#', 'Profile photo', 'Status', 'Core team member', 'Mobile']}
            rows={loading ? [] : rows}
            emptyMessage={loading ? 'Loading quick attendance...' : members.length ? 'No members match the current search or filter.' : 'No core team members found.'}
          />
        </div>
      </Modal>
      <ImageModal
        isOpen={imagePreview.isOpen}
        onClose={() => setImagePreview({ isOpen: false, src: '', title: '', alt: '' })}
        imageUrl={imagePreview.src}
        title={imagePreview.title}
        alt={imagePreview.alt}
      />
    </>
  )
}
