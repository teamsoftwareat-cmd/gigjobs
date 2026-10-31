import { useEffect, useState } from 'react'
import { recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui'
import './CandidateTravelTicketsModal.css'

const getValue = (item, keys, fallback = '') => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null && item[key] !== '') return item[key]
  }
  return fallback
}

const getTicketRecords = (payload) => {
  let value = payload
  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []
    const records = getValue(value, ['travel_tickets', 'travelTickets', 'tickets', 'items', 'records', 'files'])
    if (Array.isArray(records)) return records
    if (value.data !== undefined) {
      value = value.data
      continue
    }
    if (getValue(value, ['file_url', 'fileUrl', 'url', 'ticket_url', 'ticketUrl', 'path'])) return [value]
    return []
  }
  return []
}

const normalizeTicketFiles = (payload) => getTicketRecords(payload).flatMap((record) => {
  const recordDate = getValue(record, ['travel_date', 'travelDate', 'date', 'travel_start_date', 'travelStartDate'])
  const nestedFiles = getValue(record, ['files', 'ticket_files', 'ticketFiles', 'attachments'])
  const files = Array.isArray(nestedFiles) ? nestedFiles : [record]
  return files.map((file) => {
    const url = typeof file === 'string'
      ? file
      : getValue(file, ['file_url', 'fileUrl', 'url', 'ticket_url', 'ticketUrl', 'path', 'document_url', 'documentUrl'])
    if (!url) return null
    const name = typeof file === 'string'
      ? file.split('/').pop()?.split('?')[0] || 'Travel ticket'
      : getValue(file, ['file_name', 'fileName', 'name', 'original_name', 'originalName'], 'Travel ticket')
    return {
      date: getValue(file, ['travel_date', 'travelDate', 'date'], recordDate),
      name,
      url,
    }
  }).filter(Boolean)
})

const formatTravelDate = (value) => {
  if (!value) return 'Date not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CandidateTravelTicketsModal({ candidate, onClose }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const candidateId = getValue(candidate, ['candidate_id', 'candidateId', 'id', '_id'])
  const candidateName = getValue(candidate, ['name', 'candidate_name', 'candidateName', 'full_name', 'fullName'], 'Candidate')

  useEffect(() => {
    if (!candidate || !candidateId) return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    setTickets([])

    recruiterAPI.getCandidateTravelTickets(candidateId)
      .then((response) => {
        if (!cancelled) setTickets(normalizeTicketFiles(response?.data ?? response))
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error('Failed to load candidate travel tickets:', loadError)
        setError('Unable to load travel tickets. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [candidate, candidateId])

  return (
    <Modal isOpen={Boolean(candidate)} onClose={onClose} title={`Travel tickets · ${candidateName}`} maxWidth="760px">
      <div className="candidate-travel-tickets">
        <div className="candidate-travel-tickets-meta">
          <strong>{candidateName}</strong>
          <span>Candidate ID: {candidateId || '—'}</span>
        </div>
        {loading && <div className="candidate-travel-tickets-empty">Loading travel tickets...</div>}
        {error && <div className="attendance-message error" role="alert">{error}</div>}
        {!loading && !error && tickets.length === 0 && <div className="candidate-travel-tickets-empty">No travel tickets found.</div>}
        {!loading && tickets.length > 0 && <div className="candidate-travel-tickets-list">
          {tickets.map((ticket, index) => <div className="candidate-travel-ticket-row" key={`${ticket.url}-${index}`}>
            <div><span>Travel date</span><strong>{formatTravelDate(ticket.date)}</strong></div>
            <div className="candidate-travel-ticket-file"><span>Ticket file</span><strong title={ticket.name}>{ticket.name}</strong></div>
            <a className="btn btn-primary btn-sm" href={ticket.url} target="_blank" rel="noreferrer">View ticket</a>
          </div>)}
        </div>}
      </div>
    </Modal>
  )
}