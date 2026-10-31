import { Component, useEffect, useState } from 'react'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui'
import './ApplicationsStatsModal.css'

ChartJS.register(CategoryScale, LineElement, PointElement, Tooltip, Legend, Filler)

class ChartErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError
      ? <p className="applications-stats-empty">Chart unavailable</p>
      : this.props.children
  }
}

const STATUS_LABELS = {
  pending: 'Pending',
  interested: 'Interested',
  not_interrested: 'Not interested',
  not_interested: 'Not interested',
  call_not_answered: 'Call not answered',
  waiting_for_confirmation: 'Waiting for confirmation',
}
const STATUS_KEYS = ['interested', 'pending', 'not_interrested', 'call_not_answered', 'waiting_for_confirmation']
const STATUS_COLORS = ['#167D78', '#E5A33D', '#D95D59', '#6786B7', '#8E6BA8', '#438C85']

const unwrapData = (response) => {
  let payload = response?.data
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      throw new Error('The statistics response was not valid JSON.')
    }
  }
  if (payload?.success === false) throw new Error(payload.message || 'Could not load statistics.')
  return payload?.data ?? payload ?? {}
}

const getRows = (data, keys) => {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  return []
}

const toCount = (value) => {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? count : 0
}

const toSeries = (rows, nameKeys, countKeys) => rows.map((row, index) => ({
  label: String(nameKeys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? `Unknown ${index + 1}`),
  value: toCount(countKeys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null)),
}))

const getOptionValue = (row, keys) => String(keys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? '')

const getDailyRows = (data) => getRows(data, ['daily', 'daily_stats', 'by_day', 'timeline'])

const getDailyStatusCount = (row, status) => toCount(
  row?.[status] ?? row?.statuses?.[status] ?? row?.status_counts?.[status],
)

const getSummary = (data) => data?.summary ?? data?.totals ?? data?.stats ?? data ?? {}

const dateInputValue = (date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

const initialRange = () => {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { from: dateInputValue(from), to: dateInputValue(to) }
}

const formatRate = (value, interested, totalCandidates) => {
  const rate = Number(value)
  if (Number.isFinite(rate)) return `${Math.round((rate <= 1 ? rate * 100 : rate) * 10) / 10}%`
  return totalCandidates ? `${Math.round((interested / totalCandidates) * 1000) / 10}%` : '0%'
}

const dailyChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { usePointStyle: true, boxWidth: 8, padding: 14, color: '#52615D' },
    },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#66736F', maxTicksLimit: 10, autoSkip: true, maxRotation: 0 },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Calls', color: '#66736F' },
      grid: { color: '#E8ECEB' },
      ticks: { precision: 0, color: '#66736F' },
    },
  },
}

const getDailyTimeline = (rows, from, to) => {
  const rowsByDate = new Map(rows.map((row) => [String(row.date ?? row.day ?? ''), row]))
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []

  const dayCount = Math.floor((end - start) / 86400000) + 1
  if (dayCount > 366) {
    return rows.map((row) => ({
      date: String(row.date ?? row.day ?? ''),
      row,
    })).sort((left, right) => left.date.localeCompare(right.date))
  }

  const timeline = []
  for (let index = 0; index < dayCount; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    timeline.push({ date: dateInputValue(date), row: rowsByDate.get(dateInputValue(date)) || {} })
  }
  return timeline
}

