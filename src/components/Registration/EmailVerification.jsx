import React, { useState, useEffect, useRef } from 'react'
import { authAPI } from '../../api/axios'
import { Modal } from '../ui'

const EmailVerification = ({ email, onVerify, showToast, isVerified }) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const inputRefs = useRef([])

  useEffect(() => {
    let interval
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendTimer])

  const isEmailValid = !!email && /.+@.+\..+/.test(email)

  const openModal = () => setModalOpen(true)
  const closeModal = () => setModalOpen(false)

  const sendOTP = async () => {
    if (!isEmailValid) {
      showToast('⚠️', 'Please enter a valid email address first')
      return
    }

    setLoading(true)
    try {
      await authAPI.sendEmailOTP(email)
      setOtpSent(true)
      setOtp(Array(6).fill(''))
      setResendTimer(60)
      setTimeout(() => inputRefs.current[0]?.focus(), 0)
    } catch (error) {
      showToast('❌', error.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    const nextValue = value.replace(/\D/g, '').slice(0, 1)
    const nextOtp = [...otp]
    nextOtp[index] = nextValue
    setOtp(nextOtp)

    if (nextValue && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (index === 5 && nextOtp.every((digit) => digit !== '')) {
      verifyOTP(nextOtp.join(''))
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (event) => {
    const pastedValue = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pastedValue) {
      return
    }

    event.preventDefault()

    const nextOtp = Array(6).fill('')
    pastedValue.split('').forEach((digit, idx) => {
      nextOtp[idx] = digit
    })

    setOtp(nextOtp)
    setTimeout(() => inputRefs.current[Math.min(pastedValue.length, 5)]?.focus(), 0)

    if (pastedValue.length === 6) {
      verifyOTP(nextOtp.join(''))
    }
  }

  const verifyOTP = async (otpValue) => {
    if (!otpValue || otpValue.length < 6) {
      showToast('⚠️', 'Please enter the full 6-digit code')
      return
    }

    setVerifying(true)
    try {
      await authAPI.verifyEmailOTP(email, otpValue)
      onVerify(true)
      setOtpSent(false)
    } catch (error) {
      showToast('❌', 'Invalid OTP. Please try again.')
      setOtp(Array(6).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 0)
    } finally {
      setVerifying(false)
    }
  }

  if (isVerified) {
    return (
      <span className="email-verified-pill">
        <i className="fas fa-check-circle"></i> Verified
      </span>
    )
  }

  const buttonLabel = otpSent ? 'Continue verification' : 'Verify Email'

  return (
    <>
      <div className="email-verify-summary">
        <button
          type="button"
          className="email-verify-inline-button"
          onClick={openModal}
          disabled={!isEmailValid}
        >
          {buttonLabel}
        </button>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-envelope" style={{ color: 'var(--teal)' }}></i>
            Verify your email address
          </div>
        }
        maxWidth="520px"
        footer={
          <div className="email-verify-modal-footer" style={{width: '100%', gap: '12px'}}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{marginTop: '0px'}}
              onClick={() => (otpSent ? verifyOTP(otp.join('')) : sendOTP())}
              disabled={loading || verifying || (!otpSent && !isEmailValid) || (otpSent && otp.some((digit) => !digit))}
            >
              {otpSent ? (verifying ? 'Verifying…' : 'Verify code') : (loading ? 'Sending…' : 'Send code')}
            </button>
          </div>
        }
      >
        <div className="email-verification-modal-body">
          <div className="email-verification-intro">
            <div className="email-verification-icon">
              <i className="fas fa-shield-alt"></i>
            </div>
            <div className="email-verification-top">
              <div className="email-verification-note">
                {otpSent
                  ? `A 6-digit code has been sent to ${email}. Enter it below to verify your email.`
                  : 'Verify your email to unlock faster communication and improve trust with employers.'}
              </div>
            </div>
          </div>

          {otpSent ? (
            <>
              <div className="email-otp-section">
                <div className="email-otp-grid" style={{ display: 'flex', gap: 'clamp(4px, 2vw, 10px)', justifyContent: 'center' }}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => (inputRefs.current[index] = element)}
                      id={`email-otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength="1"
                      className="email-otp-input"
                      style={{ textAlign: 'center', width: 'clamp(38px, 12vw, 48px)', height: 'clamp(48px, 15vw, 56px)', padding: '0', fontSize: '1.25rem', fontWeight: '700', borderRadius: '10px' }}
                      value={digit}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(index, event)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      disabled={verifying}
                    />
                  ))}
                </div>
                <div className="email-verify-actions" style={{ justifyContent: 'space-between', marginTop: '14px' }}>
                  {resendTimer > 0 ? (
                    <span className="email-verify-help">Resend available in {resendTimer}s. Check spam</span>
                  ) : (
                    <button type="button" className="email-verify-link" onClick={sendOTP}>
                      Resend code
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-tertiary btn-sm"
                    onClick={() => {
                      setOtpSent(false)
                      setOtp(Array(6).fill(''))
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="email-verification-note" style={{ marginTop: '18px', textAlign: 'center' }}>
              Please confirm that <strong>{email}</strong> is your active email address. Verification is required to continue.
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

export default EmailVerification