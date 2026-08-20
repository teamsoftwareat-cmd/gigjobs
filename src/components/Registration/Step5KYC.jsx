import React, { useEffect, useRef, useState } from 'react'
import { authAPI } from '../../api/axios'
import { LoadingOverlay, Modal } from '../ui'
import { step5KYCSchema } from '../../schemas/validations'

const isFilled = (value) => String(value || '').trim().length > 0
const digitsOnly = (value) => String(value || '').replace(/\D/g, '')

/**
 * Aggressively compresses an image to ensure it goes through on slow mobile networks.
 * Caps resolution and reduces JPEG quality. This acts as an in-browser compressor to cap payload size.
 */
const compressImage = (fileOrBlob, maxSize = 640, quality = 0.5) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > maxSize || height > maxSize) {
        const scale = maxSize / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
    }
    img.onerror = () => resolve(fileOrBlob) // Fallback if image fails to load
    img.src = URL.createObjectURL(fileOrBlob)
  })
}

const ImageCaptureModal = ({ open, title, error, onClose, onCapture, initialFacingMode = 'environment', isProcessing = false }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraFacingMode, setCameraFacingMode] = useState(initialFacingMode)
  const [availableCameras, setAvailableCameras] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [hasCameraAccess, setHasCameraAccess] = useState(true); // New state to track camera access


  useEffect(() => {
    if (open) {
      setCameraFacingMode(initialFacingMode)
    }
  }, [open, initialFacingMode])

  // Enumerate devices and set initial selectedDeviceId/facingMode
  useEffect(() => {
    if (!open) return

    let mounted = true;
    const initDevices = async () => {
      // Assume access until proven otherwise, will be set to false if enumeration fails
      setHasCameraAccess(true); // Assume access until proven otherwise

      try {
        const mobile = window.innerWidth <= 768
        setIsMobile(mobile)

        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoInputs = devices.filter((device) => device.kind === 'videoinput')
        setAvailableCameras(videoInputs)
        
        let deviceIdToUse = '';
        if (!mobile && videoInputs.length > 0) {
          // For desktop, try to find a 'face' camera or use the first one
          const defaultCam = videoInputs.find(d => d.label.toLowerCase().includes('face')) || videoInputs[0];
          deviceIdToUse = defaultCam.deviceId;
        }
        // For mobile, we'll rely on facingMode, so no specific deviceId initially

        if (!mounted) return; // Component unmounted during async operation

        setSelectedDeviceId(deviceIdToUse); // This will trigger the camera startup useEffect
        // If deviceIdToUse is empty, the other useEffect will use cameraFacingMode
      } catch (error) {
        console.error('Failed to enumerate devices or get camera access:', error);
        if (mounted) {
          setHasCameraAccess(false);
        }
      }
    }

    initDevices();

    // Cleanup function for this effect
    return () => {
      mounted = false;
      // No need to stop camera here, the other useEffect handles it based on `open`
    };
  }, [open]); // Only run when modal opens/closes

  // Handle Camera Start/Stop based on selectedDeviceId/cameraFacingMode
  useEffect(() => {
    if (!open) return undefined; // Only run if modal is open

    let mounted = true;
    const startStream = async () => {
      setIsStarting(true)
      
      // If camera access is denied, don't proceed with starting the stream
      if (!hasCameraAccess) {
        setIsStarting(false);
        return;
      }

      // Stop previous stream if exists
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => track.stop());
        streamRef.current = null
      }

      // Pause video and clear source object immediately
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      // Increased cooldown to allow mobile hardware to release the lens
      // This is crucial for mobile camera switching
      await new Promise(resolve => setTimeout(resolve, 600)); // Increased delay

      try {
        const constraints = {
          audio: false,
          video: {
            ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: cameraFacingMode }),
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.muted = true
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.error("Play error:", e));
          };
        }
        setHasCameraAccess(true); // Confirm access
      } catch (error) {
      console.error('Camera access denied or stream failed:', error);
        if (mounted) {
          setHasCameraAccess(false);
        }
      } finally {
        if (mounted) setIsStarting(false)
      }
    }

    startStream();


    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    };
  }, [open, cameraFacingMode, selectedDeviceId, hasCameraAccess]); // hasCameraAccess is a dependency to re-run when retry is clicked

  if (!open) return null

  const capture = () => {
    const video = videoRef.current 
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Keep the captured image at a higher resolution for better clarity while still avoiding oversized payloads.
    const MAX_SIZE = 800
    let width = video.videoWidth || 1280
    let height = video.videoHeight || 720

    if (width > MAX_SIZE || height > MAX_SIZE) {
      const scale = MAX_SIZE / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Use a higher quality setting so the captured image stays clearer while still being reasonably small.
    canvas.toBlob((blob) => {
      onCapture(blob)
    }, 'image/jpeg', 0.7)
  }

  return (
    <div className="capture-modal-backdrop" style={{ zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12px' }}>
      <div className="capture-modal-card" style={{ maxHeight: '98vh', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '500px', background: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="capture-modal-header">
          <div>
            <div className="capture-modal-title">{title}</div>
            <div className="capture-modal-subtitle">Make sure the image is clear and fully visible.</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
          {error ? (
            <div className="capture-error" style={{ marginBottom: '15px' }}>{error}</div>
          ) : null}

          <div className="camera-select-group" style={{ marginBottom: '15px' }}>
            {isMobile ? (
              <>
                <button
                  type="button"
                  className={`btn btn-primary btn-sm ${cameraFacingMode === 'environment' ? 'btn-active' : ''}`}
                  style={cameraFacingMode === 'environment' ? { background: 'var(--primary)', color: 'black', borderColor: 'var(--primary)', fontWeight: '700', boxShadow: '0 0 0 2px rgba(14, 124, 134, 0.2)' } : {}}
                  onClick={() => {
                    setSelectedDeviceId('')
                    setHasCameraAccess(true); // Reset to allow retry
                    setCameraFacingMode('environment')
                  }}
                  disabled={isStarting}
                >
                  Rear Camera
                </button>
                <button
                  type="button"
                  className={`btn btn-primary btn-sm ${cameraFacingMode === 'user' ? 'btn-active' : ''}`}
                  style={cameraFacingMode === 'user' ? { background: 'var(--primary)', color: 'black', borderColor: 'var(--primary)', fontWeight: '700', boxShadow: '0 0 0 2px rgba(14, 124, 134, 0.2)' } : {}}
                  onClick={() => {
                    setSelectedDeviceId('')
                    setHasCameraAccess(true); // Reset to allow retry
                    setCameraFacingMode('user')
                  }}
                  disabled={isStarting}
                >
                  Front Camera
                </button>
              </>
            ) : (
              <>
                <label htmlFor="camera-device-select" className="camera-device-select-label">
                  Choose camera
                </label>
                <select
                  id="camera-device-select"
                  className="camera-device-select"
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setHasCameraAccess(true); // Reset to allow retry
                    setSelectedDeviceId(e.target.value);
                  }}
                  disabled={isStarting}
                >
                  {availableCameras.length > 0 ? (
                    availableCameras.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))
                  ) : (
                    <option value="">Default camera</option>
                  )}
                </select>
              </>
            )}
          </div>

          {!hasCameraAccess && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, background: 'rgba(0,0,0,0.8)', color: '#fff', textAlign: 'center', padding: '20px' }}>
            <p style={{ marginBottom: '15px' }}>Camera access denied or no camera found. Please ensure camera permissions are granted and a camera is available. If permissions are granted, try again.</p>
            {/* Retry button to re-attempt camera access */}
            <button
              className="btn btn-primary btn-sm"
              style={{ height: 'fit-content !important' }}
              onClick={() => {
                setHasCameraAccess(true); // Setting to true will trigger the useEffect to try starting the stream again
              }}
              disabled={isStarting}
            >
              Start Camera
            </button>
          </div>
        )}
          <div className="capture-video-container" style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px', background: '#000', maxHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isStarting && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                <div className="loader"></div>
              </div>
            )}
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="capture-video" 
              style={{ 
                transform: cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none',
                opacity: isStarting || !hasCameraAccess ? 0.3 : 1
              }}
            />
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fff' }}>
          <button className="btn btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold' }} onClick={capture} disabled={isStarting || isProcessing || !hasCameraAccess}>
            Capture
          </button>
        </div>
      </div>
    </div>
  )
}

