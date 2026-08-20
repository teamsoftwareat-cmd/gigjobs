import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useNavigate, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { useAlert } from '../../context/AlertContext'
import { PageHeader, Card, DataTable } from '../../components/ui'

function useQuery() {
  return new URLSearchParams(useLocation().search)
}

const normalizeRowCount = (row, fields) => {
  for (const field of fields) {
    const value = row[field]
    if (value !== undefined && value !== null && value !== '') return Number(value)
  }
  return 0
}

const getDistrictId = (row) => row?.districtId || row?.district_id || row?.id || row?.district || row?.locationId || row?.location_id || row?.location || row?.location_name || row?.districtName || row?.district_name

const getDistrictName = (row) => row?.district || row?.district_name || row?.location || row?.location_name || row?.name || row?.label || 'Unknown'

const getCentreName = (row) => row?.centre_name || row?.centre || row?.location || row?.location_name || row?.name || row?.label || ''

const renderDesignationBreakdown = (breakdown) => {
  const list = Array.isArray(breakdown)
    ? breakdown
    : typeof breakdown === 'object' && breakdown
      ? Object.entries(breakdown).map(([designation, values]) => ({ designation, ...values }))
      : []

  if (list.length === 0) {
    return <div style={{ color: 'var(--text3)' }}>No designation details</div>
  }

  return (
    <div style={{ display: 'grid', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) repeat(2, auto)', gap: 12, fontWeight: 700, borderBottom: '1px solid rgba(26, 39, 64, 0.12)', paddingBottom: 6, color: 'var(--text)' }}>
        <div>Designation</div>
        <div style={{ textAlign: 'right' }}>Req</div>
        <div style={{ textAlign: 'right' }}>Avail</div>
      </div>
      {list.map((item, index) => {
        const designation = item.designation || item.name || item.label || 'Unknown'
        const required = normalizeRowCount(item, ['required', 'required_count', 'requiredCount', 'total_required'])
        const available = normalizeRowCount(item, ['available', 'available_count', 'availableCount', 'present', 'filled'])
        return (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) repeat(2, auto)', gap: 12, alignItems: 'center', color: 'var(--text)' }}>
            <div>{designation}</div>
            <div style={{ textAlign: 'right' }}>{required}</div>
            <div style={{ textAlign: 'right' }}>{available}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function ProjectStats() {
  const navigate = useNavigate()
  const query = useQuery()
  const projectId = query.get('projectId') || query.get('id')
  const projectType = query.get('projectType') === 'written' ? 'written' : 'regular'
  const { alert } = useAlert()

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [designation, setDesignation] = useState('')
  const [designationOptions, setDesignationOptions] = useState([])
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [viewMode, setViewMode] = useState(projectType === 'written' ? 'district' : 'location')
  const [currentDistrict, setCurrentDistrict] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [exportMode, setExportMode] = useState('separate')

  const fetchStats = useCallback(async () => {
    if (!projectId || viewMode === 'centre') return
    setLoading(true)
    try {
      const params = {
        from: fromDate || undefined,
        to: toDate || undefined,
        designation: designation || undefined,
        search: search || undefined,
        limit,
        offset,
      }

      const response = await recruiterAPI.getProjectStats(projectId, {
        ...params,
        projectType: projectType === 'written' ? 'written' : undefined,
      })

      const payload = response?.data ?? {}

      // Check if response is aggregated format: { designation, required, available, unfilled, data? }
      const isAggregatedResponse = (
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        payload.designation &&
        payload.required !== undefined &&
        payload.available !== undefined &&
        payload.unfilled !== undefined &&
        !payload.results && // Ensure it's not the regular multi-row response format
        !payload.meta // Ensure it's not wrapped with metadata
      )

      if (isAggregatedResponse) {
        // Set summary data for the aggregated response
        setSummaryData({
          designation: payload.designation,
          required: Number(payload.required) || 0,
          available: Number(payload.available) || 0,
          unfilled: Number(payload.unfilled) || 0,
        })
        
        // If data array is included, show centre-wise breakdown
        const centreList = Array.isArray(payload?.data) ? payload.data : []
        setRows(centreList)
        setTotal(centreList.length)
      } else {
        // Handle normal array response
        setSummaryData(null)
        const dataList = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
            ? payload.results
            : Array.isArray(payload)
              ? payload
              : []

        setRows(dataList)
        const totalCount = payload?.total ?? payload?.count ?? payload?.meta?.total ?? dataList.length
        setTotal(Number(totalCount) || 0)
      }
    } catch (error) {
      console.error('Failed to load project stats', error)
      alert('Unable to load stats. Please try again.')
      setRows([])
      setTotal(0)
      setSummaryData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, projectType, fromDate, toDate, designation, search, limit, offset, viewMode, alert])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (!projectId) return

    const loadDesignations = async () => {
      try {
        const response = await recruiterAPI.getDesignations(projectId)
        const payload = response?.data ?? response ?? []
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : []

        setDesignationOptions(list.map((item) => (typeof item === 'string' ? item : item.name || item.designation || '')).filter(Boolean))
      } catch (err) {
        console.warn('Failed to load designations:', err)
        setDesignationOptions([])
      }
    }

    loadDesignations()
  }, [projectId])

  const fetchDistrictStats = useCallback(async () => {
    if (!projectId || !currentDistrict || viewMode !== 'centre') return
    setLoading(true)
    try {
      const districtId = getDistrictId(currentDistrict)
      const response = await recruiterAPI.getProjectDistrictStats(projectId, districtId, {
        from: fromDate || undefined,
        to: toDate || undefined,
        designation: designation || undefined,
        search: search || undefined,
        limit,
        offset,
        projectType: projectType === 'written' ? 'written' : undefined,
      })
      const payload = response?.data ?? {}
      const centres = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : []

      setRows(centres)
      setTotal(centres.length)
    } catch (err) {
      console.error('Failed to load centres for district', err)
      alert('Unable to load centres for district')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [projectId, currentDistrict, viewMode, fromDate, toDate, designation, search, limit, offset, projectType, alert])

  const handleDrill = async (item) => {
    if (projectType !== 'written') return
    const districtId = getDistrictId(item)
    if (!districtId) return

    setCurrentDistrict(item)
    setViewMode('centre')
    setOffset(0)
  }

  const handleBack = () => {
    setCurrentDistrict(null)
    setViewMode('district')
    setOffset(0)
    fetchStats()
  }

  // Refetch district stats when filters change while in centre view
  useEffect(() => {
    fetchDistrictStats()
  }, [fetchDistrictStats])

  const viewLabel = projectType === 'written'
    ? viewMode === 'centre'
      ? `Centre-wise stats for ${currentDistrict?.district || currentDistrict?.district_name || currentDistrict?.name || 'selected district'}`
      : 'District-wise stats'
    : 'Location-wise stats'

  const isDesignationFiltered = Boolean(designation)
  const nameHeader = projectType === 'written'
    ? viewMode === 'centre'
      ? 'Centre'
      : 'District'
    : 'Location'

  const getDesignationCounts = (row) => {
    const breakdown = Array.isArray(row.designation_breakdown)
      ? row.designation_breakdown
      : Array.isArray(row.designations)
        ? row.designations
        : Array.isArray(row.designation)
          ? row.designation
          : Array.isArray(row.breakdown)
            ? row.breakdown
            : []

    const selected = (breakdown || []).find((item) => {
      const name = item.designation || item.name || item.label || ''
      return String(name).trim().toLowerCase() === String(designation).trim().toLowerCase()
    })

    if (selected) {
      const required = normalizeRowCount(selected, ['required', 'required_count', 'requiredCount', 'total_required'])
      const available = normalizeRowCount(selected, ['available', 'available_count', 'availableCount', 'present', 'filled'])
      return { required, available, unfilled: Math.max(0, required - available) }
    }

    const required = normalizeRowCount(row, ['required', 'required_count', 'requiredCount', 'total_required'])
    const available = normalizeRowCount(row, ['available', 'available_count', 'availableCount', 'present', 'filled'])
    return { required, available, unfilled: Math.max(0, required - available) }
  }

  const tableColumns = projectType === 'written'
    ? viewMode === 'centre'
      ? ['S.No', 'Centre', 'Photo', 'Required', 'Available', 'Unfilled', 'Designations']
      : ['S.No', 'District', 'Required', 'Available', 'Unfilled', 'Designations', 'Action']
    : ['S.No', 'Location', 'Required', 'Available', 'Unfilled', 'Designations']

  const totals = rows.reduce(
    (acc, r) => {
      const required = normalizeRowCount(r, ['required', 'required_count', 'requiredCount', 'total_required'])
      const available = normalizeRowCount(r, ['available', 'available_count', 'availableCount', 'present', 'filled'])
      const unfilled = Math.max(0, required - available)
      return {
        required: acc.required + required,
        available: acc.available + available,
        unfilled: acc.unfilled + unfilled,
      }
    },
    { required: 0, available: 0, unfilled: 0 }
  )

  const exportToExcel = async (mode = exportMode) => {
    setLoading(true)
    try {
      const wb = XLSX.utils.book_new()

      const fetchAllPages = async (call, params = {}) => {
        const allRows = []
        let offsetValue = 0
        const pageLimit = 1000
        while (true) {
          const response = await call({ ...params, limit: pageLimit, offset: offsetValue })
          const payload = response?.data ?? {}
          const pageRows = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.results)
              ? payload.results
              : Array.isArray(payload)
                ? payload
                : []
          if (!pageRows.length) break
          allRows.push(...pageRows)
          if (pageRows.length < pageLimit) break
          offsetValue += pageLimit
        }
        return allRows
      }

      const getRoleCounts = (row, roleNames) => {
        for (const role of roleNames) {
          const req = normalizeRowCount(row, [
            `${role}_required`, `${role}Required`, `${role}req`, `${role}_req`, `${role}Req`, `${role}required`, `${role}_count`, `${role}Count`
          ])
          const present = normalizeRowCount(row, [
            `${role}_present`, `${role}Present`, `${role}_available`, `${role}Available`, `${role}present`, `${role}present_count`, `${role}presentCount`
          ])
          if (req || present) {
            const absent = req ? Math.max(0, req - present) : normalizeRowCount(row, [`${role}_absent`, `${role}Absent`, `${role}_absent_count`, `${role}absent`])
            return { req, present, absent }
          }
        }

        const breakdown = Array.isArray(row.designation_breakdown)
          ? row.designation_breakdown
          : Array.isArray(row.designations)
            ? row.designations
            : Array.isArray(row.breakdown)
              ? row.breakdown
              : []
        if (breakdown.length) {
          for (const item of breakdown) {
            const name = (item.designation || item.name || '').toString().toLowerCase()
            if (roleNames.some((r) => name.includes(r))) {
              const req = normalizeRowCount(item, ['required', 'required_count', 'requiredCount', 'total_required'])
              const present = normalizeRowCount(item, ['present', 'present_count', 'presentCount', 'available', 'available_count'])
              const absent = normalizeRowCount(item, ['absent', 'absent_count']) || (req ? Math.max(0, req - present) : 0)
              return { req, present, absent }
            }
          }
        }

        const totalReq = normalizeRowCount(row, ['required', 'required_count', 'requiredCount', 'total_required'])
        const totalPresent = normalizeRowCount(row, ['present', 'present_count', 'presentCount', 'available', 'filled'])
        const req = totalReq
        const present = totalPresent
        const absent = req ? Math.max(0, req - present) : 0
        return { req, present, absent }
      }

      const districtRows = await fetchAllPages((params) => recruiterAPI.getProjectStats(projectId, params), {
        from: fromDate || undefined,
        to: toDate || undefined,
        designation: designation || undefined,
        search: search || undefined,
        projectType: projectType === 'written' ? 'written' : undefined,
      })

      if (mode === 'single') {
        const allCentres = []
        for (const districtRow of districtRows) {
          const districtId = getDistrictId(districtRow)
          const districtName = getDistrictName(districtRow)
          if (!projectId || !districtId) continue

          const centres = await fetchAllPages((params) => recruiterAPI.getProjectDistrictStats(projectId, districtId, params), {
            from: fromDate || undefined,
            to: toDate || undefined,
            designation: designation || undefined,
            search: search || undefined,
            projectType: projectType === 'written' ? 'written' : undefined,
          })

          centres.forEach((centre) => {
            allCentres.push({ ...centre, __districtName: districtName })
          })
        }

        const sortedCentres = allCentres.slice().sort((a, b) => {
          const centreA = String(getCentreName(a) || '').toLocaleLowerCase()
          const centreB = String(getCentreName(b) || '').toLocaleLowerCase()
          const centreDiff = centreA.localeCompare(centreB)
          if (centreDiff !== 0) return centreDiff

          const districtA = String(a.__districtName || getDistrictName(a) || '').toLocaleLowerCase()
          const districtB = String(b.__districtName || getDistrictName(b) || '').toLocaleLowerCase()
          return districtA.localeCompare(districtB)
        })

        const sheet = []
        sheet.push(['', '', '', 'Supervisor', '', '', 'Operator', '', ''])
        sheet.push(['S.No', 'District', 'Centre', 'Req', 'PRESENT', 'ABSENT', 'Req', 'PRESENT', 'ABSENT'])
        sortedCentres.forEach((centre, index) => {
          const districtName = centre.__districtName || getDistrictName(centre) || 'Unknown'
          const name = getCentreName(centre)
          const sup = getRoleCounts(centre, ['supervisor', 'sup'])
          const op = getRoleCounts(centre, ['operator', 'op'])
          sheet.push([index + 1, districtName, name, sup.req || 0, sup.present || 0, sup.absent || 0, op.req || 0, op.present || 0, op.absent || 0])
        })

        const totalSupReq = sortedCentres.reduce((acc, centre) => acc + (getRoleCounts(centre, ['supervisor', 'sup']).req || 0), 0)
        const totalSupPresent = sortedCentres.reduce((acc, centre) => acc + (getRoleCounts(centre, ['supervisor', 'sup']).present || 0), 0)
        const totalSupAbsent = sortedCentres.reduce((acc, centre) => acc + (getRoleCounts(centre, ['supervisor', 'sup']).absent || 0), 0)
        const totalOpReq = sortedCentres.reduce((acc, centre) => acc + (getRoleCounts(centre, ['operator', 'op']).req || 0), 0)
        const totalOpPresent = sortedCentres.reduce((acc, centre) => acc + (getRoleCounts(centre, ['operator', 'op']).present || 0), 0)
        const totalOpAbsent = sortedCentres.reduce((acc, centre) => acc + (getRoleCounts(centre, ['operator', 'op']).absent || 0), 0)
        sheet.push([])
        sheet.push(['Total', '', '', totalSupReq, totalSupPresent, totalSupAbsent, totalOpReq, totalOpPresent, totalOpAbsent])

        const ws = XLSX.utils.aoa_to_sheet(sheet)
        ws['!merges'] = [
          { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
          { s: { r: 0, c: 6 }, e: { r: 0, c: 8 } },
        ]
        XLSX.utils.book_append_sheet(wb, ws, 'All Centres')
      } else {
        const header1 = ['', '', 'Supervisor', '', '', 'Operator', '', '']
        const header2 = ['S.No', 'District', 'Req', 'PRESENT', 'ABSENT', 'Req', 'PRESENT', 'ABSENT']
        const districtSheet = [header1, header2]

        const districtMap = {}
        const districtOrder = []
        districtRows.forEach((r) => {
          const id = getDistrictId(r) || getDistrictName(r)
          const name = getDistrictName(r)
          if (!districtMap[id]) {
            districtMap[id] = { id, name, rows: [] }
            districtOrder.push(id)
          }
          districtMap[id].rows.push(r)
        })

        districtOrder.forEach((districtKey, idx) => {
          const districtData = districtMap[districtKey]
          const first = districtData.rows[0] || {}
          const sup = getRoleCounts(first, ['supervisor', 'sup'])
          const op = getRoleCounts(first, ['operator', 'op'])
          districtSheet.push([idx + 1, districtData.name, sup.req || 0, sup.present || 0, sup.absent || 0, op.req || 0, op.present || 0, op.absent || 0])
        })

        const totalSupReq = districtOrder.reduce((acc, key) => acc + (getRoleCounts(districtMap[key].rows[0] || {}, ['supervisor', 'sup']).req || 0), 0)
        const totalSupPresent = districtOrder.reduce((acc, key) => acc + (getRoleCounts(districtMap[key].rows[0] || {}, ['supervisor', 'sup']).present || 0), 0)
        const totalSupAbsent = districtOrder.reduce((acc, key) => acc + (getRoleCounts(districtMap[key].rows[0] || {}, ['supervisor', 'sup']).absent || 0), 0)
        const totalOpReq = districtOrder.reduce((acc, key) => acc + (getRoleCounts(districtMap[key].rows[0] || {}, ['operator', 'op']).req || 0), 0)
        const totalOpPresent = districtOrder.reduce((acc, key) => acc + (getRoleCounts(districtMap[key].rows[0] || {}, ['operator', 'op']).present || 0), 0)
        const totalOpAbsent = districtOrder.reduce((acc, key) => acc + (getRoleCounts(districtMap[key].rows[0] || {}, ['operator', 'op']).absent || 0), 0)
        districtSheet.push([])
        districtSheet.push(['Total', '', totalSupReq, totalSupPresent, totalSupAbsent, totalOpReq, totalOpPresent, totalOpAbsent])

        const wsDistrict = XLSX.utils.aoa_to_sheet(districtSheet)
        wsDistrict['!merges'] = [
          { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } },
          { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } },
        ]
        XLSX.utils.book_append_sheet(wb, wsDistrict, 'District Status')

        for (const districtKey of districtOrder) {
          const districtData = districtMap[districtKey]
          const first = districtData.rows[0] || {}
          const districtId = getDistrictId(first)
          let centres = []

          if (projectId && districtId) {
            centres = await fetchAllPages((params) => recruiterAPI.getProjectDistrictStats(projectId, districtId, params), {
              from: fromDate || undefined,
              to: toDate || undefined,
              designation: designation || undefined,
              search: search || undefined,
              projectType: projectType === 'written' ? 'written' : undefined,
            })
          }

          if (!centres || centres.length === 0) continue

          const sheet = []
          sheet.push(['', '', 'Supervisor', '', '', 'Operator', '', ''])
          sheet.push(['S.No', 'Centre', 'Req', 'PRESENT', 'ABSENT', 'Req', 'PRESENT', 'ABSENT'])
          centres.forEach((c, i) => {
            const name = getCentreName(c)
            const sup = getRoleCounts(c, ['supervisor', 'sup'])
            const op = getRoleCounts(c, ['operator', 'op'])
            sheet.push([i + 1, name, sup.req || 0, sup.present || 0, sup.absent || 0, op.req || 0, op.present || 0, op.absent || 0])
          })

          const ws = XLSX.utils.aoa_to_sheet(sheet)
          ws['!merges'] = [
            { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } },
            { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } },
          ]
          const safeName = (districtData.name || districtKey || 'Sheet').toString().slice(0, 28) + ' Centres'
          XLSX.utils.book_append_sheet(wb, ws, safeName)
        }
      }

      const fileName = `project-${projectId || 'stats'}-${mode === 'single' ? 'single-centres' : 'separate-centres'}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (err) {
      console.error('Export failed', err)
      alert('Failed to export Excel file')
    } finally {
      setLoading(false)
    }
  }

  const tableRows = rows.map((r, idx) => {
    const name = viewMode === 'centre'
      ? r.centre_name || r.centre || r.district || r.district_name || r.location || r.location_name || r.name || r.label || 'Unknown'
      : r.district || r.district_name || r.location || r.location_name || r.centre || r.centre_name || r.name || r.label || 'Unknown'
    const required = normalizeRowCount(r, ['required', 'required_count', 'requiredCount', 'total_required'])
    const available = normalizeRowCount(r, ['available', 'available_count', 'availableCount', 'present', 'filled'])
    const unfilled = Math.max(0, required - available)
    const breakdown = r.designation_breakdown || r.designations || r.designation || r.breakdown || []
    const action = viewMode === 'district'
      ? <button className="btn btn-outline btn-sm" type="button" onClick={() => handleDrill(r)}>View centres</button>
      : null

    const nameCell = viewMode === 'centre'
      ? (
        <div style={{ maxWidth: 240, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', color: 'var(--text)' }}>
          {name}
        </div>
      )
      : name

    const photoUrl = viewMode === 'centre' ? (r.group_photo || r.groupPhoto || r.photo || r.image || null) : null
    const photoCell = viewMode === 'centre'
      ? photoUrl ? (
        <img
          src={photoUrl}
          alt="Group Photo"
          style={{
            maxWidth: '80px',
            maxHeight: '80px',
            borderRadius: '4px',
            objectFit: 'cover',
            cursor: 'pointer'
          }}
          title="Click to expand"
          onClick={() => {
            const modal = document.createElement('div')
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;'
            modal.innerHTML = `<div style="max-width:90vw;max-height:90vh;"><img src="${photoUrl}" style="max-width:100%;max-height:100%;border-radius:8px;" /><button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:20px;right:20px;background:#fff;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;">Close</button></div>`
            document.body.appendChild(modal)
          }}
        />
      ) : (
        <span style={{ color: 'var(--text2)', fontSize: '12px' }}>—</span>
      )
      : null

    const row = [
      offset + idx + 1,
      nameCell,
    ]

    if (viewMode === 'centre') {
      row.push(photoCell)
    }

    row.push(
      required,
      available,
      unfilled,
      renderDesignationBreakdown(breakdown),
    )

    if (viewMode === 'district') {
      row.push(action)
    }

    return row.slice(0, tableColumns.length)
  })

  // Add totals row
  const totalsRow = [
    <strong style={{ color: 'var(--text)', minWidth: '100px', display: 'block' }}>Total</strong>,
    '',
  ]
  if (viewMode === 'centre') {
    totalsRow.push('') // Empty cell for photo column
  }
  totalsRow.push(
    <strong style={{ color: 'var(--text)' }}>{totals.required}</strong>,
    <strong style={{ color: 'var(--text)' }}>{totals.available}</strong>,
    <strong style={{ color: 'var(--text)' }}>{totals.unfilled}</strong>,
    '',
  )
  if (viewMode === 'district') {
    totalsRow.push('')
  }
  tableRows.push(totalsRow.slice(0, tableColumns.length))

  const renderDesignationTable = () => {
    const headingLabel = designation || 'Designation'
    const actionCol = viewMode === 'district'
    const nameCellStyle = viewMode === 'centre'
      ? { maxWidth: 240, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', color: 'var(--text)' }
      : { color: 'var(--text)' }

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th rowSpan="2">S.No</th>
              <th rowSpan="2">{nameHeader}</th>
              <th colSpan="3" style={{ textAlign: 'center', color: 'var(--text)' }}>{headingLabel}</th>
              {actionCol && <th rowSpan="2">Action</th>}
            </tr>
            <tr>
              <th style={{ textAlign: 'right', color: 'var(--text)' }}>Req</th>
              <th style={{ textAlign: 'right', color: 'var(--text)' }}>Avail</th>
              <th style={{ textAlign: 'right', color: 'var(--text)' }}>Unfilled</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={actionCol ? 6 : 5} style={{ textAlign: 'center', color: 'var(--text2)', padding: '24px' }}>
                  {loading ? 'Loading stats…' : 'No data available.'}
                </td>
              </tr>
            ) : rows.map((r, idx) => {
              const name = viewMode === 'centre'
                ? r.centre_name || r.centre || r.district || r.district_name || r.location || r.location_name || r.name || r.label || 'Unknown'
                : r.district || r.district_name || r.location || r.location_name || r.centre || r.centre_name || r.name || r.label || 'Unknown'
              const { required, available, unfilled } = getDesignationCounts(r)
              const action = viewMode === 'district'
                ? <button className="btn btn-outline btn-sm" type="button" onClick={() => handleDrill(r)}>View centres</button>
                : null

              return (
                <tr key={idx}>
                  <td style={{ color: 'var(--text)' }}>{offset + idx + 1}</td>
                  <td><div style={nameCellStyle}>{name}</div></td>
                  <td style={{ textAlign: 'right', color: 'var(--text)' }}>{required}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text)' }}>{available}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text)' }}>{unfilled}</td>
                  {actionCol && <td>{action}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderSummary = () => {
    if (!summaryData || loading) return null

    const fillPercentage = summaryData.required > 0 
      ? Math.round((summaryData.available / summaryData.required) * 100)
      : 0
    const unfillPercentage = 100 - fillPercentage

    return (
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{
            padding: 16,
            border: '1px solid rgba(26, 39, 64, 0.12)',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Required</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)' }}>{summaryData.required}</div>
          </div>
          <div style={{
            padding: 16,
            border: '1px solid rgba(26, 39, 64, 0.12)',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Available</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>{summaryData.available}</div>
          </div>
          <div style={{
            padding: 16,
            border: '1px solid rgba(26, 39, 64, 0.12)',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Unfilled</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--danger)' }}>{summaryData.unfilled}</div>
          </div>
          <div style={{
            padding: 16,
            border: '1px solid rgba(26, 39, 64, 0.12)',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Fill Rate</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>{fillPercentage}%</div>
          </div>
        </div>

        {/* Fill Distribution Bar */}
        <div style={{ padding: 16, border: '1px solid rgba(26, 39, 64, 0.12)', borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 12, fontWeight: 600 }}>Fill Distribution</div>
          <div style={{ display: 'flex', gap: 8, height: 24, borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                flex: fillPercentage,
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: 'white',
              }}
            >
              {fillPercentage > 10 && `${fillPercentage}%`}
            </div>
            <div
              style={{
                flex: unfillPercentage,
                backgroundColor: 'rgba(220, 53, 69, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--danger)',
              }}
            >
              {unfillPercentage > 10 && `${unfillPercentage}%`}
            </div>
          </div>
        </div>

        {/* Centre-wise Breakdown Table */}
        {rows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ color: 'var(--text)', marginBottom: 12, fontSize: 16, fontWeight: 600 }}>Centre-wise Breakdown</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Centre/District</th>
                    <th style={{ textAlign: 'center' }}>Photo</th>
                    <th style={{ textAlign: 'right' }}>Required</th>
                    <th style={{ textAlign: 'right' }}>Available</th>
                    <th style={{ textAlign: 'right' }}>Unfilled</th>
                    <th style={{ textAlign: 'right' }}>Fill %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const name = r.centre_name || r.centre || r.district || r.district_name || r.location || r.location_name || r.name || 'Unknown'
                    const required = normalizeRowCount(r, ['required', 'required_count', 'requiredCount', 'total_required'])
                    const available = normalizeRowCount(r, ['available', 'available_count', 'availableCount', 'present', 'filled'])
                    const unfilled = Math.max(0, required - available)
                    const fillPct = required > 0 ? Math.round((available / required) * 100) : 0
                    const photoUrl = r.group_photo || r.groupPhoto || r.photo || r.image || null
                    return (
                      <tr key={idx}>
                        <td style={{ color: 'var(--text)' }}>{offset + idx + 1}</td>
                        <td><div style={{ maxWidth: 240, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', color: 'var(--text)' }}>{name}</div></td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt="Group Photo"
                              style={{
                                maxWidth: '80px',
                                maxHeight: '80px',
                                borderRadius: '4px',
                                objectFit: 'cover',
                                cursor: 'pointer'
                              }}
                              title="Click to expand"
                              onClick={() => {
                                const modal = document.createElement('div')
                                modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;'
                                modal.innerHTML = `<div style="max-width:90vw;max-height:90vh;"><img src="${photoUrl}" style="max-width:100%;max-height:100%;border-radius:8px;" /><button onclick="this.parentElement.parentElement.remove()" style="position:absolute;top:20px;right:20px;background:#fff;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;">Close</button></div>`
                                document.body.appendChild(modal)
                              }}
                            />
                          ) : (
                            <span style={{ color: 'var(--text2)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text)' }}>{required}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text)' }}>{available}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text)' }}>{unfilled}</td>
                        <td style={{ textAlign: 'right', color: fillPct >= 80 ? 'var(--primary)' : 'var(--danger)' }}>{fillPct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, color: 'var(--text2)', fontSize: 12 }}>
              Showing {Math.min(total, offset + 1)}–{Math.min(total, offset + limit)} of {total} centres
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="project-stats-page">
      <PageHeader title="Project Stats" subtitle={`${viewLabel} — Project ${projectId || 'unknown'}`} />
      <Card>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {projectType === 'written' && viewMode === 'centre' && (
            <button className="btn btn-outline btn-sm" type="button" onClick={handleBack}>
              <FontAwesomeIcon icon={faArrowLeft} /> Back to districts
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 240 }}>
            <FontAwesomeIcon icon={faSearch} />
            <input
              className="form-control"
              placeholder="Search districts/locations…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 240 }}>
            <div>
              <div className="filter-label">From</div>
              <input className="form-control" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setOffset(0) }} />
            </div>
            <div>
              <div className="filter-label">To</div>
              <input className="form-control" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setOffset(0) }} />
            </div>
            <div>
              <div className="filter-label">Designation</div>
              <select className="form-control" value={designation} onChange={(e) => { setDesignation(e.target.value); setOffset(0) }}>
                <option value="">All designations</option>
                {designationOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'flex-end' }}>
            <select className="form-control" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0) }}>
              <option value={10}>10 entries</option>
              <option value={20}>20 entries</option>
              <option value={50}>50 entries</option>
            </select>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => {
              setFromDate('')
              setToDate('')
              setDesignation('')
              setSearch('')
              setOffset(0)
            }}>
              Clear
            </button>
            <select className="form-control" value={exportMode} onChange={(e) => setExportMode(e.target.value)}>
              <option value="separate">Separate centres</option>
              <option value="single">Single centres</option>
            </select>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => exportToExcel(exportMode)} disabled={rows.length === 0}>
              Export Excel
            </button>
          </div>
        </div>

        {summaryData ? (
          renderSummary()
        ) : isDesignationFiltered ? (
          renderDesignationTable()
        ) : (
          <DataTable columns={tableColumns} rows={loading ? [] : tableRows} emptyMessage={loading ? 'Loading stats…' : 'No data available.'} />
        )}

        <div style={{ marginTop: 12, marginBottom: 12, color: 'var(--text2)', fontSize: 12 }}>
          {summaryData ? (
            rows.length > 0 
              ? `Aggregated stats for ${summaryData.designation} — Showing ${Math.min(total, offset + 1)}–${Math.min(total, offset + limit)} of ${total} centres`
              : `Aggregated stats for ${summaryData.designation}`
          ) : (
            `Showing ${Math.min(total, offset + 1)}–${Math.min(total, offset + limit)} of ${total} rows`
          )}
        </div>

        {!summaryData && !isDesignationFiltered && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Showing <strong>{Math.min(total, offset + 1)}</strong>-<strong>{Math.min(total, offset + limit)}</strong> of <strong>{total}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {Math.ceil(total / limit) <= 5 ? (
                  Array.from({ length: Math.ceil(total / limit) }, (_, i) => i).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`btn btn-sm ${offset === pageNum * limit ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setOffset(pageNum * limit)}
                    >
                      {pageNum + 1}
                    </button>
                  ))
                ) : (
                  <>
                    {offset > 0 && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOffset(0)}>1</button>
                    )}
                    {offset > limit * 2 && <span style={{ color: 'var(--text2)' }}>…</span>}
                    {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i)
                      .filter((i) => i * limit >= offset - limit && i * limit <= offset + limit * 2)
                      .map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          className={`btn btn-sm ${offset === pageNum * limit ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setOffset(pageNum * limit)}
                        >
                          {pageNum + 1}
                        </button>
                      ))}
                    {offset < (Math.ceil(total / limit) - 3) * limit && <span style={{ color: 'var(--text2)' }}>…</span>}
                    {offset < (Math.ceil(total / limit) - 1) * limit && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setOffset((Math.ceil(total / limit) - 1) * limit)}
                      >
                        {Math.ceil(total / limit)}
                      </button>
                    )}
                  </>
                )}
              </div>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
