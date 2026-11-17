import { useEffect, useMemo, useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCommentDots, faTimes, faSearch, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useAlert } from '../../context/AlertContext'
import { recruiterAPI } from '../../api/axios'
import { decryptRegistrationId } from '../../utils/faceEnrollLinkCrypto'
import './MessageComposer.css'

const extractVariables = (text = '') => {
  const vars = new Set()
  const regex = /{{\s*([^{}\s]+)\s*}}/g
  let match
  while ((match = regex.exec(text))) {
    vars.add(match[1])
  }
  return [...vars]
}

const getUrlTemplateVariables = (text = '') => {
  const variables = []
  const regex = /{{\s*([^{}\s]+)\s*}}/g
  let match
  while ((match = regex.exec(String(text || '')))) {
    variables.push(match[1])
  }
  return variables
}

const interpolateTemplate = (text, values) => {
  return String(text || '').replace(/{{\s*([^{}\s]+)\s*}}/g, (_, key) => {
    const replacement = values[key]
    return replacement != null && replacement !== '' ? replacement : `{{${key}}}`
  })
}

const OTHER_PROJECT_VALUE = 'others'
export const TAGGED_FIELD_OPTIONS = [
  'registration',
  'attendance',
  'hiring',
  'kyc',
  'offer letter',
  'agreement letter',
  'certificate letters',
]

