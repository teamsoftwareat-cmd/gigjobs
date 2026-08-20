import { useEffect, useRef, useState } from 'react'
import { useAlert } from '../../context/AlertContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faTimes, faRotateRight } from '@fortawesome/free-solid-svg-icons'

export default function CameraCaptureModal({
  open,
  onClose,
  onCapture
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [rotationOffset, setRotationOffset] = useState(0)
  const [debugInfo, setDebugInfo] = useState(null)
  const [videoRotation, setVideoRotation] = useState(0)
  const [videoMirror, setVideoMirror] = useState(false)
  const { alert } = useAlert()

  useEffect(() => {
    if (!open) return

    startCamera()

    return () => stopCamera()
  }, [open])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.playsInline = true
        videoRef.current.muted = true
        videoRef.current.srcObject = stream
        try { await videoRef.current.play() } catch (e) { /* ignore autoplay errors */ }
        // detect facing mode and set preview transform
        try {
          const track = stream.getVideoTracks && stream.getVideoTracks()[0]
          const settings = track && track.getSettings ? track.getSettings() : {}
          const facing = settings.facingMode || ''
          const mirror = typeof facing === 'string' && facing.toLowerCase().includes('user')
          setVideoMirror(Boolean(mirror))
        } catch (e) {
          setVideoMirror(false)
        }

        // set initial rotation for preview based on screen.orientation
        try {
          const rawAngle = (window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0
          const angle = (typeof rawAngle === 'number') ? ((rawAngle + 360) % 360) : 0
          const correction = (angle === 270) ? 90 : (angle === 90) ? -90 : (angle === 180 ? 180 : 0)
          setVideoRotation(correction)
        } catch (e) {
          setVideoRotation(0)
        }
      }
    } catch (err) {
      alert('Camera permission denied')
    }
  }

  useEffect(() => {
    const onOrientation = () => {
      try {
        const rawAngle = (window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0
        const angle = (typeof rawAngle === 'number') ? ((rawAngle + 360) % 360) : 0
        const correction = (angle === 270) ? 90 : (angle === 90) ? -90 : (angle === 180 ? 180 : 0)
        setVideoRotation(correction)
      } catch (e) {
        setVideoRotation(0)
      }
    }
    window.addEventListener('orientationchange', onOrientation)
    return () => window.removeEventListener('orientationchange', onOrientation)
  }, [])

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject
    if (stream && stream.getTracks) {
      stream.getTracks().forEach((t) => t.stop())
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null } catch {}
    }
  }

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')

    // Detect orientation angle (supports modern and legacy APIs)
    const rawAngle = (window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0
    const angle = (typeof rawAngle === 'number') ? ((rawAngle + 360) % 360) : 0

    // Determine if camera is front-facing (mirror) using track settings
    let mirror = false
    try {
      const stream = video.srcObject
      const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0]
      const settings = track && track.getSettings ? track.getSettings() : {}
      const facing = settings.facingMode || ''
      if (typeof facing === 'string' && facing.toLowerCase().includes('user')) mirror = true
      if (!mirror && track && track.label && /front|user|selfie/i.test(track.label)) mirror = true
    } catch (e) {
      // ignore
    }

    // Prepare debug info for on-screen display and console
    try {
      const stream = video.srcObject
      const track = stream && stream.getVideoTracks && stream.getVideoTracks()[0]
      const settings = track && track.getSettings ? track.getSettings() : {}
      const trackLabel = (track && track.label) || ''
      const facingVal = settings.facingMode || ''
      const screenType = (window.screen && window.screen.orientation && window.screen.orientation.type) || ''
      const rawAngleVal = rawAngle
      const deviceIsLandscape = window.innerWidth > window.innerHeight
      const videoIsLandscape = video.videoWidth > video.videoHeight
      const sw = needsSwap ? video.videoHeight : video.videoWidth
      const sh = needsSwap ? video.videoWidth : video.videoHeight
      const info = {
        rawAngle: rawAngleVal,
        totalAngle,
        rotationOffset,
        autoRotate: ((deviceIsLandscape !== videoIsLandscape) ? ((angle === 270) ? -90 : 90) : 0),
        mirror,
        facing: facingVal,
        trackLabel,
        deviceIsLandscape,
        videoIsLandscape,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        sw,
        sh,
        screenType
      }
      setDebugInfo(info)
      console.debug('CameraCapture debug', info)
    } catch (e) {
      console.debug('CameraCapture debug failed to collect info', e)
    }

    const needsSwap = angle === 90 || angle === 270
    const sw = needsSwap ? video.videoHeight : video.videoWidth
    const sh = needsSwap ? video.videoWidth : video.videoHeight
    canvas.width = sw
    canvas.height = sh

    ctx.save()
    ctx.translate(sw / 2, sh / 2)
    // Apply deterministic correction based on reported screen orientation.
    // For many Android devices: angle 270 => rotated left, 90 => rotated right.
    // Map: 270 (left) -> rotate +90 to upright; 90 (right) -> rotate -90.
    const correction = (angle === 270) ? 90 : (angle === 90) ? -90 : (angle === 180 ? 180 : 0)
    const totalAngle = (rotationOffset + correction + 360) % 360
    const rad = (totalAngle * Math.PI) / 180
    if (rad !== 0) ctx.rotate(rad)
    if (mirror) ctx.scale(-1, 1)

    try {
      ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2, video.videoWidth, video.videoHeight)
    } catch (e) {
      ctx.restore()
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
    }

    ctx.restore()

    const image = canvas.toDataURL('image/png')
    onCapture(image)
    stopCamera()
  }

  if (!open) return null

  const isMobile = window.innerWidth < 768

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        style={{
          width: isMobile ? '100%' : 480,
          height: isMobile ? '100%' : 'auto',
          background: '#fff',
          borderRadius: isMobile ? 0 : 16,
          padding: 16,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* HEADER */}
        <div style={{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          marginBottom:12
        }}>
          <div style={{ fontWeight:600 }}>Capture Photo</div>

            <div style={{ display:'flex', gap:8 }}>
              <button type="button" onClick={() => setRotationOffset((r) => (r + 90) % 360)} style={{ background: 'none', border: 'none', fontSize: 18 }} aria-label="Rotate preview">
                <FontAwesomeIcon icon={faRotateRight} />
              </button>
              <button onClick={onClose} style={{
                background:'none',
                border:'none',
                fontSize:18
              }}>
                <FontAwesomeIcon icon={faTimes}/>
              </button>
            </div>
        </div>

        {/* VIDEO */}
        <video
          ref={videoRef}
          autoPlay
          style={{
            width:'100%',
            borderRadius:12,
            flex:1,
            objectFit:'cover',
            transform: `rotate(${videoRotation}deg) scaleX(${videoMirror ? -1 : 1})`,
            transformOrigin: 'center center'
          }}
        />

        {debugInfo && (
          <div style={{ position: 'absolute', left: 10, top: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 8, borderRadius: 8, fontSize: 12, zIndex: 10000 }}>
            <div>angle: {debugInfo.rawAngle}° (total {debugInfo.totalAngle}°)</div>
            <div>autoRotate: {debugInfo.autoRotate}°</div>
            <div>mirror: {String(debugInfo.mirror)}</div>
            <div>facing: {debugInfo.facing || 'n/a'}</div>
            <div>track: {debugInfo.trackLabel ? debugInfo.trackLabel.slice(0,30) : 'n/a'}</div>
            <div>video: {debugInfo.videoWidth}x{debugInfo.videoHeight}</div>
            <div>canvas: {debugInfo.sw}x{debugInfo.sh}</div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display:'none' }} />

        {/* ACTION */}
        <button
          onClick={capture}
          style={{
            marginTop:12,
            background:'#2563eb',
            color:'#fff',
            padding:'14px',
            borderRadius:10,
            border:'none',
            fontWeight:600,
            width:'100%'
          }}
        >
          <FontAwesomeIcon icon={faCamera}/> Capture
        </button>
      </div>
    </div>
  )
}