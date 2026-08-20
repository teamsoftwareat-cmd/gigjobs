import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes,
  faEye,
  faEyeSlash,
  faSignInAlt
} from '@fortawesome/free-solid-svg-icons'
import './LoginModal.css'
import { useAuth } from '../../context/AuthContext'
import { authAPI } from '../../api/axios'

export default function InternalLoginModal({ onClose }) {
  const navigate = useNavigate()
  const { login, loginAsRecruiterDev } = useAuth()
  const usernameRef = useRef(null)

  const [form, setForm] = useState({
    username: '',
    password: ''
  })
  const [mode, setMode] = useState('login')
  const [resetMobile, setResetMobile] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const isValidMobile = (value) => /^[6-9]\d{9}$/.test(value)

  const handleLogin = async () => {
    if (!form.username || !form.password) {
      setError('Please enter username and password')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const result = await login({ ...form, mode: 'internal' })

      if (result.success) {
        onClose()
        navigate(result.user.homeRoute)
      } else {
        setError(result.error)
      }
    } catch (err) {
      console.log(err)
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const sendResetOtp = async () => {
    if (!isValidMobile(resetMobile)) {
      setError('Enter a valid 10-digit mobile number')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setStatus(null)

      await authAPI.sendInternalForgotPasswordOTP(resetMobile)
      setStatus(`OTP sent to +91 ${resetMobile}. Check your messages.`)
      setMode('forgotVerify')
      setResetOtp('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to send reset code'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const verifyResetOtp = async () => {
    if (resetOtp.trim().length < 4) {
      setError('Enter the OTP sent to your mobile number')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setStatus(null)

      await authAPI.verifyInternalForgotPasswordOTP(resetMobile, resetOtp.trim())
      setStatus('OTP verified. You may now choose a new password.')
      setMode('forgotReset')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to verify OTP'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    if (resetOtp.trim().length < 4) {
      setError('Enter the OTP sent to your mobile number')
      return
    }
    if (!newPassword) {
      setError('Enter a new password')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setStatus(null)

      await authAPI.resetInternalForgotPassword({ mobile: resetMobile, otp: resetOtp.trim(), password: newPassword })
      setStatus('Password successfully reset. Please sign in.')
      setMode('login')
      setForm({ ...form, password: '' })
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to reset password'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const startForgotPassword = () => {
    setError(null)
    setStatus(null)
    setMode('forgotMobile')
    setResetMobile('')
  }

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return

    if (mode === 'login') handleLogin()
    else if (mode === 'forgotMobile') sendResetOtp()
    else if (mode === 'forgotVerify') verifyResetOtp()
    else if (mode === 'forgotReset') resetPassword()
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modern" onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <div className="modal-heading">
            <div className="modal-badge">Internal</div>
            <div>
              <div className="modal-title" style={{color: '#000'}}>Internal Sign in</div>
              <div className="modal-sub" style={{color: '#000'}}>Recruiters, admins and accounts access</div>
            </div>
          </div>

          <button className="modal-close" style={{width: 'fit-content !important'}} onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-note" style={{color: '#000'}}>
            {mode === 'login' && 'Use your assigned internal credentials to access the secure operations dashboard.'}
            {mode === 'forgotMobile' && 'Enter the mobile number associated with your internal account.'}
            {mode === 'forgotReset' && 'Enter the OTP from your mobile and choose a new password.'}
          </div>
          {error && <div className="alert-error">{error}</div>}
          {status && <div className="modal-note" style={{ marginBottom: 12 }}>{status}</div>}

          {mode === 'login' ? (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  ref={usernameRef}
                  className="form-control"
                  placeholder="Enter username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="password-wrap">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />

                  <button
                    type="button"
                    className="password-eye"
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    <FontAwesomeIcon className="password-eye-icon" icon={showPwd ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              <button
                className="btn-primary btn-full"
                onClick={handleLogin}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faSignInAlt} style={{ marginRight: 8 }} />
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              {/* remove later */}
              {loginAsRecruiterDev && (
                <button
                  className="btn btn-outline btn-full"
                  onClick={() => {
                    setLoading(true)
                    const res = loginAsRecruiterDev()
                    if (res?.success) {
                      onClose()
                      navigate(res.user.homeRoute)
                    } else {
                      setError(res?.error || 'Dev login failed')
                    }
                    setLoading(false)
                  }}
                  style={{ marginTop: 8 }}
                >
                  Quick Dev Login (Recruiter)
                </button>
              )}

              <div className="login-footer" onClick={startForgotPassword} style={{ cursor: 'pointer' }}>
                Forgot password?
              </div>
            </>
          ) : mode === 'forgotMobile' ? (
            <>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  ref={usernameRef}
                  className="form-control"
                  placeholder="Enter registered mobile"
                  type="tel"
                  value={resetMobile}
                  onChange={(e) => setResetMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                />
              </div>

              <button
                className="btn-primary btn-full"
                onClick={sendResetOtp}
                disabled={loading}
              >
                {loading ? 'Sending OTP…' : 'Send Reset Code'}
              </button>

              <button
                className="btn btn-outline btn-full"
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setStatus(null)
                }}
                style={{ marginTop: 8 }}
              >
                Back to sign in
              </button>
            </>
          ) : mode === 'forgotVerify' ? (
            <>
              <div className="form-group">
                <label className="form-label">Reset OTP</label>
                <input
                  className="form-control"
                  placeholder="Enter OTP"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                />
              </div>

              <button
                className="btn-primary btn-full"
                onClick={verifyResetOtp}
                disabled={loading}
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>

              <button
                className="btn btn-outline btn-full"
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setStatus(null)
                }}
                style={{ marginTop: 8 }}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Reset OTP</label>
                <input
                  className="form-control"
                  placeholder="Enter OTP"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="password-wrap">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="form-control"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />

                  <button
                    type="button"
                    className="password-eye"
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    <FontAwesomeIcon icon={showPwd ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                className="btn-primary btn-full"
                onClick={resetPassword}
                disabled={loading}
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>

              <button
                className="btn btn-outline btn-full"
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setStatus(null)
                }}
                style={{ marginTop: 8 }}
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
