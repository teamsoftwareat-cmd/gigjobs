import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader, Card, Button, LoadingOverlay } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const predayChecklistTemplate = [
  { id: 'preday-1', label: "Confirm all operators are ready for tomorrow's exam" },
  { id: 'preday-2', label: 'Check for any dropouts / absentee staff (mention remarks)', hasRemarks: true },
  { id: 'preday-3', label: 'Have you visited centre and met principal and explained biometric process' },
  { id: 'preday-4', label: 'All tablets are fully charged' },
  { id: 'preday-5', label: 'Tables & chairs arranged at venue' },
  { id: 'preday-6', label: 'Wi-Fi & CCTV camera installation completed' },
  { id: 'preday-7', label: 'Candidate data downloaded (Morning & Evening shifts)' },
  { id: 'preday-8', label: 'Operator kits ready (Tablet + Biometric device + Accessories)' },
  { id: 'preday-9', label: 'ID Cards & Jackets available for all staff' },
  { id: 'preday-10', label: 'Recee certificate filled and signature of principle done' },
  { id: 'preday-11', label: 'Check if extra inventory required (mention remarks)', hasRemarks: true },
  { id: 'preday-12', label: 'Have you informed all staff to reported by 6:00 AM Sharp' },
]

const examChecklistTemplate = [
  { id: 'exam-1', label: 'All operators reached the venue' },
  { id: 'exam-2', label: 'Attendance marked for all staff' },
  { id: 'exam-3', label: 'Tablets fully charged' },
  { id: 'exam-4', label: 'Chargers / power banks carried' },
  { id: 'exam-5', label: 'Devices functioning properly' },
  { id: 'exam-6', label: 'Staff wearing ID cards' },
  { id: 'exam-7', label: 'Staff wearing jackets/uniform' },
  { id: 'exam-8', label: 'Tables & chairs arranged properly' },
  { id: 'exam-9', label: 'Biometric devices connected and working' },
  { id: 'exam-10', label: 'WiFi cameras installed and turned ON' },
  { id: 'exam-11', label: 'System ready for candidate verification' },
  { id: 'exam-12', label: 'MORNING SHIFT BIOMETRIC का पूरा DATA SYNC (12PM PM TAK)' },
  { id: 'exam-13', label: 'MORNING SHIFT BIOMETRIC ATTENDANCE COUNT (SCHOOL COUNT)' },
  { id: 'exam-14', label: 'MORNING SHIFT परीक्षा के बाद COMPLETION CERTIFICATE पर PRINCIPAL से COUNT लिखवा कर SIGN जरूर कराना है।' },
  { id: 'exam-15', label: 'AFTERNOON SHIFT BIOMETRIC का पूरा DATA SYNC (12PM PM TAK)' },
  { id: 'exam-16', label: 'AFTERNOON SHIFT BIOMETRIC ATTENDANCE COUNT (SCHOOL COUNT)' },
  { id: 'exam-17', label: 'AFTERNOON SHIFT परीक्षा के बाद COMPLETION CERTIFICATE पर PRINCIPAL से COUNT लिखवा कर SIGN जरूर कराना है।' },
  { id: 'exam-18', label: 'सेंटर छोड़ने से सभी किट (All tabs and Inventory) अपने लोकेशन हेड को कंट्रोल रूम में जमा करा दें या नहीं।' },
]

function normalizeSelectionOptions(resp, fallbackLabelKey = 'title') {
  const payload = resp?.data ?? resp
  const raw = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.records)
        ? payload.records
        : Array.isArray(payload)
          ? payload
          : []

  return raw
    .map((item) => {
      if (!item) return null
      if (typeof item === 'object') {
        const label = String(item[fallbackLabelKey] ?? item.title ?? item.name ?? item.label ?? item.venue ?? item.location ?? item.value ?? '')
        const value = fallbackLabelKey === 'venue'
          ? label
          : String(item.id ?? item.value ?? item.key ?? item.title_id ?? item.titleId ?? label)
        const countValue = item.count ?? item.recipientCount ?? item.total ?? item.available_count
        const count = Number(countValue)
        return value ? { value, label, count: Number.isFinite(count) ? count : undefined } : null
      }
      const value = String(item || '')
      return value ? { value, label: value, count: undefined } : null
    })
    .filter(Boolean)
}

