import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, PageHeader } from '../../components/ui'
import { decryptFaceEnrollUserId } from '../../utils/faceEnrollLinkCrypto'

const FINAL_PROFILE_ENDPOINT = 'https://cynosurejobs.net/digilocker/core-team-attendance/assign_employee/get_candidate_face_image.php'

const captureCards = [
  { key: 'front', title: 'Front', caption: 'Facing forward' },
  { key: 'left', title: 'Left side', caption: 'Profile left' },
  { key: 'right', title: 'Right side', caption: 'Profile right' },
]

const styles = `
  .face-enroll-page {
    display: grid;
    gap: 22px;
    padding: 0 0 28px;
  }

  .face-enroll-hero {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(14, 165, 233, 0.06));
    border: 1px solid rgba(59, 130, 246, 0.12);
    border-radius: 20px;
    padding: 18px 18px 0;
  }

  .face-enroll-hero-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .face-enroll-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.1);
    color: var(--primary);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .face-enroll-hero h2 {
    margin: 0;
    font-size: clamp(1.6rem, 2.5vw, 2.4rem);
  }

  .face-enroll-hero p {
    margin: 8px 0 0;
    color: var(--text3);
    line-height: 1.6;
  }

  .face-enroll-form {
    display: grid;
    gap: 22px;
  }

  .face-enroll-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  .face-field {
    display: grid;
    gap: 8px;
  }

  .face-field label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text2);
    text-transform: uppercase;
  }

  .face-field input {
    width: 100%;
    min-height: 52px;
    border: 1px solid var(--border-light);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(255,255,255,0.5), rgba(248,250,252,1));
    color: var(--text1);
    padding: 0 14px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .face-field input:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.75);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
    transform: translateY(-1px);
  }

  .face-field input.invalid {
    border-color: rgba(239, 68, 68, 0.8);
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.08);
  }

  .field-error {
    min-height: 16px;
    margin: 0;
    font-size: 12px;
    color: var(--red);
  }

  .face-capture-box {
    display: grid;
    gap: 16px;
  }

  .capture-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .capture-header h3 {
    margin: 0;
    font-size: 18px;
  }

  .capture-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.08);
    color: var(--primary);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .capture-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .capture-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 200px;
    padding: 16px 12px 12px;
    background: linear-gradient(180deg, rgba(248, 250, 252, 1), rgba(239, 246, 255, 1));
    border: 1px solid var(--border-light);
    border-radius: 20px;
    color: var(--text3);
    cursor: pointer;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }

  .capture-card:hover {
    transform: translateY(-2px);
    border-color: rgba(59, 130, 246, 0.45);
    box-shadow: 0 16px 30px rgba(59, 130, 246, 0.08);
  }

  .capture-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(96,165,250,0.2));
    color: var(--primary);
    font-size: 20px;
    font-weight: 700;
  }

  .capture-card strong {
    color: var(--text1);
    font-size: 13px;
    font-weight: 800;
  }

  .capture-card span {
    font-size: 11px;
    color: var(--text3);
    text-align: center;
  }

  .capture-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(59, 130, 246, 0.08);
    color: var(--primary);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .capture-preview {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 20px;
    display: none;
    z-index: 1;
  }

  .capture-card.has-image .capture-preview {
    display: block;
  }

  .capture-card.has-image .capture-icon,
  .capture-card.has-image strong,
  .capture-card.has-image span,
  .capture-card.has-image .capture-status {
    display: none;
  }

  .face-enroll-action {
    display: flex;
    justify-content: flex-end;
  }

  .face-submit-btn {
    min-width: 186px;
    min-height: 48px;
    font-weight: 800;
  }

  .camera-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 23, 0.9);
    display: flex;
    align-items: stretch;
    justify-content: center;
    z-index: 1000;
  }

  .camera-dialog {
    position: relative;
    width: 100%;
    height: 100%;
    background: #020817;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .camera-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 18px 18px 12px;
    background: linear-gradient(180deg, rgba(2,6,23,0.8), rgba(2,6,23,0));
  }

  .camera-header h3 {
    margin: 0;
    font-size: 18px;
    color: white;
    text-shadow: 0 2px 10px rgba(0,0,0,0.3);
  }

  .camera-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .camera-switch-btn,
  .close-camera-btn {
    border: 0;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    color: white;
    font-weight: 700;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }

  .close-camera-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    padding: 0;
    font-size: 22px;
    line-height: 1;
  }

  .camera-view {
    flex: 1;
    width: 100%;
    overflow: hidden;
    background: #020817;
  }

  .camera-view video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #020817;
  }

  .camera-face-guide {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
    background: repeating-linear-gradient(0deg, transparent 0, transparent 7px, rgba(122, 166, 255, 0.04) 8px);
  }

  .camera-face-frame {
    position: absolute;
    left: 50%;
    top: 46%;
    width: min(70vw, 360px);
    height: min(58vh, 430px);
    transform: translate(-50%, -50%);
    border: 1px solid rgba(146, 190, 255, 0.28);
    box-shadow: 0 0 0 999px rgba(2, 8, 18, 0.1), inset 0 0 24px rgba(87, 145, 255, 0.08);
  }

  .camera-face-frame::before,
  .camera-face-frame::after,
  .camera-face-corner {
    content: '';
    position: absolute;
    width: 44px;
    height: 44px;
    border-color: #92beff;
    border-style: solid;
    filter: drop-shadow(0 0 6px rgba(121, 166, 255, 0.9));
  }

  .camera-face-frame::before {
    top: -1px;
    left: -1px;
    border-width: 3px 0 0 3px;
  }

  .camera-face-frame::after {
    right: -1px;
    bottom: -1px;
    border-width: 0 3px 3px 0;
  }

  .camera-face-corner.top-right {
    top: -1px;
    right: -1px;
    border-width: 3px 3px 0 0;
  }

  .camera-face-corner.bottom-left {
    bottom: -1px;
    left: -1px;
    border-width: 0 0 3px 3px;
  }

  .camera-footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    gap: 12px;
    padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
    background: linear-gradient(0deg, rgba(2,6,23,0.9), rgba(2,6,23,0));
  }

  .camera-footer button {
    flex: 1;
    min-height: 52px;
    border-radius: 14px;
    font-weight: 800;
  }

  .message-box {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
  }

  .message-box.error {
    background: rgba(239, 68, 68, 0.08);
    color: var(--red);
  }

  .message-box.success {
    background: rgba(16, 185, 129, 0.08);
    color: var(--green);
  }

  .face-submit-loader {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(2, 6, 23, 0.68);
    backdrop-filter: blur(5px);
  }

  .face-submit-loader-card {
    width: min(100%, 320px);
    display: grid;
    justify-items: center;
    gap: 12px;
    padding: 24px 20px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    background: rgba(15, 28, 42, 0.96);
    color: white;
    text-align: center;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  }

  .face-submit-loader-spinner {
    width: 42px;
    height: 42px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top-color: #7aa6ff;
    border-radius: 50%;
    animation: face-submit-spin 0.8s linear infinite;
  }

  .face-submit-loader-card strong {
    font-size: 16px;
  }

  .face-submit-loader-card span {
    color: rgba(255, 255, 255, 0.72);
    font-size: 13px;
  }

  @keyframes face-submit-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .success-modal,
  .error-modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.55);
    z-index: 1100;
    padding: 20px;
  }

  .success-dialog,
  .error-dialog {
    width: min(100%, 340px);
    background: rgba(255, 255, 255, 0.98);
    border-radius: 24px;
    padding: 18px 18px 16px;
    box-shadow: 0 25px 60px rgba(15, 23, 42, 0.22);
    text-align: center;
  }

  .success-dialog h3,
  .error-dialog h3 {
    margin: 0 0 8px;
    font-size: 20px;
  }

  .success-dialog p,
  .error-dialog p {
    margin: 0 0 16px;
    color: var(--text3);
    line-height: 1.5;
  }

  .modal-badge {
    width: 62px;
    height: 62px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    margin: 0 auto 14px;
    color: white;
    font-size: 24px;
    font-weight: 800;
  }

  .modal-badge.success {
    background: linear-gradient(135deg, #10b981, #34d399);
  }

  .modal-badge.error {
    background: linear-gradient(135deg, #ef4444, #f87171);
  }

  @media (max-width: 768px) {
    .capture-grid {
      grid-template-columns: 1fr;
    }

    .capture-card {
      min-height: 160px;
    }

    .face-enroll-hero {
      padding: 16px 16px 8px;
    }

    .face-enroll-action {
      justify-content: stretch;
    }

    .face-submit-btn {
      width: 100%;
    }
  }
`

