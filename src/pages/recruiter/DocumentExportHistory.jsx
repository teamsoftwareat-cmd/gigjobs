import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faDownload, faRefresh, faSearch, faFileZipper, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { Card, DataTable, LoadingOverlay, PageHeader, StatCard, Tag } from '../../components/ui'
import { recruiterAPI } from '../../api/axios'
import { generateAgreementPDF, generateAgreementWithPolicePDF, generateOfferLetterPDF } from './CheckKYC'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import Select from 'react-select'

const DOCUMENT_TYPES = {
  offer_letter: { label: 'Offers', singular: 'Offer Letter', variant: 'green' },
  agreement: { label: 'Agreements', singular: 'Agreement', variant: 'blue' },
  certificate: { label: 'Certificates', singular: 'Certificate', variant: 'gold' },
}


const flattenExportGroups = (groups) => groups.flatMap((group) => {
  // Handle nested candidates structure - each group has a candidates array
  // and each item in candidates might have a nested candidates array
  const candidatesList = group.candidates || []
  
  return candidatesList.flatMap((item) => {
    // Check if this item has a nested candidates array (double-nested structure)
    const actualCandidates = item.candidates || [item]
    
    return actualCandidates.map((candidate) => ({
      ...candidate,
      project_id: group.project_id,
      project_name: group.project_name,
      document_type: group.document_type,
    }))
  })
})

const getCandidateSnapshot = (record) => record?.candidate_snapshot || record?.candidateSnapshot || record?.candidate || {}
const getDocumentPayload = (record) => record?.document_payload || record?.documentPayload || {}
const getProjectId = (project) => project?.id ?? project?.project_id ?? project?.projectId ?? project?.value
const getProjectName = (project) => project?.name || project?.project_name || project?.projectName || project?.title || project?.label || ''
const getCertificateCandidate = (record) => ({
  ...(record?.candidate || record?.candidate_data || {}),
  name: record?.candidate_name || record?.candidateName || record?.name || record?.candidate?.name || '',
  mobile: record?.mobile || record?.candidate_mobile || record?.candidateMobile || record?.candidate?.mobile || '',
  aadhaar_number: record?.aadhaar_number || record?.aadhaar || record?.aadhaarNumber || record?.candidate?.aadhaar_number || record?.candidate?.aadhaar || '',
  designation: record?.designation || record?.candidate_designation || record?.candidate?.designation || '',
  venue: record?.venue || record?.location || record?.candidate?.venue || record?.candidate?.location || '',
  issue_date: record?.issue_date || record?.issueDate || record?.date || record?.candidate?.issue_date || '',
})