export default function VerifierChecklistPage() {
  const { alert } = useAlert()
  const [loading, setLoading] = useState(false)
  const [titles, setTitles] = useState([])
  const [titlesRaw, setTitlesRaw] = useState([])
  const [selectedTitle, setSelectedTitle] = useState('')
  const [venues, setVenues] = useState([])
  const [selectedVenue, setSelectedVenue] = useState('')
  const [centresList, setCentresList] = useState([])
  const [selectedCentre, setSelectedCentre] = useState('ALL')
  const [centreChecklists, setCentreChecklists] = useState([])
  const [day, setDay] = useState('preday')
  const exportRef = useRef(null)

  const fetchTitles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await recruiterAPI.getVerificationTeamDatabaseRecords()
      const payload = res?.data ?? res
      const raw = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []
      setTitlesRaw(raw)
      setTitles(normalizeSelectionOptions(raw))
    } catch (err) {
      console.error('Failed to load titles', err)
      alert('Failed to load titles')
      setTitles([])
      setTitlesRaw([])
    } finally {
      setLoading(false)
    }
  }, [alert])

  const fetchVenues = useCallback(async (titleId) => {
    if (!titleId) return
    try {
      const res = await recruiterAPI.getVerificationTeamDatabaseVenueRecords(titleId)
      const payload = res?.data ?? res
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []
      setVenues(normalizeSelectionOptions(list, 'venue'))
    } catch (err) {
      console.error('Failed to load venues', err)
      alert('Failed to load venues')
      setVenues([])
    }
  }, [alert])

  const loadVenueChecklists = useCallback(async (titleId, venueName, centreKeyParam = 'ALL') => {
    if (!titleId || !venueName) return
    setCentreChecklists([])
    try {
      setLoading(true)
      const resp = await recruiterAPI.getVerifierCenters(titleId, venueName)
      const raw = resp?.data ?? resp
      const centres = Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw)
            ? raw
            : []

      const normalizedCentres = centres.map((centre) => ({
        id: centre.id || centre.centreCode || centre.code || centre.name,
        centreKey: centre.centreCode || centre.centre_code || centre.code || centre.id || centre.centre || centre.name,
        name: centre.name || centre.centre || centre.centreName || centre.location || centre.locationName || '',
      }))
      setCentresList(normalizedCentres)

      const toFetch = centreKeyParam === 'ALL' ? normalizedCentres.map((c) => c.centreKey) : [centreKeyParam]

      const checklistPromises = toFetch.map(async (centreKey) => {
        try {
          const r = await recruiterAPI.getVerifierChecklist(titleId, venueName, centreKey)
          const payload = r?.data ?? r
          const items = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.checklist)
                ? payload.checklist
                : Array.isArray(payload?.data?.checklist)
                  ? payload.data.checklist
                  : Array.isArray(payload?.data)
                    ? payload.data
                    : []
          return { centreKey, items }
        } catch (err) {
          return { centreKey, items: [] }
        }
      })

      const results = await Promise.all(checklistPromises)
      setCentreChecklists(results.map((r) => ({ centreKey: r.centreKey, items: r.items || [] })))
    } catch (err) {
      console.error('Failed to load centre checklists', err)
      alert('Failed to load centre checklists')
      setCentreChecklists([])
    } finally {
      setLoading(false)
    }
  }, [alert])

  // Helpers to normalize checklist data and merge with templates
  const normalizeChecklistBoolean = (value) => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      return ['1', 'true', 'yes', 'y', 'checked', 'on'].includes(normalized)
    }
    return false
  }

  const extractChecklistItems = (payload) => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.items)) return payload.items
    if (Array.isArray(payload?.checklist)) return payload.checklist
    if (Array.isArray(payload?.data)) return payload.data
    if (payload?.data && typeof payload.data === 'object') return extractChecklistItems(payload.data)
    return []
  }

  const mergeChecklistItems = (serverItems, template) => {
    const normalized = Array.isArray(serverItems) ? serverItems : []
    const baseTemplate = template || (day === 'exam' ? examChecklistTemplate : predayChecklistTemplate)
    return baseTemplate.map((t, idx) => {
      const serverMatch = normalized.find((item) => String(item.id || item.key || item.label).toLowerCase() === String(t.id || t.key || t.label).toLowerCase()) || (normalized[idx] || null)
      return {
        id: t.id || serverMatch?.id || serverMatch?.key,
        label: t.label || serverMatch?.label || serverMatch?.name || '',
        checked: normalizeChecklistBoolean(serverMatch?.checked ?? serverMatch?.isChecked ?? serverMatch?.is_checked ?? serverMatch?.value),
        note: serverMatch?.note || serverMatch?.remarks || serverMatch?.remark || '',
      }
    })
  }

  const getTemplateForDay = (d) => {
    const normalized = String(d || '').trim().toLowerCase()
    if (!normalized) return predayChecklistTemplate
    // accept variants like 'exam', 'examday', 'exam_day', 'eventday'
    if (normalized.includes('exam')) return examChecklistTemplate
    if (normalized.includes('pre')) return predayChecklistTemplate
    // fallback: if it contains 'day' but not 'pre', treat as exam if it mentions 'exam'
    return predayChecklistTemplate
  }

  const getExportHeader = () => {
    const titleLabel = titles.find((t) => String(t.value) === String(selectedTitle))?.label || selectedTitle || ''
    const checklistLabel = String(day || '').toLowerCase() === 'exam'
      ? 'Exam Day Checklist'
      : 'Control Room Checklist Pre Exam'
    return { titleLabel, checklistLabel }
  }

  const buildExportData = () => {
    const template = getTemplateForDay(day)
    const masterItems = (template || []).map((t) => ({ id: String(t.id ?? t.key ?? t.label ?? '').trim(), label: String(t.label ?? t.name ?? '') }))

    const mergedPerCentre = centreChecklists.map((c) => {
      const rawItems = extractChecklistItems(c.items) || []
      const items = rawItems.map((it) => ({
        id: String(it.id ?? it.key ?? it.label ?? ''),
        label: String(it.label ?? it.name ?? it.text ?? ''),
        checked: normalizeChecklistBoolean(it.checked ?? it.isChecked ?? it.is_checked ?? it.value),
        note: String(it.note ?? it.remarks ?? it.remark ?? ''),
      }))
      return { centreKey: c.centreKey, items }
    })

    const centreChunks = []
    const maxCentresPerPage = 8
    for (let i = 0; i < mergedPerCentre.length; i += maxCentresPerPage) {
      centreChunks.push(mergedPerCentre.slice(i, i + maxCentresPerPage))
    }

    return { masterItems, centreChunks }
  }

  useEffect(() => {
    fetchTitles()
  }, [fetchTitles])

  const exportVenuePdf = async () => {
    if (!selectedVenue || !centreChecklists || centreChecklists.length === 0) return
    setLoading(true)

    try {
      const { titleLabel, checklistLabel } = getExportHeader()
      const { masterItems, centreChunks } = buildExportData()
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      let pageIndex = 0

      for (const chunk of centreChunks) {
        const wrapper = document.createElement('div')
        wrapper.style.position = 'absolute'
        wrapper.style.top = '-9999px'
        wrapper.style.left = '-9999px'
        wrapper.style.backgroundColor = '#ffffff'
        wrapper.style.padding = '16px'
        wrapper.style.width = '1200px'
        wrapper.style.boxSizing = 'border-box'

        const header = document.createElement('div')
        header.style.marginBottom = '16px'
        header.style.padding = '10px'
        header.style.background = '#ffffff'
        header.style.border = '1px solid #e2e8f0'
        header.style.fontFamily = 'Arial, sans-serif'
        header.innerHTML = `
          <div style="font-size:16px;font-weight:700;text-align:center;margin-bottom:6px;">${checklistLabel}</div>
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:12px;">
            <span><strong>Title:</strong> ${titleLabel}</span>
            <span><strong>Venue:</strong> ${selectedVenue}</span>
            <span><strong>Centre:</strong> ${chunk.length === centreChunks[0].length && centreChunks.length === 1 ? (selectedCentre === 'ALL' ? 'All centres' : selectedCentre) : `Page ${pageIndex + 1} centres`}</span>
          </div>
        `
        wrapper.appendChild(header)

        const table = document.createElement('table')
        table.style.borderCollapse = 'collapse'
        table.style.width = '100%'
        table.style.fontFamily = 'Arial, sans-serif'
        const thead = document.createElement('thead')
        const headerRow = document.createElement('tr')
        const headings = ['S.No', 'Checklist Item', ...chunk.map((centre) => centre.centreKey)]
        headings.forEach((text, index) => {
          const th = document.createElement('th')
          th.style.border = '1px solid #ddd'
          th.style.padding = '8px'
          th.style.background = index < 2 ? '#f7f7f9' : '#f1f5f9'
          th.style.textAlign = 'center'
          th.style.fontSize = '12px'
          th.innerText = text
          headerRow.appendChild(th)
        })
        thead.appendChild(headerRow)
        table.appendChild(thead)

        const tbody = document.createElement('tbody')
        masterItems.forEach((mi, idx) => {
          const row = document.createElement('tr')
          const idxCell = document.createElement('td')
          idxCell.style.border = '1px solid #eee'
          idxCell.style.padding = '8px'
          idxCell.style.textAlign = 'center'
          idxCell.style.fontSize = '12px'
          idxCell.innerText = String(idx + 1)
          row.appendChild(idxCell)

          const labelCell = document.createElement('td')
          labelCell.style.border = '1px solid #eee'
          labelCell.style.padding = '8px'
          labelCell.style.fontSize = '12px'
          labelCell.innerText = mi.label
          row.appendChild(labelCell)

          chunk.forEach((centre) => {
            const cell = document.createElement('td')
            cell.style.border = '1px solid #eee'
            cell.style.padding = '8px'
            cell.style.textAlign = 'center'
            cell.style.fontSize = '12px'

            const item = (centre.items || []).find((it) => String(it.id || it.label) === String(mi.id))
            const checked = item ? item.checked : false
            const note = item ? item.note : ''
            const checkbox = document.createElement('span')
            checkbox.style.display = 'inline-block'
            checkbox.style.width = '16px'
            checkbox.style.height = '16px'
            checkbox.style.border = '1px solid #999'
            checkbox.style.margin = '0 auto'
            checkbox.style.verticalAlign = 'middle'
            checkbox.style.backgroundColor = checked ? '#22c55e' : 'transparent'
            if (checked) checkbox.style.borderColor = '#22c55e'
            cell.appendChild(checkbox)
            if (note) {
              const noteDiv = document.createElement('div')
              noteDiv.style.fontSize = '10px'
              noteDiv.style.color = '#666'
              noteDiv.style.marginTop = '4px'
              noteDiv.style.whiteSpace = 'normal'
              noteDiv.innerText = note
              cell.appendChild(noteDiv)
            }
            row.appendChild(cell)
          })
          tbody.appendChild(row)
        })
        table.appendChild(tbody)
        wrapper.appendChild(table)
        document.body.appendChild(wrapper)

        const canvas = await html2canvas(wrapper, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
        })
        document.body.removeChild(wrapper)

        const imgData = canvas.toDataURL('image/png')
        const imgProps = pdf.getImageProperties(imgData)
        const imgWidth = pdfWidth
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width

        if (pageIndex > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
        pdf.setFontSize(9)
        pdf.text(`Page ${pageIndex + 1} of ${centreChunks.length}`, pdfWidth - 20, pdfHeight - 10, { align: 'right' })
        pageIndex += 1
      }

      const fileName = `Checklist-${String(selectedVenue).replace(/\s+/g, '_')}.pdf`
      pdf.save(fileName)
    } catch (err) {
      console.error('Failed to export snapshot PDF', err)
      alert('Failed to export snapshot PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="Verifier Checklists" />
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ minWidth: 160 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Title</label>
            <select value={selectedTitle} onChange={(e) => {
              const v = e.target.value
              setSelectedTitle(v)
              setSelectedVenue('')
              setCentresList([])
              setCentreChecklists([])
              // derive day from titlesRaw (try match by id or by label)
              const opt = titles.find((x) => String(x.value) === String(v))
              let raw = null
              if (opt) {
                raw = titlesRaw.find((it) => String(it.id || it.title_id || it.value || it.key || it.title) === String(v) || String(it.title || it.name || it.label) === String(opt.label))
              }
              if (!raw) raw = titlesRaw.find((it) => String(it.id || it.title_id || it.value || it.key || it.title) === String(v))
              // Prefer explicit `call_day` from server (e.g., 'examday' or 'preday')
              let derivedDay = ''
              if (raw) derivedDay = String(raw?.call_day ?? raw?.day ?? raw?.projectDay ?? raw?.project_day ?? raw?.day_type ?? raw?.type ?? raw?.day ?? '').trim().toLowerCase()
              if (!derivedDay) derivedDay = 'preday'
              // normalize variants to 'exam' or 'preday'
              if (derivedDay.includes('exam')) derivedDay = 'exam'
              else if (derivedDay.includes('pre')) derivedDay = 'preday'
              setDay(derivedDay)
              if (v) fetchVenues(v)
            }} style={{ width: '100%' }}>
              <option value="">-- Select title --</option>
              {titles.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Venue</label>
            <select value={selectedVenue} onChange={(e) => {
              const v = e.target.value
              setSelectedVenue(v)
              setSelectedCentre('ALL')
              setCentreChecklists([])
              if (selectedTitle && v) loadVenueChecklists(selectedTitle, v, 'ALL')
            }} style={{ width: '100%' }}>
              <option value="">-- Select venue --</option>
              {venues.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>Centre</label>
            <select value={selectedCentre} onChange={(e) => {
              const v = e.target.value
              setSelectedCentre(v)
              if (selectedTitle && selectedVenue) loadVenueChecklists(selectedTitle, selectedVenue, v === 'ALL' ? 'ALL' : v)
            }} style={{ width: '100%' }}>
              <option value="ALL">All centres</option>
              {centresList.map((c) => <option key={c.centreKey || c.id} value={c.centreKey}>{c.centreKey}</option>)}
            </select>
          </div>

          <div style={{ marginLeft: 'auto' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => exportVenuePdf()} disabled={!centreChecklists || centreChecklists.length === 0}>Export PDF</Button>
            </div>
          </div>
        </div>

        <LoadingOverlay visible={loading} />

        <div style={{ overflowX: 'auto' }}>
          {(!selectedTitle || !selectedVenue) ? (
            <div style={{ color: '#666' }}>Select title and venue to load checklists</div>
          ) : (
            (() => {
              // determine template
              const template = getTemplateForDay(day)
              if (!template || template.length === 0) {
                return <div style={{ color: '#666' }}>No checklist template for this day ({day})</div>
              }

              // prepare merged data per centre from server items only (no templates)
              const mergedPerCentre = (centreChecklists && centreChecklists.length > 0)
                ? centreChecklists.map((c) => {
                  const rawItems = extractChecklistItems(c.items) || []
                  const items = rawItems.map((it) => ({
                    id: it.id || it.key || it.label || '',
                    label: it.label || it.name || it.text || '',
                    checked: normalizeChecklistBoolean(it.checked ?? it.isChecked ?? it.is_checked ?? it.value),
                    note: it.note || it.remarks || it.remark || ''
                  }))
                  return { centreKey: c.centreKey, items, raw: rawItems }
                })
                : []

              // Use template as authoritative labels/order for UI table as well
              let uiEffectiveDay = String(day || '').trim().toLowerCase()
              if (!uiEffectiveDay && selectedTitle && Array.isArray(titlesRaw)) {
                const opt = titles.find((t) => String(t.value) === String(selectedTitle))
                let raw = null
                if (opt) {
                  raw = titlesRaw.find((it) => String(it.id || it.title_id || it.value || it.key || it.title) === String(selectedTitle) || String(it.title || it.name || it.label) === String(opt.label))
                }
                if (!raw) raw = titlesRaw.find((it) => String(it.id || it.title_id || it.value || it.key || it.title) === String(selectedTitle))
                uiEffectiveDay = String(raw?.call_day ?? raw?.day ?? raw?.projectDay ?? raw?.project_day ?? raw?.day_type ?? raw?.type ?? '').trim().toLowerCase() || ''
              }
              const templateRows = getTemplateForDay(uiEffectiveDay) || []
              const masterItems = templateRows.map((t) => ({ id: String(t.id ?? t.key ?? t.label ?? '').trim(), label: String(t.label ?? t.name ?? '') }))

              // columns: item index, description, then one column per centre
              const col1Width = 60
              const col2Width = 420
              if (!masterItems || masterItems.length === 0) {
                return <div style={{ color: '#666' }}>No checklist items available from server for this venue/centres.</div>
              }

              const { titleLabel, checklistLabel } = getExportHeader()
              return (
                <div style={{ overflowX: 'auto', position: 'relative' }} ref={exportRef}>
                  <div style={{ marginBottom: 16, padding: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{checklistLabel}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                      <span><strong>Title:</strong> {titleLabel}</span>
                      <span><strong>Venue:</strong> {selectedVenue}</span>
                      <span><strong>Centre:</strong> {selectedCentre === 'ALL' ? 'All centres' : selectedCentre}</span>
                    </div>
                  </div>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ border: '1px solid #ddd', padding: 8, background: '#f7f7f9', position: 'sticky', left: 0, zIndex: 3, width: col1Width, textAlign: 'center' }}>S.No</th>
                        <th style={{ border: '1px solid #ddd', padding: 8, background: '#f7f7f9', position: 'sticky', left: col1Width, zIndex: 3, minWidth: col2Width }}>Checklist Item</th>
                        {mergedPerCentre.map((c, ci) => (
                          <th key={c.centreKey} style={{ border: '1px solid #ddd', padding: 8, background: '#f1f5f9', textAlign: 'center' }}>{c.centreKey}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {masterItems.map((mi, idx) => (
                        <tr key={mi.id || idx}>
                          <td style={{ border: '1px solid #eee', padding: 8, width: col1Width, textAlign: 'center', position: 'sticky', left: 0, background: '#fff', zIndex: 2 }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #eee', padding: 8, position: 'sticky', left: col1Width, background: '#fff', zIndex: 2, minWidth: col2Width }}>{mi.label}</td>
                          {mergedPerCentre.map((c) => {
                            const item = (c.items || []).find((it) => String(it.id || it.label) === String(mi.id))
                            const checked = item ? item.checked : false
                            const note = item ? item.note : ''
                            return (
                              <td key={`${c.centreKey}-${mi.id || idx}`} style={{ border: '1px solid #eee', padding: 8, textAlign: 'center', minWidth: 120 }}>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <input type="checkbox" checked={!!checked} readOnly />
                                </div>
                                {note ? <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{note}</div> : null}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()
          )}
        </div>
      </Card>
    </div>
  )
}
