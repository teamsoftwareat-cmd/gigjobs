import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { useTheme } from '../../context/ThemeContext'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
)

function useChartColors() {
  const { theme } = useTheme()
  return {
    text: theme === 'dark' ? '#8B949E' : '#8899AA',
    grid: theme === 'dark' ? '#2D3748' : '#E5E7EB',
  }
}

/* ============================= */
/* ===== EARNINGS BAR ===== */
/* ============================= */
export function EarningsBarChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const labels = data.map(d => d.day)
  const values = data.map(d => d.amount)

  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Earnings (₹)',
            data: values.length ? values : [0],
            backgroundColor: values.map((_, i) =>
              i === values.length - 1 ? '#0E7C86' : '#0E7C8699'
            ),
            borderRadius: 6,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              ticks: {
                color: text,
                callback: (v) => '₹' + v.toLocaleString('en-IN')
              },
              grid: { color: grid }
            },
            x: {
              ticks: { color: text },
              grid: { display: false }
            }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== ATTENDANCE BAR ===== */
/* ============================= */
export function AttendanceBarChart({ data = {} }) {
  const { text, grid } = useChartColors()

  const labels = ['Total Required', 'Total Available', 'Present', 'Absent']
  const values = [
    data.totalRequired || 0,
    data.totalAvailable || 0,
    data.present || 0,
    data.absent || 0,
  ]

  return (
    <div className="chart-container">
      <Bar
        data={{
          labels,
          datasets: [{
            label: 'Attendance',
            data: values,
            backgroundColor: ['#0E7C86', '#28A745', '#17A2B8', '#DC3545'],
            borderRadius: 6,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              ticks: { color: text },
              grid: { color: grid }
            },
            x: {
              ticks: { color: text },
              grid: { display: false }
            }
          }
        }}
      />
    </div>
  )
}
export function EarningsLineChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const labels = data.map(d => d.day)
  const values = data.map(d => d.amount)

  return (
    <div className="chart-container">
      <Line
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Earnings',
            data: values.length ? values : [0],
            borderColor: '#0E7C86',
            backgroundColor: '#0E7C8622',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#0E7C86',
            pointRadius: 5,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              ticks: {
                color: text,
                callback: (v) => '₹' + v.toLocaleString('en-IN')
              },
              grid: { color: grid }
            },
            x: {
              ticks: { color: text },
              grid: { display: false }
            }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== PLACEMENTS ===== */