const combineDailyStats = (projectPayloads) => {
  const summary = { total_calls: 0, total_candidates: 0, interested: 0 }
  const byDate = new Map()
  const projectTotals = []

  projectPayloads.forEach(({ projectId, payload }) => {
    const sourceSummary = getSummary(payload)
    summary.total_calls += toCount(sourceSummary.total_calls ?? sourceSummary.calls ?? sourceSummary.total)
    summary.total_candidates += toCount(sourceSummary.total_candidates ?? sourceSummary.total ?? sourceSummary.total_records)
    summary.interested += toCount(sourceSummary.interested ?? sourceSummary.interested_count)
    if (projectId) {
      projectTotals.push({
        project_id: projectId,
        total_calls: toCount(sourceSummary.total_calls ?? sourceSummary.calls ?? sourceSummary.total),
      })
    }

    getDailyRows(payload).forEach((row) => {
      const date = String(row.date ?? row.day ?? '')
      if (!date) return
      const current = byDate.get(date) || { date, calls: 0 }
      current.calls += toCount(row.calls ?? row.call_count ?? row.total_calls ?? row.total)
      STATUS_KEYS.forEach((status) => { current[status] = (current[status] || 0) + getDailyStatusCount(row, status) })
      byDate.set(date, current)
    })
  })

  summary.conversion_rate = summary.total_candidates
    ? (summary.interested / summary.total_candidates) * 100
    : 0

  return {
    summary,
    daily: Array.from(byDate.values()).sort((left, right) => left.date.localeCompare(right.date)),
    projects: projectTotals,
  }
}

