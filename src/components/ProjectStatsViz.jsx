import React, { useEffect, useState, useRef } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

export default function ProjectStatsViz({ rows = [], totals = { required: 0, available: 0, unfilled: 0 }, viewMode = 'location', currentDistrict = null, onDrill = () => {} }) {
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 720 : false)
  const barRef = useRef(null)

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 720)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const labels = rows.map((r) => (
    viewMode === 'centre'
      ? r.centre_name || r.centre || r.name || r.label || 'Unknown'
      : r.district || r.district_name || r.location || r.location_name || r.name || r.label || 'Unknown'
  ))

  const filled = rows.map((r) => Number(r.available ?? r.available_count ?? r.present ?? r.filled ?? 0))
  const required = rows.map((r) => Number(r.required ?? r.required_count ?? r.total_required ?? r.requiredCount ?? 0))
  const unfilled = required.map((req, i) => Math.max(0, req - (filled[i] || 0)))

  const barData = {
    labels,
    datasets: [
      { label: 'Present', data: filled, backgroundColor: 'rgba(75,192,75,0.9)' },
      { label: 'Absent', data: unfilled, backgroundColor: 'rgba(255,159,64,0.95)' }
    ]
  }

  const barOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true } },
    onClick: (evt, elements) => {
      if (!elements || elements.length === 0) return
      const idx = elements[0].index
      if (rows[idx]) onDrill(rows[idx])
    }
  }

  const doughnutData = {
    labels: ['Present', 'Absent'],
    datasets: [{ data: [totals.available || 0, totals.unfilled || 0], backgroundColor: ['rgba(75,192,75,0.9)', 'rgba(255,159,64,0.95)'] }]
  }

  return (
    <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: 10, alignItems: 'stretch' }}>
      <div style={{ flex: '0 0 240px', display: 'grid', gap: 8, alignItems: 'start' }}>
        <div style={{ padding: 10, borderRadius: 10, background: '#fff', border: '1px solid rgba(15,23,42,0.06)' }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Project Fill Rate</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{totals.available} / {totals.required}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: (totals.required > 0 ? Math.round((totals.available / totals.required) * 100) : 0) >= 80 ? 'green' : (totals.required > 0 ? Math.round((totals.available / totals.required) * 100) : 0) >= 50 ? 'orange' : 'red' }}>{totals.required > 0 ? Math.round((totals.available / totals.required) * 100) : 0}%</div>
        </div>

        <div style={{ padding: 10, borderRadius: 10, background: '#fff', border: '1px solid rgba(15,23,42,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Present</div>
          <div style={{ fontWeight: 700, textAlign: 'right' }}>{totals.available}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Absent</div>
          <div style={{ fontWeight: 700, textAlign: 'right' }}>{totals.unfilled}</div>
        </div>

        <div style={{ padding: 8, borderRadius: 10, background: '#fff', border: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 120, height: 120 }}>
            <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 8 } } } }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 220, background: '#fff', borderRadius: 12, padding: 12, border: '1px solid rgba(15,23,42,0.06)' }}>
        <div style={{ height: isNarrow ? 320 : Math.max(220, rows.length * 36) }}>
          <Bar ref={barRef} data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  )
}
