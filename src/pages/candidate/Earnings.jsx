import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Tag, DataTable } from '../../components/ui/index'
import { EarningsPieChart } from '../../components/ui/Charts'
import { candidateAPI } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`
const formatPaymentDate = (date) => {
  if (!date) return '—'
  const parsedDate = new Date(date)
  if (Number.isNaN(parsedDate.getTime())) return '—'
  return parsedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getPayouts = (response) => {
  const payload = response?.data?.data ?? response?.data ?? response ?? {}
  const rows = Array.isArray(payload)
    ? payload
    : payload?.payouts || payload?.payments || payload?.payment_history || payload?.payout_history || payload?.items || payload?.records || payload?.earnings || []

  if (!Array.isArray(rows)) return []

  return rows.map((item, index) => {
    const rawPayoutType = String(item?.payout_type || item?.payoutType || item?.type || '').toLowerCase()
    return {
      id: item?.id ?? item?.payout_id ?? item?.payment_id ?? index,
      project: item?.project_name || item?.projectName || item?.project?.name || item?.project || '—',
      amount: Number(item?.amount ?? item?.total_amount ?? item?.net_amount ?? item?.earnings ?? 0),
      feeType: item?.fee_type || item?.type_of_fee || item?.feeType || item?.payment_type || item?.type || 'Earnings',
      date: item?.payment_date || item?.payout_date || item?.date || item?.paid_at || item?.created_at || '',
      payoutType: rawPayoutType.includes('expense') || rawPayoutType.includes('reimburse') ? 'expenses' : 'salary',
      status: item?.payment_status || item?.status || 'Pending',
    }
  })
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
  const currentYear = new Date().getFullYear()
  const registrationId = user?.registrationId || user?.registration_id || localStorage.getItem('registration_id') || ''
  const [yearFilter, setYearFilter] = useState(currentYear)
  const [payoutType, setPayoutType] = useState('all')
  const [breakdownBy, setBreakdownBy] = useState('project')
  const [payoutData, setPayoutData] = useState([])
  const [loading, setLoading] = useState(Boolean(registrationId))
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isMounted = true

    if (!registrationId) {
      setPayoutData([])
      setLoading(false)
      return () => {
        isMounted = false
      }
    }

    setLoading(true)
    setLoadError(false)
    candidateAPI.getEarnings(registrationId, { year: yearFilter })
      .then((response) => {
        if (isMounted) setPayoutData(getPayouts(response))
      })
      .catch((error) => {
        console.error('Unable to load candidate earnings:', error)
        if (isMounted) {
          setPayoutData([])
          setLoadError(true)
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [registrationId, yearFilter])

  const payoutLabel = payoutType === 'all' ? 'All payouts' : payoutType === 'salary' ? 'Salary' : 'Expenses'
  const payouts = useMemo(() => payoutData.filter((payout) => (
    (!payout.date || Number(String(payout.date).slice(0, 4)) === yearFilter) &&
    (payoutType === 'all' || payout.payoutType === payoutType)
  )), [payoutData, yearFilter, payoutType])
  const payoutCount = payouts.length
  const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0)
  const averagePayout = payoutCount ? totalAmount / payoutCount : 0
  const breakdown = useMemo(() => {
    const totals = new Map()
    payouts.forEach((payout) => {
      const label = breakdownBy === 'project' ? payout.project : payout.feeType
      totals.set(label, (totals.get(label) || 0) + payout.amount)
    })
    return Array.from(totals, ([label, amount]) => ({ label, amount }))
  }, [payouts, breakdownBy])

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
              <div className="earnings-hero-title">{formatCurrency(totalAmount)}</div>
              <div className="earnings-hero-period">Year {yearFilter}</div>
            </div>
            <Tag variant="teal">{payoutLabel}</Tag>
          </div>

          <div className="earnings-hero-copy">A concise view of your payout performance, with clear growth signals and fast filter control.</div>

          <div className="earnings-hero-badges">
            <div className="earnings-hero-badge">
              <strong>{formatCurrency(totalAmount)}</strong>
              <span>Total earnings</span>
            </div>
            <div className="earnings-hero-badge">
              <strong>{formatCurrency(averagePayout)}</strong>
              <span>Average payment</span>
            </div>
            <div className="earnings-hero-badge">
              <strong>{payoutCount}</strong>
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
              <h2>Earnings breakdown</h2>
              <p className="chart-card-subtitle">Compare earnings by project or fee type.</p>
            </div>
            <div className="earnings-breakdown-toggle" role="group" aria-label="Breakdown grouping">
              <button
                type="button"
                className={`earnings-breakdown-button${breakdownBy === 'project' ? ' active' : ''}`}
                aria-pressed={breakdownBy === 'project'}
                onClick={() => setBreakdownBy('project')}
              >
                Project
              </button>
              <button
                type="button"
                className={`earnings-breakdown-button${breakdownBy === 'fee' ? ' active' : ''}`}
                aria-pressed={breakdownBy === 'fee'}
                onClick={() => setBreakdownBy('fee')}
              >
                Fee type
              </button>
            </div>
          </div>
          <div className="earnings-chart-wrapper earnings-pie-chart-wrapper">
            {loading ? (
              <div className="earnings-chart-empty">Loading earnings...</div>
            ) : breakdown.length === 0 ? (
              <div className="earnings-chart-empty">No earnings available for this filter.</div>
            ) : (
              <EarningsPieChart data={breakdown} />
            )}
          </div>
        </Card>

        <Card className="earnings-card history-card">
          <div className="history-card-head">
            <div>
              <h2>Payment history</h2>
              <p className="history-card-subtitle">Project earnings, fee types, and payment dates.</p>
            </div>
            <span className="chart-card-badge">{payoutCount} records</span>
          </div>

          <div className="earnings-history-table earnings-history-desktop">
            {loading ? (
              <div className="earnings-history-empty">Loading payment history...</div>
            ) : loadError ? (
              <div className="earnings-history-empty">Unable to load payment history.</div>
            ) : (
              <DataTable
                columns={['Project Name', 'Amount', 'Type of Fee', 'Payment Date']}
                rows={payouts.map((payout) => [
                  <strong key={`project-${payout.id}`} className="earnings-history-cell-project">{payout.project}</strong>,
                  <span key={`amount-${payout.id}`} className="earnings-history-cell-amount">{formatCurrency(payout.amount)}</span>,
                  <Tag key={`fee-${payout.id}`} variant="teal">{payout.feeType}</Tag>,
                  <span key={`date-${payout.id}`} className="earnings-history-cell-date">{formatPaymentDate(payout.date)}</span>,
                ])}
                emptyMessage="No payout history available for this filter"
              />
            )}
          </div>

          <div className="earnings-history-mobile">
            {loading ? (
              <div className="earnings-history-empty">Loading payment history...</div>
            ) : loadError ? (
              <div className="earnings-history-empty">Unable to load payment history.</div>
            ) : payouts.length === 0 ? (
              <div className="earnings-history-empty">No payout history available for this filter</div>
            ) : (
              payouts.map((payout) => (
                <div key={`mobile-${payout.id}`} className="earnings-history-row">
                  <div className="earnings-history-row-top">
                    <div>
                      <div className="earnings-history-row-project">{payout.project}</div>
                      <div className="earnings-history-row-date">{formatPaymentDate(payout.date)}</div>
                    </div>
                    <div className="earnings-history-row-amount">{formatCurrency(payout.amount)}</div>
                  </div>
                  <div className="earnings-history-row-meta">
                    <Tag variant="teal">{payout.feeType}</Tag>
                    <Tag variant={statusVariant(payout.status)}>{payout.status}</Tag>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

export default CandidateEarnings
