import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faBriefcase,
  faCalendarCheck,
  faChartLine,
  faChevronLeft,
  faChevronRight,
  faMapMarkerAlt,
  faRupeeSign,
} from '@fortawesome/free-solid-svg-icons'

import { StatCard, Card, CardHeader, PageHeader, Tag } from '../../components/ui/index'
import { EarningsBarChart } from '../../components/ui/Charts'
import { candidateAPI } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatCurrency = (value) => {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.applications)) return payload.applications
  if (Array.isArray(payload?.records)) return payload.records
  if (Array.isArray(payload?.projects)) return payload.projects
  return []
}

const normalizeObject = (payload) => {
  if (!payload || typeof payload !== 'object') return {}
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

const extractPayload = (response) => normalizeObject(response?.data?.data || response?.data || response || {})

const getStatusLabel = (item) => {
  return String(item?.application_status || item?.status || item?.applied_status || item?.state || item?.current_status || 'Applied').trim() || 'Applied'
}

const getStatusVariant = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (!normalized) return 'gray'
  if (normalized.includes('offer') || normalized.includes('selected') || normalized.includes('hired') || normalized.includes('accepted')) return 'success'
  if (normalized.includes('interview') || normalized.includes('shortlist') || normalized.includes('review') || normalized.includes('screening')) return 'gray'
  if (normalized.includes('rejected') || normalized.includes('closed') || normalized.includes('withdrawn') || normalized.includes('declined')) return 'gray'
  if (normalized.includes('pending') || normalized.includes('applied') || normalized.includes('under review') || normalized.includes('waiting')) return 'gray'
  return 'gray'
}

