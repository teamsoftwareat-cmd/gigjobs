import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, CardHeader, DataTable, Tag, StatCard } from '../../components/ui/index'
import { candidateAPI, recruiterAPI } from '../../api/axios'

import { useAuth } from '../../context/AuthContext'

export default function CallingProjects({ registrationIdOverride, onViewRecipients, useRecruiterApi = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const registrationId = registrationIdOverride ?? user?.registrationId
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const [projectLocations, setProjectLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const [kpis, setKpis] = useState({ 
    totalProjects: 0, 
    totalRecipients: 0, 
    calledRecipients: 0, 
    pendingRecipients: 0 
  })

  const fetchKpis = useCallback(() => {
    try {
      const stats = {
        totalProjects: projectLocations.length,
        totalRecipients: projectLocations.reduce((sum, pl) => sum + (pl.recipientCount || 0), 0),
        calledRecipients: projectLocations.reduce((sum, pl) => sum + (pl.calledCount || 0), 0),
        pendingRecipients: projectLocations.reduce((sum, pl) => sum + (pl.pendingCount || 0), 0),
      }
      setKpis(stats)
    } catch (err) {
      setKpis({ totalProjects: 0, totalRecipients: 0, calledRecipients: 0, pendingRecipients: 0 })
    }
  }, [projectLocations])

  const fetchProjectLocations = useCallback(async () => {
    if (!registrationId) return
    
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const params = { 
        search: search || undefined, 
        offset, 
        limit: pageSize 
      }
      const apiClient = useRecruiterApi ? recruiterAPI : candidateAPI
      const res = await apiClient.getAssignedProjectLocations(registrationId, params)
      const data = res.data?.data || {}
      const items = data.items || []
      setProjectLocations(items)
      setTotal(data.total || items.length)
    } catch (err) {
      console.error('Failed to fetch project locations:', err)
      setProjectLocations([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, registrationId])

  useEffect(() => {
    fetchProjectLocations()
  }, [fetchProjectLocations])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  const handleViewRecipients = (projectId, projectName, pl) => {
    const projectType = pl.projectType || (pl.district && pl.centre ? 'written' : 'regular')
    const displayLocation = projectType === 'written'
      ? `${pl.district} - ${pl.centre}`
      : pl.location
    const districtId = pl.districtId || pl.district_id || pl.district || undefined
    const centreId = pl.centreId || pl.centre_id || pl.centre || undefined

    const navState = {
      projectId,
      projectName,
      projectType,
      callerId: pl.id ? String(pl.id).replace('pl-', '') : undefined,
      location: pl.location || undefined,
      locationId: pl.locationId || pl.location_id || undefined,
      district: pl.district || undefined,
      centre: pl.centre || undefined,
      districtId,
      centreId,
      projectLocation: `${projectName} - ${displayLocation}`
    }

    if (typeof onViewRecipients === 'function') {
      onViewRecipients(navState)
      return
    }

    navigate('/app/candidate/calling/recipients', { state: navState })
  }

  const columns = ['Project', 'Location', 'District', 'Centre', 'Total Recipients', 'Called', 'Pending', 'Actions']

  const rows = projectLocations.map((pl) => {
    const calledCount = pl.calledCount || 0
    const pendingCount = pl.pendingCount || 0
    const totalCount = pl.recipientCount || 0
    const projectType = pl.projectType || (pl.district && pl.centre ? 'written' : 'regular')

    return [
      pl.project || pl.projectName || '-',
      projectType === 'written' ? '-' : (pl.location || pl.locationId || '-'),
      projectType === 'written' ? (pl.district || '-') : '-',
      projectType === 'written' ? (pl.centre || '-') : '-',
      totalCount,
      <Tag key={`called-${pl.id}`} variant="green">{calledCount}</Tag>,
      <Tag key={`pending-${pl.id}`} variant="yellow">{pendingCount}</Tag>,
      <button
        className="btn btn-primary btn-sm"
        onClick={() => handleViewRecipients(
          pl.projectId || pl.project_id,
          pl.project || pl.projectName,
          pl
        )}
        style={{ padding: '4px 8px', fontSize: '11px' }}
      >
        View Recipients →
      </button>
    ]
  })

  const lastPage = Math.max(1, Math.ceil((total || 0) / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(page * pageSize, total)

  const totalPages = lastPage
  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)))
  const pageEnd = Math.min(totalPages, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  useEffect(() => {
    const lp = Math.max(1, Math.ceil((total || 0) / pageSize))
    if (page > lp) setPage(lp)
  }, [total, pageSize, page])

  return (
    <div className="candidate-calling-page">
      <PageHeader 
        title="Calling Projects" 
        subtitle="Select a project-location to view and call recipients"
      />

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card-wrapper">
          <StatCard icon="📋" value={kpis.totalProjects} label="Projects" />
        </div>
        <div className="stat-card-wrapper">
          <StatCard icon="👥" value={kpis.totalRecipients} label="Total Recipients" />
        </div>
        <div className="stat-card-wrapper">
          <StatCard icon="✅" value={kpis.calledRecipients} label="Called" />
        </div>
        <div className="stat-card-wrapper">
          <StatCard icon="⏳" value={kpis.pendingRecipients} label="Pending" />
        </div>
      </div>

      <Card>
        <CardHeader title="Your Projects & Locations" action={(
          <div className="callers-filters">
            <div className="callers-search-group">
              <input 
                className="form-control" 
                placeholder="Search projects or locations" 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1) }} 
              />
              <select 
                className="form-control" 
                value={pageSize} 
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )} />

        {/* Mobile project cards (mobile-first) */}
        <div className="mobile-only">
          {loading ? (
            <div style={{ padding: 16, color: 'var(--text3)' }}>Loading project-locations…</div>
          ) : projectLocations.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text3)' }}>No projects assigned yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projectLocations.map((pl, idx) => {
                const projectId = pl.projectId || pl.project_id || pl.project
                const projectName = pl.project || pl.projectName || `Project ${projectId}`
                const projectType = pl.projectType || (pl.district && pl.centre ? 'written' : 'regular')
                const displayLocation = projectType === 'written' ? `${pl.district || '-'} - ${pl.centre || '-'}` : (pl.location || pl.locationId || '-')
                const total = pl.recipientCount || 0
                const called = pl.calledCount || 0
                const pending = pl.pendingCount || 0
                const initials = projectName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div
                    key={projectId || idx}
                    className="project-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleViewRecipients(projectId, projectName, pl)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleViewRecipients(projectId, projectName, pl) }}
                    style={{ padding: 14, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.14)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {initials || 'PJ'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</div>
                        <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLocation}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 8px', borderRadius: 999, background: 'rgba(148, 163, 184, 0.12)' }}>Total {total}</span>
                          <span style={{ fontSize: 12, color: 'var(--green)', padding: '4px 8px', borderRadius: 999, background: 'rgba(34, 197, 94, 0.12)' }}>Called {called}</span>
                          <span style={{ fontSize: 12, color: '#d97706', padding: '4px 8px', borderRadius: 999, background: 'rgba(245, 158, 11, 0.12)' }}>Pending {pending}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: 40, height: 40, minWidth: 40, borderRadius: '50%', padding: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}
                        onClick={(e) => { e.stopPropagation(); handleViewRecipients(projectId, projectName, pl) }}
                        aria-label={`Open ${projectName}`}
                      >
                        →
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="desktop-only">
          <DataTable 
            columns={columns} 
            rows={rows} 
            emptyMessage={loading ? 'Loading project-locations…' : 'No projects assigned yet.'}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: '12px' }}>
            {total === 0 ? `Showing 0 of 0` : `Showing ${start} - ${end} of ${total}`}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="firstprev pagination-page-btn" type="button" disabled={page === 1} onClick={() => setPage(1)}>First</button>
            <button className="firstprev pagination-page-btn" type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>

            <div className="pagination-pages">
              {pageStart > 1 && (
                <>
                  <button className="pagination-page-btn" type="button" onClick={() => setPage(1)}>1</button>
                  {pageStart > 2 && <span className="pagination-ellipsis">…</span>}
                </>
              )}

              {pageNumbers.map((pnum) => (
                <button key={pnum} className={`pagination-page-btn${pnum === page ? ' active' : ''}`} type="button" onClick={() => setPage(pnum)}>{pnum}</button>
              ))}

              {pageEnd < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
              {pageEnd < totalPages && (
                <button className="pagination-page-btn" type="button" onClick={() => setPage(totalPages)}>{totalPages}</button>
              )}
            </div>

            <button className="lastprev pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            <button className="lastprev pagination-page-btn" type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last</button>
          </div>
        </div>
      </Card>

      <style>{`
        .candidate-calling-page .page-header { gap: 16px; }
        .candidate-calling-page .stats-grid { gap: 12px; }
        .candidate-calling-page .card { padding: 16px; }
        .candidate-calling-page .card-header { gap: 12px; }
        .candidate-calling-page .callers-filters { padding: 10px 0 0; }
        .candidate-calling-page .callers-search-group { flex-wrap: wrap; gap: 10px; width: 100%; min-width: 0; }
        .candidate-calling-page .callers-search-group input,
        .candidate-calling-page .callers-search-group select {
          width: 100% !important;
          min-width: 0;
        }
        .candidate-calling-page .table-wrap table { min-width: 100%; }
        .candidate-calling-page .table-wrap table thead th,
        .candidate-calling-page .table-wrap table tbody td {
          padding: 10px 10px;
        }
        .candidate-calling-page .pagination-pages {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .candidate-calling-page .pagination-page-btn {
          min-width: auto;
          padding: 7px 12px;
        }
        .candidate-calling-page .firstprev,
        .candidate-calling-page .lastprev {
          min-width: 100px;
        }

        @media (max-width: 680px) {
          .candidate-calling-page .stats-grid { grid-template-columns: 1fr 1fr; }
          .candidate-calling-page .page-title { font-size: 20px; }
          .candidate-calling-page .card-header { flex-direction: column; align-items: stretch; }
          .candidate-calling-page .card-header > div { width: 100%; }
          .candidate-calling-page .pagination-pages { justify-content: flex-start; }
          .candidate-calling-page .firstprev,
          .candidate-calling-page .lastprev {
            display: none;
          }
        }
        /* Mobile / desktop visibility helpers */
        .mobile-only { display: none; }
        .desktop-only { display: block; }
        @media (max-width: 680px) {
          .mobile-only { display: block; }
          .desktop-only { display: none; }
          .project-card { box-shadow: 0 6px 16px rgba(10,18,34,0.04); }
          .project-card .btn { min-width: auto; }
        }
      `}</style>
    </div>
  )
}
