import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faMobileAlt, faIdCard, faUserCircle, faQrcode } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { PageHeader, Card } from '../../components/ui'

const buildQrUrl = (value) => {
  const encoded = encodeURIComponent(value)
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encoded}`
}

const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim().toLowerCase()
}

const parseBooleanLike = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const text = normalizeText(value)
    if (['1', 'true', 'yes', 'y', 'verified', 'registered', 'active', 'success', 'complete', 'approved', 'done'].includes(text)) {
      return true
    }
    if (['0', 'false', 'no', 'n', 'not registered', 'not_registered', 'pending', 'inactive', 'failed', 'rejected', 'unverified'].includes(text)) {
      return false
    }
  }
  return undefined
}

const isRegisteredStatus = (item) => {
  const direct = parseBooleanLike(item?.is_registered ?? item?.registered ?? item?.registration_status ?? item?.status)
  if (typeof direct === 'boolean') return direct

  const status = normalizeText(item?.registration_status ?? item?.registrationStatus ?? item?.status)
  if (status === '') return false
  return !['not registered', 'not_registered', 'pending', 'unregistered', 'false', '0', 'no', 'n'].includes(status)
}

const isKycVerifiedStatus = (item) => {
  const direct = parseBooleanLike(item?.is_kyc_verified ?? item?.kyc_verified ?? item?.kycStatus ?? item?.kyc_status ?? item?.verification_status)
  if (typeof direct === 'boolean') return direct

  const status = normalizeText(item?.kyc_status ?? item?.kycStatus ?? item?.verification_status ?? item?.kyc)
  if (status === '') return false
  return ['verified', 'verified successfully', 'approved', 'true', '1', 'yes', 'done', 'complete', 'success'].includes(status)
}

const isPoliceVerifiedStatus = (item) => {
  const direct = parseBooleanLike(item?.is_police_verified ?? item?.police_verified ?? item?.police_status ?? item?.policeStatus)
  if (typeof direct === 'boolean') return direct

  const status = normalizeText(item?.police_status ?? item?.policeStatus ?? item?.police_verification_status)
  if (status === '') return false
  return ['verified', 'verified successfully', 'approved', 'true', '1', 'yes', 'done', 'complete', 'success'].includes(status)
}

const formatStatus = (value, fallback = '—') => {
  const text = normalizeText(value)
  if (!text) return fallback
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const getCandidateRecord = (payload) => {
  const topLevel = payload?.data ?? payload
  const items = Array.isArray(topLevel?.items)
    ? topLevel.items
    : Array.isArray(topLevel?.data)
      ? topLevel.data
      : Array.isArray(topLevel)
        ? topLevel
        : []

  return topLevel?.item || topLevel?.candidate || topLevel?.result || items[0] || null
}

export default function RegistrationKycStatus() {
  const [mobileSearch, setMobileSearch] = useState('')
  const [aadhaarSearch, setAadhaarSearch] = useState('')
  const [candidate, setCandidate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hoveredQr, setHoveredQr] = useState(null)
  const [copiedQr, setCopiedQr] = useState('')

  const handleSearch = async (event) => {
    event?.preventDefault?.()

    if (!mobileSearch.trim() && !aadhaarSearch.trim()) {
      setCandidate(null)
      setError('Enter a mobile number or Aadhaar number to search.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await recruiterAPI.getRegistrationKycStatus({
        mobile: mobileSearch || undefined,
        aadhaar: aadhaarSearch || undefined,
      })

      const record = getCandidateRecord(response?.data ?? {})
      if (record) {
        setCandidate(record)
      } else {
        setCandidate(null)
        setError('No candidate found for the provided details.')
      }
    } catch (err) {
      console.error('Failed to load registration and KYC status:', err)
      setCandidate(null)
      setError('Unable to load candidate details right now.')
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setMobileSearch('')
    setAadhaarSearch('')
    setCandidate(null)
    setError('')
    setHoveredQr(null)
    setCopiedQr('')
  }

  const handleCopyLink = async (link, qrKey) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
        setCopiedQr(qrKey)
        window.setTimeout(() => setCopiedQr(''), 1600)
      }
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const candidateId = candidate?.id || candidate?.candidate_id || candidate?.candidateId || ''
  const name = candidate?.name || candidate?.candidate_name || candidate?.candidateName || '—'
  const mobile = candidate?.mobile || candidate?.candidate_mobile || candidate?.mobile_number || candidate?.phone || '—'
  const aadhaar = candidate?.aadhaar || candidate?.aadhaar_number || candidate?.aadhar_number || '—'
  const isRegistered = isRegisteredStatus(candidate)
  const isKycVerified = isKycVerifiedStatus(candidate)
  const isPoliceVerified = isPoliceVerifiedStatus(candidate)
  const registrationStatus = formatStatus(candidate?.registration_status ?? candidate?.registrationStatus ?? (isRegistered ? 'Registered' : 'Not registered'))
  const kycStatus = formatStatus(candidate?.kyc_status ?? candidate?.kycStatus ?? (isKycVerified ? 'Verified' : 'Not verified'))
  const policeStatus = formatStatus(candidate?.police_status ?? candidate?.policeStatus ?? (isPoliceVerified ? 'Verified' : 'Pending'))
  const registrationLink = 'https://cynosurejobs.net/gigjobs/#/register'
  const kycLink = `https://cynosurejobs.net/gigjobs/#/attendance/kycverify?candidateid=${candidateId}`
  const policeInfoLink = candidateId ? `https://cynosurejobs.net/gigjobs/#/attendance/police-info?candidate_id=${candidateId}` : ''
  const showRegistrationQr = !!candidate && !isRegistered
  const showKycQr = !!candidate && isRegistered && !isKycVerified

  return (
    <div className="recruiter-attendance-page">
      <PageHeader
        title="Registration / KYC Status"
        subtitle="Search one candidate by mobile number or Aadhaar and review their registration and KYC progress."
      />

      <Card style={{ marginBottom: 20, padding: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="filter-search-box">
              <FontAwesomeIcon icon={faMobileAlt} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Mobile number"
                value={mobileSearch}
                onChange={(event) => setMobileSearch(event.target.value)}
              />
            </div>

            <div className="filter-search-box">
              <FontAwesomeIcon icon={faIdCard} className="filter-search-icon" />
              <input
                className="form-control"
                placeholder="Aadhaar number"
                value={aadhaarSearch}
                onChange={(event) => setAadhaarSearch(event.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              <FontAwesomeIcon icon={faSearch} style={{ marginRight: 6 }} />
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={clearSearch}>
              Clear
            </button>
          </div>

          {error ? <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div> : null}
        </form>
      </Card>

      {candidate ? (
        <Card style={{ padding: 20, borderRadius: 18, boxShadow: '0 14px 36px rgba(15, 23, 42, 0.08)', background: 'linear-gradient(135deg, rgba(14, 124, 134, 0.06), rgba(108, 63, 197, 0.04))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FontAwesomeIcon icon={faUserCircle} style={{ color: 'var(--blue)' }} />
                <h3 style={{ margin: 0, fontSize: 18 }}>{name}</h3>
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Candidate details and the required follow-up actions.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 10px', borderRadius: 999, background: isRegistered ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.16)', color: isRegistered ? 'var(--green)' : 'var(--orange)', fontSize: 12, fontWeight: 700 }}>
                {isRegistered ? 'Registered' : 'Not Registered'}
              </span>
              <span style={{ padding: '6px 10px', borderRadius: 999, background: isKycVerified ? 'rgba(16, 185, 129, 0.14)' : 'rgba(59, 130, 246, 0.14)', color: isKycVerified ? 'var(--green)' : 'var(--blue)', fontSize: 12, fontWeight: 700 }}>
                {isKycVerified ? 'KYC Verified' : 'KYC Pending'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.88)', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Mobile number</div>
              <div style={{ fontWeight: 600 }}>{mobile}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.88)', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Aadhaar number</div>
              <div style={{ fontWeight: 600 }}>{aadhaar}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.88)', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Registration status</div>
              <div style={{ fontWeight: 600 }}>{registrationStatus}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.88)', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>KYC status</div>
              <div style={{ fontWeight: 600 }}>{kycStatus}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255, 255, 255, 0.88)', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Police verification</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{policeStatus}</div>
              {!isPoliceVerified && policeInfoLink ? (
                <a href={policeInfoLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'underline' }}>
                  Open police info link
                </a>
              ) : null}
            </div>
          </div>

          {(showRegistrationQr || showKycQr) ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 20 }}>
              {showRegistrationQr ? (
                <div
                  onMouseEnter={() => setHoveredQr('registration')}
                  onMouseLeave={() => setHoveredQr(null)}
                  style={{ padding: 14, borderRadius: 14, background: 'rgba(255, 255, 255, 0.92)', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', minWidth: 140, boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)', position: 'relative' }}
                >
                  <FontAwesomeIcon icon={faQrcode} style={{ marginBottom: 8, color: 'var(--blue)' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Registration QR</div>
                  <img src={buildQrUrl(registrationLink)} alt="Registration QR" style={{ width: 96, height: 96, borderRadius: 8 }} />
                  {(hoveredQr === 'registration' || copiedQr === 'registration') ? (
                    <button
                      type="button"
                      onClick={() => handleCopyLink(registrationLink, 'registration')}
                      style={{ position: 'absolute', top: 8, right: 8, border: 'none', borderRadius: 999, padding: '6px 8px', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)', color: '#fff', fontSize: 11 }}
                    >
                      {copiedQr === 'registration' ? 'Copied' : 'Copy link'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {showKycQr ? (
                <div
                  onMouseEnter={() => setHoveredQr('kyc')}
                  onMouseLeave={() => setHoveredQr(null)}
                  style={{ padding: 14, borderRadius: 14, background: 'rgba(255, 255, 255, 0.92)', border: '1px solid rgba(15, 23, 42, 0.08)', textAlign: 'center', minWidth: 140, boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)', position: 'relative' }}
                >
                  <FontAwesomeIcon icon={faQrcode} style={{ marginBottom: 8, color: 'var(--teal)' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>KYC QR</div>
                  <img src={buildQrUrl(kycLink)} alt="KYC QR" style={{ width: 96, height: 96, borderRadius: 8 }} />
                  {(hoveredQr === 'kyc' || copiedQr === 'kyc') ? (
                    <button
                      type="button"
                      onClick={() => handleCopyLink(kycLink, 'kyc')}
                      style={{ position: 'absolute', top: 8, right: 8, border: 'none', borderRadius: 999, padding: '6px 8px', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)', color: '#fff', fontSize: 11 }}
                    >
                      {copiedQr === 'kyc' ? 'Copied' : 'Copy link'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : (
        <Card style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
          <FontAwesomeIcon icon={faUserCircle} size="2x" style={{ marginBottom: 12, opacity: 0.6 }} />
          <div>Search using mobile number or Aadhaar to view the candidate card.</div>
        </Card>
      )}
    </div>
  )
}