const Step5KYC = ({ isActive, formData, updateFormData, onPrev, onSubmit, showToast, isSubmitting = false }) => {
  const [captureField, setCaptureField] = useState(null)
  const [isVerifyingFace, setIsVerifyingFace] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [aadhaarBlurred, setAadhaarBlurred] = useState(false)
  const [imageSizes, setImageSizes] = useState({})
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: '' }); // New state for alert modal

  const handleAadhaarChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
    const groups = digits.match(/.{1,4}/g)
    updateFormData({ aadhaarNumber: groups ? groups.join(' ') : digits })
  }

  const handleAadhaarConfirmChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
    const groups = digits.match(/.{1,4}/g)
    updateFormData({ aadhaarNumberConfirm: groups ? groups.join(' ') : digits })
  }

  const getMaskedAadhaar = (value) => {
    if (!value) return ''
    const digits = value.replace(/\s/g, '')
    if (digits.length < 12) return value
    // Show last 4 digits, mask the rest: XXXX XXXX 1234
    return 'XXXX XXXX ' + digits.slice(-4)
  }

  const handleImageUpload = (field) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isProfilePhoto = field === 'profilePhoto'
    const origMB = (file.size / 1024 / 1024).toFixed(2)
    console.log(`[Upload] Original size for ${field}: ${origMB} MB`)

    const processFile = async () => {
      const fileToUse = isProfilePhoto
        ? await compressImage(file, 720, 0.7)
        : file

      const sizeKB = (fileToUse.size / 1024).toFixed(2)
      setImageSizes(prev => ({ ...prev, [field]: { original: `${origMB} MB`, compressed: `${sizeKB} KB` } }))

      console.log(`[Upload] Processed size for ${field}: ${sizeKB} KB`)

      const previewUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(fileToUse)
      })

      if (isProfilePhoto) {
        setIsVerifyingFace(true)
        try {
          const response = await authAPI.verifyFace(fileToUse)
          if (response.data?.success === false) {
            throw new Error(response.data.message || 'Face verification failed. Please try again.')
          }
          updateFormData({ [field]: previewUrl, faceId: response.data.id })
          setAlertModal({ isOpen: true, title: 'Success', message: `Face verified! (Upload size: ${sizeKB} KB)`, type: 'success' })
        } catch (error) {
          setAlertModal({ isOpen: true, title: 'Verification Failed', message: error.response?.data?.message || error.message || 'Face verification failed. Please try again.', type: 'error' })
          updateFormData({ [field]: '' })
        } finally {
          setIsVerifyingFace(false)
        }
      } else {
        updateFormData({ [field]: previewUrl })
        setAlertModal({ isOpen: true, title: 'Success', message: `Image added! (Final size: ${sizeKB} KB)`, type: 'success' })
      }
    }

    processFile()
  }

  const handleCapture = async (blob) => {
    const currentField = captureField
    if (!currentField) return

    const isProfilePhoto = currentField === 'profilePhoto'
    const fileToUse = isProfilePhoto
      ? await compressImage(blob, 720, 0.7)
      : blob

    const sizeKB = (fileToUse.size / 1024).toFixed(2)
    setImageSizes(prev => ({ ...prev, [currentField]: { original: 'Camera', compressed: `${sizeKB} KB` } }))
    console.log(`[Capture] Processed image size for ${currentField}: ${sizeKB} KB`)

    const previewUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(fileToUse)
    })

    if (isProfilePhoto) {
      setCaptureError('')
      setIsVerifyingFace(true)
      try {
        const response = await authAPI.verifyFace(fileToUse)
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Face verification failed. Please try again.')
        }
        updateFormData({ [currentField]: previewUrl, faceId: response.data.id })
        setAlertModal({ isOpen: true, title: 'Success', message: `Face verified! (Upload size: ${sizeKB} KB)`, type: 'success' })
        setCaptureError('')
        setCaptureField(null)
      } catch (error) {
        const message = error.response?.data?.message || error.message || 'Face verification failed. Please try again.'
        setAlertModal({ isOpen: true, title: 'Verification Failed', message: message, type: 'error' })
        setCaptureError(message)
      } finally {
        setIsVerifyingFace(false)
      }
    } else {
      updateFormData({ [currentField]: previewUrl })
      setAlertModal({ isOpen: true, title: 'Success', message: `Image captured! (Size: ${sizeKB} KB)`, type: 'success' })
      setCaptureField(null)
    }
  }

  const clearImage = (field) => {
    const updates = { [field]: '' }
    if (field === 'profilePhoto') {
      updates.faceId = ''
    }
    updateFormData(updates)
    setImageSizes(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setAlertModal({ isOpen: true, title: 'Image Cleared', message: 'Image removed successfully.', type: 'info' });
  }

  const validateAndSubmit = () => {
    if (isSubmitting) return

    const aadhaarDigits = digitsOnly(formData.aadhaarNumber)
    const aadhaarConfirmDigits = digitsOnly(formData.aadhaarNumberConfirm)

    if (aadhaarDigits !== aadhaarConfirmDigits) {
      setAlertModal({ isOpen: true, title: 'Validation Error', message: 'Aadhaar numbers do not match. Please re-enter your Aadhaar.', type: 'error' });
      return
    }

    const result = step5KYCSchema.safeParse({
      aadhaarNumber: aadhaarDigits,
      aadhaarNumberConfirm: aadhaarConfirmDigits,
      panNumber: String(formData.panNumber || '').trim().toUpperCase(),
      bankAccount: formData.bankAccount,
      ifscCode: String(formData.ifscCode || '').trim().toUpperCase(),
      bankName: formData.bankName,
      accountHolderName: formData.accountHolderName,
      profilePhoto: formData.profilePhoto,
      aadhaarFront: formData.aadhaarFront,
      aadhaarBack: formData.aadhaarBack,
    })

    if (!result.success) {
      const error = result.error.issues[0]
      setAlertModal({ isOpen: true, title: 'Validation Error', message: error?.message || 'Please fix the highlighted fields', type: 'error' });
      return
    }

    onSubmit()
  }

  const renderImageCard = (field, title, helper, allowUpload = true) => {
    const src = formData[field]
    const isProfile = field === 'profilePhoto'
    const sizes = imageSizes[field]
    const isComplete = Boolean(src)
    const isVerifying = isVerifyingFace && isProfile

    return (
      <div className="kyc-image-card">
        <div className="kyc-image-head">
          <div>
            <div className="kyc-image-title">{title}</div>
            <div className="kyc-image-helper">{helper}</div>
          </div>
          {isComplete ? (
            <span className="tag tag-green">✓ Completed</span>
          ) : (
            <span className="tag tag-yellow">Required</span>
          )}
        </div>

        <div className="kyc-preview" style={{ position: 'relative' }}>
          {isVerifying ? (
            <div className="kyc-preview-empty">
              <div className="loader"></div>
              <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--teal)' }}>Verifying face...</p>
            </div>
          ) : src ? (
            <>
              <img src={src} alt={title} className="kyc-preview-img" />
              <div className="kyc-success-badge">✓ Saved</div>
              {sizes && (
                <div style={{ 
                  position: 'absolute', 
                  bottom: '8px', 
                  left: '8px', 
                  right: '8px',
                  background: 'rgba(14, 124, 134, 0.9)', 
                  color: 'white', 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  fontSize: '10px',
                  fontWeight: '600',
                  display: 'flex',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {sizes.original !== 'Camera' && <span>Orig: {sizes.original}</span>}
                  <span>Sent: {sizes.compressed}</span>
                </div>
              )}
            </>
          ) : (
            <div className="kyc-preview-empty">
              {isProfile ? 'Use your camera to capture a sharp face photo.' : 'No image added yet'}
            </div>
          )}
        </div>

        <div className="kyc-action-row">
          {allowUpload ? (
            <label className={`btn btn-secondary btn-sm kyc-upload-btn ${isVerifying ? 'disabled' : ''}`}>
              Upload
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload(field)}
                style={{ display: 'none' }}
                disabled={isVerifying}
              />
            </label>
          ) : (
            <button className="btn btn-tertiary btn-sm" type="button" disabled style={{ cursor: 'not-allowed', opacity: 0.75 }}>
              Capture only
            </button>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCaptureError('')
              setCaptureField(field)
            }}
            type="button"
            disabled={isVerifying}
          >
            {isProfile ? 'Capture Photo' : 'Capture'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => clearImage(field)} type="button" disabled={!src || isVerifying}>
            Clear
          </button>
        </div>
      </div>
    )
  }

  if (!isActive) return null

  return (
    <div className="reg-step-content active">
      <LoadingOverlay active={isVerifyingFace} message="Verifying face identity..." />

      <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>
        🔒 KYC Details
      </div>
      <div style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: '20px' }}>
        Add your Aadhaar, PAN and bank details to complete registration
      </div>

      <div className="kyc-info" style={{ background: '#EFF6FF', borderRadius: '16px', padding: '18px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <i className="fas fa-id-card" style={{ fontSize: '24px', color: '#0E7C86' }}></i>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Capture your face and Aadhaar documents</div>
            <div style={{ fontSize: '13px', color: '#4A5568' }}>Profile photo must be captured via camera. Aadhaar front/back can be captured or uploaded.</div>
          </div>
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#1A2740' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Quick tips for a successful capture</p>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '6px' }}>
            <li>Hold the document flat and steady</li>
            <li>Use good lighting and avoid glare</li>
            <li>Make sure all edges and text are clear</li>
          </ul>
        </div>
      </div>

      <div className="kyc-image-grid">
        {renderImageCard('profilePhoto', 'Your Photo', 'A clear face photo from camera only', false)}
        {renderImageCard('aadhaarFront', 'Aadhaar Front', 'Front side of Aadhaar card')}
        {renderImageCard('aadhaarBack', 'Aadhaar Back', 'Back side of Aadhaar card')}
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Aadhaar Number *</label>
          <input
            className="form-control"
            placeholder="XXXX XXXX XXXX"
            value={aadhaarBlurred ? getMaskedAadhaar(formData.aadhaarNumber) : (formData.aadhaarNumber || '')}
            onChange={handleAadhaarChange}
            onBlur={() => setAadhaarBlurred(true)}
            onFocus={() => setAadhaarBlurred(false)}
            maxLength="14"
            readOnly={aadhaarBlurred}
          />
          <div style={{ fontSize: '12px', color: '#8899AA', marginTop: '5px' }}>
            Enter your 12-digit Aadhaar number. It will be masked after you move to the next field.
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Confirm Aadhaar Number *</label>
          <input
            className="form-control"
            placeholder="XXXX XXXX XXXX"
            value={formData.aadhaarNumberConfirm || ''}
            onChange={handleAadhaarConfirmChange}
            maxLength="14"
          />
          <div style={{ fontSize: '12px', color: '#8899AA', marginTop: '5px' }}>
            Re-enter your 12-digit Aadhaar number to confirm
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">PAN Number (Optional)</label>
          <input
            className="form-control"
            placeholder="ABCDE1234F"
            value={formData.panNumber || ''}
            onChange={(e) => updateFormData({ panNumber: e.target.value.toUpperCase() })}
            maxLength="10"
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <div style={{ color: 'var(--text3)', fontSize: '12.5px' }}>
            PAN and bank details are optional. If you add bank information, please complete all fields.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Bank Account Number</label>
          <input
            className="form-control"
            placeholder="Enter bank account number"
            value={formData.bankAccount || ''}
            onChange={(e) => updateFormData({ bankAccount: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">IFSC Code</label>
          <input
            className="form-control"
            placeholder="IFSC code"
            value={formData.ifscCode || ''}
            onChange={(e) => updateFormData({ ifscCode: e.target.value.toUpperCase() })}
            maxLength="11"
            style={{ textTransform: 'uppercase' }}
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Account Holder Name</label>
          <input
            className="form-control"
            placeholder="Account holder name"
            value={formData.accountHolderName || ''}
            onChange={(e) => updateFormData({ accountHolderName: e.target.value })}
          />
        </div>
      </div>

      <div className="action-row">
        <button className="btn btn-secondary btn-sm" onClick={onPrev}>
          Back
        </button>
        <button className="btn btn-primary btn-sm" onClick={validateAndSubmit} disabled={isVerifyingFace || isSubmitting}>
          {isSubmitting ? 'Submitting...' : isVerifyingFace ? 'Verifying Face...' : 'Complete Registration'}
        </button>
      </div>

      <ImageCaptureModal
        open={Boolean(captureField)}
        title={
          captureField === 'profilePhoto'
            ? 'Capture Your Photo'
            : captureField === 'aadhaarFront'
            ? 'Capture Aadhaar Front'
            : 'Capture Aadhaar Back'
        }
        initialFacingMode={captureField === 'profilePhoto' ? 'user' : 'environment'}
        isProcessing={isVerifyingFace}
        error={captureError}
        onClose={() => {
          setCaptureError('')
          setCaptureField(null)
        }}
        onCapture={handleCapture}
      />

      {/* Alert Modal */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        maxWidth="400px"
        footer={
          <button className="btn btn-primary" onClick={() => setAlertModal({ ...alertModal, isOpen: false })}>
            OK
          </button>
        }
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          {alertModal.type === 'success' && <i className="fas fa-check-circle" style={{ color: 'var(--green)', fontSize: '48px', marginBottom: '15px' }}></i>}
          {alertModal.type === 'error' && <i className="fas fa-times-circle" style={{ color: 'var(--red)', fontSize: '48px', marginBottom: '15px' }}></i>}
          {alertModal.type === 'info' && <i className="fas fa-info-circle" style={{ color: 'var(--blue)', fontSize: '48px', marginBottom: '15px' }}></i>}
          <p style={{ fontSize: '16px', color: 'var(--text1)' }}>{alertModal.message}</p>
        </div>
      </Modal>
    </div>
  )
}

export default Step5KYC