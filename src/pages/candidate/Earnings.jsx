import { useEffect, useState } from 'react'
import { Card, CardHeader, PageHeader, Tag, DataTable } from '../../components/ui/index'
import { EarningsLineChart } from '../../components/ui/Charts'
import { candidateAPI } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatCurrency = (v) => {
  const n = Number(v) || 0
  return `Rs ${n.toLocaleString('en-IN')}`
}

const statusVariant = (status) => {
  if (!status) return 'yellow'
  const s = String(status).toLowerCase()
  if (s.includes('credit') || s.includes('paid') || s.includes('credited')) return 'green'
  if (s.includes('pending')) return 'yellow'
  if (s.includes('failed') || s.includes('rejected')) return 'red'
  return 'blue'
}

export function CandidateEarnings() {
  const { user } = useAuth()
  const registrationId = user?.registrationId || user?.userId || localStorage.getItem('registration_id')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState({})
  const [chartData, setChartData] = useState([])
  const [payouts, setPayouts] = useState([])
  const currentYear = new Date().getFullYear()
  const [yearFilter, setYearFilter] = useState(currentYear)
  const [payoutType, setPayoutType] = useState('all')

  const payoutLabel = payoutType === 'all' ? 'All payouts' : payoutType === 'salary' ? 'Salary' : 'Expenses'
  const payoutCount = payouts.length
  const totalAmount = payouts.reduce((sum, p) => sum + Number(p.amount || p.paid_amount || p.amount_paid || p.value || 0), 0)
  const averagePayout = payoutCount ? totalAmount / payoutCount : 0
  const successfulPayouts = payouts.filter((p) => {
    const status = String(p.status || p.payment_status || p.state || '').toLowerCase()
    return /credit|paid|success|completed/.test(status)
  }).length
  const successRate = payoutCount ? `${Math.round((successfulPayouts / payoutCount) * 100)}%` : '—'
  const periodLabel = summary.periodLabel || String(yearFilter)

  useEffect(() => {
    const id = registrationId || 'usr_001'
    setLoading(true)
    setError(null)

    const params = { year: yearFilter }
    if (payoutType !== 'all') params.payout_type = payoutType

    candidateAPI.getEarnings(id, params).then((res) => {
      const payload = res?.data || {}
      const sum = payload.summary || payload.payment_summary || payload || {}
      setSummary({
        total: sum.total || payload.total || 0,
        periodLabel: sum.period || payload.period || String(yearFilter),
      })

      const rawChart = payload.chart || payload.earnings_chart || payload.earnings || payload.data || []
      const mappedChart = Array.isArray(rawChart) ? rawChart.map((d) => ({ day: d.day || d.label || d.date || '', amount: Number(d.amount || d.value || d.earnings || 0) })) : []
      setChartData(mappedChart)

      const rawPayouts = payload.payouts || payload.history || payload.payout_history || []
      setPayouts(Array.isArray(rawPayouts) ? rawPayouts : [])
    }).catch((err) => {
      setError(err?.message || 'Failed to load earnings')
    }).finally(() => setLoading(false))
  }, [registrationId, yearFilter, payoutType])

  return (
    <div className="candidate-earnings-page earnings-page">
      <PageHeader
        title="Earnings Dashboard"
        subtitle="A refreshed summary of your payouts, performance, and cash flow."
      />

      <div className="earnings-top-grid">
        <Card className="earnings-card earnings-hero-card">
          <div className="earnings-hero-head">
            <div>
              <div className="earnings-hero-pretitle">Earnings dashboard</div>
              <div className="earnings-hero-title">{loading ? 'Loading…' : formatCurrency(summary.total)}</div>
              <div className="earnings-hero-period">{periodLabel === String(yearFilter) ? `Year ${yearFilter}` : `Period ${periodLabel}`}</div>
            </div>
            <Tag variant="teal">{payoutLabel}</Tag>
          </div>

          <div className="earnings-hero-copy">A concise view of your payout performance, with clear growth signals and fast filter control.</div>

          <div className="earnings-hero-badges">
            <div className="earnings-hero-badge">
              <strong>{loading ? '—' : formatCurrency(totalAmount)}</strong>
              <span>Total paid</span>
            </div>
            <div className="earnings-hero-badge">
              <strong>{loading ? '—' : formatCurrency(averagePayout)}</strong>
              <span>Average payout</span>
            </div>
            <div className="earnings-hero-badge">
              <strong>{loading ? '—' : payoutCount}</strong>
              <span>Payments</span>
            </div>
          </div>
        </Card>

        <Card className="earnings-card earnings-panel-card">
          <div className="earnings-panel-head">
            <div>
              <div className="earnings-panel-title">View controls</div>
              <div className="earnings-panel-subtitle">Filter data and keep your payout metrics focused.</div>
            </div>
            <span className="chart-card-badge">Quick filter</span>
          </div>

          <div className="earnings-panel-filters">
            <div className="earnings-filter-item">
              <label htmlFor="yearFilter">Year</label>
              <select id="yearFilter" className="form-control" value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = currentYear - i
                  return <option key={y} value={y}>{y}</option>
                })}
              </select>
            </div>
            <div className="earnings-filter-item">
              <label htmlFor="payoutType">Payout type</label>
              <select id="payoutType" className="form-control" value={payoutType} onChange={(e) => setPayoutType(e.target.value)}>
                <option value="all">All payouts</option>
                <option value="salary">Salary</option>
                <option value="expenses">Expenses</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      <div className="earnings-content-grid">
        <Card className="earnings-card chart-card">
          <div className="chart-card-head">
            <div>
              <h2>Income trend</h2>
              <p className="chart-card-subtitle">Track your payout momentum across the selected year.</p>
            </div>
          </div>
          <div className="earnings-chart-wrapper">
            {loading ? (
              <div className="earnings-chart-empty">Loading chart data…</div>
            ) : chartData.length === 0 ? (
              <div className="earnings-chart-empty">No earnings trend available for this filter.</div>
            ) : (
              <EarningsLineChart data={chartData} />
            )}
          </div>
        </Card>

        <Card className="earnings-card history-card">
          <div className="history-card-head">
            <div>
              <h2>Recent payouts</h2>
              <p className="history-card-subtitle">Recent payments and their status, updated automatically.</p>
            </div>
            <span className="chart-card-badge">{loading ? 'Loading' : `${payoutCount} records`}</span>
          </div>

          {loading ? (
            <div className="earnings-loading">Loading payout history…</div>
          ) : error ? (
            <div className="earnings-error">{error}</div>
          ) : (
            <>
              <div className="earnings-history-table earnings-history-desktop">
                <DataTable
                  columns={["Date", "Amount", "Project", "Status"]}
                  rows={(payouts || []).map((p, i) => [
                    <span key={`date-${i}`} className="earnings-history-cell-date">{p.date || p.paid_at || p.created_at || '—'}</span>,
                    <span key={`amt-${i}`} className="earnings-history-cell-amount">{formatCurrency(p.amount || p.paid_amount || p.amount_paid || p.value)}</span>,
                    <span key={`proj-${i}`} className="earnings-history-cell-project">{p.project || p.projectName || p.project_title || p.description || '—'}</span>,
                    <Tag variant={statusVariant(p.status || p.payment_status || p.state)}>{p.status || p.payment_status || p.state || 'Unknown'}</Tag>
                  ])}
                  emptyMessage="No payout history available"
                />
              </div>

              <div className="earnings-history-mobile">
                {(payouts || []).length === 0 ? (
                  <div className="earnings-history-empty">No payout history available</div>
                ) : (
                  (payouts || []).map((p, i) => (
                    <div key={`mobile-${i}`} className="earnings-history-row">
                      <div className="earnings-history-row-top">
                        <div>
                          <div className="earnings-history-row-date">{p.date || p.paid_at || p.created_at || '—'}</div>
                          <div className="earnings-history-row-project">{p.project || p.projectName || p.project_title || p.description || 'Untitled payout'}</div>
                        </div>
                        <div className="earnings-history-row-amount">{formatCurrency(p.amount || p.paid_amount || p.amount_paid || p.value)}</div>
                      </div>
                      <div className="earnings-history-row-meta">
                        <Tag variant={statusVariant(p.status || p.payment_status || p.state)}>{p.status || p.payment_status || p.state || 'Unknown'}</Tag>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

export default CandidateEarnings
