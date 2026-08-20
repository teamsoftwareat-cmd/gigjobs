import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faCheckCircle, faExclamationTriangle, faSun, faMoon } from '@fortawesome/free-solid-svg-icons'
import { LoadingOverlay, Modal } from '../../components/ui'
import { useAlert } from '../../context/AlertContext'
import { useTheme } from '../../context/ThemeContext'
import { candidateAPI } from '../../api/axios'
import './KYCverify.css'

const DIGILOCKER_BASE_URL = import.meta.env.VITE_DIGILOCKER_BASE_URL || 'https://cynosurejobs.net/digilocker'
const DIGILOCKER_SDK_URL = 'https://cdn.jsdelivr.net/gh/surepassio/surepass-digiboost-web-sdk@latest/index.min.js'

const formatAadhaar = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export default function KYCverify() {
  const [searchParams] = useSearchParams()
  const [sdkReady, setSdkReady] = useState(false)
  const [sdkError, setSdkError] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [launchOnModalOpen, setLaunchOnModalOpen] = useState(false)
  const [verificationToken, setVerificationToken] = useState('')
  const [verificationClientId, setVerificationClientId] = useState('')
  const [candidateDetails, setCandidateDetails] = useState(null)
  const [candidateDetailsError, setCandidateDetailsError] = useState('')
  const [loadStatus, setLoadStatus] = useState('loading')
  const { theme, toggleTheme } = useTheme()
  const { alert } = useAlert()
  const containerRef = useRef(null)

  const aadhaarParam = useMemo(() => {
    const value = searchParams.get('aadhar') || searchParams.get('aadhaar') || ''
    return value.trim()
  }, [searchParams])

  const candidateIdParam = useMemo(() => {
    const value = searchParams.get('candidateid') || searchParams.get('candidate_id') || ''
    return value.trim()
  }, [searchParams])

  const getCandidateAadhaar = (details) => {
    return details?.aadhaar_number || details?.aadhaar || details?.aadhar || ''
  }

  const formatFieldLabel = (key) =>
    String(key)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())

  const hiddenDetails = new Set([
    'candidate_id',
    'candidate_name',
    'mobile',
    'aadhaar_number',
    'aadhaar',
    'aadhar',
    'candidate_image',
    'photo',
    'profile_image',
    'image',
    'aadhaar_front',
    'aadhaar_front_image',
    'aadhaar_front_url',
    'aadhaar_back',
    'aadhaar_back_image',
    'aadhaar_back_url',
    'verified_status',
    'verified',
    'employment_status',
    'id'
  ])

  const candidateDetailEntries = Object.entries(candidateDetails || {})
    .filter(([key]) => !hiddenDetails.has(key))
    .map(([key, value]) => ({
      key,
      label: formatFieldLabel(key),
      value:
        value === null || value === undefined
          ? 'Not provided'
          : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
    }))

  const candidateImageUrl = candidateDetails?.candidate_image || candidateDetails?.photo || candidateDetails?.profile_image || candidateDetails?.image || ''
  const aadhaarFrontUrl = candidateDetails?.aadhaar_front || candidateDetails?.aadhaar_front_image || candidateDetails?.aadhaar_front_url || ''
  const aadhaarBackUrl = candidateDetails?.aadhaar_back || candidateDetails?.aadhaar_back_image || candidateDetails?.aadhaar_back_url || ''
  const verifiedStatus = String(candidateDetails?.verified_status || candidateDetails?.verified || '').trim().toLowerCase()
  const isVerified = ['yes', 'true', 'verified', '1'].includes(verifiedStatus)
  const hasCandidateQuery = Boolean(candidateIdParam || aadhaarParam)

  useEffect(() => {
    const loadCandidateDetails = async () => {
      if (!hasCandidateQuery) {
        setCandidateDetails(null)
        setCandidateDetailsError('')
        setLoadStatus('ready')
        return
      }

      setLoadStatus('loading')
      setCandidateDetails(null)
      setCandidateDetailsError('')

      try {
        const params = {}
        if (aadhaarParam) params.aadhaar = aadhaarParam
        if (candidateIdParam) params.candidate_id = candidateIdParam

        const response = await candidateAPI.getKYCInfo(params)
        const payload = response?.data?.data ?? response?.data

        setCandidateDetails(payload)
      } catch (error) {
        console.error('candidate details fetch error', error)
        setCandidateDetailsError(error?.message || 'Failed to fetch candidate details.')
      } finally {
        setLoadStatus('ready')
      }
    }

    loadCandidateDetails()
  }, [aadhaarParam, candidateIdParam, hasCandidateQuery])

  useEffect(() => {
    setLoadStatus('ready')
    if (typeof window === 'undefined') return

    if (window.DigiboostSdk) {
      setSdkReady(true)
      return
    }

    const existingScript = document.querySelector('script[data-digilocker-sdk]')
    if (existingScript) {
      existingScript.addEventListener('load', () => setSdkReady(true))
      existingScript.addEventListener('error', () => setSdkError('Failed to load DigiLocker SDK'))
      return
    }

    const script = document.createElement('script')
    script.src = DIGILOCKER_SDK_URL
    script.async = true
    script.dataset.digilockerSdk = 'true'
    script.onload = () => setSdkReady(true)
    script.onerror = () => {
      setSdkError('Unable to load Surepass DigiLocker SDK. Please check your network.')
      setStatus('error')
    }
    document.body.appendChild(script)

    return () => {
      script.onload = null
      script.onerror = null
    }
  }, [])

  const closeVerifyModal = () => {
    setVerifyModalOpen(false)
    setLaunchOnModalOpen(false)
  }

  const showGlobalToast = (message, icon = '❌', duration = 3000) => {
    if (!message) return
    window.dispatchEvent(new CustomEvent('apiMessage', {
      detail: { type: 'error', icon, message, duration }
    }))
  }

  const clearWidget = () => {
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
  }

  useEffect(() => {
    if (verifyModalOpen && verificationToken && launchOnModalOpen) {
      launchVerification()
    }
  }, [verifyModalOpen, verificationToken, launchOnModalOpen])

  const prepareVerification = async () => {
    if (!sdkReady) {
      await alert('DigiLocker SDK is not ready yet. Please wait a moment.')
      return
    }

    setStatus('initializing')
    setMessage('')
    clearWidget()

    try {
      const payload = {
        ...(aadhaarParam ? { aadhaar: aadhaarParam } : {}),
        ...(candidateIdParam ? { candidate_id: candidateIdParam } : {})
      }

      const response = await fetch(`${DIGILOCKER_BASE_URL}/init.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      let result = null
      try {
        result = await response.json()
      } catch {
        result = null
      }

      const token = result?.data?.token
      const clientId = result?.data?.client_id

      if (!token || !clientId) {
        const debugMessage = result?.message || 'Failed to initialize DigiLocker.'
        throw new Error(debugMessage)
      }

      setVerificationToken(token)
      setVerificationClientId(clientId)
      setLaunchOnModalOpen(true)
      setVerifyModalOpen(true)
      setStatus('ready')
    } catch (error) {
      console.error('prepareVerification error', error)
      setStatus('error')
      setMessage(error?.message || 'Failed to initialize DigiLocker verification.')
    }
  }

  const downloadAadhaarXml = async (clientId) => {
    try {
      const payload = { client_id: clientId }
      if (aadhaarParam) payload.aadhaar = aadhaarParam
      if (candidateIdParam) payload.candidate_id = candidateIdParam

      const response = await fetch(`${DIGILOCKER_BASE_URL}/download_aadhaar.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('download_aadhaar error', error)
      return { success: false, message: 'Failed to process verification response.' }
    }
  }

  const reloadCandidateDetails = async () => {
    if (!hasCandidateQuery) {
      return
    }

    setCandidateDetails(null)
    setCandidateDetailsError('')

    try {
      const params = {}
      if (aadhaarParam) params.aadhaar = aadhaarParam
      if (candidateIdParam) params.candidate_id = candidateIdParam

      const response = await candidateAPI.getKYCInfo(params)
      const payload = response?.data?.data ?? response?.data

      setCandidateDetails(payload)
    } catch (error) {
      console.error('candidate details fetch error', error)
      setCandidateDetailsError(error?.message || 'Failed to fetch candidate details.')
    }
  }

  const launchVerification = async () => {
    if (!sdkReady) {
      await alert('DigiLocker SDK is not ready yet. Please wait a moment.')
      return
    }

    if (!verificationToken || !verificationClientId) {
      await alert('DigiLocker is not initialized yet. Please try again.')
      return
    }

    clearWidget()

    try {
      setLaunchOnModalOpen(false)
      window.DigiboostSdk({
        gateway: 'production',
        token: verificationToken,
        selector: '#digilocker-button',
        style: {
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '14px 22px',
          borderRadius: '10px',
          fontSize: '16px',
          fontWeight: 600,
          width: '100%',
          maxWidth: '360px'
        },
        onSuccess: async () => {
          setStatus('success')
          const result = await downloadAadhaarXml(verificationClientId)

          if (result?.success) {
            setStatus('success')
            setMessage(result?.message || 'Verification successful!')
            setTimeout(() => {
              closeVerifyModal()
              reloadCandidateDetails()
            }, 1500)
          } else {
            const errorMessage = result?.message || 'Verification failed. Please retry.'
            setStatus('failed')
            setMessage(errorMessage)
            closeVerifyModal()
            showGlobalToast(errorMessage)
          }
        },
        onFailure: (error) => {
          const errorMessage = 'Verification failed. Please retry.'
          console.error('DigiLocker failure', error)
          setStatus('failed')
          setMessage(errorMessage)
          closeVerifyModal()
          showGlobalToast(errorMessage)
        }
      })
    } catch (error) {
      console.error('launchVerification error', error)
      setStatus('error')
      setMessage(error?.message || 'Failed to start DigiLocker verification.')
    }
  }

  return (
    <div className="kyc-page">
      <LoadingOverlay active={loadStatus === 'loading'} message="Loading candidate details..." />
      <div className="kyc-shell">
        <div className="kyc-navbar">
          <div className="kyc-navbar-spacer" />
          <button className="kyc-theme-toggle kyc-icon-btn" onClick={toggleTheme} type="button" aria-label="Toggle theme">
            <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
          </button>
        </div>

        <section className="kyc-panel">
          <div className="kyc-panel-copy">
            <span className="kyc-badge">KYC Verification</span>
            <h1>Verify your identity</h1>
            <p>Review your details below and verify your identity using DigiLocker. This is quick and secure.</p>
          </div>
        </section>

        {candidateDetailsError && (
          <div className="kyc-message-error">
            <strong>Error loading details</strong>
            <p>{candidateDetailsError}</p>
          </div>
        )}

        {!hasCandidateQuery && (
          <div className="kyc-card kyc-empty-state">
            <p>Provide a candidate ID or Aadhaar number in the URL to load verification details.</p>
          </div>
        )}

        {candidateDetails && (
          <div className="kyc-card kyc-form-card">
            <div className="kyc-candidate-header">
              <div className="kyc-status-badge">
                <FontAwesomeIcon 
                  icon={isVerified ? faCheckCircle : faExclamationTriangle} 
                  className={`kyc-badge-icon ${isVerified ? 'verified' : 'unverified'}`}
                />
                <span>{isVerified ? 'Verified' : 'Pending verification'}</span>
              </div>
            </div>

            <div className="kyc-candidate-photo">
              {candidateImageUrl ? (
                <img src={candidateImageUrl} alt="Candidate" />
              ) : (
                <div className="kyc-photo-placeholder">No photo</div>
              )}
            </div>

            <div className="kyc-candidate-info">
              {candidateDetails?.candidate_name && (
                <div className="kyc-info-item">
                  <span className="kyc-info-label">Name</span>
                  <span className="kyc-info-value">{candidateDetails.candidate_name}</span>
                </div>
              )}
              <div className="kyc-info-item">
                <span className="kyc-info-label">Aadhaar</span>
                <span className="kyc-info-value">{formatAadhaar(getCandidateAadhaar(candidateDetails) || aadhaarParam || 'Not available')}</span>
              </div>
              {candidateDetails?.mobile && (
                <div className="kyc-info-item">
                  <span className="kyc-info-label">Mobile</span>
                  <span className="kyc-info-value">{candidateDetails.mobile}</span>
                </div>
              )}
            </div>

            <div className="kyc-documents">
              <h3 className="kyc-documents-title">Aadhaar documents</h3>
              <div className="kyc-docs-row">
                <div className="kyc-doc">
                  <span className="kyc-doc-name">Front</span>
                  {aadhaarFrontUrl ? (
                    <img src={aadhaarFrontUrl} alt="Aadhaar front" />
                  ) : (
                    <div className="kyc-doc-placeholder">No image</div>
                  )}
                </div>
                <div className="kyc-doc">
                  <span className="kyc-doc-name">Back</span>
                  {aadhaarBackUrl ? (
                    <img src={aadhaarBackUrl} alt="Aadhaar back" />
                  ) : (
                    <div className="kyc-doc-placeholder">No image</div>
                  )}
                </div>
              </div>
            </div>

            {candidateDetailEntries.length > 0 && (
              <div className="kyc-extra-info">
                <h3 className="kyc-extra-title">Additional information</h3>
                <div className="kyc-extra-list">
                  {candidateDetailEntries.map((field) => (
                    <div key={field.key} className="kyc-extra-item">
                      <span className="kyc-extra-label">{field.label}</span>
                      <span className="kyc-extra-value">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isVerified && (
              <div className="kyc-verification-area">
                <button
                  className="kyc-btn kyc-btn-primary kyc-digilocker-action"
                  onClick={prepareVerification}
                  disabled={!sdkReady || !hasCandidateQuery || status === 'initializing'}
                  type="button"
                >
                  <svg className="kyc-digilocker-logo" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" fill="#0065a0" />
                  <path d="M8 11h8v6H8z" fill="#fff" />
                  <path d="M12 7c1.93 0 3.5 1.57 3.5 3.5V12h-1.5v-1.5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5V12H8.5v-1.5C8.5 8.57 9.57 7 11 7z" fill="#0065a0" />
                </svg>
                  Verify with DigiLocker
                </button>
                {sdkError && <div className="kyc-message-error">{sdkError}</div>}
              </div>
            )}

            {isVerified && (
              <div className="kyc-verified-banner">
                <FontAwesomeIcon icon={faCheckCircle} className="kyc-check-icon" />
                <span>Your identity is verified. No further action is needed.</span>
              </div>
            )}

            {(status !== 'idle' && message) && (
              <div className={`kyc-status-msg kyc-status-${status}`}>
                <FontAwesomeIcon 
                  icon={status === 'success' ? faCheckCircle : status === 'error' || status === 'failed' ? faExclamationTriangle : faSpinner}
                  spin={status === 'initializing'}
                />
                <span>{message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={verifyModalOpen}
        onClose={closeVerifyModal}
        title="Verify with DigiLocker"
        closeOnBackdropClick
        footer={(
          <button type="button" className="btn btn-outline" onClick={closeVerifyModal}>Cancel</button>
        )}
      >
        <div className="kyc-digilocker-modal-body">
          <p className="kyc-modal-description">
            Securely verify the candidate’s Aadhaar details using the DigiLocker verification widget.
            Once the widget launches, follow the DigiLocker flow to complete verification.
          </p>
          <div className="kyc-modal-info-row">
            <div>
              <strong>Candidate</strong>
              <p>{candidateDetails?.candidate_name || 'Unknown'}</p>
            </div>
            <div>
              <strong>Aadhaar</strong>
              <p>{formatAadhaar(getCandidateAadhaar(candidateDetails) || aadhaarParam || 'Not available')}</p>
            </div>
          </div>
          {(status !== 'idle' && message) && (
            <div className={`kyc-status-msg kyc-status-${status}`}>
              <FontAwesomeIcon
                icon={status === 'success' ? faCheckCircle : status === 'error' || status === 'failed' ? faExclamationTriangle : faSpinner}
                spin={status === 'initializing'}
              />
              <span>{message}</span>
            </div>
          )}
          <div id="digilocker-button" ref={containerRef} className="kyc-widget-area" />
        </div>
      </Modal>
    </div>
  )
}
