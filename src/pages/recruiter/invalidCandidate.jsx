import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faEye, faSearch, faIdCard, faMobileAlt, faUsers, faInfoCircle, faFileCsv } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from "../../api/axios";
import { PageHeader, Card, DataTable, StatCard, Modal } from "../../components/ui";
import "./InvalidCandidate.css";

const InvalidCandidate = () => {

const navigate = useNavigate();
const [candidates,setCandidates] = useState([]);
const [loading,setLoading] = useState(false);

const [candidateSearch, setCandidateSearch] = useState("");
const [aadhaarSearch, setAadhaarSearch] = useState("");
const [mobileSearch, setMobileSearch] = useState("");
const [entries,setEntries] = useState(10);
const [currentPage,setCurrentPage] = useState(1);
const [fromDate, setFromDate] = useState('');
const [toDate, setToDate] = useState('');
const [invalidFilter, setInvalidFilter] = useState('all');
const [totalRecords,setTotalRecords] = useState(0);
const [copiedCandidateId, setCopiedCandidateId] = useState(null);
const [invalidDataModalOpen, setInvalidDataModalOpen] = useState(false);
const [invalidDataLoading, setInvalidDataLoading] = useState(false);
const [invalidDataError, setInvalidDataError] = useState('');
const [selectedInvalidData, setSelectedInvalidData] = useState(null);
const [exportLoading, setExportLoading] = useState(false);

const getCandidateUrl = (candidateId) => {
  const basePath = window.location.pathname.includes('/gigjobs') ? '/gigjobs' : ''
  return `${window.location.origin}${basePath}/#/app/recruiter/candidate/${candidateId}`
}

const getKycLink = (candidate) => {
  const basePath = window.location.pathname.includes('/gigjobs') ? '/gigjobs' : ''
  const url = new URL(`${window.location.origin}${basePath}/#/attendance/kycverify`)
  const params = new URLSearchParams()
  const candidateId = candidate?.candidate_id || candidate?.id

  if (candidateId) {
    params.set('candidateid', candidateId)
  }

  url.hash = `/attendance/kycverify?${params.toString()}`
  return url.toString()
}

const copyKycLink = async (candidate) => {
  const link = getKycLink(candidate)
  const candidateId = candidate?.candidate_id || candidate?.id

  try {
    await navigator.clipboard.writeText(link)
    setCopiedCandidateId(candidateId)
    setTimeout(() => setCopiedCandidateId(null), 2500)
  } catch (error) {
    console.error('Clipboard copy failed', error)
    alert('Unable to copy KYC link. Please copy it manually.')
  }
}

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  const escapedValue = stringValue.replace(/"/g, '""')
  return `"${escapedValue}"`
}

const exportInvalidCandidatesCsv = async () => {
  setExportLoading(true)

  try {
    const statusParam = invalidFilter === 'all' ? undefined : invalidFilter === 'tried-failed' ? true : false
    const pageLimit = 1000
    let offset = 0
    const allItems = []
    const params = {
      from: fromDate || undefined,
      to: toDate || undefined,
      candidate: candidateSearch || undefined,
      aadhaar: aadhaarSearch || undefined,
      mobile: mobileSearch || undefined,
      status: statusParam,
    }

    while (true) {
      const res = await recruiterAPI.getInvalidCandidate({
        offset,
        limit: pageLimit,
        ...params,
      })

      const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : []
      if (items.length === 0) break

      allItems.push(...items)
      if (items.length < pageLimit) break
      offset += pageLimit
    }

    if (allItems.length === 0) {
      alert('No records available for export.')
      return
    }

    const exportRows = allItems.map((item, index) => ({
      slNo: index + 1,
      id: item.candidate_id || item.id || '',
      regDate: item.reg_date || '',
      name: item.name || '',
      mobile: item.mobile || '',
      city: item.city || '',
      email: item.email || '',
      aadhaar: item.aadhaar || '',
      status: item.status ?? '',
      invalid: item.invalid ?? '',
      profileUrl: getCandidateUrl(item.id || item.candidate_id),
      kycLink: getKycLink(item),
    }))

    const header = ['Sl.No', 'ID', 'Reg Date', 'Name', 'Mobile', 'City', 'Email', 'Aadhaar', 'Status', 'Invalid', 'Profile URL', 'KYC Link']
    const csv = [header.join(',')]
      .concat(exportRows.map((row) => [
        escapeCsvValue(row.slNo),
        escapeCsvValue(row.id),
        escapeCsvValue(row.regDate),
        escapeCsvValue(row.name),
        escapeCsvValue(row.mobile),
        escapeCsvValue(row.city),
        escapeCsvValue(row.email),
        escapeCsvValue(row.aadhaar),
        escapeCsvValue(row.status),
        escapeCsvValue(row.invalid),
        escapeCsvValue(row.profileUrl),
        escapeCsvValue(row.kycLink),
      ].join(',')))
      .join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `invalid_aadhaar_candidates_export.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export CSV failed:', error)
    alert('Unable to export CSV right now. Please try again.')
  } finally {
    setExportLoading(false)
  }
}

const normalizeInvalidDataResponse = (response) => {
  const payload = response?.data?.data?.data || response?.data?.data || response?.data
  if (!payload) return null

  return {
    ...payload,
    success: response?.data?.success ?? payload?.success,
    message: response?.data?.message ?? payload?.message,
    xml_url: payload?.xml_url || payload?.xmlUrl || null,
    client_id: payload?.client_id || payload?.clientId || null,
  }
}

const openInvalidDataModal = async (candidate) => {
  const candidateId = candidate?.candidate_id || candidate?.id
  if (!candidateId) return

  setInvalidDataModalOpen(true)
  setInvalidDataLoading(true)
  setInvalidDataError('')
  setSelectedInvalidData(null)

  try {
    const response = await recruiterAPI.getInvalidAadhaarData(candidateId)
    const normalizedData = normalizeInvalidDataResponse(response)
    setSelectedInvalidData(normalizedData)
  } catch (error) {
    console.error('Failed to load invalid data:', error)
    setInvalidDataError('Unable to load invalid Aadhaar data right now.')
  } finally {
    setInvalidDataLoading(false)
  }
}

const formatInvalidDataJson = (value) => {
  if (value === null || value === undefined) return '{}'
  return JSON.stringify(value, null, 2)
}

const isTriedAndFailedRow = (item) => {
  if (typeof item?.status === 'boolean') return item.status === true
  if (typeof item?.invalid === 'boolean') return item.invalid === false

  if (typeof item?.status === 'string') {
    const normalizedStatus = item.status.toLowerCase()
    return ['true', '1', 'yes', 'y', 'valid', 't'].includes(normalizedStatus)
  }

  if (typeof item?.invalid === 'string') {
    const normalizedInvalid = item.invalid.toLowerCase()
    return ['false', '0', 'no', 'n', 'valid'].includes(normalizedInvalid)
  }

  return false
}

const filteredCandidates = (Array.isArray(candidates) ? candidates : []).filter((item) => {
  if (invalidFilter === 'all') return true
  if (invalidFilter === 'no-tries') return !isTriedAndFailedRow(item)
  if (invalidFilter === 'tried-failed') return isTriedAndFailedRow(item)
  return true
})

/* Fetch Invalid Candidates */
const fetchCandidates = async () => {
  try {
    setLoading(true);

    const offset = (currentPage - 1) * entries;

    const statusParam = invalidFilter === 'all' ? undefined : invalidFilter === 'tried-failed' ? true : false

    const res = await recruiterAPI.getInvalidCandidate({
      offset: offset,
      limit: entries,
      from: fromDate || undefined,
      to: toDate || undefined,
      candidate: candidateSearch || undefined,
      aadhaar: aadhaarSearch || undefined,
      mobile: mobileSearch || undefined,
      status: statusParam,
    });

    console.log(res.data);

    if (res.data.success) {
      const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : []
      const total = typeof res.data?.data?.total === 'number' ? res.data.data.total : 0
      setCandidates(items)
      setTotalRecords(total)
    } else {
      setCandidates([])
      setTotalRecords(0)
    }
  } catch (error) {
    console.error("Error fetching invalid candidates:", error);
  } finally {
    setLoading(false);
  }
};


/* Auto Fetch */
useEffect(() => {
  const timer = setTimeout(() => {
    fetchCandidates();
  }, 350);

  return () => clearTimeout(timer);
}, [currentPage, entries, candidateSearch, aadhaarSearch, mobileSearch, fromDate, toDate, invalidFilter]);

useEffect(() => {
  setCurrentPage(1);
}, [candidateSearch, aadhaarSearch, mobileSearch, fromDate, toDate, invalidFilter]);


const totalPages = Math.ceil(totalRecords / entries);
const start = totalRecords === 0 ? 0 : (currentPage - 1) * entries + 1;
const end = Math.min(currentPage * entries, totalRecords);

const columns = ['Sl.No', 'ID', 'Reg Date', 'Name', 'Mobile', 'City', 'Email', 'Aadhaar', 'Action'];

const rows = filteredCandidates.map((item, index) => [
  ((currentPage - 1) * entries) + index + 1,
  <span key={`id-${item.id}`} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.candidate_id}</span>,
  item.reg_date || '—',
  <div key={`name-${item.id}`} style={{ fontWeight: 600 }}>{item.name}</div>,
  item.mobile || '—',
  item.city || '—',
  <div key={`email-${item.id}`} className="text-truncate" style={{ maxWidth: '180px' }} title={item.email}>{item.email || '—'}</div>,
  <span key={`aadhaar-${item.id}`} style={{ fontFamily: 'monospace' }}>{item.aadhaar || '—'}</span>,
  <div key={`actions-${item.id || item.candidate_id}`} className="action-cell" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    <button 
      className="btn btn-outline btn-sm" 
      onClick={() => window.open(getCandidateUrl(item.id || item.candidate_id), '_blank')}
    >
      <FontAwesomeIcon icon={faEye} style={{ marginRight: 6 }} /> View
    </button>
    {isTriedAndFailedRow(item) && (
      <button 
        className="btn btn-outline btn-sm"
        onClick={() => openInvalidDataModal(item)}
        style={{ minWidth: '120px' }}
      >
        <FontAwesomeIcon icon={faInfoCircle} style={{ marginRight: 6 }} /> Invalid Data
      </button>
    )}
    <button 
      className={`btn ${copiedCandidateId === item.candidate_id ? 'btn-success' : 'btn-secondary'} btn-sm`} 
      onClick={() => copyKycLink(item)}
      style={{ minWidth: '110px' }}
    >
      <FontAwesomeIcon icon={faCopy} style={{ marginRight: 6 }} />
      {copiedCandidateId === item.candidate_id ? 'Copied' : 'Copy KYC'}
    </button>
  </div>
]);


return(
 <div className="recruiter-attendance-page">
    <PageHeader 
      title="Invalid Aadhaar Candidates" 
      subtitle="Candidates whose Aadhaar verification failed. You can copy a direct KYC link to share with them."
    />

    <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <StatCard 
        icon={<FontAwesomeIcon icon={faUsers} />} 
        value={totalRecords} 
        label="Total Invalid Records" 
        iconStyle={{ background: 'var(--red-light)', color: 'var(--red)' }}
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

        <div className="projects-table-filter-group" style={{ flex: '1 1 180px' }}>
          <div className="filter-label">Status</div>
          <select className="form-control" value={invalidFilter} onChange={(e) => setInvalidFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="no-tries">No tries</option>
            <option value="tried-failed">Tried and failed</option>
          </select>
        </div>

        <div className="projects-table-filter-group date-group">
          <div className="filter-label">Filter range</div>
          <input className="form-control" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span className="date-separator">to</span>
          <input className="form-control" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>

        <div className="projects-table-meta" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="entries-selector">
            <label>Rows</label>
            <select className="form-control" value={entries} onChange={(e) => setEntries(Number(e.target.value))}>
              {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <button className="btn btn-outline btn-sm" onClick={exportInvalidCandidatesCsv} disabled={exportLoading}>
            <FontAwesomeIcon icon={faFileCsv} style={{ marginRight: 6 }} /> {exportLoading ? 'Exporting...' : 'Export CSV'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => { setCandidateSearch(''); setAadhaarSearch(''); setMobileSearch(''); setFromDate(''); setToDate(''); setInvalidFilter('all'); }}>
            Reset Filters
          </button>
        </div>
      </div>
    </Card>

    <Card>
      <div className="projects-table-wrap">
        <DataTable 
          columns={columns} 
          rows={rows} 
          emptyMessage={loading ? 'Loading records...' : 'No invalid candidates found matching your criteria.'}
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

    <Modal
      isOpen={invalidDataModalOpen}
      onClose={() => {
        setInvalidDataModalOpen(false)
        setInvalidDataError('')
        setSelectedInvalidData(null)
      }}
      title={selectedInvalidData?.aadhaar_xml_data?.full_name || selectedInvalidData?.digilocker_metadata?.name || 'Invalid Aadhaar Details'}
      maxWidth="900px"
    >
      {invalidDataLoading ? (
        <div style={{ padding: '16px 0', color: 'var(--text3)' }}>Loading invalid Aadhaar data...</div>
      ) : invalidDataError ? (
        <div style={{ padding: '16px 0', color: 'var(--red)' }}>{invalidDataError}</div>
      ) : selectedInvalidData ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Raw JSON response from the invalid Aadhaar endpoint.
            </div>
            {selectedInvalidData.xml_url ? (
              <a href={selectedInvalidData.xml_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)' }}>
                Open XML
              </a>
            ) : null}
          </div>
          <pre style={{ margin: 0, padding: 16, background: '#0f172a', color: '#e2e8f0', borderRadius: 8, overflowX: 'auto', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
{formatInvalidDataJson(selectedInvalidData)}
          </pre>
        </>
      ) : null}
    </Modal>
  </div>
)

};

export default InvalidCandidate;