const formatDate = (value) => {
  if (!value) return 'Unknown'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

const getRerenderCandidate = (record) => {
  const candidate = getCandidateSnapshot(record)
  const parsed = record.sheet_context?.parsed || {}
  return {
    ...candidate,
    id: candidate.candidate_id || record.candidate_id,
    name: candidate.name || parsed.name || '',
    mobile: candidate.mobile || parsed.mobile || '',
    aadhaarNumber: candidate.aadhaar_number || parsed.aadhaar || '',
    district: candidate.district || parsed.district || '',
    centre: candidate.centre || parsed.centre || '',
    centreCode: candidate.centre_code || parsed.centre_code || '',
    location: candidate.location || parsed.location || '',
    designation: candidate.designation || parsed.designation || '',
  }
}

export default function DocumentExportHistory() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedType = searchParams.get('type') || 'offer_letter'
  const documentType = DOCUMENT_TYPES[requestedType] ? requestedType : 'offer_letter'
  
  // Pagination state
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  
  // Filter states
  const [projectOption, setProjectOption] = useState(null)
  const [searchName, setSearchName] = useState('')
  const [searchMobile, setSearchMobile] = useState('')
  const [searchAadhaar, setSearchAadhaar] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [projectSearchInput, setProjectSearchInput] = useState('')
  
  // UI state
  const [records, setRecords] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [rerenderingId, setRerenderingId] = useState(null)
  const [agreementFormatRecord, setAgreementFormatRecord] = useState(null)
  const [bulkAgreementFormat, setBulkAgreementFormat] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [downloadingZip, setDownloadingZip] = useState(false)

  // Load projects for dropdown
  const loadProjects = async (search = '') => {
    setProjectsLoading(true)
    try {
      const response = await recruiterAPI.getProjectSuggestions(search, 1000)
      // Handle nested response structure
      let projectList = response?.data
      
      // If response.data is not an array, try to get it from response.data.data
      if (!Array.isArray(projectList)) {
        projectList = Array.isArray(projectList?.data) ? projectList.data : []
      }
      
      console.log('Projects loaded:', projectList)
      setProjects(projectList)
    } catch (err) {
      console.error('Failed to load projects:', err)
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }

  // Load document history with pagination and filters
  const loadHistory = async (newOffset = 0) => {
    setLoading(true)
    setError('')
    try {
      const params = {
        offset: newOffset,
        limit,
        ...(projectOption?.value && { project_id: projectOption.value }),
        ...(searchName && { candidate_name: searchName }),
        ...(searchMobile && { candidate_mobile: searchMobile }),
        ...(searchAadhaar && { aadhaar_number: searchAadhaar }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      }
      const response = documentType === 'certificate'
        ? await recruiterAPI.getCertificateHistory(params)
        : await recruiterAPI.getDocumentExports({ ...params, document_type: documentType })
      // Extract nested data structure - API returns { success: true, data: { total, items }, pagination }
      const payload = response?.data?.data || response?.data || {}
      const items = Array.isArray(payload) ? payload : payload.items || payload.records || payload.history || []
      const total = payload.total ?? payload.count ?? items.length
      
      setRecords(documentType === 'certificate' ? items : flattenExportGroups(items))
      setTotal(total)
      setOffset(newOffset)
    } catch (err) {
      setRecords([])
      setError(err?.response?.data?.message || err?.message || 'Unable to load document history.')
    } finally {
      setLoading(false)
    }
  }

  const rerenderRecord = async (record, includePoliceReport = false) => {
    const candidateId = record.candidate_id
    setRerenderingId(String(candidateId))
    setAgreementFormatRecord(null)
    try {
      const candidate = getRerenderCandidate(record)
      const payload = getDocumentPayload(record)
      const generator = record.document_type === 'offer_letter'
        ? generateOfferLetterPDF
        : includePoliceReport || record.document_type === 'agreement_with_police'
          ? generateAgreementWithPolicePDF
          : generateAgreementPDF
      const result = await generator(candidateId, payload, candidate)
      if (!result?.blob) throw new Error(result?.error || 'Unable to generate PDF')
      const name = String(candidate.name || candidateId || 'candidate').replace(/[^a-z0-9]+/gi, '_')
      const suffix = record.document_type === 'offer_letter' ? 'offer_letter' : 'agreement'
      saveAs(result.blob, `${name}_${suffix}.pdf`)
    } catch (err) {
      setError(err?.message || 'Unable to rerender document.')
    } finally {
      setRerenderingId(null)
    }
  }

  const handleRerenderClick = (record) => {
    if (record.document_type === 'agreement') {
      setAgreementFormatRecord(record)
      return
    }
    rerenderRecord(record)
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(records.map((record, index) => String(record.candidate_id || record.id || record.certificate_id || index))))
    } else {
      setSelectedIds(new Set())
    }
  }

  const getRecordId = (record, index = 0) => String(record.candidate_id || record.id || record.certificate_id || index)

  const handleSelectRecord = (candidateId, checked) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(String(candidateId))
    } else {
      newSelected.delete(String(candidateId))
    }
    setSelectedIds(newSelected)
  }

  const downloadBulkAsZip = async () => {
    if (documentType === 'certificate') return
    if (selectedIds.size === 0) {
      setError('Please select at least one record to download.')
      return
    }

    if (documentType === 'agreement') {
      setAgreementFormatRecord(null)
      setBulkAgreementFormat(true)
      return
    }

    await downloadBulkAsZipWithFormat(false)
  }

  const downloadBulkAsZipWithFormat = async (includePoliceReport = false) => {
    setDownloadingZip(true)
    setError('')
    try {
      const zip = new JSZip()
      const selectedRecords = records.filter(r => selectedIds.has(String(r.candidate_id)))

      for (const record of selectedRecords) {
        try {
          const candidate = getRerenderCandidate(record)
          const payload = getDocumentPayload(record)
          const generator = record.document_type === 'offer_letter'
            ? generateOfferLetterPDF
            : includePoliceReport
              ? generateAgreementWithPolicePDF
              : generateAgreementPDF
          const result = await generator(record.candidate_id, payload, candidate)
          if (result?.blob) {
            const name = String(candidate.name || record.candidate_id || 'candidate').replace(/[^a-z0-9]+/gi, '_')
            const suffix = record.document_type === 'offer_letter' ? 'offer_letter' : 'agreement'
            zip.file(`${name}_${suffix}.pdf`, result.blob)
          }
        } catch (err) {
          console.error(`Failed to generate PDF for candidate ${record.candidate_id}:`, err)
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveAs(zipBlob, `documents_${new Date().getTime()}.zip`)
      setSelectedIds(new Set())
    } catch (err) {
      setError(err?.message || 'Unable to download bulk documents as zip.')
    } finally {
      setDownloadingZip(false)
    }
  }

  const handleSearch = () => {
    setOffset(0)
    loadHistory(0)
  }

  useEffect(() => {
    loadProjects('')
  }, [])

  useEffect(() => {
    loadHistory(0)
  }, [documentType])

  const config = DOCUMENT_TYPES[documentType]
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)
  const allSelected = records.length > 0 && selectedIds.size === records.length

  const getVisiblePageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const visiblePages = new Set([1, totalPages, currentPage])
    for (let page = currentPage - 2; page <= currentPage + 2; page += 1) {
      if (page > 1 && page < totalPages) visiblePages.add(page)
    }

    const sortedPages = [...visiblePages].sort((a, b) => a - b)
    const pagesWithBreaks = []

    for (let i = 0; i < sortedPages.length; i += 1) {
      const current = sortedPages[i]
      const previous = sortedPages[i - 1]

      if (previous && current - previous > 1) {
        pagesWithBreaks.push('ellipsis')
      }

      pagesWithBreaks.push(current)
    }

    return pagesWithBreaks
  }

  const pageNumbers = getVisiblePageNumbers()

  const projectOptions = projects.map(p => ({
    value: getProjectId(p),
    label: getProjectName(p) || `Project ${getProjectId(p) ?? ''}`
  }))

  const projectNamesById = useMemo(() => new Map(
    projects
      .map((project) => [String(getProjectId(project)), getProjectName(project)])
      .filter(([projectId, projectName]) => projectId && projectName)
  ), [projects])

  const rows = records.map((record, index) => {
    const candidate = documentType === 'certificate' ? getCertificateCandidate(record) : getCandidateSnapshot(record)
    const recordId = getRecordId(record, index)
    const selectCell = <input
      type="checkbox"
      checked={selectedIds.has(recordId)}
      onChange={(e) => handleSelectRecord(recordId, e.target.checked)}
    />
    const rerenderCell = documentType === 'certificate' ? <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/app/recruiter/certifications', { state: { rerenderCertificate: record } })} title="Choose a certificate template and rerender">
        <FontAwesomeIcon icon={faDownload} /> Rerender
      </button> : <button type="button" className="btn btn-outline btn-sm" onClick={() => handleRerenderClick(record)} disabled={rerenderingId === String(record.candidate_id)} title="Rerender document">
        <FontAwesomeIcon icon={rerenderingId === String(record.candidate_id) ? faRefresh : faDownload} spin={rerenderingId === String(record.candidate_id)} /> Rerender
      </button>

    if (documentType === 'certificate') {
      return [
        selectCell,
        projectNamesById.get(String(record.project_id)) || record.project_id || '—',
        candidate.name || 'Unknown',
        candidate.mobile || '—',
        candidate.aadhaar_number || '—',
        record.project_name || '—',
        candidate.venue || '—',
        candidate.issue_date || '—',
        formatDate(record.created_at),
        candidate.designation || '—',
        rerenderCell,
      ]
    }

    return [
      selectCell,
      record.project_name || '—',
      candidate.name || 'Unknown',
      candidate.mobile || '—',
      candidate.aadhaar_number || '—',
      candidate.district || '—',
      candidate.centre || '—',
      candidate.location || '—',
      candidate.designation || '—',
      rerenderCell,
    ]
  })

  return (
    <div>
      <PageHeader
        title={`${config.label} History`}
        subtitle={`Review and rerender generated ${config.label.toLowerCase()} for candidates.`}
        action={<button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/app/recruiter/check-kyc')}><FontAwesomeIcon icon={faArrowLeft} /> Check KYC</button>}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {Object.entries(DOCUMENT_TYPES).map(([type, item]) => (
          <button key={type} type="button" className={`btn btn-sm ${documentType === type ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSearchParams({ type })}>
            {item.label} History
          </button>
        ))}
      </div>

      <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <StatCard label={`Total ${config.label}`} value={total} icon="📄" />
      </div>

      {/* Filters Card */}
      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {/* Project Filter - Searchable */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500 }}>Project</label>
            <Select
              options={projectOptions}
              value={projectOption}
              onChange={setProjectOption}
              onInputChange={(value) => {
                setProjectSearchInput(value)
                loadProjects(value)
              }}
              isLoading={projectsLoading}
              placeholder="Search projects..."
              isClearable
              isSearchable
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '38px',
                  borderColor: '#d1d5db',
                  '&:hover': { borderColor: '#9ca3af' },
                }),
              }}
            />
          </div>

          {/* Name Search */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500 }}>Candidate Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
          </div>

          {/* Mobile Search */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500 }}>Mobile Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search by mobile..."
              value={searchMobile}
              onChange={(e) => setSearchMobile(e.target.value)}
            />
          </div>

          {/* Aadhaar Search */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500 }}>Aadhaar Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search by Aadhaar..."
              value={searchAadhaar}
              onChange={(e) => setSearchAadhaar(e.target.value)}
            />
          </div>

          {/* Date From */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500 }}>Date From</label>
            <input
              type="date"
              className="form-control"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500 }}>Date To</label>
            <input
              type="date"
              className="form-control"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setSearchName('')
              setSearchMobile('')
              setSearchAadhaar('')
              setDateFrom('')
              setDateTo('')
              setProjectOption(null)
            }}
          >
            Clear Filters
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSearch}
            disabled={loading}
            title="Search with current filters"
          >
            <FontAwesomeIcon icon={faSearch} /> Search
          </button>
        </div>
      </Card>

      {/* Bulk Actions Card */}
      {selectedIds.size > 0 && documentType !== 'certificate' && (
        <Card style={{ padding: 16, marginBottom: 20, background: '#f0f7ff', border: '1px solid #0ea5e9' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.95rem' }}>
              <strong>{selectedIds.size}</strong> record(s) selected
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedIds(new Set())}
                title="Clear selection"
              >
                Clear Selection
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={downloadBulkAsZip}
                disabled={downloadingZip}
                title="Download all selected records as a ZIP file"
              >
                <FontAwesomeIcon icon={downloadingZip ? faRefresh : faFileZipper} spin={downloadingZip} /> Download as ZIP
              </button>
            </div>
          </div>
        </Card>
      )}

      {error && <Card style={{ padding: 16, color: 'var(--red)', marginBottom: 20 }}>{error}</Card>}
      
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {records.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                title={allSelected ? 'Deselect all' : 'Select all on this page'}
              />
              <span style={{ fontSize: '0.85rem', color: '#666' }}>
                {allSelected ? `All ${records.length} records selected` : `Select all ${records.length} records`}
              </span>
            </div>
          ) : (
            <div />
          )}

          <div style={{ marginLeft: 'auto', padding: '6px 12px', background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ margin: 0, fontSize: '0.85rem' }}>Show entries</label>
            <select
              value={limit}
              onChange={(e) => {
                const nextLimit = Number(e.target.value)
                setLimit(nextLimit)
                setOffset(0)
                loadHistory(0)
              }}
              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={documentType === 'certificate'
            ? ['Select', 'Project Name', 'Candidate', 'Mobile', 'Aadhaar', 'Certificate Title', 'Venue', 'Issue Date', 'Created At', 'Designation', 'Action']
            : ['Select', 'Project', 'Candidate', 'Mobile', 'Aadhaar', 'District', 'Centre', 'Location', 'Designation', 'Action']}
          rows={rows}
          emptyMessage={loading ? 'Loading history...' : `No ${config.label.toLowerCase()} history found.`}
        />
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Card style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.9rem' }}>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> • Showing <strong>{records.length}</strong> of <strong>{total}</strong> records
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => loadHistory(Math.max(0, offset - limit))}
              disabled={offset === 0 || loading}
              title="Previous page"
            >
              <FontAwesomeIcon icon={faChevronLeft} /> Previous
            </button>

            {pageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span key={`ellipsis-${index}`} style={{ padding: '6px 4px', color: '#6b7280' }}>
                    ...
                  </span>
                )
              }

              const isActive = page === currentPage
              return (
                <button
                  key={page}
                  type="button"
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => loadHistory((page - 1) * limit)}
                  disabled={loading}
                  style={{ minWidth: 42 }}
                >
                  {page}
                </button>
              )
            })}

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => loadHistory(offset + limit)}
              disabled={offset + limit >= total || loading}
              title="Next page"
            >
              Next <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </Card>
      )}

      {(agreementFormatRecord || bulkAgreementFormat) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)' }}>
            <h2 style={{ margin: '0 0 8px' }}>Choose Agreement Export Format</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--text3)' }}>
              {bulkAgreementFormat
                ? 'Choose whether to download the standard agreement ZIP or the complete agreement ZIP with police verification.'
                : 'Choose whether to regenerate the standard agreement or the complete agreement with police verification.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  if (bulkAgreementFormat) {
                    downloadBulkAsZipWithFormat(false)
                    setBulkAgreementFormat(false)
                    return
                  }
                  rerenderRecord(agreementFormatRecord, false)
                }}
                disabled={rerenderingId !== null || downloadingZip}
                style={{ minHeight: 120, display: 'grid', gap: 8, alignContent: 'center' }}
              >
                <strong>Standard Export</strong>
                <span>Agreement, pages 1-2, and KYC report, page 3</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (bulkAgreementFormat) {
                    downloadBulkAsZipWithFormat(true)
                    setBulkAgreementFormat(false)
                    return
                  }
                  rerenderRecord(agreementFormatRecord, true)
                }}
                disabled={rerenderingId !== null || downloadingZip}
                style={{ minHeight: 120, display: 'grid', gap: 8, alignContent: 'center' }}
              >
                <strong>Complete Export</strong>
                <span>Agreement, KYC report, and police report</span>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setAgreementFormatRecord(null)
                  setBulkAgreementFormat(false)
                }}
                disabled={rerenderingId !== null || downloadingZip}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <LoadingOverlay active={loading} message="Loading document history..." />
    </div>
  )
}
