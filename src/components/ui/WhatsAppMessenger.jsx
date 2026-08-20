import { useEffect, useMemo, useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCommentDots, faTimes, faSearch, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useAlert } from '../../context/AlertContext'
import { recruiterAPI } from '../../api/axios'
import './MessageComposer.css'

const STATIC_VARIABLE_OPTIONS = [
  { value: 'candidate_name', label: 'Candidate Name' },
  { value: 'position_name', label: 'Position Name' },
  { value: 'jd', label: 'Job Description' },
  { value: 'salary', label: 'Salary' },
  { value: 'location', label: 'Location' },
  { value: 'work_experience', label: 'Work Experience' },
  { value: 'recruiter_name', label: 'Recruiter Name' },
  { value: 'recruiter_emailid', label: 'Recruiter Email ID' },
  { value: 'recruiter_number', label: 'Recruiter Number' },
]

const extractVariables = (text = '') => {
  const vars = new Set()
  const regex = /{{\s*([^{}\s]+)\s*}}/g
  let match
  while ((match = regex.exec(text))) {
    vars.add(match[1])
  }
  return [...vars]
}

const interpolateTemplate = (text, values) => {
  return String(text || '').replace(/{{\s*([^{}\s]+)\s*}}/g, (_, key) => {
    const replacement = values[key]
    return replacement != null && replacement !== '' ? replacement : `{{${key}}}`
  })
}

