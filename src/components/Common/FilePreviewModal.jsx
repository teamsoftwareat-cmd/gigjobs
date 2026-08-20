import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui'

export default function FilePreviewModal({ files = [], open = false, initialIndex = 0, onClose = () => {} }) {
  const [index, setIndex] = useState(initialIndex || 0)
  const touchStartX = useRef(null)
  const touchDeltaX = useRef(0)

  useEffect(() => {
    setIndex(initialIndex || 0)
  }, [initialIndex, open])

  const urls = useMemo(() => files.map((f) => ({ file: f, url: typeof f === 'string' ? f : URL.createObjectURL(f) })), [files])

  useEffect(() => {
    return () => {
      urls.forEach((u) => {
        if (u.url && typeof u.url === 'string' && u.url.startsWith('blob:')) URL.revokeObjectURL(u.url)
      })
    }
  }, [urls])

  if (!open) return null

  if (!files || files.length === 0) return null

  const current = urls[index]
  const isImage = current.file && current.file.type && current.file.type.startsWith('image/')
  const isPdf = (current.file && current.file.type === 'application/pdf') || (typeof current.url === 'string' && current.url.match(/\.pdf(\?|$)/i))

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches?.[0]?.clientX || null
    touchDeltaX.current = 0
  }

  const handleTouchMove = (e) => {
    if (touchStartX.current == null) return
    const x = e.touches?.[0]?.clientX || 0
    touchDeltaX.current = x - touchStartX.current
  }

  const handleTouchEnd = () => {
    const delta = touchDeltaX.current
    const threshold = 50
    if (delta > threshold) {
      prev()
    } else if (delta < -threshold) {
      next()
    }
    touchStartX.current = null
    touchDeltaX.current = 0
  }

  const prev = () => setIndex((i) => (i - 1 + files.length) % files.length)
  const next = () => setIndex((i) => (i + 1) % files.length)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '90%', maxWidth: 1000, background: '#fff', borderRadius: 6, padding: 16, maxHeight: '90%', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{current.file.name}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant="secondary" onClick={prev}>Prev</Button>
            <Button type="button" variant="secondary" onClick={next}>Next</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>

        <div
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isImage ? (
            <img src={current.url} alt={current.file.name} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
          ) : isPdf ? (
            // use iframe as it tends to embed more consistently across browsers
            <iframe src={current.url} title={current.file.name} style={{ width: '100%', height: '70vh', border: 0 }} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{current.file.name}</div>
              <div style={{ marginTop: 8 }}><a href={current.url} target="_blank" rel="noreferrer">Download</a></div>
            </div>
          )}
        </div>

        {files.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
            {urls.map((u, i) => (
              <button key={i} onClick={() => setIndex(i)} style={{ border: i === index ? '2px solid var(--brand)' : '1px solid #ddd', padding: 2, background: '#fff' }}>
                {u.file.type && u.file.type.startsWith('image/') ? (
                  <img src={u.url} alt={u.file.name} style={{ width: 64, height: 48, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 64, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{u.file.name}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