/* ============================= */
export function PlacementsChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const labels = data.map(d => d.month)
  const placements = data.map(d => d.placements)
  const targets = data.map(d => d.target)

  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [
            {
              label: 'Placements',
              data: placements.length ? placements : [0],
              backgroundColor: '#0E7C86CC',
              borderRadius: 6,
            },
            {
              label: 'Target',
              type: 'line',
              data: targets.length ? targets : [0],
              borderColor: '#F4A130',
              borderDash: [5, 5],
              borderWidth: 2,
              pointRadius: 0,
            }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: text } } },
          scales: {
            y: { ticks: { color: text }, grid: { color: grid } },
            x: { ticks: { color: text }, grid: { display: false } }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== ATTENDANCE DOUGHNUT ===== */
/* ============================= */
export function AttendanceDoughnut({ data = {} }) {
  const { text } = useChartColors()

  const values = [
    data.present || 0,
    data.absent || 0,
    data.leave || 0,
  ]

  return (
    <div className="chart-container">
      <Doughnut
        data={{
          labels: ['Present', 'Absent', 'On Leave'],
          datasets: [{
            data: values,
            backgroundColor: ['#1B9E5C', '#E53935', '#F4A130'],
            borderWidth: 0,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'right',
              labels: { color: text, boxWidth: 12 }
            }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== TICKET ACTIVITY LINE CHART ===== */
/* ============================= */
export function TicketActivityLineChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const labels = data.map(d => d.date)
  const raised = data.map(d => d.raised)
  const resolved = data.map(d => d.resolved)

  return (
    <div className="chart-container" style={{ height: '300px', width: '100%' }}>
      <Line
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [
            {
              label: 'Tickets Raised',
              data: raised.length ? raised : [0],
              borderColor: '#3b82f6', // Blue
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#3b82f6',
            },
            {
              label: 'Tickets Resolved',
              data: resolved.length ? resolved : [0],
              borderColor: '#10b981', // Green
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#10b981',
            }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: text } },
            tooltip: { bodyColor: text, titleColor: text }
          },
          scales: {
            y: { ticks: { color: text, beginAtZero: true }, grid: { color: grid } },
            x: { ticks: { color: text }, grid: { display: false } }
          },
          layout: { padding: { top: 20, bottom: 20, left: 10, right: 10 } }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== SPARKLINE ===== */
/* ============================= */
export function Sparkline({ data = [], color = '#0E7C86', height = 36 }) {
  const { text } = useChartColors()
  const values = Array.isArray(data) ? data : []
  return (
    <div style={{ height, width: '100%' }}>
      <Line
        data={{ labels: values.map((_, i) => i), datasets: [{ data: values.length ? values : [0], borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.3, pointRadius: 0 }] }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          elements: { line: { borderWidth: 2 } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== AADHAAR STACKED CITY ===== */
/* ============================= */
export function AadharCityStackedChart({ valid = [], invalid = [] }) {
  const { text, grid } = useChartColors()

  const map = {}
  ;(valid || []).forEach((d) => { const city = d.city || d.location || 'Unknown'; map[city] = map[city] || { valid: 0, invalid: 0 }; map[city].valid += d.count || 0 })
  ;(invalid || []).forEach((d) => { const city = d.city || d.location || 'Unknown'; map[city] = map[city] || { valid: 0, invalid: 0 }; map[city].invalid += d.count || 0 })

  const rows = Object.entries(map).map(([city, counts]) => ({ city, valid: counts.valid || 0, invalid: counts.invalid || 0 }))
  const top = rows.sort((a, b) => (b.valid + b.invalid) - (a.valid + a.invalid)).slice(0, 8)

  const labels = top.map(r => r.city)
  const val = top.map(r => r.valid)
  const inv = top.map(r => r.invalid)

  return (
    <div className="chart-container" style={{ height: '320px' }}>
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [
            { label: 'Valid', data: val.length ? val : [0], backgroundColor: '#1B9E5C' },
            { label: 'Invalid', data: inv.length ? inv : [0], backgroundColor: '#E53935' }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: text } }, tooltip: { bodyColor: text } },
          scales: {
            x: { stacked: true, ticks: { color: text }, grid: { display: false } },
            y: { stacked: true, ticks: { color: text }, grid: { color: grid } }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== TOP PROJECTS BAR ===== */
/* ============================= */
export function TopProjectsBarChart({ data = [] }) {
  const { text, grid } = useChartColors()
  const sorted = (data || []).slice().sort((a, b) => b.count - a.count).slice(0, 8)
  const labels = sorted.map(d => d.name || d.projectName || d.project || 'Unknown')
  const values = sorted.map(d => d.count || d.candidates || d.total || 0)

  return (
    <div className="chart-container" style={{ height: '320px' }}>
      <Bar
        data={{ labels: labels.length ? labels : ['No Data'], datasets: [{ label: 'Candidates', data: values.length ? values : [0], backgroundColor: '#0E7C86', borderRadius: 6 }] }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { color: text }, grid: { color: grid } }, x: { ticks: { color: text }, grid: { display: false } } }
        }}
      />
    </div>
  )
}

export function ProjectPaymentStackedBarChart({ data = [], type = 'amount' }) {
  const { text, grid } = useChartColors()
  const rows = Array.isArray(data) ? data : []
  const labels = rows.map((item) => item.projectName || item.name || item.title || item.id || 'Unknown')
  const paid = rows.map((item) => {
    const summary = item.paymentSummary || item.payment_summary || {}
    return Number(
      type === 'count'
        ? (summary.paidCount || summary.paid_count || 0)
        : (summary.totalPaid || summary.paidAmount || summary.amountPaid || 0)
    )
  })
  const pending = rows.map((item) => {
    const summary = item.paymentSummary || item.payment_summary || {}
    return Number(
      type === 'count'
        ? (summary.pendingCount || summary.pending_count || 0)
        : (summary.totalPending || summary.pendingAmount || summary.amountPending || 0)
    )
  })

  return (
    <div className="chart-container" style={{ height: '320px' }}>
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [
            { label: type === 'count' ? 'Paid People' : 'Amount Paid', data: paid.length ? paid : [0], backgroundColor: '#10b981', borderRadius: 6 },
            { label: type === 'count' ? 'Pending People' : 'Amount Pending', data: pending.length ? pending : [0], backgroundColor: '#ef4444', borderRadius: 6 }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: text } },
            tooltip: { bodyColor: text, titleColor: text }
          },
          scales: {
            x: { stacked: true, ticks: { color: text }, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { color: text }, grid: { color: grid } }
          }
        }}
      />
    </div>
  )
}

export function AadharStatusDoughnut({ data = {} }) {
  const { text } = useChartColors()
  const values = [data.verified || 0, data.invalid || 0, data.pending || 0]

  return (
    <div className="chart-container">
      <Doughnut
        data={{
          labels: ['Verified', 'Invalid OCR', 'Pending Review'],
          datasets: [{
            data: values,
            backgroundColor: ['#1B9E5C', '#E53935', '#F4A130'],
            borderWidth: 0,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'right',
              labels: { color: text, boxWidth: 12 }
            }
          }
        }}
      />
    </div>
  )
}

export function OCRTrendChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const labels = data.map(d => d.day)
  const valid = data.map(d => d.valid)
  const invalid = data.map(d => d.invalid)

  return (
    <div className="chart-container" style={{ height: '300px' }}>
      <Line
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [
            {
              label: 'Valid OCR',
              data: valid.length ? valid : [0],
              borderColor: '#1B9E5C',
              backgroundColor: '#1B9E5C33',
              fill: true,
              tension: 0.35,
              pointRadius: 4,
            },
            {
              label: 'Invalid OCR',
              data: invalid.length ? invalid : [0],
              borderColor: '#E53935',
              backgroundColor: '#E5393533',
              fill: true,
              tension: 0.35,
              pointRadius: 4,
            }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: text },
              position: 'top'
            }
          },
          scales: {
            y: {
              ticks: {
                color: text,
                beginAtZero: true
              },
              grid: { color: grid }
            },
            x: {
              ticks: {
                color: text,
                maxRotation: 45,
                minRotation: 0
              },
              grid: { display: false }
            }
          },
          layout: {
            padding: {
              top: 20,
              bottom: 20,
              left: 10,
              right: 10
            }
          }
        }}
      />
    </div>
  )
}

