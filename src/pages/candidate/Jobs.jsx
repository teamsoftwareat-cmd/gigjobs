import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faPaperPlane, faMapMarkerAlt, faClock, faCalendar, faFilter, faChevronLeft, faChevronRight, faSearch, faBriefcase, faUserGraduate } from '@fortawesome/free-solid-svg-icons'
import { Card, PageHeader, Tag, Modal } from '../../components/ui/index'
import { candidateAPI } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import VerificationBanner from '../../components/Common/VerificationBanner'
import { applyJobSchema } from '../../schemas/validations'

export default function CandidateJobs() {
  const [searchTerm, setSearchTerm] = useState('')
  const [applyJob, setApplyJob] = useState(null)
  const [applyForm, setApplyForm] = useState({
    preferredStartDate: '',
    selectedPreference: ''
  })
  const [resumeFile, setResumeFile] = useState(null)
  const [applyErrors, setApplyErrors] = useState({})
  
  // Pagination states
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 10,
    offset: 0,
    totalJobs: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  
  const { user } = useAuth()
  const registrationId = user?.registrationId || user?.registration_id || localStorage.getItem('registration_id')
  const candidateContact = {
    mobile: user?.mobile || '',
    email: user?.email || '',
    aadhaar: user?.aadhaar || user?.aadhaar_number || '',
  }
  const navigate = useNavigate()

  const [aadhaarVerified, setAadhaarVerified] = useState(null)

  const [filters, setFilters] = useState({
    location: 'All Locations'
  })

  const [availableFilters, setAvailableFilters] = useState({
    locations: []
  })

  const [isMobile, setIsMobile] = useState(false)

  // Show entries options
  const entriesOptions = [10, 25, 50, 100]

  // Fetch jobs with offset/limit pagination and search query
  const fetchJobs = async (page = 1, limit = pagination.limit, search = searchTerm) => {
    setLoading(true)
    try {
      const offset = (page - 1) * limit
      
      const params = {
        offset: offset,
        limit: limit,
        ...(registrationId ? { registration_id: registrationId } : {}),
        ...(search && { search: search }),
        ...(filters.location !== 'All Locations' && { location: filters.location })
      }
      
      const response = await candidateAPI.getJobs(params)
      
      if (response.data.success) {
        setJobs(response.data.data.jobs)
        
        const totalJobs = response.data.data.total || 0
        const totalPages = Math.ceil(totalJobs / limit)
        const hasNext = offset + limit < totalJobs
        const hasPrev = offset > 0
        
        setPagination({
          currentPage: page,
          limit: limit,
          offset: offset,
          totalJobs: totalJobs,
          totalPages: totalPages,
          hasNext: hasNext,
          hasPrev: hasPrev
        })
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle search
  const handleSearch = () => {
    fetchJobs(1, pagination.limit, searchTerm)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchJobs(newPage, pagination.limit, searchTerm)
    }
  }

  // Handle previous page
  const handlePrevious = () => {
    if (pagination.hasPrev && pagination.currentPage > 1) {
      handlePageChange(pagination.currentPage - 1)
    }
  }

  // Handle next page
  const handleNext = () => {
    if (pagination.hasNext && pagination.currentPage < pagination.totalPages) {
      handlePageChange(pagination.currentPage + 1)
    }
  }

  // Handle entries per page change
  const handleEntriesChange = (newLimit) => {
    const newTotalPages = Math.ceil(pagination.totalJobs / newLimit)
    const newPage = Math.min(pagination.currentPage, newTotalPages)
    fetchJobs(newPage, newLimit, searchTerm)
  }

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({ ...prev, [filterType]: value }))
  }

  // Apply all filters (reset to page 1)
  const applyFilters = () => {
    fetchJobs(1, pagination.limit, searchTerm)
  }

  // Reset filters
  const resetFilters = () => {
    setFilters({
      location: 'All Locations'
    })
    fetchJobs(1, pagination.limit, searchTerm)
  }

  // Fetch available filters on mount
  const fetchFilters = async () => {
    try {
      const response = await candidateAPI.getJobFilters()
      if (response.data.success) {
        setAvailableFilters({
          locations: response.data.filters.locations || []
        })
      }
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }

  const isWrittenProject = (job) => String(job?.project_type || job?.projectType || '').toLowerCase() === 'written'
  const getPreferenceFieldName = (job) => (isWrittenProject(job) ? 'district' : 'location')
  const getPreferenceLabel = (job) => (isWrittenProject(job) ? 'Preferred district' : 'Preferred location')

  // Apply for job
  const handleApply = async () => {
    // Ensure candidate selected a preference for this job
    if (!applyForm.selectedPreference) {
      setApplyErrors({ selectedPreference: `Please select a ${isWrittenProject(applyJob) ? 'district' : 'location'}` })
      return
    }
    const result = applyJobSchema.safeParse(applyForm)
    if (!result.success) {
      const errs = {}
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message })
      setApplyErrors(errs)
      return
    }
    
    setApplyErrors({})
    try {
      const preferenceField = getPreferenceFieldName(applyJob)
      const requestData = {
        jobId: applyJob.id,
        preferredStartDate: applyForm.preferredStartDate,
        [preferenceField]: applyForm.selectedPreference,
        mobile: candidateContact.mobile,
        email: candidateContact.email,
        aadhaar: candidateContact.aadhaar,
      }

      const formData = new FormData()
      formData.append('registration_id', registrationId)
      Object.entries(requestData).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        if (Array.isArray(value)) {
          value.forEach((item) => formData.append(`${key}[]`, item))
        } else {
          formData.append(key, value)
        }
      })
      if (resumeFile instanceof File) {
        formData.append('resume', resumeFile)
      }
      await candidateAPI.applyJob(registrationId, applyJob.id, formData)

      // After successful application, refresh jobs list so UI reflects applied status
      try {
        await fetchJobs(pagination.currentPage || 1, pagination.limit, searchTerm)
      } catch (refreshErr) {
        // ignore refresh errors
        console.warn('Failed to refresh jobs after apply', refreshErr)
      }

      // After successful application, check Aadhaar verification status.
      // We allow applying but warn the user if they're not verified.
      try {
        const verifyResp = await candidateAPI.checkAadhaarVerification({ registration_id: registrationId })
        const payload = verifyResp?.data ?? verifyResp
        const checkData = payload?.data ?? payload
        let isVerified = true
        if (checkData && typeof checkData === 'object') {
          isVerified = Boolean(checkData.verified ?? checkData.is_verified ?? (checkData.status === 'verified'))
        } else if (typeof checkData === 'string') {
          isVerified = checkData.toLowerCase().includes('verified')
        }
        if (!isVerified) {
          window.dispatchEvent(new CustomEvent('apiMessage', {
            detail: {
              type: 'error',
              message: 'Your Aadhaar is not verified. Application submitted but will not be processed until verification.',
            },
          }))
        }
      } catch (e) {
        // ignore verification check errors
      }

      setApplyJob(null)
      setApplyForm({ preferredStartDate: '', selectedPreference: '' })
      setResumeFile(null)
    } catch (error) {
      console.error('Application error:', error)
    }
  }

  // Format salary display
  const formatSalary = (salary) => {
    if (!salary) return '₹300-800/day'
    if (typeof salary === 'number') {
      return `₹${salary}/day`
    }
    if (typeof salary === 'string') {
      if (salary.includes('/day')) return salary
      return `₹${salary}/day`
    }
    return `₹${salary}/day`
  }

  const formatDateValue = (value) => {
    if (!value) return ''
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
      ? String(value)
      : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const normalizeField = (value) => {
    if (value === undefined || value === null) return ''
    if (Array.isArray(value)) return value.join(', ')
    return String(value)
  }

  const jobDateRange = (job) => {
    if (!job) return null
    const start = job.startDate || job.start_date || job.fromDate || job.from_date || job.start
    const end = job.endDate || job.end_date || job.toDate || job.to_date || job.end
    if (!start && !end) return null
    return `${start ? formatDateValue(start) : 'Any'} → ${end ? formatDateValue(end) : 'Any'}`
  }

  // Initial load
  useEffect(() => {
    fetchJobs(1, pagination.limit, '')
    fetchFilters()
  }, [])

  // Check Aadhaar verification status for banner
  useEffect(() => {
    const runCheck = async () => {
      if (!registrationId) return setAadhaarVerified(null)
      try {
        const resp = await candidateAPI.checkAadhaarVerification({ registration_id: registrationId })
        const payload = resp?.data ?? resp
        const checkData = payload?.data ?? payload
        let isVerified = true
        if (checkData && typeof checkData === 'object') {
          isVerified = Boolean(checkData.verified ?? checkData.is_verified ?? (checkData.status === 'verified'))
        } else if (typeof checkData === 'string') {
          isVerified = checkData.toLowerCase().includes('verified')
        }
        setAadhaarVerified(isVerified)
      } catch (e) {
        setAadhaarVerified(null)
      }
    }
    runCheck()
  }, [registrationId])

  // When an apply modal opens, prefill selected location (first available)
  useEffect(() => {
    if (!applyJob) return
    const locs = Array.isArray(applyJob.location)
      ? applyJob.location
      : (applyJob.locations || (applyJob.location ? [applyJob.location] : []))
    setApplyForm(prev => ({ ...prev, selectedPreference: locs[0] || '' }))
  }, [applyJob])

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(window.innerWidth <= 640)
    updateIsMobile()
    window.addEventListener('resize', updateIsMobile)
    return () => window.removeEventListener('resize', updateIsMobile)
  }, [])

  return (
    <div className="candidate-jobs-page">
      <PageHeader
        title="Browse Jobs"
        subtitle={`${pagination.totalJobs.toLocaleString()} open roles in Greater Chennai`}
      />

      {aadhaarVerified === false && (
        <VerificationBanner
          message="Aadhaar is not verified for this profile. You can apply, but applications won't be processed until verification."
          buttonText="Verify Aadhaar"
          onAction={() => {
            const params = new URLSearchParams()
            if (registrationId) params.set('candidate_id', registrationId)
            navigate(`/attendance/kycverify?${params.toString()}`)
          }}
        />
      )}

      {/* Dynamic Filters - Only Locations and Salary */}
      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select 
            className="form-control" 
            style={{ flex: 1, minWidth: 130 }}
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
          >
            <option>All Locations</option>
            {availableFilters.locations?.map(location => (
              <option key={location}>{location}</option>
            ))}
          </select>
          
          <button style={{ width: '80px', backgroundColor: 'var(--teal)', color: 'white' }} className="btn btn-outline btn-sm" onClick={applyFilters}>
            <FontAwesomeIcon icon={faFilter} /> Filter
          </button>
          <button className="btn btn-outline btn-sm" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </Card>

      {/* Show Entries & Search */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <FontAwesomeIcon icon={faSpinner} className="spinner" size="2x" />
          <p>Loading jobs...</p>
        </div>
      ) : (
        <>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text-sm" style={{ color: 'var(--text3)' }}>Show entries:</span>
              <select 
                className="form-control" 
                style={{ width: '80px', padding: '6px 8px' }}
                value={pagination.limit}
                onChange={(e) => handleEntriesChange(Number(e.target.value))}
              >
                {entriesOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search jobs by title, company..."
                style={{ width: isMobile ? '100%' : '100%', minWidth: 0 }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="btn btn-primary btn-sm" onClick={handleSearch}>
                <FontAwesomeIcon icon={faSearch} /> Search
              </button>
            </div>
          </div>

          {/* Showing entries info */}
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text3)' }}>
            Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.totalJobs)} of {pagination.totalJobs.toLocaleString()} entries
          </div>

          {/* Job Grid */}
          <div className="job-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, width: '100%' }}>
            {jobs.map((job) => {
              const isApplied = Boolean(job.applied ?? job.is_applied ?? (job.applied_status === true))
              return (
              <div key={job.id} className="job-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div className="job-co-logo">{job.emoji || '💼'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="job-title">{normalizeField(job.title)}</div>
                    <div className="job-company">{normalizeField(job.company)} · {normalizeField(job.location)}</div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
                  <Tag variant={job.typeVariant || 'teal'}>{normalizeField(job.type)}</Tag>
                  <Tag variant="gray">{normalizeField(job.shift)}</Tag>
                  <Tag variant="blue">{normalizeField(job.industry)}</Tag>
                </div>
                
                {/* Experience Level */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <FontAwesomeIcon icon={faUserGraduate} style={{ color: 'var(--teal)', fontSize: 12 }} />
                  <span className="text-sm" style={{ color: 'var(--text2)', minWidth: 0 }}>
                    Experience: {normalizeField(job.experienceLevel) || 'Fresher'}
                  </span>
                </div>
                
                {/* Shift Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <FontAwesomeIcon icon={faBriefcase} style={{ color: 'var(--teal)', fontSize: 12 }} />
                  <span className="text-sm" style={{ color: 'var(--text2)', minWidth: 0 }}>
                    Shift: {normalizeField(job.shift) || 'Day Shift'}
                  </span>
                </div>
                
                <div className="text-sm text-muted" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                    <FontAwesomeIcon icon={faMapMarkerAlt} style={{ color: 'var(--teal)' }} /> {normalizeField(job.location)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                    <FontAwesomeIcon icon={job.type === 'Internship' ? faCalendar : faClock} style={{ color: 'var(--teal)' }} /> {normalizeField(job.time)}
                  </span>
                </div>
                
                <div className="job-card-footer">
                  <div className="job-salary">{formatSalary(job.salary)}</div>
                  <button
                    className={`btn btn-sm ${isApplied ? 'btn-outline' : 'btn-primary'}`}
                    onClick={() => !isApplied && setApplyJob(job)}
                    disabled={isApplied}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} /> {isApplied ? 'Applied' : 'Apply Now'}
                  </button>
                </div>
              </div>
              )
            })}
          </div>

          {/* Pagination - Showing backend total (1240) instead of page numbers */}
          <div style={{ 
            marginTop: 30, 
            padding: '20px 0', 
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap'
          }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={handlePrevious}
              disabled={!pagination.hasPrev || pagination.currentPage === 1}
            >
              <FontAwesomeIcon icon={faChevronLeft} /> Previous
            </button>
            
            <span style={{ fontSize: 14, color: 'var(--text3)' }}>
                Page {pagination.currentPage} of {pagination.totalPages || 1}
            </span>
            
            <button
              className="btn btn-outline btn-sm"
              onClick={handleNext}
              disabled={!pagination.hasNext || pagination.currentPage === pagination.totalPages}
            >
              Next <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </>
      )}

      {/* Apply Modal */}
      <Modal
        isOpen={!!applyJob}
        onClose={() => { setApplyJob(null); setApplyErrors({}); setResumeFile(null) }}
        title="Apply for Job"
        maxWidth={isMobile ? '100%' : '900px'}
        fullScreen={isMobile}
        footer={
          applyJob && (
            <>
              <button className="btn btn-outline" onClick={() => { setApplyJob(null); setResumeFile(null) }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleApply}>
                <FontAwesomeIcon icon={faPaperPlane} /> Submit Application
              </button>
            </>
          )
        }
      >
        {applyJob && (
          <>
            <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div className="job-co-logo" style={{ width: 52, height: 52, fontSize: 20 }}>{applyJob.emoji || '💼'}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--teal)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{applyJob.title}</div>
                  <div className="text-sm text-muted" style={{ marginTop: 4 }}>{normalizeField(applyJob.company)} · {normalizeField(applyJob.location)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <div className="text-sm text-muted">Employment type</div>
                  <div style={{ marginTop: 6 }}><Tag variant={applyJob.typeVariant || 'teal'}>{applyJob.type || 'Full Time'}</Tag></div>
                </div>
                <div>
                  <div className="text-sm text-muted">Shift</div>
                  <div style={{ marginTop: 6 }}>{applyJob.shift || 'Day Shift'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Experience</div>
                  <div style={{ marginTop: 6 }}>{applyJob.experienceLevel || 'Fresher'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Salary</div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>{formatSalary(applyJob.salary)}</div>
                </div>
              </div>

              {jobDateRange(applyJob) && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="text-sm text-muted">Job dates</div>
                  <div style={{ marginTop: 6, fontWeight: 600 }}>{jobDateRange(applyJob)}</div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                <div>
                  <div className="text-sm text-muted">Job description</div>
                  <div style={{ marginTop: 10, padding: 14, borderRadius: 12, background: 'var(--bg)' }}>
                    <p style={{ marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text2)' }}>
                      {applyJob.description || applyJob.details || applyJob.summary || 'No description available for this role.'}
                    </p>
                    {applyJob.requirements && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>Requirements</div>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text2)' }}>{applyJob.requirements}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{getPreferenceLabel(applyJob)}</label>
              <select
                className={`form-control${applyErrors.selectedPreference ? ' invalid' : ''}`}
                value={applyForm.selectedPreference}
                onChange={(e) => setApplyForm({ ...applyForm, selectedPreference: e.target.value })}
              >
                <option value="">Select {isWrittenProject(applyJob) ? 'district' : 'location'}</option>
                {(Array.isArray(applyJob?.location) ? applyJob.location : (applyJob?.locations || (applyJob?.location ? [applyJob.location] : []))).map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              {applyErrors.selectedPreference && <div className="field-error">{applyErrors.selectedPreference}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Mobile number</label>
              <input
                type="text"
                className="form-control"
                value={candidateContact.mobile}
                readOnly
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-control"
                value={candidateContact.email}
                readOnly
              />
            </div>
            <div className="form-group">
              <label className="form-label">Aadhaar number</label>
              <input
                type="text"
                className="form-control"
                value={candidateContact.aadhaar}
                readOnly
              />
            </div>
            <div className="form-group">
              <label className="form-label">Resume (optional)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="form-control"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred start date</label>
              <input 
                className={`form-control${applyErrors.preferredStartDate ? ' invalid' : ''}`} 
                type="date"
                value={applyForm.preferredStartDate} 
                onChange={(e) => setApplyForm({ ...applyForm, preferredStartDate: e.target.value })} 
              />
              {applyErrors.preferredStartDate && <div className="field-error">{applyErrors.preferredStartDate}</div>}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}