export function WhatsAppMessenger({
  isOpen = false,
  templates = [],
  recipientPhone = '',
  recipientId = '',
  recipientName = '',
  recipients = [],
  onClose,
  onSend,
  onSaveTemplate,
}) {
  const [fetchedTemplates, setFetchedTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateContent, setTemplateContent] = useState(null)
  const [variables, setVariables] = useState({})
  const [sending, setSending] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const dropdownRef = useRef(null)

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  const allTemplates = useMemo(() => {
    const list = fetchedTemplates.length > 0 ? fetchedTemplates : templates
    if (!templateSearch) return list
    return list.filter(t => (t.name || '').toLowerCase().includes(templateSearch.toLowerCase()))
  }, [fetchedTemplates, templates, templateSearch])

  useEffect(() => {
    if (isOpen) {
      recruiterAPI.getWhatsAppTemplates()
        .then(res => {
          const list = res.data?.templates || []
          setFetchedTemplates(list)
        })
        .catch(err => console.error('Failed to fetch WhatsApp templates', err))
    }
  }, [isOpen])

  // Fetch template content when ID changes
  useEffect(() => {
    if (selectedTemplateId) {
      setLoadingContent(true)
      recruiterAPI.getWhatsAppTemplateDetails(selectedTemplateId)
        .then(res => {
          setTemplateContent(res.data?.content || '')
        })
        .catch(err => console.error('Failed to fetch template content', err))
        .finally(() => setLoadingContent(false))
    } else {
      setTemplateContent(null)
    }
  }, [selectedTemplateId])

  const selectedTemplateName = useMemo(() => {
    const list = fetchedTemplates.length > 0 ? fetchedTemplates : templates
    const t = list.find(t => t.id === selectedTemplateId)
    return t ? t.name : ''
  }, [fetchedTemplates, templates, selectedTemplateId])

  const templateVariables = useMemo(() => {
    return extractVariables(templateContent || '')
  }, [templateContent])

  useEffect(() => {
    if (!templateContent) {
      setVariables({})
      return
    }

    const defaults = templateVariables.reduce((acc, key) => {
      acc[key] = ''
      return acc
    }, {})

    setVariables(defaults)
  }, [templateContent, templateVariables])

  const previewText = useMemo(
    () => interpolateTemplate(templateContent || '', variables),
    [templateContent, variables]
  )

  const handleVariableChange = (key, value) => {
    setVariables((prev) => ({ ...prev, [key]: value }))
  }

  const { alert } = useAlert()

  const handleSend = async () => {
    if (!selectedTemplateId || !templateContent) {
      return alert('Please select a WhatsApp template before sending.')
    }
    if (recipients.length === 0) {
      return alert('Please select at least one recipient.')
    }
    if (typeof onSend === 'function') {
      setSending(true)
      try {
        await onSend({
          templateId: selectedTemplateId,
          variables,
        })
      } catch (error) {
        console.error(error)
        await alert('Failed to send WhatsApp message. Please try again.')
      } finally {
        setSending(false)
      }
    }
  }

  const handleSaveTemplate = async () => {
    if (!onSaveTemplate || !selectedTemplateId) return
    await onSaveTemplate({ id: selectedTemplateId, name: selectedTemplateName, body: templateContent })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="offcanvas-backdrop" />

      {/* Offcanvas */}
      <div className="offcanvas offcanvas-end offcanvas-whatsapp">
        {/* Header */}
        <div className="offcanvas-header">
          <div>
            <h5 className="offcanvas-title">
              <FontAwesomeIcon icon={faCommentDots} /> Send WhatsApp Messages
            </h5>
            {recipients?.length > 0 && (
              <p className="recipients-count">{recipients.length} candidates selected</p>
            )}
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>

        {/* Body */}
        <div className="offcanvas-body">
          {/* Recipients Summary */}
          {recipients?.length > 0 && (
            <div className="recipients-badge-group">
              <div className="recipients-badge">
                <span className="badge-icon">👥</span>
                <span>Selected Candidates</span>
                <span className="badge-count">{recipients.length}</span>
              </div>
            </div>
          )}

          {/* Template Selection */}
          <div className="email-field">
            <label>Select Template</label>
            <div className="custom-dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
              <div 
                className="email-select" 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundImage: 'none' // Remove default arrow to use FontAwesome
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTemplateName || 'Choose a template...'}
                </span>
                <FontAwesomeIcon icon={isDropdownOpen ? faChevronUp : faChevronDown} style={{ fontSize: '12px', color: '#6b7280' }} />
              </div>
              
              {isDropdownOpen && (
                <div className="dropdown-menu-portal" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  background: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  marginTop: '4px',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px', borderBottom: '1px solid #f3f4f6' }}>
                    <div className="filter-search-box" style={{ marginBottom: 0 }}>
                      <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                      <input 
                        type="text" 
                        className="email-input" 
                        placeholder="Search templates..." 
                        value={templateSearch}
                        autoFocus
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    {allTemplates.length > 0 ? (
                      allTemplates.map((template) => (
                        <div 
                          key={template.id} 
                          style={{ 
                            padding: '10px 12px', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            backgroundColor: selectedTemplateId === template.id ? '#eff6ff' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                          onClick={() => {
                            setSelectedTemplateId(template.id)
                            setIsDropdownOpen(false)
                            setTemplateSearch('')
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = selectedTemplateId === template.id ? '#eff6ff' : '#f9fafb'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = selectedTemplateId === template.id ? '#eff6ff' : 'transparent'}
                        >
                          {template.name}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', color: '#9ca3af', fontSize: '14px', textAlign: 'center' }}>No templates found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          
          {/* Template Preview */}
          <div className="template-preview-section">
            <div className="preview-label">Template Preview</div>
            <div className="template-preview whatsapp-preview" style={{justifyContent: "flex-start"}}>
              {loadingContent ? (
                <div className="preview-message">Loading template body...</div>
              ) : templateContent ? (
                <div className="preview-message">
                  <div className="preview-bubble">
                    {previewText}
                  </div>
                </div>
              ) : (
                'Select a template to see preview'
              )}
            </div>
          </div>

          {/* Variable Mapping */}
          {templateVariables.length > 0 && (
            <div className="variables-section">
              <div className="variables-heading">
                <span>Variable Mapping</span>
                <small>Assign values to template variables</small>
              </div>
              <div className="variable-mappings">
                {templateVariables.map((key) => (
                  <div key={key} className="email-field" style={{flexDirection: "row", alignItems: "center"}}>
                    <label>{key}</label>
                    <select 
                      className="email-select variable-select"
                      value={variables[key] || ''}
                      onChange={(e) => handleVariableChange(key, e.target.value)}
                    >
                      <option value="">Select {key}...</option>
                      {STATIC_VARIABLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="offcanvas-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-whatsapp"
            onClick={handleSend}
            disabled={sending || recipients.length === 0 || !templateContent}
          >
            <span className="btn-icon">💬</span>
            {sending ? 'Sending...' : `Send via WhatsApp to ${recipients?.length || 0}`}
          </button>
        </div>
      </div>
    </>
  )
}
