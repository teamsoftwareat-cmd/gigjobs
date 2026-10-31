import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function SearchableProjectSelect({ options = [], value = '', onChange, placeholder = 'Select project', disabled = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState(null)
  const containerRef = useRef(null)
  const menuRef = useRef(null)
  const resolvedOptions = options.map((option) => ({
    ...option,
    id: String(option.id ?? option.project_id ?? option.value ?? ''),
    name: String(option.name ?? option.label ?? option.project_name ?? option.projectName ?? option.title ?? ''),
  }))
  const selected = resolvedOptions.find((option) => String(option.id) === String(value))
  const filteredOptions = resolvedOptions.filter((option) => String(option.name).toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    setQuery(selected?.name || '')
  }, [selected?.id, selected?.name])

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!containerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  useEffect(() => {
    if (!open) return undefined

    const updateMenuPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 190 }}>
      <button
        type="button"
        className="form-control"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(event) => {
          event.preventDefault()
          setOpen((current) => !current)
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? 'inherit' : 'var(--text3)' }}>{selected?.name || placeholder}</span>
        <span aria-hidden="true">{open ? '\u25b2' : '\u25bc'}</span>
      </button>
      {open && menuPosition && createPortal(
        <div ref={menuRef} role="listbox" style={{ position: 'fixed', zIndex: 15000, top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: 280, overflowY: 'auto', padding: 8, background: 'var(--card)', border: '1px solid var(--border-light)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)' }}>
          <input
            autoFocus
            className="form-control"
            value={query}
            placeholder={`Search ${placeholder.toLowerCase()}`}
            aria-label={`Search ${placeholder.toLowerCase()}`}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
            }}
            style={{ marginBottom: 6 }}
          />
          {filteredOptions.map((option) => (
            <button key={option.id} role="option" aria-selected={String(option.id) === String(value)} type="button" style={{ display: 'block', width: '100%', padding: '9px 10px', border: 0, background: String(option.id) === String(value) ? 'var(--bg-light)' : 'transparent', textAlign: 'left', cursor: 'pointer' }} onClick={() => { onChange(option.id); setQuery(option.name); setOpen(false) }}>
              {option.name}
          </button>
          ))}
          {filteredOptions.length === 0 && <div style={{ padding: '9px 10px', color: 'var(--text3)', fontSize: 13 }}>No projects found.</div>}
        </div>,
        document.body,
      )}
    </div>
  )
}
