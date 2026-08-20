import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { candidateAPI } from '../../api/axios'
import { PageHeader, Card, DataTable, Tag, StatCard } from '../../components/ui'
import { ImageModal } from '../../components/ui/ImageModal'
import { MapModal } from '../../components/ui/MapModal' // Import MapModal
import { useAuth } from '../../context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMapMarkerAlt, faCalendarAlt, faClock, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'

const formatDate = (value) => { // Existing function, no change
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const LIMIT_OPTIONS = [10, 20, 50]
const NO_IMAGE_PLACEHOLDER = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'

const statusVariant = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'present' || normalized === 'approved') return 'green'
  if (normalized === 'late' || normalized === 'exception' || normalized === 'pending') return 'yellow'
  if (normalized === 'absent') return 'red'
  return 'gray'
}

// Helper function to parse coordinates from various possible formats
const parseCoords = (val) => {
  if (!val) return null
  const isValidPoint = (latitude, longitude) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
    if (latitude === 0 && longitude === 0) return false
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false
    return true
  }

  if (typeof val === 'object') {
    const lat = Number(val.lat ?? val.latitude ?? val.latitute ?? val.latLng?.lat ?? val.geo?.lat ?? val.location?.lat)
    const lng = Number(val.lng ?? val.longitude ?? val.lon ?? val.long ?? val.latLng?.lng ?? val.geo?.lng ?? val.location?.lng)
    if (isValidPoint(lat, lng)) return { latitude: lat, longitude: lng }
    if (Array.isArray(val.coordinates) && val.coordinates.length >= 2) {
      const maybeLng = Number(val.coordinates[0])
      const maybeLat = Number(val.coordinates[1])
      if (isValidPoint(maybeLat, maybeLng)) return { latitude: maybeLat, longitude: maybeLng }
    }
  }
  if (typeof val === 'string') {
    const parts = val.split(/[,\s]+/).map((p) => Number(p)).filter(Number.isFinite)
    if (parts.length >= 2 && isValidPoint(parts[0], parts[1])) return { latitude: parts[0], longitude: parts[1] }
  }
  return null
}

const formatLocationLabel = (value) => {
  if (!value) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const coords = parseCoords(value)
    if (coords) return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
    if (value.address) return value.address
    if (value.name) return value.name
    return JSON.stringify(value)
  }
  return String(value)
}

