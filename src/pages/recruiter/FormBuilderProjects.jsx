import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faPen, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons'
import { Card, PageHeader } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import { encryptRegistrationId } from '../../utils/faceEnrollLinkCrypto'

const getFormBuilderId = (formBuilder) => formBuilder?.formBuilderId ?? formBuilder?.form_builder_id ?? formBuilder?.id ?? formBuilder?._id
const getFormBuilderName = (formBuilder) => formBuilder?.name ?? formBuilder?.form_name ?? formBuilder?.title ?? 'Untitled form'
const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const getFormBuildersPayload = (response) => {
  const payload = response?.data?.data ?? response?.data ?? response
  const items = Array.isArray(payload) ? payload : payload?.items ?? payload?.form_builders ?? payload?.forms ?? payload?.results ?? []
  const total = payload?.total ?? payload?.totalCount ?? payload?.count ?? payload?.meta?.total ?? payload?.meta?.totalItems ?? items.length
  return { items: Array.isArray(items) ? items : [], total: Number(total) || 0 }
}

export default function FormBuilderProjects() {
  const navigate = useNavigate()
  const [formBuilders, setFormBuilders] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [copiedFormId, setCopiedFormId] = useState(null)
  const [copyError, setCopyError] = useState('')

  const loadFormBuilders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await recruiterAPI.getFormBuilders({
        search: searchQuery || undefined,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      })
      const result = getFormBuildersPayload(response)
      setFormBuilders(result.items)
      setTotal(result.total)
    } catch (loadError) {
      setFormBuilders([])
      setTotal(0)
      setError(loadError?.message || 'Unable to load form builders. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery])

  useEffect(() => { loadFormBuilders() }, [loadFormBuilders])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const copyFormLink = async (formBuilder) => {
    const formBuilderId = getFormBuilderId(formBuilder)
    if (formBuilderId == null) return

    try {
      const encryptedFormId = await encryptRegistrationId(formBuilderId)
      const link = `https://cynosurejobs.net/gigjobs3/#/apply/${encodeURIComponent(encryptedFormId)}`
      await navigator.clipboard.writeText(link)
      setCopiedFormId(String(formBuilderId))
      setCopyError('')
      window.setTimeout(() => setCopiedFormId(null), 2000)
    } catch (copyFailure) {
      setCopyError(copyFailure?.message || 'Unable to encrypt or copy the form link. Please try again.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, total)

  return (
    <div>
      <PageHeader
        title="Form Builder"
        subtitle="Create and manage application forms."
        action={(
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/app/recruiter/form-builder/new')}>
            <FontAwesomeIcon icon={faPlus} /> Create Form Builder
          </button>
        )}
      />

      <Card>
        <div className="projects-table-filters" style={{ marginBottom: 16 }}>
          <div className="projects-table-filter-group search-group">
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
              <input
                className="form-control search-input"
                type="search"
                placeholder="Search form ID or name"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <label className="projects-table-filter-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Show entries</span>
            <select className="form-control" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} style={{ width: 90 }}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>

        <div className="excel-preview" style={{ marginTop: 0, overflowX: 'auto' }}>
          <table className="excel-preview-table" style={{ minWidth: 760 }}>
            <thead>
              <tr><th>Form ID</th><th>Form name</th><th>Project</th><th>Created</th><th>Last updated</th><th>Action</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>Loading form builders...</td></tr>
              ) : error && formBuilders.length === 0 ? (
                <tr><td colSpan={6} role="alert" style={{ textAlign: 'center', padding: 24, color: 'var(--red)' }}>{error}</td></tr>
              ) : formBuilders.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No form builders found.</td></tr>
              ) : formBuilders.map((formBuilder, index) => {
                const formBuilderId = getFormBuilderId(formBuilder)
                return (
                  <tr key={formBuilderId ?? `${page}-${index}`}>
                    <td>{formBuilderId ?? '-'}</td>
                    <td>{getFormBuilderName(formBuilder)}</td>
                    <td>{formBuilder.project_name ?? formBuilder.projectName ?? '-'}</td>
                    <td>{formatDate(formBuilder.createdAt ?? formBuilder.created_at)}</td>
                    <td>{formatDate(formBuilder.updatedAt ?? formBuilder.updated_at)}</td>
                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/app/recruiter/form-builder/${encodeURIComponent(formBuilderId)}`)}
                        disabled={formBuilderId == null}
                      >
                        <FontAwesomeIcon icon={faPen} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => copyFormLink(formBuilder)}
                        disabled={formBuilderId == null}
                        aria-label={`Copy link for ${getFormBuilderName(formBuilder)}`}
                      >
                        <FontAwesomeIcon icon={faCopy} /> {copiedFormId === String(formBuilderId) ? 'Copied' : 'Copy link'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {error && formBuilders.length > 0 && <div role="alert" style={{ color: 'var(--red)', marginTop: 10 }}>{error}</div>}
        {copyError && <div role="alert" style={{ color: 'var(--red)', marginTop: 10 }}>{copyError}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14, fontSize: 13 }}>
          <span>Showing {firstRow}–{lastRow} of {total} form builders</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        </div>
      </Card>
    </div>
  )
}
