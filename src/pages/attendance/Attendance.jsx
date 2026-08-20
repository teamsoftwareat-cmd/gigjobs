import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faCheckCircle, faDoorOpen, faArrowLeft, faUser, faMobileAlt, faIdCard, faMoon, faSun, faHome, faIdBadge, faShare, faDownload, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import CameraCaptureModal from '../../components/ui/CameraCaptureModal'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { candidateAPI, recruiterAPI, DESIGNATION_FALLBACK_OPTIONS } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import './Attendance.css'

const initialForm = {
  name: '',
  aadhaar: '',
  confirmAadhaar: '',
  mobile: ''
}

export default function CandidateAttendance() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const idCardRef = useRef(null)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [cameraOpen, setCameraOpen] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('') // 'success' or 'error'
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [isSharing, setIsSharing] = useState(false)
  const [showAadhaar, setShowAadhaar] = useState(false)
  const [showConfirmAadhaar, setShowConfirmAadhaar] = useState(false)
  const [districtOptions, setDistrictOptions] = useState([])
  const [centreOptions, setCentreOptions] = useState([])
  const [designationOptions, setDesignationOptions] = useState(DESIGNATION_FALLBACK_OPTIONS)
  const [selectedDistrictId, setSelectedDistrictId] = useState('')
  const [selectedCentreId, setSelectedCentreId] = useState('')
  const [designation, setDesignation] = useState('')
  const [groupPhotoMode, setGroupPhotoMode] = useState(false)
  const projectIdFromUrl = searchParams.get('projectId') || searchParams.get('id') || ''
  const candidateIdFromUrl = searchParams.get('candidate_id') || searchParams.get('candidateId') || ''
  const projectTypeFromUrl = searchParams.get('projectType') || searchParams.get('project_type') || ''

  const isProjectAttendance = Boolean(projectIdFromUrl)
  const isWritten = isProjectAttendance && projectTypeFromUrl.toLowerCase() !== 'regular'
  const isGroupPhotoMode = isWritten && groupPhotoMode
  const [linkStatus, setLinkStatus] = useState({ loading: false, checked: false, active: true })
  const [projectName, setProjectName] = useState('')
  const { alert } = useAlert()

  const normalizeProjectActiveFlag = (value) => {
    if (value === undefined || value === null) return null
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1 || value === 2
    const normalized = String(value).trim().toLowerCase()
    if (['active', 'open', 'true', '1', 'enabled', 'ongoing', 'started', 'running'].includes(normalized)) return true
    if (['inactive', 'closed', 'false', '0', 'disabled', 'ended', 'completed', 'finished'].includes(normalized)) return false
    return null
  }

  const isAttendanceLinkActive = (projectData = {}) => {
    const attendanceOpen = projectData.attendance_open ?? projectData.isAttendanceOpen ?? projectData.attendanceOpen ?? projectData.is_attendance_open
    const attendanceActive = normalizeProjectActiveFlag(attendanceOpen)
    if (attendanceActive !== null) return attendanceActive

    const status = projectData.status ?? projectData.project_status ?? projectData.statusName ?? projectData.active ?? projectData.isActive
    const statusActive = normalizeProjectActiveFlag(status)
    if (statusActive !== null) return statusActive

    return true
  }

  const normalizeAadhaar = (value) => String(value || '').replace(/\D/g, '').slice(0, 12)
  const formatAadhaar = (value) => {
    const digits = normalizeAadhaar(value)
    return digits.replace(/(\d{4})(?=\d)/g, '$1-')
  }

  const setField = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value })
    setErrors({ ...errors, [field]: '' })
    if (message) {
      setMessage('')
      setMessageType('')
    }
  }

  const setAadhaarField = (field) => (event) => {
    const formatted = formatAadhaar(event.target.value)
    const nextForm = { ...form, [field]: formatted }
    const nextErrors = { ...errors, [field]: '' }

    if (field === 'aadhaar' && nextForm.confirmAadhaar) {
      if (normalizeAadhaar(nextForm.aadhaar) !== normalizeAadhaar(nextForm.confirmAadhaar)) {
        nextErrors.confirmAadhaar = 'Aadhaar numbers do not match'
      } else {
        nextErrors.confirmAadhaar = ''
      }
    }

    if (field === 'confirmAadhaar' && nextForm.aadhaar) {
      if (normalizeAadhaar(nextForm.aadhaar) !== normalizeAadhaar(nextForm.confirmAadhaar)) {
        nextErrors.confirmAadhaar = 'Aadhaar numbers do not match'
      } else {
        nextErrors.confirmAadhaar = ''
      }
    }

    setForm(nextForm)
    setErrors(nextErrors)
    if (message) {
      setMessage('')
      setMessageType('')
    }
  }

  useEffect(() => {
    const loadDesignations = async () => {
      try {
        const response = await recruiterAPI.getDesignations(projectIdFromUrl)
        const payload = response?.data ?? {}
        const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
        const list = rawList
          .map(item => typeof item === 'string' ? item : (item.name || item.designation || ''))
          .filter(Boolean)
        setDesignationOptions(list.length > 0 ? list : DESIGNATION_FALLBACK_OPTIONS)
      } catch (err) {
        console.warn('Failed to load designations:', err)
        setDesignationOptions(DESIGNATION_FALLBACK_OPTIONS)
      }
    }

    // Load designations for both project-specific and regular attendance.
    loadDesignations()
  }, [projectIdFromUrl])

  useEffect(() => {
    if (!projectIdFromUrl) return

    let cancelled = false
    const checkProjectLinkStatus = async () => {
      setLinkStatus({ loading: true, checked: false, active: true })
      try {
        const response = await recruiterAPI.checkAttendanceLinkStatus(projectIdFromUrl)
        const payload = response?.data
        const active = typeof payload === 'boolean'
          ? payload
          : isAttendanceLinkActive(payload ?? {})
        const name = typeof payload === 'object' && payload !== null
          ? (payload.project_name || payload.projectName || payload.name || '')
          : ''
        if (!cancelled) {
          setLinkStatus({ loading: false, checked: true, active })
          setProjectName(name)
        }
      } catch (err) {
        console.warn('Failed to verify attendance link status:', err)
        if (!cancelled) {
          setLinkStatus({ loading: false, checked: true, active: true })
        }
      }
    }

    checkProjectLinkStatus()
    return () => { cancelled = true }
  }, [projectIdFromUrl])

  useEffect(() => {
    if (!isWritten) return

    const loadDistricts = async () => {
      try {
        const response = await recruiterAPI.getProjectDistricts(projectIdFromUrl)
        const payload = response?.data ?? {}
        const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.districts) ? payload.districts : []
        const list = rawList.map(item => {
          if (item && typeof item === 'object') {
            return {
              id: String(item.id || item.districtId || item.locationId || ''),
              name: String(item.name || item.district || item.location || '')
            }
          }
          return { id: String(item), name: String(item) }
        }).filter(item => item.id)
        setDistrictOptions(list)
      } catch (err) {
        console.warn('Failed to load district suggestions:', err)
        setDistrictOptions([])
      }
    }

    loadDistricts()
  }, [isWritten, projectIdFromUrl])

  useEffect(() => {
    if (!candidateIdFromUrl) return

    const loadCandidate = async () => {
      try {
        const response = await recruiterAPI.getCandidateById(candidateIdFromUrl)
        let payload = response?.data ?? {}
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload)
          } catch {
            payload = {}
          }
        }

        const candidate = payload?.data ?? payload?.candidate ?? payload ?? {}
        const name = candidate.name || candidate.fullName || candidate.candidate_name || candidate.firstName || candidate.first_name || ''
        const aadhaarValue = candidate.aadhaar || candidate.aadhar || candidate.aadhaarNumber || candidate.aadhaar_no || candidate.aadharNumber || ''
        const mobileValue = candidate.mobile || candidate.phone || candidate.contact || candidate.phone_number || ''
        const districtValue = candidate.districtId || candidate.district_id || candidate.district || ''
        const centreValue = candidate.centreId || candidate.centre_id || candidate.centre || ''
        const designationValue = candidate.designation || candidate.role || candidate.designation_name || ''

        setForm((prev) => ({
          ...prev,
          name: name || prev.name,
          aadhaar: aadhaarValue ? formatAadhaar(aadhaarValue) : prev.aadhaar,
          confirmAadhaar: aadhaarValue ? formatAadhaar(aadhaarValue) : prev.confirmAadhaar,
          mobile: mobileValue || prev.mobile,
        }))
        setDesignation(designationValue ? String(designationValue) : '')

        if (districtValue) {
          setSelectedDistrictId(String(districtValue))
        }
        if (centreValue) {
          setSelectedCentreId(String(centreValue))
        }
      } catch (err) {
        console.warn('Failed to autofill candidate details:', err)
      }
    }

    loadCandidate()
  }, [candidateIdFromUrl])

  const handleToggleGroupPhoto = () => {
    setGroupPhotoMode((prevMode) => !prevMode)
    setErrors({})
    setMessage('')
    setMessageType('')
  }

  useEffect(() => {
    if (!isWritten || !selectedDistrictId) {
      setCentreOptions([])
      return
    }

    const loadCentres = async () => {
      try {
        const response = await recruiterAPI.getDistrictCentres(projectIdFromUrl, selectedDistrictId)
        const payload = response?.data ?? {}
        const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.centres) ? payload.centres : []
        const list = rawList.map(item => {
          if (item && typeof item === 'object') {
            return {
              id: String(item.id || item.centreId || ''),
              name: String(item.name || item.centre || '')
            }
          }
          return { id: String(item), name: String(item) }
        }).filter(item => item.id)
        setCentreOptions(list)
      } catch (err) {
        console.warn('Failed to load centre suggestions:', err)
        setCentreOptions([])
      }
    }

    setSelectedCentreId('')
    loadCentres()
  }, [projectIdFromUrl, selectedDistrictId])

  const handleAadhaarFocus = (field) => () => {
    if (field === 'aadhaar') setShowAadhaar(true)
    if (field === 'confirmAadhaar') setShowConfirmAadhaar(true)
  }

  const handleAadhaarBlur = (field) => () => {
    if (field === 'aadhaar') setShowAadhaar(false)
    if (field === 'confirmAadhaar') setShowConfirmAadhaar(false)
  }

  const validate = () => {
    const nextErrors = {}
    if (isGroupPhotoMode) {
      if (!selectedDistrictId) nextErrors.district = 'Please select a district'
      if (!selectedCentreId) nextErrors.centre = 'Please select a centre'
      if (!photo) nextErrors.photo = 'Capture a photo before marking attendance'
    } else {
      if (!form.name.trim()) nextErrors.name = 'Name is required'
      if (!/^[0-9]{12}$/.test(normalizeAadhaar(form.aadhaar))) nextErrors.aadhaar = 'Aadhaar number must be 12 digits'
      if (!/^[0-9]{12}$/.test(normalizeAadhaar(form.confirmAadhaar))) nextErrors.confirmAadhaar = 'Please confirm your Aadhaar number'
      else if (normalizeAadhaar(form.aadhaar) !== normalizeAadhaar(form.confirmAadhaar)) nextErrors.confirmAadhaar = 'Aadhaar numbers do not match'
      if (!/^[0-9]{10}$/.test(form.mobile.trim())) nextErrors.mobile = 'Mobile number must be 10 digits'
      if (!photo) nextErrors.photo = 'Capture a photo before marking attendance'
      if (isProjectAttendance) {
        if (!designation) nextErrors.designation = 'Please select a designation'
        if (isWritten && !selectedDistrictId) nextErrors.district = 'Please select a district'
        if (isWritten && !selectedCentreId) nextErrors.centre = 'Please select a centre'
      }
    }
    setErrors(nextErrors)
    
    if (Object.keys(nextErrors).length > 0) {
      setMessage('Please correct the errors above and try again.')
      setMessageType('error')
    }
    
    return Object.keys(nextErrors).length === 0
  }

  const handleCapture = (imageData) => {
    setPhoto(imageData)
    setCameraOpen(false)
    setMessage('Photo captured successfully.')
    setMessageType('success')
  }

  const handleAttendance = async () => {
    if (!validate()) return
    if (projectIdFromUrl && linkStatus.checked && !linkStatus.active) {
      setMessage('Attendance for this project is closed.')
      setMessageType('error')
      return
    }
    setIsSubmitting(true)

    const timestamp = new Date().toLocaleString('en-IN', {
      hour12: true,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    try {
      // Get geolocation
      let latitude = null
      let longitude = null
      
      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              latitude = position.coords.latitude
              longitude = position.coords.longitude
              resolve()
            },
            () => {
              console.warn('Geolocation permission denied')
              resolve()
            }
          )
        })
      }

      // Get IP and ISP information
      let ipInfo = {}
      try {
        const ipResponse = await fetch('https://ipapi.co/json/')
        if (ipResponse.ok) {
          ipInfo = await ipResponse.json()
        }
      } catch (error) {
        console.warn('Failed to fetch IP information:', error)
      }

      // Collect browser and device information
      const browserInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints,
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        doNotTrack: navigator.doNotTrack,
        webdriver: navigator.webdriver
      }

      // Detect device type based on OS platform (more reliable than user agent)
      const platform = navigator.platform?.toLowerCase() || ''
      const userAgent = navigator.userAgent.toLowerCase()
      
      // Desktop OS detection
      const isWindowsDesktop = platform.includes('win32') || platform.includes('win')
      const isMacDesktop = platform.includes('macintel') || (platform.includes('macppc') && !userAgent.includes('iphone') && !userAgent.includes('ipad'))
      const isLinuxDesktop = platform.includes('linux') && !userAgent.includes('android')
      
      // Mobile/Tablet user agents
      const isMobileUA = /android.*mobile|iphone|ipod|blackberry|iemobile|opera mini|windows phone/i.test(userAgent)
      const isTabletUA = /ipad|android(?!.*mobile)|tablet|playbook|silk/i.test(userAgent)
      
      // Determine device type - platform takes priority
      const deviceType = isWindowsDesktop || isMacDesktop || isLinuxDesktop ? 'desktop' : 
                        isMobileUA ? 'mobile' : 
                        isTabletUA ? 'tablet' : 'desktop'

      // Convert data URL to Blob
      const response = await fetch(photo)
      const blob = await response.blob()

      // Create FormData
      const formData = new FormData()
      if (!isGroupPhotoMode) {
        formData.append('name', form.name)
        formData.append('aadhaar', normalizeAadhaar(form.aadhaar))
        formData.append('mobile', form.mobile)
        if (designation) formData.append('designation', designation)
      }
      if (projectIdFromUrl) formData.append('projectId', projectIdFromUrl)
      if (candidateIdFromUrl) formData.append('candidate_id', candidateIdFromUrl)
      if (selectedDistrictId) formData.append('districtId', selectedDistrictId)
      if (selectedCentreId) formData.append('centreId', selectedCentreId)
      formData.append('timestamp', timestamp)
      formData.append('photo', blob, 'attendance-photo.jpg')
      
      if (latitude !== null && longitude !== null) {
        formData.append('latitude', String(latitude))
        formData.append('longitude', String(longitude))
      }

      // Add IP and ISP information
      if (ipInfo.ip) formData.append('ip_address', ipInfo.ip)
      if (ipInfo.org) formData.append('isp', ipInfo.org)
      if (ipInfo.city) formData.append('city', ipInfo.city)
      if (ipInfo.region) formData.append('region', ipInfo.region)
      if (ipInfo.country_name) formData.append('country', ipInfo.country_name)
      if (ipInfo.asn) formData.append('asn', ipInfo.asn)

      // Add browser and device information
      formData.append('device_type', deviceType)
      formData.append('browser_info', JSON.stringify(browserInfo))

      const apiResponse = isGroupPhotoMode
        ? await candidateAPI.markGroupPhoto(formData)
        : await candidateAPI.markAttendance(formData)
      
      // Extract success message from response
      let successMessage = 'Attendance marked successfully!'
      if (apiResponse && apiResponse.data) {
        if (typeof apiResponse.data === 'object' && apiResponse.data.message) {
          successMessage = apiResponse.data.message
        } else if (typeof apiResponse.data === 'string') {
          successMessage = apiResponse.data
        }
      }
      
      setMessage(successMessage)
      setMessageType('success')
      setSubmitted(true)
      setSubmittedData({
        name: form.name,
        aadhaar: form.aadhaar,
        mobile: form.mobile,
        photo: photo,
        timestamp: timestamp,
        latitude,
        longitude,
        ip: ipInfo.ip,
        isp: ipInfo.org,
        city: ipInfo.city,
        deviceType
      })
      setCurrentStep(2)
    } catch (error) {
      console.error('Attendance submission error:', error)
      
      // Extract error message from response
      let errorMessage = 'Failed to mark attendance. Please try again.'
      
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail
        }
      } else if (error.message) {
        errorMessage = error.message
      }
      
      setMessage(errorMessage)
      setMessageType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Share ID card functionality
  const shareIdCard = async () => {
    if (!idCardRef.current) return

    setIsSharing(true)
    try {
      // Convert HTML to canvas
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(idCardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: true
      })

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          await alert('Failed to generate image')
          setIsSharing(false)
          return
        }

        const file = new File([blob], 'attendance-certificate.png', { type: 'image/png' })

        // Check if Web Share API is supported
        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Attendance ID Card',
              files: [file]
            })
          } catch (error) {
            if (error.name !== 'AbortError') {
              console.error('Share failed:', error)
              // Fallback to download
              downloadImage(canvas)
            }
          }
        } else {
          // Fallback to download
          downloadImage(canvas)
        }
        setIsSharing(false)
      })
    } catch (error) {
      console.error('Failed to share ID card:', error)
      await alert('Failed to share ID card. Please try again.')
      setIsSharing(false)
    }
  }

  const downloadImage = (canvas) => {
    const link = document.createElement('a')
    link.download = 'attendance-certificate.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="attendance-page">
      <div className="attendance-shell">
        <div className="attendance-navbar">
          {/* <button className="attendance-back-btn" onClick={() => navigate('/')}> 
            <FontAwesomeIcon icon={faHome} /> Home
          </button> */}
          {isWritten && (
            <button
              className={`attendance-mode-toggle attendance-icon-btn ${isGroupPhotoMode ? 'active' : ''}`}
              type="button"
              onClick={handleToggleGroupPhoto}
              aria-pressed={isGroupPhotoMode}
              aria-label="Toggle group photo mode"
            >
              Group photo
            </button>
          )}
          <button className="attendance-theme-toggle attendance-icon-btn" onClick={toggleTheme} type="button" aria-label="Toggle theme">
            <FontAwesomeIcon icon={theme === 'dark' ? faSun : faMoon} />
          </button>
        </div>

        <section className="attendance-panel">
          <div className="attendance-panel-copy">
            <span className="attendance-badge">Candidate Attendance</span>
            <h1>{currentStep === 1 ? (projectName ? `Mark attendance instantly — ${projectName}` : 'Mark attendance instantly') : 'Your Attendance ID'}</h1>
            <p>{currentStep === 1
              ? isGroupPhotoMode
                ? 'Select district and centre, capture a group photo, and then use the button below to complete attendance.'
                : 'Enter Aadhaar, mobile number and name, capture a live selfie, and then use the button below to complete attendance. No login needed.'
              : message && message.toLowerCase().includes('check-in') ? 'Your check-in has been recorded. Here is your digital ID card for verification.' :
                message && message.toLowerCase().includes('check-out') ? 'Your check-out has been recorded. Here is your digital ID card for verification.' :
                'Your attendance has been recorded. Here is your digital ID card for verification.'}</p>
          </div>
          {currentStep === 2 && message && <div className={`attendance-message ${messageType === 'error' ? 'error' : ''}`}>{message}</div>}
        </section>

        {currentStep === 1 ? (
          <div className="attendance-card attendance-form-card">
            {isSubmitting && (
              <div className="attendance-loading-overlay">
                <div className="attendance-loading-box">
                  <div className="attendance-spinner" />
                  <div>Marking attendance...</div>
                </div>
              </div>
            )}
            {projectIdFromUrl && linkStatus.checked && !linkStatus.active ? (
              <div className="attendance-closed-panel">
                <div className="attendance-closed-illustration" aria-hidden>
                  <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" focusable="false">
                    <defs>
                      <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0" stopColor="#F4A130" />
                        <stop offset="1" stopColor="#F97316" />
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="120" height="120" rx="16" fill="url(#g1)" opacity="0.12" />
                    <g transform="translate(24,22)">
                      <circle cx="36" cy="22" r="14" fill="#fff" opacity="0.95" />
                      <circle cx="36" cy="22" r="12" fill="#FFEFE0" />
                      <rect x="4" y="52" width="64" height="12" rx="6" fill="#fff" opacity="0.95" />
                      <rect x="48" y="36" width="20" height="18" rx="4" fill="#fff" />
                      <rect x="52" y="40" width="12" height="10" rx="2" fill="#F4A130" />
                      <path d="M20 66c6-6 28-6 34 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.9" />
                    </g>
                  </svg>
                </div>
                <div className="attendance-closed-content">
                  <h3>Attendance closed</h3>
                  <p>Attendance for this project is closed. Candidates cannot submit attendance.</p>
                </div>
              </div>
            ) : (
              <>
                {!isGroupPhotoMode && (
                  <>
                    <div className="attendance-field">
                      <label className="field-label">Full name</label>
                      <div className={`attendance-input-row${errors.name ? ' invalid' : ''}`}>
                        <div className="attendance-input-icon"><FontAwesomeIcon icon={faUser} /></div>
                        <input
                          className="form-control"
                          type="text"
                          value={form.name}
                          onChange={setField('name')}
                          placeholder="Enter full name"
                          autoComplete="name"
                        />
                      </div>
                      {errors.name && <p className="attendance-error">{errors.name}</p>}
                    </div>

                    <div className="attendance-field">
                      <label className="field-label">Aadhaar number</label>
                      <div className={`attendance-input-row${errors.aadhaar ? ' invalid' : ''}`}>
                        <div className="attendance-input-icon"><FontAwesomeIcon icon={faIdCard} /></div>
                        <input
                          className="form-control"
                          type={showAadhaar ? 'text' : 'password'}
                          inputMode="numeric"
                          value={form.aadhaar}
                          onChange={setAadhaarField('aadhaar')}
                          onFocus={handleAadhaarFocus('aadhaar')}
                          onBlur={handleAadhaarBlur('aadhaar')}
                          placeholder="1234-5678-9012"
                          maxLength={14}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="attendance-eye-btn"
                          onClick={() => setShowAadhaar((prev) => !prev)}
                          aria-label={showAadhaar ? 'Hide Aadhaar' : 'Show Aadhaar'}
                        >
                          <FontAwesomeIcon icon={showAadhaar ? faEyeSlash : faEye} />
                        </button>
                      </div>
                      {errors.aadhaar && <p className="attendance-error">{errors.aadhaar}</p>}
                    </div>

                    <div className="attendance-field">
                      <label className="field-label">Confirm Aadhaar number</label>
                      <div className={`attendance-input-row${errors.confirmAadhaar ? ' invalid' : ''}`}>
                        <div className="attendance-input-icon"><FontAwesomeIcon icon={faIdCard} /></div>
                        <input
                          className="form-control"
                          type={showConfirmAadhaar ? 'text' : 'password'}
                          inputMode="numeric"
                          value={form.confirmAadhaar}
                          onChange={setAadhaarField('confirmAadhaar')}
                          onFocus={handleAadhaarFocus('confirmAadhaar')}
                          onBlur={handleAadhaarBlur('confirmAadhaar')}
                          placeholder="1234-5678-9012"
                          maxLength={14}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="attendance-eye-btn"
                          onClick={() => setShowConfirmAadhaar((prev) => !prev)}
                          aria-label={showConfirmAadhaar ? 'Hide confirm Aadhaar' : 'Show confirm Aadhaar'}
                        >
                          <FontAwesomeIcon icon={showConfirmAadhaar ? faEyeSlash : faEye} />
                        </button>
                      </div>
                      {errors.confirmAadhaar && <p className="attendance-error">{errors.confirmAadhaar}</p>}
                    </div>

                    <div className="attendance-field">
                      <label className="field-label">Mobile number</label>
                      <div className={`attendance-input-row${errors.mobile ? ' invalid' : ''}`}>
                        <div className="attendance-input-icon"><FontAwesomeIcon icon={faMobileAlt} /></div>
                        <input
                          className="form-control"
                          type="text"
                          inputMode="tel"
                          value={form.mobile}
                          onChange={setField('mobile')}
                          placeholder="9876543210"
                          maxLength={10}
                          autoComplete="tel"
                        />
                      </div>
                      {errors.mobile && <p className="attendance-error">{errors.mobile}</p>}
                    </div>

                    <div className="attendance-field">
                      <label className="field-label">Designation</label>
                      <select
                        className={`form-control${errors.designation ? ' invalid' : ''}`}
                        value={designation}
                        onChange={(e) => {
                          setDesignation(e.target.value)
                          setErrors((prev) => ({ ...prev, designation: '' }))
                        }}
                      >
                        <option value="">Select designation</option>
                        {designationOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      {errors.designation && <p className="attendance-error">{errors.designation}</p>}
                    </div>
                  </>
                )}

                {isWritten && (
                  <>
                    <div className="attendance-field">
                      <label className="field-label">District</label>
                      <select
                        className={`form-control${errors.district ? ' invalid' : ''}`}
                        value={selectedDistrictId}
                        onChange={(e) => {
                          setSelectedDistrictId(e.target.value)
                          setErrors(prev => ({ ...prev, district: '' }))
                        }}
                      >
                        <option value="">{districtOptions.length ? 'Select district' : 'Loading districts...'}</option>
                        {districtOptions.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                      {errors.district && <p className="attendance-error">{errors.district}</p>}
                    </div>

                    <div className="attendance-field">
                      <label className="field-label">Centre</label>
                      <select
                        className={`form-control${errors.centre ? ' invalid' : ''}`}
                        value={selectedCentreId}
                        onChange={(e) => {
                          setSelectedCentreId(e.target.value)
                          setErrors(prev => ({ ...prev, centre: '' }))
                        }}
                        disabled={!selectedDistrictId || centreOptions.length === 0}
                      >
                        <option value="">{selectedDistrictId ? (centreOptions.length ? 'Select centre' : 'Loading centres...') : 'Select a district first'}</option>
                        {centreOptions.map((option) => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                      {errors.centre && <p className="attendance-error">{errors.centre}</p>}
                    </div>
                  </>
                )}

            <div className="attendance-field">
              <div className="attendance-photo-row">
                <div>
                  <label className="field-label">Live photo</label>
                  <p className="attendance-info">Capture a fresh attendance photo for secure verification.</p>
                </div>
                <button
                  className="attendance-btn attendance-btn-secondary"
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  disabled={projectIdFromUrl && linkStatus.checked && !linkStatus.active}
                >
                  <FontAwesomeIcon icon={faCamera} /> Capture photo
                </button>
              </div>
              {errors.photo && <p className="attendance-error">{errors.photo}</p>}
            </div>

            {photo && (
              <div className="attendance-preview">
                <p className="field-label">Photo preview</p>
                <img src={photo} alt="Attendance capture" />
              </div>
            )}

            {projectIdFromUrl && linkStatus.loading && (
              <div className="attendance-message">Verifying attendance link status…</div>
            )}
            {projectIdFromUrl && linkStatus.checked && !linkStatus.active && (
              <div className="attendance-message error">Attendance for this project is closed.</div>
            )}

            <div className="attendance-actions">
              <button
                className="attendance-btn attendance-btn-primary"
                type="button"
                onClick={handleAttendance}
                disabled={isSubmitting || (projectIdFromUrl && linkStatus.checked && !linkStatus.active)}
              >
                <FontAwesomeIcon icon={faDoorOpen} /> {isSubmitting ? 'Processing...' : 'Mark attendance'}
              </button>
              {message && <div className={`attendance-message ${messageType === 'error' ? 'error' : ''}`}>{message}</div>}
            </div>
            </>
          )}
          </div>
        ) : isGroupPhotoMode ? (
          <div className="attendance-card attendance-form-card">
            <div className="attendance-success-container">
              <div className="attendance-preview">
                <p className="field-label">Group photo submitted</p>
                <img src={submittedData.photo} alt="Group attendance" />
              </div>
              {message && <div className={`attendance-message ${messageType === 'error' ? 'error' : ''}`}>{message}</div>}
            </div>
            <div className="attendance-actions">
              <button className="attendance-btn attendance-btn-secondary" type="button" onClick={() => {
                setCurrentStep(1)
                setMessage('')
                setMessageType('')
                setPhoto(null)
              }}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back to form
              </button>
            </div>
          </div>
        ) : (
          <div className="attendance-certificate-container">
            <div className="professional-id-card" ref={idCardRef}>
              <div className="card-header">
                <div className="brand-name">Cynosure Jobs</div>
                <div className="card-label">ATTENDANCE PASS</div>
              </div>

              <div className="card-body">
                <div className="photo-container">
                  <img src={submittedData.photo} alt="Profile" className="id-photo" />
                </div>

                <h3 className="candidate-name">{submittedData.name}</h3>

                <div className="id-details">
                  <div className="id-detail-row">
                    <span className="label">Aadhaar</span>
                    <span className="value">{submittedData.aadhaar}</span>
                  </div>
                  <div className="id-detail-row">
                    <span className="label">Mobile</span>
                    <span className="value">{submittedData.mobile}</span>
                  </div>
                  <div className="id-detail-row">
                    <span className="label">Time</span>
                    <span className="value">{submittedData.timestamp}</span>
                  </div>
                </div>

                <div className="id-status-badge">
                  {message && message.toLowerCase().includes('check-in') ? '✓ CHECKED IN' : 
                   message && message.toLowerCase().includes('check-out') ? '✓ CHECKED OUT' : 
                   '✓ VERIFIED'}
                </div>
              </div>

              <div className="card-footer">
                <p>This document serves as proof of session attendance.</p>
                <p className="footer-tag">DIGITAL VERIFICATION</p>
              </div>
            </div>

            <div className="attendance-actions attendance-actions-center">
              <button 
                className="attendance-btn attendance-btn-secondary share-mobile-only" 
                type="button" 
                onClick={shareIdCard}
                disabled={isSharing}
              >
                <FontAwesomeIcon icon={faShare} /> {isSharing ? 'Processing...' : 'Share/Download'}
              </button>
              <button className="attendance-btn attendance-btn-secondary" type="button" onClick={() => {
                setCurrentStep(1)
                setMessage('')
                setMessageType('')
              }}>
                <FontAwesomeIcon icon={faArrowLeft} /> Back to form
              </button>
            </div>
          </div>
        )}
      </div>

      <CameraCaptureModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
    </div>
  )
}
