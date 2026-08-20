import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { PageHeader, Card, CardHeader, DataTable, Tag } from '../../components/ui/index'
import { useAuth } from '../../context/AuthContext'
import { candidateAPI, recruiterAPI } from '../../api/axios'

export default function VerifierProjectDetails({ initialState, registrationIdOverride, onViewRecipients, useRecruiterApi = false }) {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  // Use override if provided, otherwise use route params/state, otherwise use user context
  const registrationId = registrationIdOverride || user?.registrationId
  const state = initialState || location.state || {}
  const title = state.title || 'Assignment'
  const titleId = state.titleId || projectId
  const api = useRecruiterApi ? recruiterAPI : candidateAPI
  const handleBackToTitles = () => {
    navigate('/app/candidate/verifier')
  }
  const normalizeDay = (raw) => {
    const value = String(raw || '').trim().toLowerCase()
    if (value.includes('exam')) return 'exam'
    if (value.includes('pre') || value.includes('preday')) return 'preday'
    return 'preday'
  }
  const day = normalizeDay(state.day || 'preday')
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(false)

  const isVenueCompleted = (venue) => {
    const status = String(venue?.call_status ?? venue?.status ?? '').trim().toLowerCase()
    return status === 'completed'
  }
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

  const fetchVenues = useCallback(async () => {
    if (!registrationId || !titleId) return

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

      // Fetch venues for this title
      const response = await api.getVerifierProjectVenues(
        registrationId,
        titleId,
        params
      )
      const payload = response.data?.data || response.data || {}
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload) ? payload : []
      const count = payload.total || payload.count || items.length

      setVenues(items)
      setTotal(typeof count === 'number' ? count : Number(count) || items.length)
    } catch (err) {
      console.error('Failed to load venues:', err)
      setVenues([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [api, registrationId, titleId, page, pageSize, appliedSearch])

  const handleSearch = () => {
    setAppliedSearch(search.trim())
    setPage(1)
  }

  useEffect(() => {
    fetchVenues()
  }, [fetchVenues])

  useEffect(() => {
    const onResize = () => setIsCompactView(getIsCompactView())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleViewRecipients = (venue) => {
    const venueName = venue.venue || venue.name || 'Venue'
    const venueId = venue.id || venueName
    const venueDay = normalizeDay(venue.day || venue.projectDay || day || 'preday')

    const state = {
      title,
      title_id: titleId,
      venue: venueName,
      day: venueDay,
      recipientCount: venue.recipient_count || venue.recipientCount || 0,
      calledCount: venue.called_count || venue.calledCount || 0,
      pendingCount: venue.pending_count || venue.pendingCount || 0,
    }

    if (onViewRecipients) {
      // If callback provided (modal mode), call it
      onViewRecipients(venue)
    } else {
      // Otherwise navigate (standalone mode)
      navigate(`/app/candidate/verifier/recipients/${venueId}`, {
        state,
      })
    }
  }

  const rows = useMemo(() => venues.map((venue, idx) => {
    const venueName = venue.venue || venue.name || `Venue ${idx + 1}`
    const totalCount = venue.recipient_count || venue.recipientCount || 0
    const calledCount = venue.called_count || venue.calledCount || 0
    const pendingCount = venue.pending_count || venue.pendingCount || 0

    return [
      venueName,
      totalCount,
      <Tag key={`called-${idx}`} variant="green">{calledCount}</Tag>,
      <Tag key={`pending-${idx}`} variant="yellow">{pendingCount}</Tag>,
      <button
        className="btn btn-primary btn-sm"
        type="button"
        onClick={() => handleViewRecipients(venue)}
        style={{ padding: '4px 8px', fontSize: 11, width: 'fit-content !important' }}
      >
        View recipients
      </button>
    ]
  }), [venues])

  const lastPage = Math.max(1, Math.ceil((total || 0) / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(page * pageSize, total)
  const pageStart = Math.max(1, Math.min(page - 2, Math.max(1, lastPage - 4)))
  const pageEnd = Math.min(lastPage, pageStart + 4)
  const pageNumbers = []
  for (let i = pageStart; i <= pageEnd; i += 1) pageNumbers.push(i)

  return (
    <div className="candidate-calling-page">
      {!initialState && (
        <PageHeader
          title={title}
          subtitle="Assigned venues"
          action={(
            <button type="button" className="btn btn-outline btn-sm" onClick={handleBackToTitles}>
              Back to titles
            </button>
          )}
        />
      )}

      <Card>
        <CardHeader title="Venues" action={(
          <div className="callers-filters">
            <div className="callers-search-group">
              <input
                className="form-control"
                placeholder="Search by venue name"
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
              <div style={{ padding: 16, color: 'var(--text3)' }}>Loading venues…</div>
            ) : venues.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text3)' }}>No venues found.</div>
            ) : venues.map((venue, idx) => {
              const venueName = venue.venue || venue.name || `Venue ${idx + 1}`
              const totalCount = venue.recipient_count || venue.recipientCount || 0
              const calledCount = venue.called_count || venue.calledCount || 0
              const pendingCount = venue.pending_count || venue.pendingCount || 0
              return (
                <div key={venue.id || venueName} className={`compact-card${isVenueCompleted(venue) ? ' completed-venue-card' : ''}`}>
                  <div className="compact-card-header">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{venueName}</div>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => handleViewRecipients(venue)} style={{ width: 'fit-content' }}>View recipients</button>
                  </div>
                  <div className="compact-card-grid">
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
              columns={['Venue', 'Total Recipients', 'Called', 'Pending', 'Actions']}
              rows={rows}
              emptyMessage={loading ? 'Loading venues…' : 'No venues found.'}
              getRowClassName={(row, index) => isVenueCompleted(venues[index]) ? 'completed-venue-row' : ''}
            />
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: '12px' }}>{total === 0 ? 'Showing 0 of 0' : `Showing ${start} - ${end} of ${total}`}</div>
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
              {pageEnd < lastPage && <button className="pagination-page-btn" type="button" onClick={() => setPage(lastPage)}>{lastPage}</button>}
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
        .candidate-calling-page .callers-search-group select,
        .candidate-calling-page .callers-search-group button { width: 100% !important; min-width: 0; }
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
        .candidate-calling-page .completed-venue-row td { background: rgba(16, 185, 129, 0.08); }
        .candidate-calling-page .completed-venue-card { background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.3); }
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