export function ProjectStatusChart({ data = [] }) {
  const { text, grid } = useChartColors()
  const counts = data.reduce((acc, project) => {
    const status = (project.status || 'unknown').toString().toLowerCase()
    if (status === 'active') acc.active += 1
    else if (status === 'completed') acc.completed += 1
    else if (status === 'paused') acc.paused += 1
    else acc.other += 1
    return acc
  }, { active: 0, completed: 0, paused: 0, other: 0 })

  const labels = ['Active', 'Completed', 'Paused', 'Other']
  const values = [counts.active, counts.completed, counts.paused, counts.other]

  return (
    <div className="chart-container" style={{ height: '320px' }}>
      <Doughnut
        data={{
          labels,
          datasets: [{
            data: values,
            backgroundColor: ['#0E7C86', '#4F46E5', '#F59E0B', '#94A3B8'],
            borderWidth: 0,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: text }, position: 'bottom' },
            tooltip: { bodyColor: text, titleColor: text }
          }
        }}
      />
    </div>
  )
}

export function ProjectLocationChart({ data = [] }) {
  const { text, grid } = useChartColors()
  const locationMap = data.reduce((acc, project) => {
    const location = project.location || 'Unknown'
    acc[location] = (acc[location] || 0) + 1
    return acc
  }, {})

  const sortedLocations = Object.entries(locationMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const labels = sortedLocations.map(([loc]) => loc)
  const values = sortedLocations.map(([, count]) => count)

  return (
    <div className="chart-container" style={{ height: '320px' }}>
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Projects',
            data: values.length ? values : [0],
            backgroundColor: '#0E7C86',
            borderRadius: 8,
            maxBarThickness: 26,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { bodyColor: text, titleColor: text }
          },
          scales: {
            y: {
              ticks: { color: text, beginAtZero: true },
              grid: { color: grid }
            },
            x: {
              ticks: { color: text },
              grid: { display: false }
            }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== AADHAAR CITY BAR ===== */
/* ============================= */
export function AadharCityBarChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const sorted = (data || []).slice().sort((a, b) => b.count - a.count).slice(0, 8)
  const labels = sorted.map(d => d.city || d.location || 'Unknown')
  const values = sorted.map(d => d.count || 0)

  return (
    <div className="chart-container" style={{ height: '300px' }}>
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Aadhaar Records',
            data: values.length ? values : [0],
            backgroundColor: '#6C3FC5',
            borderRadius: 6,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { color: text, beginAtZero: true }, grid: { color: grid } },
            x: { ticks: { color: text }, grid: { display: false } }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== REVENUE ===== */
/* ============================= */
export function RevenueChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const labels = data.map(d => d.month)
  const revenue = data.map(d => d.revenue)
  const payouts = data.map(d => d.payouts)

  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [
            {
              label: 'Revenue (₹L)',
              data: revenue.length ? revenue : [0],
              backgroundColor: '#6C3FC5CC',
              borderRadius: 6
            },
            {
              label: 'Payouts (₹L)',
              data: payouts.length ? payouts : [0],
              backgroundColor: '#0E7C86CC',
              borderRadius: 6
            },
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: text } } },
          scales: {
            y: {
              ticks: {
                color: text,
                callback: (v) => '₹' + v + 'L'
              },
              grid: { color: grid }
            },
            x: { ticks: { color: text }, grid: { display: false } }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== MAN DAYS ===== */
/* ============================= */
export function ManDaysChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const labels = data.map(d => d.month)
  const actual = data.map(d => d.actual)
  const target = data.map(d => d.target)

  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: labels.length ? labels : ['No Data'],
          datasets: [
            {
              label: 'Actual Man Days',
              data: actual.length ? actual : [0],
              backgroundColor: '#0E7C86CC',
              borderRadius: 6,
            },
            {
              label: 'Target',
              type: 'line',
              data: target.length ? target : [0],
              borderColor: '#F4A130',
              borderDash: [5, 5],
              borderWidth: 2,
              pointRadius: 3,
            }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: text } } },
          scales: {
            y: {
              ticks: {
                color: text,
                callback: (v) => v.toLocaleString('en-IN')
              },
              grid: { color: grid }
            },
            x: { ticks: { color: text }, grid: { display: false } }
          }
        }}
      />
    </div>
  )
}