const dataURLToBlob = (dataUrl) => {
  const [header, data] = dataUrl.split(',')
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(data)
  const array = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i)
  }

  return new Blob([array], { type: mime })
}

const getBackendMessages = (responseData) => {
  const messages = []
  const messageKeys = new Set(['error', 'errors', 'message', 'messages'])

  const isMessageKey = (key = '') => {
    const normalized = key.toLowerCase()
    return messageKeys.has(normalized) || normalized.includes('error') || normalized.includes('message')
  }

  const collect = (value, key = '', isMessageContext = false) => {
    if (value === null || value === undefined) return

    if (typeof value === 'string' || typeof value === 'number') {
      if (isMessageContext || isMessageKey(key) || !key) {
        const message = String(value).trim()
        if (message && !messages.includes(message)) messages.push(message)
      }
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collect(item, key, isMessageContext || isMessageKey(key)))
      return
    }

    if (typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => {
        collect(childValue, childKey, isMessageContext || isMessageKey(key))
      })
    }
  }

  collect(responseData)
  return messages
}

export default function FaceEnroll() {
  const [searchParams] = useSearchParams()
  const encryptedUserToken = searchParams.get('token')
  const legacyUserId = searchParams.get('user_id')
  const [userId, setUserId] = useState(legacyUserId || '')

  const [formData, setFormData] = useState({ name: '', mobile: '', role: '' })
  const [errors, setErrors] = useState({ name: '', mobile: '', role: '' })
  const [capturedImages, setCapturedImages] = useState({ front: null, left: null, right: null })
  const [activeCardKey, setActiveCardKey] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraDialogTitle, setCameraDialogTitle] = useState('Capture front face')
  const [preferredFacingMode, setPreferredFacingMode] = useState('user')
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [isErrorOpen, setIsErrorOpen] = useState(false)
  const [errorText, setErrorText] = useState('Please try again.')

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const resolveUserId = async () => {
      if (!encryptedUserToken) return

      try {
        const decryptedUserId = await decryptFaceEnrollUserId(encryptedUserToken)
        if (!cancelled) setUserId(decryptedUserId)
      } catch (error) {
        console.warn('Unable to decrypt face enrollment link:', error)
        if (!cancelled) {
          setErrorText('This face enrollment link is invalid or expired.')
          setIsErrorOpen(true)
        }
      }
    }

    resolveUserId()
    return () => { cancelled = true }
  }, [encryptedUserToken])

  useEffect(() => {
    const preloadUserProfileFromUrl = async () => {
      if (!userId) return

      try {
        const response = await fetch(`https://cynosurejobs.net/digilocker/core-team-attendance/assign_employee/get_employee_details.php?user_id=${encodeURIComponent(userId)}`, {
          credentials: 'same-origin',
        })

        if (!response.ok) return

        const result = await response.json()
        const profile = result?.success && result?.data ? result.data : result?.data || (Array.isArray(result) ? result[0] : null)

        if (!profile) return

        const nameValue = profile.name || profile.full_name || ''
        const mobileValue = profile.mobile || profile.number || profile.phone || ''
        const roleValue = profile.role || profile.job_title || profile.type || ''

        setFormData((current) => ({
          ...current,
          name: nameValue || current.name,
          mobile: mobileValue ? String(mobileValue).replace(/\D/g, '').slice(0, 10) : current.mobile,
          role: roleValue || current.role,
        }))
      } catch (err) {
        console.warn('Unable to preload employee profile.', err)
      }
    }

    preloadUserProfileFromUrl()
  }, [userId])

  const openCamera = async (cardKey) => {
    const label = captureCards.find((card) => card.key === cardKey)?.title || 'Face'
    setActiveCardKey(cardKey)
    setCameraDialogTitle(`Capture ${label} face`)
    setCameraOpen(true)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorText('This browser does not support camera access.')
      setIsErrorOpen(true)
      return
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: preferredFacingMode },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.style.transform = 'scaleX(-1)'
        await videoRef.current.play()
      }
    } catch (err) {
      console.error('Camera access failed:', err)
      setErrorText('Camera access was blocked. Please allow camera permission and try again.')
      setIsErrorOpen(true)
      closeCamera()
    }
  }

  const closeCamera = () => {
    setCameraOpen(false)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const switchCamera = async () => {
    if (!activeCardKey) return
    const nextMode = preferredFacingMode === 'user' ? 'environment' : 'user'
    setPreferredFacingMode(nextMode)
    await openCamera(activeCardKey)
  }

  const captureCurrentFace = async () => {
    if (!activeCardKey || !videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      setErrorText('Please allow camera access and try again.')
      setIsErrorOpen(true)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    const context = canvas.getContext('2d')
    if (context) {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    }

    const dataUrl = canvas.toDataURL('image/png')
    setCapturedImages((current) => ({ ...current, [activeCardKey]: dataUrl }))
    closeCamera()
  }

  const validateForm = () => {
    const nextErrors = { name: '', mobile: '', role: '' }

    if (!formData.name.trim()) nextErrors.name = 'Full name is required.'
    if (!formData.mobile.trim()) nextErrors.mobile = 'Mobile number is required.'
    else if (!/^[6-9]\d{9}$/.test(formData.mobile.trim())) nextErrors.mobile = 'Enter a valid 10-digit Indian mobile number.'
    if (!formData.role.trim()) nextErrors.role = 'Role is required.'

    setErrors(nextErrors)
    return !nextErrors.name && !nextErrors.mobile && !nextErrors.role
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    let safeValue = value

    if (name === 'mobile') {
      safeValue = value.replace(/\D/g, '').slice(0, 10)
    }

    setFormData((current) => ({ ...current, [name]: safeValue }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const saveFaceProfile = async (payload) => {
    const formDataToSend = new FormData()

    formDataToSend.append('name', payload.name || '')
    formDataToSend.append('mobile', payload.mobile || '')
    formDataToSend.append('role', payload.role || '')
    formDataToSend.append('savedAt', payload.savedAt || new Date().toISOString())
    formDataToSend.append('action', 'register')

    if (userId) formDataToSend.append('user_id', userId)

    Object.entries(payload.captures || {}).forEach(([key, imageDataUrl]) => {
      if (!imageDataUrl) return
      const blob = dataURLToBlob(imageDataUrl)
      formDataToSend.append(key, blob, `${key}-capture.png`)
    })

    try {
      const response = await fetch(FINAL_PROFILE_ENDPOINT, {
        method: 'POST',
        body: formDataToSend,
      })

      const responseText = await response.text()
      let result = {}

      try {
        const parsed = responseText ? JSON.parse(responseText) : {}
        result = parsed && typeof parsed === 'object' ? parsed : {}
      } catch (error) {
        result = {}
      }

      const backendMessages = getBackendMessages(result)
      if (responseText && backendMessages.length === 0 && !result.success) {
        backendMessages.push(responseText.trim())
      }

      if (!response.ok) {
        backendMessages.unshift(`Request failed with status ${response.status}.`)
      }

      return {
        ...result,
        success: response.ok && result.success === true,
        errorMessage: backendMessages.join('\n'),
      }
    } catch (err) {
      console.warn('Final profile save failed while reaching the backend.', err)
      return {
        success: false,
        saved: false,
        errorMessage: err.message || 'Unable to reach the final profile endpoint.',
      }
    }
  }

  const resetForm = () => {
    setFormData({ name: '', mobile: '', role: '' })
    setErrors({ name: '', mobile: '', role: '' })
    setCapturedImages({ front: null, left: null, right: null })
    closeCamera()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    const capturedKeys = Object.keys(capturedImages).filter((key) => Boolean(capturedImages[key]))
    if (capturedKeys.length < 3) {
      setStatusMessage({ type: 'error', text: 'Please capture all 3 face images before saving.' })
      return
    }

    setIsSubmitting(true)
    setStatusMessage({ type: '', text: '' })

    try {
      const finalPayload = {
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        role: formData.role.trim(),
        user_id: userId,
        captures: {
          front: capturedImages.front,
          left: capturedImages.left,
          right: capturedImages.right,
        },
        savedAt: new Date().toISOString(),
      }

      const saveResult = await saveFaceProfile(finalPayload)

      if (saveResult && saveResult.success === true) {
        setIsSuccessOpen(true)
        resetForm()
        return
      }

      setErrorText(saveResult.errorMessage || 'The final save did not return success. Please try again.')
      setIsErrorOpen(true)
      setStatusMessage({ type: 'error', text: saveResult.errorMessage || 'The final save did not return success. Please try again.' })
    } catch (err) {
      console.error('Save failed:', err)
      setErrorText('Something went wrong while saving. Please try again.')
      setIsErrorOpen(true)
      setStatusMessage({ type: 'error', text: 'Something went wrong while saving. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <style>{styles}</style>

      <div className="face-enroll-page">
        <div className="face-enroll-hero">
          <div className="face-enroll-hero-row">
            <span className="face-enroll-badge">Secure setup</span>
            <span className="capture-badge">3 images required</span>
          </div>
          <h2>Face Enrollment</h2>
          <p>Add a new team member and capture their front, left, and right face profile for quick daily verification.</p>
        </div>

        <Card style={{ padding: 20 }}>
          <form className="face-enroll-form" onSubmit={handleSubmit} noValidate>
            <div className="face-enroll-fields">
              <div className="face-field">
                <label htmlFor="face-name">Full name</label>
                <input
                  id="face-name"
                  name="name"
                  type="text"
                  className={errors.name ? 'invalid' : ''}
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Aisha Rahman"
                />
                <p className="field-error">{errors.name}</p>
              </div>

              <div className="face-field">
                <label htmlFor="face-mobile">Mobile number</label>
                <input
                  id="face-mobile"
                  name="mobile"
                  type="tel"
                  inputMode="numeric"
                  className={errors.mobile ? 'invalid' : ''}
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                />
                <p className="field-error">{errors.mobile}</p>
              </div>

              <div className="face-field">
                <label htmlFor="face-role">Role</label>
                <input
                  id="face-role"
                  name="role"
                  type="text"
                  className={errors.role ? 'invalid' : ''}
                  value={formData.role}
                  onChange={handleInputChange}
                  placeholder="e.g. Supervisor"
                />
                <p className="field-error">{errors.role}</p>
              </div>
            </div>

            <div className="face-capture-box">
              <div className="capture-header">
                <h3>Face capture</h3>
                <span className="capture-badge">3 required</span>
              </div>

              <div className="capture-grid">
                {captureCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`capture-card ${capturedImages[card.key] ? 'has-image' : ''}`}
                    onClick={() => openCamera(card.key)}
                  >
                    <div className="capture-icon">◉</div>
                    <strong>{card.title}</strong>
                    <span>{card.caption}</span>
                    <span className="capture-status">{capturedImages[card.key] ? 'Captured' : 'Open camera'}</span>
                    {capturedImages[card.key] && <img className="capture-preview" src={capturedImages[card.key]} alt={`${card.title} preview`} />}
                  </button>
                ))}
              </div>
            </div>

            {statusMessage.text && (
              <div className={`message-box ${statusMessage.type === 'error' ? 'error' : 'success'}`}>
                {statusMessage.text}
              </div>
            )}

            <div className="face-enroll-action">
              <button className="btn btn-primary face-submit-btn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save face profile'}
              </button>
            </div>
          </form>
        </Card>
      </div>

      {cameraOpen && (
        <div className="camera-overlay" onClick={(event) => event.target === event.currentTarget && closeCamera()}>
          <div className="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="face-camera-title">
            <div className="camera-header">
              <h3 id="face-camera-title">{cameraDialogTitle}</h3>
              <div className="camera-actions">
                <button type="button" className="camera-switch-btn" onClick={switchCamera}>
                  {preferredFacingMode === 'user' ? 'Switch to rear' : 'Switch to front'}
                </button>
                <button type="button" className="close-camera-btn" onClick={closeCamera} aria-label="Close camera">
                  ×
                </button>
              </div>
            </div>

            <div className="camera-view">
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="camera-face-guide" aria-label="Face positioning guide">
                <div className="camera-face-frame">
                  <span className="camera-face-corner top-right" />
                  <span className="camera-face-corner bottom-left" />
                </div>
              </div>
            </div>

            <div className="camera-footer">
              <button type="button" className="btn btn-outline" onClick={closeCamera}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={captureCurrentFace}>Capture photo</button>
            </div>
          </div>
        </div>
      )}

      {isSuccessOpen && (
        <div className="success-modal" role="dialog" aria-modal="true" aria-labelledby="success-title">
          <div className="success-dialog">
            <div className="modal-badge success">✓</div>
            <h3 id="success-title">Profile saved</h3>
            <p>Face profile has been saved successfully.</p>
            <button type="button" className="btn btn-primary" onClick={() => setIsSuccessOpen(false)}>
              OK
            </button>
          </div>
        </div>
      )}

      {isSubmitting && (
        <div className="face-submit-loader" role="status" aria-live="polite" aria-label="Saving face profile">
          <div className="face-submit-loader-card">
            <div className="face-submit-loader-spinner" aria-hidden="true" />
            <strong>Saving face profile</strong>
            <span>Please wait while the captured images are uploaded.</span>
          </div>
        </div>
      )}

      {isErrorOpen && (
        <div className="error-modal" role="alertdialog" aria-modal="true" aria-labelledby="error-title">
          <div className="error-dialog">
            <div className="modal-badge error">!</div>
            <h3 id="error-title">Something went wrong</h3>
            <p>{errorText}</p>
            <button type="button" className="btn btn-primary" onClick={() => setIsErrorOpen(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  )
}
