import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun, faShield, faMapPin, faCheckCircle, faUser } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { candidateAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import './policeinfo.css'

const initialForm = {
  nearbyPoliceStation: '',
  nearbyPolicePincode: '',
}

export default function PoliceInfo() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { showAlert } = useAlert()

  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)
  const [kycInfo, setKycInfo] = useState(null)
  const [loadingKyc, setLoadingKyc] = useState(false)

  const candidateIdFromUrl = searchParams.get('candidate_id') || ''
  const registrationIdFromUrl = searchParams.get('registration_id') || searchParams.get('registrationId') || ''

  useEffect(() => {
    // Redirect if no candidate_id is provided
    if (!candidateIdFromUrl) {
      showAlert('Invalid access. Candidate ID is required.', 'error')
      navigate(-1)
      return
    }

    // Fetch KYC info
    const fetchKycInfo = async () => {
      setLoadingKyc(true)
      try {
        const response = await candidateAPI.getKYCInfo({ candidate_id: candidateIdFromUrl })
        if (response && response.data) {
          // API returns { data: { candidate_info } }, so access response.data.data
          const candidateData = response.data.data || response.data
          setKycInfo(candidateData)
        }
      } catch (error) {
        console.error('Error fetching KYC info:', error)
        showAlert('Failed to load candidate information', 'error')
      } finally {
        setLoadingKyc(false)
      }
    }

    fetchKycInfo()
  }, [candidateIdFromUrl, navigate, showAlert])

  const validateForm = () => {
    const newErrors = {}

    if (!form.nearbyPoliceStation.trim()) {
      newErrors.nearbyPoliceStation = 'Police Station is required'
    }

    if (!form.nearbyPolicePincode.trim()) {
      newErrors.nearbyPolicePincode = 'Pincode is required'
    } else if (!/^\d{6}$/.test(form.nearbyPolicePincode.trim())) {
      newErrors.nearbyPolicePincode = 'Pincode must be 6 digits'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        nearby_police_station: form.nearbyPoliceStation.trim(),
        nearby_police_pincode: form.nearbyPolicePincode.trim(),
        candidate_id: candidateIdFromUrl,
        name: kycInfo?.candidate_name,
        aadhaar: kycInfo?.aadhaar_number,
        mobile: kycInfo?.mobile,
        registration_id: registrationIdFromUrl || undefined,
      }

      // Call the new police info API endpoint
      const response = await candidateAPI.submitPoliceInfo(payload)

      if (response && response.data) {
        setSubmittedData(response.data)
        setSubmitted(true)
        setForm(initialForm)
        showAlert('Police information submitted successfully!', 'success')
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to submit police information'
      showAlert(errorMessage, 'error')
      console.error('Error submitting police info:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setForm(initialForm)
    setErrors({})
    setSubmitted(false)
    setSubmittedData(null)
  }

  // Guard: Don't render if no candidate_id
  if (!candidateIdFromUrl) {
    return null
  }

  return (
    <div className={`police-container ${theme}`}>
      <div className="police-wrapper">
        {/* Header */}
        <div className="police-header">
          <h1>Police Station Information</h1>
          <button onClick={toggleTheme} className="police-theme-toggle" title="Toggle theme">
            <FontAwesomeIcon icon={theme === 'light' ? faMoon : faSun} />
          </button>
        </div>

        {submitted && submittedData ? (
          // Success Screen
          <div className="success-screen">
            <div className="success-icon-wrapper">
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
            <h2 className="success-title">Submitted Successfully!</h2>
            <p className="success-subtitle">Your police station information has been recorded.</p>
          </div>
        ) : (
          <>
            {/* KYC Info Card */}
            <div className={`kyc-card ${loadingKyc ? 'loading' : ''}`}>
              {loadingKyc ? (
                <div>Loading your information...</div>
              ) : kycInfo ? (
                <>
                  <div className="kyc-header">
                    <div className="kyc-icon">
                      <FontAwesomeIcon icon={faUser} />
                    </div>
                    <h3>Your Information</h3>
                  </div>
                  <div className="kyc-info-list">
                    <div className="kyc-info-item">
                      <span className="kyc-info-label">Name</span>
                      <span className="kyc-info-value">{kycInfo.candidate_name}</span>
                    </div>
                    <div className="kyc-info-item">
                      <span className="kyc-info-label">Mobile</span>
                      <span className="kyc-info-value">{kycInfo.mobile}</span>
                    </div>
                    <div className="kyc-info-item">
                      <span className="kyc-info-label">Aadhaar</span>
                      <span className="kyc-info-value">{kycInfo.aadhaar_number}</span>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Form Card */}
            <div className="form-card">
              <h2>Police Station Details</h2>
              <form onSubmit={handleSubmit}>
                {/* Nearby Police Station Input */}
                <div className="form-group">
                  <label htmlFor="nearbyPoliceStation" className="form-label">
                    Nearby Police Station
                  </label>
                  <input
                    type="text"
                    id="nearbyPoliceStation"
                    name="nearbyPoliceStation"
                    placeholder="Enter police station name"
                    value={form.nearbyPoliceStation}
                    onChange={handleInputChange}
                    className={`form-input ${errors.nearbyPoliceStation ? 'input-error' : ''}`}
                    disabled={isSubmitting}
                  />
                  {errors.nearbyPoliceStation && (
                    <span className="error-message">{errors.nearbyPoliceStation}</span>
                  )}
                </div>

                {/* Nearby Police Station Pincode Input */}
                <div className="form-group">
                  <label htmlFor="nearbyPolicePincode" className="form-label">
                    Police Station Pincode
                  </label>
                  <input
                    type="text"
                    id="nearbyPolicePincode"
                    name="nearbyPolicePincode"
                    placeholder="Enter 6-digit pincode"
                    value={form.nearbyPolicePincode}
                    onChange={handleInputChange}
                    maxLength="6"
                    className={`form-input ${errors.nearbyPolicePincode ? 'input-error' : ''}`}
                    disabled={isSubmitting}
                    inputMode="numeric"
                  />
                  {errors.nearbyPolicePincode && (
                    <span className="error-message">{errors.nearbyPolicePincode}</span>
                  )}
                  <span className="form-hint">Must be a valid 6-digit postal code</span>
                </div>

                {/* Submit Buttons */}
                <div className="button-group" style={{ width: '100%'}}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ backgroundColor: isSubmitting ? '#ffce49' : '#f97316 ', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Information'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleReset}
                    disabled={isSubmitting}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
