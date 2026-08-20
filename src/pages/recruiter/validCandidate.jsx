import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faUsers, faEye, faIdCard, faMobileAlt } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from "../../api/axios";
import { PageHeader, Card, DataTable, StatCard } from "../../components/ui";
import "./validCandidate.css";

const ValidCandidate = () => {

  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);

  const [candidateSearch, setCandidateSearch] = useState("");
  const [aadhaarSearch, setAadhaarSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");
  const [entries, setEntries] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);

  const getCandidateUrl = (candidateId) => {
    const basePath = window.location.pathname.includes('/gigjobs') ? '/gigjobs' : ''
    return `${window.location.origin}${basePath}/#/app/recruiter/candidate/${candidateId}`
  }

  /* Fetch Candidates */
  const fetchCandidates = async () => {
    try {
      setLoading(true);

      const offset = (currentPage - 1) * entries;

      const res = await recruiterAPI.getValidCandidates({
        offset: offset,
        limit: entries,
        from: fromDate || undefined,
        to: toDate || undefined,
        candidate: candidateSearch || undefined,
        aadhaar: aadhaarSearch || undefined,
        mobile: mobileSearch || undefined,
      });

      if (res.data && res.data.success) {
        setCandidates(res.data.data.items || []);
        setTotalRecords(res.data.data.total || 0);
      }
    } catch (error) {
      console.error("Error fetching candidates:", error);
    } finally {
      setLoading(false);
    }
  };

  /* Debounced fetch */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCandidates();
    }, 350);

    return () => clearTimeout(timer);
  }, [currentPage, entries, candidateSearch, aadhaarSearch, mobileSearch, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [candidateSearch, aadhaarSearch, mobileSearch, fromDate, toDate]);

  const totalPages = Math.ceil(totalRecords / entries);
  const start = totalRecords === 0 ? 0 : (currentPage - 1) * entries + 1;
  const end = Math.min(currentPage * entries, totalRecords);

  const columns = ['Sl.No', 'ID', 'Reg Date', 'Name', 'Mobile', 'City', 'Email', 'Aadhaar', 'Action'];

  const rows = candidates.map((item, index) => [
    ((currentPage - 1) * entries) + index + 1,
    <span key={`id-${item.id}`} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.candidate_id}</span>,
    item.reg_date || '—',
    <div key={`name-${item.id}`} style={{ fontWeight: 600 }}>{item.name}</div>,
    item.mobile || '—',
    item.city || '—',
    <div key={`email-${item.id}`} className="text-truncate" style={{ maxWidth: '180px' }} title={item.email}>{item.email || '—'}</div>,
    <span key={`aadhaar-${item.id}`} style={{ fontFamily: 'monospace' }}>{item.aadhaar || '—'}</span>,
    <div key={`actions-${item.id}`} className="action-cell" style={{ display: 'flex', gap: '8px' }}>
      <button
        className="btn btn-outline btn-sm"
        onClick={() => window.open(getCandidateUrl(item.id || item.candidate_id), '_blank')}
      >
        <FontAwesomeIcon icon={faEye} style={{ marginRight: 6 }} /> View
      </button>
    </div>
  ]);

  return (
    <div className="recruiter-attendance-page">
      <PageHeader
        title="Valid Candidate List"
        subtitle="Verified candidates list. Use filters to narrow results."
      />

      <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <StatCard
          icon={<FontAwesomeIcon icon={faUsers} />}
          value={totalRecords}
          label="Total Valid Records"
          iconStyle={{ background: 'var(--green-light)', color: 'var(--green)' }}
        />
      </div>

      <Card style={{ marginBottom: 20, padding: 16 }}>
        <div className="projects-table-filters" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div className="projects-table-filter-group" style={{ flex: '1 1 250px' }}>
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Search Name or ID..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="projects-table-filter-group" style={{ flex: '1 1 200px' }}>
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faIdCard} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Search Aadhaar..."
                value={aadhaarSearch}
                onChange={(e) => setAadhaarSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="projects-table-filter-group" style={{ flex: '1 1 200px' }}>
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faMobileAlt} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Search Mobile..."
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="projects-table-filter-group date-group">
            <div className="filter-label">Filter range</div>
            <input className="form-control" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="date-separator">to</span>
            <input className="form-control" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="projects-table-meta">
            <div className="entries-selector">
              <label>Rows</label>
              <select className="form-control" value={entries} onChange={(e) => setEntries(Number(e.target.value))}>
                {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => { setCandidateSearch(''); setAadhaarSearch(''); setMobileSearch(''); setFromDate(''); setToDate(''); }}>Reset Filters</button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="projects-table-wrap">
          <DataTable
            columns={columns}
            rows={rows}
            emptyMessage={loading ? 'Loading records...' : 'No valid candidates found matching your criteria.'}
          />
        </div>

        <div className="projects-table-pagination" style={{ padding: '16px' }}>
          <div className="pagination-summary">
            Showing {start} to {end} of {totalRecords} entries
          </div>
          <div className="pagination-actions">
            <button
              className="pagination-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </button>
            <div className="pagination-pages">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    className={`pagination-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              className="pagination-page-btn"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
};

export default ValidCandidate;