import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, Button, LoadingOverlay } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'

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
        return value ? { value, label, count: Number.isFinite(count) ? count : undefined, raw: item } : null
      }
      const value = String(item || '')
      return value ? { value, label: value, count: undefined, raw: item } : null
    })
    .filter(Boolean)
}

function getNestedValue(obj, keys = []) {
  for (const key of keys) {
    if (!key) continue
    const value = obj?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getDateOnly(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const text = String(value)
    return text.length >= 10 ? text.slice(0, 10) : text
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatActivationValue(value) {
  if (!value) return 'No activation time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function getActivationValue(item) {
  const source = item?.raw ?? item
  return getNestedValue(source, ['activation_date_time', 'activationDateTime', 'activation_date', 'activationDate', 'date'])
}

export default function VerificationDashboardPage() {
  const { alert } = useAlert()
  const [loading, setLoading] = useState(false)
  const [titles, setTitles] = useState([])
  const [titlesRaw, setTitlesRaw] = useState([])
  const [selectedDate, setSelectedDate] = useState(getDateOnly(new Date()))
  const [selectedTitle, setSelectedTitle] = useState('')
  const [venues, setVenues] = useState([])
  const [selectedVenue, setSelectedVenue] = useState('')
  const [centresList, setCentresList] = useState([])
  const [centreStats, setCentreStats] = useState({})
  const [selectedCentre, setSelectedCentre] = useState('ALL')
  const [summary, setSummary] = useState({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
  const [activeView, setActiveView] = useState('reached')
  const [listRows, setListRows] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [designationFilter, setDesignationFilter] = useState('')
  const [venueSearchTerm, setVenueSearchTerm] = useState('')
  const [centreSearchTerm, setCentreSearchTerm] = useState('')
  const [venueStats, setVenueStats] = useState({})
  const [pagination, setPagination] = useState({ page: 1, offset: 0, limit: 10, total: 0 })

  const fetchTitles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await recruiterAPI.getVerificationTeamDatabaseRecordsWithTimer()
      const payload = res?.data ?? res
      const raw = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : []
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

  const fetchVenueSummaries = useCallback(async (titleId, venueItems = []) => {
    if (!titleId || !venueItems.length) {
      setVenueStats({})
      return
    }

    try {
      const results = await Promise.all(
        venueItems.map(async (venueItem) => {
          const response = await recruiterAPI.getVerificationDashboardSummary(titleId, venueItem.value, undefined)
          const payload = response?.data ?? response
          const data = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : payload

          return {
            key: venueItem.value,
            absentCount: toNumber(getNestedValue(data, ['absent_count', 'absentCount', 'absent', 'absent_total']), 0),
            replacedCount: toNumber(getNestedValue(data, ['replaced_count', 'replacedCount', 'replaced', 'replaced_total']), 0),
            reachedCount: toNumber(getNestedValue(data, ['reached_count', 'reachedCount', 'reached']), 0),
            totalCentres: toNumber(getNestedValue(data, ['total_centres', 'totalCentres', 'centres_count', 'centresCount', 'centre_count', 'centreCount', 'total_centres_count', 'totalCentresCount']), 0),
          }
        })
      )

      setVenueStats((prev) => {
        const next = { ...prev }
        results.forEach((item) => {
          next[item.key] = item
        })
        return next
      })
    } catch (err) {
      console.error('Failed to load venue summaries', err)
    }
  }, [alert])

  const fetchVenues = useCallback(async (titleId) => {
    if (!titleId) {
      setVenues([])
      setVenueStats({})
      return
    }
    try {
      const res = await recruiterAPI.getVerificationTeamDatabaseVenueRecords(titleId)
      const payload = res?.data ?? res
      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : []
      const normalizedVenues = normalizeSelectionOptions(list, 'venue')
      setVenues(normalizedVenues)
      if (normalizedVenues.length) {
        await fetchVenueSummaries(titleId, normalizedVenues)
      } else {
        setVenueStats({})
      }
    } catch (err) {
      console.error('Failed to load venues', err)
      alert('Failed to load venues')
      setVenues([])
      setVenueStats({})
    }
  }, [alert, fetchVenueSummaries])

  const fetchCentreSummaries = useCallback(async (titleId, venueName, centreItems = []) => {
    if (!titleId || !venueName || !centreItems.length) {
      setCentreStats({})
      return
    }

    try {
      const results = await Promise.all(
        centreItems.map(async (centreItem) => {
          const centreKey = centreItem.centreKey || centreItem.id || centreItem.code || centreItem.name || ''
          if (!centreKey) return null

          const response = await recruiterAPI.getVerificationDashboardSummary(titleId, venueName, centreKey)
          const payload = response?.data ?? response
          const data = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : payload

          return {
            key: centreKey,
            absentCount: toNumber(getNestedValue(data, ['absent_count', 'absentCount', 'absent', 'absent_total']), 0),
            replacedCount: toNumber(getNestedValue(data, ['replaced_count', 'replacedCount', 'replaced', 'replaced_total']), 0),
            reachedCount: toNumber(getNestedValue(data, ['reached_count', 'reachedCount', 'reached']), 0),
          }
        })
      )

      const nextStats = results.filter(Boolean).reduce((acc, item) => {
        acc[item.key] = item
        return acc
      }, {})

      setCentreStats((prev) => ({ ...prev, ...nextStats }))
    } catch (err) {
      console.error('Failed to load centre summaries', err)
    }
  }, [])

  const fetchCentres = useCallback(async (titleId, venueName) => {
    if (!titleId || !venueName) {
      setCentresList([])
      setCentreStats({})
      return
    }

    try {
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
      if (normalizedCentres.length) {
        await fetchCentreSummaries(titleId, venueName, normalizedCentres)
      } else {
        setCentreStats({})
      }
    } catch (err) {
      console.error('Failed to load centres', err)
      alert('Failed to load centres')
      setCentresList([])
      setCentreStats({})
    }
  }, [alert, fetchCentreSummaries])

  const fetchSummary = useCallback(async (titleId, venueName, centreKey = 'ALL') => {
    if (!titleId) {
      setSummary({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
      return
    }

    try {
      const response = await recruiterAPI.getVerificationDashboardSummary(
        titleId,
        venueName || undefined,
        centreKey === 'ALL' ? undefined : centreKey
      )
      const payload = response?.data ?? response
      const data = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : payload

      const totalCentres = toNumber(getNestedValue(data, ['total_centres', 'totalCentres', 'centres_count', 'centresCount', 'centre_count', 'centreCount', 'total_centres_count', 'totalCentresCount']), 0)
      const absentCount = toNumber(getNestedValue(data, ['absent_count', 'absentCount', 'absent', 'absent_total']), 0)
      const replacedCount = toNumber(getNestedValue(data, ['replaced_count', 'replacedCount', 'replaced', 'replaced_total']), 0)
      const reachedCount = toNumber(getNestedValue(data, ['reached_count', 'reachedCount', 'reached']), 0)

      setSummary((prev) => ({
        totalCentres: centreKey === 'ALL' ? totalCentres : prev.totalCentres,
        absentCount,
        replacedCount,
        reachedCount,
      }))
    } catch (err) {
      console.error('Failed to load verification summary', err)
      setSummary({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
    }
  }, [centresList.length])

  const fetchList = useCallback(async (view, titleId, venueName, centreKey = 'ALL', options = {}) => {
    if (!titleId || !view) return
    const offset = options.offset ?? 0
    const limit = options.limit ?? 10
    const search = options.search ?? ''
    const designation = options.designation ?? ''

    setListLoading(true)
    try {
      const response = await recruiterAPI.getVerificationDashboardItems(
        view,
        titleId,
        venueName || undefined,
        centreKey === 'ALL' ? undefined : centreKey,
        { offset, limit, search, designation }
      )
      const payload = response?.data ?? response
      const dataPayload = payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : payload
      const list = Array.isArray(dataPayload?.data)
        ? dataPayload.data
        : Array.isArray(dataPayload?.items)
          ? dataPayload.items
          : Array.isArray(dataPayload?.records)
            ? dataPayload.records
            : Array.isArray(dataPayload)
              ? dataPayload
              : []
      const totalCount = toNumber(
        getNestedValue(dataPayload, ['total', 'count', 'total_count', 'totalCount', 'meta.total', 'meta.count']) ?? getNestedValue(payload, ['total', 'count', 'total_count', 'totalCount', 'meta.total', 'meta.count']),
        list.length
      )

      setListRows(list)
      setPagination((prev) => ({ ...prev, offset, limit, total: totalCount, page: Math.floor(offset / limit) + 1 }))
    } catch (err) {
      console.error(`Failed to load ${view} records`, err)
      setListRows([])
      setPagination((prev) => ({ ...prev, offset, limit, total: 0, page: 1 }))
    } finally {
      setListLoading(false)
    }
  }, [])

  const sortedTitles = useMemo(() => {
    return [...titles].sort((left, right) => {
      const leftTime = new Date(getActivationValue(left)).getTime()
      const rightTime = new Date(getActivationValue(right)).getTime()
      const leftIsValid = Number.isFinite(leftTime)
      const rightIsValid = Number.isFinite(rightTime)

      if (!leftIsValid && !rightIsValid) return 0
      if (!leftIsValid) return 1
      if (!rightIsValid) return -1
      return leftTime - rightTime
    })
  }, [titles])

  const visibleTitles = useMemo(() => {
    if (!selectedDate) return sortedTitles
    return sortedTitles.filter((item) => getDateOnly(getActivationValue(item)) === selectedDate)
  }, [selectedDate, sortedTitles])

  const previewTitles = useMemo(() => visibleTitles.slice(0, 5), [visibleTitles])

  const totalPages = useMemo(() => {
    const safeLimit = Math.max(1, pagination.limit || 10)
    return Math.max(1, Math.ceil((pagination.total || 0) / safeLimit))
  }, [pagination.limit, pagination.total])

  const pageWindow = useMemo(() => {
    const currentPage = Math.min(Math.max(1, pagination.page || 1), totalPages)
    const start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, currentPage + 2)
    const pages = []
    for (let page = start; page <= end; page += 1) {
      pages.push(page)
    }
    return pages
  }, [pagination.page, totalPages])

  const filteredVenues = useMemo(() => {
    const query = venueSearchTerm.trim().toLowerCase()
    if (!query) return venues
    return venues.filter((item) => String(item.label).toLowerCase().includes(query))
  }, [venueSearchTerm, venues])

  const filteredCentres = useMemo(() => {
    const query = centreSearchTerm.trim().toLowerCase()
    if (!query) return centresList
    return centresList.filter((centre) => {
      const label = `${centre.centreKey || centre.id || centre.code || ''} ${centre.name || centre.centreName || centre.centre || ''}`.toLowerCase()
      return label.includes(query)
    })
  }, [centreSearchTerm, centresList])

  const selectedTitleDetails = useMemo(() => {
    const match = visibleTitles.find((item) => String(item.value) === String(selectedTitle))
    return match || visibleTitles[0] || null
  }, [selectedTitle, visibleTitles])

  useEffect(() => {
    fetchTitles()
  }, [fetchTitles])

  useEffect(() => {
    if (!selectedDate && titlesRaw.length) {
      const firstDate = titlesRaw
        .map((item) => getActivationValue(item))
        .map((value) => getDateOnly(value))
        .filter(Boolean)[0]

      if (firstDate) {
        setSelectedDate(firstDate)
      }
    }
  }, [selectedDate, titlesRaw])

  useEffect(() => {
    if (!titlesRaw.length) return

    const matchingTitles = sortedTitles.filter((item) => getDateOnly(getActivationValue(item)) === selectedDate)
    const fallbackTitle = matchingTitles[0] ?? sortedTitles[0]
    const shouldPickFallback = !selectedTitle || !matchingTitles.some((item) => String(item.value) === String(selectedTitle))

    if (shouldPickFallback && fallbackTitle) {
      const nextTitleValue = fallbackTitle.value
      setSelectedTitle(nextTitleValue)
      if (nextTitleValue) {
        setSelectedVenue('')
        setSelectedCentre('ALL')
        setSearchTerm('')
        setPagination({ page: 1, offset: 0, limit: 10, total: 0 })
        setSummary({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
        setListRows([])
        setCentresList([])
        fetchVenues(nextTitleValue)
      }
    }
  }, [fetchVenues, selectedDate, selectedTitle, sortedTitles, titlesRaw.length])

  useEffect(() => {
    if (!selectedTitle) {
      setSummary({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
      setListRows([])
      setPagination((prev) => ({ ...prev, total: 0, page: 1, offset: 0 }))
      return
    }

    fetchSummary(selectedTitle, selectedVenue, selectedCentre)
    fetchList(activeView, selectedTitle, selectedVenue, selectedCentre, { offset: 0, limit: pagination.limit, search: '', designation: designationFilter })
  }, [activeView, designationFilter, fetchList, fetchSummary, pagination.limit, selectedCentre, selectedTitle, selectedVenue])

  useEffect(() => {
    if (!selectedTitle || !selectedVenue) {
      setCentresList([])
      return
    }

    fetchCentres(selectedTitle, selectedVenue)
  }, [fetchCentres, selectedTitle, selectedVenue])

  const activeTitleLabel = useMemo(() => {
    const match = titles.find((item) => String(item.value) === String(selectedTitle))
    return match?.label || ''
  }, [selectedTitle, titles])

  const activeVenueLabel = useMemo(() => {
    const match = venues.find((item) => String(item.value) === String(selectedVenue))
    return match?.label || ''
  }, [selectedVenue, venues])

  const handleDateChange = (value) => {
    setSelectedDate(value)
    setSelectedTitle('')
    setSelectedVenue('')
    setSelectedCentre('ALL')
    setSearchTerm('')
    setVenueSearchTerm('')
    setCentreSearchTerm('')
    setPagination({ page: 1, offset: 0, limit: 10, total: 0 })
    setSummary({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
    setListRows([])
    setCentresList([])
    setCentreStats({})
    setVenues([])
    setVenueStats({})
  }

  const handleTitleChange = (value) => {
    setSelectedTitle(value)
    setSelectedVenue('')
    setSelectedCentre('ALL')
    setSearchTerm('')
    setVenueSearchTerm('')
    setCentreSearchTerm('')
    setPagination((prev) => ({ ...prev, page: 1, offset: 0, total: 0, limit: prev.limit || 10 }))
    setSummary({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
    setListRows([])
    setCentresList([])
    setCentreStats({})
    setVenueStats({})
    if (value) {
      fetchVenues(value)
    }
  }

  const handleVenueChange = (value) => {
    setSelectedVenue(value)
    setSelectedCentre('ALL')
    setSearchTerm('')
    setCentreSearchTerm('')
    setPagination((prev) => ({ ...prev, page: 1, offset: 0, total: 0 }))
    setSummary({ totalCentres: 0, absentCount: 0, replacedCount: 0, reachedCount: 0 })
    setListRows([])
    setCentreStats({})
    if (selectedTitle && value) {
      fetchCentres(selectedTitle, value)
      fetchSummary(selectedTitle, value, 'ALL')
      fetchList(activeView, selectedTitle, value, 'ALL', { offset: 0, limit: pagination.limit, search: '', designation: designationFilter })
    }
  }

  const handleCentreChange = (value) => {
    setSelectedCentre(value)
    setSearchTerm('')
    setPagination((prev) => ({ ...prev, page: 1, offset: 0, total: 0 }))
    setListRows([])
    if (selectedTitle && selectedVenue) {
      fetchSummary(selectedTitle, selectedVenue, value)
      fetchList(activeView, selectedTitle, selectedVenue, value, { offset: 0, limit: pagination.limit, search: '', designation: designationFilter })
    }
  }

  const handleDesignationChange = (nextDesignation) => {
    setDesignationFilter(nextDesignation)
    setPagination((prev) => ({ ...prev, page: 1, offset: 0, total: 0 }))
    if (selectedTitle) {
      fetchList(activeView, selectedTitle, selectedVenue || undefined, selectedCentre, { offset: 0, limit: pagination.limit, search: searchTerm, designation: nextDesignation })
    }
  }

  const triggerListView = (view) => {
    setActiveView(view)
    setPagination((prev) => ({ ...prev, page: 1, offset: 0, total: 0 }))
    if (selectedTitle) {
      fetchList(view, selectedTitle, selectedVenue || undefined, selectedCentre, { offset: 0, limit: pagination.limit, search: searchTerm, designation: designationFilter })
    }
  }

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1, offset: 0, total: 0 }))
    if (selectedTitle) {
      fetchList(activeView, selectedTitle, selectedVenue || undefined, selectedCentre, { offset: 0, limit: pagination.limit, search: searchTerm, designation: designationFilter })
    }
  }

  const handlePageChange = (nextPage) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages)
    const nextOffset = Math.max(0, (safePage - 1) * pagination.limit)
    if (selectedTitle) {
      fetchList(activeView, selectedTitle, selectedVenue || undefined, selectedCentre, { offset: nextOffset, limit: pagination.limit, search: searchTerm, designation: designationFilter })
    }
  }

  const handleEntriesChange = (nextLimit) => {
    const safeLimit = Math.max(1, nextLimit)
    setPagination((prev) => ({ ...prev, limit: safeLimit, page: 1, offset: 0, total: 0 }))
    if (selectedTitle) {
      fetchList(activeView, selectedTitle, selectedVenue || undefined, selectedCentre, { offset: 0, limit: safeLimit, search: searchTerm, designation: designationFilter })
    }
  }

  const renderKpiCard = (label, value, accent, onClick, active) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 130,
        border: active ? `2px solid ${accent}` : '1px solid #e2e8f0',
        background: active ? `${accent}10` : '#fff',
        borderRadius: 10,
        padding: 10,
        textAlign: 'left',
        cursor: 'pointer',
        boxShadow: active ? `0 8px 20px ${accent}15` : '0 4px 12px rgba(15,23,42,0.04)',
      }}
    >
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{value}</div>
    </button>
  )

  const tableColumns = useMemo(() => {
    if (activeView === 'replaced') {
      return ['S.No', 'Candidate Name', 'Aadhaar Number', 'Mobile Number', 'Venue', 'Centre', 'Designation', 'Replaced with', 'Replacement Mobile', 'Replacement Aadhaar']
    }
    return ['S.No', 'Candidate Name', 'Aadhaar Number', 'Mobile Number', 'Venue', 'Centre', 'Designation']
  }, [activeView])

  const tableRowsMapped = useMemo(() => {
    return listRows.map((row, idx) => {
      const candidateName = getNestedValue(row, ['name', 'candidate_name', 'full_name', 'employee_name', 'person_name', 'label', 'title']) || '-'
      const aadhaarNumber = getNestedValue(row, ['aadhaar', 'aadhaar_number', 'aadhaarNo', 'aadhar', 'aadhar_number', 'aadhaar_no']) || '-'
      const mobileNumber = getNestedValue(row, ['mobile', 'phone', 'contact_number', 'contact', 'phone_number', 'mobile_number']) || '-'
      const venue = getNestedValue(row, ['venue', 'venue_name', 'location', 'location_name', 'place']) || '-'
      const centre = getNestedValue(row, ['centre_name', 'centre', 'center', 'centreName', 'location', 'location_name']) || '-'
      const designation = getNestedValue(row, ['designation', 'role', 'job_role', 'designation_name']) || '-'

      if (activeView === 'replaced') {
        const replacedWith = getNestedValue(row, ['replaced_with', 'replacement_name', 'replacement_candidate_name', 'replacedWith', 'replaced_to']) || '-'
        const replacementMobile = getNestedValue(row, ['replacement_mobile', 'replacement_phone', 'replacement_mobile_number', 'replaced_mobile', 'replacement_contact']) || '-'
        const replacementAadhaar = getNestedValue(row, ['replacement_aadhaar', 'replacement_aadhaar_number', 'replaced_aadhaar', 'replacement_aadhaar_no']) || '-'
        return [idx + 1, candidateName, aadhaarNumber, mobileNumber, venue, centre, designation, replacedWith, replacementMobile, replacementAadhaar]
      }

      if (activeView === 'reached') {
        return [idx + 1, candidateName, aadhaarNumber, mobileNumber, venue, centre, designation]
      }

      return [idx + 1, candidateName, aadhaarNumber, mobileNumber, venue, centre, designation]
    })
  }, [activeView, listRows])

  return (
    <div>
      <PageHeader title="Verification Dashboard" subtitle="Monitor absent and replaced verification centres" />
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 600, minWidth: 90, fontSize: 12 }}>Activation date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              style={{ width: 120, minWidth: 110, padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', fontSize: 11 }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'column', gap: 10 }}>
            <div style={{ minWidth: 240, border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong style={{ fontSize: 13 }}>Title sheet</strong>
                <span style={{ color: '#64748b', fontSize: 11 }}>{visibleTitles.length} item{visibleTitles.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {visibleTitles.length === 0 ? (
                  <div style={{ color: '#64748b', padding: '6px 0' }}>No titles available.</div>
                ) : (
                  previewTitles.map((item) => {
                    const isActive = String(item.value) === String(selectedTitle)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleTitleChange(item.value)}
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 6,
                          minWidth: 150,
                          border: isActive ? '1px solid #2563eb' : '1px solid #e2e8f0',
                          background: isActive ? '#eff6ff' : '#fff',
                          borderRadius: 12,
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 8px 20px rgba(37, 99, 235, 0.14)' : '0 3px 10px rgba(15, 23, 42, 0.05)',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12, lineHeight: 1.2 }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.3 }}>{formatActivationValue(getActivationValue(item))}</div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div style={{ minWidth: 240, border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 13 }}>Venue sheet</strong>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{venues.length} item{venues.length === 1 ? '' : 's'}</span>
                </div>
                <input
                  type="text"
                  value={venueSearchTerm}
                  onChange={(e) => setVenueSearchTerm(e.target.value)}
                  placeholder="Search venue"
                  style={{ width: 140, minWidth: 120, padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 11 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {!selectedTitle ? (
                  <div style={{ color: '#64748b', padding: '4px 0', fontSize: 12 }}>Pick a title.</div>
                ) : venues.length === 0 ? (
                  <div style={{ color: '#64748b', padding: '4px 0', fontSize: 12 }}>No venues available.</div>
                ) : filteredVenues.length === 0 ? (
                  <div style={{ color: '#64748b', padding: '4px 0', fontSize: 12 }}>No venues match.</div>
                ) : (
                  filteredVenues.map((item) => {
                    const isActive = String(item.value) === String(selectedVenue)
                    const venueStatsData = venueStats[item.value] || {}
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleVenueChange(item.value)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 6,
                          width: '100%',
                          minHeight: 92,
                          border: isActive ? '1px solid #10b981' : '1px solid #e2e8f0',
                          background: isActive ? '#ecfdf5' : '#fff',
                          borderRadius: 12,
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 8px 20px rgba(16, 185, 129, 0.14)' : '0 3px 10px rgba(15, 23, 42, 0.05)',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12, lineHeight: 1.2 }}>{item.label}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {item.count !== undefined ? <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>{item.count} item{item.count === 1 ? '' : 's'}</span> : null}
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#fffbeb', color: '#b45309' }}>Absent: {venueStatsData.absentCount ?? '—'}</span>
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#fef2f2', color: '#b91c1c' }}>Replaced: {venueStatsData.replacedCount ?? '—'}</span>
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#ecfdf5', color: '#047857' }}>Reached: {venueStatsData.reachedCount ?? '—'}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div style={{minWidth: 240, border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 13 }}>Centre sheet</strong>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{centresList.length} item{centresList.length === 1 ? '' : 's'}</span>
                </div>
                <input
                  type="text"
                  value={centreSearchTerm}
                  onChange={(e) => setCentreSearchTerm(e.target.value)}
                  placeholder="Search centre"
                  style={{ width: 140, minWidth: 120, padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 11 }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {!selectedVenue ? (
                  <div style={{ color: '#64748b', padding: '4px 0', fontSize: 12 }}>Pick a venue.</div>
                ) : centresList.length === 0 ? (
                  <div style={{ color: '#64748b', padding: '4px 0', fontSize: 12 }}>No centres available.</div>
                ) : filteredCentres.length === 0 ? (
                  <div style={{ color: '#64748b', padding: '4px 0', fontSize: 12 }}>No centres match.</div>
                ) : (
                  filteredCentres.map((centre) => {
                    const code = centre.centreKey || centre.id || centre.code || ''
                    const name = centre.name || centre.centreName || centre.centre || ''
                    const label = code && name ? `${code} - ${name}` : (code || name || 'Unknown centre')
                    const centreKey = centre.centreKey || centre.id || centre.code || ''
                    const isActive = String(centreKey) === String(selectedCentre)
                    const centreStatsData = centreStats[centreKey] || {}
                    return (
                      <button
                        key={centreKey || centre.id}
                        type="button"
                        onClick={() => handleCentreChange(centreKey || 'ALL')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 6,
                          width: '100%',
                          minHeight: 68,
                          border: isActive ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                          background: isActive ? '#fffbeb' : '#fff',
                          borderRadius: 12,
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxShadow: isActive ? '0 8px 20px rgba(245, 158, 11, 0.14)' : '0 3px 10px rgba(15, 23, 42, 0.05)',
                        }}
                      >
                        <div
                          title={label}
                          style={{
                            fontWeight: 700,
                            color: '#0f172a',
                            fontSize: 12,
                            lineHeight: 1.2,
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#f8fafc', color: '#475569' }}>Centre</span>
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#fffbeb', color: '#b45309' }}>Absent: {centreStatsData.absentCount ?? '—'}</span>
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#fef2f2', color: '#b91c1c' }}>Replaced: {centreStatsData.replacedCount ?? '—'}</span>
                          <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 999, background: '#ecfdf5', color: '#047857' }}>Reached: {centreStatsData.reachedCount ?? '—'}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <LoadingOverlay active={loading} message="Loading dashboard data" />

            {!selectedTitle ? (
              <div style={{ color: '#64748b', padding: '12px 0' }}>Select a title to view verification KPIs.</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {renderKpiCard('Total Centres', summary.totalCentres, '#2563eb', () => {}, false)}
                  {renderKpiCard('Absent', summary.absentCount, '#f59e0b', () => triggerListView('absent'), activeView === 'absent')}
                  {renderKpiCard('Replaced', summary.replacedCount, '#ef4444', () => triggerListView('replaced'), activeView === 'replaced')}
                  {renderKpiCard('Reached', summary.reachedCount, '#10b981', () => triggerListView('reached'), activeView === 'reached')}
                </div>

                <div style={{ color: '#64748b', marginBottom: 8, fontSize: 12 }}>
                  Showing data for <strong>{activeTitleLabel || selectedTitle}</strong> / <strong>{activeVenueLabel || selectedVenue}</strong> / <strong>{selectedCentre === 'ALL' ? 'All centres' : selectedCentre}</strong>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={designationFilter}
                    onChange={(e) => handleDesignationChange(e.target.value)}
                    style={{ minWidth: 140, padding: '7px 8px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12, background: '#fff' }}
                  >
                    <option value="">All designations</option>
                    <option value="Operator">Operator</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={`Search ${activeView} records`}
                    style={{ flex: 1, minWidth: 220, padding: '7px 8px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12 }}
                  />
                  <Button onClick={handleSearch}>Search</Button>
                </div>

                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: 10, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 13 }}>
                    {activeView === 'absent' ? 'Absent records' : activeView === 'replaced' ? 'Replaced records' : 'Reached records'}
                  </div>
                  {listLoading ? (
                    <div style={{ padding: 20, color: '#64748b', fontSize: 12 }}>Loading {activeView} records...</div>
                  ) : (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {tableColumns.map((col) => (
                                <th key={col} style={{ textAlign: 'left', padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableRowsMapped.length === 0 ? (
                              <tr>
                                <td colSpan={tableColumns.length} style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                                  No {activeView} records found for this selection.
                                </td>
                              </tr>
                            ) : (
                              tableRowsMapped.map((row, idx) => (
                                <tr key={`${activeView}-${idx}`}>
                                  {row.map((cell, cellIdx) => (
                                    <td key={`${activeView}-${idx}-${cellIdx}`} style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: 12 }}>{cell}</td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderTop: '1px solid #e2e8f0', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>Show</span>
                            <select
                              value={pagination.limit}
                              onChange={(e) => handleEntriesChange(Number(e.target.value))}
                              style={{ padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' }}
                            >
                              {[10, 25, 50, 100].map((size) => (
                                <option key={size} value={size}>{size}</option>
                              ))}
                            </select>
                            <span>entries</span>
                          </label>
                          <span>
                            Showing {pagination.total ? Math.min((pagination.offset || 0) + 1, pagination.total) : 0} to {pagination.total ? Math.min((pagination.offset || 0) + tableRowsMapped.length, pagination.total) : 0} of {pagination.total || 0}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Button variant="outline" disabled={pagination.page <= 1} onClick={() => handlePageChange(1)}>First</Button>
                          <Button variant="outline" disabled={pagination.page <= 1} onClick={() => handlePageChange(pagination.page - 1)}>Previous</Button>
                          {pageWindow.map((pageNumber) => (
                            <button
                              key={pageNumber}
                              type="button"
                              onClick={() => handlePageChange(pageNumber)}
                              style={{
                                minWidth: 32,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: pagination.page === pageNumber ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                background: pagination.page === pageNumber ? '#eff6ff' : '#fff',
                                color: pagination.page === pageNumber ? '#2563eb' : '#0f172a',
                                cursor: 'pointer',
                                fontWeight: pagination.page === pageNumber ? 700 : 500,
                              }}
                            >
                              {pageNumber}
                            </button>
                          ))}
                          <Button variant="outline" disabled={pagination.page >= totalPages} onClick={() => handlePageChange(pagination.page + 1)}>Next</Button>
                          <Button variant="outline" disabled={pagination.page >= totalPages} onClick={() => handlePageChange(totalPages)}>Last</Button>
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
