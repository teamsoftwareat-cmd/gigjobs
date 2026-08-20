/*
  Original accordion-based AllocateRecipientsModal component
  Commented out so you can revert back if needed.

import { useState, useEffect } from 'react'
import { Modal, FormField, Button } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'

export default function AllocateRecipientsModal({ isOpen, onClose, project, location, callerId, onSelect, initialSelected = [] }) {
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState(initialSelected)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [batches, setBatches] = useState([])
  const [expandedBatches, setExpandedBatches] = useState(new Set())

  // Set default date range to past week
  useEffect(() => {
    if (isOpen) {
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(today.getDate() - 7)

      setToDate(today.toISOString().split('T')[0])
      setFromDate(weekAgo.toISOString().split('T')[0])
      setPage(1)
      setSelectedRows(initialSelected)
      setExpandedBatches(new Set())
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && project && location && fromDate && toDate) {
      fetchRecipients()
    }
  }, [isOpen, project, location, page, pageSize, search, fromDate, toDate])

  const fetchRecipients = async () => {
    setLoading(true)
    try {
      const params = {
        project,
        location,
        search: search || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        offset: (page - 1) * pageSize,
        limit: pageSize
      }
      const res = await recruiterAPI.getRecipients(params)
      const data = res.data?.data || {}
      const items = data.items || []
      setRecipients(items)
      setTotal(data.total || 0)

      // Group by batch (date and time_slot)
      const batchMap = {}
      items.forEach(item => {
        const safeTimeSlot = (item.time_slot || 'No Time').replace(/:/g, '_')
        const batchKey = `${item.date || 'No Date'}-${safeTimeSlot}`
        if (!batchMap[batchKey]) {
          batchMap[batchKey] = []
        }
        batchMap[batchKey].push(item)
      })
      setBatches(Object.entries(batchMap))
    } catch (err) {
      setRecipients([])
      setTotal(0)
      setBatches([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = () => {
    const recipientIds = [...new Set(selectedRows.map((rowKey) => String(rowKey).split(':')[1]))]
    onSelect?.(recipientIds)
    onClose()
  }

  const getRowKey = (batchKey, recipient, index) => `${batchKey}:${recipient.id}:${index}`

  const getDisplayBatchKey = (batchKey) => {
    return batchKey.replace(/_/g, ':')
  }

  const toggleRecipient = (rowKey) => {
    setSelectedRows(prev =>
      prev.includes(rowKey)
        ? prev.filter(key => key !== rowKey)
        : [...prev, rowKey]
    )
  }

  const toggleBatchSelection = (batchKey, batchRecipients) => {
    const batchKeys = batchRecipients.map((r, idx) => getRowKey(batchKey, r, idx))
    const allSelected = batchKeys.every(key => selectedRows.includes(key))

    if (allSelected) {
      setSelectedRows(prev => prev.filter(key => !batchKeys.includes(key)))
    } else {
      setSelectedRows(prev => [...new Set([...prev, ...batchKeys])])
    }
  }

  const toggleAccordion = (batchKey) => {
    setExpandedBatches(prev => {
      const newSet = new Set(prev)
      if (newSet.has(batchKey)) {
        newSet.delete(batchKey)
      } else {
        newSet.add(batchKey)
      }
      return newSet
    })
  }

  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(page * pageSize, total)

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2))
    let endPage = Math.min(lastPage, startPage + maxVisible - 1)

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Allocate Recipients" maxWidth="1200px">
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Search</label>
            <input
              className="form-control"
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>From Date</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>To Date</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Page Size</label>
            <select
              className="form-control"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Total Recipients: {total}</strong> |
            <strong style={{ color: '#007bff', marginLeft: '8px' }}>Selected: {selectedRows.length}</strong>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setSearch('')
              setFromDate('')
              setToDate('')
              setPage(1)
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            Loading recipients...
          </div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No recipients found
          </div>
        ) : (
          batches.map(([batchKey, batchRecipients]) => {
            const isExpanded = expandedBatches.has(batchKey)
            const batchKeys = batchRecipients.map((r, idx) => getRowKey(batchKey, r, idx))
            const allSelected = batchKeys.length > 0 && batchKeys.every(key => selectedRows.includes(key))
            const someSelected = batchKeys.some(key => selectedRows.includes(key))

            return (
              <div key={batchKey} style={{ marginBottom: '8px', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#f8f9fa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => toggleAccordion(batchKey)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        toggleBatchSelection(batchKey, batchRecipients)
                      }}
                    />
                    <strong>{getDisplayBatchKey(batchKey)}</strong>
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      ({batchRecipients.length} recipients)
                    </span>
                  </div>
                  <span style={{ fontSize: '18px' }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', width: '50px' }}>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation()
                                toggleBatchSelection(batchKey, batchRecipients)
                              }}
                            />
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>ID</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Name</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Phone</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Email</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Aadhaar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchRecipients.map((recipient, index) => (
                          <tr key={`${recipient.id}-${index}`} style={{ borderBottom: '1px solid #f1f3f4' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="checkbox"
                              checked={selectedRows.includes(getRowKey(batchKey, recipient, index))}
                              onChange={() => toggleRecipient(getRowKey(batchKey, recipient, index))}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>{recipient.id}</td>
                            <td style={{ padding: '8px 12px' }}>{recipient.name || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{recipient.phone || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{recipient.email || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{recipient.aadhaar || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {lastPage > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #dee2e6' }}>
          {[
            { label: 'First', target: 1, disabled: page === 1 },
            { label: 'Previous', target: Math.max(1, page - 1), disabled: page === 1 }
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => setPage(item.target)}
              style={{
                minWidth: '70px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                backgroundColor: item.disabled ? '#f8f9fa' : '#ffffff',
                color: item.disabled ? '#adb5bd' : '#495057',
                cursor: item.disabled ? 'not-allowed' : 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}

          {getPageNumbers().map(pageNum => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setPage(pageNum)}
              style={{
                minWidth: '42px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: pageNum === page ? '1px solid #0d6efd' : '1px solid #ced4da',
                backgroundColor: pageNum === page ? '#0d6efd' : '#ffffff',
                color: pageNum === page ? '#ffffff' : '#495057',
                cursor: 'pointer'
              }}
            >
              {pageNum}
            </button>
          ))}

          {[
            { label: 'Next', target: Math.min(lastPage, page + 1), disabled: page === lastPage },
            { label: 'Last', target: lastPage, disabled: page === lastPage }
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => setPage(item.target)}
              style={{
                minWidth: '70px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                backgroundColor: item.disabled ? '#f8f9fa' : '#ffffff',
                color: item.disabled ? '#adb5bd' : '#495057',
                cursor: item.disabled ? 'not-allowed' : 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #dee2e6' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Showing {start} - {end} of {total} recipients
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedRows.length === 0}
            onClick={handleSelect}
          >
            Select {selectedRows.length} Recipients
          </button>
        </div>
      </div>
    </Modal>
  )
}
*/

