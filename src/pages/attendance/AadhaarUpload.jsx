import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faUpload, faFileImage, faSpinner, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons'
import { LoadingOverlay } from '../../components/ui'
import { candidateAPI } from '../../api/axios'
import './AadhaarUpload.css'

const formatAadhaar = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

const maskAadhaar = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
  if (digits.length <= 4) return formatAadhaar(digits)

  const masked = digits
    .split('')
    .map((digit, index) => (index < digits.length - 4 ? 'X' : digit))
    .join('')

  return masked.replace(/(.{4})/g, '$1 ').trim()
}

const getCandidateAadhaar = (details = {}) => {
  return details?.aadhaar_number || details?.aadhaar || details?.aadhar || ''
}

const getCandidateDisplayName = (details = {}) => {
  return details?.candidate_name || details?.name || details?.fullName || details?.full_name || 'Candidate'
}

const getCandidateIdFromDetails = (details = {}) => {
  return details?.candidate_id || details?.candidateId || details?.id || details?._id || ''
}

export default function AadhaarUpload() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const candidateIdParam = useMemo(
    () => searchParams.get('candidate_id') || searchParams.get('candidateid') || searchParams.get('candidateId') || '',
    [searchParams]
  )
  const aadhaarParam = useMemo(
    () => searchParams.get('aadhaar') || searchParams.get('aadhar') || '',
    [searchParams]
  )

  const [candidateDetails, setCandidateDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [frontFile, setFrontFile] = useState(null)
  const [backFile, setBackFile] = useState(null)
  const [frontPreviewUrl, setFrontPreviewUrl] = useState('')
  const [backPreviewUrl, setBackPreviewUrl] = useState('')
  const [submitStatus, setSubmitStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const hasQuery = Boolean(candidateIdParam || aadhaarParam)
  const resolvedCandidateId = useMemo(
    () => candidateIdParam || getCandidateIdFromDetails(candidateDetails) || '',
    [candidateDetails, candidateIdParam]
  )

  useEffect(() => {
    const loadCandidateDetails = async () => {
      if (!hasQuery) {
        setCandidateDetails(null)
        setFetchError('Please open this page with a candidate_id or aadhaar parameter.')
        setLoading(false)
        return
      }

      setLoading(true)
      setFetchError('')
      setCandidateDetails(null)

      try {
        const params = {}
        if (candidateIdParam) params.candidate_id = candidateIdParam
        if (aadhaarParam) params.aadhaar = aadhaarParam

        const response = await candidateAPI.getKYCInfo(params)
        const payload = response?.data?.data ?? response?.data
        setCandidateDetails(payload || null)
      } catch (err) {
        console.error('Failed to load candidate details', err)
        setCandidateDetails(null)
        setFetchError('Unable to load candidate details. Please check the link or try again later.')
      } finally {
        setLoading(false)
      }
    }

    loadCandidateDetails()
  }, [aadhaarParam, candidateIdParam, hasQuery])

  const handleFileChange = (setter) => (event) => {
    const file = event.target.files?.[0]
    setter(file || null)
  }

  const handleUpload = async () => {
    setError('')
    setMessage('')

    if (!resolvedCandidateId) {
      setError('Unable to upload because the candidate identifier is missing.')
      return
    }

    if (!frontFile && !backFile) {
      setError('Please choose Aadhaar front and/or back files before uploading.')
      return
    }

    setSubmitStatus('saving')
    try {
      if (frontFile) {
        await candidateAPI.uploadAadhaarFront(resolvedCandidateId, frontFile)
      }
      if (backFile) {
        await candidateAPI.uploadAadhaarBack(resolvedCandidateId, backFile)
      }

      setMessage('Aadhaar images uploaded successfully.')
      setFrontFile(null)
      setBackFile(null)

      if (resolvedCandidateId) {
        const response = await candidateAPI.getKYCInfo({ candidate_id: resolvedCandidateId })
        const payload = response?.data?.data ?? response?.data
        setCandidateDetails(payload || null)
      }
    } catch (err) {
      console.error('Upload error', err)
      setError('Upload failed. Please try again.')
    } finally {
      setSubmitStatus('idle')
    }
  }

  const cancelUpload = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/attendance')
    }
  }

  const aadhaarNumber = maskAadhaar(getCandidateAadhaar(candidateDetails) || aadhaarParam || '')
  const candidateName = getCandidateDisplayName(candidateDetails)
  const existingFrontUrl = candidateDetails?.aadhaar_front || candidateDetails?.aadhaar_front_image || candidateDetails?.aadhaar_front_url || ''
  const existingBackUrl = candidateDetails?.aadhaar_back || candidateDetails?.aadhaar_back_image || candidateDetails?.aadhaar_back_url || ''

  useEffect(() => {
    if (!frontFile) {
      setFrontPreviewUrl('')
      return undefined
    }

    const url = URL.createObjectURL(frontFile)
    setFrontPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [frontFile])

  useEffect(() => {
    if (!backFile) {
      setBackPreviewUrl('')
      return undefined
    }

    const url = URL.createObjectURL(backFile)
    setBackPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [backFile])

  return (
    <div className="aadhaar-upload-page" style={{flexDirection: 'column'}}>
      <LoadingOverlay active={loading} message="Loading candidate details..." />
      <div className="aadhaar-header">
        <button className="aadhaar-back-button" type="button" onClick={cancelUpload}>
          <FontAwesomeIcon icon={faArrowLeft} /> Back
        </button>
      </div>

      <div className="aadhaar-card">
        <div className="aadhaar-card-header">
          <div>
            <h1>Aadhaar Upload</h1>
            <p>Use this form to upload Aadhaar front and back images for your candidate.</p>
          </div>
        </div>

        {fetchError && <div className="aadhaar-message aadhaar-message-error">{fetchError}</div>}

        {!hasQuery && (
          <div className="aadhaar-empty-state">
            <p>This page requires a <strong>candidate_id</strong> or <strong>aadhaar</strong> parameter in the URL.</p>
            <p>Share a link like <code>/attendance/aadhaar-upload?candidate_id=123&amp;aadhaar=123412341234</code>.</p>
          </div>
        )}

        {hasQuery && !loading && candidateDetails && (
          <div className="aadhaar-candidate-summary">
            <div>
              <div className="aadhaar-summary-label">Candidate</div>
              <div className="aadhaar-summary-value">{candidateName}</div>
            </div>
            <div>
              <div className="aadhaar-summary-label">Mobile</div>
              <div className="aadhaar-summary-value">{candidateDetails.mobile || candidateDetails.phone || candidateDetails.whatsapp || 'Not available'}</div>
            </div>
            <div>
              <div className="aadhaar-summary-label">Email</div>
              <div className="aadhaar-summary-value">{candidateDetails.email || candidateDetails.email_id || 'Not available'}</div>
            </div>
            <div>
              <div className="aadhaar-summary-label">Aadhaar</div>
              <div className="aadhaar-summary-value">{aadhaarNumber || 'Not available'}</div>
            </div>
          </div>
        )}

        <div className="aadhaar-section">
          <div className="aadhaar-upload-row">
            <label className="aadhaar-file-card">
              <span className="aadhaar-file-title">Aadhaar front</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange(setFrontFile)}
              />
              <div className="aadhaar-file-placeholder">
                <FontAwesomeIcon icon={faFileImage} />
                <span>{frontFile ? frontFile.name : 'Choose front side file'}</span>
              </div>
              {frontPreviewUrl && (
                <div className="aadhaar-preview">
                  <img src={frontPreviewUrl} alt="Aadhaar front preview" />
                </div>
              )}
            </label>

            <label className="aadhaar-file-card">
              <span className="aadhaar-file-title">Aadhaar back</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange(setBackFile)}
              />
              <div className="aadhaar-file-placeholder">
                <FontAwesomeIcon icon={faFileImage} />
                <span>{backFile ? backFile.name : 'Choose back side file'}</span>
              </div>
              {backPreviewUrl && (
                <div className="aadhaar-preview">
                  <img src={backPreviewUrl} alt="Aadhaar back preview" />
                </div>
              )}
            </label>
          </div>

          <div className="aadhaar-action-row">
            <button
              type="button"
              className="aadhaar-submit-button"
              onClick={handleUpload}
              disabled={submitStatus === 'saving' || (!frontFile && !backFile) || !resolvedCandidateId}
            >
              {submitStatus === 'saving' ? (
                <><FontAwesomeIcon icon={faSpinner} spin /> Uploading…</>
              ) : (
                <><FontAwesomeIcon icon={faUpload} /> Upload Aadhaar</>
              )}
            </button>
          </div>

          {(message || error) && (
            <div className={`aadhaar-message ${message ? 'aadhaar-message-success' : 'aadhaar-message-error'}`}>
              <FontAwesomeIcon icon={message ? faCheckCircle : faTimesCircle} />
              <span>{message || error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