const normalizeProjects = (response) => {
  const payload = response?.data?.data ?? response?.data ?? response
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.projects)
      ? payload.projects
      : Array.isArray(payload?.items)
        ? payload.items
      : Array.isArray(payload?.results)
        ? payload.results
        : []

  return items.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      const name = String(item).trim()
      return name ? { id: name, name } : null
    }

    if (!item || typeof item !== 'object') return null
    const id = String(item.id ?? item.project_id ?? item.projectId ?? item.value ?? item.key ?? item._id ?? item.project ?? '').trim()
    const name = String(item.name ?? item.project_name ?? item.projectName ?? item.title ?? item.label ?? item.project ?? '').trim()
    return id || name ? { id: id || name, name: name || id } : null
  }).filter(Boolean)
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
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false)
  const [templateDetailsError, setTemplateDetailsError] = useState('')
  const [templateDetails, setTemplateDetails] = useState(null)
  const [templateImageUrl, setTemplateImageUrl] = useState('')
  const [templateType, setTemplateType] = useState(null)
  const [variables, setVariables] = useState({})
  const [buttonVariableValues, setButtonVariableValues] = useState({})
  const [candidateNamePlaceholder, setCandidateNamePlaceholder] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imageFileError, setImageFileError] = useState('')
  const [sending, setSending] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [templateLoadError, setTemplateLoadError] = useState('')
  const [projectOptions, setProjectOptions] = useState([])
  const [projectLoading, setProjectLoading] = useState(false)
  const [projectLoadError, setProjectLoadError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [taggedField, setTaggedField] = useState('')
  const dropdownRef = useRef(null)
  const imageInputRef = useRef(null)
  const [localImagePreview, setLocalImagePreview] = useState('')

  useEffect(() => {
    if (!imageFile) {
      setLocalImagePreview('')
      return
    }

    const previewUrl = URL.createObjectURL(imageFile)
    setLocalImagePreview(previewUrl)
    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [imageFile])

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
      let active = true
      setTemplateLoadError('')
      recruiterAPI.getWhatsAppTemplates()
        .then(res => {
          const list = Array.isArray(res.data?.templates)
            ? res.data.templates
            : Array.isArray(res.data)
              ? res.data
              : null
          if (!list) {
            throw new Error('WhatsApp templates response must contain a templates array.')
          }
          if (active) setFetchedTemplates(list)
        })
        .catch(err => {
          if (!active) return
          console.error('Failed to fetch WhatsApp templates', err)
          setTemplateLoadError('Could not load WhatsApp templates. Please try again.')
        })
      return () => {
        active = false
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    let active = true
    setProjectLoading(true)
    setProjectLoadError('')
    recruiterAPI.getProjectSuggestions('', 1000)
      .then((response) => {
        const options = normalizeProjects(response)
        if (active) setProjectOptions(options)
      })
      .catch((error) => {
        if (!active) return
        console.error('Failed to fetch WhatsApp project options', error)
        setProjectLoadError('Could not load projects. You can still select Other.')
      })
      .finally(() => {
        if (active) setProjectLoading(false)
      })

    return () => { active = false }
  }, [isOpen])

  const selectedTemplate = useMemo(() => {
    const list = fetchedTemplates.length > 0 ? fetchedTemplates : templates
    return list.find((template) => String(template.id ?? template.template_id ?? template.templateId ?? template.name) === String(selectedTemplateId)) || null
  }, [fetchedTemplates, templates, selectedTemplateId])

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateContent(null)
      setTemplateDetailsLoading(false)
      setTemplateDetailsError('')
      setTemplateDetails(null)
      setButtonVariableValues({})
      setTemplateImageUrl('')
      setTemplateType(null)
      setImageFile(null)
      setImageFileError('')
      return undefined
    }

    let active = true
    const fallbackContent = selectedTemplate?.content ?? selectedTemplate?.body ?? ''
    const imageUrl = selectedTemplate?.image_url || selectedTemplate?.imageUrl || ''

    setTemplateContent(typeof fallbackContent === 'string' && fallbackContent.trim() ? fallbackContent : null)
    setTemplateDetailsLoading(true)
    setTemplateDetailsError('')
    setTemplateDetails(null)
    setButtonVariableValues({})
    setTemplateType(null)
    setTemplateImageUrl(imageUrl)
    setImageFile(null)
    setImageFileError('')

    recruiterAPI.getWhatsAppTemplateDetails(selectedTemplateId)
      .then((response) => {
        const payload = response?.data?.data ?? response?.data ?? response
        if (payload?.success === false || typeof payload?.content !== 'string') {
          throw new Error('Template body content was not returned.')
        }
        if (active) {
          const header = payload.header && typeof payload.header === 'object' ? payload.header : {}
          const mediaType = header.type ?? payload.type
          setTemplateDetails(payload)
          setTemplateContent(payload.content.trim() ? payload.content : null)
          setTemplateType(mediaType == null ? null : String(mediaType).toLowerCase())
          setTemplateImageUrl(header.media_url || header.mediaUrl || payload.image_url || payload.imageUrl || imageUrl)
        }
      })
      .catch((error) => {
        if (!active) return
        console.error('Failed to fetch WhatsApp template details', error)
        setTemplateDetailsError('Could not load template body content.')
      })
      .finally(() => {
        if (active) setTemplateDetailsLoading(false)
      })

    return () => { active = false }
  }, [selectedTemplateId, selectedTemplate])

  const selectedTemplateName = useMemo(() => {
    return selectedTemplate?.name || ''
  }, [selectedTemplate])

  const templateVariables = useMemo(() => {
    return extractVariables(templateContent || '')
  }, [templateContent])
  const urlTemplateButtons = useMemo(() => {
    const buttons = Array.isArray(templateDetails?.buttons) ? templateDetails.buttons : []
    return buttons
      .map((button, index) => ({ ...button, index }))
      .filter((button) => String(button.type || '').toUpperCase() === 'URL' && button.url)
  }, [templateDetails])
  const applyButton = useMemo(
    () => urlTemplateButtons.find((button) => String(button.url || '').includes('/apply/')) || null,
    [urlTemplateButtons],
  )
  const buttonVariables = useMemo(
    () => urlTemplateButtons.map((button) => ({ ...button, variables: getUrlTemplateVariables(button.url) })),
    [urlTemplateButtons],
  )
  const defaultCandidateNamePlaceholder = useMemo(() => {
    const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
    return templateVariables.find((key) => ['candidatename', 'recipientname'].includes(normalize(key)))
      || templateVariables.find((key) => /^\d+$/.test(key))
      || ''
  }, [templateVariables])

  useEffect(() => {
    if (!templateContent) {
      setVariables({})
      setCandidateNamePlaceholder('')
      return
    }

    setCandidateNamePlaceholder(defaultCandidateNamePlaceholder)
    const defaults = templateVariables.reduce((acc, key) => {
      acc[key] = key === defaultCandidateNamePlaceholder ? 'candidate_name' : ''
      return acc
    }, {})

    setVariables(defaults)
  }, [templateContent, templateVariables, defaultCandidateNamePlaceholder])

  const previewText = useMemo(
    () => interpolateTemplate(templateContent || '', variables),
    [templateContent, variables]
  )
  const getPreviewButtonUrl = (button) => {
    const values = Object.fromEntries(getUrlTemplateVariables(button.url).map((key) => [
      key,
      buttonVariableValues[`${button.index}:${key}`] || `{{${key}}}`,
    ]))
    return interpolateTemplate(button.url, values)
  }

  const handleVariableChange = (key, value) => {
    setVariables((prev) => ({ ...prev, [key]: value }))
  }

  const handleCandidateNamePlaceholderChange = (event) => {
    const nextPlaceholder = event.target.value
    setCandidateNamePlaceholder(nextPlaceholder)
    setVariables((previous) => {
      const next = { ...previous }
      if (candidateNamePlaceholder && next[candidateNamePlaceholder] === 'candidate_name') {
        next[candidateNamePlaceholder] = ''
      }
      if (nextPlaceholder) next[nextPlaceholder] = 'candidate_name'
      return next
    })
  }

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageFile(null)
      setImageFileError('Choose an image file.')
      event.target.value = ''
      return
    }
    setImageFile(file)
    setImageFileError('')
  }

  const { alert } = useAlert()

  const handleSend = async () => {
    if (!selectedTemplateId || !templateContent) {
      return alert('Please select a WhatsApp template before sending.')
    }
    if (recipients.length === 0) {
      return alert('Please select at least one recipient.')
    }
    if (selectedProjectId && !taggedField) {
      return alert('Select a tagged field for the project.')
    }
    if (templateType === 'image' && !imageFile && !templateImageUrl) {
      return alert('Please upload an image for this image template.')
    }
    if (typeof onSend === 'function') {
      setSending(true)
      try {
        const buttonValues = {}
        buttonVariables.forEach((button) => {
          if (!button.variables.length) return
          const values = button.variables.map((key) => (
            String(button.url || '').includes('/apply/') && key === button.variables[0]
              ? String(buttonVariableValues[`${button.index}:${key}`] || '').trim()
              : String(buttonVariableValues[`${button.index}:${key}`] || '').trim()
          ))
          if (values.some(Boolean)) buttonValues[String(button.index + 1)] = values
        })
        if (applyButton && !buttonValues[String(applyButton.index + 1)]?.[0]) {
          await alert('Enter a value for the apply button in Button URL Mapping.')
          return
        }
        let formId
        if (applyButton) {
          const applyButtonValue = String(buttonValues[String(applyButton.index + 1)]?.[0] || '')
          const token = applyButtonValue.match(/\/apply\/([^/?#]+)/i)?.[1] || applyButtonValue
          try {
            formId = await decryptRegistrationId(decodeURIComponent(token))
          } catch {
            if (/^(\d+|[0-9a-f]{8}-[0-9a-f-]{27})$/i.test(token)) formId = token
          }
        }
        const projectName = selectedProjectId === OTHER_PROJECT_VALUE
          ? ''
          : projectOptions.find((project) => project.id === selectedProjectId)?.name || ''
        await onSend({
          templateId: selectedTemplateId,
          template_name: selectedTemplateName,
          ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
          ...(projectName ? { project_name: projectName } : {}),
          ...(selectedProjectId && taggedField ? { tagged_field: taggedField } : {}),
          variables,
          imageFile,
          ...(formId ? { form_id: formId } : {}),
          ...(Object.keys(buttonValues).length ? { buttonValues } : {}),
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

          {/* Project Selection */}
          <div className="email-field">
            <label htmlFor="whatsapp-project">Project</label>
            <select
              id="whatsapp-project"
              className="email-select"
              value={selectedProjectId}
              onChange={(event) => {
                setSelectedProjectId(event.target.value)
                setTaggedField('')
              }}
              disabled={projectLoading}
            >
              <option value="">{projectLoading ? 'Loading projects...' : 'Select a project (optional)'}</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
              <option value={OTHER_PROJECT_VALUE}>Other</option>
            </select>
            {projectLoadError && <small className="field-error" role="alert">{projectLoadError}</small>}
            {selectedProjectId && (
              <div className="email-field">
                <label htmlFor="whatsapp-tagged-field">Tagged field</label>
                <select
                  id="whatsapp-tagged-field"
                  className="email-select"
                  value={taggedField}
                  onChange={(event) => setTaggedField(event.target.value)}
                >
                  <option value="">Select a tagged field</option>
                  {TAGGED_FIELD_OPTIONS.map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

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
                <FontAwesomeIcon icon={isDropdownOpen ? faChevronUp : faChevronDown} style={{ fontSize: '12px', color: '#374151' }} />
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
                      allTemplates.map((template) => {
                        const templateId = String(template.id ?? template.template_id ?? template.templateId ?? template.name ?? '')
                        return (
                        <div 
                          key={templateId}
                          style={{ 
                            padding: '10px 12px', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            backgroundColor: selectedTemplateId === templateId ? '#eff6ff' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                          onClick={() => {
                            setSelectedTemplateId(templateId)
                            setIsDropdownOpen(false)
                            setTemplateSearch('')
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = selectedTemplateId === templateId ? '#eff6ff' : '#f9fafb'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = selectedTemplateId === templateId ? '#eff6ff' : 'transparent'}
                        >
                          {template.name || template.title || templateId}
                        </div>
                      )})
                    ) : (
                      <div style={{ padding: '12px', color: '#475569', fontSize: '14px', textAlign: 'center' }}>No templates found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {templateType === 'image' && (
            <div className="email-field whatsapp-image-upload">
              <label htmlFor="whatsapp-template-image">Upload image</label>
              <input
                ref={imageInputRef}
                id="whatsapp-template-image"
                className="email-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imageFile && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setImageFile(null)
                    setImageFileError('')
                    if (imageInputRef.current) imageInputRef.current.value = ''
                  }}
                >
                  Remove uploaded image
                </button>
              )}
              {imageFileError && <small className="field-error" role="alert">{imageFileError}</small>}
            </div>
          )}

          {/* Template Preview */}
          <div className="template-preview-section">
            <div className="preview-label">Template Preview</div>
            <div className="template-preview whatsapp-preview" style={{justifyContent: "flex-start"}}>
              {templateLoadError && fetchedTemplates.length === 0 && templates.length === 0 ? (
                <div className="preview-message" role="alert">{templateLoadError}</div>
              ) : templateDetailsLoading ? (
                <div className="preview-message" role="status">Loading template content...</div>
              ) : templateDetailsError && !templateContent ? (
                <div className="preview-message" role="alert">{templateDetailsError}</div>
              ) : templateContent ? (
                <div className="preview-message whatsapp-preview-message">
                  {templateType === 'image' && (localImagePreview || templateImageUrl) && (
                    <img
                      className="whatsapp-template-image"
                      src={localImagePreview || templateImageUrl}
                      alt={`${selectedTemplateName} preview`}
                    />
                  )}
                  <div className="preview-bubble">
                    {previewText}
                  </div>
                  {urlTemplateButtons.length > 0 && (
                    <div className="whatsapp-template-buttons">
                      {urlTemplateButtons.map((button) => (
                        <div className="whatsapp-template-button" key={button.index}>
                          <span>{button.text || 'Open link'}</span>
                          {getUrlTemplateVariables(button.url).length > 0 && (
                            <small>{getPreviewButtonUrl(button)}</small>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                selectedTemplateId
                  ? 'Template content is missing. Include content in the WhatsApp templates GET response.'
                  : 'Select a template to see preview'
              )}
            </div>
          </div>

          {/* Variable Mapping */}
          {(templateVariables.length > 0 || buttonVariables.some((button) => button.variables.length > 0)) && (
            <div className="variables-section">
              <div className="variables-heading">
                <span>Message Content Variables</span>
                <small>Map message text and Apply button placeholders here.</small>
              </div>
              {templateVariables.length > 0 && (
                <>
                  <div className="email-field">
                    <label htmlFor="whatsapp-candidate-name-placeholder">Candidate name placeholder</label>
                    <select
                      id="whatsapp-candidate-name-placeholder"
                      className="email-select"
                      value={candidateNamePlaceholder}
                      onChange={handleCandidateNamePlaceholderChange}
                    >
                      <option value="">Do not map candidate name</option>
                      {templateVariables.map((key) => <option key={key} value={key}>{`{{${key}}}`}</option>)}
                    </select>
                  </div>
                  <div className="variable-mappings">
                    {templateVariables.map((key) => (
                      <div key={key} className="email-field" style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <label htmlFor={`whatsapp-variable-${key}`}>{`{{${key}}}`}</label>
                        {key === candidateNamePlaceholder ? (
                          <input
                            id={`whatsapp-variable-${key}`}
                            className="email-input variable-select"
                            value="Candidate name (automatic)"
                            readOnly
                          />
                        ) : (
                          <input
                            id={`whatsapp-variable-${key}`}
                            type="text"
                            className="email-input variable-select"
                            value={variables[key] || ''}
                            onChange={(event) => handleVariableChange(key, event.target.value)}
                            placeholder={`Enter ${key}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {buttonVariables.some((button) => button.variables.length > 0) && (
                <div className="variable-mappings">
                {buttonVariables.flatMap((button) => button.variables.map((key, variableIndex) => {
                  const isApplyUrl = String(button.url || '').includes('/apply/')
                  const valueKey = `${button.index}:${key}`
                  const inputValue = buttonVariableValues[valueKey] || ''

                  return (
                    <div key={`${button.index}:${variableIndex}`} className="email-field">
                      <label htmlFor={`whatsapp-button-variable-${button.index}-${variableIndex}`}>
                        {button.text || `Button ${button.index + 1}`} — {`{{${key}}}`}
                      </label>
                      <input
                        id={`whatsapp-button-variable-${button.index}-${variableIndex}`}
                        type="text"
                        className="email-input variable-select"
                        value={inputValue}
                        onChange={(event) => setButtonVariableValues((current) => ({ ...current, [valueKey]: event.target.value }))}
                        placeholder={isApplyUrl && variableIndex === 0 ? 'Enter apply button value' : `Enter ${key}`}
                      />
                    </div>
                  )
                }))}
                </div>
              )}
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