export default function CandidateAttendancePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const registrationId = user?.registrationId
  const { state } = location
  const projectId = state?.projectId
  const projectType = state?.projectType || 'regular'
  const locationId = state?.locationId
  const districtId = state?.districtId
  const centreId = state?.centreId
  const projectName = state?.projectName || 'Project'
  const locationName = state?.locationName || 'Location'
  const districtName = state?.districtName || 'District'
  const centreName = state?.centreName || 'Centre'
  const fullTitle = projectType === 'written'
    ? `${projectName} / ${districtName} / ${centreName}`
    : `${projectName} / ${locationName}`

  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(10)
  const [offset, setOffset] = useState(0)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [imagePreview, setImagePreview] = useState({ isOpen: false, src: '', alt: '', title: '' })
  const [mapPreview, setMapPreview] = useState({ isOpen: false, markers: [], title: '' }) // Updated state to hold an array of markers

  const fetchAttendance = useCallback(async () => {
    if (!registrationId || !projectId) return
    if (projectType === 'regular' && !locationId) return
    if (projectType === 'written' && (!districtId || !centreId)) return
    setLoading(true)
    try {
      const params = {
        offset,
        limit,
        from: fromDate || undefined,
        to: toDate || undefined,
      }
      if (projectType === 'written') {
        params.district_id = districtId
        params.centre_id = centreId
      }
      const response = await candidateAPI.getAttendanceRecords(registrationId, projectId, locationId, params)

      const payload = response?.data?.data || response?.data?.attendance || response?.data || {}
      const rows = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.records) ? payload.records : Array.isArray(payload) ? payload : []
      const count = payload?.total ?? payload?.count ?? rows.length

      setAttendance(rows)
      setTotal(count)
    } catch (error) {
      console.warn('Unable to load attendance records:', error)
      setAttendance([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [projectId, locationId, offset, limit, fromDate, toDate, registrationId, projectType, districtId, centreId])

  useEffect(() => {
    const missingRequired = projectType === 'regular'
      ? (!projectId || !locationId || !registrationId)
      : (!projectId || !districtId || !centreId || !registrationId)

    if (missingRequired) {
      navigate('/app/candidate/attendance')
      return
    }
    fetchAttendance()
  }, [fetchAttendance, projectId, projectType, locationId, districtId, centreId, registrationId, navigate])

  const openImageModal = (src, title, alt) => {
    setImagePreview({ isOpen: true, src, title, alt })
  }

  const closeImageModal = () => {
    setImagePreview({ isOpen: false, src: '', alt: '', title: '' })
  }

  const openMapModal = (markers, title) => { // Updated to accept markers array
    setMapPreview({ isOpen: true, markers, title })
  }

  const closeMapModal = () => { // Updated to clear markers
    setMapPreview({ isOpen: false, markers: [], title: '' })
  }

  const columns = projectType === 'written'
    ? ['S.No', 'Date', 'Clock In', 'Clock Out', 'In Photo', 'Out Photo', 'In Location', 'Out Location', 'Status']
    : ['S.No', 'Date', 'Clock In', 'Clock Out', 'In Photo', 'Out Photo', 'In Location', 'Out Location', 'Status']

  const rows = useMemo(() => attendance.map((record, idx) => {
    const checkInImage = record.check_in_image || record.checkin_image || record.check_in_photo || ''
    const checkOutImage = record.check_out_image || record.checkout_image || record.check_out_photo || ''
    const checkInLocation = record.check_in_location || record.checkin_location || record.in_location || record.check_in_geo || record.check_in_location_geo
    const checkOutLocation = record.check_out_location || record.checkout_location || record.out_location || record.check_out_geo || record.check_out_location_geo

    // Extract all relevant coordinates for multiple markers
    const projectLocationCoords = parseCoords(location.state?.projectGeo || record.project_location_geo || record.project_location || record.project_geo)
    const checkInCoords = parseCoords(record.check_in_location_geo || record.check_in_location || record.checkin_location_geo || record.checkin_location || record.in_location_geo || record.in_location)
    const checkOutCoords = parseCoords(record.check_out_location_geo || record.check_out_location || record.checkout_location_geo || record.checkout_location || record.out_location_geo || record.out_location)

    const checkInLocationLabel = formatLocationLabel(checkInLocation)
    const checkOutLocationLabel = formatLocationLabel(checkOutLocation)

    const inMarkers = []
    if (projectLocationCoords) {
      inMarkers.push({ ...projectLocationCoords, label: 'Project Location', type: 'project' })
    }
    if (checkInCoords) {
      inMarkers.push({ ...checkInCoords, label: 'Check-in Location', type: 'checkin' })
    }

    const outMarkers = []
    if (projectLocationCoords) {
      outMarkers.push({ ...projectLocationCoords, label: 'Project Location', type: 'project' })
    }
    if (checkOutCoords) {
      outMarkers.push({ ...checkOutCoords, label: 'Check-out Location', type: 'checkout' })
    }

    return [
      offset + idx + 1,
      formatDate(record.date),
      record.clock_in || '—',
      record.clock_out || '—',
      <button
        key={`${idx}-inimg`}
        type="button"
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
        onClick={() => openImageModal(checkInImage || NO_IMAGE_PLACEHOLDER, 'Check-in image', 'Check in')}
      >
        <img
          src={checkInImage || NO_IMAGE_PLACEHOLDER}
          alt="Check in"
          style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', opacity: checkInImage ? 1 : 0.5 }}
        />
      </button>,
      <button
        key={`${idx}-outimg`}
        type="button"
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
        onClick={() => openImageModal(checkOutImage || NO_IMAGE_PLACEHOLDER, 'Check-out image', 'Check out')}
      >
        <img
          src={checkOutImage || NO_IMAGE_PLACEHOLDER}
          alt="Check out"
          style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover', opacity: checkOutImage ? 1 : 0.5 }}
        />
      </button>,
      <div key={`${idx}-inloc`} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
        <span className="text-truncate" style={{ maxWidth: '100px' }} title={checkInLocationLabel}>{checkInLocationLabel}</span>
        {(inMarkers.length > 0) && ( // Show map button if any coords exist for check-in/project
          <button
            type="button"
            className="btn btn-link p-0 text-primary"
            onClick={() => openMapModal(inMarkers, 'Check-in / Project Locations')}
          >
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </button>
        )}
      </div>,
      <div key={`${idx}-outloc`} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
        <span className="text-truncate" style={{ maxWidth: '100px' }} title={checkOutLocationLabel}>{checkOutLocationLabel}</span>
        {(outMarkers.length > 0) && ( // Show map button if any coords exist for check-out/project
          <button
            type="button"
            className="btn btn-link p-0 text-primary"
            onClick={() => openMapModal(outMarkers, 'Check-out / Project Locations')}
          >
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </button>
        )}
      </div>,
      <Tag key={`${idx}-status`} variant={statusVariant(record.status)}>{record.status || 'Unknown'}</Tag>
    ]
  }), [attendance, offset, location.state]) // Added location.state to dependencies

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div>
      <PageHeader
        title="Attendance Details"
        subtitle={`Project / Location: ${fullTitle}`}
        action={
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/app/candidate/attendance')}>
            &larr; Back to Summary
          </button>
        }
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <StatCard icon={<FontAwesomeIcon icon={faCalendarAlt} />} value={total} label="Total Records" />
        <StatCard icon={<FontAwesomeIcon icon={faCheckCircle} color="var(--green)" />} value={attendance.filter(a => a.status?.toLowerCase() === 'present').length} label="Present (Page)" />
        <StatCard icon={<FontAwesomeIcon icon={faExclamationTriangle} color="var(--yellow)" />} value={attendance.filter(a => ['late', 'exception'].includes(a.status?.toLowerCase())).length} label="Exceptions (Page)" />
        <StatCard icon={<FontAwesomeIcon icon={faClock} color="var(--blue)" />} value={attendance[0]?.clock_in || '--:--'} label="Latest Entry" />
      </div>

      <Card style={{ marginBottom: 20, padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>From Date</label>
            <input type="date" className="form-control" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setOffset(0); }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>To Date</label>
            <input type="date" className="form-control" value={toDate} onChange={(e) => { setToDate(e.target.value); setOffset(0); }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text3)' }}>Show</label>
            <select className="form-control" style={{ width: '100px' }} value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}>
              {LIMIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt} rows</option>)}
            </select>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => { setFromDate(''); setToDate(''); setOffset(0); }}>Reset</button>
        </div>
      </Card>

      <Card>
        <div className="projects-table-wrap">
          <DataTable
            columns={columns}
            rows={rows}
            emptyMessage={loading ? 'Loading records...' : 'No attendance records found for the selected range.'}
          />
        </div>
        
        {total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 8px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
              Showing {total === 0 ? 0 : offset + 1} – {Math.min(offset + limit, total)} of {total} records
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="pagination-page-btn"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </button>
              <button
                className="pagination-page-btn"
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      <ImageModal
        isOpen={imagePreview.isOpen}
        onClose={closeImageModal}
        imageUrl={imagePreview.src}
        title={imagePreview.title}
        alt={imagePreview.alt}
      />
      
      {/* Using the shared MapModal component */}
      <MapModal
        isOpen={mapPreview.isOpen}
        onClose={closeMapModal}
        markers={mapPreview.markers}
        title={mapPreview.title}
      />
    </div>
  )
}