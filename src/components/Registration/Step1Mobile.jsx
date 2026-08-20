import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, masterDataAPI } from '../../api/axios'
import { LoadingOverlay } from '../ui'
import { step1MobileSchema } from '../../schemas/validations'

const Step1Mobile = ({ isActive, formData, updateFormData, showToast, onNext, setRegistrationId }) => {
  const navigate = useNavigate()
  const [showReferral, setShowReferral] = useState(false)
  const [mobileSent, setMobileSent] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [resendTimer, setResendTimer] = useState(0)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [skipOtp, setSkipOtp] = useState(false)
  const [attempts, setAttempts] = useState(3)
  const [mobileExists, setMobileExists] = useState(false)

  useEffect(() => {
    let interval
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [resendTimer])

  useEffect(() => {
    // Check existence if the number is already there (e.g. restored session)
    if (formData.mobile?.length === 10 && !mobileSent) {
      const check = async () => {
        try {
          const response = await authAPI.checkMobileExists(formData.mobile)
          if (response.data.exists) setMobileExists(true)
        } catch (e) {}
      }
      check()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMobileChange = async (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10)
    updateFormData({ mobile: value })
    setMobileExists(false)

    if (value.length === 10) {
      try {
        const response = await authAPI.checkMobileExists(value)
        if (response.data.exists) {
          setMobileExists(true)
          showToast('ℹ️', 'Mobile number already registered. Please login instead.')
        }
      } catch (error) {
        console.error('Error checking mobile:', error)
      }
    }
  }

  const sendOTP = async () => {
    if (mobileExists) {
      showToast('ℹ️', 'Mobile number already registered. Please sign in.')
      return
    }

    const result = step1MobileSchema.safeParse({
      mobile: formData.mobile,
      referralCode: formData.referralCode,
    })

    if (!result.success) {
      const error = result.error.issues[0]
      showToast('⚠️', error?.message || 'Please enter a valid mobile number')
      return
    }

    setLoading(true)
    try {
      const response = await authAPI.sendMobileOTP(formData.mobile)
      setMobileSent(true)
      setSkipOtp(false)
      setAttempts(3)

      if (response.data.data?.registration_id) {
        setRegistrationId(response.data.data.registration_id)
        updateFormData({ registrationId: response.data.data.registration_id })
      }

      const resendWait = response.data.data?.resend_available_in || 30
      setResendTimer(resendWait)
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to send OTP'
      showToast('❌', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    const newOtp = [...otp]
    newOtp[index] = value.replace(/\D/g, '').slice(0, 1)
    setOtp(newOtp)

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }

    if (index === 5 && newOtp.every((digit) => digit !== '')) {
      setTimeout(() => verifyOTP(newOtp.join('')), 100)
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const verifyOTP = async (providedOtp) => {
    const otpValue = typeof providedOtp === 'string' ? providedOtp : otp.join('')
    if (otpValue.length !== 6) {
      showToast('❌', 'Enter full 6-digit OTP')
      return
    }

    setVerifying(true)
    try {
      const response = await authAPI.verifyMobileOTP(formData.mobile, otpValue)

      updateFormData({
        otpVerified: true,
        registrationId: response.data.data.registration_id,
      })
      setRegistrationId(response.data.data.registration_id)

      if (response.data.data.access_token) {
        localStorage.setItem('access_token', response.data.data.access_token)
        localStorage.setItem('refresh_token', response.data.data.refresh_token)
      }

      onNext()
    } catch (error) {
      const attemptsRemaining = error.response?.data?.data?.attempts_remaining
      setAttempts(attemptsRemaining || attempts - 1)
      showToast('❌', error.response?.data?.message || 'Invalid OTP')

      setOtp(['', '', '', '', '', ''])
      document.getElementById('otp-0')?.focus()

      if (attemptsRemaining === 0 || attempts === 1) {
        showToast('⚠️', 'Too many invalid attempts. Please request a new OTP.')
        setMobileSent(false)
      }
    } finally {
      setVerifying(false)
    }
  }

  const handleSkipOTP = () => {
    setSkipOtp(true)
    showToast('ℹ️', 'You can verify later. Please complete other steps.')
    onNext()
  }

  const validateReferral = async (code) => {
    if (!code || code.length < 5) return false

    try {
      const response = await masterDataAPI.validateReferral(code)
      if (response.data.valid) {
        showToast('✅', `Referral code applied! You'll get ₹${response.data.data?.bonus_amount || 100} bonus!`)
        return true
      } else {
        showToast('⚠️', 'Invalid referral code')
        return false
      }
    } catch (error) {
      showToast('❌', 'Error validating referral code')
      return false
    }
  }

  const handleReferralChange = async (e) => {
    const code = e.target.value.toUpperCase()
    updateFormData({ referralCode: code })
    if (code.length >= 5) {
      await validateReferral(code)
    }
  }

  if (!isActive) return null

  return (
    <div className="reg-step-content active">
      <LoadingOverlay active={loading} message="Sending OTP..." />
      <LoadingOverlay active={verifying} message="Verifying code..." />

      <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>
        📱 Verify Your Mobile
      </div>
      <div style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: '20px' }}>
        We'll send a 6-digit OTP to confirm your number
      </div>

      {!mobileSent ? (
        <div>
          <div className="form-group">
            <label className="form-label">Mobile Number *</label>
            <div className="phone-input-row" style={{ display: 'flex' }}>
              <div className="phone-prefix" style={{ padding: '11px 14px', background: '#F0F4F8', border: '1.5px solid #DDE4EE', borderRight: 'none', borderRadius: '10px 0 0 10px' }}>
                +91
              </div>
              <input
                className="form-control"
                style={{ borderRadius: '0 10px 10px 0' }}
                type="tel"
                placeholder="98765 43210"
                maxLength="10"
                value={formData.mobile}
                onChange={handleMobileChange}
                disabled={loading}
                autoFocus
              />
            </div>
            {mobileExists && (
              <div style={{ color: '#E53935', fontSize: '12.5px', marginTop: '6px', fontWeight: 500 }}>
                <i className="fas fa-exclamation-circle"></i> This number is already registered.{' '}
                <span 
                  onClick={() => navigate('/')} 
                  style={{ textDecoration: 'underline', cursor: 'pointer', color: '#0E7C86' }}
                >
                  Sign in instead
                </span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <div
              className="referral-toggle-link"
              onClick={() => setShowReferral(!showReferral)}
              style={{ fontSize: '12px', textAlign: 'right', cursor: 'pointer', color: '#0E7C86', fontWeight: 500 }}
            >
              <i className={`fas ${showReferral ? 'fa-times-circle' : 'fa-ticket-alt'}`}></i>
              {showReferral ? ' Remove referral code' : ' Have a referral code?'}
            </div>
            {showReferral && (
              <div className="form-group">
                <label className="form-label">Referral Code</label>
                <input
                  className="form-control"
                  placeholder="Enter friend's code — e.g. CY12345"
                  value={formData.referralCode}
                  onChange={handleReferralChange}
                  style={{ textTransform: 'uppercase' }}
                />
                <div style={{ fontSize: '12px', color: '#1B9E5C', marginTop: '5px' }}>
                  <i className="fas fa-gift"></i> Referral bonus: ₹100 after first gig
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={sendOTP}
            disabled={loading || formData.mobile.length < 10 || mobileExists}
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
            {loading ? ' Sending...' : ' Send OTP'}
          </button>

          <div style={{ marginTop: '12px', fontSize: '13px', textAlign: 'center', color: '#4A5568', display: 'none' }}>
            Already have an account?{' '}
            <span
              onClick={() => navigate('/')}
              style={{ cursor: 'pointer', color: '#0E7C86', fontWeight: 600, textDecoration: 'underline' }}
            >
              Sign in
            </span>
          </div>
        </div>
      ) : (
        <div>
          <div className="otp-section" style={{ background: '#E0F5F7', borderRadius: '12px', padding: '20px', textAlign: 'center', marginTop: '12px' }}>
            <div className="otp-sent">
              <i className="fas fa-envelope"></i> OTP sent to +91 {formData.mobile}
            </div>
            <div style={{ color: '#4A5568', fontSize: '12px', marginBottom: '14px', marginTop: '8px' }}>
              Enter the 6-digit code below
            </div>
            <div className="otp-inputs" style={{ display: 'flex', gap: 'clamp(4px, 2vw, 10px)', justifyContent: 'center', margin: '16px 0' }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-${idx}`}
                  type="text"
                  maxLength="1"
                  className="otp-box"
                  style={{
                    width: 'clamp(38px, 12vw, 50px)',
                    height: 'clamp(48px, 15vw, 56px)',
                    border: `2px solid ${verifying ? '#FFB84D' : '#DDE4EE'}`,
                    borderRadius: '12px',
                    textAlign: 'center',
                    fontSize: '22px',
                    fontWeight: 700,
                    background: verifying ? '#FFF3E0' : 'white',
                  }}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  disabled={verifying}
                  autoFocus={idx === 0}
                />
              ))}
            </div>
            {attempts < 3 && attempts > 0 && (
              <div style={{ fontSize: '11px', color: '#E53935', marginBottom: '8px' }}>
                <i className="fas fa-exclamation-triangle"></i> {attempts} attempts remaining
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button style={{display: 'none'}} className="btn btn-secondary btn-sm" onClick={handleSkipOTP} disabled={verifying}>
                Skip OTP
              </button>
              <button className="btn btn-primary btn-sm" onClick={verifyOTP} disabled={verifying || otp.some((digit) => digit === '')}>
                {verifying ? 'Verifying…' : 'Verify OTP'}
              </button>
            </div>

            {resendTimer > 0 ? (
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#8899AA' }}>
                You can resend OTP in {resendTimer}s
              </div>
            ) : (
              <div style={{ marginTop: '12px', fontSize: '12px', color: '#0E7C86', cursor: 'pointer' }} onClick={sendOTP}>
                Resend OTP
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Step1Mobile