import { useState, useEffect } from 'react'
import { Modal } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'

export default function AllocateRecipientsModal({ isOpen, onClose, project, projectType = 'regular', location, district, centre, callerId, onSelect, initialSelected = [] }) {
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState(initialSelected.map(String))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    if (isOpen) {
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(today.getDate() - 7)

      setToDate(today.toISOString().split('T')[0])
      setFromDate(weekAgo.toISOString().split('T')[0])
      setPage(1)
      setSelectedRows(initialSelected.map(String))
    }
  }, [isOpen, initialSelected])

  useEffect(() => {
    const hasSelectionContext = project && ((projectType === 'written' && district && centre) || (projectType !== 'written' && location))
    if (isOpen && hasSelectionContext && fromDate && toDate) {
      fetchRecipients()
    }
  }, [isOpen, project, projectType, location, district, centre, page, pageSize, search, fromDate, toDate])

  const fetchRecipients = async () => {
    setLoading(true)
    try {
      const params = {
        project,
        search: search || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        offset: (page - 1) * pageSize,
        limit: pageSize
      }

      if (projectType === 'written') {
        params.district = district
        params.centre = centre
      } else {
        params.location = location
      }

      const res = await recruiterAPI.getRecipients(params)
      const data = res.data?.data || {}
      const items = data.items || []
      setRecipients(items)
      setTotal(data.total || 0)
    } catch (err) {
      setRecipients([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const toggleRecipient = (id) => {
    const sid = String(id)
    setSelectedRows(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])
  }

  const toggleSelectAllVisible = () => {
    const visibleIds = recipients.map(r => String(r.id))
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedRows.includes(id))
    if (allSelected) {
      setSelectedRows(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      setSelectedRows(prev => [...new Set([...prev, ...visibleIds])])
    }
  }

  const handleSelect = () => {
    const recipientIds = [...new Set(selectedRows.map(String))]
    onSelect?.(recipientIds)
    onClose()
  }

  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = total === 0 ? 0 : Math.min(page * pageSize, total)

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2))
    let endPage = Math.min(lastPage, startPage + maxVisible - 1)

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    for (let i = startPage; i <= endPage; i++) pages.push(i)
    return pages
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Allocate Recipients" maxWidth="1200px">
      {/* Search and Filter Section */}
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Search</label>
            <input
              className="form-control"
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>From Date</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>To Date</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Page Size</label>
            <select
              className="form-control"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Total Recipients: {total}</strong> |
            <strong style={{ color: '#007bff', marginLeft: '8px' }}>Selected: {selectedRows.length}</strong>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setSearch('')
              setFromDate('')
              setToDate('')
              setPage(1)
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Simple table view */}
      <div style={{ maxHeight: '500px', overflowY: 'auto', marginBottom: '20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading recipients...</div>
        ) : recipients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No recipients found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={recipients.length > 0 && recipients.every(r => selectedRows.includes(String(r.id)))}
                    onChange={toggleSelectAllVisible}
                  />
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Phone</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Aadhaar</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                {/* <th style={{ padding: '8px 12px', textAlign: 'left' }}>Time Slot</th> */}
              </tr>
            </thead>
            <tbody>
              {recipients.map((recipient) => (
                <tr key={recipient.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(String(recipient.id))}
                      onChange={() => toggleRecipient(recipient.id)}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>{recipient.id}</td>
                  <td style={{ padding: '8px 12px' }}>{recipient.name || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{recipient.phone || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{recipient.email || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{recipient.aadhaar || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>{recipient.date || '-'}</td>
                  {/* <td style={{ padding: '8px 12px' }}>{recipient.time_slot || '-'}</td> */}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #dee2e6' }}>
          {[{ label: 'First', target: 1, disabled: page === 1 }, { label: 'Previous', target: Math.max(1, page - 1), disabled: page === 1 }].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => setPage(item.target)}
              style={{
                minWidth: '70px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                backgroundColor: item.disabled ? '#f8f9fa' : '#ffffff',
                color: item.disabled ? '#adb5bd' : '#495057',
                cursor: item.disabled ? 'not-allowed' : 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}

          {getPageNumbers().map(pageNum => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setPage(pageNum)}
              style={{
                minWidth: '42px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: pageNum === page ? '1px solid #0d6efd' : '1px solid #ced4da',
                backgroundColor: pageNum === page ? '#0d6efd' : '#ffffff',
                color: pageNum === page ? '#ffffff' : '#495057',
                cursor: 'pointer'
              }}
            >
              {pageNum}
            </button>
          ))}

          {[{ label: 'Next', target: Math.min(lastPage, page + 1), disabled: page === lastPage }, { label: 'Last', target: lastPage, disabled: page === lastPage }].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => setPage(item.target)}
              style={{
                minWidth: '70px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid #ced4da',
                backgroundColor: item.disabled ? '#f8f9fa' : '#ffffff',
                color: item.disabled ? '#adb5bd' : '#495057',
                cursor: item.disabled ? 'not-allowed' : 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #dee2e6' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Showing {start} - {end} of {total} recipients
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedRows.length === 0}
            onClick={handleSelect}
          >
            Select {selectedRows.length} Recipients
          </button>
        </div>
      </div>
    </Modal>
  )
}