function MiniCalendar({ attendance = [], loading, currentMonth = new Date(), onMonthChange }) {
  if (loading) {
    return <div style={{ height: 220, background: '#f3f4f6', borderRadius: 12 }} />
  }

  const today = new Date()
  const safeAttendance = Array.isArray(attendance) ? attendance : []
  const viewDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(viewDate)

  const presentDays = safeAttendance
    .filter((item) => {
      const itemDate = new Date(item?.date || item?.timestamp || '')
      return Number.isFinite(itemDate.getTime())
        && itemDate.getFullYear() === viewDate.getFullYear()
        && itemDate.getMonth() === viewDate.getMonth()
        && ['present', 'clocked-in', 'checked-in'].includes(String(item?.status || '').toLowerCase())
    })
    .map((item) => new Date(item?.date || item?.timestamp || '').getDate())
    .filter((day) => Number.isFinite(day))

  const absentDays = safeAttendance
    .filter((item) => {
      const itemDate = new Date(item?.date || item?.timestamp || '')
      return Number.isFinite(itemDate.getTime())
        && itemDate.getFullYear() === viewDate.getFullYear()
        && itemDate.getMonth() === viewDate.getMonth()
        && String(item?.status || '').toLowerCase() === 'absent'
    })
    .map((item) => new Date(item?.date || item?.timestamp || '').getDate())
    .filter((day) => Number.isFinite(day))

  const lateDays = safeAttendance
    .filter((item) => {
      const itemDate = new Date(item?.date || item?.timestamp || '')
      return Number.isFinite(itemDate.getTime())
        && itemDate.getFullYear() === viewDate.getFullYear()
        && itemDate.getMonth() === viewDate.getMonth()
        && ['late', 'exception', 'pending'].includes(String(item?.status || '').toLowerCase())
    })
    .map((item) => new Date(item?.date || item?.timestamp || '').getDate())
    .filter((day) => Number.isFinite(day))

  const startDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()

  const days = Array.from({ length: startDay }, () => ({ empty: true }))
    .concat(
      Array.from({ length: daysInMonth }, (_, index) => ({
        day: index + 1,
        present: presentDays.includes(index + 1),
        absent: absentDays.includes(index + 1),
        late: lateDays.includes(index + 1),
        today: index + 1 === today.getDate() && viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear(),
      }))
    )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Calendar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => onMonthChange?.(-1)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <div style={{ minWidth: 120, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#111827' }}>{monthLabel}</div>
          <button onClick={() => onMonthChange?.(1)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} style={{ textAlign: 'center' }}>{day}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((day, index) => (
          <div
            key={`${day.day || 'empty'}-${index}`}
            style={{
              height: 32,
              borderRadius: 8,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: day.empty ? 'transparent' : day.present ? '#dcfce7' : day.absent ? '#fee2e2' : day.late ? '#fef3c7' : '#f9fafb',
              border: day.today ? '2px solid #2563eb' : '1px solid #e5e7eb',
            }}
          >
            {!day.empty && day.day}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CandidateDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const registrationId = user?.registrationId || user?.registration_id || localStorage.getItem('registration_id') || ''

  const [applications, setApplications] = useState([])
  const [applicationCount, setApplicationCount] = useState(0)
  const [attendanceSummary, setAttendanceSummary] = useState([])
  const [assignedProjects, setAssignedProjects] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [earningsSummary, setEarningsSummary] = useState({})
  const [earningsChart, setEarningsChart] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState({
    attendance: true,
    applications: true,
    earnings: true,
    profile: true,
  })

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setLoading({ attendance: true, applications: true, earnings: true, profile: true })

      try {
        const currentYear = new Date().getFullYear()
        const [attendanceProjectsResult, applicationsResult, earningsResult, profileResult] = await Promise.allSettled([
          registrationId ? candidateAPI.getAttendanceProjectLocations(registrationId, { offset: 0, limit: 5 }) : Promise.resolve(null),
          registrationId ? candidateAPI.getApplications(registrationId, { offset: 0, limit: 5 }) : Promise.resolve(null),
          registrationId ? candidateAPI.getEarnings(registrationId, { year: currentYear }) : Promise.resolve(null),
          registrationId ? candidateAPI.getProfile(registrationId) : Promise.resolve(null),
        ])

        if (!isMounted) return

        const attendanceProjectsPayload = extractPayload(attendanceProjectsResult.status === 'fulfilled' ? attendanceProjectsResult.value : {})
        const applicationsPayload = extractPayload(applicationsResult.status === 'fulfilled' ? applicationsResult.value : {})
        const earningsPayload = extractPayload(earningsResult.status === 'fulfilled' ? earningsResult.value : {})
        const profilePayload = extractPayload(profileResult.status === 'fulfilled' ? profileResult.value : {})

        const appItems = normalizeList(applicationsPayload?.items || applicationsPayload?.applications || applicationsPayload)
        const appTotal = Number(applicationsPayload.total ?? applicationsPayload.count ?? appItems.length ?? 0)
        const projectRows = normalizeList(attendanceProjectsPayload?.items || attendanceProjectsPayload?.records || attendanceProjectsPayload?.projects || attendanceProjectsPayload)
        const summary = earningsPayload.summary || earningsPayload.payment_summary || earningsPayload || {}
        const rawChart = earningsPayload.chart || earningsPayload.earnings_chart || earningsPayload.earnings || earningsPayload.data || []
        const chartData = Array.isArray(rawChart)
          ? rawChart.map((item) => ({
              day: item.day || item.label || item.date || '',
              amount: Number(item.amount || item.value || item.earnings || 0),
            }))
          : []

        let records = []

        if (registrationId && projectRows.length > 0) {
          try {
            const attendanceRecordSets = await Promise.all(
              projectRows.map(async (project) => {
                const projectId = project?.project_id || project?.projectId || project?.id || ''
                const locationId = project?.location_id || project?.locationId || project?.location?.id || ''

                if (!projectId) return []

                try {
                  const attendanceRecordsResponse = await candidateAPI.getAttendanceRecords(registrationId, projectId, locationId, { offset: 0, limit: 60 })
                  const recordsPayload = extractPayload(attendanceRecordsResponse)
                  return normalizeList(recordsPayload?.items || recordsPayload?.records || recordsPayload)
                } catch (recordError) {
                  console.warn('Unable to load attendance records for calendar for project:', projectId, recordError)
                  return []
                }
              })
            )

            const seen = new Set()
            records = attendanceRecordSets.flat().filter((item) => {
              const key = `${item?.date || item?.timestamp || ''}-${item?.status || ''}`
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
          } catch (recordError) {
            console.warn('Unable to load attendance records for calendar:', recordError)
          }
        }

        setApplications(appItems)
        setApplicationCount(appTotal)
        setAttendanceSummary(projectRows)
        setAssignedProjects(projectRows)
        setAttendanceRecords(records)
        setEarningsSummary(summary)
        setEarningsChart(chartData)
        setProfile(profilePayload)
      } catch (error) {
        console.error('Dashboard load failed:', error)
      } finally {
        if (isMounted) {
          setLoading({ attendance: false, applications: false, earnings: false, profile: false })
        }
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [registrationId])

  const statCards = useMemo(() => [
    {
      key: 'applications',
      label: 'Applications',
      value: applicationCount || applications.length || 0,
      icon: faBriefcase,
      color: '#2563eb',
    },
    {
      key: 'attendance',
      label: 'Projects',
      value: attendanceSummary.length || assignedProjects.length || 0,
      icon: faCalendarCheck,
      color: '#16a34a',
    },
    {
      key: 'earnings',
      label: 'Earnings',
      value: formatCurrency(earningsSummary.total || earningsSummary.amount || 0),
      icon: faRupeeSign,
      color: '#ea580c',
    },
  ], [applicationCount, applications.length, attendanceSummary.length, assignedProjects.length, earningsSummary])

  const handleCalendarMonthChange = (delta) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const displayName = profile?.name || profile?.full_name || user?.name || user?.fullName || 'Candidate'
  const todayRecord = attendanceRecords.find((item) => {
    const dateValue = String(item?.date || item?.timestamp || '')
    return dateValue.includes(new Date().toISOString().slice(0, 10))
  })
  const todayStatusLabel = todayRecord?.status || 'No record yet'
  const isOnShift = Boolean(todayRecord && ['present', 'clocked-in', 'checked-in', 'late', 'exception', 'pending'].includes(String(todayRecord?.status || '').toLowerCase()))

  return (
    <div style={{ padding: 16, maxWidth: 1280, margin: '0 auto', display: 'none' }}>
      <PageHeader
        title={`Welcome back, ${displayName} 👋`}
        subtitle="A focused view of your latest applications, attendance, and payouts."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            icon={<FontAwesomeIcon icon={card.icon} />}
            iconStyle={{ background: `${card.color}15`, color: card.color }}
            value={card.value}
            label={card.label}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
        <Card style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)' }}>
          <CardHeader title="Today's attendance" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #eef2f7' }}>
            <div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Current status</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{todayStatusLabel}</div>
            </div>
          </div>
          <MiniCalendar attendance={attendanceRecords} loading={loading.attendance} currentMonth={calendarMonth} onMonthChange={handleCalendarMonthChange} />
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dcfce7' }} /> Present</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fee2e2' }} /> Absent</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fef3c7' }} /> Late</div>
          </div>
          <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Assigned projects</div>
            {loading.attendance ? (
              <div style={{ height: 80, background: '#f3f4f6', borderRadius: 10 }} />
            ) : assignedProjects.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 13 }}>No project assignments loaded yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {assignedProjects.slice(0, 3).map((project, index) => {
                  const projectName = project?.project_name || project?.projectName || project?.title || project?.name || `Project ${index + 1}`
                  const locationName = project?.location_name || project?.locationName || project?.location || project?.centre || 'Location pending'
                  return (
                    <div key={`${projectName}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{projectName}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}><FontAwesomeIcon icon={faMapMarkerAlt} /> {locationName}</div>
                      </div>
                      <Tag variant="gray">Active</Tag>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
        <Card style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)' }}>
          <CardHeader title="Recent applications" />
          {loading.applications ? (
            <div style={{ height: 220, background: '#f3f4f6', borderRadius: 12 }} />
          ) : applications.length === 0 ? (
            <div style={{ color: '#6b7280', padding: '24px 0' }}>No recent applications yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {applications.map((app, index) => {
                const title = app?.job_title || app?.title || app?.jobTitle || app?.designation || 'Application'
                const status = getStatusLabel(app)
                const appliedDate = app?.applied_on || app?.appliedAt || app?.date || app?.created_at || ''
                return (
                  <div key={`${title}-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#f8fafc', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{formatDate(appliedDate)}</div>
                      </div>
                      <Tag variant={getStatusVariant(status)}>{status}</Tag>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <button onClick={() => navigate('/app/candidate/applications')} style={{ background: 'transparent', border: 'none', color: '#2563eb', padding: 0, cursor: 'pointer', fontWeight: 600 }}>
              View all applications <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button onClick={() => navigate('/app/candidate/jobs')} style={{ ...actionButtonStyle, background: '#2563eb', color: '#fff', padding: '8px 12px' }}>
              <FontAwesomeIcon icon={faBriefcase} /> Find Jobs
            </button>
          </div>
        </Card>

        <Card style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)' }}>
          <CardHeader title="Earnings overview" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Current payout snapshot</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', fontWeight: 700 }}>
              <FontAwesomeIcon icon={faChartLine} /> {formatCurrency(earningsSummary.total || earningsSummary.amount || 0)}
            </div>
          </div>
          {loading.earnings ? (
            <div style={{ height: 220, background: '#f3f4f6', borderRadius: 12 }} />
          ) : earningsChart.length === 0 ? (
            <div style={{ color: '#6b7280', padding: '24px 0' }}>No earnings history available yet.</div>
          ) : (
            <div style={{ height: 260, maxHeight: 260, width: '100%', overflow: 'hidden', padding: '8px 4px 4px', borderRadius: 12, background: '#f8fafc', border: '1px solid #eef2f7' }}>
              <EarningsBarChart data={earningsChart} />
            </div>
          )}
        </Card>
      </div>

    </div>
  )
}

const actionButtonStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
}

