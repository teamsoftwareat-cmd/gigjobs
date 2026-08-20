import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, CardHeader, DataTable, Tag } from '../../components/ui/index'
import { useAuth } from '../../context/AuthContext'
import { candidateAPI, recruiterAPI } from '../../api/axios'

export default function VerifierProjects({ registrationIdOverride, onViewDetails, useRecruiterApi = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const registrationId = registrationIdOverride ?? user?.registrationId
  const api = useRecruiterApi ? recruiterAPI : candidateAPI
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const getIsCompactView = () => {
    if (typeof window === 'undefined') return false
    const isPortrait = window.matchMedia('(orientation: portrait)').matches
    return window.innerWidth <= 680 || (window.innerWidth <= 1024 && isPortrait)
  }
  const [isCompactView, setIsCompactView] = useState(getIsCompactView)

  const fetchVerifierProjects = useCallback(async () => {
    if (!registrationId) return
    
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const params = {
        offset,
        limit: pageSize,
      }
      if (appliedSearch) {
        params.search = appliedSearch
      }

      const response = await api.getVerifierProjects(registrationId, params)
      const payload = response.data?.data || response.data || {}
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload) ? payload : []
      const count = payload.total || payload.count || items.length
      
      setAssignments(items)
      setTotal(typeof count === 'number' ? count : Number(count) || items.length)
    } catch (err) {
      console.error('Failed to fetch verifier assignments:', err)
      setAssignments([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [api, registrationId, page, pageSize, appliedSearch])

  const handleSearch = () => {
    setAppliedSearch(search.trim())
    setPage(1)
  }

  useEffect(() => {
    fetchVerifierProjects()
  }, [fetchVerifierProjects])

  useEffect(() => {
    const onResize = () => setIsCompactView(getIsCompactView())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const normalizeDay = (raw) => {
    const value = String(raw || '').trim().toLowerCase()
    if (value.includes('exam')) return 'exam'
    if (value.includes('pre') || value.includes('preday')) return 'preday'
    return 'preday'
  }

  const handleViewDetails = (titleGroup) => {
    const titleName = titleGroup.title || 'Verifier Title'
    const titleId = titleGroup.title_id || titleGroup.id || titleName
    const day = normalizeDay(titleGroup.day || titleGroup.projectDay || 'preday')

    if (onViewDetails) {
      // If callback provided (modal mode), call it
      onViewDetails(titleGroup)
    } else {
      // Otherwise navigate (standalone mode)
      navigate(`/app/candidate/verifier/projects/${titleId}`, {
        state: {
          title: titleName,
          titleId,
          day,
        },
      })
    }
  }

  const titleGroups = useMemo(() => {
    // API should return pre-grouped titles with aggregated data
    // If it returns individual assignments, group them here
    const firstItem = assignments[0]
    const isPreGrouped = firstItem && ('venue_count' in firstItem || 'venueCount' in firstItem)
    
    if (isPreGrouped) {
      // API already returns grouped data
      return assignments.map((item) => ({
        id: item.id,
        title_id: item.title_id,
        title: item.title || item.name || 'Untitled',
        day: item.day || item.projectDay || 'preday',
        venueCount: item.venue_count || item.venueCount || 0,
        totalRecipients: item.recipient_count || item.recipientCount || 0,
        totalCalled: item.called_count || item.calledCount || 0,
        totalPending: item.pending_count || item.pendingCount || 0,
      }))
    }
    
    // Fallback: group by title if API returns individual assignments
    const groups = {}
    assignments.forEach((assignment) => {
      const title = assignment.title || assignment.name || 'Untitled'
      const titleId = assignment.title_id || assignment.id || title
      
      if (!groups[titleId]) {
        groups[titleId] = {
          id: assignment.id,
          title_id: titleId,
          title,
          venues: [],
          totalRecipients: 0,
          totalCalled: 0,
          totalPending: 0,
        }
      }
      
      groups[titleId].venues.push(assignment.venue || assignment.location || assignment.venue_name || '-')
      groups[titleId].totalRecipients += assignment.recipient_count || assignment.recipientCount || 0
      groups[titleId].totalCalled += assignment.called_count || assignment.calledCount || 0
      groups[titleId].totalPending += assignment.pending_count || assignment.pendingCount || 0
    })
    
    return Object.values(groups)
  }, [assignments])

  const rows = useMemo(() => titleGroups.map((titleGroup, idx) => {
    const venueCount = titleGroup.venueCount || titleGroup.venues?.length || 0
    const totalCount = titleGroup.totalRecipients
    const calledCount = titleGroup.totalCalled
    const pendingCount = titleGroup.totalPending

    return [
      titleGroup.title,
      venueCount,
      totalCount,
      <Tag key={`called-${idx}`} variant="green">{calledCount}</Tag>,
      <Tag key={`pending-${idx}`} variant="yellow">{pendingCount}</Tag>,
      <button
        className="btn btn-primary btn-sm"
        type="button"
        onClick={() => handleViewDetails(titleGroup)}
        style={{ padding: '4px 8px', fontSize: 11, width: 'fit-content !important' }}
      >
        View venues
      </button>
    ]
  }), [titleGroups])

  const lastPage = Math.max(1, Math.ceil((total || 0) / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(page * pageSize, total)

  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, lastPage - 4)))
  const pageEnd = Math.min(lastPage, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  return (
    <div className="candidate-calling-page">
      <PageHeader
        title="Verifier Projects"
        subtitle="View your assigned verifier project locations"
      />

      <Card>
        <CardHeader title="Assigned Projects" action={(
          <div className="callers-filters">
            <div className="callers-search-group">
              <input
                className="form-control"
                placeholder="Search by title or venue"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button type="button" className="btn btn-primary" onClick={handleSearch}>Search</button>
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

        {isCompactView ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <div style={{ padding: 16, color: 'var(--text3)' }}>Loading verifier assignments…</div>
            ) : titleGroups.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text3)' }}>No verifier assignments found.</div>
            ) : titleGroups.map((titleGroup, idx) => {
              const venueCount = titleGroup.venueCount || titleGroup.venues?.length || 0
              const totalCount = titleGroup.totalRecipients
              const calledCount = titleGroup.totalCalled
              const pendingCount = titleGroup.totalPending
              return (
                <div key={titleGroup.id || titleGroup.title_id || idx} className="compact-card">
                  <div className="compact-card-header">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{titleGroup.title}</div>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => handleViewDetails(titleGroup)} style={{ width: 'fit-content' }}>View venues</button>
                  </div>
                  <div className="compact-card-grid">
                    <span>Venues {venueCount}</span>
                    <span>Recipients {totalCount}</span>
                    <span>Called {calledCount}</span>
                    <span>Pending {pendingCount}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="desktop-only">
            <DataTable
              columns={['Title', 'Venues', 'Total Recipients', 'Called', 'Pending', 'Actions']}
              rows={rows}
              emptyMessage={loading ? 'Loading verifier assignments…' : 'No verifier assignments found.'}
            />
          </div>
        )}

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
              {pageEnd < lastPage - 1 && <span className="pagination-ellipsis">…</span>}
              {pageEnd < lastPage && (
                <button className="pagination-page-btn" type="button" onClick={() => setPage(lastPage)}>{lastPage}</button>
              )}
            </div>
            <button className="lastprev pagination-page-btn" type="button" disabled={page === lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>Next</button>
            <button className="lastprev pagination-page-btn" type="button" disabled={page === lastPage} onClick={() => setPage(lastPage)}>Last</button>
          </div>
        </div>
      </Card>

      <style>{`
        .candidate-calling-page .card { padding: 16px; }
        .candidate-calling-page .card-header { gap: 12px; }
        .candidate-calling-page .callers-filters { padding: 10px 0 0; }
        .candidate-calling-page .callers-search-group { flex-wrap: wrap; gap: 10px; width: 100%; min-width: 0; }
        .candidate-calling-page .callers-search-group input,
        .candidate-calling-page .callers-search-group select { width: 100% !important; min-width: 0; }
        .candidate-calling-page .table-wrap table { min-width: 100%; }
        .candidate-calling-page .table-wrap table thead th,
        .candidate-calling-page .table-wrap table tbody td { padding: 10px 10px; }
        .candidate-calling-page .pagination-pages { display: flex; flex-wrap: wrap; gap: 8px; }
        .candidate-calling-page .pagination-page-btn { min-width: auto; padding: 7px 12px; }
        .candidate-calling-page .firstprev,
        .candidate-calling-page .lastprev { min-width: 100px; }
        .candidate-calling-page .compact-card { border: 1px solid var(--border, #e2e8f0); border-radius: 14px; padding: 14px; background: var(--card, #fff); display: flex; flex-direction: column; gap: 10px; }
        .candidate-calling-page .compact-card-header { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
        .candidate-calling-page .compact-card-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .candidate-calling-page .compact-card-grid span { padding: 5px 8px; border-radius: 999px; background: rgba(148, 163, 184, 0.14); font-size: 12px; color: var(--text3, #475569); }
        @media (max-width: 680px) {
          .candidate-calling-page .page-header { gap: 16px; }
          .candidate-calling-page .card-header { flex-direction: column; align-items: stretch; }
          .candidate-calling-page .card-header > div { width: 100%; }
          .candidate-calling-page .pagination-pages { justify-content: flex-start; }
          .candidate-calling-page .firstprev,
          .candidate-calling-page .lastprev { display: none; }
        }
      `}</style>
    </div>
  )
}