/* ============================= */
/* ===== CENTRES ATTENDANCE BAR ===== */
/* ============================= */
export function CentresAttendanceChart({ data = [] }) {
  const { text, grid } = useChartColors()

  const centres = data.map(d => d.centre)
  const present = data.map(d => d.present)
  const absent = data.map(d => d.absent)
  const totalRequired = data.reduce((sum, d) => sum + Number(d.total_required || 0), 0)
  const totalAvailable = data.reduce((sum, d) => sum + Number(d.total_available || 0), 0)
  const supervisors = data.reduce((sum, d) => sum + Number(d.supervisors || 0), 0)
  const videographers = data.reduce((sum, d) => sum + Number(d.videographers || 0), 0)
  const operators = data.reduce((sum, d) => sum + Number(d.operators || 0), 0)

  return (
    <>
      <div className="chart-container">
        <Bar
          data={{
            labels: centres.length ? centres : ['No Data'],
            datasets: [
              {
                label: 'Present',
                data: present.length ? present : [0],
                backgroundColor: '#28A745',
                borderRadius: 6,
              },
              {
                label: 'Absent',
                data: absent.length ? absent : [0],
                backgroundColor: '#DC3545',
                borderRadius: 6,
              }
            ]
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'x',
            plugins: { legend: { labels: { color: text } } },
            scales: {
              y: {
                ticks: { color: text },
                grid: { color: grid }
              },
              x: {
                ticks: { color: text },
                grid: { display: false }
              }
            }
          }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '16px' }}>
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(14, 124, 134, 0.08)', color: text }}>
          <div style={{ fontSize: '12px', marginBottom: '6px' }}>Total Required</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{totalRequired}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(23, 162, 184, 0.08)', color: text }}>
          <div style={{ fontSize: '12px', marginBottom: '6px' }}>Total Available</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{totalAvailable}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(111, 66, 193, 0.08)', color: text }}>
          <div style={{ fontSize: '12px', marginBottom: '6px' }}>Supervisors</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{supervisors}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(232, 62, 140, 0.08)', color: text }}>
          <div style={{ fontSize: '12px', marginBottom: '6px' }}>Videographers</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{videographers}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(253, 126, 20, 0.08)', color: text }}>
          <div style={{ fontSize: '12px', marginBottom: '6px' }}>Operators</div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{operators}</div>
        </div>
      </div>
    </>
  )
}