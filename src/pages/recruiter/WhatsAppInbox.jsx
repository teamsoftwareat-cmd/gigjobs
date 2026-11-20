import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDown,
  faArrowRight,
  faCheck,
  faCircleNotch,
  faFile,
  faMagnifyingGlass,
  faPaperclip,
  faPaperPlane,
  faRotate,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { whatsappConversationAPI } from '../../api/axios'
import './WhatsAppInbox.css'

const normalizeMobile = (value) => String(value || '').replace(/\D/g, '')

const parseMessageDate = (value) => {
  if (!value) return null
  const normalized = String(value).trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatMessageTime = (value) => {
  if (!value) return ''
  const parsedDate = parseMessageDate(value)
  if (!parsedDate) return String(value)
  return parsedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const formatConversationTime = (value) => {
  if (!value) return ''
  const parsedDate = parseMessageDate(value)
  if (!parsedDate) return String(value)
  if (parsedDate.toDateString() === new Date().toDateString()) return formatMessageTime(value)
  return parsedDate.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const parseJson = (value) => {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const getReadableMessage = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  const parsed = parseJson(text)
  if (typeof parsed === 'string') return parsed
  if (!Array.isArray(parsed)) return text
  const body = parsed.find((part) => String(part?.type || '').toLowerCase() === 'body')
  const values = Array.isArray(body?.parameters)
    ? body.parameters.map((parameter) => String(parameter?.text ?? parameter?.parameter_value ?? '').trim()).filter(Boolean)
    : []
  if (values.length) return values.join(' · ')
  if (body) return 'Template message'

  const findText = (item) => {
    if (!item || typeof item !== 'object') return ''
    if (Array.isArray(item)) return item.map(findText).filter(Boolean).join(' ')
    const directText = item.text || item.body || item.content || item.caption
    return directText ? String(directText) : Object.values(item).map(findText).filter(Boolean).join(' ')
  }
  return findText(parsed) || 'Template message'
}

const getChatMessageText = (message) => {
  const content = String(message?.message_content || '').trim()
  if (!content) return ''

  const components = parseJson(content)
  if (!Array.isArray(components)) {
    return typeof components === 'string' ? components : content
  }

  const rawPayload = parseJson(message.raw_payload)
  const providerMessage = rawPayload?.data?.message || rawPayload?.message || {}
  const rawTemplate = parseJson(providerMessage.raw_template || providerMessage.template)
  const templateBody = rawTemplate?.body || rawTemplate?.content || providerMessage.template_body
  const bodyComponent = components.find((part) => String(part?.type || '').toLowerCase() === 'body')
  const parameters = Array.isArray(bodyComponent?.parameters) ? bodyComponent.parameters : []

  if (typeof templateBody === 'string' && templateBody.trim()) {
    return templateBody.replace(/{{\s*(\d+)\s*}}/g, (placeholder, index) => {
      const parameter = parameters[Number(index) - 1]
      const value = parameter?.text ?? parameter?.parameter_value
      return value == null || value === '' ? placeholder : String(value)
    })
  }

  const isTemplate = String(message.message_type || '').toLowerCase() === 'template'
  if (isTemplate) return 'Template message (content unavailable)'
  return getReadableMessage(content)
}

const formatMessageDate = (value) => {
  if (!value) return 'Conversation'
  const parsedDate = parseMessageDate(value)
  if (!parsedDate) return 'Conversation'
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (parsedDate.toDateString() === today.toDateString()) return 'Today'
  if (parsedDate.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return parsedDate.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.'

export default function WhatsAppInbox() {
  const [mobileInput, setMobileInput] = useState('')
  const [activeMobile, setActiveMobile] = useState('')
  const [activeName, setActiveName] = useState('')
  const [messages, setMessages] = useState([])
  const [conversationList, setConversationList] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const [selectedAttachment, setSelectedAttachment] = useState(null)
  const [listError, setListError] = useState('')
  const [listPage, setListPage] = useState(1)
  const [listPerPage, setListPerPage] = useState(30)
  const [listTotal, setListTotal] = useState(0)
  const [appliedSearch, setAppliedSearch] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const conversationRef = useRef(null)
  const attachmentInputRef = useRef(null)
  const requestId = useRef(0)
  const listRequestId = useRef(0)
  const liveStateRef = useRef({ activeMobile, appliedSearch, listPage })
  const totalPages = Math.max(1, Math.ceil(listTotal / listPerPage))
  liveStateRef.current = { activeMobile, appliedSearch, listPage }

  const orderedMessages = useMemo(() => (
    [...messages].sort((a, b) => {
      const dateA = parseMessageDate(a.message_at)?.getTime()
      const dateB = parseMessageDate(b.message_at)?.getTime()
      if (dateA !== undefined && dateB !== undefined) return dateA - dateB
      if (dateA !== undefined) return -1
      if (dateB !== undefined) return 1
      return Number(a.id || 0) - Number(b.id || 0)
    })
  ), [messages])

  const loadConversations = useCallback(async (search = '', page = 1) => {
    const currentRequestId = ++listRequestId.current
    setListLoading(true)
    setListError('')
    try {
      const response = await whatsappConversationAPI.getConversations(search, page)
      const payload = response?.data
      const pageData = payload?.data
      if (!payload || payload.success === false || !Array.isArray(pageData?.data)) {
        throw new Error(payload?.message || 'The WhatsApp conversations response is not in the expected format.')
      }
      if (currentRequestId !== listRequestId.current) return
      setConversationList(pageData.data)
      setListPage(Number(pageData.current_page) || page)
      setListPerPage(Math.max(1, Number(pageData.per_page) || 30))
      setListTotal(Math.max(0, Number(pageData.total) || 0))
    } catch (requestError) {
      if (currentRequestId !== listRequestId.current) return
      console.error('Failed to load WhatsApp conversations', requestError)
      setListError(getErrorMessage(requestError))
      setConversationList([])
      setListTotal(0)
    } finally {
      if (currentRequestId === listRequestId.current) setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const loadConversation = useCallback(async (mobile, { showLoader = true } = {}) => {
    if (!mobile) return
    const currentRequestId = ++requestId.current
    if (showLoader) setConversationLoading(true)
    setError('')
    try {
      const response = await whatsappConversationAPI.getMessages(mobile)
      const payload = response?.data
      if (!payload || payload.success === false || !Array.isArray(payload.data)) {
        throw new Error(payload?.message || 'The WhatsApp messages response is not in the expected format.')
      }
      if (currentRequestId !== requestId.current) return
      setMessages(payload.data)
      setActiveMobile(payload.mobile ? normalizeMobile(payload.mobile) : mobile)
      setLastUpdated(new Date())
    } catch (requestError) {
      if (currentRequestId !== requestId.current) return
      console.error('Failed to load WhatsApp conversation', requestError)
      setError(getErrorMessage(requestError))
      if (showLoader) setMessages([])
    } finally {
      if (currentRequestId === requestId.current && showLoader) setConversationLoading(false)
    }
  }, [])

  useEffect(() => {
    const appKey = import.meta.env.VITE_REVERB_APP_KEY
    if (!appKey) return undefined

    window.Pusher = Pusher
    const token = localStorage.getItem('access_token')
    const port = Number(import.meta.env.VITE_REVERB_PORT || 443)
    const authEndpoint = import.meta.env.VITE_REVERB_AUTH_ENDPOINT
      || 'https://cynosurejobs.net/gig_jobs_backend/gigjobs_cyno/public/broadcasting/auth'
    const echo = new Echo({
      broadcaster: 'reverb',
      key: appKey,
      wsHost: import.meta.env.VITE_REVERB_HOST || new URL(authEndpoint).hostname,
      wsPort: port,
      wssPort: port,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      authEndpoint,
      auth: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    })

    echo.private('whatsapp.inbox').listen('.whatsapp.message.updated', () => {
      const { activeMobile: mobile, appliedSearch, listPage } = liveStateRef.current
      if (mobile) loadConversation(mobile, { showLoader: false })
      loadConversations(appliedSearch, listPage)
    })

    return () => {
      echo.leave('whatsapp.inbox')
      echo.disconnect()
    }
  }, [loadConversation, loadConversations])

  useEffect(() => {
    if (!orderedMessages.length || !conversationRef.current) return
    conversationRef.current.scrollTop = conversationRef.current.scrollHeight
  }, [orderedMessages])

  const searchConversations = async (event) => {
    event?.preventDefault()
    const search = mobileInput.trim()
    setAppliedSearch(search)
    setListPage(1)
    await loadConversations(search, 1)
  }

  const selectConversation = async (conversation) => {
    const mobile = normalizeMobile(conversation.candidate_mobile)
    if (!mobile) return
    setActiveMobile(mobile)
    setActiveName(conversation.candidate_name || '')
    setMessages([])
    setError('')
    await loadConversation(mobile)
  }

  const refreshConversation = () => loadConversation(activeMobile)

  const refreshInbox = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await Promise.all([
        loadConversations(appliedSearch, listPage),
        activeMobile ? loadConversation(activeMobile) : Promise.resolve(),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  const selectAttachment = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    const acceptedExtensions = ['jpg', 'jpeg', 'png', 'mp4', '3gp', '3gpp', 'pdf', 'xls', 'xlsx', 'doc']
    if (!acceptedExtensions.includes(extension)) {
      setAttachmentError('Choose a JPG, JPEG, PNG, MP4, 3GP, 3GPP, PDF, XLS, XLSX, or DOC file.')
      event.target.value = ''
      return
    }
    setAttachmentError('')
    setSelectedAttachment(file)
  }

  const removeAttachment = () => {
    setSelectedAttachment(null)
    setAttachmentError('')
    if (attachmentInputRef.current) attachmentInputRef.current.value = ''
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    const text = messageDraft.trim()
    if ((!text && !selectedAttachment) || !activeMobile || sending) return

    setSending(true)
    setError('')
    try {
      await whatsappConversationAPI.sendMessage(activeMobile, text, selectedAttachment)
      setMessageDraft('')
      removeAttachment()
      await loadConversation(activeMobile, { showLoader: false })
      await loadConversations(appliedSearch, listPage)
    } catch (sendError) {
      console.error('Failed to send WhatsApp message', sendError)
      setError(getErrorMessage(sendError))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="whatsapp-inbox-page">
      <header className="whatsapp-inbox-heading">
        <div>
          <div className="whatsapp-inbox-eyebrow">MESSAGING</div>
          <h1>WhatsApp Inbox</h1>
          <p>View and reply to candidate conversations in one place.</p>
        </div>
        <div className="whatsapp-inbox-secure">
          <span className="whatsapp-inbox-secure-dot" />
          Connected inbox
        </div>
        <button
          type="button"
          className="whatsapp-inbox-page-refresh"
          onClick={refreshInbox}
          disabled={refreshing || listLoading || conversationLoading}
          aria-label="Refresh inbox"
          title="Refresh inbox"
        >
          <FontAwesomeIcon icon={faRotate} spin={refreshing} />
          <span>Refresh</span>
        </button>
      </header>

      <div className="whatsapp-inbox-shell">
        <aside className="whatsapp-inbox-contacts">
          <div className="whatsapp-inbox-contacts-head">
            <div>
              <h2>Conversations</h2>
              <p>{listTotal ? `${listTotal} conversations` : 'Search by mobile number'}</p>
            </div>
            <span className="whatsapp-inbox-brand"><FontAwesomeIcon icon={faWhatsapp} /></span>
          </div>
          <form className="whatsapp-inbox-search" onSubmit={searchConversations}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              aria-label="Search conversations by mobile number"
              placeholder="Search mobile number"
              value={mobileInput}
              onChange={(event) => setMobileInput(event.target.value)}
            />
          </form>
          <button className="whatsapp-inbox-search-button" type="button" disabled={listLoading} onClick={() => searchConversations()}>
            {listLoading ? <FontAwesomeIcon icon={faCircleNotch} spin /> : 'Search conversations'}
          </button>
          {listError && <div className="whatsapp-inbox-search-error" role="alert">{listError}</div>}

          <div className="whatsapp-inbox-contact-divider" />
          <div className="whatsapp-inbox-contact-list">
            {listLoading && !conversationList.length ? (
              <div className="whatsapp-inbox-list-state"><FontAwesomeIcon icon={faCircleNotch} spin /> Loading conversations…</div>
            ) : conversationList.length ? conversationList.map((conversation) => {
              const mobile = normalizeMobile(conversation.candidate_mobile)
              const outgoing = String(conversation.last_direction || '').toLowerCase() === 'outgoing'
              return (
                <button
                  type="button"
                  key={mobile}
                  className={`whatsapp-inbox-contact${mobile === activeMobile ? ' active' : ''}`}
                  onClick={() => selectConversation(conversation)}
                >
                  <span className="whatsapp-inbox-contact-avatar">{(conversation.candidate_name || mobile).slice(-2).toUpperCase()}</span>
                  <span className="whatsapp-inbox-contact-details">
                    <span className="whatsapp-inbox-contact-title">
                      <strong>{conversation.candidate_name || mobile}</strong>
                      <time>{formatConversationTime(conversation.last_message_at)}</time>
                    </span>
                    <span className="whatsapp-inbox-contact-preview">
                      {outgoing && <span className="whatsapp-inbox-preview-direction">You: </span>}
                      {getReadableMessage(conversation.last_message) || 'No message preview'}
                    </span>
                  </span>
                </button>
              )
            }) : (
            <div className="whatsapp-inbox-contact-empty">
              <span className="whatsapp-inbox-contact-empty-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
              <strong>{listError ? 'Conversations unavailable' : 'No conversations found'}</strong>
              <span>{listError ? 'Try refreshing the conversation list.' : 'Try another mobile number.'}</span>
            </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="whatsapp-inbox-pagination">
              <span>Page {listPage} of {totalPages}</span>
              <div>
                <button type="button" aria-label="Previous page" disabled={listLoading || listPage <= 1} onClick={() => loadConversations(appliedSearch, listPage - 1)}>‹</button>
                <button type="button" aria-label="Next page" disabled={listLoading || listPage >= totalPages} onClick={() => loadConversations(appliedSearch, listPage + 1)}>›</button>
              </div>
            </div>
          )}
        </aside>

        <section className="whatsapp-inbox-conversation" aria-label="WhatsApp conversation">
          {activeMobile ? (
            <>
              <div className="whatsapp-inbox-chat-header">
                <div className="whatsapp-inbox-chat-person">
                  <span className="whatsapp-inbox-contact-avatar large">{activeMobile.slice(-2)}</span>
                  <div>
                    <strong>{activeName || messages.find((message) => message.candidate_name)?.candidate_name || activeMobile}</strong>
                    <span><i /> {activeName ? activeMobile : 'WhatsApp conversation'}</span>
                  </div>
                </div>
                <div className="whatsapp-inbox-chat-actions">
                  {lastUpdated && <span className="whatsapp-inbox-updated">Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
                  <button type="button" aria-label="Refresh messages" title="Refresh messages" disabled={conversationLoading} onClick={refreshConversation}>
                    <FontAwesomeIcon icon={conversationLoading ? faCircleNotch : faRotate} spin={conversationLoading} />
                  </button>
                </div>
              </div>

              {error && <div className="whatsapp-inbox-error" role="alert">{error}</div>}

              <div className="whatsapp-inbox-message-area" ref={conversationRef}>
                {conversationLoading ? (
                  <div className="whatsapp-inbox-state">
                    <FontAwesomeIcon icon={faCircleNotch} spin />
                    <span>Loading conversation…</span>
                  </div>
                ) : orderedMessages.length ? (
                  <>
                    {orderedMessages.map((message, index) => {
                      const outgoing = String(message.direction || '').toLowerCase() === 'outgoing'
                      const dayLabel = formatMessageDate(message.message_at)
                      const showDayDivider = index === 0 || dayLabel !== formatMessageDate(orderedMessages[index - 1].message_at)
                      const isImage = String(message.message_type || '').toLowerCase() === 'image'
                      return (
                        <Fragment key={message.id ?? message.provider_message_id ?? index}>
                          {showDayDivider && <div className="whatsapp-inbox-date-divider"><span>{dayLabel}</span></div>}
                          <article className={`whatsapp-inbox-message ${outgoing ? 'outgoing' : 'incoming'}`}>
                            <div className="whatsapp-inbox-bubble">
                              {message.media_url && (
                                isImage
                                  ? <a className="whatsapp-inbox-media" href={message.media_url} target="_blank" rel="noreferrer"><img src={message.media_url} alt="WhatsApp image attachment" /></a>
                                  : <a className="whatsapp-inbox-file" href={message.media_url} target="_blank" rel="noreferrer">Open {message.message_type || 'media'} attachment</a>
                              )}
                              {message.message_content && <p>{getChatMessageText(message)}</p>}
                              <div className="whatsapp-inbox-message-meta">
                                <span>{formatMessageTime(message.message_at)}</span>
                                {outgoing && <FontAwesomeIcon icon={faCheck} aria-label={message.message_status || 'sent'} title={message.message_status || 'sent'} />}
                              </div>
                            </div>
                          </article>
                        </Fragment>
                      )
                    })}
                  </>
                ) : (
                  <div className="whatsapp-inbox-state">
                    <span className="whatsapp-inbox-empty-chat-icon"><FontAwesomeIcon icon={faWhatsapp} /></span>
                    <strong>No messages yet</strong>
                    <span>There are no messages in this conversation yet.</span>
                  </div>
                )}
              </div>

              <form className="whatsapp-inbox-composer" onSubmit={sendMessage}>
                {selectedAttachment && (
                  <div className="whatsapp-inbox-attachment-preview">
                    <FontAwesomeIcon icon={faFile} />
                    <span>{selectedAttachment.name}</span>
                    <button type="button" aria-label="Remove attachment" onClick={removeAttachment} disabled={sending}>
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                )}
                {attachmentError && <div className="whatsapp-inbox-attachment-error" role="alert">{attachmentError}</div>}
                <div className="whatsapp-inbox-composer-row">
                  <input
                    ref={attachmentInputRef}
                    className="whatsapp-inbox-file-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.mp4,.3gp,.3gpp,.pdf,.xls,.xlsx,.doc,image/jpeg,image/png,video/mp4,video/3gpp,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword"
                    aria-label="Attach a file"
                    onChange={selectAttachment}
                    disabled={sending}
                  />
                  <button
                    type="button"
                    className="whatsapp-inbox-attach-button"
                    aria-label="Attach PDF, Word document, or image"
                    title="Attach JPG, JPEG, PNG, MP4, 3GP, 3GPP, PDF, XLS, XLSX, or DOC"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={sending}
                  >
                    <FontAwesomeIcon icon={faPaperclip} />
                  </button>
                  <textarea
                    aria-label="Write a WhatsApp message"
                    placeholder="Write a message…"
                    rows={1}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                    disabled={sending}
                  />
                  <button type="submit" aria-label="Send message" disabled={(!messageDraft.trim() && !selectedAttachment) || sending}>
                    <FontAwesomeIcon icon={sending ? faCircleNotch : faPaperPlane} spin={sending} />
                    <span>{sending ? 'Sending' : 'Send'}</span>
                  </button>
                </div>
                <span className="whatsapp-inbox-composer-hint">JPG, JPEG, PNG, MP4, 3GP, 3GPP, PDF, XLS, XLSX, DOC · Enter to send · Shift + Enter for a new line</span>
              </form>
            </>
          ) : (
            <div className="whatsapp-inbox-welcome">
              <div className="whatsapp-inbox-welcome-icon"><FontAwesomeIcon icon={faWhatsapp} /></div>
              <h2>Your candidate conversations</h2>
              <p>Open a conversation using a mobile number to see messages and send a reply.</p>
              <div className="whatsapp-inbox-welcome-tip"><FontAwesomeIcon icon={faArrowDown} /> Choose a number from the panel to get started</div>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
