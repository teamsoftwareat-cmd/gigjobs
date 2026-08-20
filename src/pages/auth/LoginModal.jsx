import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faPaperPlane,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons'
import './LoginModal.css'
import { useAuth } from '../../context/AuthContext'
import { authAPI } from '../../api/axios'

export default function LoginModal({ onClose }) {
  const navigate = useNavigate()
  const { loginWithOtp, loginAsCandidateDev } = useAuth()
  const mobileRef = useRef(null)

  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [stage, setStage] = useState('enterMobile')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [resendTimer, setResendTimer] = useState(0)

  useEffect(() => {
    mobileRef.current?.focus()
  }, [])

  useEffect(() => {
    if (resendTimer <= 0) return undefined
    const timer = setTimeout(() => setResendTimer((prev) => Math.max(prev - 1, 0)), 1000)
    return () => clearTimeout(timer)
  }, [resendTimer])

  const validateMobile = (value) => /^[6-9]\d{9}$/.test(value)

  const handleMobileChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10)
    setMobile(value)
    setError(null)
    setStatus(null)
  }

  const sendOTP = async () => {
    if (!validateMobile(mobile)) {
      setError('Enter a valid 10-digit mobile number')
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      const response = await authAPI.loginCandidateSendOTP(mobile)
      const resendWait = response.data?.data?.resend_available_in || 30
      setResendTimer(resendWait)
      setStage('enterOtp')
      setStatus(`OTP sent to +91 ${mobile}`)
      setOtp(['', '', '', '', '', ''])
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to send OTP'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    const nextValue = value.replace(/\D/g, '').slice(0, 1)
    const nextOtp = [...otp]
    nextOtp[index] = nextValue
    setOtp(nextOtp)
    setError(null)

    if (nextValue && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const verifyOTP = async () => {
    const otpValue = otp.join('')
    if (otpValue.length !== 6) {
      setError('Enter the full 6-digit OTP')
      return
    }

    setVerifying(true)
    setError(null)
    setStatus(null)

    try {
      const result = await loginWithOtp({ mobile, otp: otpValue })
      if (result.success) {
        onClose()
        navigate(result.user.homeRoute)
      } else {
        setError(result.error || 'Invalid OTP')
        setOtp(['', '', '', '', '', ''])
        document.getElementById('otp-0')?.focus()
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong')
    } finally {
      setVerifying(false)
    }
  }

  const resendOTP = () => {
    if (resendTimer > 0) return
    sendOTP()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (stage === 'enterMobile') sendOTP()
      else verifyOTP()
    }
  }

  const resetToMobile = () => {
    setStage('enterMobile')
    setOtp(['', '', '', '', '', ''])
    setError(null)
    setStatus(null)
    setResendTimer(0)
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modern" onKeyDown={handleKeyDown}>
        
        <div className="modal-header">
          <div>
            <div className="modal-title">Candidate Sign in</div>
            <div className="modal-sub">Log in with mobile number and OTP</div>
          </div>

          <button className="modal-close" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="alert-error">{error}</div>}
          {status && <div className="modal-note">{status}</div>}

          {stage === 'enterMobile' ? (
            <>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  ref={mobileRef}
                  className="form-control"
                  type="tel"
                  placeholder="9876543210"
                  value={mobile}
                  onChange={handleMobileChange}
                  maxLength={10}
                />
              </div>

              <button
                className="btn-primary btn-full"
                onClick={sendOTP}
                disabled={loading || mobile.length < 10}
              >
                <FontAwesomeIcon icon={faPaperPlane} style={{ marginRight: 8 }} />
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </button>

              {/* DEV-ONLY: Quick bypass for local candidate testing. Remove before production. */}
              {/* {loginAsCandidateDev && (
                <button
                  className="btn btn-outline btn-full"
                  type="button"
                  onClick={async () => {
                    setLoading(true)
                    const result = loginAsCandidateDev()
                    if (result.success) {
                      onClose()
                      navigate(result.user.homeRoute)
                    } else {
                      setError(result.error || 'Dev login failed')
                    }
                    setLoading(false)
                  }}
                  style={{ marginTop: 8 }}
                >
                  Quick Dev Login (Candidate)
                </button>
              )} */}
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" style={{ textAlign: 'center', display: 'block', marginBottom: '16px' }}>Enter OTP</label>
                <div style={{ display: 'flex', gap: 'clamp(4px, 2vw, 10px)', justifyContent: 'center' }}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className="form-control"
                      style={{ textAlign: 'center', width: 'clamp(38px, 12vw, 48px)', height: 'clamp(48px, 15vw, 56px)', padding: '0', fontSize: '1.25rem', fontWeight: '700', borderRadius: '10px' }}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                <button
                  className="btn-primary btn-full"
                  type="button"
                  onClick={verifyOTP}
                  disabled={verifying || otp.some((digit) => digit === '')}
                >
                  {verifying ? 'Verifying…' : 'Verify OTP'}
                </button>
                <button
                  className="btn btn-outline btn-full"
                  type="button"
                  onClick={resetToMobile}
                  disabled={verifying}
                >
                  <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 8 }} />
                  Change Number
                </button>
              </div>

              <div style={{ marginTop: '14px', fontSize: '12px', color: '#9ca3af' }}>
                {resendTimer > 0 ? (
                  <>Resend OTP in {resendTimer}s</>
                ) : (
                  <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={resendOTP}>
                    Resend OTP
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}