export default function ApplicationsStatsModal({ isOpen, onClose, jobId = '', projectCatalog = [] }) {
  const [range, setRange] = useState(initialRange)
  const [filters, setFilters] = useState({ caller_id: '', job_id: jobId })
  const [overview, setOverview] = useState(null)
  const [filteredOverview, setFilteredOverview] = useState(null)
  const [dailyStats, setDailyStats] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [filteredOverviewLoading, setFilteredOverviewLoading] = useState(false)
  const [dailyLoading, setDailyLoading] = useState(false)
  const [error, setError] = useState('')
  const projects = getRows(overview, ['projects', 'by_project', 'project_stats'])

  useEffect(() => {
    if (!isOpen) return undefined
    let active = true
    setOverviewLoading(true)
    setError('')

    recruiterAPI.getShortTermHiringCallStats()
      .then((response) => {
        if (active) setOverview(unwrapData(response))
      })
      .catch((requestError) => {
        console.error('Failed to load short-term hiring call overview:', requestError)
        if (active) setError(requestError.message || 'Could not load statistics.')
      })
      .finally(() => {
        if (active) setOverviewLoading(false)
      })

    return () => { active = false }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) setFilters((current) => ({ ...current, job_id: jobId || '' }))
  }, [isOpen, jobId])

  useEffect(() => {
    if (!isOpen || !overview) return undefined
    let active = true
    const params = {
      ...(filters.caller_id ? { caller_id: filters.caller_id } : {}),
      ...(filters.job_id ? { project_id: filters.job_id } : {}),
    }

    if (!Object.keys(params).length) {
      setFilteredOverview(overview)
      setFilteredOverviewLoading(false)
      return undefined
    }

    setFilteredOverviewLoading(true)
    recruiterAPI.getShortTermHiringCallStats(params)
      .then((response) => {
        if (active) setFilteredOverview(unwrapData(response))
      })
      .catch((requestError) => {
        console.error('Failed to load filtered short-term hiring call overview:', requestError)
        if (active) setError(requestError.message || 'Could not load filtered statistics.')
      })
      .finally(() => {
        if (active) setFilteredOverviewLoading(false)
      })

    return () => { active = false }
  }, [isOpen, overview, filters])

  useEffect(() => {
    if (!isOpen || !overview) return undefined
    let active = true
    setDailyLoading(true)
    setError('')

    const overviewProjects = getRows(overview, ['projects', 'by_project', 'project_stats'])
    const projectIds = filters.job_id
      ? [filters.job_id]
      : overviewProjects.map((project) => getOptionValue(project, ['project_id', 'job_id', 'id'])).filter(Boolean)
    const requestsFor = projectIds.length ? projectIds : [null]
    const requestParams = {
      from: range.from,
      to: range.to,
      ...(filters.caller_id ? { caller_id: filters.caller_id } : {}),
    }

    Promise.all(requestsFor.map((projectId) => recruiterAPI.getShortTermHiringDailyStats({
      ...requestParams,
      ...(projectId ? { project_id: projectId } : {}),
    })))
      .then((responses) => {
        if (active) setDailyStats(combineDailyStats(responses.map((response, index) => ({
          projectId: requestsFor[index],
          payload: unwrapData(response),
        }))))
      })
      .catch((requestError) => {
        console.error('Failed to load short-term hiring daily statistics:', requestError)
        if (active) setError(requestError.message || 'Could not load statistics.')
      })
      .finally(() => {
        if (active) setDailyLoading(false)
      })

    return () => { active = false }
  }, [isOpen, range, filters, overview])

  const displayedOverview = filteredOverview ?? overview
  const callSummary = getSummary(displayedOverview)
  const statusSummary = getSummary(dailyStats)
  const history = getRows(displayedOverview, ['history', 'items', 'calls'])
  const dailyRows = getDailyRows(dailyStats)
  const dailyTimeline = getDailyTimeline(dailyRows, range.from, range.to)
  const callers = getRows(overview, ['callers', 'by_caller', 'caller_stats'])
  const displayedCallers = getRows(displayedOverview, ['callers', 'by_caller', 'caller_stats'])
  const displayedProjects = getRows(displayedOverview, ['projects', 'by_project', 'project_stats'])
  const responseStatusRows = getRows(dailyStats, ['statuses', 'status_breakdown', 'status_counts', 'by_status'])
  const statusRows = responseStatusRows.length ? responseStatusRows : STATUS_KEYS.map((status) => ({
    status,
    count: dailyRows.reduce((total, row) => total + getDailyStatusCount(row, status), 0),
  }))
  const statusSeries = toSeries(statusRows, ['status', 'name', 'label'], ['count', 'total', 'candidates'])
  const interested = toCount(statusSummary.interested ?? statusSummary.interested_count ?? statusSeries.find((item) => item.label.toLowerCase() === 'interested')?.value)
  const totalCandidates = toCount(statusSummary.total_candidates ?? statusSummary.total ?? statusSummary.total_records) || statusSeries.reduce((total, item) => total + item.value, 0)
  const totalCalls = toCount(statusSummary.total_calls ?? dailyRows.reduce((sum, row) => sum + toCount(row.calls), 0))
  const conversion = formatRate(statusSummary.conversion_rate ?? statusSummary.interest_rate, interested, totalCandidates)
  const callerOptions = callers.map((caller) => ({
    value: getOptionValue(caller, ['caller_id', 'user_id', 'id', 'calling_team_login_id', 'caller']),
    label: String(caller.caller_name ?? caller.user_name ?? caller.name ?? caller.label ?? caller.caller_id ?? 'Unknown caller'),
  })).filter((caller) => caller.value)
  const callerNames = new Map(callerOptions.map((caller) => [caller.value, caller.label]))
  const projectOptions = projects.map((project) => ({
    value: getOptionValue(project, ['project_id', 'job_id', 'id']),
    label: String(project.project_name ?? project.name ?? project.title ?? project.project_id ?? project.job_id ?? 'Unknown project'),
  })).filter((project) => project.value)
  const projectNameById = new Map(projectCatalog.map((project) => [
    String(project.id),
    project.projectName || String(project.name || '').replace(`${project.id} - `, ''),
  ]))
  const projectSeries = toSeries(dailyStats?.projects?.length ? dailyStats.projects : displayedProjects, ['project_name', 'name', 'project_id', 'job_id', 'label'], ['total_calls', 'calls', 'call_count', 'total'])
    .map((project) => ({
      ...project,
      id: project.label,
      label: projectNameById.get(project.label) || project.label,
    }))
    .sort((left, right) => right.value - left.value)
  const projectCalls = projectSeries.reduce((total, project) => total + project.value, 0)
  const callerRows = filters.caller_id
    ? callers.filter((caller) => getOptionValue(caller, ['caller_id', 'user_id', 'id', 'calling_team_login_id', 'caller']) === filters.caller_id)
    : displayedCallers
  const callerSeries = toSeries(callerRows, ['caller_name', 'name', 'user_name', 'caller', 'label'], ['total_calls', 'calls', 'call_count', 'total'])
    .sort((left, right) => right.value - left.value)
  const callerCalls = callerSeries.reduce((total, caller) => total + caller.value, 0)
  const statusTotal = statusSeries.reduce((total, status) => total + status.value, 0)
  const isLoading = overviewLoading || filteredOverviewLoading || dailyLoading

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Short-term hiring stats" maxWidth="1180px">
      <div className="applications-stats">
        <div className="applications-stats-filters">
          <label>
            <span>From</span>
            <input className="form-control" type="date" name="from" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
          </label>
          <label>
            <span>To</span>
            <input className="form-control" type="date" name="to" value={range.to} min={range.from} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
          </label>
          <label>
            <span>Caller</span>
            <select className="form-control" value={filters.caller_id} onChange={(event) => setFilters((current) => ({ ...current, caller_id: event.target.value }))}>
              <option value="">All callers</option>
              {callerOptions.map((caller) => <option key={caller.value} value={caller.value}>{caller.label}</option>)}
            </select>
          </label>
          <label>
            <span>Project</span>
            <select className="form-control" value={filters.job_id} onChange={(event) => setFilters((current) => ({ ...current, job_id: event.target.value }))}>
              <option value="">All projects</option>
              {projectOptions.map((project) => <option key={project.value} value={project.value}>{project.label}</option>)}
            </select>
          </label>
          {isLoading && <span className="applications-stats-refreshing" role="status">Updating stats…</span>}
          {jobId && <span className="applications-stats-scope">Applicants list filtered to project {jobId}</span>}
        </div>

        {error && <div className="applications-stats-error" role="alert">{error}</div>}
        {isLoading && !overview && !dailyStats ? (
          <div className="applications-stats-state" role="status">Loading statistics…</div>
        ) : (
          <>
            <div className="applications-stats-kpis">
              <div><span>Calls in selected period</span><strong>{totalCalls.toLocaleString()}</strong></div>
              <div><span>Candidates in selected period</span><strong>{toCount(statusSummary.total_candidates ?? statusSummary.unique_candidates).toLocaleString()}</strong></div>
              <div><span>Interested</span><strong>{interested.toLocaleString()}</strong></div>
              <div><span>Interest conversion</span><strong>{conversion}</strong></div>
            </div>

            <div className="applications-stats-grid">
              <section className="applications-stats-chart applications-stats-chart-wide">
                <h3>Daily calls &amp; outcomes</h3>
                {dailyTimeline.length ? <ChartErrorBoundary><div className="applications-stats-plot"><Line data={{
                  labels: dailyTimeline.map(({ date }) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                  datasets: [
                    ...STATUS_KEYS.map((status, index) => ({
                      label: STATUS_LABELS[status],
                      data: dailyTimeline.map(({ row }) => getDailyStatusCount(row, status)),
                      borderColor: STATUS_COLORS[index],
                      backgroundColor: STATUS_COLORS[index],
                      borderWidth: 2,
                      pointRadius: dailyTimeline.length > 20 ? 0 : 2,
                      pointHoverRadius: 5,
                      tension: 0.35,
                      fill: false,
                    })),
                    {
                      label: 'Total calls',
                      data: dailyTimeline.map(({ row }) => toCount(row.calls ?? row.call_count ?? row.total_calls ?? row.total)),
                      borderColor: '#174D49',
                      backgroundColor: 'rgba(23, 77, 73, 0.1)',
                      borderWidth: 3,
                      pointRadius: dailyTimeline.length > 20 ? 1 : 3,
                      pointHoverRadius: 6,
                      tension: 0.35,
                      fill: true,
                    },
                  ],
                }} options={dailyChartOptions} /></div></ChartErrorBoundary> : <p className="applications-stats-empty">No daily call or status data for this range.</p>}
              </section>
              <section className="applications-stats-chart applications-stats-callers">
                <div className="applications-stats-section-heading">
                  <div><h3>Calls by recruiter</h3><p>{filters.caller_id ? 'Selected caller' : 'All-time call activity, ranked'}</p></div>
                  <strong>{callerCalls.toLocaleString()} calls</strong>
                </div>
                {callerSeries.length ? (
                  <div className="applications-stats-rank-list">
                    {callerSeries.map((caller, index) => {
                      const share = callerCalls ? (caller.value / callerCalls) * 100 : 0
                      return (
                        <div className="applications-stats-rank-row" key={`${caller.label}-${index}`}>
                          <span className="applications-stats-rank-number">{String(index + 1).padStart(2, '0')}</span>
                          <div className="applications-stats-rank-main">
                            <div className="applications-stats-rank-label"><strong>{caller.label}</strong><span>{caller.value.toLocaleString()} calls <b>{share.toFixed(1)}%</b></span></div>
                            <div className="applications-stats-bar-track"><i style={{ width: `${share}%`, backgroundColor: '#438C85' }} /></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="applications-stats-empty">No caller breakdown available.</p>}
              </section>
              <section className="applications-stats-chart applications-stats-projects">
                <div className="applications-stats-section-heading">
                  <div><h3>Call volume by project</h3><p>Selected period, ranked by project</p></div>
                  <strong>{projectCalls.toLocaleString()} calls</strong>
                </div>
                {projectSeries.length ? (
                  <div className="applications-stats-rank-list">
                    {projectSeries.map((project, index) => {
                      const share = projectCalls ? (project.value / projectCalls) * 100 : 0
                      return (
                        <div className="applications-stats-rank-row" key={`${project.label}-${index}`}>
                          <span className="applications-stats-rank-number">{String(index + 1).padStart(2, '0')}</span>
                          <div className="applications-stats-rank-main">
                            <div className="applications-stats-rank-label"><div className="applications-stats-project-name"><strong>{project.label}</strong><small>ID: {project.id}</small></div><span>{project.value.toLocaleString()} calls <b>{share.toFixed(1)}%</b></span></div>
                            <div className="applications-stats-bar-track"><i style={{ width: `${share}%` }} /></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="applications-stats-empty">No project breakdown available.</p>}
              </section>
              <section className="applications-stats-chart applications-stats-status-chart">
                <div className="applications-stats-section-heading">
                  <div><h3>Status outcomes</h3><p>Counts and share for the selected dates and filters</p></div>
                  <strong>{statusTotal.toLocaleString()} candidates</strong>
                </div>
                {statusSeries.length ? (
                  <div className="applications-stats-outcomes">
                    {statusSeries.map((item, index) => {
                      const share = statusTotal ? (item.value / statusTotal) * 100 : 0
                      const label = STATUS_LABELS[item.label.toLowerCase()] || item.label
                      return (
                        <div className="applications-stats-outcome" key={item.label}>
                          <div className="applications-stats-outcome-label"><i style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} /><span>{label}</span></div>
                          <div className="applications-stats-outcome-value"><strong>{item.value.toLocaleString()}</strong><small>{share.toFixed(1)}%</small></div>
                          <div className="applications-stats-outcome-track"><i style={{ width: `${share}%`, backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }} /></div>
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="applications-stats-empty">No status breakdown available.</p>}
              </section>
              <section className="applications-stats-chart applications-stats-history">
                <h3>Recent call history</h3>
                {history.length ? (
                  <div className="applications-stats-history-wrap">
                    <table>
                      <thead>
                        <tr><th>Candidate</th><th>Number</th><th>Project</th><th>Caller</th><th>Called at</th></tr>
                      </thead>
                      <tbody>
                        {history.map((call, index) => (
                          <tr key={`${call.candidate_id ?? call.id ?? 'call'}-${call.call_time ?? index}`}>
                            <td>{call.candidate_name || call.name || '—'}</td>
                            <td>{call.number || '—'}</td>
                            <td>{call.job_id || call.project_id || '—'}</td>
                            <td>{callerNames.get(String(call.caller_id ?? '')) || call.caller_name || `User ${call.caller_id ?? '—'}`}</td>
                            <td>{call.call_time || call.created_at || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="applications-stats-empty">No call history available.</p>}
              </section>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}